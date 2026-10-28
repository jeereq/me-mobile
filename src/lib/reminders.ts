import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { calculerRappels } from './rappels-telephone';
import type { Config, Espace } from './types';

export { calculerRappels } from './rappels-telephone';

// iOS garde au plus 64 notifications programmées : on garde de la marge.
const MAX_NOTIFS = 58;
const CHANNEL = 'rappels';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function demanderPermission() {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

export async function planifierRappels(e: Espace, c: Config) {
  if (Platform.OS === 'web' || !c.canaux.notification) return;
  try {
    if (!(await demanderPermission())) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Rappels Me', importance: AndroidImportance.HIGH });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    const [h, m] = c.routineHeure.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Ton briefing Me est prêt', body: 'Agenda, relances, tâches et habitudes du jour.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: h || 7, minute: m || 0, channelId: CHANNEL },
    });
    for (const p of calculerRappels(e, c).slice(0, MAX_NOTIFS)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: p.title, body: p.body, data: { mode: p.mode } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL },
      });
    }
  } catch {
    // Les rappels sont un plus : une erreur ici ne doit jamais bloquer l'app.
  }
}
