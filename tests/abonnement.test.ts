import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { badgeAbonnement, estPro, fmtPrix, resumeAbonnement, type EtatAbonnement } from '../src/lib/abonnement.ts';

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
});
