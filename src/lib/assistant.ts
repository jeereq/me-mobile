import * as Speech from 'expo-speech';

import { budgetDe, categoriesDe, categoriesDeItem } from './categories';
import { resumes, tachesUrgentes } from './planning';
import { addDays, doneIn, fmtLong, habitToday, hm, streak, today } from './dates';
import { donneesPlan, memoriserPlan, sansMarkdown } from './plan-du-jour';
import { api, API_URL, ApiError, tokenStore } from './api';
import { lireCopilote, type ReponseCopilote } from './copilote';
import { bilan, financesDe, prochaineEcheance, revenusEntre, totalRevenus } from './finances';
import { statsFinances } from './stats-finances';
import type { AudioPrefs, Espace, Ton } from './types';
import { relanceAttendue } from './suivi';

export async function voixDisponibles(toutes: boolean) {
  const v = await Speech.getAvailableVoicesAsync();
  return v
    .filter((x) => toutes || x.language.toLowerCase().startsWith('fr'))
    .sort((a, b) => (b.quality === 'Enhanced' ? 1 : 0) - (a.quality === 'Enhanced' ? 1 : 0) || a.name.localeCompare(b.name));
}

export function parler(text: string, a: AudioPrefs, cb?: { onStart?: () => void; onDone?: () => void }) {
  Speech.stop();
  Speech.speak(text, {
    language: 'fr-FR',
    voice: a.voix || undefined,
    rate: a.vitesse,
    pitch: a.hauteur,
    onStart: cb?.onStart,
    onDone: cb?.onDone,
    onStopped: cb?.onDone,
    onError: cb?.onDone,
  });
}
export const taire = () => Speech.stop();

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

export function resumeDonnees(e: Espace) {
  const d = today();
  const parents = resumes(e.taches);
  return JSON.stringify({
    aujourdhui: d,
    agenda: e.agenda[d] || [],
    relances: e.relances.slice(0, 80).map(({ contact, sujet, boite, date, statut, mode }) => ({ contact, sujet, boite, date, statut, mode })),
    taches: e.taches.filter((t) => !parents.has(t.id)).slice(0, 80).map(({ titre, source, priorite, echeance, statut, mode, projet, categories }) => ({ titre, source, priorite, echeance, statut, mode, ...(projet ? { projet: e.projets?.find((p) => p.id === projet)?.nom } : {}), ...(categories?.length ? { categories: categoriesDeItem({ categories }, categoriesDe(e)).map((c) => c.nom) } : {}) })),
    habitudes: e.habitudes.map((h) => ({ nom: h.nom, categorie: h.categorie, frequence: h.frequence, jour: h.jour, mode: h.mode, faitCettePeriode: doneIn(h, d), serie: streak(h, d) })),
    contacts: e.contacts.slice(0, 80),
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
        moisEnCours: { depense: m.total, plafond: m.plafondTotal, projection: m.projection, resteParJour: m.parJour, revenus: revenusMois, solde: Math.round((revenusMois - m.total) * 100) / 100, moisPrecedent: s.totalAvant },
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
  });
}

export const iaDisponible = () => !!API_URL;

/**
 * Demande à l'IA (OpenAI) via me-api (la clé API reste côté serveur).
 */
export async function demanderIA(type: 'question' | 'plan' | 'relance' | 'copilote' | 'mails' | 'lot', payload: Record<string, unknown>): Promise<string> {
  const { text } = await api<{ text: string }>('/assistant', { method: 'POST', body: { type, ...payload }, token: await tokenStore.get() });
  return String(text || '').trim();
}

/**
 * Demande au copilote le plan de la journée et ses propositions de tâches, et les mémorise.
 * Un serveur plus ancien ne connaît que « plan » : on le lui demande, et les propositions sont tirées du texte.
 */
export async function preparerCopilote(e: Espace, d: string): Promise<ReponseCopilote> {
  const payload = { ton: e.audio.ton, heure: hm(), donnees: JSON.stringify(donneesPlan(e, d)) };
  const brut = await demanderIA('copilote', payload).catch((err) => {
    if (err instanceof ApiError && err.status === 400) return demanderIA('plan', payload).then(sansMarkdown);
    throw err;
  });
  const r = lireCopilote(brut, d);
  if (!r.plan) throw new Error("L'IA n'a rien renvoyé. Réessaie dans un instant.");
  memoriserPlan(d, r.plan, r.propositions);
  return r;
}

/** Le texte du plan seulement, pour la voix. */
export const preparerPlan = async (e: Espace, d: string): Promise<string> => (await preparerCopilote(e, d)).plan;
