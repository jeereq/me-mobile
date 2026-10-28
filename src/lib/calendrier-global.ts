import { addDays, doneIn, habitDue, parse } from './dates';
import { depensesEntre, financesDe, prochaineEcheance, revenusEntre } from './finances';
import { datesVersements, objectifsActifs, suiviObjectif } from './objectifs';
import { estDeMembre, type FiltreMembre } from './equipe-taches';
import type { MembreEquipe } from './equipes';
import { planifier, resumes, tachesDuProjet } from './planning';
import type { Espace, Evenement } from './types';

/**
 * Le calendrier : tout ce qui a une date, au même endroit.
 *
 * Rendez-vous de l'agenda, tâches (et tâches de projet, à leur échéance), début et fin des projets, relances, habitudes
 * prévues ou cochées, dépenses et revenus notés, paiements récurrents à venir, début et fin des budgets datés et de leurs
 * postes, échéances d'objectifs, versements faits et versements prévus par leur plan.
 *
 * Rien n'est stocké en plus : chaque événement se calcule depuis l'espace, pour la période demandée.
 * Dates en texte « AAAA-MM-JJ ».
 */

export type GenreEvt = 'agenda' | 'tache' | 'projet' | 'relance' | 'habitude' | 'depense' | 'revenu' | 'recurrent' | 'budget' | 'objectif';

/** Les genres dans l'ordre où ils se rangent dans une journée, avec leur nom et leur icône. */
export const GENRES: { key: GenreEvt; label: string; emoji: string }[] = [
  { key: 'agenda', label: 'Rendez-vous', emoji: '📅' },
  { key: 'tache', label: 'Tâches', emoji: '✅' },
  { key: 'projet', label: 'Projets', emoji: '📁' },
  { key: 'relance', label: 'Relances', emoji: '💬' },
  { key: 'habitude', label: 'Habitudes', emoji: '🔁' },
  { key: 'depense', label: 'Dépenses', emoji: '💸' },
  { key: 'revenu', label: 'Revenus', emoji: '💰' },
  { key: 'recurrent', label: 'À venir (récurrents)', emoji: '🔄' },
  { key: 'budget', label: 'Budgets', emoji: '🎯' },
  { key: 'objectif', label: 'Objectifs', emoji: '🏁' },
];
export const TOUS_GENRES: GenreEvt[] = GENRES.map((g) => g.key);
const RANG = new Map(TOUS_GENRES.map((g, i) => [g, i]));

export type Evt = {
  /** Identifiant unique dans la liste (genre, élément, jour). */
  cle: string;
  genre: GenreEvt;
  date: string;
  /** « HH:MM » pour un rendez-vous. */
  heure?: string;
  titre: string;
  detail?: string;
  /** Montant en valeur positive, dans la devise principale ; `sens` dit si l'argent sort ou entre. */
  montant?: number;
  sens?: 'sortie' | 'entree';
  fait?: boolean;
  /** Prévu pour un jour passé et pas fait. */
  retard?: boolean;
  /** Tâche de projet qui attend une tâche précédente. */
  bloque?: boolean;
  /** Habitude de chaque jour : elle remplirait chaque case du mois, la vue du mois ne la marque pas. */
  quotidien?: boolean;
  /** Pour une tâche : le membre à qui elle est confiée, et le nom du responsable (voir `equipe-taches.ts`). */
  affecteA?: string;
  responsable?: string;
  /** Ce qu'on peut cocher depuis le calendrier. */
  ref?: { type: 'tache' | 'relance' | 'habitude'; id: string };
  /** Le rendez-vous d'origine, pour le modifier dans son agenda quand il vient d'un compte connecté. */
  evenement?: Evenement;
  /** L'écran où se trouve l'élément. */
  lien: { chemin: string; params?: Record<string, string> };
};

type Options = { genres?: Iterable<GenreEvt> };

