import type { Perimetre } from './copilote';
import { addDays } from './dates';
import { adresseEmail, type Mail } from './mails';

/**
 * Les demandes vocales sur les mails d'une personne, en une phrase : « Lis mes mails concernant Joseph Niandou et fais-moi un résumé
 * dessus », « Résume mes échanges avec Paul de cette semaine », « Qu'est-ce que Sophie m'a écrit ? ». On lit qui, sur quelle période,
 * et si un résumé est demandé ; la personne est retrouvée même quand la dictée écorche son nom (« Nian dou », « Niandu »).
 * Module pur : aucun appel réseau, tout se teste.
 */

export type DemandeMails = { qui: string; resume: boolean; depuis?: string; jusqua?: string };
export type Personne = { nom: string; adresse?: string };

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'");

const MAIL = "(?:e-?mails?|mails?|courriels?|messages?|echanges?|conversations?)";
// La phrase doit parler de lire, montrer ou résumer : « Ajoute une tâche lire les mails de Paul » reste une tâche.
const DEBUT = /^(?:lis|lire|lit|montre|affiche|donne|fais|fait|prepare|resume|resumer|synthetise|recapitule|ouvre|cherche|trouve|retrouve|regarde|consulte|parcours|analyse|qu'est-ce|qu'est ce|quels? sont|quoi de neuf|(?:mes|les|des|tous mes|tous les) )/;
const RESUME = /\b(?:resum\w*|synthes\w*|synthetis\w*|recap\w*|en bref|l'essentiel|les grandes lignes|de quoi (?:ils?|elles?|ca) parlen?t?)\b/;
// Ce qui relie les mails à la personne. Les liens longs d'abord : « de la part de » avant « de ».
const LIEN = "(?:que j'ai (?:recus?|echanges?) (?:avec |de |d')?|qui viennent (?:de |d')|de la part (?:de |d')|en provenance (?:de |d')|concernant|a propos (?:de |d')|au sujet (?:de |d')|en rapport avec|lies? a|avec|venant (?:de |d')|envoyes? par|recus? (?:de |d')|de|d'|du|sur)\\s*";
const PERSONNE = new RegExp(`\\b${MAIL}\\s+(?:non lus?\\s+|recents?\\s+)?${LIEN}(.+)$`);
// Ce qui suit la personne et n'en fait pas partie : la suite de la demande, la période.
const PERIODE =
  "(?:(?:de |du |des |sur |pour |depuis |durant |pendant |datant (?:de |d'|du ))?(?:cette semaine|la semaine (?:derniere|passee)|ce mois(?:-ci)?|(?:le )?mois (?:dernier|passe)|aujourd'hui|hier|cette annee|(?:les |ces )?\\d+ derniers? (?:jours?|semaines?|mois)|recents?|recemment))";
const FIN = new RegExp(`\\s+(?:et\\s+(?:puis\\s+)?(?:fais|fait|donne|dis|resume|redige|prepare|en|me|m'en|lis|montre)\\b|puis\\b|ensuite\\b|pour (?:me |m'en |en )|en (?:resume|bref)\\b|${PERIODE}|dessus\\b|non lus?\\b)`);
const TITRES = /^(?:monsieur|madame|mademoiselle|m\.?|mme|mr|le docteur|docteur|maitre)\s+/;

/** La période dite dans la phrase, en bornes AAAA-MM-JJ (aucune : toute la boîte). */
export function periodeDite(q: string, d: string): { depuis?: string; jusqua?: string } {
  if (/\baujourd'hui\b/.test(q)) return { depuis: d };
  if (/\bhier\b/.test(q)) return { depuis: addDays(d, -1), jusqua: addDays(d, -1) };
  if (/la semaine (?:derniere|passee)/.test(q)) return { depuis: addDays(d, -13), jusqua: addDays(d, -7) };
  if (/cette semaine/.test(q)) return { depuis: addDays(d, -6) };
  if (/mois (?:dernier|passe)/.test(q)) {
    const fin = addDays(`${d.slice(0, 7)}-01`, -1);
    return { depuis: `${fin.slice(0, 7)}-01`, jusqua: fin };
  }
  if (/ce mois/.test(q)) return { depuis: `${d.slice(0, 7)}-01` };
  if (/cette annee/.test(q)) return { depuis: `${d.slice(0, 4)}-01-01` };
  const n = /(\d+) derniers? (jours?|semaines?|mois)/.exec(q);
  if (n) {
    const k = Number(n[1]);
    const jours = n[2].startsWith('jour') ? k : n[2].startsWith('semaine') ? k * 7 : k * 30;
    return { depuis: addDays(d, -(Math.max(1, jours) - 1)) };
  }
  return {};
}

/**
 * Lit une demande sur les mails d'une personne. `q` : la phrase sans accents, en minuscules. Rien si la phrase ne parle pas
 * des mails d'une personne (« Lis mes mails » seul, « Écris un mail à Paul » restent aux autres commandes).
 */
export function lireDemandeMails(q: string, d: string): DemandeMails | null {
  const t = norm(q).replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  // « Qu'est-ce que Joseph m'a écrit ? » : un résumé ; « Est-ce que Joseph m'a écrit ? » : la liste.
  const ecrit = /^(?:(qu'est-ce que|qu'est ce que|que)|est-ce que|est ce que|est-ce qu'|est ce qu')\s*(.+?)\s+(?:m'a|m'ont)\s+(?:ecrit|envoye|repondu|dit|demande)\b/.exec(t);
  let qui: string | undefined;
  let resume = RESUME.test(t);
  if (ecrit) {
    qui = ecrit[2];
    resume = resume || !!ecrit[1];
  } else {
    if (!DEBUT.test(t)) return null;
    const p = PERSONNE.exec(t);
    if (!p) return null;
    qui = p[1];
  }
  qui = qui.split(FIN)[0].replace(TITRES, '').replace(/^(?:la |le |l')(?=\S)/, '').trim();
  // « Mes mails de la boîte ventes », « mes mails non lus » : pas une personne.
  if (!qui || /^(?:boite|etiquette|tag|libelle|dossier)\b/.test(qui) || /^(?:moi|nous|aujourd'hui|hier)$/.test(qui)) return null;
  return { qui, resume, ...periodeDite(t, d) };
}

const MOTS_VIDES = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'd', 'l', 'et', 'mon', 'ma', 'mes', 'son', 'sa', 'ses', 'monsieur', 'madame', 'mme', 'mr', 'ami', 'amie', 'client', 'cliente', 'collegue']);
const mots = (s: string) =>
  norm(s)
    .split(/[^a-z0-9]+/)
    .filter((x) => x.length > 1 && !MOTS_VIDES.has(x));

/** Distance d'édition (lettres ajoutées, retirées ou changées) : « niandu » est à 1 de « niandou ». */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 9;
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prec = cur;
  }
  return prec[b.length];
}
const tolere = (n: number) => (n >= 7 ? 2 : n >= 4 ? 1 : 0);
const proche = (dit: string, nom: string) => nom.startsWith(dit) || (dit.length >= 4 && dit.startsWith(nom) && nom.length >= 3) || distance(dit, nom) <= tolere(Math.min(dit.length, nom.length));

/** À quel point `qui` (ce qui a été dit) désigne cette personne : 0 (pas du tout) à 1 (tous les mots dits s'y retrouvent). */
export function correspondance(qui: string, p: Personne): number {
  const dits = mots(qui);
  const local = adresseEmail(p.adresse ?? '').replace(/@.*$/, '');
  const siens = [...new Set([...mots(p.nom), ...mots(local)])];
  if (!dits.length || !siens.length) return 0;
  const trouves = dits.filter((w) => siens.some((s) => proche(w, s))).length;
  if (trouves === dits.length) return 1;
  // La dictée coupe ou colle les noms : « Nian dou » pour « Niandou », « josephniandou » pour « Joseph Niandou ».
  const colle = dits.join('');
  const colles = [mots(p.nom).join(''), ...mots(p.nom), local.replace(/[^a-z0-9]/g, '')].filter((x) => x.length >= 4);
  if (colle.length >= 5 && colles.some((s) => s.includes(colle) || distance(colle, s) <= tolere(colle.length))) return 0.95;
  return trouves / dits.length;
}

/**
 * La personne dont on parle, parmi celles qui écrivent (ou à qui l'on écrit) et les contacts : tous les mots dits doivent
 * s'y retrouver, à une faute de dictée près. À égalité, celle avec qui l'on échange le plus.
 */
export function trouverPersonne(qui: string, mails: Pick<Mail, 'contact' | 'adresse'>[], contacts: { nom: string }[] = []): Personne | null {
  const parCle = new Map<string, Personne & { n: number }>();
  for (const m of mails) {
    const nom = (m.contact || adresseEmail(m.adresse ?? '')).trim();
    if (!nom) continue;
    const k = norm(nom);
    const x = parCle.get(k);
    if (x) x.n++;
    else parCle.set(k, { nom, ...(m.adresse ? { adresse: adresseEmail(m.adresse).toLowerCase() } : {}), n: 1 });
  }
  for (const c of contacts) if (c.nom?.trim() && !parCle.has(norm(c.nom))) parCle.set(norm(c.nom), { nom: c.nom.trim(), n: 0 });
  const notes = [...parCle.values()].map((p) => ({ p, s: correspondance(qui, p) })).filter((x) => x.s >= 0.95);
  notes.sort((a, b) => b.s - a.s || b.p.n - a.p.n);
  const best = notes[0]?.p;
  return best ? { nom: best.nom, ...(best.adresse ? { adresse: best.adresse } : {}) } : null;
}

const recent = (a: Mail, b: Mail) => `${b.date} ${b.heure ?? ''}`.localeCompare(`${a.date} ${a.heure ?? ''}`);
const dansPeriode = (m: Pick<Mail, 'date'>, p: { depuis?: string; jusqua?: string }) => (!p.depuis || m.date >= p.depuis) && (!p.jusqua || m.date <= p.jusqua);

/** Les mails échangés avec cette personne (reçus d'elle ou envoyés à elle), les plus récents d'abord. */
export function mailsDePersonne(mails: Mail[], p: Personne, periode: { depuis?: string; jusqua?: string } = {}): Mail[] {
  const nom = norm(p.nom);
  return mails.filter((m) => dansPeriode(m, periode) && ((!!m.contact && norm(m.contact) === nom) || (!!p.adresse && adresseEmail(m.adresse ?? '').toLowerCase() === p.adresse))).sort(recent);
}

/** Sans personne reconnue, « mes mails concernant le devis » : les mails dont l'objet ou le début parle de tous ces mots. */
export function mailsDuSujet(mails: Mail[], sujet: string, periode: { depuis?: string; jusqua?: string } = {}): Mail[] {
  const dits = mots(sujet);
  if (!dits.length) return [];
  return mails
    .filter((m) => {
      if (!dansPeriode(m, periode)) return false;
      const siens = mots(`${m.sujet} ${m.extrait ?? ''}`);
      return dits.every((w) => siens.some((s) => proche(w, s)));
    })
    .sort(recent);
}

/** La recherche à faire côté serveur pour retrouver aussi les mails plus anciens que la réception relue. */
export const perimetreVoix = (p: Personne | null, qui: string, periode: { depuis?: string; jusqua?: string }): Perimetre => ({ genre: 'personne', qui: p?.adresse ?? p?.nom ?? qui, ...periode });

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const quand = (date: string, d: string) =>
  date === d ? "aujourd'hui" : date === addDays(d, -1) ? 'hier' : `le ${Number(date.slice(8, 10))}${date.slice(8, 10) === '01' ? 'er' : ''} ${MOIS[Number(date.slice(5, 7)) - 1] ?? ''}`;
const nb = (k: number, un: string, plusieurs: string) => `${k} ${k > 1 ? plusieurs : un}`;

/**
 * Ce que la voix dit des mails d'une personne sans l'IA : combien, combien de non lus, et les derniers (quand, objet, début).
 * `nom` : la personne ou le sujet demandé.
 */
export function direMailsDe(nom: string, mails: Mail[], d: string, max = 4): string {
  if (!mails.length) return `Je ne trouve aucun mail concernant ${nom}.`;
  const tries = [...mails].sort(recent);
  const non = tries.filter((m) => m.nonLu).length;
  const tete = `${nb(tries.length, 'mail', 'mails')} concernant ${nom}${non ? `, dont ${nb(non, 'non lu', 'non lus')}` : ''}.`;
  const ligne = (m: Mail) => {
    const debut = (m.extrait ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    return `${majusculeDebut(quand(m.date, d))}${m.sens === 'envoye' ? ', tu as écrit' : ''} : ${m.sujet || 'sans objet'}${debut ? `. ${debut.replace(/[.…]*$/, '')}` : ''}.`;
  };
  return `${tete} ${tries.slice(0, max).map(ligne).join(' ')}${tries.length > max ? ` Et ${nb(tries.length - max, 'autre', 'autres')}.` : ''}`;
}
const majusculeDebut = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** La synthèse du copilote, à dire : la vue d'ensemble puis les constats, et combien de mails ont été lus. */
export function direSynthese(nom: string, r: { synthese: string; points: string[] }, total: number, lus: number): string {
  const sur = total > lus ? `J'ai lu les ${lus} plus récents de tes ${total} mails avec ${nom}.` : `J'ai lu ${lus > 1 ? `tes ${lus} mails` : 'ton mail'} avec ${nom}.`;
  const points = r.points.length ? ` À retenir : ${r.points.map((p) => p.replace(/[.\s]+$/, '')).join(' ; ')}.` : '';
  return `${sur} ${r.synthese}${points}`.trim();
}
