import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filtrerPilier, parPilier, piliersUtilises } from '../src/lib/piliers.ts';
import { construireRapport, rapportCsv, rapportHtml } from '../src/lib/rapport-exco.ts';
import { planifier, tachesDuProjet } from '../src/lib/planning.ts';
import type { Projet, Tache } from '../src/lib/types.ts';

const AUJ = '2026-11-11';
const p: Projet = { id: 'a', nom: 'A', emoji: '📁', debut: null, joursOuvres: true, creeLe: AUJ };
let n = 0;
const tache = (fin: string, x: Partial<Tache> = {}): Tache => ({ id: `t${++n}`, titre: `T${n}`, source: 'manuel', priorite: 'moyenne', echeance: fin, statut: 'en_attente', mode: 'passif', creeLe: AUJ, projet: 'a', debut: fin, duree: 1, fixe: true, ...x });
const ts = [tache('2026-10-05', { pilier: [6, 8], statut: 'fait' }), tache('2026-10-20', { pilier: [6] }), tache('2026-12-10', { pilier: [1] }), tache('2026-12-11')];
const e = [{ projet: p, taches: tachesDuProjet(ts, 'a'), plan: planifier(tachesDuProjet(ts, 'a'), p, AUJ) }];

describe('piliers', () => {
  it('liste les piliers cités et filtre les actions', () => {
    assert.deepEqual(piliersUtilises(e), [1, 6, 8]);
    assert.equal(filtrerPilier(e, null), e);
    assert.deepEqual(filtrerPilier(e, 6)[0].taches.map((t) => t.pilier), [[6, 8], [6]]);
    assert.equal(filtrerPilier(e, 6)[0].plan, e[0].plan);
    assert.deepEqual(filtrerPilier(e, 5)[0].taches, []);
  });
  it('compte une action pour chacun de ses piliers', () => {
    assert.deepEqual(parPilier([{ pilier: [6, 8], fait: true, retard: false }, { pilier: [6], fait: false, retard: true }, { fait: false, retard: false }]), [
      { pilier: 6, total: 2, faites: 1, enRetard: 1 },
      { pilier: 8, total: 1, faites: 1, enRetard: 0 },
    ]);
  });
  it('le rapport donne une ligne par pilier, en HTML et en CSV', () => {
    const r = construireRapport(e, '2026-T4', AUJ);
    assert.deepEqual(r.piliers, [{ pilier: 1, total: 1, faites: 0, enRetard: 0 }, { pilier: 6, total: 2, faites: 1, enRetard: 1 }, { pilier: 8, total: 1, faites: 1, enRetard: 0 }]);
    assert.ok(rapportHtml(r).includes('Par pilier du groupe') && rapportCsv(r).includes('Pilier 6;2;1;1'));
    assert.deepEqual(construireRapport([{ ...e[0], taches: e[0].taches.slice(3) }], '2026-T4', AUJ).piliers, []);
  });
});
