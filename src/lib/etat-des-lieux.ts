import { recommandations as recosOperations, operationsDe } from './analyse-operations';
import { idBudgetDe } from './categories';
import { comptesDe } from './comptes';
import { addDays, doneIn, habitDue } from './dates';
import { versPrincipal } from './devises';
import { bilan, depensesEntre, financesDe, fmtMontant, type Ligne, revenusEntre, suiviPlan, totalRevenus } from './finances';
import { jeuDe, niveauDe, serie, xpTotal } from './jeu';
import { sansResumes } from './planning';
import { faisabilite, objectifsActifs, suiviObjectif } from './objectifs';
import { prevision, type Etat as EtatPrevision } from './previsions';
import { dateFr } from './stats-finances';
import type { Espace, Finances } from './types';

/**
 * Tableau de bord : résumé des finances et état des lieux (où en sont l'argent, les tâches, les relances, les habitudes),
 * avec des recommandations classées de la plus urgente à la plus encourageante. Tout est calculé, rien n'est stocké.
 */

export type Niveau = 'alerte' | 'conseil' | 'info' | 'bien';
export type Constat = { id: 'finances' | 'taches' | 'relances' | 'habitudes' | 'serie'; titre: string; detail: string; niveau: Niveau; href: string };
export type Recommandation = { id: string; niveau: Niveau; titre: string; texte: string; href: string; action: string };

const ORDRE: Niveau[] = ['alerte', 'conseil', 'info', 'bien'];
const arrondi = (n: number) => Math.round(n * 100) / 100;
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
const niveauDeEtat = (e: EtatPrevision): Niveau => (e === 'depasse' ? 'alerte' : e === 'risque' ? 'conseil' : 'bien');

export type ResumeFinances = ReturnType<typeof resumeFinances>;

/** Le mois en cours en un coup d'œil : dépensé, budget, reste, rythme, aujourd'hui, revenus, solde du mois et des comptes. */
export function resumeFinances(e: Espace, d: string) {
  const f = financesDe(e);
  const fmt = (n: number) => fmtMontant(n, f.devise);
  const b = bilan(f, 'mois', d, d);
  const mois = prevision(f, 'mois', d);
  const jour = prevision(f, 'jour', d);
  // Même borne que l'écran Finances (tout le mois), pour que les deux disent la même chose.
  const revenus = totalRevenus(revenusEntre(f, b.debut, b.fin));
  // Solde des comptes : le dernier solde lu dans chaque relevé, converti dans la devise principale quand le taux est connu.
  const soldes = comptesDe(f).filter((c) => c.solde);
  const convertis = soldes.map((c) => versPrincipal(c.solde!.montant, c.solde!.devise, f.devise, f.taux));
  const totalComptes = soldes.length && convertis.every((x) => x !== null) ? arrondi(convertis.reduce((s: number, x) => s + x!, 0)) : null;
  const aSurveiller = (mois?.budgets ?? []).filter((x) => x.etat !== 'ok').slice(0, 3);
  return {
    devise: f.devise,
    fmt,
    vide: !f.depenses.length && !f.budgets.length && !(f.revenus ?? []).length,
    debut: b.debut,
    fin: b.fin,
    depense: b.total,
    plafond: b.plafondTotal || null,
    // Face au budget : ce qui compte dedans (sans budget global, le hors budget est à part, comme dans Finances).
    compte: b.compte,
    horsBudget: f.budgets.some((x) => x.global) ? 0 : b.horsBudget,
    reste: b.plafondTotal ? arrondi(b.plafondTotal - b.compte) : null,
    ratio: b.plafondTotal ? b.compte / b.plafondTotal : 0,
    /** Le budget d'aujourd'hui, le même chiffre que dans Finances. */
    parJour: b.plafondTotal && b.parJour !== null ? b.parJour : null,
    projection: b.projection,
    etat: mois?.etat ?? null,
    jour: jour ? { depense: jour.depense, plafond: jour.plafond, etat: jour.etat } : { depense: arrondi(depensesEntre(f, d, d).reduce((s, x) => s + x.montant, 0)), plafond: null, etat: null },
    revenus,
    solde: arrondi(revenus - b.total),
    comptes: { n: comptesDe(f).length, total: totalComptes },
    aSurveiller,
  };
}

