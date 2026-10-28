import { router, type Href } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { analyserCompteRendu } from '@/lib/assistant';
import { tRelance, tTache, useActions } from '@/lib/actions';
import { celebrer } from '@/lib/celebration';
import {
  annulerOuverture,
  candidatsCloture,
  clotureParCR,
  comptesRendusDe,
  comptesRendusLies,
  deRef,
  etatCompteRendu,
  fusionnerActions,
  genreCR,
  GENRES_CR,
  lireAction,
  lireNotes,
  majCompteRendu,
  noterClotures,
  ouvrirActions,
  rapprocherFaits,
  supprimerCompteRendu,
  titreParDefaut,
  type Candidat,
} from '@/lib/comptes-rendus';
import { cle } from '@/lib/copilote';
import { fmtCourt, today, uid } from '@/lib/dates';
import { resumes } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { ActionCompteRendu, CompteRendu, Espace } from '@/lib/types';

import { ChoixCategories } from './categories';
import { BadgePro, Case, teinteCopilote, useCopiloteVisible } from './copilote';
import { Puce } from './finances-plus';
import { DatePick } from './forms';
import { Icone } from './icones';
import { SousOnglets } from './onglets';
import { SqueletteReponse } from './squelettes';
import { Btn, Colonnes, Dialogue, Empty, IconBtn, Input, Panel, Sep, T } from './ui';

/** Où ouvrir une tâche, une relance ou un projet depuis un compte rendu. */
export function lienVers(e: Pick<Espace, 'taches'>, genre: 'tache' | 'relance' | 'projet', id: string): Href {
  if (genre === 'projet') return { pathname: '/projets', params: { id } } as Href;
  if (genre === 'relance') return '/relances';
  const t = e.taches.find((x) => x.id === id);
  return (t?.projet ? { pathname: '/projets', params: { id: t.projet } } : '/taches') as Href;
}

export const ouvrirCR = (id: string) => router.push({ pathname: '/comptes-rendus', params: { id } } as Href);
/** Un nouveau compte rendu déjà rattaché à un projet, une tâche ou une relance. */
export const nouveauCR = (lien?: { projet?: string; tache?: string; relance?: string }) => router.push({ pathname: '/comptes-rendus', params: { nouveau: '1', ...lien } } as Href);

const titreCR = (cr: CompteRendu, e: Espace) => cr.titre.trim() || titreParDefaut(cr, e);

/* ——— Le lien, vu depuis une tâche ou une relance ——— */

