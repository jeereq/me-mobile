import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decrireMode, heureDe, lireHeure, lireHeures, lireJours, REGLES_DEFAUT, reglesDuMode } from '../src/lib/modes.ts';

describe('lecture des réglages', () => {
  it('reconnaît matin, soir et HH:MM', () => {
    assert.equal(lireHeure('Matin'), 'matin');
    assert.equal(lireHeure('9:05'), '09:05');
    assert.equal(lireHeure('24:00'), null);
    assert.equal(lireHeure('midi'), null);
    assert.equal(lireHeure(12), null);
  });
  it('lit une liste d’heures, sans doublon ni valeur fausse', () => {
    assert.deepEqual(lireHeures('matin, 12:30; soir 12:30 n’importe quoi'), ['matin', '12:30', 'soir']);
    assert.deepEqual(lireHeures('9h 18h30'), ['09:00', '18:30']);
    assert.deepEqual(lireHeures(''), []);
  });
  it('lit une liste de jours, du plus loin au plus proche', () => {
    assert.deepEqual(lireJours('1, 3 ; 7 3 0 99 x'), [7, 3, 1]);
  });
  it('heureDe suit le briefing et le rappel du soir', () => {
    assert.equal(heureDe('matin', '06:30', '20:00'), '06:30');
    assert.equal(heureDe('soir', '06:30', '20:00'), '20:00');
    assert.equal(heureDe('14:15', '06:30', '20:00'), '14:15');
  });
});

describe('règles d’un mode', () => {
  it('sans réglage : les valeurs d’origine', () => {
    for (const m of Object.keys(REGLES_DEFAUT) as (keyof typeof REGLES_DEFAUT)[]) assert.deepEqual(reglesDuMode({}, m), REGLES_DEFAUT[m]);
  });
  it('agressif suit encore l’ancien réglage « commencer à J- »', () => {
    assert.deepEqual(reglesDuMode({ agressifJMoins: 5 }, 'agressif').avant, [5, 1]);
    assert.deepEqual(reglesDuMode({ agressifJMoins: 5, modes: { agressif: { avant: [2] } } }, 'agressif').avant, [2]);
  });
  it('ignore les valeurs invalides et garde le reste', () => {
    const r = reglesDuMode({ modes: { normal: { jourJ: ['8:00', 'n’importe quoi'], heure: 'x', avant: [0, 2, 99, 1.5] } } as never }, 'normal');
    assert.deepEqual(r.jourJ, ['08:00']);
    assert.equal(r.heure, '09:00');
    assert.deepEqual(r.avant, [2]);
  });
  it('un bilan null le supprime, un bilan absent garde celui d’origine', () => {
    assert.equal(reglesDuMode({ modes: { hebdo: { bilan: null } } }, 'hebdo').bilan, null);
    assert.deepEqual(reglesDuMode({ modes: { hebdo: {} } }, 'hebdo').bilan, { jour: 0, heure: 'soir' });
    assert.deepEqual(reglesDuMode({ modes: { hebdo: { bilan: { jour: 5, heure: '17:00' } } } }, 'hebdo').bilan, { jour: 5, heure: '17:00' });
  });
});

describe('description d’un mode', () => {
  it('décrit les règles d’origine', () => {
    assert.equal(decrireMode(REGLES_DEFAUT.passif, '07:00', '19:00'), 'Aucune notification : visible seulement dans l’app et dans le briefing du matin.');
    assert.equal(decrireMode(REGLES_DEFAUT.normal, '07:00', '19:00'), 'Envoie un rappel le jour J à 9 h.');
    assert.equal(decrireMode(REGLES_DEFAUT.agressif, '07:00', '19:00'), "Envoie des rappels le jour J le matin (7 h) et le soir (19 h), un rappel 3 j et 1 j avant l'échéance et un rappel chaque jour de retard. Les rappels à l'avance et en retard partent à 9 h.");
    assert.match(decrireMode(REGLES_DEFAUT.hebdo, '07:00', '19:00'), /bilan de la semaine le dimanche le soir \(19 h\)/);
  });
});

