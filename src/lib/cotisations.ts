/** Suivi d'une cotisation à une période donnée. Module pur, testé dans tests/cotisations.test.ts. */

import type { RythmeCotisation } from './commun/cotisations';

export type PaiementMembre = { periode: string; statut: 'paye' | 'en_attente'; mode: 'mobile' | 'main'; montant: number };
export type MembreCotisation = { id: string; nom: string; telephone: string; lien: string | null; depuis: string; demandePeriode: string | null; paiements: PaiementMembre[] };
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
