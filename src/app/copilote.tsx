import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { BadgePro, PlanDuJour, PropositionsTaches, teinteCopilote, useCopilote, useCopiloteVisible } from '@/components/copilote';
import { Icone, type IconeNom } from '@/components/icones';
import { ReservePro } from '@/components/reserve-pro';
import { SqueletteReponse } from '@/components/squelettes';
import { Btn, Colonnes, Empty, Header, Input, Panel, Screen, T } from '@/components/ui';
import { demanderIA, parler, resumeDonnees } from '@/lib/assistant';
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
  const visible = useCopiloteVisible();
  const t = teinteCopilote();
  const { plan, propositions, busy, erreur, planifier } = useCopilote();
  const [q, setQ] = useState('');
  const [rep, setRep] = useState('');
  const [reflechit, setReflechit] = useState(false);
  const nonLus = mails.filter((m) => m.nonLu && m.sens === 'recu').length;
  const recus = mails.filter((m) => m.sens === 'recu').length;

  const demander = async () => {
    if (!q.trim()) return;
    setReflechit(true);
    setRep('');
    try {
      const texte = await demanderIA('question', { question: q.trim(), ton: espace.audio.ton, donnees: resumeDonnees(espace) });
      setRep(texte);
      if (espace.audio.lireReponses) parler(texte, espace.audio);
    } catch (e) {
      setRep((e as Error).message);
    } finally {
      setReflechit(false);
    }
  };

  const entete = <Header retour eyebrow="Ton assistant IA" title="Mon copilote" right={!pro ? <BadgePro /> : undefined} />;

  if (!visible)
    return (
      <Screen>
        {entete}
        <Empty icone="copilote">Le copilote demande la connexion au serveur me-api et l'IA activée dans Configuration.</Empty>
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
          <Panel accent title="Ma journée" right={plan ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>Prêt</Text> : undefined}>
            {!plan && !busy ? <T small muted>Le copilote lit ton agenda, tes relances, tes tâches et tes factures proches, puis te propose un plan et des tâches à ajouter.</T> : null}
            {busy ? <SqueletteReponse /> : plan ? <PlanDuJour plan={plan} /> : null}
            {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
            {!busy && plan ? <PropositionsTaches propositions={propositions} /> : null}
            <View style={{ flexDirection: 'row' }}>
              <Btn couleur={t.c} kind={plan ? 'sec' : 'primary'} label={busy ? 'Je prépare ta journée…' : plan ? 'Refaire le plan' : 'Planifier ma journée'} onPress={planifier} disabled={busy} />
            </View>
          </Panel>
        }
        droite={
          <>
            <Panel title="Mes mails">
              <T small muted>
                {recus ? `Le copilote résume chaque mail, dit s'il attend une réponse et la prépare. Tu envoies tout, ou seulement ce que tu coches.` : 'Connecte Gmail ou Outlook dans Agendas & outils pour que le copilote prépare tes réponses.'}
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
            </Panel>
            {pouvoirs}
          </>
        }
      />
    </Screen>
  );
}
