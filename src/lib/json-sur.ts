/** Lit un JSON gardé sur l'appareil : une valeur abîmée compte comme absente, elle ne bloque pas le démarrage. */
export function lireJson<T>(brut: string | null | undefined): T | null {
  if (!brut) return null;
  try {
    return JSON.parse(brut) as T;
  } catch {
    return null;
  }
}
