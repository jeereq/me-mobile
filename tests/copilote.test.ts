import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dejaEnTaches, donneesMails, lireAnalyses, lireCopilote, lireJson, mailsAAnalyser, MAX_MAILS_ANALYSE, propositionsDuTexte, tachesDepuis } from '../src/lib/copilote.ts';
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
  it('envoie le texte lu, sinon l’extrait, et coupe le lot', () => {
    const mails = Array.from({ length: 12 }, (_, i) => mail(`m${i}`, { extrait: 'extrait' }));
    const j = JSON.parse(donneesMails(mails, { m0: 'Texte complet' }));
    assert.equal(j.length, MAX_MAILS_ANALYSE);
    assert.deepEqual(j[0], { id: 'm0', de: 'Paul', sujet: 'Sujet m0', boite: 'pro', texte: 'Texte complet' });
    assert.equal(j[1].texte, 'extrait');
  });

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
});
