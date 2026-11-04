import * as Speech from 'expo-speech';

import { budgetDe, categoriesDe, categoriesDeItem } from './categories';
import { resumes, tachesUrgentes } from './planning';
import { addDays, doneIn, fmtLong, habitToday, hm, streak, today } from './dates';
import { enLimite, ouvertsPuisFaits } from './donnees-question';
import { donneesPlan, memoriserPlan, sansMarkdown } from './plan-du-jour';
import { api, API_URL, ApiError, tokenStore } from './api';
import { candidatsCloture, donneesCompteRendu, lireAnalyseCompteRendu, type AnalyseCompteRendu } from './comptes-rendus';
import { demandeAnalyse, donneesSynthese, lireAnalyses, lireCopilote, lireLot, MAX_MAILS_ANALYSE, reunirLot, requeteLot, type Perimetre, type ReponseCopilote } from './copilote';
import { contexteCrm, refsDu } from './contexte-mails';
import { direSynthese, mailsDePersonne, trouverPersonne } from './mails-voix';
import type { Mail } from './mails';
import { bilan, financesDe, prochaineEcheance, revenusEntre, totalRevenus } from './finances';
import { statsFinances } from './stats-finances';
import type { AudioPrefs, CompteRendu, Espace, Relance, Tache, Ton } from './types';
import { relanceAttendue } from './suivi';
import { arreterExtraitEve, VOIX_TELEPHONE, voixEve } from './eve';
import { decouperLecture, lecteur } from './lecture';
import { choisirVitesseLecture, vitesseLecture, vitesseSuivante } from './voix-pref';
import { prononcerNom } from './prononciation';
import { nomCourant } from './nom';

export async function voixDisponibles(toutes: boolean) {
  const v = await Speech.getAvailableVoicesAsync();
  return v
    .filter((x) => toutes || x.language.toLowerCase().startsWith('fr'))
    .sort((a, b) => (b.quality === 'Enhanced' ? 1 : 0) - (a.quality === 'Enhanced' ? 1 : 0) || a.name.localeCompare(b.name));
}

// L'app parle-t-elle en ce moment, depuis n'importe quel écran ? Le bouton audio l'affiche et permet de la couper.
let parole = false;
const abonnesParole = new Set<() => void>();
const direParole = (v: boolean) => {
  if (v === parole) return;
  parole = v;
  abonnesParole.forEach((f) => f());
};
export const enParole = () => parole;
export const surParole = (f: () => void) => {
  abonnesParole.add(f);
  return () => {
    abonnesParole.delete(f);
  };
};

/** La lecture en cours, depuis n'importe quel écran : la barre de lecture l'affiche et permet de la mettre en pause. */
export type EtatLecture = {
  active: boolean;
  enPause: boolean;
  titre?: string;
  /** L'écran a sa propre commande (écran vocal, essai d'une voix) : pas de barre. */
  discret?: boolean;
  /** La phrase en cours, et où elle se situe dans le texte. */
  phrase?: string;
  numero?: number;
  total?: number;
  /** Multiplie la vitesse réglée pour la voix. */
  vitesse?: number;
};
const AUCUNE_LECTURE: EtatLecture = { active: false, enPause: false };
let lecture = AUCUNE_LECTURE;
const abonnesLecture = new Set<() => void>();
const poserLecture = (v: EtatLecture) => {
  lecture = v;
  abonnesLecture.forEach((f) => f());
};
export const etatLecture = () => lecture;
export const surLecture = (f: () => void) => {
  abonnesLecture.add(f);
  return () => {
    abonnesLecture.delete(f);
  };
};

let lectureCourante = 0;
let lecteurCourant: ReturnType<typeof lecteur> | null = null;
// Prévient celui qui écoute la lecture en cours, une seule fois, qu'elle s'arrête : fin normale, « Arrêter » ou nouvelle lecture.
let finLecture: (() => void) | null = null;
const couperLecture = () => {
  lectureCourante++;
  lecteurCourant?.annuler();
  lecteurCourant = null;
  if (lecture.active) poserLecture(AUCUNE_LECTURE);
  const f = finLecture;
  finLecture = null;
  arreterExtraitEve();
  f?.();
};

