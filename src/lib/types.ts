import type { ThemeNom } from './theme';
import type { Origine, Taux } from './devises';
import type { ModeConfig } from './modes';

export type Mode = 'passif' | 'normal' | 'agressif' | 'coach' | 'hebdo';
export type Boite = 'perso' | 'pro';
export type Frequence = 'quotidien' | 'hebdo' | 'mensuel';
export type Priorite = 'haute' | 'moyenne' | 'basse';

export const MODE_LABELS: Record<Mode, string> = {
  passif: 'Passif',
  normal: 'Normal',
  agressif: 'Agressif',
  coach: 'Coach',
  hebdo: 'Bilan hebdo',
};
export const MODES = Object.keys(MODE_LABELS) as Mode[];

export type Relance = {
  id: string;
  contact: string;
  sujet: string;
  boite: Boite;
  date: string;
  statut: 'a_faire' | 'relance' | 'repondu';
  /** Jour où la réponse a été obtenue (mission du jour, points). */
  reponduLe?: string | null;
  mode: Mode;
  creeLe: string;
  /** Importée d'un compte connecté : source et lien vers l'original. */
  ext?: SourceKey;
  lien?: string;
  /** Catégories de l'utilisateur (voir `categories.ts`) : une ou plusieurs. */
  categories?: string[];
};

export type Tache = {
  id: string;
  titre: string;
  source: Boite | 'manuel';
  priorite: Priorite;
  echeance: string | null;
  statut: 'en_attente' | 'fait';
  faitLe?: string | null;
  mode: Mode;
  creeLe: string;
  ext?: SourceKey;
  lien?: string;
  categories?: string[];
  /** Projet auquel appartient la tâche (voir `planning.ts`). Les champs ci-dessous ne servent qu'aux tâches de projet. */
  projet?: string;
  /** Tâche parente : celle-ci en est une sous-tâche. Une tâche qui a des sous-tâches est un « résumé » : ses dates et son avancement viennent d'elles. */
  parent?: string;
  /** Tâches qui doivent être finies avant que celle-ci commence (lien « fin → début »). */
  apres?: string[];
  /** Jours d'attente après la fin des tâches précédentes (jours ouvrés si le projet les utilise). */
  delai?: number;
  /** Premier jour du travail. Les dates d'une tâche non figée sont recalculées par le planning. */
  debut?: string | null;
  /** Durée en jours (jours ouvrés si le projet les utilise) ; 0 = jalon. */
  duree?: number;
  /** Dates imposées (saisies à la main ou lues dans le fichier) : le planning ne les déplace pas. */
  fixe?: boolean;
  /** Part déjà faite, de 0 à 100. */
  avancement?: number;
  jalon?: boolean;
  responsable?: string;
  note?: string;
  /** Rang dans le projet, pour garder l'ordre du fichier. */
  ordre?: number;
  /** Repère de la ligne d'origine dans le fichier importé : sert à mettre le projet à jour sans le dupliquer. */
  ref?: string;
};

export type Habitude = {
  id: string;
  nom: string;
  categorie: 'finance' | 'perso';
  frequence: Frequence;
  /** hebdo : jour de la semaine (0 = dimanche) ; mensuel : jour du mois */
  jour: number | null;
  mode: Mode;
  coches: string[];
  ordre: number;
  categories?: string[];
};

export type Contact = { id: string; nom: string; organisation: string; dernierEchange: string };
export type JournalJour = { date: string; entrees: { h: string; texte: string }[] };
export type Evenement = { id?: string; debut: string; fin?: string; titre: string; lieu?: string; source?: string; calendrier?: Boite; lien?: string };

export type SourceKey = 'google_agenda' | 'gmail' | 'outlook' | 'trello' | 'slack' | 'notion' | 'asana' | 'todoist';
export type ImportKind = 'agenda' | 'taches' | 'relances';
export type SourcePrefs = { actif: boolean; imports: ImportKind[]; ctx: Boite; couleur: string; filtre: string };
export type SourceAutre = { id: string; nom: string; note: string; ctx: Boite };

export type Ton = 'neutre' | 'motivant' | 'direct' | 'coach';
export type AudioPrefs = {
  voix: string;
  vitesse: number;
  hauteur: number;
  ton: Ton;
  sections: ('agenda' | 'relances' | 'taches' | 'habitudes')[];
  lireReponses: boolean;
};

