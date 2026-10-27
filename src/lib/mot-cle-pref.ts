import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { lireMotCle, MOT_CLE_DEFAUT, type MotCle } from './mot-cle';

/**
 * Le réglage du mot-clé reste sur cet appareil : on l'active là où l'on veut que le micro écoute (le téléphone en main, pas
 * l'ordinateur du bureau), donc il ne suit pas le compte d'un appareil à l'autre.
 */
const CLE = 'me.motcle';
let courant: MotCle = MOT_CLE_DEFAUT;
let charge = false;
const abonnes = new Set<(m: MotCle) => void>();

async function charger() {
  if (charge) return courant;
  try {
    const brut = await AsyncStorage.getItem(CLE);
    courant = lireMotCle(brut ? JSON.parse(brut) : null);
  } catch {
    courant = MOT_CLE_DEFAUT;
  }
  charge = true;
  abonnes.forEach((f) => f(courant));
  return courant;
}

export function enregistrerMotCle(m: MotCle) {
  courant = m;
  charge = true;
  abonnes.forEach((f) => f(m));
  AsyncStorage.setItem(CLE, JSON.stringify(m)).catch(() => {});
}

/** Le réglage du mot-clé de cet appareil et de quoi le changer ; `pret` est faux tant qu'il n'est pas relu. */
export function useMotCle() {
  const [m, setM] = useState(courant);
  const [pret, setPret] = useState(charge);
  useEffect(() => {
    abonnes.add(setM);
    charger().then((x) => {
      setM(x);
      setPret(true);
    });
    return () => {
      abonnes.delete(setM);
    };
  }, []);
  return { motCle: m, pret, changer: (patch: Partial<MotCle>) => enregistrerMotCle({ ...courant, ...patch }) };
}
