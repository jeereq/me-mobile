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
  /** Les premiers mots du message, sous l'objet dans la liste. */
  extrait?: string;
  /** Étiquettes du fil : libellés Gmail, catégories Outlook. */
  libelles?: string[];
  /** Le message porte des pièces jointes. */
  pj?: boolean;
  /** Boîte partagée d'où vient le mail (« ventes@entreprise.fr ») ; absente = la boîte du compte. */
  boite?: string;
  /** Dossier d'où vient le mail quand il a été ouvert depuis un dossier (absent = la réception). */
  dossier?: string;
};

/** `compte` : l'adresse d'une boîte (celle du compte, ou une boîte partagée). `libelle` : une étiquette. */
export type FiltreMails = { boite?: Boite | 'toutes'; compte?: string; nonLus?: boolean; q?: string; libelle?: string };

/** La boîte où se trouve un mail : la boîte partagée s'il en vient, sinon celle du compte. */
export const boiteDuMail = (m: Pick<Mail, 'boite' | 'compte'>) => m.boite ?? m.compte;

const texte = (m: Mail) => `${m.sujet} ${m.contact} ${m.compte ?? ''} ${m.boite ?? ''} ${m.extrait ?? ''} ${(m.libelles ?? []).join(' ')}`.toLowerCase();
const meme = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Les mails qui correspondent aux filtres de l'écran (perso/pro, boîte, étiquette, non lus, recherche). */
export function filtrerMails(mails: Mail[], f: FiltreMails): Mail[] {
  const q = (f.q ?? '').trim().toLowerCase();
  return mails.filter(
    (m) =>
      (!f.boite || f.boite === 'toutes' || m.ctx === f.boite) &&
      (!f.compte || boiteDuMail(m) === f.compte) &&
      (!f.libelle || (m.libelles ?? []).some((l) => meme(l, f.libelle!))) &&
      (!f.nonLus || !!m.nonLu) &&
      (!q || texte(m).includes(q)),
  );
}

/** Une boîte de la liste de gauche : celle d'un compte connecté, ou une boîte partagée lue avec lui. */
export type BoiteMail = { adresse: string; compte: string; partagee: boolean; nombre: number; nonLus: number; source: SourceKey };

/** Les boîtes présentes dans la liste, les boîtes des comptes d'abord puis les partagées, chacune avec ses non lus. */
export function boitesDeMails(mails: Mail[]): BoiteMail[] {
  const m = new Map<string, BoiteMail>();
  for (const x of mails) {
    const adresse = boiteDuMail(x);
    if (!adresse) continue;
    const b = m.get(adresse) ?? m.set(adresse, { adresse, compte: x.compte ?? adresse, partagee: !!x.boite, nombre: 0, nonLus: 0, source: x.source }).get(adresse)!;
    b.nombre++;
    if (x.nonLu) b.nonLus++;
  }
  return [...m.values()].sort((a, b) => Number(a.partagee) - Number(b.partagee) || a.adresse.localeCompare(b.adresse, 'fr'));
}

/** Les étiquettes présentes dans la liste, avec leur nombre de fils, les plus utilisées d'abord. */
export function libellesDeMails(mails: Mail[]): { nom: string; nombre: number }[] {
  const m = new Map<string, { nom: string; nombre: number }>();
  for (const x of mails)
    for (const l of new Set(x.libelles ?? [])) {
      const cle = l.toLowerCase();
      const e = m.get(cle) ?? m.set(cle, { nom: l, nombre: 0 }).get(cle)!;
      e.nombre++;
    }
  return [...m.values()].sort((a, b) => b.nombre - a.nombre || a.nom.localeCompare(b.nom, 'fr'));
}

