import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detailOffre, estAbonne, libelleAction, nomOffreMembre, OFFRES_ADMIN, type LigneMembre } from '../src/lib/gestion-membres.ts';

const l = (o: Partial<LigneMembre>): LigneMembre => ({ id: 'u', email: 'a@x.com', nom: 'A', role: 'UTILISATEUR', emailVerifie: true, creeLe: '2026-01-01T00:00:00Z', offre: 'gratuit', palier: 0, periode: null, jusqua: null, joursRestants: null, expireLe: null, ...o });

describe('onglet Utilisateurs', () => {
  it('nomme l’offre d’un compte', () => {
    assert.equal(nomOffreMembre(l({ offre: 'pro', palier: 2 })), 'Pro 2');
    assert.equal(nomOffreMembre(l({ offre: 'pro' })), 'Pro');
    assert.equal(nomOffreMembre(l({ offre: 'finances' })), 'Finances');
    assert.equal(nomOffreMembre(l({ offre: 'essai' })), 'Essai');
    assert.equal(nomOffreMembre(l({ offre: 'libre' })), 'Tout inclus');
  });
  it('seules les formules payées comptent comme abonnement', () => {
    assert.equal(estAbonne(l({ offre: 'pro' })), true);
    assert.equal(estAbonne(l({ offre: 'finances' })), true);
    assert.equal(estAbonne(l({ offre: 'essai' })), false);
    assert.equal(estAbonne(l({ offre: 'libre' })), false);
  });
  it('dit quand une offre finit, et insiste quand c’est proche', () => {
    assert.match(detailOffre(l({ jusqua: '2027-02-15T10:00:00Z', joursRestants: 90 })), /^Jusqu’au 15 févr\. 2027$/);
    assert.match(detailOffre(l({ jusqua: '2026-11-18T10:00:00Z', joursRestants: 3 })), /^Finit dans 3 jours$/);
    assert.match(detailOffre(l({ jusqua: '2026-11-16T10:00:00Z', joursRestants: 1 })), /^Finit demain$/);
    assert.match(detailOffre(l({ expireLe: '2026-10-01T10:00:00Z' })), /^Expiré le 1 oct\. 2026$/);
    assert.equal(detailOffre(l({})), '');
  });
  it('décrit les gestes du journal', () => {
    assert.equal(libelleAction({ action: 'offrir', formule: 'pro', palier: 2, duree: '3 mois' }), 'Pro 2 offert · 3 mois');
    assert.equal(libelleAction({ action: 'offrir', formule: 'finances', palier: 0, duree: '1 mois' }), 'Finances offert · 1 mois');
    assert.equal(libelleAction({ action: 'essai', formule: null, palier: 0, duree: '14 jours' }), 'Essai prolongé · 14 jours');
    assert.equal(libelleAction({ action: 'retirer', formule: null, palier: 0, duree: null }), 'Abonnement retiré');
  });
  it('propose toutes les formules vendues', () => {
    assert.deepEqual(OFFRES_ADMIN.map((o) => o.label), ['Finances', 'Pro', 'Pro 1', 'Pro 2', 'Pro 3']);
  });
});
