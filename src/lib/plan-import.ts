import { lireEtatTache } from './etats-tache';
import { decalerDate, dureeEntre, etapesDepuisTexte, finDepuis, replanifier } from './planning';
import type { Cellule, Feuille } from './tableur';
import type { Categorie, EtatTache, Mode, Priorite, Projet, Tache } from './types';
import { serieEnDate } from './xlsx';

/**
 * Import d'un plan de projet depuis un tableau (Excel, CSV, texte collé) : colonnes reconnues à leur titre, hiérarchie lue dans
 * les retraits, les niveaux, les numéros « 1.2.3 » ou une colonne « Parent », prédécesseurs (« 3 », « 3FS+2j », « Maquettes »),
 * durées (« 5 j », « 2 sem »), dates, priorités, responsables, catégories et sous-tâches listées dans une cellule.
 * Rien n'est écrit ici : on obtient des brouillons que l'écran montre avant de les ajouter.
 *
 * Ce fichier n'importe que des fichiers purs : il se teste avec `npm test`.
 */

/* ---------- Colonnes ---------- */

export type Role = 'projet' | 'id' | 'titre' | 'parent' | 'niveau' | 'debut' | 'fin' | 'duree' | 'apres' | 'priorite' | 'responsable' | 'statut' | 'avancement' | 'categories' | 'sousTaches' | 'jalon' | 'note' | 'periode' | 'budget' | 'engage' | 'unitaire' | 'quantite' | 'pilier' | 'indicateur' | 'critere' | 'ignorer';

export const ROLES: { cle: Role; nom: string; aide: string }[] = [
  { cle: 'titre', nom: 'Tâche', aide: 'Le nom de la tâche (obligatoire)' },
  { cle: 'projet', nom: 'Projet', aide: 'Un projet par valeur de cette colonne' },
  { cle: 'id', nom: 'N°', aide: 'Numéro ou code, pour les prédécesseurs et les parents' },
  { cle: 'parent', nom: 'Parent', aide: 'La tâche dont celle-ci est une sous-tâche' },
  { cle: 'niveau', nom: 'Niveau', aide: '1 = tâche principale, 2 = sous-tâche…' },
  { cle: 'debut', nom: 'Début', aide: 'Date de début' },
  { cle: 'fin', nom: 'Fin', aide: 'Date de fin ou échéance' },
  { cle: 'periode', nom: 'Période', aide: 'T4 2026, S2 2027, mars 2027…' },
  { cle: 'duree', nom: 'Durée', aide: '5, 5 j, 2 sem…' },
  { cle: 'apres', nom: 'Après', aide: 'Prédécesseurs : numéros ou noms de tâches' },
  { cle: 'priorite', nom: 'Priorité', aide: 'Haute, moyenne, basse' },
  { cle: 'responsable', nom: 'Responsable', aide: 'Qui s’en occupe' },
  { cle: 'statut', nom: 'Statut', aide: 'Fait, à faire…' },
  { cle: 'avancement', nom: '% fait', aide: 'Avancement en pourcentage' },
  { cle: 'categories', nom: 'Catégories', aide: 'Une ou plusieurs, séparées par une virgule' },
  { cle: 'sousTaches', nom: 'Sous-tâches', aide: 'Étapes listées dans la cellule' },
  { cle: 'jalon', nom: 'Jalon', aide: 'Oui pour une étape sans durée' },
  { cle: 'note', nom: 'Note', aide: 'Commentaire' },
  { cle: 'pilier', nom: 'Pilier', aide: 'Un ou plusieurs piliers, de 1 à 10 (6 · 8)' },
  { cle: 'indicateur', nom: 'Indicateur', aide: 'Comment on mesure la réussite' },
  { cle: 'critere', nom: 'Critère de succès', aide: 'À quoi on reconnaît le succès' },
  { cle: 'budget', nom: 'Budget', aide: 'Montant prévu (8 500, 8 500 $)' },
  { cle: 'engage', nom: 'Engagé', aide: 'Déjà dépensé ou commandé' },
  { cle: 'unitaire', nom: 'Coût unitaire', aide: 'Multiplié par la quantité si le budget manque' },
  { cle: 'quantite', nom: 'Quantité', aide: 'Nombre de personnes, de licences…' },
  { cle: 'ignorer', nom: 'Ignorer', aide: 'Cette colonne n’est pas importée' },
];

const SYNONYMES: Record<Exclude<Role, 'ignorer'>, string[]> = {
  titre: ['tache', 'taches', 'nom de la tache', 'nom de tache', 'nom de la tâche', 'nom', 'titre', 'intitule', 'libelle', 'activite', 'activites', 'designation', 'task', 'task name', 'name', 'title', 'action', 'actions', 'etape', 'travail', 'livrable', 'element', 'to do', 'todo'],
  projet: ['projet', 'projets', 'project', 'chantier', 'programme', 'nom du projet', 'dossier', 'partie', 'volet', 'axe', 'lot'],
  id: ['id', 'n', 'no', 'num', 'numero', 'numero de tache', 'identifiant', '#', 'wbs', 'code', 'ref', 'reference', 'task id', 'n tache'],
  parent: ['parent', 'tache parente', 'tache mere', 'parent id', 'id parent', 'sous tache de', 'rattache a', 'phase'],
  niveau: ['niveau', 'niveau hierarchique', 'level', 'outline level', 'indent', 'indentation', 'retrait', 'niveau de plan'],
  debut: ['debut', 'date de debut', 'date debut', 'start', 'start date', 'commence', 'commencement', 'du', 'demarrage', 'begin', 'debut prevu', 'debut au plus tot'],
  fin: ['fin', 'date de fin', 'date fin', 'end', 'end date', 'finish', 'echeance', 'date limite', 'deadline', 'due', 'due date', 'au', 'termine le', 'livraison', 'fin prevue', 'date echeance'],
  duree: ['duree', 'duree jours', 'jours', 'nb jours', 'nombre de jours', 'duration', 'days', 'nb j', 'delai'],
  apres: ['predecesseurs', 'predecesseur', 'depend de', 'dependances', 'dependance', 'apres', 'precedent', 'precedents', 'predecessors', 'predecessor', 'depends on', 'dependencies', 'after', 'lie a', 'liens', 'suit', 'prerequis', 'tache precedente', 'taches precedentes'],
  priorite: ['priorite', 'prio', 'priority', 'importance', 'urgence'],
  responsable: ['responsable', 'assigne a', 'assigne', 'owner', 'assignee', 'porteur', 'pilote', 'ressource', 'ressources', 'noms des ressources', 'resource', 'resource names', 'affecte a', 'intervenant', 'qui', 'equipe', 'responsible', 'responsables'],
  statut: ['statut', 'status', 'etat', 'state', 'fait', 'commentaire status', 'commentaire statut'],
  periode: ['periode', 'periode recommandee', 'periode du plan', 'timeline', 'trimestre', 'calendrier', 'echeancier', 'horizon', 'quand'],
  avancement: ['avancement', 'progression', 'progress', 'realise', 'achevement', 'complete', 'pourcentage', '% realise', '% acheve', '% avancement', '% complete', '% termine', '% fait', '%'],
  categories: ['categorie', 'categories', 'tag', 'tags', 'etiquette', 'etiquettes', 'label', 'labels', 'type', 'domaine', 'theme', 'famille', 'categorie s'],
  sousTaches: ['sous taches', 'sous tache', 'sous taches a creer', 'subtasks', 'sub tasks', 'sous etapes', 'etapes', 'checklist', 'details', 'detail'],
  jalon: ['jalon', 'jalons', 'milestone', 'milestones'],
  note: ['note', 'notes', 'commentaire', 'commentaires', 'remarque', 'remarques', 'comment', 'comments', 'observations', 'observation', 'description', 'precisions', 'risques', 'risque', 'risks', ],
  pilier: ['pilier', 'piliers', 'pilier groupe', 'pillar', 'pillars'],
  indicateur: ['indicateur', 'indicateurs', 'indicator', 'indicators', 'kpi', 'kpis'],
  critere: ['critere de succes', 'criteres de succes', 'critere', 'criteres', 'success criteria', 'success criterion', 'key success', 'keys success'],
  budget: ['budget', 'cout', 'couts', 'cout total', 'cout estime', 'montant', 'cost', 'total cost', 'estimated cost'],
  engage: ['engage', 'depense', 'depenses', 'depense reelle', 'consomme', 'spent', 'actual cost', 'cout reel'],
  unitaire: ['cout unitaire', 'prix unitaire', 'pu', 'unit cost', 'unit price'],
  quantite: ['nb pers', 'nb personnes', 'nombre de personnes', 'quantite', 'qte', 'quantity', 'effectif'],
};

