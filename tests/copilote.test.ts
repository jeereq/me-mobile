import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { boitesNonLues, dejaEnTaches, lireAnalyses, lireCopilote, lireJson, mailsAAnalyser, MAX_MAILS_ANALYSE, paquets, propositionsDuTexte, tachesDepuis } from '../src/lib/copilote.ts';
import type { Mail } from '../src/lib/mails.ts';

const d = '2026-10-27';
let n = 0;
const o = { mode: 'normal' as const, id: () => `t${n++}`, maintenant: '2026-10-27T10:00:00Z' };

describe('copilote : propositions de tâches', () => {
  it('lit le JSON, même entouré de texte ou de ```json', () => {
    assert.deepEqual(lireJson('Voici :\n```json\n{"a":1}\n```'), { a: 1 });
    assert.equal(lireJson('pas de json'), null);
    assert.equal(lireJson('[1,2]'), null);
  });

  it('range le plan et les propositions, sans doublon, avec des valeurs sûres', () => {
    const r = lireCopilote(
      JSON.stringify({
        plan: '**Priorités** :\n- Appeler Paul',
        propositions: [
          { titre: 'Appeler Paul pour le devis', priorite: 'haute', echeance: d, heure: '9h30', raison: 'Il attend depuis lundi.' },
          { titre: 'appeler paul pour le devis !', priorite: 'haute' },
          { titre: 'Payer la facture EDF', priorite: 'urgente', echeance: 'demain' },
          { titre: '' },
          'n’importe quoi',
        ],
      }),
      d,
    );
    assert.equal(r.plan, 'Priorités :\n• Appeler Paul');
    assert.deepEqual(
      r.propositions.map((p) => [p.titre, p.priorite, p.echeance, p.heure]),
      [
        ['Appeler Paul pour le devis', 'haute', d, '09:30'],
        ['Payer la facture EDF', 'moyenne', d, undefined],
      ],
    );
  });

  it("tire les propositions du texte quand le serveur ne rend que le plan", () => {
    const p = propositionsDuTexte('Tes 3 priorités :\n1. Envoyer le devis à Ana\n14h00 – Appeler la banque\nDe 15h à 16h : Réunion équipe\nPause déjeuner\n• Envoyer le devis à Ana', d);
    assert.deepEqual(p.map((x) => x.titre), ['Envoyer le devis à Ana', 'Appeler la banque']);
    assert.deepEqual(lireCopilote('Envoyer le devis à Ana', d).propositions.map((x) => x.titre), ['Envoyer le devis à Ana']);
  });

  it('convertit tout, ou seulement la sélection, sans recréer une tâche en cours', () => {
    const { propositions } = lireCopilote(JSON.stringify({ plan: 'x', propositions: [{ titre: 'Appeler Paul' }, { titre: 'Payer EDF' }, { titre: 'Ranger le bureau' }] }), d);
    const taches = [{ titre: 'Payer  EDF', statut: 'en_attente' as const }, { titre: 'Ranger le bureau', statut: 'fait' as const }];
    assert.deepEqual([...dejaEnTaches(propositions, taches)], ['p1']);
    const tout = tachesDepuis(propositions, propositions.map((p) => p.id), taches, o);
    assert.deepEqual(tout.map((t) => t.titre), ['Appeler Paul', 'Ranger le bureau']);
    assert.equal(tout[0].statut, 'en_attente');
    assert.equal(tout[0].source, 'manuel');
    const partiel = tachesDepuis(propositions, ['p2'], taches, o);
    assert.deepEqual(partiel.map((t) => t.titre), ['Ranger le bureau']);
  });
});

const mail = (id: string, x: Partial<Mail> = {}): Mail => ({ id, sujet: `Sujet ${id}`, contact: 'Paul', date: d, sens: 'recu', source: 'gmail', ctx: 'pro', ...x }) as Mail;

