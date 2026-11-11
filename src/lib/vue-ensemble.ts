/**
 * La vue d'ensemble des projets : les tâches de tous les projets filtrées d'un coup, regroupées par projet, puis par responsable,
 * et le mail à écrire à un responsable. Module pur : il se teste avec `npm test`.
 */
import { responsablesDe } from './equipe-taches';
import type { MembreEquipe } from './equipes';
import { CRITERES_VIDES, nbCriteres, tachesVisibles, type Criteres, type StatutFiltre } from './filtres-taches';
import { adresseEmail, type Mail } from './mails';
import { trouverPersonne } from './mails-voix';
import type { LignePlan, Plan } from './planning';
import type { Projet, Tache } from './types';

export type Entree = { projet: Projet; plan: Plan; taches: Tache[] };
export type LigneEnsemble = { projet: Projet; tache: Tache; ligne: LignePlan };
export type GroupeEnsemble = { projet: Projet; plan: Plan; nbTaches: number; nbFaites: number; enRetard: number; lignes: LigneEnsemble[] };

/** À l'ouverture, on ne montre que ce qui reste à faire. */
export const CRITERES_ENSEMBLE: Criteres = { ...CRITERES_VIDES, statut: 'afaire' };

export type Ensemble = {
  groupes: GroupeEnsemble[];
  /** Toutes les tâches qui passent les filtres, dans tous les projets montrés. */
  nbTaches: number;
  nbEnRetard: number;
  comptes: Record<StatutFiltre, number>;
};

const feuille = (e: Entree, t: Tache) => {
  const l = e.plan.lignes.get(t.id);
  return l && !l.resume ? l : null;
};

/** Les projets (un seul si `projetId`) avec leurs tâches qui passent les filtres ; les projets sans tâche correspondante s'effacent dès qu'un filtre est posé. */
export function vueEnsemble(entrees: Entree[], c: Criteres, x: { aujourdhui: string; membres: MembreEquipe[]; moiId?: string; projetId?: string | null }): Ensemble {
  const comptes: Record<StatutFiltre, number> = { toutes: 0, afaire: 0, retard: 0, critique: 0, jalons: 0, faites: 0 };
  const groupes: GroupeEnsemble[] = [];
  let nbTaches = 0;
  let nbEnRetard = 0;
  for (const e of entrees) {
    if (x.projetId && e.projet.id !== x.projetId) continue;
    const toutes = e.taches.flatMap((t) => {
      const l = feuille(e, t);
      return l ? [{ t, l }] : [];
    });
    for (const { l } of toutes) {
      comptes.toutes++;
      if (l.fait) comptes.faites++;
      else {
        comptes.afaire++;
        if (l.fin < x.aujourdhui) comptes.retard++;
        if (l.critique) comptes.critique++;
      }
      if (l.jalon) comptes.jalons++;
    }
    const visibles = tachesVisibles(e.taches, e.plan, c, x);
    const lignes = toutes.filter(({ t }) => !visibles || visibles.has(t.id)).map(({ t, l }) => ({ projet: e.projet, tache: t, ligne: l }));
    // Les tâches en retard d'abord, puis par date de fin.
    lignes.sort((a, b) => Number(!enRetard(a, x.aujourdhui)) - Number(!enRetard(b, x.aujourdhui)) || a.ligne.fin.localeCompare(b.ligne.fin));
    if (nbCriteres(c) && !lignes.length) continue;
    nbTaches += lignes.length;
    nbEnRetard += lignes.filter((l) => enRetard(l, x.aujourdhui)).length;
    groupes.push({ projet: e.projet, plan: e.plan, nbTaches: toutes.length, nbFaites: toutes.filter(({ l }) => l.fait).length, enRetard: toutes.filter(({ l }) => !l.fait && l.fin < x.aujourdhui).length, lignes });
  }
  // Les projets où il y a le plus de retard d'abord.
  groupes.sort((a, b) => b.enRetard - a.enRetard || a.projet.nom.localeCompare(b.projet.nom));
  return { groupes, nbTaches, nbEnRetard, comptes };
}

export const enRetard = (l: LigneEnsemble, aujourdhui: string) => !l.ligne.fait && !l.ligne.jalon && l.ligne.fin < aujourdhui;

/* ---------- Responsables ---------- */

