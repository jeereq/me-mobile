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

/** Ce qui se montre dans l'app : le reste se télécharge. Un tableur se montre en tableau, lu par le serveur. */
export type GenreApercu = 'image' | 'pdf' | 'texte' | 'tableur';

const PAR_EXTENSION: Record<string, GenreApercu> = { pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', txt: 'texte', csv: 'tableur', xlsx: 'tableur' };
const TABLEURS = ['text/csv', 'application/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

/** Le genre d'aperçu d'un fichier, d'après son type, ou son extension si le type ne dit rien. */
export function genreApercu(p: { nom: string; type?: string }): GenreApercu | null {
  const t = (p.type ?? '').split(';')[0].trim().toLowerCase();
  const ext = /\.([a-z0-9]+)$/i.exec(p.nom)?.[1]?.toLowerCase() ?? '';
  if (t === 'application/pdf') return 'pdf';
  if (/^image\/(png|jpe?g|gif|webp)$/.test(t)) return 'image';
  if (TABLEURS.includes(t) || (t === 'application/vnd.ms-excel' && ext === 'csv')) return 'tableur';
  if (t === 'text/plain') return ext === 'csv' ? 'tableur' : 'texte';
  if (t && t !== 'application/octet-stream') return null;
  return PAR_EXTENSION[ext] ?? null;
}

/** Les lignes d'un tableur joint, telles que me-api les a lues. */
export type Tableau = { colonnes: string[]; lignes: string[][]; totalLignes: number; feuille?: string | null };

export type NaturePiece = 'facture' | 'recu' | 'releve' | 'devis' | 'contrat' | 'tableau' | 'courrier' | 'autre';
export const NATURES_PIECE: Record<NaturePiece, string> = { facture: 'Facture', recu: 'Reçu', releve: 'Relevé', devis: 'Devis', contrat: 'Contrat', tableau: 'Tableau', courrier: 'Courrier', autre: 'Document' };

/** Ce que l'IA a lu dans une pièce jointe (`POST …/pieces/:piece/analyse`). Rien n'est enregistré. */
export type AnalysePiece = {
  nature: NaturePiece;
  titre: string | null;
  resume: string | null;
  champs: { libelle: string; valeur: string }[];
  depense: { montant: number; devise: string | null; date: string | null; marchand: string | null; description: string | null } | null;
  echeance: string | null;
  tableau: Tableau | null;
};

/** « 200 lignes sur 512 », ou « 12 lignes ». */
export function lignesMontrees(t: Tableau): string {
  const n = t.lignes.length;
  const l = (x: number) => `${x} ligne${x > 1 ? 's' : ''}`;
  return t.totalLignes > n ? `${l(n)} sur ${t.totalLignes}` : l(n);
}

/** Le tableau à coller dans un tableur : colonnes séparées par des tabulations. */
export const tableauTsv = (t: Tableau) => [t.colonnes, ...t.lignes].map((l) => l.map((c) => c.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');

/** De quoi ouvrir le formulaire de dépense déjà rempli ; on relit avant d'ajouter. */
export function depenseDeLaPiece(a: AnalysePiece, n: number): { ajout: string; montant: string; note: string } | null {
  const d = a.depense;
  if (!d || !(d.montant > 0)) return null;
  const note = [d.marchand, d.description].filter(Boolean).join(' : ') || a.titre || '';
  return { ajout: String(n), montant: String(d.montant).replace('.', ','), note: note.slice(0, 120) };
}

/** Un texte trop long n'est montré qu'en partie : au-delà, il vaut mieux le télécharger. */
export const MAX_TEXTE_APERCU = 200_000;

