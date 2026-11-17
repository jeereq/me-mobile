import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { corrigerToutes, corrigerUne, fautesRestantes, type Faute } from '../src/lib/fautes.ts';
import type { Mail } from '../src/lib/mails.ts';
import { basculerSource, boitesDesSources, mailsChoisissables, MAX_SOURCES } from '../src/lib/sources-mail.ts';

const f = (avant: string, apres: string): Faute => ({ avant, apres, genre: 'orthographe', raison: 'x' });

describe('corriger les fautes', () => {
  it('corrige une faute, à sa première occurrence', () => {
    assert.equal(corrigerUne('je vous envoi le doc', f('envoi', 'envoie')), 'je vous envoie le doc');
    assert.equal(corrigerUne('rien', f('absent', 'x')), 'rien');
  });
  it('ne propose plus une faute déjà corrigée à la main', () => {
    const fautes = [f('envoi', 'envoie'), f('document', 'documents')];
    assert.deepEqual(fautesRestantes('je vous envoie le document', fautes).map((x) => x.avant), ['document']);
  });
  it('« tout corriger » reprend le texte du serveur tant que le texte n’a pas changé', () => {
    const v = { verifie: 'a b', corrige: 'À B' };
    assert.equal(corrigerToutes('a b', v, [f('a', 'à')]), 'À B');
  });
  it('« tout corriger » applique ce qui reste quand le texte a changé', () => {
    const v = { verifie: 'je vous envoi les document', corrige: 'je vous envoie les documents' };
    assert.equal(corrigerToutes('je vous envoie les document', v, [f('envoi', 'envoie'), f('les document', 'les documents')]), 'je vous envoie les documents');
  });
});

describe('choisir des mails sources', () => {
  const m = (id: string, contact: string, sujet: string, fil?: string): Mail => ({ id, sujet, contact, date: '2026-11-10', sens: 'recu', fil, source: 'google' as never, ctx: 'pro' });
  it('ajoute et retire un mail', () => {
    assert.deepEqual(basculerSource([], 'a'), ['a']);
    assert.deepEqual(basculerSource(['a', 'b'], 'a'), ['b']);
  });
  it('s’arrête à cinq mails', () => {
    const cinq = Array.from({ length: MAX_SOURCES }, (_, i) => `m${i}`);
    assert.deepEqual(basculerSource(cinq, 'autre'), cinq);
    assert.equal(basculerSource(cinq, 'm0').length, MAX_SOURCES - 1);
  });
  it('un seul mail par conversation et jamais celui auquel on répond', () => {
    const tous = [m('1', 'Paul', 'Devis', 'f1'), m('2', 'Paul', 'Re: Devis', 'f1'), m('3', 'Marie', 'Facture', 'f2'), m('4', 'Luc', 'Contrat', 'f3')];
    assert.deepEqual(mailsChoisissables(tous, '').map((x) => x.id), ['1', '3', '4']);
    assert.deepEqual(mailsChoisissables(tous, '', '3').map((x) => x.id), ['1', '4']);
    assert.deepEqual(mailsChoisissables(tous, '', '1').map((x) => x.id), ['3', '4']);
  });
  it('filtre sans tenir compte des accents ni des majuscules', () => {
    const tous = [m('1', 'Hélène', 'Réunion'), m('2', 'Paul', 'Devis')];
    assert.deepEqual(mailsChoisissables(tous, 'helene').map((x) => x.id), ['1']);
    assert.deepEqual(mailsChoisissables(tous, 'DEVIS').map((x) => x.id), ['2']);
  });
});

describe('filtrer les sources par boîte', () => {
  const m = (id: string, contact: string, compte: string, boite?: string): Mail => ({ id, sujet: `Sujet ${id}`, contact, date: '2026-11-10', sens: 'recu', compte, boite, source: 'google' as never, ctx: 'pro' });
  const tous = [m('1', 'Paul', 'moi@me.app'), m('2', 'Marie', 'moi@me.app', 'ventes@entreprise.fr'), m('3', 'Luc', 'perso@me.app'), m('4', 'Ana', 'moi@me.app', 'ventes@entreprise.fr')];
  it('ne garde que les mails de la boîte choisie', () => {
    assert.deepEqual(mailsChoisissables(tous, '', undefined, 'ventes@entreprise.fr').map((x) => x.id), ['2', '4']);
    assert.deepEqual(mailsChoisissables(tous, '', undefined, 'moi@me.app').map((x) => x.id), ['1']);
  });
  it('sans boîte choisie, tout reste', () => {
    assert.equal(mailsChoisissables(tous, '').length, 4);
  });
  it('liste les boîtes avec leur nombre, les partagées en dernier', () => {
    assert.deepEqual(boitesDesSources(tous), [
      { adresse: 'moi@me.app', partagee: false, nombre: 1 },
      { adresse: 'perso@me.app', partagee: false, nombre: 1 },
      { adresse: 'ventes@entreprise.fr', partagee: true, nombre: 2 },
    ]);
  });
  it('ne compte pas le mail auquel on répond', () => {
    assert.deepEqual(boitesDesSources(tous, '3').map((b) => b.adresse), ['moi@me.app', 'ventes@entreprise.fr']);
  });
  it('se combine avec la recherche', () => {
    assert.deepEqual(mailsChoisissables(tous, 'ana', undefined, 'ventes@entreprise.fr').map((x) => x.id), ['4']);
  });
});
