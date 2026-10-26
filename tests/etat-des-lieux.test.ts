import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { etatDesLieux, resumeFinances } from '../src/lib/etat-des-lieux.ts';
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
