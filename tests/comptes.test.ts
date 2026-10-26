import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ajouterCompte, autreMoitie, candidatsLien, changerCompte, delier, ignorerLien, lier, nbSansCompte, proposerLiens, rattacher, resumerComptes, supprimerCompte, verifierNom, virements } from '../src/lib/comptes.ts';
import type { OpLiable } from '../src/lib/comptes.ts';
import type { Compte, Finances } from '../src/lib/types.ts';

const eq: Compte = { id: 'c1', nom: 'Equity – dollars', emoji: '🏦' };
const mp: Compte = { id: 'c2', nom: 'M-Pesa', emoji: '📱' };
const dep = (id: string, date: string, montant: number, compte?: string) => ({ id, montant, date, note: id, budget: null, creeLe: '', ...(compte ? { compte } : {}) });
const rev = (id: string, date: string, montant: number, compte?: string) => ({ id, montant, date, note: id, creeLe: '', ...(compte ? { compte } : {}) });
const base = (): Finances => ({ devise: '$', budgets: [], depenses: [dep('d1', '2026-01-10', 100, 'c1'), dep('d2', '2026-01-12', 20, 'c1'), dep('d3', '2026-01-15', 5)], revenus: [rev('r1', '2026-01-11', 100, 'c2'), rev('r2', '2026-01-12', 500, 'c1')] });
const liables = (f: Finances): OpLiable[] => [
  ...f.depenses.map((x) => ({ id: x.id, sens: 'sortie' as const, date: x.date, montant: x.montant, compte: x.compte ?? null, lien: x.lien ?? null })),
  ...(f.revenus || []).map((x) => ({ id: x.id, sens: 'entree' as const, date: x.date, montant: x.montant, compte: x.compte ?? null, lien: x.lien ?? null })),
];

describe('comptes', () => {
  it('refuse un nom vide ou déjà pris, sans tenir compte des accents ni de la casse', () => {
    const f = ajouterCompte(base(), eq);
    assert.match(verifierNom(f, '   '), /Donne un nom/);
    assert.match(verifierNom(f, 'EQUITY – DOLLARS'), /déjà ce nom/);
    assert.equal(verifierNom(f, 'Equity – francs'), '');
    assert.equal(verifierNom(f, 'Equity – dollars', 'c1'), '', 'un compte garde son propre nom quand on le modifie');
    assert.equal(verifierNom(ajouterCompte(base(), { id: 'x', nom: 'Épargne', emoji: '💵' }), 'epargne'), 'Un compte porte déjà ce nom. Ajoute la banque ou la devise pour les distinguer (« Equity – dollars », « Equity – francs »).');
  });

  it('rattache les opérations sans compte, et seulement elles', () => {
    const f = base();
    assert.equal(nbSansCompte(f), 1);
    const g = rattacher(f, 'c2');
    assert.equal(nbSansCompte(g), 0);
    assert.equal(g.depenses.find((x) => x.id === 'd3')!.compte, 'c2');
    assert.equal(g.depenses.find((x) => x.id === 'd1')!.compte, 'c1', 'un compte déjà choisi ne change pas');
    assert.equal(rattacher(f, 'c2', ['zzz']).depenses.find((x) => x.id === 'd3')!.compte, undefined);
  });

  it('change le compte d’une opération, ou la détache', () => {
    const f = changerCompte(base(), 'd1', 'c2');
    assert.equal(f.depenses[0].compte, 'c2');
    assert.ok(!('compte' in changerCompte(f, 'd1', null).depenses[0]));
  });

  it('supprime un compte sans perdre ses opérations', () => {
    const f = supprimerCompte(ajouterCompte(ajouterCompte(base(), eq), mp), 'c1');
    assert.deepEqual(f.comptes!.map((c) => c.id), ['c2']);
    assert.equal(f.depenses.length, 3);
    assert.equal(nbSansCompte(f), 4);
  });
});

