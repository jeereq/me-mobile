import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { addDays, doneIn, habitDue, parse, pastDue, periodKey, today } from './dates';
import { heureDe, reglesDuMode } from './modes';
import { estTacheDeProjet, tachesActives } from './planning';
import { type Config, type Espace, type Mode, MODES } from './types';

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

/** Calcule les rappels des prochaines semaines selon le mode de chaque élément et les règles de ce mode (voir `modes.ts`). */
export function calculerRappels(e: Espace, c: Config, now = new Date()): Planned[] {
  const out: Planned[] = [];
  const t0 = today();
  const actif = (m: Mode) => c.modes[m]?.actif !== false;
  const matin = c.routineHeure;
  const soir = c.rappelSoir;
  const heure = (t: string) => heureDe(t, matin, soir);

  // Éléments à date fixe : relances et tâches
  const datés = [
    ...e.relances.filter((r) => r.statut === 'a_faire' && r.date).map((r) => ({ titre: `Relancer ${r.contact}`, detail: r.sujet, date: r.date, mode: r.mode })),
    // Tâches de projet : pas les résumés ni les tâches bloquées, et pas de rappel quotidien pour un vieux retard.
    ...tachesActives(e, t0).filter((t) => t.echeance && (!estTacheDeProjet(t, e.projets) || t.echeance >= addDays(t0, -3))).map((t) => ({ titre: t.titre, detail: 'Tâche à faire', date: t.echeance as string, mode: t.mode })),
  ];

  for (let i = 0; i < HORIZON_JOURS; i++) {
    const d = addDays(t0, i);
    const resumes: Partial<Record<Mode, string[]>> = {};

    for (const x of datés) {
      if (!actif(x.mode)) continue;
      const r = reglesDuMode(c, x.mode);
      if (x.date === d) {
        // Une seule heure : le titre tel quel ; plusieurs : on insiste (« Aujourd'hui », puis « Pas encore fait »).
        r.jourJ.forEach((t, k) => out.push({ date: at(d, heure(t)), title: r.jourJ.length === 1 ? x.titre : k === 0 ? `Aujourd'hui : ${x.titre}` : `Pas encore fait : ${x.titre}`, body: x.detail, mode: x.mode }));
      } else if (d > x.date) {
        if (r.retard) out.push({ date: at(d, heure(r.heure)), title: `En retard : ${x.titre}`, body: `Prévu le ${x.date}. ${x.detail}`, mode: x.mode });
      } else {
        for (const j of r.avant) if (addDays(d, j) === x.date) out.push({ date: at(d, heure(r.heure)), title: `Dans ${j} j : ${x.titre}`, body: x.detail, mode: x.mode });
      }
    }

    for (const h of e.habitudes) {
      if (!actif(h.mode) || doneIn(h, d)) continue;
      const r = reglesDuMode(c, h.mode);
      if (habitDue(h, d)) {
        if (r.resume) (resumes[h.mode] ||= []).push(h.nom);
        else
          r.jourJ.forEach((t, k) => {
            if (r.jourJ.length === 1) out.push({ date: at(d, heure(t)), title: h.nom, body: "C'est le jour.", mode: h.mode });
            else if (k === 0) out.push({ date: at(d, heure(t)), title: `Aujourd'hui : ${h.nom}`, body: 'À faire avant ce soir.', mode: h.mode });
            else out.push({ date: at(d, heure(t)), title: `Pas encore fait : ${h.nom}`, body: 'Coche-le dans Me dès que c’est fait.', mode: h.mode });
          });
      } else if (!r.resume && h.frequence !== 'quotidien') {
        if (periodKey(h.frequence, d) === periodKey(h.frequence, t0) && pastDue(h, d)) {
          if (r.retard) out.push({ date: at(d, heure(r.heure)), title: `En retard : ${h.nom}`, body: 'Toujours pas coché pour cette période.', mode: h.mode });
        } else {
          for (const j of r.avant) if (habitDue(h, addDays(d, j))) out.push({ date: at(d, heure(r.heure)), title: `Dans ${j} j : ${h.nom}`, body: 'Prépare-toi.', mode: h.mode });
        }
      }
    }

    // Message du soir qui regroupe les habitudes du jour (mode « coach » d'origine).
    for (const m of MODES) {
      const noms = resumes[m];
      if (!noms?.length) continue;
      const corps = `${noms.length > 1 ? `${noms.length} habitudes` : '1 habitude'} à tenir aujourd'hui : ${noms.slice(0, 3).join(', ')}.`;
      if (m === 'coach') out.push({ date: at(d, soir), title: 'Coach Me', body: `${corps} Ne casse pas ta série.`, mode: m });
      else out.push({ date: at(d, soir), title: 'Tes habitudes du jour', body: corps, mode: m });
    }

    // Bilan de la semaine : le jour choisi pour le mode (le dimanche soir pour « bilan hebdo »), avec ce qui est suivi dans ce mode pour la semaine à venir.
    for (const m of MODES) {
      const r = reglesDuMode(c, m);
      if (!actif(m) || !r.bilan || parse(d).getDay() !== r.bilan.jour) continue;
      const suivis = [
        ...datés.filter((x) => x.mode === m && x.date >= d && x.date <= addDays(d, 7)).map((x) => x.titre),
        ...e.habitudes.filter((h) => h.mode === m && Array.from({ length: 7 }, (_, k) => addDays(d, k + 1)).some((j) => habitDue(h, j))).map((h) => h.nom),
      ];
      if (suivis.length) out.push({ date: at(d, heure(r.bilan.heure)), title: 'Ton bilan de la semaine', body: `${suivis.length} élément(s) à suivre : ${suivis.slice(0, 4).join(', ')}.`, mode: m });
    }
  }

  return out.filter((p) => p.date > now).sort((a, b) => a.date.getTime() - b.date.getTime());
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
