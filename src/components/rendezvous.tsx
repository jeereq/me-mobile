import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { api } from '@/lib/api';
import { today } from '@/lib/dates';
import { evenementDeAgenda } from '@/lib/externe';
import { useStore } from '@/lib/store';
import type { AgendaDispo, CompteConnecte } from '@/lib/sync';
import { C } from '@/lib/theme';
import type { Evenement } from '@/lib/types';

import { Btn, Dialogue, Input, Seg, T } from './ui';

/**
 * Créer, modifier ou supprimer un rendez-vous dans un agenda connecté, depuis Me.
 * Les agendas proposés sont ceux du compte choisi ; le rendez-vous part chez Google ou Microsoft,
 * et le compte est relu tout de suite pour que le calendrier de Me l'affiche.
 */

/** La date écrite en toutes lettres sous le champ, pour vérifier d'un coup d'œil qu'on n'a pas tapé à côté. */
function lisible(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Écris la date sous la forme AAAA-MM-JJ.';
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'Cette date n’existe pas.';
  const long = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return long.charAt(0).toUpperCase() + long.slice(1);
}

/** Comptes qui acceptent qu'on écrive dans leur agenda. */
export const comptesAgenda = (externes: CompteConnecte[]) => externes.filter((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft');

export function FormRendezvous({ date, evenement, onFermer }: { date: string; /** Rendez-vous importé à modifier ; absent, on en crée un. */ evenement?: Evenement; onFermer: () => void }) {
  const { externes, session, synchroniser } = useStore();
  const token = session?.token;
  const comptes = comptesAgenda(externes);
  const refEvt = evenement?.id ? evenementDeAgenda(evenement.id) : null;

  const [compte, setCompte] = useState(() => refEvt?.compte || comptes[0]?.id || '');
  const [agendas, setAgendas] = useState<AgendaDispo[] | null>(null);
  const [agendaId, setAgendaId] = useState(refEvt?.agenda || '');
  const [titre, setTitre] = useState(evenement?.titre || '');
  const [jour, setJour] = useState(date || today());
  const [journee, setJournee] = useState(evenement ? evenement.debut === 'Journée' : false);
  const [debut, setDebut] = useState(evenement && evenement.debut !== 'Journée' ? evenement.debut : '09:00');
  const [fin, setFin] = useState(evenement?.fin || '');
  const [lieu, setLieu] = useState(evenement?.lieu || '');
  const [busy, setBusy] = useState<'' | 'enregistre' | 'supprime'>('');
  const [msg, setMsg] = useState('');

  // Changer de compte remet la liste des agendas en chargement (ajusté pendant le rendu, sans effet).
  const [compteVu, setCompteVu] = useState(compte);
  if (compte !== compteVu) {
    setCompteVu(compte);
    setAgendas(null);
  }
  useEffect(() => {
    if (!compte || !token) return;
    let vivant = true;
    api<{ agendas: AgendaDispo[]; choisis: string[] }>(`/integrations/${compte}/agendas`, { token })
      .then((r) => {
        if (!vivant) return;
        setAgendas(r.agendas);
        setAgendaId((a) => (a && r.agendas.some((x) => x.id === a) ? a : (r.agendas.find((x) => x.principal) || r.agendas[0])?.id || ''));
      })
      .catch((e: Error) => {
        if (!vivant) return;
        setAgendas([]);
        setMsg(e.message);
      });
    return () => {
      vivant = false;
    };
  }, [compte, token]);

  const corps = () => ({ agendaId, titre, date: jour, lieu: lieu.trim() || undefined, ...(journee ? { journee: true } : { debut, ...(fin.trim() ? { fin: fin.trim() } : {}) }) });

  const enregistrer = async () => {
    if (!token) return;
    setBusy('enregistre');
    setMsg('');
    try {
      if (refEvt) await api(`/integrations/${compte}/agenda`, { method: 'PATCH', body: { ...corps(), id: refEvt.evenement }, token });
      else await api(`/integrations/${compte}/agenda`, { method: 'POST', body: corps(), token });
      await synchroniser(true);
      onFermer();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const supprimer = async () => {
    if (!token || !refEvt) return;
    setBusy('supprime');
    setMsg('');
    try {
      await api(`/integrations/${compte}/agenda/supprimer`, { method: 'POST', body: { agendaId: refEvt.agenda, id: refEvt.evenement }, token });
      await synchroniser(true);
      onFermer();
    } catch (e) {
      setMsg((e as Error).message);
      setBusy('');
    }
  };

  if (!comptes.length)
    return (
      <Dialogue titre="Nouveau rendez-vous" onFermer={onFermer}>
        <T>Connecte un compte Google ou Microsoft dans Agendas & outils pour écrire dans ton agenda depuis Me.</T>
        <Btn kind="sec" label="Fermer" onPress={onFermer} />
      </Dialogue>
    );

  return (
    <Dialogue titre={refEvt ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'} onFermer={onFermer}>
      {comptes.length > 1 && !refEvt ? <Seg label="Compte" options={comptes.map((c) => ({ key: c.id, label: c.compte }))} value={compte} onChange={setCompte} /> : null}
      {agendas === null ? (
        <T small muted>Chargement des agendas…</T>
      ) : agendas.length ? (
        <Seg label="Agenda" options={agendas.slice(0, 6).map((a) => ({ key: a.id, label: a.nom }))} value={agendaId} onChange={setAgendaId} />
      ) : (
        <T small muted>Aucun agenda accessible sur ce compte.</T>
      )}
      <Input label="Titre" value={titre} onChangeText={setTitre} placeholder="Ex. Réunion équipe" />
      <Input label="Jour" value={jour} onChangeText={setJour} placeholder="2026-10-27" aide={lisible(jour)} keyboardType="numbers-and-punctuation" />
      <Seg label="Durée" options={[{ key: 'heure', label: 'À une heure' }, { key: 'journee', label: 'Journée entière' }]} value={journee ? 'journee' : 'heure'} onChange={(k) => setJournee(k === 'journee')} />
      {!journee ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input label="Début" value={debut} onChangeText={setDebut} placeholder="09:00" keyboardType="numbers-and-punctuation" />
          <Input label="Fin" value={fin} onChangeText={setFin} placeholder="+ 1 h" aide="Vide = une heure" keyboardType="numbers-and-punctuation" />
        </View>
      ) : null}
      <Input label="Lieu" value={lieu} onChangeText={setLieu} placeholder="Bureau, lien de visio…" />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={busy === 'enregistre' ? 'Enregistrement…' : refEvt ? 'Enregistrer' : 'Créer le rendez-vous'} disabled={!!busy || !titre.trim() || !agendaId} onPress={enregistrer} />
        <Btn kind="sec" label="Annuler" onPress={onFermer} />
        {refEvt ? <Btn kind="danger" label={busy === 'supprime' ? 'Suppression…' : 'Supprimer'} disabled={!!busy} onPress={supprimer} /> : null}
      </View>
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
      <T small muted>
        Le rendez-vous est écrit dans l'agenda choisi, chez {comptes.find((c) => c.id === compte)?.fournisseur === 'microsoft' ? 'Microsoft' : 'Google'}. Il revient ensuite dans le calendrier de Me.
      </T>
    </Dialogue>
  );
}
