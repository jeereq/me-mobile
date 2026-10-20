import type { ThemeNom } from './theme';

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
  /** Identifiants des éléments importés déjà vus : ce que tu supprimes ne revient pas. */
  importsVus?: string[];
  majLe: string;
};

export type Periode = 'semaine' | 'mois' | 'trimestre' | 'annee';
/** Un plafond de dépenses pour une période ; « global » couvre toutes les dépenses, sinon seulement celles rangées dans ce budget. */
export type Budget = { id: string; nom: string; emoji: string; montant: number; periode: Periode; global?: boolean };
export type Depense = { id: string; montant: number; budget: string | null; note: string; date: string; creeLe: string };
export type Finances = { devise: string; budgets: Budget[]; depenses: Depense[] };

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
  modes: Record<Mode, { actif: boolean; desc: string }>;
  canaux: { notification: boolean; mail: boolean; agenda: boolean };
  defauts: { relance: Mode; tache: Mode; facture: Mode; finance: Mode; perso: Mode };
  sourcesAutorisees: Record<SourceKey, boolean>;
  assistant: { actif: boolean; ia: boolean; ton: Ton; /** Modèle OpenAI choisi par l'admin ; vide = celui du serveur. */ modele: string };
  habitudesModeles: HabitudeModele[];
  /** Thème et couleur d'accent par défaut de tous les comptes. */
  theme: { nom: ThemeNom; accent: string };
};
