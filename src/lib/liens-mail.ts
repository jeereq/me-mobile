import { addDays, today, uid } from './dates';
import { refExterne } from './externe';
import { adresseEmail, type Mail } from './mails';
import type { Config, Espace, LienMail, Relance, Tache } from './types';

/**
 * Relier les relances et les tâches aux mails d'où elles viennent.
 * Un lien tient au fil de discussion (`<compte connecté>:<fil>`) : un nouveau message dans le même échange
 * reste rattaché. Le lien est posé tout seul quand il est sûr (élément importé d'un mail), proposé quand
 * il est probable (même objet, ou même contact et objet proche), et l'utilisateur peut lier ou délier à la main.
 * Les habitudes n'ont pas de lien : elles reviennent chaque jour, un mail n'en est jamais l'origine.
 * Module pur : chaque fonction rend un nouvel espace ou une valeur, sans rien appeler.
 */

export type GenreLie = 'relance' | 'tache';
export type ElementLie = { genre: GenreLie; id: string; titre: string; fait: boolean };

/** La clé du fil d'un mail de la boîte de Me : le compte connecté puis le fil (ou le message, s'il n'a pas de fil). */
export function cleFil(m: Pick<Mail, 'id' | 'fil' | 'source'>): string {
  const r = refExterne(m.id);
  return `${r?.compte ?? m.source}:${m.fil || r?.element || m.id}`;
}

/** Ce que l'on garde d'un mail dans une relance ou une tâche. */
export function lienDepuisMail(m: Mail): LienMail {
  return { fil: cleFil(m), sujet: m.sujet, ...(m.contact ? { contact: m.contact } : {}), ...(m.adresse ? { adresse: adresseEmail(m.adresse) } : {}), ...(m.lien ? { lien: m.lien } : {}), source: m.source };
}

/** Le mail d'un lien, s'il est encore dans la boîte de Me (le plus récent du fil). */
export function mailDuLien(l: LienMail | undefined, mails: Mail[]): Mail | null {
  if (!l) return null;
  return mails.filter((m) => cleFil(m) === l.fil).sort((a, b) => `${b.date} ${b.heure ?? ''}`.localeCompare(`${a.date} ${a.heure ?? ''}`))[0] ?? null;
}

/** Le compte connecté et le fil d'un lien (`compte:fil`), pour relire le mail chez Gmail ou Outlook quand il n'est plus dans la boîte de Me. */
export function refLien(l: Pick<LienMail, 'fil'> | undefined): { compte: string; fil: string } | null {
  const i = l?.fil.indexOf(':') ?? -1;
  return l && i > 0 && i < l.fil.length - 1 ? { compte: l.fil.slice(0, i), fil: l.fil.slice(i + 1) } : null;
}

const titreRelance = (r: Relance) => `${r.contact} · ${r.sujet}`;

/** Les relances et tâches rattachées à ce mail (même fil), les ouvertes d'abord. */
export function liesAuMail(m: Mail, e: Pick<Espace, 'relances' | 'taches'>): ElementLie[] {
  const cle = cleFil(m);
  const out: ElementLie[] = [
    ...e.relances.filter((r) => r.mail?.fil === cle).map((r) => ({ genre: 'relance' as const, id: r.id, titre: titreRelance(r), fait: r.statut === 'repondu' })),
    ...e.taches.filter((t) => t.mail?.fil === cle).map((t) => ({ genre: 'tache' as const, id: t.id, titre: t.titre, fait: t.statut === 'fait' })),
  ];
  return out.sort((a, b) => Number(a.fait) - Number(b.fait));
}

/* ——— Ressemblance entre un élément et un mail ——— */

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const PETITS = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'et', 'ou', 'a', 'en', 'pour', 'sur', 'avec', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'votre', 'vos', 'nos', 'ce', 'cette', 'ces', 'the', 'of', 'to', 'for', 'and', 're', 'tr', 'fw', 'fwd', 'ref', 'relancer', 'relance', 'envoyer', 'repondre', 'faire', 'mail']);

