import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/texte';

import { BadgePro, BandeauPlan, ContextePlan, PlanDuJour, PropositionsTaches, teinteCopilote, useCopilote, useCopiloteVisible } from '@/components/copilote';
import { Icone, type IconeNom } from '@/components/icones';
import { Ondes } from '@/components/ondes';
import { ReservePro } from '@/components/reserve-pro';
import { SqueletteReponse } from '@/components/squelettes';
import { Btn, Colonnes, Empty, Header, Input, Panel, Screen, T } from '@/components/ui';
import { demanderIA, iaDisponible, parler, resumeDonnees, taire } from '@/lib/assistant';
import { fmtHeure } from '@/lib/dates';
import { tailleDansCercle, useNomApp } from '@/lib/nom';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

/** Ce que le copilote sait faire, en tête de l'écran (et pour l'offre gratuite, ce que Pro débloque). */
const POUVOIRS: { icone: IconeNom; titre: string; texte: string }[] = [
  { icone: 'jour', titre: 'Planifier ta journée', texte: 'Tes priorités et un déroulé par créneaux, autour de tes rendez-vous.' },
  { icone: 'taches', titre: 'Proposer des tâches', texte: 'Tout convertir en tâches d’un geste, ou cocher seulement celles que tu gardes.' },
  { icone: 'mail', titre: 'Répondre à tes mails', texte: 'Il analyse un mail ou plusieurs d’un coup et prépare les réponses.' },
  { icone: 'micro', titre: 'Répondre à tes questions', texte: '« Qui dois-je relancer cette semaine ? », à l’écrit ou à la voix.' },
];

/**
 * Mon copilote : le plan de la journée et ses propositions à convertir en tâches (toutes ou une sélection),
 * l'analyse des mails avec des réponses prêtes, et les questions à l'IA. Fonction Pro.
 */
export default function Copilote() {
  const { espace, pro, mails } = useStore();
  const nomApp = useNomApp();
  const visible = useCopiloteVisible();
  const t = teinteCopilote();
  const { plan, propositions, heure, contexte, setContexte, evolution, busy, erreur, planifier } = useCopilote();
  const [q, setQ] = useState('');
  const [rep, setRep] = useState('');
  const [echec, setEchec] = useState('');
  const [reflechit, setReflechit] = useState(false);
  // La réponse lue à voix haute : les ondes du copilote bougent avec elle.
  const [parle, setParle] = useState(false);
  const [mot, setMot] = useState(0);
  useEffect(() => () => void taire(), []);
  const nonLus = mails.filter((m) => m.nonLu && m.sens === 'recu').length;
  const recus = mails.filter((m) => m.sens === 'recu').length;

  const demander = async () => {
    if (!q.trim()) return;
    setReflechit(true);
    setRep('');
    setEchec('');
    try {
      const texte = await demanderIA('question', { question: q.trim(), ton: espace.audio.ton, donnees: resumeDonnees(espace, mails) });
      setRep(texte);
      if (espace.audio.lireReponses) parler(texte, espace.audio, { onStart: () => setParle(true), onDone: () => setParle(false), onMot: () => setMot((x) => x + 1) });
    } catch (e) {
      setEchec((e as Error).message);
    } finally {
      setReflechit(false);
    }
  };

  const entete = <Header retour eyebrow="Ton assistant IA" title="Mon copilote" right={!pro ? <BadgePro /> : undefined} />;

  if (!visible)
    return (
      <Screen>
        {entete}
        {iaDisponible() ? (
          <>
            <Empty icone="copilote">Active l'IA pour utiliser le copilote.</Empty>
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Btn couleur={t.c} label="Activer l'IA" onPress={() => router.push('/config?section=ia' as never)} />
            </View>
          </>
        ) : (
          <Empty icone="copilote">Le copilote n'est pas disponible pour le moment.</Empty>
        )}
      </Screen>
    );

  const pouvoirs = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {POUVOIRS.map((p) => (
        <View key={p.titre} style={{ flexGrow: 1, flexBasis: 220, flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: t.douce }}>
          <Icone nom={p.icone} color={t.c} size={22} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14.5 }}>{p.titre}</Text>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{p.texte}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  if (!pro)
    return (
      <Screen>
        {entete}
        {pouvoirs}
        <ReservePro fonction="assistant" />
      </Screen>
    );

  return (
    <Screen>
      {entete}
      <Colonnes
        gauche={
          <Panel accent title="Ma journée" right={plan ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{heure ? `Préparé à ${fmtHeure(heure)}` : 'Prêt'}</Text> : undefined}>
            {plan ? <BandeauPlan evolution={evolution} onActualiser={planifier} busy={busy} /> : null}
            {busy ? <SqueletteReponse /> : plan ? <PlanDuJour plan={plan} faits={evolution?.faits} /> : null}
            {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
            {!busy && plan ? <PropositionsTaches propositions={propositions} /> : null}
            <ContextePlan valeur={contexte} onChange={setContexte} />
            <View style={{ flexDirection: 'row' }}>
              <Btn couleur={t.c} kind={plan ? 'sec' : 'primary'} label={busy ? 'Je prépare ta journée…' : plan ? 'Refaire le plan' : 'Planifier ma journée'} onPress={planifier} disabled={busy} />
            </View>
          </Panel>
        }
        droite={
          <>
            <Panel title="Mes mails">
              <T small muted>
                {recus ? `Résumés et réponses prêtes. Tu envoies ce que tu coches.` : 'Connecte Gmail ou Outlook dans Agendas & outils.'}
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {recus ? <Btn couleur={t.c} label={nonLus ? `Analyser mes ${nonLus} non lus` : 'Analyser mes derniers mails'} onPress={() => router.push({ pathname: '/messages', params: { analyser: '1' } } as never)} /> : null}
                {recus ? <Btn couleur={t.c} kind="sec" label="Choisir les mails" onPress={() => router.push({ pathname: '/messages', params: { analyser: 'choisir' } } as never)} /> : <Btn kind="sec" label="Agendas & outils" onPress={() => router.push('/sources')} />}
              </View>
            </Panel>
            <Panel title="Poser une question">
              <Input value={q} onChangeText={setQ} multiline placeholder="Ex. Qui dois-je relancer en priorité cette semaine ?" style={{ minHeight: 80, textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row' }}>
                <Btn couleur={t.c} label={reflechit ? 'Je réfléchis…' : 'Demander'} onPress={demander} disabled={reflechit || !q.trim()} />
              </View>
              {reflechit ? <SqueletteReponse /> : rep ? <T>{rep}</T> : null}
              {echec ? (
                <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
                  <T small style={{ color: C.agressif }}>{echec}</T>
                  <View style={{ flexDirection: 'row' }}>
                    <Btn small kind="sec" label="Réessayer" onPress={demander} />
                  </View>
                </View>
              ) : null}
              {parle ? <Ondes mode="parle" mot={mot} couleur={t.c} couleur2={C.accent} taille={150}>
          <Text fixe style={{ color: t.c, fontFamily: F.titre, fontSize: tailleDansCercle(nomApp, 22), letterSpacing: -0.5 }}>{nomApp}</Text>
        </Ondes> : null}
            </Panel>
            {pouvoirs}
          </>
        }
      />
    </Screen>
  );
}
