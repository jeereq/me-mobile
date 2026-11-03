import type { ActionMail, AnalyseLot, AnalyseMail } from './copilote';
import type { Mail } from './mails';
import { MAX_MAILS_ANALYSE } from './copilote';

/** Le travail d'une analyse de mails, gardé sur l'appareil pour la reprendre : réponses modifiées, coches, ce qui est déjà traité. Module pur. */
export type Rangement = 'lu' | 'archiver';
export type RepriseAnalyse = {
  pour: string;
  quand: string;
  mails: Mail[];
  perimetre?: string;
  consignes: string;
  suivant: number;
  analyses: AnalyseMail[];
  textes: Record<string, string>;
  decoches: string[];
  envoyes: string[];
  taches: string[];
  ranges: Record<string, Rangement>;
  lot?: Omit<AnalyseLot, 'analyses'>;
  introuvables: number;
};

const SEPT_JOURS = 7 * 864e5;

/** Ce qu'une analyse garde encore à faire : un mail traité n'y compte plus, un mail pas encore analysé si. */
export function resteATraiter(r: Pick<RepriseAnalyse, 'mails' | 'suivant' | 'analyses' | 'envoyes' | 'taches' | 'ranges'>): number {
  const fait: Record<ActionMail, (id: string) => boolean> = { repondre: (id) => r.envoyes.includes(id), tache: (id) => r.taches.includes(id), rien: () => false };
  const ouverts = r.analyses.filter((a) => !r.ranges[a.id] && !fait[a.action](a.id)).length;
  return ouverts + Math.max(0, r.mails.length - r.suivant * MAX_MAILS_ANALYSE);
}

/** Une reprise relue : refusée si elle est abîmée ou trop ancienne, les mails ont pu changer depuis. */
export function lireReprise(brut: unknown, maintenant: number): RepriseAnalyse | null {
  const r = brut as Partial<RepriseAnalyse> | null;
  if (!r || typeof r !== 'object' || typeof r.pour !== 'string' || typeof r.quand !== 'string') return null;
  if (!Array.isArray(r.mails) || !Array.isArray(r.analyses) || !r.analyses.length || typeof r.suivant !== 'number') return null;
  const age = maintenant - Date.parse(r.quand);
  if (!(age >= 0 && age <= SEPT_JOURS)) return null;
  return {
    pour: r.pour,
    quand: r.quand,
    mails: r.mails,
    ...(r.perimetre ? { perimetre: r.perimetre } : {}),
    consignes: typeof r.consignes === 'string' ? r.consignes : '',
    suivant: r.suivant,
    analyses: r.analyses,
    textes: r.textes && typeof r.textes === 'object' ? r.textes : {},
    decoches: Array.isArray(r.decoches) ? r.decoches : [],
    envoyes: Array.isArray(r.envoyes) ? r.envoyes : [],
    taches: Array.isArray(r.taches) ? r.taches : [],
    ranges: r.ranges && typeof r.ranges === 'object' ? r.ranges : {},
    ...(r.lot ? { lot: r.lot } : {}),
    introuvables: typeof r.introuvables === 'number' ? r.introuvables : 0,
  };
}

/** Depuis quand, en quelques mots. */
export function depuisQuand(iso: string, maintenant: number): string {
  const min = Math.floor((maintenant - Date.parse(iso)) / 6e4);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return j === 1 ? 'hier' : `il y a ${j} jours`;
}

/** Des mails rangés par compte, en lots que le serveur accepte. */
export function lotsParCompte<T extends { compte: string; element: string }>(refs: T[], taille = 50): { compte: string; elements: string[] }[] {
  const par = new Map<string, string[]>();
  for (const r of refs) par.set(r.compte, [...(par.get(r.compte) ?? []), r.element]);
  return [...par].flatMap(([compte, l]) => {
    const out: { compte: string; elements: string[] }[] = [];
    for (let i = 0; i < l.length; i += taille) out.push({ compte, elements: l.slice(i, i + taille) });
    return out;
  });
}
