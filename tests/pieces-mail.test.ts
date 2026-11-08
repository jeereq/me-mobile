import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ajouterPieces, type AnalysePiece, avecPieces, depenseDeLaPiece, genreApercu, lignesMontrees, MAX_PIECES, MAX_PIECES_OCTETS, tableauTsv } from '../src/lib/pieces-mail.ts';

const f = (nom: string, taille?: number) => ({ uri: `file:///${nom}`, nom, type: 'application/pdf', taille });

describe('joindre des fichiers', () => {
  it('ajoute, sans reprendre un fichier déjà là', () => {
    const r = ajouterPieces([f('a.pdf', 10)], [f('a.pdf', 10), f('b.pdf', 20)]);
    assert.deepEqual(r.liste.map((x) => x.nom), ['a.pdf', 'b.pdf']);
    assert.equal(r.refus, null);
  });
  it('garde deux fichiers de même nom et de tailles différentes', () => {
    assert.equal(ajouterPieces([f('a.pdf', 10)], [f('a.pdf', 11)]).liste.length, 2);
  });
  it('s’arrête à la limite du nombre de fichiers', () => {
    const r = ajouterPieces([], Array.from({ length: MAX_PIECES + 2 }, (_, i) => f(`${i}.pdf`, 1)));
    assert.equal(r.liste.length, MAX_PIECES);
    assert.match(r.refus ?? '', /10 pièces/);
  });
  it('s’arrête à la limite de poids, mais garde ce qui tient', () => {
    const r = ajouterPieces([f('a.pdf', MAX_PIECES_OCTETS - 5)], [f('gros.pdf', 10), f('petit.pdf', 5)]);
    assert.deepEqual(r.liste.map((x) => x.nom), ['a.pdf', 'petit.pdf']);
    assert.match(r.refus ?? '', /gros\.pdf/);
  });
  it('refuse un fichier vide, accepte une taille inconnue', () => {
    assert.match(ajouterPieces([], [f('vide.pdf', 0)]).refus ?? '', /vide/);
    assert.equal(ajouterPieces([], [f('inconnu.pdf')]).liste.length, 1);
  });
  it('dit ce qui part', () => {
    assert.equal(avecPieces(0), '');
    assert.equal(avecPieces(1), ' avec 1 pièce jointe');
    assert.equal(avecPieces(3), ' avec 3 pièces jointes');
  });
});

describe('ce qui se montre dans l’app', () => {
  it('reconnaît les photos, les PDF et les textes à leur type', () => {
    assert.equal(genreApercu({ nom: 'x', type: 'application/pdf' }), 'pdf');
    assert.equal(genreApercu({ nom: 'x', type: 'image/PNG' }), 'image');
    assert.equal(genreApercu({ nom: 'x', type: 'image/jpeg; name=a' }), 'image');
    assert.equal(genreApercu({ nom: 'x', type: 'text/csv' }), 'tableur');
    assert.equal(genreApercu({ nom: 'releve.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'tableur');
    assert.equal(genreApercu({ nom: 'releve.csv', type: 'application/vnd.ms-excel' }), 'tableur');
    assert.equal(genreApercu({ nom: 'note.txt', type: 'text/plain' }), 'texte');
  });
  it('regarde l’extension si le type ne dit rien', () => {
    assert.equal(genreApercu({ nom: 'devis.PDF', type: 'application/octet-stream' }), 'pdf');
    assert.equal(genreApercu({ nom: 'photo.jpg' }), 'image');
    assert.equal(genreApercu({ nom: 'liste.csv', type: '' }), 'tableur');
    assert.equal(genreApercu({ nom: 'releve.XLSX' }), 'tableur');
    assert.equal(genreApercu({ nom: 'ancien.xls', type: 'application/vnd.ms-excel' }), null);
  });
  it('ne montre jamais un format actif, même mal nommé', () => {
    assert.equal(genreApercu({ nom: 'page.html', type: 'text/html' }), null);
    assert.equal(genreApercu({ nom: 'devis.pdf', type: 'text/html' }), null);
    assert.equal(genreApercu({ nom: 'logo.svg', type: 'image/svg+xml' }), null);
    assert.equal(genreApercu({ nom: 'logo.svg' }), null);
    assert.equal(genreApercu({ nom: 'contrat.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), null);
    assert.equal(genreApercu({ nom: 'sans-extension' }), null);
  });
});


describe('analyse d’une pièce jointe', () => {
  const t = { colonnes: ['Date', 'Libellé'], lignes: [['01/10', 'Achat\tKin']], totalLignes: 1 };
  it('dit combien de lignes sont montrées', () => {
    assert.equal(lignesMontrees(t), '1 ligne');
    assert.equal(lignesMontrees({ ...t, totalLignes: 512 }), '1 ligne sur 512');
  });
  it('copie le tableau pour un tableur', () => {
    assert.equal(tableauTsv(t), 'Date\tLibellé\n01/10\tAchat Kin');
  });
  it('prépare la dépense sans rien ajouter', () => {
    const a: AnalysePiece = { nature: 'facture', titre: 'Facture SNEL', resume: null, champs: [], echeance: null, tableau: null, depense: { montant: 45.5, devise: 'USD', date: null, marchand: 'SNEL', description: 'Électricité' } };
    assert.deepEqual(depenseDeLaPiece(a, 7), { ajout: '7', montant: '45,5', note: 'SNEL : Électricité' });
    assert.equal(depenseDeLaPiece({ ...a, depense: null }, 7), null);
    assert.equal(depenseDeLaPiece({ ...a, depense: { ...a.depense!, marchand: null, description: null } }, 7)?.note, 'Facture SNEL');
  });
});