export type Espace = {
  relances: Relance[];
  taches: Tache[];
  habitudes: Habitude[];
  contacts: Contact[];
  journal: Record<string, JournalJour>;
  agenda: Record<string, Evenement[]>;
  sources: Partial<Record<SourceKey, SourcePrefs>>;
  sourcesAutres: SourceAutre[];
  audio: AudioPrefs;
  /** Couleurs choisies par l'utilisateur ; vide = celles de la configuration système. */
  apparence?: { theme?: ThemeNom; accent?: string };
  /** Canaux de rappel envoyés par le serveur : centre de notifications de l'app et email. */
  notifs?: { app?: boolean; email?: boolean; recompenses?: boolean };
  /** Sons de l'app (case cochée, rappel reçu) ; actifs sauf si false. */
  sons?: boolean;
  /** Système de récompenses : points gagnés, badges, jokers de série. */
  jeu?: Jeu;
  /** Budgets par période et dépenses. */
  finances?: Finances;
  /** Catégories de l'utilisateur, communes aux dépenses, budgets, tâches, relances, habitudes et projets. */
  categories?: Categorie[];
  /** Projets : un plan de tâches, sous-tâches et liens, avec son planning. */
  projets?: Projet[];
  /** Carte « Premiers pas » de l'accueil, masquée par l'utilisateur. */
  premiersPas?: { masque?: boolean };
  /** Identifiants des éléments importés déjà vus : ce que tu supprimes ne revient pas. */
  importsVus?: string[];
  majLe: string;
};

/** Une catégorie choisie par l'utilisateur. Un même élément peut en porter plusieurs. */
export type Categorie = {
  id: string;
  nom: string;
  emoji: string;
  /** Couleur #RRGGBB, choisie dans la palette de `categories.ts`. */
  couleur: string;
  /** Mots du libellé qui rangent une opération dans cette catégorie à l'import (« uber, bolt »). */
  mots?: string[];
};

/** Un projet : ses tâches portent `projet: id`. */
export type Projet = {
  id: string;
  nom: string;
  emoji: string;
  couleur?: string;
  /** Jour de départ du planning ; sans lui, le plus tôt des dates imposées, sinon aujourd'hui. */
  debut: string | null;
  /** Le planning saute le samedi et le dimanche (oui par défaut). */
  joursOuvres: boolean;
  categories?: string[];
  note?: string;
  /** D'où vient le plan (fichier Excel, tableau collé) et quand ; sert à proposer la mise à jour. */
  source?: { type: 'excel' | 'csv' | 'colle'; fichier?: string; le: string };
  creeLe: string;
  archive?: boolean;
};

