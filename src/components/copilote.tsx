import { type Href, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/texte';

import { iaDisponible, parler, preparerCopilote, taire } from '@/lib/assistant';
import { celebrer } from '@/lib/celebration';
import { dejaEnTaches, dejaFaites, tachesDepuis, type Proposition } from '@/lib/copilote';
import { today, uid } from '@/lib/dates';
import { clePortee } from '@/lib/equipes';
import { evolutionPlan, ligneFaite, MAX_CONTEXTE_PLAN, planDuJour, planRestant, surPlan, type EvolutionPlan } from '@/lib/plan-du-jour';
import { chargerPlan } from '@/lib/plan-garde';
import { tailleDansCercle, useNomApp } from '@/lib/nom';
import { useStore } from '@/lib/store';
import { teinte, vive } from '@/lib/teinte';
import { alpha, C, F } from '@/lib/theme';
import type { Priorite } from '@/lib/types';

import { BoutonDicter } from './dictee';
import { Icone } from './icones';
import { Ondes } from './ondes';
import { SqueletteReponse } from './squelettes';
import { Btn, T } from './ui';

/** La teinte du copilote, partout dans l'app : lilas, comme la voix et l'assistant. */
export const teinteCopilote = () => teinte(vive('lilas'));

/** Le copilote est proposé dès que l'IA est branchée ; sans Pro, l'écran du copilote montre l'offre. */
export function useCopiloteVisible() {
  const { config } = useStore();
  return config.assistant.ia && iaDisponible();
}

const AUCUNE: Proposition[] = [];

/** Le plan du jour et ses propositions, partagés entre l'accueil, l'écran du copilote et la voix. */
export function useCopilote() {
  const { espace, mails, session, portee } = useStore();
  const d = today();
  const [garde, setGarde] = useState(() => planDuJour(d));
  const [contexte, setContexte] = useState(() => planDuJour(d)?.contexte ?? '');
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');
  useEffect(
    () =>
      surPlan((jour, p) => {
        if (jour !== today()) return;
        setGarde(p);
        setContexte(p?.contexte ?? '');
      }),
    [],
  );
  const pour = session?.user.id ? clePortee(session.user.id, portee) : '';
  useEffect(() => {
    if (pour) chargerPlan(pour, d);
  }, [pour, d]);
  const evolution = useMemo(() => (garde ? evolutionPlan(garde, espace, d) : null), [garde, espace, d]);
  const planifier = async () => {
    setBusy(true);
    setErreur('');
    try {
      await preparerCopilote(espace, d, mails, contexte);
    } catch (e) {
      setErreur((e as Error).message || "Le plan n'a pas pu être préparé.");
    } finally {
      setBusy(false);
    }
  };
  return { plan: garde?.texte ?? '', propositions: garde?.propositions ?? AUCUNE, heure: garde?.heure, contexte, setContexte, evolution, busy, erreur, planifier };
}

const PRIO: Record<Priorite, { label: string; c: () => string }> = {
  haute: { label: 'Haute', c: () => C.agressif },
  moyenne: { label: 'Moyenne', c: () => C.hebdo },
  basse: { label: 'Basse', c: () => C.muted },
};

/** Une case à cocher ronde dans la teinte du copilote. */
export function Case({ on, off }: { on: boolean; off?: boolean }) {
  const t = teinteCopilote();
  return (
    <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 1.8, borderColor: off ? C.line : on ? t.c : C.muted, backgroundColor: on && !off ? t.c : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on || off ? <Text style={{ color: off ? C.muted : t.encre, fontFamily: F.texteF, fontSize: 13, lineHeight: 15 }}>✓</Text> : null}
    </View>
  );
}

/**
 * Les propositions du copilote, chacune avec sa case : « Tout convertir en tâches » les ajoute toutes,
 * « Convertir la sélection » seulement celles qui restent cochées. Une proposition déjà dans les tâches
 * en cours est grisée et n'est pas recréée. Après l'ajout : « Annuler » et « Voir mes tâches ».
 */
