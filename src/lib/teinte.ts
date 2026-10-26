import { usePathname } from 'expo-router';

import { alpha, C, encre } from '@/lib/theme';

/**
 * Chaque rubrique a sa couleur, pour qu'on sache d'un coup d'œil où l'on est : le halo en haut de l'écran, le titre,
 * les boutons, l'onglet actif et la barre latérale la reprennent. Teintes vives sur les thèmes sombres, plus
 * soutenues sur le thème clair pour rester lisibles sur fond blanc.
 */
const VIVES = {
  soleil: ['#FFB547', '#C77700'],
  ciel: ['#6EB6FF', '#1F6FE0'],
  raisin: ['#B39BFF', '#6D4AE0'],
  menthe: ['#4FD8A0', '#0E9466'],
  bonbon: ['#FF7EB6', '#D0337A'],
  corail: ['#FF8A7A', '#D9483A'],
  lagon: ['#45D3E6', '#0D8FA3'],
  citron: ['#E8D85A', '#9A8A00'],
} as const;
export type Vive = keyof typeof VIVES;

/** Rubrique → couleur. Les écrans sans rubrique gardent l'accent du thème. */
const RUBRIQUES: [string, Vive][] = [
  ['/relances', 'ciel'],
  ['/taches', 'raisin'],
  ['/habitudes', 'menthe'],
  ['/plus', 'lagon'],
  ['/projets', 'bonbon'],
  ['/finances', 'soleil'],
  ['/categories', 'lagon'],
  ['/statistiques', 'ciel'],
  ['/rapport', 'corail'],
  ['/recompenses', 'citron'],
  ['/journal', 'bonbon'],
  ['/sources', 'lagon'],
  ['/equipe', 'raisin'],
  ['/assistant', 'bonbon'],
  ['/notifications', 'corail'],
  ['/config', 'lagon'],
  ['/compte', 'lagon'],
  ['/brouillon', 'raisin'],
];

export const vive = (v: Vive) => VIVES[v][C.sombre ? 0 : 1];

/** Couleur de la rubrique d'un chemin (« / » : l'accueil, couleur soleil). */
export function teinteDe(chemin: string) {
  if (chemin === '/' || chemin === '') return vive('soleil');
  const r = RUBRIQUES.find(([p]) => chemin.startsWith(p));
  return r ? vive(r[1]) : C.accent;
}

export type Teinte = { c: string; encre: string; douce: string; ligne: string; halo: string };

export function teinte(c: string): Teinte {
  return { c, encre: encre(c), douce: alpha(c, C.sombre ? 0.16 : 0.1), ligne: alpha(c, C.sombre ? 0.4 : 0.32), halo: alpha(c, C.sombre ? 0.2 : 0.14) };
}

/** Teinte de l'écran affiché. */
export function useTeinte(): Teinte {
  return teinte(teinteDe(usePathname()));
}
