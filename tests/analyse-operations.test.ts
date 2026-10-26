import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ancre, appliquer, bornes, cumul, FILTRES_VIDES, nbFiltres, parCategorie, parJourSemaine, parLibelle, parMois, periodesDisponibles, recommandations, totaux } from '../src/lib/analyse-operations.ts';
import type { Operation } from '../src/lib/analyse-operations.ts';

let n = 0;
const op = (sens: 'sortie' | 'entree', date: string, montant: number, note = '', budget: string | null = null, importee = false, compte: string | null = null, lien: string | null = null): Operation => ({ id: `o${n++}`, sens, date, montant, note, budget, compte, lien, importee });
const nom = (id: string | null) => (id === 'b1' ? 'Courses' : '');
const fmt = (x: number) => `${x} $`;
const ctx = (extra = {}) => ({ budgets: [{ id: 'b1', nom: 'Courses', emoji: '🛒', montant: 100, periode: 'mois' as const }], recurrences: [] as string[], fmt, ref: '2026-02-11', ...extra });

const jeu = [
  op('entree', '2025-11-05', 1000, 'Salaire', null, true),
  op('sortie', '2025-11-10', 40, 'Marché', 'b1'),
  op('sortie', '2025-11-20', 60, 'Retrait ATM', null, true),
  op('entree', '2025-12-05', 1000, 'Salaire', null, true),
  op('sortie', '2025-12-12', 120, 'Marché', 'b1'),
  op('sortie', '2026-01-08', 15, 'Frais sur Retrait ATM', null, true),
];

describe('bornes et périodes', () => {
  it('lit les périodes relatives, les années et les mois', () => {
    assert.deepEqual(bornes('30j', '2026-02-11'), { debut: '2026-01-13', fin: '2026-02-11' });
    assert.deepEqual(bornes('12m', '2026-02-11'), { debut: '2025-02-12', fin: '2026-02-11' });
    assert.deepEqual(bornes('2025', '2026-02-11'), { debut: '2025-01-01', fin: '2025-12-31' });
    assert.deepEqual(bornes('2024-02', '2026-02-11'), { debut: '2024-02-01', fin: '2024-02-29' });
    assert.deepEqual(bornes('tout', '2026-02-11'), { debut: null, fin: null });
  });
  it('ancre les périodes relatives sur la dernière opération quand elle est ancienne', () => {
    assert.equal(ancre(jeu, '2026-10-26'), '2026-01-08');
    assert.equal(ancre(jeu, '2025-01-01'), '2025-01-01');
    assert.equal(ancre([], '2026-10-26'), '2026-10-26');
  });
  it('liste les mois et années présents, du plus récent au plus ancien', () => {
    assert.deepEqual(periodesDisponibles(jeu), { mois: ['2026-01', '2025-12', '2025-11'], annees: ['2026', '2025'] });
  });
});

describe('appliquer', () => {
  const ref = '2026-01-08';
  it('sans filtre : tout, du plus récent au plus ancien', () => {
    const l = appliquer(jeu, FILTRES_VIDES, ref, nom);
    assert.equal(l.length, 6);
    assert.equal(l[0].date, '2026-01-08');
  });
  it('filtre par mois, sens, budget, montant et origine', () => {
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, periode: '2025-11' }, ref, nom).length, 3);
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, sens: 'entrees' }, ref, nom).length, 2);
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, budget: 'b1' }, ref, nom).length, 2);
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, budget: 'hors' }, ref, nom).length, 2);
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, min: 60, max: 120 }, ref, nom).length, 2);
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, origine: 'importees' }, ref, nom).length, 4);
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, origine: 'saisies' }, ref, nom).length, 2);
  });
  it('filtre par compte et met à part les virements entre comptes', () => {
    const ops = [op('sortie', '2026-01-02', 50, 'A', null, true, 'c1', 'v1'), op('entree', '2026-01-02', 50, 'A', null, true, 'c2', 'v1'), op('sortie', '2026-01-03', 9, 'B', null, true, 'c1'), op('sortie', '2026-01-04', 3, 'C')];
    const f = (p: object) => appliquer(ops, { ...FILTRES_VIDES, ...p }, '2026-01-10', nom).length;
    assert.equal(f({ compte: 'c1' }), 2);
    assert.equal(f({ compte: 'c2' }), 1);
    assert.equal(f({ compte: 'aucun' }), 1);
    assert.equal(f({ virements: 'sans' }), 2);
    assert.equal(f({ virements: 'seuls' }), 2);
    assert.equal(f({ compte: 'c1', virements: 'sans' }), 1);
    assert.equal(nbFiltres({ ...FILTRES_VIDES, compte: 'c1', virements: 'sans' }), 2);
  });
  it('un budget exclut les entrées', () => {
    assert.ok(appliquer(jeu, { ...FILTRES_VIDES, budget: 'hors' }, ref, nom).every((x) => x.sens === 'sortie'));
  });
  it('cherche dans le libellé, le budget et le montant, avec « | » pour « ou »', () => {
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, recherche: 'marche' }, ref, nom).length, 0, 'accents conservés : « marché » ≠ « marche »');
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, recherche: 'marché' }, ref, nom).length, 2);
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, recherche: 'courses' }, ref, nom).length, 2);
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, recherche: '120' }, ref, nom).length, 1);
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, recherche: 'salaire|retrait' }, ref, nom).length, 4);
  });
  it('trie par montant ou par ancienneté', () => {
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, tri: 'gros' }, ref, nom)[0].montant, 1000);
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, tri: 'petits' }, ref, nom)[0].montant, 15);
    assert.equal(appliquer(jeu, { ...FILTRES_VIDES, tri: 'anciennes' }, ref, nom)[0].date, '2025-11-05');
  });
  it('compte les filtres actifs sans le tri', () => {
    assert.equal(nbFiltres(FILTRES_VIDES), 0);
    assert.equal(nbFiltres({ ...FILTRES_VIDES, tri: 'gros', periode: '30j', min: 5, recherche: ' ' }), 2);
  });
});

