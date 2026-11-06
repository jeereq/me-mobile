import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { C } from '@/lib/theme';

/** Dessins originaux des cotisations : des gens, une cagnotte, sans texte à traduire. Couleurs fixes, lisibles sur tous les thèmes. */

const PEAUX = ['#7A4A2E', '#5E3A24', '#8F5B3A', '#6B4226', '#A06B45'];
const HABITS = ['#F2A65A', '#6C7CFF', '#2FBF8F', '#E8649A', '#3BB3E0'];
const OR = '#F4C542';
const OR_FONCE = '#C98A2B';
const VERT = '#2FBF8F';

function Personne({ x, y, i, e = 1 }: { x: number; y: number; i: number; e?: number }) {
  const n = i % PEAUX.length;
  return (
    <>
      <Path d={`M${x - 15 * e} ${y + 30 * e}a${15 * e} ${17 * e} 0 0 1 ${30 * e} 0z`} fill={HABITS[n]} />
      <Circle cx={x} cy={y + 2 * e} r={10 * e} fill={PEAUX[n]} />
    </>
  );
}

function Piece({ x, y, r = 7 }: { x: number; y: number; r?: number }) {
  return (
    <>
      <Circle cx={x} cy={y} r={r} fill={OR} />
      <Circle cx={x} cy={y} r={r * 0.58} fill="none" stroke={OR_FONCE} strokeWidth={1.4} />
    </>
  );
}

const Cercle = () => (
  <>
    <Circle cx={120} cy={80} r={58} fill="none" stroke={C.accent} strokeWidth={2} strokeDasharray="4 7" strokeLinecap="round" />
    <Path d="M163 42l11 1-3 11" fill="none" stroke={C.accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    <Personne x={120} y={10} i={0} />
    <Personne x={185} y={52} i={1} />
    <Personne x={160} y={118} i={2} />
    <Personne x={80} y={118} i={3} />
    <Personne x={55} y={52} i={4} />
    <Piece x={108} y={60} />
    <Piece x={126} y={55} />
    <Piece x={137} y={66} />
    <Path d="M92 72h56c0 22-11 34-28 34s-28-12-28-34z" fill={OR_FONCE} />
    <Rect x={88} y={68} width={64} height={8} rx={4} fill={OR} />
  </>
);

const Raison = () => (
  <>
    <Rect x={70} y={68} width={100} height={72} rx={8} fill={HABITS[1]} />
    <Rect x={62} y={50} width={116} height={24} rx={7} fill="#8E9BFF" />
    <Rect x={110} y={50} width={20} height={90} fill={OR} />
    <Path d="M120 50c-22-2-34-12-30-23 4-10 22-8 30 23zM120 50c22-2 34-12 30-23-4-10-22-8-30 23z" fill={OR} stroke={OR_FONCE} strokeWidth={2} />
    <Piece x={40} y={110} r={9} />
    <Piece x={28} y={84} />
    <Piece x={46} y={62} r={6} />
    <Personne x={205} y={84} i={0} e={1.15} />
    <Path d="M190 58l5-8M207 50v-9M222 58l6-7" stroke={OR} strokeWidth={3} strokeLinecap="round" />
  </>
);

const Invitation = () => (
  <>
    <Personne x={190} y={18} i={2} e={1.15} />
    <Personne x={40} y={72} i={4} e={1.15} />
    <Rect x={76} y={58} width={96} height={70} rx={10} fill={HABITS[1]} />
    <Path d="M78 64l46 36 46-36" fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M66 66C80 40 110 28 140 34" fill="none" stroke={C.accent} strokeWidth={2} strokeDasharray="4 7" strokeLinecap="round" />
    <Piece x={170} y={126} r={11} />
  </>
);

const Annuaire = () => (
  <>
    <Rect x={40} y={20} width={120} height={32} rx={10} fill={C.sunk} stroke={C.line} strokeWidth={1.5} />
    <Rect x={40} y={62} width={120} height={32} rx={10} fill={C.sunk} stroke={C.line} strokeWidth={1.5} />
    <Rect x={40} y={104} width={120} height={32} rx={10} fill={C.sunk} stroke={C.line} strokeWidth={1.5} />
    <Circle cx={58} cy={36} r={9} fill={PEAUX[0]} />
    <Circle cx={58} cy={78} r={9} fill={PEAUX[1]} />
    <Circle cx={58} cy={120} r={9} fill={PEAUX[2]} />
    <Rect x={74} y={31} width={62} height={9} rx={4.5} fill={HABITS[0]} />
    <Rect x={74} y={73} width={48} height={9} rx={4.5} fill={HABITS[1]} />
    <Rect x={74} y={115} width={56} height={9} rx={4.5} fill={HABITS[2]} />
    <Circle cx={166} cy={78} r={27} fill={C.surface} stroke={OR_FONCE} strokeWidth={6} />
    <Path d="M186 98l24 26" stroke={OR_FONCE} strokeWidth={9} strokeLinecap="round" />
    <Piece x={166} y={78} r={11} />
  </>
);

const Verification = () => (
  <>
    <Rect x={38} y={30} width={150} height={96} rx={12} fill={C.sunk} stroke={C.line} strokeWidth={2} />
    <Rect x={52} y={46} width={46} height={58} rx={8} fill={HABITS[4]} />
    <Personne x={75} y={50} i={1} e={1} />
    <Rect x={110} y={52} width={62} height={8} rx={4} fill={C.muted} />
    <Rect x={110} y={70} width={46} height={8} rx={4} fill={C.line} />
    <Rect x={110} y={88} width={54} height={8} rx={4} fill={C.line} />
    <Circle cx={190} cy={118} r={23} fill={VERT} />
    <Path d="M179 118l8 8 15-16" fill="none" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const DESSINS = { cercle: Cercle, raison: Raison, invitation: Invitation, annuaire: Annuaire, verification: Verification };
export type NomIllustration = keyof typeof DESSINS;

export function Illustration({ nom, largeur = 200 }: { nom: NomIllustration; largeur?: number }) {
  const Dessin = DESSINS[nom];
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: largeur, height: (largeur * 150) / 240 }}>
      <Svg width={largeur} height={(largeur * 150) / 240} viewBox="0 0 240 150">
        <Dessin />
      </Svg>
    </View>
  );
}

/** Le petit repère d'une ligne de groupe : chacun son tour, ou une raison précise. */
export function BadgeGroupe({ mode }: { mode: 'rotation' | 'objectif' }) {
  return (
    <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: C.sunk, alignItems: 'center', justifyContent: 'center' }}>
      <Illustration nom={mode === 'objectif' ? 'raison' : 'cercle'} largeur={38} />
    </View>
  );
}
