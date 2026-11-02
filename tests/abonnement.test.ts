import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { badgeAbonnement, nomOffre, peutReunions, prixOffre, resteReunions, dureeHeures, estFinances, estPro, fmtPrix, joursConvertis, resumeAbonnement, tarif, TARIFS, type EtatAbonnement, type Offres } from '../src/lib/abonnement.ts';

const etat = (e: Partial<EtatAbonnement>): EtatAbonnement => ({ actif: true, offre: 'gratuit', pro: false, periode: null, jusqua: null, joursRestants: null, fonctions: [], ...e });

describe('abonnement', () => {
  it('ouvre tout sans état (mode local ou ancien serveur)', () => {
    assert.equal(estPro(null), true);
    assert.equal(estPro(etat({})), false);
    assert.equal(badgeAbonnement(undefined), undefined);
  });

  it('résume chaque offre', () => {
    assert.match(resumeAbonnement(etat({ offre: 'essai', pro: true, joursRestants: 1, jusqua: '2026-11-10T00:00:00Z' })), /demain/);
    assert.match(resumeAbonnement(etat({ offre: 'pro', pro: true, periode: 'annuel', jusqua: '2027-10-27T00:00:00Z', joursRestants: 365 })), /sans renouvellement automatique/);
    assert.match(resumeAbonnement(etat({})), /Offre gratuite/);
  });

  it('affiche un badge court', () => {
    assert.equal(badgeAbonnement(etat({ offre: 'essai', joursRestants: 5 })), 'ESSAI · 5 J');
    assert.equal(badgeAbonnement(etat({ offre: 'pro', joursRestants: 100 })), 'PRO');
    assert.equal(badgeAbonnement(etat({ offre: 'pro', joursRestants: 3 })), 'PRO · 3 J');
    assert.equal(badgeAbonnement(etat({})), 'GRATUIT');
    assert.equal(badgeAbonnement(etat({ offre: 'libre' })), undefined);
  });

  it('écrit les prix comme les conditions de vente', () => {
    assert.equal(fmtPrix(499, 'USD'), '4,99 $');
    assert.equal(fmtPrix(4999, 'EUR'), '49,99 €');
  });

  it('ouvre les finances avancées avec Finances, Pro ou un ancien serveur', () => {
    assert.equal(estFinances(null), true);
    assert.equal(estFinances(etat({ finances: false })), false);
    assert.equal(estFinances(etat({ offre: 'finances', finances: true })), true);
    // Un serveur à deux offres n'envoie pas `finances` : tout y restait gratuit.
    assert.equal(estFinances(etat({})), true);
    assert.equal(badgeAbonnement(etat({ offre: 'finances', joursRestants: 40 })), 'FINANCES');
    assert.match(resumeAbonnement(etat({ offre: 'finances', periode: 'mensuel', jusqua: '2026-12-01T00:00:00Z', joursRestants: 29 })), /^Finances mensuel/);
    assert.match(resumeAbonnement(etat({ offre: 'essai', joursRestants: 3, ensuite: { formule: 'finances', jusqua: '2026-12-20T00:00:00Z' } })), /Ensuite, Finances/);
  });

  it('garde la formule la plus chère à 4,99 $ par mois', () => {
    assert.equal(fmtPrix(TARIFS.finances.mensuel, 'USD'), '1,99 $');
    assert.equal(Math.max(TARIFS.finances.mensuel, TARIFS.pro.mensuel), 499);
  });

  it('lit les prix du serveur, ou ne propose pas Finances sur un ancien serveur', () => {
    const ancien = { actif: true, paiement: true, versionCgv: 'x', devise: 'USD', essaiJours: 14, pro: { nom: 'Pro', mensuel: { prix: 499, libelle: '' }, annuel: { prix: 4999, libelle: '' } }, fonctions: {} } as unknown as Offres;
    assert.equal(tarif(ancien, 'finances', 'mensuel'), null);
    assert.equal(tarif(ancien, 'pro', 'annuel'), 4999);
    assert.equal(tarif(null, 'finances', 'annuel'), 1999);
    const nouveau = { ...ancien, formules: { finances: { nom: 'Finances', mensuel: { prix: 199, libelle: '' }, annuel: { prix: 1999, libelle: '' } }, pro: ancien.pro } } as Offres;
    assert.equal(tarif(nouveau, 'finances', 'mensuel'), 199);
    // 30 jours de Finances valent 11 jours de Pro (arrondi en dessous), comme le calcule le serveur.
    assert.deepEqual(joursConvertis(etat({ offre: 'finances', joursRestants: 30 }), nouveau, 'pro'), { de: 'Finances', jours: 11, joursAvant: 30 });
    assert.equal(joursConvertis(etat({ offre: 'pro', joursRestants: 30 }), nouveau, 'pro'), null);
  });
});

