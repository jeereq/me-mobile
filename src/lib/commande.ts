import type { Href } from 'expo-router';

import { addDays, doneIn, habitToday } from './dates';
import { bilan, financesDe, fmtMontant } from './finances';
import { boiteDuMail, destinataire, objetDepuisTexte, resumeMails, trouverMail, type Mail } from './mails';
import { lirePhrase, type Phrase } from './phrase';
import { tachesActives, tachesUrgentes } from './planning';
import { PAGES } from './recherche';
import type { Config, Espace, Habitude, Periode, Relance, Tache } from './types';
import { relanceAttendue } from './suivi';
import { commandePlus, enrichirDepense, questionPlus } from './commande-plus';
import { liste, majuscule, n, nettoyerDemande, nombresEnChiffres, ressemblance, racines, sansAccents } from './voix-texte';

/**
 * Commandes à la voix (ou tapées) : « Ajoute une dépense de 12 euros resto », « Combien il me reste en courses ? »,
 * « Ouvre les finances », « J'ai fini le devis », « Lis mes mails », « Réponds à Paul que c'est bon », « Annule ». On reconnaît l'intention ; ajouter repose sur l'ajout
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
  /** Ouvrir un mail et le lire à voix haute. */
  | { type: 'lireMail'; mail: Mail }
  /** Un nouveau mail prérempli, à vérifier avant l'envoi : `a` absent quand le contact n'a pas d'adresse connue. */
  | { type: 'ecrireMail'; a?: string; nom: string; sujet: string; texte: string }
  /** Une réponse préremplie, à vérifier avant l'envoi. */
  | { type: 'repondreMail'; mail: Mail; texte: string }
  /** Un changement de l'espace (reporter, supprimer, virement, revenu…) : `defaire` le reprend si on dit « Annule ». */
  | { type: 'changer'; texte: string; faire: (e: Espace) => Espace; defaire: (e: Espace) => Espace }
  /** « J'ai relancé Paul » (relancée, on attend la réponse) ou « Paul a répondu ». */
  | { type: 'statutRelance'; relance: Relance; statut: Relance['statut'] }
  | { type: 'annuler' }
  | { type: 'rien' };

const DE_LA: Record<Periode, string> = { jour: "aujourd'hui", semaine: 'cette semaine', mois: 'ce mois-ci', trimestre: 'ce trimestre', annee: 'cette année' };

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
  // Le reste : chaque budget sur sa période, moins les dépenses notées dedans (voir `bilan`).
  const reste = Math.round((m.plafondTotal - m.compte) * 100) / 100;
  if (reste < 0) return `${depense}. Tes budgets sont dépassés de ${fmtMontant(-reste, f.devise)} (${fmtMontant(m.compte, f.devise)} pour ${fmtMontant(m.plafondTotal, f.devise)}).`;
  return `${depense}. Sur tes budgets, ${fmtMontant(m.compte, f.devise)} notés pour ${fmtMontant(m.plafondTotal, f.devise)} : il te reste ${fmtMontant(reste, f.devise)}.`;
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
  const r = e.relances.filter((x) => relanceAttendue(x) && x.date <= d);
  return r.length ? `${n(r.length, 'relance', 'relances')} à faire : ${liste(r.slice(0, 5).map((x) => `${x.contact} pour ${x.sujet}`))}.` : 'Personne à relancer aujourd’hui.';
}

function reponseHabitudes(e: Espace, d: string) {
  const h = e.habitudes.filter((x) => habitToday(x, d) && !doneIn(x, d));
  return h.length ? `Encore ${n(h.length, 'habitude', 'habitudes')} aujourd'hui : ${liste(h.slice(0, 6).map((x) => x.nom))}.` : 'Toutes tes habitudes du jour sont faites, bravo.';
}

