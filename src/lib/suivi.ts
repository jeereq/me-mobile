import { addDays, doneIn, fmtCourt, JOURS, parse, periodKey } from './dates';
import { relanceAttendue } from './commun/calcul';
import type { Habitude, Relance, Tache } from './types';

/**
 * Le suivi au quotidien des relances, des tâches et des habitudes : relancer et reprogrammer, ranger une tâche
 * dans un projet, faire le bilan d'une habitude. Dates en texte « AAAA-MM-JJ ». Rien n'est stocké ici.
 */

/* ---------- Relances ---------- */

/**
 * « Relancé » : la relance est comptée et la suivante est reprogrammée `delai` jours plus tard.
 * Elle reste suivie (mission du jour, rappels) jusqu'à la réponse.
 */
export function relancer(r: Relance, jour: string, delai: number): Relance {
  return { ...r, statut: 'relance', reponduLe: null, nbRelances: (r.nbRelances ?? 0) + 1, derniereRelance: jour, date: addDays(jour, Math.max(1, Math.round(delai) || 1)) };
}

/**
 * Une relance qui attend une action à sa date : à faire, ou déjà relancée avec la nouvelle version
 * (les anciennes relances « Relancé » n'ont pas de date de relance, elles ne reviennent pas d'un coup en retard).
 * Règle commune avec le serveur (`commun/calcul.ts`).
 */
export { relanceAttendue } from './commun/calcul';

/** « 1re relance », « 2e relance ». */
export const rangRelance = (n: number) => `${n}${n === 1 ? 're' : 'e'} relance`;

/** Nombre de jours de `a` à `b` (positif si `b` est après `a`). */
const ecartJours = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

/** Un jour dit simplement : « aujourd'hui », « demain », « jeudi » dans la semaine, sinon « 12 nov. ». */
export function quandCourt(date: string, jour: string): string {
  const n = ecartJours(jour, date);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  if (n > 1 && n < 7) return JOURS[parse(date).getDay()];
  return `le ${fmtCourt(date)}`;
}

export type EtatRelance = { texte: string; niveau: 'retard' | 'jour' | 'attente' | 'fait' };

/**
 * Où en est une relance, en une phrase : « En retard de 2 jours », « 3e relance prévue aujourd'hui »,
 * « Relancé mardi · prochaine fois jeudi », « A répondu le 28 oct. ».
 */
export function etatRelance(r: Relance, jour: string): EtatRelance {
  if (r.statut === 'repondu') return { texte: r.reponduLe ? `A répondu le ${fmtCourt(r.reponduLe)}` : 'A répondu', niveau: 'fait' };
  const rang = r.nbRelances ? `${rangRelance(r.nbRelances + 1)} prévue` : 'Prévue';
  if (relanceAttendue(r) && r.date <= jour) {
    const retard = ecartJours(r.date, jour);
    return retard > 0 ? { texte: `${rang} ${quandCourt(r.date, jour)}, en retard de ${retard} jour${retard > 1 ? 's' : ''}`, niveau: 'retard' } : { texte: `${rang} aujourd'hui`, niveau: 'jour' };
  }
  const prochaine = r.date && r.date > jour ? `prochaine fois ${quandCourt(r.date, jour)}` : '';
  if (r.derniereRelance) return { texte: [`Relancé ${quandCourt(r.derniereRelance, jour)}`, prochaine].filter(Boolean).join(' · '), niveau: 'attente' };
  if (r.statut === 'relance') return { texte: ['Relancé', prochaine].filter(Boolean).join(' · '), niveau: 'attente' };
  return { texte: `À relancer ${r.date ? quandCourt(r.date, jour) : ''}`.trim(), niveau: 'attente' };
}

/**
 * Les relances en trois groupes : à relancer maintenant (le jour est venu), en attente de réponse,
 * et celles qui ont eu leur réponse (les plus récentes d'abord).
 */
