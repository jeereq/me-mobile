import { type ReactNode, useMemo, useState } from 'react';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { useActions } from '@/lib/actions';
import { fmtCourt, today, uid } from '@/lib/dates';
import { SEUIL_COLONNES } from '@/lib/mise-en-page';
import {
  candidatesApres,
  changerParent,
  creerTache,
  decalerTache,
  delierApres,
  deplacerTache,
  desindenter,
  descendantes,
  ecartJours,
  etapesDepuisTexte,
  genererSousTaches,
  indenter,
  lierApres,
  MODELES_ETAPES,
  ordreAffichage,
  planifier,
  prochainesTaches,
  replanifier,
  supprimerTaches,
  tachesDuProjet,
  type LignePlan,
  type PatchTache,
} from '@/lib/planning';
import { membreDe, nomMembre } from '@/lib/affectation';
import { useStore } from '@/lib/store';
import { alpha, C, F, S } from '@/lib/theme';
import type { Priorite, Projet, Tache } from '@/lib/types';

import { ChoixAffectation, MailDeTache } from './affectation';
import { ChoixCategories, EtiquettesCategories } from './categories';
import { ComptesRendusProjet } from './comptes-rendus';
import { Puce } from './finances-plus';
import { DatePick, ModePick } from './forms';
import { Gantt, LegendeGantt, ZOOMS, type Zoom } from './gantt';
import { Filtre, SousOnglets, Onglets } from './onglets';
import { Btn, Check, Collant, Dialogue, Empty, Input, Panel, Sep, Seg, T } from './ui';

export const EMOJIS_PROJET = ['📁', '🚀', '🏗️', '📣', '🎓', '🛠️', '🌍', '🧪', '🏠', '💼', '🎉', '📦'];

const nettoyer = (t: Tache): Tache => Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined)) as Tache;

type Maj = (fn: (t: Tache[]) => Tache[]) => void;

/** Une modification des tâches du projet, suivie du recalcul des dates (les tâches des autres projets ne bougent pas). */
export function useMajProjet(projetId: string): Maj {
  const { update } = useStore();
  return (fn) =>
    update((e) => {
      const p = e.projets?.find((x) => x.id === projetId);
      const t = fn(e.taches);
      return { ...e, taches: p ? replanifier(t, p, today()) : t };
    });
}

/* ---------- Petits éléments partagés avec la liste des projets ---------- */

/** Où en est un projet, en un mot et une couleur (lue au rendu : elle suit le thème). */
export function statutProjet(nbTaches: number, nbFaites: number, enRetard: number) {
  if (!nbTaches) return { label: 'À planifier', couleur: C.muted };
  if (nbFaites >= nbTaches) return { label: 'Terminé', couleur: C.coach };
  if (enRetard) return { label: 'En retard', couleur: C.agressif };
  return { label: 'Dans les temps', couleur: C.accent };
}

/** « dans 5 j », « demain », « dépassée de 2 j ». */
export function echeance(fin: string, aujourdhui: string) {
  const n = ecartJours(aujourdhui, fin);
  return n === 0 ? 'aujourd’hui' : n === 1 ? 'demain' : n > 0 ? `dans ${n} j` : `dépassée de ${-n} j`;
}

export function Pastille({ label, couleur }: { label: string; couleur: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: alpha(couleur, 0.14) }}>
      <Text style={{ color: couleur, fontFamily: F.texteM, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function BarreAvancement({ pct, hauteur = 10 }: { pct: number; hauteur?: number }) {
  return (
    <View style={{ height: hauteur, borderRadius: hauteur / 2, backgroundColor: C.sunk, overflow: 'hidden' }} accessibilityLabel={`${pct} % terminé`}>
      <View style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', borderRadius: hauteur / 2, backgroundColor: C.coach }} />
    </View>
  );
}

export function Tuile({ titre, valeur, couleur }: { titre: string; valeur: string; couleur?: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 140, gap: 3, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.sunk }}>
      <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>
        {titre}
      </Text>
      <Text numberOfLines={2} style={{ color: couleur ?? C.ink, fontFamily: F.texteF, fontSize: 15 }}>
        {valeur}
      </Text>
    </View>
  );
}

/** Sur le web, amène un bloc qui vient de s'ouvrir dans la fenêtre (l'éditeur sous le planning). */
/* ---------- Génération de sous-tâches ---------- */

