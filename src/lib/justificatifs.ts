import { DEVISES } from './devises';
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

/** Ce que me-api a lu sur une facture (`POST /justificatifs/analyse`) ; un champ illisible vaut null. */
export type LectureFacture = {
  facture: boolean;
  montant: number | null;
  /** Code ISO 4217 (USD, EUR, CDF…). */
  devise: string | null;
  date: string | null;
  heure: string | null;
  marchand: string | null;
  description: string | null;
  categorie: string | null;
  confiance: 'haute' | 'moyenne' | 'basse';
};

/** La clé de devise de l'app (« $ », « € », « CDF »…) pour un code ISO lu sur la facture ; null si l'app ne la connaît pas. */
export function cleDevise(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  const d = DEVISES.find((x) => x.code === c || x.cle.toUpperCase() === c || x.alias.includes(c.toLowerCase()));
  return d ? d.cle : null;
}

/** Ce qu'une lecture change dans le formulaire de dépense : seulement les champs lus, le reste garde ce qui est saisi. */
export type Remplissage = { montant?: string; devise?: string; date?: string; heure?: string; note?: string; categories?: string[]; message: string; aRelire: boolean };

/** Traduit une lecture en champs du formulaire et en une phrase qui dit ce qui a été rempli et ce qu'il faut relire. */
export function remplissage(l: LectureFacture, devisePrincipale: string, categoriesConnues: string[] = []): Remplissage {
  if (!l.facture) return { message: "L'IA ne voit pas de facture ni de reçu sur ce fichier : il reste joint, remplis la dépense à la main.", aRelire: true };
  const r: Remplissage = { message: '', aRelire: l.confiance !== 'haute' };
  const remplis: string[] = [];
  if (l.montant !== null) {
    r.montant = (Number.isInteger(l.montant) ? String(l.montant) : l.montant.toFixed(2)).replace('.', ',');
    remplis.push('le montant');
  }
  const devise = cleDevise(l.devise);
  if (devise && devise !== devisePrincipale) r.devise = devise;
  if (l.date) {
    r.date = l.date;
    remplis.push('la date');
  }
  if (l.heure) r.heure = l.heure;
  const note = [l.marchand, l.description].filter(Boolean).join(' · ');
  if (note) {
    r.note = note.slice(0, 140);
    remplis.push(l.marchand ? 'le commerçant' : 'la note');
  }
  if (l.categorie && categoriesConnues.includes(l.categorie)) {
    r.categories = [l.categorie];
    remplis.push('la catégorie');
  }
  if (!remplis.length) return { ...r, message: "L'IA n'a rien pu lire de sûr sur ce fichier : il reste joint, remplis la dépense à la main.", aRelire: true };
  const liste = remplis.length > 1 ? `${remplis.slice(0, -1).join(', ')} et ${remplis[remplis.length - 1]}` : remplis[0];
  const devisePas = l.devise && !devise ? ` La devise lue (${l.devise}) n'est pas dans Me : vérifie le montant.` : '';
  r.message = `${liste[0].toUpperCase()}${liste.slice(1)} ${remplis.length > 1 ? 'ont été remplis' : 'a été rempli'} d'après la facture.${l.montant === null ? " Le total n'a pas pu être lu : indique-le." : ''}${devisePas} ${r.aRelire ? 'Image peu nette : relis bien avant d’ajouter.' : 'Relis avant d’ajouter.'}`;
  if (l.montant === null || devisePas) r.aRelire = true;
  return r;
}