/** « 📝 Réunion · Site » sous une tâche ou une relance née d'un compte rendu (ou clôturée par lui) : ouvre le compte rendu. */
export function EtiquetteCR({ genre, id, origine }: { genre: 'tache' | 'relance'; id: string; origine?: string }) {
  const { espace } = useStore();
  const cr = (origine && comptesRendusDe(espace).find((x) => x.id === origine)) || clotureParCR(espace, genre, id);
  if (!cr) return null;
  const clos = !(origine && cr.id === origine);
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${clos ? 'Clôturée par' : 'Issue de'} ${titreCR(cr, espace)}`} onPress={() => ouvrirCR(cr.id)} hitSlop={6} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: alpha(C.normal, 0.12), opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ fontSize: 11 }}>📝</Text>
      <Text numberOfLines={1} style={{ maxWidth: 180, color: C.normal, fontFamily: F.texteM, fontSize: 12 }}>
        {clos ? 'Clos · ' : ''}
        {titreCR(cr, espace)}
      </Text>
    </Pressable>
  );
}

/** Le résumé d'un compte rendu en une ligne : « 2 à ouvrir · 3 en cours · 1 clôturé ». */
export function suiviCR(cr: CompteRendu, e: Espace) {
  const s = etatCompteRendu(cr, e);
  return [s.aConvertir ? `${s.aConvertir} à ouvrir` : '', s.enCours ? `${s.enCours} en cours` : '', s.terminees ? `${s.terminees} terminé${s.terminees > 1 ? 's' : ''}` : '', s.clos ? `${s.clos} clôturé${s.clos > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ');
}

/** Une ligne de liste : genre, titre, date, rattachements et suivi. */
export function LigneCR({ cr, onPress }: { cr: CompteRendu; onPress?: () => void }) {
  const { espace } = useStore();
  const g = genreCR(cr.genre);
  const suivi = suiviCR(cr, espace);
  const s = etatCompteRendu(cr, espace);
  const liens = [...(cr.projets ?? []).map((id) => espace.projets?.find((p) => p.id === id)).filter(Boolean).map((p) => `${p!.emoji} ${p!.nom}`), ...(cr.relances ?? []).map((id) => espace.relances.find((r) => r.id === id)?.contact).filter(Boolean)];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${titreCR(cr, espace)}`} onPress={onPress ?? (() => ouvrirCR(cr.id))} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.sunk, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 19 }}>{g.emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>
          {titreCR(cr, espace)}
        </Text>
        <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
          {fmtCourt(cr.date)}
          {liens.length ? ` · ${liens.slice(0, 2).join(', ')}` : ''}
        </Text>
        {suivi ? <Text style={{ color: s.aConvertir ? C.hebdo : C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{suivi}</Text> : null}
      </View>
      <Text style={{ color: C.accent, fontSize: 20 }}>›</Text>
    </Pressable>
  );
}

/** Le panneau « Comptes rendus » d'un projet : les derniers, et « + Compte rendu » déjà rattaché. */
export function ComptesRendusProjet({ projet }: { projet: string }) {
  const { espace } = useStore();
  const liste = comptesRendusLies(espace, 'projet', projet);
  return (
    <Panel title="Comptes rendus" count={liste.length || undefined} right={<Btn small kind="sec" label="+ Compte rendu" onPress={() => nouveauCR({ projet })} />}>
      {liste.length ? (
        liste.slice(0, 5).map((cr, i) => (
          <View key={cr.id}>
            {i ? <Sep /> : null}
            <LigneCR cr={cr} />
          </View>
        ))
      ) : (
        <Empty icone="livre">Note ici tes réunions et points d’avancement : tu y clôtures les tâches réglées et tu ouvres celles qui en sortent.</Empty>
      )}
      {liste.length > 5 ? (
        <Pressable accessibilityRole="link" onPress={() => router.push('/comptes-rendus')}>
          <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Voir les {liste.length} comptes rendus ›</Text>
        </Pressable>
      ) : null}
    </Panel>
  );
}

/** Dans la fiche d'une tâche ou d'une relance : ses comptes rendus, et « + Compte rendu » déjà rattaché à elle. */
export function ComptesRendusElement({ genre, id, origine, onOuvrir }: { genre: 'tache' | 'relance'; id: string; origine?: string; /** Ferme la fiche avant d'aller au compte rendu. */ onOuvrir: () => void }) {
  const { espace } = useStore();
  const liste = comptesRendusLies(espace, genre, id, origine);
  return (
    <View style={{ gap: 6 }}>
      <T small muted>
        Comptes rendus
      </T>
      {liste.slice(0, 3).map((cr) => (
        <LigneCR key={cr.id} cr={cr} onPress={() => (onOuvrir(), ouvrirCR(cr.id))} />
      ))}
      <View style={{ flexDirection: 'row' }}>
        <Btn small kind="sec" label="+ Compte rendu" onPress={() => (onOuvrir(), nouveauCR(genre === 'tache' ? { tache: id } : { relance: id }))} />
      </View>
    </View>
  );
}

/* ——— Rattacher à des projets, tâches et relances ——— */

type Onglet = 'projets' | 'taches' | 'relances';

function ChoisirLiens({ cr, onFermer }: { cr: CompteRendu; onFermer: () => void }) {
  const { espace, update } = useStore();
  const [onglet, setOnglet] = useState<Onglet>('projets');
  const [q, setQ] = useState('');
  const ok = (s: string) => cle(s).includes(cle(q));
  const parents = resumes(espace.taches);
  const lignes: { id: string; titre: string; detail?: string }[] =
    onglet === 'projets'
      ? (espace.projets ?? []).filter((p) => !p.archive && ok(p.nom)).map((p) => ({ id: p.id, titre: `${p.emoji} ${p.nom}` }))
      : onglet === 'taches'
        ? espace.taches
            .filter((t) => (t.statut !== 'fait' || cr.taches?.includes(t.id)) && !parents.has(t.id) && ok(t.titre))
            .slice(0, 60)
            .map((t) => ({ id: t.id, titre: t.titre, detail: t.projet ? espace.projets?.find((p) => p.id === t.projet)?.nom : t.echeance ? `Pour le ${fmtCourt(t.echeance)}` : undefined }))
        : espace.relances.filter((r) => (r.statut !== 'repondu' || cr.relances?.includes(r.id)) && ok(`${r.contact} ${r.sujet}`)).slice(0, 60).map((r) => ({ id: r.id, titre: `${r.contact} · ${r.sujet}`, detail: `Le ${fmtCourt(r.date)}` }));
  const choisis = new Set(cr[onglet] ?? []);
  const basculer = (id: string) =>
    update((e) =>
      majCompteRendu(e, cr.id, (x) => {
        const s = new Set(x[onglet] ?? []);
        if (s.has(id)) s.delete(id);
        else s.add(id);
        return { ...x, [onglet]: [...s] };
      }),
    );
  return (
    <Dialogue titre="Rattacher le compte rendu" onFermer={onFermer}>
      <SousOnglets label="Rattacher à" options={[{ key: 'projets', label: 'Projets' }, { key: 'taches', label: 'Tâches' }, { key: 'relances', label: 'Relances' }]} value={onglet} onChange={setOnglet} />
      <Input value={q} onChangeText={(v: string) => setQ(v)} placeholder="Chercher" accessibilityLabel="Chercher" />
      {lignes.length ? (
        <View style={{ gap: 6 }}>
          {lignes.map((l) => {
            const on = choisis.has(l.id);
            return (
              <Pressable key={l.id} accessibilityRole="checkbox" aria-checked={on} accessibilityState={{ checked: on }} onPress={() => basculer(l.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, backgroundColor: on ? alpha(C.accent, 0.1) : C.sunk, opacity: pressed ? 0.85 : 1 })}>
                <Case on={on} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>
                    {l.titre}
                  </Text>
                  {l.detail ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{l.detail}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Empty>{q ? 'Rien ne correspond.' : onglet === 'projets' ? 'Aucun projet en cours.' : onglet === 'taches' ? 'Aucune tâche ouverte.' : 'Aucune relance ouverte.'}</Empty>
      )}
      <Btn label="Terminé" onPress={onFermer} />
    </Dialogue>
  );
}

function Rattachements({ cr }: { cr: CompteRendu }) {
  const { espace, update } = useStore();
  const [choisir, setChoisir] = useState(false);
  const puces = [
    ...(cr.projets ?? []).map((id) => ({ genre: 'projets' as const, id, label: (() => { const p = espace.projets?.find((x) => x.id === id); return p ? `${p.emoji} ${p.nom}` : null; })(), href: lienVers(espace, 'projet', id) })),
    ...(cr.taches ?? []).map((id) => ({ genre: 'taches' as const, id, label: espace.taches.find((x) => x.id === id)?.titre ?? null, href: lienVers(espace, 'tache', id) })),
    ...(cr.relances ?? []).map((id) => ({ genre: 'relances' as const, id, label: (() => { const r = espace.relances.find((x) => x.id === id); return r ? `↻ ${r.contact} · ${r.sujet}` : null; })(), href: lienVers(espace, 'relance', id) })),
  ].filter((p) => p.label);
  const retirer = (genre: Onglet, id: string) => update((e) => majCompteRendu(e, cr.id, (x) => ({ ...x, [genre]: (x[genre] ?? []).filter((y) => y !== id) })));
  return (
    <View style={{ gap: 6 }}>
      <T small muted>
        Rattaché à
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {puces.map((p) => (
          <View key={`${p.genre}:${p.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 10, paddingRight: 4, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk }}>
            <Pressable accessibilityRole="link" onPress={() => router.push(p.href)}>
              <Text numberOfLines={1} style={{ maxWidth: 220, color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>
                {p.label}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Détacher ${p.label}`} onPress={() => retirer(p.genre, p.id)} hitSlop={8} style={{ paddingHorizontal: 5 }}>
              <Text style={{ color: C.muted, fontSize: 14 }}>×</Text>
            </Pressable>
          </View>
        ))}
        <Puce label="+ Projet, tâche ou relance" on={false} onPress={() => setChoisir(true)} />
      </View>
      {choisir ? <ChoisirLiens cr={cr} onFermer={() => setChoisir(false)} /> : null}
    </View>
  );
}

/* ——— Le compte rendu ——— */

const AIDE_NOTES = `Décisions
- On garde la date du 15 novembre
Actions
- @Paul envoyer le devis vendredi
- Relancer Marie lundi pour la facture
Fait
- ✓ Maquette validée`;

/** Une case dans le style du copilote, avec son texte et ses détails. */
function LigneCase({ on, off, onPress, titre, details, barre, droite, label }: { on: boolean; off?: boolean; onPress?: () => void; titre: string; details?: (string | false | null | undefined)[]; barre?: boolean; droite?: ReactNode; label?: string }) {
  const t = teinteCopilote();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        accessibilityRole="checkbox"
        aria-checked={on}
        accessibilityState={{ checked: on, disabled: off }}
        accessibilityLabel={label ?? titre}
        disabled={off || !onPress}
        onPress={onPress}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: on && !off ? t.ligne : C.line, backgroundColor: on && !off ? t.douce : C.sunk, opacity: pressed ? 0.85 : 1 })}>
        <View style={{ paddingTop: 1 }}>
          <Case on={on} off={off} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: off ? C.muted : C.ink, fontFamily: F.texteM, fontSize: 15, textDecorationLine: barre ? 'line-through' : 'none' }}>{titre}</Text>
          {details?.filter(Boolean).length ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{details.filter(Boolean).join(' · ')}</Text> : null}
        </View>
      </Pressable>
      {droite}
    </View>
  );
}

const dateCourte = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '');

function PointsAction({ cr }: { cr: CompteRendu }) {
  const { espace, update, config } = useStore();
  const t = teinteCopilote();
  const [exclus, setExclus] = useState<Set<string>>(new Set());
  const [nouveau, setNouveau] = useState('');
  const [dansProjet, setDansProjet] = useState(true);
  const [annuler, setAnnuler] = useState<{ genre: 'tache' | 'relance'; id: string }[]>([]);
  useEffect(() => {
    if (!annuler.length) return;
    const x = setTimeout(() => setAnnuler([]), 8000);
    return () => clearTimeout(x);
  }, [annuler]);
  const libres = cr.actions.filter((a) => !a.cree);
  const coches = libres.filter((a) => !exclus.has(a.id));
  const projet = cr.projets?.length === 1 ? espace.projets?.find((p) => p.id === cr.projets![0]) : undefined;
  const etat = (a: ActionCompteRendu) => {
    const x = a.genre === 'tache' ? espace.taches.find((y) => y.id === a.cree) : espace.relances.find((y) => y.id === a.cree);
    if (!x) return null;
    return 'statut' in x && (x.statut === 'fait' || x.statut === 'repondu') ? 'fait' : 'ouvert';
  };

  const ouvrir = (ids: string[]) => {
    const d = today();
    // Les identifiants sont tirés avant : la mise à jour peut être rejouée, elle crée alors les mêmes éléments.
    const reserve = ids.map(() => uid());
    const opts = (i = { n: 0 }) => ({ id: () => reserve[i.n++] ?? uid(), maintenant: new Date().toISOString(), d, modeTache: config.defauts.tache, modeRelance: config.defauts.relance, boite: 'pro' as const, projet: dansProjet ? projet?.id : undefined });
    const { crees } = ouvrirActions(espace, cr.id, ids, opts());
    update((e) => ouvrirActions(e, cr.id, ids, opts()).espace);
    if (!crees.length) return;
    setAnnuler(crees);
    const nt = crees.filter((c) => c.genre === 'tache').length;
    const nr = crees.length - nt;
    celebrer({ type: 'message', emoji: '✅', texte: [nt ? `${nt} tâche${nt > 1 ? 's' : ''}` : '', nr ? `${nr} relance${nr > 1 ? 's' : ''}` : ''].filter(Boolean).join(' et ') + (crees.length > 1 ? ' ouvertes' : ' ouverte') });
  };
  const ajouter = () => {
    const a = lireAction(nouveau, today());
    if (!a) return;
    update((e) => majCompteRendu(e, cr.id, (x) => ({ ...x, actions: fusionnerActions(x, [a], uid) })));
    setNouveau('');
  };
  const retirer = (id: string) => update((e) => majCompteRendu(e, cr.id, (x) => ({ ...x, actions: x.actions.filter((a) => a.id !== id) })));
  const basculer = (id: string) =>
    setExclus((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Panel title="Ce qui s’ouvre" count={cr.actions.length || undefined}>
      <T small muted>
        Les tâches et relances qui sortent de l’échange. Elles gardent le lien vers ce compte rendu.
      </T>
      {cr.actions.length ? (
        <View style={{ gap: 6 }}>
          {cr.actions.map((a) => {
            const e = a.cree ? etat(a) : null;
            const quoi = a.genre === 'relance' ? `Relance · ${a.contact}` : 'Tâche';
            return (
              <LigneCase
                key={a.id}
                on={a.cree ? true : !exclus.has(a.id)}
                off={!!a.cree}
                barre={e === 'fait'}
                onPress={a.cree ? undefined : () => basculer(a.id)}
                titre={a.titre}
                label={`${quoi} : ${a.titre}`}
                details={[quoi, a.responsable && `@${a.responsable}`, a.echeance && `pour le ${dateCourte(a.echeance)}`, a.priorite === 'haute' && 'urgent', e === 'fait' ? 'terminée' : e === 'ouvert' ? 'ouverte' : a.cree ? 'supprimée depuis' : undefined]}
                droite={
                  a.cree && e ? (
                    <IconBtn label="Voir" glyph="↗" onPress={() => router.push(lienVers(espace, a.genre, a.cree!))} />
                  ) : !a.cree ? (
                    <IconBtn label={`Retirer ${a.titre}`} glyph="×" onPress={() => retirer(a.id)} />
                  ) : null
                }
              />
            );
          })}
        </View>
      ) : (
        <Empty icone="taches">Aucun point d’action pour l’instant. Lis tes notes, ou ajoute-les ci-dessous.</Empty>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Input value={nouveau} onChangeText={(v: string) => setNouveau(v)} placeholder="Envoyer le devis vendredi, Relancer Marie lundi…" returnKeyType="done" onSubmitEditing={ajouter} accessibilityLabel="Nouveau point d’action" />
        </View>
        <Btn kind="sec" label="Ajouter" onPress={ajouter} disabled={!nouveau.trim()} />
      </View>
      {projet && libres.some((a) => a.genre === 'tache') ? (
        <Pressable accessibilityRole="checkbox" aria-checked={dansProjet} onPress={() => setDansProjet(!dansProjet)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Case on={dansProjet} />
          <T small>{`Mettre les tâches dans le projet ${projet.emoji} ${projet.nom}`}</T>
        </Pressable>
      ) : null}
      {annuler.length ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: alpha(C.coach, 0.12) }}>
          <Text style={{ flex: 1, minWidth: 150, color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>{annuler.length > 1 ? `${annuler.length} éléments ouverts` : 'Élément ouvert'}</Text>
          <Pressable accessibilityRole="button" onPress={() => (update((e) => annulerOuverture(e, cr.id, annuler)), setAnnuler([]))} hitSlop={8}>
            <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 13 }}>Annuler</Text>
          </Pressable>
        </View>
      ) : libres.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn couleur={t.c} label={`Tout ouvrir (${libres.length})`} onPress={() => ouvrir(libres.map((a) => a.id))} />
          {coches.length && coches.length < libres.length ? <Btn couleur={t.c} kind="sec" label={`Ouvrir la sélection (${coches.length})`} onPress={() => ouvrir(coches.map((a) => a.id))} /> : null}
        </View>
      ) : null}
    </Panel>
  );
}

function AClore({ cr, proposes, choix, setChoix }: { cr: CompteRendu; proposes: Set<string>; choix: Set<string>; setChoix: (f: (s: Set<string>) => Set<string>) => void }) {
  const { espace } = useStore();
  const { enLot } = useActions();
  const t = teinteCopilote();
  const candidats = useMemo(() => candidatsCloture(espace, cr), [espace, cr]);
  const ouverts = candidats.filter((c) => !c.fait);
  const coches = ouverts.filter((c) => choix.has(c.ref));

  const clore = (refs: string[]) => {
    enLot((e, d, h) => {
      const n = refs.reduce((acc, ref) => {
        const x = deRef(ref);
        if (!x) return acc;
        if (x.genre === 'tache') return acc.taches.find((y) => y.id === x.id && y.statut !== 'fait') ? tTache(acc, x.id, d, h) : acc;
        return acc.relances.find((y) => y.id === x.id && y.statut !== 'repondu') ? tRelance(acc, x.id, 'repondu', d, h) : acc;
      }, e);
      return noterClotures(n, cr.id, refs, d);
    });
    setChoix(() => new Set());
  };
  const rouvrir = (c: Candidat) =>
    enLot((e, d, h) => {
      const n = c.genre === 'tache' ? (e.taches.find((y) => y.id === c.id)?.statut === 'fait' ? tTache(e, c.id, d, h) : e) : tRelance(e, c.id, 'a_faire', d, h);
      return noterClotures(n, cr.id, [c.ref], d, true);
    });
  const basculer = (ref: string) =>
    setChoix((s) => {
      const n = new Set(s);
      if (n.has(ref)) n.delete(ref);
      else n.add(ref);
      return n;
    });

  return (
    <Panel title="Ce qui se clôture" count={ouverts.length ? `${ouverts.length} ouverts` : undefined}>
      <T small muted>
        Les tâches et relances rattachées. Coche ce qui est réglé : la tâche passe à « fait », la relance à « répondu ».
      </T>
      {candidats.length ? (
        <View style={{ gap: 6 }}>
          {candidats.map((c) => (
            <LigneCase
              key={c.ref}
              on={c.fait || choix.has(c.ref)}
              off={c.fait}
              barre={c.fait}
              onPress={c.fait ? undefined : () => basculer(c.ref)}
              titre={c.titre}
              label={`${c.genre === 'tache' ? 'Tâche' : 'Relance'} : ${c.titre}`}
              details={[c.genre === 'tache' ? 'Tâche' : 'Relance', c.detail, c.parCe ? 'clôturée ici' : c.fait ? 'déjà faite' : proposes.has(c.ref) ? 'réglée d’après les notes' : undefined]}
              droite={c.parCe ? <Btn small kind="sec" label="Rouvrir" onPress={() => rouvrir(c)} /> : null}
            />
          ))}
        </View>
      ) : (
        <Empty icone="taches">Rattache un projet, une tâche ou une relance pour clôturer ici ce qui est réglé.</Empty>
      )}
      {coches.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn couleur={t.c} label={`Clôturer la sélection (${coches.length})`} onPress={() => clore(coches.map((c) => c.ref))} />
        </View>
      ) : null}
    </Panel>
  );
}

function Decisions({ cr }: { cr: CompteRendu }) {
  const { update } = useStore();
  const [nouvelle, setNouvelle] = useState('');
  const maj = (decisions: string[]) => update((e) => majCompteRendu(e, cr.id, (x) => ({ ...x, decisions })));
  const ajouter = () => {
    if (!nouvelle.trim()) return;
    maj([...(cr.decisions ?? []), nouvelle.trim()]);
    setNouvelle('');
  };
  return (
    <Panel title="Décisions" count={cr.decisions?.length || undefined}>
      {cr.decisions?.length ? (
        cr.decisions.map((x, i) => (
          <View key={`${i}:${x}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.coach }} />
            <T style={{ flex: 1 }}>{x}</T>
            <IconBtn label={`Retirer ${x}`} glyph="×" onPress={() => maj(cr.decisions!.filter((_, j) => j !== i))} />
          </View>
        ))
      ) : (
        <T small muted>
          Aucune décision notée.
        </T>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Input value={nouvelle} onChangeText={(v: string) => setNouvelle(v)} placeholder="Ajouter une décision" returnKeyType="done" onSubmitEditing={ajouter} accessibilityLabel="Nouvelle décision" />
        </View>
        <Btn kind="sec" label="Ajouter" onPress={ajouter} disabled={!nouvelle.trim()} />
      </View>
    </Panel>
  );
}

