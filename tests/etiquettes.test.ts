import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { etiquetteACreer, etiquettesAProposer, etiquettesDeLaSelection, parCompte, usageEtiquettes, type Etiquette } from '../src/lib/etiquettes.ts';
import type { Mail } from '../src/lib/mails.ts';

const m = (id: string, libelles?: string[]): Mail => ({ id, sujet: 's', contact: 'c', date: '2026-11-18', sens: 'recu', source: 'google' as never, ctx: 'pro', libelles });
const d = (...noms: string[]): Etiquette[] => noms.map((nom) => ({ nom }));

describe('choisir une étiquette', () => {
  it('écarte celles déjà posées', () => {
    assert.deepEqual(etiquettesAProposer(d('Facture', 'Client'), ['facture']).map((x) => x.nom), ['Client']);
  });
  it('filtre sur ce qui est tapé, sans tenir compte des accents ni des majuscules', () => {
    assert.deepEqual(etiquettesAProposer(d('Réunion', 'Client', 'Recrutement'), [], 'reu').map((x) => x.nom), ['Réunion']);
    assert.deepEqual(etiquettesAProposer(d('Réunion', 'Client'), [], 'CLI').map((x) => x.nom), ['Client']);
  });
  it('met les plus utilisées devant, puis l’ordre alphabétique', () => {
    const usage = usageEtiquettes([m('1', ['Client']), m('2', ['Client']), m('3', ['Urgent'])]);
    assert.deepEqual(etiquettesAProposer(d('Banque', 'Urgent', 'Client'), [], '', usage).map((x) => x.nom), ['Client', 'Urgent', 'Banque']);
  });
  it('compte les étiquettes des mails chargés', () => {
    const u = usageEtiquettes([m('1', ['Client', 'Urgent']), m('2', ['client']), m('3')]);
    assert.equal(u.get('client'), 2);
    assert.equal(u.get('urgent'), 1);
  });
});

describe('créer une étiquette', () => {
  it('propose la création tant que le nom est inconnu', () => {
    assert.equal(etiquetteACreer(d('Facture'), [], 'Devis'), 'Devis');
    assert.equal(etiquetteACreer(d('Facture'), [], '  '), null);
  });
  it('ne propose rien si l’étiquette existe déjà, posée ou non', () => {
    assert.equal(etiquetteACreer(d('Facture'), [], 'facture'), null);
    assert.equal(etiquetteACreer(d(), ['Client'], 'client'), null);
  });
});

describe('étiqueter plusieurs mails', () => {
  it('range les mails par compte', () => {
    const r = parCompte([m('ext:a:1'), m('ext:b:2'), m('ext:a:3'), m('local')]);
    assert.deepEqual([...r.keys()], ['a', 'b']);
    assert.equal(r.get('a')?.length, 2);
  });
  it('dit quelles étiquettes portent les mails choisis, les plus posées d’abord', () => {
    assert.deepEqual(etiquettesDeLaSelection([m('1', ['Client']), m('2', ['Client', 'Urgent']), m('3')]), [
      { nom: 'Client', nombre: 2 },
      { nom: 'Urgent', nombre: 1 },
    ]);
  });
  it('rien de posé, rien à retirer', () => {
    assert.deepEqual(etiquettesDeLaSelection([m('1'), m('2')]), []);
  });
});
