import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lecteur } from '../src/lib/lecture.ts';

const banc = (morceaux: string[]) => {
  const dits: string[] = [];
  const fins: (() => void)[] = [];
  let fini = 0;
  const l = lecteur(morceaux, (t, fin) => (dits.push(t), fins.push(fin)), () => fini++);
  return { l, dits, fins, finis: () => fini };
};

describe('lecteur', () => {
  it('lit tout dans l’ordre puis termine une seule fois', () => {
    const b = banc(['a', 'b']);
    b.l.lancer();
    b.fins[0]();
    b.fins[1]();
    assert.deepEqual(b.dits, ['a', 'b']);
    assert.equal(b.finis(), 1);
  });
  it('sans rien à lire, termine tout de suite', () => {
    const b = banc([]);
    b.l.lancer();
    assert.equal(b.finis(), 1);
  });
  it('la pause reprend au morceau en cours, sans avancer sur le retour de la coupure', () => {
    const b = banc(['a', 'b', 'c']);
    b.l.lancer();
    b.fins[0]();
    b.l.pause();
    b.fins[1]();
    assert.deepEqual(b.dits, ['a', 'b']);
    b.l.reprendre();
    assert.deepEqual(b.dits, ['a', 'b', 'b']);
    // La fin en retard de la lecture coupée arrive après la reprise : elle ne saute rien.
    b.fins[1]();
    assert.deepEqual(b.dits, ['a', 'b', 'b']);
    b.fins[2]();
    b.fins[3]();
    assert.deepEqual(b.dits, ['a', 'b', 'b', 'c']);
    assert.equal(b.finis(), 1);
  });
  it('une pause avant le départ attend la reprise', () => {
    const b = banc(['a']);
    b.l.pause();
    b.l.lancer();
    assert.deepEqual(b.dits, []);
    b.l.reprendre();
    assert.deepEqual(b.dits, ['a']);
  });
  it('une lecture annulée ne dit plus rien et ne termine pas', () => {
    const b = banc(['a', 'b']);
    b.l.lancer();
    b.l.annuler();
    b.fins[0]();
    b.l.reprendre();
    assert.deepEqual(b.dits, ['a']);
    assert.equal(b.finis(), 0);
  });
});
