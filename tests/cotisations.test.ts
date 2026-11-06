import assert from 'node:assert/strict';
import { test } from 'node:test';

import { etatMembre, suiviPeriode, type Cotisation, type MembreCotisation } from '../src/lib/cotisations';

const membre = (id: string, m: Partial<MembreCotisation> = {}): MembreCotisation => ({ id, nom: id, telephone: '243812345678', lien: null, depuis: '2026-10', demandePeriode: null, paiements: [], ...m });
const cotisation = (membres: MembreCotisation[]): Cotisation => ({ id: 'c', titre: 'Tontine', montant: 1000, devise: 'USD', rythme: 'mensuel', archive: false, periode: '2026-11', periodes: ['2026-10', '2026-11'], encaisse: 0, membres });

test('état d’un membre selon la période', () => {
  const paye = membre('a', { paiements: [{ periode: '2026-11', statut: 'paye', mode: 'mobile', montant: 1000 }] });
  assert.equal(etatMembre(paye, '2026-11'), 'paye');
  assert.equal(etatMembre(paye, '2026-10'), 'a_payer');
  assert.equal(etatMembre(membre('b', { paiements: [{ periode: '2026-11', statut: 'en_attente', mode: 'mobile', montant: 1000 }] }), '2026-11'), 'en_attente');
  assert.equal(etatMembre(membre('c', { demandePeriode: '2026-11' }), '2026-11'), 'demande');
  assert.equal(etatMembre(membre('d', { depuis: '2026-11' }), '2026-10'), 'hors');
  assert.equal(etatMembre(membre('e', { depuis: 'unique' }), 'unique'), 'a_payer');
});

test('suivi : montants et personnes à relancer', () => {
  const s = suiviPeriode(
    cotisation([
      membre('a', { paiements: [{ periode: '2026-11', statut: 'paye', mode: 'main', montant: 800 }] }),
      membre('b'),
      membre('c', { demandePeriode: '2026-11' }),
      membre('d', { paiements: [{ periode: '2026-11', statut: 'en_attente', mode: 'mobile', montant: 1000 }] }),
    ]),
    '2026-11',
  );
  assert.equal(s.total, 4);
  assert.equal(s.payes, 1);
  assert.equal(s.recu, 800);
  assert.equal(s.reste, 3000);
  assert.deepEqual(s.aDemander.map((m) => m.id), ['b']);
  // Un membre arrivé plus tard ne compte pas pour les périodes d'avant.
  assert.equal(suiviPeriode(cotisation([membre('z', { depuis: '2026-11' })]), '2026-10').total, 0);
});