export type Periode = 'jour' | 'semaine' | 'mois' | 'trimestre' | 'annee';
/** Un plafond de dépenses pour une période ; « global » couvre toutes les dépenses, sinon seulement celles rangées dans ce budget. */
export type Budget = { id: string; nom: string; emoji: string; montant: number; periode: Periode; global?: boolean; /** Catégories que ce budget suit : une dépense classée dans l'une d'elles y compte, si elle n'a pas de budget choisi à la main. */ categories?: string[] };
export type Depense = { id: string; montant: number; /** Compte bancaire d'où vient l'opération ; absent = pas encore rattachée à un compte. */ compte?: string; /** Identifiant partagé avec l'autre moitié d'un virement entre deux de mes comptes : ni dépense ni revenu. */ lien?: string; /** Clé de l'opération dans le relevé bancaire d'où elle vient : sert à ne pas l'importer deux fois. */ reference?: string; /** Saisie dans une autre devise que la principale : `montant` est alors la valeur convertie. */ origine?: Origine; budget: string | null; /** Une ou plusieurs catégories. */ categories?: string[]; note: string; date: string; creeLe: string; /** Créée par un paiement récurrent. */ recurrence?: string };
export type Revenu = { id: string; montant: number; compte?: string; lien?: string; reference?: string; origine?: Origine; categories?: string[]; note: string; date: string; creeLe: string; recurrence?: string };
/** Un compte bancaire (ou portefeuille mobile, caisse…) : les opérations importées d'un relevé lui sont rattachées. */
export type Compte = {
  id: string;
  /** Nom clair, choisi par l'utilisateur : « Equity – dollars », « M-Pesa », « Cash ». */
  nom: string;
  emoji: string;
  /** Banque ou service, pour s'y retrouver quand deux comptes portent le même nom. */
  banque?: string;
  /** Devise habituelle du relevé de ce compte : proposée à l'import. */
  devise?: string;
  /** Dernier solde lu dans un relevé (colonne « Solde »). */
  solde?: { montant: number; date: string; devise: string };
};
/** Dépense ou revenu qui revient (loyer, abonnement, salaire) : chaque échéance passée est ajoutée à l'ouverture de l'app. */
export type Recurrence = {
  id: string;
  genre: 'depense' | 'revenu';
  montant: number;
  /** Devise d'origine si différente de la principale ; `montant` a été converti à la création. */
  origine?: Origine;
  note: string;
  budget: string | null;
  categories?: string[];
  frequence: 'semaine' | 'mois' | 'annee';
  /** Première échéance ; les suivantes tombent le même jour de la semaine, du mois (ou le dernier jour du mois) ou de l'année. */
  debut: string;
  /** Dernière échéance déjà ajoutée. */
  derniere: string | null;
};
export type Horizon = Periode;
export type Finances = {
  /** Devise principale : budgets, totaux, prévisions et alertes. */
  devise: string;
  /** Taux vers la devise principale, par devise (1 unité = x unités principales). */
  taux?: Taux;
  budgets: Budget[];
  depenses: Depense[];
  revenus?: Revenu[];
  /** Comptes bancaires, du plus ancien au plus récent. */
  comptes?: Compte[];
  /** Virements possibles que l'utilisateur a écartés (« sortie|entrée »), pour ne pas les reproposer. */
  liensIgnores?: string[];
  recurrences?: Recurrence[];
  alertes?: AlertesFinances;
};
/** Alertes de prévision envoyées par le serveur ; chaque réglage absent prend sa valeur par défaut. */
export type AlertesFinances = {
  /** Horizons surveillés (tous par défaut). */
  horizons?: Partial<Record<Horizon, boolean>>;
  /** Alerte quand la prévision atteint cette part du budget : 0,8, 0,9 ou 1 (défaut). */
  seuil?: number;
  /** Heure de l'alerte, « HH:MM » (défaut : l'heure du rappel du soir). */
  heure?: string;
  /** Budget du jour dans le briefing du matin (oui par défaut). */
  matin?: boolean;
  /** Canaux : notification push et email (oui par défaut, selon les réglages de Mon compte). */
  push?: boolean;
  email?: boolean;
};

export type TypeGain = 'habitude' | 'relance' | 'tache' | 'journal' | 'bonus';
/** Un gain de points, rangé sous une clé unique (élément + période) : décocher le retire, recocher ne le double pas. */
export type Gain = { d: string; p: number; t: TypeGain; h?: string };
export type Jeu = {
  gains: Record<string, Gain>;
  /** Gains de plus de 120 jours, résumés pour garder l'espace léger. */
  archive?: { xp: number; comptes: Partial<Record<TypeGain, number>> };
  /** Badge -> jour d'obtention. */
  badges: Record<string, string>;
  /** Jokers en réserve : chacun sauve la série un jour manqué. */
  jokers: number;
  /** Jours sauvés par un joker, et séries de 7 jours déjà récompensées par un joker. */
  joursSauves: string[];
  jokersGagnes: string[];
  /** Présentation des récompenses déjà vue. */
  intro?: boolean;
};

export type HabitudeModele = Omit<Habitude, 'coches'>;

export type Config = {
  routineHeure: string;
  rappelSoir: string;
  delaiRelanceJours: number;
  agressifJMoins: number;
  /** Pour chaque mode : actif, description libre, et les règles de rappel (voir `modes.ts`) ; une règle absente prend la valeur d'origine. */
  modes: Record<Mode, ModeConfig & { actif: boolean; desc: string }>;
  canaux: { notification: boolean; mail: boolean; agenda: boolean };
  defauts: { relance: Mode; tache: Mode; facture: Mode; finance: Mode; perso: Mode };
  sourcesAutorisees: Record<SourceKey, boolean>;
  assistant: { actif: boolean; ia: boolean; ton: Ton; /** Modèle OpenAI choisi par l'admin ; vide = celui du serveur. */ modele: string };
  habitudesModeles: HabitudeModele[];
  /** Thème et couleur d'accent par défaut de tous les comptes. */
  theme: { nom: ThemeNom; accent: string };
};
