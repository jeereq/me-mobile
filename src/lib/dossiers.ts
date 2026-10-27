import type { IconeNom } from '@/components/icones';

import type { DossierMail, GenreDossier } from './sync';

/**
 * Les dossiers d'une boîte, comme le volet d'Outlook : rangés par le serveur (réception, envoyés… puis les autres),
 * chaque sous-dossier sous son parent, avec sa profondeur pour le retrait. Module pur.
 */

export type DossierAffiche = DossierMail & { profondeur: number; aEnfants: boolean };

/** La profondeur de chaque dossier (0 = premier niveau) et s'il a des sous-dossiers ; un dossier replié cache ses enfants. */
export function arbreDossiers(l: DossierMail[], replies: Set<string> = new Set()): DossierAffiche[] {
  const parId = new Map(l.map((d) => [d.id, d]));
  const profondeur = (d: DossierMail, n = 0): number => (d.parent && parId.has(d.parent) && n < 5 ? profondeur(parId.get(d.parent)!, n + 1) : n);
  const parents = new Set(l.map((d) => d.parent).filter(Boolean));
  const cache = (d: DossierMail): boolean => !!d.parent && parId.has(d.parent) && (replies.has(d.parent) || cache(parId.get(d.parent)!));
  return l.filter((d) => !cache(d)).map((d) => ({ ...d, profondeur: profondeur(d), aEnfants: parents.has(d.id) }));
}

export const ICONE_DOSSIER: Record<GenreDossier, IconeNom> = {
  reception: 'mail',
  envoyes: 'envoyer',
  brouillons: 'crayon',
  archive: 'archive',
  supprimes: 'corbeille',
  indesirables: 'bouclier',
  suivis: 'etoile',
  importants: 'eclair',
  autre: 'dossier',
};

/** Le dossier de réception d'une liste (là où tombent les mails de la boîte de Me). */
export const reception = (l: DossierMail[]) => l.find((d) => d.genre === 'reception');

/** Les dossiers où l'on peut ranger un mail : pas les brouillons ni les envoyés, et pas celui où il est déjà (passer l'arbre complet garde les retraits). */
export const destinations = <D extends DossierMail>(l: D[], depuis?: string): D[] => l.filter((d) => d.genre !== 'brouillons' && d.genre !== 'envoyes' && d.id !== depuis);
