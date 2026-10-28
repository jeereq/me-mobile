import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  annulerOuverture,
  candidatsCloture,
  comptesRendusLies,
  donneesCompteRendu,
  etatCompteRendu,
  fusionnerActions,
  lireAnalyseCompteRendu,
  lireNotes,
  noterClotures,
  nouveauCompteRendu,
  ouvrirActions,
  rapprocherFaits,
  supprimerCompteRendu,
} from '../src/lib/comptes-rendus.ts';
import type { CompteRendu, Espace, Relance, Tache } from '../src/lib/types.ts';

const d = '2026-10-28'; // un mercredi
let n = 0;
const id = () => `x${n++}`;

const tache = (x: Partial<Tache> & Pick<Tache, 'id' | 'titre'>): Tache => ({ source: 'manuel', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: d, ...x });
const relance = (x: Partial<Relance> & Pick<Relance, 'id' | 'contact' | 'sujet'>): Relance => ({ boite: 'pro', date: d, statut: 'a_faire', mode: 'normal', creeLe: d, ...x });
const espace = (x: Partial<Espace> = {}): Espace => ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: { voix: '', vitesse: 1, hauteur: 1, ton: 'neutre', sections: [], lireReponses: false }, majLe: d, ...x }) as Espace;

describe('comptes rendus : lire les notes sans IA', () => {
  it('range décisions, actions et faits, par section ou par marque', () => {
    const r = lireNotes(
      `Contexte :
Point sur le lancement avec Paul et Sophie.
Décisions
- On garde la date du 15 novembre
- Budget validé à 3 000 €
Actions
- @Paul envoyer le devis vendredi
- Préparer la maquette demain urgent
- Relancer Marie lundi pour la facture
Fait :
- [x] Devis envoyé
Décision : pas de version mobile pour l'instant
TODO : réserver la salle le 12/11
✓ Maquette validée`,
      d,
    );
    assert.deepEqual(r.decisions, ['On garde la date du 15 novembre', 'Budget validé à 3 000 €', "Pas de version mobile pour l'instant"]);
    assert.deepEqual(r.faits, ['Devis envoyé', 'Maquette validée']);
    assert.equal(r.actions.length, 4);
    assert.deepEqual(r.actions[0], { genre: 'tache', titre: 'Envoyer le devis', echeance: '2026-10-30', priorite: 'moyenne', responsable: 'Paul' });
    assert.deepEqual(r.actions[1], { genre: 'tache', titre: 'Préparer la maquette', echeance: '2026-10-29', priorite: 'haute' });
    assert.deepEqual(r.actions[2], { genre: 'relance', titre: 'Facture', contact: 'Marie', echeance: '2026-11-02', priorite: 'moyenne' });
    assert.equal(r.actions[3].titre, 'Réserver la salle');
    assert.equal(r.actions[3].echeance, '2026-11-12');
  });

  it('garde les notes libres hors des actions, sauf une relance', () => {
    const r = lireNotes('Paul trouve le prix élevé.\nRappeler Paul jeudi au sujet du prix\nRappeler Paul jeudi au sujet du prix', d);
    assert.deepEqual(r.decisions, []);
    assert.equal(r.actions.length, 1);
    assert.equal(r.actions[0].genre, 'relance');
    assert.equal(r.actions[0].contact, 'Paul');
  });
});

describe('comptes rendus : clôturer', () => {
  const e = espace({
    projets: [{ id: 'p', nom: 'Site', emoji: '🚀', debut: d, joursOuvres: true, creeLe: d }],
    taches: [
      tache({ id: 't1', titre: 'Envoyer le devis à Paul', projet: 'p' }),
      tache({ id: 't2', titre: 'Écrire les textes', projet: 'p', statut: 'fait' }),
      tache({ id: 'res', titre: 'Résumé', projet: 'p' }),
      tache({ id: 't3', titre: 'Sous-tâche', projet: 'p', parent: 'res' }),
      tache({ id: 't9', titre: 'Autre chose' }),
    ],
    relances: [relance({ id: 'r1', contact: 'Marie', sujet: 'Facture' }), relance({ id: 'r2', contact: 'Jean', sujet: 'Contrat' })],
  });
  const cr: CompteRendu = { ...nouveauCompteRendu({ id: 'cr', date: d, maintenant: d, projets: ['p'], relances: ['r1'] }), notes: '' };

  it('propose les tâches du projet (sans résumé ni tâche déjà faite) et les relances rattachées', () => {
    const c = candidatsCloture(e, cr);
    assert.deepEqual(c.map((x) => x.ref), ['t:t1', 't:t3', 'r:r1']);
  });

  it('rapproche « Devis envoyé » de « Envoyer le devis à Paul »', () => {
    const c = candidatsCloture(e, cr);
    assert.deepEqual(rapprocherFaits(['Devis envoyé à Paul'], c), ['t:t1']);
    assert.deepEqual(rapprocherFaits(['Rien à voir'], c), []);
  });

  it('note les clôtures, et les retire quand on rouvre', () => {
    const e2 = noterClotures({ ...e, comptesRendus: [cr] }, 'cr', ['t:t1', 'r:r1'], d);
    assert.deepEqual(e2.comptesRendus![0].clotures, [{ genre: 'tache', id: 't1', le: d }, { genre: 'relance', id: 'r1', le: d }]);
    const e3 = noterClotures(e2, 'cr', ['t:t1'], d, true);
    assert.deepEqual(e3.comptesRendus![0].clotures, [{ genre: 'relance', id: 'r1', le: d }]);
    assert.deepEqual(comptesRendusLies(e2, 'tache', 't1').map((x) => x.id), ['cr']);
  });
});

