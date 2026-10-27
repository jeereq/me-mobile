import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ajouterCategorie,
  basculer,
  budgetDe,
  CATEGORIES_SUGGEREES,
  categoriesDeItem,
  categoriserDepuisBudgets,
  classerOperations,
  classerParMots,
  categoriesHabituelles,
  deplacer,
  fusionnerCategories,
  repartitionParCategorie,
  supprimerCategorie,
  usage,
  verifierNom,
} from '../src/lib/categories.ts';
import type { Budget, Categorie, Espace } from '../src/lib/types.ts';

const cat = (id: string, nom: string, mots?: string[]): Categorie => ({ id, nom, emoji: '🏷️', couleur: '#7AB8F5', ...(mots ? { mots } : {}) });
const resto = cat('resto', 'Restaurants', ['deliveroo', 'uber eats', 'pizza']);
const travail = cat('travail', 'Travail');
const transport = cat('transport', 'Transport', ['uber', 'bolt']);

const espace = (): Espace => ({
  relances: [{ id: 'r1', contact: 'Paul', sujet: 'Devis', boite: 'pro', date: '2026-10-30', statut: 'a_faire', mode: 'normal', creeLe: '', categories: ['travail'] }],
  taches: [{ id: 't1', titre: 'Envoyer', source: 'pro', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: '', categories: ['travail', 'resto'] }],
  habitudes: [],
  contacts: [],
  journal: {},
  agenda: {},
  sources: {},
  sourcesAutres: [],
  audio: { voix: '', vitesse: 1, hauteur: 1, ton: 'neutre', sections: [], lireReponses: true },
  categories: [resto, travail, transport],
  finances: {
    devise: '$',
    budgets: [
      { id: 'b-sorties', nom: 'Sorties', emoji: '🎉', montant: 100, periode: 'mois', categories: ['resto'] },
      { id: 'b-pro', nom: 'Pro', emoji: '💼', montant: 200, periode: 'mois', categories: ['travail'] },
      { id: 'b-glob', nom: 'Total', emoji: '💰', montant: 900, periode: 'mois', global: true },
    ],
    depenses: [
      { id: 'd1', montant: 30, budget: null, categories: ['resto', 'travail'], note: 'Déjeuner client', date: '2026-10-10', creeLe: '' },
      { id: 'd2', montant: 12, budget: 'b-pro', categories: ['resto'], note: 'Pizza', date: '2026-10-11', creeLe: '' },
      { id: 'd3', montant: 8, budget: null, note: 'Uber Eats Pizza', date: '2026-10-12', creeLe: '' },
    ],
    revenus: [{ id: 'v1', montant: 500, categories: ['travail'], note: 'Facture', date: '2026-10-01', creeLe: '' }],
    recurrences: [],
  },
  majLe: '',
});

describe('catégories : liste d’un élément', () => {
  it('bascule une catégorie et efface la clé quand la liste devient vide', () => {
    assert.deepEqual(basculer(undefined, 'a'), ['a']);
    assert.deepEqual(basculer(['a'], 'b'), ['a', 'b']);
    assert.deepEqual(basculer(['a', 'b'], 'a'), ['b']);
    assert.equal(basculer(['a'], 'a'), undefined);
  });

  it('renvoie les catégories dans l’ordre du catalogue et ignore celles qui n’existent plus', () => {
    const l = categoriesDeItem({ categories: ['transport', 'fantome', 'resto'] }, [resto, travail, transport]);
    assert.deepEqual(l.map((c) => c.id), ['resto', 'transport']);
    assert.deepEqual(categoriesDeItem({}, [resto]), []);
  });

  it('refuse un nom vide ou déjà pris, sans tenir compte des accents ni de la casse', () => {
    assert.match(verifierNom([resto], '  '), /Donne un nom/);
    assert.match(verifierNom([resto], 'RESTAURANTS'), /déjà ce nom/);
    assert.equal(verifierNom([cat('s', 'Santé')], 'sante'), 'Une catégorie porte déjà ce nom.');
    assert.equal(verifierNom([resto], 'Restaurants', 'resto'), '', 'une catégorie garde son propre nom quand on la modifie');
    assert.equal(verifierNom([resto], 'Sorties'), '');
  });

  it('range les catégories : monter, descendre, et rester dans les bornes', () => {
    const l = [resto, travail, transport];
    assert.deepEqual(deplacer(l, 'transport', -1).map((c) => c.id), ['resto', 'transport', 'travail']);
    assert.deepEqual(deplacer(l, 'resto', -1), l);
    assert.deepEqual(deplacer(l, 'transport', 1), l);
  });
});

