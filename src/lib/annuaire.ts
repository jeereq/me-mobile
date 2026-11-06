import type { RythmeObjectif } from './commun/cotisations';

/** Les filtres de l'annuaire. Le montant regroupe la devise et un plafond. */
export type FiltresAnnuaire = {
  mode: 'rotation' | 'objectif' | null;
  rythme: RythmeObjectif | null;
  montant: string | null;
};

export const FILTRES_VIDES: FiltresAnnuaire = { mode: null, rythme: null, montant: null };

export const TYPES_GROUPE: { key: 'rotation' | 'objectif'; label: string }[] = [
  { key: 'rotation', label: 'Chacun son tour' },
  { key: 'objectif', label: 'Raison précise' },
];

export const RYTHMES_GROUPE: { key: RythmeObjectif; label: string }[] = [
  { key: 'quotidien', label: 'Chaque jour' },
  { key: 'hebdomadaire', label: 'Chaque semaine' },
  { key: 'mensuel', label: 'Chaque mois' },
  { key: 'unique', label: 'Une fois' },
];

const tranche = (devise: 'USD' | 'CDF', max: number) => ({ key: `${devise}-${max}`, devise, max: max * 100, label: `Jusqu’à ${max.toLocaleString('fr-FR').replace(/[\s ]/g, ' ')} ${devise}` });

export const TRANCHES_MONTANT = [tranche('USD', 5), tranche('USD', 10), tranche('USD', 50), tranche('USD', 100), tranche('CDF', 10000), tranche('CDF', 50000), tranche('CDF', 100000), tranche('CDF', 300000)];

export const nombreFiltres = (f: FiltresAnnuaire) => [f.mode, f.rythme, f.montant].filter(Boolean).length;

/** Ce que l'on demande au serveur, qui filtre avant de limiter la liste. */
export function requeteAnnuaire(q: string, f: FiltresAnnuaire) {
  const t = TRANCHES_MONTANT.find((x) => x.key === f.montant);
  const p = new URLSearchParams();
  if (q.trim()) p.set('q', q.trim());
  if (f.mode) p.set('mode', f.mode);
  if (f.rythme) p.set('rythme', f.rythme);
  if (t) {
    p.set('devise', t.devise);
    p.set('montantMax', String(t.max));
  }
  return p.toString();
}
