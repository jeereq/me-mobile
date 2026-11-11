import type { EtatTache } from './types';

const normaliser = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Où en est une tâche qui n'est pas finie, au-delà de « à faire » et « fait » :
 * pas encore décidée (proposée, à valider, en pipeline) ou arrêtée (bloquée).
 * Une tâche en cours se reconnaît à son avancement.
 */
export const ETATS: { cle: EtatTache; nom: string; aide: string; /** Le travail n'est pas encore confirmé : il pèse moins sur la charge. */ incertain: boolean }[] = [
  { cle: 'propose', nom: 'Proposé', aide: 'Suggéré, pas encore étudié', incertain: true },
  { cle: 'a_valider', nom: 'À valider', aide: 'Attend une décision', incertain: true },
  { cle: 'pipeline', nom: 'Pipeline', aide: 'Dans les projets à venir', incertain: true },
  { cle: 'bloque', nom: 'Bloqué', aide: 'Arrêté tant qu\'un obstacle n\'est pas levé', incertain: false },
];

export const nomEtat = (e: EtatTache) => ETATS.find((x) => x.cle === e)?.nom ?? e;
export const estIncertain = (e: EtatTache | undefined) => !!e && !!ETATS.find((x) => x.cle === e)?.incertain;

/** « Proposé – à valider », « Pipeline », « Bloquée (attente fournisseur) » → l'état ; null si le texte n'en dit rien. */
export function lireEtatTache(texte: string | null | undefined): EtatTache | null {
  const n = normaliser(texte);
  if (!n) return null;
  if (/(^| )(bloque|bloquee|blocked|suspendu|suspendue|en pause|on hold)( |$)/.test(n)) return 'bloque';
  if (/(a valider|a confirmer|a approuver|en attente de validation|to validate|to approve|pending approval)/.test(n)) return 'a_valider';
  if (/^(propose|proposee|proposed|suggere|suggeree)( |$)/.test(n)) return 'propose';
  if (/^(pipeline|en projet|a l etude|a venir|backlog)( |$)/.test(n)) return 'pipeline';
  return null;
}
