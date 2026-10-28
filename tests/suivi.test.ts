import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilanHabitude, joursHistorique, rangerDansProjet, rangRelance, relanceAttendue, relancer } from '../src/lib/suivi.ts';
import { missionDuJour } from '../src/lib/mission.ts';
import type { Espace, Habitude, Relance, Tache } from '../src/lib/types.ts';

const J = '2026-10-28'; // un mercredi
const r = (x: Partial<Relance> = {}): Relance => ({ id: 'r1', contact: 'Marie', sujet: 'Devis', boite: 'pro', date: J, statut: 'a_faire', mode: 'normal', creeLe: '', ...x });
const t = (id: string, x: Partial<Tache> = {}): Tache => ({ id, titre: `Tâche ${id}`, source: 'pro', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: '', ...x });
const h = (x: Partial<Habitude> = {}): Habitude => ({ id: 'h1', nom: 'Sport', categorie: 'perso', frequence: 'quotidien', jour: null, mode: 'coach', coches: [], ordre: 1, ...x });

describe('relancer', () => {
  it('compte la relance et reprogramme la suivante', () => {
    const a = relancer(r(), J, 3);
    assert.equal(a.statut, 'relance');
    assert.equal(a.nbRelances, 1);
    assert.equal(a.derniereRelance, J);
    assert.equal(a.date, '2026-10-31');
    const b = relancer(a, '2026-10-31', 3);
    assert.equal(b.nbRelances, 2);
    assert.equal(b.date, '2026-11-03');
  });
  it('garde au moins un jour de délai', () => {
    assert.equal(relancer(r(), J, 0).date, '2026-10-29');
  });
  it('nomme le rang', () => {
    assert.equal(rangRelance(1), '1re relance');
    assert.equal(rangRelance(3), '3e relance');
  });
});

describe('relance attendue', () => {
  it('suit les relances à faire et celles relancées avec la nouvelle version', () => {
    assert.equal(relanceAttendue(r()), true);
    assert.equal(relanceAttendue(relancer(r(), J, 3)), true);
    assert.equal(relanceAttendue(r({ statut: 'relance' })), false);
    assert.equal(relanceAttendue(r({ statut: 'repondu' })), false);
  });
  it('remet une relance relancée dans la mission du jour à sa nouvelle date', () => {
    const e = { relances: [relancer(r({ date: '2026-10-20' }), '2026-10-25', 3)], taches: [], habitudes: [] } as unknown as Espace;
    assert.deepEqual(missionDuJour(e, J).map((m) => m.titre), ['Relancer à nouveau Marie']);
    assert.equal(missionDuJour(e, '2026-10-27').length, 0);
  });
});

describe('ranger une tâche dans un projet', () => {
  it('ajoute la tâche à la fin du plan, à la date de son échéance', () => {
    const ts = [t('a', { projet: 'p', ordre: 4 }), t('x', { echeance: '2026-11-05' })];
    const x = rangerDansProjet(ts, 'x', 'p').find((y) => y.id === 'x')!;
    assert.equal(x.projet, 'p');
    assert.equal(x.ordre, 5);
    assert.equal(x.duree, 1);
    assert.equal(x.debut, '2026-11-05');
    assert.equal(x.fixe, true);
  });
  it('sort une tâche de son projet sans garder les champs du planning ni les liens', () => {
    const ts = [t('a', { projet: 'p', apres: ['x'] }), t('x', { projet: 'p', duree: 2, debut: J, fixe: true, ordre: 2, echeance: '2026-10-29' })];
    const n = rangerDansProjet(ts, 'x', null);
    const x = n.find((y) => y.id === 'x')!;
    assert.equal(x.projet, undefined);
    assert.equal(x.duree, undefined);
    assert.equal(x.echeance, '2026-10-29');
    assert.deepEqual(n.find((y) => y.id === 'a')!.apres, []);
  });
  it('ne déplace pas une tâche qui a des sous-tâches', () => {
    const ts = [t('x', { projet: 'p' }), t('y', { projet: 'p', parent: 'x' })];
    assert.equal(rangerDansProjet(ts, 'x', null), ts);
  });
});

describe('bilan d’une habitude', () => {
  it('ne compte pas les jours d’avant le premier coché', () => {
    const b = bilanHabitude(h({ coches: ['2026-10-25', '2026-10-26', J] }), J);
    assert.deepEqual(b, { faites: 3, periodes: 4, pct: 75, unite: 'jours' });
  });
  it('ne compte pas la période en cours tant qu’elle n’est pas faite', () => {
    const b = bilanHabitude(h({ coches: ['2026-10-26', '2026-10-27'] }), J);
    assert.equal(b.periodes, 2);
    assert.equal(b.pct, 100);
  });
  it('compte en semaines pour une habitude hebdo', () => {
    const b = bilanHabitude(h({ frequence: 'hebdo', jour: 1, coches: ['2026-10-05', '2026-10-19', '2026-10-26'] }), J);
    assert.equal(b.unite, 'semaines');
    assert.equal(b.periodes, 4);
    assert.equal(b.faites, 3);
  });
  it('dit quand rien n’est coché', () => {
    assert.equal(bilanHabitude(h(), J).periodes, 0);
  });
});

describe('jours de l’historique', () => {
  it('cinq semaines du lundi au dimanche, sans les jours à venir', () => {
    const j = joursHistorique(J);
    assert.equal(j.length, 35);
    assert.equal(j[0], '2026-09-28');
    assert.equal(j[30], J);
    assert.equal(j[31], null);
  });
});
