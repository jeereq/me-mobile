/** Suivi d'une cotisation à une période donnée. Module pur, testé dans tests/cotisations.test.ts. */

import { montantCotisation, type RythmeCotisation } from './commun/cotisations';
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

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 9 décembre », avec l'année seulement si ce n'est pas celle d'aujourd'hui. */
export function jourMois(iso: string, aujourdhui: string) {
  const jour = `${Number(iso.slice(8, 10))} ${MOIS[Number(iso.slice(5, 7)) - 1]}`;
  return iso.slice(0, 4) === aujourdhui.slice(0, 4) ? jour : `${jour} ${iso.slice(0, 4)}`;
}

export type TonSituation = 'du' | 'attente' | 'ok' | 'neutre';

/** Ce qu'il faut retenir d'un groupe : où j'en suis, ce qui se passe, et l'avancement. */
export function situationGroupe(g: Groupe, aujourdhui: string): { action: string; ton: TonSituation; detail: string; ratio: number } {
  const objectif = g.mode === 'objectif';
  const actuel = g.etat === 'en_cours' ? g.tours.find((t) => t.numero === g.tourCourant) : undefined;
  const cotises = g.membres.filter((m) => m.aCotise).length;
  const ratio = objectif ? (g.totalPrevu ? g.collecte / g.totalPrevu : 0) : g.etat === 'en_cours' ? (g.places ? cotises / g.places : 0) : g.places ? g.inscrits / g.places : 0;
  const detail = objectif
    ? `${montantCotisation(g.collecte, g.devise)} sur ${montantCotisation(g.totalPrevu, g.devise)}${g.dateFin ? `, jusqu’au ${jourMois(g.dateFin, aujourdhui)}` : ''}`
    : actuel
      ? `${actuel.pourMoi ? 'Tu reçois' : `${actuel.beneficiaire.split(' ')[0]} reçoit`} ${montantCotisation(actuel.net, g.devise)} le ${jourMois(actuel.echeance, aujourdhui)}`
      : `${g.inscrits} membre${g.inscrits > 1 ? 's' : ''} sur ${g.places}`;
  if (g.etat === 'termine') return { action: 'Terminé', ton: 'neutre', detail, ratio: 1 };
  if (g.etat === 'annule') return { action: 'Annulé', ton: 'neutre', detail, ratio: 0 };
  if (g.moi?.etat === 'demande') return { action: 'Demande envoyée', ton: 'neutre', detail, ratio };
  if (g.enAttente) return { action: 'Paiement à valider', ton: 'attente', detail, ratio };
  if (g.aPayer) return { action: `${g.aPayer.genre === 'caution' ? 'Caution de ' : ''}${montantCotisation(g.aPayer.montant, g.devise)}${g.aPayer.genre === 'caution' ? '' : ' à payer'}`, ton: 'du', detail, ratio };
  if (g.etat === 'en_cours') return { action: 'Tu es à jour', ton: 'ok', detail, ratio };
  const libres = Math.max(0, g.places - g.inscrits);
  return { action: libres ? `${libres} place${libres > 1 ? 's' : ''} à remplir` : 'Prêt à démarrer', ton: 'neutre', detail, ratio };
}

/** En tête de liste : le total à payer, et le prochain versement que je reçois. */
export function resumeGroupes(groupes: Groupe[]) {
  const totaux = new Map<string, number>();
  for (const g of groupes) if (g.aPayer && !g.enAttente && g.etat !== 'termine' && g.etat !== 'annule') totaux.set(g.devise, (totaux.get(g.devise) ?? 0) + g.aPayer.montant);
  const tours = groupes
    .filter((g) => g.etat === 'en_cours' && g.mode !== 'objectif')
    .flatMap((g) => g.tours.filter((t) => t.pourMoi && (t.etat === 'a_venir' || t.etat === 'collecte')).map((t) => ({ nom: g.nom, net: t.net, devise: g.devise, echeance: t.echeance })))
    .sort((a, b) => a.echeance.localeCompare(b.echeance));
  return { dus: [...totaux].map(([devise, total]) => montantCotisation(total, devise)), prochain: tours[0] ?? null };
}

/** Combien de temps dure un groupe chacun son tour : un tour par membre. */
export function dureeGroupe(g: Pick<Groupe, 'mode' | 'rythme' | 'places'>) {
  if (g.mode === 'objectif') return null;
  const unite = g.rythme === 'quotidien' ? 'jour' : g.rythme === 'hebdomadaire' ? 'semaine' : g.rythme === 'mensuel' ? 'mois' : null;
  if (!unite) return null;
  return `${g.places} ${unite}${g.places > 1 && unite !== 'mois' ? 's' : ''}`;
}