export const normaliser = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%#]+/g, ' ')
    .trim();

/** Rôle d'une colonne d'après son titre, avec un score (plus la correspondance est longue, plus elle est sûre). */
export function roleDeEntete(texte: Cellule): { role: Role; score: number } | null {
  const brut = String(texte ?? '');
  // « Mécanismes de suivi / Control mechanism », « Budget ( $ ) » : le titre entier, puis chaque moitié, sans les parenthèses.
  const formes = [brut, ...brut.split(/[/\n|]+/), brut.replace(/\([^)]*\)/g, ' ')].map(normaliser).filter(Boolean);
  let meilleur: { role: Role; score: number } | null = null;
  for (const n of new Set(formes))
    for (const [role, liste] of Object.entries(SYNONYMES) as [Role, string[]][])
      for (const brutS of liste) {
        const s = normaliser(brutS);
        if (!s) continue;
        const exact = n === s;
        // Les mots très courts (« n », « du ») ne valent que seuls ; les autres peuvent être au milieu d'un titre plus long.
        const dedans = s.length > 2 && ` ${n} `.includes(` ${s} `);
        if (!exact && !dedans) continue;
        const score = (exact ? 1000 : 0) + s.length;
        if (!meilleur || score > meilleur.score) meilleur = { role, score };
      }
  return meilleur;
}

export type Colonne = { index: number; entete: string; role: Role; exemples: string[] };
export type Detection = { ligneEntete: number; colonnes: Colonne[]; problemes: string[] };

const texte = (c: Cellule | undefined): string => (c === null || c === undefined ? '' : String(c)).trim();
/** « Mecanismes de suivi/\nControl mechanism » → « Mecanismes de suivi ». */
export const nomCourt = (entete: string) => entete.replace(/\([^)]*\)/g, ' ').split(/[/\n|]/)[0].replace(/\s+/g, ' ').trim() || entete.trim();
/** « À définir », « TBD », « N/A »… : une case pas encore remplie. */
/**
 * Un montant dans une cellule : « 8500 », « 8 500 $ », « $8,500.50 », « 1.250,00 € ».
 * `reste` est ce qui suit le montant (« (hors frais de déplacement) ») : il va dans la note.
 * Pas de montant (null) pour « À définir », un texte libre ou une fourchette (« 5 000 – 10 000 ») : le texte est alors gardé tel quel.
 */
