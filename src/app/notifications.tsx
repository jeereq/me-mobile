import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { Btn, Empty, Panel, Screen, Sep, T } from '@/components/ui';
import { fmtCourt, today } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C, MODE_COLORS, MONO } from '@/lib/theme';

const couleurMode = (m: string) => MODE_COLORS[m as keyof typeof MODE_COLORS] || C.accent;

export default function Notifications() {
  const { mode, notifs, chargerNotifs, marquerLues } = useStore();

  // À l'ouverture : on recharge, puis tout ce qui est affiché compte comme lu en quittant l'écran.
  useEffect(() => {
    chargerNotifs().catch(() => {});
    return () => {
      marquerLues().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode !== 'cloud')
    return (
      <Screen>
        <Empty>Les rappels envoyés par le serveur (dans l'app et par email) demandent la connexion à me-api. En mode local, les rappels arrivent en notifications du téléphone.</Empty>
      </Screen>
    );

  const jours = new Map<string, typeof notifs.notifications>();
  for (const n of notifs.notifications) {
    const j = n.quand.slice(0, 10);
    jours.set(j, [...(jours.get(j) || []), n]);
  }

  return (
    <Screen>
      {notifs.nonLues ? <Btn kind="sec" small label={`Tout marquer comme lu (${notifs.nonLues})`} onPress={() => marquerLues()} /> : null}
      {[...jours.entries()].map(([j, liste]) => (
        <Panel key={j} title={j === today() ? "Aujourd'hui" : fmtCourt(j)} count={liste.length}>
          {liste.map((n, i) => (
            <View key={n.id}>
              {i ? <Sep /> : null}
              <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
                <View style={{ width: 4, borderRadius: 2, backgroundColor: couleurMode(n.mode), opacity: n.lu ? 0.4 : 1 }} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T style={{ fontWeight: n.lu ? '400' : '700' }}>{n.titre}</T>
                  <T small muted>
                    {n.corps}
                  </T>
                  <Text style={{ color: C.muted, fontFamily: MONO, fontSize: 11 }}>
                    {n.quand.slice(11, 16)}
                    {n.parEmail ? ' · aussi par email' : ''}
                  </Text>
                </View>
                {!n.lu ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, marginTop: 6 }} /> : null}
              </View>
            </View>
          ))}
        </Panel>
      ))}
      {!notifs.notifications.length ? <Empty>Aucun rappel pour l'instant. Ils arrivent ici à l'heure prévue, selon le mode de chaque relance, tâche ou habitude.</Empty> : null}
    </Screen>
  );
}
