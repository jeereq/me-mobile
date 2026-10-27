import assert from 'node:assert/strict';
import { test } from 'node:test';

import { comprendre, confirmerAjout } from '../src/lib/commande.ts';
import type { Espace, Finances } from '../src/lib/types.ts';

const D = '2026-10-27'; // un mardi
const finances: Finances = {
  devise: '€',
  budgets: [{ id: 'b1', nom: 'Courses', emoji: '🛒', montant: 300, periode: 'mois' }],
  depenses: [{ id: 'd1', montant: 120, budget: 'b1', note: 'Marché', date: '2026-10-05', creeLe: '' }],
};
const espace = (x: Partial<Espace> = {}): Espace =>
  ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: {} as Espace['audio'], majLe: '', finances, ...x }) as Espace;
const tache = (id: string, titre: string, x: object = {}) => ({ id, titre, source: 'manuel' as const, priorite: 'moyenne' as const, echeance: null, statut: 'en_attente' as const, faitLe: null, mode: 'normal' as const, creeLe: '', ...x });

test('ajouter une tâche à la voix, avec ou sans « ajoute »', () => {
  const a = comprendre('Ajoute une tâche envoyer le devis demain', espace(), D);
  assert.deepEqual(a, { type: 'ajout', phrase: { genre: 'tache', titre: 'Envoyer le devis', echeance: '2026-10-28', priorite: 'moyenne' } });
  const b = comprendre('Rappelle-moi d’appeler le garagiste vendredi', espace(), D);
  assert.equal(b.type === 'ajout' && b.phrase.genre === 'tache' && b.phrase.titre, "Appeler le garagiste");
  const c = comprendre('Relancer Paul jeudi pour la facture', espace(), D);
  assert.equal(c.type === 'ajout' && c.phrase.genre, 'relance');
});

test('dépense dictée : le montant, la devise et le budget sont reconnus', () => {
  const a = comprendre('Ajoute une dépense de 12 euros pour les courses', espace(), D);
  assert.ok(a.type === 'ajout' && a.phrase.genre === 'depense');
  if (a.type === 'ajout' && a.phrase.genre === 'depense') {
    assert.equal(a.phrase.montant, 12);
    assert.equal(a.phrase.budget, 'b1');
  }
  const b = comprendre("J'ai dépensé 8,50 € au resto hier", espace(), D);
  assert.ok(b.type === 'ajout' && b.phrase.genre === 'depense' && b.phrase.date === '2026-10-26');
  assert.equal(comprendre('Ajoute une dépense resto', espace(), D).type, 'reponse');
});

test('habitude dictée sans fréquence : quotidienne', () => {
  const a = comprendre('Crée une habitude méditer', espace(), D);
  assert.deepEqual(a, { type: 'ajout', phrase: { genre: 'habitude', titre: 'Méditer', frequence: 'quotidien', jour: null } });
});

test('consulter un budget', () => {
  const a = comprendre('Combien il me reste pour les courses ?', espace(), D);
  assert.equal(a.type, 'reponse');
  assert.match(a.type === 'reponse' ? a.texte : '', /Courses.*120.*300.*reste 180/);
  const b = comprendre('Où en est mon budget ce mois-ci', espace(), D);
  assert.match(b.type === 'reponse' ? b.texte : '', /dépensé 120.*reste 180/);
});

test('ouvrir un écran', () => {
  assert.deepEqual(comprendre('Ouvre les finances', espace(), D), { type: 'aller', href: '/finances', titre: 'Finances' });
  assert.deepEqual(comprendre('Va dans mes projets s’il te plaît', espace(), D), { type: 'aller', href: '/projets', titre: 'Projets' });
  assert.deepEqual(comprendre('Ouvre les tâches', espace(), D), { type: 'aller', href: '/taches', titre: 'Tâches' });
  assert.equal(comprendre('Montre-moi mes tâches', espace(), D).type, 'reponse');
});

test('cocher une tâche dite avec d’autres mots', () => {
  const e = espace({ taches: [tache('t1', 'Envoyer le devis à Paul'), tache('t2', 'Faire les courses')] });
  const a = comprendre("J'ai envoyé le devis", e, D);
  assert.ok(a.type === 'cocher' && a.cible.item.id === 't1');
  // Rien qui ressemble : la réussite part au journal.
  assert.deepEqual(comprendre("J'ai couru 10 km", e, D), { type: 'journal', texte: "J'ai couru 10 km" });
});

test('journal, annulation, briefing et questions libres', () => {
  assert.deepEqual(comprendre('Note dans mon journal que le client a signé', espace(), D), { type: 'journal', texte: 'Le client a signé' });
  assert.equal(comprendre('Annule', espace(), D).type, 'annuler');
  assert.equal(comprendre('Lis-moi mon briefing', espace(), D).type, 'briefing');
  assert.equal(comprendre('Pourquoi je dépense autant ?', espace(), D).type, 'question');
  assert.equal(comprendre('  ', espace(), D).type, 'rien');
});

test('tâches et relances du jour', () => {
  const e = espace({ taches: [tache('t1', 'Payer le loyer', { echeance: D })], relances: [{ id: 'r1', contact: 'Marie', sujet: 'le contrat', boite: 'pro', date: D, statut: 'a_faire', mode: 'normal', creeLe: '' }] });
  assert.match((comprendre("Qu'est-ce que j'ai à faire aujourd'hui ?", e, D) as { texte: string }).texte, /Payer le loyer/);
  assert.match((comprendre('Qui dois-je relancer ?', e, D) as { texte: string }).texte, /Marie pour le contrat/);
});

test('confirmation parlée', () => {
  assert.equal(confirmerAjout({ genre: 'tache', titre: 'Envoyer le devis', echeance: '2026-10-28', priorite: 'haute' }, '€', D, (s) => s), 'Tâche ajoutée : Envoyer le devis, pour demain, importante.');
});
