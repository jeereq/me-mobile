import type { FichierChoisi } from './justificatifs';

export const MAX_PIECES = 10;
export const MAX_PIECES_OCTETS = 20 * 1024 * 1024;

/** Une pièce jointe d'un mail reçu, de quoi l'ouvrir. */
export type PieceMail = { id: string; nom: string; taille?: number; type?: string };

/** Ajoute les fichiers qui tiennent : un fichier déjà là n'est pas repris, ce qui dépasse est signalé en clair. */
export function ajouterPieces(liste: FichierChoisi[], nouvelles: FichierChoisi[]): { liste: FichierChoisi[]; refus: string | null } {
  const out = [...liste];
  let refus: string | null = null;
  let total = liste.reduce((n, f) => n + (f.taille ?? 0), 0);
  for (const f of nouvelles) {
    if (out.some((x) => x.nom === f.nom && x.taille === f.taille)) continue;
    if (f.taille === 0) refus = `« ${f.nom} » est vide.`;
    else if (out.length >= MAX_PIECES) refus = `${MAX_PIECES} pièces jointes au plus.`;
    else if (total + (f.taille ?? 0) > MAX_PIECES_OCTETS) refus = `« ${f.nom} » dépasse la limite de 20 Mo par mail.`;
    else {
      out.push(f);
      total += f.taille ?? 0;
    }
  }
  return { liste: out, refus };
}

/** Le texte de confirmation : « avec 2 pièces jointes », ou rien. */
export const avecPieces = (n: number) => (n ? ` avec ${n} pièce${n > 1 ? 's' : ''} jointe${n > 1 ? 's' : ''}` : '');
