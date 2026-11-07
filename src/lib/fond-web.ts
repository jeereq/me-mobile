/**
 * Dans le navigateur, le fond de la page, la barre du navigateur et l'écran de démarrage suivent le thème.
 * La couleur est gardée pour la prochaine ouverture : public/avant-app.js l'applique avant l'app.
 */
export function suivreFondWeb(couleur: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--me-fond', couleur);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', couleur);
  try {
    localStorage.setItem('me-fond', couleur);
  } catch {
    // Navigation privée ou stockage refusé : la page s'ouvrira avec le fond par défaut.
  }
}
