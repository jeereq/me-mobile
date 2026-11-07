import type { RythmeObjectif } from './commun/cotisations';

/** Les filtres de l'annuaire. Le montant regroupe la devise et un plafond. */
export type TriAnnuaire = 'recent' | 'montant' | 'places';
export type FiltresAnnuaire = {
  mode: 'rotation' | 'objectif' | null;
  rythme: RythmeObjectif | null;
  montant: string | null;
  tri: TriAnnuaire;
  /** Seulement les groupes qui n'ont pas encore démarré. */
  ouverts: boolean;
};

export const FILTRES_VIDES: FiltresAnnuaire = { mode: null, rythme: null, montant: null, tri: 'recent', ouverts: false };

export const TRIS: { key: TriAnnuaire; label: string }[] = [
  { key: 'recent', label: 'Plus récents' },
  { key: 'montant', label: 'Moins chers' },
  { key: 'places', label: 'Bientôt complets' },
];

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

export const nombreFiltres = (f: FiltresAnnuaire) => [f.mode, f.rythme, f.montant, f.ouverts].filter(Boolean).length;

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
  if (f.tri !== 'recent') p.set('tri', f.tri);
  if (f.ouverts) p.set('ouverts', '1');
  return p.toString();
}

/** Ce que le serveur enregistre pour une alerte : la recherche et les filtres, sans le tri. */
export type FiltresAlerte = { q?: string; mode?: string; rythme?: string; devise?: string; montantMax?: number };
export type Alerte = { id: string; filtres: FiltresAlerte; creeLe: string };

export function filtresAlerte(q: string, f: FiltresAnnuaire): FiltresAlerte {
  const t = TRANCHES_MONTANT.find((x) => x.key === f.montant);
  return { ...(q.trim() ? { q: q.trim() } : {}), ...(f.mode ? { mode: f.mode } : {}), ...(f.rythme ? { rythme: f.rythme } : {}), ...(t ? { devise: t.devise, montantMax: t.max } : {}) };
}

/** « Chaque mois, jusqu’à 10 USD, « Gombe » » ; « Tous les nouveaux groupes » sans critère. */
export function texteAlerte(f: FiltresAlerte) {
  const t = TRANCHES_MONTANT.find((x) => x.devise === f.devise && x.max === f.montantMax);
  const montant = t ? t.label.replace('Jusqu’à', 'jusqu’à') : f.montantMax && f.devise ? `jusqu’à ${f.montantMax / 100} ${f.devise}` : '';
  const morceaux = [TYPES_GROUPE.find((x) => x.key === f.mode)?.label, RYTHMES_GROUPE.find((x) => x.key === f.rythme)?.label, montant, f.q ? `« ${f.q} »` : ''].filter(Boolean) as string[];
  if (!morceaux.length) return 'Tous les nouveaux groupes';
  const s = morceaux.join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** L'identifiant d'un groupe dans son lien « /annuaire/tontine-des-commercants-ck123 ». */
export function idDuLien(segment: string) {
  const id = segment.split('-').pop() ?? '';
  return /^[a-z0-9]{6,40}$/i.test(id) ? id : null;
}

/** Ce que l'annuaire sait d'un organisateur : seulement des faits enregistrés sur Me. */
export type Confiance = { termines: number; versements: number; aTemps: number; depuis: string | null };

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Les faits, du plus parlant au moins parlant. Un nouvel organisateur le dit simplement. */
export function lignesConfiance(c: Confiance | null | undefined) {
  if (!c) return [];
  const l: string[] = [];
  if (c.termines) l.push(`${pluriel(c.termines, 'groupe')} mené${c.termines > 1 ? 's' : ''} à terme`);
  if (c.versements) l.push(c.aTemps === c.versements ? `${pluriel(c.versements, 'versement')}, ${c.versements > 1 ? 'tous' : ''} à temps`.replace(',  à', ', à') : `${c.aTemps} versement${c.aTemps > 1 ? 's' : ''} à temps sur ${c.versements}`);
  if (c.depuis) l.push(`Sur Me depuis ${MOIS[Number(c.depuis.slice(5, 7)) - 1]} ${c.depuis.slice(0, 4)}`);
  if (!c.termines && !c.versements) l.unshift('Premier groupe sur Me');
  return l;
}

