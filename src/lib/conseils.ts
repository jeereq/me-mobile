import { addDays, parse } from './dates';
import { etatDesLieux, type Niveau } from './etat-des-lieux';
import { bilan, financesDe, fmtMontant } from './finances';
import { capaciteMensuelle, echeanceTenable, faisabilite, fondsUrgenceConseille, objectifsActifs, planReduction, suiviObjectif } from './objectifs';
import { dateFr } from './stats-finances';
import type { Espace } from './types';

/**
 * Conseils pour tenir le budget et atteindre les objectifs : ce que l'état des lieux sait déjà dire, plus ce qui relie les deux
 * (un budget qui déborde chaque mois, une marge à verser sur un objectif, où trouver l'argent d'un plan qui ne tient pas).
 * Tout est calculé, rien n'est stocké.
 */

export type DomaineConseil = 'budget' | 'objectif';
export type Conseil = { id: string; domaine: DomaineConseil; niveau: Niveau; titre: string; texte: string; href: string; action: string };

const ORDRE: Niveau[] = ['alerte', 'conseil', 'info', 'bien'];
const arrondi = (n: number) => Math.round(n * 100) / 100;
const OBJECTIFS = '/finances?onglet=objectifs';
const debutMois = (d: string) => `${d.slice(0, 8)}01`;
const jours = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5) + 1;

/** Le premier jour du mois qui précède `d` de `n` mois. */
export function moisAvant(d: string, n: number) {
  let x = debutMois(d);
  for (let i = 0; i < n; i++) x = debutMois(addDays(x, -1));
  return x;
}

/** Les budgets mensuels qui dépassent presque chaque mois : le plafond n'est pas réaliste, ou la dépense dérape. */
function recidives(e: Espace, d: string): Conseil[] {
  const f = financesDe(e);
  const fmt = (n: number) => fmtMontant(n, f.devise);
  const mois = [1, 2, 3].map((k) => bilan(f, 'mois', moisAvant(d, k), d));
  const out: Conseil[] = [];
  for (const b of f.budgets) {
    if (b.global || b.periode !== 'mois' || b.enveloppe || b.fin) continue;
    const lignes = mois.map((m) => m.lignes.find((l) => l.budget.id === b.id)).filter((l): l is NonNullable<typeof l> => !!l && l.plafond > 0);
    const depasses = lignes.filter((l) => l.depense > l.plafond);
    if (lignes.length < 2 || depasses.length < 2) continue;
    const moyenne = arrondi(lignes.reduce((s, l) => s + l.depense, 0) / lignes.length);
    const realiste = Math.ceil(moyenne / 10) * 10;
    out.push({
      id: `budget-recidive-${b.id}`,
      domaine: 'budget',
      niveau: depasses.length === lignes.length ? 'alerte' : 'conseil',
      titre: `${b.emoji} ${b.nom} : dépassé ${depasses.length} mois sur ${lignes.length}`,
      texte: `Environ ${fmt(moyenne)} dépensés par mois pour ${fmt(b.montant)} prévus. Soit tu relèves le budget à ${fmt(realiste)}, soit tu fixes une règle pour couper ${fmt(arrondi(moyenne - b.montant))} par mois : sans l'un des deux, il sera encore dépassé.`,
      href: '/finances',
      action: 'Revoir le budget',
    });
  }
  return out;
}

/** Une marge de fin de mois sur un budget peu utilisé : de quoi avancer sur l'objectif le plus en retard. */
function marge(e: Espace, d: string): Conseil[] {
  const f = financesDe(e);
  const fmt = (n: number) => fmtMontant(n, f.devise);
  const cibles = objectifsActifs(f)
    .map((o) => ({ o, s: suiviObjectif(o, d) }))
    .filter((x) => !x.s.atteint && x.s.etat !== 'a_venir');
  if (!cibles.length) return [];
  const m = bilan(f, 'mois', d, d);
  const ecoules = jours(m.debut, d);
  const total = jours(m.debut, m.fin);
  if (ecoules / total < 0.6) return [];
  const libres = m.lignes
    .filter((l) => !l.budget.global && l.budget.periode === 'mois' && l.plafond > 0 && l.ratio <= 0.7 && l.reste > 0)
    .sort((a, b) => b.reste - a.reste);
  if (!libres.length) return [];
  const l = libres[0];
  const retard = (x: (typeof cibles)[number]) => (x.s.etat === 'en_retard' || x.s.etat === 'depasse' ? 0 : 1);
  const cible = [...cibles].sort((a, b) => retard(a) - retard(b) || a.o.echeance.localeCompare(b.o.echeance))[0];
  const montant = arrondi(Math.min(l.reste, cible.s.reste, cible.s.versement > 0 ? cible.s.versement : l.reste));
  if (montant <= 0) return [];
  return [
    {
      id: `budget-marge-${l.budget.id}`,
      domaine: 'objectif',
      niveau: 'info',
      titre: `${l.budget.emoji} ${l.budget.nom} : ${fmt(l.reste)} de marge`,
      texte: `Il reste ${total - ecoules} jours au mois et seulement ${Math.round(l.ratio * 100)} % de ce budget est utilisé. Tu peux mettre ${fmt(montant)} sur « ${cible.o.nom} »${retard(cible) === 0 ? ', en retard sur son plan' : ''} sans toucher à tes autres budgets.`,
      href: OBJECTIFS,
      action: 'Verser',
    },
  ];
}

