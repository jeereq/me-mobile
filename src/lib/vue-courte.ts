import { addDays, doneIn, habitToday, streak } from './dates';
import type { Habitude, Priorite, Tache } from './types';

/**
 * Ce qui garde les écrans Tâches, Habitudes et Calendrier courts : des groupes dans l'ordre où on s'en occupe,
 * un résumé de quelques chiffres, et des listes qu'on coupe après quelques lignes. Rien n'est stocké.
 * Dates en texte « AAAA-MM-JJ ».
 */

/* ---------- Listes coupées ---------- */

/** Les `n` premiers éléments, et combien il en reste ; `tout` montre toute la liste. */
export function limiter<T>(liste: T[], n: number, tout: boolean): { vues: T[]; reste: number } {
  if (tout || liste.length <= n) return { vues: liste, reste: 0 };
  // Un seul élément de plus ne vaut pas un bouton « Voir plus » : on le montre.
  if (liste.length === n + 1) return { vues: liste, reste: 0 };
  return { vues: liste.slice(0, n), reste: liste.length - n };
}

/* ---------- Tâches ---------- */

export type Echeance = 'retard' | 'aujourdhui' | 'semaine' | 'plus_tard' | 'sans_date';
export type CleGroupe = Echeance | 'terminees';

/** Les groupes dans l'ordre d'urgence, avec leur titre, et si on les montre ouverts d'emblée. */
export const GROUPES_TACHES: { cle: CleGroupe; label: string; ouvert: boolean }[] = [
  { cle: 'retard', label: 'En retard', ouvert: true },
  { cle: 'aujourdhui', label: "Aujourd'hui", ouvert: true },
  { cle: 'semaine', label: 'Cette semaine', ouvert: true },
  { cle: 'plus_tard', label: 'Plus tard', ouvert: false },
  { cle: 'sans_date', label: 'Sans date', ouvert: false },
  { cle: 'terminees', label: 'Terminées', ouvert: false },
];

const PRIO: Record<Priorite, number> = { haute: 0, moyenne: 1, basse: 2 };

export function echeanceDe(t: Pick<Tache, 'echeance'>, jour: string): Echeance {
  if (!t.echeance) return 'sans_date';
  if (t.echeance < jour) return 'retard';
  if (t.echeance === jour) return 'aujourdhui';
  return t.echeance <= addDays(jour, 7) ? 'semaine' : 'plus_tard';
}

const parUrgence = (a: Tache, b: Tache) => PRIO[a.priorite] - PRIO[b.priorite] || (a.echeance || '9999').localeCompare(b.echeance || '9999') || a.titre.localeCompare(b.titre, 'fr');

/** Les tâches rangées par échéance ; les groupes vides n'y sont pas. Les terminées, les plus récentes d'abord, en dernier. */
export function grouperTaches(taches: Tache[], jour: string): { cle: CleGroupe; label: string; ouvert: boolean; taches: Tache[] }[] {
  const ouvertes = taches.filter((t) => t.statut !== 'fait');
  const faites = taches.filter((t) => t.statut === 'fait').sort((a, b) => (b.faitLe || '').localeCompare(a.faitLe || '') || a.titre.localeCompare(b.titre, 'fr'));
  return GROUPES_TACHES.map((g) => ({ ...g, taches: g.cle === 'terminees' ? faites : ouvertes.filter((t) => echeanceDe(t, jour) === g.cle).sort(parUrgence) })).filter((g) => g.taches.length);
}

export type ResumeTaches = { ouvertes: number; retard: number; aujourdhui: number; semaine: number; faitesAujourdhui: number; total: number; pct: number };

/** Les chiffres du haut de page : ce qui presse, et où en est la journée. */
export function resumeTaches(taches: Tache[], jour: string): ResumeTaches {
  const ouvertes = taches.filter((t) => t.statut !== 'fait');
  const compte = (e: Echeance) => ouvertes.filter((t) => echeanceDe(t, jour) === e).length;
  const faitesAujourdhui = taches.filter((t) => t.statut === 'fait' && t.faitLe === jour).length;
  const total = faitesAujourdhui + ouvertes.length;
  return { ouvertes: ouvertes.length, retard: compte('retard'), aujourdhui: compte('aujourdhui'), semaine: compte('semaine'), faitesAujourdhui, total, pct: total ? Math.round((faitesAujourdhui / total) * 100) : 0 };
}

/* ---------- Habitudes ---------- */

/** Ce qui est à faire aujourd'hui, et le reste (prévu un autre jour), chacun dans l'ordre choisi. */
export function habitudesDuJour(habitudes: Habitude[], jour: string): { aujourdhui: Habitude[]; autres: Habitude[] } {
  const tri = [...habitudes].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr'));
  return { aujourdhui: tri.filter((h) => habitToday(h, jour)), autres: tri.filter((h) => !habitToday(h, jour)) };
}

export type ResumeHabitudes = { dues: number; faites: number; pct: number; meilleureSerie: number; enSerie: number };

export function resumeHabitudes(habitudes: Habitude[], jour: string): ResumeHabitudes {
  const dues = habitudes.filter((h) => habitToday(h, jour));
  const faites = dues.filter((h) => doneIn(h, jour)).length;
  const series = habitudes.map((h) => streak(h, jour));
  return { dues: dues.length, faites, pct: dues.length ? Math.round((faites / dues.length) * 100) : 0, meilleureSerie: Math.max(0, ...series), enSerie: series.filter((s) => s >= 2).length };
}
