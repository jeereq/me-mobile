import { useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** À partir de cette largeur (ordinateur, tablette en paysage), les onglets passent en barre latérale. */
export const LARGEUR_BUREAU = 900;
/** Hauteur de la barre d'onglets flottante du téléphone. */
export const HAUTEUR_BARRE = 64;

// Sur le web (app installée sur l'écran d'accueil de l'iPhone), useSafeAreaInsets reste à 0 :
// on lit directement les zones sûres fournies par le navigateur (encoche en haut, geste d'accueil en bas).
function zonesSuresWeb() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return { haut: 0, bas: 0 };
  const sonde = document.createElement('div');
  sonde.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(sonde);
  const st = getComputedStyle(sonde);
  const z = { haut: parseFloat(st.paddingTop) || 0, bas: parseFloat(st.paddingBottom) || 0 };
  sonde.remove();
  return z;
}

/** Zones sûres de l'écran (encoche, barre d'état, geste d'accueil), sur téléphone comme sur le web. */
export function useZonesSures() {
  const [web] = useState(zonesSuresWeb);
  const i = useSafeAreaInsets();
  return { haut: Math.max(i.top, web.haut), bas: Math.max(i.bottom, web.bas) };
}

/**
 * Place de la barre d'onglets flottante. Sur iPhone, elle se pose juste au-dessus de la barre du geste d'accueil
 * (zone sûre du bas) au lieu de la recouvrir ; le contenu et le bouton + gardent la place nécessaire.
 */
export function useBarreOnglets() {
  const { bas } = useZonesSures();
  const bureau = useWindowDimensions().width >= LARGEUR_BUREAU;
  const decalage = bas > 0 ? bas : 12;
  return {
    bureau,
    /** Distance entre la barre et le bas de l'écran. */
    decalage,
    /** Haut de la barre, mesuré depuis le bas de l'écran (0 sur ordinateur). */
    haut: bureau ? 0 : decalage + HAUTEUR_BARRE,
    /** Marge à laisser sous le contenu pour qu'il ne passe pas sous la barre. */
    reserve: bureau ? 40 : decalage + HAUTEUR_BARRE + 28,
  };
}
