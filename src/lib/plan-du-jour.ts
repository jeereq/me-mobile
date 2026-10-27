import { addDays } from './dates';
import { resumeFinances } from './etat-des-lieux';
import { financesDe, prochaineEcheance } from './finances';
import { missionDuJour } from './mission';
import { resumes, tachesActives } from './planning';
import type { Espace } from './types';

/**
 * Les données envoyées à l'IA pour « Planifier ma journée » : seulement ce qui reste à faire aujourd'hui.
 * Le résumé général (`resumeDonnees`) mélangeait le fait et le pas fait, coupait les listes au hasard
 * et dépassait souvent la taille que le serveur lit : le plan proposait des choses déjà faites ou en oubliait.
 */
export function donneesPlan(e: Espace, d: string) {
  const mission = missionDuJour(e, d).filter((m) => !m.fait);
  const urgentes = new Set(mission.filter((m) => m.type === 'tache').map((m) => m.id));
  const parents = resumes(e.taches);
  const semaine = addDays(d, 7);
  const f = financesDe(e);
  const fin = resumeFinances(e, d);
  const dansTroisJours = addDays(d, 3);
  return {
    aujourdhui: d,
    agenda: (e.agenda[d] || []).map(({ debut, fin, titre, lieu }) => ({ debut, ...(fin ? { fin } : {}), titre, ...(lieu ? { lieu } : {}) })),
    relancesDues: mission.filter((m) => m.type === 'relance').map((m) => ({ contact: m.item.contact, sujet: m.item.sujet, boite: m.item.boite, ...(m.item.date < d ? { enRetard: true } : {}) })),
    tachesUrgentes: mission.filter((m) => m.type === 'tache').map((m) => ({ titre: m.titre, quand: m.detail, priorite: m.item.priorite, ...(m.item.echeance ? { echeance: m.item.echeance } : {}), ...(m.item.projet ? { projet: e.projets?.find((p) => p.id === m.item.projet)?.nom } : {}) })),
    habitudesDuJour: mission.filter((m) => m.type === 'habitude').map((m) => ({ nom: m.titre, categorie: m.item.categorie })),
    // Pour remplir les trous de la journée, sans noyer l'IA : la semaine qui vient, la plus proche d'abord.
    tachesSemaine: tachesActives(e, d)
      .filter((t) => !urgentes.has(t.id) && !parents.has(t.id) && t.echeance && t.echeance <= semaine)
      .sort((a, b) => a.echeance!.localeCompare(b.echeance!))
      .slice(0, 10)
      .map((t) => ({ titre: t.titre, echeance: t.echeance, priorite: t.priorite })),
    finances: {
      devise: f.devise,
      ...(fin.parJour !== null ? { budgetDuJour: fin.parJour, depenseAujourdhui: fin.jour.depense } : {}),
      // Factures et prélèvements qui tombent dans les 3 jours : à payer en premier.
      facturesProches: (f.recurrences || [])
        .filter((r) => r.genre === 'depense' && (!r.fin || r.fin >= d))
        .map((r) => ({ note: r.note, montant: r.montant, date: prochaineEcheance(r) }))
        .filter((r) => r.date <= dansTroisJours)
        .sort((a, b) => a.date.localeCompare(b.date)),
    },
  };
}

/** Le plan est lu tel quel (et à voix haute) : on enlève le markdown que certains modèles ajoutent malgré la consigne. */
export function sansMarkdown(texte: string) {
  return texte
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[ \t]*[-*•][ \t]+/gm, '• ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Le dernier plan, gardé le temps de la session : il survit au changement d'onglet, pas au changement de jour.
let dernier: { jour: string; texte: string } | null = null;
export const planMemorise = (jour: string) => (dernier?.jour === jour ? dernier.texte : '');
export const memoriserPlan = (jour: string, texte: string) => {
  dernier = { jour, texte };
};
