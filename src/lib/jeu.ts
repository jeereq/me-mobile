import { addDays } from './dates';
import type { Espace, Gain, Jeu, TypeGain } from './types';

/**
 * Récompenses de me : chaque action rapporte des points (XP), les points font monter de niveau,
 * les jours actifs d'affilée forment une série que des jokers protègent, et des badges marquent les étapes.
 * Tout est rangé dans espace.jeu, synchronisé comme le reste.
 */

export const POINTS = { habitude: 10, relance: 15, tache: 15, tacheHaute: 20, ponctuel: 5, journal: 5, journalMaxParJour: 3, parfait: 50 } as const;
export const JOKERS_MAX = 2;
const GARDE_JOURS = 120;

export const jeuDe = (e: Espace): Jeu => ({ gains: {}, badges: {}, jokers: 0, joursSauves: [], jokersGagnes: [], ...e.jeu });

// Niveau n atteint à 50·n·(n−1) points : 100, 300, 600, 1000, 1500…
export const seuil = (n: number) => 50 * n * (n - 1);
const TITRES = ['Débutant', 'Lancé', 'Régulier', 'Organisé', 'Discipliné', 'Inarrêtable', 'Expert', 'Maître', 'Légende'];
export const titreNiveau = (n: number) => TITRES[Math.min(n, TITRES.length) - 1] + (n > TITRES.length ? ` ${n - TITRES.length + 1}` : '');

export function niveauDe(xp: number) {
  let n = 1;
  while (xp >= seuil(n + 1)) n++;
  const bas = seuil(n);
  const haut = seuil(n + 1);
  return { niveau: n, titre: titreNiveau(n), dansNiveau: xp - bas, pourNiveau: haut - bas, restant: haut - xp, progression: (xp - bas) / (haut - bas) };
}

const gains = (j: Jeu) => Object.entries(j.gains);
export const xpTotal = (j: Jeu) => (j.archive?.xp ?? 0) + gains(j).reduce((s, [, g]) => s + g.p, 0);
export const xpDuJour = (j: Jeu, d: string) => gains(j).reduce((s, [, g]) => s + (g.d === d ? g.p : 0), 0);

export function comptes(j: Jeu) {
  const c: Record<TypeGain, number> = { habitude: 0, relance: 0, tache: 0, journal: 0, bonus: 0, ...j.archive?.comptes };
  for (const [, g] of gains(j)) c[g.t]++;
  return c;
}

const joursActifs = (j: Jeu) => new Set([...gains(j).map(([, g]) => g.d), ...j.joursSauves]);

/** Série en cours : jours actifs d'affilée jusqu'à aujourd'hui ; un jour pas encore commencé ne la casse pas. */
export function serie(j: Jeu, d: string) {
  const actifs = joursActifs(j);
  let cur = actifs.has(d) ? d : addDays(d, -1);
  let n = 0;
  while (actifs.has(cur)) {
    n++;
    cur = addDays(cur, -1);
  }
  return n;
}

