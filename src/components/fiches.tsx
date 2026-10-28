import { useState } from 'react';
import { View } from 'react-native';

import { api } from '@/lib/api';
import { fmtCourt, today } from '@/lib/dates';
import { tacheDeListe } from '@/lib/externe';
import { replanifier } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { rangerDansProjet } from '@/lib/suivi';
import type { Boite, Mode, Priorite, Relance, Tache } from '@/lib/types';

import { ChoixAffectation, MailDeTache } from './affectation';
import { ChoixCategories } from './categories';
import { ComptesRendusElement } from './comptes-rendus';
import { DatePick, ModePick } from './forms';
import { Btn, Dialogue, Input, Seg, T } from './ui';

/**
 * Les fiches qui modifient une relance ou une tâche après coup : tout ce qu'on a saisi à la création,
 * plus une note libre. Une tâche peut aussi être rangée dans un projet (ou en sortir).
 */

/** Une note vide disparaît de l'élément au lieu de rester en chaîne vide. */
const avecNote = <X extends { note?: string }>(x: X, note: string): X => {
  const { note: _n, ...reste } = x;
  return (note.trim() ? { ...reste, note: note.trim() } : reste) as X;
};
/** Les clés à `undefined` sont retirées (confier à « Personne » retire le responsable). */
const sansVide = <X extends object>(o: X) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as X;
const avecCategories = <X extends { categories?: string[] }>(x: X, ids?: string[]): X => {
  const { categories: _c, ...reste } = x;
  return (ids?.length ? { ...reste, categories: ids } : reste) as X;
};

function Boutons({ enregistrer, valide, fermer, supprimer }: { enregistrer: () => void; valide: boolean; fermer: () => void; supprimer: () => void }) {
  const [confirmer, setConfirmer] = useState(false);
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Btn label="Enregistrer" onPress={enregistrer} disabled={!valide} />
      <Btn kind="sec" label="Annuler" onPress={fermer} />
      {confirmer ? <Btn kind="danger" label="Supprimer pour de bon" onPress={supprimer} /> : <Btn kind="danger" label="Supprimer" onPress={() => setConfirmer(true)} />}
    </View>
  );
}

/** Ce qui s'est passé : création, relances faites, réponse. */
function historiqueRelance(r: Relance): string {
  const morceaux = [r.creeLe ? `Créée le ${fmtCourt(r.creeLe.slice(0, 10))}` : ''];
  if (r.nbRelances) morceaux.push(`relancée ${r.nbRelances} fois${r.derniereRelance ? `, la dernière le ${fmtCourt(r.derniereRelance)}` : ''}`);
  else if (r.statut === 'relance') morceaux.push('relancée');
  if (r.statut === 'repondu' && r.reponduLe) morceaux.push(`réponse reçue le ${fmtCourt(r.reponduLe)}`);
  return morceaux.filter(Boolean).join(' · ');
}

export function FicheRelance({ r, onFermer }: { r: Relance; onFermer: () => void }) {
  const { update, config } = useStore();
  const [contact, setContact] = useState(r.contact);
  const [sujet, setSujet] = useState(r.sujet);
  const [boite, setBoite] = useState<Boite>(r.boite);
  const [date, setDate] = useState<string | null>(r.date);
  const [mode, setMode] = useState<Mode>(r.mode);
  const [cats, setCats] = useState<string[] | undefined>(r.categories);
  const [note, setNote] = useState(r.note ?? '');
  const [affectation, setAffectation] = useState<{ affecteA?: string; responsable?: string }>({ affecteA: r.affecteA, responsable: r.responsable });

  const enregistrer = () => {
    update((e) => ({ ...e, relances: e.relances.map((x) => (x.id === r.id ? sansVide({ ...avecCategories(avecNote({ ...x, contact: contact.trim(), sujet: sujet.trim(), boite, date: date || x.date, mode }, note), cats), ...affectation }) : x)) }));
    onFermer();
  };
  const supprimer = () => {
    update((e) => ({ ...e, relances: e.relances.filter((x) => x.id !== r.id) }));
    onFermer();
  };
  const histoire = historiqueRelance(r);
  return (
    <Dialogue titre="Modifier la relance" onFermer={onFermer}>
      {histoire ? <T small muted>{histoire}</T> : null}
      <Input label="Qui ?" value={contact} onChangeText={setContact} placeholder="Ex. Marie, cabinet Dupont" />
      <Input label="À quel sujet ?" value={sujet} onChangeText={setSujet} placeholder="Ex. Devis du site web" />
      <Seg label="Boîte" options={[{ key: 'perso', label: 'Perso' }, { key: 'pro', label: 'Pro' }]} value={boite} onChange={setBoite} />
      <DatePick label={r.statut === 'relance' ? 'Relancer à nouveau le' : 'Relancer le'} value={date} onChange={setDate} />
      <Input label="Note" value={note} onChangeText={setNote} placeholder="Ce qu'il faut savoir avant de relancer : montant, promesse, interlocuteur…" multiline style={{ minHeight: 70, textAlignVertical: 'top' }} aide="Reprise par l'IA quand elle rédige la relance." />
      <ChoixAffectation t={affectation} genre="relance" onChoisir={(p) => setAffectation((a) => ({ ...a, ...p }))} />
      <ChoixCategories value={cats} onChange={setCats} />
      <ModePick value={mode} onChange={setMode} config={config} />
      <ComptesRendusElement genre="relance" id={r.id} origine={r.compteRendu} onOuvrir={onFermer} />
      <Boutons enregistrer={enregistrer} valide={!!contact.trim() && !!sujet.trim()} fermer={onFermer} supprimer={supprimer} />
    </Dialogue>
  );
}

