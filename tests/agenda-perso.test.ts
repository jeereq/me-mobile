import assert from 'node:assert/strict';
import { test } from 'node:test';

import { agendaPerso, avecAgendaPerso, estAgendaPerso } from '../src/lib/agenda-perso.ts';

const imp = (id: string, date: string, debut: string, titre: string, extra = {}) => ({ id, date, debut, titre, source: 'outlook', ...extra });

test('mes rendez-vous importés, par jour, triés, confiés à moi', () => {
  const a = agendaPerso([imp('ext:c1:b', '2026-11-02', '14:00', 'Revue'), imp('ext:c1:a', '2026-11-02', '09:00', 'Café', { lieu: 'Bureau', agenda: 'Travail', ctx: 'pro', fin: '09:30' }), imp('ext:c2:z', '2026-11-03', 'Journée', 'Congé')], 'u1');
  assert.deepEqual(Object.keys(a).sort(), ['2026-11-02', '2026-11-03']);
  assert.deepEqual(a['2026-11-02'].map((x) => x.id), ['ext:c1:a', 'ext:c1:b']);
  assert.deepEqual(a['2026-11-02'][0], { id: 'ext:c1:a', debut: '09:00', fin: '09:30', titre: 'Café', lieu: 'Bureau', source: 'outlook', calendrier: 'pro', agenda: 'Travail', affecteA: 'u1' });
  assert.equal(a['2026-11-03'][0].affecteA, 'u1');
});

test('sans identifiant de personne ni rendez-vous : rien d’inventé', () => {
  assert.deepEqual(agendaPerso(undefined, 'u1'), {});
  assert.equal('affecteA' in agendaPerso([imp('ext:c1:a', '2026-11-02', '09:00', 'X')])['2026-11-02'][0], false);
});

test('l’agenda de l’équipe avec le mien : fusion triée, sans doublon, sans rien modifier', () => {
  const equipe = { '2026-11-02': [{ id: 'me:1', debut: '10:00', titre: 'Point équipe', affecteA: 'u2' }], '2026-11-05': [{ id: 'me:2', debut: '08:00', titre: 'Autre' }] };
  const perso = agendaPerso([imp('ext:c1:a', '2026-11-02', '09:00', 'Café'), imp('ext:c1:b', '2026-11-04', '11:00', 'Dentiste')], 'u1');
  const vu = avecAgendaPerso(equipe, perso);
  assert.deepEqual(vu['2026-11-02'].map((x) => x.id), ['ext:c1:a', 'me:1']);
  assert.deepEqual(Object.keys(vu).sort(), ['2026-11-02', '2026-11-04', '2026-11-05']);
  // Les originaux ne bougent pas : rien du mien n’entre dans le document partagé.
  assert.equal(equipe['2026-11-02'].length, 1);
  assert.equal(Object.keys(equipe).length, 2);
  // Relire deux fois ne duplique pas.
  assert.equal(avecAgendaPerso(vu, perso)['2026-11-02'].length, 2);
  // Sans agenda perso, l’agenda de l’équipe est rendu tel quel.
  assert.equal(avecAgendaPerso(equipe, {}), equipe);
  assert.deepEqual(avecAgendaPerso(undefined, {}), {});
});

test('un rendez-vous de mon agenda personnel se reconnaît à son identifiant', () => {
  assert.equal(estAgendaPerso('ext:c1:a'), true);
  assert.equal(estAgendaPerso('me:1'), false);
  assert.equal(estAgendaPerso(undefined), false);
});
