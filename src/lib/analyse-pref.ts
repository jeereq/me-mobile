import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { lireReglagesAnalyse, REGLAGES_ANALYSE, type ReglagesAnalyse } from './copilote';

/**
 * Les réglages de l'analyse des mails par le copilote (consignes, nombre de mails) restent sur cet appareil et servent de
 * point de départ à chaque analyse : on les change au moment de choisir les mails, ou depuis le résultat.
 */
const CLE = 'me.analyse';
let courant: ReglagesAnalyse = REGLAGES_ANALYSE;
let charge = false;
const abonnes = new Set<(r: ReglagesAnalyse) => void>();

async function charger() {
  if (charge) return courant;
  try {
    const brut = await AsyncStorage.getItem(CLE);
    courant = lireReglagesAnalyse(brut ? JSON.parse(brut) : null);
  } catch {
    courant = REGLAGES_ANALYSE;
  }
  charge = true;
  abonnes.forEach((f) => f(courant));
  return courant;
}

export function enregistrerReglagesAnalyse(r: Partial<ReglagesAnalyse>) {
  courant = lireReglagesAnalyse({ ...courant, ...r });
  charge = true;
  abonnes.forEach((f) => f(courant));
  AsyncStorage.setItem(CLE, JSON.stringify(courant)).catch(() => {});
}

/** Les réglages d'analyse de cet appareil ; `pret` est faux tant qu'ils ne sont pas relus. */
export function useReglagesAnalyse() {
  const [r, setR] = useState(courant);
  const [pret, setPret] = useState(charge);
  useEffect(() => {
    abonnes.add(setR);
    charger().then((x) => {
      setR(x);
      setPret(true);
    });
    return () => {
      abonnes.delete(setR);
    };
  }, []);
  return { reglages: r, pret };
}