/** Lit un texte avec la voix choisie, Eve par défaut. Les longs textes passent par morceaux. `titre` nomme la lecture dans la barre de lecture. */
export function parler(text: string, a: AudioPrefs, cb?: { onStart?: () => void; onDone?: () => void; onMot?: () => void; titre?: string; discret?: boolean; /** Un texte dans une autre langue que le français : lu par une voix de cette langue. */ langue?: string }) {
  couperLecture();
  Speech.stop();
  const id = lectureCourante;
  const annule = () => id !== lectureCourante;
  const fini = () => {
    if (annule()) return;
    finLecture = null;
    lecteurCourant = null;
    poserLecture(AUCUNE_LECTURE);
    direParole(false);
    cb?.onDone?.();
  };
  finLecture = () => {
    direParole(false);
    cb?.onDone?.();
  };
  let commence = false;
  const debut = () => {
    if (commence) return;
    commence = true;
    direParole(true);
    cb?.onStart?.();
  };

  let voix: string | undefined;
  const etranger = !!cb?.langue && !cb.langue.startsWith('fr');
  const morceaux = decouperLecture(etranger ? text : prononcerNom(text));
  const l = lecteur(
    morceaux,
    (morceau, fin) =>
      void Speech.speak(morceau, {
        language: cb?.langue ?? 'fr-FR',
        voice: etranger ? undefined : voix,
        rate: Math.min(2, a.vitesse * vitesseLecture()),
        pitch: a.hauteur,
        onStart: debut,
        onBoundary: cb?.onMot ? () => cb.onMot?.() : undefined,
        onDone: fin,
        onError: fin,
      }),
    fini,
    (i) => {
      if (!annule()) poserLecture({ ...lecture, phrase: morceaux[i], numero: i + 1, total: morceaux.length });
    },
  );
  lecteurCourant = l;
  poserLecture({ active: true, enPause: false, titre: cb?.titre, discret: cb?.discret, phrase: morceaux[0], numero: 1, total: morceaux.length, vitesse: vitesseLecture() });

  const lire = (voice?: string) => {
    voix = voice;
    l.lancer();
  };
  if (etranger || a.voix === VOIX_TELEPHONE) return lire();
  if (a.voix) return lire(a.voix);
  voixEve(() => voixDisponibles(false)).then((id) => {
    if (!annule()) lire(id);
  });
}

export function pauseLecture() {
  if (!lecteurCourant || lecture.enPause) return;
  lecteurCourant.pause();
  direParole(false);
  poserLecture({ ...lecture, enPause: true });
  return Speech.stop();
}

export function reprendreLecture() {
  if (!lecteurCourant || !lecture.enPause) return;
  poserLecture({ ...lecture, enPause: false });
  direParole(true);
  lecteurCourant.reprendre();
}

/** Passe à la phrase suivante ou revient à la précédente. */
export function allerLecture(delta: number) {
  if (!lecteurCourant) return;
  Speech.stop();
  lecteurCourant.aller(delta);
}

/** Change la vitesse (gardée pour les prochaines lectures) et redit la phrase en cours à cette vitesse. */
export function changerVitesseLecture() {
  const v = vitesseSuivante(vitesseLecture());
  choisirVitesseLecture(v);
  if (!lecteurCourant) return;
  poserLecture({ ...lecture, vitesse: v });
  if (lecture.enPause) return;
  Speech.stop();
  lecteurCourant.redire();
}

export const taire = () => {
  couperLecture();
  direParole(false);
  return Speech.stop();
};

const TON: Record<Ton, { hello: (n: string) => string; end: string }> = {
  neutre: { hello: (n) => `Bonjour${n}.`, end: 'Bonne journée.' },
  motivant: { hello: (n) => `Bonjour${n} ! Belle journée qui commence.`, end: 'Tu as tout en main. Bonne journée !' },
  direct: { hello: (n) => `Bonjour${n}. Voici l'essentiel.`, end: "C'est tout." },
  coach: { hello: (n) => `Debout${n}, on attaque.`, end: "Pas d'excuse aujourd'hui : coche tout avant ce soir." },
};
const n = (k: number, one: string, many: string) => `${k} ${k > 1 ? many : one}`;
const heure = (s?: string) => {
  const [h, m] = String(s || '').split(':');
  return h ? `${Number(h)} heures${m && m !== '00' ? ' ' + m : ''}` : '';
};