export function PropositionsTaches({ propositions, max, titre = 'Propositions' }: { propositions: Proposition[]; /** Au-delà, « Voir les N autres » ouvre l'écran du copilote. */ max?: number; titre?: string }) {
  const { espace, update, config } = useStore();
  const t = teinteCopilote();
  const deja = useMemo(() => dejaEnTaches(propositions, espace.taches), [propositions, espace.taches]);
  const faites = useMemo(() => dejaFaites(propositions, espace.taches, today()), [propositions, espace.taches]);
  const libres = propositions.filter((p) => !deja.has(p.id) && !faites.has(p.id));
  // Tout est coché au départ : on décoche ce qu'on ne veut pas garder.
  // On garde ce qui est décoché, pour ce lot-là : un nouveau plan repart tout coché.
  const [decoches, setDecoches] = useState<{ pour: Proposition[]; ids: Set<string> }>(() => ({ pour: propositions, ids: new Set() }));
  const exclus = decoches.pour === propositions ? decoches.ids : new Set<string>();
  const choix = { has: (id: string) => !exclus.has(id) };
  const [ajoutees, setAjoutees] = useState<string[]>([]);
  useEffect(() => {
    if (!ajoutees.length) return;
    const x = setTimeout(() => setAjoutees([]), 8000);
    return () => clearTimeout(x);
  }, [ajoutees]);

  if (!propositions.length) return null;
  const coches = libres.filter((p) => choix.has(p.id));
  const visibles = max ? propositions.slice(0, max) : propositions;
  const basculer = (id: string) => {
    const n = new Set(exclus);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setDecoches({ pour: propositions, ids: n });
  };
  const convertir = (ids: string[]) => {
    const nouvelles = tachesDepuis(propositions, ids, espace.taches, { mode: config.defauts.tache, id: uid, maintenant: new Date().toISOString() });
    if (!nouvelles.length) return;
    update((e) => ({ ...e, taches: [...nouvelles, ...e.taches] }));
    setAjoutees(nouvelles.map((x) => x.id));
    celebrer({ type: 'message', emoji: '✅', texte: nouvelles.length > 1 ? `${nouvelles.length} tâches ajoutées` : 'Tâche ajoutée' });
  };
  const annuler = () => {
    const ids = new Set(ajoutees);
    update((e) => ({ ...e, taches: e.taches.filter((x) => !ids.has(x.id)) }));
    setAjoutees([]);
  };
  const tousLibresCoches = libres.length > 0 && coches.length === libres.length;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ flex: 1, color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>
          {titre} <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>{propositions.length}</Text>
        </Text>
        {libres.length > 1 ? (
          <Pressable accessibilityRole="button" onPress={() => setDecoches({ pour: propositions, ids: tousLibresCoches ? new Set(libres.map((p) => p.id)) : new Set() })} hitSlop={8}>
            <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>{tousLibresCoches ? 'Tout décocher' : 'Tout cocher'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        {visibles.map((p) => {
          const faite = faites.has(p.id);
          const off = deja.has(p.id) || faite;
          const on = !off && choix.has(p.id);
          const prio = PRIO[p.priorite];
          return (
            <Pressable
              key={p.id}
              accessibilityRole="checkbox"
              aria-checked={on}
              accessibilityState={{ checked: on, disabled: off }}
              accessibilityLabel={faite ? `${p.titre}, faite` : off ? `${p.titre}, déjà dans tes tâches` : p.titre}
              disabled={off}
              onPress={() => basculer(p.id)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: on ? t.ligne : C.line, backgroundColor: on ? t.douce : C.sunk, opacity: off ? 0.6 : pressed ? 0.85 : 1 })}>
              <View style={{ paddingTop: 1 }}>
                <Case on={on} off={off} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15, textDecorationLine: off ? 'line-through' : 'none' }}>{p.titre}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2 }}>
                  {off ? (
                    <Text style={{ color: C.coach, fontFamily: F.texteM, fontSize: 12.5 }}>{faite ? 'Faite' : 'Déjà dans tes tâches'}</Text>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: prio.c() }} />
                        <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{prio.label}</Text>
                      </View>
                      {p.heure ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{p.heure}</Text> : null}
                      {p.echeance && p.echeance !== today() ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>pour le {p.echeance.slice(8, 10)}/{p.echeance.slice(5, 7)}</Text> : null}
                    </>
                  )}
                </View>
                {p.raison && !off ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{p.raison}</Text> : null}
              </View>
            </Pressable>
          );
        })}
        {max && propositions.length > max ? (
          <Pressable accessibilityRole="link" onPress={() => router.push('/copilote' as Href)} style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
            <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>{propositions.length - max > 1 ? `Voir les ${propositions.length - max} autres propositions` : 'Voir l’autre proposition'} ›</Text>
          </Pressable>
        ) : null}
      </View>

      {ajoutees.length ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, backgroundColor: alpha(C.coach, 0.12) }}>
          <Text style={{ flex: 1, minWidth: 150, color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>
            {ajoutees.length > 1 ? `${ajoutees.length} tâches ajoutées` : 'Tâche ajoutée'} à tes tâches
          </Text>
          <Pressable accessibilityRole="button" onPress={annuler} hitSlop={8}>
            <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 13 }}>Annuler</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push('/taches')} hitSlop={8}>
            <Text style={{ color: C.coach, fontFamily: F.texteF, fontSize: 13 }}>Voir mes tâches ›</Text>
          </Pressable>
        </View>
      ) : libres.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn couleur={t.c} label={`Tout convertir en tâches (${libres.length})`} onPress={() => convertir(libres.map((p) => p.id))} />
          {coches.length && coches.length < libres.length ? <Btn couleur={t.c} kind="sec" label={`Convertir la sélection (${coches.length})`} onPress={() => convertir(coches.map((p) => p.id))} /> : null}
        </View>
      ) : (
        <T small muted>
          Tout est déjà dans tes tâches ou fait.
        </T>
      )}
    </View>
  );
}

