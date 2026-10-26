/**
 * Devises des finances.
 *
 * Chaque espace a une devise principale (`Finances.devise`) : tous les budgets, totaux, prévisions et alertes serveur
 * sont calculés dans cette devise. Une dépense ou un revenu saisi dans une autre devise est converti à la saisie avec
 * le taux de l'espace (`Finances.taux`) ; le montant d'origine est gardé dans `origine` pour l'afficher et l'exporter.
 *
 * `cle` est ce qui est enregistré dans l'espace : les anciens libellés (« € », « $ », « FCFA », « £ », « CHF ») restent valides.
 * Ce fichier n'importe rien : il se teste avec `npm test`.
 */
export type DeviseInfo = { cle: string; code: string; nom: string; decimales: number; alias: string[]; /** Ce qu'on écrit après un montant quand l'usage diffère de la clé (« 5 000 FC » pour le franc congolais). */ symbole?: string };

export const DEVISES: DeviseInfo[] = [
  { cle: '€', code: 'EUR', nom: 'Euro', decimales: 2, alias: ['eur', 'euro', 'euros'] },
  { cle: '$', code: 'USD', nom: 'Dollar américain', decimales: 2, alias: ['usd', 'dollar', 'dollars'] },
  { cle: 'FCFA', code: 'XAF', nom: 'Franc CFA', decimales: 0, alias: ['fcfa', 'cfa', 'xaf', 'xof'] },
  { cle: 'CDF', code: 'CDF', nom: 'Franc congolais', decimales: 0, alias: ['cdf', 'fc', 'franc congolais', 'francs congolais', 'congolais'], symbole: 'FC' },
  { cle: '£', code: 'GBP', nom: 'Livre sterling', decimales: 2, alias: ['gbp'] },
  { cle: 'CHF', code: 'CHF', nom: 'Franc suisse', decimales: 2, alias: ['chf'] },
  { cle: 'CAD', code: 'CAD', nom: 'Dollar canadien', decimales: 2, alias: ['cad'] },
  { cle: 'MAD', code: 'MAD', nom: 'Dirham marocain', decimales: 2, alias: ['mad', 'dirham', 'dirhams'] },
  { cle: 'TND', code: 'TND', nom: 'Dinar tunisien', decimales: 3, alias: ['tnd', 'dinar', 'dinars'] },
  { cle: 'DZD', code: 'DZD', nom: 'Dinar algérien', decimales: 2, alias: ['dzd'] },
  { cle: 'NGN', code: 'NGN', nom: 'Naira', decimales: 2, alias: ['ngn', 'naira'] },
  { cle: 'GHS', code: 'GHS', nom: 'Cedi', decimales: 2, alias: ['ghs', 'cedi'] },
  { cle: 'ZAR', code: 'ZAR', nom: 'Rand', decimales: 2, alias: ['zar', 'rand'] },
  { cle: 'JPY', code: 'JPY', nom: 'Yen', decimales: 0, alias: ['jpy', 'yen'] },
  { cle: 'CNY', code: 'CNY', nom: 'Yuan', decimales: 2, alias: ['cny', 'yuan'] },
  { cle: 'INR', code: 'INR', nom: 'Roupie indienne', decimales: 2, alias: ['inr', 'roupie', 'roupies'] },
  { cle: 'BRL', code: 'BRL', nom: 'Réal', decimales: 2, alias: ['brl'] },
  { cle: 'AED', code: 'AED', nom: 'Dirham des Émirats', decimales: 2, alias: ['aed'] },
];

export const DEVISE_DEFAUT = '€';

/**
 * Taux de référence : valeur d'1 unité de chaque devise en dollars américains. Ce sont des ordres de grandeur arrondis,
 * pas des cours en direct : ils servent tant que tu n'as pas donné ton propre taux (qui est toujours prioritaire).
 */
export const REFERENCE_USD: Record<string, number> = {
  $: 1,
  '€': 1.08,
  '£': 1.27,
  CHF: 1.13,
  CAD: 0.73,
  MAD: 0.1,
  CDF: 0.00035,
  FCFA: 0.00165,
  TND: 0.32,
  DZD: 0.0074,
  NGN: 0.00065,
  GHS: 0.065,
  ZAR: 0.055,
  JPY: 0.0067,
  CNY: 0.138,
  INR: 0.012,
  BRL: 0.18,
  AED: 0.272,
};

