import type { Commande } from './commande';
import { creerVirement, comptesDe, resumerComptes } from './comptes';
import { addDays, doneIn, fmtCourt, habitToday, JOURS, parse, streak, uid } from './dates';
import { saisie } from './devises';
import { bilan, financesDe, fmtMontant, revenusEntre, suiviPlan, totalRevenus } from './finances';
import { lienDepuisMail, mailDuLien, relanceDepuisMail, tacheDepuisMail } from './liens-mail';
import { destinataire, trouverMail, type Mail } from './mails';
import { ajouterVersement, objectifsActifs, resumeObjectifs, suiviObjectif } from './objectifs';
import { lireDate, lirePhrase } from './phrase';
import { tachesActives } from './planning';
import type { Budget, Compte, Config, Espace, Finances, Objectif, Periode, Relance, Revenu, Tache } from './types';
import { liste, majuscule, meilleur, n, nomDansPhrase, sansAccents } from './voix-texte';

/**
 * Commandes vocales au-delà de l'ajout : reporter, supprimer, prioriser, relancer par mail, revenus, virements,
 * postes, objectifs, comptes, agenda, mails rattachés. Chaque fonction lit la phrase et rend une commande, ou null
 * si la phrase ne la concerne pas. Les changements sont des fonctions pures (`faire`, `defaire`) : « Annule » les défait.
 */
export type Contexte = { brut: string; q: string; e: Espace; d: string; mails: Mail[]; config?: Pick<Config, 'delaiRelanceJours' | 'defauts'> };

