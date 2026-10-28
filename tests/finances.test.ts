import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decaler, decalagePour, periodePourDates, suiviPlan } from '../src/lib/finances.ts';

test('plan de dépenses : prévu, dépensé et reste par poste', () => {
  const b = { id: 'b1', nom: 'Vacances', emoji: '🏖️', montant: 1000, periode: 'mois' as const, plan: [
    { id: 'p1', nom: 'Billets', montant: 600 },
    { id: 'p2', nom: 'Hôtel', montant: 300 },
  ] };
  const dep = (id: string, montant: number, poste?: string) => ({ id, montant, budget: 'b1', poste, note: '', date: '2026-10-10', creeLe: '' });
  const s = suiviPlan(b, [dep('d1', 200, 'p1'), dep('d2', 400, 'p2'), dep('d3', 50)], 1000)!;
  assert.equal(s.total, 900);
  assert.equal(s.nonAffecte, 100);
  assert.equal(s.horsPostes, 50);
  assert.deepEqual(s.postes.map((x) => [x.poste.nom, x.prevu, x.depense, x.reste]), [['Billets', 600, 200, 400], ['Hôtel', 300, 400, -100]]);
});

test('plan de dépenses : les prévus suivent le plafond de la période affichée', () => {
  const b = { id: 'b1', nom: 'Courses', emoji: '🛒', montant: 400, periode: 'mois' as const, plan: [{ id: 'p1', nom: 'Marché', montant: 100 }] };
  // Budget mensuel regardé à la semaine : le plafond vaut un quart, le prévu du poste aussi.
  const s = suiviPlan(b, [], 100)!;
  assert.equal(s.postes[0].prevu, 25);
});

test('sans plan, suiviPlan ne renvoie rien', () => {
  assert.equal(suiviPlan({ id: 'b', nom: 'X', emoji: '💰', montant: 10, periode: 'mois' }, [], 10), null);
});

test('plan de dépenses : les dates d’un poste disent s’il est à venir, en cours ou terminé', () => {
  const b = {
    id: 'b1',
    nom: 'Vacances',
    emoji: '🏖️',
    montant: 900,
    periode: 'mois' as const,
    plan: [
      { id: 'p1', nom: 'Billets', montant: 300, debut: '2026-10-01', fin: '2026-10-10' },
      { id: 'p2', nom: 'Hôtel', montant: 300, debut: '2026-10-15', fin: '2026-10-25' },
      { id: 'p3', nom: 'Repas', montant: 300, fin: '2026-10-18' },
    ],
  };
  const dep = (id: string, montant: number, poste: string) => ({ id, montant, budget: 'b1', poste, note: '', date: '2026-10-05', creeLe: '' });
  // Le 20 octobre : « Billets » est terminé sans tout dépenser, « Hôtel » court encore, « Repas » est terminé et dépassé.
  const s = suiviPlan(b, [dep('d1', 200, 'p1'), dep('d2', 100, 'p2'), dep('d3', 360, 'p3')], 900, '2026-10-20')!;
  assert.deepEqual(s.postes.map((x) => x.etat), ['termine', 'encours', 'termine']);
  assert.deepEqual(s.postes.map((x) => x.resteApres), [true, false, false]);
  assert.deepEqual(s.postes.map((x) => x.depasse), [false, false, true]);
  assert.deepEqual([s.enCours.length, s.aVenir.length, s.termines.length], [1, 0, 2]);
});

test('plan de dépenses : un poste qui n’a pas commencé est « à venir »', () => {
  const b = { id: 'b1', nom: 'Noël', emoji: '🎁', montant: 200, periode: 'mois' as const, plan: [{ id: 'p1', nom: 'Cadeaux', montant: 200, debut: '2026-12-01' }] };
  const s = suiviPlan(b, [], 200, '2026-10-20')!;
  assert.equal(s.postes[0].etat, 'avenir');
  assert.equal(s.aVenir.length, 1);
});

