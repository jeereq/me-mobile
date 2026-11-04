import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aReconnecter } from '../src/lib/sync.ts';

describe('un compte à reconnecter', () => {
  it('se reconnaît au message du serveur', () => {
    assert.equal(aReconnecter({ erreur: 'L’autorisation a expiré ou a été retirée : reconnecte ce compte.' }), true);
    assert.equal(aReconnecter({ erreur: 'Autorisations insuffisantes : reconnecte ce compte et accepte l’accès à l’agenda et aux mails.' }), true);
  });
  it('pas pour une panne passagère ou sans erreur', () => {
    assert.equal(aReconnecter({ erreur: 'Synchronisation impossible pour l’instant.' }), false);
    assert.equal(aReconnecter({ erreur: null }), false);
  });
});