/** Le nom court d'une boîte partagée pour la liste : « ventes@entreprise.fr » → « Ventes ». */
export function nomBoite(adresse: string): string {
  const n = adresse.replace(/@.*$/, '').replace(/[._-]+/g, ' ').trim();
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : adresse;
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

/** Un message plus ancien du même fil, rendu avec le mail ouvert. */
export type MessageFil = { id: string; de: string; adresse?: string; date?: string; heure?: string; texte: string; piecesJointes: string[] };

/** Un mail lu en entier, à la demande (le serveur ne le garde pas) : texte brut, destinataires, pièces jointes, étiquettes et fil. */
export type ContenuMail = {
  id: string;
  sujet: string;
  de: string;
  adresse?: string;
  a: string[];
  cc: string[];
  date?: string;
  heure?: string;
  texte: string;
  piecesJointes: string[];
  lien?: string;
  libelles?: string[];
  /** Les messages plus anciens du fil, du plus ancien au plus récent. */
  fil?: MessageFil[];
  /** Boîte partagée d'où vient le mail. */
  boite?: string;
};

/**
 * Le texte d'un mail coupé là où commence le message cité (la réponse précédente recopiée dessous) :
 * « Le lun. 27 oct. 2026, Paul a écrit : », « On … wrote: », un bloc « De : … Envoyé : » d'Outlook,
 * « -----Original Message----- », un trait de soulignés, ou une suite de lignes « > ».
 * Le corps garde ce qui est écrit au-dessus ; `cite` est replié dans le volet de lecture.
 */
export function decouperCitation(texte: string): { corps: string; cite: string } {
  const lignes = texte.split('\n');
  const debut = lignes.findIndex((l, i) => {
    const t = l.trim();
    if (!t || i === 0) return false;
    if (/^(le|on)\s.{4,200}\s(a écrit|wrote)\s?:$/i.test(t)) return true;
    if (/^-{2,}\s*(original message|message d'origine|message original)\s*-{2,}$/i.test(t)) return true;
    if (/^_{10,}$/.test(t)) return true;
    if (/^(de|from)\s?:\s.+/i.test(t) && /^(envoyé|sent|date)\s?:/i.test((lignes[i + 1] ?? '').trim())) return true;
    // Des lignes « > » jusqu'à la fin (ou presque) : la citation à l'ancienne.
    if (t.startsWith('>')) {
      const reste = lignes.slice(i).filter((x) => x.trim());
      return reste.filter((x) => x.trim().startsWith('>')).length >= reste.length * 0.8;
    }
    return false;
  });
  if (debut < 0) return { corps: texte, cite: '' };
  const corps = lignes.slice(0, debut).join('\n').trimEnd();
  // Rien au-dessus de la citation : on montre tout plutôt qu'un mail vide.
  return corps.trim() ? { corps, cite: lignes.slice(debut).join('\n').trim() } : { corps: texte, cite: '' };
}

/** Un morceau du texte d'un mail : du texte, un lien web, une adresse mail ou un numéro de téléphone, à rendre touchables. */
export type Morceau = { t: 'texte' | 'lien' | 'mail' | 'tel'; v: string };

/** Le texte découpé en morceaux, pour que les liens, adresses et numéros s'ouvrent d'un toucher. */
export function morceauxTexte(texte: string): Morceau[] {
  const re = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"»])|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|(\+?\d[\d .-]{7,}\d)/g;
  const out: Morceau[] = [];
  let i = 0;
  for (const r of texte.matchAll(re)) {
    const debut = r.index ?? 0;
    // Un numéro doit compter au moins 9 chiffres : « 2026-10-27 » ou un montant ne sont pas des numéros.
    if (r[3] && r[3].replace(/\D/g, '').length < 9) continue;
    if (debut > i) out.push({ t: 'texte', v: texte.slice(i, debut) });
    out.push({ t: r[1] ? 'lien' : r[2] ? 'mail' : 'tel', v: r[0] });
    i = debut + r[0].length;
  }
  if (i < texte.length) out.push({ t: 'texte', v: texte.slice(i) });
  return out;
}

/** La première ligne utile d'un message (pour un message replié du fil). */
export const premiereLigne = (texte: string) => decouperCitation(texte).corps.split('\n').map((l) => l.trim()).find(Boolean) ?? '';

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

/** L'heure d'un fil dans la liste, comme Outlook : l'heure aujourd'hui, « Hier », le jour de la semaine sur 7 jours, sinon la date. */
export function quandCourt(m: Pick<Mail, 'date' | 'heure'>, aujourdhui: string): string {
  if (!m.date) return '';
  if (m.date === aujourdhui) return m.heure ?? "Aujourd'hui";
  if (m.date === addDays(aujourdhui, -1)) return 'Hier';
  const d = new Date(`${m.date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  if (m.date > addDays(aujourdhui, -7)) {
    const j = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
    return j.charAt(0).toUpperCase() + j.slice(1);
  }
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '');
}

/** Les initiales d'un contact pour son avatar : « Marie Dupont » → « MD », « canal+ » → « C ». */
export function initiales(nom: string): string {
  const mots = adresseEmail(nom)
    .replace(/@.*$/, '')
    .split(/[\s._-]+/)
    .map((x) => x.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (!mots.length) return '?';
  return (mots.length > 1 ? mots[0][0] + mots[mots.length - 1][0] : mots[0][0]).toUpperCase();
}

/** Toujours la même couleur pour un même contact (indice dans une palette de `n` couleurs). */
export function teinteContact(nom: string, n: number): number {
  let h = 0;
  for (const c of norm(nom)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return n > 0 ? h % n : 0;
}
