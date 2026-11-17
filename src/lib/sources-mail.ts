import { boiteDuMail, type Mail } from './mails';

/** Au plus 5 mails mélangés : l'IA les lit tous ensemble, au-delà elle perdrait le fil. */
export const MAX_SOURCES = 5;

/** Ajoute ou retire un mail de la sélection ; au-delà de MAX_SOURCES, la liste ne change pas. */
export function basculerSource(liste: string[], id: string, max = MAX_SOURCES): string[] {
  if (liste.includes(id)) return liste.filter((x) => x !== id);
  return liste.length >= max ? liste : [...liste, id];
}

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Les mails qu'on peut choisir comme source : un seul par conversation (le plus récent), sans le mail auquel on répond,
 * filtrés par la boîte choisie (une adresse de compte ou de boîte partagée) et par ce que l'utilisateur tape
 * (contact, objet, début du texte).
 */
export function mailsChoisissables(mails: Mail[], recherche: string, sauf?: string, boite?: string): Mail[] {
  const q = sansAccents(recherche.trim());
  const filDuSauf = sauf ? mails.find((x) => x.id === sauf)?.fil : undefined;
  const vus = new Set<string>();
  return mails.filter((m) => {
    if (m.id === sauf || (m.fil && m.fil === filDuSauf)) return false;
    if (boite && boiteDuMail(m) !== boite) return false;
    const cle = m.fil || m.id;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return !q || sansAccents(`${m.contact} ${m.sujet} ${m.extrait ?? ''}`).includes(q);
  });
}

/** Les boîtes qui ont au moins un mail à choisir : de quoi proposer un filtre, et rien quand il n'y a qu'une boîte. */
export function boitesDesSources(mails: Mail[], sauf?: string): { adresse: string; partagee: boolean; nombre: number }[] {
  const m = new Map<string, { adresse: string; partagee: boolean; nombre: number }>();
  for (const x of mailsChoisissables(mails, '', sauf)) {
    const adresse = boiteDuMail(x);
    if (!adresse) continue;
    const b = m.get(adresse) ?? m.set(adresse, { adresse, partagee: !!x.boite, nombre: 0 }).get(adresse)!;
    b.nombre++;
  }
  return [...m.values()].sort((a, b) => Number(a.partagee) - Number(b.partagee) || a.adresse.localeCompare(b.adresse, 'fr'));
}
