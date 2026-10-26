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
export type DeviseInfo = { cle: string; code: string; nom: string; decimales: number; alias: string[] };

export const DEVISES: DeviseInfo[] = [
  { cle: '€', code: 'EUR', nom: 'Euro', decimales: 2, alias: ['eur', 'euro', 'euros'] },
  { cle: '$', code: 'USD', nom: 'Dollar américain', decimales: 2, alias: ['usd', 'dollar', 'dollars'] },
  { cle: 'FCFA', code: 'XAF', nom: 'Franc CFA', decimales: 0, alias: ['fcfa', 'cfa', 'xaf', 'xof'] },
  { cle: '£', code: 'GBP', nom: 'Livre sterling', decimales: 2, alias: ['gbp'] },
  { cle: 'CHF', code: 'CHF', nom: 'Franc suisse', decimales: 2, alias: ['chf'] },
  { cle: 'CAD', code: 'CAD', nom: 'Dollar canadien', decimales: 2, alias: ['cad'] },
  { cle: 'MAD', code: 'MAD', nom: 'Dirham marocain', decimales: 2, alias: ['mad', 'dirham', 'dirhams'] },
  { cle: 'CDF', code: 'CDF', nom: 'Franc congolais', decimales: 0, alias: ['cdf'] },
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

/** Convertit un montant dans la devise principale. Null si la devise n'a pas de taux. */
export function versPrincipal(montant: number, devise: string, principal: string, taux: Taux | undefined): number | null {
  if (devise === principal) return montant;
  const t = taux?.[devise];
  if (!tauxValide(t)) return null;
  return arrondiA(montant * t, infoDevise(principal).decimales);
}

/** Convertit un montant de la devise principale vers une autre (pour afficher l'équivalent). Null sans taux. */
export function depuisPrincipal(montant: number, devise: string, principal: string, taux: Taux | undefined): number | null {
  if (devise === principal) return montant;
  const t = taux?.[devise];
  if (!tauxValide(t)) return null;
  return arrondiA(montant / t, infoDevise(devise).decimales);
}

/** Formate un montant : « 1 200 € », « 12,50 $ », « 3 000 FCFA ». Les décimales suivent la devise. */
export function fmtDevise(n: number, cle: string): string {
  const d = infoDevise(cle).decimales;
  const entier = Math.abs(n - Math.round(n)) < 0.005;
  const dec = entier ? 0 : Math.max(d, 2) > 2 ? d : 2;
  const txt = n.toLocaleString('fr-FR', { minimumFractionDigits: d === 0 ? 0 : dec, maximumFractionDigits: d === 0 ? 0 : dec });
  return `${txt} ${cle}`;
}

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

/** Changer de devise principale : les taux sont recalculés pour la nouvelle devise (taux inverses), les montants déjà enregistrés ne bougent pas. */
export function changerPrincipal(ancienne: string, nouvelle: string, taux: Taux | undefined): Taux {
  const t = taux?.[nouvelle];
  if (!tauxValide(t)) return {};
  const sortie: Taux = { [ancienne]: arrondiA(1 / t, 8) };
  for (const [k, v] of Object.entries(taux ?? {})) if (k !== nouvelle && k !== ancienne && tauxValide(v)) sortie[k] = arrondiA(v / t, 8);
  return sortie;
}