describe('agrégats', () => {
  it('totalise entrées, sorties et solde', () => {
    assert.deepEqual(totaux(jeu), { entrees: 2000, sorties: 235, solde: 1765, nbEntrees: 2, nbSorties: 4 });
  });
  it('regroupe par mois sans trou', () => {
    const m = parMois([op('sortie', '2025-01-10', 5), op('entree', '2025-04-02', 9)]);
    assert.deepEqual(m.map((x) => x.mois), ['2025-01', '2025-02', '2025-03', '2025-04']);
    assert.equal(m[1].sorties, 0);
    assert.equal(m[3].entrees, 9);
    assert.deepEqual(parMois([]), []);
  });
  it('cumule jour après jour', () => {
    assert.deepEqual(cumul([op('entree', '2025-01-02', 10), op('sortie', '2025-01-02', 4), op('sortie', '2025-01-05', 8)]), [{ date: '2025-01-02', v: 6 }, { date: '2025-01-05', v: -2 }]);
  });
  it('regroupe les sorties par budget et par libellé', () => {
    const c = parCategorie(jeu, ctx().budgets);
    assert.deepEqual(c.map((x) => [x.nom, x.total]), [['Courses', 160], ['Hors budget', 75]]);
    const l = parLibelle(jeu);
    assert.equal(l[0].nom, 'Marché');
    assert.equal(l[0].n, 2);
    assert.equal(parLibelle(jeu, 'entree')[0].total, 2000);
  });
  it('totalise les sorties par jour de la semaine (lundi en premier)', () => {
    const j = parJourSemaine([op('sortie', '2026-02-09', 5), op('sortie', '2026-02-15', 7), op('entree', '2026-02-09', 99)]);
    assert.equal(j[0].total, 5);
    assert.equal(j[6].total, 7);
  });
});

