import { Platform } from 'react-native';

// Interface HUD façon « Jarvis » : fond quasi noir, cyan lumineux, thème sombre unique.
export const C = {
  bg: '#04080C',
  surface: '#0A141C',
  sunk: '#071019',
  ink: '#DCF3FF',
  muted: '#86A7B8',
  line: '#17384A',
  accent: '#38D9FF',
  accentInk: '#021219',
  accentSoft: '#0B2C3A',
  glow: 'rgba(56,217,255,0.35)',
  passif: '#7F98A6',
  normal: '#62AEFF',
  agressif: '#FF6474',
  coach: '#3EF0B0',
  hebdo: '#FFCB5C',
} as const;

export const MODE_COLORS = {
  passif: C.passif,
  normal: C.normal,
  agressif: C.agressif,
  coach: C.coach,
  hebdo: C.hebdo,
} as const;

export const COULEURS = { accent: C.accent, normal: C.normal, coach: C.coach, hebdo: C.hebdo, agressif: C.agressif, passif: C.passif } as const;

export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const R = 14;
