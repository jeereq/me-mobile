import { texteLu, type ContexteCrm, type LectureMail } from './contexte-mails';
import { addDays } from './dates';
import { boiteDuMail, type Mail } from './mails';
import { sansMarkdown } from './plan-du-jour';
import type { Boite, Mode, Priorite, Tache } from './types';

/**
 * Mon copilote : ce que l'IA propose (plan de la journée, analyse des mails) rangé en cases à cocher,
 * pour tout convertir en tâches d'un geste ou n'en garder qu'une partie.
 * Module pur, testé dans tests/copilote.test.ts.
 */

export type Proposition = {
  /** Identifiant stable dans le lot (pour les cases à cocher). */
  id: string;
  titre: string;
  priorite: Priorite;
  echeance: string | null;
  heure?: string;
  raison?: string;
};

export type ReponseCopilote = { plan: string; propositions: Proposition[] };

const PRIORITES: Priorite[] = ['haute', 'moyenne', 'basse'];
const jour = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const heureOk = (v: unknown) => (typeof v === 'string' && /^\d{1,2}[:h]\d{2}$/.test(v.trim()) ? v.trim().replace('h', ':').padStart(5, '0') : undefined);
const texte = (v: unknown, max = 160) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Le JSON rendu par l'IA, même entouré de texte ou d'une clôture ```json. Rien de lisible : null. */
export function lireJson(brut: string): Record<string, unknown> | null {
  const s = brut.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const debut = s.indexOf('{');
  const fin = s.lastIndexOf('}');
  if (debut < 0 || fin <= debut) return null;
  try {
    const v = JSON.parse(s.slice(debut, fin + 1));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Les lignes du plan qui ne sont pas des actions : titres, rendez-vous, pauses.
const PAS_UNE_ACTION = /^(priorit|déroulé|deroule|plan|ensuite|bonne|voici|pause|déjeuner|dejeuner|rendez-vous|rdv|réunion|reunion)\b/i;

/**
 * Un ancien serveur (ou une réponse qui n'est pas du JSON) ne rend que le texte du plan :
 * chaque ligne qui ressemble à une action devient une proposition, sans l'heure ni la puce.
 */
export function propositionsDuTexte(plan: string, d: string): Proposition[] {
  const vues = new Set<string>();
  return plan
    .split('\n')
    .map((l) =>
      l
        .replace(/^[\s•*-]+/, '')
        .replace(/^\d{1,2}[.)]\s+/, '')
        .replace(/^(de\s+)?\d{1,2}\s*[h:]\s*\d{0,2}(\s*(à|-|–)\s*\d{1,2}\s*[h:]\s*\d{0,2})?\s*[:,–-]?\s*/i, '')
        .trim(),
    )
    .filter((l) => l.length >= 6 && l.length <= 140 && !l.endsWith(':') && !PAS_UNE_ACTION.test(l))
    .filter((l) => {
      const k = cle(l);
      if (vues.has(k)) return false;
      vues.add(k);
      return true;
    })
    .slice(0, 8)
    .map((titre, i) => ({ id: `p${i}`, titre: titre.replace(/[.;]$/, ''), priorite: i < 3 ? 'haute' : 'moyenne', echeance: d }));
}

/** La réponse du copilote : le plan à lire et les propositions à cocher. */
export function lireCopilote(brut: string, d: string): ReponseCopilote {
  const j = lireJson(brut);
  if (!j || typeof j.plan !== 'string') {
    const plan = sansMarkdown(brut);
    return { plan, propositions: propositionsDuTexte(plan, d) };
  }
  const plan = sansMarkdown(j.plan);
  const brutes = Array.isArray(j.propositions) ? j.propositions : [];
  const vues = new Set<string>();
  const propositions: Proposition[] = [];
  for (const p of brutes) {
    if (!p || typeof p !== 'object') continue;
    const x = p as Record<string, unknown>;
    const titre = texte(x.titre);
    if (!titre || vues.has(cle(titre))) continue;
    vues.add(cle(titre));
    propositions.push({
      id: `p${propositions.length}`,
      titre,
      priorite: PRIORITES.includes(x.priorite as Priorite) ? (x.priorite as Priorite) : 'moyenne',
      echeance: jour(x.echeance) ?? d,
      ...(heureOk(x.heure) ? { heure: heureOk(x.heure) } : {}),
      ...(texte(x.raison) ? { raison: texte(x.raison, 200) } : {}),
    });
    if (propositions.length >= 10) break;
  }
  return { plan, propositions: propositions.length ? propositions : propositionsDuTexte(plan, d) };
}

/** Clé de comparaison d'un titre : sans accents, casse, ponctuation ni espaces en trop. */
export const cle = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Les propositions qui sont déjà des tâches en cours (même titre) : affichées, mais pas recréées. */
export function dejaEnTaches(propositions: Proposition[], taches: Pick<Tache, 'titre' | 'statut'>[]): Set<string> {
  const titres = new Set(taches.filter((t) => t.statut !== 'fait').map((t) => cle(t.titre)));
  return new Set(propositions.filter((p) => titres.has(cle(p.titre))).map((p) => p.id));
}

/** Les tâches à créer pour les propositions choisies (dans l'ordre du copilote), sans doublon avec les tâches en cours. */
export function tachesDepuis(propositions: Proposition[], ids: Iterable<string>, taches: Pick<Tache, 'titre' | 'statut'>[], o: { mode: Mode; id: () => string; maintenant: string; source?: Boite | 'manuel' }): Tache[] {
  const choisies = new Set(ids);
  const deja = dejaEnTaches(propositions, taches);
  return propositions
    .filter((p) => choisies.has(p.id) && !deja.has(p.id))
    .map((p) => ({ id: o.id(), titre: p.titre, source: o.source ?? 'manuel', priorite: p.priorite, echeance: p.echeance, statut: 'en_attente' as const, faitLe: null, mode: o.mode, creeLe: o.maintenant }));
}

/* ——— Analyse des mails ——— */

export type ActionMail = 'repondre' | 'tache' | 'rien';
/** Les sortes de mail que l'IA distingue (voir le serveur, `analyse-mails.ts`), avec leur nom affiché. */
export const CATEGORIES_MAIL = { demande: 'Demande', facture: 'Facture', devis: 'Devis', rendez_vous: 'Rendez-vous', relance: 'Relance', information: 'Information', newsletter: 'Lettre d’info', notification: 'Notification', personnel: 'Perso', autre: 'Autre' } as const;
export type CategorieMail = keyof typeof CATEGORIES_MAIL;
export type AnalyseMail = {
  id: string;
  resume: string;
  urgence: 'haute' | 'normale' | 'basse';
  action: ActionMail;
  reponse: string;
  tache: string;
  categorie?: CategorieMail;
  /** La date limite que donne le mail (AAAA-MM-JJ). */
  echeance?: string;
  /** Le montant principal, tel qu'écrit (« 1 250 € »). */
  montant?: string;
  /** Le rendez-vous proposé ou confirmé. */
  rdv?: { date: string; heure?: string };
  /** La relance (son id) à laquelle ce mail répond. */
  relance?: string;
  /** Le projet (son id) dont parle le mail. */
  projet?: string;
};
/** Ce que l'app envoie en plus des mails : la date du jour et ce que l'utilisateur suit déjà. */
export type ContexteAnalyse = { aujourdhui: string; crm: ContexteCrm };

/** Au plus autant de mails par demande à l'IA : au-delà, sa réponse devient trop longue et lente. Plus de mails = plusieurs paquets. */
export const MAX_MAILS_ANALYSE = 10;
/** Le texte d'un mail envoyé à l'IA, coupé : le début dit presque toujours ce qui est demandé. */
const MAX_TEXTE_MAIL = 3000;

/**
 * Ce que l'app envoie pour l'analyse : le texte lu (ou l'extrait de la liste si la lecture a échoué), le fil et les pièces jointes.
 * Avec le contexte, un objet `{ aujourdhui, crm, mails }` ; sans lui, la simple liste des mails.
 */
export function donneesMails(mails: Pick<Mail, 'id' | 'contact' | 'adresse' | 'date' | 'sujet' | 'ctx' | 'extrait'>[], textes: Record<string, string | LectureMail>, contexte?: ContexteAnalyse) {
  const liste = mails.slice(0, MAX_MAILS_ANALYSE).map((m) => {
    const l = textes[m.id];
    const lu = typeof l === 'object' ? l : undefined;
    return {
      id: m.id,
      de: m.contact,
      ...(contexte && m.adresse ? { adresse: m.adresse } : {}),
      ...(contexte && m.date ? { date: m.date } : {}),
      sujet: m.sujet,
      boite: m.ctx,
      texte: (texteLu(l) ?? m.extrait ?? '').slice(0, MAX_TEXTE_MAIL),
      ...(lu?.precedents?.length ? { precedents: lu.precedents } : {}),
      ...(lu?.pj?.length ? { pj: lu.pj } : {}),
    };
  });
  return JSON.stringify(contexte ? { ...contexte, mails: liste } : liste);
}

const URGENCES = ['haute', 'normale', 'basse'] as const;
const ACTIONS: ActionMail[] = ['repondre', 'tache', 'rien'];

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const sansPrefixe = (ref: unknown, refs: string[] | undefined) => (typeof ref === 'string' && refs?.includes(ref) ? ref.slice(ref.indexOf(':') + 1) : undefined);

/**
 * L'analyse rendue par l'IA, ramenée aux mails demandés (un id inconnu est ignoré, un mail oublié n'a pas d'analyse).
 * Une relance ou un projet n'est gardé que si sa ref faisait partie du contexte envoyé ; une date doit exister.
 */
export function lireAnalyses(brut: string, ids: string[], refs?: { relances?: string[]; projets?: string[] }): AnalyseMail[] {
  const j = lireJson(brut);
  const liste = Array.isArray(j?.analyses) ? (j!.analyses as unknown[]) : [];
  const parId = new Map<string, AnalyseMail>();
  for (const a of liste) {
    if (!a || typeof a !== 'object') continue;
    const x = a as Record<string, unknown>;
    const id = String(x.id ?? '');
    if (!ids.includes(id) || parId.has(id)) continue;
    const reponse = typeof x.reponse === 'string' ? x.reponse.replace(/\r/g, '').trim() : '';
    const action = ACTIONS.includes(x.action as ActionMail) ? (x.action as ActionMail) : reponse ? 'repondre' : 'rien';
    const echeance = typeof x.echeance === 'string' && jourValide(x.echeance) ? x.echeance : undefined;
    const montant = texte(x.montant, 40);
    const rdvDate = typeof x.rdv_date === 'string' && jourValide(x.rdv_date) ? x.rdv_date : undefined;
    const rdvHeure = typeof x.rdv_heure === 'string' && HEURE.test(x.rdv_heure) ? x.rdv_heure : undefined;
    const relance = sansPrefixe(x.relance, refs?.relances);
    const projet = sansPrefixe(x.projet, refs?.projets);
    parId.set(id, {
      id,
      resume: texte(x.resume, 300),
      urgence: URGENCES.includes(x.urgence as (typeof URGENCES)[number]) ? (x.urgence as AnalyseMail['urgence']) : 'normale',
      action,
      reponse: action === 'rien' ? '' : reponse,
      tache: texte(x.tache),
      ...(typeof x.categorie === 'string' && x.categorie in CATEGORIES_MAIL ? { categorie: x.categorie as CategorieMail } : {}),
      ...(echeance ? { echeance } : {}),
      ...(montant && montant !== 'null' ? { montant } : {}),
      ...(rdvDate ? { rdv: { date: rdvDate, ...(rdvHeure ? { heure: rdvHeure } : {}) } } : {}),
      ...(relance ? { relance } : {}),
      ...(projet ? { projet } : {}),
    });
  }
  return ids.map((id) => parId.get(id)).filter((a): a is AnalyseMail => !!a);
}

/**
 * Les mails à proposer quand on touche « Analyser mes mails » : tous les non lus reçus (de la boîte choisie, sinon de toutes),
 * les plus récents d'abord ; sans non lu, les 10 derniers reçus. `boite` : l'adresse d'un compte ou d'une boîte partagée.
 */
export function mailsAAnalyser<M extends Pick<Mail, 'id' | 'sens' | 'nonLu' | 'date' | 'heure' | 'boite' | 'compte'>>(mails: M[], boite?: string): M[] {
  const recus = mails.filter((m) => m.sens === 'recu' && (!boite || boiteDuMail(m) === boite));
  const recent = (a: M, b: M) => `${b.date}${b.heure ?? ''}`.localeCompare(`${a.date}${a.heure ?? ''}`);
  const nonLus = recus.filter((m) => m.nonLu).sort(recent);
  return nonLus.length ? nonLus : [...recus].sort(recent).slice(0, MAX_MAILS_ANALYSE);
}

/** Les mails coupés en paquets d'au plus `n` : une demande à l'IA par paquet. */
export function paquets<T>(liste: T[], n = MAX_MAILS_ANALYSE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < liste.length; i += n) out.push(liste.slice(i, i + n));
  return out;
}

export type BoiteNonLus = { adresse: string; partagee: boolean; nonLus: number };
/** Les boîtes (comptes et boîtes partagées) qui ont des non lus reçus, pour choisir laquelle analyser : les comptes d'abord. */
export function boitesNonLues(mails: Pick<Mail, 'sens' | 'nonLu' | 'boite' | 'compte'>[]): BoiteNonLus[] {
  const m = new Map<string, BoiteNonLus>();
  for (const x of mails) {
    const adresse = boiteDuMail(x);
    if (!adresse || x.sens !== 'recu' || !x.nonLu) continue;
    const b = m.get(adresse) ?? m.set(adresse, { adresse, partagee: !!x.boite, nonLus: 0 }).get(adresse)!;
    b.nonLus++;
  }
  return [...m.values()].sort((a, b) => Number(a.partagee) - Number(b.partagee) || b.nonLus - a.nonLus || a.adresse.localeCompare(b.adresse, 'fr'));
}

/** Une tâche tirée d'un mail analysé : pour la date limite que donne le mail, sinon sous 2 jours, plus tôt si c'est urgent. */
export const echeanceMail = (a: Pick<AnalyseMail, 'urgence' | 'echeance'>, d: string) => (a.echeance && a.echeance >= d ? a.echeance : a.urgence === 'haute' ? d : addDays(d, a.urgence === 'basse' ? 7 : 2));
export const prioriteMail = (a: Pick<AnalyseMail, 'urgence'>): Priorite => (a.urgence === 'haute' ? 'haute' : a.urgence === 'basse' ? 'basse' : 'moyenne');

/* ——— Analyse d'un lot : une personne, un domaine, un dossier, une boîte, sur une période ——— */

/** Le lot que le copilote analyse d'un coup. `compte` : le compte connecté où chercher (tous sinon). */
export type Perimetre = {
  genre: 'personne' | 'domaine' | 'dossier' | 'boite';
  /** Adresse ou nom de la personne. */
  qui?: string;
  domaine?: string;
  dossier?: { id: string; nom: string };
  compte?: string;
  /** Boîte partagée (son adresse). */
  boite?: string;
  depuis?: string;
  jusqua?: string;
};

export type ClePeriode = '7j' | '30j' | 'mois' | 'mois-1' | '90j' | '1an' | 'tout' | 'dates';
export const PERIODES: { cle: ClePeriode; label: string }[] = [
  { cle: '7j', label: '7 jours' },
  { cle: '30j', label: '30 jours' },
  { cle: 'mois', label: 'Ce mois' },
  { cle: 'mois-1', label: 'Mois dernier' },
  { cle: '90j', label: '3 mois' },
  { cle: '1an', label: '1 an' },
  { cle: 'tout', label: 'Tout' },
  { cle: 'dates', label: 'Début et fin…' },
];
const JOURS: Partial<Record<ClePeriode, number>> = { '7j': 7, '30j': 30, '90j': 90, '1an': 365 };
/**
 * Les bornes d'une période (« Début et fin… » garde celles choisies). Les durées finissent aujourd'hui ; « Ce mois » court
 * du 1er à aujourd'hui, « Mois dernier » du 1er au dernier jour du mois précédent.
 */
export const bornesPeriode = (c: ClePeriode, d: string): { depuis?: string; jusqua?: string } => {
  if (JOURS[c]) return { depuis: addDays(d, -(JOURS[c]! - 1)) };
  if (c === 'mois') return { depuis: `${d.slice(0, 7)}-01` };
  if (c === 'mois-1') {
    const fin = addDays(`${d.slice(0, 7)}-01`, -1);
    return { depuis: `${fin.slice(0, 7)}-01`, jusqua: fin };
  }
  return {};
};

/** « 2026-02-30 » n'existe pas : le format ne suffit pas, le jour doit être au calendrier. */
export function jourValide(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const x = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === s;
}

/**
 * Les bornes saisies, vérifiées : un début ou une fin laissé vide n'est pas une borne (pas de limite de ce côté), mais une
 * date fausse ou un début après la fin est une erreur — jamais ignorée en silence, ce qui élargirait la recherche sans le dire.
 */
export function bornesDates(du: string, au: string): { depuis?: string; jusqua?: string; erreur?: string } {
  const a = du.trim();
  const b = au.trim();
  if (a && !jourValide(a)) return { erreur: 'Le début de la période n’est pas une date valide (AAAA-MM-JJ).' };
  if (b && !jourValide(b)) return { erreur: 'La fin de la période n’est pas une date valide (AAAA-MM-JJ).' };
  if (a && b && a > b) return { erreur: 'Le début doit venir avant la fin de la période.' };
  return { ...(a ? { depuis: a } : {}), ...(b ? { jusqua: b } : {}) };
}

/** Combien de mails un lot peut compter, et combien l'écran en propose. */
export const LOT_OPTIONS = [10, 25, 50, 100] as const;
export const LOT_DEFAUT = 50;
/** Au plus autant de mails dans un lot (le serveur ne rend pas plus de 100 par recherche) ; les 10 premiers sont lus en entier, les autres sur leur extrait. */
export const MAX_LOT = 100;
/** Les consignes d'analyse : de quoi guider l'IA, pas de quoi lui réécrire ses règles. */
export const MAX_CONSIGNES = 600;

/** Un nombre de mails valide : entier entre 5 et MAX_LOT, 50 sinon. */
export const nombreLot = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.min(MAX_LOT, Math.max(5, Math.round(n))) : LOT_DEFAUT);
/** Les consignes saisies : espaces en trop retirés (les retours à la ligne restent), longueur limitée. */
export const nettoyerConsignes = (s: unknown): string => (typeof s === 'string' ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CONSIGNES) : '');

/** Les réglages d'analyse gardés sur l'appareil : relus sans se fier à ce qui est stocké. */
export type ReglagesAnalyse = { consignes: string; nombre: number };
export const REGLAGES_ANALYSE: ReglagesAnalyse = { consignes: '', nombre: LOT_DEFAUT };
export function lireReglagesAnalyse(brut: unknown): ReglagesAnalyse {
  const o = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {};
  return { consignes: nettoyerConsignes(o.consignes), nombre: nombreLot(o.nombre) };
}

/** « paul@ovh.com », « Paul <paul@ovh.com> » → « ovh.com ». */
export const domaineDe = (adresse = '') => (adresse.match(/@([^\s>]+)/)?.[1] ?? '').toLowerCase().replace(/[>.,;]+$/, '');

const jourCourt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
/** Le périmètre en clair, pour l'écran et pour l'IA : « les mails de @ovh.com, du 1 octobre au 28 octobre 2026 ». */
export function decrirePerimetre(p: Perimetre, nomBoite?: (a: string) => string): string {
  const quoi =
    p.genre === 'personne' ? `les mails de ${p.qui}` : p.genre === 'domaine' ? `les mails de @${p.domaine}` : p.genre === 'dossier' ? `les mails du dossier « ${p.dossier?.nom} »` : `les mails de la boîte ${nomBoite && p.boite ? nomBoite(p.boite) : p.boite}`;
  const ou = p.genre !== 'boite' && p.boite ? ` (boîte ${nomBoite ? nomBoite(p.boite) : p.boite})` : '';
  const quand = p.depuis && p.jusqua ? `, du ${jourCourt(p.depuis)} au ${jourCourt(p.jusqua)}` : p.depuis ? `, depuis le ${jourCourt(p.depuis)}` : p.jusqua ? `, jusqu'au ${jourCourt(p.jusqua)}` : ', sur toute la période';
  return `${quoi}${ou}${quand}`;
}

