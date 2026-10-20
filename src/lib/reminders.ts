import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, doneIn, habitDue, parse, pastDue, periodKey, today } from './dates';
import type { Config, Espace, Mode } from './types';

const HORIZON_JOURS = 21;
// iOS garde au plus 64 notifications programmées : on garde de la marge.
const MAX_NOTIFS = 58;
const CHANNEL = 'rappels';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

type Planned = { date: Date; title: string; body: string; mode: Mode };

const at = (day: string, time: string) => {
  const d = parse(day);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

export async function demanderPermission() {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

/** Calcule les rappels des prochaines semaines selon le mode de chaque élément. */
export function calculerRappels(e: Espace, c: Config, now = new Date()): Planned[] {
  const out: Planned[] = [];
  const t0 = today();
  const actif = (m: Mode) => c.modes[m]?.actif !== false;
  const matin = c.routineHeure;
  const soir = c.rappelSoir;
  const coachParJour: Record<string, string[]> = {};
  const hebdo: string[] = [];

  // Éléments à date fixe : relances et tâches
  const datés = [
    ...e.relances.filter((r) => r.statut === 'a_faire' && r.date).map((r) => ({ titre: `Relancer ${r.contact}`, detail: r.sujet, date: r.date, mode: r.mode })),
    ...e.taches.filter((t) => t.statut !== 'fait' && t.echeance).map((t) => ({ titre: t.titre, detail: 'Tâche à faire', date: t.echeance as string, mode: t.mode })),
  ];

  for (let i = 0; i < HORIZON_JOURS; i++) {
    const d = addDays(t0, i);

    for (const x of datés) {
      if (!actif(x.mode)) continue;
      if (x.mode === 'normal' || x.mode === 'coach') {
        if (x.date === d) out.push({ date: at(d, '09:00'), title: x.titre, body: x.detail, mode: x.mode });
      } else if (x.mode === 'agressif') {
        if (x.date === d) {
          out.push({ date: at(d, matin), title: `Aujourd'hui : ${x.titre}`, body: x.detail, mode: x.mode });
          out.push({ date: at(d, soir), title: `Pas encore fait : ${x.titre}`, body: x.detail, mode: x.mode });
        } else if (d > x.date) {
          out.push({ date: at(d, '09:00'), title: `En retard : ${x.titre}`, body: `Prévu le ${x.date}. ${x.detail}`, mode: x.mode });
        } else {
          for (const j of [c.agressifJMoins, 1]) if (addDays(d, j) === x.date) out.push({ date: at(d, '09:00'), title: `Dans ${j} j : ${x.titre}`, body: x.detail, mode: x.mode });
        }
      } else if (x.mode === 'hebdo' && i < 7 && !hebdo.includes(x.titre)) hebdo.push(x.titre);
    }

    for (const h of e.habitudes) {
      if (!actif(h.mode) || h.mode === 'passif' || doneIn(h, d)) continue;
      const due = habitDue(h, d);
      if (h.mode === 'normal' && due) out.push({ date: at(d, '09:00'), title: h.nom, body: "C'est le jour.", mode: h.mode });
      if (h.mode === 'agressif') {
        if (due) {
          out.push({ date: at(d, matin), title: `Aujourd'hui : ${h.nom}`, body: 'À faire avant ce soir.', mode: h.mode });
          out.push({ date: at(d, soir), title: `Pas encore fait : ${h.nom}`, body: 'Coche-le dans me dès que c’est fait.', mode: h.mode });
        } else if (h.frequence !== 'quotidien' && periodKey(h.frequence, d) === periodKey(h.frequence, t0) && pastDue(h, d)) {
          out.push({ date: at(d, '09:00'), title: `En retard : ${h.nom}`, body: 'Toujours pas coché pour cette période.', mode: h.mode });
        } else {
          for (const j of [c.agressifJMoins, 1]) if (h.frequence !== 'quotidien' && habitDue(h, addDays(d, j))) out.push({ date: at(d, '09:00'), title: `Dans ${j} j : ${h.nom}`, body: 'Prépare-toi.', mode: h.mode });
        }
      }
      if (h.mode === 'coach' && due) (coachParJour[d] ||= []).push(h.nom);
      if (h.mode === 'hebdo' && due && i < 7 && !hebdo.includes(h.nom)) hebdo.push(h.nom);
    }
  }

  for (const [d, noms] of Object.entries(coachParJour)) {
    out.push({ date: at(d, soir), title: 'Coach me', body: `${noms.length > 1 ? `${noms.length} habitudes` : '1 habitude'} à tenir aujourd'hui : ${noms.slice(0, 3).join(', ')}. Ne casse pas ta série.`, mode: 'coach' });
  }
  if (hebdo.length) {
    const sunday = addDays(t0, (7 - parse(t0).getDay()) % 7);
    out.push({ date: at(sunday, soir), title: 'Ton bilan de la semaine', body: `${hebdo.length} élément(s) à suivre : ${hebdo.slice(0, 4).join(', ')}.`, mode: 'hebdo' });
  }

  return out.filter((p) => p.date > now).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export async function planifierRappels(e: Espace, c: Config) {
  if (Platform.OS === 'web' || !c.canaux.notification) return;
  try {
    if (!(await demanderPermission())) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Rappels me', importance: AndroidImportance.HIGH });
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    const [h, m] = c.routineHeure.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Ton briefing me est prêt', body: 'Agenda, relances, tâches et habitudes du jour.' },
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