/** Le plan du jour, lu tel quel (une idée par ligne), avec « Écouter ». */
/** Ce que tu dis au copilote de ta journée, avant de planifier. Replié sur l'accueil, pour laisser la place au plan. */
export function ContextePlan({ valeur, onChange, replie }: { valeur: string; onChange: (v: string) => void; replie?: boolean }) {
  const t = teinteCopilote();
  const [ouvert, setOuvert] = useState(!replie);
  if (!ouvert && !valeur)
    return (
      <Pressable accessibilityRole="button" hitSlop={6} onPress={() => setOuvert(true)} style={{ alignSelf: 'flex-start' }}>
        <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>+ Ton contexte</Text>
      </Pressable>
    );
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk }}>
      <TextInput
        multiline
        value={valeur}
        onChangeText={onChange}
        maxLength={MAX_CONTEXTE_PLAN}
        accessibilityLabel="Ton contexte pour le plan"
        placeholder="Ton contexte : 2 h ce matin, réunion annulée…"
        placeholderTextColor={C.muted}
        selectionColor={C.accent}
        textAlignVertical="top"
        style={{ minHeight: 44, padding: 0, color: C.ink, fontFamily: F.texte, fontSize: 14.5, lineHeight: 20, outlineStyle: 'none' } as object}
      />
      <View style={{ flexDirection: 'row' }}>
        <BoutonDicter valeur={valeur} onTexte={onChange} />
      </View>
    </View>
  );
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Ce qui a bougé depuis le plan : rien de changé, rien d'affiché. */
export function BandeauPlan({ evolution, onActualiser, busy }: { evolution: EvolutionPlan | null; onActualiser: () => void; busy?: boolean }) {
  const t = teinteCopilote();
  if (!evolution || busy) return null;
  const parties = [evolution.faits.length ? pluriel(evolution.faits.length, 'fait', 'faits') : '', evolution.nouveaux ? pluriel(evolution.nouveaux, 'nouveau', 'nouveaux') : '', evolution.rdv ? `${evolution.rdv} rendez-vous` : ''].filter(Boolean);
  if (!parties.length) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: t.douce }}>
      <Text style={{ flex: 1, minWidth: 150, color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>{`Depuis ce plan : ${parties.join(' · ')}`}</Text>
      <Pressable accessibilityRole="button" hitSlop={6} onPress={onActualiser}>
        <Text style={{ color: t.c, fontFamily: F.texteF, fontSize: 13 }}>Actualiser</Text>
      </Pressable>
    </View>
  );
}