export function meilleureSerie(j: Jeu) {
  const jours = [...joursActifs(j)].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < jours.length; i++) {
    run = i && addDays(jours[i - 1], 1) === jours[i] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Points des 7 derniers jours, du plus ancien à aujourd'hui. */
export const semaine = (j: Jeu, d: string) => Array.from({ length: 7 }, (_, i) => addDays(d, i - 6)).map((jour) => ({ jour, xp: xpDuJour(j, jour), sauve: j.joursSauves.includes(jour) }));

export type Stats = { xp: number; niveau: number; serie: number; record: number; comptes: Record<TypeGain, number>; parfaits: number; matinal: boolean; nocturne: boolean };
export function stats(j: Jeu, d: string): Stats {
  const xp = xpTotal(j);
  return {
    xp,
    niveau: niveauDe(xp).niveau,
    serie: serie(j, d),
    record: meilleureSerie(j),
    comptes: comptes(j),
    parfaits: gains(j).filter(([k]) => k.startsWith('p:')).length,
    matinal: gains(j).some(([, g]) => g.h && g.h < '08:00'),
    nocturne: gains(j).some(([, g]) => g.h && g.h >= '22:00'),
  };
}

export type Badge = { id: string; nom: string; desc: string; emoji: string; test: (s: Stats) => boolean };
export const BADGES: Badge[] = [
  { id: 'premier_pas', nom: 'Premier pas', desc: 'Gagner tes premiers points', emoji: '👣', test: (s) => s.xp > 0 },
  { id: 'parfait', nom: 'Journée parfaite', desc: 'Terminer toute ta mission du jour', emoji: '⭐', test: (s) => s.parfaits >= 1 },
  { id: 'serie_3', nom: 'Sur la lancée', desc: '3 jours actifs d’affilée', emoji: '🔥', test: (s) => s.record >= 3 },
  { id: 'serie_7', nom: 'Semaine complète', desc: '7 jours actifs d’affilée', emoji: '📅', test: (s) => s.record >= 7 },
  { id: 'serie_30', nom: 'Mois de fer', desc: '30 jours actifs d’affilée', emoji: '🏆', test: (s) => s.record >= 30 },
  { id: 'relanceur', nom: 'Relanceur', desc: '10 relances abouties', emoji: '📨', test: (s) => s.comptes.relance >= 10 },
  { id: 'finisseur', nom: 'Finisseur', desc: '25 tâches terminées', emoji: '✅', test: (s) => s.comptes.tache >= 25 },
  { id: 'regulier', nom: 'Habitué', desc: '50 habitudes cochées', emoji: '🌱', test: (s) => s.comptes.habitude >= 50 },
  { id: 'plume', nom: 'Plume', desc: '10 notes dans ton journal', emoji: '✍️', test: (s) => s.comptes.journal >= 10 },
  { id: 'matinal', nom: 'Lève-tôt', desc: 'Une action avant 8 h', emoji: '🌅', test: (s) => s.matinal },
  { id: 'nocturne', nom: 'Oiseau de nuit', desc: 'Une action après 22 h', emoji: '🌙', test: (s) => s.nocturne },
  { id: 'parfait_7', nom: 'Perfectionniste', desc: '7 journées parfaites', emoji: '💎', test: (s) => s.parfaits >= 7 },
  { id: 'niveau_5', nom: 'Discipliné', desc: 'Atteindre le niveau 5', emoji: '🎖️', test: (s) => s.niveau >= 5 },
  { id: 'niveau_10', nom: 'Légendaire', desc: 'Atteindre le niveau 10', emoji: '👑', test: (s) => s.niveau >= 10 },
];

const avecJeu = (e: Espace, j: Jeu): Espace => ({ ...e, jeu: j });

export function gagner(e: Espace, cle: string, g: Gain): Espace {
  const j = jeuDe(e);
  if (j.gains[cle]) return e;
  return avecJeu(e, { ...j, gains: { ...j.gains, [cle]: g } });
}

export function retirer(e: Espace, cle: string): Espace {
  const j = jeuDe(e);
  if (!j.gains[cle]) return e;
  const { [cle]: _, ...reste } = j.gains;
  return avecJeu(e, { ...j, gains: reste });
}

/**
 * Entretien après chaque action et à l'ouverture : un joker sauve hier s'il a été manqué,
 * chaque palier de 7 jours de série rapporte un joker, les nouveaux badges sont datés,
 * les vieux gains sont résumés.
 */
export function entretenir(e: Espace, d: string): Espace {
  const initial = jeuDe(e);
  let j = initial;
  if (!Object.keys(j.gains).length && !j.archive) return e;

  // Joker : hier manqué alors qu'avant-hier comptait dans la série.
  const hier = addDays(d, -1);
  const actifs = joursActifs(j);
  if (j.jokers > 0 && !actifs.has(hier) && actifs.has(addDays(d, -2))) j = { ...j, jokers: j.jokers - 1, joursSauves: [...j.joursSauves, hier] };

  // Palier de série : un joker tous les 7 jours, une seule fois par palier.
  const s = serie(j, d);
  const palier = joursActifs(j).has(d) ? d : hier;
  if (s >= 7 && s % 7 === 0 && !j.jokersGagnes.includes(palier)) j = { ...j, jokers: Math.min(JOKERS_MAX, j.jokers + 1), jokersGagnes: [...j.jokersGagnes, palier].slice(-20) };

  // Badges
  const st = stats(j, d);
  const nouveaux = BADGES.filter((b) => !j.badges[b.id] && b.test(st));
  if (nouveaux.length) j = { ...j, badges: { ...j.badges, ...Object.fromEntries(nouveaux.map((b) => [b.id, d])) } };

  // Archive des gains anciens
  const limite = addDays(d, -GARDE_JOURS);
  const vieux = Object.entries(j.gains).filter(([, g]) => g.d < limite);
  if (vieux.length) {
    const archive = { xp: j.archive?.xp ?? 0, comptes: { ...j.archive?.comptes } };
    for (const [, g] of vieux) {
      archive.xp += g.p;
      archive.comptes[g.t] = (archive.comptes[g.t] ?? 0) + 1;
    }
    j = { ...j, archive, gains: Object.fromEntries(Object.entries(j.gains).filter(([, g]) => g.d >= limite)), joursSauves: j.joursSauves.filter((x) => x >= limite) };
  }
  return j === initial ? e : avecJeu(e, j);
}
