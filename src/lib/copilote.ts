import { addDays } from './dates';
import type { Mail } from './mails';
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
export type AnalyseMail = { id: string; resume: string; urgence: 'haute' | 'normale' | 'basse'; action: ActionMail; reponse: string; tache: string };

/** Au plus autant de mails par analyse : au-delà, la réponse de l'IA devient trop longue et lente. */
export const MAX_MAILS_ANALYSE = 10;
/** Le texte d'un mail envoyé à l'IA, coupé : le début dit presque toujours ce qui est demandé. */
const MAX_TEXTE_MAIL = 3000;

/** Ce que l'app envoie pour l'analyse : le texte lu (ou l'extrait de la liste si la lecture a échoué). */
export function donneesMails(mails: Pick<Mail, 'id' | 'contact' | 'sujet' | 'ctx' | 'extrait'>[], textes: Record<string, string>) {
  return JSON.stringify(mails.slice(0, MAX_MAILS_ANALYSE).map((m) => ({ id: m.id, de: m.contact, sujet: m.sujet, boite: m.ctx, texte: (textes[m.id] ?? m.extrait ?? '').slice(0, MAX_TEXTE_MAIL) })));
}

const URGENCES = ['haute', 'normale', 'basse'] as const;
const ACTIONS: ActionMail[] = ['repondre', 'tache', 'rien'];

/** L'analyse rendue par l'IA, ramenée aux mails demandés (un id inconnu est ignoré, un mail oublié n'a pas d'analyse). */
export function lireAnalyses(brut: string, ids: string[]): AnalyseMail[] {
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
    parId.set(id, {
      id,
      resume: texte(x.resume, 300),
      urgence: URGENCES.includes(x.urgence as (typeof URGENCES)[number]) ? (x.urgence as AnalyseMail['urgence']) : 'normale',
      action,
      reponse: action === 'rien' ? '' : reponse,
      tache: texte(x.tache),
    });
  }
  return ids.map((id) => parId.get(id)).filter((a): a is AnalyseMail => !!a);
}

/** Les mails à proposer quand on touche « Analyser » sans rien choisir : les non lus reçus d'abord, puis les plus récents. */
export function mailsAAnalyser<M extends Pick<Mail, 'id' | 'sens' | 'nonLu' | 'date' | 'heure'>>(mails: M[]): M[] {
  const recus = mails.filter((m) => m.sens === 'recu');
  const recent = (a: M, b: M) => `${b.date}${b.heure ?? ''}`.localeCompare(`${a.date}${a.heure ?? ''}`);
  const nonLus = recus.filter((m) => m.nonLu).sort(recent);
  return (nonLus.length ? nonLus : [...recus].sort(recent)).slice(0, MAX_MAILS_ANALYSE);
}

/** Une tâche tirée d'un mail analysé : à faire sous 2 jours, plus tôt si c'est urgent. */
export const echeanceMail = (a: Pick<AnalyseMail, 'urgence'>, d: string) => (a.urgence === 'haute' ? d : addDays(d, a.urgence === 'basse' ? 7 : 2));
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

export type ClePeriode = '7j' | '30j' | '90j' | '1an' | 'tout' | 'dates';
export const PERIODES: { cle: ClePeriode; label: string }[] = [
  { cle: '7j', label: '7 jours' },
  { cle: '30j', label: '30 jours' },
  { cle: '90j', label: '3 mois' },
  { cle: '1an', label: '1 an' },
  { cle: 'tout', label: 'Tout' },
  { cle: 'dates', label: 'Dates…' },
];
const JOURS: Partial<Record<ClePeriode, number>> = { '7j': 7, '30j': 30, '90j': 90, '1an': 365 };
/** Les bornes d'une période qui finit aujourd'hui (« Dates… » garde celles saisies). */
export const bornesPeriode = (c: ClePeriode, d: string): { depuis?: string; jusqua?: string } => (JOURS[c] ? { depuis: addDays(d, -(JOURS[c]! - 1)) } : {});

/** Au plus autant de mails dans un lot ; les 10 premiers sont lus en entier, les autres sur leur extrait. */
export const MAX_LOT = 50;

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
export function requeteLot(p: Perimetre): Record<string, string> {
  return {
    ...(p.genre === 'personne' && p.qui ? { de: p.qui.trim() } : {}),
    ...(p.genre === 'domaine' && p.domaine ? { domaine: p.domaine.trim() } : {}),
    ...(p.genre === 'dossier' && p.dossier ? { dossier: p.dossier.id } : {}),
    ...(p.boite ? { boite: p.boite } : {}),
    ...(p.depuis ? { depuis: p.depuis } : {}),
    ...(p.jusqua ? { jusqua: p.jusqua } : {}),
    max: String(MAX_LOT),
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

/** Ce que l'app envoie pour un lot : date et adresse en plus, le texte entier des premiers mails, l'extrait des autres. */
export function donneesLot(mails: Pick<Mail, 'id' | 'contact' | 'adresse' | 'date' | 'sujet' | 'ctx' | 'extrait'>[], textes: Record<string, string>) {
  return JSON.stringify(mails.slice(0, MAX_LOT).map((m) => ({ id: m.id, de: m.contact, ...(m.adresse ? { adresse: m.adresse } : {}), date: m.date, sujet: m.sujet, boite: m.ctx, texte: (textes[m.id] ?? m.extrait ?? '').slice(0, textes[m.id] ? 2000 : 400) })));
}

export type AnalyseLot = { synthese: string; points: string[]; actions: Proposition[]; analyses: AnalyseMail[] };

/** La réponse de l'IA pour un lot : la synthèse, les constats, les actions (à convertir en tâches) et chaque mail. */
export function lireLot(brut: string, ids: string[], d: string): AnalyseLot {
  const j = lireJson(brut) ?? {};
  const actions = lireCopilote(JSON.stringify({ plan: ' ', propositions: Array.isArray(j.actions) ? j.actions : [] }), d).propositions.filter((p) => p.titre);
  return {
    synthese: typeof j.synthese === 'string' ? sansMarkdown(j.synthese) : '',
    points: (Array.isArray(j.points) ? j.points : []).map((x) => texte(x, 220)).filter(Boolean).slice(0, 8),
    // Sans actions rendues, aucune proposition n'est tirée du texte : le lot n'a pas de plan.
    actions: Array.isArray(j.actions) && j.actions.length ? actions : [],
    analyses: lireAnalyses(brut, ids),
  };
}
