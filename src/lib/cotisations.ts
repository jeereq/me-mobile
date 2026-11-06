/** Suivi d'une cotisation à une période donnée. Module pur, testé dans tests/cotisations.test.ts. */

import type { RythmeCotisation } from './commun/cotisations';
import type { Groupe } from './tontines';

export type PaiementMembre = { periode: string; statut: 'paye' | 'en_attente'; mode: 'mobile' | 'main'; montant: number };
export type MembreCotisation = { id: string; nom: string; telephone: string; email?: string; lien: string | null; depuis: string; demandePeriode: string | null; paiements: PaiementMembre[] };
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