describe('paliers de réunions : Pro 0 à Pro 3', () => {
  it('additionne le prix du palier à celui de Pro, avec ou sans serveur', () => {
    assert.equal(prixOffre(null, 'pro', 0, 'mensuel'), 499);
    assert.equal(prixOffre(null, 'pro', 1, 'mensuel'), 698);
    assert.equal(prixOffre(null, 'pro', 2, 'mensuel'), 998);
    assert.equal(prixOffre(null, 'pro', 3, 'annuel'), 14998);
    assert.equal(prixOffre(null, 'finances', 3, 'mensuel'), 199);
    // Un serveur qui ne connaît pas les paliers ne les vend pas.
    const ancien = { actif: true, paiement: true, versionCgv: 'x', devise: 'USD', essaiJours: 14, pro: { nom: 'Pro', mensuel: { prix: 499, libelle: '' }, annuel: { prix: 4999, libelle: '' } }, fonctions: {} } as unknown as Offres;
    assert.equal(prixOffre(ancien, 'pro', 1, 'mensuel'), null);
    assert.equal(prixOffre(ancien, 'pro', 0, 'mensuel'), 499);
  });
  it('nomme les paliers', () => {
    assert.deepEqual([nomOffre('pro', 0), nomOffre('pro', undefined), nomOffre('pro', 2), nomOffre('finances', 3)], ['Pro', 'Pro', 'Pro 2', 'Finances']);
    assert.match(resumeAbonnement(etat({ offre: 'pro', palier: 2, periode: 'mensuel', jusqua: '2026-12-01T00:00:00Z' })), /^Pro 2 mensuel/);
    assert.equal(badgeAbonnement(etat({ offre: 'pro', palier: 3, joursRestants: 20 })), 'PRO 3');
    assert.equal(badgeAbonnement(etat({ offre: 'pro', joursRestants: 20 })), 'PRO');
  });
  it('ouvre l’enregistrement seulement quand le serveur donne le droit', () => {
    assert.equal(peutReunions(etat({ offre: 'pro', fonctions: ['assistant'] })), false);
    assert.equal(peutReunions(etat({ offre: 'pro', fonctions: ['assistant', 'reunions'] })), true);
    assert.equal(peutReunions(null), false);
  });
  it('dit ce qui reste d’heures de réunion', () => {
    assert.equal(dureeHeures(7800), '2 h 10');
    assert.equal(dureeHeures(2700), '45 min');
    assert.equal(dureeHeures(3 * 3600), '3 h');
    const c = { cle: '2026-11', limiteSecondes: 10800, utiliseesSecondes: 3000, restantesSecondes: 7800, illimite: false };
    assert.equal(resteReunions(c), 'Il te reste 2 h 10 de réunion ce mois-ci.');
    assert.equal(resteReunions(c, true), 'Il te reste 2 h 10 de réunion dans ton essai.');
    assert.equal(resteReunions({ ...c, illimite: true, restantesSecondes: null }), null);
    assert.equal(resteReunions(null), null);
  });
  it('convertit le temps restant au changement de palier', () => {
    const o = { actif: true, paiement: true, versionCgv: 'x', devise: 'USD', essaiJours: 14, pro: { nom: 'Pro', mensuel: { prix: 499, libelle: '' }, annuel: { prix: 4999, libelle: '' } }, formules: { finances: { nom: 'Finances', mensuel: { prix: 199, libelle: '' }, annuel: { prix: 1999, libelle: '' } }, pro: { nom: 'Pro', mensuel: { prix: 499, libelle: '' }, annuel: { prix: 4999, libelle: '' } } }, paliers: { 1: { nom: 'Pro 1', heures: 3, mensuel: { prix: 199, libelle: '' }, annuel: { prix: 1999, libelle: '' } } }, fonctions: {} } as unknown as Offres;
    assert.deepEqual(joursConvertis(etat({ offre: 'pro', joursRestants: 30 }), o, 'pro', 1), { de: 'Pro', jours: 21, joursAvant: 30 });
    assert.equal(joursConvertis(etat({ offre: 'pro', palier: 1, joursRestants: 30 }), o, 'pro', 1), null);
  });
});
