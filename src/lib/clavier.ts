/** Le clavier du téléphone dans une page web. Module pur, testé dans tests/clavier.test.ts. */

/** En dessous, c'est la barre d'adresse du navigateur qui bouge, pas le clavier. */
export const SEUIL_CLAVIER = 80;

/** Ce que le clavier recouvre en bas de la fenêtre, d'après la zone réellement visible (`visualViewport`). */
export function hauteurClavier(fenetre: number, visible: number, decalage: number) {
  const h = Math.round(fenetre - visible - decalage);
  return h >= SEUIL_CLAVIER ? h : 0;
}

/** Un champ d'une ligne se place au milieu de ce qui reste ; un long texte, juste assez pour être vu. */
export const placementChamp = (balise: string): 'center' | 'nearest' => (balise === 'TEXTAREA' ? 'nearest' : 'center');
