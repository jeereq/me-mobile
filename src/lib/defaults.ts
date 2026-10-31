import type { Config, Espace, HabitudeModele, ImportKind, SourceKey } from './types';

export const HABITUDES_MODELES: HabitudeModele[] = [
  { id: 'loyer', nom: 'Payer le loyer', categorie: 'finance', frequence: 'mensuel', jour: 1, mode: 'agressif', ordre: 1 },
  { id: 'electricite', nom: "Payer l'électricité", categorie: 'finance', frequence: 'mensuel', jour: 10, mode: 'agressif', ordre: 2 },
  { id: 'internet-tel', nom: 'Payer internet et téléphone', categorie: 'finance', frequence: 'mensuel', jour: 10, mode: 'agressif', ordre: 3 },
  { id: 'epargne', nom: "Virement d'épargne", categorie: 'finance', frequence: 'mensuel', jour: 2, mode: 'normal', ordre: 4 },
  { id: 'depenses', nom: 'Faire le point sur les dépenses de la semaine', categorie: 'finance', frequence: 'hebdo', jour: 0, mode: 'normal', ordre: 5 },
  { id: 'budget', nom: 'Revue du budget du mois', categorie: 'finance', frequence: 'mensuel', jour: 28, mode: 'normal', ordre: 6 },
  { id: 'abonnements', nom: 'Vérifier les abonnements', categorie: 'finance', frequence: 'mensuel', jour: 15, mode: 'normal', ordre: 7 },
  { id: 'argent-prete', nom: "Suivre l'argent prêté ou à récupérer", categorie: 'finance', frequence: 'hebdo', jour: 5, mode: 'normal', ordre: 8 },
  { id: 'sport', nom: 'Sport', categorie: 'perso', frequence: 'quotidien', jour: null, mode: 'coach', ordre: 1 },
  { id: 'sommeil', nom: 'Au lit avant 23 h', categorie: 'perso', frequence: 'quotidien', jour: null, mode: 'coach', ordre: 2 },
  { id: 'lecture', nom: 'Lecture (20 min)', categorie: 'perso', frequence: 'quotidien', jour: null, mode: 'coach', ordre: 3 },
  { id: 'famille', nom: 'Appeler la famille', categorie: 'perso', frequence: 'hebdo', jour: 0, mode: 'coach', ordre: 4 },
  { id: 'sante', nom: 'Vérifier mes rendez-vous santé', categorie: 'perso', frequence: 'mensuel', jour: 1, mode: 'normal', ordre: 5 },
  { id: 'apprentissage', nom: 'Apprentissage (cours, formation)', categorie: 'perso', frequence: 'hebdo', jour: 3, mode: 'coach', ordre: 6 },
];

export const DEFAULT_CONFIG: Config = {
  routineHeure: '07:00',
  rappelSoir: '19:00',
  delaiRelanceJours: 3,
  agressifJMoins: 3,
  modes: {
    passif: { actif: true, desc: 'Visible seulement dans Me et dans le briefing du matin.' },
    normal: { actif: true, desc: 'Une notification le jour J.' },
    agressif: { actif: true, desc: "Notifications à l'avance, matin et soir du jour J, puis chaque jour tant que ce n'est pas coché." },
    coach: { actif: true, desc: 'Un encouragement quotidien avec ta série.' },
    hebdo: { actif: true, desc: 'Rien en semaine, un récap le dimanche soir.' },
  },
  canaux: { notification: true, mail: false, agenda: false },
  defauts: { relance: 'normal', tache: 'normal', facture: 'agressif', finance: 'normal', perso: 'coach' },
  sourcesAutorisees: { google_agenda: true, google_taches: true, gmail: true, outlook: true, trello: true, slack: true, notion: true, asana: true, todoist: true },
  assistant: { actif: true, ia: true, ton: 'motivant', modele: '', modeleFort: '' },
  habitudesModeles: HABITUDES_MODELES,
  theme: { nom: 'jarvis', accent: '' },
};

export function nouvelEspace(config: Config): Espace {
  return {
    relances: [],
    taches: [],
    habitudes: config.habitudesModeles.map((m) => ({ ...m, coches: [] })),
    contacts: [],
    journal: {},
    agenda: {},
    sources: {},
    sourcesAutres: [],
    audio: { voix: '', vitesse: 1, hauteur: 1, ton: config.assistant.ton, sections: ['agenda', 'relances', 'taches', 'habitudes'], lireReponses: true },
    majLe: new Date().toISOString(),
  };
}

export const SOURCE_DEFS: Record<SourceKey, { nom: string; lettre: string; ctx: 'perso' | 'pro'; imports: ImportKind[]; filtre: string; couleur: string }> = {
  google_agenda: { nom: 'Google Agenda', lettre: 'G', ctx: 'perso', imports: ['agenda'], filtre: 'Agendas à inclure', couleur: 'coach' },
  google_taches: { nom: 'Google Tasks', lettre: 'T', ctx: 'perso', imports: ['taches'], filtre: 'Listes à suivre', couleur: 'coach' },
  gmail: { nom: 'Gmail', lettre: 'M', ctx: 'perso', imports: ['taches', 'relances', 'mails'], filtre: 'Libellés à surveiller', couleur: 'agressif' },
  outlook: { nom: 'Outlook · Microsoft 365', lettre: 'O', ctx: 'pro', imports: ['agenda', 'taches', 'relances', 'mails'], filtre: 'Agendas ou dossiers', couleur: 'normal' },
  trello: { nom: 'Trello', lettre: 'T', ctx: 'pro', imports: ['taches', 'agenda'], filtre: 'Tableaux à suivre', couleur: 'normal' },
  slack: { nom: 'Slack', lettre: 'S', ctx: 'pro', imports: ['taches', 'relances'], filtre: 'Canaux à suivre', couleur: 'hebdo' },
  notion: { nom: 'Notion', lettre: 'N', ctx: 'pro', imports: ['taches', 'agenda'], filtre: 'Bases à suivre', couleur: 'passif' },
  asana: { nom: 'Asana', lettre: 'A', ctx: 'pro', imports: ['taches'], filtre: 'Projets à suivre', couleur: 'agressif' },
  todoist: { nom: 'Todoist', lettre: '✓', ctx: 'perso', imports: ['taches'], filtre: 'Projets à suivre', couleur: 'agressif' },
};
export const IMPORT_LABELS: Record<ImportKind, string> = { agenda: 'Agenda', taches: 'Tâches', relances: 'Relances', mails: 'Mails' };
