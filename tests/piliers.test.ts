import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ajouterPilier, filtrerPilier, MAX_PILIERS, nbTachesDuPilier, nomParDefaut, nomPilier, parPilier, piliersDe, piliersParDefaut, piliersUtilises, renommerPilier, retirerPilier } from '../src/lib/piliers.ts';
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

describe('piliers configurables', () => {
  it("dix piliers d'origine tant que rien n'est choisi, puis ceux de l'utilisateur", () => {
    assert.equal(piliersDe({}).length, 10);
    assert.deepEqual(piliersDe({}).map((x) => x.nom).slice(0, 2), ['Pilier 1', 'Pilier 2']);
    assert.deepEqual(piliersDe({ piliers: [] }), [], 'une liste vide reste vide');
    const ordre = piliersDe({ piliers: [{ id: 'p3', n: 3, nom: 'Clients' }, { id: 'p1', n: 1, nom: 'Finances' }] });
    assert.deepEqual(ordre.map((x) => x.n), [1, 3]);
  });
  it('le nom choisi, sinon « Pilier n »', () => {
    const ps = renommerPilier(piliersParDefaut(), 2, 'Clients');
    assert.equal(nomPilier(2, ps), 'Clients');
    assert.equal(nomPilier(3, ps), 'Pilier 3');
    assert.equal(nomPilier(12, ps), 'Pilier 12', 'un numéro qui n’est plus dans la liste garde un nom');
    assert.equal(nomPilier(2), 'Pilier 2');
    assert.equal(nomPilier(2, renommerPilier(ps, 2, '  ')), 'Pilier 2');
    assert.equal(nomParDefaut(ps[0]) && !nomParDefaut(ps[1]), true);
  });
  it('ajouter prend le numéro suivant, jusqu’à la limite', () => {
    const ps = ajouterPilier(piliersParDefaut());
    assert.deepEqual(ps.at(-1), { id: 'p11', n: 11, nom: 'Pilier 11' });
    let x = piliersParDefaut();
    for (let i = 0; i < 30; i++) x = ajouterPilier(x);
    assert.equal(x.length, MAX_PILIERS);
    assert.deepEqual(ajouterPilier([]).map((y) => y.n), [1]);
  });
  it("retirer un pilier l'enlève des tâches, sans toucher aux autres", () => {
    const espace = { piliers: renommerPilier(piliersParDefaut(), 6, 'Clients'), taches: ts };
    assert.equal(nbTachesDuPilier(espace.taches, 6), 2);
    const apres = retirerPilier(espace, 6);
    assert.equal(apres.piliers.some((x) => x.n === 6), false);
    assert.equal(apres.piliers.length, 9);
    assert.deepEqual(apres.taches.map((t) => t.pilier), [[8], undefined, [1], undefined]);
    assert.equal('pilier' in apres.taches[1], false);
    assert.equal(nbTachesDuPilier(ts, 6), 2, 'les tâches d’origine ne bougent pas');
    assert.equal(retirerPilier({ taches: ts }, 1).piliers.length, 9, 'depuis les dix d’origine');
  });
  it('le rapport utilise les noms choisis', () => {
    const ps = renommerPilier(piliersParDefaut(), 6, 'Clients');
    assert.equal(parPilier([{ pilier: [6], fait: true, retard: false }], ps)[0].nom, 'Clients');
    assert.equal('nom' in parPilier([{ pilier: [6], fait: true, retard: false }])[0], false);
    const r = construireRapport(e, '2026-T4', AUJ, undefined, { piliers: ps });
    assert.ok(rapportHtml(r).includes('Clients'));
    assert.ok(rapportCsv(r).includes('Clients;'));
  });
});
