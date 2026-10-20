import * as Speech from 'expo-speech';

import { addDays, doneIn, fmtLong, habitToday, streak, today } from './dates';
import { supabase } from './supabase';
import type { AudioPrefs, Espace, Ton } from './types';

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
    const r = e.relances.filter((x) => x.statut === 'a_faire' && x.date <= d);
    out.push(r.length ? `${n(r.length, 'relance', 'relances')} à faire : ${r.slice(0, 5).map((x) => `${x.contact}, pour ${x.sujet}`).join(' ; ')}.` : 'Aucune relance à faire.');
  }
  if (a.sections.includes('taches')) {
    const soon = addDays(d, 2);
    const tk = e.taches.filter((x) => x.statut !== 'fait' && (x.priorite === 'haute' || (x.echeance && x.echeance <= soon)));
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
  return JSON.stringify({
    aujourdhui: d,
    agenda: e.agenda[d] || [],
    relances: e.relances.slice(0, 80).map(({ contact, sujet, boite, date, statut, mode }) => ({ contact, sujet, boite, date, statut, mode })),
    taches: e.taches.slice(0, 80).map(({ titre, source, priorite, echeance, statut, mode }) => ({ titre, source, priorite, echeance, statut, mode })),
    habitudes: e.habitudes.map((h) => ({ nom: h.nom, categorie: h.categorie, frequence: h.frequence, jour: h.jour, mode: h.mode, faitCettePeriode: doneIn(h, d), serie: streak(h, d) })),
    contacts: e.contacts.slice(0, 80),
    journal: Object.values(e.journal).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7),
  });
}

export const iaDisponible = () => !!supabase;

/**
 * Demande à Claude via la fonction Supabase « assistant » (la clé API reste côté serveur).
 */
export async function demanderIA(type: 'question' | 'plan' | 'relance', payload: Record<string, unknown>): Promise<string> {
  if (!supabase) throw new Error("L'IA demande la configuration Supabase (voir le README).");
  const { data, error } = await supabase.functions.invoke('assistant', { body: { type, ...payload } });
  if (error) throw new Error("L'IA n'a pas pu répondre. Réessaie dans un moment.");
  return String((data as { text?: string })?.text || '').trim();
}
