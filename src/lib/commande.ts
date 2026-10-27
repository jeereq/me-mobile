import type { Href } from 'expo-router';

import { addDays, doneIn, habitToday } from './dates';
import { bilan, financesDe, fmtMontant } from './finances';
import { lirePhrase, type Phrase } from './phrase';
import { tachesActives, tachesUrgentes } from './planning';
import { PAGES, sansAccents } from './recherche';
import type { Espace, Habitude, Periode, Relance, Tache } from './types';

/**
 * Commandes à la voix (ou tapées) : « Ajoute une dépense de 12 euros resto », « Combien il me reste en courses ? »,
 * « Ouvre les finances », « J'ai fini le devis », « Annule ». On reconnaît l'intention ; ajouter repose sur l'ajout
 * en une phrase (`phrase.ts`). Tout est local et instantané ; seules les vraies questions partent à l'IA, si elle est là.
 */
export type Cible = { genre: 'tache'; item: Tache } | { genre: 'habitude'; item: Habitude } | { genre: 'relance'; item: Relance };

export type Commande =
  | { type: 'ajout'; phrase: Phrase }
  | { type: 'aller'; href: Href; titre: string }
  | { type: 'cocher'; cible: Cible }
  | { type: 'journal'; texte: string }
  | { type: 'reponse'; texte: string }
  | { type: 'briefing' }
  | { type: 'plan' }
  | { type: 'question'; texte: string }
  | { type: 'annuler' }
  | { type: 'rien' };

const liste = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}` : l[0] ?? '');
const n = (k: number, un: string, plusieurs: string) => `${k} ${k > 1 ? plusieurs : un}`;
const DE_LA: Record<Periode, string> = { jour: "aujourd'hui", semaine: 'cette semaine', mois: 'ce mois-ci', trimestre: 'ce trimestre', annee: 'cette année' };

/** Mots qui comptent pour reconnaître une tâche ou un budget : sans accents, sans les petits mots, coupés à 5 lettres (« envoyé » ≈ « envoyer »). */
const VIDES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'l', 'a', 'au', 'aux', 'pour', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'et', 'en', 'avec', 'sur', 'j', 'ai', 'je', 'comme', 'fait', 'faite', 'fini', 'finie']);
const racines = (s: string) =>
  sansAccents(s)
    .split(/[^a-z0-9]+/)
    .filter((m) => m && !VIDES.has(m))
    .map((m) => m.slice(0, 5));

/** Part des mots cherchés présents dans `titre` (0 à 1) ; à égalité, le titre le plus court l'emporte. */
function ressemblance(cherche: string, titre: string) {
  const a = racines(cherche);
  const b = new Set(racines(titre));
  if (!a.length || !b.size) return 0;
  const trouves = a.filter((m) => b.has(m)).length;
  return trouves / a.length + trouves / b.size / 100;
}

function trouver(e: Espace, texte: string, d: string): Cible | null {
  const candidats: { c: Cible; nom: string }[] = [
    ...tachesActives(e, d).map((t) => ({ c: { genre: 'tache' as const, item: t }, nom: t.titre })),
    ...e.habitudes.filter((h) => habitToday(h, d) && !doneIn(h, d)).map((h) => ({ c: { genre: 'habitude' as const, item: h }, nom: h.nom })),
    ...e.relances.filter((r) => r.statut !== 'repondu').map((r) => ({ c: { genre: 'relance' as const, item: r }, nom: `${r.contact} ${r.sujet}` })),
  ];
  const meilleur = candidats.map((x) => ({ ...x, s: ressemblance(texte, x.nom) })).sort((a, b) => b.s - a.s)[0];
  return meilleur && meilleur.s >= 0.5 ? meilleur.c : null;
}

function reponseFinances(e: Espace, q: string, d: string): string {
  const f = financesDe(e);
  const b = f.budgets.filter((x) => !x.global).find((x) => racines(x.nom).some((m) => racines(q).includes(m)));
  if (b) {
    const l = bilan(f, b.periode, d, d).lignes.find((x) => x.budget.id === b.id);
    if (!l) return `Le budget ${b.nom} ne court pas en ce moment.`;
    const quand = DE_LA[b.periode];
    if (l.reste < 0) return `${b.nom} : ${fmtMontant(l.depense, f.devise)} dépensés ${quand}, le budget de ${fmtMontant(l.plafond, f.devise)} est dépassé de ${fmtMontant(-l.reste, f.devise)}.`;
    return `${b.nom} : ${fmtMontant(l.depense, f.devise)} dépensés ${quand} sur ${fmtMontant(l.plafond, f.devise)}. Il te reste ${fmtMontant(l.reste, f.devise)}.`;
  }
  const vue: Periode = /aujourd'?hui|ce jour/.test(q) ? 'jour' : /semaine/.test(q) ? 'semaine' : /annee/.test(q) ? 'annee' : 'mois';
  const m = bilan(f, vue, d, d);
  const depense = `Tu as dépensé ${fmtMontant(m.total, f.devise)} ${DE_LA[vue]}`;
  if (!m.plafondTotal) return `${depense}.${f.budgets.length ? '' : ' Crée un budget dans Finances pour savoir ce qu’il te reste.'}`;
  const reste = Math.round((m.plafondTotal - m.total) * 100) / 100;
  if (reste < 0) return `${depense}, soit ${fmtMontant(-reste, f.devise)} de plus que ton budget de ${fmtMontant(m.plafondTotal, f.devise)}.`;
  return `${depense} sur ${fmtMontant(m.plafondTotal, f.devise)}. Il te reste ${fmtMontant(reste, f.devise)}${m.parJour != null && vue !== 'jour' ? `, soit ${fmtMontant(m.parJour, f.devise)} par jour` : ''}.`;
}

function reponseTaches(e: Espace, d: string) {
  const t = tachesUrgentes(e, d, addDays(d, 2));
  if (!t.length) {
    const toutes = tachesActives(e, d).length;
    return toutes ? `Rien d'urgent. Il te reste ${n(toutes, 'tâche', 'tâches')} en attente.` : "Aucune tâche en attente. Profites-en !";
  }
  return `Tu as ${n(t.length, 'tâche urgente', 'tâches urgentes')} : ${liste(t.slice(0, 5).map((x) => x.titre))}${t.length > 5 ? ', entre autres' : ''}.`;
}

