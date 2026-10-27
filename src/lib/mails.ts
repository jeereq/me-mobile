import { addDays } from './dates';
import type { Boite, SourceKey } from './types';

/**
 * La boîte mail de Me : les fils récents rapportés par le serveur (Gmail, Outlook), rangés pour être lus.
 * La synchro n'apporte que l'objet, le contact, la date, l'état lu et le lien vers le fil ; le texte se lit à la demande (`ContenuMail`).
 * Module pur : aucune donnée n'est écrite, tout se recalcule depuis ce que le serveur renvoie.
 * Dates en texte « AAAA-MM-JJ ».
 */

export type Mail = {
  id: string;
  sujet: string;
  contact: string;
  date: string;
  heure?: string;
  sens: 'recu' | 'envoye';
  nonLu?: boolean;
  fil?: string;
  lien?: string;
  source: SourceKey;
  /** Perso ou pro, selon le compte connecté d'où il vient. */
  ctx: Boite;
  /** Adresse du compte connecté (« moi@gmail.com »). */
  compte?: string;
  /** Adresse du contact, pour lui répondre. */
  adresse?: string;
};

export type FiltreMails = { boite?: Boite | 'toutes'; compte?: string; nonLus?: boolean; q?: string };

const texte = (m: Mail) => `${m.sujet} ${m.contact} ${m.compte ?? ''}`.toLowerCase();

/** Les mails qui correspondent aux filtres de l'écran (boîte, compte, non lus, recherche). */
export function filtrerMails(mails: Mail[], f: FiltreMails): Mail[] {
  const q = (f.q ?? '').trim().toLowerCase();
  return mails.filter(
    (m) =>
      (!f.boite || f.boite === 'toutes' || m.ctx === f.boite) &&
      (!f.compte || m.compte === f.compte) &&
      (!f.nonLus || !!m.nonLu) &&
      (!q || texte(m).includes(q)),
  );
}

/** Les comptes présents dans la liste, avec leur nombre de mails : de quoi bâtir le filtre par compte. */
export function comptesDeMails(mails: Mail[]): { compte: string; nombre: number }[] {
  const m = new Map<string, number>();
  for (const x of mails) if (x.compte) m.set(x.compte, (m.get(x.compte) ?? 0) + 1);
  return [...m].map(([compte, nombre]) => ({ compte, nombre })).sort((a, b) => a.compte.localeCompare(b.compte, 'fr'));
}

/** Combien de fils ne sont pas lus (la pastille de l'écran Plus et de la barre latérale). */
export const nonLus = (mails: Mail[]) => mails.filter((m) => m.nonLu).length;

export type GroupeMails = { cle: string; titre: string; mails: Mail[] };

/** Titre d'un jour : « Aujourd'hui », « Hier », sinon la date écrite en toutes lettres. */
export function titreJourMail(date: string, aujourdhui: string): string {
  if (date === aujourdhui) return "Aujourd'hui";
  if (date === addDays(aujourdhui, -1)) return 'Hier';
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'Sans date';
  const long = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return long.charAt(0).toUpperCase() + long.slice(1);
}

/** Les mails groupés par jour, du plus récent au plus ancien ; dans un jour, l'heure la plus récente d'abord. */
export function grouperMails(mails: Mail[], aujourdhui: string): GroupeMails[] {
  const jours = new Map<string, Mail[]>();
  for (const m of mails) {
    const cle = m.date || '';
    (jours.get(cle) ?? jours.set(cle, []).get(cle)!).push(m);
  }
  return [...jours.entries()]
    .sort((a, b) => (b[0] || '').localeCompare(a[0] || ''))
    .map(([cle, liste]) => ({
      cle: cle || 'sans-date',
      titre: cle ? titreJourMail(cle, aujourdhui) : 'Sans date',
      mails: [...liste].sort((x, y) => (y.heure ?? '').localeCompare(x.heure ?? '') || x.sujet.localeCompare(y.sujet, 'fr')),
    }));
}

