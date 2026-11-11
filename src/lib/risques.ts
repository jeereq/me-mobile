import type { Risque } from './types';

export type Niveau = 'eleve' | 'moyen' | 'faible';
export const NIVEAUX: { cle: Niveau; nom: string }[] = [
  { cle: 'eleve', nom: 'Élevé' },
  { cle: 'moyen', nom: 'Moyen' },
  { cle: 'faible', nom: 'Faible' },
];
export const STATUTS_RISQUE: { cle: Risque['statut']; nom: string }[] = [
  { cle: 'ouvert', nom: 'Ouvert' },
  { cle: 'mitige', nom: 'Réduit' },
  { cle: 'clos', nom: 'Clos' },
];
export const NIVEAU_3 = [1, 2, 3] as const;
export const NOMS_NIVEAU_3 = { 1: 'Faible', 2: 'Moyen', 3: 'Fort' } as const;

/** Probabilité × impact : de 1 à 9. */
export const scoreRisque = (r: Pick<Risque, 'probabilite' | 'impact'>) => r.probabilite * r.impact;
/** Élevé à partir de 6 (fort × moyen), moyen de 3 à 4, faible en dessous. */
export const niveauRisque = (r: Pick<Risque, 'probabilite' | 'impact'>): Niveau => (scoreRisque(r) >= 6 ? 'eleve' : scoreRisque(r) >= 3 ? 'moyen' : 'faible');
export const nomNiveau = (n: Niveau) => NIVEAUX.find((x) => x.cle === n)!.nom;

export const risquesDe = (e: { risques?: Risque[] }) => e.risques ?? [];
const rang = { ouvert: 0, mitige: 1, clos: 2 } as const;

/** Les plus graves d'abord ; les risques clos à la fin. */
export const trierRisques = (l: Risque[]) => [...l].sort((a, b) => rang[a.statut] - rang[b.statut] || scoreRisque(b) - scoreRisque(a) || a.titre.localeCompare(b.titre, 'fr'));

export function nouveauRisque(o: { id: string; maintenant: string; titre?: string; projet?: string }): Risque {
  return { id: o.id, titre: o.titre ?? '', probabilite: 2, impact: 2, statut: 'ouvert', ...(o.projet ? { projet: o.projet } : {}), creeLe: o.maintenant };
}

/** Combien de risques actifs (ouverts ou réduits) par niveau. */
export function resumeRisques(l: Risque[]): Record<Niveau, number> & { clos: number } {
  const r = { eleve: 0, moyen: 0, faible: 0, clos: 0 };
  for (const x of l) if (x.statut === 'clos') r.clos++;
  else r[niveauRisque(x)]++;
  return r;
}

/** Retire les références à des projets supprimés. */
export const sansProjetsSupprimes = (l: Risque[], projets: { id: string }[]): Risque[] => l.map((r) => (r.projet && !projets.some((p) => p.id === r.projet) ? { ...r, projet: undefined } : r));