describe('comptes rendus : ouvrir des tâches et relances', () => {
  it('crée les points choisis avec le lien vers le compte rendu, sans doublon', () => {
    const base = espace({ taches: [tache({ id: 'deja', titre: 'Préparer la maquette' })] });
    const cr = nouveauCompteRendu({ id: 'cr', date: d, maintenant: d });
    cr.actions = fusionnerActions(cr, lireNotes('Actions\n- Préparer la maquette\n- Envoyer le devis vendredi\n- Relancer Marie lundi pour la facture', d).actions, id);
    const e = { ...base, comptesRendus: [cr] };
    const r = ouvrirActions(e, 'cr', cr.actions.map((a) => a.id), { id, maintenant: d, d, modeTache: 'normal', modeRelance: 'normal', boite: 'pro' });
    assert.equal(r.crees.length, 2);
    assert.equal(r.espace.taches.length, 2);
    const t = r.espace.taches.find((x) => x.titre === 'Envoyer le devis')!;
    assert.equal(t.compteRendu, 'cr');
    assert.equal(t.echeance, '2026-10-30');
    assert.equal(r.espace.relances[0].contact, 'Marie');
    assert.equal(r.espace.relances[0].compteRendu, 'cr');
    // La maquette existait : le point y est relié.
    assert.equal(r.espace.comptesRendus![0].actions[0].cree, 'deja');
    assert.deepEqual(etatCompteRendu(r.espace.comptesRendus![0], r.espace), { aConvertir: 0, enCours: 3, terminees: 0, clos: 0 });
    // Reconvertir ne recrée rien.
    assert.equal(ouvrirActions(r.espace, 'cr', cr.actions.map((a) => a.id), { id, maintenant: d, d, modeTache: 'normal', modeRelance: 'normal', boite: 'pro' }).crees.length, 0);
    const annule = annulerOuverture(r.espace, 'cr', r.crees);
    assert.equal(annule.taches.length, 1);
    assert.equal(annule.relances.length, 0);
    assert.equal(annule.comptesRendus![0].actions.filter((a) => a.cree).length, 1);
  });

  it('met les tâches dans le projet rattaché, avec la date dite en réunion', () => {
    const projet = { id: 'p', nom: 'Site', emoji: '🚀', debut: d, joursOuvres: true, creeLe: d };
    const cr = nouveauCompteRendu({ id: 'cr', date: d, maintenant: d, projets: ['p'] });
    cr.actions = [{ id: 'a', genre: 'tache', titre: 'Tester le formulaire', echeance: '2026-11-03' }];
    const r = ouvrirActions(espace({ projets: [projet], comptesRendus: [cr] }), 'cr', ['a'], { id, maintenant: d, d, modeTache: 'normal', modeRelance: 'normal', boite: 'pro', projet: 'p' });
    const t = r.espace.taches[0];
    assert.equal(t.projet, 'p');
    assert.equal(t.debut, '2026-11-03');
    assert.equal(t.fixe, true);
  });

  it('supprimer le compte rendu garde les tâches, sans le lien', () => {
    const cr = nouveauCompteRendu({ id: 'cr', date: d, maintenant: d });
    const e = supprimerCompteRendu(espace({ comptesRendus: [cr], taches: [tache({ id: 't', titre: 'x', compteRendu: 'cr' })] }), 'cr');
    assert.equal(e.comptesRendus!.length, 0);
    assert.equal(e.taches[0].compteRendu, undefined);
  });
});

describe('comptes rendus : analyse par l’IA', () => {
  it('envoie les éléments ouverts avec leur référence', () => {
    const e = espace({ relances: [relance({ id: 'r1', contact: 'Marie', sujet: 'Facture' })] });
    const cr = { ...nouveauCompteRendu({ id: 'cr', date: d, maintenant: d, relances: ['r1'] }), notes: 'Marie a payé.' };
    const j = JSON.parse(donneesCompteRendu(cr, e, d));
    assert.deepEqual(j.ouverts, [{ ref: 'r:r1', genre: 'relance', titre: 'Marie · Facture' }]);
    assert.equal(j.notes, 'Marie a payé.');
  });

  it('lit la réponse avec des valeurs sûres', () => {
    const r = lireAnalyseCompteRendu(
      '```json\n' +
        JSON.stringify({
          resume: '**Point** rapide.',
          decisions: ['Garder la date', ''],
          actions: [
            { genre: 'tache', titre: 'Envoyer le devis', priorite: 'urgente', echeance: '2026-10-30', responsable: 'Paul' },
            { genre: 'relance', titre: 'Contrat', contact: 'Jean' },
            { genre: 'relance', titre: 'Sans contact' },
            { genre: 'tache', titre: 'envoyer le devis !' },
          ],
          clotures: ['r:r1', 'r:inconnue'],
        }) +
        '\n```',
      ['r:r1'],
      d,
    );
    assert.equal(r.resume, 'Point rapide.');
    assert.deepEqual(r.decisions, ['Garder la date']);
    assert.deepEqual(r.actions, [
      { genre: 'tache', titre: 'Envoyer le devis', responsable: 'Paul', priorite: 'moyenne', echeance: '2026-10-30' },
      { genre: 'relance', titre: 'Contrat', contact: 'Jean', priorite: 'moyenne', echeance: d },
      { genre: 'tache', titre: 'Sans contact', priorite: 'moyenne', echeance: null },
    ]);
    assert.deepEqual(r.clotures, ['r:r1']);
  });
});