export function briefing(e: Espace, prenom: string) {
  const a = e.audio;
  const t = TON[a.ton] || TON.neutre;
  const d = today();
  const out = [t.hello(prenom ? ' ' + prenom : ''), `Nous sommes le ${fmtLong()}.`];
  if (a.sections.includes('agenda')) {
    const ev = e.agenda[d] || [];
    out.push(ev.length ? `Tu as ${n(ev.length, 'rendez-vous', 'rendez-vous')} : ${ev.slice(0, 6).map((x) => `à ${heure(x.debut)}, ${x.titre}`).join(' ; ')}.` : "Aucun rendez-vous à ton agenda aujourd'hui.");
  }
  if (a.sections.includes('relances')) {
    const r = e.relances.filter((x) => relanceAttendue(x) && x.date <= d);
    out.push(r.length ? `${n(r.length, 'relance', 'relances')} à faire : ${r.slice(0, 5).map((x) => `${x.contact}, pour ${x.sujet}`).join(' ; ')}.` : 'Aucune relance à faire.');
  }
  if (a.sections.includes('taches')) {
    const soon = addDays(d, 2);
    const tk = tachesUrgentes(e, d, soon);
    out.push(tk.length ? `${n(tk.length, 'tâche urgente', 'tâches urgentes')} : ${tk.slice(0, 5).map((x) => x.titre).join(' ; ')}.` : 'Pas de tâche urgente.');
  }
  if (a.sections.includes('habitudes')) {
    const h = e.habitudes.filter((x) => habitToday(x, d) && !doneIn(x, d));
    out.push(h.length ? `Habitudes à tenir aujourd'hui : ${h.slice(0, 6).map((x) => x.nom).join(' ; ')}.` : 'Toutes tes habitudes du jour sont faites.');
  }
  out.push(t.end);
  return out.join(' ');
}

/** `mails` : les derniers mails relus dans Me (qui, quoi, quand, le début), pour que l'IA réponde aussi aux questions sur la boîte. */
export function resumeDonnees(e: Espace, mails: Mail[] = []) {
  const d = today();
  const parents = resumes(e.taches);
  const relances = ouvertsPuisFaits(e.relances, { fait: (r) => r.statut === 'repondu', echeance: (r) => r.date, finiLe: (r) => r.reponduLe });
  const taches = ouvertsPuisFaits(e.taches.filter((t) => !parents.has(t.id)), { fait: (t) => t.statut === 'fait', echeance: (t) => t.echeance, finiLe: (t) => t.faitLe });
  const relance = ({ contact, sujet, boite, date, statut, mode }: Relance) => ({ contact, sujet, boite, date, statut, mode });
  const tache = ({ titre, source, priorite, echeance, statut, mode, projet, categories }: Tache) => ({ titre, source, priorite, echeance, statut, mode, ...(projet ? { projet: e.projets?.find((p) => p.id === projet)?.nom ?? projet } : {}), ...(categories?.length ? { categories } : {}) });
  const donnees = {
    aujourdhui: d,
    compte: { relancesOuvertes: relances.total, tachesOuvertes: taches.total, mailsNonLus: mails.filter((m) => m.nonLu && m.sens === 'recu').length },
    agenda: e.agenda[d] || [],
    relances: relances.ouverts.map(relance),
    relancesRepondues: relances.faits.map(relance),
    taches: taches.ouverts.map(tache),
    tachesFaites: taches.faits.map(tache),
    habitudes: e.habitudes.map((h) => ({ nom: h.nom, categorie: h.categorie, frequence: h.frequence, jour: h.jour, mode: h.mode, faitCettePeriode: doneIn(h, d), serie: streak(h, d) })),
    contacts: e.contacts.slice(0, 80),
    ...(mails.length
      ? {
          mailsRecents: [...mails]
            .sort((a, b) => `${b.date} ${b.heure ?? ''}`.localeCompare(`${a.date} ${a.heure ?? ''}`))
            .slice(0, 40)
            .map((m) => ({ de: m.sens === 'envoye' ? 'moi' : m.contact, a: m.sens === 'envoye' ? m.contact : 'moi', date: m.date, sujet: m.sujet.slice(0, 120), ...(m.nonLu ? { nonLu: true } : {}), ...(m.extrait ? { debut: m.extrait.slice(0, 160) } : {}) })),
        }
      : {}),
    journal: Object.values(e.journal).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7),
    finances: (() => {
      const f = financesDe(e);
      const m = bilan(f, 'mois', d, d);
      const s = statsFinances(f, 'mois', d, d);
      const revenusMois = totalRevenus(revenusEntre(f, m.debut, m.fin));
      return {
        // Tous les montants sont dans cette devise ; `taux` donne la valeur d'1 unité des autres devises saisies.
        devise: f.devise,
        ...(f.taux && Object.keys(f.taux).length ? { taux: f.taux } : {}),
        moisEnCours: { depense: m.total, plafond: m.plafondTotal, compteDansBudgets: m.compte, revenus: revenusMois, solde: Math.round((revenusMois - m.total) * 100) / 100, moisPrecedent: s.totalAvant },
        // Tendances : moyenne des mois passés, budgets tenus, où part l'argent.
        stats: {
          moyenneMensuelle: s.moyenne,
          budgetsTenus: s.respect,
          historique: s.historique.map((h) => ({ mois: h.libelle, depense: h.v })),
          parBudget: s.parBudget.map((x) => ({ budget: x.nom, ceMois: x.v, moisPrecedent: x.avant })),
          postesPrincipaux: s.postes.map((x) => ({ note: x.nom, total: x.v, fois: x.n })),
          jourLePlusCher: s.jourLePlusCher,
          plusGrosseDepense: s.plusGrosse && { montant: s.plusGrosse.montant, note: s.plusGrosse.note, date: s.plusGrosse.date },
        },
        budgets: m.lignes.map((l) => ({ nom: l.budget.nom, montant: l.budget.montant, periode: l.budget.periode, global: !!l.budget.global, depenseCeMois: l.depense })),
        recurrents: (f.recurrences || []).map((r) => ({ genre: r.genre, note: r.note, montant: r.montant, frequence: r.frequence, prochaine: prochaineEcheance(r) })),
        depensesRecentes: f.depenses.filter((x) => !x.lien).slice(0, 40).map((x) => ({ montant: x.montant, note: x.note, date: x.date, budget: budgetDe(f.budgets, x)?.nom ?? null, categories: categoriesDeItem(x, categoriesDe(e)).map((c) => c.nom) })),
        revenusRecents: (f.revenus || []).filter((x) => !x.lien).slice(0, 12).map(({ montant, note, date }) => ({ montant, note, date })),
      };
    })(),
  };
  // Trop long, le JSON serait coupé par le serveur : on retire d'abord ce qui sert le moins.
  return enLimite(donnees, [
    (x) => void (x.journal = x.journal.slice(0, 3)),
    (x) => void (x.finances.depensesRecentes = x.finances.depensesRecentes.slice(0, 15)),
    (x) => void ((x.relancesRepondues = x.relancesRepondues.slice(0, 5)), (x.tachesFaites = x.tachesFaites.slice(0, 5))),
    (x) => void (x.contacts = x.contacts.slice(0, 30)),
    (x) => void (x.mailsRecents = x.mailsRecents?.slice(0, 20).map(({ debut: _debut, ...m }) => m)),
    (x) => void (x.journal = []),
    (x) => void (x.taches = x.taches.slice(0, 40)),
    (x) => void (x.relances = x.relances.slice(0, 40)),
  ]);
}

