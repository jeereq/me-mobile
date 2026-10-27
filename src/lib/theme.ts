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

// Palettes : fonds neutres et reposants, couleurs vives et joyeuses par-dessus (accent, modes, rubriques dans teinte.ts).
// Les clés restent celles d'origine (les comptes gardent leur choix), seuls les noms et teintes changent.
export const THEMES = {
  // Nuit : fond presque noir légèrement violacé, une couleur franche par rubrique (indigo, corail, ambre, menthe).
  jarvis: { nom: 'Nuit', sombre: true, bg: '#111014', surface: '#1B1A21', sunk: '#16151B', ink: '#F2F1F5', muted: '#A3A1AD', line: '#2A2932', accent: '#8B9BFF', accentInk: '#111014', passif: '#A3A1AD', normal: '#8B9BFF', agressif: '#FF7A6B', coach: '#4FD1A5', hebdo: '#F5B544' },
  mark: { nom: 'Ambre', sombre: true, bg: '#14100C', surface: '#1D1813', sunk: '#17130F', ink: '#F4ECE3', muted: '#A99A8B', line: '#2E261E', accent: '#FFB547', accentInk: '#1E1203', passif: '#A99A8B', normal: '#7FB2FF', agressif: '#FF7A85', coach: '#5FD39C', hebdo: '#FFD25E' },
  matrice: { nom: 'Forêt', sombre: true, bg: '#0D1310', surface: '#151D19', sunk: '#101713', line: '#222E28', ink: '#E6F0EA', muted: '#8C9E95', accent: '#4FD8A0', accentInk: '#04170F', passif: '#8C9E95', normal: '#6EB6FF', agressif: '#FF7F7F', coach: '#B5DE5A', hebdo: '#FFC75A' },
  nebuleuse: { nom: 'Lavande', sombre: true, bg: '#120F1A', surface: '#1B1825', sunk: '#15121E', ink: '#EEEAF6', muted: '#9E98B0', line: '#2C2838', accent: '#B39BFF', accentInk: '#140C2E', passif: '#9E98B0', normal: '#7FAAFF', agressif: '#FF7EA0', coach: '#45D3C0', hebdo: '#FFC76A' },
  clair: { nom: 'Clair', sombre: false, bg: '#F7F7FB', surface: '#FFFFFF', sunk: '#F0F1F6', ink: '#171C24', muted: '#626B77', line: '#E4E6EE', accent: '#1F6FE0', accentInk: '#FFFFFF', passif: '#7E8792', normal: '#1F6FE0', agressif: '#D63D4A', coach: '#0E9466', hebdo: '#B86E00' },
} satisfies Record<string, Palette>;
export type ThemeNom = keyof typeof THEMES;
export const THEME_NOMS = Object.keys(THEMES) as ThemeNom[];

/** Couleurs d'accent proposées en plus de celle du thème. */
export const ACCENTS = ['#8B9BFF', '#6EB6FF', '#4FD8A0', '#FFB547', '#FF7EB6', '#B39BFF', '#FF8A7A', '#45D3E6', '#1F6FE0'] as const;

/** Applique une transparence à une couleur #RRGGBB. */
export function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Texte lisible sur un fond d'accent : sombre sur une couleur claire, blanc sur une couleur foncée. */
export function encre(hex: string) {
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
    accentSoft: alpha(a, p.sombre ? 0.12 : 0.08),
    accentLine: alpha(a, p.sombre ? 0.32 : 0.28),
    glow: alpha(a, p.sombre ? 0.18 : 0.12),
    halo: alpha(a, p.sombre ? 0.05 : 0.04),
    grille: alpha(a, 0),
    tabBg: p.sombre ? alpha(p.surface, 0.97) : alpha('#FFFFFF', 0.97),
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

/** Polices chargées au démarrage (app/_layout.tsx) : Space Grotesk pour les titres et les chiffres, Inter pour le texte. */
export const F = {
  titre: 'SpaceGrotesk_700Bold',
  titreM: 'SpaceGrotesk_600SemiBold',
  chiffre: 'SpaceGrotesk_500Medium',
  texte: 'Inter_400Regular',
  texteM: 'Inter_500Medium',
  texteF: 'Inter_600SemiBold',
} as const;

export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const R = 18;