describe('copilote : analyse des mails', () => {
  it('ne garde que les mails demandés, dans leur ordre, avec des valeurs sûres', () => {
    const a = lireAnalyses(
      JSON.stringify({
        analyses: [
          { id: 'b', resume: 'Newsletter', urgence: 'basse', action: 'rien', reponse: 'Merci !' },
          { id: 'a', resume: 'Demande un devis', urgence: 'critique', reponse: 'Bonjour Paul, …', tache: 'Préparer le devis' },
          { id: 'inconnu', resume: 'x' },
        ],
      }),
      ['a', 'b', 'c'],
    );
    assert.deepEqual(a.map((x) => [x.id, x.urgence, x.action, x.reponse]), [
      ['a', 'normale', 'repondre', 'Bonjour Paul, …'],
      ['b', 'basse', 'rien', ''],
    ]);
  });

  it('propose les non lus reçus d’abord, sinon les plus récents', () => {
    const l = [mail('vieux', { date: '2026-10-01' }), mail('envoye', { sens: 'envoye', nonLu: true }), mail('nl1', { nonLu: true, heure: '08:00' }), mail('nl2', { nonLu: true, heure: '09:00' })];
    assert.deepEqual(mailsAAnalyser(l).map((m) => m.id), ['nl2', 'nl1']);
    assert.deepEqual(mailsAAnalyser([mail('a', { date: '2026-10-01' }), mail('b')]).map((m) => m.id), ['b', 'a']);
  });

  it('garde tous les non lus annoncés, pas seulement les 10 premiers', () => {
    const l = Array.from({ length: 203 }, (_, i) => mail(`nl${i}`, { nonLu: true }));
    assert.equal(mailsAAnalyser(l).length, 203);
    // Sans non lu, seulement les derniers reçus.
    assert.equal(mailsAAnalyser(Array.from({ length: 30 }, (_, i) => mail(`r${i}`))).length, MAX_MAILS_ANALYSE);
  });

  it('analyse les non lus de la boîte choisie : un compte ou une boîte partagée', () => {
    const l = [
      mail('perso', { nonLu: true, compte: 'moi@gmail.com' }),
      mail('pro', { nonLu: true, compte: 'moi@societe.fr' }),
      mail('ventes', { nonLu: true, compte: 'moi@societe.fr', boite: 'ventes@societe.fr' }),
      mail('ventes-lu', { compte: 'moi@societe.fr', boite: 'ventes@societe.fr' }),
    ];
    assert.deepEqual(mailsAAnalyser(l, 'moi@societe.fr').map((m) => m.id), ['pro']);
    assert.deepEqual(mailsAAnalyser(l, 'ventes@societe.fr').map((m) => m.id), ['ventes']);
    assert.equal(mailsAAnalyser(l).length, 3);
    assert.deepEqual(boitesNonLues([...l, mail('pro2', { nonLu: true, compte: 'moi@societe.fr' })]), [
      { adresse: 'moi@societe.fr', partagee: false, nonLus: 2 },
      { adresse: 'moi@gmail.com', partagee: false, nonLus: 1 },
      { adresse: 'ventes@societe.fr', partagee: true, nonLus: 1 },
    ]);
  });

  it('coupe les mails en paquets de 10 pour l’IA', () => {
    const p = paquets(Array.from({ length: 203 }, (_, i) => i));
    assert.equal(p.length, 21);
    assert.deepEqual(p.map((x) => x.length).slice(-2), [10, 3]);
    assert.deepEqual(p.flat().length, 203);
    assert.deepEqual(paquets([]), []);
  });
});

