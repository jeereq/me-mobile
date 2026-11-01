import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contexteCrm, refsDu } from '../src/lib/contexte-mails.ts';
import { demandeAnalyse, echeanceMail, lireAnalyses, lireLot, MAX_MAILS_ANALYSE } from '../src/lib/copilote.ts';
import type { Mail } from '../src/lib/mails.ts';
import type { Espace, Projet, Relance, Tache } from '../src/lib/types.ts';

const J = '2026-10-30';
const m = (id: string, x: Partial<Mail> = {}): Mail => ({ id: `ext:g1:${id}`, fil: `f-${id}`, sujet: 'Devis toiture', contact: 'Paul Martin', adresse: 'Paul Martin <paul@martin.fr>', date: J, sens: 'recu', source: 'gmail', ctx: 'pro', ...x });
const rel = (id: string, x: Partial<Relance> = {}): Relance => ({ id, contact: 'Paul', sujet: 'Devis toiture', boite: 'pro', date: '2026-10-20', statut: 'a_faire', mode: 'normal', creeLe: J, ...x });
const tac = (id: string, x: Partial<Tache> = {}): Tache => ({ id, titre: `Tâche ${id}`, source: 'pro', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: J, ...x });
const proj = (id: string, x: Partial<Projet> = {}): Projet => ({ id, nom: `Projet ${id}`, emoji: '🏠', debut: null, joursOuvres: true, creeLe: J, ...x }) as Projet;
const esp = (o: Partial<Espace>) => ({ relances: [], taches: [], projets: [], ...o }) as Pick<Espace, 'relances' | 'taches' | 'projets'>;

describe('contexte de Me envoyé à l’IA', () => {
  it('les relances ouvertes avec l’expéditeur ou rattachées au fil, pas les autres', () => {
    const e = esp({
      relances: [rel('1'), rel('2', { contact: 'Sophie', mail: { fil: 'g1:f-a', sujet: 'x' } }), rel('3', { contact: 'Karim' }), rel('4', { statut: 'repondu' })],
    });
    const c = contexteCrm([m('a')], e);
    assert.deepEqual(c.relances.map((r) => r.ref), ['r:1', 'r:2']);
    assert.deepEqual(c.relances[0], { ref: 'r:1', contact: 'Paul', sujet: 'Devis toiture', depuis: '2026-10-20' });
  });
  it('les tâches ouvertes, liées au mail d’abord, sans les faites', () => {
    const e = esp({ taches: [tac('vieille', { creeLe: '2026-01-01' }), tac('faite', { statut: 'fait' }), tac('liee', { mail: { fil: 'g1:f-a', sujet: 'x' }, creeLe: '2025-01-01' }), tac('recente', { creeLe: '2026-10-29' })] });
    assert.deepEqual(contexteCrm([m('a')], e).taches.map((t) => t.ref), ['t:liee', 't:recente', 't:vieille']);
  });
  it('les projets en cours seulement', () => {
    const c = contexteCrm([m('a')], esp({ projets: [proj('1'), proj('2', { archive: true })] }));
    assert.deepEqual(c.projets, [{ ref: 'p:1', nom: 'Projet 1' }]);
    assert.deepEqual(refsDu(c), { relances: [], projets: ['p:1'] });
  });
  it('coupe les textes à ce que le serveur accepte', () => {
    const e = esp({ relances: [rel('1', { contact: 'P'.repeat(500), sujet: 'S'.repeat(500) })], taches: [tac('t', { titre: 'T'.repeat(500) })], projets: [proj('1', { nom: 'N'.repeat(500) })] });
    const c = contexteCrm([m('a', { contact: 'P'.repeat(500), adresse: undefined })], e);
    assert.equal(c.relances[0].contact.length, 200);
    assert.equal(c.relances[0].sujet.length, 300);
    assert.equal(c.taches[0].titre.length, 300);
    assert.equal(c.projets[0].nom.length, 200);
    assert.equal(c.taches[0].echeance, null);
  });
});

describe('demande d’analyse envoyée au serveur', () => {
  const crm = { relances: [], taches: [], projets: [] };
  it('des références de mails, le ton, les consignes nettoyées et le contexte — jamais le texte des mails', () => {
    const d = demandeAnalyse([m('a'), m('b', { extrait: 'extrait' })], { ton: 'direct', consignes: '  Repère   les factures  ', crm });
    assert.deepEqual(d, { mails: ['ext:g1:a', 'ext:g1:b'], ton: 'direct', consignes: 'Repère les factures', crm });
    assert.ok(!JSON.stringify(d).includes('extrait'));
  });
  it('sans consignes, pas de champ « consignes »', () => {
    assert.ok(!('consignes' in demandeAnalyse([m('a')], { ton: 'neutre', consignes: '   ', crm })));
    assert.ok(!('consignes' in demandeAnalyse([m('a')], { ton: 'neutre', crm })));
  });
  it('dix mails au plus, et seulement ceux d’un compte connecté', () => {
    const mails = [...Array.from({ length: 12 }, (_, i) => m(`${i}`)), m('x', { id: 'local-1' })];
    const d = demandeAnalyse(mails, { ton: 'neutre', crm });
    assert.equal(d.mails.length, MAX_MAILS_ANALYSE);
    assert.deepEqual(demandeAnalyse([m('x', { id: 'local-1' })], { ton: 'neutre', crm }).mails, []);
  });
  it('un identifiant de mail qui contient « : » reste entier', () => {
    assert.deepEqual(demandeAnalyse([m('a:b:c')], { ton: 'neutre', crm }).mails, ['ext:g1:a:b:c']);
  });
});

