import { useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export type ModeOndes = 'repos' | 'ecoute' | 'reflechit' | 'parle';

/**
 * Ondes vocales façon Jarvis / Siri : trois vagues superposées qui suivent la voix.
 * - `ecoute` : elles montent et descendent avec le volume du micro (`volume`, de -2 en silence à 10 fort).
 * - `parle` : la voix de l'app (la synthèse ne donne pas son volume) : un débit de syllabes simulé, relancé à chaque mot (`mot`).
 * - `reflechit` : une respiration lente ; `repos` : une ligne presque plate.
 * Figées en une vague calme si l'appareil demande de réduire les animations.
 */
export function Ondes({ mode, volume = 0, mot = 0, couleur, couleur2, hauteur = 72 }: { mode: ModeOndes; volume?: number; mot?: number; couleur: string; couleur2?: string; hauteur?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [largeur, setLargeur] = useState(0);
  const [image, setImage] = useState({ niveau: 0.05, phase: 0 });
  const [fige, setFige] = useState(false);
  const etat = useRef({ niveau: 0.05, cible: 0.05, phase: 0, prochain: 0 });
  const entrees = useRef({ mode, volume });
  useEffect(() => {
    entrees.current = { mode, volume };
  }, [mode, volume]);

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
    if (mot && entrees.current.mode === 'parle') etat.current.cible = 0.85 + Math.random() * 0.15;
  }, [mot]);

  useEffect(() => {
    if (fige) return;
    let boucle = 0;
    let avant = 0;
    const image = (ms: number) => {
      const dt = avant ? Math.min(0.05, (ms - avant) / 1000) : 1 / 60;
      avant = ms;
      const e = etat.current;
      const { mode: m, volume: v } = entrees.current;
      if (m === 'ecoute') e.cible = 0.08 + Math.max(0, Math.min(10, v)) / 10 * 0.92;
      else if (m === 'parle') {
        // Une syllabe toutes les 90 à 180 ms, avec de courtes pauses : ça respire comme une voix.
        if (ms >= e.prochain) {
          e.cible = Math.random() < 0.12 ? 0.12 : 0.35 + Math.random() * 0.6;
          e.prochain = ms + 90 + Math.random() * 90;
        }
      } else if (m === 'reflechit') e.cible = 0.22 + 0.1 * Math.sin(ms / 420);
      else e.cible = 0.05;
      // Monte vite, redescend plus doucement.
      const k = e.cible > e.niveau ? 14 : 6;
      e.niveau += (e.cible - e.niveau) * Math.min(1, k * dt);
      e.phase += dt * (m === 'repos' ? 1.2 : m === 'reflechit' ? 2.2 : 4 + e.niveau * 5);
      setImage({ niveau: e.niveau, phase: e.phase });
      boucle = requestAnimationFrame(image);
    };
    boucle = requestAnimationFrame(image);
    return () => cancelAnimationFrame(boucle);
  }, [fige]);

  const { niveau, phase } = fige ? { niveau: mode === 'repos' ? 0.05 : 0.3, phase: 0 } : image;
  const milieu = hauteur / 2;
  const vague = (frequence: number, decalage: number, force: number) => {
    if (!largeur) return '';
    const pas = Math.max(2, largeur / 90);
    let d = '';
    for (let x = 0; x <= largeur + 0.1; x += pas) {
      const u = (x / largeur) * 2 - 1;
      // Les bords restent posés sur la ligne, la vague gonfle au centre.
      const enveloppe = Math.pow(1 - u * u, 2);
      const y = milieu + Math.sin(u * frequence + phase * (1 + decalage) + decalage * 3) * enveloppe * (milieu - 3) * Math.max(0.04, niveau) * force;
      d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };
  const c2 = couleur2 ?? couleur;

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setLargeur(Math.round(e.nativeEvent.layout.width))}
      style={{ width: '100%', height: hauteur }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {largeur ? (
        <Svg width={largeur} height={hauteur}>
          <Defs>
            <LinearGradient id={`o1${id}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={couleur} stopOpacity={0.15} />
              <Stop offset="0.5" stopColor={couleur} stopOpacity={1} />
              <Stop offset="1" stopColor={c2} stopOpacity={0.15} />
            </LinearGradient>
            <LinearGradient id={`o2${id}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={c2} stopOpacity={0.1} />
              <Stop offset="0.5" stopColor={c2} stopOpacity={0.8} />
              <Stop offset="1" stopColor={couleur} stopOpacity={0.1} />
            </LinearGradient>
          </Defs>
          <Path d={vague(5.5, 0.6, 0.55)} stroke={`url(#o2${id})`} strokeWidth={1.5} fill="none" opacity={0.6} />
          <Path d={vague(9, 1.3, -0.75)} stroke={`url(#o2${id})`} strokeWidth={2} fill="none" opacity={0.75} />
          <Path d={vague(7, 0, 1)} stroke={`url(#o1${id})`} strokeWidth={3} strokeLinecap="round" fill="none" />
        </Svg>
      ) : null}
    </View>
  );
}