/** Les paramètres de la recherche côté serveur (`/integrations/:compte/mails/recherche`). */
export function requeteLot(p: Perimetre, max: number = LOT_DEFAUT): Record<string, string> {
  return {
    ...(p.genre === 'personne' && p.qui ? { de: p.qui.trim() } : {}),
    ...(p.genre === 'domaine' && p.domaine ? { domaine: p.domaine.trim() } : {}),
    ...(p.genre === 'dossier' && p.dossier ? { dossier: p.dossier.id } : {}),
    ...(p.boite ? { boite: p.boite } : {}),
    ...(p.depuis ? { depuis: p.depuis } : {}),
    ...(p.jusqua ? { jusqua: p.jusqua } : {}),
    max: String(nombreLot(max)),
  };
}

/** Le périmètre appliqué aux mails déjà dans Me (la réception relue), pour compléter ou remplacer la recherche. */
export function filtrerPerimetre<M extends Pick<Mail, 'contact' | 'adresse' | 'date' | 'boite' | 'compte' | 'id' | 'dossier'>>(mails: M[], p: Perimetre): M[] {
  const qui = cle(p.qui ?? '');
  const dom = (p.domaine ?? '').toLowerCase().replace(/^.*@/, '').trim();
  return mails.filter((m) => {
    if (p.depuis && m.date < p.depuis) return false;
    if (p.jusqua && m.date > p.jusqua) return false;
    if (p.boite && (m.boite ?? m.compte) !== p.boite) return false;
    if (p.compte && !m.id.startsWith(`ext:${p.compte}:`)) return false;
    if (p.genre === 'personne') return !!qui && (cle(m.contact).includes(qui) || cle(m.adresse ?? '').includes(qui));
    if (p.genre === 'domaine') return !!dom && (domaineDe(m.adresse) === dom || domaineDe(m.adresse).endsWith(`.${dom}`));
    if (p.genre === 'dossier') return m.dossier === p.dossier?.id;
    return true;
  });
}

