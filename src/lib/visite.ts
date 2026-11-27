import { useSyncExternalStore } from 'react';

export { etapesVisite, ORDRE_VISITE, type EtapeVisite } from './guide-pages';
import type { ClePage } from './navigation';

/**
 * La visite guidée : une suite d'étapes qui ouvre chaque page affichée et en montre, en quelques points, les gestes principaux.
 * L'étape en cours vit en mémoire (null : pas de visite) ; qu'elle soit terminée ou passée est gardé dans l'espace.
 */
let etape: number | null = null;
/** Une visite lancée depuis une page commence à cette page (la carte retrouve son étape). */
let depart: ClePage | null = null;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

export const visite = {
  demarrer(cle?: ClePage) {
    etape = 0;
    depart = cle ?? null;
    prevenir();
  },
  aller(n: number) {
    etape = n;
    prevenir();
  },
  arreter() {
    etape = null;
    depart = null;
    prevenir();
  },
  /** La page où la visite doit commencer, une seule fois. */
  departDemande() {
    const d = depart;
    depart = null;
    return d;
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

/** Les pages que la visite montre, dans l'ordre. Ce qu'elle dit de chacune vient du guide (`guide-pages.ts`). Une page masquée est sautée. */
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