/**
 * Ce que les plans de dépenses racontent : un poste dépassé, un poste dont la date est passée sans que tout soit
 * dépensé, un poste qui commence, de l'argent non réparti, des dépenses rangées dans aucun poste, et le conseil
 * de dire comment un gros budget sera dépensé. Les plus urgents d'abord.
 */
export function plansDepenses(f: Finances, d: string): Recommandation[] {
  const fmt = (n: number) => fmtMontant(n, f.devise);
  const b = bilan(f, 'mois', d, d);
  const out: Recommandation[] = [];
  const sansPlan: Ligne[] = [];

  for (const l of b.lignes) {
    const suivi = suiviPlan(l.budget, l.budget.global ? b.depenses : b.depenses.filter((x) => idBudgetDe(f.budgets, x) === l.budget.id), l.plafond, d);
    if (!suivi) {
      if (l.plafond > 0 && l.depense > 0) sansPlan.push(l);
      continue;
    }
    const nom = `${l.budget.emoji} ${l.budget.nom}`;
    for (const x of suivi.postes.filter((p) => p.depasse).sort((a, z) => a.reste - z.reste).slice(0, 2))
      out.push({ id: `poste-depasse-${x.poste.id}`, niveau: 'alerte', titre: `${nom} : « ${x.poste.nom} » dépassé`, texte: `${fmt(x.depense)} dépensés pour ${fmt(x.prevu)} prévus, soit ${fmt(-x.reste)} de trop. Reprends ce montant sur un autre poste, ou revois le plan du budget.`, href: '/finances', action: 'Voir le budget' });
    for (const x of suivi.postes.filter((p) => p.resteApres).slice(0, 2))
      out.push({ id: `poste-reste-${x.poste.id}`, niveau: 'conseil', titre: `${nom} : « ${x.poste.nom} » est terminé`, texte: `Prévu jusqu’au ${dateFr(x.poste.fin!)}, et ${fmt(x.reste)} n’ont pas été dépensés. Mets-les de côté, ou donne-les à un autre poste.`, href: '/finances', action: 'Voir le budget' });
    for (const x of suivi.aVenir.filter((p) => p.poste.debut && p.poste.debut <= addDays(d, 7)).slice(0, 1))
      out.push({ id: `poste-bientot-${x.poste.id}`, niveau: 'info', titre: `${nom} : « ${x.poste.nom} » commence le ${dateFr(x.poste.debut!)}`, texte: `${fmt(x.prevu)} y sont prévus. Garde-les disponibles d’ici là.`, href: '/finances', action: 'Voir le budget' });
    // Bonne pratique : tout le budget est réparti, et chaque dépense est rangée.
    if (suivi.nonAffecte > 0 && suivi.nonAffecte >= l.budget.montant * 0.2)
      out.push({ id: `plan-libre-${l.budget.id}`, niveau: 'info', titre: `${nom} : ${fmt(suivi.nonAffecte)} sans poste`, texte: 'Une partie du budget n’est destinée à rien. Ajoute un poste pour elle, ou baisse le montant du budget : tu sauras mieux où va ton argent.', href: '/finances', action: 'Compléter le plan' });
    else if (suivi.nonAffecte < 0)
      out.push({ id: `plan-trop-${l.budget.id}`, niveau: 'conseil', titre: `${nom} : les postes dépassent le budget`, texte: `Les postes font ${fmt(suivi.total)} pour un budget de ${fmt(l.budget.montant)}, soit ${fmt(-suivi.nonAffecte)} de trop. Baisse un poste ou relève le budget.`, href: '/finances', action: 'Revoir le plan' });
    if (suivi.horsPostes > 0 && l.depense > 0 && suivi.horsPostes >= l.depense * 0.4)
      out.push({ id: `plan-horsposte-${l.budget.id}`, niveau: 'info', titre: `${nom} : ${fmt(suivi.horsPostes)} dépensés sans poste`, texte: 'Range ces dépenses dans un poste (à la saisie, ou en touchant l’opération) : le suivi par poste deviendra juste.', href: '/finances', action: 'Ranger les dépenses' });
  }

  // Bonne pratique : les gros budgets gagnent à dire comment ils seront dépensés.
  const gros = sansPlan.sort((a, z) => z.plafond - a.plafond)[0];
  if (gros && gros.plafond >= 200)
    out.push({ id: `plan-manquant-${gros.budget.id}`, niveau: 'info', titre: `${gros.budget.emoji} ${gros.budget.nom} : dis comment il sera dépensé`, texte: `${fmt(gros.plafond)} sans détail. Découpe-le en postes (« Billets », « Hôtel », « Repas »), avec leurs dates si tu les connais : Me suivra chaque poste au lieu d’un seul total.`, href: '/finances', action: 'Ajouter des postes' });

  return out.sort((a, z) => ORDRE.indexOf(a.niveau) - ORDRE.indexOf(z.niveau));
}

