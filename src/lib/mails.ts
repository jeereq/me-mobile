import { addDays } from './dates';
import type { Boite, SourceKey } from './types';

/**
 * La boîte mail de Me : les fils récents rapportés par le serveur (Gmail, Outlook), rangés pour être lus.
 * Me ne garde que l'objet, le contact, la date, l'état lu et le lien vers le fil d'origine — jamais le contenu.
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
