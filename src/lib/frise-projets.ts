import { nomTrimestre, trimestreDe } from './feuille-de-route';
import { nomPilier, type Pilier } from './piliers';
import type { Plan } from './planning';
import type { Projet } from './types';

/**
 * La timeline des projets : un projet par ligne, dans l'ordre où ils s'exécutent (début le plus tôt d'abord),
 * une barre du début à la fin du planning, sur un axe de mois. Module pur, testé dans tests/frise-projets.test.ts.
 */

type Entree = { projet: Projet; plan: Pick<Plan, 'debut' | 'fin' | 'avancement'>; faites?: number; total?: number; enRetard?: number };

const MS_JOUR = 86400000;
const jourUtc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
/** Jours entre deux dates « AAAA-MM-JJ » (b − a). */
export const joursEntre = (a: string, b: string) => Math.round((jourUtc(b) - jourUtc(a)) / MS_JOUR);

/** Ordre d'exécution : début le plus tôt, puis fin la plus proche, puis nom ; les projets sans date à la fin. */
export function comparerExecution(a: { nom: string; debut?: string | null; fin?: string | null }, b: { nom: string; debut?: string | null; fin?: string | null }): number {
  return (a.debut ?? '9999').localeCompare(b.debut ?? '9999') || (a.fin ?? '9999').localeCompare(b.fin ?? '9999') || a.nom.localeCompare(b.nom, 'fr');
}

export type BarreFrise = {
  projet: Projet;
  debut: string;
  fin: string;
  /** Jours depuis le début de l'axe, et durée en jours (fin comprise). */
  decalage: number;
  duree: number;
  /** 0 à 100. */
  avancement: number;
  faites: number;
  total: number;
  enRetard: number;
  termine: boolean;
};
export type MoisFrise = { cle: string; nom: string; decalage: number; jours: number; annee: string };
export type Frise = { debut: string; fin: string; jours: number; mois: MoisFrise[]; barres: BarreFrise[]; sansDates: Projet[]; /** Jours depuis le début de l'axe, si aujourd'hui y est. */ aujourdhui: number | null };

const NOMS_MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function frise(entrees: Entree[], aujourdhui: string): Frise | null {
  const avecDates = entrees.filter((e) => e.plan.debut && e.plan.fin);
  const sansDates = entrees.filter((e) => !(e.plan.debut && e.plan.fin)).map((e) => e.projet);
  if (!avecDates.length) return null;
  const ordonnees = [...avecDates].sort((a, b) => comparerExecution({ nom: a.projet.nom, debut: a.plan.debut, fin: a.plan.fin }, { nom: b.projet.nom, debut: b.plan.debut, fin: b.plan.fin }));
  const debut = ordonnees.reduce((m, e) => (e.plan.debut! < m ? e.plan.debut! : m), ordonnees[0].plan.debut!);
  const fin = ordonnees.reduce((m, e) => (e.plan.fin! > m ? e.plan.fin! : m), ordonnees[0].plan.fin!);
  // L'axe commence au 1er du mois du premier début et finit à la fin du mois de la dernière fin.
  const axeDebut = `${debut.slice(0, 7)}-01`;
  const jours = joursEntre(axeDebut, `${fin.slice(0, 7)}-01`) + new Date(Date.UTC(Number(fin.slice(0, 4)), Number(fin.slice(5, 7)), 0)).getUTCDate();
  const mois: MoisFrise[] = [];
  for (let c = axeDebut; mois.length < 240; ) {
    const [a, m] = [Number(c.slice(0, 4)), Number(c.slice(5, 7))];
    const decalage = joursEntre(axeDebut, c);
    if (decalage >= jours) break;
    mois.push({ cle: c.slice(0, 7), nom: NOMS_MOIS[m - 1], decalage, jours: new Date(Date.UTC(a, m, 0)).getUTCDate(), annee: String(a) });
    c = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
  }
  const barres = ordonnees.map((e) => {
    const d = e.plan.debut!;
    const f = e.plan.fin! < d ? d : e.plan.fin!;
    const total = e.total ?? 0;
    const faites = e.faites ?? 0;
    return { projet: e.projet, debut: d, fin: f, decalage: joursEntre(axeDebut, d), duree: joursEntre(d, f) + 1, avancement: Math.max(0, Math.min(100, Math.round(e.plan.avancement ?? 0))), faites, total, enRetard: e.enRetard ?? 0, termine: total > 0 && faites >= total };
  });
  const auj = joursEntre(axeDebut, aujourdhui);
  return { debut: axeDebut, fin, jours, mois, barres, sansDates, aujourdhui: auj >= 0 && auj <= jours ? auj : null };
}

/* ——— Regrouper les projets ——— */

export type ModeGroupe = 'aucun' | 'pilier' | 'trimestre' | 'mois';
export type GroupeFrise = { cle: string; titre: string; barres: BarreFrise[] };

/** Le pilier d'un projet : celui qui compte le plus de tâches (le plus petit numéro en cas d'égalité), ou null. */
export function pilierPrincipal(taches: { pilier?: number[] }[]): number | null {
  const n = new Map<number, number>();
  for (const t of taches) for (const p of t.pilier ?? []) n.set(p, (n.get(p) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}

const nomMois = (cle: string) => `${NOMS_MOIS[Number(cle.slice(5, 7)) - 1]} ${cle.slice(0, 4)}`;

/**
 * Range les barres (déjà dans l'ordre d'exécution) en groupes. Par pilier : le pilier principal du projet, « Sans pilier » en dernier.
 * Par trimestre ou par mois : celui où le projet démarre, dans l'ordre du calendrier. `taches` : les tâches de chaque projet (pour les piliers).
 */
export function grouperBarres(barres: BarreFrise[], mode: ModeGroupe, o: { piliers?: Pilier[]; taches?: Map<string, { pilier?: number[] }[]> } = {}): GroupeFrise[] {
  if (mode === 'aucun') return [{ cle: 'tous', titre: '', barres }];
  const groupes = new Map<string, GroupeFrise>();
  for (const b of barres) {
    let cle: string;
    let titre: string;
    if (mode === 'pilier') {
      const n = pilierPrincipal(o.taches?.get(b.projet.id) ?? []);
      cle = n === null ? 'z-sans' : `p${String(n).padStart(3, '0')}`;
      titre = n === null ? 'Sans pilier' : nomPilier(n, o.piliers);
    } else if (mode === 'trimestre') {
      cle = trimestreDe(b.debut);
      titre = nomTrimestre(cle);
    } else {
      cle = b.debut.slice(0, 7);
      titre = nomMois(cle);
    }
    const g = groupes.get(cle) ?? { cle, titre, barres: [] };
    g.barres.push(b);
    groupes.set(cle, g);
  }
  return [...groupes.values()].sort((a, b) => a.cle.localeCompare(b.cle));
}
