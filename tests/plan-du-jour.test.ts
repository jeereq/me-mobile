import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { donneesPlan, sansMarkdown } from '../src/lib/plan-du-jour.ts';
import type { Espace, Tache } from '../src/lib/types.ts';

const d = '2026-10-27';
const espace = (x: Partial<Espace> = {}): Espace => ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: {} as Espace['audio'], majLe: '', ...x }) as Espace;
const tache = (id: string, x: Partial<Tache> = {}): Tache => ({ id, titre: id, source: 'manuel', priorite: 'normale', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: '', ...x }) as Tache;

describe('données du plan de la journée', () => {
  it("n'envoie que ce qui reste à faire", () => {
    const e = espace({
      taches: [tache('urgente', { echeance: d }), tache('faite', { echeance: d, statut: 'fait', faitLe: d }), tache('vieille faite', { statut: 'fait', faitLe: '2026-01-01' }), tache('jeudi', { echeance: '2026-10-31' }), tache('plus tard', { echeance: '2026-12-01' })],
      relances: [
        { id: 'r1', contact: 'Ana', sujet: 'Devis', boite: 'pro', date: '2026-10-25', statut: 'a_faire', mode: 'normal', creeLe: '' },
        { id: 'r2', contact: 'Bob', sujet: 'Facture', boite: 'pro', date: d, statut: 'repondu', reponduLe: d, mode: 'normal', creeLe: '' },
        { id: 'r3', contact: 'Cléo', sujet: 'Café', boite: 'perso', date: '2026-11-15', statut: 'a_faire', mode: 'normal', creeLe: '' },
      ],
    });
    const p = donneesPlan(e, d);
    assert.deepEqual(p.tachesUrgentes.map((t) => t.titre), ['urgente']);
    assert.deepEqual(p.tachesSemaine.map((t) => t.titre), ['jeudi']);
    assert.deepEqual(p.relancesDues, [{ contact: 'Ana', sujet: 'Devis', boite: 'pro', enRetard: true }]);
  });

  it('signale les factures qui tombent dans les 3 jours', () => {
    const e = espace({
      finances: {
        devise: '€', budgets: [], depenses: [],
        recurrences: [
          { id: 'l', genre: 'depense', montant: 700, note: 'Loyer', budget: null, frequence: 'mois', debut: '2026-09-28', derniere: '2026-09-28' },
          { id: 's', genre: 'revenu', montant: 2000, note: 'Salaire', budget: null, frequence: 'mois', debut: '2026-09-28', derniere: '2026-09-28' },
          { id: 'n', genre: 'depense', montant: 10, note: 'Netflix', budget: null, frequence: 'mois', debut: '2026-10-15', derniere: '2026-10-15' },
        ],
      } as Espace['finances'],
    });
    assert.deepEqual(donneesPlan(e, d).finances.facturesProches, [{ note: 'Loyer', montant: 700, date: '2026-10-28' }]);
  });

  it('reste petit même avec beaucoup de données', () => {
    const taches = Array.from({ length: 3000 }, (_, i) => tache(`t${i}`, { statut: i % 2 ? 'fait' : 'en_attente', echeance: '2027-01-01', note: 'x'.repeat(200) }));
    assert.ok(JSON.stringify(donneesPlan(espace({ taches }), d)).length < 20_000);
  });
});

describe('plan sans markdown', () => {
  it('enlève gras, titres et puces', () => {
    assert.equal(sansMarkdown('### Priorités\n**1. Loyer**\n- 9 h : devis\n\n\n* 10 h : `appel`'), 'Priorités\n1. Loyer\n• 9 h : devis\n\n• 10 h : appel');
  });
});
