import { useState } from 'react';
import { View } from 'react-native';

import { today } from '@/lib/dates';
import { proprietaireParDefaut } from '@/lib/equipe-taches';
import { avecRdv, erreurRdv, idRdvLocal, rdvDeSaisie, sansRdv } from '@/lib/rdv-equipe';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import type { Evenement } from '@/lib/types';

import { ChoixAffectation } from './affectation';
import { Btn, Dialogue, Input, Seg, T } from './ui';

/** La date écrite en toutes lettres sous le champ, pour vérifier d'un coup d'œil qu'on n'a pas tapé à côté. */
function lisible(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Écris la date sous la forme AAAA-MM-JJ.';
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'Cette date n’existe pas.';
  const long = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return long.charAt(0).toUpperCase() + long.slice(1);
}

/**
 * Un rendez-vous créé dans Me, dans l'agenda de l'équipe, avec la personne à qui il est confié. Les agendas connectés
 * (Google, Microsoft) n'alimentent que l'espace personnel : sans cela, une équipe n'aurait aucun rendez-vous.
 * La personne choisie en est prévenue par le serveur, comme pour une tâche. Par défaut, le rendez-vous est à son créateur.
 */
export function FormRdvEquipe({ date, evenement, jourActuel, onFermer }: { date: string; /** Rendez-vous à modifier ; absent, on en crée un. */ evenement?: Evenement; /** Son jour actuel, quand on le modifie. */ jourActuel?: string; onFermer: () => void }) {
  const { equipeActive, session, update } = useStore();
  const membres = equipeActive?.membres ?? [];
  const [titre, setTitre] = useState(evenement?.titre ?? '');
  const [jour, setJour] = useState(jourActuel || date || today());
  const [journee, setJournee] = useState(evenement ? evenement.debut === 'Journée' : false);
  const [debut, setDebut] = useState(evenement && evenement.debut !== 'Journée' ? evenement.debut : '09:00');
  const [fin, setFin] = useState(evenement?.fin ?? '');
  const [lieu, setLieu] = useState(evenement?.lieu ?? '');
  const [proprio, setProprio] = useState<{ affecteA?: string; responsable?: string }>(() => (evenement ? { affecteA: evenement.affecteA, responsable: evenement.responsable } : proprietaireParDefaut(membres, session?.user.id)));
  const [msg, setMsg] = useState('');

  const enregistrer = () => {
    const saisie = { titre, jour, journee, debut, fin };
    const erreur = erreurRdv(saisie);
    if (erreur) return setMsg(erreur);
    const propre = { ...(proprio.affecteA ? { affecteA: proprio.affecteA } : {}), ...(proprio.responsable ? { responsable: proprio.responsable } : {}) };
    const ev = rdvDeSaisie(evenement?.id ?? idRdvLocal(), saisie, lieu, propre);
    update((e) => ({ ...e, agenda: avecRdv(e.agenda ?? {}, jour, ev) }));
    onFermer();
  };
  const supprimer = () => {
    if (!evenement?.id) return;
    update((e) => ({ ...e, agenda: sansRdv(e.agenda ?? {}, evenement.id!) }));
    onFermer();
  };

  return (
    <Dialogue titre={evenement ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'} onFermer={onFermer}>
      <Input label="Titre" value={titre} onChangeText={setTitre} placeholder="Ex. Point client" autoFocus={!evenement} />
      <Input label="Jour" value={jour} onChangeText={setJour} placeholder="2026-10-27" aide={lisible(jour)} keyboardType="numbers-and-punctuation" />
      <Seg label="Durée" options={[{ key: 'heure', label: 'À une heure' }, { key: 'journee', label: 'Journée entière' }]} value={journee ? 'journee' : 'heure'} onChange={(k) => setJournee(k === 'journee')} />
      {!journee ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input label="Début" value={debut} onChangeText={setDebut} placeholder="09:00" keyboardType="numbers-and-punctuation" />
          <Input label="Fin" value={fin} onChangeText={setFin} placeholder="10:00" aide="Facultatif" keyboardType="numbers-and-punctuation" />
        </View>
      ) : null}
      <Input label="Lieu" value={lieu} onChangeText={setLieu} placeholder="Bureau, lien de visio…" />
      <ChoixAffectation t={proprio} genre="rdv" onChoisir={(p) => setProprio((a) => ({ ...a, ...p }))} />
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={evenement ? 'Enregistrer' : 'Créer le rendez-vous'} disabled={!titre.trim()} onPress={enregistrer} />
        <Btn kind="sec" label="Annuler" onPress={onFermer} />
        {evenement ? <Btn kind="danger" label="Supprimer" onPress={supprimer} /> : null}
      </View>
      <T small muted>Ce rendez-vous est gardé dans l’agenda de l’équipe, dans Me. Il ne s’écrit pas dans Google ou Microsoft.</T>
    </Dialogue>
  );
}