// Accents facultatifs dans les motifs écrits sur le texte d'origine (la reconnaissance vocale les met, le clavier pas toujours).
const AJOUT = /^\s*(?:(?:est-ce que tu peux|tu peux|peux-tu|peux tu)\s+)?(?:rappelle[- ]moi\s+d'|(?:ajoute[rz]?|rajoute[rz]?|cr[ée]{1,2}[erz]?|mets|nouvelle?|enregistre[rz]?|note[rz]?|rappelle[- ]moi(?:\s+de)?|il faut que je|je dois)\s+(?:moi\s+)?)(?:(?:une?|la|le|ma|mon|du|des)\s+)?(?:(t[âa]che|relance|habitude|d[ée]pense)s?\b\s*(?::|de\s+|d'|pour\s+)?)?/i;
const MAIL = "(?:e-?mails?|mails?|courriels?|messages?)";
// Ce qui sépare le destinataire du message dicté : « … à Paul pour lui dire que … », « … à Paul : … ».
const DIRE = /^(.+?)(?:\s*:\s*|\s+(?:pour (?:lui |leur )?(?:dire|annoncer|rappeler|demander)|en (?:lui )?disant|qui dit|disant|et dis[- ](?:lui|leur))\s+(?:que\s+|qu')?)(.*)$/i;
const REPONSE = /^(.+?)(?:\s*:\s*|\s+(?:que|qu')\s*|\s+(?:pour (?:lui |leur )?dire|en (?:lui )?disant)\s+(?:que\s+|qu')?)(.*)$/i;

/** Le mail : compter et lire les non lus, lire un mail, en écrire un, répondre. Rien ne part sans confirmation à l'écran. */
function commandeMail(brut: string, q: string, mails: Mail[]): Commande | null {
  // « Lis mon dernier mail », « Réponds au dernier mail que c'est bon » : le plus récent reçu, sans nommer personne.
  const recu = [...mails].filter((m) => m.sens !== 'envoye').sort((a, b) => `${b.date} ${b.heure ?? ''}`.localeCompare(`${a.date} ${a.heure ?? ''}`))[0];
  if (/^(?:lis|lire|lit|ouvre|montre)(?:-moi| moi)? (?:mon |le )dernier (?:e-?mail|mail|courriel|message)$/.test(q)) return recu ? { type: 'lireMail', mail: recu } : { type: 'reponse', texte: resumeMails(mails) };
  const dernier = /^(?:r[ée]ponds?|r[ée]pondre)\s+(?:au|à mon|a mon)\s+dernier\s+(?:e-?mail|mail|courriel|message)(?:\s*:\s*|\s+(?:que|qu')\s*|\s+(?:pour (?:lui |leur )?dire|en (?:lui )?disant)\s+(?:que\s+|qu')?)?(.*)$/i.exec(brut);
  if (dernier) return recu ? { type: 'repondreMail', mail: recu, texte: majuscule(dernier[1].trim()) } : { type: 'reponse', texte: 'Aucun mail reçu à qui répondre.' };
  const un = /^(?:lis|lire|lit|ouvre|montre)(?:-moi| moi)? (?:le |son |leur )?(?:dernier |nouveau )?(?:e-?mail|mail|courriel|message) (?:de |d'|du )(.+)$/.exec(q);
  if (un) {
    const m = trouverMail(mails, un[1]);
    return m ? { type: 'lireMail', mail: m } : { type: 'reponse', texte: `Je ne trouve pas de mail récent de ${majuscule(un[1])}.` };
  }
  // « Mails de la boîte ventes », « Lis la boîte partagée support » : les non lus de cette boîte seulement.
  const boite = /^(?:(?:lis|lire|lit|montre)(?:-moi| moi)? )?(?:(?:mes |les )?(?:e-?mails?|mails?|courriels?|messages?) (?:de|dans) )?la boite(?: partagee)? (?:de |du |des )?(.+)$/.exec(q);
  if (boite) {
    const cle = boite[1].replace(/\s+/g, '').replace(/@.*$/, '');
    const l = mails.filter((m) => (boiteDuMail(m) ?? '').toLowerCase().replace(/@.*$/, '').replace(/[._-]/g, '').includes(cle.replace(/[._-]/g, '')));
    return { type: 'reponse', texte: l.length ? `Boîte ${boiteDuMail(l[0])}. ${resumeMails(l)}` : `Je ne trouve pas de boîte « ${boite[1]} ». Ajoute une boîte partagée dans Agendas & outils.` };
  }
  // « Mails étiquetés facture », « Mes mails avec l'étiquette client ».
  const etiq = new RegExp(`^(?:(?:lis|montre)(?:-moi| moi)? )?(?:mes |les )?${MAIL} (?:etiquetes?|tagues?|avec (?:l'|le )?(?:etiquette|tag|libelle)|(?:de |dans )?(?:l'|le )?(?:etiquette|tag|libelle)) (.+)$`).exec(q);
  if (etiq) {
    const nom = etiq[1].trim();
    const sans = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const l = mails.filter((m) => (m.libelles ?? []).some((x) => sans(x) === nom));
    return { type: 'reponse', texte: l.length ? `Étiquette ${majuscule(nom)}. ${resumeMails(l)}` : `Aucun mail récent avec l'étiquette « ${nom} ».` };
  }
  if (new RegExp(`^(?:lis|lire|lit)(?:-moi| moi)? (?:mes |les )?(?:derniers |nouveaux )?${MAIL}(?: non lus)?$`).test(q)) return { type: 'reponse', texte: resumeMails(mails) };
  if (new RegExp(`^(?:combien (?:de |d')|est-ce que j'ai |est ce que j'ai |ai-je |j'ai (?:des |de nouveaux |recu des? ))(?:nouveaux )?${MAIL}\\b|^(?:mes|des) (?:nouveaux )?${MAIL}(?: non lus)?$`).test(q)) return { type: 'reponse', texte: resumeMails(mails) };

  const ecrire = /^(?:[ée]cris|[ée]crire|envoie|envoyer|r[ée]dige|pr[ée]pare)(?:[- ]moi)?\s+(?:un |une )?(?:nouveau )?(?:e-?mail|mail|courriel|message)\s+(?:à|a|au|pour)\s+(.+)$/i.exec(brut);
  if (ecrire) {
    const d = DIRE.exec(ecrire[1]);
    const qui = (d ? d[1] : ecrire[1]).trim();
    const texte = majuscule((d?.[2] ?? '').trim());
    const dest = destinataire(mails, qui);
    return { type: 'ecrireMail', a: dest?.adresse, nom: dest?.nom ?? qui, sujet: texte ? objetDepuisTexte(texte) : '', texte };
  }

  const rep = /^(?:r[ée]ponds?|r[ée]pondre)\s+(?:au (?:dernier )?(?:e-?mail|mail|message|courriel) (?:de |d')|à |a )(.+)$/i.exec(brut);
  if (rep) {
    const r = REPONSE.exec(rep[1]);
    const qui = (r ? r[1] : rep[1]).trim();
    const m = trouverMail(mails, qui);
    return m ? { type: 'repondreMail', mail: m, texte: majuscule((r?.[2] ?? '').trim()) } : { type: 'reponse', texte: `Je ne trouve pas de mail récent de ${qui} auquel répondre.` };
  }
  return null;
}

const QUESTION = /^(qui|que|quoi|quel|quelle|quels|quelles|combien|quand|comment|pourquoi|ou|est-ce|est ce|qu'est|dis-moi|dis moi|explique|donne-moi|donne moi|conseille)\b|\?\s*$/;

/** Ce que l'app comprend d'une phrase dite ou tapée. `d` : aujourd'hui (AAAA-MM-JJ) ; `mails` : les fils des boîtes connectées ; `config` : délais et modes par défaut. */
export function comprendre(texte: string, e: Espace, d: string, mails: Mail[] = [], config?: Pick<Config, 'delaiRelanceJours' | 'defauts'>): Commande {
  // Les formules de politesse ne changent rien à la commande ; les nombres dits en lettres deviennent des chiffres.
  const brut = nombresEnChiffres(nettoyerDemande(texte));
  const q = sansAccents(brut);
  if (!q) return { type: 'rien' };

  if (/^(?:annule|annuler|enleve ca|efface ca|supprime ca|retire ca|non annule)\b/.test(q)) return { type: 'annuler' };
  // « Planifie ma journée » demande un vrai plan à l'IA ; « ma journée » seul reste le briefing lu.
  if (/(?:planifi|organis|programm)\w*[\s-]+(?:moi[\s-]+)?(?:ma|la|mon)\s+(?:journee|jour)|plan (?:de|pour) (?:ma |la |aujourd'?hui)|plan du jour|(?:fais|prepare|propose)(?:-moi)? (?:un |le |mon )?plan|comment (?:m')?organiser ma journee/.test(q)) return { type: 'plan' };
  if (/briefing|resume de (?:ma|la) journee|programme du jour|ma journee|lis-moi ma journee/.test(q)) return { type: 'briefing' };

  // Dans le journal : « Note dans mon journal que le client a signé ». Lu sur le texte d'origine pour garder accents et majuscules.
  const jr = /^(?:note|[ée]cris|ajoute|mets)\s+(?:dans|au)\s+(?:mon |le )?journal\s*(?:que\s+|qu')?(.+)$/i.exec(brut) ?? /^(?:note|[ée]cris|ajoute|mets)\s+(.+?)\s+(?:dans|au)\s+(?:mon |le )?journal[.!]?$/i.exec(brut);
  if (jr) {
    const t = jr[1].replace(/^(?:que\s+|qu')/i, '');
    return { type: 'journal', texte: t[0].toUpperCase() + t.slice(1) };
  }

  const mail = commandeMail(brut, q, mails);
  if (mail) return mail;

  const ctx = { brut, q, e, d, mails, config };
  const plus = commandePlus(ctx);
  if (plus) return plus;

  // Cocher : « J'ai fini le devis », « Marque sport comme fait », « Coche méditation ».
  // Après « j'ai », tout participe passé (« couru », « envoyé », « fini ») ; une dépense (« j'ai payé 12 € ») reste une dépense.
  const fait = /^(?:j'ai (?!depense|paye|achete)[a-z]+(?:e|i|u|it|is|ert)|marque|coche|termine|valide)\s+(.+?)(?:\s+comme\s+(?:fait|faite|termine|terminee|fini|finie))?$/.exec(q);
  // « J'ai médité », « J'ai couru » : le verbe seul désigne l'habitude ou la tâche (« Méditer »).
  const seul = /^j'ai (?!depense|paye|achete)([a-z]+(?:e|i|u|it|is|ert))$/.exec(q);
  if (seul) {
    const c = trouver(e, seul[1], d);
    return c ? { type: 'cocher', cible: c } : { type: 'journal', texte: majuscule(brut) };
  }
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
  const question = questionPlus(ctx);
  if (question) return question;
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
      return { type: 'ajout', phrase: p.genre === 'depense' ? enrichirDepense(p, e, brut) : p };
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