describe('nouveaux champs de l’analyse', () => {
  const brut = JSON.stringify({
    analyses: [
      { id: 'a', resume: 'Devis', action: 'repondre', categorie: 'devis', echeance: '2026-11-06', montant: '8 450 €', rdv_date: '2026-11-12', rdv_heure: '08:30', relance: 'r:1', projet: 'p:1' },
      { id: 'b', resume: 'x', action: 'rien', categorie: 'inconnue', echeance: '2026-02-31', montant: null, rdv_date: null, rdv_heure: '25:00', relance: 'r:99', projet: 'p:9' },
    ],
  });
  const refs = { relances: ['r:1'], projets: ['p:1'] };
  it('lit catégorie, échéance, montant, rendez-vous, relance et projet', () => {
    const [a] = lireAnalyses(brut, ['a', 'b'], refs);
    assert.equal(a.categorie, 'devis');
    assert.equal(a.echeance, '2026-11-06');
    assert.equal(a.montant, '8 450 €');
    assert.deepEqual(a.rdv, { date: '2026-11-12', heure: '08:30' });
    assert.equal(a.relance, '1');
    assert.equal(a.projet, '1');
  });
  it('écarte une catégorie inconnue, une date impossible, une ref qui n’a pas été envoyée', () => {
    const b = lireAnalyses(brut, ['a', 'b'], refs)[1];
    for (const k of ['categorie', 'echeance', 'montant', 'rdv', 'relance', 'projet'] as const) assert.equal(b[k], undefined, k);
  });
  it('sans refs, aucune relance ni projet n’est retenu', () => {
    const [a] = lireAnalyses(brut, ['a']);
    assert.equal(a.relance, undefined);
    assert.equal(a.projet, undefined);
  });
  it('un lot relit les mêmes champs', () => {
    assert.equal(lireLot(JSON.stringify({ synthese: 'x', analyses: JSON.parse(brut).analyses }), ['a'], J, refs).analyses[0].relance, '1');
  });
  it('la tâche tirée du mail prend la date limite du mail', () => {
    assert.equal(echeanceMail({ urgence: 'normale', echeance: '2026-11-06' }, J), '2026-11-06');
    assert.equal(echeanceMail({ urgence: 'normale', echeance: '2026-10-01' }, J), '2026-11-01');
    assert.equal(echeanceMail({ urgence: 'haute' }, J), J);
  });
});

describe('synthèse d’un lot à partir des analyses', () => {
  it('envoie l’analyse de chaque mail, pas son texte, avec les tâches ouvertes', async () => {
    const { donneesSynthese } = await import('../src/lib/copilote.ts');
    const contexte = { aujourdhui: J, crm: { relances: [{ ref: 'r:1', contact: 'Paul', sujet: 'x', depuis: J }], taches: [{ ref: 't:1', titre: 'Payer OVH', echeance: null }], projets: [] } };
    const analyses = [
      { id: 'ext:g1:a', resume: 'Facture OVH de 42 €', urgence: 'haute' as const, action: 'tache' as const, reponse: 'Bonjour…', tache: 'Payer la facture', categorie: 'facture' as const, echeance: '2026-11-02', montant: '42 €' },
      { id: 'inconnu', resume: 'x', urgence: 'basse' as const, action: 'rien' as const, reponse: '', tache: '' },
    ];
    const j = JSON.parse(donneesSynthese([m('a', { extrait: 'texte secret' })], analyses, contexte));
    assert.deepEqual(j.crm, { taches: contexte.crm.taches });
    assert.equal(j.aujourdhui, J);
    assert.deepEqual(j.mails, [{ id: 'ext:g1:a', de: 'Paul Martin', date: J, sujet: 'Devis toiture', resume: 'Facture OVH de 42 €', urgence: 'haute', action: 'tache', categorie: 'facture', echeance: '2026-11-02', montant: '42 €', tache: 'Payer la facture' }]);
  });
  it('100 mails analysés tiennent largement sous la limite du serveur', async () => {
    const { donneesSynthese } = await import('../src/lib/copilote.ts');
    const mails = Array.from({ length: 100 }, (_, i) => m(`${i}`));
    const analyses = mails.map((x) => ({ id: x.id, resume: 'r'.repeat(300), urgence: 'normale' as const, action: 'repondre' as const, reponse: 'x'.repeat(2000), tache: 't'.repeat(160) }));
    assert.ok(donneesSynthese(mails, analyses).length < 54_000);
  });
});
