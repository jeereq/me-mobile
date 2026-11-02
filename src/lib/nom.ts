import { useSyncExternalStore } from 'react';

import { NOM_APP_DEFAUT, nomApp } from './commun/nom-app';

/**
 * Le nom que l'utilisateur a donné à l'app (Mon compte › Préférences), à la place de « Me ». Il suit le compte : le store le
 * lit sur le profil et le pose ici, pour que la voix, la commande vocale et le mot-clé s'en servent sans passer par React.
 * Avant la connexion (accueil public, écran de connexion), l'app reste « Me ».
 */
let courant = NOM_APP_DEFAUT;
const abonnes = new Set<() => void>();

export const nomCourant = () => courant;

export function definirNomApp(brut?: string | null) {
  const n = nomApp(brut);
  if (n === courant) return;
  courant = n;
  abonnes.forEach((f) => f());
}

const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};

/** Le nom de l'app, mis à jour quand il change. */
export const useNomApp = () => useSyncExternalStore(abonner, nomCourant, nomCourant);

/** Ce qui tient dans la pastille du logo : « Me », ou les initiales du nom choisi (« Ja », « MC »). */
export function sigle(nom: string) {
  if (nom.length <= 2) return nom;
  const mots = nom.split(' ').filter(Boolean);
  if (mots.length > 1) return mots.slice(0, 2).map((m) => m[0].toUpperCase()).join('');
  return nom[0].toUpperCase() + nom[1].toLowerCase();
}

/** Le nom à mettre dans une expression régulière. */
export const motif = (nom: string) => nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Taille du nom écrit au centre d'un cercle (ondes de la voix) : plus petite pour un nom long, pour qu'il y tienne. */
export const tailleDansCercle = (nom: string, base: number) => (nom.length <= 4 ? base : Math.max(Math.round(base * 0.55), Math.round((base * 5) / nom.length)));
