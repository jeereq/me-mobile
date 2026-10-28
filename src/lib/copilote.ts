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
