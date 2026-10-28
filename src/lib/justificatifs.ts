import type { Justificatif } from './types';

/**
 * Justificatifs de dépenses : photos de reçus et PDF de factures. L'app envoie le fichier à me-api, qui le dépose
 * chez Cloudinary (la clé n'est jamais dans l'app) et renvoie une fiche, rangée dans `Depense.justificatifs`.
 * Un fichier retiré d'une dépense est effacé par le serveur une semaine plus tard (le temps d'« Annuler »).
 */

/** Un fichier choisi (appareil photo, galerie, fichiers) : sur le web, `file` est le fichier du navigateur. */
export type FichierChoisi = { uri: string; nom: string; type: string; taille?: number; file?: Blob };

export const TAILLE_MAX = 10 * 1024 * 1024;
export const MAX_PAR_DEPENSE = 10;

/** « 340 Ko », « 2,4 Mo ». */
export function tailleLisible(octets: number) {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(Math.round((octets / 1024 / 1024) * 10) / 10).toString().replace('.', ',')} Mo`;
}

/** Type d'un fichier choisi : celui donné par le téléphone, sinon d'après l'extension (Android renvoie parfois rien). */
export function typeDe(nom: string, type?: string | null) {
  if (type && type !== 'application/octet-stream') return type;
  const ext = /\.([a-z0-9]+)$/i.exec(nom)?.[1]?.toLowerCase();
  return ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'heic' || ext === 'heif' ? 'image/heic' : 'image/jpeg';
}

/** Ce qui empêche d'envoyer ce fichier, en clair, ou null. */
export function refus(f: FichierChoisi): string | null {
  const t = typeDe(f.nom, f.type);
  if (!t.startsWith('image/') && t !== 'application/pdf') return `« ${f.nom} » n'est ni une photo ni un PDF.`;
  if (f.taille && f.taille > TAILLE_MAX) return `« ${f.nom} » est trop lourd (${tailleLisible(f.taille)}, 10 Mo au plus).`;
  return null;
}

/** Libellé court sous la vignette : « PDF · 2 pages · 340 Ko », « Photo · 1,2 Mo ». */
export function detailJustificatif(j: Justificatif) {
  return [j.sorte === 'pdf' ? 'PDF' : 'Photo', j.pages && j.pages > 1 ? `${j.pages} pages` : null, tailleLisible(j.taille)].filter(Boolean).join(' · ');
}