describe('catégories : suppression et fusion dans tout l’espace', () => {
  it('supprimer une catégorie la retire partout, et efface la clé des éléments qui n’en ont plus', () => {
    const e = supprimerCategorie(espace(), 'travail');
    assert.deepEqual(e.categories!.map((c) => c.id), ['resto', 'transport']);
    assert.equal('categories' in e.relances[0], false, 'la relance n’avait que celle-là');
    assert.deepEqual(e.taches[0].categories, ['resto']);
    assert.deepEqual(e.finances!.depenses[0].categories, ['resto']);
    assert.equal('categories' in e.finances!.revenus![0], false);
    assert.equal(e.finances!.budgets[1].categories, undefined, 'un budget qui suivait seulement cette catégorie ne suit plus rien');
  });

  it('fusionner pose la catégorie cible sans doublon, puis supprime l’ancienne', () => {
    const e = fusionnerCategories(espace(), 'travail', 'resto');
    assert.deepEqual(e.categories!.map((c) => c.id), ['resto', 'transport']);
    assert.deepEqual(e.taches[0].categories, ['resto'], 'resto était déjà là : pas de doublon');
    assert.deepEqual(e.relances[0].categories, ['resto']);
    assert.deepEqual(e.finances!.depenses[0].categories, ['resto']);
    assert.equal(fusionnerCategories(espace(), 'resto', 'resto').categories!.length, 3);
  });

  it('compte l’usage par catégorie', () => {
    const u = usage(espace());
    assert.equal(u.get('travail')!.total, 5); // relance, tâche, dépense d1, revenu, budget
    assert.equal(u.get('travail')!.taches, 2);
    assert.equal(u.get('resto')!.finances, 3); // d1, d2, budget Sorties
    assert.equal(u.get('transport'), undefined);
  });

  it('ajoute une catégorie au catalogue sans toucher au reste', () => {
    const e = ajouterCategorie({ ...espace(), categories: undefined }, resto);
    assert.deepEqual(e.categories, [resto]);
  });
});

describe('catégories : budgets qui suivent des catégories', () => {
  const budgets = espace().finances!.budgets as Budget[];

  it('un budget choisi à la main l’emporte sur les catégories', () => {
    assert.equal(budgetDe(budgets, { budget: 'b-pro', categories: ['resto'] })!.id, 'b-pro');
  });
  it('sans budget choisi, le premier budget qui suit une des catégories compte la dépense, une seule fois', () => {
    assert.equal(budgetDe(budgets, { budget: null, categories: ['resto', 'travail'] })!.id, 'b-sorties');
    assert.equal(budgetDe(budgets, { budget: null, categories: ['travail'] })!.id, 'b-pro');
  });
  it('aucune catégorie suivie : hors budget ; le budget global n’est jamais « le budget » d’une dépense', () => {
    assert.equal(budgetDe(budgets, { budget: null, categories: ['transport'] }), null);
    assert.equal(budgetDe(budgets, { budget: null }), null);
    assert.equal(budgetDe(budgets, { budget: 'b-glob' }), null);
    assert.equal(budgetDe(budgets, { budget: 'supprime', categories: ['travail'] })!.id, 'b-pro', 'un budget supprimé n’empêche pas le classement par catégorie');
  });
});

