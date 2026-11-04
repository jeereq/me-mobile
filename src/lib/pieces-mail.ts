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

/** Ce qui se montre dans l'app : le reste se télécharge. */
export type GenreApercu = 'image' | 'pdf' | 'texte';

const PAR_EXTENSION: Record<string, GenreApercu> = { pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', txt: 'texte', csv: 'texte' };

/** Le genre d'aperçu d'un fichier, d'après son type, ou son extension si le type ne dit rien. */
export function genreApercu(p: { nom: string; type?: string }): GenreApercu | null {
  const t = (p.type ?? '').split(';')[0].trim().toLowerCase();
  if (t === 'application/pdf') return 'pdf';
  if (/^image\/(png|jpe?g|gif|webp)$/.test(t)) return 'image';
  if (t === 'text/plain' || t === 'text/csv') return 'texte';
  if (t && t !== 'application/octet-stream') return null;
  return PAR_EXTENSION[/\.([a-z0-9]+)$/i.exec(p.nom)?.[1]?.toLowerCase() ?? ''] ?? null;
}

/** Un texte trop long n'est montré qu'en partie : au-delà, il vaut mieux le télécharger. */
export const MAX_TEXTE_APERCU = 200_000;

