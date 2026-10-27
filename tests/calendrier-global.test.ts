import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bornesMois, evenementsEntre, joursDeSemaine, parJour, resumeJour } from '../src/lib/calendrier-global.ts';
import type { Espace, Tache } from '../src/lib/types.ts';

const AUJ = '2026-10-27';
const tache = (o: Partial<Tache>): Tache => ({ id: 't', titre: 'Tâche', source: 'manuel', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: '', ...o });
const espace = (o: Partial<Espace> = {}): Espace => ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: {} as Espace['audio'], majLe: '', ...o });
const titres = (l: { titre: string }[]) => l.map((x) => x.titre);

describe('calendrier : tout ce qui a une date', () => {
  it('range les rendez-vous, tâches, relances et habitudes d’un jour', () => {
    const e = espace({
      agenda: { '2026-10-28': [{ id: 'a', debut: '09:30', titre: 'Réunion', lieu: 'Bureau' }] },
      taches: [tache({ id: 't1', titre: 'Payer', echeance: '2026-10-28', priorite: 'haute' }), tache({ id: 't2', titre: 'Sans date' })],
      relances: [{ id: 'r1', contact: 'Marie', sujet: 'Devis', boite: 'pro', date: '2026-10-28', statut: 'a_faire', mode: 'normal', creeLe: '' }],
      habitudes: [{ id: 'h1', nom: 'Marcher', categorie: 'perso', frequence: 'quotidien', jour: null, mode: 'normal', coches: [], ordre: 0 }],
    });
    const l = evenementsEntre(e, '2026-10-28', '2026-10-28', AUJ);
    assert.deepEqual(titres(l), ['Réunion', 'Payer', 'Relancer Marie', 'Marcher']);
    assert.equal(l[0].heure, '09:30');
    assert.equal(l[1].detail, 'Priorité haute');
    assert.equal(l[1].ref?.type, 'tache');
  });

  it('marque en retard ce qui est passé et pas fait, et fait ce qui est coché', () => {
    const e = espace({
      taches: [tache({ id: 'a', titre: 'Vieille', echeance: '2026-10-20' }), tache({ id: 'b', titre: 'Finie', echeance: '2026-10-20', statut: 'fait', faitLe: '2026-10-19' }), tache({ id: 'c', titre: 'Faite sans date', statut: 'fait', faitLe: '2026-10-21' })],
      habitudes: [{ id: 'h', nom: 'Lire', categorie: 'perso', frequence: 'quotidien', jour: null, mode: 'normal', coches: ['2026-10-21'], ordre: 0 }],
    });
    const l = evenementsEntre(e, '2026-10-20', '2026-10-22', AUJ);
    const par = new Map(l.map((x) => [x.titre + x.date, x]));
    assert.equal(par.get('Vieille2026-10-20')!.retard, true);
    assert.equal(par.get('Finie2026-10-20')!.fait, true);
    assert.equal(par.get('Finie2026-10-20')!.retard, false);
    assert.ok(par.has('Faite sans date2026-10-21'));
    // Une habitude passée n'apparaît que le jour où elle a été tenue.
    assert.deepEqual(l.filter((x) => x.genre === 'habitude').map((x) => x.date), ['2026-10-21']);
  });

  it('montre les habitudes à venir, pas les jours passés manqués', () => {
    const e = espace({ habitudes: [{ id: 'h', nom: 'Sport', categorie: 'perso', frequence: 'hebdo', jour: 1, mode: 'normal', coches: [], ordre: 0 }] });
    const l = evenementsEntre(e, '2026-10-19', '2026-11-09', AUJ);
    assert.deepEqual(l.map((x) => x.date), ['2026-11-02', '2026-11-09']);
  });

  it('place les tâches d’un projet à leur échéance, sans les résumés, et signale celles qui attendent', () => {
    const e = espace({
      projets: [{ id: 'p', nom: 'Site', emoji: '🌐', debut: '2026-11-02', joursOuvres: true, creeLe: '' }],
      taches: [
        tache({ id: 'r', titre: 'Conception', projet: 'p', echeance: '2026-11-06' }),
        tache({ id: 'a', titre: 'Maquettes', projet: 'p', parent: 'r', debut: '2026-11-02', echeance: '2026-11-04', duree: 3 }),
        tache({ id: 'b', titre: 'Validation', projet: 'p', parent: 'r', apres: ['a'], debut: '2026-11-05', echeance: '2026-11-06', duree: 2, jalon: false }),
      ],
    });
    const l = evenementsEntre(e, '2026-11-01', '2026-11-30', AUJ);
    const taches = l.filter((x) => x.genre === 'tache');
    assert.deepEqual(titres(taches), ['Maquettes', 'Validation']);
    assert.equal(taches[0].detail, '🌐 Site');
    assert.equal(taches[0].bloque, false);
    assert.equal(taches[1].bloque, true);
    assert.deepEqual(titres(l.filter((x) => x.genre === 'projet')), ['Début : 🌐 Site', 'Fin prévue : 🌐 Site']);
  });

  it('range l’argent : dépenses, revenus, récurrents à venir, budgets datés', () => {
    const e = espace({
      finances: {
        devise: '€',
        budgets: [
          { id: 'b', nom: 'Vacances', emoji: '🏖️', montant: 600, periode: 'mois', debut: '2026-11-01', fin: '2026-11-30', enveloppe: true, plan: [{ id: 'p1', nom: 'Billets', montant: 300, fin: '2026-11-10' }] },
        ],
        depenses: [{ id: 'd1', montant: 12.5, budget: null, note: 'Café', date: '2026-10-27', creeLe: '' }, { id: 'v', montant: 99, budget: null, note: 'Virement', date: '2026-10-27', creeLe: '', lien: 'x' }],
        revenus: [{ id: 'r1', montant: 2000, note: 'Salaire', date: '2026-10-27', creeLe: '' }],
        recurrences: [{ id: 'loyer', genre: 'depense', montant: 700, note: 'Loyer', budget: null, frequence: 'mois', debut: '2026-09-05', derniere: '2026-10-05' }],
      },
    });
    const l = evenementsEntre(e, '2026-10-27', '2026-11-30', AUJ);
    assert.deepEqual(
      l.map((x) => [x.date, x.genre, x.titre]),
      [
        ['2026-10-27', 'depense', 'Café'],
        ['2026-10-27', 'revenu', 'Salaire'],
        ['2026-11-01', 'budget', 'Début du budget 🏖️ Vacances'],
        ['2026-11-05', 'recurrent', 'Loyer'],
        ['2026-11-10', 'budget', 'Fin du poste Billets'],
        ['2026-11-30', 'budget', 'Fin du budget 🏖️ Vacances'],
      ],
    );
    const jour = resumeJour(l.filter((x) => x.date === '2026-10-27'));
    assert.equal(jour.depenses, 12.5);
    assert.equal(jour.revenus, 2000);
  });

  it('range les objectifs : échéance, versements faits et versements prévus', () => {
    const e = espace({
      finances: { devise: '€', budgets: [], depenses: [], objectifs: [{ id: 'o', nom: 'Voyage', emoji: '✈️', genre: 'epargne', cible: 1200, debut: '2026-10-01', echeance: '2027-01-01', versements: [{ id: 'v1', date: '2026-10-15', montant: 300 }], creeLe: '' }] },
    });
    const l = evenementsEntre(e, '2026-10-01', '2027-01-31', AUJ, { genres: ['objectif'] });
    assert.deepEqual(l.map((x) => [x.date, x.titre, x.montant]), [
      ['2026-10-15', 'Versé : ✈️ Voyage', 300],
      ['2026-11-01', 'À verser : ✈️ Voyage', 300],
      ['2026-12-01', 'À verser : ✈️ Voyage', 300],
      ['2027-01-01', 'À verser : ✈️ Voyage', 300],
      ['2027-01-01', 'Objectif : ✈️ Voyage', 1200],
    ]);
    assert.equal(l[1].lien.params?.onglet, 'objectifs');
  });

  it('ne calcule que les genres demandés', () => {
    const e = espace({ taches: [tache({ echeance: '2026-10-28' })], relances: [{ id: 'r', contact: 'A', sujet: '', boite: 'pro', date: '2026-10-28', statut: 'a_faire', mode: 'normal', creeLe: '' }] });
    assert.deepEqual(evenementsEntre(e, '2026-10-28', '2026-10-28', AUJ, { genres: ['relance'] }).map((x) => x.genre), ['relance']);
  });

  it('range par jour et donne les bornes d’un mois et d’une semaine', () => {
    const e = espace({ taches: [tache({ id: 'a', echeance: '2026-10-28' }), tache({ id: 'b', echeance: '2026-10-28' }), tache({ id: 'c', echeance: '2026-10-30' })] });
    const m = parJour(evenementsEntre(e, '2026-10-01', '2026-10-31', AUJ));
    assert.equal(m.get('2026-10-28')!.length, 2);
    assert.equal(m.get('2026-10-30')!.length, 1);
    assert.deepEqual(bornesMois('2026-02'), { debut: '2026-02-01', fin: '2026-02-28' });
    assert.deepEqual(joursDeSemaine('2026-10-28').filter((_, i) => i === 0 || i === 6), ['2026-10-26', '2026-11-01']);
  });
});

describe('calendrier : habitudes de chaque jour', () => {
  it('les marque comme quotidiennes pour ne pas remplir chaque case du mois', () => {
    const e = espace({ habitudes: [{ id: 'h', nom: 'Marcher', categorie: 'perso', frequence: 'quotidien', jour: null, mode: 'normal', coches: [], ordre: 0 }, { id: 'g', nom: 'Bilan', categorie: 'perso', frequence: 'hebdo', jour: 1, mode: 'normal', coches: [], ordre: 1 }] });
    const l = evenementsEntre(e, '2026-11-02', '2026-11-02', AUJ);
    assert.deepEqual(l.map((x) => [x.titre, !!x.quotidien]), [['Bilan', false], ['Marcher', true]]);
  });
});