describe('catégories : classement par mots-clés', () => {
  const cats = [resto, travail, transport, cat('sante', 'Santé', ['pharmacie'])];
  it('trouve plusieurs catégories pour un libellé, sans tenir compte des accents ni de la casse', () => {
    assert.deepEqual(classerParMots('UBER EATS Paris', cats), ['resto', 'transport']);
    assert.deepEqual(classerParMots('Pharmacie du Centre', cats), ['sante']);
    assert.deepEqual(classerParMots('Dépense santé', cats), ['sante'], 'le nom de la catégorie compte aussi');
  });
  it('les catégories proposées ne rangent pas recharges et mobile money dans « Abonnements »', () => {
    const proposees = CATEGORIES_SUGGEREES.map((c) => ({ ...c, id: c.nom }));
    assert.deepEqual(classerParMots('Vodacom Airtime 243817125577', proposees), ['Téléphone et mobile money']);
    assert.deepEqual(classerParMots('Airtelmoney – Xe1004843179c – Kalala', proposees), ['Téléphone et mobile money']);
    assert.deepEqual(classerParMots('Orange – Xd645e7390a4d', proposees), ['Téléphone et mobile money']);
    assert.deepEqual(classerParMots('NETFLIX.COM', proposees), ['Abonnements']);
  });
  it('un mot-clé doit commencer un mot : « bolt » ne matche pas « Sbolt »', () => {
    assert.deepEqual(classerParMots('Sbolt', cats), []);
    assert.deepEqual(classerParMots('', cats), []);
  });
  it('classe les opérations sans catégorie et laisse les autres', () => {
    const { espace: e, classees } = classerOperations(espace());
    assert.equal(classees, 1);
    assert.deepEqual(e.finances!.depenses.find((d) => d.id === 'd3')!.categories, ['resto', 'transport']);
    assert.deepEqual(e.finances!.depenses.find((d) => d.id === 'd1')!.categories, ['resto', 'travail'], 'déjà classée : inchangée');
    assert.equal(classerOperations(e).classees, 0);
    assert.equal(classerOperations(e).espace, e, 'rien à faire : même objet');
  });
  it('préfère les catégories déjà données à des opérations de même libellé', () => {
    assert.deepEqual(categoriesHabituelles(espace().finances!, 'pizza'), ['resto']);
    assert.equal(categoriesHabituelles(espace().finances!, 'inconnu'), null);
  });
});

describe('catégories : à partir des budgets existants', () => {
  it('crée une catégorie par budget, le fait la suivre et la pose sur ses dépenses', () => {
    const e0: Espace = {
      ...espace(),
      categories: [],
      finances: {
        devise: '$',
        budgets: [
          { id: 'b1', nom: 'Courses', emoji: '🛒', montant: 400, periode: 'mois' },
          { id: 'b2', nom: 'Transport', emoji: '🚗', montant: 100, periode: 'mois' },
          { id: 'g', nom: 'Total', emoji: '💰', montant: 900, periode: 'mois', global: true },
        ],
        depenses: [
          { id: 'x1', montant: 5, budget: 'b1', note: 'Pain', date: '2026-10-01', creeLe: '' },
          { id: 'x2', montant: 7, budget: null, note: 'Café', date: '2026-10-01', creeLe: '' },
        ],
      },
    };
    let n = 0;
    const { espace: e, creees } = categoriserDepuisBudgets(e0, () => `n${++n}`);
    assert.equal(creees, 2, 'le budget global n’a pas de catégorie');
    assert.deepEqual(e.categories!.map((c) => c.nom), ['Courses', 'Transport']);
    assert.deepEqual(e.finances!.budgets[0].categories, ['n1']);
    assert.equal(e.finances!.budgets[2].categories, undefined);
    assert.deepEqual(e.finances!.depenses[0].categories, ['n1']);
    assert.equal(e.finances!.depenses[1].categories, undefined);
    // Refaire l'opération ne crée rien de plus.
    const encore = categoriserDepuisBudgets(e, () => `m${++n}`);
    assert.equal(encore.creees, 0);
    assert.equal(encore.espace.categories!.length, 2);
    assert.deepEqual(encore.espace.finances!.depenses[0].categories, ['n1']);
  });
});

describe('catégories : répartition', () => {
  it('une opération à plusieurs catégories compte dans chacune ; les autres vont dans « Sans catégorie »', () => {
    const r = repartitionParCategorie(
      [
        { montant: 30, categories: ['resto', 'travail'] },
        { montant: 12, categories: ['resto'] },
        { montant: 8 },
        { montant: 4, categories: ['fantome'] },
      ],
      [resto, travail],
    );
    assert.deepEqual(r.map((x) => [x.cle, x.total, x.n]), [['resto', 42, 2], ['travail', 30, 1], ['aucune', 12, 2]]);
    assert.equal(r[2].nom, 'Sans catégorie');
  });
});
