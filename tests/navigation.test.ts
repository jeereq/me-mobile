import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, it } from 'node:test';

import { BARRE_OUTILS, BARRE_PRINCIPAL, basculerPage, compteursDuJour, doitChoisirPages, masquable, masqueesParDefaut, PAGES, PAGES_PRO, pagesMasquees } from '../src/lib/navigation.ts';
import { rechercher } from '../src/lib/recherche.ts';
import type { Espace } from '../src/lib/types.ts';

const d = '2026-11-02';
const vide = { relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: {}, majLe: '', projets: [] } as unknown as Espace;

/** Le fichier d'une adresse dans `src/app/` : un écran à part, ou un onglet du téléphone. */
const fichier = (href: string) => {
  const nom = href === '/' ? 'index' : href.slice(1).split('?')[0];
  return [`src/app/${nom}.tsx`, `src/app/(tabs)/${nom}.tsx`].some((f) => existsSync(f));
};

describe('liste des pages', () => {
  it('chaque page a son écran', () => {
    for (const p of PAGES) assert.ok(fichier(String(p.href)), `${p.titre} : ${String(p.href)}`);
  });

  it('les clés sont uniques et la barre latérale ne cite que des pages connues', () => {
    const cles = PAGES.map((p) => p.cle);
    assert.equal(new Set(cles).size, cles.length);
    for (const c of [...BARRE_PRINCIPAL, ...BARRE_OUTILS]) assert.ok(cles.includes(c), c);
  });

  it('la recherche trouve toutes les pages, y compris le copilote, les équipes et l’abonnement', () => {
    const titres = rechercher(vide, '').map((r) => r.titre);
    for (const p of PAGES) assert.ok(titres.includes(p.titre), p.titre);
    assert.equal(rechercher(vide, 'copilote')[0]?.titre, 'Mon copilote');
    assert.equal(rechercher(vide, 'equipes')[0]?.titre, 'Équipes');
    assert.equal(rechercher(vide, 'abonnement')[0]?.titre, 'Abonnement');
  });
});

describe('nombres des badges', () => {
  it('relances arrivées, tâches urgentes et habitudes à cocher', () => {
    const e = {
      ...vide,
      relances: [
        { id: 'r1', contact: 'Paul', sujet: 'devis', date: '2026-11-01', statut: 'a_faire', reponduLe: null, mode: 'normal' },
        { id: 'r2', contact: 'Léa', sujet: 'contrat', date: '2026-11-10', statut: 'a_faire', reponduLe: null, mode: 'normal' },
      ],
      taches: [
        { id: 't1', titre: 'Facture', source: 'manuel', priorite: 'moyenne', echeance: '2026-11-03', statut: 'en_attente', faitLe: null, mode: 'normal', creeLe: '', ordre: 0 },
        { id: 't2', titre: 'Plus tard', source: 'manuel', priorite: 'moyenne', echeance: '2026-12-01', statut: 'en_attente', faitLe: null, mode: 'normal', creeLe: '', ordre: 1 },
      ],
      habitudes: [{ id: 'h1', nom: 'Sport', categorie: 'perso', frequence: 'quotidien', jour: null, mode: 'normal', coches: [], ordre: 0 }],
    } as unknown as Espace;
    assert.deepEqual(compteursDuJour(e, d), { relances: 1, taches: 1, habitudes: 1 });
  });
});

describe('pages masquées', () => {
  it('rien de masqué par défaut', () => {
    assert.equal(pagesMasquees(vide).size, 0);
  });

  it('masque puis réaffiche une page, dans l’ordre des pages', () => {
    let masquees = basculerPage(vide, 'recompenses', false);
    masquees = basculerPage({ barre: { masquees } }, 'finances', false);
    assert.deepEqual(masquees, ['finances', 'recompenses']);
    masquees = basculerPage({ barre: { masquees } }, 'finances', true);
    assert.deepEqual(masquees, ['recompenses']);
  });

  it('Aujourd’hui et Mon compte ne se masquent pas, les clés inconnues sont ignorées', () => {
    assert.equal(masquable('jour'), false);
    assert.equal(masquable('compte'), false);
    assert.deepEqual(basculerPage(vide, 'jour', false), []);
    assert.deepEqual([...pagesMasquees({ barre: { masquees: ['jour', 'compte', 'inconnue', 'bilan'] } })], ['bilan']);
  });

  it('toutes les pages de la barre, sauf Aujourd’hui, peuvent être masquées', () => {
    for (const c of [...BARRE_PRINCIPAL, ...BARRE_OUTILS]) assert.equal(masquable(c), c !== 'jour', c);
  });
});

describe('choix des pages à la première connexion', () => {
  const ab = (offre: 'gratuit' | 'essai' | 'finances' | 'pro', pro: boolean) => ({ actif: true, offre, pro, periode: null, jusqua: null, joursRestants: null, fonctions: [] });

  it('Pro, essai ou sans abonnement : tout est coché ; Gratuit et Finances : les pages Pro sont décochées', () => {
    assert.deepEqual(masqueesParDefaut(null), []);
    assert.deepEqual(masqueesParDefaut(ab('pro', true)), []);
    assert.deepEqual(masqueesParDefaut(ab('essai', true)), []);
    assert.deepEqual(masqueesParDefaut(ab('gratuit', false)), [...PAGES_PRO]);
    assert.deepEqual(masqueesParDefaut(ab('finances', false)), [...PAGES_PRO]);
    for (const c of PAGES_PRO) assert.ok(masquable(c), c);
  });

  it('proposé à un espace neuf, une seule fois, jamais dans une équipe ni à un compte qui a déjà des données', () => {
    assert.equal(doitChoisirPages(vide, false), true);
    assert.equal(doitChoisirPages(vide, true), false);
    assert.equal(doitChoisirPages({ ...vide, barre: { choisi: true } }, false), false);
    assert.equal(doitChoisirPages({ ...vide, barre: { masquees: ['bilan'] } }, false), false);
    assert.equal(doitChoisirPages({ ...vide, taches: [{}] } as unknown as Espace, false), false);
  });
});