export const iaDisponible = () => !!API_URL;

/**
 * Demande à l'IA (OpenAI) via me-api (la clé API reste côté serveur).
 */
export async function demanderIA(type: 'question' | 'plan' | 'relance' | 'copilote' | 'mails' | 'lot' | 'synthese' | 'compte_rendu', payload: Record<string, unknown>): Promise<string> {
  const { text } = await api<{ text: string }>('/assistant', { method: 'POST', body: { type, nom: nomCourant(), ...payload }, token: await tokenStore.get() });
  return String(text || '').trim();
}

/**
 * Fait analyser des mails par le serveur : il les lit lui-même chez Gmail ou Outlook (sans les marquer lus) et garde chaque analyse 30 jours,
 * si bien que rouvrir une analyse, ou un mail déjà préparé à l'avance, ne coûte rien. Renvoie la réponse à relire avec `lireAnalyses`,
 * et les mails que le serveur n'a pas pu lire (supprimés ou déplacés).
 */
export async function analyserMails(demande: ReturnType<typeof demandeAnalyse>): Promise<{ brut: string; illisibles: string[] }> {
  const r = await api<{ analyses?: unknown[]; illisibles?: string[] }>('/assistant/mails', { method: 'POST', body: demande, token: await tokenStore.get() }).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) throw new Error("Le serveur ne connaît pas encore la nouvelle analyse des mails. Mets le serveur à jour, puis réessaie.");
    throw e;
  });
  return { brut: JSON.stringify({ analyses: r.analyses ?? [] }), illisibles: r.illisibles ?? [] };
}

/**
 * Demande au copilote le plan de la journée et ses propositions de tâches, et les mémorise.
 * Un serveur plus ancien ne connaît que « plan » : on le lui demande, et les propositions sont tirées du texte.
 */
