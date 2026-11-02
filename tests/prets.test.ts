import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bilanMois, echeancesAVenir, suiviPret, totauxPrets } from '../src/lib/commun/prets.ts';
import { echeance } from '../src/lib/finances.ts';

describe('finances avancées (copie du code commun)', () => {
  it('suit un prêt et additionne les prêts', () => {
    const p = { id: 'p', personne: 'Paul', sens: 'prete' as const, montant: 40, date: '2026-10-01', echeance: '2026-10-20', remboursements: [{ id: 'r', date: '2026-10-10', montant: 15 }] };
    assert.deepEqual(suiviPret(p, '2026-11-01'), { rendu: 15, reste: 25, etat: 'en_retard' });
    assert.equal(totauxPrets([p], '2026-11-01').onMeDoit, 25);
  });

  it('place les échéances aux mêmes dates que les paiements récurrents de l’app', () => {
    const r = { id: 'l', genre: 'depense' as const, montant: 300, note: 'Loyer', frequence: 'mois' as const, debut: '2026-01-31', derniere: null };
    const a = echeancesAVenir([r], '2026-01-30', 120).map((x) => x.date);
    const app = Array.from({ length: a.length }, (_, n) => echeance(r, n));
    assert.deepEqual(a, app);
  });

  it('fait le bilan du mois sans les virements', () => {
    const b = bilanMois({ depenses: [{ id: 'a', montant: 10, date: '2026-10-02' }, { id: 'v', montant: 99, date: '2026-10-03', lien: 'x' }], revenus: [] }, '2026-10');
    assert.equal(b.depenses, 10);
    assert.equal(b.solde, -10);
  });
});
