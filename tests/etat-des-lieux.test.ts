import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { etatDesLieux, recosObjectifs, resumeFinances } from '../src/lib/etat-des-lieux.ts';
import type { Espace, Finances } from '../src/lib/types.ts';

const d = '2026-10-26';
const espace = (x: Partial<Espace> = {}, finances?: Finances): Espace => ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: {} as Espace['audio'], majLe: '', finances, ...x }) as Espace;
const dep = (montant: number, date: string, budget: string | null = null) => ({ id: `${date}-${montant}`, montant, note: 'Achat', budget, date, creeLe: '' });

describe('résumé des finances du tableau de bord', () => {
  it('donne le dépensé, le budget, le reste et le solde du mois', () => {
    const r = resumeFinances(espace({}, { devise: '€', budgets: [{ id: 'g', nom: 'Total', emoji: '💰', montant: 1000, periode: 'mois', global: true }], depenses: [dep(300, '2026-10-10'), dep(20, d), dep(50, '2026-09-30')], revenus: [{ id: 'v', montant: 1500, note: 'Salaire', date: '2026-10-01', creeLe: '' }] }), d);
    assert.equal(r.depense, 320);
    assert.equal(r.plafond, 1000);
    assert.equal(r.reste, 680);
    assert.equal(r.revenus, 1500);
    assert.equal(r.solde, 1180);
    assert.equal(r.jour.depense, 20);
  });
  it('reste vide sans aucune donnée', () => {
    assert.equal(resumeFinances(espace(), d).vide, true);
  });
});

describe('état des lieux et recommandations', () => {
  it('signale un budget du mois dépassé en premier', () => {
    const e = espace({}, { devise: '€', budgets: [{ id: 'g', nom: 'Total', emoji: '💰', montant: 100, periode: 'mois', global: true }], depenses: [dep(150, '2026-10-05')] });
    const { recommandations } = etatDesLieux(e, d);
    assert.equal(recommandations[0].id, 'mois-depasse');
    assert.equal(recommandations[0].niveau, 'alerte');
  });
  it('propose un budget quand il y a des dépenses mais aucun budget', () => {
    const e = espace({}, { devise: '€', budgets: [], depenses: [1, 2, 3, 4, 5].map((i) => dep(10 + i, `2026-10-0${i}`)) });
    assert.ok(etatDesLieux(e, d).recommandations.some((x) => x.id === 'sans-budget'));
  });
  it('compte les tâches en retard et les relances à faire', () => {
    const e = espace({
      taches: [{ id: 't', titre: 'Envoyer la facture', source: 'manuel', priorite: 'normale', echeance: '2026-10-20', statut: 'en_attente', mode: 'normal', creeLe: '' }],
      relances: [{ id: 'r', contact: 'Paul', sujet: 'Devis', boite: 'pro', date: '2026-10-24', statut: 'a_faire', mode: 'normal', creeLe: '' }],
    });
    const { constats, recommandations } = etatDesLieux(e, d);
    assert.match(constats.find((x) => x.id === 'taches')!.detail, /1 en retard/);
    assert.ok(recommandations.some((x) => x.id === 'taches-retard' && x.texte.includes('Envoyer la facture')));
    assert.ok(recommandations.some((x) => x.id === 'relances' && x.titre === 'Relancer Paul'));
  });
});

describe('recommandations sur les objectifs', () => {
  const obj = (x: Record<string, unknown>) => ({ id: 'o', nom: 'Voyage', emoji: '✈️', genre: 'epargne', cible: 1200, debut: '2026-08-01', echeance: '2027-01-15', versements: [], creeLe: '', ...x });
  const fin = (objectifs: unknown[], extra: Partial<Finances> = {}) => ({ devise: '€', budgets: [], depenses: [], revenus: [], objectifs, ...extra }) as unknown as Finances;
  it('signale un objectif dont la date est passée', () => {
    const r = recosObjectifs(fin([obj({ echeance: '2026-09-01' })]), d);
    assert.equal(r[0].id, 'objectif-depasse-o');
    assert.equal(r[0].niveau, 'alerte');
    assert.equal(r[0].href, '/finances?onglet=objectifs');
  });
  it('signale un objectif en retard sur son plan', () => {
    const r = recosObjectifs(fin([obj({})]), d);
    assert.equal(r[0].id, 'objectif-retard-o');
  });
  it('dit quand le plan ne tient pas dans le budget', () => {
    const revenus = ['2026-07-15', '2026-08-15', '2026-09-15'].map((date) => ({ id: date, date, montant: 1000, note: 'Salaire', creeLe: '' }));
    const depenses = ['2026-07-20', '2026-08-20', '2026-09-20'].map((date) => ({ id: date, date, montant: 900, note: 'Vie', budget: null, creeLe: '' }));
    const r = recosObjectifs(fin([obj({ plan: { cadence: 'mois', versement: 500 } })], { revenus, depenses } as Partial<Finances>), d);
    assert.equal(r[0].id, 'objectif-tient-pas-o');
  });
  it('ne dit rien d’un objectif atteint ou pas encore commencé', () => {
    assert.deepEqual(recosObjectifs(fin([obj({ depart: 1200 - 1, versements: [{ id: 'v', date: '2026-10-01', montant: 1000 }] }), obj({ id: 'p', debut: '2026-12-01' })]), d), []);
  });
  it('les remonte dans l’état des lieux', () => {
    const e = espace({}, fin([obj({ echeance: '2026-09-01' })]));
    assert.ok(etatDesLieux(e, d).recommandations.some((x) => x.id === 'objectif-depasse-o'));
  });
});
