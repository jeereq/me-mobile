import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { estFichierPerime } from '../src/lib/version-web.ts';

describe('fichier d’une ancienne version', () => {
  it('reconnaît un morceau de l’app introuvable', () => {
    assert.equal(estFichierPerime('Loading module https://me.neevo.app/_expo/static/js/web/taches-01fd3d3918fdbff325bee5dc40897210.js failed.\n(error: https://me.neevo.app/_expo/static/js/web/taches-01fd3d3918fdbff325bee5dc40897210.js)'), true);
    assert.equal(estFichierPerime('Failed to fetch dynamically imported module: https://me.neevo.app/x.js'), true);
    assert.equal(estFichierPerime('Importing a module script failed.'), true);
  });
  it('laisse passer les autres erreurs', () => {
    assert.equal(estFichierPerime("Cannot read properties of undefined (reading 'map')"), false);
    assert.equal(estFichierPerime('Loading'), false);
  });
});
