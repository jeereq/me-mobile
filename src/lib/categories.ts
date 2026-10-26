import type { Budget, Categorie, Espace, Finances } from './types';

/**
 * Catégories personnalisées.
 *
 * L'utilisateur a un catalogue de catégories (nom, icône, couleur, mots-clés) et peut en poser une ou plusieurs
 * sur une dépense, un revenu, un paiement récurrent, un budget, une tâche, une relance, une habitude ou un projet.
 * Un budget qui « suit » des catégories compte les dépenses qui en portent une, quand aucun budget n'a été choisi à la main.
 *
 * Ce fichier n'importe que des types : il se teste avec `npm test`, sans l'app.
 */

export const PALETTE_CATEGORIES = ['#7AB8F5', '#72C29A', '#E0A960', '#E58A9A', '#A99BEA', '#E5937A', '#5FC9C4', '#C9D26B', '#D68FD6', '#9AA7B5'] as const;
export const EMOJIS_CATEGORIE = ['🛒', '🍽️', '🚗', '🏠', '🎉', '👕', '💊', '📱', '🎁', '✈️', '📚', '💡', '🐾', '💼', '🏦', '👨‍👩‍👧', '🧾', '⚽', '🎓', '🔧'];

/** Catégories proposées en un geste ; les mots-clés servent à classer les opérations importées. */
export const CATEGORIES_SUGGEREES: Omit<Categorie, 'id'>[] = [
  { nom: 'Alimentation', emoji: '🛒', couleur: PALETTE_CATEGORIES[1], mots: ['carrefour', 'leclerc', 'auchan', 'lidl', 'aldi', 'intermarche', 'monoprix', 'marche', 'epicerie', 'supermarche', 'boulangerie'] },
  { nom: 'Restaurants', emoji: '🍽️', couleur: PALETTE_CATEGORIES[2], mots: ['restaurant', 'resto', 'deliveroo', 'uber eats', 'just eat', 'mcdo', 'burger', 'pizza', 'cafe', 'brasserie'] },
  { nom: 'Transport', emoji: '🚗', couleur: PALETTE_CATEGORIES[0], mots: ['sncf', 'ratp', 'uber', 'bolt', 'heetch', 'blablacar', 'carburant', 'essence', 'peage', 'parking', 'navigo', 'taxi'] },
  { nom: 'Logement', emoji: '🏠', couleur: PALETTE_CATEGORIES[4], mots: ['loyer', 'edf', 'engie', 'eau', 'assurance habitation', 'syndic', 'electricite'] },
  { nom: 'Santé', emoji: '💊', couleur: PALETTE_CATEGORIES[3], mots: ['pharmacie', 'medecin', 'docteur', 'dentiste', 'mutuelle', 'hopital', 'clinique'] },
  { nom: 'Frais bancaires', emoji: '🏦', couleur: PALETTE_CATEGORIES[9], mots: ['frais', 'tva', 'commission', 'fees', 'maintenance', 'notification'] },
  { nom: 'Abonnements', emoji: '📱', couleur: PALETTE_CATEGORIES[6], mots: ['netflix', 'spotify', 'deezer', 'canal', 'abonnement', 'orange', 'free', 'sfr', 'bouygues', 'airtel', 'vodacom'] },
  { nom: 'Travail', emoji: '💼', couleur: PALETTE_CATEGORIES[5], mots: [] },
];

const norme = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const categoriesDe = (e: Pick<Espace, 'categories'>): Categorie[] => e.categories ?? [];
export const trouverCategorie = (cats: Categorie[], id: string) => cats.find((c) => c.id === id);

/** Les catégories d'un élément, dans l'ordre du catalogue ; une catégorie supprimée sur un autre appareil est ignorée. */
export function categoriesDeItem(item: { categories?: string[] }, cats: Categorie[]): Categorie[] {
  const ids = item.categories;
  if (!ids?.length) return [];
  return cats.filter((c) => ids.includes(c.id));
}

/** Ajoute ou retire une catégorie d'une liste ; une liste vide devient `undefined` (la clé disparaît de l'élément). */
export function basculer(ids: string[] | undefined, id: string): string[] | undefined {
  const l = ids ?? [];
  const n = l.includes(id) ? l.filter((x) => x !== id) : [...l, id];
  return n.length ? n : undefined;
}
export const avec = (ids: string[] | undefined, id: string): string[] => (ids?.includes(id) ? ids : [...(ids ?? []), id]);
export const sans = (ids: string[] | undefined, id: string): string[] | undefined => {
  const n = (ids ?? []).filter((x) => x !== id);
  return n.length ? n : undefined;
};

/** Pose `categories` sur un élément en retirant la clé quand la liste est vide. */
export function poser<T extends { categories?: string[] }>(item: T, ids: string[] | undefined): T {
  const { categories: _ancien, ...reste } = item;
  void _ancien;
  return (ids?.length ? { ...reste, categories: ids } : reste) as T;
}

