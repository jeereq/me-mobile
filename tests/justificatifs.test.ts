import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { vuesJustificatif, cleDevise, detailJustificatif, type LectureFacture, refus, remplissage, tailleLisible, typeDe } from '../src/lib/justificatifs.ts';

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

describe('lecture des factures par l’IA', () => {
  const lu: LectureFacture = { facture: true, montant: 42.5, devise: 'USD', date: '2026-10-30', heure: '09:05', marchand: 'Carrefour', description: 'Courses', categorie: 'c1', confiance: 'haute' };

  it('retrouve la devise de l’app depuis le code lu', () => {
    assert.equal(cleDevise('USD'), '$');
    assert.equal(cleDevise('eur'), '€');
    assert.equal(cleDevise('XOF'), 'FCFA');
    assert.equal(cleDevise('CDF'), 'CDF');
    assert.equal(cleDevise('XYZ'), null);
    assert.equal(cleDevise(null), null);
  });

  it('remplit montant, date, heure, note et catégorie', () => {
    const r = remplissage(lu, '$', ['c1', 'c2']);
    assert.equal(r.montant, '42,50');
    assert.equal(remplissage({ ...lu, montant: 12000 }, '$').montant, '12000');
    assert.equal(r.devise, undefined);
    assert.equal(r.date, '2026-10-30');
    assert.equal(r.heure, '09:05');
    assert.equal(r.note, 'Carrefour · Courses');
    assert.deepEqual(r.categories, ['c1']);
    assert.equal(r.aRelire, false);
    assert.match(r.message, /^Le montant, la date, le commerçant et la catégorie ont été remplis/);
  });

  it('change de devise quand la facture est dans une autre', () => {
    assert.equal(remplissage({ ...lu, devise: 'CDF' }, '$').devise, 'CDF');
  });

  it('ignore une catégorie supprimée entre-temps', () => {
    assert.equal(remplissage(lu, '$', ['c2']).categories, undefined);
  });

  it('demande de relire quand le total manque ou que l’image est floue', () => {
    const sans = remplissage({ ...lu, montant: null }, '$', ['c1']);
    assert.equal(sans.montant, undefined);
    assert.equal(sans.aRelire, true);
    assert.match(sans.message, /total n'a pas pu être lu/);
    assert.equal(remplissage({ ...lu, confiance: 'basse' }, '$').aRelire, true);
    assert.match(remplissage({ ...lu, devise: 'XYZ' }, '$').message, /XYZ/);
  });

  it('ne remplit rien quand ce n’est pas une facture', () => {
    const r = remplissage({ ...lu, facture: false }, '$');
    assert.equal(r.montant, undefined);
    assert.match(r.message, /ne voit pas de facture/);
  });
});

describe('adresses d’un justificatif', () => {
  const liens = { apercu: 'a', grand: 'g', fichier: 'f' };
  it('préfère les liens temporaires', () => {
    assert.deepEqual(vuesJustificatif({ url: '', apercu: undefined }, liens), liens);
  });
  it('retombe sur l’ancienne adresse', () => {
    const v = vuesJustificatif({ url: 'https://c/x.pdf', apercu: 'https://c/c_fill,w_240,h_240,pg_1/x.jpg' }, null);
    assert.equal(v.fichier, 'https://c/x.pdf');
    assert.equal(v.grand, 'https://c/c_limit,w_1200,h_1200,pg_1/x.jpg');
  });
  it('sans rien, n’invente pas d’adresse vide', () => {
    assert.deepEqual(vuesJustificatif({ url: '' }, null), { apercu: undefined, grand: undefined, fichier: undefined });
  });
});
