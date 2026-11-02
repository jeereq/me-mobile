import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { destinataires, estAutomatique, facettes, FILTRES_VIDES, filtrerAnalyses, filtrerLot, LOT_SANS_FILTRE, nbFiltres, ongletInitial, parExpediteur, parOnglet, trierAnalyses } from '../src/lib/tri-analyses.ts';

type A = { id: string; action: 'repondre' | 'tache' | 'rien'; urgence: 'haute' | 'normale' | 'basse'; echeance?: string; contact?: string };
const a = (id: string, action: A['action'], urgence: A['urgence'] = 'normale', echeance?: string, contact = ''): A => ({ id, action, urgence, echeance, contact });
const ids = (l: A[]) => l.map((x) => x.id);

describe('tri de l’analyse des mails', () => {
  it('met l’urgent d’abord, puis la date la plus proche, sans changer la liste reçue', () => {
    const l = [a('1', 'repondre', 'basse'), a('2', 'repondre'), a('3', 'repondre', 'normale', '2026-11-20'), a('4', 'repondre', 'normale', '2026-11-05'), a('5', 'repondre', 'haute')];
    assert.deepEqual(ids(trierAnalyses(l)), ['5', '4', '3', '2', '1']);
    assert.equal(l[0].id, '1');
  });
  it('garde l’ordre d’arrivée à égalité', () => {
    assert.deepEqual(ids(trierAnalyses([a('x', 'rien'), a('y', 'rien'), a('z', 'rien')])), ['x', 'y', 'z']);
  });
  it('sépare les réponses, les tâches et le reste', () => {
    const o = parOnglet([a('r', 'repondre'), a('t', 'tache'), a('n', 'rien'), a('r2', 'repondre', 'haute')]);
    assert.deepEqual(ids(o.repondre), ['r2', 'r']);
    assert.deepEqual(ids(o.tache), ['t']);
    assert.deepEqual(ids(o.rien), ['n']);
  });
  it('ouvre le premier onglet qui a du contenu', () => {
    assert.equal(ongletInitial({ repondre: [1], tache: [1], rien: [1] }), 'repondre');
    assert.equal(ongletInitial({ repondre: [], tache: [1], rien: [1] }), 'tache');
    assert.equal(ongletInitial({ repondre: [], tache: [], rien: [1] }), 'rien');
    assert.equal(ongletInitial({ repondre: [], tache: [], rien: [] }), 'repondre');
  });
  it('regroupe par expéditeur, le plus bavard d’abord, sans tenir compte de la casse', () => {
    const g = parExpediteur([a('1', 'rien', 'normale', undefined, 'Ana'), a('2', 'rien', 'normale', undefined, 'vercel[bot]'), a('3', 'rien', 'normale', undefined, 'VERCEL[bot]'), a('4', 'rien', 'normale', undefined, '  ')], (x) => x.contact ?? '');
    assert.deepEqual(g.map((x) => [x.contact, x.analyses.length]), [['vercel[bot]', 2], ['Ana', 1], ['Sans expéditeur', 1]]);
  });
  it('nomme les destinataires d’un envoi, sans doublon', () => {
    assert.equal(destinataires(['Paul']), 'Paul');
    assert.equal(destinataires(['Paul', 'Paul', 'Ana']), 'Paul et Ana');
    assert.equal(destinataires(['Paul', 'Ana', 'Léa']), 'Paul, Ana et 1 autre');
    assert.equal(destinataires(['Paul', 'Ana', 'Léa', 'Max']), 'Paul, Ana et 2 autres');
    assert.equal(destinataires(['']), 'Sans expéditeur');
  });
});

