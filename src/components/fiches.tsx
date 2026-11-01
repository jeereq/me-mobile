import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '@/lib/api';
import { useActions } from '@/lib/actions';
import { addDays, fmtCourt, today } from '@/lib/dates';
import { tacheDeListe } from '@/lib/externe';
import { replanifier } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { etatRelance, rangerDansProjet } from '@/lib/suivi';
import { teinteDe } from '@/lib/teinte';
import { alpha, C, F } from '@/lib/theme';
import type { Boite, Mode, Priorite, Relance, Tache } from '@/lib/types';

import { ChoixAffectation, MailDeTache } from './affectation';
import { ChoixCategories } from './categories';
import { ComptesRendusElement } from './comptes-rendus';
import { DatePick, Importante, ModePick, PlusOptions } from './forms';
import { MailDeLElement } from './lien-mail';
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
  const { statutRelance } = useActions();
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
  const etat = etatRelance(r, today());
  const repondu = r.statut === 'repondu';
  const agir = (f: () => void) => () => {
    f();
    onFermer();
  };
  const reporter = (jours: number) => update((e) => ({ ...e, relances: e.relances.map((x) => (x.id === r.id ? { ...x, date: addDays(today(), jours) } : x)) }));
  const coul = teinteDe('/relances');
  return (
    <Dialogue titre={`${r.contact} · ${r.sujet}`} onFermer={onFermer}>
      <View style={{ gap: 4, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: alpha(etat.niveau === 'retard' ? C.agressif : etat.niveau === 'fait' ? C.coach : C.line, 0.5), backgroundColor: alpha(etat.niveau === 'retard' ? C.agressif : etat.niveau === 'fait' ? C.coach : C.ink, 0.06) }}>
        <Text style={{ color: etat.niveau === 'retard' ? C.agressif : C.ink, fontFamily: F.texteF, fontSize: 15 }}>{etat.texte}</Text>
        {histoire ? <T small muted>{histoire}</T> : null}
      </View>
      {repondu ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn kind="sec" label="Rouvrir la relance" onPress={agir(() => statutRelance(r, 'a_faire'))} />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn label="Relancer" couleur={coul} onPress={agir(() => router.push({ pathname: '/brouillon', params: { id: r.id } }))} />
            <Btn kind="sec" label={`${r.contact} a répondu`} onPress={agir(() => statutRelance(r, 'repondu'))} />
            <Btn kind="sec" label="Relancé autrement" onPress={agir(() => statutRelance(r, 'relance'))} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <T small muted>Reporter :</T>
            <Btn small kind="sec" label="Demain" onPress={agir(() => reporter(1))} />
            <Btn small kind="sec" label="Dans 3 jours" onPress={agir(() => reporter(3))} />
            <Btn small kind="sec" label="+1 semaine" onPress={agir(() => reporter(7))} />
          </View>
        </>
      )}
      <MailDeLElement genre="relance" x={r} />
      <Input label="Qui ?" value={contact} onChangeText={setContact} placeholder="Ex. Marie, cabinet Dupont" />
      <Input label="À quel sujet ?" value={sujet} onChangeText={setSujet} placeholder="Ex. Devis du site web" />
      <DatePick label={r.statut === 'relance' ? 'Relancer à nouveau le' : 'Relancer le'} value={date} onChange={setDate} />
      <Seg label="Pour" options={[{ key: 'pro', label: 'Pro' }, { key: 'perso', label: 'Perso' }]} value={boite} onChange={setBoite} />
      <ModePick value={mode} onChange={setMode} config={config} />
      <PlusOptions resume={[note.trim() ? 'note' : '', cats?.length ? 'catégorie' : ''].filter(Boolean).join(', ')} ouvert={!!note.trim()}>
        <Input label="Note" value={note} onChangeText={setNote} placeholder="Ce qu'il faut savoir avant de relancer : montant, promesse, interlocuteur…" multiline style={{ minHeight: 70, textAlignVertical: 'top' }} aide="Reprise par Me quand il rédige la relance." />
        <ChoixAffectation t={affectation} genre="relance" onChoisir={(p) => setAffectation((a) => ({ ...a, ...p }))} />
        <ChoixCategories value={cats} onChange={setCats} />
        <ComptesRendusElement genre="relance" id={r.id} origine={r.compteRendu} onOuvrir={onFermer} />
      </PlusOptions>
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
    <Dialogue titre="La tâche" onFermer={onFermer}>
      {t.statut === 'fait' && t.faitLe ? <T small muted>{`Terminée le ${fmtCourt(t.faitLe)}`}</T> : null}
      <Input label="Que faut-il faire ?" value={titre} onChangeText={setTitre} placeholder="Ex. Envoyer le contrat signé" />
      <DatePick label="Pour quand ?" value={echeance} onChange={setEcheance} allowNone />
      <Seg label="Pour" options={[{ key: 'pro', label: 'Pro' }, { key: 'perso', label: 'Perso' }, { key: 'manuel', label: 'Autre' }]} value={source} onChange={setSource} />
      <Importante value={priorite === 'haute'} onChange={(v) => setPriorite(v ? 'haute' : t.priorite === 'haute' ? 'moyenne' : t.priorite)} />
      <MailDeLElement genre="tache" x={t} />
      <Input label="Note" value={note} onChangeText={setNote} placeholder="Détails, liens, ce qui bloque…" multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <PlusOptions resume={[cats?.length ? 'catégorie' : '', affectation.affecteA ? 'confiée' : ''].filter(Boolean).join(', ')}>
        <ChoixAffectation t={affectation} onChoisir={(p) => setAffectation((a) => ({ ...a, ...p }))} />
        {projets.length ? (
          <View style={{ gap: 4 }}>
            <Seg label="Projet" options={[{ key: '', label: 'Aucun' }, ...projets.map((p) => ({ key: p.id, label: `${p.emoji} ${p.nom}` }))]} value={projet} onChange={setProjet} />
            {choixProjet ? <T small muted>{`La tâche passera dans le planning de « ${choixProjet.nom} »${echeance ? `, à la date du ${fmtCourt(echeance)}` : ''}, et se suivra dans l'écran Projets.`}</T> : null}
          </View>
        ) : null}
        <ChoixCategories value={cats} onChange={setCats} />
        <ModePick value={mode} onChange={setMode} config={config} />
        <ComptesRendusElement genre="tache" id={t.id} origine={t.compteRendu} onOuvrir={onFermer} />
      </PlusOptions>
      <Btn small kind="sec" label="Écrire un mail à ce sujet" onPress={() => setMail(true)} disabled={!titrePropre} />
      <Boutons enregistrer={enregistrer} valide={!!titrePropre} fermer={onFermer} supprimer={supprimer} />
    </Dialogue>
  );
}
