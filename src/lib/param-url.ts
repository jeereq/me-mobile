import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Un état d'écran gardé dans l'adresse (?onglet=budgets&vue=semaine) : recharger la page, partager le lien ou revenir
 * en arrière retombe sur la même vue. `valeurs` limite ce qui est accepté (null : toute valeur non vide) ; la valeur
 * par défaut n'est pas écrite dans l'adresse. Un lien qui change le paramètre (?onglet=objectifs) met l'état à jour.
 */
export function useParamUrl<T extends string>(nom: string, valeurs: readonly T[] | null, defaut: T): [T, (v: T) => void] {
  const brut = useLocalSearchParams<Record<string, string | string[] | undefined>>()[nom];
  const p = typeof brut === 'string' && brut ? brut : undefined;
  const lu = (p && (!valeurs || (valeurs as readonly string[]).includes(p)) ? p : defaut) as T;
  const [valeur, setValeur] = useState<T>(lu);
  const [vu, setVu] = useState(p);
  if (p !== vu) {
    setVu(p);
    setValeur(lu);
  }
  const changer = useCallback(
    (v: T) => {
      const dans = v === defaut ? undefined : v;
      // `vu` n'est pas touché : il suit l'adresse seulement. Le choix reste affiché pendant que l'adresse se met à
      // jour, et ne revient pas à l'ancienne valeur si la navigation n'a pas encore suivi.
      setValeur(v);
      try {
        router.setParams({ [nom]: dans });
      } catch {
        // Hors navigation (tests, aperçu) : l'état reste en mémoire.
      }
    },
    [nom, defaut],
  );
  return [valeur, changer];
}

/** Retire des paramètres d'une adresse déjà lus (?ajout=…), pour qu'un rechargement ne rouvre pas la fenêtre. */
export function oublierParams(...noms: string[]) {
  try {
    router.setParams(Object.fromEntries(noms.map((n) => [n, undefined])));
  } catch {
    // Hors navigation.
  }
}
