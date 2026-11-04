import { cle, type Proposition } from './copilote';
import { addDays } from './dates';
import { resumeFinances } from './etat-des-lieux';
import { financesDe, prochaineEcheance } from './finances';
import { liesAuMail } from './liens-mail';
import type { Mail } from './mails';
import { missionDuJour } from './mission';
import { resumes, tachesActives } from './planning';
import { estAutomatique } from './tri-analyses';
import type { Espace } from './types';

const MAX_MAILS_PLAN = 12;
export const MAX_CONTEXTE_PLAN = 500;

/** Les mails à placer dans la journée : non lus récents, écrits par une personne, et pas déjà suivis par une tâche ou une relance ouverte. */
export function mailsDuPlan(mails: Mail[], e: Pick<Espace, 'relances' | 'taches'>, d: string) {
  const depuis = addDays(d, -7);
  return mails
    .filter((m) => m.sens === 'recu' && m.nonLu && m.date >= depuis && !estAutomatique(m) && !liesAuMail(m, e).some((x) => !x.fait))
    .sort((a, b) => `${b.date} ${b.heure ?? ''}`.localeCompare(`${a.date} ${a.heure ?? ''}`))
    .slice(0, MAX_MAILS_PLAN)
    .map((m) => ({ de: m.contact, sujet: m.sujet.slice(0, 120), date: m.date, ...(m.extrait ? { debut: m.extrait.slice(0, 160) } : {}) }));
}

/**
 * Les données envoyées à l'IA pour « Planifier ma journée » : seulement ce qui reste à faire aujourd'hui.
 * Le résumé général (`resumeDonnees`) mélangeait le fait et le pas fait, coupait les listes au hasard
 * et dépassait souvent la taille que le serveur lit : le plan proposait des choses déjà faites ou en oubliait.
 */
export function donneesPlan(e: Espace, d: string, mails: Mail[] = [], contexte = '') {
  const mission = missionDuJour(e, d).filter((m) => !m.fait);
  const urgentes = new Set(mission.filter((m) => m.type === 'tache').map((m) => m.id));
  const parents = resumes(e.taches);
  const semaine = addDays(d, 7);
  const f = financesDe(e);
  const fin = resumeFinances(e, d);
  const dansTroisJours = addDays(d, 3);
  return {
    aujourdhui: d,
    ...(contexte.trim() ? { contexteDuJour: contexte.trim().slice(0, MAX_CONTEXTE_PLAN) } : {}),
    mailsNonLus: mailsDuPlan(mails, e, d),
    agenda: (e.agenda[d] || []).map(({ debut, fin, titre, lieu }) => ({ debut, ...(fin ? { fin } : {}), titre, ...(lieu ? { lieu } : {}) })),
    relancesDues: mission.filter((m) => m.type === 'relance').map((m) => ({ contact: m.item.contact, sujet: m.item.sujet, boite: m.item.boite, ...(m.item.date < d ? { enRetard: true } : {}) })),
    tachesUrgentes: mission.filter((m) => m.type === 'tache').map((m) => ({ titre: m.titre, quand: m.detail, priorite: m.item.priorite, ...(m.item.echeance ? { echeance: m.item.echeance } : {}), ...(m.item.projet ? { projet: e.projets?.find((p) => p.id === m.item.projet)?.nom } : {}) })),
    habitudesDuJour: mission.filter((m) => m.type === 'habitude').map((m) => ({ nom: m.titre, categorie: m.item.categorie })),
    // Pour remplir les trous de la journée, sans noyer l'IA : la semaine qui vient, la plus proche d'abord.
    tachesSemaine: tachesActives(e, d)
      .filter((t) => !urgentes.has(t.id) && !parents.has(t.id) && t.echeance && t.echeance <= semaine)
      .sort((a, b) => a.echeance!.localeCompare(b.echeance!))
      .slice(0, 10)
      .map((t) => ({ titre: t.titre, echeance: t.echeance, priorite: t.priorite })),
    finances: {
      devise: f.devise,
      // Ce qui reste sur les budgets, d'après les seules dépenses notées : pas de budget du jour supposé.
      ...(fin.reste !== null ? { resteBudgets: fin.reste, depenseAujourdhui: fin.jour.depense } : {}),
      // Factures et prélèvements qui tombent dans les 3 jours : à payer en premier.
      facturesProches: (f.recurrences || [])
        .filter((r) => r.genre === 'depense' && (!r.fin || r.fin >= d))
        .map((r) => ({ note: r.note, montant: r.montant, date: prochaineEcheance(r) }))
        .filter((r) => r.date <= dansTroisJours)
        .sort((a, b) => a.date.localeCompare(b.date)),
    },
  };
}

