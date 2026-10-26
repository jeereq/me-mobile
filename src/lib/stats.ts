import { addDays, doneIn, habitDue, parse } from './dates';
import { bilan, bornes, financesDe } from './finances';
import { jeuDe, meilleureSerie, serie } from './jeu';
import type { Espace } from './types';

/** Statistiques calculées à partir de l'espace : rien n'est stocké en plus. */

const JOURS_NOMS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const dans = (x: string | null | undefined, a: string, b: string) => !!x && x >= a && x <= b;
const ecartJours = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
const moyenne = (l: number[]) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : null);

export type Barre = { cle: string; axe: string; detail: string; v: number };

export function statistiques(e: Espace, d: string, jours = 30) {
  const debut = addDays(d, 1 - jours);
  const avDebut = addDays(debut, -jours);
  const avFin = addDays(debut, -1);
  const j = jeuDe(e);
  const gains = Object.values(j.gains);
  const f = financesDe(e);

  const tachesFaites = (a: string, b: string) => e.taches.filter((t) => t.statut === 'fait' && dans(t.faitLe, a, b)).length;
  const relancesAbouties = (a: string, b: string) => e.relances.filter((r) => r.statut === 'repondu' && dans(r.reponduLe, a, b)).length;
  const points = (a: string, b: string) => gains.filter((g) => dans(g.d, a, b)).reduce((s, g) => s + g.p, 0);
  const actifs = (a: string, b: string) => new Set(gains.filter((g) => dans(g.d, a, b)).map((g) => g.d)).size;
  const depenses = (a: string, b: string) => Math.round(f.depenses.filter((x) => !x.lien && dans(x.date, a, b)).reduce((s, x) => s + x.montant, 0) * 100) / 100;

  // Habitudes : jours où l'habitude était prévue, et parmi eux ceux où sa période a été cochée.
  const tenue = (a: string, b: string, ids?: string) => {
    let prevus = 0;
    let tenus = 0;
    for (const h of e.habitudes) {
      if (ids && h.id !== ids) continue;
      for (let x = a; x <= b; x = addDays(x, 1))
        if (habitDue(h, x)) {
          prevus++;
          if (doneIn(h, x)) tenus++;
        }
    }
    return { prevus, tenus, taux: prevus ? tenus / prevus : null };
  };
  const habitudes = e.habitudes.map((h) => ({ id: h.id, nom: h.nom, ...tenue(debut, d, h.id) }));

  // Semaines du lundi au dimanche, de la plus ancienne à la courante.
  const semaines = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const lundi = addDays(bornes('semaine', d).debut, -7 * (n - 1 - i));
      return { debut: lundi, fin: addDays(lundi, 6) };
    });
  const axeSemaine = (lundi: string) => {
    const x = parse(lundi);
    return `${x.getDate()} ${MOIS_COURTS[x.getMonth()]}`;
  };
  const axeCourt = (lundi: string) => {
    const x = parse(lundi);
    return `${x.getDate()}/${x.getMonth() + 1}`;
  };
  const pointsSemaines: Barre[] = semaines(12).map((s) => {
    const v = points(s.debut, s.fin);
    return { cle: s.debut, axe: axeCourt(s.debut), detail: `Semaine du ${axeSemaine(s.debut)} : ${v} pts`, v };
  });
  const tachesSemaines: Barre[] = semaines(8).map((s) => {
    const v = tachesFaites(s.debut, s.fin);
    return { cle: s.debut, axe: axeCourt(s.debut), detail: `Semaine du ${axeSemaine(s.debut)} : ${v} tâche${v > 1 ? 's' : ''} terminée${v > 1 ? 's' : ''}`, v };
  });
  const depensesMois = Array.from({ length: 6 }, (_, i) => {
    const x = parse(d);
    const m = new Date(x.getFullYear(), x.getMonth() - (5 - i), 1);
    const { debut: a, fin: b } = bornes('mois', `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-01`);
    return { cle: a, axe: MOIS_COURTS[m.getMonth()], v: depenses(a, b), mois: `${MOIS_COURTS[m.getMonth()]} ${m.getFullYear()}` };
  });

  // Répartition du mois en cours par budget.
  const moisEnCours = bilan(f, 'mois', d, d);
  const repartition = [
    ...moisEnCours.lignes.filter((l) => !l.budget.global && l.depense > 0).map((l) => ({ nom: `${l.budget.emoji} ${l.budget.nom}`, v: l.depense })),
    ...(moisEnCours.horsBudget > 0 ? [{ nom: '💸 Hors budget', v: moisEnCours.horsBudget }] : []),
  ].sort((a, b) => b.v - a.v);

  // Relances et tâches des 90 derniers jours.
  const depuis90 = addDays(d, -89);
  const recentes = e.relances.filter((r) => (r.creeLe || '').slice(0, 10) >= depuis90);
  const repondues = recentes.filter((r) => r.statut === 'repondu');
  const delaiReponse = moyenne(repondues.filter((r) => r.reponduLe && r.creeLe).map((r) => Math.max(0, ecartJours(r.creeLe.slice(0, 10), r.reponduLe!))));
  const delaiTache = moyenne(e.taches.filter((t) => t.statut === 'fait' && t.faitLe && t.creeLe && t.faitLe >= depuis90).map((t) => Math.max(0, ecartJours(t.creeLe.slice(0, 10), t.faitLe!))));

  // Quand tu es le plus actif : jour de la semaine et moment de la journée (gains des 120 derniers jours).
  const parJour = Array(7).fill(0) as number[];
  const moments: Record<string, number> = { matin: 0, 'après-midi': 0, soir: 0 };
  for (const g of gains) {
    parJour[parse(g.d).getDay()]++;
    if (g.h) moments[g.h < '12:00' ? 'matin' : g.h < '18:00' ? 'après-midi' : 'soir']++;
  }
  const meilleurJour = gains.length ? JOURS_NOMS[parJour.indexOf(Math.max(...parJour))] : null;
  const totalMoments = moments.matin + moments['après-midi'] + moments.soir;
  const moment = totalMoments ? Object.entries(moments).sort((a, b) => b[1] - a[1])[0] : null;

  return {
    jours,
    tuiles: {
      taches: { v: tachesFaites(debut, d), avant: tachesFaites(avDebut, avFin) },
      relances: { v: relancesAbouties(debut, d), avant: relancesAbouties(avDebut, avFin) },
      habitudes: { v: tenue(debut, d).taux, avant: tenue(avDebut, avFin).taux },
      actifs: { v: actifs(debut, d), avant: actifs(avDebut, avFin) },
      points: { v: points(debut, d), avant: points(avDebut, avFin) },
      depenses: { v: depenses(debut, d), avant: depenses(avDebut, avFin) },
    },
    serie: serie(j, d),
    record: meilleureSerie(j),
    habitudes: habitudes.filter((h) => h.prevus).sort((a, b) => (b.taux ?? 0) - (a.taux ?? 0)),
    pointsSemaines,
    tachesSemaines,
    tachesEnRetard: e.taches.filter((t) => t.statut !== 'fait' && t.echeance && t.echeance < d).length,
    tachesOuvertes: e.taches.filter((t) => t.statut !== 'fait').length,
    delaiTache,
    relances: {
      recentes: recentes.length,
      repondues: repondues.length,
      taux: recentes.length ? repondues.length / recentes.length : null,
      delai: delaiReponse,
      enRetard: e.relances.filter((r) => r.statut !== 'repondu' && r.date < d).length,
      enAttente: e.relances.filter((r) => r.statut !== 'repondu').length,
    },
    depensesMois,
    repartition,
    devise: f.devise,
    meilleurJour,
    moment: moment ? { nom: moment[0], part: moment[1] / totalMoments } : null,
  };
}
