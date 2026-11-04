import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { enLimite, ouvertsPuisFaits } from '../src/lib/donnees-question.ts';
import { donneesPlan, heurePlan, lirePlanGarde, mailsDuPlan, memoriserPlan, planGarde, planMemorise, poserTitulaire, sansMarkdown } from '../src/lib/plan-du-jour.ts';
import type { Espace, Tache } from '../src/lib/types.ts';

const d = '2026-10-27';
const espace = (x: Partial<Espace> = {}): Espace => ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: {} as Espace['audio'], majLe: '', ...x }) as Espace;
const tache = (id: string, x: Partial<Tache> = {}): Tache => ({ id, titre: id, source: 'manuel', priorite: 'normale', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: '', ...x }) as Tache;

describe('données du plan de la journée', () => {
  it("n'envoie que ce qui reste à faire", () => {
    const e = espace({
      taches: [tache('urgente', { echeance: d }), tache('faite', { echeance: d, statut: 'fait', faitLe: d }), tache('vieille faite', { statut: 'fait', faitLe: '2026-01-01' }), tache('jeudi', { echeance: '2026-10-31' }), tache('plus tard', { echeance: '2026-12-01' })],
      relances: [
        { id: 'r1', contact: 'Ana', sujet: 'Devis', boite: 'pro', date: '2026-10-25', statut: 'a_faire', mode: 'normal', creeLe: '' },
        { id: 'r2', contact: 'Bob', sujet: 'Facture', boite: 'pro', date: d, statut: 'repondu', reponduLe: d, mode: 'normal', creeLe: '' },
        { id: 'r3', contact: 'Cléo', sujet: 'Café', boite: 'perso', date: '2026-11-15', statut: 'a_faire', mode: 'normal', creeLe: '' },
      ],
    });
    const p = donneesPlan(e, d);
    assert.deepEqual(p.tachesUrgentes.map((t) => t.titre), ['urgente']);
    assert.deepEqual(p.tachesSemaine.map((t) => t.titre), ['jeudi']);
    assert.deepEqual(p.relancesDues, [{ contact: 'Ana', sujet: 'Devis', boite: 'pro', enRetard: true }]);
  });

  it('signale les factures qui tombent dans les 3 jours', () => {
    const e = espace({
      finances: {
        devise: '€', budgets: [], depenses: [],
        recurrences: [
          { id: 'l', genre: 'depense', montant: 700, note: 'Loyer', budget: null, frequence: 'mois', debut: '2026-09-28', derniere: '2026-09-28' },
          { id: 's', genre: 'revenu', montant: 2000, note: 'Salaire', budget: null, frequence: 'mois', debut: '2026-09-28', derniere: '2026-09-28' },
          { id: 'n', genre: 'depense', montant: 10, note: 'Netflix', budget: null, frequence: 'mois', debut: '2026-10-15', derniere: '2026-10-15' },
        ],
      } as Espace['finances'],
    });
    assert.deepEqual(donneesPlan(e, d).finances.facturesProches, [{ note: 'Loyer', montant: 700, date: '2026-10-28' }]);
  });

  it('reste petit même avec beaucoup de données', () => {
    const taches = Array.from({ length: 3000 }, (_, i) => tache(`t${i}`, { statut: i % 2 ? 'fait' : 'en_attente', echeance: '2027-01-01', note: 'x'.repeat(200) }));
    assert.ok(JSON.stringify(donneesPlan(espace({ taches }), d)).length < 20_000);
  });
});

describe('plan sans markdown', () => {
  it('enlève gras, titres et puces', () => {
    assert.equal(sansMarkdown('### Priorités\n**1. Loyer**\n- 9 h : devis\n\n\n* 10 h : `appel`'), 'Priorités\n1. Loyer\n• 9 h : devis\n\n• 10 h : appel');
  });
});

