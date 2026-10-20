/**
 * Chargements en cours, pour la barre de progression en haut de l'écran.
 * Chaque appel au serveur compte (sauf les synchros discrètes en arrière-plan) ; suivre() sert pour le reste.
 */
let enCours = 0;
const abonnes = new Set<(n: number) => void>();
const prevenir = () => abonnes.forEach((f) => f(enCours));

export function debutChargement() {
  enCours++;
  prevenir();
  let fini = false;
  return () => {
    if (fini) return;
    fini = true;
    enCours--;
    prevenir();
  };
}

export async function suivre<T>(p: Promise<T>): Promise<T> {
  const fin = debutChargement();
  try {
    return await p;
  } finally {
    fin();
  }
}

export const chargementsEnCours = () => enCours;

/** Prévient à chaque changement, et tout de suite avec l'état actuel. */
export function surChargement(f: (n: number) => void) {
  abonnes.add(f);
  f(enCours);
  return () => {
    abonnes.delete(f);
  };
}
