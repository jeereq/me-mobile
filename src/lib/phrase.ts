import { addDays, parse, ymd } from './dates';
import type { Budget, Frequence, Priorite } from './types';

/**
 * Ajout en une phrase : « Relancer Paul jeudi pour le devis », « Sport tous les jours »,
 * « Envoyer la facture demain urgent ». On repère le genre, la date, la fréquence et l'importance,
 * le reste devient le titre. Tout est local, instantané et marche hors ligne.
 */
export type Phrase =
  | { genre: 'tache'; titre: string; echeance: string | null; priorite: Priorite }
  | { genre: 'relance'; contact: string; sujet: string; date: string | null }
  | { genre: 'habitude'; titre: string; frequence: Frequence; jour: number | null }
  | { genre: 'depense'; montant: number; note: string; budget: string | null; date: string };

const L = 'a-zà-ÿœæ0-9';
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const NOMBRES: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, dix: 10, quinze: 15 };
const nombre = (s: string) => NOMBRES[s.toLowerCase()] ?? Number(s);
// Accents facultatifs : « fevrier », « aout », « decembre » sont compris aussi.
const souple = (m: string) => m.replace(/é/g, '[ée]').replace(/û/g, '[ûu]');
const RE_JOUR = JOURS.join('|');
const RE_MOIS = MOIS.map(souple).join('|');
const moisDe = (s: string) => MOIS.findIndex((m) => new RegExp(`^${souple(m)}$`, 'i').test(s));
const jourDe = (s: string) => JOURS.indexOf(s.toLowerCase().replace(/s$/, ''));

/** Cherche un motif entre deux limites de mot, le retire du texte et rend ses groupes. */
function prendre(texte: { v: string }, coeur: string): string[] | null {
  const re = new RegExp(`(^|[^${L}])(?:${coeur})(?![${L}])`, 'i');
  const m = re.exec(texte.v);
  if (!m) return null;
  texte.v = texte.v.slice(0, m.index) + m[1] + ' ' + texte.v.slice(m.index + m[0].length);
  return m.slice(2);
}

const prochain = (d: string, jour: number) => {
  const diff = (jour - parse(d).getDay() + 7) % 7;
  return addDays(d, diff || 7);
};
function ajouterMois(d: string, n: number) {
  const x = parse(d);
  const jour = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  x.setDate(Math.min(jour, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  return ymd(x);
}
function dateValide(an: number, mois: number, jour: number) {
  const x = new Date(an, mois, jour);
  return x.getMonth() === mois && x.getDate() === jour ? ymd(x) : null;
}

/** Retire la première date trouvée et la rend au format AAAA-MM-JJ. */
function prendreDate(t: { v: string }, d: string): string | null {
  const avant = "(?:pour |avant |d'ici |d’ici |au plus tard |)";
  let m: string[] | null;
  if (prendre(t, `${avant}(?:aujourd'hui|aujourd’hui|ce soir|ce matin|cet après-midi|cet apres-midi|ce midi)`)) return d;
  if (prendre(t, `avant-hier`)) return addDays(d, -2);
  if (prendre(t, `hier(?: soir| matin| midi)?`)) return addDays(d, -1);
  if (prendre(t, `${avant}apr[èe]s-demain`)) return addDays(d, 2);
  if (prendre(t, `${avant}demain(?: matin| soir| midi| après-midi)?`)) return addDays(d, 1);
  if ((m = prendre(t, `${avant}dans (\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|dix|quinze) (jours?|semaines?|mois)`))) {
    const n = nombre(m[0]);
    return m[1].startsWith('mois') ? ajouterMois(d, n) : addDays(d, m[1].startsWith('semaine') ? n * 7 : n);
  }
  if (prendre(t, `${avant}(?:la )?semaine prochaine`)) return prochain(d, 1);
  if (prendre(t, `${avant}(?:ce |le )?week-?end`)) return parse(d).getDay() === 6 || parse(d).getDay() === 0 ? d : prochain(d, 6);
  // « Cette semaine » : d'ici vendredi (ou aujourd'hui à partir du vendredi).
  if (prendre(t, `${avant}cette semaine`)) return [0, 5, 6].includes(parse(d).getDay()) ? d : prochain(d, 5);
  if (prendre(t, `${avant}(?:la |en )?fin (?:du |de )mois`)) {
    const x = parse(d);
    return ymd(new Date(x.getFullYear(), x.getMonth() + 1, 0));
  }
  if ((m = prendre(t, `${avant}(?:ce |le )?(${RE_JOUR})(?: prochain)?`))) return prochain(d, jourDe(m[0]));
  const an = parse(d).getFullYear();
  if ((m = prendre(t, `${avant}(?:le )?(\\d{1,2})(?:er)? (${RE_MOIS})(?: (\\d{4}))?`))) {
    const mois = moisDe(m[1]);
    let r = dateValide(m[2] ? Number(m[2]) : an, mois, Number(m[0]));
    if (r && !m[2] && r < d) r = dateValide(an + 1, mois, Number(m[0]));
    return r;
  }
  if ((m = prendre(t, `${avant}(?:le )?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?`))) {
    const y = m[2] ? (m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])) : an;
    let r = dateValide(y, Number(m[1]) - 1, Number(m[0]));
    if (r && !m[2] && r < d) r = dateValide(an + 1, Number(m[1]) - 1, Number(m[0]));
    return r;
  }
  if ((m = prendre(t, `${avant}le (\\d{1,2})(?:er)?`))) {
    const x = parse(d);
    let r = dateValide(x.getFullYear(), x.getMonth(), Number(m[0]));
    if (!r || r < d) r = dateValide(x.getFullYear(), x.getMonth() + 1, Number(m[0]));
    return r;
  }
  return null;
}

