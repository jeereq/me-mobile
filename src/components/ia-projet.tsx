import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/texte';

import { demanderIA, iaDisponible } from '@/lib/assistant';
import { ApiError } from '@/lib/api';
import { today, uid } from '@/lib/dates';
import {
  ajouterPlanIA,
  donneesPlanIA,
  donneesProjet,
  lireEtat,
  lirePlanIA,
  lireReponse,
  QUESTIONS_PROJET,
  risquesProjet,
  type EtatIA,
  type TachePlanIA,
} from '@/lib/ia-projet';
import type { Plan } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Projet, Tache } from '@/lib/types';

import { teinteCopilote } from './copilote';
import { ReserveProjets } from './reserve-pro';
import { Puce } from './finances-plus';
import { SqueletteReponse } from './squelettes';
import { Btn, Check, Input, Panel, T } from './ui';

type Maj = (fn: (t: Tache[]) => Tache[]) => void;

const message = (e: unknown) => (e instanceof ApiError ? (e.status === 402 ? 'L’IA des projets fait partie de Me Projets (et Pro).' : e.message) : e instanceof Error ? e.message : 'L’IA n’a pas répondu. Réessaie dans un instant.');

function Niveau({ niveau }: { niveau: 'haut' | 'moyen' }) {
  const c = niveau === 'haut' ? C.agressif : C.hebdo;
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: alpha(c, 0.14) }}>
      <Text style={{ color: c, fontFamily: F.texteM, fontSize: 12 }}>{niveau === 'haut' ? 'Élevé' : 'Moyen'}</Text>
    </View>
  );
}

/** Ce que l'app repère seule : visible sans IA, sans Pro, sans réseau. */
function RisquesLocaux({ taches, plan }: { taches: Tache[]; plan: Plan }) {
  const risques = useMemo(() => risquesProjet({ taches, plan, aujourdhui: today() }), [taches, plan]);
  return (
    <Panel title="Risques" count={risques.length || undefined}>
      {risques.length ? (
        risques.map((r) => (
          <View key={r.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Niveau niveau={r.niveau} />
              {r.tache ? <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14.5, flexShrink: 1 }}>{r.tache}</Text> : null}
            </View>
            <T small muted>{r.texte}</T>
          </View>
        ))
      ) : (
        <T small muted>Rien ne menace la date de fin pour l’instant.</T>
      )}
    </Panel>
  );
}

