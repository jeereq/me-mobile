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
  mode: Mode;
  creeLe: string;
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
export type Evenement = { debut: string; fin?: string; titre: string; lieu?: string; source?: string; calendrier?: Boite };

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
  majLe: string;
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
};
