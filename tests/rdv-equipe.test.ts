import assert from 'node:assert/strict';
import { test } from 'node:test';

import { avecRdv, erreurRdv, estRdvLocal, heureComplete, idRdvLocal, rdvDeSaisie, sansRdv } from '../src/lib/rdv-equipe.ts';

const saisie = { titre: ' Point client ', jour: '2026-11-04', journee: false, debut: '9:30', fin: '10h30' };

test('seuls les rendez-vous créés dans Me sont modifiables ici', () => {
  assert.equal(estRdvLocal(idRdvLocal()), true);
  assert.equal(estRdvLocal('ext:c1:abc'), false);
  assert.equal(estRdvLocal(undefined), false);
  assert.notEqual(idRdvLocal(), idRdvLocal());
});

test('les heures s’écrivent à la française et se complètent', () => {
  assert.equal(heureComplete('9:30'), '09:30');
  assert.equal(heureComplete('14h05'), '14:05');
  assert.equal(heureComplete('24:00'), null);
  assert.equal(heureComplete('9h75'), null);
  assert.equal(heureComplete(''), null);
});

test('ce qui empêche d’enregistrer est dit en clair', () => {
  assert.equal(erreurRdv(saisie), null);
  assert.match(erreurRdv({ ...saisie, titre: '  ' }) ?? '', /titre/);
  assert.match(erreurRdv({ ...saisie, jour: null }) ?? '', /jour/);
  assert.match(erreurRdv({ ...saisie, debut: '25:00' }) ?? '', /début/);
  assert.match(erreurRdv({ ...saisie, fin: 'tard' }) ?? '', /fin/);
  assert.match(erreurRdv({ ...saisie, fin: '09:00' }) ?? '', /après le début/);
  // Une fin vide est permise ; une journée entière n’a pas d’heures.
  assert.equal(erreurRdv({ ...saisie, fin: '' }), null);
  assert.equal(erreurRdv({ ...saisie, journee: true, debut: 'xx', fin: 'yy' }), null);
});

test('le rendez-vous gardé : heures complétées, propriétaire, journée entière', () => {
  const ev = rdvDeSaisie('me:1', saisie, ' Bureau ', { affecteA: 'u1', responsable: 'Alice' });
  assert.deepEqual(ev, { id: 'me:1', debut: '09:30', fin: '10:30', titre: 'Point client', lieu: 'Bureau', calendrier: 'pro', affecteA: 'u1', responsable: 'Alice' });
  const jour = rdvDeSaisie('me:2', { ...saisie, journee: true }, '', {});
  assert.deepEqual(jour, { id: 'me:2', debut: 'Journée', titre: 'Point client', calendrier: 'pro' });
});

test('l’agenda : ajouter, trier par heure, déplacer, retirer', () => {
  const a = rdvDeSaisie('me:a', { ...saisie, debut: '14:00', fin: '' }, '', {});
  const b = rdvDeSaisie('me:b', { ...saisie, titre: 'Café', debut: '08:00', fin: '' }, '', {});
  let ag = avecRdv({}, '2026-11-04', a);
  ag = avecRdv(ag, '2026-11-04', b);
  assert.deepEqual(ag['2026-11-04'].map((x) => x.id), ['me:b', 'me:a']);
  // Modifier en changeant de jour : l’ancien emplacement est vidé.
  ag = avecRdv(ag, '2026-11-06', { ...a, titre: 'Point déplacé' });
  assert.deepEqual(Object.keys(ag).sort(), ['2026-11-04', '2026-11-06']);
  assert.deepEqual(ag['2026-11-04'].map((x) => x.id), ['me:b']);
  assert.equal(ag['2026-11-06'][0].titre, 'Point déplacé');
  // Modifier sans changer de jour : pas de doublon.
  ag = avecRdv(ag, '2026-11-06', { ...a, titre: 'Encore' });
  assert.equal(ag['2026-11-06'].length, 1);
  // Retirer le dernier d’un jour supprime le jour ; les autres jours ne bougent pas.
  const sans = sansRdv(ag, 'me:a');
  assert.deepEqual(Object.keys(sans), ['2026-11-04']);
  assert.equal(sansRdv(sans, 'inconnu')['2026-11-04'].length, 1);
});

test('ajouter ne touche pas l’agenda d’origine ni les rendez-vous importés', () => {
  const importe = { id: 'ext:c1:x', debut: '10:00', titre: 'Importé' };
  const origine = { '2026-11-04': [importe] };
  const ag = avecRdv(origine, '2026-11-04', rdvDeSaisie('me:1', saisie, '', {}));
  assert.equal(origine['2026-11-04'].length, 1);
  assert.deepEqual(ag['2026-11-04'].map((x) => x.id), ['me:1', 'ext:c1:x']);
});
