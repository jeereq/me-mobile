import { useSyncExternalStore } from 'react';

import type { GuideCle } from './guide-pages';

/**
 * L'état de l'assistant d'aide, en mémoire : la fenêtre qui liste les actions d'une page, et le pas à pas qui reste
 * affiché par-dessus la page pendant qu'on fait l'action. `actif` : le bouton « ? » ne se montre qu'à un compte connecté.
 */
export type EtatAide = { actif: boolean; liste: GuideCle | null; pas: { cle: GuideCle; action: string; i: number } | null };

let etat: EtatAide = { actif: false, liste: null, pas: null };
const abonnes = new Set<() => void>();
const poser = (n: Partial<EtatAide>) => {
  etat = { ...etat, ...n };
  abonnes.forEach((f) => f());
};

export const aide = {
  activer: (actif: boolean) => etat.actif !== actif && poser({ actif, ...(actif ? {} : { liste: null, pas: null }) }),
  /** Ouvre la liste des actions d'une page. */
  ouvrir: (cle: GuideCle) => poser({ liste: cle }),
  fermer: () => poser({ liste: null }),
  /** Montre une action pas à pas, par-dessus la page ; ferme la liste. */
  commencer: (cle: GuideCle, action: string) => poser({ liste: null, pas: { cle, action, i: 0 } }),
  aller: (i: number) => etat.pas && poser({ pas: { ...etat.pas, i } }),
  arreter: () => poser({ pas: null }),
};

export const useAide = (): EtatAide =>
  useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => etat,
    () => etat,
  );
