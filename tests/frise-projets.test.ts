import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { comparerExecution, frise, joursEntre } from '../src/lib/frise-projets.ts';
import type { Projet } from '../src/lib/types.ts';

const projet = (id: string, nom = id): Projet => ({ id, nom, emoji: '📁', debut: null, joursOuvres: true, creeLe: '2026-11-01' });
const e = (id: string, debut: string | null, fin: string | null, x: { avancement?: number; faites?: number; total?: number; enRetard?: number; nom?: string } = {}) => ({ projet: projet(id, x.nom), plan: { debut, fin, avancement: x.avancement ?? 0 }, faites: x.faites, total: x.total, enRetard: x.enRetard });

describe('timeline des projets', () => {
  it('jours entre deux dates', () => {
    assert.equal(joursEntre('2026-11-01', '2026-11-12'), 11);
    assert.equal(joursEntre('2026-12-31', '2027-01-01'), 1);
  });
  it('ordre d’exécution : début, puis fin, puis nom ; sans date à la fin', () => {
    const l = [e('c', '2026-12-01', '2027-03-31'), e('a', '2026-11-03', '2026-11-30'), e('b', '2026-12-01', '2027-01-15'), e('z', null, null), e('d', '2026-12-01', '2027-01-15', { nom: 'A' })];
    const tri = [...l].sort((x, y) => comparerExecution({ nom: x.projet.nom, debut: x.plan.debut, fin: x.plan.fin }, { nom: y.projet.nom, debut: y.plan.debut, fin: y.plan.fin }));
    assert.deepEqual(tri.map((x) => x.projet.id), ['a', 'd', 'b', 'c', 'z']);
  });
  it('place les barres sur un axe de mois, du premier au dernier', () => {
    const f = frise([e('b', '2026-12-15', '2027-02-10', { avancement: 40, faites: 2, total: 5, enRetard: 1 }), e('a', '2026-11-03', '2026-11-30', { faites: 3, total: 3 })], '2026-11-12')!;
    assert.equal(f.debut, '2026-11-01');
    assert.deepEqual(f.mois.map((m) => m.cle), ['2026-11', '2026-12', '2027-01', '2027-02']);
    assert.equal(f.jours, 30 + 31 + 31 + 28);
    assert.deepEqual(f.barres.map((b) => b.projet.id), ['a', 'b']);
    assert.equal(f.barres[0].decalage, 2);
    assert.equal(f.barres[0].duree, 28);
    assert.equal(f.barres[0].termine, true);
    assert.equal(f.barres[1].decalage, 44);
    assert.equal(f.barres[1].avancement, 40);
    assert.equal(f.barres[1].enRetard, 1);
    assert.equal(f.aujourdhui, 11);
  });
  it('aujourd’hui hors de l’axe : pas de repère', () => {
    assert.equal(frise([e('a', '2026-11-03', '2026-11-30')], '2027-06-01')!.aujourdhui, null);
  });
  it('les projets sans dates sont listés à part ; aucun projet daté : pas de timeline', () => {
    const f = frise([e('a', '2026-11-03', '2026-11-30'), e('z', null, null)], '2026-11-12')!;
    assert.deepEqual(f.sansDates.map((p) => p.id), ['z']);
    assert.equal(frise([e('z', null, null)], '2026-11-12'), null);
  });
  it('une fin avant le début est ramenée au début (barre d’un jour)', () => {
    assert.equal(frise([e('a', '2026-11-10', '2026-11-05')], '2026-11-12')!.barres[0].duree, 1);
  });
});

describe('regrouper la timeline', () => {
  const f = frise([e('a', '2026-11-03', '2026-11-30'), e('b', '2026-12-01', '2027-01-15'), e('c', '2026-12-10', '2027-03-31'), e('d', '2027-01-04', '2027-02-01')], '2026-11-12')!;
  const taches = new Map<string, { pilier?: number[] }[]>([
    ['a', [{ pilier: [2] }, { pilier: [2, 3] }, { pilier: [1] }]],
    ['b', [{ pilier: [1] }]],
    ['c', []],
    ['d', [{ pilier: [2] }]],
  ]);
  it('pilier principal : le plus de tâches, le plus petit numéro en cas d’égalité', async () => {
    const { pilierPrincipal } = await import('../src/lib/frise-projets.ts');
    assert.equal(pilierPrincipal(taches.get('a')!), 2);
    assert.equal(pilierPrincipal([{ pilier: [3] }, { pilier: [1] }]), 1);
    assert.equal(pilierPrincipal([]), null);
  });
  it('sans regroupement : un seul groupe', async () => {
    const { grouperBarres } = await import('../src/lib/frise-projets.ts');
    const g = grouperBarres(f.barres, 'aucun');
    assert.equal(g.length, 1);
    assert.equal(g[0].barres.length, 4);
  });
  it('par pilier : ordre des piliers, « Sans pilier » en dernier, ordre d’exécution dans chaque groupe', async () => {
    const { grouperBarres } = await import('../src/lib/frise-projets.ts');
    const g = grouperBarres(f.barres, 'pilier', { taches, piliers: [{ id: 'x', n: 2, nom: 'Clients' }] });
    assert.deepEqual(g.map((x) => x.titre), ['Pilier 1', 'Clients', 'Sans pilier']);
    assert.deepEqual(g.map((x) => x.barres.map((b) => b.projet.id)), [['b'], ['a', 'd'], ['c']]);
  });
  it('par trimestre ou par mois de début', async () => {
    const { grouperBarres } = await import('../src/lib/frise-projets.ts');
    const t = grouperBarres(f.barres, 'trimestre');
    assert.deepEqual(t.map((x) => x.titre), ['T4 2026', 'T1 2027']);
    assert.deepEqual(t.map((x) => x.barres.map((b) => b.projet.id)), [['a', 'b', 'c'], ['d']]);
    const m = grouperBarres(f.barres, 'mois');
    assert.deepEqual(m.map((x) => x.titre), ['nov. 2026', 'déc. 2026', 'janv. 2027']);
  });
});