export function PlanDuJour({ plan, lignes, faits = [] }: { plan: string; /** Au-delà, le plan est coupé (accueil). */ lignes?: number; /** Ce qui est fait depuis le plan : ces lignes sont barrées. */ faits?: EvolutionPlan['faits'] }) {
  const { espace } = useStore();
  const nomApp = useNomApp();
  const [parle, setParle] = useState(false);
  const [mot, setMot] = useState(0);
  const t = teinteCopilote();
  const tout = plan.split('\n').filter((l) => l.trim());
  const vues = lignes ? tout.slice(0, lignes) : tout;
  useEffect(() => () => void taire(), []);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ gap: 4 }}>
        {vues.map((l, i) => {
          const fait = ligneFaite(l, faits);
          return (
            <Text key={i} accessibilityLabel={fait ? `Fait : ${l}` : undefined} style={{ color: fait ? C.muted : C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 22, textDecorationLine: fait ? 'line-through' : 'none' }}>
              {l}
            </Text>
          );
        })}
        {lignes && tout.length > lignes ? (
          <Pressable accessibilityRole="link" onPress={() => router.push('/copilote' as Href)} hitSlop={6}>
            <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>Lire tout le plan ›</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (parle) {
              taire();
              setParle(false);
            } else parler(planRestant(plan, faits) || plan, espace.audio, { titre: 'Plan du jour', onStart: () => setParle(true), onDone: () => setParle(false), onMot: () => setMot((x) => x + 1) });
          }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: t.douce, opacity: pressed ? 0.8 : 1 })}>
          <Icone nom="onde" color={t.c} size={16} />
          <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>{parle ? 'Arrêter' : 'Écouter le plan'}</Text>
        </Pressable>
      </View>
      {parle ? <Ondes mode="parle" mot={mot} couleur={t.c} couleur2={C.accent} taille={150}>
          <Text fixe style={{ color: t.c, fontFamily: F.titre, fontSize: tailleDansCercle(nomApp, 22), letterSpacing: -0.5 }}>{nomApp}</Text>
        </Ondes> : null}
    </View>
  );
}

/** Le badge « PRO » à côté du nom du copilote, quand l'offre gratuite ne l'inclut pas. */
export function BadgePro() {
  return (
    <View style={{ borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: alpha(C.hebdo, 0.18) }}>
      <Text style={{ color: C.hebdo, fontFamily: F.texteF, fontSize: 10.5, letterSpacing: 0.6 }}>PRO</Text>
    </View>
  );
}

/**
 * La carte du copilote en tête de l'accueil : ce qu'il sait faire, « Planifier ma journée », puis le plan
 * et ses propositions à convertir en tâches. Sans Pro, elle présente le copilote et mène à l'offre.
 */
export function CarteCopilote() {
  const { pro, mails } = useStore();
  const t = teinteCopilote();
  const { plan, propositions, contexte, setContexte, evolution, busy, erreur, planifier } = useCopilote();
  const nonLus = mails.filter((m) => m.nonLu && m.sens === 'recu').length;

  return (
    <View style={{ borderRadius: 22, borderWidth: 1, borderColor: t.ligne, backgroundColor: C.sombre ? alpha(t.c, 0.08) : alpha(t.c, 0.05), padding: 18, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.c, alignItems: 'center', justifyContent: 'center' }}>
          <Icone nom="copilote" color={t.encre} size={24} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 19, letterSpacing: -0.3 }}>Mon copilote</Text>
            {!pro ? <BadgePro /> : null}
          </View>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13.5 }}>
            {plan ? 'Ton plan est prêt. Garde les propositions qui te vont.' : 'Priorités, tâches et réponses aux mails.'}
          </Text>
        </View>
        <Pressable accessibilityRole="link" accessibilityLabel="Ouvrir Mon copilote" onPress={() => router.push('/copilote' as Href)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ color: t.c, fontFamily: F.texteF, fontSize: 13 }}>Ouvrir ›</Text>
        </Pressable>
      </View>

      {!pro ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn couleur={t.c} label="Découvrir le copilote" onPress={() => router.push('/copilote' as Href)} />
        </View>
      ) : (
        <>
          {plan ? <BandeauPlan evolution={evolution} onActualiser={planifier} busy={busy} /> : null}
          {busy ? <SqueletteReponse /> : plan ? <PlanDuJour plan={plan} lignes={4} faits={evolution?.faits} /> : null}
          <ContextePlan replie valeur={contexte} onChange={setContexte} />
          {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
          {!busy && plan ? <PropositionsTaches propositions={propositions} max={4} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn couleur={t.c} kind={plan ? 'sec' : 'primary'} label={busy ? 'Je prépare ta journée…' : plan ? 'Refaire le plan' : 'Planifier ma journée'} onPress={planifier} disabled={busy} />
            {nonLus ? <Btn couleur={t.c} kind="sec" label={`Analyser mes mails (${nonLus})`} onPress={() => router.push({ pathname: '/messages', params: { analyser: '1' } } as never)} /> : null}
          </View>
        </>
      )}
    </View>
  );
}
