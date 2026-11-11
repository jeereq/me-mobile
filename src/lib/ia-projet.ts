/**
 * L'IA d'un projet : ce qu'on envoie à l'assistant, ce qu'on lit de ses réponses, et les risques que l'app repère seule.
 * Module pur (pas de réseau) : l'appel à l'assistant est fait par l'écran.
 */
import { nomMembre } from './affectation';
import { creerTache, type LignePlan, type Plan } from './planning';
import type { MembreEquipe } from './equipes';
import type { Mode, Priorite, Projet, Tache } from './types';

/** Au-delà, la liste est raccourcie : les tâches faites d'abord, puis les plus lointaines. */
export const MAX_TACHES_IA = 150;

type Ctx = { projet: Pick<Projet, 'nom' | 'debut' | 'joursOuvres'>; taches: Tache[]; plan: Plan; aujourdhui: string; membres?: MembreEquipe[] };

const enRetard = (l: LignePlan | undefined, aujourdhui: string) => !!l && !l.fait && !l.jalon && l.fin < aujourdhui;

/** Le projet tel que l'assistant le lit : chaque tâche avec ses dates, son avancement, son responsable et ce qui la bloque. */
export function donneesProjet({ projet, taches, plan, aujourdhui, membres = [] }: Ctx): string {
  const titre = new Map(taches.map((t) => [t.id, t.titre]));
  const ouvertes = (t: Tache) => !plan.lignes.get(t.id)?.fait;
  // Les tâches à faire d'abord (dans l'ordre du plan), les faites ensuite : une longue liste garde l'essentiel.
  const rang = new Map(plan.ordre.map((id, i) => [id, i]));
  const triees = [...taches].filter((t) => plan.lignes.has(t.id)).sort((a, b) => Number(!ouvertes(a)) - Number(!ouvertes(b)) || (rang.get(a.id) ?? 0) - (rang.get(b.id) ?? 0));
  const lignes = triees.slice(0, MAX_TACHES_IA).map((t) => {
    const l = plan.lignes.get(t.id)!;
    return {
      titre: t.titre,
      ...(t.parent && titre.get(t.parent) ? { phase: titre.get(t.parent) } : {}),
      ...(l.resume ? { resume: true } : {}),
      ...(l.jalon ? { jalon: true } : {}),
      debut: l.debut,
      fin: l.fin,
      duree: l.duree,
      avancement: l.avancement,
      fait: l.fait,
      ...(t.responsable ? { responsable: t.responsable } : {}),
      ...(t.etat && t.etat !== 'normal' ? { etat: t.etat } : {}),
      ...(l.critique && !l.fait ? { critique: true } : {}),
      ...(enRetard(l, aujourdhui) ? { enRetard: true } : {}),
      ...(l.bloquee ? { bloquee: true } : {}),
      ...(t.apres?.length ? { apres: t.apres.map((a) => titre.get(a)).filter(Boolean) } : {}),
      ...(t.note ? { note: t.note.slice(0, 200) } : {}),
    };
  });
  return JSON.stringify({
    nom: projet.nom,
    aujourdhui,
    debut: plan.debut,
    finPrevue: plan.fin,
    avancement: plan.avancement,
    joursOuvres: projet.joursOuvres,
    nbTaches: taches.length,
    taches: lignes,
    ...(membres.length ? { membres: membres.map(nomMembre) } : {}),
  });
}

/** Ce que l'assistant lit pour proposer un plan : la date de départ, l'équipe et ce qui existe déjà (pour ne rien doubler). */
export function donneesPlanIA({ projet, taches, aujourdhui, membres = [] }: Pick<Ctx, 'projet' | 'taches' | 'aujourdhui' | 'membres'>): string {
  return JSON.stringify({
    nom: projet.nom,
    aujourdhui,
    debut: projet.debut ?? aujourdhui,
    joursOuvres: projet.joursOuvres,
    membres: membres.map(nomMembre),
    existantes: taches.slice(0, 100).map((t) => t.titre),
  });
}

