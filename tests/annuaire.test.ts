import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FILTRES_VIDES, nombreFiltres, requeteAnnuaire, TRANCHES_MONTANT } from '../src/lib/annuaire';

test('la requête ne porte que les filtres choisis', () => {
  assert.equal(requeteAnnuaire('  ', FILTRES_VIDES), '');
  assert.equal(requeteAnnuaire(' Gombe ', { mode: 'rotation', rythme: 'mensuel', montant: null }), 'q=Gombe&mode=rotation&rythme=mensuel');
  assert.equal(requeteAnnuaire('', { ...FILTRES_VIDES, montant: 'CDF-50000' }), 'devise=CDF&montantMax=5000000');
});

test('compte les filtres actifs', () => {
  assert.equal(nombreFiltres(FILTRES_VIDES), 0);
  assert.equal(nombreFiltres({ ...FILTRES_VIDES, rythme: 'unique', montant: TRANCHES_MONTANT[0].key }), 2);
});