export function grouperRelances(relances: Relance[], jour: string): { maintenant: Relance[]; attente: Relance[]; repondues: Relance[] } {
  const parDate = (a: Relance, b: Relance) => (a.date || '').localeCompare(b.date || '');
  const maintenant = relances.filter((r) => relanceAttendue(r) && r.date <= jour).sort(parDate);
  const attente = relances.filter((r) => r.statut !== 'repondu' && !maintenant.includes(r)).sort(parDate);
  const repondues = relances.filter((r) => r.statut === 'repondu').sort((a, b) => (b.reponduLe || '').localeCompare(a.reponduLe || ''));
  return { maintenant, attente, repondues };
}

/* ---------- Tâches ---------- */

/**
 * Range une tâche dans un projet (ou l'en sort avec `null`). Une échéance devient la date imposée de la tâche
 * dans le planning ; sortie du projet, la tâche garde sa date de fin comme échéance et perd les champs du planning.
 */
export function rangerDansProjet(taches: Tache[], id: string, projet: string | null): Tache[] {
  const t = taches.find((x) => x.id === id);
  if (!t || (t.projet ?? null) === projet) return taches;
  // Une tâche qui a des sous-tâches ou qui en est une ne change pas de projet seule.
  if (t.parent || taches.some((x) => x.parent === id)) return taches;
  let n: Tache;
  if (projet) {
    const ordre = Math.max(0, ...taches.filter((x) => x.projet === projet).map((x) => x.ordre ?? 0)) + 1;
    n = { ...t, projet, duree: 1, ordre, ...(t.echeance ? { debut: t.echeance, fixe: true } : {}) };
  } else {
    const { projet: _p, apres: _a, delai: _d, debut: _db, duree: _du, fixe: _f, avancement: _av, jalon: _j, ordre: _o, ref: _r, ...reste } = t;
    n = reste;
  }
  // Les liens « après » vers une tâche qui change de projet n'ont plus de sens.
  return taches.map((x) => (x.id === id ? n : x.apres?.includes(id) ? { ...x, apres: x.apres.filter((a) => a !== id) } : x));
}

/* ---------- Habitudes ---------- */

/** Combien de périodes regarder pour le bilan : 30 jours, 12 semaines, 6 mois. */
const NB_PERIODES = { quotidien: 30, hebdo: 12, mensuel: 6 } as const;

/** Le premier jour de la période d'avant (jour, semaine ou mois). */
function periodePrecedente(h: Habitude, s: string): string {
  if (h.frequence === 'mensuel') {
    const [a, m] = s.split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
  }
  return addDays(s, h.frequence === 'hebdo' ? -7 : -1);
}

export type BilanHabitude = { faites: number; periodes: number; pct: number; unite: string };

/**
 * Le taux de réussite d'une habitude sur ses dernières périodes, sans compter celles d'avant le premier jour coché
 * (une habitude créée la semaine dernière n'est pas à 20 % sur un mois). La période en cours compte seulement si elle est faite.
 */
export function bilanHabitude(h: Habitude, jour: string): BilanHabitude {
  const unite = h.frequence === 'mensuel' ? 'mois' : h.frequence === 'hebdo' ? 'semaines' : 'jours';
  const premiere = [...h.coches].sort()[0];
  if (!premiere) return { faites: 0, periodes: 0, pct: 0, unite };
  const debut = periodKey(h.frequence, premiere);
  let faites = 0;
  let periodes = 0;
  let cur = jour;
  for (let i = 0; i < NB_PERIODES[h.frequence]; i++, cur = periodePrecedente(h, cur)) {
    // Avant la période du premier jour coché : on s'arrête (les clés de semaine ne se comparent pas comme du texte).
    if (cur < premiere && periodKey(h.frequence, cur) !== debut) break;
    const fait = doneIn(h, cur);
    if (i === 0 && !fait) continue;
    periodes++;
    if (fait) faites++;
  }
  return { faites, periodes, pct: periodes ? Math.round((faites / periodes) * 100) : 0, unite };
}

/** Les 35 derniers jours (cinq semaines, du lundi au dimanche), pour la grille d'historique : null après aujourd'hui. */
export function joursHistorique(jour: string): (string | null)[] {
  const [a, m, j] = jour.split('-').map(Number);
  const lundi = (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7;
  const premier = addDays(jour, -lundi - 28);
  return Array.from({ length: 35 }, (_, i) => {
    const d = addDays(premier, i);
    return d > jour ? null : d;
  });
}