/** Un mail lu en entier, à la demande (le serveur ne le garde pas) : texte brut, destinataires, pièces jointes. */
export type ContenuMail = { id: string; sujet: string; de: string; adresse?: string; a: string[]; cc: string[]; date?: string; heure?: string; texte: string; piecesJointes: string[]; lien?: string };

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const PETITS = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'mon', 'ma', 'mes', 'son', 'sa', 'ses', 'sur', 'pour']);
const mots = (s: string) =>
  norm(s)
    .split(/[^a-z0-9@.]+/)
    .filter((x) => x.length > 1 && !PETITS.has(x));
const recent = (a: Mail, b: Mail) => `${b.date} ${b.heure ?? ''}`.localeCompare(`${a.date} ${a.heure ?? ''}`);

/** L'adresse seule : « Marie Dupont <marie@exemple.fr> » devient « marie@exemple.fr ». */
export const adresseEmail = (v = '') => (v.match(/<([^>]+)>/)?.[1] ?? v).trim();

/**
 * Le mail le plus récent de `qui` : tous les mots cherchés dans le nom ou l'adresse du contact
 * (« Paul », « paul martin »), sinon dans l'objet (« le devis »).
 */
export function trouverMail(mails: Mail[], qui: string, parObjet = true): Mail | null {
  const cherche = mots(qui);
  if (!cherche.length) return null;
  const tous = (texte: string) => {
    const t = mots(texte);
    return cherche.every((c) => t.some((m) => m.startsWith(c)));
  };
  const tries = [...mails].sort(recent);
  return tries.find((m) => tous(`${m.contact} ${m.adresse ?? ''}`)) ?? (parObjet ? tries.find((m) => tous(m.sujet)) : undefined) ?? null;
}

/** Une adresse dictée à la voix : « paul point martin arobase exemple point fr » devient « paul.martin@exemple.fr ». */
export function adresseDictee(s: string): string | null {
  const v = norm(s)
    .replace(/\s*(?:arobase|arrobase|at)\s*/g, '@')
    .replace(/\s*(?:point|dot)\s*/g, '.')
    .replace(/\s*(?:tiret du bas|underscore)\s*/g, '_')
    .replace(/\s*tiret\s*/g, '-')
    .replace(/\s+/g, '');
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v) ? v : null;
}

/** À qui écrire : une adresse dite ou tapée, sinon celle d'un contact qui t'a écrit récemment. */
export function destinataire(mails: Mail[], qui: string): { nom: string; adresse: string } | null {
  const brut = adresseEmail(qui);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brut)) return { nom: brut, adresse: brut.toLowerCase() };
  const dicte = adresseDictee(qui);
  if (dicte) return { nom: dicte, adresse: dicte };
  const m = trouverMail(
    mails.filter((x) => x.adresse),
    qui,
    false,
  );
  return m?.adresse ? { nom: m.contact || adresseEmail(m.adresse), adresse: adresseEmail(m.adresse) } : null;
}

/** Ce que la voix dit de la boîte : les non lus d'abord (qui et quoi), sinon les derniers reçus. */
export function resumeMails(mails: Mail[], max = 5): string {
  if (!mails.length) return 'Aucun mail récent. Connecte Gmail ou Outlook dans Agendas & outils, et coche « Mails ».';
  const non = [...mails].filter((m) => m.nonLu).sort(recent);
  const liste = (l: Mail[]) => l.slice(0, max).map((m) => `${m.contact || 'quelqu’un'} : ${m.sujet}`).join(' ; ');
  if (!non.length) return `Aucun mail non lu. Les derniers : ${liste([...mails].sort(recent).slice(0, 3))}.`;
  const tete = non.length === 1 ? 'Un mail non lu' : `${non.length} mails non lus`;
  return `${tete}. ${liste(non)}${non.length > max ? ', entre autres' : ''}.`;
}

/** Un objet tiré du message dicté : sa première phrase, en 60 caractères au plus. */
export function objetDepuisTexte(texte: string): string {
  const phrase = texte.trim().split(/(?<=[.!?])\s|\n/)[0].replace(/[.!?]+$/, '');
  if (phrase.length <= 60) return phrase.charAt(0).toUpperCase() + phrase.slice(1);
  const coupe = phrase.slice(0, 60).replace(/\s+\S*$/, '');
  return `${coupe.charAt(0).toUpperCase()}${coupe.slice(1)}…`;
}
