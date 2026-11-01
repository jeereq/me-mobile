import { useState } from 'react';
import { Switch, View } from 'react-native';

import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import type { CompteConnecte } from '@/lib/sync';
import { C } from '@/lib/theme';

import { T, tap } from './ui';

/**
 * L'analyse à l'avance des mails d'un compte (Pro) : toutes les 15 minutes, le serveur analyse les nouveaux mails non lus des 3 derniers jours
 * pour que l'analyse s'ouvre sans attente. Désactivée par défaut : elle envoie ces mails à OpenAI sans que tu aies ouvert l'analyse.
 */
export function AnalyseAuto({ compte }: { compte: CompteConnecte }) {
  const { session, synchroniser, pro } = useStore();
  const [on, setOn] = useState(compte.analyseAuto === true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const changer = async (v: boolean) => {
    tap();
    setOn(v);
    setBusy(true);
    setMsg('');
    try {
      await api(`/integrations/${compte.id}`, { method: 'PATCH', body: { analyseAuto: v }, token: session?.token });
      setMsg(v ? 'Activée : les prochains mails reçus seront analysés dans les 15 minutes.' : 'Désactivée. Les analyses déjà prêtes restent 30 jours, puis disparaissent.');
      await synchroniser(true);
    } catch (e) {
      setOn(!v);
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T>Analyser mes nouveaux mails à l’avance</T>
          <T small muted>
            Le copilote lit tes nouveaux mails non lus (les 10 derniers, sur 3 jours) et prépare l’analyse et les réponses : à l’ouverture, c’est déjà prêt.
          </T>
        </View>
        <Switch accessibilityLabel={`Analyser à l’avance les mails de ${compte.compte}`} value={on} onValueChange={changer} disabled={busy || !pro} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} />
      </View>
      <T small muted>
        Ces mails sont envoyés à OpenAI (l’IA du copilote) même si tu n’ouvres pas l’analyse. Seul le résultat est gardé 30 jours sur le serveur, jamais le texte des mails ; les mails restent non lus.
        {pro ? '' : ' Inclus dans Pro.'}
      </T>
      {msg ? <T small muted>{msg}</T> : null}
    </View>
  );
}