function Etat({ projet, taches, plan }: { projet: Projet; taches: Tache[]; plan: Plan }) {
  const { espace, equipeActive } = useStore();
  const t = teinteCopilote();
  const [etat, setEtat] = useState<EtatIA | null>(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');
  const analyser = async () => {
    setBusy(true);
    setErreur('');
    try {
      const brut = await demanderIA('projet_etat', { ton: espace.audio.ton, donnees: donneesProjet({ projet, taches, plan, aujourdhui: today(), membres: equipeActive?.membres }) });
      const lu = lireEtat(brut);
      if (!lu) throw new Error('L’IA n’a rien de clair à dire. Réessaie dans un instant.');
      setEtat(lu);
    } catch (e) {
      setErreur(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="État du projet">
      {busy ? <SqueletteReponse /> : null}
      {!busy && etat ? (
        <View style={{ gap: 12 }}>
          {etat.resume ? <T>{etat.resume}</T> : null}
          {etat.risques.map((r, i) => (
            <View key={i} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Niveau niveau={r.niveau} />
                {r.tache ? <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14.5, flexShrink: 1 }}>{r.tache}</Text> : null}
              </View>
              {r.pourquoi ? <T small muted>{r.pourquoi}</T> : null}
              {r.action ? <T small>{`→ ${r.action}`}</T> : null}
            </View>
          ))}
          {etat.actions.length ? (
            <View style={{ gap: 4 }}>
              <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14.5 }}>Cette semaine</Text>
              {etat.actions.map((a, i) => (
                <T key={i} small>{`• ${a}`}</T>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
      <View style={{ flexDirection: 'row' }}>
        <Btn couleur={t.c} kind={etat ? 'sec' : 'primary'} label={busy ? 'J’analyse…' : etat ? 'Actualiser' : 'Analyser le projet'} onPress={analyser} disabled={busy || !taches.length} />
      </View>
    </Panel>
  );
}

function PlanDepuisObjectif({ projet, taches, maj }: { projet: Projet; taches: Tache[]; maj: Maj }) {
  const { espace, config, equipeActive, lectureSeule } = useStore();
  const t = teinteCopilote();
  const [objectif, setObjectif] = useState('');
  const [plan, setPlan] = useState<TachePlanIA[]>([]);
  const [decoches, setDecoches] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');
  const [ajoutees, setAjoutees] = useState(0);
  const proposer = async () => {
    setBusy(true);
    setErreur('');
    setAjoutees(0);
    try {
      const brut = await demanderIA('projet_plan', { question: objectif.trim(), ton: espace.audio.ton, donnees: donneesPlanIA({ projet, taches, aujourdhui: today(), membres: equipeActive?.membres }) });
      const lu = lirePlanIA(brut);
      if (!lu.length) throw new Error('L’IA n’a pas proposé de plan. Précise ton objectif et réessaie.');
      setPlan(lu);
      setDecoches(new Set());
    } catch (e) {
      setErreur(message(e));
    } finally {
      setBusy(false);
    }
  };
  // Décocher une phase écarte aussi ses sous-tâches.
  const ecartees = useMemo(() => {
    const e = new Set(decoches);
    for (const x of plan) if (x.parent && decoches.has(x.parent)) e.add(x.titre);
    return e;
  }, [plan, decoches]);
  const gardees = plan.filter((x) => !ecartees.has(x.titre));
  const ajouter = () => {
    const choisies = gardees.map((x) => ({ ...x, apres: x.apres.filter((a) => !ecartees.has(a)) }));
    maj((ts) => ajouterPlanIA(ts, projet, choisies, { mode: config.defauts.tache, uid, membres: equipeActive?.membres }));
    setAjoutees(choisies.length);
    setPlan([]);
    setObjectif('');
  };
  const bascule = (titre: string) => setDecoches((d) => (d.has(titre) ? new Set([...d].filter((x) => x !== titre)) : new Set([...d, titre])));
  return (
    <Panel title="Plan depuis un objectif">
      {!plan.length ? (
        <>
          <Input label="Ce que le projet doit réussir" value={objectif} onChangeText={(v: string) => setObjectif(v)} multiline placeholder="Migrer le site vers un nouvel hébergeur avant fin janvier" style={{ minHeight: 80, textAlignVertical: 'top' }} />
          {busy ? <SqueletteReponse /> : null}
          {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
          {ajoutees ? <T small>{`${ajoutees} tâche${ajoutees > 1 ? 's ajoutées' : ' ajoutée'} au projet.`}</T> : null}
          <View style={{ flexDirection: 'row' }}>
            <Btn couleur={t.c} label={busy ? 'Je prépare le plan…' : 'Proposer un plan'} onPress={proposer} disabled={busy || objectif.trim().length < 8 || lectureSeule} />
          </View>
        </>
      ) : (
        <>
          <T small muted>Décoche ce que tu ne veux pas garder.</T>
          {plan.map((x) => (
            <View key={x.titre} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: x.parent ? 22 : 0, opacity: ecartees.has(x.titre) ? 0.45 : 1 }}>
              <Check checked={!ecartees.has(x.titre)} onToggle={() => bascule(x.titre)} label={x.titre} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontFamily: x.parent ? F.texte : F.texteF, fontSize: 14.5 }}>{x.titre}</Text>
                <T small muted>{[x.jalon ? 'Jalon' : plan.some((y) => y.parent === x.titre) ? null : `${x.duree} j`, x.responsable || null].filter(Boolean).join(' · ')}</T>
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn couleur={t.c} label={`Ajouter ${gardees.length} tâche${gardees.length > 1 ? 's' : ''}`} onPress={ajouter} disabled={!gardees.length} />
            <Btn kind="sec" label="Refaire" onPress={proposer} disabled={busy} />
            <Btn kind="sec" label="Annuler" onPress={() => setPlan([])} />
          </View>
        </>
      )}
    </Panel>
  );
}

function Question({ projet, taches, plan }: { projet: Projet; taches: Tache[]; plan: Plan }) {
  const { espace, equipeActive } = useStore();
  const t = teinteCopilote();
  const [question, setQuestion] = useState('');
  const [reponse, setReponse] = useState<{ q: string; r: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');
  const demander = async (q: string) => {
    if (!q.trim()) return;
    setBusy(true);
    setErreur('');
    try {
      const brut = await demanderIA('projet_question', { question: q.trim(), ton: espace.audio.ton, donnees: donneesProjet({ projet, taches, plan, aujourdhui: today(), membres: equipeActive?.membres }) });
      const r = lireReponse(brut);
      if (!r) throw new Error('L’IA n’a rien répondu. Réessaie dans un instant.');
      setReponse({ q: q.trim(), r });
      setQuestion('');
    } catch (e) {
      setErreur(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Poser une question">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {QUESTIONS_PROJET.map((q) => (
          <Puce key={q} label={q} on={false} onPress={() => !busy && demander(q)} />
        ))}
      </View>
      <Input value={question} onChangeText={(v: string) => setQuestion(v)} placeholder="Ta question sur le projet" returnKeyType="send" onSubmitEditing={() => demander(question)} />
      {busy ? <SqueletteReponse /> : null}
      {!busy && reponse ? (
        <View style={{ gap: 4 }}>
          <T small muted>{reponse.q}</T>
          <T>{reponse.r}</T>
        </View>
      ) : null}
      {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
      <View style={{ flexDirection: 'row' }}>
        <Btn couleur={t.c} label={busy ? 'Je cherche…' : 'Demander'} onPress={() => demander(question)} disabled={busy || !question.trim()} />
      </View>
    </Panel>
  );
}

/** L'onglet « IA » d'un projet : les risques repérés par l'app, puis l'état, un plan et des questions avec l'assistant. */
export function IAProjet({ projet, taches, plan, maj }: { projet: Projet; taches: Tache[]; plan: Plan; maj: Maj }) {
  const { config, projets } = useStore();
  const possible = config.assistant.ia && iaDisponible();
  return (
    <View style={{ gap: 16 }}>
      <RisquesLocaux taches={taches} plan={plan} />
      {!possible ? (
        <Panel title="Assistant">
          <T small muted>L’assistant IA est désactivé.</T>
        </Panel>
      ) : !projets ? (
        <ReserveProjets fonction="projetsIA" />
      ) : (
        <>
          <Etat projet={projet} taches={taches} plan={plan} />
          <PlanDepuisObjectif projet={projet} taches={taches} maj={maj} />
          <Question projet={projet} taches={taches} plan={plan} />
        </>
      )}
    </View>
  );
}