const changerFinances = (e: Espace, f: (x: Finances) => Finances): Espace => ({ ...e, finances: f(financesDe(e)) });
const quandDit = (date: string, d: string) => (date === d ? "aujourd'hui" : date === addDays(d, 1) ? 'demain' : date === addDays(d, -1) ? 'hier' : `${JOURS[parse(date).getDay()]} ${fmtCourt(date).replace(/\.$/, '')}`);
const ARTICLE = /^(?:(?:la|le|les|l'|une?|ma|mon|mes)\s*)/i;
/** Le montant d'une phrase (« 200 € », « 1 500 dollars », « 12,50 ») et sa devise ; on réutilise la lecture des dépenses. */
function montantDe(texte: string, d: string, budgets: Budget[] = []) {
  const p = lirePhrase(`dépensé ${texte}`, d, budgets);
  return p?.genre === 'depense' ? p : null;
}
/** « le taxi », « mon salaire » → « Taxi », « Salaire » : la note sans l'article dicté devant. */
export const noteNette = (s: string) => majuscule(s.replace(/^(?:(?:de|d'|du|des|pour|comme|le|la|les|l'|un|une|mon|ma|mes)\s*)+/i, '').trim());
const PERIODE: [RegExp, Periode][] = [
  [/par jour|chaque jour|quotidien/, 'jour'],
  [/par semaine|chaque semaine|hebdo/, 'semaine'],
  [/par trimestre|chaque trimestre/, 'trimestre'],
  [/par an|par annee|chaque annee|annuel/, 'annee'],
  [/par mois|chaque mois|mensuel/, 'mois'],
];

/* ——— Tâches et relances ——— */

type Element = { genre: 'tache'; t: Tache } | { genre: 'relance'; r: Relance };
const nomElement = (x: Element) => (x.genre === 'tache' ? x.t.titre : `${x.r.contact} ${x.r.sujet}`);

/** La tâche ou la relance que désigne la phrase (« la tâche devis », « la relance de Paul », « Paul »). */
function element(c: Contexte, texte: string, genre?: string | null): Element | null {
  const t = texte.replace(/^(?:la |le |ma |mon )?(?:t[âa]che|relance)s?\s+(?:de |d'|du |pour |avec )?/i, '').replace(ARTICLE, '');
  const elements: Element[] = [
    ...(genre === 'relance' ? [] : tachesActives(c.e, c.d).map((x) => ({ genre: 'tache' as const, t: x }))),
    ...(genre === 'tache' ? [] : c.e.relances.filter((r) => r.statut !== 'repondu').map((r) => ({ genre: 'relance' as const, r }))),
  ];
  return meilleur(elements, nomElement, t);
}

/** « Reporte le devis à lundi », « Décale la relance de Paul à demain », « Repousse la tâche sport de 3 jours ». */
function reporter(c: Contexte): Commande | null {
  const m = /^(?:reporte[rz]?|repousse[rz]?|d[ée]cale[rz]?|d[ée]place[rz]?|remets?|remettre|(mets|passe))\s+(?:(?:la |le )?(t[âa]che|relance)s?\s+)?(.+)$/i.exec(c.brut);
  if (!m) return null;
  // « Mets le devis à demain » ne reporte que si « le devis » existe déjà ; sinon c'est un ajout.
  const doux = !!m[1];
  m.splice(1, 1);
  const genre = m[1] ? sansAccents(m[1]) : null;
  const decal = /^(.+?)\s+(?:de|d')\s*(\d+|un|une)\s+(jours?|semaines?)$/i.exec(m[2]);
  let quoi: string;
  let date: string | null;
  if (decal) {
    quoi = decal[1];
    const k = /^\d+$/.test(decal[2]) ? Number(decal[2]) : 1;
    date = addDays(c.d, k * (decal[3].startsWith('semaine') ? 7 : 1));
  } else {
    const l = lireDate(m[2], c.d);
    quoi = l.reste.replace(/\s+(?:à|a|au|pour|jusqu'à|jusqu'a)$/i, '');
    date = l.date;
  }
  if (!date) return doux ? null : { type: 'reponse', texte: 'À quand ? Dis par exemple « Reporte le devis à lundi ».' };
  const x = element(c, quoi, genre);
  if (!x) return doux ? null : { type: 'reponse', texte: `Je ne trouve pas « ${quoi} » dans tes tâches ni tes relances.` };
  const quand = quandDit(date, c.d);
  if (x.genre === 'tache') {
    const { id, echeance } = x.t;
    return { type: 'changer', texte: `${x.t.titre} : reportée à ${quand}.`, faire: (e) => ({ ...e, taches: e.taches.map((t) => (t.id === id ? { ...t, echeance: date } : t)) }), defaire: (e) => ({ ...e, taches: e.taches.map((t) => (t.id === id ? { ...t, echeance } : t)) }) };
  }
  const { id, date: avant } = x.r;
  return { type: 'changer', texte: `Relance de ${x.r.contact} reportée à ${quand}.`, faire: (e) => ({ ...e, relances: e.relances.map((r) => (r.id === id ? { ...r, date } : r)) }), defaire: (e) => ({ ...e, relances: e.relances.map((r) => (r.id === id ? { ...r, date: avant } : r)) }) };
}

/** « Supprime la tâche devis », « Efface l'habitude sport », « Retire la relance de Paul ». */
function supprimer(c: Contexte): Commande | null {
  const m = /^(?:supprime[rz]?|efface[rz]?|retire[rz]?|enl[èe]ve[rz]?)\s+(?:la |le |l'|une? |ma |mon )?(t[âa]che|relance|habitude|d[ée]pense)s?\s+(?:de |d'|du |pour )?(.+)$/i.exec(c.brut);
  if (!m) return null;
  const genre = sansAccents(m[1]);
  if (genre === 'habitude') {
    const h = meilleur(c.e.habitudes, (x) => x.nom, m[2]);
    if (!h) return { type: 'reponse', texte: `Je ne trouve pas d'habitude « ${m[2]} ».` };
    const i = c.e.habitudes.findIndex((x) => x.id === h.id);
    return { type: 'changer', texte: `Habitude supprimée : ${h.nom}.`, faire: (e) => ({ ...e, habitudes: e.habitudes.filter((x) => x.id !== h.id) }), defaire: (e) => ({ ...e, habitudes: [...e.habitudes.slice(0, i), h, ...e.habitudes.slice(i)] }) };
  }
  if (genre === 'depense') {
    const f = financesDe(c.e);
    const dep = meilleur(f.depenses.filter((x) => !x.lien).slice(0, 60), (x) => `${x.note} ${x.montant}`, m[2]);
    if (!dep) return { type: 'reponse', texte: `Je ne trouve pas de dépense récente « ${m[2]} ».` };
    return { type: 'changer', texte: `Dépense supprimée : ${fmtMontant(dep.montant, f.devise)}${dep.note ? ` ${dep.note}` : ''}.`, faire: (e) => changerFinances(e, (g) => ({ ...g, depenses: g.depenses.filter((x) => x.id !== dep.id) })), defaire: (e) => changerFinances(e, (g) => ({ ...g, depenses: [dep, ...g.depenses] })) };
  }
  const x = element(c, m[2], genre);
  if (!x) return { type: 'reponse', texte: `Je ne trouve pas « ${m[2]} » dans tes ${genre === 'relance' ? 'relances' : 'tâches'}.` };
  if (x.genre === 'tache') {
    const t = x.t;
    const i = c.e.taches.findIndex((y) => y.id === t.id);
    return { type: 'changer', texte: `Tâche supprimée : ${t.titre}.`, faire: (e) => ({ ...e, taches: e.taches.filter((y) => y.id !== t.id) }), defaire: (e) => ({ ...e, taches: [...e.taches.slice(0, i), t, ...e.taches.slice(i)] }) };
  }
  const r = x.r;
  const i = c.e.relances.findIndex((y) => y.id === r.id);
  return { type: 'changer', texte: `Relance de ${r.contact} supprimée.`, faire: (e) => ({ ...e, relances: e.relances.filter((y) => y.id !== r.id) }), defaire: (e) => ({ ...e, relances: [...e.relances.slice(0, i), r, ...e.relances.slice(i)] }) };
}

/** « Le devis est urgent », « Mets le devis en priorité haute », « Le rangement n'est pas urgent ». */
function prioriser(c: Contexte): Commande | null {
  const haute = /^(?:mets|passe|rends|marque)\s+(.+?)\s+(?:en\s+)?(?:priorit[ée] haute|prioritaire|urgente?|importante?|en priorit[ée])$/i.exec(c.brut) ?? /^(.+?)\s+est\s+(?:tr[èe]s\s+)?(?:urgente?|importante?|prioritaire)$/i.exec(c.brut);
  const basse = /^(?:mets|passe|rends|marque)\s+(.+?)\s+(?:en\s+)?(?:priorit[ée] basse|pas urgente?|moins urgente?)$/i.exec(c.brut) ?? /^(.+?)\s+n'est\s+pas\s+(?:urgente?|importante?|prioritaire)$/i.exec(c.brut);
  const m = haute ?? basse;
  if (!m) return null;
  const x = element(c, m[1], 'tache');
  if (!x || x.genre !== 'tache') return { type: 'reponse', texte: `Je ne trouve pas de tâche « ${m[1]} ».` };
  const { id, priorite: avant, titre } = x.t;
  const priorite = haute ? 'haute' : 'basse';
  return { type: 'changer', texte: haute ? `${titre} : importante.` : `${titre} : priorité basse.`, faire: (e) => ({ ...e, taches: e.taches.map((t) => (t.id === id ? { ...t, priorite } : t)) }), defaire: (e) => ({ ...e, taches: e.taches.map((t) => (t.id === id ? { ...t, priorite: avant } : t)) }) };
}

/** « J'ai relancé Paul » (relance faite, en attente de réponse), « Paul a répondu » (relance close). */
function etatRelance(c: Contexte): Commande | null {
  const relance = /^j'ai (?:relance|recontacte|rappele|ecrit a|appele)\s+(.+)$/.exec(c.q);
  const repondu = /^(.+?)\s+(?:a|m'a)\s+(?:repondu|rappele|ecrit)\b/.exec(c.q) ?? /^(?:j'ai eu|j'ai recu la reponse de|reponse recue de)\s+(.+)$/.exec(c.q);
  const m = relance ?? repondu;
  if (!m) return null;
  const r = meilleur(
    c.e.relances.filter((x) => x.statut !== 'repondu'),
    (x) => `${x.contact} ${x.sujet}`,
    m[1],
  );
  if (!r) return relance ? null : { type: 'reponse', texte: `Je n'ai pas de relance en cours pour ${majuscule(m[1])}.` };
  return { type: 'statutRelance', relance: r, statut: relance ? 'relance' : 'repondu' };
}

/** « Relance Paul par mail », « Envoie la relance à Paul » : un mail prêt à envoyer, en réponse au mail rattaché s'il y en a un. */
function relancerParMail(c: Contexte): Commande | null {
  const m = /^(?:relance[rz]?|recontacte[rz]?)\s+(.+?)\s+par (?:e-?mail|mail|courriel)$/.exec(c.q) ?? /^(?:envoie|envoyer|ecris)\s+(?:la |une )?relance\s+(?:a|pour|de)\s+(.+)$/.exec(c.q);
  if (!m) return null;
  const r = meilleur(
    c.e.relances.filter((x) => x.statut !== 'repondu'),
    (x) => `${x.contact} ${x.sujet}`,
    m[1],
  );
  const texte = (sujet: string) => `Bonjour, je me permets de revenir vers vous au sujet de « ${sujet} ». Avez-vous pu avancer ? Bien à vous.`;
  if (r) {
    const fil = mailDuLien(r.mail, c.mails);
    if (fil) return { type: 'repondreMail', mail: fil, texte: texte(r.sujet) };
    const dest = destinataire(c.mails, r.contact);
    return { type: 'ecrireMail', a: dest?.adresse ?? r.mail?.adresse, nom: dest?.nom ?? r.contact, sujet: `Relance : ${r.sujet}`, texte: texte(r.sujet) };
  }
  const dest = destinataire(c.mails, m[1]);
  return { type: 'ecrireMail', a: dest?.adresse, nom: dest?.nom ?? majuscule(m[1]), sujet: 'Relance', texte: 'Bonjour, je me permets de revenir vers vous. Avez-vous pu avancer ? Bien à vous.' };
}

/** « Crée une relance pour le mail de Paul », « Fais une tâche du mail de Paul », « Transforme le mail de Paul en tâche ». */
function depuisMail(c: Contexte): Commande | null {
  const m =
    /^(?:cree|creer|ajoute|fais|fait|mets)\s+(?:une |la )?(tache|relance)\s+(?:pour|depuis|avec|a partir|sur|du|a propos)\s*(?:de |du |d')?(?:le |ce |son )?(?:dernier )?(?:e-?mail|mail|courriel|message)\s+(?:de |d'|du )?(.+)$/.exec(c.q) ??
    /^(?:transforme|change)\s+(?:le |ce )?(?:dernier )?(?:e-?mail|mail|courriel|message)\s+(?:de |d'|du )?(.+?)\s+en\s+(tache|relance)$/.exec(c.q);
  if (!m) return null;
  const [genre, qui] = /^(tache|relance)$/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
  const mail = trouverMail(c.mails, qui);
  if (!mail) return { type: 'reponse', texte: `Je ne trouve pas de mail récent de ${majuscule(qui)}.` };
  const config = c.config ?? { delaiRelanceJours: 3, defauts: { relance: 'normal', tache: 'normal', facture: 'normal', finance: 'normal', perso: 'normal' } };
  if (genre === 'relance') {
    const r = relanceDepuisMail(mail, config, c.d);
    return { type: 'changer', texte: `Relance ajoutée : ${r.contact}, « ${r.sujet} », ${quandDit(r.date, c.d)}. Elle reste rattachée au mail.`, faire: (e) => ({ ...e, relances: [r, ...e.relances] }), defaire: (e) => ({ ...e, relances: e.relances.filter((x) => x.id !== r.id) }) };
  }
  const t = tacheDepuisMail(mail, config);
  return { type: 'changer', texte: `Tâche ajoutée : ${t.titre}. Elle reste rattachée au mail de ${mail.contact || 'ce contact'}.`, faire: (e) => ({ ...e, taches: [t, ...e.taches] }), defaire: (e) => ({ ...e, taches: e.taches.filter((x) => x.id !== t.id) }) };
}

/** « Rattache la relance de Paul à son dernier mail » : le lien qu'on fait aussi à la main dans Mails. */
function rattacher(c: Contexte): Commande | null {
  const m = /^(?:rattache|lie|relie|associe)\s+(?:la |le )?(tache|relance)\s+(.+?)\s+(?:a|au|avec)\s+(?:son |le |ce )?(?:dernier )?(?:e-?mail|mail|courriel|message)(?:\s+(?:de |d'|du )?(.+))?$/.exec(c.q);
  if (!m) return null;
  const x = element(c, m[2], m[1]);
  if (!x) return { type: 'reponse', texte: `Je ne trouve pas « ${m[2]} ».` };
  const qui = m[3] ?? (x.genre === 'relance' ? x.r.contact : m[2]);
  const mail = trouverMail(c.mails, qui);
  if (!mail) return { type: 'reponse', texte: `Je ne trouve pas de mail récent de ${majuscule(qui)}.` };
  const lien = lienDepuisMail(mail);
  const cle = x.genre === 'tache' ? 'taches' : 'relances';
  const id = x.genre === 'tache' ? x.t.id : x.r.id;
  const avant = x.genre === 'tache' ? x.t.mail : x.r.mail;
  const poser = (e: Espace, v: typeof avant) => ({ ...e, [cle]: (e[cle] as (Tache | Relance)[]).map((y) => (y.id === id ? { ...y, mail: v } : y)) });
  return { type: 'changer', texte: `C'est rattaché au mail « ${mail.sujet} ».`, faire: (e) => poser(e, lien), defaire: (e) => poser(e, avant) };
}

/* ——— Finances ——— */

const compteNomme = (f: Finances, phrase: string): Compte | null => nomDansPhrase(comptesDe(f), (x) => x.nom, phrase) ?? null;

/** « J'ai reçu 1 500 € de salaire », « Ajoute un revenu de 200 € remboursement sur le compte Equity ». */
function revenu(c: Contexte): Commande | null {
  const m = /^(?:j'ai (?:re[çc]u|touch[ée]|gagn[ée]|encaiss[ée]|per[çc]u)|(?:ajoute|note|enregistre)[rz]?\s+(?:un |une )?(?:revenu|rentr[ée]e d'argent|entr[ée]e)(?:\s+de)?|revenu de|rentr[ée]e de)\s+(.+)$/i.exec(c.brut);
  if (!m) return null;
  const f = financesDe(c.e);
  const compte = compteNomme(f, m[1]);
  const reste = compte ? m[1].replace(new RegExp(`\\s*(?:sur|dans|au|à)\\s+(?:le |mon |l')?(?:compte\\s+)?${compte.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), ' ') : m[1];
  const p = montantDe(reste, c.d);
  if (!p) return /^j'ai/i.test(c.brut) ? null : { type: 'reponse', texte: 'Combien ? Dis par exemple « J’ai reçu 1 500 € de salaire ».' };
  const s = saisie(p.montant, p.devise ?? f.devise, f.devise, f.taux);
  if (!s) return { type: 'reponse', texte: `Je ne connais pas le taux du ${p.devise}. Renseigne-le dans Finances.` };
  const note = noteNette(p.note) || 'Revenu';
  const r: Revenu = { id: uid(), montant: s.montant, ...(s.origine ? { origine: s.origine } : {}), note, date: p.date, creeLe: new Date().toISOString(), ...(compte ? { compte: compte.id } : {}) };
  return { type: 'changer', texte: `Revenu noté : ${fmtMontant(r.montant, f.devise)}${note !== 'Revenu' ? ` (${note})` : ''}${compte ? ` sur ${compte.nom}` : ''}.`, faire: (e) => changerFinances(e, (g) => ({ ...g, revenus: [r, ...(g.revenus || [])] })), defaire: (e) => changerFinances(e, (g) => ({ ...g, revenus: (g.revenus || []).filter((x) => x.id !== r.id) })) };
}

/** « Vire 200 € du compte courant vers le livret », « Transfère 50 dollars de Equity à M-Pesa ». */
function virement(c: Contexte): Commande | null {
  if (!/^(?:vire[rz]?|transf[èe]re[rz]?|fais un virement|faire un virement|virement|mets|d[ée]place|bouge)\b/i.test(c.brut) || !/\d/.test(c.brut)) return null;
  const f = financesDe(c.e);
  const comptes = comptesDe(f);
  // Les deux comptes : celui qui suit « de / du / depuis » part, celui qui suit « vers / sur / à / au » reçoit.
  const pos = comptes
    .map((x) => ({ x, i: sansAccents(c.brut).indexOf(sansAccents(x.nom)) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i);
  // Un seul compte nommé et deux comptes en tout : l'autre est sous-entendu (« Transfère 50 € sur M-Pesa »).
  if (pos.length === 1 && comptes.length === 2) {
    const autre = comptes.find((x) => x.id !== pos[0].x.id)!;
    const vers = /(?:vers|sur|a|au|dans)\s+(?:le |mon |l')?(?:compte )?$/.test(sansAccents(c.brut).slice(Math.max(0, pos[0].i - 12), pos[0].i));
    pos.splice(0, 1, ...(vers ? [{ x: autre, i: -1 }, pos[0]] : [pos[0], { x: autre, i: 1e9 }]));
  }
  if (pos.length < 2) {
    // « Mets 100 € de côté » sans comptes : ce n'est pas un virement (voir les objectifs).
    if (/^(?:mets|d[ée]place|bouge)\b/i.test(c.brut)) return null;
    return { type: 'reponse', texte: comptes.length < 2 ? 'Pour un virement, il me faut au moins deux comptes : ajoute-les dans Finances, onglet Comptes.' : `Entre quels comptes ? Dis par exemple « Vire 200 € de ${comptes[0].nom} vers ${comptes[1].nom} ».` };
  }
  const avant = (i: number) => sansAccents(c.brut).slice(Math.max(0, i - 12), i);
  const [a, b] = pos;
  const versA = /(?:vers|sur|a|au|dans)\s+(?:le |mon |l')?(?:compte )?$/.test(avant(a.i));
  const [de, vers] = versA ? [b.x, a.x] : [a.x, b.x];
  const p = montantDe(c.brut.replace(/^\S+\s+/, ''), c.d);
  if (!p) return { type: 'reponse', texte: 'Combien ? Dis par exemple « Vire 200 € du compte courant vers le livret ».' };
  const s = saisie(p.montant, p.devise ?? f.devise, f.devise, f.taux);
  if (!s) return { type: 'reponse', texte: `Je ne connais pas le taux du ${p.devise}. Renseigne-le dans Finances.` };
  const id = uid();
  const g = creerVirement(f, { id, de: de.id, vers: vers.id, montant: s.montant, date: p.date, creeLe: new Date().toISOString() });
  if (!g) return { type: 'reponse', texte: 'Le compte de départ et celui d’arrivée sont les mêmes.' };
  return {
    type: 'changer',
    texte: `Virement noté : ${fmtMontant(s.montant, f.devise)} de ${de.nom} vers ${vers.nom}.`,
    faire: (e) => changerFinances(e, (h) => creerVirement(h, { id, de: de.id, vers: vers.id, montant: s.montant, date: p.date, creeLe: new Date().toISOString() }) ?? h),
    defaire: (e) => changerFinances(e, (h) => ({ ...h, depenses: h.depenses.filter((x) => x.id !== `${id}-s`), revenus: (h.revenus || []).filter((x) => x.id !== `${id}-e`) })),
  };
}

/** « Mets 100 € de côté pour le voyage », « Verse 50 € sur l'objectif voiture », « J'ai remboursé 200 € du prêt ». */
function verser(c: Contexte): Commande | null {
  const m = /^(?:verse[rz]?|mets|mettre|ajoute[rz]?|j'ai mis|j'ai verse|j'ai rembourse|rembourse[rz]?|epargne[rz]?|j'ai epargne|economise[rz]?|j'ai economise)\s+(.+)$/.exec(c.q);
  if (!m || !/\d/.test(m[1])) return null;
  const f = financesDe(c.e);
  const objectifs = objectifsActifs(f);
  const o = nomDansPhrase(objectifs, (x) => x.nom, m[1]) ?? (/(?:objectif|de cote|epargne|rembours|economis)/.test(c.q) ? meilleur(objectifs, (x) => x.nom, m[1].replace(/[\d,.]+\s*\S*/, '')) : null);
  if (!o) return /(?:objectif|de cote)/.test(c.q) ? { type: 'reponse', texte: objectifs.length ? `Pour quel objectif ? ${liste(objectifs.map((x) => x.nom))}.` : 'Tu n’as pas encore d’objectif. Crée-le dans Finances, onglet Objectifs.' } : null;
  const p = montantDe(c.brut.replace(/^\S+\s+(?:mis\s+|vers[ée]\s+|rembours[ée]\s+)?/i, ''), c.d);
  if (!p) return null;
  const s = saisie(p.montant, p.devise ?? f.devise, f.devise, f.taux);
  if (!s) return { type: 'reponse', texte: `Je ne connais pas le taux du ${p.devise}. Renseigne-le dans Finances.` };
  const v = { id: uid(), date: p.date, montant: s.montant };
  const apres = suiviObjectif(ajouterVersement(o, v), c.d);
  const cible = o;
  const poser = (e: Espace, f2: (x: Objectif) => Objectif) => changerFinances(e, (g) => ({ ...g, objectifs: (g.objectifs ?? []).map((x) => (x.id === cible.id ? f2(x) : x)) }));
  return {
    type: 'changer',
    texte: `${fmtMontant(s.montant, f.devise)} versés sur ${o.nom}. ${apres.atteint ? 'Objectif atteint, bravo !' : `Tu en es à ${Math.round(apres.pct * 100)} %, il reste ${fmtMontant(apres.reste, f.devise)}.`}`,
    faire: (e) => poser(e, (x) => ajouterVersement(x, v)),
    defaire: (e) => poser(e, (x) => ({ ...x, versements: x.versements.filter((y) => y.id !== v.id) })),
  };
}

/** « Crée un budget restaurant de 150 € par mois ». */
function creerBudget(c: Contexte): Commande | null {
  const m = /^(?:cr[ée]{1,2}[erz]?|ajoute[rz]?|nouveau|fais|fixe[rz]?|mets)\s+(?:un |le |mon )?budget\s+(.+)$/i.exec(c.brut);
  if (!m) return null;
  const f = financesDe(c.e);
  const p = montantDe(m[1], c.d);
  if (!p) return { type: 'reponse', texte: 'De combien ? Dis par exemple « Crée un budget restaurant de 150 € par mois ».' };
  const qr = sansAccents(m[1]);
  const periode = PERIODE.find(([re]) => re.test(qr))?.[1] ?? 'mois';
  const nom = majuscule(
    p.note
      .replace(/\b(?:par|chaque)\s+(?:jour|semaine|mois|trimestre|an|ann[ée]e)\b|\b(?:quotidien|hebdo|mensuel|annuel)\b/gi, '')
      .trim()
      .replace(/^(?:de |d'|pour |du |des )|\s+(?:de|pour|par)$/gi, '')
      .trim(),
  );
  if (!nom) return { type: 'reponse', texte: 'Pour quoi, ce budget ? Dis par exemple « Crée un budget restaurant de 150 € par mois ».' };
  const deja = meilleur(f.budgets, (x) => x.nom, nom, 1);
  const s = saisie(p.montant, p.devise ?? f.devise, f.devise, f.taux);
  if (!s) return { type: 'reponse', texte: `Je ne connais pas le taux du ${p.devise}. Renseigne-le dans Finances.` };
  const par = { jour: 'par jour', semaine: 'par semaine', mois: 'par mois', trimestre: 'par trimestre', annee: 'par an' }[periode];
  if (deja) {
    const { id, montant: avant, periode: pAvant } = deja;
    return { type: 'changer', texte: `Budget ${deja.nom} : ${fmtMontant(s.montant, f.devise)} ${par}.`, faire: (e) => changerFinances(e, (g) => ({ ...g, budgets: g.budgets.map((b) => (b.id === id ? { ...b, montant: s.montant, periode } : b)) })), defaire: (e) => changerFinances(e, (g) => ({ ...g, budgets: g.budgets.map((b) => (b.id === id ? { ...b, montant: avant, periode: pAvant } : b)) })) };
  }
  const b: Budget = { id: uid(), nom, emoji: '💰', montant: s.montant, periode };
  return { type: 'changer', texte: `Budget ${nom} créé : ${fmtMontant(s.montant, f.devise)} ${par}.`, faire: (e) => changerFinances(e, (g) => ({ ...g, budgets: [...g.budgets, b] })), defaire: (e) => changerFinances(e, (g) => ({ ...g, budgets: g.budgets.filter((x) => x.id !== b.id) })) };
}

/** Une dépense dictée qui nomme un poste du budget (« 260 € de billets ») ou un compte (« payé avec M-Pesa ») : on les range. */
export function enrichirDepense<P extends { budget: string | null; note: string; poste?: string; compte?: string }>(p: P, e: Espace, brut: string): P {
  const f = financesDe(e);
  const plans = f.budgets.filter((b) => (b.plan ?? []).length && (!p.budget || b.id === p.budget));
  let r = { ...p, note: noteNette(p.note) };
  for (const b of plans) {
    const poste = nomDansPhrase(b.plan ?? [], (x) => x.nom, `${p.note} ${brut}`);
    if (poste) {
      r = { ...r, budget: b.id, poste: poste.id };
      break;
    }
  }
  const compte = compteNomme(f, brut);
  if (compte) r = { ...r, compte: compte.id, note: r.note.replace(new RegExp(`\\s*(?:avec|sur|depuis|par)\\s+(?:le |la |mon |ma )?(?:compte |carte )?${compte.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '').trim() };
  return r;
}

/* ——— Questions ——— */

function reponseComptes(c: Contexte): Commande | null {
  const f = financesDe(c.e);
  const comptes = comptesDe(f);
  const vise = compteNomme(f, c.brut);
  // « Combien j'ai sur le livret », « Solde de mon compte », « Mes comptes » ; un budget ou un poste nommé n'est pas un compte.
  if (!/solde (?:de |du |sur )?(?:mon |le |mes )?comptes?|mes comptes|sur mes comptes|combien (?:j'ai|ai-je|il y a) (?:sur|dans) (?:le |mon |ma )?compte/.test(c.q) && !(vise && /combien|solde/.test(c.q))) return null;
  if (!comptes.length) return { type: 'reponse', texte: 'Tu n’as pas encore de compte. Ajoute-les dans Finances, onglet Comptes.' };
  const ops = [...f.depenses.map((x) => ({ id: x.id, sens: 'sortie' as const, date: x.date, montant: x.montant, compte: x.compte ?? null, lien: x.lien ?? null })), ...(f.revenus || []).map((x) => ({ id: x.id, sens: 'entree' as const, date: x.date, montant: x.montant, compte: x.compte ?? null, lien: x.lien ?? null }))];
  const resumes = resumerComptes(ops, comptes);
  const dire = (x: Compte) => {
    if (x.solde) return `${x.nom} : ${fmtMontant(x.solde.montant, x.solde.devise)} au dernier relevé (${fmtCourt(x.solde.date)})`;
    const r = resumes.find((y) => y.id === x.id);
    const net = r ? Math.round((r.entrees + r.virementsRecus - r.sorties - r.virementsEnvoyes) * 100) / 100 : 0;
    return `${x.nom} : ${net >= 0 ? '+' : ''}${fmtMontant(net, f.devise)} d'opérations notées`;
  };
  return { type: 'reponse', texte: vise ? `${dire(vise)}.` : `${liste(comptes.slice(0, 5).map(dire))}.` };
}

function reponsePostes(c: Contexte): Commande | null {
  if (!/combien|reste|ou en|depense/.test(c.q)) return null;
  const f = financesDe(c.e);
  for (const b of f.budgets) {
    const poste = nomDansPhrase(b.plan ?? [], (x) => x.nom, c.brut);
    if (!poste) continue;
    const bl = bilan(f, b.periode, c.d, c.d);
    const l = bl.lignes.find((x) => x.budget.id === b.id);
    const s = suiviPlan(b, bl.depenses.filter((x) => x.budget === b.id), l?.plafond ?? b.montant, c.d)?.postes.find((x) => x.poste.id === poste.id);
    if (!s) continue;
    return { type: 'reponse', texte: `${poste.nom} (budget ${b.nom}) : ${fmtMontant(s.depense, f.devise)} dépensés sur ${fmtMontant(s.prevu, f.devise)} prévus. ${s.reste < 0 ? `Dépassé de ${fmtMontant(-s.reste, f.devise)}.` : `Il reste ${fmtMontant(s.reste, f.devise)}.`}` };
  }
  return null;
}

function reponseObjectifs(c: Contexte): Commande | null {
  const f = financesDe(c.e);
  const objectifs = objectifsActifs(f);
  const o = nomDansPhrase(objectifs, (x) => x.nom, c.brut);
  if (!/objectif|epargne|de cote|economi/.test(c.q) && !(o && /ou en|combien|reste/.test(c.q))) return null;
  if (!objectifs.length) return { type: 'reponse', texte: 'Tu n’as pas encore d’objectif. Crée-le dans Finances, onglet Objectifs.' };
  if (o) {
    const s = suiviObjectif(o, c.d);
    if (s.atteint) return { type: 'reponse', texte: `${o.nom} : objectif atteint, ${fmtMontant(s.acquis, f.devise)} sur ${fmtMontant(o.cible, f.devise)}.` };
    return { type: 'reponse', texte: `${o.nom} : ${fmtMontant(s.acquis, f.devise)} sur ${fmtMontant(o.cible, f.devise)} (${Math.round(s.pct * 100)} %). Il reste ${fmtMontant(s.reste, f.devise)}, soit ${fmtMontant(s.versement, f.devise)} par ${s.cadence === 'semaine' ? 'semaine' : 'mois'} pour tenir le ${fmtCourt(o.echeance)}.` };
  }
  const r = resumeObjectifs(f, c.d);
  return { type: 'reponse', texte: `${n(r.nb, 'objectif', 'objectifs')} : ${fmtMontant(r.acquis, f.devise)} sur ${fmtMontant(r.cible, f.devise)} (${Math.round(r.pct * 100)} %)${r.enRetard ? `, ${n(r.enRetard, 'en retard', 'en retard')}` : ''}. Il faut mettre de côté ${fmtMontant(r.parMois, f.devise)} par mois.` };
}

function reponseRevenus(c: Contexte): Commande | null {
  const gagne = /combien (?:j'ai|ai-je) (?:gagne|recu|touche|encaisse)|mes revenus|(?:mon|le) salaire/.test(c.q);
  const solde = /(?:mon|le) solde|combien (?:j'ai|ai-je) (?:economise|mis de cote)|mon epargne/.test(c.q) && !/compte/.test(c.q);
  if (!gagne && !solde) return null;
  const f = financesDe(c.e);
  const vue: Periode = /semaine/.test(c.q) ? 'semaine' : /annee|cette annee/.test(c.q) ? 'annee' : 'mois';
  const m = bilan(f, vue, c.d, c.d);
  const rev = totalRevenus(revenusEntre(f, m.debut, m.fin));
  const quand = { jour: "aujourd'hui", semaine: 'cette semaine', mois: 'ce mois-ci', trimestre: 'ce trimestre', annee: 'cette année' }[vue];
  const net = Math.round((rev - m.total) * 100) / 100;
  if (gagne) return { type: 'reponse', texte: rev ? `Tu as reçu ${fmtMontant(rev, f.devise)} ${quand}. Avec ${fmtMontant(m.total, f.devise)} de dépenses, ton solde est de ${fmtMontant(net, f.devise)}.` : `Aucun revenu noté ${quand}. Dis par exemple « J’ai reçu 1 500 € de salaire ».` };
  return { type: 'reponse', texte: `${quand[0].toUpperCase()}${quand.slice(1)} : ${fmtMontant(rev, f.devise)} reçus, ${fmtMontant(m.total, f.devise)} dépensés. ${net >= 0 ? `Il te reste ${fmtMontant(net, f.devise)}.` : `Tu es à découvert de ${fmtMontant(-net, f.devise)}.`}` };
}

function reponseDernieres(c: Contexte): Commande | null {
  if (!/(?:mes |les )?(?:dernieres|derniers) (?:depenses|achats|operations)|(?:mes |les )?(?:derniers )?virements/.test(c.q)) return null;
  const f = financesDe(c.e);
  if (/virement/.test(c.q)) {
    const v = f.depenses.filter((x) => x.lien).slice(0, 3);
    return { type: 'reponse', texte: v.length ? `Derniers virements : ${liste(v.map((x) => `${fmtMontant(x.montant, f.devise)}, ${x.note}, ${quandDit(x.date, c.d)}`))}.` : 'Aucun virement noté entre tes comptes.' };
  }
  const l = [...f.depenses].filter((x) => !x.lien).sort((a, b) => b.date.localeCompare(a.date) || b.creeLe.localeCompare(a.creeLe)).slice(0, 3);
  return { type: 'reponse', texte: l.length ? `Tes dernières dépenses : ${liste(l.map((x) => `${fmtMontant(x.montant, f.devise)}${x.note ? ` ${x.note}` : ''}, ${quandDit(x.date, c.d)}`))}.` : 'Aucune dépense notée pour l’instant.' };
}

/** « Qu'est-ce que j'ai demain ? », « Mon agenda de lundi », « Mon prochain rendez-vous ». */
function reponseAgenda(c: Contexte): Commande | null {
  const prochain = /(?:mon |le )?prochain (?:rendez-vous|rdv|rendez vous|evenement)/.test(c.q);
  const jour = /(?:agenda|rendez-vous|rendez vous|rdv|reunions?|de prevu)|qu'est-ce que j'ai|qu'est ce que j'ai|j'ai quoi/.test(c.q) && !/a faire|taches|relances|mails?\b|budget|depense/.test(c.q);
  if (!prochain && !jour) return null;
  if (prochain) {
    for (let i = 0; i < 30; i++) {
      const j = addDays(c.d, i);
      const ev = [...(c.e.agenda[j] || [])].sort((a, b) => a.debut.localeCompare(b.debut));
      if (ev.length) return { type: 'reponse', texte: `Ton prochain rendez-vous : ${ev[0].titre}, ${quandDit(j, c.d)}${ev[0].debut ? ` à ${ev[0].debut.replace(':', ' h ')}` : ''}${ev[0].lieu ? `, ${ev[0].lieu}` : ''}.` };
    }
    return { type: 'reponse', texte: 'Aucun rendez-vous dans les 30 prochains jours.' };
  }
  const date = lireDate(c.brut, c.d).date ?? c.d;
  const ev = [...(c.e.agenda[date] || [])].sort((a, b) => a.debut.localeCompare(b.debut));
  const taches = c.e.taches.filter((t) => t.statut !== 'fait' && t.echeance === date);
  const relances = c.e.relances.filter((r) => r.statut === 'a_faire' && r.date === date);
  const quand = quandDit(date, c.d);
  const parties = [
    ev.length ? `${n(ev.length, 'rendez-vous', 'rendez-vous')} : ${liste(ev.slice(0, 5).map((x) => `${x.debut ? `à ${x.debut.replace(':', ' h ')}, ` : ''}${x.titre}`))}` : '',
    taches.length ? `${n(taches.length, 'tâche', 'tâches')} : ${liste(taches.slice(0, 4).map((t) => t.titre))}` : '',
    relances.length ? `${n(relances.length, 'relance', 'relances')} : ${liste(relances.slice(0, 4).map((r) => r.contact))}` : '',
  ].filter(Boolean);
  return { type: 'reponse', texte: parties.length ? `${majuscule(quand)}, ${parties.join('. ')}.` : `Rien de prévu ${quand}.` };
}

/** « Tâches de demain », « Tâches en retard », « Mes tâches de la semaine », « Relances en retard ». */
function reponseTachesDatees(c: Contexte): Commande | null {
  const m = /(taches|relances)\s+(?:en retard|de demain|pour demain|de la semaine|de cette semaine|cette semaine|d'aujourd'hui|du jour|de (?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche))/.exec(c.q);
  if (!m) return null;
  const retard = /en retard/.test(c.q);
  const semaine = /semaine/.test(c.q);
  const date = lireDate(c.brut, c.d).date ?? c.d;
  const dans = (x: string | null) => !!x && (retard ? x < c.d : semaine ? x >= c.d && x <= addDays(c.d, 6) : x === date);
  const quand = retard ? 'en retard' : semaine ? 'cette semaine' : quandDit(date, c.d);
  if (m[1] === 'relances') {
    const r = c.e.relances.filter((x) => x.statut === 'a_faire' && dans(x.date));
    return { type: 'reponse', texte: r.length ? `${n(r.length, 'relance', 'relances')} ${quand} : ${liste(r.slice(0, 5).map((x) => `${x.contact} pour ${x.sujet}`))}.` : `Aucune relance ${quand}.` };
  }
  const t = tachesActives(c.e, c.d).filter((x) => dans(x.echeance));
  return { type: 'reponse', texte: t.length ? `${n(t.length, 'tâche', 'tâches')} ${quand} : ${liste(t.slice(0, 5).map((x) => x.titre))}${t.length > 5 ? ', entre autres' : ''}.` : `Aucune tâche ${quand}.` };
}

/** « Ma série de sport », « Combien de jours de suite pour méditer ? ». */
function reponseSerie(c: Contexte): Commande | null {
  if (!/serie|de suite|d'affilee|streak/.test(c.q)) return null;
  const h = nomDansPhrase(c.e.habitudes, (x) => x.nom, c.brut) ?? meilleur(c.e.habitudes, (x) => x.nom, c.brut.replace(/^.*?(?:serie|suite|affil[ée]e)\s*(?:de |d'|du |pour |en )?/i, ''));
  if (!h) {
    const l = c.e.habitudes.map((x) => ({ x, s: streak(x, c.d) })).sort((a, b) => b.s - a.s).slice(0, 3);
    return { type: 'reponse', texte: l.length ? `Tes meilleures séries : ${liste(l.map((y) => `${y.x.nom}, ${y.s}`))}.` : 'Tu n’as pas encore d’habitude.' };
  }
  const s = streak(h, c.d);
  const unite = h.frequence === 'hebdo' ? 'semaine' : h.frequence === 'mensuel' ? 'mois' : 'jour';
  return { type: 'reponse', texte: `${h.nom} : ${s ? `${s} ${unite}${s > 1 && unite !== 'mois' ? 's' : ''} de suite` : 'pas de série en cours'}.${habitToday(h, c.d) && !doneIn(h, c.d) ? ' Pense à la faire aujourd’hui.' : ''}` };
}

const AIDE =
  'Je peux ajouter une tâche, une relance, une habitude, une dépense ou un revenu ; reporter, supprimer ou prioriser une tâche ; noter un virement entre tes comptes ou un versement sur un objectif ; te dire ce qu’il reste dans un budget, un poste ou un objectif ; lire ton agenda, tes mails (une boîte partagée, une étiquette), y répondre ou en écrire ; créer une relance depuis un mail ; planifier ta journée. Dis « Annule » pour défaire.';

/** Toutes les commandes de ce fichier, dans l'ordre où on les essaie. */
export function commandePlus(c: Contexte): Commande | null {
  if (/^(?:aide|help|qu'est-ce que tu (?:sais|peux) faire|qu'est ce que tu (?:sais|peux) faire|que (?:sais|peux)-tu faire|tu sais faire quoi|comment (?:ca marche|tu marches))\b/.test(c.q)) return { type: 'reponse', texte: AIDE };
  if (/^(?:bonjour|salut|coucou|hello|bonsoir)$/.test(c.q)) return { type: 'reponse', texte: 'Bonjour ! Que puis-je faire pour toi ? Dis « Aide » pour savoir ce que je sais faire.' };
  for (const f of [depuisMail, rattacher, relancerParMail, etatRelance, reporter, supprimer, prioriser, creerBudget, virement, revenu, verser]) {
    const r = f(c);
    if (r) return r;
  }
  return null;
}

/** Les questions de ce fichier, essayées avant les questions générales sur le budget, les tâches et les relances. */
export function questionPlus(c: Contexte): Commande | null {
  for (const f of [reponseTachesDatees, reponseAgenda, reponseComptes, reponseDernieres, reponseRevenus, reponseObjectifs, reponsePostes, reponseSerie]) {
    const r = f(c);
    if (r) return r;
  }
  return null;
}

