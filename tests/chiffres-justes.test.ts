import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilan as bilanCommun, prevision, resteDesBudgets } from '../src/lib/commun/previsions.ts';
import { addDays } from '../src/lib/dates.ts';
import { convertirFinances } from '../src/lib/devises.ts';
import { bilan, restaurerBudget, suiviBudget, supprimerBudget } from '../src/lib/finances.ts';
import { arriveesProposees, erreurReport, restesReportables, transferer } from '../src/lib/reports.ts';
import type { Budget, Finances, Periode } from '../src/lib/types.ts';

/**
 * Un même chiffre partout : l'écran Finances (`bilan` de l'app), le panneau « Où en sont mes budgets », les alertes et
 * le briefing du serveur (`src/lib/commun/previsions.ts`, copié de me-api) disent la même chose sur les mêmes données.
 */

const PERIODES: Periode[] = ['jour', 'semaine', 'mois', 'trimestre', 'annee'];
const T0 = '2026-11-04';

function financesAuHasard(graine: number): Finances {
  let g = graine;
  const h = () => ((g = (g * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const choix = <T,>(t: readonly T[]) => t[Math.floor(h() * t.length)];
  const jour = () => addDays(T0, Math.floor(h() * 120) - 60);
  const budgets: Budget[] = Array.from({ length: 1 + Math.floor(h() * 5) }, (_, i) => {
    const debut = h() < 0.3 ? jour() : undefined;
    const fin = h() < 0.3 ? addDays(debut ?? jour(), Math.floor(h() * 90)) : undefined;
    return { id: `b${i}`, nom: `B${i}`, emoji: '💰', montant: Math.round(h() * 500), periode: choix(PERIODES), ...(i === 0 && h() < 0.3 ? { global: true } : {}), ...(h() < 0.4 ? { categories: [choix(['a', 'b'])] } : {}), ...(debut ? { debut } : {}), ...(fin ? { fin } : {}), ...(debut && fin && h() < 0.5 ? { enveloppe: true } : {}) };
  });
  const depenses = Array.from({ length: Math.floor(h() * 25) }, (_, i) => ({ id: `d${i}`, montant: Math.round(h() * 8000) / 100, budget: h() < 0.5 ? choix(budgets).id : null, ...(h() < 0.4 ? { categories: [choix(['a', 'b'])] } : {}), ...(h() < 0.1 ? { lien: `v${i}` } : {}), note: '', date: jour(), creeLe: '' }));
  const verse = depenses.filter(() => h() < 0.15);
  const objectifs = verse.length ? [{ id: 'o', nom: 'O', emoji: '🎯', genre: 'epargne' as const, cible: 1000, debut: '2026-09-01', echeance: '2027-09-01', versements: verse.map((x) => ({ id: `v-${x.id}`, date: x.date, montant: x.montant, depense: x.id })), creeLe: '' }] : [];
  const reports = h() < 0.5 ? [{ id: 'r', montant: 10, de: { budget: budgets[0].id, periode: budgets[0].periode, debut: '2026-10-01' }, vers: { budget: choix(budgets).id, periode: choix(PERIODES), debut: '2026-11-02' }, creeLe: '' }] : [];
  return { devise: '€', budgets, depenses, objectifs, reports };
}

describe('un seul calcul pour l’écran, les alertes et le briefing', () => {
  it('donne les mêmes totaux que l’écran Finances, quelle que soit la période', () => {
    for (let graine = 1; graine <= 300; graine++) {
      const f = financesAuHasard(graine);
      for (const vue of PERIODES) {
        const ref = addDays(T0, (graine % 40) - 20);
        const a = bilan(f, vue, ref, T0);
        const b = bilanCommun(f, vue, ref, T0);
        assert.equal(b.plafondTotal, a.plafondTotal, `graine ${graine}, vue ${vue} : plafond`);
        assert.equal(b.compte, a.compte, `graine ${graine}, vue ${vue} : dépensé`);
        assert.deepEqual(b.lignes.map((l) => [l.budget.id, l.plafond, l.depense]), a.lignes.map((l) => [l.budget.id, l.plafond, l.depense]), `graine ${graine}, vue ${vue} : lignes`);
      }
    }
  });
  it('le briefing annonce le reste du mois de l’accueil', () => {
    const f = financesAuHasard(7);
    const m = bilan(f, 'mois', T0, T0);
    assert.equal(resteDesBudgets(f, T0), Math.round((m.plafondTotal - m.compte) * 100) / 100);
  });
  it('une dépense versée sur un objectif n’est pas comptée dans les alertes', () => {
    const f: Finances = { devise: '€', budgets: [{ id: 'g', nom: 'Tout', emoji: '💰', montant: 100, periode: 'mois', global: true }], depenses: [{ id: 'e', montant: 80, budget: null, note: '', date: '2026-11-01', creeLe: '' }], objectifs: [{ id: 'o', nom: 'Voyage', emoji: '✈️', genre: 'epargne', cible: 500, debut: '2026-10-01', echeance: '2027-06-01', versements: [{ id: 'v', date: '2026-11-01', montant: 80, depense: 'e' }], creeLe: '' }] };
    assert.equal(prevision(f, 'mois', '2026-11-02')?.depense, 0);
  });
});

describe('aucun reste perdu', () => {
  const courses: Budget = { id: 'b', nom: 'Courses', emoji: '🛒', montant: 100, periode: 'mois', fin: '2026-10-31' };
  const f: Finances = { devise: '€', budgets: [courses], depenses: [{ id: 'd', montant: 40, budget: 'b', note: '', date: '2026-10-10', creeLe: '' }] };
  it('refuse de reporter sur une période où le budget ne court plus', () => {
    const [r] = restesReportables(f, 'mois', '2026-10-15', '2026-11-01');
    const mois = arriveesProposees(r.case)[2];
    assert.match(erreurReport(f, r.case, 60, { case: mois.case }, '2026-11-01') ?? '', /ne court plus/);
  });
  it('accepte un autre budget qui court à l’arrivée', () => {
    const g: Finances = { ...f, budgets: [courses, { id: 'n', nom: 'Marché', emoji: '🥕', montant: 80, periode: 'mois' }] };
    const [r] = restesReportables(g, 'mois', '2026-10-15', '2026-11-01');
    const mois = arriveesProposees(r.case)[2];
    assert.equal(erreurReport(g, r.case, 60, { case: { ...mois.case, budget: 'n' } }, '2026-11-01'), null);
  });
  it('supprimer un budget annule ses transferts, et « Annuler » les remet', () => {
    const repas: Budget = { id: 'r', nom: 'Repas', emoji: '🍽️', montant: 20, periode: 'jour' };
    const marche: Budget = { id: 'm', nom: 'Marché', emoji: '🥕', montant: 300, periode: 'mois' };
    const g = transferer({ devise: '€', budgets: [repas, marche], depenses: [], recurrences: [{ id: 'x', genre: 'depense', montant: 5, note: '', budget: 'm', frequence: 'mois', debut: '2026-11-01', derniere: null }] }, { budget: 'm', periode: 'mois', debut: '2026-11-01' }, { budget: 'r', periode: 'jour', debut: '2026-11-03' }, 5, 't');
    assert.equal(suiviBudget(g, repas, '2026-11-03')?.total, 25);
    const sans = supprimerBudget(g, 'm');
    assert.equal(suiviBudget(sans, repas, '2026-11-03')?.total, 20);
    assert.equal(sans.recurrences?.[0].budget, null);
    const remis = restaurerBudget(sans, g, 'm');
    assert.equal(suiviBudget(remis, repas, '2026-11-03')?.total, 25);
    assert.equal(remis.recurrences?.[0].budget, 'm');
  });
});

describe('changer de devise convertit tout', () => {
  it('objectifs, versements, restes reportés et postes passent dans la nouvelle devise', () => {
    const f: Finances = {
      devise: '€',
      taux: { $: 0.5 },
      budgets: [{ id: 't', nom: 'Travaux', emoji: '🔨', montant: 900, periode: 'mois', plan: [{ id: 'p', nom: 'Peinture', montant: 300 }] }],
      depenses: [{ id: 'e', montant: 10, budget: null, note: '', date: '2026-11-01', creeLe: '' }],
      objectifs: [{ id: 'o', nom: 'Voyage', emoji: '✈️', genre: 'epargne', cible: 1000, depart: 100, debut: '2026-10-01', echeance: '2027-06-01', versements: [{ id: 'v', date: '2026-10-05', montant: 200 }, { id: 'w', date: '2026-11-01', montant: 10, depense: 'e' }], plan: { cadence: 'mois', versement: 50 }, creeLe: '' }],
      reports: [{ id: 'r', montant: 20, de: { budget: 't', periode: 'mois', debut: '2026-10-01' }, vers: { budget: 't', periode: 'mois', debut: '2026-11-01' }, creeLe: '' }],
    };
    const g = convertirFinances(f, '$')!;
    assert.equal(g.budgets[0].plan?.[0].montant, 600);
    const o = g.objectifs![0];
    assert.deepEqual([o.cible, o.depart, o.plan?.versement], [2000, 200, 100]);
    assert.deepEqual(o.versements.map((v) => v.montant), [400, g.depenses[0].montant]);
    assert.equal(g.reports![0].montant, 40);
  });
});