/* ---------- Risques repérés par l'app ---------- */

export type Risque = { id: string; tache?: string; niveau: 'haut' | 'moyen'; texte: string };

const jours = (n: number) => `${n} jour${n > 1 ? 's' : ''}`;
const ecart = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

/**
 * Ce qui menace le projet, sans IA : retards, tâches critiques en retard ou sans responsable, blocages, liens qui se contredisent.
 * Les plus graves d'abord ; `max` en garde les premiers.
 */
export function risquesProjet({ taches, plan, aujourdhui }: Pick<Ctx, 'taches' | 'plan' | 'aujourdhui'>, max = 8): Risque[] {
  const r: Risque[] = [];
  const ouvertes = taches.filter((t) => {
    const l = plan.lignes.get(t.id);
    return l && !l.fait && !l.resume;
  });
  const equipe = taches.some((t) => t.responsable?.trim());
  for (const t of ouvertes) {
    const l = plan.lignes.get(t.id)!;
    if (enRetard(l, aujourdhui)) {
      const n = ecart(l.fin, aujourdhui);
      r.push(l.critique ? { id: `retard:${t.id}`, tache: t.titre, niveau: 'haut', texte: `En retard de ${jours(n)}, et sur la voie critique : la fin du projet glisse.` } : { id: `retard:${t.id}`, tache: t.titre, niveau: 'moyen', texte: `En retard de ${jours(n)}.` });
    } else if (l.critique && l.bloquee) {
      r.push({ id: `bloquee:${t.id}`, tache: t.titre, niveau: 'moyen', texte: 'Critique, et une tâche qui la précède n’est pas finie.' });
    }
    if (l.critique && equipe && !t.responsable?.trim()) r.push({ id: `sans:${t.id}`, tache: t.titre, niveau: 'moyen', texte: 'Critique et sans responsable.' });
    if (l.conflit) r.push({ id: `conflit:${t.id}`, tache: t.titre, niveau: 'moyen', texte: 'Ses dates imposées ne respectent pas ses liens.' });
  }
  if (plan.fin && ouvertes.length && plan.fin < aujourdhui) r.push({ id: 'fin', niveau: 'haut', texte: `La fin prévue est dépassée de ${jours(ecart(plan.fin, aujourdhui))} et il reste ${ouvertes.length} tâche${ouvertes.length > 1 ? 's' : ''}.` });
  if (plan.nbCycles) r.push({ id: 'cycles', niveau: 'moyen', texte: `${plan.nbCycles} tâche${plan.nbCycles > 1 ? 's' : ''} dans une boucle de liens : ils sont ignorés.` });
  const poids = (x: Risque) => (x.niveau === 'haut' ? 0 : 1);
  return r.sort((a, b) => poids(a) - poids(b)).slice(0, max);
}

/* ---------- Lire les réponses ---------- */