/** Le plan est lu tel quel (et à voix haute) : on enlève le markdown que certains modèles ajoutent malgré la consigne. */
export function sansMarkdown(texte: string) {
  return texte
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[ \t]*[-*•][ \t]+/gm, '• ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Ce qui restait à faire quand le plan a été préparé : de quoi voir ensuite ce qui a bougé. `mots` : ce qu'une ligne du plan doit citer. */
export type BasePlan = { elements: { cle: string; mots: string }[]; rdv: string[] };
const cleRdv = (x: { debut?: string; titre?: string }) => `${x.debut ?? ''}|${x.titre ?? ''}`;

export function basePlan(e: Espace, d: string): BasePlan {
  return {
    elements: missionDuJour(e, d)
      .filter((m) => !m.fait)
      .map((m) => ({ cle: m.cle, mots: m.type === 'relance' ? m.item.contact : m.titre })),
    rdv: (e.agenda[d] || []).map(cleRdv),
  };
}

// Le dernier plan et ses propositions, pour ce compte et cet espace seulement : ils survivent au changement d'onglet, pas au changement de jour.
export type PlanGarde = { pour: string; jour: string; texte: string; propositions: Proposition[]; heure?: string; contexte?: string; base?: BasePlan };
type DetailsPlan = Pick<PlanGarde, 'heure' | 'contexte' | 'base'>;
let dernier: PlanGarde | null = null;
let titulaire = '';
const abonnes = new Set<(jour: string, plan: PlanGarde | null) => void>();
export const planGarde = () => dernier;
export const planDuJour = (jour: string) => (dernier?.jour === jour ? dernier : null);
export const planMemorise = (jour: string) => planDuJour(jour)?.texte ?? '';
export const memoriserPlan = (jour: string, texte: string, propositions: Proposition[] = [], details: DetailsPlan = {}) => {
  dernier = { pour: titulaire, jour, texte, propositions, ...details };
  abonnes.forEach((f) => f(jour, dernier));
};
/** Change de compte ou d'espace : le plan d'avant ne le suit pas. Vrai s'il y a eu changement. */
export function poserTitulaire(pour: string, jour: string): boolean {
  if (pour === titulaire) return false;
  titulaire = pour;
  dernier = null;
  abonnes.forEach((f) => f(jour, null));
  return true;
}
export const titulairePlan = () => titulaire;
/** Prévient quand un plan est préparé, d'où qu'il vienne (accueil, écran du copilote ou commande vocale). Renvoie de quoi se désabonner. */
export const surPlan = (f: (jour: string, plan: PlanGarde | null) => void) => {
  abonnes.add(f);
  return () => void abonnes.delete(f);
};

/** Un plan relu sur l'appareil : seulement celui de ce compte, de cet espace et de ce jour. */
export function lirePlanGarde(brut: unknown, pour: string, jour: string): PlanGarde | null {
  const p = brut as Partial<PlanGarde> | null;
  if (!p || typeof p !== 'object' || p.pour !== pour || p.jour !== jour || typeof p.texte !== 'string' || !p.texte.trim()) return null;
  const propositions = Array.isArray(p.propositions) ? p.propositions.filter((x) => x && typeof x.id === 'string' && typeof x.titre === 'string') : [];
  const base = p.base && Array.isArray(p.base.elements) && Array.isArray(p.base.rdv) ? p.base : undefined;
  return { pour, jour, texte: p.texte, propositions, ...(typeof p.heure === 'string' ? { heure: p.heure } : {}), ...(typeof p.contexte === 'string' && p.contexte ? { contexte: p.contexte } : {}), ...(base ? { base } : {}) };
}

/* ——— Le plan suit la journée ——— */

export type EvolutionPlan = { faits: { mots: string }[]; nouveaux: number; rdv: number };

/** Ce qui a bougé depuis le plan, sans refaire appel à l'IA. Une tâche créée depuis une proposition du plan n'est pas une nouveauté. */
export function evolutionPlan(g: Pick<PlanGarde, 'base' | 'propositions'>, e: Espace, d: string): EvolutionPlan | null {
  if (!g.base) return null;
  const mission = missionDuJour(e, d);
  const avant = new Set(g.base.elements.map((x) => x.cle));
  const parCle = new Map(mission.map((m) => [m.cle, m]));
  const proposees = new Set(g.propositions.map((p) => cle(p.titre)));
  const rdvAvant = new Set(g.base.rdv);
  return {
    faits: [...g.base.elements.filter((x) => parCle.get(x.cle)?.fait), ...mission.filter((m) => m.fait && !avant.has(m.cle) && proposees.has(cle(m.titre))).map((m) => ({ mots: m.titre }))],
    nouveaux: mission.filter((m) => !m.fait && !avant.has(m.cle) && !proposees.has(cle(m.titre))).length,
    rdv: (e.agenda[d] || []).filter((x) => !rdvAvant.has(cleRdv(x))).length,
  };
}

const MOTS_VIDES = new Set(['avec', 'pour', 'dans', 'chez', 'sur', 'des', 'les', 'une', 'aux', 'que', 'qui', 'mon', 'mes', 'ton', 'tes', 'par', 'est']);

/** Une ligne du plan qui parle de quelque chose de fait. La ligne qui annonce les priorités en cite plusieurs : elle reste. */
export function ligneFaite(ligne: string, faits: { mots: string }[]): boolean {
  const l = ` ${cle(ligne)} `;
  if (l.startsWith(' priorit')) return false;
  return faits.some((f) => {
    const mots = cle(f.mots).split(' ').filter((m) => m.length >= 3 && !MOTS_VIDES.has(m));
    return mots.length > 0 && mots.filter((m) => l.includes(` ${m} `)).length / mots.length >= 0.7;
  });
}

/** Le plan sans ce qui est fait, pour la lecture à voix haute. */
export const planRestant = (plan: string, faits: { mots: string }[]) =>
  plan
    .split('\n')
    .filter((l) => !ligneFaite(l, faits))
    .join('\n');