/** Montant saisi dans une autre devise que la principale : ce qu'il valait à l'origine. */
export type Origine = { montant: number; devise: string };
/** Taux de conversion : combien d'unités de la devise principale vaut 1 unité de la devise. */
export type Taux = Record<string, number>;

export const infoDevise = (cle: string | undefined | null): DeviseInfo => DEVISES.find((d) => d.cle === cle) ?? { cle: cle || DEVISE_DEFAUT, code: cle || DEVISE_DEFAUT, nom: cle || DEVISE_DEFAUT, decimales: 2, alias: [] };
export const connue = (cle: string | undefined | null) => DEVISES.some((d) => d.cle === cle);

/** Reconnaît une devise dans un mot de la phrase (« usd », « dollars », « $ ») ; null si inconnue. */
export function lireDevise(mot: string): string | null {
  const m = mot.trim().toLowerCase();
  if (!m) return null;
  return DEVISES.find((d) => d.cle.toLowerCase() === m || d.alias.includes(m))?.cle ?? null;
}

/** Expression régulière (sans groupe) qui reconnaît toutes les devises dans une phrase, pour `phrase.ts`. */
export const MOTIFS_DEVISES = ['€', '\\$', '£', ...DEVISES.flatMap((d) => [d.cle, ...d.alias]).filter((x) => !/^[€$£]$/.test(x))]
  .sort((a, b) => b.length - a.length)
  .join('|');