export function lireSomme(c: Cellule | undefined): { montant: number | null; reste: string } {
  if (typeof c === 'number') return Number.isFinite(c) && c >= 0 ? { montant: c, reste: '' } : { montant: null, reste: '' };
  const t = texte(c).replace(/[\u00a0\u202f]/g, ' ');
  const m = /^\s*(?:[$€£]|usd|eur|cdf|fc)?\s*(\d[\d .,']*)/i.exec(t);
  if (!m || aDefinir(t)) return { montant: null, reste: aDefinir(t) ? '' : t.trim() };
  let nombre = m[1].replace(/[ ']/g, '').replace(/[.,]+$/, '');
  const virgule = nombre.lastIndexOf(',');
  const point = nombre.lastIndexOf('.');
  const dernier = Math.max(virgule, point);
  // Le dernier séparateur est décimal s'il est suivi de 1 ou 2 chiffres (ou s'il est seul de son espèce avec une autre avant) ; sinon c'est un séparateur de milliers.
  if (dernier >= 0 && nombre.length - dernier - 1 <= 2) nombre = `${nombre.slice(0, dernier).replace(/[.,]/g, '')}.${nombre.slice(dernier + 1)}`;
  else nombre = nombre.replace(/[.,]/g, '');
  const montant = Number(nombre);
  const reste = t.slice(m[0].length).replace(/^\s*(?:[$€£]|(?:usd|us\$|eur|euros?|dollars?|cdf|fc)(?![a-z]))\.?/i, '').trim();
  if (!Number.isFinite(montant) || /^[-–—à]\s*\d/.test(reste)) return { montant: null, reste: t.trim() };
  return { montant, reste };
}

/** « 6 · 8 », « 3, 10 », « Pilier 2 » → [6, 8], [3, 10], [2] : les numéros de 1 à 10, une fois chacun. */
export function lirePiliers(c: Cellule | undefined): number[] {
  if (typeof c === 'number') return Number.isInteger(c) && c >= 1 && c <= 10 ? [c] : [];
  return [...new Set((texte(c).match(/\d+/g) ?? []).map(Number).filter((n) => n >= 1 && n <= 10))];
}

/** Le premier texte utile parmi plusieurs cellules (« À définir » et « NA » ne comptent pas). */
const premierTexte = (cellules: (Cellule | undefined)[]): string | null => cellules.map(texte).find((t) => t && !aDefinir(t)) ?? null;

export const aDefinir = (c: Cellule | undefined) => /^(a definir|a designer|a preciser|a determiner|a confirmer|tbd|tba|n a|na|non applicable|neant|aucun|)$/.test(normaliser(c)) || /^[-–—?.]+$/.test(texte(c));

/** La feuille à ouvrir d'abord : celle où le plus de colonnes sont reconnues, puis la plus fournie (un classeur a souvent des pages de garde et d'analyse). */
export function meilleureFeuille(feuilles: Feuille[]): number {
  let meilleur = { i: 0, roles: -1, lignes: -1 };
  feuilles.forEach((f, i) => {
    const d = detecterColonnes(f);
    const roles = d.ligneEntete < 0 ? 0 : new Set(d.colonnes.map((c) => c.role).filter((r) => r !== 'ignorer')).size;
    if (roles > meilleur.roles || (roles === meilleur.roles && f.lignes.length > meilleur.lignes)) meilleur = { i, roles, lignes: f.lignes.length };
  });
  return meilleur.i;
}

/** Trouve la ligne de titres (parmi les 25 premières) et le rôle de chaque colonne. */
export function detecterColonnes(f: Feuille): Detection {
  const largeur = Math.max(0, ...f.lignes.map((l) => l.length));
  let meilleur = { ligne: -1, score: 0, nb: 0 };
  f.lignes.slice(0, 25).forEach((l, i) => {
    const roles = new Map<Role, number>();
    for (const c of l) {
      const r = typeof c === 'number' ? null : roleDeEntete(c);
      if (r && (roles.get(r.role) ?? 0) < r.score) roles.set(r.role, r.score);
    }
    const nb = roles.size;
    const score = [...roles.values()].reduce((s, x) => s + x, 0) + (roles.has('titre') ? 500 : 0);
    const seule = roles.has('titre') && l.filter((c) => texte(c)).length === 1;
    if ((nb >= 2 || seule) && score > meilleur.score) meilleur = { ligne: i, score, nb };
  });
  const problemes: string[] = [];
  const ligneEntete = meilleur.ligne;
  const colonnes: Colonne[] = Array.from({ length: largeur }, (_, index) => ({ index, entete: ligneEntete >= 0 ? texte(f.lignes[ligneEntete][index]) : '', role: 'ignorer' as Role, exemples: [] }));

  if (ligneEntete >= 0) {
    const scores = new Map<number, { role: Role; score: number }>();
    colonnes.forEach((c) => {
      const r = c.entete ? roleDeEntete(c.entete) : null;
      if (r) scores.set(c.index, r);
    });
    // Un même rôle sur deux colonnes : la meilleure l'emporte (sauf catégories et notes, qui s'additionnent).
    // Deux colonnes de période (le plan, puis le plan révisé) : la plus à droite est la plus récente.
    const rang = (x: [number, { role: Role; score: number }]) => x[1].score + (x[1].role === 'periode' ? x[0] / 1000 : 0);
    for (const [index, r] of [...scores].sort((a, b) => rang(b) - rang(a) || a[0] - b[0])) {
      const deja = colonnes.some((c) => c.role === r.role);
      if (!deja || r.role === 'categories' || r.role === 'note') colonnes[index].role = r.role;
    }
  }
  const donnees = f.lignes.slice(ligneEntete + 1);
  // Pas de colonne « tâche » reconnue : la colonne de texte la plus fournie, à défaut la première.
  if (!colonnes.some((c) => c.role === 'titre') && colonnes.length) {
    const moyenne = (i: number) => {
      const t = donnees.map((l) => l[i]).filter((c) => typeof c === 'string') as string[];
      return t.length ? t.reduce((s, x) => s + x.trim().length, 0) / t.length : 0;
    };
    const libres = colonnes.filter((c) => c.role === 'ignorer');
    const choix = libres.sort((a, b) => moyenne(b.index) - moyenne(a.index))[0] ?? colonnes[0];
    choix.role = 'titre';
    problemes.push(ligneEntete >= 0 ? `Aucune colonne « Tâche » reconnue : « ${choix.entete || `colonne ${choix.index + 1}`} » sert de nom de tâche.` : 'Aucune ligne de titres reconnue : la première colonne sert de nom de tâche.');
  }
  // Une colonne « Actions » qui raconte chaque action en un paragraphe fait de mauvais noms de tâches :
  // s'il existe à côté une colonne courte et bien remplie (« Objectif »), elle donne le nom et le paragraphe passe en note.
  const titre = colonnes.find((c) => c.role === 'titre');
  if (titre && ligneEntete >= 0) {
    const stats = (i: number) => {
      const t = donnees.map((l) => texte(l[i])).filter(Boolean);
      const avecLettres = t.filter((x) => /[a-zà-ÿ]{3}/i.test(x));
      return { remplies: t.length, lettres: avecLettres.length, moyenne: t.length ? t.reduce((s, x) => s + x.length, 0) / t.length : 0, distinctes: new Set(t).size };
    };
    const st = stats(titre.index);
    if (st.moyenne > 90) {
      const courte = colonnes
        .filter((c) => c.role === 'ignorer' && c.entete)
        .map((c) => ({ c, s: stats(c.index) }))
        .filter(({ s }) => s.remplies >= st.remplies * 0.9 && s.lettres >= s.remplies * 0.9 && s.moyenne >= 8 && s.moyenne <= 60 && s.distinctes >= s.remplies * 0.7)
        .sort((a, b) => b.s.distinctes - a.s.distinctes || a.c.index - b.c.index)[0];
      if (courte) {
        courte.c.role = 'titre';
        titre.role = 'note';
        problemes.push(`« ${nomCourt(courte.c.entete)} » donne le nom des tâches (plus court) ; « ${nomCourt(titre.entete)} » va dans la note.`);
      }
    }
  }
  for (const c of colonnes) c.exemples = donnees.map((l) => texte(l[c.index])).filter(Boolean).slice(0, 3);
  return { ligneEntete, colonnes, problemes };
}

/* ---------- Valeurs ---------- */

const MOIS: Record<string, number> = {
  janv: 1, janvier: 1, jan: 1, january: 1, fevr: 2, fevrier: 2, fev: 2, feb: 2, february: 2, mars: 3, mar: 3, march: 3, avr: 4, avril: 4, apr: 4, april: 4, mai: 5, may: 5,
  juin: 6, jun: 6, june: 6, juil: 7, juillet: 7, jul: 7, july: 7, aout: 8, aug: 8, august: 8, sept: 9, sep: 9, septembre: 9, september: 9, oct: 10, octobre: 10, october: 10,
  nov: 11, novembre: 11, november: 11, dec: 12, decembre: 12, december: 12,
};
const joursDuMois = (a: number, m: number) => new Date(Date.UTC(a, m, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, '0');

/** Date écrite de plusieurs façons → « AAAA-MM-JJ », ou null. `annee` complète les dates sans année (« 14/11 »). */
export function lireDateTexte(c: Cellule | undefined, annee: number): string | null {
  if (c === null || c === undefined) return null;
  if (typeof c === 'number') return c > 20000 && c < 80000 ? serieEnDate(c, false) : null;
  const brut = c.trim();
  if (!brut) return null;
  const valide = (a: number, m: number, j: number) => (m >= 1 && m <= 12 && j >= 1 && j <= joursDuMois(a, m) && a >= 1990 && a <= 2100 ? `${a}-${pad(m)}-${pad(j)}` : null);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(brut);
  if (m) return valide(+m[1], +m[2], +m[3]);
  return lireDateLongue(brut, annee) ?? lireDateLongue(brut.replace(/^(?:lun|mar|mer|jeu|ven|sam|dim|mon|tue|wed|thu|fri|sat|sun)[a-zé]*\.?,?\s+(?=\d)/i, ''), annee);
}

function lireDateLongue(net: string, annee: number): string | null {
  const valide = (a: number, m: number, j: number) => (m >= 1 && m <= 12 && j >= 1 && j <= joursDuMois(a, m) && a >= 1990 && a <= 2100 ? `${a}-${pad(m)}-${pad(j)}` : null);
  const an = (s: string) => (s.length <= 2 ? 2000 + Number(s) : Number(s));
  let m = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{4}))?$/.exec(net);
  if (m) {
    let j = +m[1];
    let mo = +m[2];
    // 14/11 est évident ; 11/14 est une date à l'américaine.
    if (mo > 12 && j <= 12) [j, mo] = [mo, j];
    return valide(m[3] ? an(m[3]) : annee, mo, j);
  }
  const mn = normaliser(net);
  m = /^(\d{1,2})(?:er)? ([a-z]+)(?: (\d{2}|\d{4}))?$/.exec(mn) || /^(\d{1,2}) ([a-z]+) (\d{2}|\d{4})$/.exec(mn);
  if (m && MOIS[m[2]]) return valide(m[3] ? an(m[3]) : annee, MOIS[m[2]], +m[1]);
  m = /^([a-z]+) (\d{1,2})(?: (\d{2}|\d{4}))?$/.exec(mn);
  if (m && MOIS[m[1]]) return valide(m[3] ? an(m[3]) : annee, MOIS[m[1]], +m[2]);
  return null;
}

/**
 * Une période écrite en trimestres, semestres, mois ou année → ses premier et dernier jours.
 * « T4 2026 », « Q1 2027 », « T1 – T2 2027 », « T4 2026 – T1 2027 (déc. – janv.) », « S2 2027 », « juin 2027 », « fin 2026 », « 2028 ».
 * Des mois entre parenthèses précisent la période (« T1 2027 (fév. – mars) » : du 1er février au 31 mars).
 * Plusieurs périodes (« T4 2026 si capacité, sinon T1 2027 ») : de la première à la dernière.
 */
export function lirePeriode(c: Cellule | undefined): { debut: string; fin: string } | null {
  if (typeof c === 'number') return Number.isInteger(c) && c >= 1990 && c <= 2100 ? { debut: `${c}-01-01`, fin: `${c}-12-31` } : null;
  if (typeof c !== 'string') return null;
  const mots = normaliser(c.replace(/\(/g, ' xxouvre ').replace(/\)/g, ' xxferme ')).split(' ').filter(Boolean);
  const estAnnee = (m: string | undefined) => !!m && /^(19|20)\d{2}$/.test(m);
  const annees = mots.map((m, i) => ({ i, a: estAnnee(m) ? +m : 0 })).filter((x) => x.a);
  if (!annees.length) return null;
  // Chaque repère (trimestre, semestre, mois) en mois comptés depuis l'an 0, avec l'année écrite après lui, à défaut avant.
  type Repere = { de: number; a: number; precis: boolean };
  const reperes: Repere[] = [];
  let parenthese = false;
  mots.forEach((m, i) => {
    if (m === 'xxouvre') return void (parenthese = true);
    if (m === 'xxferme') return void (parenthese = false);
    const t = /^[tq]([1-4])$/.exec(m);
    const sem = /^[sh]([12])$/.exec(m);
    let mois: [number, number] | null = null;
    if (t) mois = [(+t[1] - 1) * 3 + 1, +t[1] * 3];
    else if (sem) mois = sem[1] === '1' ? [1, 6] : [7, 12];
    else if (MOIS[m]) mois = [MOIS[m], MOIS[m]];
    else if (m === 'fin' && estAnnee(mots[i + 1])) mois = [10, 12];
    else if (m === 'debut' && estAnnee(mots[i + 1])) mois = [1, 3];
    if (!mois) return;
    const annee = (annees.find((x) => x.i > i) ?? [...annees].reverse().find((x) => x.i < i))!.a;
    reperes.push({ de: annee * 12 + mois[0], a: annee * 12 + mois[1], precis: parenthese });
  });
  const an = (x: number) => Math.floor((x - 1) / 12);
  const mo = (x: number) => ((x - 1) % 12) + 1;
  const rendre = (d: number, f: number) => ({ debut: `${an(d)}-${pad(mo(d))}-01`, fin: `${an(f)}-${pad(mo(f))}-${pad(joursDuMois(an(f), mo(f)))}` });
  if (!reperes.length) {
    // Une année seule, ou « 2027 – 2028 » ; un texte qui cite seulement une année n'est pas une période.
    const libres = mots.filter((m) => !estAnnee(m) && !/^(a|au|et|de|en|annee|xxouvre|xxferme)$/.test(m));
    return libres.length ? null : rendre(Math.min(...annees.map((x) => x.a)) * 12 + 1, Math.max(...annees.map((x) => x.a)) * 12 + 12);
  }
  const larges = reperes.filter((r) => !r.precis);
  const base = larges.length ? larges : reperes;
  let d = Math.min(...base.map((r) => r.de));
  let f = Math.max(...base.map((r) => r.a));
  // Les mois entre parenthèses resserrent la période, dans l'ordre écrit (« déc. – janv. » passe l'année).
  const precis = reperes.filter((r) => r.precis);
  if (larges.length && precis.length) {
    const premier = mo(precis[0].de);
    const dernier = mo(precis[precis.length - 1].a);
    let dd = d;
    while (mo(dd) !== premier && dd <= f) dd++;
    let ff = f;
    while (mo(ff) !== dernier && ff >= d) ff--;
    if (dd <= ff) [d, f] = [dd, ff];
  }
  return rendre(d, f);
}

/** Durée → nombre de jours (de travail si `ouvres`), ou null. 0 est une durée valide : un jalon. */
export function lireDuree(c: Cellule | undefined, ouvres: boolean): number | null {
  if (c === null || c === undefined || c === '') return null;
  const arrondir = (x: number) => (x <= 0 ? 0 : Math.max(1, Math.round(x)));
  if (typeof c === 'number') return Number.isFinite(c) && c >= 0 ? arrondir(c) : null;
  const m = /^(\d+(?:[.,]\d+)?)\s*([a-zéèû]*)\s*\??$/i.exec(c.trim());
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const u = normaliser(m[2]);
  if (u === '' || /^(j|jr|jrs|jour|jours|d|day|days)$/.test(u)) return arrondir(n);
  if (/^(s|sem|semaine|semaines|w|wk|week|weeks)$/.test(u)) return arrondir(n * (ouvres ? 5 : 7));
  if (/^(m|mois|month|months)$/.test(u)) return arrondir(n * (ouvres ? 22 : 30));
  if (/^(h|hr|hrs|heure|heures|hour|hours)$/.test(u)) return arrondir(n / 8);
  return null;
}

export function lirePriorite(c: Cellule | undefined): Priorite | null {
  const n = normaliser(c);
  if (!n) return null;
  if (/^(haute|high|urgent|urgente|critique|critical|p1|1|elevee|elevé|importante|majeure|forte)$/.test(n)) return 'haute';
  if (/^(basse|low|faible|mineure|p3|3|4|5|bas|secondaire)$/.test(n)) return 'basse';
  if (/^(moyenne|medium|normal|normale|moyen|p2|2|standard)$/.test(n)) return 'moyenne';
  return null;
}

/** Statut ou avancement : « Terminé », « 40 % », 0,4, « oui »… */
export function lireEtat(c: Cellule | undefined): { fait: boolean | null; avancement: number | null } {
  if (c === null || c === undefined || c === '') return { fait: null, avancement: null };
  const pour = (p: number) => ({ fait: p >= 100, avancement: Math.max(0, Math.min(100, Math.round(p))) });
  if (typeof c === 'number') return c <= 1 ? pour(c * 100) : c <= 100 ? pour(c) : { fait: null, avancement: null };
  const brut = c.trim();
  const pc = /^(\d+(?:[.,]\d+)?)\s*%$/.exec(brut);
  if (pc) return pour(Number(pc[1].replace(',', '.')));
  const n = normaliser(brut);
  // « À valider », « Proposé – à valider », « Non fait » : pas fait, même si le mot « fait » ou « valide » y figure.
  if (/(^| )(a|non|pas|sans) (valider|faire|livrer|terminer|finaliser|decider|completer|clore|fait|faite|termine|terminee|valide|validee|livre|livree)( |$)/.test(n) || /^(propose|pipeline|en projet|a l etude)/.test(n)) return { fait: false, avancement: null };
  if (/^(oui|x|vrai|true|yes|ok)$/.test(n) || /(termin|fait|done|complet|clos|achev|finished|livre|valide)/.test(n)) return { fait: true, avancement: 100 };
  if (/^(non|faux|false|no)$/.test(n) || /(a faire|todo|to do|non demarr|not started|planifie|en attente|ouvert|open)/.test(n)) return { fait: false, avancement: null };
  if (/(en cours|in progress|progress|demarre|started|wip)/.test(n)) return { fait: false, avancement: null };
  const num = Number(brut.replace(',', '.'));
  return Number.isFinite(num) ? lireEtat(num) : { fait: null, avancement: null };
}

const OUI = /^(oui|x|vrai|true|yes|1|jalon|milestone|ok)$/;
export const lireOui = (c: Cellule | undefined) => (typeof c === 'number' ? c === 1 : OUI.test(normaliser(c)));

const listeDe = (c: Cellule | undefined) =>
  texte(c)
    .split(/[,;|\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

export type Reference = { ref: string; delai: number; type: string | null };

/** « 3 », « 3FS+2j », « Maquettes », « 4;6FS+1sem » → références et délais. */
export function lireReferences(c: Cellule | undefined, ouvres: boolean): Reference[] {
  if (c === null || c === undefined || c === '') return [];
  return listeDe(typeof c === 'number' ? String(c) : c).map((tok) => {
    const lag = /^(.*?)\s*(FS|DF|SS|DD|FF|SF|DF|FD)?\s*([+-])\s*(\d+(?:[.,]\d+)?)\s*(j|jr|jrs|jour|jours|d|day|days|sem|semaine|semaines|w|wk|h)?\s*$/i.exec(tok);
    const type = /^(.*?)\s*(FS|DF|SS|DD|FF|SF|FD)\s*$/i.exec(tok);
    if (lag && lag[1].trim()) {
      const n = Number(lag[4].replace(',', '.')) * (lag[3] === '-' ? -1 : 1);
      const u = (lag[5] ?? 'j').toLowerCase();
      const jours = /^(sem|semaine|semaines|w|wk)$/.test(u) ? n * (ouvres ? 5 : 7) : u === 'h' ? n / 8 : n;
      return { ref: lag[1].trim(), delai: Math.round(jours), type: lag[2] ? lag[2].toUpperCase() : null, brut: tok } as Reference & { brut: string };
    }
    if (type && type[1].trim() && /[\d\s]/.test(type[1].slice(-1))) return { ref: type[1].trim(), delai: 0, type: type[2].toUpperCase(), brut: tok } as Reference & { brut: string };
    return { ref: tok, delai: 0, type: null, brut: tok } as Reference & { brut: string };
  });
}

/* ---------- Lecture du plan ---------- */

export type Brouillon = {
  /** Identifiant dans le fichier (colonne N°, sinon « L12 » pour la ligne 12). */
  cle: string;
  ligne: number;
  titre: string;
  parentCle: string | null;
  debut: string | null;
  fin: string | null;
  duree: number | null;
  apres: { cle: string; delai: number }[];
  priorite: Priorite | null;
  responsable: string | null;
  fait: boolean | null;
  avancement: number | null;
  categories: string[];
  sousTaches: string[];
  jalon: boolean;
  note: string | null;
  budget: number | null;
  engage: number | null;
  etat: EtatTache | null;
  pilier: number[];
  indicateur: string | null;
  critere: string | null;
};
export type ProjetLu = { nom: string; taches: Brouillon[] };
export type PlanLu = {
  projets: ProjetLu[];
  avertissements: string[];
  nbLignes: number;
  /** Le fichier donne des dates / des liens : sinon on propose d'enchaîner les tâches. */
  aDesDates: boolean;
  aDesLiens: boolean;
};
export type OptionsLecture = {
  ligneEntete: number;
  roles: Role[];
  /** Nom du fichier sans extension, pour nommer le projet quand la feuille a un nom générique. */
  nomFichier?: string;
  joursOuvres: boolean;
  aujourdhui: string;
};

const NOM_GENERIQUE = /^(feuil(le)?\s*\d*|sheet\s*\d*|plan|planning|tableau|export|classeur\d*|book\d*|sans titre|untitled)$/i;

/** Retrait d'un titre : retrait de la cellule Excel, sinon espaces ou tabulations de début (2 espaces = 1 niveau), puces retirées. */
function retraitEtTitre(brut: string, retraitCellule: number): { titre: string; retrait: number } {
  const m = /^([ \t ]*)([•▪▫◦‣·*–-]\s+)?(.*)$/s.exec(brut)!;
  const blancs = m[1].replace(/\t/g, '  ').length;
  return { titre: m[3].trim(), retrait: retraitCellule > 0 ? retraitCellule : Math.floor(blancs / 2) };
}

export function lirePlan(f: Feuille, opts: OptionsLecture): PlanLu {
  const { roles, ligneEntete } = opts;
  const col = (r: Role) => roles.findIndex((x) => x === r);
  const cols = (r: Role) => roles.map((x, i) => (x === r ? i : -1)).filter((i) => i >= 0);
  const iTitre = col('titre');
  const avertissements: string[] = [];
  if (iTitre < 0) return { projets: [], avertissements: ['Choisis la colonne qui contient le nom des tâches.'], nbLignes: 0, aDesDates: false, aDesLiens: false };
  const annee = +opts.aujourdhui.slice(0, 4);
  const nomParDefaut = !NOM_GENERIQUE.test(f.nom.trim()) ? f.nom.trim() : opts.nomFichier?.trim() || 'Projet importé';

  type Ligne = Brouillon & { projet: string; retrait: number; niveau: number | null; parentRef: string | null; refs: Reference[]; idBrut: string | null };
  const lignes: Ligne[] = [];
  let projetCourant = nomParDefaut;
  const vus = new Set<string>();
  f.lignes.forEach((l, y) => {
    if (y <= ligneEntete) return;
    if (l.every((c) => c === null || texte(c) === '')) return;
    const lu = (i: number) => (i >= 0 ? l[i] : undefined);
    const iProjet = col('projet');
    if (iProjet >= 0 && texte(lu(iProjet))) projetCourant = texte(lu(iProjet));
    const { titre, retrait } = retraitEtTitre(l[iTitre] === null || l[iTitre] === undefined ? '' : String(l[iTitre]), f.retraits?.[y]?.[iTitre] ?? 0);
    if (!titre) {
      if (l.some((c, i) => i !== iProjet && texte(c))) avertissements.push(`Ligne ${y + 1} sans nom de tâche : ignorée.`);
      return;
    }
    const idBrut = col('id') >= 0 && texte(lu(col('id'))) ? texte(lu(col('id'))) : null;
    let cle = idBrut ?? `L${y + 1}`;
    const unique = `${projetCourant}\u0000${cle}`;
    if (vus.has(unique)) {
      avertissements.push(`Le numéro « ${cle} » est utilisé plusieurs fois (ligne ${y + 1}) : seul le premier peut servir de prédécesseur.`);
      cle = `L${y + 1}`;
    }
    vus.add(`${projetCourant}\u0000${cle}`);

    // Une date précise d'abord ; sinon une période (« T4 2026 », « mars 2027 ») donne son premier et son dernier jour.
    const periode = col('periode') >= 0 ? lirePeriode(lu(col('periode'))) : null;
    if (col('periode') >= 0 && !periode && !aDefinir(lu(col('periode')))) avertissements.push(`Ligne ${y + 1} : période « ${texte(lu(col('periode')))} » non reconnue.`);
    const debut = (col('debut') >= 0 ? lireDateTexte(lu(col('debut')), annee) ?? lirePeriode(lu(col('debut')))?.debut : null) ?? periode?.debut ?? null;
    const fin = (col('fin') >= 0 ? lireDateTexte(lu(col('fin')), annee) ?? lirePeriode(lu(col('fin')))?.fin : null) ?? periode?.fin ?? null;
    if (col('debut') >= 0 && !aDefinir(lu(col('debut'))) && !debut) avertissements.push(`Ligne ${y + 1} : date de début « ${texte(lu(col('debut')))} » non reconnue.`);
    if (col('fin') >= 0 && !aDefinir(lu(col('fin'))) && !fin) avertissements.push(`Ligne ${y + 1} : date de fin « ${texte(lu(col('fin')))} » non reconnue.`);
    let etat = { fait: null as boolean | null, avancement: null as number | null };
    for (const r of ['statut', 'avancement'] as const) {
      const e = lireEtat(lu(col(r)));
      etat = { fait: e.fait ?? etat.fait, avancement: e.avancement ?? etat.avancement };
    }
    // Un état que l'app ne sait pas ranger (« Pipeline », « Proposé – à valider ») est gardé dans la note.
    const etatBrut = texte(lu(col('statut')));
    const etatSimple = /^(a faire|todo|to do|non demarre|non demarree|not started|en cours|in progress|planifie|en attente|ouvert|open|non|faux|false|no)$/.test(normaliser(etatBrut));
    const etatTache = etat.fait !== true ? lireEtatTache(etatBrut) : null;
    // Un état reconnu (« À valider ») va dans le champ ; un autre texte est gardé dans la note.
    const etatLibre = etatBrut && etat.fait !== true && etat.avancement === null && !etatSimple && !etatTache && !aDefinir(etatBrut) ? `État : ${etatBrut}` : '';
    // Plusieurs colonnes de note : chacune garde son titre (« Risques : … »).
    const iNotes = cols('note');
    const notes = iNotes.filter((i) => !aDefinir(l[i])).map((i) => (iNotes.length > 1 && texte(f.lignes[ligneEntete]?.[i]) ? `${nomCourt(texte(f.lignes[ligneEntete][i]))} : ${texte(l[i])}` : texte(l[i])));
    // Budget : le montant va dans le champ prévu ; ce qui l'accompagne (ou un texte sans montant) reste dans la note.
    const prevu = col('budget') >= 0 ? lireSomme(lu(col('budget'))) : { montant: null, reste: '' };
    const unitaire = col('unitaire') >= 0 ? lireSomme(lu(col('unitaire'))).montant : null;
    const quantite = col('quantite') >= 0 ? lireSomme(lu(col('quantite'))).montant : null;
    const budget = prevu.montant ?? (unitaire !== null ? Math.round(unitaire * (quantite ?? 1) * 100) / 100 : null);
    const engageLu = col('engage') >= 0 ? lireSomme(lu(col('engage'))) : { montant: null, reste: '' };
    const notesBudget = [prevu.reste ? `${col('budget') >= 0 && texte(f.lignes[ligneEntete]?.[col('budget')]) ? nomCourt(texte(f.lignes[ligneEntete][col('budget')])) : 'Budget'} : ${prevu.reste}` : '', engageLu.reste ? `Engagé : ${engageLu.reste}` : ''].filter(Boolean);
    const duree = col('duree') >= 0 ? lireDuree(lu(col('duree')), opts.joursOuvres) : null;
    if (col('duree') >= 0 && texte(lu(col('duree'))) && duree === null) avertissements.push(`Ligne ${y + 1} : durée « ${texte(lu(col('duree')))} » non reconnue.`);
    lignes.push({
      cle,
      ligne: y + 1,
      projet: projetCourant,
      titre,
      retrait,
      niveau: col('niveau') >= 0 && Number.isFinite(Number(texte(lu(col('niveau'))))) && texte(lu(col('niveau'))) ? Number(texte(lu(col('niveau')))) : null,
      parentRef: col('parent') >= 0 && texte(lu(col('parent'))) ? texte(lu(col('parent'))) : null,
      parentCle: null,
      idBrut,
      debut,
      fin: debut && fin && fin < debut ? debut : fin,
      duree,
      refs: lireReferences(lu(col('apres')), opts.joursOuvres),
      apres: [],
      priorite: lirePriorite(lu(col('priorite'))),
      responsable: aDefinir(lu(col('responsable'))) ? null : texte(lu(col('responsable'))),
      fait: etat.fait,
      avancement: etat.avancement,
      categories: [...new Set(cols('categories').flatMap((i) => listeDe(l[i])))],
      sousTaches: col('sousTaches') >= 0 ? etapesDepuisTexte(texte(lu(col('sousTaches')))) : [],
      jalon: col('jalon') >= 0 ? lireOui(lu(col('jalon'))) : false,
      note: [etatLibre, ...notes, ...notesBudget].filter(Boolean).join('\n') || null,
      budget,
      engage: engageLu.montant,
      etat: etatTache,
      pilier: [...new Set(cols('pilier').flatMap((i) => lirePiliers(l[i])))].sort((a, b) => a - b),
      indicateur: premierTexte(cols('indicateur').map((i) => l[i])),
      critere: premierTexte(cols('critere').map((i) => l[i])),
    });
  });

  const projets: ProjetLu[] = [];
  for (const nom of [...new Set(lignes.map((x) => x.projet))]) {
    const rangees = lignes.filter((x) => x.projet === nom);
    const parCle = new Map(rangees.map((x) => [x.cle, x]));
    const parId = new Map(rangees.filter((x) => x.idBrut).map((x) => [x.idBrut!.toLowerCase(), x]));
    const parTitre = new Map<string, Ligne>();
    for (const x of rangees) if (!parTitre.has(normaliser(x.titre))) parTitre.set(normaliser(x.titre), x);
    const aIds = parId.size > 0;
    const trouver = (ref: string): Ligne | undefined => {
      const r = ref.trim();
      return parId.get(r.toLowerCase()) ?? parTitre.get(normaliser(r)) ?? (!aIds && /^\d+$/.test(r) ? rangees[Number(r) - 1] : undefined);
    };

    // Hiérarchie : colonne « Parent », sinon niveaux, sinon numéros « 1.2.3 », sinon retraits.
    const wbs = rangees.filter((x) => x.idBrut && /^\d+(\.\d+)+$/.test(x.idBrut) || x.idBrut && /^\d+$/.test(x.idBrut));
    const wbsPointe = rangees.some((x) => x.idBrut && /^\d+(\.\d+)+$/.test(x.idBrut));
    const aNiveaux = rangees.some((x) => x.niveau !== null);
    const aRetraits = rangees.some((x) => x.retrait > 0);
    void wbs;
    const pile: { niveau: number; ligne: Ligne }[] = [];
    for (const x of rangees) {
      let parent: Ligne | undefined;
      if (x.parentRef) {
        parent = trouver(x.parentRef);
        if (!parent) avertissements.push(`Ligne ${x.ligne} : le parent « ${x.parentRef} » est introuvable.`);
      } else if (col('parent') < 0 || !rangees.some((y) => y.parentRef)) {
        if (aNiveaux) {
          const n = x.niveau ?? 1;
          while (pile.length && pile[pile.length - 1].niveau >= n) pile.pop();
          parent = pile[pile.length - 1]?.ligne;
          pile.push({ niveau: n, ligne: x });
        } else if (wbsPointe && x.idBrut && /^\d+(\.\d+)+$/.test(x.idBrut)) {
          parent = parId.get(x.idBrut.replace(/\.\d+$/, '').toLowerCase());
        } else if (aRetraits) {
          while (pile.length && pile[pile.length - 1].niveau >= x.retrait) pile.pop();
          parent = pile[pile.length - 1]?.ligne;
          pile.push({ niveau: x.retrait, ligne: x });
        }
      }
      if (parent && parent !== x) x.parentCle = parent.cle;
    }

    // Prédécesseurs.
    for (const x of rangees) {
      const delais = new Set<number>();
      for (const r of x.refs as (Reference & { brut?: string })[]) {
        // Le texte entier d'abord (un nom de tâche peut finir par « -2 »), puis la référence nue.
        const cible = trouver(r.brut ?? r.ref) ?? trouver(r.ref);
        const exacte = r.brut ? trouver(r.brut) : undefined;
        const lien = exacte ? { cle: exacte.cle, delai: 0, type: null } : cible ? { cle: cible.cle, delai: r.delai, type: r.type } : null;
        if (!lien) {
          avertissements.push(`Ligne ${x.ligne} : le prédécesseur « ${r.ref} » est introuvable.`);
          continue;
        }
        if (lien.cle === x.cle) continue;
        if (lien.type && lien.type !== 'FS' && lien.type !== 'DF') avertissements.push(`Ligne ${x.ligne} : le lien « ${lien.type} » est lu comme « fin → début ».`);
        if (lien.delai < 0) {
          avertissements.push(`Ligne ${x.ligne} : une avance de ${-lien.delai} j sur « ${r.ref} » est ramenée à 0 (les tâches ne se chevauchent pas).`);
          lien.delai = 0;
        }
        if (!x.apres.some((a) => a.cle === lien.cle)) x.apres.push({ cle: lien.cle, delai: lien.delai });
        delais.add(lien.delai);
      }
      if (delais.size > 1) avertissements.push(`Ligne ${x.ligne} : plusieurs délais différents ; le plus long est gardé.`);
    }
    // Un lien vers sa propre descendante est absurde (la tâche en fait partie) : on le retire.
    const ancetres = (x: Ligne) => {
      const s = new Set<string>();
      for (let c = x.parentCle, n = 0; c && n++ < 100; c = parCle.get(c)?.parentCle ?? null) s.add(c);
      return s;
    };
    for (const x of rangees) {
      const anc = ancetres(x);
      x.apres = x.apres.filter((a) => !anc.has(a.cle));
    }
    projets.push({
      nom,
      taches: rangees.map(({ projet: _p, retrait: _r, niveau: _n, parentRef: _pr, refs: _rf, idBrut: _i, ...b }) => {
        void [_p, _r, _n, _pr, _rf, _i];
        return b;
      }),
    });
  }
  return {
    projets,
    avertissements: avertissements.slice(0, 40),
    nbLignes: lignes.length,
    aDesDates: lignes.some((x) => x.debut || x.fin),
    aDesLiens: lignes.some((x) => x.refs.length > 0),
  };
}

/* ---------- Construction des projets et des tâches ---------- */

export type OptionsConstruction = {
  /** Jour de départ du planning, ou null (la première date du fichier, sinon aujourd'hui). */
  debut: string | null;
  joursOuvres: boolean;
  mode: Mode;
  source: Tache['source'];
  /** Catalogue existant : les catégories du fichier y sont retrouvées par leur nom. */
  categories: Categorie[];
  /** Crée les catégories du fichier qui n'existent pas encore. */
  creerCategories: boolean;
  /** Une tâche sans date ni lien suit la précédente de son niveau. */
  enchainer: boolean;
  /** Les sous-tâches listées dans une cellule s'enchaînent et se partagent la durée. */
  enchainerSousTaches: boolean;
  nouvelId: () => string;
  aujourdhui: string;
  emojis?: string[];
  couleurs?: readonly string[];
  /** Complète le projet (emoji, couleur) : sinon valeurs par défaut. */
  maintenant?: string;
  fichier?: string;
  type?: 'excel' | 'csv' | 'colle';
};
export type Construit = { projets: Projet[]; taches: Tache[]; categoriesCreees: Categorie[] };

const EMOJIS_PROJET = ['📁', '🚀', '🏗️', '📣', '🎓', '🛠️', '🌍', '🧪'];

/** Transforme les brouillons en projets et tâches prêts à ranger, dates calculées. */
export function construire(plan: PlanLu, o: OptionsConstruction): Construit {
  const projets: Projet[] = [];
  let taches: Tache[] = [];
  const categories = [...o.categories];
  const creees: Categorie[] = [];
  const couleurs = o.couleurs ?? ['#7AB8F5'];
  const idCategorie = (nom: string): string | null => {
    const n = normaliser(nom);
    const c = categories.find((x) => normaliser(x.nom) === n);
    if (c) return c.id;
    if (!o.creerCategories) return null;
    const nouvelle: Categorie = { id: o.nouvelId(), nom: nom.trim(), emoji: '🏷️', couleur: couleurs[categories.length % couleurs.length] };
    categories.push(nouvelle);
    creees.push(nouvelle);
    return nouvelle.id;
  };

  plan.projets.forEach((pl, k) => {
    const projet: Projet = {
      id: o.nouvelId(),
      nom: pl.nom,
      emoji: (o.emojis ?? EMOJIS_PROJET)[k % (o.emojis ?? EMOJIS_PROJET).length],
      debut: o.debut,
      joursOuvres: o.joursOuvres,
      creeLe: o.maintenant ?? new Date().toISOString(),
      source: { type: o.type ?? 'excel', ...(o.fichier ? { fichier: o.fichier } : {}), le: o.aujourdhui },
    };
    const ids = new Map(pl.taches.map((b) => [b.cle, o.nouvelId()]));
    const enfants = new Map<string | null, Brouillon[]>();
    for (const b of pl.taches) {
      const p = b.parentCle && ids.has(b.parentCle) ? b.parentCle : null;
      enfants.set(p, [...(enfants.get(p) ?? []), b]);
    }
    const resumes = new Set(pl.taches.filter((b) => (enfants.get(b.cle)?.length ?? 0) > 0 || b.sousTaches.length > 0).map((b) => b.cle));
    const rang = new Map<string, number>();
    for (const l of enfants.values()) l.forEach((b, i) => rang.set(b.cle, i));
    const ouvres = o.joursOuvres;
    const lot: Tache[] = [];

    for (const b of pl.taches) {
      const id = ids.get(b.cle)!;
      const jalon = b.jalon || b.duree === 0;
      const resume = resumes.has(b.cle);
      let debut: string | null = null;
      let echeance: string | null = null;
      let duree: number | undefined;
      let fixe = false;
      if (!resume) {
        if (jalon) {
          const d = b.debut ?? b.fin;
          if (d) {
            debut = d;
            echeance = d;
            fixe = true;
          }
          duree = 0;
        } else if (b.debut && b.fin) {
          debut = b.debut;
          echeance = b.fin;
          fixe = true;
          duree = dureeEntre(b.debut, b.fin, ouvres);
        } else if (b.debut) {
          duree = b.duree ?? 1;
          debut = b.debut;
          echeance = finDepuis(b.debut, duree, ouvres);
          fixe = true;
        } else if (b.fin) {
          duree = b.duree ?? 1;
          debut = decalerDate(b.fin, -(duree - 1), ouvres);
          echeance = b.fin;
          fixe = true;
        } else duree = b.duree ?? 1;
      }
      const delai = Math.max(0, ...b.apres.map((a) => a.delai));
      const cats = b.categories.map(idCategorie).filter((x): x is string => !!x);
      const fait = b.fait === true;
      lot.push({
        id,
        titre: b.titre,
        source: o.source,
        priorite: b.priorite ?? 'moyenne',
        echeance,
        statut: fait ? 'fait' : 'en_attente',
        ...(fait ? { faitLe: echeance ?? debut ?? null } : {}),
        mode: o.mode,
        creeLe: o.maintenant ?? new Date().toISOString(),
        projet: projet.id,
        ...(b.parentCle && ids.has(b.parentCle) ? { parent: ids.get(b.parentCle)! } : {}),
        ...(b.apres.length ? { apres: b.apres.filter((a) => ids.has(a.cle)).map((a) => ids.get(a.cle)!) } : {}),
        ...(delai > 0 ? { delai } : {}),
        ...(debut ? { debut } : {}),
        ...(duree !== undefined ? { duree } : {}),
        ...(fixe ? { fixe: true } : {}),
        ...(!fait && b.avancement ? { avancement: b.avancement } : {}),
        ...(jalon && !resume ? { jalon: true } : {}),
        ...(b.responsable ? { responsable: b.responsable } : {}),
        ...(b.note ? { note: b.note } : {}),
        ...(b.etat && !fait ? { etat: b.etat } : {}),
        ...(b.pilier.length ? { pilier: b.pilier } : {}),
        ...(b.indicateur ? { indicateur: b.indicateur } : {}),
        ...(b.critere ? { critere: b.critere } : {}),
        ...(b.budget !== null ? { budget: b.budget } : {}),
        ...(b.engage !== null ? { engage: b.engage } : {}),
        ...(cats.length ? { categories: cats } : {}),
        ordre: rang.get(b.cle) ?? 0,
        ref: b.cle,
      });
    }

    // Sous-tâches listées dans une cellule : des enfants de cette tâche, enchaînés et se partageant sa durée.
    for (const b of pl.taches) {
      if (!b.sousTaches.length) continue;
      const parent = lot.find((t) => t.id === ids.get(b.cle))!;
      const deja = lot.filter((t) => t.parent === parent.id).length;
      const total = b.duree && b.duree > 0 ? b.duree : b.sousTaches.length;
      const base = Math.floor(total / b.sousTaches.length);
      const surplus = total % b.sousTaches.length;
      const nouveaux = b.sousTaches.map((titre, i) => ({ titre, id: o.nouvelId(), i }));
      for (const s of nouveaux) {
        lot.push({
          id: s.id,
          titre: s.titre,
          source: parent.source,
          priorite: parent.priorite,
          echeance: null,
          statut: parent.statut === 'fait' ? 'fait' : 'en_attente',
          ...(parent.statut === 'fait' ? { faitLe: parent.faitLe ?? null } : {}),
          mode: parent.mode,
          creeLe: parent.creeLe,
          projet: projet.id,
          parent: parent.id,
          ordre: deja + s.i,
          duree: o.enchainerSousTaches ? Math.max(1, base + (s.i < surplus ? 1 : 0)) : 1,
          ...(o.enchainerSousTaches && s.i > 0 ? { apres: [nouveaux[s.i - 1].id] } : {}),
          ...(parent.categories ? { categories: parent.categories } : {}),
          ...(parent.responsable ? { responsable: parent.responsable } : {}),
          ...(b.debut && s.i === 0 ? { debut: b.debut, fixe: true } : {}),
        });
      }
      // Le parent devient un résumé : ses dates et sa durée viennent des étapes.
      const i = lot.findIndex((t) => t.id === parent.id);
      const { duree: _d, fixe: _f, debut: _b, jalon: _j, ...sans } = lot[i];
      void [_d, _f, _b, _j];
      lot[i] = { ...sans, echeance: null };
    }

    // Sans date ni lien, une tâche suit la précédente de son niveau (si on le demande).
    if (o.enchainer) {
      const freres = new Map<string | undefined, Tache[]>();
      for (const t of lot) freres.set(t.parent, [...(freres.get(t.parent) ?? []), t]);
      for (const l of freres.values()) {
        l.sort((a, z) => (a.ordre ?? 0) - (z.ordre ?? 0));
        for (let i = 1; i < l.length; i++) {
          const t = l[i];
          const avant = l[i - 1];
          // Seulement entre tâches simples : ni date imposée, ni lien, ni résumé de part et d'autre.
          const simple = (x: Tache) => !x.fixe && !x.apres?.length && !lot.some((y) => y.parent === x.id);
          if (simple(t) && !t.jalon && !lot.some((y) => y.parent === avant.id) && !avant.jalon) t.apres = [avant.id];
          else if (simple(t) && !lot.some((y) => y.parent === avant.id)) t.apres = [avant.id];
        }
      }
    }
    // Départ du planning : la date choisie, sinon la plus ancienne date du fichier.
    const premiere = lot.map((t) => t.debut).filter((d): d is string => !!d).sort()[0];
    projets.push({ ...projet, debut: o.debut ?? premiere ?? null });
    taches = taches.concat(lot);
  });
  const rangees: Tache[] = [];
  for (const p of projets) rangees.push(...replanifier(taches.filter((t) => t.projet === p.id), p, o.aujourdhui));
  return { projets, taches: rangees, categoriesCreees: creees };
}

/* ---------- Mise à jour d'un projet déjà importé ---------- */

export type Fusion = { taches: Tache[]; ajoutees: number; modifiees: number; absentes: number };

/**
 * Remet à jour un projet à partir d'une nouvelle version du fichier : les tâches sont reconnues à leur repère (`ref`), ce qui est
 * fait reste fait, ce qui est nouveau est ajouté, et ce qui a disparu du fichier est gardé (rien n'est supprimé sans toi).
 */
export function fusionnerImport(existantes: Tache[], importees: Tache[], projetExistant: string, projetImporte: string): Fusion {
  const mine = existantes.filter((t) => t.projet === projetExistant);
  const parRef = new Map(mine.filter((t) => t.ref).map((t) => [t.ref!, t]));
  const traduction = new Map<string, string>();
  for (const t of importees) {
    const e = t.ref ? parRef.get(t.ref) : undefined;
    traduction.set(t.id, e ? e.id : t.id);
  }
  let ajoutees = 0;
  let modifiees = 0;
  const gardees = new Set<string>();
  const changees = new Map<string, Tache>();
  const neuves: Tache[] = [];
  for (const t of importees) {
    if (t.projet !== projetImporte) continue;
    const id = traduction.get(t.id)!;
    const e = t.ref ? parRef.get(t.ref) : undefined;
    const apres = t.apres?.map((a) => traduction.get(a) ?? a);
    const { parent: _pa, apres: _ap, ...base } = t;
    void [_pa, _ap];
    const rattache = { ...base, id, projet: projetExistant, ...(t.parent ? { parent: traduction.get(t.parent) ?? t.parent } : {}), ...(apres ? { apres } : {}) };
    if (!e) {
      neuves.push(rattache);
      ajoutees++;
      continue;
    }
    gardees.add(e.id);
    // On garde ce qui est propre à l'utilisateur : état, avancement, rappels ; le reste suit le fichier.
    const { parent: _p0, apres: _a0, debut: _d0, fixe: _f0, duree: _du0, jalon: _j0, ...sansPlan } = e;
    void [_p0, _a0, _d0, _f0, _du0, _j0];
    const fait = e.statut === 'fait' || rattache.statut === 'fait';
    changees.set(e.id, {
      ...sansPlan,
      titre: rattache.titre,
      priorite: rattache.priorite,
      echeance: rattache.echeance,
      statut: fait ? 'fait' : 'en_attente',
      ...(fait ? { faitLe: e.faitLe ?? rattache.faitLe ?? null } : { faitLe: null }),
      ...(rattache.parent ? { parent: rattache.parent } : {}),
      ...(rattache.apres ? { apres: rattache.apres } : {}),
      ...(rattache.delai ? { delai: rattache.delai } : {}),
      ...(rattache.debut ? { debut: rattache.debut } : {}),
      ...(rattache.duree !== undefined ? { duree: rattache.duree } : {}),
      ...(rattache.fixe ? { fixe: true } : {}),
      ...(rattache.jalon ? { jalon: true } : {}),
      ...(rattache.responsable ? { responsable: rattache.responsable } : e.responsable ? { responsable: e.responsable } : {}),
      ...(rattache.note ? { note: rattache.note } : e.note ? { note: e.note } : {}),
      // Le budget suit le fichier ; ce qui a été engagé se saisit dans l'app et n'est écrasé que si le fichier en donne un.
      ...(rattache.pilier ? { pilier: rattache.pilier } : e.pilier ? { pilier: e.pilier } : {}),
      ...(rattache.indicateur ? { indicateur: rattache.indicateur } : e.indicateur ? { indicateur: e.indicateur } : {}),
      ...(rattache.critere ? { critere: rattache.critere } : e.critere ? { critere: e.critere } : {}),
      ...(!fait && (rattache.etat ?? e.etat) ? { etat: rattache.etat ?? e.etat } : {}),
      ...(rattache.budget !== undefined ? { budget: rattache.budget } : e.budget !== undefined ? { budget: e.budget } : {}),
      ...(rattache.engage !== undefined ? { engage: rattache.engage } : e.engage !== undefined ? { engage: e.engage } : {}),
      ...(rattache.categories ? { categories: [...new Set([...(e.categories ?? []), ...rattache.categories])] } : e.categories ? { categories: e.categories } : {}),
      ...(!fait && (rattache.avancement ?? e.avancement) ? { avancement: rattache.avancement ?? e.avancement } : {}),
      ordre: rattache.ordre,
    });
    modifiees++;
  }
  const absentes = mine.filter((t) => t.ref && !gardees.has(t.id)).length;
  const taches = [...existantes.map((t) => changees.get(t.id) ?? t), ...neuves];
  return { taches, ajoutees, modifiees, absentes };
}