function PanneauSousTaches({ t, projet, maj, fermer }: { t: Tache; projet: Projet; maj: Maj; fermer: () => void }) {
  const [texte, setTexte] = useState('');
  const [modele, setModele] = useState<string | null>(null);
  const [enchainer, setEnchainer] = useState(true);
  const [repartir, setRepartir] = useState(true);
  const etapes = texte.trim() ? etapesDepuisTexte(texte) : MODELES_ETAPES.find((m) => m.cle === modele)?.etapes ?? [];
  const generer = () => {
    maj((ts) => genererSousTaches(ts, projet, t.id, etapes, { enchainer, repartir }, uid, today()));
    fermer();
  };
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: C.sunk }}>
      <T small muted>Découpe « {t.titre} » en étapes. La tâche devient un résumé : ses dates et son avancement viennent de ses sous-tâches.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {MODELES_ETAPES.map((m) => (
          <Puce key={m.cle} label={m.nom} on={modele === m.cle && !texte.trim()} onPress={() => (setModele(m.cle), setTexte(''))} />
        ))}
      </View>
      <Input label="Ou écris tes étapes (une par ligne)" value={texte} onChangeText={(v: string) => setTexte(v)} multiline placeholder={'Rédiger\nRelire\nEnvoyer'} style={{ minHeight: 80, textAlignVertical: 'top' }} />
      {etapes.length ? <T small muted>{etapes.length} sous-tâche{etapes.length > 1 ? 's' : ''} : {etapes.join(' → ')}</T> : null}
      <Seg label="Ordre" options={[{ key: 'oui', label: 'Les enchaîner' }, { key: 'non', label: 'En parallèle' }]} value={enchainer ? 'oui' : 'non'} onChange={(k) => setEnchainer(k === 'oui')} />
      <Seg label="Durée" options={[{ key: 'oui', label: 'Partager celle de la tâche' }, { key: 'non', label: '1 jour chacune' }]} value={repartir ? 'oui' : 'non'} onChange={(k) => setRepartir(k === 'oui')} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn small label="Générer" onPress={generer} disabled={!etapes.length} />
        <Btn small kind="sec" label="Annuler" onPress={fermer} />
      </View>
    </View>
  );
}

/* ---------- Édition d'une tâche ---------- */

