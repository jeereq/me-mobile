import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { operationsDe } from '../src/lib/analyse-operations.ts';
import { creerVirement, listeVirements, virements } from '../src/lib/comptes.ts';
import { bilan, revenusEntre } from '../src/lib/finances.ts';
import type { Finances } from '../src/lib/types.ts';

const f: Finances = { devise: '€', budgets: [], depenses: [], revenus: [], comptes: [{ id: 'a', nom: 'Equity', emoji: '🏦' }, { id: 'b', nom: 'M-Pesa', emoji: '📱' }] };

describe('virements entre mes comptes', () => {
  it('note les deux moitiés, déjà liées, sans dépense ni revenu', () => {
    const g = creerVirement(f, { id: 'v1', de: 'a', vers: 'b', montant: 200, recu: 198, date: '2026-10-20', creeLe: '' })!;
    assert.equal(g.depenses.length, 1);
    assert.equal(g.revenus!.length, 1);
    assert.equal(g.depenses[0].note, 'Virement vers M-Pesa');
    assert.equal(bilan(g, 'mois', '2026-10-20', '2026-10-27').total, 0);
    assert.equal(revenusEntre(g, '2026-10-01', '2026-10-31').length, 0);
    assert.equal(virements(operationsDe(g)).nb, 1);
  });
  it('liste chaque virement une fois, de quel compte vers quel compte, frais compris', () => {
    const g = creerVirement(creerVirement(f, { id: 'v1', de: 'a', vers: 'b', montant: 200, recu: 198, date: '2026-10-20', creeLe: '' })!, { id: 'v2', de: 'b', vers: 'a', montant: 50, date: '2026-10-25', creeLe: '' })!;
    const l = listeVirements(operationsDe(g));
    assert.deepEqual(
      l.map((x) => [x.de, x.vers, x.montant, x.frais]),
      [
        ['b', 'a', 50, 0],
        ['a', 'b', 200, 2],
      ],
    );
  });
  it('refuse un virement vers le même compte', () => {
    assert.equal(creerVirement(f, { id: 'v', de: 'a', vers: 'a', montant: 10, date: '2026-10-20', creeLe: '' }), null);
  });
});