/** Tous les événements entre deux jours (inclus), triés par jour, heure puis genre. */
export function evenementsEntre(e: Espace, debut: string, fin: string, aujourdhui: string, options: Options = {}): Evt[] {
  const veut = new Set(options.genres ?? TOUS_GENRES);
  const out: Evt[] = [];
  const dans = (x?: string | null): x is string => !!x && x >= debut && x <= fin;
  const f = financesDe(e);
  const projets = (e.projets ?? []).filter((p) => !p.archive);
  const idsProjets = new Set((e.projets ?? []).map((p) => p.id));

  if (veut.has('agenda'))
    for (let d = debut; d <= fin; d = addDays(d, 1))
      for (const [i, ev] of (e.agenda?.[d] ?? []).entries())
        out.push({ cle: `agenda:${ev.id ?? i}:${d}`, genre: 'agenda', date: d, heure: ev.debut || undefined, titre: ev.titre, detail: [ev.lieu, ev.agenda].filter(Boolean).join(' · ') || undefined, evenement: ev, lien: ev.lien ? { chemin: '/sources' } : { chemin: '/' } });

  // Un plan par projet : sert aux tâches bloquées et aux dates de début et de fin.
  const plans = new Map<string, ReturnType<typeof planifier>>();
  if (veut.has('tache') || veut.has('projet'))
    for (const p of projets) {
      const mine = tachesDuProjet(e.taches, p.id);
      if (mine.length) plans.set(p.id, planifier(mine, p, aujourdhui));
    }

  if (veut.has('tache')) {
    const parents = resumes(e.taches);
    for (const t of e.taches) {
      if (parents.has(t.id)) continue;
      const date = t.echeance ?? (t.statut === 'fait' ? t.faitLe : null);
      if (!dans(date)) continue;
      const projet = t.projet && idsProjets.has(t.projet) ? e.projets!.find((p) => p.id === t.projet) : undefined;
      const fait = t.statut === 'fait';
      const ligne = projet ? plans.get(projet.id)?.lignes.get(t.id) : undefined;
      out.push({
        cle: `tache:${t.id}:${date}`,
        genre: 'tache',
        date,
        titre: t.titre,
        detail: projet ? `${projet.emoji} ${projet.nom}${t.jalon || t.duree === 0 ? ' · jalon' : ''}` : t.priorite === 'haute' ? 'Priorité haute' : undefined,
        fait,
        retard: !fait && date < aujourdhui,
        bloque: !!ligne?.bloquee,
        ref: { type: 'tache', id: t.id },
        ...(t.affecteA ? { affecteA: t.affecteA } : {}),
        ...(t.responsable ? { responsable: t.responsable } : {}),
        lien: projet ? { chemin: '/projets', params: { id: projet.id } } : { chemin: '/taches' },
      });
    }
  }

  if (veut.has('projet'))
    for (const p of projets) {
      const plan = plans.get(p.id);
      const debutP = plan?.debut ?? p.debut;
      const lien = { chemin: '/projets', params: { id: p.id } };
      if (dans(debutP)) out.push({ cle: `projet:${p.id}:debut`, genre: 'projet', date: debutP, titre: `Début : ${p.emoji} ${p.nom}`, lien });
      if (plan?.fin && dans(plan.fin)) {
        const fini = plan.avancement >= 100;
        out.push({ cle: `projet:${p.id}:fin`, genre: 'projet', date: plan.fin, titre: `Fin prévue : ${p.emoji} ${p.nom}`, detail: `${Math.round(plan.avancement)} % fait`, fait: fini, retard: !fini && plan.fin < aujourdhui, lien });
      }
    }

  if (veut.has('relance'))
    for (const r of e.relances) {
      const fait = r.statut === 'repondu';
      const date = fait ? (r.reponduLe ?? r.date) : r.date;
      if (!dans(date)) continue;
      out.push({ cle: `relance:${r.id}:${date}`, genre: 'relance', date, titre: `Relancer ${r.contact}`, detail: r.sujet || undefined, fait, retard: !fait && date < aujourdhui, ref: { type: 'relance', id: r.id }, lien: { chemin: '/relances' } });
    }

  if (veut.has('habitude'))
    for (const h of e.habitudes)
      for (let d = debut; d <= fin; d = addDays(d, 1)) {
        if (!habitDue(h, d)) continue;
        const fait = doneIn(h, d);
        // Un jour passé n'apparaît que s'il a été tenu : on ne sait pas depuis quand l'habitude existe.
        if (d < aujourdhui && !fait) continue;
        out.push({ cle: `habitude:${h.id}:${d}`, genre: 'habitude', date: d, titre: h.nom, fait, ...(h.frequence === 'quotidien' ? { quotidien: true } : {}), ref: { type: 'habitude', id: h.id }, lien: { chemin: '/habitudes' } });
      }

  const nomBudget = (id: string | null) => f.budgets.find((b) => b.id === id);
  if (veut.has('depense'))
    for (const x of depensesEntre(f, debut, fin)) {
      const b = nomBudget(x.budget);
      out.push({ cle: `depense:${x.id}`, genre: 'depense', date: x.date, titre: x.note || (b ? b.nom : 'Dépense'), detail: b ? `${b.emoji} ${b.nom}` : undefined, montant: x.montant, sens: 'sortie', fait: true, lien: { chemin: '/finances' } });
    }
  if (veut.has('revenu'))
    for (const x of revenusEntre(f, debut, fin)) out.push({ cle: `revenu:${x.id}`, genre: 'revenu', date: x.date, titre: x.note || 'Revenu', montant: x.montant, sens: 'entree', fait: true, lien: { chemin: '/finances' } });

  // Les échéances passées sont déjà notées comme dépenses ou revenus : ne restent que celles à venir.
  if (veut.has('recurrent'))
    for (const r of f.recurrences ?? []) {
      let x = prochaineEcheance(r);
      for (let i = 0; i < 400 && x <= fin && (!r.fin || x <= r.fin); i++) {
        if (x >= debut && x > aujourdhui) out.push({ cle: `recurrent:${r.id}:${x}`, genre: 'recurrent', date: x, titre: r.note || (r.genre === 'revenu' ? 'Revenu récurrent' : 'Paiement récurrent'), montant: r.montant, sens: r.genre === 'revenu' ? 'entree' : 'sortie', lien: { chemin: '/finances' } });
        x = prochaineEcheance({ ...r, derniere: x });
      }
    }

  if (veut.has('budget'))
    for (const b of f.budgets) {
      if (dans(b.debut) && !b.global) out.push({ cle: `budget:${b.id}:debut`, genre: 'budget', date: b.debut, titre: `Début du budget ${b.emoji} ${b.nom}`, montant: b.montant, lien: { chemin: '/finances' } });
      if (dans(b.fin)) out.push({ cle: `budget:${b.id}:fin`, genre: 'budget', date: b.fin, titre: `Fin du budget ${b.emoji} ${b.nom}`, fait: b.fin < aujourdhui, lien: { chemin: '/finances' } });
      for (const p of b.plan ?? []) if (dans(p.fin)) out.push({ cle: `budget:${b.id}:${p.id}:fin`, genre: 'budget', date: p.fin, titre: `Fin du poste ${p.emoji ?? ''} ${p.nom}`.replace('  ', ' '), detail: `${b.emoji} ${b.nom}`, montant: p.montant, fait: p.fin < aujourdhui, lien: { chemin: '/finances' } });
    }

  if (veut.has('objectif'))
    for (const o of objectifsActifs(f)) {
      const s = suiviObjectif(o, aujourdhui);
      const lien = { chemin: '/finances', params: { onglet: 'objectifs' } };
      if (dans(o.echeance)) out.push({ cle: `objectif:${o.id}:echeance`, genre: 'objectif', date: o.echeance, titre: `Objectif : ${o.emoji} ${o.nom}`, detail: s.atteint ? 'Atteint' : `${Math.round(s.pct * 100)} % atteint`, montant: o.cible, fait: s.atteint, retard: !s.atteint && o.echeance < aujourdhui, lien });
      for (const v of o.versements) if (dans(v.date)) out.push({ cle: `objectif:${o.id}:v:${v.id}`, genre: 'objectif', date: v.date, titre: `Versé : ${o.emoji} ${o.nom}`, detail: v.note || undefined, montant: v.montant, sens: 'entree', fait: true, lien });
      // Les versements du plan à venir, tant que l'objectif n'est pas atteint.
      if (!s.atteint)
        for (const x of datesVersements(o)) if (dans(x) && x >= aujourdhui && !o.versements.some((v) => v.date === x)) out.push({ cle: `objectif:${o.id}:plan:${x}`, genre: 'objectif', date: x, titre: `À verser : ${o.emoji} ${o.nom}`, detail: 'Prévu par le plan', montant: s.versement, sens: 'sortie', lien });
    }

  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.heure ?? '99').localeCompare(b.heure ?? '99') || RANG.get(a.genre)! - RANG.get(b.genre)! || a.titre.localeCompare(b.titre, 'fr'));
}