/** Une partie repliable de l'éditeur : son titre, et ce qu'elle contient en résumé tant qu'elle est fermée. */
function Section({ titre, resume, children }: { titre: string; resume?: string; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: ouvert }}
        onPress={() => setOuvert(!ouvert)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>{titre}</Text>
        <Text numberOfLines={1} style={{ flex: 1, textAlign: 'right', color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
          {ouvert ? '' : resume}
        </Text>
        <Text style={{ color: C.muted, fontSize: 14 }}>{ouvert ? '▾' : '▸'}</Text>
      </Pressable>
      {ouvert ? children : null}
    </View>
  );
}

const LIBELLES_PRIORITE: Record<Priorite, string> = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' };

function EditeurTache({ t, projet, toutes, ligne, maj, fermer }: { t: Tache; projet: Projet; toutes: Tache[]; ligne?: LignePlan; maj: Maj; fermer: () => void }) {
  const { config, equipeActive } = useStore();
  const [titre, setTitre] = useState(t.titre);
  const [duree, setDuree] = useState(String(t.duree ?? ligne?.duree ?? 1));
  const [responsable, setResponsable] = useState(t.responsable ?? '');
  const [note, setNote] = useState(t.note ?? '');
  const [lien, setLien] = useState(false);
  const [parent, setParent] = useState(false);
  const [generer, setGenerer] = useState(false);
  const [suppr, setSuppr] = useState(false);
  const [erreur, setErreur] = useState('');
  const resume = !!ligne?.resume;
  const mine = tachesDuProjet(toutes, projet.id);
  const nom = (id: string) => mine.find((x) => x.id === id)?.titre ?? '(supprimée)';
  const modifier = (patch: PatchTache) => maj((ts) => ts.map((x) => (x.id === t.id ? nettoyer({ ...x, ...patch }) : x)));
  const candidates = lien ? candidatesApres(toutes, t.id) : [];
  const parents = parent ? ordreAffichage(mine).filter((x) => x.tache.id !== t.id && !descendantes(mine, t.id).has(x.tache.id)) : [];
  const nbSous = mine.filter((x) => x.parent === t.id).length;
  const jalon = !!t.jalon || t.duree === 0;

  const avancements = [0, 25, 50, 75, 100];
  const fixer = (avancement: number) =>
    modifier(avancement >= 100 ? { statut: 'fait', faitLe: today(), avancement: undefined } : { statut: 'en_attente', faitLe: null, avancement: avancement || undefined });
  // Écrire un autre nom que celui du membre choisi retire l'affectation : la tâche ne reste pas confiée à quelqu'un qui n'est plus le responsable.
  const enregistrerResponsable = () => {
    const texte = responsable.trim();
    const m = equipeActive && t.affecteA ? membreDe(equipeActive.membres, t) : null;
    modifier({ responsable: texte || undefined, ...(t.affecteA && (!m || nomMembre(m) !== texte) ? { affecteA: undefined } : {}) });
  };
  const [mail, setMail] = useState(false);

  if (mail) return <MailDeTache t={{ ...t, titre: titre.trim() || t.titre, responsable: responsable.trim() || undefined }} onFermer={() => setMail(false)} />;
  return (
    <Dialogue titre="Modifier la tâche" onFermer={fermer}>
      <Input label="Tâche" value={titre} onChangeText={(v: string) => setTitre(v)} onEndEditing={() => titre.trim() && titre.trim() !== t.titre && modifier({ titre: titre.trim() })} onBlur={() => titre.trim() && titre.trim() !== t.titre && modifier({ titre: titre.trim() })} returnKeyType="done" />

      {resume ? (
        <T small muted>
          Résumé de {nbSous} sous-tâche{nbSous > 1 ? 's' : ''} : {ligne ? `${fmtCourt(ligne.debut)} → ${fmtCourt(ligne.fin)}, ${ligne.avancement} % fait` : ''}.
        </T>
      ) : (
        <>
          <Seg label="Type" options={[{ key: 'tache', label: 'Tâche' }, { key: 'jalon', label: 'Jalon (étape sans durée)' }]} value={jalon ? 'jalon' : 'tache'} onChange={(k) => (k === 'jalon' ? modifier({ jalon: true, duree: 0 }) : (modifier({ jalon: undefined, duree: 1 }), setDuree('1')))} />
          <Seg label="Avancement" options={avancements.map((a) => ({ key: String(a), label: `${a} %` }))} value={String(t.statut === 'fait' ? 100 : avancements.reduce((m, a) => (Math.abs(a - (t.avancement ?? 0)) < Math.abs(m - (t.avancement ?? 0)) ? a : m), 0))} onChange={(k) => fixer(Number(k))} />
        </>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {!resume && !jalon ? (
          <View style={{ flexGrow: 1, flexBasis: 130 }}>
            <Input
              label={`Durée en jours${projet.joursOuvres ? ' ouvrés' : ''}`}
              value={duree}
              onChangeText={(v: string) => {
                setDuree(v);
                const n = Math.round(Number(v.replace(',', '.')));
                if (Number.isFinite(n) && n >= 1 && n <= 999) modifier({ duree: n });
              }}
              keyboardType="number-pad"
            />
          </View>
        ) : null}
        <View style={{ flexGrow: 2, flexBasis: 180 }}>
          <Input label="Responsable" value={responsable} onChangeText={(v: string) => setResponsable(v)} onEndEditing={enregistrerResponsable} onBlur={enregistrerResponsable} placeholder="Qui s’en occupe ?" />
        </View>
      </View>
      {/* Dans l'espace d'une équipe, la tâche se confie d'un geste à un membre, qui en est prévenu. */}
      <ChoixAffectation t={t} onChoisir={(p) => { setResponsable(p.responsable ?? ''); modifier(p); }} />
      <Btn small kind="sec" label="✉️ Écrire un mail à ce sujet" onPress={() => setMail(true)} />
      {!resume ? (
        <>
          <DatePick label="Début imposé" value={t.fixe ? t.debut ?? null : null} onChange={(d) => modifier(d ? { debut: d, fixe: true } : { fixe: undefined })} allowNone />
          {t.fixe ? <T small muted>{`Début imposé le ${fmtCourt(t.debut)} : cette date ne bouge pas quand les tâches précédentes changent. Choisis « Sans date » pour laisser le planning la calculer.`}</T> : null}
        </>
      ) : null}

      <Sep />
      <Section titre="Liens et ordre" resume={(t.apres ?? []).length ? `Après ${(t.apres ?? []).map(nom).join(', ')}` : 'Ne dépend de rien'}>
        <T small muted>À faire après</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(t.apres ?? []).map((a) => (
            <Puce key={a} label={`${nom(a)} ✕`} on onPress={() => maj((ts) => delierApres(ts, t.id, a))} />
          ))}
          {!(t.apres ?? []).length ? <T small muted>Aucune : cette tâche ne dépend de rien.</T> : null}
        </View>
        {t.apres?.length ? (
          <Input label="Attendre (jours après la fin des précédentes)" value={String(t.delai ?? 0)} onChangeText={(v: string) => modifier({ delai: Math.max(0, Math.min(365, Math.round(Number(v.replace(/\D/g, '')) || 0))) || undefined })} keyboardType="number-pad" />
        ) : null}
        <View style={{ flexDirection: 'row' }}>
          <Btn small kind="sec" label={lien ? 'Fermer' : '+ Lier à une autre tâche'} onPress={() => setLien(!lien)} />
        </View>
        {lien ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {candidates.length ? (
              candidates.slice(0, 60).map((c) => (
                <Puce
                  key={c.id}
                  label={c.titre}
                  on={false}
                  onPress={() => {
                    const r = lierApres(toutes, t.id, c.id);
                    if (r.erreur) return setErreur(r.erreur);
                    setErreur('');
                    maj((ts) => lierApres(ts, t.id, c.id).taches);
                  }}
                />
              ))
            ) : (
              <T small muted>Aucune autre tâche à lier.</T>
            )}
          </View>
        ) : null}
        {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
        {resume ? <T small muted>Un lien posé sur un résumé vaut pour toutes ses sous-tâches.</T> : null}

        <T small muted>Place dans le plan</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Btn small kind="sec" label="↑ Monter" onPress={() => maj((ts) => deplacerTache(ts, t.id, -1))} />
          <Btn small kind="sec" label="↓ Descendre" onPress={() => maj((ts) => deplacerTache(ts, t.id, 1))} />
          <Btn small kind="sec" label="→ Sous-tâche de la précédente" onPress={() => maj((ts) => indenter(ts, t.id))} />
          {t.parent ? <Btn small kind="sec" label="← Remonter d’un niveau" onPress={() => maj((ts) => desindenter(ts, t.id))} /> : null}
          <Btn small kind="sec" label={parent ? 'Fermer' : 'Changer de parent'} onPress={() => setParent(!parent)} />
        </View>
        {parent ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Puce label="Aucun (niveau principal)" on={!t.parent} onPress={() => maj((ts) => changerParent(ts, t.id, null).taches)} />
            {parents.slice(0, 60).map((p) => (
              <Puce key={p.tache.id} label={p.tache.titre} on={t.parent === p.tache.id} onPress={() => maj((ts) => changerParent(ts, t.id, p.tache.id).taches)} />
            ))}
          </View>
        ) : null}
        <T small muted>Décaler</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Btn small kind="sec" label="− 1 jour" onPress={() => maj((ts) => decalerTache(ts, projet, t.id, -1, today()))} />
          <Btn small kind="sec" label="+ 1 jour" onPress={() => maj((ts) => decalerTache(ts, projet, t.id, 1, today()))} />
          <Btn small kind="sec" label="+ 1 semaine" onPress={() => maj((ts) => decalerTache(ts, projet, t.id, projet.joursOuvres ? 5 : 7, today()))} />
        </View>
      </Section>

      <Sep />
      <Section titre="Sous-tâches" resume={nbSous ? `${nbSous} sous-tâche${nbSous > 1 ? 's' : ''}` : 'Aucune'}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Btn small kind="sec" label={generer ? 'Fermer' : '✨ Générer des sous-tâches'} onPress={() => setGenerer(!generer)} />
          <Btn small kind="sec" label="+ Sous-tâche" onPress={() => maj((ts) => creerTache(ts, { source: t.source, priorite: t.priorite, mode: t.mode }, { id: uid(), titre: 'Nouvelle sous-tâche', projet: projet.id, parent: t.id, duree: 1, ...(t.categories ? { categories: t.categories } : {}) }))} />
        </View>
        {generer ? <PanneauSousTaches t={t} projet={projet} maj={maj} fermer={() => setGenerer(false)} /> : null}
      </Section>

      <Sep />
      <Section titre="Détails" resume={`Priorité ${LIBELLES_PRIORITE[t.priorite]?.toLowerCase() ?? 'moyenne'}${t.note ? ' · note' : ''}`}>
        <Seg label="Priorité" options={[{ key: 'haute', label: 'Haute' }, { key: 'moyenne', label: 'Moyenne' }, { key: 'basse', label: 'Basse' }]} value={t.priorite} onChange={(p: Priorite) => modifier({ priorite: p })} />
        <ChoixCategories value={t.categories} onChange={(ids) => modifier({ categories: ids })} />
        <Input label="Note" value={note} onChangeText={(v: string) => setNote(v)} onEndEditing={() => modifier({ note: note.trim() || undefined })} onBlur={() => modifier({ note: note.trim() || undefined })} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
        <ModePick value={t.mode} onChange={(m) => modifier({ mode: m })} config={config} label="Rappel" />
      </Section>

      <Sep />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn small label="Terminé" onPress={fermer} />
        {suppr ? (
          <>
            <Btn small kind="danger" label={resume ? 'Supprimer avec ses sous-tâches' : 'Confirmer la suppression'} onPress={() => (maj((ts) => supprimerTaches(ts, [t.id])), fermer())} />
            <Btn small kind="sec" label="Garder" onPress={() => setSuppr(false)} />
          </>
        ) : (
          <Btn small kind="danger" label="Supprimer" onPress={() => setSuppr(true)} />
        )}
      </View>
    </Dialogue>
  );
}

/* ---------- Une ligne de l'arbre ---------- */

function LigneTache({ t, ligne, niveau, replie, bascule, ouvert, ouvrir, aujourdhui }: { t: Tache; ligne: LignePlan; niveau: number; replie: boolean; bascule: () => void; ouvert: boolean; ouvrir: () => void; aujourdhui: string }) {
  const { basculerTache } = useActions();
  const enRetard = !ligne.fait && ligne.fin < aujourdhui;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: niveau * 20, paddingRight: 4, borderRadius: 10, backgroundColor: ouvert ? alpha(C.accent, 0.08) : 'transparent' }}>
      {ligne.resume ? (
        <Pressable accessibilityRole="button" accessibilityLabel={replie ? `Déplier ${t.titre}` : `Replier ${t.titre}`} accessibilityState={{ expanded: !replie }} onPress={bascule} hitSlop={8} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.sunk }}>
          <Text style={{ color: C.muted, fontSize: 14 }}>{replie ? '▸' : '▾'}</Text>
        </Pressable>
      ) : (
        <View style={{ width: 30, alignItems: 'center' }}>
          <Check checked={ligne.fait} label={`Terminer ${t.titre}`} onToggle={() => basculerTache(t)} />
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel={`Modifier ${t.titre}`} onPress={ouvrir} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.75 : 1 })}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={{ color: ligne.fait ? C.muted : C.ink, fontFamily: ligne.resume ? F.texteF : F.texte, fontSize: 15, lineHeight: 20, textDecorationLine: ligne.fait ? 'line-through' : 'none' }}>
            {ligne.jalon && !ligne.resume ? '◆ ' : ''}
            {t.titre}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: enRetard ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 13 }}>
              {ligne.debut === ligne.fin ? fmtCourt(ligne.fin) : `${fmtCourt(ligne.debut)} → ${fmtCourt(ligne.fin)}`}
              {ligne.resume || ligne.jalon ? '' : ` · ${ligne.duree} j`}
              {ligne.fait ? '' : ligne.avancement ? ` · ${ligne.avancement} %` : ''}
              {t.responsable ? ` · ${t.responsable}` : ''}
            </Text>
            {enRetard ? <Pastille label="En retard" couleur={C.agressif} /> : null}
            {ligne.critique && !ligne.fait && !enRetard ? <Pastille label="Voie critique" couleur={C.agressif} /> : null}
            {ligne.bloquee ? <Pastille label="⏳ Attend une tâche" couleur={C.muted} /> : null}
            {ligne.conflit ? <Pastille label="⚠ Dates en conflit" couleur={C.agressif} /> : null}
            {ligne.cycle ? <Pastille label="⚠ Boucle de liens" couleur={C.agressif} /> : null}
            <EtiquettesCategories ids={t.categories} />
          </View>
        </View>
        <Text style={{ color: ouvert ? C.accent : C.muted, fontSize: 18 }}>{ouvert ? '▾' : '›'}</Text>
      </Pressable>
    </View>
  );
}

