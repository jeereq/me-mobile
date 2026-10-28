import assert from 'node:assert/strict';
import { test } from 'node:test';

import { statutInvitation } from '../src/lib/invitations-liste.ts';

const base = { email: 'paul@exemple.fr' };

test('lien jamais ouvert', () => {
  assert.deepEqual(statutInvitation({ ...base, etat: 'envoyee' }), { alerte: false, texte: 'Lien pas encore ouvert.' });
  // Un ancien serveur n’envoie pas l’état : on reste sur « pas encore ouvert ».
  assert.equal(statutInvitation({ ...base }).texte, 'Lien pas encore ouvert.');
});

test('lien ouvert avec le bon compte : il reste à cliquer sur Rejoindre', () => {
  const s = statutInvitation({ ...base, etat: 'ouverte', ouverteLe: '2026-10-30T08:00:00.000Z' });
  assert.equal(s.alerte, false);
  assert.match(s.texte, /Lien ouvert le .+ pas encore cliqué sur « Rejoindre/);
});

test('lien ouvert avec une autre adresse : alerte, et l’autre adresse est proposée', () => {
  const s = statutInvitation({ ...base, etat: 'autre_compte', ouverteLe: '2026-10-30T08:00:00.000Z', ouvertePar: 'paul.perso@gmail.com' });
  assert.equal(s.alerte, true);
  assert.equal(s.autreAdresse, 'paul.perso@gmail.com');
  assert.match(s.texte, /avec paul\.perso@gmail\.com, qui n’est pas paul@exemple\.fr/);
});
