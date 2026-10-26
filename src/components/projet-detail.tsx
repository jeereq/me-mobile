import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useActions } from '@/lib/actions';
import { fmtCourt, today, uid } from '@/lib/dates';
import {
  candidatesApres,
  changerParent,
  creerTache,
  decalerTache,
  delierApres,
  deplacerTache,
  desindenter,
  descendantes,
  etapesDepuisTexte,
  genererSousTaches,
  indenter,
  lierApres,
  MODELES_ETAPES,
  ordreAffichage,
  planifier,
  replanifier,
  supprimerTaches,
  tachesDuProjet,
  type LignePlan,
  type PatchTache,
} from '@/lib/planning';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Priorite, Projet, Tache } from '@/lib/types';

import { ChoixCategories, EtiquettesCategories } from './categories';
import { Puce } from './finances-plus';
import { DatePick, ModePick } from './forms';
import { Gantt, ZOOMS, type Zoom } from './gantt';
import { Btn, Check, Empty, IconBtn, Input, Panel, Sep, Seg, T } from './ui';

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
    <View style={{ gap: 8, padding: 10, borderRadius: 12, backgroundColor: C.sunk }}>
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

function EditeurTache({ t, projet, toutes, ligne, maj, fermer }: { t: Tache; projet: Projet; toutes: Tache[]; ligne?: LignePlan; maj: Maj; fermer: () => void }) {
  const { config } = useStore();
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

  const avancements = [0, 25, 50, 75, 100];
  const fixer = (avancement: number) =>
    modifier(avancement >= 100 ? { statut: 'fait', faitLe: today(), avancement: undefined } : { statut: 'en_attente', faitLe: null, avancement: avancement || undefined });

  return (
    <View style={{ gap: 10, padding: 12, marginVertical: 6, borderRadius: 12, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
      <Input label="Tâche" value={titre} onChangeText={(v: string) => setTitre(v)} onEndEditing={() => titre.trim() && titre.trim() !== t.titre && modifier({ titre: titre.trim() })} onBlur={() => titre.trim() && titre.trim() !== t.titre && modifier({ titre: titre.trim() })} returnKeyType="done" />

      {resume ? (
        <T small muted>
          Résumé de {mine.filter((x) => x.parent === t.id).length} sous-tâche(s) : {ligne ? `${fmtCourt(ligne.debut)} → ${fmtCourt(ligne.fin)}, ${ligne.avancement} % fait` : ''}.
        </T>
      ) : (
        <>
          <Seg label="Type" options={[{ key: 'tache', label: 'Tâche' }, { key: 'jalon', label: 'Jalon (étape sans durée)' }]} value={t.jalon || t.duree === 0 ? 'jalon' : 'tache'} onChange={(k) => (k === 'jalon' ? modifier({ jalon: true, duree: 0 }) : (modifier({ jalon: undefined, duree: 1 }), setDuree('1')))} />
          {!(t.jalon || t.duree === 0) ? (
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
          ) : null}
          <DatePick label="Début imposé" value={t.fixe ? t.debut ?? null : null} onChange={(d) => modifier(d ? { debut: d, fixe: true } : { fixe: undefined })} allowNone />
          {t.fixe ? <T small muted>{`Début imposé le ${fmtCourt(t.debut)} : cette date ne bouge pas quand les tâches précédentes changent. Choisis « Sans date » pour laisser le planning la calculer.`}</T> : null}
          <Seg label="Avancement" options={avancements.map((a) => ({ key: String(a), label: `${a} %` }))} value={String(t.statut === 'fait' ? 100 : avancements.reduce((m, a) => (Math.abs(a - (t.avancement ?? 0)) < Math.abs(m - (t.avancement ?? 0)) ? a : m), 0))} onChange={(k) => fixer(Number(k))} />
        </>
      )}

      <Seg label="Priorité" options={[{ key: 'haute', label: 'Haute' }, { key: 'moyenne', label: 'Moyenne' }, { key: 'basse', label: 'Basse' }]} value={t.priorite} onChange={(p: Priorite) => modifier({ priorite: p })} />
      <Input label="Responsable" value={responsable} onChangeText={(v: string) => setResponsable(v)} onEndEditing={() => modifier({ responsable: responsable.trim() || undefined })} onBlur={() => modifier({ responsable: responsable.trim() || undefined })} placeholder="Qui s’en occupe ?" />
      <ChoixCategories value={t.categories} onChange={(ids) => modifier({ categories: ids })} />
      <Input label="Note" value={note} onChangeText={(v: string) => setNote(v)} onEndEditing={() => modifier({ note: note.trim() || undefined })} onBlur={() => modifier({ note: note.trim() || undefined })} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
      <ModePick value={t.mode} onChange={(m) => modifier({ mode: m })} config={config} label="Rappel" />

      <View style={{ gap: 6 }}>
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
        {resume || (t.apres ?? []).length ? <T small muted>{resume ? 'Un lien posé sur un résumé vaut pour toutes ses sous-tâches.' : ''}</T> : null}
      </View>

      <View style={{ gap: 6 }}>
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Btn small kind="sec" label="− 1 jour" onPress={() => maj((ts) => decalerTache(ts, projet, t.id, -1, today()))} />
          <Btn small kind="sec" label="+ 1 jour" onPress={() => maj((ts) => decalerTache(ts, projet, t.id, 1, today()))} />
          <Btn small kind="sec" label="+ 1 semaine" onPress={() => maj((ts) => decalerTache(ts, projet, t.id, projet.joursOuvres ? 5 : 7, today()))} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Btn small kind="sec" label={generer ? 'Fermer' : '✨ Générer des sous-tâches'} onPress={() => setGenerer(!generer)} />
        <Btn small kind="sec" label="+ Sous-tâche" onPress={() => maj((ts) => creerTache(ts, { source: t.source, priorite: t.priorite, mode: t.mode }, { id: uid(), titre: 'Nouvelle sous-tâche', projet: projet.id, parent: t.id, duree: 1, ...(t.categories ? { categories: t.categories } : {}) }))} />
      </View>
      {generer ? <PanneauSousTaches t={t} projet={projet} maj={maj} fermer={() => setGenerer(false)} /> : null}

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
    </View>
  );
}

/* ---------- Une ligne de l'arbre ---------- */

function LigneTache({ t, ligne, niveau, replie, bascule, ouvert, ouvrir, aujourdhui }: { t: Tache; ligne: LignePlan; niveau: number; replie: boolean; bascule: () => void; ouvert: boolean; ouvrir: () => void; aujourdhui: string }) {
  const { basculerTache } = useActions();
  const enRetard = !ligne.fait && ligne.fin < aujourdhui;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingLeft: niveau * 16, backgroundColor: ouvert ? alpha(C.accent, 0.06) : 'transparent' }}>
      {ligne.resume ? (
        <Pressable accessibilityRole="button" accessibilityLabel={replie ? 'Déplier' : 'Replier'} accessibilityState={{ expanded: !replie }} onPress={bascule} hitSlop={8} style={{ width: 26, alignItems: 'center' }}>
          <Text style={{ color: C.muted, fontSize: 14 }}>{replie ? '▸' : '▾'}</Text>
        </Pressable>
      ) : (
        <View style={{ width: 26, alignItems: 'center' }}>
          <Check checked={ligne.fait} label={`Terminer ${t.titre}`} onToggle={() => basculerTache(t)} />
        </View>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel={`Modifier ${t.titre}`} onPress={ouvrir} style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={2} style={{ color: ligne.fait ? C.muted : C.ink, fontFamily: ligne.resume ? F.texteF : F.texte, fontSize: 14, textDecorationLine: ligne.fait ? 'line-through' : 'none' }}>
          {ligne.jalon && !ligne.resume ? '◆ ' : ''}
          {t.titre}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: enRetard ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 12 }}>
            {ligne.debut === ligne.fin ? fmtCourt(ligne.fin) : `${fmtCourt(ligne.debut)} → ${fmtCourt(ligne.fin)}`}
            {ligne.resume || ligne.jalon ? '' : ` · ${ligne.duree} j`}
            {ligne.resume || ligne.fait ? '' : ligne.avancement ? ` · ${ligne.avancement} %` : ''}
            {ligne.resume ? ` · ${ligne.avancement} %` : ''}
            {t.responsable ? ` · ${t.responsable}` : ''}
          </Text>
          {ligne.bloquee ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 11 }}>⏳ attend une tâche</Text> : null}
          {ligne.critique && !ligne.fait ? <Text style={{ color: C.agressif, fontFamily: F.texteM, fontSize: 11 }}>voie critique</Text> : null}
          {ligne.conflit ? <Text style={{ color: C.agressif, fontFamily: F.texteM, fontSize: 11 }}>⚠ dates en conflit</Text> : null}
          {ligne.cycle ? <Text style={{ color: C.agressif, fontFamily: F.texteM, fontSize: 11 }}>⚠ boucle de liens</Text> : null}
          <EtiquettesCategories ids={t.categories} />
        </View>
      </Pressable>
    </View>
  );
}

