import type { Href } from 'expo-router';

import type { Commande } from './commande';
import { parse, uid } from './dates';
import { creerTache, etatProjet, planifier, prochainesTaches, replanifier, supprimerTaches, tachesDuProjet, type LignePlan } from './planning';
import type { Config, Espace, Projet, Tache } from './types';
import { majuscule, meilleur, n, nomDansPhrase } from './voix-texte';

/**
 * Les projets à la voix : « Où en est le projet Cybersécurité ? », « Lis-moi le projet Site web », « Mes projets », « Qu'est-ce qui est en retard
 * dans mes projets ? », « Ouvre le projet Déménagement », « Crée un projet Rentrée », « Ajoute la tâche appeler Paul au projet Site web ».
 * Les réponses viennent des vrais projets, jamais de l'IA. Module pur : se teste avec `npm test`.
 */

type Ctx = { brut: string; q: string; e: Espace; d: string; config?: Pick<Config, 'defauts'>; /** Faux sans la formule Projets : créer, ajouter et ouvrir restent possibles, pas la lecture à voix haute. */ avance?: boolean };

const RESERVE_LECTURE = 'Écouter l’état d’un projet fait partie de Me Projets, ou de Pro. Tu peux voir les offres dans Mon compte, Abonnement.';

const dateDite = (s: string) => parse(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const actifs = (e: Espace) => (e.projets ?? []).filter((p) => !p.archive);
const quand = (fin: string, d: string) => {
  const k = Math.round((parse(fin).getTime() - parse(d).getTime()) / 864e5);
  return k === 0 ? "aujourd'hui" : k === 1 ? 'demain' : k > 0 ? `dans ${k} jours` : `il y a ${-k} jours`;
};
const nomsDits = (xs: string[], max = 4) => {
  const l = [...new Set(xs)];
  return l.length > max ? `${l.slice(0, max).join(' ; ')} ; et ${l.length - max} autre${l.length - max > 1 ? 's' : ''}` : l.join(' ; ');
};

/** Un extrait de la phrase sans accents (`q`), repris dans la phrase d'origine pour garder accents et majuscules. */
const original = (brut: string, q: string, extrait: string) => {
  const i = q.indexOf(extrait);
  return brut.length === q.length && i >= 0 ? brut.slice(i, i + extrait.length).trim() : extrait.trim();
};

/** Le projet dont parle la phrase : son nom tel quel, sinon le plus ressemblant à ce qui suit « projet ». */
export function projetDit(e: Espace, q: string): Projet | null {
  const ps = actifs(e);
  const tel = nomDansPhrase(ps, (p) => p.nom, q);
  if (tel) return tel;
  const apres = /\bprojets?\s+(?:(?:de|du|des|d'|la|le|les|l')\s*)?(.+)$/.exec(q)?.[1];
  return apres ? meilleur(ps, (p) => p.nom, apres) : null;
}

/* ---------- Ce que l'on dit ---------- */

type LigneDite = { tache: Tache; ligne: LignePlan };
const lignesOuvertes = (e: Espace, p: Projet, d: string): LigneDite[] => {
  const mine = tachesDuProjet(e.taches, p.id);
  const plan = planifier(mine, p, d);
  return mine.flatMap((tache) => {
    const ligne = plan.lignes.get(tache.id);
    return ligne && !ligne.resume && !ligne.fait ? [{ tache, ligne }] : [];
  });
};
const enRetard = (l: LigneDite, d: string) => !l.ligne.jalon && l.ligne.fin < d;
const qui = (t: Tache) => t.responsable?.trim();
const dire = (l: LigneDite) => `${l.tache.titre}${qui(l.tache) ? `, ${qui(l.tache)}` : ''}`;

/** Un projet à voix haute. `detaille` (« lis-moi le projet ») ajoute les retards, les prochaines tâches et ce qui n'a pas de responsable. */
export function direProjet(e: Espace, p: Projet, d: string, detaille = false): string {
  const etat = etatProjet(e.taches, p, d);
  if (!etat.nbTaches) return `Le projet ${p.nom} n'a pas encore de tâche.`;
  const reste = etat.nbTaches - etat.nbFaites;
  const out = [`Le projet ${p.nom} est avancé à ${etat.plan.avancement} pour cent : ${n(etat.nbFaites, 'tâche faite', 'tâches faites')} sur ${etat.nbTaches}.`];
  if (!reste) return `Le projet ${p.nom} est terminé : les ${etat.nbTaches} tâches sont faites.`;
  if (etat.fin) out.push(`La fin est prévue le ${dateDite(etat.fin)}, ${quand(etat.fin, d)}.`);
  const ouvertes = lignesOuvertes(e, p, d);
  const retard = ouvertes.filter((l) => enRetard(l, d)).sort((a, b) => a.ligne.fin.localeCompare(b.ligne.fin));
  out.push(retard.length ? `${n(retard.length, 'tâche est en retard', 'tâches sont en retard')}.` : 'Aucune tâche en retard.');
  if (!detaille) return out.join(' ');
  if (retard.length) out.push(`En retard : ${nomsDits(retard.map(dire), 5)}.`);
  const suivantes = prochainesTaches(e.taches, p, d, 3).filter((x) => !enRetard(x, d));
  if (suivantes.length) out.push(`À faire ensuite : ${nomsDits(suivantes.map(dire), 3)}.`);
  const critiques = ouvertes.filter((l) => l.ligne.critique && !enRetard(l, d));
  if (critiques.length) out.push(`${n(critiques.length, 'tâche est sur la voie critique', 'tâches sont sur la voie critique')} : tout retard décale la fin.`);
  const sans = ouvertes.filter((l) => !qui(l.tache) && !l.tache.affecteA).length;
  if (sans && ouvertes.some((l) => qui(l.tache))) out.push(`${n(sans, 'tâche n\'a pas de responsable', 'tâches n\'ont pas de responsable')}.`);
  return out.join(' ');
}

/** Tous les projets en cours : combien, lesquels sont en retard, et le plus proche à finir. */
export function direProjets(e: Espace, d: string): string {
  const ps = actifs(e).map((p) => ({ p, etat: etatProjet(e.taches, p, d) }));
  if (!ps.length) return "Tu n'as pas encore de projet. Dis par exemple « Crée un projet Rentrée ».";
  const encours = ps.filter(({ etat }) => etat.nbTaches > etat.nbFaites);
  const out = [`Tu as ${n(ps.length, 'projet', 'projets')}, dont ${encours.length} en cours.`];
  const retard = encours.filter(({ etat }) => etat.enRetard);
  out.push(retard.length ? `En retard : ${nomsDits(retard.map(({ p, etat }) => `${p.nom} (${n(etat.enRetard, 'tâche', 'tâches')})`), 5)}.` : 'Aucun projet en retard.');
  const prochain = encours.filter(({ etat }) => etat.fin && etat.fin >= d).sort((a, b) => a.etat.fin!.localeCompare(b.etat.fin!))[0];
  if (prochain) out.push(`Le prochain à finir est ${prochain.p.nom}, le ${dateDite(prochain.etat.fin!)}.`);
  return out.join(' ');
}

/** Les tâches en retard d'un projet, ou de tous. */
export function direRetards(e: Espace, d: string, p?: Projet | null): string {
  const ps = p ? [p] : actifs(e);
  const lignes = ps.flatMap((x) => lignesOuvertes(e, x, d).filter((l) => enRetard(l, d)).map((l) => ({ ...l, projet: x })));
  if (!lignes.length) return p ? `Aucune tâche en retard dans le projet ${p.nom}.` : 'Aucune tâche en retard dans tes projets.';
  lignes.sort((a, b) => a.ligne.fin.localeCompare(b.ligne.fin));
  const dites = lignes.slice(0, 6).map((l) => `${l.tache.titre}${p ? '' : `, projet ${l.projet.nom}`}${qui(l.tache) ? `, ${qui(l.tache)}` : ''}, prévue le ${dateDite(l.ligne.fin)}`);
  return `${n(lignes.length, 'tâche est en retard', 'tâches sont en retard')}${p ? ` dans le projet ${p.nom}` : ''} : ${dites.join(' ; ')}${lignes.length > 6 ? ` ; et ${lignes.length - 6} autres` : ''}.`;
}

/** Qui a quoi à faire dans un projet. */
export function direResponsables(e: Espace, p: Projet, d: string): string {
  const par = new Map<string, number>();
  let sans = 0;
  for (const l of lignesOuvertes(e, p, d)) {
    const noms = (qui(l.tache) ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!noms.length) sans++;
    for (const nom of noms) par.set(nom, (par.get(nom) ?? 0) + 1);
  }
  if (!par.size) return sans ? `Personne n'est responsable dans le projet ${p.nom} : ${n(sans, 'tâche reste', 'tâches restent')} sans responsable.` : `Il ne reste rien à faire dans le projet ${p.nom}.`;
  const dits = [...par].sort((a, b) => b[1] - a[1]).map(([nom, k]) => `${nom}, ${n(k, 'tâche', 'tâches')}`);
  return `Dans le projet ${p.nom} : ${dits.join(' ; ')}.${sans ? ` ${n(sans, 'tâche reste', 'tâches restent')} sans responsable.` : ''}`;
}

/** Ce qui reste à faire d'un projet, dans l'ordre. */
export function direReste(e: Espace, p: Projet, d: string): string {
  const suivantes = prochainesTaches(e.taches, p, d, 5);
  if (!suivantes.length) return lignesOuvertes(e, p, d).length ? `Dans le projet ${p.nom}, tout ce qui reste attend une autre tâche.` : `Il ne reste rien à faire dans le projet ${p.nom}.`;
  return `Dans le projet ${p.nom}, à faire : ${suivantes.map((x) => `${x.tache.titre}, pour le ${dateDite(x.ligne.fin)}`).join(' ; ')}.`;
}

/* ---------- Reconnaître la phrase ---------- */

const AJOUTER = '(?:ajoute|ajouter|rajoute|rajouter|cree|creer|mets|mettre)';
const LIRE = /\b(?:lis|lit|lire|raconte|presente|parle|detaille)\b/;
const POINT = /\b(?:ou en est|ou en est-on|ou on en est|etat|point|statut|avancement|resume|resumer|bilan|dis-moi|donne-moi|montre-moi)\b/;
const ECARTE = /\b(?:mails?|e-mails?|courriels?|budgets?|depenses?|cotisations?|tontines?)\b/;

/** Une commande sur les projets, ou null si la phrase n'en parle pas. */
export function commandeProjet({ brut, q: qBrut, e, d, config, avance = true }: Ctx): Commande | null {
  const lecture = (texte: string): Commande => ({ type: 'reponse', texte: avance ? texte : RESERVE_LECTURE });
  // Sans la ponctuation de fin ; `brut` suit pour garder accents et majuscules.
  const q = qBrut.replace(/[?.!\s]+$/, '');
  const brutSansPonct = brut.replace(/[?.!\s]+$/, '');
  const mot = /\bprojets?\b/.test(q);
  if (ECARTE.test(q) || (!mot && !actifs(e).length)) return null;

  // Créer : « Crée un projet Rentrée scolaire ».
  const creer = /^(?:cree|creer|ajoute|ajouter|nouveau|lance|lancer|demarre|demarrer|ouvre un nouveau)\s+(?:un |le |mon )?(?:nouveau )?projet\s+(?:(?:appele|nomme|qui s'appelle|intitule)\s+)?(.+)$/.exec(q);
  if (creer) {
    const nom = majuscule(original(brutSansPonct, q, creer[1]));
    if (nom.length < 2) return { type: 'reponse', texte: 'Quel nom veux-tu donner au projet ?' };
    if (actifs(e).some((p) => p.nom.trim().toLowerCase() === nom.toLowerCase())) return { type: 'reponse', texte: `Le projet ${nom} existe déjà.` };
    const projet: Projet = { id: uid(), nom, emoji: '📁', debut: d, joursOuvres: true, creeLe: new Date().toISOString() };
    return {
      type: 'changer',
      texte: `C'est fait : le projet ${nom} est créé. Dis « Ajoute la tâche… au projet ${nom} » pour le remplir.`,
      faire: (x) => ({ ...x, projets: [...(x.projets ?? []), projet] }),
      defaire: (x) => ({ ...x, projets: (x.projets ?? []).filter((p) => p.id !== projet.id), taches: x.taches.filter((t) => t.projet !== projet.id) }),
    };
  }

  if (!mot) {
    // « Où en est Cybersécurité ? » sans le mot « projet » : seulement quand le nom d'un projet est dit tel quel.
    const nom = /^(?:ou en est|ou en est-on|ou on en est|ou en sommes-nous)\b/.test(q) ? nomDansPhrase(actifs(e), (p) => p.nom, q) : null;
    return nom ? lecture(direProjet(e, nom, d)) : null;
  }

  // Ajouter une tâche : « Ajoute la tâche appeler Paul au projet Site web », « Dans le projet Site web, ajoute la maquette ».
  const formes: { re: RegExp; tache: number; projet: number }[] = [
    { re: new RegExp(`^${AJOUTER}\\s+(?:une |la |une nouvelle )?(?:tache\\s+)?(.+?)\\s+(?:au|dans le|dans|sur le|pour le|dans mon|a mon)\\s+projet\\s+(.+)$`), tache: 1, projet: 2 },
    { re: new RegExp(`^(?:dans|sur|pour|au)\\s+(?:le |mon )?projet\\s+(.+?),?\\s+${AJOUTER}\\s+(?:une |la |une nouvelle )?(?:tache\\s+)?(.+)$`), tache: 2, projet: 1 },
    { re: new RegExp(`^${AJOUTER}\\s+(?:au|dans le|dans)\\s+projet\\s+(.+?)\\s+(?:une |la |une nouvelle )?tache\\s+(.+)$`), tache: 2, projet: 1 },
  ];
  for (const f of formes) {
    const m = f.re.exec(q);
    if (!m) continue;
    const projet = meilleur(actifs(e), (p) => p.nom, m[f.projet]) ?? nomDansPhrase(actifs(e), (p) => p.nom, m[f.projet]);
    if (!projet) return { type: 'reponse', texte: `Je ne trouve pas le projet ${original(brutSansPonct, q, m[f.projet])}. Dis « Mes projets » pour les entendre.` };
    const t = majuscule(original(brutSansPonct, q, m[f.tache]));
    const id = uid();
    const base = { source: 'manuel' as const, priorite: 'moyenne' as const, mode: config?.defauts.tache ?? 'passif' };
    return {
      type: 'changer',
      texte: `C'est ajouté au projet ${projet.nom} : ${t}.`,
      faire: (x) => ({ ...x, taches: replanifier(creerTache(x.taches, base, { id, titre: t, projet: projet.id, duree: 1 }), projet, d) }),
      defaire: (x) => ({ ...x, taches: replanifier(supprimerTaches(x.taches, [id]), projet, d) }),
    };
  }

  const projet = projetDit(e, q);

  // Ouvrir : « Ouvre le projet Site web ».
  if (/^(?:ouvre|ouvrir|va|aller|allons|emmene-moi|emmene moi|montre|affiche|passe)\b/.test(q)) {
    if (projet) return { type: 'aller', href: { pathname: '/projets', params: { id: projet.id } } as Href, titre: `le projet ${projet.nom}` };
    return null;
  }

  // Les retards : « Qu'est-ce qui est en retard dans le projet X », « Quelles tâches sont en retard dans mes projets ».
  if (/\ben retard\b|\bretards?\b/.test(q)) return lecture(direRetards(e, d, projet));

  // Qui fait quoi : « Qui est responsable dans le projet X ? ».
  if (projet && /\bresponsables?\b|qui s'occupe|qui travaille|qui fait quoi/.test(q)) return lecture(direResponsables(e, projet, d));

  // Ce qui reste : « Que reste-t-il à faire dans le projet X », « Les prochaines tâches du projet X ».
  if (projet && /\b(?:reste|restent|prochaines?|a faire|suite)\b/.test(q)) return lecture(direReste(e, projet, d));

  // Lire ou résumer un projet, ou tous.
  if (LIRE.test(q) || POINT.test(q) || /^(?:mes |les )?projets?$|\b(?:mes|les) projets\b|^quel(?:s|le|les)? (?:est|sont)\b/.test(q)) {
    if (projet) return lecture(direProjet(e, projet, d, LIRE.test(q) || /detail/.test(q)));
    if (/\b(?:mes|les|tous mes|tous les) projets\b|^projets$/.test(q) || /combien de projets/.test(q)) return lecture(direProjets(e, d));
    return lecture(`Je ne trouve pas ce projet. ${direProjets(e, d)}`);
  }
  return projet && /^(?:le |mon )?projet\b/.test(q) ? lecture(direProjet(e, projet, d)) : null;
}
