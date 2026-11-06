/** Suivi d'une cotisation à une période donnée. Module pur, testé dans tests/cotisations.test.ts. */

import type { RythmeCotisation } from './commun/cotisations';
import type { Groupe } from './tontines';

export type PaiementMembre = { periode: string; statut: 'paye' | 'en_attente'; mode: 'mobile' | 'main'; montant: number };
export type MembreCotisation = { id: string; nom: string; depuis: string; demandePeriode: string | null; paiements: PaiementMembre[] };
export type Cotisation = { id: string; titre: string; montant: number; devise: string; rythme: RythmeCotisation; archive: boolean; periode: string; periodes: string[]; encaisse: number; membres: MembreCotisation[] };
export type EtatMembre = 'paye' | 'en_attente' | 'demande' | 'a_payer' | 'hors';

export function etatMembre(m: MembreCotisation, periode: string): EtatMembre {
  const p = m.paiements.filter((x) => x.periode === periode);
  if (p.some((x) => x.statut === 'paye')) return 'paye';
  if (p.some((x) => x.statut === 'en_attente')) return 'en_attente';
  // Arrivé après cette période : il ne la doit pas.
  if (periode !== 'unique' && periode < m.depuis) return 'hors';
  return m.demandePeriode === periode ? 'demande' : 'a_payer';
}

export function suiviPeriode(c: Cotisation, periode: string) {
  const etats = c.membres.map((m) => ({ m, etat: etatMembre(m, periode) })).filter((x) => x.etat !== 'hors');
  const payes = etats.filter((x) => x.etat === 'paye');
  const recu = payes.reduce((s, x) => s + (x.m.paiements.find((p) => p.periode === periode && p.statut === 'paye')?.montant ?? 0), 0);
  // À qui demander ensuite : ceux qui n'ont encore rien reçu pour cette période.
  const aDemander = etats.filter((x) => x.etat === 'a_payer').map((x) => x.m);
  return { total: etats.length, payes: payes.length, recu, reste: (etats.length - payes.length) * c.montant, aDemander };
}

/** Ce que l'organisateur peut faire sur le groupe, à ce moment. */
export function pretADemarrer(g: Pick<Groupe, 'etat' | 'places' | 'membres' | 'paiementOuvert'>) {
  return g.etat === 'ouvert' && g.paiementOuvert && g.membres.length === g.places && g.membres.every((m) => m.cautionPayee);
}

/** L'échéance du tour en cours est passée : la caution peut couvrir un impayé. */
export function echeanceDepassee(g: Pick<Groupe, 'jour' | 'tours' | 'tourCourant'>) {
  const t = g.tours.find((x) => x.numero === g.tourCourant);
  return !!t && t.etat === 'collecte' && g.jour > t.echeance;
}

/** Le groupe accepte-t-il encore des membres ? Une rotation jusqu'au démarrage, une raison précise jusqu'à sa date de fin. */
export function accueille(g: Pick<Groupe, 'mode' | 'etat' | 'final'>) {
  return g.mode === 'objectif' ? g.etat === 'en_cours' && !g.final : g.etat === 'ouvert';
}

/** « 12/05/1990 » devient « 1990-05-12 » ; null si la date n'existe pas ou si elle n'est pas passée. */
export function lireDateNaissance(texte: string, aujourdhui: string) {
  const m = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/.exec(texte.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso || iso >= aujourdhui) return null;
  return iso;
}

/** Au moins 18 ans ce jour-là. */
export function estMajeur(iso: string, aujourdhui: string) {
  const a = Number(iso.slice(0, 4));
  return `${a + 18}${iso.slice(4)}` <= aujourdhui;
}
