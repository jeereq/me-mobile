import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { api } from './api';
import { celebrer } from './celebration';
import { addDays, doneIn, hm, periodKey, today, uid } from './dates';
import { saisie } from './devises';
import { tacheDeListe } from './externe';
import { BADGES, entretenir, gagner, jeuDe, niveauDe, POINTS, retirer, xpTotal } from './jeu';
import { cleHabitude, cleRelance, cleTache, missionDuJour, pointsTache } from './mission';
import { useStore } from './store';
import { idBudgetDe } from './categories';
import { etatBudget, financesDe, fmtMontant, usageBudget } from './finances';
import { replanifier } from './planning';
import type { Phrase } from './phrase';
import { prevision } from './previsions';
import type { Budget, Depense, Espace, Habitude, Relance, Tache } from './types';

/**
 * Toutes les actions qui rapportent des points passent par ici : l'élément change, le gain est inscrit
 * (ou retiré si on décoche), la journée parfaite est vérifiée, puis l'app célèbre ce qui vient d'être gagné.
 */

// Journée parfaite : toute la mission du jour faite. Décocher un élément retire le bonus.
function bonusParfait(e: Espace, d: string, h: string): Espace {
  const m = missionDuJour(e, d);
  const complet = m.length > 0 && m.every((x) => x.fait);
  const cle = `p:${d}`;
  if (complet) return gagner(e, cle, { d, p: POINTS.parfait, t: 'bonus', h });
  return retirer(e, cle);
}

const finir = (e: Espace, d: string, h: string) => entretenir(bonusParfait(e, d, h), d);

export function tHabitude(e: Espace, id: string, d: string, h: string): Espace {
  const hab = e.habitudes.find((x) => x.id === id);
  if (!hab) return e;
  const fait = doneIn(hab, d);
  const coches = hab.coches.filter((c) => periodKey(hab.frequence, c) !== periodKey(hab.frequence, d));
  if (!fait) coches.push(d);
  let n: Espace = { ...e, habitudes: e.habitudes.map((x) => (x.id === id ? { ...x, coches: coches.sort().slice(-180) } : x)) };
  n = fait ? retirer(n, cleHabitude(hab, d)) : gagner(n, cleHabitude(hab, d), { d, p: POINTS.habitude, t: 'habitude', h });
  return finir(n, d, h);
}

export function tRelance(e: Espace, id: string, statut: Relance['statut'], d: string, h: string): Espace {
  const r = e.relances.find((x) => x.id === id);
  if (!r) return e;
  let n: Espace = { ...e, relances: e.relances.map((x) => (x.id === id ? { ...x, statut, reponduLe: statut === 'repondu' ? d : null } : x)) };
  n = statut === 'repondu' ? gagner(n, cleRelance(r), { d, p: POINTS.relance, t: 'relance', h }) : retirer(n, cleRelance(r));
  return finir(n, d, h);
}

export function tTache(e: Espace, id: string, d: string, h: string): Espace {
  const t = e.taches.find((x) => x.id === id);
  if (!t) return e;
  const fait = t.statut === 'fait';
  let n: Espace = { ...e, taches: e.taches.map((x) => (x.id === id ? { ...x, statut: fait ? 'en_attente' : 'fait', faitLe: fait ? null : d } : x)) };
  n = fait ? retirer(n, cleTache(t)) : gagner(n, cleTache(t), { d, p: pointsTache(t, d), t: 'tache', h });
  // Terminer (ou rouvrir) une tâche de projet décale celles qui la suivent.
  const projet = t.projet ? e.projets?.find((p) => p.id === t.projet) : undefined;
  if (projet) n = { ...n, taches: replanifier(n.taches, projet, d) };
  return finir(n, d, h);
}