const arrondiA = (n: number, decimales: number) => {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Valeur d'un taux utilisable (nombre fini > 0), sinon null. */
export const tauxValide = (t: unknown): t is number => typeof t === 'number' && Number.isFinite(t) && t > 0;

/**
 * Valeur d'1 unité de `devise` dans la devise principale : ton taux s'il existe, sinon le taux de référence (via le dollar).
 * Null si une des deux devises n'a ni l'un ni l'autre.
 */
export function tauxEffectif(devise: string, principal: string, taux: Taux | undefined): number | null {
  if (devise === principal) return 1;
  const t = taux?.[devise];
  if (tauxValide(t)) return t;
  const a = REFERENCE_USD[devise];
  const b = REFERENCE_USD[principal];
  return tauxValide(a) && tauxValide(b) ? a / b : null;
}

/** Vrai si le taux vient de ta saisie, faux s'il s'agit du taux de référence. */
export const tauxPerso = (devise: string, taux: Taux | undefined) => tauxValide(taux?.[devise]);

/** Convertit un montant dans la devise principale. Null si aucun taux n'est connu. */
export function versPrincipal(montant: number, devise: string, principal: string, taux: Taux | undefined): number | null {
  if (devise === principal) return montant;
  const t = tauxEffectif(devise, principal, taux);
  return t === null ? null : arrondiA(montant * t, infoDevise(principal).decimales);
}

/** Convertit un montant de la devise principale vers une autre (pour afficher l'équivalent). Null sans taux. */
export function depuisPrincipal(montant: number, devise: string, principal: string, taux: Taux | undefined): number | null {
  if (devise === principal) return montant;
  const t = tauxEffectif(devise, principal, taux);
  return t === null ? null : arrondiA(montant / t, infoDevise(devise).decimales);
}

/** Formate un montant : « 1 200 € », « 12,50 $ », « 3 000 FCFA », « 5 000 FC ». Les décimales suivent la devise. */
export function fmtDevise(n: number, cle: string): string {
  const info = infoDevise(cle);
  const d = info.decimales;
  const entier = Math.abs(n - Math.round(n)) < 0.005;
  const dec = entier ? 0 : Math.max(d, 2) > 2 ? d : 2;
  const txt = n.toLocaleString('fr-FR', { minimumFractionDigits: d === 0 ? 0 : dec, maximumFractionDigits: d === 0 ? 0 : dec });
  return `${txt} ${info.symbole ?? cle}`;
}

/** Nom d'une devise dans les listes de choix : « CDF · Franc congolais ». */
export const libelleDevise = (cle: string) => {
  const i = infoDevise(cle);
  return i.nom === cle ? cle : `${cle} · ${i.nom}`;
};

/** Texte à afficher sous un montant converti : « 20 $ » ; null si saisi dans la devise principale. */
export const libelleOrigine = (o: Origine | undefined | null, principal: string) => (o && o.devise !== principal ? fmtDevise(o.montant, o.devise) : null);

/**
 * Prépare une saisie dans `devise` : le montant à enregistrer (en devise principale) et, si besoin, l'origine.
 * Null quand la devise n'a pas de taux : l'appelant demande alors de le renseigner.
 */
export function saisie(montant: number, devise: string, principal: string, taux: Taux | undefined): { montant: number; origine?: Origine } | null {
  if (devise === principal) return { montant };
  const m = versPrincipal(montant, devise, principal, taux);
  return m === null ? null : { montant: m, origine: { montant, devise } };
}

/** Taux à retenir après un changement de devise principale (`ancienne` → `nouvelle`) : tes taux sont ramenés à la nouvelle devise. */
export function changerPrincipal(ancienne: string, nouvelle: string, taux: Taux | undefined): Taux {
  const r = tauxEffectif(nouvelle, ancienne, taux); // 1 nouvelle = r anciennes
  if (r === null) return {};
  const sortie: Taux = { [ancienne]: arrondiA(1 / r, 8) };
  for (const k of Object.keys(taux ?? {})) {
    if (k === nouvelle || k === ancienne) continue;
    const t = tauxEffectif(k, ancienne, taux);
    if (t !== null) sortie[k] = arrondiA(t / r, 8);
  }
  return sortie;
}

type AvecOrigine = { montant: number; origine?: Origine };
/** Un montant converti dans la nouvelle devise principale ; l'origine garde la valeur d'avant pour ne rien perdre (et revenir exactement). */
function convertirLigne<T extends AvecOrigine>(x: T, ancienne: string, nouvelle: string, r: number): T {
  const { origine, ...reste } = x;
  // Déjà saisi dans la devise visée : on retrouve le montant exact d'origine.
  if (origine && origine.devise === nouvelle) return { ...reste, montant: origine.montant } as unknown as T;
  const montant = arrondiA(x.montant * r, infoDevise(nouvelle).decimales);
  return { ...reste, montant, origine: origine ?? { montant: x.montant, devise: ancienne } } as unknown as T;
}

/**
 * Passe tous les finances dans une autre devise principale, montants compris (budgets, dépenses, revenus, récurrences).
 * Les montants déjà saisis dans une autre devise gardent leur origine ; les autres reçoivent l'ancien montant comme origine.
 * Null si aucun taux n'est connu entre les deux devises.
 */
export function convertirFinances<F extends FinancesLike>(f: F, nouvelle: string): F | null {
  if (f.devise === nouvelle) return f;
  const valeurNouvelle = tauxEffectif(nouvelle, f.devise, f.taux); // 1 nouvelle = x anciennes (les taux sont relatifs à l'ancienne devise)
  if (valeurNouvelle === null) return null;
  const r = 1 / valeurNouvelle; // 1 ancienne = r nouvelles
  const dec = infoDevise(nouvelle).decimales;
  const ancienne = f.devise;
  return {
    ...f,
    devise: nouvelle,
    taux: changerPrincipal(ancienne, nouvelle, f.taux),
    budgets: f.budgets.map((b) => ({ ...b, montant: arrondiA(b.montant * r, dec) })),
    depenses: f.depenses.map((x) => convertirLigne(x, ancienne, nouvelle, r)),
    revenus: f.revenus?.map((x) => convertirLigne(x, ancienne, nouvelle, r)),
    recurrences: f.recurrences?.map((x) => convertirLigne(x, ancienne, nouvelle, r)),
  } as F;
}

/** Forme minimale des finances (évite d'importer tous les types dans ce fichier). */
export type FinancesLike = {
  devise: string;
  taux?: Taux;
  budgets: { montant: number }[];
  depenses: AvecOrigine[];
  revenus?: AvecOrigine[];
  recurrences?: AvecOrigine[];
};