/** Réunit les mails trouvés (plusieurs comptes, réception et recherche) : sans doublon, les plus récents d'abord. */
export function reunirLot<M extends Pick<Mail, 'id' | 'date' | 'heure'>>(...listes: M[][]): M[] {
  const vus = new Map<string, M>();
  for (const l of listes) for (const m of l) if (!vus.has(m.id)) vus.set(m.id, m);
  return [...vus.values()].sort((a, b) => `${b.date}${b.heure ?? ''}`.localeCompare(`${a.date}${a.heure ?? ''}`)).slice(0, MAX_LOT);
}

/** Les expéditeurs et domaines qui reviennent le plus dans la boîte : les suggestions du choix du périmètre. */
export function frequents(mails: Pick<Mail, 'contact' | 'adresse' | 'sens'>[], n = 6): { personnes: string[]; domaines: string[] } {
  const compter = (cles: string[]) => {
    const c = new Map<string, number>();
    for (const k of cles) if (k) c.set(k, (c.get(k) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([k]) => k);
  };
  const recus = mails.filter((m) => m.sens === 'recu');
  const publics = /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|orange|free|laposte|sfr|wanadoo)\./;
  return { personnes: compter(recus.map((m) => m.contact)), domaines: compter(recus.map((m) => domaineDe(m.adresse)).filter((x) => !publics.test(x))) };
}

