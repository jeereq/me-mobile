import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { lireReglagesAnalyse, REGLAGES_ANALYSE, type ReglagesAnalyse } from './copilote';
import { lireReprise, resteATraiter, type RepriseAnalyse } from './reprise-analyse';

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

// La dernière analyse en cours, pour la reprendre : effacée à la déconnexion, car elle contient le résumé des mails.
const CLE_REPRISE = 'me.analyse.reprise';
let reprise: RepriseAnalyse | null = null;
let repriseLue = false;
const abonnesReprise = new Set<(r: RepriseAnalyse | null) => void>();
const poserReprise = (r: RepriseAnalyse | null) => {
  reprise = r;
  repriseLue = true;
  abonnesReprise.forEach((f) => f(r));
};

async function chargerReprise() {
  if (repriseLue) return reprise;
  try {
    const brut = await AsyncStorage.getItem(CLE_REPRISE);
    poserReprise(lireReprise(brut ? JSON.parse(brut) : null, Date.now()));
  } catch {
    poserReprise(null);
  }
  return reprise;
}

export function enregistrerReprise(r: RepriseAnalyse) {
  poserReprise(r);
  AsyncStorage.setItem(CLE_REPRISE, JSON.stringify(r)).catch(() => {});
}

export function oublierReprise() {
  poserReprise(null);
  AsyncStorage.removeItem(CLE_REPRISE).catch(() => {});
}

/** La dernière analyse de cette personne, s'il lui reste quelque chose à traiter. */
export function useReprise(pour?: string) {
  const [r, setR] = useState(reprise);
  useEffect(() => {
    abonnesReprise.add(setR);
    chargerReprise().then(setR);
    return () => {
      abonnesReprise.delete(setR);
    };
  }, []);
  return r && r.pour === pour && resteATraiter(r) > 0 ? r : null;
}