/* ---------- Détail du projet ---------- */

type Vue = 'taches' | 'planning' | 'reglages';
type FiltreTaches = 'toutes' | 'afaire' | 'retard' | 'critique';

export function ProjetDetail({ projet, retour, onImporter }: { projet: Projet; retour: () => void; onImporter: () => void }) {
  const { espace, update, config } = useStore();
  const { basculerTache } = useActions();
  const aujourdhui = today();
  const largeur = useWindowDimensions().width;
  const large = largeur >= SEUIL_COLONNES;
  const telephone = largeur < 600;
  const maj = useMajProjet(projet.id);
  const [vue, setVue] = useState<Vue>('taches');
  const [zoom, setZoom] = useState<Zoom>('semaine');
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState('');
  const [filtre, setFiltre] = useState<FiltreTaches>('toutes');

  const mine = useMemo(() => tachesDuProjet(espace.taches, projet.id), [espace.taches, projet.id]);
  const plan = useMemo(() => planifier(mine, projet, aujourdhui), [mine, projet, aujourdhui]);
  const ordre = useMemo(() => ordreAffichage(mine), [mine]);
  const prochaines = useMemo(() => prochainesTaches(espace.taches, projet, aujourdhui, 4), [espace.taches, projet, aujourdhui]);
  const parents = new Map(mine.map((t) => [t.id, t.parent]));
  const cache = (id: string) => {
    for (let p = parents.get(id), n = 0; p && n < 50; p = parents.get(p), n++) if (replies.has(p)) return true;
    return false;
  };
  const lignes = ordre.filter((o) => !cache(o.tache.id) && plan.lignes.has(o.tache.id));
  const feuilles = [...plan.lignes.values()].filter((l) => !l.resume);
  const faites = feuilles.filter((l) => l.fait).length;
  const retard = feuilles.filter((l) => !l.fait && l.fin < aujourdhui).length;
  const critiques = feuilles.filter((l) => !l.fait && l.critique).length;
  const aResumes = mine.some((t) => plan.lignes.get(t.id)?.resume);
  const filtrees = lignes.filter(({ tache }) => {
    const l = plan.lignes.get(tache.id)!;
    if (filtre === 'afaire') return l.resume || !l.fait;
    if (filtre === 'retard') return !l.fait && l.fin < aujourdhui;
    if (filtre === 'critique') return !l.fait && l.critique;
    return true;
  });
  const tacheOuverte = ouverte ? mine.find((t) => t.id === ouverte) : undefined;
  const statut = statutProjet(feuilles.length, faites, retard);

  const ajouter = () => {
    if (!nouvelle.trim()) return;
    maj((ts) => creerTache(ts, { source: 'manuel', priorite: 'moyenne', mode: config.defauts.tache }, { id: uid(), titre: nouvelle.trim(), projet: projet.id, duree: 1 }));
    setNouvelle('');
  };
  const basculerReplie = (id: string) =>
    setReplies((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const editeur = (t: Tache) => <EditeurTache key={t.id} t={t} projet={projet} toutes={espace.taches} ligne={plan.lignes.get(t.id)} maj={maj} fermer={() => setOuverte(null)} />;

  const liste = (
    <Panel title="Tâches et sous-tâches" count={feuilles.length || undefined} right={aResumes ? replies.size ? <Btn small kind="sec" label="Tout déplier" onPress={() => setReplies(new Set())} /> : <Btn small kind="sec" label="Tout replier" onPress={() => setReplies(new Set(mine.filter((t) => plan.lignes.get(t.id)?.resume).map((t) => t.id)))} /> : null}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Input value={nouvelle} onChangeText={(v: string) => setNouvelle(v)} placeholder="Ajouter une tâche au projet" returnKeyType="done" onSubmitEditing={ajouter} accessibilityLabel="Nouvelle tâche du projet" />
        </View>
        <Btn label="Ajouter" onPress={ajouter} disabled={!nouvelle.trim()} />
      </View>
      {mine.length ? (
        <Filtre
          label="Filtrer les tâches"
          options={[
            { key: 'toutes', label: 'Toutes', compte: feuilles.length },
            { key: 'afaire', label: 'À faire', compte: feuilles.length - faites },
            { key: 'retard', label: 'En retard', compte: retard },
            { key: 'critique', label: 'Critiques', compte: critiques },
          ]}
          value={filtre}
          onChange={setFiltre}
        />
      ) : null}
      {mine.length ? (
        filtrees.length ? (
          <View>
            {filtrees.map(({ tache, niveau }, i) => (
              <View key={tache.id}>
                {i ? <Sep /> : null}
                <LigneTache t={tache} ligne={plan.lignes.get(tache.id)!} niveau={niveau} replie={replies.has(tache.id)} bascule={() => basculerReplie(tache.id)} ouvert={ouverte === tache.id} ouvrir={() => setOuverte(ouverte === tache.id ? null : tache.id)} aujourdhui={aujourdhui} />
              </View>
            ))}
          </View>
        ) : (
          <Empty icone="taches">{filtre === 'retard' ? 'Aucune tâche en retard.' : filtre === 'critique' ? 'Aucune tâche sur la voie critique.' : 'Tout est fait dans ce projet.'}</Empty>
        )
      ) : (
        <Empty icone="taches">Ce projet n’a pas encore de tâche. Écris-en une ci-dessus, ou importe un plan Excel.</Empty>
      )}
    </Panel>
  );

  const etapes = (
    <Panel title="Prochaines étapes">
      {prochaines.length ? (
        prochaines.map(({ tache, ligne }, i) => (
          <View key={tache.id}>
            {i ? <Sep /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
              <Check checked={false} label={`Terminer ${tache.titre}`} onToggle={() => basculerTache(tache)} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Modifier ${tache.titre}`} onPress={() => setOuverte(tache.id)} style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texte, fontSize: 15 }}>
                  {tache.titre}
                </Text>
                <Text style={{ color: ligne.fin < aujourdhui ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 13 }}>
                  {ligne.debut > aujourdhui ? `Commence ${echeance(ligne.debut, aujourdhui)}` : `À finir ${ligne.fin < aujourdhui ? `(${echeance(ligne.fin, aujourdhui)})` : echeance(ligne.fin, aujourdhui)}`}
                  {tache.responsable ? ` · ${tache.responsable}` : ''}
                </Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <Empty icone="taches">{mine.length ? 'Plus rien à faire : tout est terminé.' : 'Ajoute une tâche pour voir ici ce qui vient ensuite.'}</Empty>
      )}
      <T small muted>
        Choisis une tâche dans la liste pour la modifier.
      </T>
    </Panel>
  );

  return (
    <View style={{ gap: S.lg }}>
      <Panel accent>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 34 }}>{plan.avancement} %</Text>
            <T small muted>
              terminé
            </T>
          </View>
          <Pastille label={statut.label} couleur={statut.couleur} />
        </View>
        <BarreAvancement pct={plan.avancement} />
        {plan.debut && plan.fin ? (
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>
            Du {fmtCourt(plan.debut)} au {fmtCourt(plan.fin)}
            {projet.joursOuvres ? ' · du lundi au vendredi' : ' · tous les jours'}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Tuile titre="Tâches faites" valeur={`${faites} / ${feuilles.length}`} />
          <Tuile titre="Fin prévue" valeur={plan.fin && feuilles.length > faites ? `${fmtCourt(plan.fin)} · ${echeance(plan.fin, aujourdhui)}` : plan.fin ? 'Terminé' : '—'} couleur={plan.fin && feuilles.length > faites && plan.fin < aujourdhui ? C.agressif : undefined} />
          <Tuile titre="En retard" valeur={retard ? `${retard} tâche${retard > 1 ? 's' : ''}` : 'Aucune'} couleur={retard ? C.agressif : C.coach} />
          <Tuile titre="Ensuite" valeur={prochaines[0]?.tache.titre ?? '—'} />
        </View>
        {plan.nbConflits ? <T small style={{ color: C.agressif }}>{`${plan.nbConflits} tâche${plan.nbConflits > 1 ? 's' : ''} avec des dates imposées qui ne respectent pas leurs liens : ouvre-les (« Dates en conflit ») pour les corriger.`}</T> : null}
        {plan.nbCycles ? <T small style={{ color: C.agressif }}>{`${plan.nbCycles} tâche${plan.nbCycles > 1 ? 's' : ''} dans une boucle de liens (A après B après A) : ces liens sont ignorés tant que tu ne les défais pas.`}</T> : null}
      </Panel>

      <Collant>
        <Onglets<Vue>
          options={[
            { key: 'taches', label: 'Tâches', compte: feuilles.length - faites || undefined },
            { key: 'planning', label: 'Planning' },
            { key: 'reglages', label: 'Réglages' },
          ]}
          value={vue}
          onChange={(v) => setVue(v)}
        />
      </Collant>

      {vue === 'taches' ? (
        large ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
            <View style={{ flex: 3, gap: S.lg }}>{liste}</View>
            <View style={[{ flex: 2, gap: S.lg }, Platform.OS === 'web' ? ({ position: 'sticky', top: S.lg } as object) : null]}>
              {etapes}
              <ComptesRendusProjet projet={projet.id} />
            </View>
          </View>
        ) : (
          <>
            {liste}
            {mine.length ? etapes : null}
            <ComptesRendusProjet projet={projet.id} />
          </>
        )
      ) : null}

      {vue === 'planning' ? (
        <>
          <Panel title="Planning" right={<View style={{ minWidth: 220 }}><SousOnglets label="Échelle du planning" options={ZOOMS.map((z) => ({ key: z.key, label: z.label }))} value={zoom} onChange={setZoom} /></View>}>
            {mine.length ? (
              <>
                {/* Au téléphone, le diagramme déborde un peu sur les marges du panneau pour gagner de la place. */}
                <View style={{ marginHorizontal: telephone ? -10 : 0 }}>
                  <Gantt lignes={lignes.map((o) => ({ tache: o.tache, ligne: plan.lignes.get(o.tache.id)!, niveau: o.niveau }))} plan={plan} zoom={zoom} aujourdhui={aujourdhui} ouverte={ouverte} onOuvrir={(id) => setOuverte(ouverte === id ? null : id)} />
                </View>
                <LegendeGantt />
                <T small muted>
                  La voie critique, ce sont les tâches dont le moindre retard décale la fin du projet. Les flèches montrent « à faire après ». Touche une tâche ou sa barre pour la modifier.
                </T>
              </>
            ) : (
              <Empty icone="agenda">Rien à planifier pour l’instant : ajoute des tâches dans l’onglet Tâches.</Empty>
            )}
          </Panel>
        </>
      ) : null}

      {vue === 'reglages' ? <ReglagesProjet projet={projet} onImporter={onImporter} retour={retour} update={update} /> : null}

      {tacheOuverte ? editeur(tacheOuverte) : null}
    </View>
  );
}

function ReglagesProjet({ projet, onImporter, retour, update }: { projet: Projet; onImporter: () => void; retour: () => void; update: ReturnType<typeof useStore>['update'] }) {
  const [nom, setNom] = useState(projet.nom);
  const [note, setNote] = useState(projet.note ?? '');
  const [suppr, setSuppr] = useState(false);
  const modifier = (patch: Partial<Projet>) => update((e) => ({ ...e, projets: (e.projets ?? []).map((p) => (p.id === projet.id ? { ...p, ...patch } : p)) }));
  // Changer les jours de travail ou le départ déplace les tâches non figées.
  const replanif = (patch: Partial<Projet>) =>
    update((e) => {
      const p = { ...projet, ...patch };
      return { ...e, projets: (e.projets ?? []).map((x) => (x.id === projet.id ? p : x)), taches: replanifier(e.taches, p, today()) };
    });
  const supprimer = () => {
    update((e) => ({ ...e, projets: (e.projets ?? []).filter((p) => p.id !== projet.id), taches: e.taches.filter((t) => t.projet !== projet.id) }));
    retour();
  };
  return (
    <Panel title="Réglages du projet">
      <Input label="Nom" value={nom} onChangeText={(v: string) => setNom(v)} onEndEditing={() => nom.trim() && modifier({ nom: nom.trim() })} onBlur={() => nom.trim() && modifier({ nom: nom.trim() })} />
      <View style={{ gap: 6 }}>
        <T small muted>
          Icône
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {EMOJIS_PROJET.map((x) => (
            <Puce key={x} label={x} on={projet.emoji === x} onPress={() => modifier({ emoji: x })} />
          ))}
        </View>
      </View>
      <Seg label="Jours de travail" options={[{ key: 'ouvres', label: 'Lundi au vendredi' }, { key: 'tous', label: 'Tous les jours' }]} value={projet.joursOuvres ? 'ouvres' : 'tous'} onChange={(k) => replanif({ joursOuvres: k === 'ouvres' })} />
      <DatePick label="Début du planning" value={projet.debut} onChange={(d) => replanif({ debut: d })} allowNone />
      <ChoixCategories label="Catégories du projet" value={projet.categories} onChange={(ids) => modifier({ categories: ids })} />
      <Input label="Note" value={note} onChangeText={(v: string) => setNote(v)} onEndEditing={() => modifier({ note: note.trim() || undefined })} onBlur={() => modifier({ note: note.trim() || undefined })} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
      {projet.source ? <T small muted>{`Importé ${projet.source.fichier ? `de « ${projet.source.fichier} » ` : ''}le ${fmtCourt(projet.source.le)}. Pour le mettre à jour, importe la nouvelle version : les tâches sont reconnues à leur ligne et ce qui est fait reste fait.`}</T> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn small kind="sec" label="Importer une nouvelle version" onPress={onImporter} />
        <Btn small kind="sec" label="Archiver" onPress={() => (modifier({ archive: true }), retour())} />
        {suppr ? (
          <>
            <Btn small kind="danger" label="Supprimer le projet et ses tâches" onPress={supprimer} />
            <Btn small kind="sec" label="Garder" onPress={() => setSuppr(false)} />
          </>
        ) : (
          <Btn small kind="danger" label="Supprimer" onPress={() => setSuppr(true)} />
        )}
      </View>
    </Panel>
  );
}