/** Les objectifs d'épargne ou de remboursement qui demandent de l'attention : en retard, échéance passée, ou plan qui ne tient pas dans le budget. */
export function recosObjectifs(f: Finances, d: string): Recommandation[] {
  const fmt = (n: number) => fmtMontant(n, f.devise);
  const href = '/finances?onglet=objectifs';
  const out: Recommandation[] = [];
  for (const o of objectifsActifs(f)) {
    const s = suiviObjectif(o, d);
    if (s.atteint || s.etat === 'a_venir') continue;
    const nom = `${o.emoji} ${o.nom}`;
    if (s.etat === 'depasse') {
      out.push({ id: `objectif-depasse-${o.id}`, niveau: 'alerte', titre: `${nom} : l’échéance est passée`, texte: `Il manque ${fmt(s.reste)} sur ${fmt(o.cible)}, et la date du ${dateFr(o.echeance)} est dépassée. Verse ce que tu peux, ou repousse la date.`, href, action: 'Voir l’objectif' });
      continue;
    }
    const fa = faisabilite(f, o, d);
    if (fa.tient === false) {
      out.push({ id: `objectif-tient-pas-${o.id}`, niveau: 'conseil', titre: `${nom} : le plan ne tient pas dans ton budget`, texte: `Il demande ${fmt(fa.besoin)} par mois et il t’en reste ${fmt(Math.max(0, fa.libre ?? 0))}. Réduis un budget de ${fmt(fa.manque)} par mois, ou repousse la date.`, href, action: 'Voir le plan' });
    } else if (s.etat === 'en_retard') {
      out.push({ id: `objectif-retard-${o.id}`, niveau: 'conseil', titre: `${nom} : en retard sur le plan`, texte: `${fmt(s.acquis)} réunis alors que ${fmt(s.attendu)} étaient attendus aujourd’hui. Prochain versement conseillé : ${fmt(Math.min(s.versement, s.reste))}${s.prochain ? `, le ${dateFr(s.prochain)}` : ''}.`, href, action: 'Verser' });
    }
  }
  return out;
}

