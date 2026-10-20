import { Platform } from 'react-native';

/**
 * Thèmes de « me ». Les couleurs vivent dans l'objet C, mis à jour en place par appliquerTheme :
 * Gate (app/_layout.tsx) l'appelle à chaque rendu, avant les écrans. Ces couleurs ne sont pas un état React :
 * la clé du thème passe donc par un contexte, dont Screen et les navigateurs se servent pour se redessiner.
 * (Le React Compiler est désactivé dans app.json : il figerait les styles qui lisent C.)
 */
type Palette = {
  nom: string;
  sombre: boolean;
  bg: string;
  surface: string;
  sunk: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentInk: string;
  passif: string;
  normal: string;
  agressif: string;
  coach: string;
  hebdo: string;
};

export const THEMES = {
  jarvis: { nom: 'Jarvis', sombre: true, bg: '#04080C', surface: '#0A141C', sunk: '#071019', ink: '#DCF3FF', muted: '#86A7B8', line: '#17384A', accent: '#38D9FF', accentInk: '#021219', passif: '#7F98A6', normal: '#62AEFF', agressif: '#FF6474', coach: '#3EF0B0', hebdo: '#FFCB5C' },
  mark: { nom: 'Mark', sombre: true, bg: '#0B0606', surface: '#170D0C', sunk: '#120908', ink: '#FFEDE3', muted: '#B39A90', line: '#3D2420', accent: '#FFB938', accentInk: '#1E1000', passif: '#A6918A', normal: '#FF8A5C', agressif: '#FF4F5E', coach: '#7BE0A0', hebdo: '#FFD86B' },
  matrice: { nom: 'Matrice', sombre: true, bg: '#030805', surface: '#09140D', sunk: '#060F09', ink: '#DDFBE6', muted: '#8AAE95', line: '#173D25', accent: '#3EF08A', accentInk: '#02150A', passif: '#83A08C', normal: '#5CC8FF', agressif: '#FF6474', coach: '#B6F35C', hebdo: '#FFD25C' },
  nebuleuse: { nom: 'Nébuleuse', sombre: true, bg: '#07050D', surface: '#110D1C', sunk: '#0C0915', ink: '#EEE8FF', muted: '#A49BBF', line: '#2D2547', accent: '#B48CFF', accentInk: '#14082B', passif: '#9790AD', normal: '#6FA8FF', agressif: '#FF6487', coach: '#47E6C1', hebdo: '#FFC861' },
  clair: { nom: 'Clair', sombre: false, bg: '#F3F6F9', surface: '#FFFFFF', sunk: '#EAF0F5', ink: '#0B1A24', muted: '#5B6F7C', line: '#D5DFE7', accent: '#0A84D6', accentInk: '#FFFFFF', passif: '#7A8B96', normal: '#2F6FE0', agressif: '#E0364A', coach: '#0E9F6E', hebdo: '#C98A00' },
} satisfies Record<string, Palette>;
export type ThemeNom = keyof typeof THEMES;
export const THEME_NOMS = Object.keys(THEMES) as ThemeNom[];

/** Couleurs d'accent proposées en plus de celle du thème. */
export const ACCENTS = ['#38D9FF', '#3EF08A', '#FFB938', '#FF6487', '#B48CFF', '#FF8A5C', '#0A84D6'] as const;

/** Applique une transparence à une couleur #RRGGBB. */
export function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Texte lisible sur un fond d'accent : sombre sur une couleur claire, blanc sur une couleur foncée. */
function encre(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#04121A' : '#FFFFFF';
}

function couleurs(nom: ThemeNom, accent?: string) {
  const p: Palette = THEMES[nom] ?? THEMES.jarvis;
  const a = accent || p.accent;
  return {
    sombre: p.sombre,
    bg: p.bg,
    surface: p.surface,
    sunk: p.sunk,
    ink: p.ink,
    muted: p.muted,
    line: p.line,
    accent: a,
    accentInk: accent ? encre(a) : p.accentInk,
    accentSoft: alpha(a, p.sombre ? 0.12 : 0.1),
    accentLine: alpha(a, 0.4),
    glow: alpha(a, p.sombre ? 0.35 : 0.2),
    halo: alpha(a, p.sombre ? 0.1 : 0.08),
    grille: alpha(a, p.sombre ? 0.05 : 0.06),
    tabBg: p.sombre ? alpha(p.bg, 0.96) : alpha('#FFFFFF', 0.97),
    passif: p.passif,
    normal: p.normal,
    agressif: p.agressif,
    coach: p.coach,
    hebdo: p.hebdo,
  };
}

export const C = couleurs('jarvis');
export const MODE_COLORS = { passif: C.passif, normal: C.normal, agressif: C.agressif, coach: C.coach, hebdo: C.hebdo };
export const COULEURS = { accent: C.accent, normal: C.normal, coach: C.coach, hebdo: C.hebdo, agressif: C.agressif, passif: C.passif };

const abonnes = new Set<() => void>();
/** Pour les feuilles de style calculées une fois (ui.tsx) : recalculées à chaque changement de thème. */
export const surTheme = (fn: () => void) => abonnes.add(fn);

let actuel = '';
/** Change les couleurs de l'app, avant le rendu des écrans. Renvoie une clé propre au thème. */
export function appliquerTheme(nom: ThemeNom, accent?: string) {
  const cle = `${nom}:${accent || ''}`;
  if (cle === actuel) return cle;
  actuel = cle;
  Object.assign(C, couleurs(nom, accent));
  Object.assign(MODE_COLORS, { passif: C.passif, normal: C.normal, agressif: C.agressif, coach: C.coach, hebdo: C.hebdo });
  Object.assign(COULEURS, { accent: C.accent, normal: C.normal, coach: C.coach, hebdo: C.hebdo, agressif: C.agressif, passif: C.passif });
  abonnes.forEach((fn) => fn());
  return cle;
}

export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const R = 16;