describe('recommandations', () => {
  it('ne conclut rien avec trop peu d’opérations', () => {
    const r = recommandations(jeu, ctx());
    assert.equal(r.length, 1);
    assert.equal(r[0].id, 'peu');
  });

  const mensuel = (mois: string, sorties: number) => [op('entree', `${mois}-03`, 1000, 'Salaire'), op('sortie', `${mois}-12`, sorties, 'Marché', 'b1'), op('sortie', `${mois}-20`, 30, 'Divers')];

  it('signale un déficit et chiffre le manque par mois', () => {
    const ops = [...mensuel('2025-10', 1500), ...mensuel('2025-11', 1500), ...mensuel('2025-12', 1500)];
    const r = recommandations(ops, ctx());
    const d = r.find((x) => x.id === 'deficit')!;
    assert.equal(d.niveau, 'alerte');
    assert.match(d.texte, /530 \$ de moins chaque mois/);
    assert.equal(r[0].id, 'deficit', 'les alertes passent en premier');
  });

  it('félicite quand au moins 20 % des entrées restent', () => {
    const ops = [...mensuel('2025-10', 300), ...mensuel('2025-11', 300), ...mensuel('2025-12', 300)];
    const r = recommandations(ops, ctx());
    assert.equal(r.find((x) => x.id === 'epargne')!.niveau, 'bien');
  });

  it('repère les frais, les retraits et leurs frais', () => {
    const ops = [
      op('entree', '2025-10-03', 2000, 'Salaire'),
      ...['2025-10-05', '2025-10-12', '2025-10-19', '2025-10-26', '2025-11-02'].flatMap((d) => [op('sortie', d, 100, 'Retrait ATM'), op('sortie', d, 2, 'Frais sur Retrait ATM'), op('sortie', d, 0.3, 'TVA sur Retrait ATM')]),
      op('sortie', '2025-11-10', 50, 'Marché', 'b1'),
    ];
    const r = recommandations(ops, ctx());
    const frais = r.find((x) => x.id === 'frais')!;
    assert.match(frais.titre, /11.5 \$/);
    const retraits = r.find((x) => x.id === 'retraits')!;
    assert.match(retraits.texte, /5 retraits pour 500 \$/);
    assert.match(retraits.texte, /11.5 \$/);
    assert.ok(retraits.voir?.recherche);
  });

  it('signale les sorties sans budget, ou l’absence de budget', () => {
    const ops = [op('entree', '2025-10-03', 900, 'Salaire'), ...Array.from({ length: 8 }, (_, i) => op('sortie', `2025-10-${10 + i}`, 20, `Truc ${i}`))];
    assert.ok(recommandations(ops, ctx()).some((x) => x.id === 'hors-budget'));
    assert.ok(recommandations(ops, ctx({ budgets: [] })).some((x) => x.id === 'sans-budget'));
  });

  it('compare le dernier mois terminé à la moyenne et ignore le mois en cours', () => {
    const ops = [...mensuel('2025-10', 200), ...mensuel('2025-11', 200), ...mensuel('2025-12', 200), ...mensuel('2026-01', 600), ...mensuel('2026-02', 5)];
    const r = recommandations(ops, ctx({ ref: '2026-02-11' }));
    const h = r.find((x) => x.id === 'hausse')!;
    assert.match(h.titre, /janvier 2026/);
    assert.equal(h.niveau, 'alerte');
  });

  it('propose d’ajouter en récurrent ce qui revient chaque mois, sauf si c’est déjà fait', () => {
    const ops = [...['2025-09', '2025-10', '2025-11', '2025-12'].flatMap((m) => [op('entree', `${m}-01`, 1000, 'Salaire'), op('sortie', `${m}-05`, 9.99, 'Netflix', 'b1'), op('sortie', `${m}-15`, 25, `Café ${m}`, 'b1')])];
    const r = recommandations(ops, ctx());
    const reg = r.find((x) => x.id === 'reguliers')!;
    assert.match(reg.texte, /Netflix \(9.99 \$\)/);
    assert.ok(!/Café/.test(reg.texte), "des cafés de montants variables ne sont pas des paiements fixes");
    assert.ok(!recommandations(ops, ctx({ recurrences: ['netflix'] })).some((x) => x.id === 'reguliers' && /Netflix/.test(x.texte)));
  });

  it('repère un mois nettement plus cher que les autres', () => {
    const ops = [...mensuel('2025-09', 200), ...mensuel('2025-10', 220), ...mensuel('2025-11', 210), ...mensuel('2025-12', 900), ...mensuel('2026-02', 5)];
    const p = recommandations(ops, ctx({ ref: '2026-02-11' })).find((x) => x.id === 'pic')!;
    assert.match(p.titre, /Décembre 2025/);
  });

  it('ne propose pas les frais bancaires comme paiements récurrents', () => {
    const ops = ['2025-09', '2025-10', '2025-11', '2025-12'].flatMap((m) => [op('entree', `${m}-01`, 1000, 'Salaire'), op('sortie', `${m}-28`, 1, 'ACCOUNT MAINTENANCE FEE')]);
    assert.ok(!recommandations(ops, ctx()).some((x) => x.id === 'reguliers'));
  });

  it('signale une sortie isolée qui écrase le reste', () => {
    const ops = [op('entree', '2025-10-01', 5000, 'Salaire'), ...Array.from({ length: 11 }, (_, i) => op('sortie', `2025-10-${10 + i}`, 10, `Petit ${i}`)), op('sortie', '2025-10-25', 900, 'Réparation toit')];
    const g = recommandations(ops, ctx()).find((x) => x.id === 'grosse')!;
    assert.match(g.texte, /900 \$ le 25\/10\/2025 \(Réparation toit\)/);
  });
});