describe('les mails dans le plan', () => {
  const mail = (id: string, x: object = {}) => ({ id, sens: 'recu', nonLu: true, contact: 'Paul', adresse: 'paul@x.fr', sujet: `Sujet ${id}`, date: d, fil: id, ...x }) as never;
  it('garde les non lus récents écrits par une personne', () => {
    const m = [mail('ok'), mail('lu', { nonLu: false }), mail('envoye', { sens: 'envoye' }), mail('vieux', { date: '2026-10-01' }), mail('robot', { contact: 'noreply', adresse: 'noreply@x.fr' })];
    assert.deepEqual(mailsDuPlan(m, espace(), d).map((x) => x.sujet), ['Sujet ok']);
  });
  it('laisse de côté un mail déjà suivi par une tâche ouverte', () => {
    const m = [mail('a', { id: 'ext:g1:a', fil: 'f1' })];
    const lie = (statut: string) => espace({ taches: [tache('t', { statut, mail: { fil: 'g1:f1' } } as never)] });
    assert.equal(mailsDuPlan(m, lie('en_attente'), d).length, 0);
    assert.equal(mailsDuPlan(m, lie('fait'), d).length, 1);
    assert.equal(mailsDuPlan(m, espace(), d).length, 1);
  });
  it('en garde douze au plus, les plus récents', () => {
    const m = Array.from({ length: 20 }, (_, i) => mail(`${i}`, { heure: `${String(i).padStart(2, '0')}:00` }));
    const r = mailsDuPlan(m, espace(), d);
    assert.equal(r.length, 12);
    assert.equal(r[0].sujet, 'Sujet 19');
  });
  it('arrive dans les données du plan', () => {
    assert.equal(donneesPlan(espace(), d, [mail('a')]).mailsNonLus.length, 1);
    assert.deepEqual(donneesPlan(espace(), d).mailsNonLus, []);
  });
});

describe('garder le plan de la journée', () => {
  const garde = { pour: 'u1', jour: d, texte: 'Le plan', propositions: [{ id: 'p', titre: 'Appeler' }, { titre: 'abîmée' }], heure: '08:15' };
  it('relit le plan de ce compte, de cet espace et de ce jour', () => {
    assert.deepEqual(lirePlanGarde(garde, 'u1', d), { ...garde, propositions: [{ id: 'p', titre: 'Appeler' }] });
  });
  it('refuse celui d’un autre compte ou d’un autre jour', () => {
    assert.equal(lirePlanGarde(garde, 'u2', d), null);
    assert.equal(lirePlanGarde(garde, 'u1', '2026-10-28'), null);
    assert.equal(lirePlanGarde({ ...garde, texte: ' ' }, 'u1', d), null);
    assert.equal(lirePlanGarde('abîmé', 'u1', d), null);
    assert.equal(lirePlanGarde(null, 'u1', d), null);
  });
  it('ne suit pas le changement de compte ou d’espace', () => {
    poserTitulaire('u1', d);
    memoriserPlan(d, 'Plan de u1', [], '08:00');
    assert.equal(planMemorise(d), 'Plan de u1');
    assert.equal(heurePlan(d), '08:00');
    assert.equal(planGarde()?.pour, 'u1');
    assert.equal(poserTitulaire('u1', d), false);
    assert.equal(planMemorise(d), 'Plan de u1');
    assert.equal(poserTitulaire('equipe:e1', d), true);
    assert.equal(planMemorise(d), '');
  });
});

describe('données d’une question', () => {
  const liste = [{ n: 'fait vieux', fait: true, le: '2026-01-01' }, { n: 'loin', fait: false, le: '2026-12-01' }, { n: 'sans date', fait: false, le: null }, { n: 'proche', fait: false, le: '2026-10-28' }, { n: 'fait récent', fait: true, le: '2026-10-20' }];
  const trier = (o = {}) => ouvertsPuisFaits(liste, { fait: (x) => x.fait, echeance: (x) => x.le, finiLe: (x) => x.le, ...o });
  it('met ce qui reste à faire d’abord, le plus proche en tête', () => {
    const r = trier();
    assert.deepEqual(r.ouverts.map((x) => x.n), ['proche', 'loin', 'sans date']);
    assert.deepEqual(r.faits.map((x) => x.n), ['fait récent', 'fait vieux']);
  });
  it('garde le vrai total même si la liste est coupée', () => {
    const r = trier({ maxOuverts: 1, maxFaits: 1 });
    assert.equal(r.total, 3);
    assert.equal(r.ouverts.length, 1);
    assert.equal(r.faits.length, 1);
  });
  it('allège dans l’ordre et s’arrête dès que ça tient', () => {
    const d2 = { a: 'x'.repeat(50), b: 'y'.repeat(50), c: 'z'.repeat(10) };
    const json = enLimite(d2, [(x) => void (x.a = ''), (x) => void (x.b = ''), (x) => void (x.c = '')], 90);
    assert.deepEqual(JSON.parse(json), { a: '', b: 'y'.repeat(50), c: 'z'.repeat(10) });
  });
  it('ne touche à rien si ça tient déjà', () => {
    const d2 = { a: 'x' };
    assert.deepEqual(JSON.parse(enLimite(d2, [(x) => void (x.a = '')], 80)), { a: 'x' });
  });
});