describe('liens entre opérations', () => {
  it('lie une sortie et une entrée, puis les délie', () => {
    const f = lier(base(), 'd1', 'r1')!;
    assert.equal(f.depenses[0].lien, 'v-d1-r1');
    assert.equal(f.revenus![0].lien, 'v-d1-r1');
    assert.equal(lier(f, 'd1', 'r2'), null, 'une opération déjà liée ne se lie pas deux fois');
    assert.equal(lier(base(), 'd1', 'inconnue'), null);
    const g = delier(f, 'v-d1-r1');
    assert.ok(!('lien' in g.depenses[0]) && !('lien' in g.revenus![0]));
  });

  it('propose les virements entre deux comptes : même montant, quelques jours d’écart', () => {
    const p = proposerLiens(liables(base()));
    assert.equal(p.length, 1);
    assert.deepEqual([p[0].sortie.id, p[0].entree.id, p[0].ecart, p[0].jours], ['d1', 'r1', 0, 1]);
  });

  it('ne reproppose pas un virement écarté', () => {
    const f = ignorerLien(base(), 'd1', 'r1');
    assert.deepEqual(f.liensIgnores, ['d1|r1']);
    assert.deepEqual(proposerLiens(liables(f), { ignores: f.liensIgnores }), []);
  });

  it('ne propose pas deux opérations du même compte, ni sans compte, ni trop éloignées, ni déjà liées', () => {
    const f = base();
    f.revenus = [rev('r3', '2026-01-10', 100, 'c1'), rev('r4', '2026-01-10', 100), rev('r5', '2026-01-20', 100, 'c2')];
    assert.deepEqual(proposerLiens(liables(f)), []);
    const g = base();
    assert.deepEqual(proposerLiens(liables(lier(g, 'd1', 'r1')!)), []);
  });

  it('accepte un petit écart de montant (frais) et choisit le meilleur rapprochement', () => {
    const f: Finances = { devise: '$', budgets: [], depenses: [dep('a', '2026-02-01', 100, 'c1'), dep('b', '2026-02-02', 100, 'c1')], revenus: [rev('x', '2026-02-02', 99, 'c2'), rev('y', '2026-02-02', 100, 'c2')] };
    const p = proposerLiens(liables(f));
    assert.equal(p.length, 2);
    const parSortie = Object.fromEntries(p.map((x) => [x.sortie.id, x.entree.id]));
    assert.equal(parSortie.b, 'y', 'le montant exact et le même jour passent d’abord');
    assert.equal(parSortie.a, 'x');
    assert.equal(p.find((x) => x.sortie.id === 'a')!.ecart, 1);
  });

  it('une entrée n’est proposée qu’une fois', () => {
    const f: Finances = { devise: '$', budgets: [], depenses: [dep('a', '2026-02-01', 50, 'c1'), dep('b', '2026-02-01', 50, 'c1')], revenus: [rev('x', '2026-02-01', 50, 'c2')] };
    assert.equal(proposerLiens(liables(f)).length, 1);
  });

  it('propose des candidats pour lier à la main, les plus proches d’abord', () => {
    const ops = liables({ ...base(), revenus: [rev('r1', '2026-01-11', 100, 'c2'), rev('r2', '2026-01-12', 500, 'c1'), rev('r9', '2026-03-01', 100, 'c2')] });
    const c = candidatsLien(ops, ops.find((x) => x.id === 'd1')!);
    assert.deepEqual(c.map((x) => x.id), ['r1', 'r2']);
    assert.ok(c.every((x) => x.sens === 'entree'));
  });

  it('compte les virements et retrouve l’autre moitié', () => {
    const f = lier(base(), 'd1', 'r1')!;
    const ops = liables(f);
    assert.deepEqual(virements(ops), { nb: 1, total: 100 });
    assert.equal(autreMoitie(ops, ops.find((x) => x.id === 'd1')!)!.id, 'r1');
    assert.equal(autreMoitie(ops, ops.find((x) => x.id === 'd2')!), undefined);
  });
});

describe('résumé des comptes', () => {
  it('sépare ce qui est réel de ce qui est viré, compte par compte', () => {
    const f = lier(ajouterCompte(ajouterCompte(base(), eq), mp), 'd1', 'r1')!;
    const r = resumerComptes(liables(f), f.comptes!);
    const e = r.find((x) => x.id === 'c1')!;
    assert.deepEqual([e.nb, e.entrees, e.sorties, e.virementsEnvoyes, e.virementsRecus, e.premiere, e.derniere], [3, 500, 20, 100, 0, '2026-01-10', '2026-01-12']);
    const m = r.find((x) => x.id === 'c2')!;
    assert.deepEqual([m.nb, m.entrees, m.virementsRecus], [1, 0, 100]);
    const aucun = r.find((x) => x.id === null)!;
    assert.deepEqual([aucun.nb, aucun.sorties], [1, 5]);
  });
  it('montre un compte sans opération', () => {
    const r = resumerComptes([], [eq]);
    assert.deepEqual([r.length, r[0].nb, r[0].derniere], [1, 0, null]);
  });
});