/** « » si le nom convient, sinon la phrase à montrer. */
export function verifierNom(cats: Categorie[], nom: string, sauf?: string): string {
  const n = norme(nom);
  if (!n) return 'Donne un nom à la catégorie.';
  if (cats.some((c) => c.id !== sauf && norme(c.nom) === n)) return 'Une catégorie porte déjà ce nom.';
  return '';
}

export function ajouterCategorie(e: Espace, c: Categorie): Espace {
  return { ...e, categories: [...categoriesDe(e), c] };
}
export function modifierCategorie(e: Espace, id: string, patch: Partial<Omit<Categorie, 'id'>>): Espace {
  return { ...e, categories: categoriesDe(e).map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

/** Applique `fn` à la liste de catégories de chaque élément de l'espace qui peut en porter. */
function surTout(e: Espace, fn: (ids: string[] | undefined) => string[] | undefined): Espace {
  const maj = <T extends { categories?: string[] }>(l: T[] | undefined): T[] | undefined => {
    if (!l) return l;
    let change = false;
    const out = l.map((x) => {
      if (!x.categories) return x;
      const n = fn(x.categories);
      if (n === x.categories) return x;
      change = true;
      return poser(x, n);
    });
    return change ? out : l;
  };
  const f = e.finances;
  return {
    ...e,
    relances: maj(e.relances)!,
    taches: maj(e.taches)!,
    habitudes: maj(e.habitudes)!,
    ...(e.projets ? { projets: maj(e.projets)! } : {}),
    ...(f
      ? {
          finances: {
            ...f,
            budgets: maj(f.budgets)!,
            depenses: maj(f.depenses)!,
            ...(f.revenus ? { revenus: maj(f.revenus)! } : {}),
            ...(f.recurrences ? { recurrences: maj(f.recurrences)! } : {}),
          },
        }
      : {}),
  };
}

/** Supprime une catégorie du catalogue et de tous les éléments qui la portaient. */
export function supprimerCategorie(e: Espace, id: string): Espace {
  const n = surTout(e, (ids) => (ids?.includes(id) ? sans(ids, id) : ids));
  return { ...n, categories: categoriesDe(n).filter((c) => c.id !== id) };
}

/** Fusionne `de` dans `vers` : les éléments de la première prennent la seconde, puis la première disparaît. */
export function fusionnerCategories(e: Espace, de: string, vers: string): Espace {
  if (de === vers) return e;
  const n = surTout(e, (ids) => (ids?.includes(de) ? sans(avec(ids, vers), de) : ids));
  return { ...n, categories: categoriesDe(n).filter((c) => c.id !== de) };
}

/** Remonte (delta -1) ou descend (+1) une catégorie dans le catalogue. */
export function deplacer(cats: Categorie[], id: string, delta: number): Categorie[] {
  const i = cats.findIndex((c) => c.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= cats.length) return cats;
  const n = [...cats];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

/** Nombre d'éléments par catégorie, tous types confondus. */
export function usage(e: Espace): Map<string, { total: number; finances: number; taches: number }> {
  const m = new Map<string, { total: number; finances: number; taches: number }>();
  const compter = (l: { categories?: string[] }[] | undefined, genre: 'finances' | 'taches') => {
    for (const x of l ?? []) for (const id of x.categories ?? []) {
      const u = m.get(id) ?? { total: 0, finances: 0, taches: 0 };
      u.total++;
      u[genre]++;
      m.set(id, u);
    }
  };
  const f = e.finances;
  compter(f?.depenses, 'finances');
  compter(f?.revenus, 'finances');
  compter(f?.recurrences, 'finances');
  compter(f?.budgets, 'finances');
  compter(e.taches, 'taches');
  compter(e.relances, 'taches');
  compter(e.habitudes, 'taches');
  compter(e.projets, 'taches');
  return m;
}

/* ---------- Budgets qui suivent des catégories ---------- */

/**
 * Le budget qui compte une dépense : celui choisi à la main s'il existe, sinon le premier budget (dans l'ordre de la liste)
 * qui suit l'une de ses catégories. Une dépense ne compte jamais dans deux budgets : pas de double compte.
 */
export function budgetDe(budgets: Budget[], d: { budget?: string | null; categories?: string[] }): Budget | null {
  if (d.budget) {
    const b = budgets.find((x) => x.id === d.budget && !x.global);
    if (b) return b;
  }
  if (!d.categories?.length) return null;
  return budgets.find((b) => !b.global && b.categories?.some((c) => d.categories!.includes(c))) ?? null;
}
export const idBudgetDe = (budgets: Budget[], d: { budget?: string | null; categories?: string[] }) => budgetDe(budgets, d)?.id ?? null;

/* ---------- Classement par mots-clés ---------- */

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Les catégories dont un mot-clé (ou le nom) apparaît dans le libellé, au début d'un mot. */
export function classerParMots(libelle: string, cats: Categorie[]): string[] {
  const l = norme(libelle);
  if (!l) return [];
  const ids: string[] = [];
  for (const c of cats) {
    const mots = [...(c.mots ?? []), ...(norme(c.nom).length > 3 ? [c.nom] : [])].map(norme).filter((m) => m.length > 1);
    if (mots.some((m) => new RegExp(`(^|[^a-z0-9])${echapper(m)}`).test(l))) ids.push(c.id);
  }
  return ids;
}

/** Catégories déjà données à des opérations de même libellé : le choix de l'utilisateur prime sur les mots-clés. */
export function categoriesHabituelles(f: Finances, libelle: string): string[] | null {
  const l = norme(libelle);
  if (!l) return null;
  const vus = new Map<string, { n: number; ids: string[] }>();
  for (const x of f.depenses) {
    if (!x.categories?.length || norme(x.note) !== l) continue;
    const cle = [...x.categories].sort().join('|');
    const e = vus.get(cle) ?? { n: 0, ids: x.categories };
    e.n++;
    vus.set(cle, e);
  }
  if (!vus.size) return null;
  return [...vus.values()].sort((a, b) => b.n - a.n)[0].ids;
}

/** Classe les dépenses et revenus qui n'ont encore aucune catégorie, d'après leur libellé. */
export function classerOperations(e: Espace): { espace: Espace; classees: number } {
  const cats = categoriesDe(e);
  const f = e.finances;
  if (!f || !cats.length) return { espace: e, classees: 0 };
  let classees = 0;
  const classer = <T extends { categories?: string[]; note: string }>(l: T[]) =>
    l.map((x) => {
      if (x.categories?.length) return x;
      const ids = classerParMots(x.note, cats);
      if (!ids.length) return x;
      classees++;
      return { ...x, categories: ids };
    });
  const depenses = classer(f.depenses);
  const revenus = f.revenus ? classer(f.revenus) : f.revenus;
  if (!classees) return { espace: e, classees: 0 };
  return { espace: { ...e, finances: { ...f, depenses, ...(revenus ? { revenus } : {}) } }, classees };
}

/* ---------- Pont avec les budgets existants ---------- */

/**
 * Crée une catégorie par budget (même nom, même icône), fait suivre cette catégorie par le budget et la pose sur les dépenses
 * déjà rangées dans ce budget. Pour qui a déjà ses budgets : ses catégories existent sans tout ressaisir.
 */
export function categoriserDepuisBudgets(e: Espace, nouvelId: () => string): { espace: Espace; creees: number } {
  const f = e.finances;
  if (!f) return { espace: e, creees: 0 };
  const cats = [...categoriesDe(e)];
  const parBudget = new Map<string, string>();
  let creees = 0;
  f.budgets.forEach((b, i) => {
    if (b.global) return;
    const existante = cats.find((c) => norme(c.nom) === norme(b.nom));
    if (existante) return void parBudget.set(b.id, existante.id);
    const c: Categorie = { id: nouvelId(), nom: b.nom, emoji: b.emoji, couleur: PALETTE_CATEGORIES[(cats.length + i) % PALETTE_CATEGORIES.length] };
    cats.push(c);
    parBudget.set(b.id, c.id);
    creees++;
  });
  if (!parBudget.size) return { espace: e, creees: 0 };
  const budgets = f.budgets.map((b) => (parBudget.has(b.id) ? { ...b, categories: avec(b.categories, parBudget.get(b.id)!) } : b));
  const depenses = f.depenses.map((d) => (d.budget && parBudget.has(d.budget) ? { ...d, categories: avec(d.categories, parBudget.get(d.budget)!) } : d));
  return { espace: { ...e, categories: cats, finances: { ...f, budgets, depenses } }, creees };
}

/* ---------- Répartition par catégorie ---------- */

export type PartCategorie = { cle: string; nom: string; emoji?: string; couleur?: string; total: number; n: number };

/**
 * Total par catégorie. Une opération à plusieurs catégories compte en entier dans chacune (la somme dépasse donc le total) ;
 * celles sans catégorie sont regroupées à part. Du plus gros au plus petit.
 */
export function repartitionParCategorie(ops: { montant: number; categories?: string[] }[], cats: Categorie[]): PartCategorie[] {
  const m = new Map<string, PartCategorie>();
  const ajouter = (cle: string, base: Omit<PartCategorie, 'cle' | 'total' | 'n'>, montant: number) => {
    const p = m.get(cle) ?? { cle, ...base, total: 0, n: 0 };
    p.total = Math.round((p.total + montant) * 100) / 100;
    p.n++;
    m.set(cle, p);
  };
  for (const o of ops) {
    const portees = categoriesDeItem(o, cats);
    if (!portees.length) ajouter('aucune', { nom: 'Sans catégorie' }, o.montant);
    for (const c of portees) ajouter(c.id, { nom: c.nom, emoji: c.emoji, couleur: c.couleur }, o.montant);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}