/** Un compte rendu : notes à gauche (saisie rapide), ce qui s'ouvre et ce qui se clôture à droite. */
export function CompteRenduDetail({ cr, retour }: { cr: CompteRendu; retour: () => void }) {
  const { espace, update, pro } = useStore();
  const ia = useCopiloteVisible();
  const t = teinteCopilote();
  const [titre, setTitre] = useState(cr.titre);
  const [notes, setNotes] = useState(cr.notes);
  const [participants, setParticipants] = useState((cr.participants ?? []).join(', '));
  const [proposes, setProposes] = useState<Set<string>>(new Set());
  // Ce que les notes (ou le copilote) disent réglé est coché d'avance ; le reste, à la main.
  const [choix, setChoix] = useState<Set<string>>(new Set());
  const proposer = (refs: string[]) => {
    setProposes(new Set(refs));
    setChoix((s) => new Set([...s, ...refs]));
  };
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [suppr, setSuppr] = useState(false);
  const maj = (patch: Partial<CompteRendu>) => update((e) => majCompteRendu(e, cr.id, (x) => ({ ...x, ...patch })));

  // Les champs de texte s'enregistrent une demi-seconde après la dernière frappe.
  const dernier = useRef({ titre: cr.titre, notes: cr.notes, participants: (cr.participants ?? []).join(', ') });
  useEffect(() => {
    const x = setTimeout(() => {
      const d = dernier.current;
      if (d.titre === titre && d.notes === notes && d.participants === participants) return;
      dernier.current = { titre, notes, participants };
      const p = participants.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      maj({ titre: titre.trim(), notes, participants: p.length ? p : undefined });
    }, 500);
    return () => clearTimeout(x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titre, notes, participants]);

  const crCourant = (): CompteRendu => {
    const p = participants.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    return { ...cr, titre: titre.trim(), notes, participants: p.length ? p : undefined };
  };

  const lire = () => {
    const d = today();
    const lu = lireNotes(notes, d);
    const c = crCourant();
    const fermes = rapprocherFaits(lu.faits, candidatsCloture(espace, c));
    update((e) =>
      majCompteRendu(e, cr.id, (x) => ({
        ...x,
        ...c,
        decisions: [...new Set([...(x.decisions ?? []), ...lu.decisions])],
        actions: fusionnerActions(x, lu.actions, uid),
      })),
    );
    proposer(fermes);
    const n = lu.actions.length;
    setMessage(n || lu.decisions.length || fermes.length ? [n ? `${n} point${n > 1 ? 's' : ''} d’action` : '', lu.decisions.length ? `${lu.decisions.length} décision${lu.decisions.length > 1 ? 's' : ''}` : '', fermes.length ? `${fermes.length} à clôturer` : ''].filter(Boolean).join(', ') + ' trouvés dans tes notes.' : 'Rien trouvé : commence une ligne par « Décision : », « [ ] » ou « ✓ », ou utilise les sections Décisions, Actions et Fait.');
  };

  const analyser = async () => {
    if (!pro) return router.push('/copilote' as Href);
    setBusy(true);
    setMessage('');
    try {
      const c = crCourant();
      const r = await analyserCompteRendu(c, espace, today());
      update((e) =>
        majCompteRendu(e, cr.id, (x) => ({
          ...x,
          ...c,
          ...(r.resume ? { resume: r.resume } : {}),
          decisions: [...new Set([...(x.decisions ?? []), ...r.decisions])],
          actions: fusionnerActions(x, r.actions, uid),
        })),
      );
      proposer(r.clotures);
      setMessage(`Le copilote propose ${r.actions.length} point${r.actions.length > 1 ? 's' : ''} d’action${r.clotures.length ? ` et ${r.clotures.length} élément${r.clotures.length > 1 ? 's' : ''} à clôturer` : ''}.`);
    } catch (e) {
      setMessage((e as Error).message || 'Le copilote n’a pas pu lire ce compte rendu. Essaie « Lire mes notes ».');
    } finally {
      setBusy(false);
    }
  };

  const supprimer = () => {
    update((e) => supprimerCompteRendu(e, cr.id));
    retour();
  };

  const gauche = (
    <>
      <Panel accent>
        <Input label="Titre" value={titre} onChangeText={(v: string) => setTitre(v)} placeholder={titreParDefaut(cr, espace)} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {GENRES_CR.map((g) => (
            <Puce key={g.key} label={`${g.emoji} ${g.label}`} on={cr.genre === g.key} onPress={() => maj({ genre: g.key })} />
          ))}
        </View>
        <DatePick label="Date" value={cr.date} onChange={(d) => d && maj({ date: d })} />
        <Input label="Participants" value={participants} onChangeText={(v: string) => setParticipants(v)} placeholder="Paul, Sophie" />
        <Rattachements cr={cr} />
        <Input
          label="Notes"
          value={notes}
          onChangeText={(v: string) => setNotes(v)}
          placeholder={AIDE_NOTES}
          multiline
          aide="Une ligne par idée. « Décision : », « [ ] » ou « → » pour une action, « ✓ » pour ce qui est réglé ; « @Paul » et « vendredi » sont compris."
          style={{ minHeight: 200, textAlignVertical: 'top' }}
        />
        {busy ? <SqueletteReponse /> : null}
        {message ? <T small style={{ color: t.c }}>{message}</T> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Btn label="Lire mes notes" onPress={lire} disabled={!notes.trim() || busy} />
          {ia ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Btn couleur={t.c} kind="sec" label={busy ? 'Le copilote lit…' : 'Analyser avec le copilote'} onPress={analyser} disabled={!notes.trim() || busy} />
              {!pro ? <BadgePro /> : null}
            </View>
          ) : null}
        </View>
      </Panel>
      {cr.resume ? (
        <Panel title="Résumé">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Icone nom="copilote" color={t.c} size={18} />
            <T style={{ flex: 1 }}>{cr.resume}</T>
          </View>
        </Panel>
      ) : null}
      <Decisions cr={cr} />
    </>
  );

  const droite = (
    <>
      <PointsAction cr={cr} />
      <AClore cr={cr} proposes={proposes} choix={choix} setChoix={setChoix} />
      <Panel title="Classement">
        <ChoixCategories value={cr.categories} onChange={(ids) => maj({ categories: ids })} />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {suppr ? (
            <>
              <Btn small kind="danger" label="Supprimer le compte rendu" onPress={supprimer} />
              <Btn small kind="sec" label="Garder" onPress={() => setSuppr(false)} />
            </>
          ) : (
            <Btn small kind="danger" label="Supprimer" onPress={() => setSuppr(true)} />
          )}
        </View>
        {suppr ? <T small muted>Les tâches et relances ouvertes depuis ce compte rendu restent, sans le lien.</T> : null}
      </Panel>
    </>
  );

  return <Colonnes gauche={gauche} droite={droite} />;
}

