import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aInscrire, appliquerDecision, estOuverte, nouvelleDecision, trierDecisions } from '../src/lib/decisions-exco.ts';
import { niveauRisque, nouveauRisque, resumeRisques, sansProjetsSupprimes, scoreRisque, trierRisques } from '../src/lib/risques.ts';
import type { DecisionExco, Risque, Tache } from '../src/lib/types.ts';

const M = '2026-11-11T10:00:00Z';
const risque = (id: string, p: 1 | 2 | 3, i: 1 | 2 | 3, statut: Risque['statut'] = 'ouvert'): Risque => ({ ...nouveauRisque({ id, maintenant: M, titre: id }), probabilite: p, impact: i, statut });
const tache = (id: string, x: Partial<Tache> = {}): Tache => ({ id, titre: id, source: 'manuel', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'passif', creeLe: M, ...x });

describe('risques', () => {
  it('score et niveau', () => {
    assert.deepEqual([[1, 1], [2, 1], [1, 3], [2, 2], [3, 2], [3, 3]].map(([p, i]) => niveauRisque({ probabilite: p as 1, impact: i as 1 })), ['faible', 'faible', 'moyen', 'moyen', 'eleve', 'eleve']);
    assert.equal(scoreRisque({ probabilite: 3, impact: 2 }), 6);
  });
  it('trie les plus graves d\'abord, les clos à la fin, et compte par niveau', () => {
    const l = [risque('clos', 3, 3, 'clos'), risque('faible', 1, 1), risque('grave', 3, 3), risque('moyen', 2, 2), risque('reduit', 3, 2, 'mitige')];
    assert.deepEqual(trierRisques(l).map((r) => r.id), ['grave', 'moyen', 'faible', 'reduit', 'clos']);
    assert.deepEqual(resumeRisques(l), { eleve: 2, moyen: 1, faible: 1, clos: 1 });
  });
  it('retire un projet supprimé', () => {
    assert.equal(sansProjetsSupprimes([{ ...risque('a', 1, 1), projet: 'x' }], [])[0].projet, undefined);
    assert.equal(sansProjetsSupprimes([{ ...risque('a', 1, 1), projet: 'x' }], [{ id: 'x' }])[0].projet, 'x');
  });
});

describe('décisions de l\'Exco', () => {
  const d = (id: string, date: string, statut: DecisionExco['statut'], x: Partial<DecisionExco> = {}): DecisionExco => ({ ...nouvelleDecision({ id, date, maintenant: M, titre: id }), statut, ...x });
  it('à prendre d\'abord (la plus proche en tête), puis le journal récent d\'abord', () => {
    const l = [d('vieille', '2026-09-01', 'prise'), d('b', '2026-12-10', 'a_prendre'), d('a', '2026-11-20', 'reportee'), d('recente', '2026-10-15', 'refusee')];
    assert.deepEqual(trierDecisions(l).map((x) => x.id), ['a', 'b', 'recente', 'vieille']);
    assert.deepEqual([estOuverte(l[0]), estOuverte(l[2])], [false, true]);
  });
  it('propose les actions à valider qui n\'ont pas de décision ouverte', () => {
    const ts = [tache('t1', { etat: 'a_valider' }), tache('t2', { etat: 'a_valider' }), tache('t3', { etat: 'a_valider', statut: 'fait' }), tache('t4')];
    assert.deepEqual(aInscrire(ts, [d('x', '2026-12-01', 'a_prendre', { tache: 't1' })]).map((t) => t.id), ['t2']);
    assert.deepEqual(aInscrire(ts, [d('x', '2026-12-01', 'prise', { tache: 't1' })]).map((t) => t.id), ['t1', 't2']);
  });
  it('une décision prise ou refusée libère l\'action ; reportée, non', () => {
    const ts = [tache('t1', { etat: 'a_valider' }), tache('t2', { etat: 'a_valider' })];
    assert.equal(appliquerDecision(ts, d('x', '2026-12-01', 'prise', { tache: 't1' }))[0].etat, undefined);
    assert.equal(appliquerDecision(ts, d('x', '2026-12-01', 'refusee', { tache: 't1' }))[1].etat, 'a_valider');
    assert.equal(appliquerDecision(ts, d('x', '2026-12-01', 'reportee', { tache: 't1' }))[0].etat, 'a_valider');
    assert.equal(appliquerDecision(ts, d('x', '2026-12-01', 'prise')), ts);
  });
});

import { construireRapport, rapportCsv, rapportHtml } from '../src/lib/rapport-exco.ts';
import { planifier } from '../src/lib/planning.ts';

describe('rapport : risques et décisions du journal', () => {
  const p = { id: 'a', nom: 'ERP', emoji: '🧩', debut: null, joursOuvres: true, creeLe: M };
  const e = [{ projet: p, taches: [], plan: planifier([], p, '2026-11-11') }];
  const decisions: DecisionExco[] = [
    { ...nouvelleDecision({ id: 'd1', date: '2026-11-05', maintenant: M, titre: 'Choix du prestataire', projet: 'a' }), statut: 'prise', decision: 'Offre B retenue' },
    { ...nouvelleDecision({ id: 'd2', date: '2026-12-01', maintenant: M, titre: 'À prendre' }) },
    { ...nouvelleDecision({ id: 'd3', date: '2026-08-01', maintenant: M, titre: 'Hors trimestre' }), statut: 'prise' },
  ];
  const risques = [{ ...risque('r1', 3, 3), projet: 'a', mitigation: 'Sauvegarde' }, risque('r2', 1, 1), risque('r3', 3, 2, 'mitige'), risque('r4', 3, 2)];
  it('liste les risques élevés ouverts et les décisions traitées du trimestre', () => {
    const r = construireRapport(e, '2026-T4', '2026-11-11', M, { risques, decisions });
    assert.deepEqual(r.risques.map((x) => [x.id, x.score, x.projetNom]), [['r1', 9, 'ERP'], ['r4', 6, undefined]]);
    assert.deepEqual(r.decisionsJournal.map((d) => [d.id, d.projetNom]), [['d1', 'ERP']]);
    assert.ok(rapportHtml(r).includes('Risques élevés') && rapportHtml(r).includes('Offre B retenue') && rapportCsv(r).includes('Décisions du trimestre'));
    assert.deepEqual([construireRapport(e, '2026-T4', '2026-11-11', M).risques, construireRapport(e, '2026-T4', '2026-11-11', M).decisionsJournal], [[], []]);
  });
});
