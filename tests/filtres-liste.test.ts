import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filtresPoses, type GroupeFiltre } from '../src/lib/filtres-liste.ts';

const g = (cle: string, valeur: string, defaut = 'tous'): GroupeFiltre => ({
  cle,
  titre: cle,
  valeur,
  defaut,
  onChange: () => {},
  options: [
    { key: 'tous', label: 'Tous' },
    { key: 'a', label: 'Budget A' },
    { key: 'b', label: 'Budget B' },
  ],
});

describe('les filtres posés d’une liste', () => {
  it('ne retient que ceux qui ne sont pas au défaut', () => {
    assert.deepEqual(filtresPoses([g('budget', 'tous'), g('categorie', 'a')]).map((p) => p.groupe.cle), ['categorie']);
  });
  it('prend l’étiquette dans les choix du groupe', () => {
    assert.equal(filtresPoses([g('budget', 'b')])[0].label, 'Budget B');
  });
  it('se rabat sur le titre quand le choix n’est plus dans la liste', () => {
    assert.equal(filtresPoses([{ ...g('budget', 'disparu') }])[0].label, 'budget');
  });
  it('garde l’ordre des groupes', () => {
    assert.deepEqual(filtresPoses([g('un', 'a'), g('deux', 'b')]).map((p) => p.groupe.cle), ['un', 'deux']);
  });
  it('rien de posé, rien à montrer', () => {
    assert.deepEqual(filtresPoses([g('budget', 'tous'), g('justif', 'toutes', 'toutes')]), []);
  });
});
