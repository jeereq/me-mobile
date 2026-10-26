import assert from 'node:assert/strict';
import { test } from 'node:test';

import { suiviPlan } from '../src/lib/finances.ts';

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