/* ---------- Détail du projet ---------- */

export function ProjetDetail({ projet, retour, onImporter }: { projet: Projet; retour: () => void; onImporter: () => void }) {
  const { espace, update, config } = useStore();
  const aujourdhui = today();
  const maj = useMajProjet(projet.id);
  const [vue, setVue] = useState<'taches' | 'planning' | 'reglages'>('taches');
  const [zoom, setZoom] = useState<Zoom>('semaine');
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState('');
  const [filtre, setFiltre] = useState<'toutes' | 'afaire' | 'retard'>('toutes');

  const mine = useMemo(() => tachesDuProjet(espace.taches, projet.id), [espace.taches, projet.id]);
  const plan = useMemo(() => planifier(mine, projet, aujourdhui), [mine, projet, aujourdhui]);
  const ordre = useMemo(() => ordreAffichage(mine), [mine]);
  const parents = new Map(mine.map((t) => [t.id, t.parent]));
  const cache = (id: string) => {
    for (let p = parents.get(id), n = 0; p && n < 50; p = parents.get(p), n++) if (replies.has(p)) return true;
    return false;
  };
  const lignes = ordre.filter((o) => !cache(o.tache.id) && plan.lignes.has(o.tache.id));
  const feuilles = [...plan.lignes.values()].filter((l) => !l.resume);
  const faites = feuilles.filter((l) => l.fait).length;
  const retard = feuilles.filter((l) => !l.fait && l.fin < aujourdhui).length;
  const filtrees = lignes.filter(({ tache }) => {
    const l = plan.lignes.get(tache.id)!;
    return filtre === 'toutes' || (filtre === 'afaire' ? l.resume || !l.fait : !l.fait && l.fin < aujourdhui);
  });

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

  return (
    <View style={{ gap: 14 }}>
      <Panel accent>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconBtn label="Tous les projets" glyph="‹" onPress={retour} />
          <Text style={{ fontSize: 22 }}>{projet.emoji}</Text>
          <Text numberOfLines={2} style={{ flex: 1, color: C.ink, fontFamily: F.titreM, fontSize: 18 }}>
            {projet.nom}
          </Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: C.sunk, overflow: 'hidden' }} accessibilityLabel={`${plan.avancement} % terminé`}>
          <View style={{ width: `${plan.avancement}%`, height: '100%', backgroundColor: C.coach }} />
        </View>
        <T small muted>
          {`${plan.avancement} % · ${faites}/${feuilles.length} tâches faites${plan.debut && plan.fin ? ` · du ${fmtCourt(plan.debut)} au ${fmtCourt(plan.fin)}` : ''}${retard ? ` · ${retard} en retard` : ''}`}
        </T>
        {plan.nbConflits ? <T small style={{ color: C.agressif }}>{`${plan.nbConflits} tâche${plan.nbConflits > 1 ? 's' : ''} avec des dates imposées qui ne respectent pas leurs liens : touche « dates en conflit » pour les corriger.`}</T> : null}
        {plan.nbCycles ? <T small style={{ color: C.agressif }}>{`${plan.nbCycles} tâche${plan.nbCycles > 1 ? 's' : ''} dans une boucle de liens (A après B après A) : ces liens sont ignorés tant que tu ne les défais pas.`}</T> : null}
      </Panel>

      <Seg options={[{ key: 'taches', label: 'Tâches' }, { key: 'planning', label: 'Planning' }, { key: 'reglages', label: 'Réglages' }]} value={vue} onChange={setVue} />

      {vue === 'taches' ? (
        <Panel title="Tâches et sous-tâches" count={feuilles.length || undefined}>
          <Seg options={[{ key: 'toutes', label: 'Toutes' }, { key: 'afaire', label: 'À faire' }, { key: 'retard', label: 'En retard' }]} value={filtre} onChange={setFiltre} />
          {mine.length ? (
            filtrees.length ? (
              filtrees.map(({ tache, niveau }, i) => (
                <View key={tache.id}>
                  {i ? <Sep /> : null}
                  <LigneTache t={tache} ligne={plan.lignes.get(tache.id)!} niveau={niveau} replie={replies.has(tache.id)} bascule={() => basculerReplie(tache.id)} ouvert={ouverte === tache.id} ouvrir={() => setOuverte(ouverte === tache.id ? null : tache.id)} aujourdhui={aujourdhui} />
                  {ouverte === tache.id ? <EditeurTache t={tache} projet={projet} toutes={espace.taches} ligne={plan.lignes.get(tache.id)} maj={maj} fermer={() => setOuverte(null)} /> : null}
                </View>
              ))
            ) : (
              <Empty icone="taches">Aucune tâche ne correspond.</Empty>
            )
          ) : (
            <Empty icone="taches">Ce projet n’a pas encore de tâche. Ajoute-en une ci-dessous, ou importe un plan Excel.</Empty>
          )}
          <Input value={nouvelle} onChangeText={(v: string) => setNouvelle(v)} placeholder="Nouvelle tâche du projet" returnKeyType="done" onSubmitEditing={ajouter} accessibilityLabel="Nouvelle tâche du projet" />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn small label="Ajouter la tâche" onPress={ajouter} disabled={!nouvelle.trim()} />
            {replies.size ? <Btn small kind="sec" label="Tout déplier" onPress={() => setReplies(new Set())} /> : <Btn small kind="sec" label="Tout replier" onPress={() => setReplies(new Set(mine.filter((t) => plan.lignes.get(t.id)?.resume).map((t) => t.id)))} />}
          </View>
        </Panel>
      ) : null}

      {vue === 'planning' ? (
        <Panel title="Planning" right={<View style={{ flexDirection: 'row', gap: 6 }}>{ZOOMS.map((z) => <Puce key={z.key} label={z.label} on={zoom === z.key} onPress={() => setZoom(z.key)} />)}</View>}>
          {mine.length ? (
            <>
              <Gantt lignes={lignes.map((o) => ({ tache: o.tache, ligne: plan.lignes.get(o.tache.id)!, niveau: o.niveau }))} plan={plan} zoom={zoom} aujourdhui={aujourdhui} ouverte={ouverte} onOuvrir={(id) => (setOuverte(id), setVue('taches'))} />
              <T small muted>Barres : en bleu les tâches, en rouge la voie critique (tout retard dessus décale la fin du projet), ◆ les jalons, les flèches montrent « à faire après ». Le trait pointillé jaune est aujourd’hui. Touche une tâche pour la modifier.</T>
            </>
          ) : (
            <Empty icone="agenda">Rien à planifier pour l’instant.</Empty>
          )}
        </Panel>
      ) : null}

      {vue === 'reglages' ? <ReglagesProjet projet={projet} onImporter={onImporter} retour={retour} update={update} /> : null}
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
