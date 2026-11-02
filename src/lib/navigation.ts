import type { Href } from 'expo-router';

import type { IconeNom } from '../components/icones';
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
  { cle: 'compte', titre: 'Mon compte', href: '/compte', chemin: '/compte', icone: 'profil', mots: 'profil mot de passe export données sécurité déconnexion apparence thème' },
];

const PAR_CLE = new Map(PAGES.map((p) => [p.cle, p]));

/** La page d'une clé (titre, adresse, icône). */
export const page = (cle: ClePage): Page => PAR_CLE.get(cle)!;

/** Raccourcis de la recherche qui ouvrent une partie d'une page. */
export const RACCOURCIS: readonly { titre: string; href: Href; mots?: string }[] = [
  { titre: 'Statistiques', href: '/bilan?onglet=tendances' as Href, mots: 'tendances graphiques' },
  { titre: 'État des lieux', href: '/bilan?onglet=conseils' as Href, mots: 'rapport recommandations conseils' },
  { titre: 'Objectifs financiers', href: '/finances?onglet=objectifs' as Href, mots: 'épargne economiser dette plan versement' },
];

/** Barre latérale : les rubriques du quotidien, puis les outils (le compte a sa place en bas de la barre). */
export const BARRE_PRINCIPAL: readonly ClePage[] = ['jour', 'copilote', 'relances', 'messages', 'taches', 'habitudes', 'finances'];
export const BARRE_OUTILS: readonly ClePage[] = ['calendrier', 'projets', 'comptes-rendus', 'categories', 'bilan', 'recompenses', 'journal', 'sources', 'equipes', 'assistant', 'notifications', 'config', 'abonnement'];

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