/** Ce que l'IA reçoit au plus pour un lot (le serveur coupe à 60 000 caractères). */
export const BUDGET_DONNEES = 54_000;
/** Ce que l'app envoie pour un lot : date et adresse en plus, le texte entier des premiers mails (et leurs pièces jointes), l'extrait des autres ; avec le contexte, un objet `{ aujourdhui, crm, mails }`. */
export function donneesLot(mails: Pick<Mail, 'id' | 'contact' | 'adresse' | 'date' | 'sujet' | 'ctx' | 'extrait'>[], textes: Record<string, string | LectureMail>, budget = BUDGET_DONNEES, contexte?: ContexteAnalyse) {
  const lot = mails.slice(0, MAX_LOT);
  const fabriquer = (plein: number, court: number) => {
    const liste = lot.map((m) => {
      const l = textes[m.id];
      const lu = texteLu(l);
      const pj = typeof l === 'object' ? l.pj : undefined;
      return { id: m.id, de: m.contact, ...(m.adresse ? { adresse: m.adresse } : {}), date: m.date, sujet: m.sujet, boite: m.ctx, texte: (lu ?? m.extrait ?? '').slice(0, lu ? plein : court), ...(pj?.length ? { pj } : {}) };
    });
    return JSON.stringify(contexte ? { ...contexte, mails: liste } : liste);
  };
  // Le serveur coupe les données à 60 000 caractères, ce qui casserait le JSON : plus il y a de mails, plus chaque texte est court.
  let plein = 2000;
  let court = 400;
  let json = fabriquer(plein, court);
  while (json.length > budget && (plein > 150 || court > 80)) {
    plein = Math.max(150, Math.floor(plein * 0.75));
    court = Math.max(80, Math.floor(court * 0.75));
    json = fabriquer(plein, court);
  }
  return json;
}