test('ecartPeriodes : le décalage qui mène à la période d’une date', async () => {
  const { decaler, ecartPeriodes, bornes } = await import('../src/lib/finances.ts');
  const cas: [Parameters<typeof ecartPeriodes>[0], string, string, number][] = [
    ['mois', '2026-10-28', '2026-09-05', -1],
    ['mois', '2026-10-28', '2025-12-31', -10],
    ['semaine', '2026-10-28', '2026-10-19', -1],
    ['jour', '2026-10-28', '2026-10-30', 2],
    ['trimestre', '2026-10-28', '2026-03-01', -3],
    ['annee', '2026-10-28', '2024-06-01', -2],
  ];
  for (const [p, de, vers, n] of cas) {
    assert.equal(ecartPeriodes(p, de, vers), n, `${p} ${vers}`);
    const { debut, fin } = bornes(p, decaler(p, de, n));
    assert.ok(vers >= debut && vers <= fin);
  }
});

test('dépense importée liée à un budget : elle compte dans le budget de sa période, pas dans celle affichée', async () => {
  const { bilan } = await import('../src/lib/finances.ts');
  const f = { devise: '€', budgets: [{ id: 'c', nom: 'Courses', emoji: '🛒', montant: 400, periode: 'mois' as const }], depenses: [
    { id: 'd1', montant: 45.2, budget: 'c', note: 'Carrefour', date: '2026-09-12', creeLe: '', reference: 'r1', compte: 'k' },
    { id: 'd2', montant: 30, budget: 'c', note: 'Lidl', date: '2026-10-05', creeLe: '', reference: 'r2', compte: 'k' },
  ] };
  assert.deepEqual(bilan(f, 'mois', '2026-10-28', '2026-10-28').lignes.map((l) => [l.depense, l.reste]), [[30, 370]]);
  assert.deepEqual(bilan(f, 'mois', '2026-09-28', '2026-10-28').lignes.map((l) => [l.depense, l.reste]), [[45.2, 354.8]]);
test('après un import : la période qui contient les dépenses importées', () => {
  // Aujourd'hui le 28 octobre 2026, vue Mois sur octobre : un relevé de septembre n'y change rien, on passe à septembre.
  assert.deepEqual(periodePourDates('mois', '2026-10-28', '2026-10-28', ['2026-09-03', '2026-09-20']), { vue: 'mois', decal: -1 });
  // Une des dates est déjà dans la période affichée : on ne bouge pas.
  assert.equal(periodePourDates('mois', '2026-10-28', '2026-10-28', ['2026-09-20', '2026-10-02']), null);
  // Plusieurs mois : la date la plus récente décide.
  assert.deepEqual(periodePourDates('mois', '2026-10-28', '2026-10-28', ['2026-06-10', '2026-08-15']), { vue: 'mois', decal: -2 });
  // Un jour ou une semaine est trop court pour un relevé : on passe au mois.
  assert.deepEqual(periodePourDates('jour', '2026-10-28', '2026-10-28', ['2026-09-12']), { vue: 'mois', decal: -1 });
  // Vue Année : l'année précédente, d'une année à l'autre.
  assert.deepEqual(periodePourDates('annee', '2026-10-28', '2026-10-28', ['2025-12-30']), { vue: 'annee', decal: -1 });
  // Rien d'importé : rien à afficher.
  assert.equal(periodePourDates('mois', '2026-10-28', '2026-10-28', []), null);
});

test('décalage en périodes entre aujourd’hui et une date', () => {
  assert.equal(decalagePour('mois', '2026-10-28', '2026-01-05'), -9);
  assert.equal(decalagePour('trimestre', '2026-10-28', '2026-03-31'), -3);
  assert.equal(decalagePour('semaine', '2026-10-28', '2026-10-14'), -2);
  assert.equal(decalagePour('jour', '2026-10-28', '2026-10-30'), 2);
  // Le mois affiché par ce décalage contient bien la date visée.
  assert.equal(decaler('mois', '2026-10-28', decalagePour('mois', '2026-10-28', '2026-03-31')), '2026-03-01');
});
