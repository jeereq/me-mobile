import { sansAccents } from './recherche';
import { lireDate } from './stats-finances';
import type { Finances } from './types';

/**
 * Import d'un relevé bancaire exporté en CSV : séparateur, colonnes et format des montants sont devinés,
 * chaque opération reçoit un budget suggéré, et celles déjà notées (même date, même montant) sont repérées.
 */

export type LigneReleve = { cle: string; date: string; libelle: string; montant: number; genre: 'depense' | 'revenu'; budget: string | null; doublon: boolean };

/** Découpe un CSV en lignes et cellules, guillemets compris. */
function decouper(texte: string, sep: string) {
  const lignes: string[][] = [];
  let cellule = '';
  let ligne: string[] = [];
  let guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') {
        cellule += '"';
        i++;
      } else if (c === '"') guillemets = false;
      else cellule += c;
    } else if (c === '"') guillemets = true;
    else if (c === sep) {
      ligne.push(cellule.trim());
      cellule = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(cellule.trim());
      if (ligne.some(Boolean)) lignes.push(ligne);
      ligne = [];
      cellule = '';
    } else cellule += c;
  }
  ligne.push(cellule.trim());
  if (ligne.some(Boolean)) lignes.push(ligne);
  return lignes;
}

/** « -1 234,56 € », « 1,234.56 », « (12.50) », « +45 » → nombre signé ; null sinon. */
export function lireSomme(s: string) {
  let t = s.replace(/[\s  €$£]|EUR|CHF|FCFA|XAF|XOF/gi, '');
  if (!t) return null;
  let signe = 1;
  if (/^\(.*\)$/.test(t)) {
    signe = -1;
    t = t.slice(1, -1);
  }
  if (/^[−–-]/.test(t)) {
    signe = -signe;
    t = t.slice(1);
  } else if (t.startsWith('+')) t = t.slice(1);
  if (/[−–-]$/.test(t)) {
    signe = -signe;
    t = t.slice(0, -1);
  }
  if (!/^[\d.,']+$/.test(t)) return null;
  // Le dernier séparateur suivi d'1 ou 2 chiffres est la virgule décimale ; les autres séparent les milliers.
  const dec = /[.,](\d{1,2})$/.exec(t);
  const entier = (dec ? t.slice(0, -dec[0].length) : t).replace(/[.,']/g, '');
  const n = Number(`${entier}${dec ? `.${dec[1]}` : ''}`);
  return Number.isFinite(n) ? signe * n : null;
}

const RE = {
  date: /date/,
  libelle: /libel|label|description|operation|intitule|detail|wording|motif|beneficiaire|nature/,
  montant: /montant|amount|somme/,
  debit: /debit|sortie|depense/,
  credit: /credit|entree|recette/,
};

/** Nettoie un libellé bancaire : « CB CARREFOUR 12/10 » → « Carrefour ». */
export function nettoyerLibelle(s: string) {
  const t = s
    .replace(/\s+/g, ' ')
    .replace(/^(paiement par carte|paiement cb|carte x?\d*|cb\*?\d*|prlv( sepa)?|prelevement( sepa)?|vir( sepa)?( recu| inst(antane)?| permanent)?|virement( sepa)?( recu| emis)?( de| a)?|retrait( dab)?)\s+/i, '')
    .replace(/\s+\d{2}[/.]\d{2}([/.]\d{2,4})?$/, '')
    .replace(/\s+(fact|carte)\s+\S+$/i, '')
    .trim();
  const propre = t.length > 2 && t === t.toUpperCase() ? t.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (x) => x.toUpperCase()) : t;
  return propre.slice(0, 60);
}

// Mots-clés fréquents sur les relevés, rattachés à des noms de budget courants.
const MOTS: [RegExp, RegExp][] = [
  [/carrefour|leclerc|auchan|lidl|aldi|intermarche|monoprix|franprix|casino|super ?u|picard|biocoop|marche|epicerie|supermarche/, /course|aliment|super/],
  [/sncf|ratp|uber(?!.*eats)|bolt|heetch|blablacar|total|esso|shell|bp |carburant|essence|peage|parking|navigo|vinci/, /transport|voiture|essence/],
  [/restaurant|resto|deliveroo|uber ?eats|just ?eat|mcdo|burger|pizza|cafe|bar |brasserie|cinema|ugc|pathe|fnac|spotify|netflix|deezer/, /sortie|resto|loisir|abonnement/],
  [/loyer|edf|engie|eau|free|orange|sfr|bouygues|assurance|syndic|habitation/, /logement|maison|loyer|facture|charge/],
  [/pharmacie|medecin|docteur|dentiste|mutuelle|hopital|clinique|ameli/, /sante|medic/],
  [/zara|h&m|kiabi|decathlon|vetement|uniqlo|primark/, /vetement|habit/],
];

/** Budget suggéré : celui des dépenses passées au même libellé, sinon par mots-clés. */
function suggerer(f: Finances, libelle: string) {
  const l = sansAccents(libelle);
  const passe = new Map<string, number>();
  for (const x of f.depenses) if (x.budget && sansAccents(x.note) === l) passe.set(x.budget, (passe.get(x.budget) || 0) + 1);
  if (passe.size) return [...passe.entries()].sort((a, z) => z[1] - a[1])[0][0];
  const categories = f.budgets.filter((b) => !b.global);
  const parNom = categories.find((b) => sansAccents(b.nom).length > 2 && l.includes(sansAccents(b.nom)));
  if (parNom) return parNom.id;
  for (const [mot, budget] of MOTS) {
    if (!mot.test(l)) continue;
    const b = categories.find((x) => budget.test(sansAccents(x.nom)));
    if (b) return b.id;
  }
  return null;
}

export function lireReleve(texte: string, f: Finances, aujourdhui: string): { lignes: LigneReleve[]; erreur?: string } {
  const brut = texte.replace(/^﻿/, '');
  const echantillon = brut.split(/\r?\n/).slice(0, 15).join('\n');
  const sep = [';', '\t', ',', '|'].map((s) => ({ s, n: echantillon.split(s).length })).sort((a, z) => z.n - a.n)[0].s;
  const table = decouper(brut, sep);
  if (table.length < 1) return { lignes: [], erreur: 'Le fichier est vide.' };

  // En-tête : la première ligne (parmi les 15 premières) qui nomme une date et un montant.
  let entete = -1;
  let col = { date: -1, libelle: -1, montant: -1, debit: -1, credit: -1 };
  for (let i = 0; i < Math.min(15, table.length) && entete < 0; i++) {
    const t = table[i].map(sansAccents);
    const trouve = (re: RegExp, sauf: number[] = []) => t.findIndex((x, j) => re.test(x) && !sauf.includes(j));
    const c = { date: trouve(RE.date), libelle: -1, montant: -1, debit: trouve(RE.debit), credit: trouve(RE.credit) };
    c.montant = trouve(RE.montant, [c.date, c.debit, c.credit]);
    c.libelle = trouve(RE.libelle, [c.date, c.montant, c.debit, c.credit]);
    if (c.date >= 0 && (c.montant >= 0 || c.debit >= 0 || c.credit >= 0)) {
      entete = i;
      col = c;
    }
  }

  const donnees = table.slice(entete + 1);
  const largeur = Math.max(...donnees.map((r) => r.length));
  const part = (j: number, ok: (s: string) => boolean) => donnees.filter((r) => r[j] && ok(r[j])).length / Math.max(1, donnees.length);
  // Sans en-tête reconnu : la colonne de dates, la dernière colonne de montants et le texte le plus long.
  if (col.date < 0) col.date = [...Array(largeur).keys()].find((j) => part(j, (s) => !!lireDate(s.split(/[\sT]/)[0], aujourdhui)) > 0.6) ?? -1;
  if (col.montant < 0 && col.debit < 0 && col.credit < 0) col.montant = [...Array(largeur).keys()].reverse().find((j) => j !== col.date && part(j, (s) => lireSomme(s) !== null) > 0.6) ?? -1;
  if (col.libelle < 0) {
    const longueur = (j: number) => donnees.reduce((s, r) => s + (r[j] && lireSomme(r[j]) === null && !lireDate(r[j], aujourdhui) ? r[j].length : 0), 0);
    col.libelle = [...Array(largeur).keys()].filter((j) => ![col.date, col.montant, col.debit, col.credit].includes(j)).sort((a, z) => longueur(z) - longueur(a))[0] ?? -1;
  }
  if (col.date < 0 || (col.montant < 0 && col.debit < 0 && col.credit < 0)) return { lignes: [], erreur: 'Colonnes de date et de montant introuvables. Vérifie que le fichier est bien un relevé exporté en CSV.' };

  const existants = new Set([...f.depenses.map((x) => `d:${x.date}:${x.montant}`), ...(f.revenus || []).map((x) => `r:${x.date}:${x.montant}`)]);
  const lignes: LigneReleve[] = [];
  donnees.forEach((r, i) => {
    const date = lireDate((r[col.date] || '').split(/[\sT]/)[0], aujourdhui);
    if (!date) return;
    let n: number | null = null;
    if (col.montant >= 0) n = lireSomme(r[col.montant] || '');
    else {
      const debit = col.debit >= 0 ? lireSomme(r[col.debit] || '') : null;
      const credit = col.credit >= 0 ? lireSomme(r[col.credit] || '') : null;
      if (debit) n = -Math.abs(debit);
      else if (credit) n = Math.abs(credit);
    }
    if (!n) return;
    const montant = Math.round(Math.abs(n) * 100) / 100;
    const genre = n < 0 ? 'depense' : 'revenu';
    const libelle = nettoyerLibelle(col.libelle >= 0 ? r[col.libelle] || '' : '');
    lignes.push({ cle: `${i}`, date, libelle, montant, genre, budget: genre === 'depense' ? suggerer(f, libelle) : null, doublon: existants.has(`${genre === 'depense' ? 'd' : 'r'}:${date}:${montant}`) });
  });
  if (!lignes.length) return { lignes, erreur: 'Aucune opération lisible dans ce fichier.' };
  return { lignes: lignes.sort((a, z) => z.date.localeCompare(a.date)) };
}
