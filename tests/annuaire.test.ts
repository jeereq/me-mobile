import assert from 'node:assert/strict';
import { test } from 'node:test';

import { filtresAlerte, FILTRES_VIDES, idDuLien, lignesConfiance, nombreFiltres, requeteAnnuaire, texteAlerte, TRANCHES_MONTANT } from '../src/lib/annuaire';

test('la requête ne porte que les filtres choisis', () => {
  assert.equal(requeteAnnuaire('  ', FILTRES_VIDES), '');
  assert.equal(requeteAnnuaire(' Gombe ', { ...FILTRES_VIDES, mode: 'rotation', rythme: 'mensuel' }), 'q=Gombe&mode=rotation&rythme=mensuel');
  assert.equal(requeteAnnuaire('', { ...FILTRES_VIDES, montant: 'CDF-50000' }), 'devise=CDF&montantMax=5000000');
});

test('compte les filtres actifs', () => {
  assert.equal(nombreFiltres(FILTRES_VIDES), 0);
  assert.equal(nombreFiltres({ ...FILTRES_VIDES, rythme: 'unique', montant: TRANCHES_MONTANT[0].key }), 2);
});

test('demande le tri et les groupes pas encore démarrés', () => {
  assert.equal(requeteAnnuaire('', { ...FILTRES_VIDES, tri: 'places', ouverts: true }), 'tri=places&ouverts=1');
  assert.equal(nombreFiltres({ ...FILTRES_VIDES, tri: 'montant' }), 0);
  assert.equal(nombreFiltres({ ...FILTRES_VIDES, ouverts: true }), 1);
});

test('enregistre une alerte et la décrit', () => {
  const f = filtresAlerte(' Gombe ', { ...FILTRES_VIDES, rythme: 'mensuel', montant: 'USD-10', tri: 'places' });
  assert.deepEqual(f, { q: 'Gombe', rythme: 'mensuel', devise: 'USD', montantMax: 1000 });
  assert.equal(texteAlerte(f), 'Chaque mois, jusqu’à 10 USD, « Gombe »');
  assert.equal(texteAlerte({}), 'Tous les nouveaux groupes');
});

test('retrouve le groupe dans son lien', () => {
  assert.equal(idDuLien('tontine-des-commercants-cm3abc123'), 'cm3abc123');
  assert.equal(idDuLien('cm3abc123'), 'cm3abc123');
  assert.equal(idDuLien('x-<script>'), null);
});

test('dit ce qu’on sait de l’organisateur', () => {
  assert.deepEqual(lignesConfiance({ termines: 2, versements: 18, aTemps: 18, depuis: '2026-03' }), ['2 groupes menés à terme', '18 versements, tous à temps', 'Sur Me depuis mars 2026']);
  assert.deepEqual(lignesConfiance({ termines: 0, versements: 3, aTemps: 2, depuis: null }), ['2 versements à temps sur 3']);
  assert.deepEqual(lignesConfiance({ termines: 0, versements: 1, aTemps: 1, depuis: null }), ['1 versement, à temps']);
  assert.deepEqual(lignesConfiance({ termines: 0, versements: 0, aTemps: 0, depuis: '2026-11' }), ['Premier groupe sur Me', 'Sur Me depuis novembre 2026']);
  assert.deepEqual(lignesConfiance(null), []);
});

