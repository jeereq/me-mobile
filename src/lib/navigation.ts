import type { Href } from 'expo-router';

import type { IconeNom } from '../components/icones';
import { estPro, type EtatAbonnement } from './abonnement';
import { addDays, doneIn, habitToday } from './dates';
import { tachesUrgentes } from './planning';
import { relanceAttendue } from './suivi';
import type { Espace } from './types';

/**
 * Les pages de l'app, en un seul endroit : la barre latérale de l'ordinateur, l'écran Plus et la recherche (Ctrl+K)
 * lisent cette liste. Une page ajoutée ici apparaît partout ; un test vérifie que chaque page a son fichier dans `app/`.
 * Seuls les onglets du téléphone gardent leurs propres libellés (« À faire », « Accueil »), mais leurs nombres viennent
 * aussi d'ici (`compteursDuJour`).
 */

export type ClePage =
  | 'jour'
  | 'copilote'
  | 'relances'
  | 'messages'
  | 'taches'
  | 'habitudes'
  | 'finances'
  | 'calendrier'
  | 'projets'
  | 'comptes-rendus'
  | 'categories'
  | 'bilan'
  | 'recompenses'
  | 'journal'
  | 'sources'
  | 'equipes'
  | 'assistant'
  | 'notifications'
  | 'config'
  | 'utilisateurs'
  | 'abonnement'
  | 'compte';

export type Page = {
  cle: ClePage;
  titre: string;
  href: Href;
  /** Début du chemin qui rend l'entrée active dans la barre latérale. */
  chemin: string;
  icone: IconeNom;
  /** Mots en plus du titre pour la recherche. */
  mots?: string;
};

export const PAGES: readonly Page[] = [
  { cle: 'jour', titre: "Aujourd'hui", href: '/', chemin: '/', icone: 'jour', mots: 'accueil mission jour' },
  { cle: 'copilote', titre: 'Mon copilote', href: '/copilote' as Href, chemin: '/copilote', icone: 'copilote', mots: 'ia assistant planifier analyse réponses' },
  { cle: 'relances', titre: 'Relances', href: '/relances', chemin: '/relances', icone: 'relances' },
  { cle: 'messages', titre: 'Mails', href: '/messages', chemin: '/messages', icone: 'mail', mots: 'gmail outlook boîte fils discussions messages courriels non lus' },
  { cle: 'taches', titre: 'Tâches', href: '/taches', chemin: '/taches', icone: 'taches' },
  { cle: 'habitudes', titre: 'Habitudes', href: '/habitudes', chemin: '/habitudes', icone: 'habitudes', mots: 'routines séries' },
  { cle: 'finances', titre: 'Finances', href: '/finances', chemin: '/finances', icone: 'portefeuille', mots: 'budget dépenses argent revenus' },
  { cle: 'calendrier', titre: 'Calendrier', href: '/calendrier', chemin: '/calendrier', icone: 'calendrier', mots: 'agenda planning semaine mois jour échéances dates' },
  { cle: 'projets', titre: 'Projets', href: '/projets', chemin: '/projets', icone: 'projets', mots: 'plan planning gantt excel import sous-tâches' },
  { cle: 'comptes-rendus', titre: 'Comptes rendus', href: '/comptes-rendus' as Href, chemin: '/comptes-rendus', icone: 'compteRendu', mots: 'réunion appel point notes décisions actions cr minutes' },
  { cle: 'categories', titre: 'Catégories', href: '/categories', chemin: '/categories', icone: 'etiquette', mots: 'étiquettes classer tags' },
  { cle: 'bilan', titre: 'Bilan', href: '/bilan' as Href, chemin: '/bilan', icone: 'stats', mots: 'tendances graphiques statistiques conseils recommandations rapport résumé tableau de bord' },
  { cle: 'recompenses', titre: 'Récompenses', href: '/recompenses', chemin: '/recompenses', icone: 'trophee', mots: 'points badges niveau série' },
  { cle: 'journal', titre: 'Journal & contacts', href: '/journal', chemin: '/journal', icone: 'livre', mots: 'historique contacts' },
  { cle: 'sources', titre: 'Agendas & outils', href: '/sources', chemin: '/sources', icone: 'agenda', mots: 'google outlook gmail trello slack notion connecter agendas calendriers synchroniser' },
  { cle: 'equipes', titre: 'Équipes', href: '/equipes', chemin: '/equipes', icone: 'equipe', mots: 'partager membres inviter espace partagé' },
  { cle: 'assistant', titre: 'Assistant audio', href: '/assistant', chemin: '/assistant', icone: 'onde', mots: 'voix briefing ia' },
  { cle: 'notifications', titre: 'Notifications', href: '/notifications', chemin: '/notifications', icone: 'cloche', mots: 'rappels' },
  { cle: 'config', titre: 'Configuration', href: '/config', chemin: '/config', icone: 'reglages', mots: 'réglages admin' },
  { cle: 'abonnement', titre: 'Abonnement', href: '/abonnement', chemin: '/abonnement', icone: 'trophee', mots: 'pro finances formule offre essai payer prix' },
  { cle: 'utilisateurs', titre: 'Utilisateurs', href: '/utilisateurs' as Href, chemin: '/utilisateurs', icone: 'equipe', mots: 'admin comptes clients abonnés abonnements membres paiements offrir' },
  { cle: 'compte', titre: 'Mon compte', href: '/compte', chemin: '/compte', icone: 'profil', mots: 'profil mot de passe export données sécurité déconnexion apparence thème barre latérale menu masquer pages' },
];