/** Le premier objet JSON d'une réponse, même entourée de texte ou de ```json. */
export function lireJson(brut: string): Record<string, unknown> | null {
  const texte = String(brut ?? '').trim();
  if (!texte) return null;
  const debut = texte.indexOf('{');
  const fin = texte.lastIndexOf('}');
  if (debut < 0 || fin <= debut) return null;
  try {
    const o = JSON.parse(texte.slice(debut, fin + 1));
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const txt = (v: unknown, max = 400) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export type EtatIA = { resume: string; risques: { tache: string; niveau: 'haut' | 'moyen'; pourquoi: string; action: string }[]; actions: string[] };

/** L'état du projet vu par l'assistant ; null si la réponse n'est pas utilisable. */
export function lireEtat(brut: string): EtatIA | null {
  const o = lireJson(brut);
  if (!o) return null;
  const resume = txt(o.resume, 1200);
  const risques = liste(o.risques)
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .map((x) => ({ tache: txt(x.tache, 200), niveau: x.niveau === 'haut' ? ('haut' as const) : ('moyen' as const), pourquoi: txt(x.pourquoi), action: txt(x.action) }))
    .filter((x) => x.pourquoi || x.action)
    .slice(0, 6);
  const actions = liste(o.actions).map((x) => txt(x, 200)).filter(Boolean).slice(0, 5);
  return resume || risques.length || actions.length ? { resume, risques, actions } : null;
}

/** Une tâche proposée par l'assistant. */
export type TachePlanIA = { titre: string; parent: string | null; duree: number; apres: string[]; responsable: string; priorite: Priorite; jalon: boolean };

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Le plan proposé : titres sans doublon, liens seulement vers des tâches qui précèdent, parent seulement s'il existe plus haut. */
export function lirePlanIA(brut: string): TachePlanIA[] {
  const o = lireJson(brut);
  if (!o) return [];
  const vus = new Set<string>();
  const sortie: TachePlanIA[] = [];
  for (const x of liste(o.taches).slice(0, 40)) {
    const e = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
    const titre = txt(e.titre, 200);
    if (!titre || vus.has(normal(titre))) continue;
    const jalon = e.jalon === true || e.duree === 0;
    const duree = jalon ? 0 : Math.min(365, Math.max(1, Math.round(Number(e.duree) || 1)));
    const parent = txt(e.parent, 200);
    const avant = (t: string) => sortie.find((s) => normal(s.titre) === normal(t))?.titre;
    sortie.push({
      titre,
      parent: parent ? (avant(parent) ?? null) : null,
      duree,
      apres: [...new Set(liste(e.apres).map((a) => avant(txt(a, 200))).filter((a): a is string => !!a && normal(a) !== normal(titre)))],
      responsable: txt(e.responsable, 100),
      priorite: e.priorite === 'haute' || e.priorite === 'basse' ? e.priorite : 'moyenne',
      jalon,
    });
    vus.add(normal(titre));
  }
  return sortie;
}

/**
 * Ajoute au projet les tâches du plan choisi : phases, sous-tâches, liens et responsables (un responsable qui est un membre de l'équipe
 * lui confie la tâche). Les liens vers une tâche écartée sont ignorés, une sous-tâche dont la phase est écartée devient une tâche seule.
 */
export function ajouterPlanIA(
  existantes: Tache[],
  projet: Pick<Projet, 'id'>,
  plan: TachePlanIA[],
  o: { mode: Mode; uid: () => string; membres?: MembreEquipe[]; maintenant?: string },
): Tache[] {
  const ids = new Map<string, string>(plan.map((t) => [normal(t.titre), o.uid()]));
  let taches = existantes;
  for (const t of plan) {
    const id = ids.get(normal(t.titre))!;
    const parent = t.parent ? ids.get(normal(t.parent)) : undefined;
    const apres = t.apres.map((a) => ids.get(normal(a))).filter((a): a is string => !!a);
    const membre = t.responsable ? o.membres?.find((m) => normal(nomMembre(m)) === normal(t.responsable)) : undefined;
    const estPhase = plan.some((x) => x.parent && normal(x.parent) === normal(t.titre));
    taches = creerTache(
      taches,
      { source: 'manuel', priorite: t.priorite, mode: o.mode },
      {
        id,
        titre: t.titre,
        projet: projet.id,
        ...(parent ? { parent } : {}),
        ...(apres.length ? { apres } : {}),
        ...(estPhase ? {} : t.jalon ? { jalon: true, duree: 0 } : { duree: t.duree }),
        ...(membre ? { affecteA: membre.id, responsable: nomMembre(membre) } : t.responsable ? { responsable: t.responsable } : {}),
      },
      o.maintenant,
    );
  }
  return taches;
}

/** La réponse à une question : du texte sans markdown. */
export function lireReponse(brut: string): string {
  return String(brut ?? '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .trim();
}

/** Des questions à poser en un geste. */
export const QUESTIONS_PROJET = ['Qui est en retard ?', 'Que faire cette semaine ?', 'Qu’est-ce qui menace la date de fin ?', 'Qui est le plus chargé ?'];
