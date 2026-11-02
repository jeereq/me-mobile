/** La taille du texte choisie sur l'appareil, comme dans WhatsApp. Module pur, testé dans tests/taille-texte.test.ts. */

export type TailleTexte = 'petit' | 'normal' | 'grand' | 'tres-grand';

export const TAILLES_TEXTE: { cle: TailleTexte; nom: string; echelle: number }[] = [
  { cle: 'petit', nom: 'Petit', echelle: 0.88 },
  { cle: 'normal', nom: 'Normal', echelle: 1 },
  { cle: 'grand', nom: 'Grand', echelle: 1.15 },
  { cle: 'tres-grand', nom: 'Très grand', echelle: 1.3 },
];

/** Une valeur enregistrée inconnue ou absente revient à la taille normale. */
export const lireTaille = (brut: unknown): TailleTexte => TAILLES_TEXTE.find((t) => t.cle === brut)?.cle ?? 'normal';

/** Le réglage ne s'applique qu'aux vues mobiles : un écran d'ordinateur garde sa mise en page. */
export const echelleDe = (cle: TailleTexte, mobile: boolean) => (mobile ? (TAILLES_TEXTE.find((t) => t.cle === cle)?.echelle ?? 1) : 1);

const ajuste = (n: number, e: number) => Math.round(n * e * 2) / 2;

/** Ce qui change dans un style : la taille et l'interligne, s'ils sont définis. Sans taille, le texte hérite de son parent, déjà ajusté. */
export function tailleAjustee(style: { fontSize?: unknown; lineHeight?: unknown } | null | undefined, e: number) {
  const sortie: { fontSize?: number; lineHeight?: number } = {};
  if (e === 1 || !style) return sortie;
  if (typeof style.fontSize === 'number') sortie.fontSize = ajuste(style.fontSize, e);
  if (typeof style.lineHeight === 'number') sortie.lineHeight = ajuste(style.lineHeight, e);
  return sortie;
}
