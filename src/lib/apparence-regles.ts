import type { ThemeNom } from './theme';

/** Le thème choisi dans Mon compte pour cet appareil (voir apparence-locale.ts). */
export type ApparenceLocale = { theme?: ThemeNom; accent?: string };

/** Une valeur lue sur l'appareil, gardée seulement si le thème existe. */
export function lireApparence(brut: string | null, themes: Record<string, unknown>): ApparenceLocale | null {
  try {
    const v = brut ? (JSON.parse(brut) as ApparenceLocale) : null;
    return v?.theme && v.theme in themes ? { theme: v.theme, accent: typeof v.accent === 'string' ? v.accent : '' } : null;
  } catch {
    return null;
  }
}

/** Le thème à montrer : celui de l'appareil, sinon l'ancien choix rangé dans l'espace personnel, sinon celui de l'admin. */
export function themeAffiche(locale: ApparenceLocale | null, ancien: ApparenceLocale | undefined, config: { nom: string; accent?: string }, themes: Record<string, unknown>): { nom: ThemeNom; accent: string; propre: boolean } {
  if (locale?.theme && locale.theme in themes) return { nom: locale.theme, accent: locale.accent ?? '', propre: true };
  if (ancien?.theme && ancien.theme in themes) return { nom: ancien.theme, accent: ancien.accent ?? '', propre: true };
  return { nom: config.nom in themes ? (config.nom as ThemeNom) : 'jarvis', accent: config.accent ?? '', propre: false };
}
