import assert from 'node:assert/strict';
import { test } from 'node:test';

import { garderInvitation, invitationGardee, oublierInvitation, type Stockage } from '../src/lib/invitation-stock.ts';

const faux = (): Stockage & { m: Map<string, string> } => {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};
const JOUR = 24 * 60 * 60 * 1000;

test('le jeton gardé se retrouve après un rechargement de la page', () => {
  const st = faux();
  garderInvitation(st, 'abc', 1000);
  assert.equal(invitationGardee(st, 1000 + JOUR), 'abc');
});

test('un jeton de plus de 8 jours est périmé et effacé', () => {
  const st = faux();
  garderInvitation(st, 'abc', 0);
  assert.equal(invitationGardee(st, 9 * JOUR), null);
  assert.equal(st.m.size, 0);
});

test('accepter, refuser ou une invitation périmée : on oublie le jeton', () => {
  const st = faux();
  garderInvitation(st, 'abc', 0);
  oublierInvitation(st);
  assert.equal(invitationGardee(st, 1), null);
});

test('contenu illisible : ignoré et effacé, sans erreur', () => {
  const st = faux();
  st.setItem('me:invitation', '{pas du json');
  assert.equal(invitationGardee(st), null);
  assert.equal(st.m.size, 0);
  st.setItem('me:invitation', JSON.stringify({ jeton: 42, le: 'x' }));
  assert.equal(invitationGardee(st), null);
});

test('sans stockage, ou stockage qui refuse : aucune erreur', () => {
  garderInvitation(null, 'abc');
  assert.equal(invitationGardee(null), null);
  oublierInvitation(null);
  const casse: Stockage = { getItem: () => { throw new Error('refusé'); }, setItem: () => { throw new Error('refusé'); }, removeItem: () => { throw new Error('refusé'); } };
  garderInvitation(casse, 'abc');
  assert.equal(invitationGardee(casse), null);
  oublierInvitation(casse);
});
