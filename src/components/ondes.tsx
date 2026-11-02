import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

export type ModeOndes = 'repos' | 'ecoute' | 'reflechit' | 'parle';

const BARRES = 64;
const DEMI = BARRES / 2;

/**
 * Couronne vocale : des barres rayonnent autour d'un centre (le micro, en `children`) et suivent la voix.
 * - `ecoute` : la hauteur des barres suit le volume du micro (`volume`, de -2 en silence à 10 fort).
 * - `parle` : la voix de l'app (la synthèse ne donne pas son volume) : un débit de syllabes simulé, relancé à chaque mot (`mot`).
 * - `reflechit` : une respiration lente ; `repos` : un anneau fin et calme.
 * Les barres sont symétriques (gauche/droite) comme un spectre de voix, chacune a sa propre inertie, un halo suit le niveau et un anneau
 * de pics retombe doucement derrière. Figée si l'appareil demande de réduire les animations.
 */
export function Ondes({ mode, volume = 0, mot = 0, couleur, couleur2, taille = 220, children }: { mode: ModeOndes; volume?: number; mot?: number; couleur: string; couleur2?: string; taille?: number; children?: ReactNode }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [fige, setFige] = useState(false);
  const [dessin, setDessin] = useState<{ barres: string; pics: string; niveau: number }>({ barres: '', pics: '', niveau: 0.05, });
  const e = useRef({ niveau: 0.05, cible: 0.05, phase: 0, prochain: 0, v: new Float32Array(DEMI + 1), pic: new Float32Array(DEMI + 1), graine: new Float32Array(DEMI + 1).map((_, i) => (i * 2.39996) % 6.28) });
  const entrees = useRef({ mode, volume, taille });
  useEffect(() => {
    entrees.current = { mode, volume, taille };
  }, [mode, volume, taille]);

  useEffect(() => {
    let fini = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((f) => !fini && setFige(f))
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, []);

  // Chaque mot prononcé par l'app relance une syllabe forte.
  useEffect(() => {
    if (mot && entrees.current.mode === 'parle') e.current.cible = 0.85 + Math.random() * 0.15;
  }, [mot]);

  useEffect(() => {
    let boucle = 0;
    let avant = 0;
    const calcul = (dt: number, ms: number, fixe: boolean) => {
      const s = e.current;
      const { mode: m, volume: vol, taille: T } = entrees.current;
      const R0 = T * 0.27;
      const L = T * 0.2;
      if (fixe) {
        s.niveau = m === 'repos' ? 0.05 : 0.4;
        s.phase = 1;
      } else {
        if (m === 'ecoute') s.cible = 0.08 + (Math.max(0, Math.min(10, vol)) / 10) * 0.92;
        else if (m === 'parle') {
          // Une syllabe toutes les 90 à 180 ms, avec de courtes pauses : ça respire comme une voix.
          if (ms >= s.prochain) {
            s.cible = Math.random() < 0.12 ? 0.12 : 0.35 + Math.random() * 0.6;
            s.prochain = ms + 90 + Math.random() * 90;
          }
        } else if (m === 'reflechit') s.cible = 0.2 + 0.08 * Math.sin(ms / 420);
        else s.cible = 0.04;
        // Monte vite, redescend plus doucement.
        s.niveau += (s.cible - s.niveau) * Math.min(1, (s.cible > s.niveau ? 14 : 6) * dt);
        s.phase += dt * (m === 'repos' ? 0.8 : m === 'reflechit' ? 1.6 : 3 + s.niveau * 4);
      }
      // Cible de chaque barre : le niveau, modulé par un bruit qui se déplace le long de la couronne (plus haut vers le bas, comme une voix).
      for (let i = 0; i <= DEMI; i++) {
        const u = i / DEMI;
        const bruit = 0.5 + 0.5 * Math.sin(s.phase * 1.4 + i * 0.55 + s.graine[i]) * Math.sin(s.phase * 0.8 - i * 0.21);
        const enveloppe = 0.45 + 0.55 * Math.cos((u - 0.5) * Math.PI * 0.9);
        // Au carré : quelques barres hautes et beaucoup de basses, comme un vrai spectre, plutôt qu'un anneau plein.
        const cible = 0.04 + s.niveau * (0.12 + 0.88 * bruit * bruit * enveloppe);
        s.v[i] += (cible - s.v[i]) * Math.min(1, (cible > s.v[i] ? 22 : 9) * dt);
      }
      // Lissage entre voisines : la couronne ondule au lieu de crépiter.
      for (let i = 1; i < DEMI; i++) s.v[i] = s.v[i] * 0.6 + (s.v[i - 1] + s.v[i + 1]) * 0.2;
      let barres = '';
      let pics = '';
      for (let k = 0; k < BARRES; k++) {
        const i = k <= DEMI ? k : BARRES - k;
        const v = s.v[i];
        s.pic[i] = Math.max(v, s.pic[i] - dt * 0.35);
        const th = (k / BARRES) * Math.PI * 2 - Math.PI / 2;
        const c = Math.cos(th);
        const sn = Math.sin(th);
        const c0 = T / 2;
        barres += `M${(c0 + c * R0).toFixed(1)} ${(c0 + sn * R0).toFixed(1)}L${(c0 + c * (R0 + v * L)).toFixed(1)} ${(c0 + sn * (R0 + v * L)).toFixed(1)}`;
        const rp = R0 + s.pic[i] * L + T * 0.018;
        pics += `M${(c0 + c * rp).toFixed(1)} ${(c0 + sn * rp).toFixed(1)}l0.01 0`;
      }
      setDessin({ barres, pics, niveau: s.niveau });
    };
    if (fige) {
      calcul(0.016, 0, true);
      return;
    }
    const image = (ms: number) => {
      const dt = avant ? Math.min(0.05, (ms - avant) / 1000) : 1 / 60;
      avant = ms;
      calcul(dt, ms, false);
      boucle = requestAnimationFrame(image);
    };
    boucle = requestAnimationFrame(image);
    return () => cancelAnimationFrame(boucle);
  }, [fige]);

  const c2 = couleur2 ?? couleur;
  const T = taille;
  const R0 = T * 0.27;
  const epaisseur = Math.max(2.5, T * 0.016);
  return (
    <View style={{ width: T, height: T, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={T} height={T} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={`b${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={couleur} stopOpacity={1} />
            <Stop offset="1" stopColor={c2} stopOpacity={1} />
          </LinearGradient>
          <RadialGradient id={`h${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0.35" stopColor={couleur} stopOpacity={0.28} />
            <Stop offset="1" stopColor={c2} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* Halo : grossit et s'éclaire avec le niveau. */}
        <Circle cx={T / 2} cy={T / 2} r={R0 * (1.25 + dessin.niveau * 0.9)} fill={`url(#h${id})`} opacity={0.35 + dessin.niveau * 0.65} />
        <Circle cx={T / 2} cy={T / 2} r={R0 - T * 0.02} fill="none" stroke={couleur} strokeOpacity={0.3} strokeWidth={1} />
        {dessin.pics ? <Path d={dessin.pics} stroke={c2} strokeOpacity={0.55} strokeWidth={epaisseur * 0.8} strokeLinecap="round" fill="none" /> : null}
        {dessin.barres ? <Path d={dessin.barres} stroke={`url(#b${id})`} strokeWidth={epaisseur} strokeLinecap="round" fill="none" /> : null}
      </Svg>
      {children}
    </View>
  );
}
