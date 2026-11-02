import { cle, lireJson } from './copilote';
import { lirePhrase } from './phrase';
import { creerTache, replanifier, resumes } from './planning';
import { sansMarkdown } from './plan-du-jour';
import type { ActionCompteRendu, Boite, ClotureCompteRendu, CompteRendu, Espace, Frequence, GenreCompteRendu, Habitude, Mode, Priorite, Relance, Tache } from './types';

/**
 * Comptes rendus : ce qui s'est dit en réunion, au téléphone ou lors d'un point, rattaché à des projets,
 * des tâches ou des relances. Depuis un compte rendu, on clôture ce qui est réglé et on ouvre les tâches
 * et relances qui en sortent ; chacune garde le lien vers le compte rendu d'origine.
 * Module pur, testé dans tests/comptes-rendus.test.ts.
 */

export const GENRES_CR: { key: GenreCompteRendu; label: string; emoji: string }[] = [
  { key: 'reunion', label: 'Réunion', emoji: '👥' },
  { key: 'appel', label: 'Appel', emoji: '📞' },
  { key: 'point', label: 'Point d’avancement', emoji: '📈' },
  { key: 'client', label: 'Rendez-vous client', emoji: '🤝' },
  { key: 'autre', label: 'Autre', emoji: '📝' },
];
export const genreCR = (g: GenreCompteRendu) => GENRES_CR.find((x) => x.key === g) ?? GENRES_CR[GENRES_CR.length - 1];

export const comptesRendusDe = (e: Pick<Espace, 'comptesRendus'>) => e.comptesRendus ?? [];

/** Les comptes rendus du plus récent au plus ancien (même jour : le dernier écrit d'abord). */
export const trierComptesRendus = (crs: CompteRendu[]) => [...crs].sort((a, b) => b.date.localeCompare(a.date) || b.creeLe.localeCompare(a.creeLe));

export function nouveauCompteRendu(o: { id: string; date: string; maintenant: string; genre?: GenreCompteRendu; titre?: string; projets?: string[]; taches?: string[]; relances?: string[] }): CompteRendu {
  return {
    id: o.id,
    titre: o.titre ?? '',
    date: o.date,
    genre: o.genre ?? 'reunion',
    notes: '',
    actions: [],
    ...(o.projets?.length ? { projets: o.projets } : {}),
    ...(o.taches?.length ? { taches: o.taches } : {}),
    ...(o.relances?.length ? { relances: o.relances } : {}),
    creeLe: o.maintenant,
  };
}

/** Un titre par défaut quand rien n'est saisi : « Réunion · Lancement du site », « Appel · Paul ». */
export function titreParDefaut(cr: Pick<CompteRendu, 'genre' | 'projets' | 'relances' | 'participants'>, e: Pick<Espace, 'projets' | 'relances'>): string {
  const g = genreCR(cr.genre).label;
  const projet = cr.projets?.length ? e.projets?.find((p) => p.id === cr.projets![0])?.nom : undefined;
  const contact = cr.relances?.length ? e.relances.find((r) => r.id === cr.relances![0])?.contact : undefined;
  const qui = projet ?? contact ?? cr.participants?.[0];
  return qui ? `${g} · ${qui}` : g;
}

/* ——— Saisie rapide : lire les notes sans IA ——— */

export type LectureNotes = {
  decisions: string[];
  actions: Omit<ActionCompteRendu, 'id'>[];
  /** Ce qui est noté comme fait ou réglé : rapproché ensuite des tâches et relances ouvertes. */
  faits: string[];
};

const PUCE = /^\s*(?:[-*•–—]+|\d{1,2}[.)])\s*/;
const MARQUE_FAIT = /^(?:\[[xX✓✔]\]|[✓✔✅☑]|(?:fait|faite|réglé|réglée|regle|terminé|terminée|termine|clos|close|ok|done)\s*[:–-])\s*/i;
const MARQUE_ACTION = /^(?:\[\s?\]|[☐→➜]|->|(?:todo|à faire|a faire|action|actions|next|suite)\s*[:–-])\s*/i;
const MARQUE_DECISION = /^(?:(?:décision|decision|décisions|decisions|décidé|decide|acté|acte|validé|valide|on part sur)\s*[:–-])\s*/i;
const TITRE_SECTION: { re: RegExp; section: Section }[] = [
  { re: /^(?:décisions?|decisions?|ce qui est décidé|acté)\s*:?$/i, section: 'decisions' },
  { re: /^(?:actions?|à faire|a faire|prochaines étapes|prochaines etapes|todo|suites?|next steps?)\s*:?$/i, section: 'actions' },
  { re: /^(?:fait|faits|réglé|réglés|regle|terminé|terminés|clos|done)\s*:?$/i, section: 'faits' },
];
type Section = 'notes' | 'decisions' | 'actions' | 'faits';
// Une ligne libre qui commence par l'un de ces verbes est une action, même hors de la section « Actions ».
const VERBE_RELANCE = /^(?:relancer|recontacter|rappeler)\s/i;