export type ResponsableEnsemble = {
  cle: string;
  nom: string;
  membre: MembreEquipe | null;
  moi: boolean;
  /** Ses tâches pas faites parmi celles qui passent les filtres, en retard d'abord. */
  lignes: LigneEnsemble[];
  enRetard: number;
};

const cleNom = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Qui a quoi à faire : un responsable par membre ou par nom écrit à la main ; une tâche à plusieurs responsables compte pour chacun. Ceux qui ont le plus de retard d'abord. */
export function responsablesEnsemble(groupes: GroupeEnsemble[], membres: MembreEquipe[], aujourdhui: string, moiId?: string): { responsables: ResponsableEnsemble[]; sansResponsable: number } {
  const par = new Map<string, ResponsableEnsemble>();
  let sans = 0;
  for (const g of groupes)
    for (const l of g.lignes) {
      if (l.ligne.fait) continue;
      const rs = responsablesDe(l.tache, membres, moiId);
      if (!rs.length) {
        sans++;
        continue;
      }
      for (const r of rs) {
        const cle = r.membre ? `m:${r.membre.id}` : `n:${cleNom(r.nom)}`;
        const x = par.get(cle) ?? { cle, nom: r.nom, membre: r.membre, moi: r.moi, lignes: [], enRetard: 0 };
        x.lignes.push(l);
        if (enRetard(l, aujourdhui)) x.enRetard++;
        par.set(cle, x);
      }
    }
  return { responsables: [...par.values()].sort((a, b) => b.enRetard - a.enRetard || b.lignes.length - a.lignes.length || a.nom.localeCompare(b.nom)), sansResponsable: sans };
}

/* ---------- Le mail ---------- */

const dateFr = (d: string) => d.split('-').reverse().join('/');
const MAX_LIGNES_MAIL = 25;

/** L'adresse d'un responsable : celle du membre de l'équipe, sinon celle d'une personne de ce nom parmi les mails des comptes connectés. */
export function adresseDe(r: Pick<ResponsableEnsemble, 'nom' | 'membre'>, mails: Pick<Mail, 'contact' | 'adresse'>[], contacts: { nom: string }[] = []): string | null {
  if (r.membre?.email) return r.membre.email;
  const p = trouverPersonne(r.nom, mails, contacts);
  const a = adresseEmail(p?.adresse ?? '');
  return a.includes('@') ? a : null;
}

/**
 * Le brouillon du mail à un responsable : ses tâches en retard puis celles à venir, avec leur projet et leur date.
 * Rien ne part sans « Oui, envoyer » dans l'écriture d'un mail.
 */
export function brouillonMailResponsable(r: Pick<ResponsableEnsemble, 'nom' | 'lignes'>, o: { aujourdhui: string; adresse?: string | null }) {
  const retard = r.lignes.filter((l) => enRetard(l, o.aujourdhui));
  const suite = r.lignes.filter((l) => !enRetard(l, o.aujourdhui));
  let reste = MAX_LIGNES_MAIL;
  const bloc = (titre: string, ls: LigneEnsemble[], date: (l: LigneEnsemble) => string) => {
    const prises = ls.slice(0, Math.max(0, reste));
    reste -= prises.length;
    if (!prises.length) return '';
    const plus = ls.length - prises.length;
    return `${titre}\n${prises.map((l) => `• ${l.projet.nom} : ${l.tache.titre} (${date(l)})`).join('\n')}${plus > 0 ? `\n• … et ${plus} autre${plus > 1 ? 's' : ''}` : ''}\n\n`;
  };
  const prenom = r.nom.replace(/@.*$/, '').trim().split(/\s+/)[0];
  const corps = bloc('En retard', retard, (l) => `prévue le ${dateFr(l.ligne.fin)}`) + bloc('À faire', suite, (l) => `pour le ${dateFr(l.ligne.fin)}`);
  const n = r.lignes.length;
  return {
    ...(o.adresse ? { a: o.adresse } : { nom: r.nom }),
    sujet: retard.length ? `Tes tâches en retard (${retard.length})` : `Tes tâches à venir (${n})`,
    texte: `Bonjour${prenom ? ` ${prenom}` : ''},\n\nVoici où en sont tes tâches :\n\n${corps}Peux-tu me dire où tu en es ?\n\nMerci,\n`,
  };
}
