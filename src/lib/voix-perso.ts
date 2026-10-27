import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Ta propre voix pour lire les réponses de Me. Sur iPhone (iOS 17 et plus), la « Voix personnelle » s'enregistre dans
 * Réglages › Accessibilité › Voix personnelle ; une fois l'app autorisée, elle s'ajoute aux voix du téléphone.
 * Android et les navigateurs n'ont pas d'équivalent : on y choisit parmi les voix installées.
 */
export type EtatVoixPerso = 'autorise' | 'refuse' | 'a_demander' | 'indisponible';
type Module = { etat(): EtatVoixPerso; demander(): Promise<EtatVoixPerso>; voix(): { identifier: string; name: string; language: string }[] };

let cache: Module | null | undefined;
const module = () => {
  if (cache === undefined) {
    try {
      cache = Platform.OS === 'ios' ? requireOptionalNativeModule<Module>('VoixPersonnelle') : null;
    } catch {
      cache = null;
    }
  }
  return cache;
};

/** Null quand ce n'est pas un iPhone, ou que l'app installée date d'avant (le module natif manque). */
export function etatVoixPerso(): EtatVoixPerso | null {
  try {
    return module()?.etat() ?? null;
  } catch {
    return null;
  }
}

/** Demande à iOS le droit de lire avec la voix personnelle (une seule fois : ensuite, cela se change dans les Réglages). */
export async function autoriserVoixPerso(): Promise<EtatVoixPerso | null> {
  try {
    return (await module()?.demander()) ?? null;
  } catch {
    return null;
  }
}

/** Les identifiants des voix personnelles autorisées, pour les montrer en premier sous le nom « Ta voix ». */
export function idsVoixPerso(): Set<string> {
  try {
    return new Set((module()?.voix() ?? []).map((v) => v.identifier));
  } catch {
    return new Set();
  }
}