const propre = (s: string) => s.replace(/\s+/g, ' ').replace(/[.;]+$/, '').trim();
const majuscule = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Une ligne d'action : « @Paul envoyer le devis vendredi », « Relancer Marie lundi pour la facture ». */
export function lireAction(ligne: string, d: string): Omit<ActionCompteRendu, 'id'> | null {
  let t = ligne;
  let responsable: string | undefined;
  const at = /(^|\s)@([\p{L}][\p{L}\p{N}_.-]*)/u.exec(t);
  if (at) {
    responsable = at[2];
    t = (t.slice(0, at.index) + ' ' + t.slice(at.index + at[0].length)).trim();
  }
  const p = lirePhrase(propre(t), d);
  if (!p) return null;
  const qui = responsable ? { responsable } : {};
  // « pour la facture » : le sujet se lit sans son article (« Facture »).
  if (p.genre === 'relance') return { genre: 'relance', titre: majuscule(p.sujet.replace(/^(?:la|le|les|l['’]|un|une|des)\s*/i, '')) || p.sujet, contact: p.contact, echeance: p.date ?? d, priorite: 'moyenne', ...qui };
  if (p.genre === 'tache') return { genre: 'tache', titre: p.titre, echeance: p.echeance, priorite: p.priorite, ...qui };
  // Une fréquence ou un montant n'en fait pas une habitude ni une dépense ici : on garde la ligne comme tâche.
  const titre = majuscule(propre(t));
  return titre ? { genre: 'tache', titre, echeance: null, priorite: 'moyenne', ...qui } : null;
}

/**
 * Lit des notes prises au fil de la réunion. Sont reconnus :
 * - les sections « Décisions », « Actions » (ou « À faire », « Prochaines étapes ») et « Fait » ;
 * - les marques en début de ligne : « Décision : », « [ ] », « TODO : », « → », « [x] », « ✓ », « Fait : » ;
 * - une ligne qui commence par « Relancer », « Rappeler » ou « Recontacter ».
 * Le reste est gardé comme notes. La date (« vendredi », « le 12/11 ») et « @Paul » sont lus dans chaque action.
 */
export function lireNotes(notes: string, d: string): LectureNotes {
  const out: LectureNotes = { decisions: [], actions: [], faits: [] };
  const vues = new Set<string>();
  let section: Section = 'notes';
  for (const brute of notes.split(/\r?\n/)) {
    const sansPuce = brute.replace(PUCE, '').trim();
    if (!sansPuce) continue;
    const titre = TITRE_SECTION.find((s) => s.re.test(sansPuce.replace(/^#+\s*/, '')));
    if (titre) {
      section = titre.section;
      continue;
    }
    // Un titre qui n'est pas une section connue (« Contexte : ») ramène aux notes.
    if (/^#+\s/.test(sansPuce) || (/:$/.test(sansPuce) && sansPuce.length < 40 && !PUCE.test(brute))) {
      section = 'notes';
      continue;
    }
    let genre: Section = section;
    let texte = sansPuce;
    const marque = ([['faits', MARQUE_FAIT], ['actions', MARQUE_ACTION], ['decisions', MARQUE_DECISION]] as const).find(([, re]) => re.test(texte));
    if (marque) {
      genre = marque[0];
      texte = texte.replace(marque[1], '');
    } else if (section === 'notes' && VERBE_RELANCE.test(texte)) genre = 'actions';
    texte = propre(texte);
    if (!texte) continue;
    if (genre === 'decisions') out.decisions.push(majuscule(texte));
    else if (genre === 'faits') out.faits.push(majuscule(texte));
    else if (genre === 'actions') {
      const a = lireAction(texte, d);
      const k = a ? `${a.genre}:${cle(a.contact ?? '')}:${cle(a.titre)}` : '';
      if (a && !vues.has(k)) {
        vues.add(k);
        out.actions.push(a);
      }
    }
  }
  return out;
}

/* ——— Ce que le compte rendu peut clôturer ——— */

export type Candidat = { ref: string; genre: 'tache' | 'relance'; id: string; titre: string; detail?: string; fait: boolean; /** Clôturé depuis ce compte rendu. */ parCe: boolean };

export const refDe = (genre: 'tache' | 'relance', id: string) => `${genre === 'tache' ? 't' : 'r'}:${id}`;
export const deRef = (ref: string): { genre: 'tache' | 'relance'; id: string } | null => {
  const m = /^([tr]):(.+)$/.exec(ref);
  return m ? { genre: m[1] === 't' ? 'tache' : 'relance', id: m[2] } : null;
};

const titreRelance = (r: Pick<Relance, 'contact' | 'sujet'>) => `${r.contact} · ${r.sujet}`;

/**
 * Les tâches et relances que ce compte rendu peut clôturer : celles qui lui sont rattachées, les tâches des projets
 * rattachés (sans les résumés, qui suivent leurs sous-tâches) et ce qu'il a déjà clôturé (pour pouvoir le rouvrir).
 * Les tâches et relances nées de ce compte rendu n'y sont pas : elles sont dans ses points d'action.
 */
export function candidatsCloture(e: Pick<Espace, 'taches' | 'relances' | 'projets'>, cr: CompteRendu): Candidat[] {
  const clos = new Set((cr.clotures ?? []).map((c) => refDe(c.genre, c.id)));
  const nees = new Set(cr.actions.map((a) => a.cree).filter(Boolean));
  const parents = resumes(e.taches);
  const projets = new Set(cr.projets ?? []);
  const taches = new Set(cr.taches ?? []);
  const relances = new Set(cr.relances ?? []);
  const out: Candidat[] = [];
  for (const t of e.taches) {
    const ref = refDe('tache', t.id);
    const lie = taches.has(t.id) || (t.projet && projets.has(t.projet) && !parents.has(t.id));
    if (!(lie || clos.has(ref)) || (nees.has(t.id) && !clos.has(ref))) continue;
    const fait = t.statut === 'fait';
    // Une tâche de projet déjà faite avant ce compte rendu n'a rien à y faire.
    if (fait && !clos.has(ref) && !taches.has(t.id)) continue;
    const projet = t.projet ? e.projets?.find((p) => p.id === t.projet) : undefined;
    out.push({ ref, genre: 'tache', id: t.id, titre: t.titre, detail: projet ? `${projet.emoji} ${projet.nom}` : t.echeance ? `Pour le ${t.echeance.slice(8, 10)}/${t.echeance.slice(5, 7)}` : undefined, fait, parCe: clos.has(ref) });
  }
  for (const r of e.relances) {
    const ref = refDe('relance', r.id);
    if (!(relances.has(r.id) || clos.has(ref)) || (nees.has(r.id) && !clos.has(ref))) continue;
    out.push({ ref, genre: 'relance', id: r.id, titre: titreRelance(r), detail: r.statut === 'relance' ? 'Relancé' : undefined, fait: r.statut === 'repondu', parCe: clos.has(ref) });
  }
  // Ce qui reste à faire d'abord.
  return out.sort((a, b) => Number(a.fait) - Number(b.fait));
}

const MOTS_VIDES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'l', 'a', 'au', 'aux', 'et', 'ou', 'pour', 'sur', 'avec', 'en', 'est', 'sont', 'a', 'ete', 'bien', 'fait', 'faite', 'regle', 'termine', 'ok']);
const racine = (m: string) => m.replace(/(ees|ee|es|e|s|er|ez|ent)$/, '');
const motsDe = (s: string) => new Set(cle(s).split(' ').filter((m) => m.length > 1 && !MOTS_VIDES.has(m)).map(racine));

/**
 * Les éléments ouverts que les lignes « fait » désignent : « ✓ Devis envoyé » ferme « Envoyer le devis à Paul ».
 * Une ligne désigne l'élément dont elle reprend le plus de mots, s'il en reprend au moins les deux tiers (ou tous, s'il en a deux ou moins).
 */
export function rapprocherFaits(faits: string[], candidats: Pick<Candidat, 'ref' | 'titre' | 'fait'>[]): string[] {
  const ouverts = candidats.filter((c) => !c.fait).map((c) => ({ ref: c.ref, mots: motsDe(c.titre) }));
  const trouves = new Set<string>();
  for (const f of faits) {
    const m = motsDe(f);
    let meilleur: { ref: string; score: number } | null = null;
    for (const c of ouverts) {
      if (!c.mots.size) continue;
      const communs = [...c.mots].filter((x) => m.has(x)).length;
      const score = communs / c.mots.size;
      const seuil = c.mots.size <= 2 ? 1 : 2 / 3;
      if (communs && score >= seuil && (!meilleur || score > meilleur.score)) meilleur = { ref: c.ref, score };
    }
    if (meilleur) trouves.add(meilleur.ref);
  }
  return [...trouves];
}

/* ——— L'analyse par l'IA (me-api, type « compte_rendu ») ——— */

export type AnalyseCompteRendu = { resume: string; decisions: string[]; actions: Omit<ActionCompteRendu, 'id'>[]; /** Références (« t:… », « r:… ») des éléments réglés d'après les notes. */ clotures: string[] };

export const MAX_TRANSCRIPTION = 100_000;

/** Ce que l'app envoie à l'IA : le compte rendu, ce à quoi il est rattaché, et les éléments ouverts qu'il pourrait clôturer. */
export type Connus = { membres?: { id: string; nom: string }[]; projets?: { id: string; nom: string }[] };

export function donneesCompteRendu(cr: CompteRendu, e: Pick<Espace, 'taches' | 'relances' | 'projets'>, d: string, o: { transcription?: boolean; membres?: Connus['membres'] } = {}): string {
  const ouverts = candidatsCloture(e, cr).filter((c) => !c.fait);
  return JSON.stringify({
    aujourdhui: d,
    titre: cr.titre,
    date: cr.date,
    genre: genreCR(cr.genre).label,
    ...(cr.participants?.length ? { participants: cr.participants } : {}),
    projets: (cr.projets ?? []).map((id) => e.projets?.find((p) => p.id === id)?.nom).filter(Boolean),
    jourSemaine: new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long' }),
    notes: cr.notes.slice(0, 12000),
    // Une réunion d'une heure fait ~60 000 caractères : le serveur en lit jusqu'à 120 000.
    // Sans droit aux réunions (Pro 0), le texte d'un ancien enregistrement n'est pas envoyé : l'analyse reste celle des notes.
    ...(o.transcription !== false && cr.transcription?.trim() ? { transcription: cr.transcription.slice(0, MAX_TRANSCRIPTION) } : {}),
    // Pour attribuer les actions : les membres de l'équipe et les projets, désignés par leur identifiant.
    ...(o.membres?.length ? { membres: o.membres.slice(0, 40).map((m) => ({ ref: m.id, nom: m.nom })) } : {}),
    ...(e.projets?.length ? { projetsConnus: e.projets.slice(0, 60).map((p) => ({ ref: p.id, nom: p.nom })) } : {}),
    ouverts: ouverts.slice(0, 60).map((c) => ({ ref: c.ref, genre: c.genre, titre: c.titre })),
  });
}

const FREQUENCES: Frequence[] = ['quotidien', 'hebdo', 'mensuel'];
const PRIORITES: Priorite[] = ['haute', 'moyenne', 'basse'];
const texte = (v: unknown, max = 200) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const jourOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** La réponse de l'IA, ramenée à des valeurs sûres. Une clôture qui ne désigne pas un élément ouvert proposé est ignorée. */
export function lireAnalyseCompteRendu(brut: string, refsOuvertes: string[], d: string, connus: Connus = {}): AnalyseCompteRendu {
  const j = lireJson(brut) ?? {};
  const vues = new Set<string>();
  const actions: Omit<ActionCompteRendu, 'id'>[] = [];
  for (const a of Array.isArray(j.actions) ? j.actions : []) {
    if (!a || typeof a !== 'object') continue;
    const x = a as Record<string, unknown>;
    const contact = texte(x.contact, 80);
    const genre: ActionCompteRendu['genre'] = x.genre === 'relance' && contact ? 'relance' : x.genre === 'mail' && contact ? 'mail' : x.genre === 'habitude' && FREQUENCES.includes(x.frequence as Frequence) ? 'habitude' : 'tache';
    const titre = texte(x.titre, 160);
    const k = `${genre}:${cle(genre === 'relance' || genre === 'mail' ? contact : '')}:${cle(titre)}`;
    if (!titre || vues.has(k)) continue;
    vues.add(k);
    const frequence = x.frequence as Frequence;
    const jour = typeof x.jour === 'number' && Number.isInteger(x.jour) ? x.jour : null;
    const heure = typeof x.heure === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.heure) ? x.heure : undefined;
    // Un membre ou un projet inventé par l'IA (hors de ceux envoyés) est ignoré.
    const membre = typeof x.membre === 'string' ? connus.membres?.find((m) => m.id === x.membre) : undefined;
    const projet = typeof x.projet === 'string' ? connus.projets?.find((p) => p.id === x.projet) : undefined;
    actions.push({
      genre,
      titre,
      ...(membre && genre !== 'mail' ? { membre: membre.id } : {}),
      ...(projet && genre === 'tache' ? { projet: projet.id } : {}),
      ...(genre === 'relance' || genre === 'mail' ? { contact } : {}),
      ...(genre === 'mail' && texte(x.corps, 2000) ? { corps: String(x.corps).replace(/\r/g, '').trim().slice(0, 2000) } : {}),
      ...(genre === 'habitude' ? { frequence, jour: frequence === 'hebdo' ? (jour !== null && jour >= 0 && jour <= 6 ? jour : 1) : frequence === 'mensuel' ? (jour !== null && jour >= 1 && jour <= 28 ? jour : 1) : null, ...(heure ? { heure } : {}) } : {}),
      ...(membre && genre !== 'mail' ? { responsable: membre.nom } : texte(x.responsable, 60) ? { responsable: texte(x.responsable, 60) } : {}),
      priorite: PRIORITES.includes(x.priorite as Priorite) ? (x.priorite as Priorite) : 'moyenne',
      echeance: genre === 'habitude' ? null : jourOk(x.echeance) ?? (genre === 'relance' ? d : null),
    });
    if (actions.length >= 25) break;
  }
  const ok = new Set(refsOuvertes);
  return {
    resume: typeof j.resume === 'string' ? sansMarkdown(j.resume).trim() : '',
    decisions: (Array.isArray(j.decisions) ? j.decisions : []).map((x) => texte(x, 240)).filter(Boolean).slice(0, 10),
    actions,
    clotures: [...new Set((Array.isArray(j.clotures) ? j.clotures : []).map((x) => String(x)).filter((r) => ok.has(r)))],
  };
}

/** Ajoute les actions lues (notes ou IA) au compte rendu, sans doublon avec celles qu'il a déjà. */
export function fusionnerActions(cr: CompteRendu, nouvelles: Omit<ActionCompteRendu, 'id'>[], id: () => string): ActionCompteRendu[] {
  const k = (a: Pick<ActionCompteRendu, 'genre' | 'titre' | 'contact'>) => `${a.genre}:${cle(a.contact ?? '')}:${cle(a.titre)}`;
  const deja = new Set(cr.actions.map(k));
  const ajout = nouvelles.filter((a) => !deja.has(k(a)) && (deja.add(k(a)), true)).map((a) => ({ id: id(), ...a }));
  return [...cr.actions, ...ajout];
}

/* ——— Ouvrir et clôturer depuis le compte rendu ——— */

export const majCompteRendu = (e: Espace, id: string, fn: (cr: CompteRendu) => CompteRendu): Espace => ({ ...e, comptesRendus: comptesRendusDe(e).map((x) => (x.id === id ? fn(x) : x)) });

export type OptionsOuvrir = { id: () => string; maintenant: string; d: string; modeTache: Mode; modeRelance: Mode; /** Défaut : `modeTache`. */ modeHabitude?: Mode; boite: Boite; /** Les tâches vont dans ce projet (le projet rattaché, s'il n'y en a qu'un). */ projet?: string; /** Les membres de l'équipe : une action confiée à l'un d'eux lui est affectée. */ membres?: { id: string; nom: string }[] };

/**
 * Crée les tâches et relances des points d'action choisis, avec le lien vers le compte rendu.
 * Un point déjà converti n'est pas recréé ; un point qui reprend une tâche ou une relance ouverte (même titre) y est relié au lieu d'en créer une autre.
 * Rend l'espace modifié et les identifiants créés (pour « Annuler »).
 */
export function ouvrirActions(e: Espace, crId: string, actionIds: Iterable<string>, o: OptionsOuvrir): { espace: Espace; crees: { genre: 'tache' | 'relance' | 'habitude'; id: string }[] } {
  const cr = comptesRendusDe(e).find((x) => x.id === crId);
  if (!cr) return { espace: e, crees: [] };
  const choisis = new Set(actionIds);
  let taches = e.taches;
  let relances = e.relances;
  let habitudes = e.habitudes;
  const crees: { genre: 'tache' | 'relance' | 'habitude'; id: string }[] = [];
  const habitudeExistante = new Map(e.habitudes.map((h) => [cle(h.nom), h.id]));
  const tacheOuverte = new Map(e.taches.filter((t) => t.statut !== 'fait').map((t) => [cle(t.titre), t.id]));
  const relanceOuverte = new Map(e.relances.filter((r) => r.statut !== 'repondu').map((r) => [`${cle(r.contact)}|${cle(r.sujet)}`, r.id]));
  const projetParDefaut = o.projet ? e.projets?.find((p) => p.id === o.projet) : undefined;
  const projetsTouches = new Map<string, NonNullable<Espace['projets']>[number]>();
  // À qui revient l'action : le membre de l'équipe (le serveur le prévient), sinon le nom noté.
  const affectation = (a: ActionCompteRendu) => {
    const m = a.membre ? o.membres?.find((x) => x.id === a.membre) : undefined;
    return m ? { affecteA: m.id, responsable: m.nom } : a.responsable ? { responsable: a.responsable } : {};
  };
  const actions = cr.actions.map((a) => {
    // Un mail ne part jamais seul : il s'écrit et se relit depuis le compte rendu.
    if (!choisis.has(a.id) || a.cree || a.genre === 'mail') return a;
    if (a.genre === 'habitude') {
      const existante = habitudeExistante.get(cle(a.titre));
      if (existante) return { ...a, cree: existante };
      const h: Habitude = { id: o.id(), nom: a.titre, categorie: 'perso', frequence: a.frequence ?? 'hebdo', jour: a.jour ?? null, ...(a.heure ? { heure: a.heure } : {}), mode: o.modeHabitude ?? o.modeTache, coches: [], ordre: habitudes.length, compteRendu: cr.id, ...(cr.categories?.length ? { categories: cr.categories } : {}) };
      habitudes = [...habitudes, h];
      habitudeExistante.set(cle(h.nom), h.id);
      crees.push({ genre: 'habitude', id: h.id });
      return { ...a, cree: h.id };
    }
    if (a.genre === 'relance') {
      const existante = relanceOuverte.get(`${cle(a.contact ?? '')}|${cle(a.titre)}`);
      if (existante) return { ...a, cree: existante };
      const r: Relance = { id: o.id(), contact: a.contact || a.responsable || 'Contact', sujet: a.titre, boite: o.boite, date: a.echeance || o.d, statut: 'a_faire', mode: o.modeRelance, creeLe: o.maintenant, compteRendu: cr.id, ...affectation(a), ...(cr.categories?.length ? { categories: cr.categories } : {}) };
      relances = [r, ...relances];
      crees.push({ genre: 'relance', id: r.id });
      return { ...a, cree: r.id };
    }
    const existante = tacheOuverte.get(cle(a.titre));
    if (existante) return { ...a, cree: existante };
    const id = o.id();
    const commun = { source: 'manuel' as const, priorite: a.priorite ?? 'moyenne', mode: o.modeTache };
    const extra = { compteRendu: cr.id, ...affectation(a), ...(cr.categories?.length ? { categories: cr.categories } : {}) };
    // Le projet dont parle l'action (dit en réunion) passe avant celui du compte rendu.
    const projet = (a.projet && e.projets?.find((p) => p.id === a.projet)) || projetParDefaut;
    if (projet) {
      projetsTouches.set(projet.id, projet);
      // Une tâche de projet prend sa place dans le planning ; une échéance dite en réunion devient sa date imposée.
      taches = creerTache(taches, commun, { id, titre: a.titre, projet: projet.id, duree: 1, ...(a.echeance ? { debut: a.echeance, echeance: a.echeance, fixe: true } : {}), ...extra }, o.maintenant);
    } else {
      const t: Tache = { id, titre: a.titre, ...commun, echeance: a.echeance ?? null, statut: 'en_attente', faitLe: null, creeLe: o.maintenant, ...extra };
      taches = [t, ...taches];
    }
    crees.push({ genre: 'tache', id });
    return { ...a, cree: id };
  });
  for (const p of projetsTouches.values()) taches = replanifier(taches, p, o.d);
  const espace = majCompteRendu({ ...e, taches, relances, habitudes }, crId, (x) => ({ ...x, actions }));
  return { espace, crees };
}

/** Défait `ouvrirActions` : retire les éléments créés et rend leurs points d'action à nouveau convertibles. */
export function annulerOuverture(e: Espace, crId: string, crees: { genre: 'tache' | 'relance' | 'habitude'; id: string }[]): Espace {
  const ids = new Set(crees.map((c) => c.id));
  const n = { ...e, taches: e.taches.filter((t) => !ids.has(t.id)), relances: e.relances.filter((r) => !ids.has(r.id)), habitudes: e.habitudes.filter((h) => !ids.has(h.id)) };
  return majCompteRendu(n, crId, (cr) => ({ ...cr, actions: cr.actions.map((a) => (a.cree && ids.has(a.cree) ? { ...a, cree: undefined } : a)) }));
}

/** Note dans le compte rendu les éléments qu'il vient de clôturer (ou retire ceux qu'on rouvre). */
export function noterClotures(e: Espace, crId: string, refs: string[], d: string, rouvrir = false): Espace {
  const cibles = refs.map(deRef).filter((x): x is { genre: 'tache' | 'relance'; id: string } => !!x);
  return majCompteRendu(e, crId, (cr) => {
    const garde = (cr.clotures ?? []).filter((c) => !cibles.some((x) => x.genre === c.genre && x.id === c.id));
    const clotures: ClotureCompteRendu[] = rouvrir ? garde : [...garde, ...cibles.map((x) => ({ ...x, le: d }))];
    return { ...cr, clotures };
  });
}

/* ——— Le lien, vu depuis une tâche, une relance ou un projet ——— */

/** Les comptes rendus qui parlent de cet élément : rattachés, d'où il vient, ou qui l'ont clôturé. Les plus récents d'abord. */
export function comptesRendusLies(e: Pick<Espace, 'comptesRendus'>, genre: 'tache' | 'relance' | 'projet', id: string, origine?: string): CompteRendu[] {
  return trierComptesRendus(
    comptesRendusDe(e).filter((cr) => {
      if (cr.id === origine) return true;
      if (genre === 'projet') return !!cr.projets?.includes(id);
      if ((genre === 'tache' ? cr.taches : cr.relances)?.includes(id)) return true;
      return cr.actions.some((a) => a.cree === id) || !!cr.clotures?.some((c) => c.genre === genre && c.id === id);
    }),
  );
}

/** Le compte rendu qui a clôturé cet élément, s'il y en a un. */
export const clotureParCR = (e: Pick<Espace, 'comptesRendus'>, genre: 'tache' | 'relance', id: string) => comptesRendusDe(e).find((cr) => cr.clotures?.some((c) => c.genre === genre && c.id === id));

/** Où en est un compte rendu : points d'action à convertir, éléments ouverts qui en sont nés, éléments clôturés. */
export function etatCompteRendu(cr: CompteRendu, e: Pick<Espace, 'taches' | 'relances'> & { habitudes?: Habitude[] }) {
  const ouvert = (id: string) => e.habitudes?.some((h) => h.id === id) || e.taches.some((t) => t.id === id && t.statut !== 'fait') || e.relances.some((r) => r.id === id && r.statut !== 'repondu');
  const aConvertir = cr.actions.filter((a) => !a.cree).length; // un mail écrit prend « mail » dans `cree`
  const enCours = cr.actions.filter((a) => a.cree && ouvert(a.cree)).length;
  const terminees = cr.actions.filter((a) => a.cree && !ouvert(a.cree)).length;
  return { aConvertir, enCours, terminees, clos: cr.clotures?.length ?? 0 };
}

/** Supprime un compte rendu. Les tâches et relances qui en sont nées restent, sans le lien. */
export function supprimerCompteRendu(e: Espace, id: string): Espace {
  const sans = <T extends { compteRendu?: string }>(x: T): T => {
    if (x.compteRendu !== id) return x;
    const { compteRendu: _, ...reste } = x;
    return reste as T;
  };
  return { ...e, comptesRendus: comptesRendusDe(e).filter((x) => x.id !== id), taches: e.taches.map(sans), relances: e.relances.map(sans), habitudes: e.habitudes.map(sans) };
}
