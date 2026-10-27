import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { estExterne, evenementDeAgenda, refExterne, tacheDeListe } from '../src/lib/externe.ts';

describe('identifiant d’un élément importé', () => {
  it('sépare le compte de l’élément', () => {
    assert.deepEqual(refExterne('ext:abc123:msg789'), { compte: 'abc123', element: 'msg789' });
  });
  it('garde les « : » de l’élément', () => {
    assert.deepEqual(refExterne('ext:abc:todo:liste1:tache2'), { compte: 'abc', element: 'todo:liste1:tache2' });
    assert.deepEqual(refExterne('ext:abc:moi@gmail.com:evt1'), { compte: 'abc', element: 'moi@gmail.com:evt1' });
  });
  it('rejette ce qui n’en est pas un', () => {
    for (const x of ['tache-locale', 'ext:', 'ext:abc', 'ext:abc:', 'ext::elt', '']) assert.equal(refExterne(x), null, x);
    assert.equal(estExterne('ext:a:b'), true);
    assert.equal(estExterne('local'), false);
  });
});

describe('tâche venue d’une liste', () => {
  it('reconnaît Google Tasks et Microsoft To Do', () => {
    assert.deepEqual(tacheDeListe('ext:cpt1:gtask:MDEx:TASK9'), { compte: 'cpt1', liste: 'MDEx', tache: 'TASK9' });
    assert.deepEqual(tacheDeListe('ext:cpt2:todo:AAMk-liste:AAMk-tache'), { compte: 'cpt2', liste: 'AAMk-liste', tache: 'AAMk-tache' });
  });
  it('ignore une tâche qui ne vient pas d’une liste', () => {
    assert.equal(tacheDeListe('ext:cpt1:18f2a3b'), null);
    assert.equal(tacheDeListe('tache-locale'), null);
  });
});

describe('rendez-vous et son agenda', () => {
  it('lit l’agenda contenu dans l’identifiant Google', () => {
    assert.deepEqual(evenementDeAgenda('ext:cpt1:moi@gmail.com:evt123'), { compte: 'cpt1', agenda: 'moi@gmail.com', evenement: 'evt123' });
  });
  it('utilise l’agenda donné quand l’identifiant n’en porte pas (Outlook)', () => {
    assert.deepEqual(evenementDeAgenda('ext:cpt2:AAMkEvt', 'principal'), { compte: 'cpt2', agenda: 'principal', evenement: 'AAMkEvt' });
    assert.equal(evenementDeAgenda('ext:cpt2:AAMkEvt'), null);
  });
  it('ignore un rendez-vous écrit dans Me', () => {
    assert.equal(evenementDeAgenda('e1', 'principal'), null);
  });
});
