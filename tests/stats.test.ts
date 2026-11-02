import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilan } from '../src/lib/finances.ts';
import { statistiques } from '../src/lib/stats.ts';
import type { Espace, Finances } from '../src/lib/types.ts';

const d = '2026-10-27';
const dep = (id: string, date: string, montant: number, extra: object = {}) => ({ id, date, montant, note: 'x', budget: null, creeLe: `${date}T10:00`, ...extra });
const espace = (finances: unknown): Espace =>
  ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: {}, majLe: '', finances }) as unknown as Espace;

describe('statistiques : dépenses', () => {
  // Une vraie dépense, une moitié de virement entre mes comptes, et un versement vers un objectif noté comme dépense.
  const f = {
    devise: '€',
    budgets: [],
    revenus: [],
    depenses: [dep('a', '2026-10-20', 50), dep('v', '2026-10-21', 200, { lien: 'r1' }), dep('o', '2026-10-22', 100)],
    objectifs: [{ id: 'obj', nom: 'Vacances', emoji: '✈️', genre: 'epargne', cible: 1000, debut: '2026-10-01', echeance: '2027-06-01', versements: [{ id: 'x', date: '2026-10-22', montant: 100, depense: 'o' }] }],
  };

  it('ne compte ni les virements ni les versements vers un objectif', () => {
    const s = statistiques(espace(f), d, 30);
    assert.equal(s.tuiles.depenses.v, 50);
  });

  it('donne le même total que l’écran Finances sur le mois', () => {
    const s = statistiques(espace(f), d, 27);
    assert.equal(s.tuiles.depenses.v, bilan(f as unknown as Finances, 'mois', d, d).total);
    assert.equal(s.depensesMois.at(-1)!.v, 50);
  });
});