const PAR_CLE = new Map(PAGES.map((p) => [p.cle, p]));

/** La page d'une clé (titre, adresse, icône). */
export const page = (cle: ClePage): Page => PAR_CLE.get(cle)!;

/** Raccourcis de la recherche qui ouvrent une partie d'une page. */
export const RACCOURCIS: readonly { titre: string; href: Href; mots?: string }[] = [
  { titre: 'Statistiques', href: '/bilan?onglet=tendances' as Href, mots: 'tendances graphiques' },
  { titre: 'État des lieux', href: '/bilan?onglet=conseils' as Href, mots: 'rapport recommandations conseils' },
  { titre: 'Objectifs financiers', href: '/finances?onglet=objectifs' as Href, mots: 'épargne economiser dette plan versement' },
  { titre: 'Cotisations', href: '/finances?onglet=cotisations' as Href, mots: 'tontine likelemba groupes cagnotte' },
  { titre: 'Annuaire', href: '/annuaire' as Href, mots: 'tontines groupes cotisations rejoindre' },
];

/** Barre latérale : les rubriques du quotidien, puis les outils (le compte a sa place en bas de la barre). */
export const BARRE_PRINCIPAL: readonly ClePage[] = ['jour', 'copilote', 'relances', 'messages', 'taches', 'habitudes', 'finances'];
export const BARRE_OUTILS: readonly ClePage[] = ['calendrier', 'projets', 'comptes-rendus', 'categories', 'bilan', 'recompenses', 'journal', 'sources', 'equipes', 'assistant', 'notifications', 'config', 'utilisateurs', 'abonnement'];

/**
 * Pages que l'on ne peut pas masquer : l'accueil (le logo y ramène) et le compte (sa place fixe en bas de la barre,
 * où se trouve le réglage pour réafficher les autres). Toutes les autres se masquent depuis Mon compte > Préférences.
 */
const FIXES: readonly ClePage[] = ['jour', 'compte'];
export const masquable = (cle: ClePage): boolean => !FIXES.includes(cle);

