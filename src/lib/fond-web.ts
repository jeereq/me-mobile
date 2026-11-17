/**
 * Dans le navigateur, le thème ne s'arrête pas à l'app : le fond de la page, la barre du navigateur, les ascenseurs,
 * l'anneau de focus au clavier et la couleur de sélection le suivent aussi.
 * Les valeurs sont gardées pour la prochaine ouverture : public/avant-app.js les applique avant le chargement de l'app.
 */
export function suivreFondWeb({ bg, accent, sombre }: { bg: string; accent: string; sombre: boolean }) {
  if (typeof document === 'undefined') return;
  const racine = document.documentElement;
  racine.style.setProperty('--me-fond', bg);
  racine.style.setProperty('--me-accent', accent);
  // Le voile de survol : clair sur un thème sombre, foncé sur un thème clair.
  racine.style.setProperty('--me-survol', sombre ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.045)');
  // Ce que le navigateur dessine lui-même (ascenseurs, champs natifs, menus) : sombre sur un thème sombre.
  racine.style.colorScheme = sombre ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  try {
    localStorage.setItem('me-fond', bg);
    localStorage.setItem('me-accent', accent);
    localStorage.setItem('me-sombre', sombre ? '1' : '0');
  } catch {
    // Navigation privée ou stockage refusé : la page s'ouvrira avec le thème par défaut.
  }
}