/**
 * Ce que l'app envoie pour la synthèse d'un lot déjà analysé mail par mail : l'analyse de chaque mail (pas son texte),
 * ce qui laisse passer de gros lots sans couper les mails, et les tâches ouvertes pour ne pas les reproposer.
 */
export function donneesSynthese(mails: Pick<Mail, 'id' | 'contact' | 'date' | 'sujet'>[], analyses: AnalyseMail[], contexte?: ContexteAnalyse, budget = BUDGET_DONNEES) {
  const parId = new Map(mails.map((m) => [m.id, m]));
  const gardees = analyses.filter((a) => parId.has(a.id));
  const fabriquer = (resume: number, tache: number) =>
    JSON.stringify({
      ...(contexte ? { aujourdhui: contexte.aujourdhui, crm: { taches: contexte.crm.taches } } : {}),
      mails: gardees.map((a) => {
        const m = parId.get(a.id)!;
        return {
          id: a.id,
          de: m.contact,
          date: m.date,
          sujet: m.sujet.slice(0, 120),
          resume: a.resume.slice(0, resume),
          urgence: a.urgence,
          action: a.action,
          ...(a.categorie ? { categorie: a.categorie } : {}),
          ...(a.echeance ? { echeance: a.echeance } : {}),
          ...(a.montant ? { montant: a.montant } : {}),
          ...(a.tache && tache ? { tache: a.tache.slice(0, tache) } : {}),
        };
      }),
    });
  // Le serveur coupe à 60 000 caractères : un très gros lot garde des résumés plus courts, puis perd le titre des tâches.
  let json = fabriquer(300, 160);
  for (const [r, t] of [[200, 100], [150, 0], [100, 0]] as const) {
    if (json.length <= budget) break;
    json = fabriquer(r, t);
  }
  return json;
}

export type AnalyseLot = { synthese: string; points: string[]; actions: Proposition[]; analyses: AnalyseMail[] };

/** La réponse de l'IA pour un lot : la synthèse, les constats, les actions (à convertir en tâches) et chaque mail. */
export function lireLot(brut: string, ids: string[], d: string, refs?: { relances?: string[]; projets?: string[] }): AnalyseLot {
  const j = lireJson(brut) ?? {};
  const actions = lireCopilote(JSON.stringify({ plan: ' ', propositions: Array.isArray(j.actions) ? j.actions : [] }), d).propositions.filter((p) => p.titre);
  return {
    synthese: typeof j.synthese === 'string' ? sansMarkdown(j.synthese) : '',
    points: (Array.isArray(j.points) ? j.points : []).map((x) => texte(x, 220)).filter(Boolean).slice(0, 8),
    // Sans actions rendues, aucune proposition n'est tirée du texte : le lot n'a pas de plan.
    actions: Array.isArray(j.actions) && j.actions.length ? actions : [],
    analyses: lireAnalyses(brut, ids, refs),
  };
}