/** L'objet sans « Re : », « TR : », « Fwd : » : deux messages du même échange ont alors le même objet. */
export function objetNu(s: string): string {
  return norm(s)
    .replace(/^\s*((re|tr|fw|fwd|ref|aw|sv)\s*(\[\d+\])?\s*:\s*)+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const motsDe = (s: string) => new Set(objetNu(s).split(/[^a-z0-9]+/).filter((x) => x.length > 2 && !PETITS.has(x)));

/** Les mots qui désignent un contact : son nom et la partie de l'adresse avant « @ ». */
function motsContact(nom?: string, adresse?: string): Set<string> {
  const a = adresseEmail(adresse ?? '').replace(/@.*$/, '');
  return new Set(norm(`${nom ?? ''} ${a}`).split(/[^a-z0-9]+/).filter((x) => x.length > 1 && !PETITS.has(x)));
}

/** Le contact d'une relance (« Marie », « marie@exemple.fr ») est celui du mail. */
export function memeContact(qui: string, m: Pick<Mail, 'contact' | 'adresse'>): boolean {
  const q = norm(qui).trim();
  if (!q) return false;
  const adr = norm(adresseEmail(m.adresse ?? ''));
  if (q.includes('@')) return !!adr && adresseEmail(q) === adr;
  const cherche = [...motsContact(q)];
  const dans = [...motsContact(m.contact, m.adresse)];
  return cherche.length > 0 && cherche.every((c) => dans.some((d) => d.startsWith(c)));
}

/** Mots en commun entre deux textes, sans les mots du contact (« devis », « toiture »). */
function communs(a: string, b: string, sauf: Set<string>): { n: number; min: number } {
  const ma = [...motsDe(a)].filter((x) => !sauf.has(x));
  const mb = new Set([...motsDe(b)].filter((x) => !sauf.has(x)));
  return { n: ma.filter((x) => mb.has(x)).length, min: Math.min(ma.length, mb.size) };
}

/** Le même objet, ou l'un contient l'autre (« Devis toiture » et « Re: Devis toiture – version 2 »). */
function memeObjet(a: string, b: string): boolean {
  const x = objetNu(a);
  const y = objetNu(b);
  if (x.length < 5 || y.length < 5) return x === y && !!x;
  return x === y || x.includes(y) || y.includes(x);
}

/** Pourquoi un élément semble lié à un mail ; null s'il ne l'est pas assez pour le proposer. */
export function raisonLien(el: { genre: 'relance'; r: Relance } | { genre: 'tache'; t: Tache }, m: Mail): string | null {
  const contact = motsContact(m.contact, m.adresse);
  if (el.genre === 'relance') {
    const { r } = el;
    const meme = memeContact(r.contact, m);
    if (memeObjet(r.sujet, m.sujet)) return meme ? 'Même contact et même objet' : 'Même objet';
    const c = communs(r.sujet, m.sujet, contact);
    if (meme && c.n >= 1 && c.n * 2 >= c.min) return 'Même contact, objet proche';
    return null;
  }
  const { t } = el;
  // Une tâche importée s'intitule « Objet · Contact » : on compare l'objet seul.
  const titre = t.titre.replace(/\s·\s[^·]*$/, '');
  const nomme = [...motsDe(t.titre)].some((x) => [...contact].some((c) => c.length > 2 && x === c));
  if (memeObjet(titre, m.sujet)) return nomme ? 'Même contact et même objet' : 'Même objet';
  const c = communs(titre, m.sujet, contact);
  if (nomme && c.n >= 1) return 'Contact cité, objet proche';
  if (c.n >= 2 && c.n * 2 >= c.min) return 'Objet proche';
  return null;
}

const proposable = (x: Relance | Tache, cle: string) => !x.mail && !(x.mailsEcartes ?? []).includes(cle);

export type Suggestion = ElementLie & { raison: string };

/** Les relances et tâches ouvertes, pas encore liées, qui semblent parler de ce mail (3 au plus). */
export function suggestionsPourMail(m: Mail, e: Pick<Espace, 'relances' | 'taches' | 'projets'>, max = 3): Suggestion[] {
  const cle = cleFil(m);
  const out: Suggestion[] = [];
  for (const r of e.relances) {
    if (r.statut === 'repondu' || !proposable(r, cle)) continue;
    const raison = raisonLien({ genre: 'relance', r }, m);
    if (raison) out.push({ genre: 'relance', id: r.id, titre: titreRelance(r), fait: false, raison });
  }
  for (const t of e.taches) {
    if (t.statut === 'fait' || t.projet || !proposable(t, cle)) continue;
    const raison = raisonLien({ genre: 'tache', t }, m);
    if (raison) out.push({ genre: 'tache', id: t.id, titre: t.titre, fait: false, raison });
  }
  const force = (s: Suggestion) => (s.raison.startsWith('Même contact et') ? 0 : s.raison === 'Même objet' ? 1 : 2);
  return out.sort((a, b) => force(a) - force(b)).slice(0, max);
}

/** Le mail qui semble lié à une relance ou une tâche pas encore rattachée (le plus récent), avec la raison. */
export function mailSuggere(el: { genre: 'relance'; r: Relance } | { genre: 'tache'; t: Tache }, mails: Mail[]): { mail: Mail; raison: string } | null {
  const x = el.genre === 'relance' ? el.r : el.t;
  if (x.mail || (el.genre === 'relance' ? el.r.statut === 'repondu' : el.t.statut === 'fait')) return null;
  const tries = [...mails].sort((a, b) => `${b.date} ${b.heure ?? ''}`.localeCompare(`${a.date} ${a.heure ?? ''}`));
  for (const m of tries) {
    if ((x.mailsEcartes ?? []).includes(cleFil(m))) continue;
    const raison = raisonLien(el, m);
    if (raison) return { mail: m, raison };
  }
  return null;
}

/* ——— Lier, délier, écarter ——— */

const champ = (g: GenreLie) => (g === 'relance' ? 'relances' : 'taches');

/** Ce qu'une relance et une tâche ont en commun pour le lien : on change ces champs-là, le reste est gardé tel quel. */
type Liable = { id: string; mail?: LienMail; mailsEcartes?: string[] };

function changer(e: Espace, g: GenreLie, id: string, f: (x: Liable) => Liable): Espace {
  const k = champ(g);
  return { ...e, [k]: (e[k] as Liable[]).map((x) => (x.id === id ? f(x) : x)) };
}

/** Rattache l'élément au mail ; un refus passé pour ce fil est oublié. */
export function lier(e: Espace, g: GenreLie, id: string, m: Mail): Espace {
  const l = lienDepuisMail(m);
  return changer(e, g, id, (x) => {
    const ecartes = (x.mailsEcartes ?? []).filter((f) => f !== l.fil);
    const { mailsEcartes: _, ...reste } = x;
    return { ...reste, mail: l, ...(ecartes.length ? { mailsEcartes: ecartes } : {}) };
  });
}

/** Détache l'élément de son mail, et retient ce fil pour ne plus le reproposer (ni le relier à la synchro). */
export function delier(e: Espace, g: GenreLie, id: string): Espace {
  return changer(e, g, id, (x) => {
    if (!x.mail) return x;
    const { mail, ...reste } = x;
    return { ...reste, mailsEcartes: [...new Set([...(x.mailsEcartes ?? []), mail.fil])] };
  });
}

/** « Non, ce n'est pas lié » : la suggestion ne revient plus. */
export function ecarter(e: Espace, g: GenreLie, id: string, m: Mail): Espace {
  const fil = cleFil(m);
  return changer(e, g, id, (x) => ({ ...x, mailsEcartes: [...new Set([...(x.mailsEcartes ?? []), fil])] }));
}

/* ——— Créer depuis un mail ——— */

/** Une relance tirée d'un mail : relancer ce contact sur cet objet dans le délai habituel. */
export function relanceDepuisMail(m: Mail, c: Pick<Config, 'delaiRelanceJours' | 'defauts'>, jour = today()): Relance {
  return {
    id: uid(),
    contact: m.contact || adresseEmail(m.adresse ?? '') || 'Contact',
    sujet: objetPropre(m.sujet),
    boite: m.ctx,
    date: addDays(jour, Math.max(1, c.delaiRelanceJours || 3)),
    statut: 'a_faire',
    mode: c.defauts.relance,
    creeLe: new Date().toISOString(),
    mail: lienDepuisMail(m),
  };
}

/** Une tâche tirée d'un mail : son objet pour titre, dans la boîte (perso ou pro) du compte. */
export function tacheDepuisMail(m: Mail, c: Pick<Config, 'defauts'>): Tache {
  return { id: uid(), titre: objetPropre(m.sujet), source: m.ctx, priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: c.defauts.tache, creeLe: new Date().toISOString(), mail: lienDepuisMail(m) };
}

/** L'objet sans les « Re : » ni « TR : » de tête, tel qu'il s'écrit. */
export function objetPropre(s: string): string {
  return s.replace(/^\s*((re|tr|fw|fwd|réf|ref|aw|sv)\s*(\[\d+\])?\s*:\s*)+/i, '').trim() || s;
}
