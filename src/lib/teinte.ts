import { usePathname } from 'expo-router';

import { alpha, C, encre } from '@/lib/theme';

/**
 * Chaque rubrique a sa couleur, pour qu'on sache d'un coup d'œil où l'on est : les boutons, les puces des panneaux,
 * l'onglet actif et la barre latérale la reprennent. Teintes vives sur les thèmes sombres, plus soutenues sur le thème
 * clair pour rester lisibles sur fond blanc.
 */
const VIVES = {
  ambre: ['#F5B544', '#B26B00'],
  indigo: ['#8B9BFF', '#3F51D9'],
  lilas: ['#B9A6FF', '#6D4AE0'],
  menthe: ['#4FD1A5', '#0E8C63'],
  rose: ['#F49AC1', '#C2326F'],
  corail: ['#FF7A6B', '#C9412F'],
  lagon: ['#5CC8DB', '#0B7F92'],
  citron: ['#DCD06A', '#857700'],
} as const;
export type Vive = keyof typeof VIVES;

/** Rubrique → couleur. Les écrans sans rubrique gardent l'accent du thème. */
const RUBRIQUES: [string, Vive][] = [
  ['/relances', 'corail'],
  ['/taches', 'ambre'],
  ['/habitudes', 'menthe'],
  ['/plus', 'lilas'],
  ['/projets', 'rose'],
  ['/calendrier', 'lagon'],
  ['/finances', 'indigo'],
  ['/categories', 'lagon'],
  ['/statistiques', 'indigo'],
  ['/rapport', 'corail'],
  ['/recompenses', 'citron'],
  ['/journal', 'rose'],
  ['/sources', 'lagon'],
  ['/equipe', 'lilas'],
  ['/assistant', 'lilas'],
  ['/notifications', 'corail'],
  ['/config', 'lagon'],
  ['/compte', 'lagon'],
  ['/brouillon', 'lilas'],
];

export const vive = (v: Vive) => VIVES[v][C.sombre ? 0 : 1];

/** Couleur de la rubrique d'un chemin (« / » : l'accueil, en indigo). */
export function teinteDe(chemin: string) {
  if (chemin === '/' || chemin === '') return vive('indigo');
  const r = RUBRIQUES.find(([p]) => chemin.startsWith(p));
  return r ? vive(r[1]) : C.accent;
}

export type Teinte = { c: string; encre: string; douce: string; ligne: string };

export function teinte(c: string): Teinte {
  return { c, encre: encre(c), douce: alpha(c, C.sombre ? 0.16 : 0.1), ligne: alpha(c, C.sombre ? 0.4 : 0.32) };
}

/** Teinte de l'écran affiché. */
export function useTeinte(): Teinte {
  return teinte(teinteDe(usePathname()));
}