/**
 * Le calendrier d'un membre : avec « tous », rien ne change ; avec un membre (ou « moi », « non affectées »), seules ses
 * tâches restent, les autres événements n'étant à personne en particulier.
 */
export function evtsDuMembre(evts: Evt[], filtre: FiltreMembre, membres: MembreEquipe[], moiId?: string): Evt[] {
  if (filtre === 'tous') return evts;
  return evts.filter((x) => x.genre === 'tache' && estDeMembre(x, filtre, membres, moiId));
}

/** Les événements rangés par jour. */
export function parJour(evts: Evt[]): Map<string, Evt[]> {
  const m = new Map<string, Evt[]>();
  for (const x of evts) (m.get(x.date) ?? m.set(x.date, []).get(x.date)!).push(x);
  return m;
}

export type ResumeJour = {
  total: number;
  genres: { genre: GenreEvt; nb: number; /** Au moins un événement qui demande une action : pas fait, ou en retard. */ attention: boolean }[];
  depenses: number;
  revenus: number;
  /** Il reste quelque chose à faire ou un retard ce jour-là. */
  aFaire: number;
};

/** Ce qu'il y a dans un jour : combien de chaque genre, les totaux d'argent, ce qui reste à faire. */
export function resumeJour(evts: Evt[]): ResumeJour {
  const nb = new Map<GenreEvt, { nb: number; attention: boolean }>();
  let depenses = 0;
  let revenus = 0;
  let aFaire = 0;
  for (const x of evts) {
    const g = nb.get(x.genre) ?? { nb: 0, attention: false };
    g.nb++;
    const action = !x.fait && !!x.ref;
    if (action || x.retard) g.attention = true;
    if (action) aFaire++;
    nb.set(x.genre, g);
    if (x.genre === 'depense') depenses += x.montant ?? 0;
    if (x.genre === 'revenu') revenus += x.montant ?? 0;
  }
  return {
    total: evts.length,
    genres: TOUS_GENRES.filter((g) => nb.has(g)).map((genre) => ({ genre, ...nb.get(genre)! })),
    depenses: Math.round(depenses * 100) / 100,
    revenus: Math.round(revenus * 100) / 100,
    aFaire,
  };
}

/** Premier et dernier jour affichés pour un mois « AAAA-MM » (le mois entier). */
export function bornesMois(mois: string) {
  const [a, m] = mois.split('-').map(Number);
  const fin = new Date(a, m, 0);
  return { debut: `${mois}-01`, fin: `${mois}-${String(fin.getDate()).padStart(2, '0')}` };
}

/** Le lundi de la semaine d'un jour, et les sept jours. */
export function joursDeSemaine(d: string): string[] {
  const lundi = addDays(d, -((parse(d).getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(lundi, i));
}
