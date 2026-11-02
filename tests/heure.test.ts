import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fmtHeure, lireHeureSaisie } from '../src/lib/dates.ts';
import { lirePhrase, lireRelance, lireTache } from '../src/lib/phrase.ts';
import { etatRelance, grouperRelances } from '../src/lib/suivi.ts';
import { grouperTaches } from '../src/lib/vue-courte.ts';
import { appliquer, FILTRES_VIDES, operationsDe } from '../src/lib/analyse-operations.ts';
import type { Finances, Relance, Tache } from '../src/lib/types.ts';

const J = '2026-11-02'; // un lundi

describe('heure tapée à la main', () => {
  it('comprend « 14:30 », « 14h30 », « 9h », « 9 »', () => {
    assert.equal(lireHeureSaisie('14:30'), '14:30');
    assert.equal(lireHeureSaisie('14h30'), '14:30');
    assert.equal(lireHeureSaisie(' 9 h '), '09:00');
    assert.equal(lireHeureSaisie('9'), '09:00');
    assert.equal(lireHeureSaisie('0h05'), '00:05');
  });
  it('refuse ce qui n’est pas une heure', () => {
    for (const x of ['', '24:00', '12:60', 'midi', '14h3', '1430']) assert.equal(lireHeureSaisie(x), null, x);
  });
  it('s’affiche à la française', () => {
    assert.equal(fmtHeure('09:00'), '9 h');
    assert.equal(fmtHeure('14:30'), '14 h 30');
    assert.equal(fmtHeure('00:15'), '0 h 15');
  });
});

describe('heure dans une phrase', () => {
  it('tâche : « demain à 14h30 »', () => {
    assert.deepEqual(lireTache('Appeler le notaire demain à 14h30', J), { titre: 'Appeler le notaire', echeance: '2026-11-03', importante: false, heure: '14:30' });
  });
  it('une heure sans jour, c’est pour aujourd’hui', () => {
    assert.deepEqual(lireTache('Point équipe à 9h', J), { titre: 'Point équipe', echeance: J, importante: false, heure: '09:00' });
  });
  it('sans heure, rien ne change', () => {
    assert.deepEqual(lireTache('Envoyer la facture jeudi', J), { titre: 'Envoyer la facture', echeance: '2026-11-05', importante: false });
    assert.deepEqual(lireTache('Lire 3 chapitres', J), { titre: 'Lire 3 chapitres', echeance: null, importante: false });
  });
  it('relance : « Paul pour le devis jeudi vers 10h »', () => {
    assert.deepEqual(lireRelance('Paul pour le devis jeudi vers 10h', J), { contact: 'Paul', sujet: 'Le devis', date: '2026-11-05', heure: '10:00' });
  });
  it('habitude et dépense', () => {
    assert.deepEqual(lirePhrase('Sport tous les jours à 7h', J), { genre: 'habitude', titre: 'Sport', frequence: 'quotidien', jour: null, heure: '07:00' });
    const dep = lirePhrase('12,50 € déjeuner à midi', J);
    assert.equal(dep?.genre, 'depense');
    assert.equal(dep?.heure, '12:00');
    assert.equal(lirePhrase('30 € courses', J)?.heure, undefined);
  });
});

const tache = (o: Partial<Tache>): Tache => ({ id: 'x', titre: 'X', source: 'manuel', priorite: 'moyenne', echeance: J, statut: 'en_attente', mode: 'normal', creeLe: J, ...o });
const relance = (o: Partial<Relance>): Relance => ({ id: 'r', contact: 'Marie', sujet: 'Devis', boite: 'pro', date: J, statut: 'a_faire', mode: 'normal', creeLe: J, ...o });

describe('rangement dans la journée', () => {
  it('les tâches du jour suivent l’heure, celles sans heure après', () => {
    const g = grouperTaches([tache({ id: 'a', titre: 'A' }), tache({ id: 'b', titre: 'B', heure: '16:00' }), tache({ id: 'c', titre: 'C', heure: '08:30' })], J);
    assert.deepEqual(g[0].taches.map((t) => t.id), ['c', 'b', 'a']);
  });
  it('les relances aussi, et leur état dit l’heure', () => {
    const g = grouperRelances([relance({ id: 'a' }), relance({ id: 'b', heure: '11:00' })], J);
    assert.deepEqual(g.maintenant.map((r) => r.id), ['b', 'a']);
    assert.equal(etatRelance(relance({ heure: '11:00' }), J).texte, "Prévue aujourd'hui à 11 h");
    assert.match(etatRelance(relance({ date: '2026-11-04', heure: '09:30' }), J).texte, /à 9 h 30$/);
  });
  it('les opérations d’un même jour : la plus tardive d’abord', () => {
    const f = { depenses: [
      { id: 'd1', montant: 5, budget: null, note: 'café', date: J, heure: '08:10', creeLe: J },
      { id: 'd2', montant: 20, budget: null, note: 'resto', date: J, heure: '20:30', creeLe: J },
      { id: 'd3', montant: 9, budget: null, note: 'sans heure', date: J, creeLe: J },
    ], revenus: [], budgets: [] } as unknown as Finances;
    const ops = appliquer(operationsDe(f), FILTRES_VIDES, J, () => '');
    assert.deepEqual(ops.map((x) => x.id), ['d2', 'd1', 'd3']);
  });
});