export function FicheTache({ t, onFermer }: { t: Tache; onFermer: () => void }) {
  const { espace, update, config, session } = useStore();
  const [titre, setTitre] = useState(t.titre);
  const [source, setSource] = useState<Tache['source']>(t.source);
  const [priorite, setPriorite] = useState<Priorite>(t.priorite);
  const [echeance, setEcheance] = useState<string | null>(t.echeance);
  const [mode, setMode] = useState<Mode>(t.mode);
  const [cats, setCats] = useState<string[] | undefined>(t.categories);
  const [note, setNote] = useState(t.note ?? '');
  const [projet, setProjet] = useState(t.projet ?? '');
  const [affectation, setAffectation] = useState<{ affecteA?: string; responsable?: string }>({ affecteA: t.affecteA, responsable: t.responsable });
  const [mail, setMail] = useState(false);
  const projets = (espace.projets ?? []).filter((p) => !p.archive);
  // Une tâche de liste (Google Tasks, To Do) se modifie aussi à la source ; les autres ne vivent que dans Me.
  const liste = tacheDeListe(t.id);
  const titrePropre = titre.trim();

  const enregistrer = () => {
    update((e) => {
      // `affecteA` et `responsable` à undefined sont retirés de la tâche (confier à « Personne »).
      let taches = e.taches.map((x) => (x.id === t.id ? sansVide({ ...avecCategories(avecNote({ ...x, titre: titrePropre, source, priorite, echeance, mode }, note), cats), ...affectation }) : x));
      if ((t.projet ?? '') !== projet) {
        taches = rangerDansProjet(taches, t.id, projet || null);
        const p = e.projets?.find((x) => x.id === projet);
        if (p) taches = replanifier(taches, p, today());
      }
      return { ...e, taches };
    });
    if (liste && session?.token && (titrePropre !== t.titre || echeance !== t.echeance))
      api(`/integrations/${liste.compte}/taches`, { method: 'PATCH', body: { listeId: liste.liste, id: liste.tache, titre: titrePropre, echeance, fait: t.statut === 'fait' }, token: session.token, discret: true }).catch(() => {});
    onFermer();
  };
  const supprimer = () => {
    update((e) => ({ ...e, taches: e.taches.filter((x) => x.id !== t.id) }));
    onFermer();
  };
  const choixProjet = projet && projet !== (t.projet ?? '') ? projets.find((p) => p.id === projet) : undefined;
  // Le mail reprend ce qui est saisi dans la fiche, même avant « Enregistrer ».
  if (mail) return <MailDeTache t={{ titre: titrePropre || t.titre, echeance, note, ...affectation }} onFermer={() => setMail(false)} />;
  return (
    <Dialogue titre="Modifier la tâche" onFermer={onFermer}>
      {t.statut === 'fait' && t.faitLe ? <T small muted>{`Terminée le ${fmtCourt(t.faitLe)}`}</T> : null}
      <Input label="Que faut-il faire ?" value={titre} onChangeText={setTitre} placeholder="Ex. Envoyer le contrat signé" />
      <Seg label="Origine" options={[{ key: 'perso', label: 'Mail perso' }, { key: 'pro', label: 'Mail pro' }, { key: 'manuel', label: 'Autre' }]} value={source} onChange={setSource} />
      <Seg label="Priorité" options={[{ key: 'haute', label: 'Haute' }, { key: 'moyenne', label: 'Moyenne' }, { key: 'basse', label: 'Basse' }]} value={priorite} onChange={setPriorite} />
      <DatePick label="Échéance" value={echeance} onChange={setEcheance} allowNone />
      <ChoixAffectation t={affectation} onChoisir={(p) => setAffectation((a) => ({ ...a, ...p }))} />
      <Input label="Note" value={note} onChangeText={setNote} placeholder="Détails, liens, ce qui bloque…" multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      {projets.length ? (
        <View style={{ gap: 4 }}>
          <Seg label="Projet" options={[{ key: '', label: 'Aucun' }, ...projets.map((p) => ({ key: p.id, label: `${p.emoji} ${p.nom}` }))]} value={projet} onChange={setProjet} />
          {choixProjet ? <T small muted>{`La tâche passera dans le planning de « ${choixProjet.nom} »${echeance ? `, à la date du ${fmtCourt(echeance)}` : ''}, et se suivra dans l'écran Projets.`}</T> : null}
        </View>
      ) : null}
      <ChoixCategories value={cats} onChange={setCats} />
      <ModePick value={mode} onChange={setMode} config={config} />
      <ComptesRendusElement genre="tache" id={t.id} origine={t.compteRendu} onOuvrir={onFermer} />
      <Btn small kind="sec" label="✉️ Écrire un mail à ce sujet" onPress={() => setMail(true)} disabled={!titrePropre} />
      <Boutons enregistrer={enregistrer} valide={!!titrePropre} fermer={onFermer} supprimer={supprimer} />
    </Dialogue>
  );
}