function prendreFrequence(t: { v: string }, d: string): { frequence: Frequence; jour: number | null } | null {
  let m: string[] | null;
  if ((m = prendre(t, `(?:le )?(\\d{1,2})(?:er)? (?:de chaque mois|du mois|chaque mois|de tous les mois|tous les mois)`))) return { frequence: 'mensuel', jour: Math.min(31, Math.max(1, Number(m[0]))) };
  if (prendre(t, `chaque mois|tous les mois|une fois par mois|mensuellement`)) return { frequence: 'mensuel', jour: parse(d).getDate() };
  if ((m = prendre(t, `(?:chaque|tous les) (${RE_JOUR})s?`))) return { frequence: 'hebdo', jour: jourDe(m[0]) };
  if (prendre(t, `chaque semaine|toutes les semaines|une fois par semaine|hebdomadaire`)) return { frequence: 'hebdo', jour: parse(d).getDay() };
  if (prendre(t, `chaque jour|tous les jours|quotidiennement|chaque matin|chaque soir|tous les matins|tous les soirs|au quotidien`)) return { frequence: 'quotidien', jour: null };
  return null;
}

const nettoyer = (s: string) => {
  const x = s
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,.;:!?–—-]+|[\s,;:–—-]+$/g, '')
    .replace(/\s+(?:pour|avant|le|la|et|à|de)$/i, '')
    .trim();
  return x ? x[0].toUpperCase() + x.slice(1) : '';
};

const sansAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const DEVISE = '€|\\$|eur|euros?|fcfa|cfa|xaf|xof|dollars?|usd|chf';

/** « 12,50 € courses », « Dépensé 30 euros resto hier » : un montant avec sa devise, ou un verbe de dépense devant. */
function lireDepense(t: { v: string }, d: string, budgets: Budget[]): Phrase | null {
  const verbe = /^\s*(?:j'ai\s+)?(?:dépensé|depense|dépense|payé|paye|achat|acheté)\s+/i;
  const avecVerbe = verbe.test(t.v);
  const m = new RegExp(`(^|\\s)(\\d{1,3}(?:[  ]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)\\s*(${DEVISE})?(?![${L}\\d])`, 'i').exec(t.v);
  if (!m || (!m[3] && !avecVerbe)) return null;
  const montant = Math.round(Number(m[2].replace(/[\s  ]/g, '').replace(',', '.')) * 100) / 100;
  if (!(montant > 0)) return null;
  t.v = (t.v.slice(0, m.index) + ' ' + t.v.slice(m.index + m[0].length)).replace(verbe, ' ');
  const date = prendreDate(t, d) ?? d;
  const note = nettoyer(t.v.replace(/^\s*(?:de|d'|pour|en|à|au|aux|chez|:)\s+/i, ' '));
  const mots = sansAccents(note);
  const b = budgets.find((x) => !x.global && mots.includes(sansAccents(x.nom))) ?? null;
  return { genre: 'depense', montant, note, budget: b?.id ?? null, date: date > d ? d : date };
}

export function lirePhrase(texte: string, d: string, budgets: Budget[] = []): Phrase | null {
  const t = { v: ` ${texte.trim()} ` };
  if (!texte.trim()) return null;
  const dep = lireDepense({ v: t.v }, d, budgets);
  if (dep) return dep;
  const urgent = !!prendre(t, `urgente?|importante?|prioritaire|en priorité|asap`) || /!/.test(t.v);
  t.v = t.v.replace(/!+/g, ' ');

  const freq = prendreFrequence(t, d);
  if (freq) {
    const titre = nettoyer(t.v);
    return titre ? { genre: 'habitude', titre, ...freq } : null;
  }

  const date = prendreDate(t, d);
  const rel = /^\s*(?:relancer|relance|recontacter|rappeler)\s+(.+)$/i.exec(t.v);
  if (rel) {
    const reste = rel[1];
    const sep = /\s(?:pour|au sujet d[eu]|au sujet de la|à propos d[eu]|à propos de la|concernant|sur|à propos de l'|au sujet de l')\s?/i.exec(reste);
    const contact = nettoyer(sep ? reste.slice(0, sep.index) : reste);
    const sujet = nettoyer(sep ? reste.slice(sep.index + sep[0].length) : '');
    return contact ? { genre: 'relance', contact, sujet: sujet || 'Suivi', date } : null;
  }

  const titre = nettoyer(t.v);
  return titre ? { genre: 'tache', titre, echeance: date, priorite: urgent ? 'haute' : 'moyenne' } : null;
}
