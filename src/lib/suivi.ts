import { addDays, doneIn, periodKey } from './dates';
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
 */
export const relanceAttendue = (r: Pick<Relance, 'statut' | 'derniereRelance'>) => r.statut === 'a_faire' || (r.statut === 'relance' && !!r.derniereRelance);

/** « 1re relance », « 2e relance ». */
export const rangRelance = (n: number) => `${n}${n === 1 ? 're' : 'e'} relance`;

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