function reponseRelances(e: Espace, d: string) {
  const r = e.relances.filter((x) => x.statut === 'a_faire' && x.date <= d);
  return r.length ? `${n(r.length, 'relance', 'relances')} à faire : ${liste(r.slice(0, 5).map((x) => `${x.contact} pour ${x.sujet}`))}.` : 'Personne à relancer aujourd’hui.';
}

function reponseHabitudes(e: Espace, d: string) {
  const h = e.habitudes.filter((x) => habitToday(x, d) && !doneIn(x, d));
  return h.length ? `Encore ${n(h.length, 'habitude', 'habitudes')} aujourd'hui : ${liste(h.slice(0, 6).map((x) => x.nom))}.` : 'Toutes tes habitudes du jour sont faites, bravo.';
}

// Accents facultatifs dans les motifs écrits sur le texte d'origine (la reconnaissance vocale les met, le clavier pas toujours).
const AJOUT = /^\s*(?:(?:est-ce que tu peux|tu peux|peux-tu|peux tu)\s+)?(?:rappelle[- ]moi\s+d'|(?:ajoute[rz]?|rajoute[rz]?|cr[ée]{1,2}[erz]?|mets|nouvelle?|enregistre[rz]?|note[rz]?|rappelle[- ]moi(?:\s+de)?|il faut que je|je dois)\s+(?:moi\s+)?)(?:(?:une?|la|le|ma|mon|du|des)\s+)?(?:(t[âa]che|relance|habitude|d[ée]pense)s?\b\s*(?::|de\s+|d'|pour\s+)?)?/i;
const QUESTION = /^(qui|que|quoi|quel|quelle|quels|quelles|combien|quand|comment|pourquoi|ou|est-ce|est ce|qu'est|dis-moi|dis moi|explique|donne-moi|donne moi|conseille)\b|\?\s*$/;

/** Ce que l'app comprend d'une phrase dite ou tapée. `d` : aujourd'hui (AAAA-MM-JJ). */
export function comprendre(texte: string, e: Espace, d: string): Commande {
  // Les formules de politesse ne changent rien à la commande.
  const brut = texte
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[’`]/g, "'")
    .replace(/^(?:dis|ok|bon|alors|euh|hey|salut)(?=[ ,])[ ,]*/i, '')
    .replace(/[ ,]*(?:s'il te pla[iî]t|s'il vous pla[iî]t|stp|svp|merci)[ .!]*$/i, '')
    .replace(/[.!]+$/, '')
    .trim();
  const q = sansAccents(brut);
  if (!q) return { type: 'rien' };

  if (/^(?:annule|annuler|enleve ca|efface ca|supprime ca|retire ca|non annule)\b/.test(q)) return { type: 'annuler' };
  // « Planifie ma journée » demande un vrai plan à l'IA ; « ma journée » seul reste le briefing lu.
  if (/(?:planifi|organis|programm)\w*[\s-]+(?:moi[\s-]+)?(?:ma|la|mon)\s+(?:journee|jour)|plan (?:de|pour) (?:ma |la |aujourd'?hui)|plan du jour|(?:fais|prepare|propose)(?:-moi)? (?:un |le |mon )?plan|comment (?:m')?organiser ma journee/.test(q)) return { type: 'plan' };
  if (/briefing|resume de (?:ma|la) journee|programme du jour|ma journee|lis-moi ma journee/.test(q)) return { type: 'briefing' };

  // Dans le journal : « Note dans mon journal que le client a signé ». Lu sur le texte d'origine pour garder accents et majuscules.
  const jr = /^(?:note|[ée]cris|ajoute|mets)\s+(?:dans|au)\s+(?:mon |le )?journal\s*(?:que\s+|qu')?(.+)$/i.exec(brut) ?? /^(?:note|[ée]cris|ajoute|mets)\s+(.+?)\s+(?:dans|au)\s+(?:mon |le )?journal[.!]?$/i.exec(brut);
  if (jr) return { type: 'journal', texte: jr[1][0].toUpperCase() + jr[1].slice(1) };

  // Cocher : « J'ai fini le devis », « Marque sport comme fait », « Coche méditation ».
  // Après « j'ai », tout participe passé (« couru », « envoyé », « fini ») ; une dépense (« j'ai payé 12 € ») reste une dépense.
  const fait = /^(?:j'ai (?!depense|paye|achete)[a-z]+(?:e|i|u|it|is|ert)|marque|coche|termine|valide)\s+(.+?)(?:\s+comme\s+(?:fait|faite|termine|terminee|fini|finie))?$/.exec(q);
  if (fait) {
    const c = trouver(e, fait[1], d);
    if (c) return { type: 'cocher', cible: c };
    // « J'ai fait … » sans tâche qui corresponde : c'est une réussite à garder dans le journal.
    if (q.startsWith("j'ai ")) return { type: 'journal', texte: brut[0].toUpperCase() + brut.slice(1) };
    return { type: 'reponse', texte: `Je n'ai trouvé aucune tâche ni habitude qui ressemble à « ${fait[1]} ».` };
  }

  // Aller sur un écran : « Ouvre les finances », « Va dans mes projets ». « Montre mes tâches » répond plutôt à voix haute.
  const nav = /^(?:ouvre|ouvrir|va|aller|allons|emmene-moi|emmene moi|passe)\s+(?:(?:a|aux|dans|sur|vers|a la|au)\s+)?(?:(?:les|mes|la|le|l'|mon|ma|l')\s*)?(?:page |ecran |onglet )?(?:des |de |du |d')?(.+)$/.exec(q);
  if (nav) {
    const voulu = racines(nav[1]);
    const page = PAGES.find((p) => racines(p.titre).some((m) => voulu.includes(m))) ?? PAGES.find((p) => racines(`${p.titre} ${p.mots ?? ''}`).some((m) => voulu.includes(m)));
    if (page) return { type: 'aller', href: page.href, titre: page.titre };
  }

  // Questions qu'on sait traiter ici.
  if (/combien.*(?:reste|depense|budget|argent)|(?:mon|mes|le|les) budgets?\b|mes depenses|ou en (?:est|sont|suis)(?:-je)? .*(?:budget|depense|finance)|mes finances|reste.*(?:budget|depenser)/.test(q) && !AJOUT.test(brut)) return { type: 'reponse', texte: reponseFinances(e, q, d) };
  if (/(?:mes|les) taches|qu'est-ce que j'ai a faire|qu'est ce que j'ai a faire|quoi faire|j'ai quoi a faire|a faire aujourd'hui|c'est quoi le programme/.test(q) && !AJOUT.test(brut)) return { type: 'reponse', texte: reponseTaches(e, d) };
  if (/qui (?:dois-je|je dois|dois je|faut-il|il faut) relancer|(?:mes|les) relances/.test(q) && !AJOUT.test(brut)) return { type: 'reponse', texte: reponseRelances(e, d) };
  if (/(?:mes|les) habitudes/.test(q) && !AJOUT.test(brut)) return { type: 'reponse', texte: reponseHabitudes(e, d) };

  // Ajouter : on retire « Ajoute une tâche », « Rappelle-moi de »… et l'ajout en une phrase fait le reste.
  const a = AJOUT.exec(brut);
  if (a || !QUESTION.test(q)) {
    const genre = a?.[1] ? sansAccents(a[1]) : null;
    let reste = a ? brut.slice(a[0].length) : brut;
    if (genre === 'depense' && !/^\s*(?:j'ai\s+)?(?:d[ée]pens|pay|achat|achet)/i.test(reste)) reste = `dépensé ${reste}`;
    if (genre === 'relance' && !/^\s*(?:relancer|relance|recontacter|rappeler)\b/i.test(reste)) reste = `relancer ${reste}`;
    const p = lirePhrase(reste, d, financesDe(e).budgets);
    if (p) {
      // « Ajoute une habitude méditer » : sans fréquence dite, elle est quotidienne.
      if (genre === 'habitude' && p.genre === 'tache') return { type: 'ajout', phrase: { genre: 'habitude', titre: p.titre, frequence: 'quotidien', jour: null } };
      // Une tâche qui commence encore par « une dépense »… sans montant : rien de sûr, on demande de répéter.
      if (genre === 'depense' && p.genre !== 'depense') return { type: 'reponse', texte: 'Je n’ai pas entendu de montant. Dis par exemple : « 12 euros de courses ».' };
      return { type: 'ajout', phrase: p };
    }
  }
  return { type: 'question', texte: brut };
}

/** La phrase dite après un ajout : « C'est noté : tâche Envoyer le devis, pour le 30/10. » */
export function confirmerAjout(p: Phrase, devise: string, d: string, fmtDate: (s: string) => string): string {
  const quand = (s: string | null) => (!s ? '' : s === d ? ", pour aujourd'hui" : s === addDays(d, 1) ? ', pour demain' : `, pour le ${fmtDate(s)}`);
  if (p.genre === 'depense') return `C'est noté : ${fmtMontant(p.montant, p.devise ?? devise)}${p.note ? ` pour ${p.note}` : ''}.`;
  if (p.genre === 'relance') return `Relance de ${p.contact} ajoutée${quand(p.date)}.`;
  if (p.genre === 'habitude') return `Nouvelle habitude : ${p.titre}.`;
  return `Tâche ajoutée : ${p.titre}${quand(p.echeance)}${p.priorite === 'haute' ? ', importante' : ''}.`;
}