/** Un objectif dont le plan demande plus que ce que le budget laisse : où trouver la différence, ou quelle date tient. */
function pourTenir(e: Espace, d: string): Conseil[] {
  const f = financesDe(e);
  const fmt = (n: number) => fmtMontant(n, f.devise);
  const out: Conseil[] = [];
  for (const o of objectifsActifs(f)) {
    const s = suiviObjectif(o, d);
    if (s.atteint || s.etat === 'a_venir' || s.etat === 'depasse') continue;
    const fa = faisabilite(f, o, d);
    if (fa.tient !== false) continue;
    const r = planReduction(f, d, fa.manque);
    const date = echeanceTenable(o, d, fa.libre);
    const ou = r ? r.leviers.map((x) => `${fmt(x.economie)} sur ${x.nom}`).join(', ') : '';
    const texte =
      `« ${o.nom} » demande ${fmt(fa.besoin)} par mois et il t'en reste ${fmt(Math.max(0, fa.libre ?? 0))}. ` +
      (r?.couvre ? `Pour trouver ${fmt(fa.manque)} : ${ou} (−${r.pct} %).` : r ? `Même avec −${r.pct} % sur tes plus gros budgets (${ou}), il manquerait encore de quoi.` : 'Aucun budget à réduire n\'a de dépenses assez grosses pour combler la différence.') +
      (date && !r?.couvre ? ` À ce que tu peux mettre de côté, tu y arrives le ${dateFr(date)}.` : date ? ` Ou repousse la date au ${dateFr(date)}.` : '');
    out.push({ id: `objectif-reduire-${o.id}`, domaine: 'objectif', niveau: 'conseil', titre: `${o.emoji} ${o.nom} : le plan ne tient pas`, texte, href: OBJECTIFS, action: 'Voir le plan' });
  }
  return out;
}

/** Un versement qui tombe aujourd'hui et n'est pas encore noté. */
function versementsDuJour(e: Espace, d: string): Conseil[] {
  const f = financesDe(e);
  const out: Conseil[] = [];
  for (const o of objectifsActifs(f)) {
    const s = suiviObjectif(o, d);
    const montant = Math.min(s.versement, s.reste);
    if (s.atteint || s.prochain !== d || montant <= 0 || o.versements.some((v) => v.date === d)) continue;
    out.push({ id: `objectif-verser-${o.id}`, domaine: 'objectif', niveau: 'info', titre: `${o.emoji} ${o.nom} : versement prévu aujourd'hui`, texte: `${fmtMontant(montant, f.devise)} à ${o.genre === 'dette' ? 'rembourser' : 'mettre de côté'}. Note-le dès que c'est fait pour garder le plan à jour.`, href: OBJECTIFS, action: 'Verser' });
  }
  return out;
}

/** Sans objectif, mais avec de quoi en financer un. */
function premierObjectif(e: Espace, d: string): Conseil[] {
  const f = financesDe(e);
  if (f.objectifs?.length) return [];
  const c = capaciteMensuelle(f, d);
  if (!c || c.revenus <= 0 || c.parMois <= 0) return [];
  const fonds = fondsUrgenceConseille(f, d);
  return [
    {
      id: 'objectif-premier',
      domaine: 'objectif',
      niveau: 'info',
      titre: 'Fixe-toi un premier objectif',
      texte: `Tu gardes en moyenne ${fmtMontant(c.parMois, f.devise)} par mois une fois tes dépenses payées${fonds ? `. Un fonds d'urgence de ${fmtMontant(fonds, f.devise)} (trois mois de dépenses) serait un bon départ` : ''}.`,
      href: OBJECTIFS,
      action: 'Créer un objectif',
    },
  ];
}

/** Tous les conseils sur le budget et les objectifs, du plus urgent au plus encourageant. */
export function conseilsBudgetsObjectifs(e: Espace, d: string): Conseil[] {
  const base: Conseil[] = etatDesLieux(e, d)
    .recommandations.filter((r) => r.href.startsWith('/finances') && !r.id.startsWith('objectif-tient-pas-'))
    .map((r) => ({ ...r, domaine: (r.id.startsWith('objectif-') ? 'objectif' : 'budget') as DomaineConseil }));
  const tous = [...base, ...recidives(e, d), ...pourTenir(e, d), ...versementsDuJour(e, d), ...marge(e, d), ...premierObjectif(e, d)];
  const vus = new Set<string>();
  return tous
    .filter((c) => (vus.has(c.id) ? false : (vus.add(c.id), true)))
    .sort((a, b) => ORDRE.indexOf(a.niveau) - ORDRE.indexOf(b.niveau));
}