describe('filtres sur les résultats', () => {
  const r = (id: string, o: Record<string, unknown> = {}) => ({ id, urgence: 'normale' as const, resume: 'Résumé', ...o });
  const mails: Record<string, { contact: string; sujet: string; adresse?: string; boite?: string; compte: string }> = {
    a: { contact: 'Paul', sujet: 'Devis du site', adresse: 'paul@x.com', compte: 'moi@x.com' },
    b: { contact: 'Ana', sujet: 'Facture 14', compte: 'moi@x.com' },
    c: { contact: 'Paul', sujet: 'Réunion', boite: 'ventes@x.com', compte: 'moi@x.com' },
  };
  const liste = [r('a', { urgence: 'haute', categorie: 'devis', montant: '8 450 €' }), r('b', { categorie: 'facture', echeance: '2026-11-10', montant: '89 €' }), r('c', { categorie: 'rendez_vous', rdv: { date: '2026-11-12' }, relance: 'r1', resume: 'Élodie confirme' })];
  const de = (id: string) => mails[id];
  const f = (o: object) => ids(filtrerAnalyses(liste as never[], de, { ...FILTRES_VIDES, ...o }) as never[]);
  it('sans filtre, garde tout', () => {
    assert.deepEqual(f({}), ['a', 'b', 'c']);
    assert.equal(nbFiltres(FILTRES_VIDES), 0);
  });
  it('filtre sur ce que le mail contient', () => {
    assert.deepEqual(f({ urgent: true }), ['a']);
    assert.deepEqual(f({ echeance: true }), ['b']);
    assert.deepEqual(f({ montant: true }), ['a', 'b']);
    assert.deepEqual(f({ rdv: true }), ['c']);
    assert.deepEqual(f({ relance: true }), ['c']);
  });
  it('additionne dans une famille et combine les familles', () => {
    assert.deepEqual(f({ categories: ['devis', 'facture'] }), ['a', 'b']);
    assert.deepEqual(f({ categories: ['devis', 'facture'], urgent: true }), ['a']);
    assert.deepEqual(f({ expediteurs: ['Paul'], montant: true }), ['a']);
    assert.equal(nbFiltres({ ...FILTRES_VIDES, urgent: true, categories: ['devis', 'facture'] }), 3);
  });
  it('filtre par boîte, partagée comprise', () => {
    assert.deepEqual(f({ boites: ['ventes@x.com'] }), ['c']);
    assert.deepEqual(f({ boites: ['moi@x.com'] }), ['a', 'b']);
  });
  it('cherche dans l’expéditeur, l’objet et le résumé, sans accents', () => {
    assert.deepEqual(f({ q: 'facture' }), ['b']);
    assert.deepEqual(f({ q: 'REUNION paul' }), ['c']);
    assert.deepEqual(f({ q: 'elodie' }), ['c']);
    assert.deepEqual(f({ q: 'paul@x' }), ['a']);
    assert.deepEqual(f({ q: 'rien' }), []);
  });
  it('ne propose que ce qui existe, le plus fréquent d’abord', () => {
    const x = facettes(liste as never[], de);
    assert.equal(x.urgent, 1);
    assert.equal(x.montant, 2);
    assert.deepEqual(x.expediteurs, [{ cle: 'Paul', nb: 2 }, { cle: 'Ana', nb: 1 }]);
    assert.deepEqual(x.boites, [{ cle: 'moi@x.com', nb: 2 }, { cle: 'ventes@x.com', nb: 1 }]);
    assert.equal(x.categories.length, 3);
  });
});

describe('filtres avant l’analyse', () => {
  it('reconnaît les mails automatiques', () => {
    for (const m of [{ contact: 'vercel[bot]', adresse: 'notifications@github.com' }, { contact: 'Banque', adresse: 'no-reply@rawbank.cd' }, { adresse: 'noreply@x.com' }, { adresse: 'donotreply@x.com' }, { adresse: 'mailer-daemon@x.com' }, { contact: 'Mail Delivery', adresse: 'bounce@x.com' }, { adresse: 'newsletter@x.com' }, { adresse: 'alerts@x.com' }, { adresse: 'no-reply+abc@x.com' }, { contact: 'Service (no-reply)', adresse: 'info@x.com' }]) assert.equal(estAutomatique(m), true, JSON.stringify(m));
  });
  it('ne prend pas une personne pour un robot', () => {
    for (const m of [{ contact: 'Paul Kasongo', adresse: 'paul@x.com' }, { contact: 'Alerte Dupont', adresse: 'alerte.dupont@x.com' }, { adresse: 'notification.claire@x.com' }, { contact: 'Robot', adresse: 'botanique@x.com' }, {}]) assert.equal(estAutomatique(m), false, JSON.stringify(m));
  });
  const lot = [{ id: 'a', contact: 'Paul', adresse: 'paul@x.com', sujet: 'Devis été', nonLu: true, pj: true }, { id: 'b', contact: 'Ana', adresse: 'ana@x.com', sujet: 'Bonjour' }, { id: 'c', contact: 'vercel[bot]', adresse: 'notifications@github.com', sujet: 'PR #9', nonLu: true }];
  const g = (o: object) => ids(filtrerLot(lot, { ...LOT_SANS_FILTRE, ...o }) as never[]);
  it('garde tout sans filtre', () => assert.deepEqual(g({}), ['a', 'b', 'c']));
  it('applique non lus, pièce jointe, automatiques et objet', () => {
    assert.deepEqual(g({ nonLus: true }), ['a', 'c']);
    assert.deepEqual(g({ pj: true }), ['a']);
    assert.deepEqual(g({ sansAuto: true }), ['a', 'b']);
    assert.deepEqual(g({ objet: 'ETE devis' }), ['a']);
    assert.deepEqual(g({ nonLus: true, sansAuto: true }), ['a']);
  });
});
