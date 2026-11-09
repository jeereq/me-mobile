import { useSyncExternalStore } from 'react';

import type { ClePage } from './navigation';

/**
 * La visite guidée : une suite d'étapes qui ouvre chaque page affichée et dit en deux phrases à quoi elle sert.
 * L'étape en cours vit en mémoire (null : pas de visite) ; qu'elle soit terminée ou passée est gardé dans l'espace.
 */
let etape: number | null = null;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

export const visite = {
  demarrer() {
    etape = 0;
    prevenir();
  },
  aller(n: number) {
    etape = n;
    prevenir();
  },
  arreter() {
    etape = null;
    prevenir();
  },
};

export const useEtapeVisite = () =>
  useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => etape,
    () => etape,
  );

/** Ce que la visite dit de chaque page, dans l'ordre où elle les montre. Une page masquée est sautée. */
export const ETAPES_VISITE: readonly { cle: ClePage; texte: string }[] = [
  { cle: 'jour', texte: 'Ta mission du jour : rendez-vous, relances, tâches et habitudes au même endroit. Le bouton + ajoute en un geste.' },
  { cle: 'copilote', texte: 'Demande-lui de planifier ta journée, de résumer tes mails ou de préparer une réponse.' },
  { cle: 'relances', texte: 'Les personnes à relancer. Me te le rappelle le bon jour.' },
  { cle: 'messages', texte: 'Tes boîtes Gmail et Outlook, triées : ce qui attend une réponse d’abord.' },
  { cle: 'taches', texte: 'Tout ce qu’il y a à faire, rangé par priorité et par échéance.' },
  { cle: 'habitudes', texte: 'Coche tes routines chaque jour et garde ta série.' },
  { cle: 'finances', texte: 'Budgets, dépenses, objectifs, prêts et cotisations. Un rapport arrive chaque soir.' },
  { cle: 'calendrier', texte: 'Tes rendez-vous et échéances, au jour, à la semaine ou au mois.' },
  { cle: 'projets', texte: 'Un projet découpé en tâches, avec son planning.' },
  { cle: 'compte', texte: 'Ton profil, tes notifications et les pages affichées. La visite se relance d’ici.' },
];

/** Une ligne pour chaque page, au choix des pages à afficher. */
export const DESCRIPTION_PAGE: Partial<Record<ClePage, string>> = {
  copilote: 'L’IA qui planifie et répond',
  relances: 'Qui relancer, et quand',
  messages: 'Gmail et Outlook, triés',
  taches: 'Tout ce qu’il y a à faire',
  habitudes: 'Tes routines du jour',
  finances: 'Budgets, dépenses, cotisations',
  calendrier: 'Rendez-vous et échéances',
  projets: 'Tâches et planning',
  'comptes-rendus': 'Réunions, décisions, actions',
  categories: 'Ranger par étiquette',
  bilan: 'Tendances et conseils',
  recompenses: 'Points, niveaux, séries',
  journal: 'Échanges et contacts',
  sources: 'Agendas et outils connectés',
  equipes: 'Un espace partagé',
  assistant: 'Ton briefing à écouter',
  notifications: 'Rappels et alertes',
  config: 'Réglages de l’app',
  utilisateurs: 'Comptes et abonnés',
  versements: 'Cagnottes à verser',
  abonnement: 'Ta formule',
};

/** Des sélections toutes faites : les pages affichées (le reste est masqué). `null` : tout ; « formule » : le choix conseillé pour la formule. */
export const PROFILS_PAGES: readonly { cle: string; titre: string; pages: readonly ClePage[] | null | 'formule' }[] = [
  { cle: 'conseille', titre: 'Conseillé', pages: 'formule' },
  { cle: 'essentiel', titre: 'L’essentiel', pages: ['relances', 'taches', 'habitudes', 'finances', 'calendrier', 'notifications'] },
  { cle: 'argent', titre: 'Mon argent', pages: ['finances', 'bilan', 'categories', 'notifications'] },
  { cle: 'travail', titre: 'Mon travail', pages: ['copilote', 'relances', 'messages', 'taches', 'calendrier', 'projets', 'comptes-rendus', 'journal', 'sources', 'equipes', 'notifications'] },
  { cle: 'tout', titre: 'Tout', pages: null },
];
