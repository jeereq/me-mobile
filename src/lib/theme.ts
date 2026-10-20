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

// Palettes sobres : fonds neutres, une seule couleur d'accent douce, des couleurs de mode désaturées.
// Les clés restent celles d'origine (les comptes gardent leur choix), seuls les noms et teintes changent.
export const THEMES = {
  jarvis: { nom: 'Nuit', sombre: true, bg: '#0F1215', surface: '#161B20', sunk: '#12161A', ink: '#E6EAEE', muted: '#8C96A0', line: '#232A31', accent: '#7AB8F5', accentInk: '#0B1520', passif: '#8C96A0', normal: '#7AB8F5', agressif: '#E5737A', coach: '#6CC7A0', hebdo: '#D9B26A' },
  mark: { nom: 'Ambre', sombre: true, bg: '#14110E', surface: '#1C1814', sunk: '#171310', ink: '#EFE8E1', muted: '#A2968A', line: '#2C251F', accent: '#E0A960', accentInk: '#1A1208', passif: '#A2968A', normal: '#8FB3E0', agressif: '#E5737A', coach: '#7CC59E', hebdo: '#E0C070' },
  matrice: { nom: 'Forêt', sombre: true, bg: '#0E1311', surface: '#151C19', sunk: '#111714', ink: '#E3ECE7', muted: '#8A9A92', line: '#212C27', accent: '#72C29A', accentInk: '#0A1711', passif: '#8A9A92', normal: '#7AB0E0', agressif: '#E07A7A', coach: '#A8C870', hebdo: '#D8B86A' },
  nebuleuse: { nom: 'Lavande', sombre: true, bg: '#121119', surface: '#1A1823', sunk: '#15141D', ink: '#EAE7F2', muted: '#9A95AB', line: '#2A2735', accent: '#A99BEA', accentInk: '#15112A', passif: '#9A95AB', normal: '#8AA8EA', agressif: '#E57A8E', coach: '#6CC7B0', hebdo: '#DDB870' },
  clair: { nom: 'Clair', sombre: false, bg: '#F6F7F9', surface: '#FFFFFF', sunk: '#F0F2F5', ink: '#1A2026', muted: '#66707A', line: '#E3E7EC', accent: '#2F6FEB', accentInk: '#FFFFFF', passif: '#8A939C', normal: '#2F6FEB', agressif: '#D9534F', coach: '#1E9E6A', hebdo: '#B7862A' },
} satisfies Record<string, Palette>;
export type ThemeNom = keyof typeof THEMES;
export const THEME_NOMS = Object.keys(THEMES) as ThemeNom[];

/** Couleurs d'accent proposées en plus de celle du thème. */
export const ACCENTS = ['#7AB8F5', '#72C29A', '#E0A960', '#E58A9A', '#A99BEA', '#E5937A', '#2F6FEB'] as const;

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