export function tNote(e: Espace, texte: string, d: string, h: string): Espace {
  let n: Espace = { ...e, journal: { ...e.journal, [d]: { date: d, entrees: [...(e.journal[d]?.entrees || []), { h, texte }] } } };
  const deja = Object.keys(jeuDe(n).gains).filter((k) => k.startsWith(`j:${d}:`)).length;
  if (deja < POINTS.journalMaxParJour) n = gagner(n, `j:${d}:${deja}`, { d, p: POINTS.journal, t: 'journal', h });
  return entretenir(n, d);
}

/** Compare avant et après une action pour annoncer les points, la journée parfaite, un niveau ou un badge. */
function annoncer(avant: Espace, apres: Espace, d: string) {
  const ja = jeuDe(avant);
  const jb = jeuDe(apres);
  const gain = xpTotal(jb) - xpTotal(ja);
  if (gain <= 0) return;
  const parfait = !ja.gains[`p:${d}`] && !!jb.gains[`p:${d}`];
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  celebrer(parfait ? { type: 'parfait', points: gain } : { type: 'points', points: gain });
  const na = niveauDe(xpTotal(ja)).niveau;
  const nb = niveauDe(xpTotal(jb));
  if (nb.niveau > na) celebrer({ type: 'niveau', niveau: nb.niveau, titre: nb.titre });
  for (const b of BADGES) if (!ja.badges[b.id] && jb.badges[b.id]) celebrer({ type: 'badge', nom: b.nom, emoji: b.emoji, desc: b.desc });
}

const DE_LA = { jour: 'du jour', semaine: 'de la semaine', mois: 'du mois', trimestre: 'du trimestre', annee: "de l'année" } as const;

// Une enveloppe (montant pour toute la durée) se nomme par sa date de fin.
const deLa = (b: Budget) => (b.enveloppe && b.fin ? `jusqu'au ${b.fin.slice(8, 10)}/${b.fin.slice(5, 7)}` : DE_LA[b.periode]);

export function useActions() {
  const { espace, update, session } = useStore();
  const agir = useCallback(
    (t: (e: Espace, d: string, h: string) => Espace) => {
      const d = today();
      const h = hm();
      // L'annonce se calcule sur l'état affiché ; la mise à jour repart de l'état le plus récent.
      annoncer(espace, t(espace, d, h), d);
      update((e) => t(e, d, h));
    },
    [espace, update],
  );
  return {
    basculerHabitude: (h: Habitude) => agir((e, d, hh) => tHabitude(e, h.id, d, hh)),
    statutRelance: (r: Relance, statut: Relance['statut']) => agir((e, d, hh) => tRelance(e, r.id, statut, d, hh)),
    basculerRelance: (r: Relance) => agir((e, d, hh) => tRelance(e, r.id, r.statut === 'repondu' ? 'a_faire' : 'repondu', d, hh)),
    basculerTache: (t: Tache) => {
      agir((e, d, hh) => tTache(e, t.id, d, hh));
      // Une tâche venue de Google Tasks ou de To Do se coche aussi à la source, sans bloquer l'affichage.
      const l = tacheDeListe(t.id);
      if (l && session?.token) api(`/integrations/${l.compte}/taches`, { method: 'PATCH', body: { listeId: l.liste, id: l.tache, titre: t.titre, echeance: t.echeance, fait: t.statut !== 'fait' }, token: session.token, discret: true }).catch(() => {});
    },
    noter: (texte: string) => agir((e, d, hh) => tNote(e, texte, d, hh)),
    /** Plusieurs éléments d'un coup : une seule mise à jour, une seule annonce des points gagnés. */
    enLot: agir,
    ajouter: (kind: 'tache' | 'relance' | 'habitude', item: Tache | Relance | Habitude) =>
      update((e) => (kind === 'tache' ? { ...e, taches: [item as Tache, ...e.taches] } : kind === 'relance' ? { ...e, relances: [item as Relance, ...e.relances] } : { ...e, habitudes: [...e.habitudes, item as Habitude] })),
    ajouterDepense: (dep: Depense) => {
      // Alerte quand la dépense fait passer un budget à 80 % ou au-delà de 100 % sur sa propre période.
      const f = financesDe(espace);
      const apres = { ...f, depenses: [dep, ...f.depenses] };
      const alertes = f.budgets
        .filter((b) => (b.global || b.id === idBudgetDe(f.budgets, dep)) && etatBudget(b, dep.date) === 'en_cours')
        .map((b) => ({ b, avant: usageBudget(f, b, dep.date), apres: usageBudget(apres, b, dep.date) }))
        .filter((x) => (x.avant < 1 && x.apres >= 1) || (x.avant < 0.8 && x.apres >= 0.8));
      const a = alertes.find((x) => x.apres >= 1) ?? alertes[0];
      if (a) celebrer({ type: 'message', emoji: a.apres >= 1 ? '⚠️' : '👀', alerte: a.apres >= 1, texte: a.apres >= 1 ? `${a.b.nom} : budget ${deLa(a.b)} dépassé` : `${a.b.nom} : ${Math.round(a.apres * 100)} % du budget ${deLa(a.b)}` });
      else {
        // Sinon, la dépense du jour face au budget du jour.
        const jour = dep.date === today() ? prevision(apres, 'jour', dep.date) : null;
        const avantJour = jour ? prevision(f, 'jour', dep.date) : null;
        if (jour?.etat === 'depasse' && avantJour?.etat !== 'depasse') celebrer({ type: 'message', emoji: '⚠️', alerte: true, texte: `Au-dessus du budget du jour (${fmtMontant(jour.plafond, f.devise)})` });
        else celebrer({ type: 'message', emoji: '💸', texte: `${fmtMontant(dep.montant, f.devise)} noté` });
      }
      update((e) => {
        const g = financesDe(e);
        return { ...e, finances: { ...g, depenses: [dep, ...g.depenses] } };
      });
    },
  };
}

