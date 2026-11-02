import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { badgeAbonnement, estFinances, estPro, fmtPrix, joursConvertis, resumeAbonnement, tarif, TARIFS, type EtatAbonnement, type Offres } from '../src/lib/abonnement.ts';

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
    assert.deepEqual(joursConvertis(etat({ offre: 'finances', joursRestants: 30 }), nouveau, 'pro'), { de: 'finances', jours: 11, joursAvant: 30 });
    assert.equal(joursConvertis(etat({ offre: 'pro', joursRestants: 30 }), nouveau, 'pro'), null);
  });
});
