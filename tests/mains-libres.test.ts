import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { annonceMail, bilanMainsLibres, commandeConfirme, commandeMail, fileAnalysee } from '../src/lib/mains-libres.ts';

const type = (t: string) => commandeMail(t).type;
const a = (id: string, x: object = {}) => ({ id, resume: `Résumé ${id}.`, urgence: 'normale' as const, action: 'repondre' as const, reponse: 'Bonjour', tache: '', ...x });
const m = (id: string) => ({ id, sujet: `Sujet ${id}`, contact: `Contact ${id}`, date: '2026-11-03', sens: 'recu', ctx: 'pro' }) as never;

describe('les commandes après un mail', () => {
  it('reconnaît ce qu’on dit naturellement', () => {
    for (const [t, attendu] of [['Suivant', 'suivant'], ['passe au suivant', 'suivant'], ['le prochain', 'suivant'], ['Archive !', 'archiver'], ['archive-le', 'archiver'], ['marque-le comme lu', 'lu'], ['crée une tâche', 'tache'], ['répète', 'repeter'], ['tu peux répéter ?', 'repeter'], ['lis tout', 'tout'], ['lis-le en entier', 'tout'], ['réponds', 'repondre'], ['je veux répondre', 'repondre'], ['stop', 'stop'], ['Arrête', 'stop'], ['c’est fini', 'stop'], ['bonjour la maison', 'inconnu'], ['', 'inconnu']] as const) assert.equal(type(t), attendu, t);
  });
  it('garde une réponse déjà dite, avec ses accents', () => {
    assert.deepEqual(commandeMail('réponds que je serai là à midi'), { type: 'repondre', texte: 'Je serai là à midi' });
    assert.deepEqual(commandeMail("réponds lui qu'on valide"), { type: 'repondre', texte: 'On valide' });
    assert.deepEqual(commandeMail('réponds'), { type: 'repondre' });
  });
});

describe('la confirmation d’un envoi', () => {
  it('envoie seulement sur un accord clair', () => {
    for (const t of ['oui', 'Oui, envoie', 'envoie', 'vas-y', 'ok', "d'accord"]) assert.equal(commandeConfirme(t), 'envoyer', t);
  });
  it('n’envoie pas au moindre refus ou doute', () => {
    for (const t of ['non', 'non envoie pas', "n'envoie pas", 'pas maintenant', 'attends', 'annule', 'oui mais non']) assert.equal(commandeConfirme(t), 'annuler', t);
    for (const t of ['', 'bof', 'je ne sais trop']) assert.equal(commandeConfirme(t), 'inconnu', t);
  });
  it('comprend les ajustements', () => {
    assert.equal(commandeConfirme('plus court'), 'court');
    assert.equal(commandeConfirme('fais plus formel'), 'formel');
    assert.equal(commandeConfirme('refuse poliment'), 'decliner');
    assert.equal(commandeConfirme('refais-la'), 'refaire');
    assert.equal(commandeConfirme('je veux la modifier'), 'modifier');
    assert.equal(commandeConfirme('stop'), 'stop');
  });
  it('comprend à qui envoyer', () => {
    for (const t of ['seulement à lui', 'juste à Paul', 'à lui seul', 'à elle seulement', 'à l’expéditeur']) assert.equal(commandeConfirme(t), 'seul', t);
    for (const t of ['à tous', 'à tout le monde']) assert.equal(commandeConfirme(t), 'tous', t);
  });
});

describe('la file et ce qui est dit', () => {
  it('l’urgent d’abord, sans ce qui ne demande rien', () => {
    const f = fileAnalysee([a('x'), a('y', { urgence: 'haute' }), a('z', { action: 'rien' }), a('perdu')], (id) => (id === 'perdu' ? undefined : m(id)));
    assert.deepEqual(f.map((e) => e.mail.id), ['y', 'x']);
  });
  it('annonce le mail, la consigne seulement au premier', () => {
    const e = { mail: m('p'), analyse: a('p', { urgence: 'haute' }) };
    assert.equal(annonceMail(e, 0, 3), 'Mail 1 sur 3. Urgent. De Contact p. Résumé p. Une réponse est prête. Dis réponds, suivant, archive ou stop.');
    assert.equal(annonceMail(e, 1, 3), 'Mail 2 sur 3. Urgent. De Contact p. Résumé p. Une réponse est prête.');
    assert.equal(annonceMail({ mail: m('q') }, 1, 1), 'De Contact q. Objet : Sujet q.');
  });
  it('fait le bilan', () => {
    assert.equal(bilanMainsLibres({ envoyes: 2, archives: 1, lus: 0, taches: 0 }), "C'est terminé : 2 réponses envoyées, 1 mail archivé.");
    assert.equal(bilanMainsLibres({ envoyes: 0, archives: 0, lus: 0, taches: 0 }), "C'est terminé.");
  });
});