export async function preparerCopilote(e: Espace, d: string, mails: Mail[] = []): Promise<ReponseCopilote> {
  const heure = hm();
  const payload = { ton: e.audio.ton, heure, donnees: JSON.stringify(donneesPlan(e, d, mails)) };
  const brut = await demanderIA('copilote', payload).catch((err) => {
    if (err instanceof ApiError && err.status === 400) return demanderIA('plan', payload).then(sansMarkdown);
    throw err;
  });
  const r = lireCopilote(brut, d);
  if (!r.plan) throw new Error("L'IA n'a rien renvoyé. Réessaie dans un instant.");
  memoriserPlan(d, r.plan, r.propositions, heure);
  return r;
}

/** Le texte du plan seulement, pour la voix. */
export const preparerPlan = async (e: Espace, d: string, mails: Mail[] = []): Promise<string> => (await preparerCopilote(e, d, mails)).plan;

/** Le copilote lit un compte rendu : résumé, décisions, actions à ouvrir et éléments rattachés à clôturer. */
export async function analyserCompteRendu(cr: CompteRendu, e: Espace, d: string, o: { transcription?: boolean; membres?: { id: string; nom: string }[] } = {}): Promise<AnalyseCompteRendu> {
  const brut = await demanderIA('compte_rendu', { ton: e.audio.ton, donnees: donneesCompteRendu(cr, e, d, o) });
  const refs = candidatsCloture(e, cr).filter((c) => !c.fait).map((c) => c.ref);
  return lireAnalyseCompteRendu(brut, refs, d, { membres: o.membres, projets: e.projets?.map((p) => ({ id: p.id, nom: p.nom })) });
}

/**
 * Retrouve les mails d'une personne dans tous les comptes connectés (la réception relue ne garde que les plus récents),
 * réunis à ceux déjà dans Me. Un compte qui ne répond pas est simplement ignoré : la voix dit ce qu'elle a trouvé.
 */
export async function chercherMailsVoix(locaux: Mail[], recherche: Perimetre | undefined, comptes: { id: string }[], token?: string | null): Promise<Mail[]> {
  if (!recherche || !token || !comptes.length) return locaux;
  const r = requeteLot(recherche, 25);
  const lus = await Promise.all(comptes.map((c) => api<{ mails: Mail[] }>(`/integrations/${c.id}/mails/recherche?${new URLSearchParams(r)}`, { token }).then((x) => x.mails ?? []).catch(() => [] as Mail[])));
  // La recherche par nom côté serveur est large (« Joseph » trouve tous les Joseph) : on garde la personne demandée.
  const trouves = lus.flat();
  const p = trouverPersonne(recherche.qui ?? '', [...locaux, ...trouves]);
  const garde = p ? mailsDePersonne(trouves, p, recherche) : trouves;
  return reunirLot(locaux, garde);
}

/**
 * « Fais-moi un résumé de mes mails avec Joseph » : le copilote lit les plus récents (un paquet, pour répondre vite),
 * puis en fait la synthèse d'ensemble ; le texte rendu est fait pour être dit.
 */
export async function resumerMailsVoix(nom: string, mails: Mail[], e: Espace, perimetre?: Perimetre): Promise<string> {
  const lot = mails.slice(0, MAX_MAILS_ANALYSE);
  const crm = contexteCrm(lot, e);
  const demande = demandeAnalyse(lot, { ton: e.audio.ton, consignes: `Résumé demandé à la voix : ce qu'il faut retenir des échanges avec ${nom}.`, crm });
  if (!demande.mails.length) throw new Error('Ces mails ne viennent pas d’un compte connecté : je ne peux pas les lire.');
  const lues = await analyserMails(demande);
  const analyses = lireAnalyses(lues.brut, lot.map((m) => m.id), refsDu(crm));
  if (!analyses.length) throw new Error("Le copilote n'a pas pu lire ces mails. Réessaie dans un instant.");
  // Un seul mail : son analyse suffit, inutile d'en demander la synthèse.
  if (analyses.length === 1) return direSynthese(nom, { synthese: analyses[0].resume, points: analyses[0].tache ? [analyses[0].tache] : [] }, mails.length, 1);
  const d = today();
  const brut = await demanderIA('synthese', { ton: e.audio.ton, perimetre: perimetre ?? { genre: 'personne', qui: nom }, donnees: donneesSynthese(lot, analyses, { aujourdhui: d, crm }) });
  const r = lireLot(brut, [], d);
  // Sans synthèse rendue, les résumés mail par mail font l'affaire.
  if (!r.synthese) return direSynthese(nom, { synthese: analyses.map((a) => a.resume).filter(Boolean).slice(0, 4).join(' '), points: r.points }, mails.length, analyses.length);
  return direSynthese(nom, r, mails.length, analyses.length);
}
