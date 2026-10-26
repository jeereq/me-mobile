import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { candidatsRevenu, lireReleve } from '../src/lib/releve.ts';
import type { Finances } from '../src/lib/types.ts';

const releve = 'Date;Libellé;Montant\n03/11/2026;VIR SALAIRE ACME;1500,00\n05/11/2026;VIR REMBOURSEMENT;42,00\n06/11/2026;CB CARREFOUR;-30,00';
const f = (revenus: Finances['revenus']): Finances => ({ devise: '€', budgets: [], depenses: [], revenus });
const salaire = { id: 'rec:2026-11-01', montant: 1500, note: 'Salaire', date: '2026-11-01', creeLe: '', recurrence: 'rec' };

describe('entrées d’un relevé liées aux revenus déjà notés', () => {
  it('lie une entrée au revenu du même montant, à quelques jours près', () => {
    const r = lireReleve(releve, f([salaire]), '2026-11-10');
    const l = r.lignes.find((x) => x.libelle.toLowerCase().includes('salaire'));
    assert.equal(l?.revenu, 'rec:2026-11-01');
    assert.equal(l?.doublon, false);
    assert.equal(r.lignes.find((x) => x.libelle.toLowerCase().includes('rembours'))?.revenu ?? null, null);
  });
  it('ne lie pas un revenu déjà rattaché à la banque', () => {
    const r = lireReleve(releve, f([{ ...salaire, reference: 'ref-1' }]), '2026-11-10');
    assert.equal(r.lignes.find((x) => x.libelle.toLowerCase().includes('salaire'))?.revenu ?? null, null);
  });
  it('retrouve comme doublon une entrée déjà liée, au réimport', () => {
    const r = lireReleve(releve, f([{ ...salaire, date: '2026-11-03', compte: 'c1' }]), '2026-11-10', { compte: 'c1' });
    const l = r.lignes.find((x) => x.libelle.toLowerCase().includes('salaire'));
    assert.equal(l?.revenu ?? null, null);
    assert.equal(l?.doublon, true);
  });
  it('ne lie un revenu qu’à une seule entrée', () => {
    const deux = 'Date;Libellé;Montant\n02/11/2026;VIR A;1500,00\n03/11/2026;VIR B;1500,00';
    const r = lireReleve(deux, f([salaire]), '2026-11-10');
    assert.equal(r.lignes.filter((x) => x.revenu).length, 1);
  });
  it('propose les revenus proches, le montant le plus proche d’abord', () => {
    const c = candidatsRevenu(f([salaire, { id: 'p', montant: 40, note: 'Prime', date: '2026-11-04', creeLe: '' }]), '2026-11-05', 42);
    assert.deepEqual(c.map((x) => x.id), ['p', 'rec:2026-11-01']);
  });
});
