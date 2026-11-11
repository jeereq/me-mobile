import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { construireRapport, rapportCsv, rapportHtml, rapportTexte, trimestresDisponibles } from '../src/lib/rapport-exco.ts';
import { planifier, tachesDuProjet } from '../src/lib/planning.ts';
import type { Projet, Tache } from '../src/lib/types.ts';

const AUJ = '2026-11-11';
const projet = (id: string, nom = id): Projet => ({ id, nom, emoji: '📁', debut: null, joursOuvres: true, creeLe: AUJ });
let n = 0;
const tache = (p: string, fin: string, x: Partial<Tache> = {}): Tache => ({ id: `t${++n}`, titre: `T${n}`, source: 'manuel', priorite: 'moyenne', echeance: fin, statut: 'en_attente', mode: 'passif', creeLe: AUJ, projet: p, debut: fin, duree: 1, fixe: true, ...x });
const entrees = (liste: [Projet, Tache[]][]) => liste.map(([p, t]) => ({ projet: p, taches: tachesDuProjet(t, p.id), plan: planifier(tachesDuProjet(t, p.id), p, AUJ) }));

describe('rapport trimestriel', () => {
  const a = projet('a', 'Cybersécurité');
  const b = projet('b', 'ERP');
  const e = entrees([
    [a, [tache('a', '2026-10-05', { statut: 'fait', budget: 100, engage: 100 }), tache('a', '2026-10-20', { responsable: 'Marie', budget: 400 }), tache('a', '2026-12-10', { etat: 'a_valider', budget: 500 }), tache('a', '2027-01-15', { budget: 50 })]],
    [b, [tache('b', '2026-11-30', { etat: 'bloque' }), tache('b', '2026-09-10', { etat: 'a_valider' }), tache('b', '2027-02-02', { budget: 20 })]],
  ]);
  it('compte le trimestre, les retards, les blocages et les budgets', () => {
    const r = construireRapport(e, '2026-T4', AUJ, '2026-11-11T10:00:00Z');
    assert.deepEqual([r.nom, r.debut, r.fin], ['T4 2026', '2026-10-01', '2026-12-31']);
    assert.deepEqual([r.total, r.faites, r.enRetard, r.realisation], [4, 1, 1, 25]);
    assert.deepEqual([r.prevu, r.engage], [1000, 100]);
    const [pa, pb] = r.projets;
    assert.deepEqual([pa.total, pa.faites, pa.enRetard, pa.aValider], [3, 1, 1, 1]);
    assert.deepEqual([pb.total, pb.bloquees], [1, 1]);
    assert.deepEqual([r.suivant.nom, r.suivant.total, r.suivant.prevu], ['T1 2027', 2, 70]);
  });
  it('garde à l\'ordre du jour une décision d\'un trimestre passé, avec le nom du projet', () => {
    const r = construireRapport(e, '2026-T4', AUJ);
    assert.deepEqual(r.decisions.map((d) => [d.projetNom, d.fin]), [['ERP', '2026-09-10'], ['Cybersécurité', '2026-12-10']]);
    assert.ok(construireRapport(e, '2026-T3', AUJ).decisions.every((d) => d.fin <= '2026-09-30'));
  });
  it('écrit les points de vigilance', () => {
    const v = construireRapport(e, '2026-T4', AUJ).vigilance.join('\n');
    assert.match(v, /1 action en retard : Cybersécurité \(1\)/);
    assert.match(v, /bloquées : ERP \(1\)/);
    assert.match(v, /2 actions à faire n'ont pas de responsable|1 action à faire n'a pas/);
  });
  it('liste les trimestres sans trou', () => {
    assert.deepEqual(trimestresDisponibles(e, AUJ), ['2026-T3', '2026-T4', '2027-T1']);
  });
  it('produit du HTML échappé, du CSV pour Excel et un texte', () => {
    const sale = entrees([[projet('c', 'A<B> & "C"'), [tache('c', '2026-12-01', { titre: '<script>x</script>' })]]]);
    const r = construireRapport(sale, '2026-T4', AUJ);
    const h = rapportHtml(r);
    assert.ok(!h.includes('<script>x') && h.includes('&lt;script&gt;') && h.includes('A&lt;B&gt; &amp; &quot;C&quot;'));
    const csv = rapportCsv(construireRapport(e, '2026-T4', AUJ));
    assert.ok(csv.startsWith('﻿Rapport trimestriel T4 2026;du 01/10/2026 au 31/12/2026') && csv.includes('Cybersécurité;3;1;1;0;1000;100'));
    assert.match(rapportTexte(construireRapport(e, '2026-T4', AUJ)), /1 action faite sur 4 \(25 %\)/);
  });
  it('un trimestre vide donne un rapport vide, sans erreur', () => {
    const r = construireRapport(e, '2030-T1', AUJ);
    assert.deepEqual([r.total, r.realisation, r.projets.length], [0, null, 0]);
    assert.ok(rapportHtml(r).includes('Aucune action ne finit'));
  });
});