/**
 * Ajout en une phrase (saisie ou voix). Rend de quoi annuler, ou null si rien n'a été ajouté
 * (montant dans une devise sans taux connu : on n'ajoute pas un montant faux).
 */
export function useAjoutPhrase() {
  const { espace, update, config } = useStore();
  const { ajouter, ajouterDepense } = useActions();
  return (lu: Phrase): (() => void) | null => {
    const id = uid();
    const creeLe = new Date().toISOString();
    if (lu.genre === 'depense') {
      const fin = financesDe(espace);
      // Devise dite dans la phrase : convertie si on a un taux, sinon gardée telle quelle et signalée par le texte.
      const s = saisie(lu.montant, lu.devise ?? fin.devise, fin.devise, fin.taux);
      if (!s) return null;
      ajouterDepense({ id, montant: s.montant, ...(s.origine ? { origine: s.origine } : {}), budget: lu.budget, ...(lu.poste ? { poste: lu.poste } : {}), ...(lu.compte ? { compte: lu.compte } : {}), note: lu.note, date: lu.date, creeLe });
      return () => update((e) => ({ ...e, finances: { ...financesDe(e), depenses: financesDe(e).depenses.filter((x) => x.id !== id) } }));
    }
    if (lu.genre === 'tache') ajouter('tache', { id, titre: lu.titre, source: 'manuel', priorite: lu.priorite, echeance: lu.echeance, statut: 'en_attente', faitLe: null, mode: config.defauts.tache, creeLe });
    else if (lu.genre === 'relance') ajouter('relance', { id, contact: lu.contact, sujet: lu.sujet, boite: 'pro', date: lu.date ?? addDays(today(), config.delaiRelanceJours), statut: 'a_faire', mode: config.defauts.relance, creeLe });
    else ajouter('habitude', { id, nom: lu.titre, categorie: 'perso', frequence: lu.frequence, jour: lu.jour, mode: config.defauts.perso, coches: [], ordre: espace.habitudes.length });
    return () => update((e) => ({ ...e, taches: e.taches.filter((x) => x.id !== id), relances: e.relances.filter((x) => x.id !== id), habitudes: e.habitudes.filter((x) => x.id !== id) }));
  };
}

export const nouvelId = uid;
