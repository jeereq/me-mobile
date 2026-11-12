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