describe('copilote : analyse d’un lot de mails', async () => {
  const { bornesDates, bornesPeriode, decrirePerimetre, domaineDe, filtrerPerimetre, frequents, jourValide, lireLot, lireReglagesAnalyse, MAX_CONSIGNES, nettoyerConsignes, nombreLot, PERIODES, requeteLot, reunirLot } = await import('../src/lib/copilote.ts');
  const m = (id: string, x: Partial<Mail> = {}): Mail => ({ id: `ext:c1:${id}`, sujet: id, contact: 'Paul', date: d, sens: 'recu', source: 'gmail', ctx: 'pro', ...x }) as Mail;

  it('lit le domaine d’une adresse', () => {
    assert.equal(domaineDe('OVH <facturation@OVH.com>'), 'ovh.com');
    assert.equal(domaineDe('paul'), '');
  });

  it('borne la période sur aujourd’hui, jour compris', () => {
    assert.deepEqual(bornesPeriode('7j', d), { depuis: '2026-10-21' });
    assert.deepEqual(bornesPeriode('tout', d), {});
  });

  it('décrit le périmètre et le traduit pour le serveur', () => {
    const p = { genre: 'domaine' as const, domaine: 'ovh.com', depuis: '2026-10-01', jusqua: '2026-10-27' };
    assert.match(decrirePerimetre(p), /^les mails de @ovh\.com, du 1 octobre 2026 au 27 octobre 2026$/);
    assert.deepEqual(requeteLot(p), { domaine: 'ovh.com', depuis: '2026-10-01', jusqua: '2026-10-27', max: '50' });
    assert.deepEqual(requeteLot({ genre: 'dossier', dossier: { id: 'Label_7', nom: 'Factures' }, qui: 'ignoré' }), { dossier: 'Label_7', max: '50' });
  });

  it('propose le mois en cours et le mois dernier, avec leurs deux bornes', () => {
    assert.deepEqual(bornesPeriode('mois', '2026-10-27'), { depuis: '2026-10-01' });
    assert.deepEqual(bornesPeriode('mois-1', '2026-10-27'), { depuis: '2026-09-01', jusqua: '2026-09-30' });
    assert.deepEqual(bornesPeriode('mois-1', '2026-01-05'), { depuis: '2025-12-01', jusqua: '2025-12-31' });
    assert.deepEqual(bornesPeriode('mois-1', '2024-03-10'), { depuis: '2024-02-01', jusqua: '2024-02-29' });
    assert.ok(PERIODES.some((x) => x.cle === 'dates'));
  });

  it('ne connaît que les jours qui existent', () => {
    assert.equal(jourValide('2026-02-28'), true);
    assert.equal(jourValide('2024-02-29'), true);
    for (const faux of ['2026-02-30', '2026-13-01', '2026-1-5', '', 'demain', '2026-00-10']) assert.equal(jourValide(faux), false, faux);
  });

  it('vérifie le début et la fin choisis, sans rien ignorer en silence', () => {
    assert.deepEqual(bornesDates('2026-09-01', '2026-09-30'), { depuis: '2026-09-01', jusqua: '2026-09-30' });
    assert.deepEqual(bornesDates('2026-09-01', ''), { depuis: '2026-09-01' });
    assert.deepEqual(bornesDates('', '2026-09-30'), { jusqua: '2026-09-30' });
    assert.deepEqual(bornesDates('  ', ''), {});
    assert.deepEqual(bornesDates('2026-09-30', '2026-09-30'), { depuis: '2026-09-30', jusqua: '2026-09-30' });
    assert.match(bornesDates('2026-09-30', '2026-09-01').erreur ?? '', /avant la fin/);
    assert.match(bornesDates('2026-9-1', '').erreur ?? '', /début/);
    assert.match(bornesDates('', '2026-02-30').erreur ?? '', /fin/);
  });

  it('demande au serveur le nombre de mails choisi, entre 5 et 100', () => {
    const p = { genre: 'domaine' as const, domaine: 'ovh.com' };
    assert.equal(requeteLot(p, 25).max, '25');
    assert.equal(requeteLot(p, 100).max, '100');
    assert.equal(requeteLot(p, 5000).max, '100');
    assert.equal(requeteLot(p, 1).max, '5');
    assert.equal(requeteLot(p).max, '50');
    assert.equal(nombreLot('50'), 50);
    assert.equal(nombreLot(NaN), 50);
    assert.equal(nombreLot(33.4), 33);
  });

  it('nettoie les consignes et relit les réglages sans se fier au stockage', () => {
    assert.equal(nettoyerConsignes('  Repère   les\tfactures \n\n\n\nimpayées  '), 'Repère les factures \n\nimpayées');
    assert.equal(nettoyerConsignes(42), '');
    assert.equal(nettoyerConsignes('a'.repeat(2000)).length, MAX_CONSIGNES);
    assert.deepEqual(lireReglagesAnalyse(null), { consignes: '', nombre: 50 });
    assert.deepEqual(lireReglagesAnalyse({ consignes: ' Urgent d’abord ', nombre: 25 }), { consignes: 'Urgent d’abord', nombre: 25 });
    assert.deepEqual(lireReglagesAnalyse({ consignes: { x: 1 }, nombre: 'beaucoup' }), { consignes: '', nombre: 50 });
  });

  it('applique le périmètre aux mails déjà relus', () => {
    const l = [m('a', { adresse: 'f@ovh.com', date: '2026-10-20' }), m('b', { adresse: 'x@mail.ovh.com' }), m('c', { adresse: 'p@exemple.fr', contact: 'Paul Dubois' }), m('d', { adresse: 'f@ovh.com', date: '2026-08-01' })];
    assert.deepEqual(filtrerPerimetre(l, { genre: 'domaine', domaine: '@OVH.com', depuis: '2026-10-01' }).map((x) => x.sujet), ['a', 'b']);
    assert.deepEqual(filtrerPerimetre(l, { genre: 'personne', qui: 'paul dub' }).map((x) => x.sujet), ['c']);
    assert.deepEqual(filtrerPerimetre(l, { genre: 'personne', qui: 'Paul', compte: 'autre' }), []);
  });

  it('réunit les résultats sans doublon, les plus récents d’abord', () => {
    const r = reunirLot([m('a', { date: '2026-10-01' }), m('b', { date: '2026-10-20' })], [m('a', { date: '2026-10-01' }), m('c', { date: '2026-10-10' })]);
    assert.deepEqual(r.map((x) => x.sujet), ['b', 'c', 'a']);
  });

  it('suggère les expéditeurs et domaines fréquents, sans les messageries publiques', () => {
    const f = frequents([m('a', { adresse: 'a@ovh.com' }), m('b', { adresse: 'b@ovh.com' }), m('c', { adresse: 'c@gmail.com', contact: 'Léa' }), m('d', { sens: 'envoye', adresse: 'd@edf.fr' })]);
    assert.deepEqual(f.domaines, ['ovh.com']);
    assert.deepEqual(f.personnes, ['Paul', 'Léa']);
  });

  it('lit la synthèse, les constats, les actions et chaque mail', () => {
    const r = lireLot(JSON.stringify({ synthese: '**Trois** factures OVH.', points: ['3 factures', ''], actions: [{ titre: 'Payer la facture OVH de septembre', priorite: 'haute' }], analyses: [{ id: 'ext:c1:a', resume: 'Facture', action: 'tache' }] }), ['ext:c1:a'], d);
    assert.equal(r.synthese, 'Trois factures OVH.');
    assert.deepEqual(r.points, ['3 factures']);
    assert.deepEqual(r.actions.map((a) => [a.titre, a.priorite]), [['Payer la facture OVH de septembre', 'haute']]);
    assert.equal(r.analyses.length, 1);
    assert.deepEqual(lireLot('{"synthese":"x"}', [], d).actions, []);
  });
});
