import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detailJustificatif, refus, tailleLisible, typeDe } from '../src/lib/justificatifs.ts';

describe('justificatifs', () => {
  it('écrit la taille en clair', () => {
    assert.equal(tailleLisible(200), '1 Ko');
    assert.equal(tailleLisible(340 * 1024), '340 Ko');
    assert.equal(tailleLisible(2.44 * 1024 * 1024), '2,4 Mo');
  });

  it('devine le type quand le téléphone ne le donne pas', () => {
    assert.equal(typeDe('Facture.PDF', 'application/octet-stream'), 'application/pdf');
    assert.equal(typeDe('recu.png', null), 'image/png');
    assert.equal(typeDe('IMG_0001.HEIC'), 'image/heic');
    assert.equal(typeDe('photo', undefined), 'image/jpeg');
    assert.equal(typeDe('x.pdf', 'image/jpeg'), 'image/jpeg');
  });

  it('refuse ce qui n’est ni photo ni PDF, et ce qui est trop lourd', () => {
    assert.equal(refus({ uri: 'f', nom: 'recu.jpg', type: 'image/jpeg', taille: 2e6 }), null);
    assert.equal(refus({ uri: 'f', nom: 'facture.pdf', type: '' }), null);
    assert.match(refus({ uri: 'f', nom: 'notes.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })!, /ni une photo ni un PDF/);
    assert.match(refus({ uri: 'f', nom: 'scan.pdf', type: 'application/pdf', taille: 12 * 1024 * 1024 })!, /trop lourd \(12 Mo/);
  });

  it('résume un justificatif sous sa vignette', () => {
    const base = { id: 'me/j/u1/a', url: 'https://x', nom: 'a', ajouteLe: '2026-10-28T08:00:00Z' };
    assert.equal(detailJustificatif({ ...base, sorte: 'pdf', taille: 340 * 1024, pages: 3 }), 'PDF · 3 pages · 340 Ko');
    assert.equal(detailJustificatif({ ...base, sorte: 'image', taille: 1.2 * 1024 * 1024 }), 'Photo · 1,2 Mo');
  });
});