/** Les pages masquées par l'utilisateur, sans les clés inconnues ni celles qui ne se masquent pas. */
export function pagesMasquees(e: Pick<Espace, 'barre'>): Set<ClePage> {
  const connues = new Set<string>(PAGES.map((p) => p.cle));
  return new Set((e.barre?.masquees ?? []).filter((c): c is ClePage => connues.has(c) && masquable(c as ClePage)));
}

/** Affiche ou masque une page ; renvoie la nouvelle liste (vide = tout est affiché). */
export function basculerPage(e: Pick<Espace, 'barre'>, cle: ClePage, visible: boolean): ClePage[] {
  const m = pagesMasquees(e);
  if (visible || !masquable(cle)) m.delete(cle);
  else m.add(cle);
  return PAGES.map((p) => p.cle).filter((c) => m.has(c));
}

/** Pages qui servent surtout avec Pro (copilote IA, boîtes mail et agendas connectés, équipes). */
export const PAGES_PRO: readonly ClePage[] = ['copilote', 'messages', 'sources', 'equipes'];

/**
 * Le choix proposé à la première connexion, selon la formule : tout avec Pro (ou l'essai, ou sans abonnements) ;
 * sans Pro, les pages Pro sont décochées d'avance (on peut les recocher : elles montrent alors l'offre).
 */
export const masqueesParDefaut = (ab: EtatAbonnement | null | undefined): ClePage[] => (estPro(ab) ? [] : [...PAGES_PRO]);

/**
 * Proposer de choisir ses pages : à la première connexion seulement, c'est-à-dire dans son propre espace,
 * pas encore choisi et encore vide (un compte qui a déjà des tâches, relances, projets ou dépenses n'est pas dérangé).
 */
export function doitChoisirPages(e: Espace, dansUneEquipe: boolean): boolean {
  if (dansUneEquipe || e.barre?.choisi || e.barre?.masquees?.length) return false;
  return !e.taches.length && !e.relances.length && !(e.projets ?? []).length && !(e.finances?.depenses ?? []).length;
}

export type Compteurs = { relances: number; taches: number; habitudes: number };

/**
 * Les nombres des badges, les mêmes sur le téléphone (onglets, Plus) et sur l'ordinateur (barre latérale) :
 * relances dont le jour est venu, tâches urgentes (échéance d'ici deux jours) et habitudes encore à cocher aujourd'hui.
 */
export function compteursDuJour(e: Espace, d: string): Compteurs {
  return {
    relances: e.relances.filter((r) => relanceAttendue(r) && r.date <= d).length,
    taches: tachesUrgentes(e, d, addDays(d, 2)).length,
    habitudes: e.habitudes.filter((h) => habitToday(h, d) && !doneIn(h, d)).length,
  };
}

/**
 * Ce que fait le bouton + selon l'écran : ajout rapide à l'accueil, un mail sur Mails, une tâche ou une relance sur À faire, une
 * habitude sur Habitudes, une dépense ailleurs. `n` change à chaque appui pour rouvrir la fenêtre.
 */
export function ajoutDeVue(chemin: string, vue?: string, n: number = Date.now()): { label: string; href: string; depense?: boolean; mail?: boolean; couleur: string } {
  if (chemin === '/') return { label: 'Ajouter une tâche, une relance ou une habitude', href: `/?ajout=${n}`, couleur: '/' };
  if (chemin === '/messages') return { label: 'Nouveau mail', href: `/messages?ecrire=${n}`, mail: true, couleur: '/messages' };
  if (chemin === '/taches') return vue === 'relances' ? { label: 'Ajouter une relance', href: `/taches?vue=relances&ajout=${n}`, couleur: '/relances' } : { label: 'Ajouter une tâche', href: `/taches?ajout=${n}`, couleur: '/taches' };
  if (chemin === '/habitudes') return { label: 'Ajouter une habitude', href: `/habitudes?ajout=${n}`, couleur: '/habitudes' };
  return { label: 'Ajouter une dépense', href: `/finances?ajout=${n}`, depense: true, couleur: '/finances' };
}