export function etatDesLieux(e: Espace, d: string): { constats: Constat[]; recommandations: Recommandation[] } {
  const f = financesDe(e);
  const r = resumeFinances(e, d);
  const fmt = r.fmt;
  const constats: Constat[] = [];
  const recos: Recommandation[] = [];

  // ---------- Finances ----------
  const depenses90 = depensesEntre(f, addDays(d, -89), d);
  if (r.plafond) {
    constats.push({ id: 'finances', titre: 'Finances', detail: `${fmt(r.depense)} dépensés ce mois sur ${fmt(r.plafond)} (${Math.round(r.ratio * 100)} %)`, niveau: r.etat && r.etat !== 'ok' ? niveauDeEtat(r.etat) : r.aSurveiller.length ? 'conseil' : r.etat ? 'bien' : 'info', href: '/finances' });
    if (r.etat === 'depasse') recos.push({ id: 'mois-depasse', niveau: 'alerte', titre: 'Budget du mois dépassé', texte: `${fmt(r.depense)} dépensés pour ${fmt(r.plafond)} prévus. Repère dans Finances ce qui peut attendre le mois prochain.`, href: '/finances', action: 'Voir Finances' });
    else if (r.etat === 'risque' && r.projection) recos.push({ id: 'mois-risque', niveau: 'conseil', titre: 'À ce rythme, le budget du mois sera dépassé', texte: `Environ ${fmt(Math.round(r.projection))} prévus pour ${fmt(r.plafond)}. Pour tenir, ton budget d'aujourd'hui est de ${fmt(r.parJour ?? 0)}.`, href: '/finances', action: 'Voir les budgets' });
  } else if (f.depenses.length) {
    constats.push({ id: 'finances', titre: 'Finances', detail: `${fmt(r.depense)} dépensés ce mois, sans budget`, niveau: 'info', href: '/finances' });
    if (depenses90.length >= 5) recos.push({ id: 'sans-budget', niveau: 'conseil', titre: 'Fixe un budget', texte: `Tu as noté ${pluriel(depenses90.length, 'dépense', 'dépenses')} ces 90 derniers jours, mais aucun budget : un budget total par mois ou par jour te dira ce qu'il te reste.`, href: '/finances', action: 'Créer un budget' });
  } else {
    constats.push({ id: 'finances', titre: 'Finances', detail: 'Aucune dépense notée', niveau: 'info', href: '/finances' });
  }
  for (const x of r.aSurveiller.slice(0, 2))
    recos.push({ id: `budget-${x.nom}`, niveau: x.etat === 'depasse' ? 'alerte' : 'conseil', titre: x.etat === 'depasse' ? `${x.emoji} ${x.nom} : budget dépassé` : `${x.emoji} ${x.nom} : budget en danger`, texte: x.etat === 'depasse' ? `${fmt(x.depense)} dépensés pour ${fmt(x.plafond)} prévus ce mois.` : `À ce rythme, environ ${fmt(Math.round(x.projection))} pour ${fmt(x.plafond)} prévus ce mois.`, href: '/finances', action: 'Voir le budget' });
  // Budgets qui s'arrêtent bientôt : ce qu'il en reste.
  for (const b of f.budgets.filter((x) => x.fin && x.fin >= d && x.fin <= addDays(d, 7) && x.enveloppe)) {
    const dep = arrondi(depensesEntre(f, b.debut ?? d, b.fin!).filter((x) => b.global || idBudgetDe(f.budgets, x) === b.id).reduce((s, x) => s + x.montant, 0));
    recos.push({ id: `fin-${b.id}`, niveau: 'info', titre: `${b.emoji} ${b.nom} se termine le ${dateFr(b.fin!)}`, texte: dep <= b.montant ? `Il reste ${fmt(arrondi(b.montant - dep))} sur ${fmt(b.montant)}. Prolonge-le dans Finances si besoin.` : `Dépassé de ${fmt(arrondi(dep - b.montant))} sur ${fmt(b.montant)}.`, href: '/finances', action: 'Voir le budget' });
  }
  // ---------- Plans de dépenses (les postes d'un budget : à quoi l'argent est destiné, et quand) ----------
  for (const x of plansDepenses(f, d).slice(0, 4)) recos.push(x);
  for (const x of recosObjectifs(f, d).slice(0, 3)) recos.push(x);

  if (f.depenses.length && !revenusEntre(f, addDays(d, -44), d).length && !(f.recurrences ?? []).some((x) => x.genre === 'revenu'))
    recos.push({ id: 'sans-revenu', niveau: 'info', titre: 'Note tes revenus', texte: 'Sans revenus notés, Me ne peut pas te dire ce que tu mets de côté. Ajoute ton salaire comme revenu qui revient chaque mois, ou importe ton relevé.', href: '/finances', action: 'Ajouter un revenu' });
  // Ce que disent les opérations des 90 derniers jours (frais bancaires, retraits, déficit, gros poste…), les plus utiles d'abord.
  const ops = operationsDe(f, (x) => idBudgetDe(f.budgets, x)).filter((x) => x.date >= addDays(d, -89) && x.date <= d && !x.lien);
  if (ops.length >= 8)
    recosOperations(ops, { budgets: f.budgets, recurrences: (f.recurrences ?? []).map((x) => x.note), fmt, ref: d })
      .filter((x) => x.niveau === 'alerte' || x.niveau === 'conseil' || x.id === 'epargne')
      .slice(0, 3)
      .forEach((x) => recos.push({ id: `ops-${x.id}`, niveau: x.niveau, titre: x.titre, texte: x.texte.replace('Sur cette sélection', 'Sur les 90 derniers jours').replace(/ ?Repère les postes à réduire dans l’onglet Graphiques\./, ''), href: '/finances', action: 'Voir les opérations' }));

  // ---------- Tâches ----------
  const taches = sansResumes(e.taches).filter((t) => t.statut !== 'fait');
  const enRetard = taches.filter((t) => t.echeance && t.echeance < d).sort((a, z) => a.echeance!.localeCompare(z.echeance!));
  const duJour = taches.filter((t) => t.echeance === d);
  constats.push({ id: 'taches', titre: 'Tâches', detail: taches.length ? `${pluriel(taches.length, 'à faire', 'à faire')}${enRetard.length ? `, dont ${enRetard.length} en retard` : ''}${duJour.length ? `, ${duJour.length} pour aujourd'hui` : ''}` : 'Rien à faire', niveau: enRetard.length ? 'conseil' : 'bien', href: '/taches' });
  if (enRetard.length)
    recos.push({ id: 'taches-retard', niveau: enRetard.length >= 5 ? 'alerte' : 'conseil', titre: `${pluriel(enRetard.length, 'tâche en retard', 'tâches en retard')}`, texte: `La plus ancienne : « ${enRetard[0].titre} », prévue le ${dateFr(enRetard[0].echeance!)}. Fais-la, donne-lui une nouvelle date ou supprime-la.`, href: '/taches', action: 'Voir les tâches' });

  // ---------- Relances ----------
  const attente = e.relances.filter((x) => x.statut !== 'repondu');
  const echues = attente.filter((x) => x.date <= d).sort((a, z) => a.date.localeCompare(z.date));
  constats.push({ id: 'relances', titre: 'Relances', detail: attente.length ? `${pluriel(attente.length, 'en attente', 'en attente')}${echues.length ? `, dont ${echues.length} à relancer` : ''}` : 'Aucune en attente', niveau: echues.length ? 'conseil' : 'bien', href: '/relances' });
  if (echues.length)
    recos.push({ id: 'relances', niveau: echues.some((x) => x.date < addDays(d, -7)) ? 'alerte' : 'conseil', titre: echues.length > 1 ? `${echues.length} relances à faire` : `Relancer ${echues[0].contact}`, texte: `${echues.length > 1 ? `La plus ancienne : ${echues[0].contact}` : 'Au sujet de'} « ${echues[0].sujet} », prévue le ${dateFr(echues[0].date)}.`, href: '/relances', action: 'Voir les relances' });

  // ---------- Habitudes (7 derniers jours) ----------
  const tenue = e.habitudes.map((h) => {
    let prevus = 0;
    let tenus = 0;
    for (let x = addDays(d, -6); x <= d; x = addDays(x, 1))
      if (habitDue(h, x)) {
        prevus++;
        if (doneIn(h, x)) tenus++;
      }
    return { h, prevus, tenus };
  });
  const prevus = tenue.reduce((s, x) => s + x.prevus, 0);
  const tenus = tenue.reduce((s, x) => s + x.tenus, 0);
  if (prevus) {
    const taux = tenus / prevus;
    constats.push({ id: 'habitudes', titre: 'Habitudes', detail: `Tenues à ${Math.round(taux * 100)} % sur 7 jours`, niveau: taux >= 0.7 ? 'bien' : taux >= 0.4 ? 'info' : 'conseil', href: '/habitudes' });
    const faible = tenue.filter((x) => x.prevus >= 4 && x.tenus / x.prevus < 0.5).sort((a, z) => a.tenus / a.prevus - z.tenus / z.prevus)[0];
    if (faible) recos.push({ id: `habitude-${faible.h.id}`, niveau: 'info', titre: `« ${faible.h.nom} » décroche`, texte: `Cochée ${faible.tenus} fois sur ${faible.prevus} cette semaine. Rends-la plus facile, ou passe-la en mode Coach pour un encouragement chaque jour.`, href: '/habitudes', action: 'Voir les habitudes' });
  }

  // ---------- Série et niveau ----------
  const j = jeuDe(e);
  const s = serie(j, d);
  const niv = niveauDe(xpTotal(j));
  constats.push({ id: 'serie', titre: 'Régularité', detail: `${s ? `Série de ${pluriel(s, 'jour', 'jours')}` : 'Pas de série en cours'} · niveau ${niv.niveau}`, niveau: s >= 3 ? 'bien' : 'info', href: '/recompenses' });
  if (s >= 3 && !recos.some((x) => x.niveau === 'alerte')) recos.push({ id: 'serie', niveau: 'bien', titre: `Série de ${s} jours`, texte: 'Une action par jour suffit à la faire grandir. Ta mission du jour est sur l’accueil.', href: '/recompenses', action: 'Voir mes récompenses' });

  return { constats, recommandations: recos.sort((a, z) => ORDRE.indexOf(a.niveau) - ORDRE.indexOf(z.niveau)) };
}

/** Le rapport en texte, à copier ou à partager : résumé des finances, état des lieux et recommandations. */
export function rapportTexte(e: Espace, d: string) {
  const r = resumeFinances(e, d);
  const { constats, recommandations } = etatDesLieux(e, d);
  const fmt = r.fmt;
  const lignes = [`État des lieux du ${dateFr(d)}`, '', 'Finances du mois'];
  lignes.push(`- Dépensé : ${fmt(r.depense)}${r.plafond ? ` sur ${fmt(r.plafond)} (${Math.round(r.ratio * 100)} %)` : ''}`);
  if (r.reste !== null) lignes.push(r.reste >= 0 ? `- Reste à dépenser : ${fmt(r.reste)}${r.parJour !== null ? ` · budget d'aujourd'hui : ${fmt(r.parJour)}` : ''}` : `- Dépassé de ${fmt(-r.reste)}`);
  lignes.push(`- Revenus : ${fmt(r.revenus)} · solde du mois : ${r.solde >= 0 ? '+' : '−'}${fmt(Math.abs(r.solde))}`);
  if (r.comptes.total !== null) lignes.push(`- Solde des comptes : ${fmt(r.comptes.total)}`);
  // Les plans de dépenses : poste par poste, ce qui est prévu, dépensé et quand.
  const f = financesDe(e);
  const b = bilan(f, 'mois', d, d);
  const plans = b.lignes
    .map((l) => ({ l, suivi: suiviPlan(l.budget, l.budget.global ? b.depenses : b.depenses.filter((x) => idBudgetDe(f.budgets, x) === l.budget.id), l.plafond, d) }))
    .filter((x) => x.suivi);
  if (plans.length) {
    lignes.push('', 'Plans de dépenses');
    for (const { l, suivi } of plans) {
      lignes.push(`- ${l.budget.emoji} ${l.budget.nom}`);
      for (const x of suivi!.postes) {
        const quand = x.poste.debut && x.poste.fin ? ` (du ${dateFr(x.poste.debut)} au ${dateFr(x.poste.fin)})` : x.poste.fin ? ` (jusqu'au ${dateFr(x.poste.fin)})` : x.poste.debut ? ` (à partir du ${dateFr(x.poste.debut)})` : '';
        const etat = x.depasse ? ` · dépassé de ${fmt(-x.reste)}` : x.resteApres ? ` · ${fmt(x.reste)} non dépensés` : x.etat === 'avenir' ? ' · à venir' : '';
        lignes.push(`  · ${x.poste.nom}${quand} : ${fmt(x.depense)} / ${fmt(x.prevu)}${etat}`);
      }
      if (suivi!.horsPostes) lignes.push(`  · Sans poste : ${fmt(suivi!.horsPostes)}`);
    }
  }
  lignes.push('', 'État des lieux', ...constats.map((c) => `- ${c.titre} : ${c.detail}`));
  lignes.push('', 'Recommandations', ...(recommandations.length ? recommandations.map((x, i) => `${i + 1}. ${x.titre}. ${x.texte}`) : ['Rien à signaler : tout est en ordre.']));
  return lignes.join('\n');
}
