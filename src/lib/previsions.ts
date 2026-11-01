import { prevision as previsionCommune, type Prevision } from './commun/previsions';
import type { Finances, Horizon } from './types';

/**
 * Où en sont les budgets de chaque période (aujourd'hui, cette semaine, ce mois…) : montant, dépensé, reste, sur la seule
 * base des dépenses notées. Rien n'est projeté ni réparti. C'est le calcul du serveur (me-api/src/commun/previsions.ts),
 * le même que l'écran Finances pour la période : le chiffre d'une alerte est celui de l'écran.
 */

export const HORIZONS: { key: Horizon; label: string; titre: string }[] = [
  { key: 'jour', label: "Aujourd'hui", titre: 'du jour' },
  { key: 'semaine', label: 'Cette semaine', titre: 'de la semaine' },
  { key: 'mois', label: 'Ce mois', titre: 'du mois' },
  { key: 'trimestre', label: 'Ce trimestre', titre: 'du trimestre' },
  { key: 'annee', label: 'Cette année', titre: "de l'année" },
];

export type Etat = Prevision['etat'];
export type { Prevision };

/** La période `horizon` qui contient `d`. `seuil` : part du budget à partir de laquelle il est « presque atteint ». null sans budget. */
export const prevision = (f: Finances, horizon: Horizon, d: string, seuil = 1): Prevision | null => previsionCommune(f, horizon, d, seuil);

export const previsions = (f: Finances, d: string, seuil = 1) => HORIZONS.map((h) => prevision(f, h.key, d, seuil)).filter((p): p is Prevision => !!p);
