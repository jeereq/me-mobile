import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { construire, detecterColonnes, fusionnerImport, lireDateTexte, lireDuree, lireEtat, lirePlan, lirePriorite, lireReferences, type Role } from '../src/lib/plan-import.ts';
import { planifier, tachesDuProjet } from '../src/lib/planning.ts';
import { lireFichier, lireTexte } from '../src/lib/tableur.ts';

const AUJ = '2026-11-02'; // un lundi
let n = 0;
const nouvelId = () => `id${++n}`;
const base = { joursOuvres: true, mode: 'passif' as const, source: 'manuel' as const, categories: [], creerCategories: true, enchainer: false, enchainerSousTaches: true, nouvelId, aujourdhui: AUJ, maintenant: '2026-11-02T08:00:00Z', debut: null };

function lire(texte: string) {
  const f = lireTexte(texte, 'Feuil1');
  const d = detecterColonnes(f);
  const roles = d.colonnes.map((c) => c.role) as Role[];
  return { f, d, plan: lirePlan(f, { ligneEntete: d.ligneEntete, roles, joursOuvres: true, aujourdhui: AUJ }) };
}

describe('valeurs', () => {
  it('dates', () => {
    assert.equal(lireDateTexte('2026-11-14', 2026), '2026-11-14');
    assert.equal(lireDateTexte('14/11/2026', 2026), '2026-11-14');
    assert.equal(lireDateTexte('14/11/26', 2026), '2026-11-14');
    assert.equal(lireDateTexte('14/11', 2026), '2026-11-14');
    assert.equal(lireDateTexte('11/14/2026', 2026), '2026-11-14');
    assert.equal(lireDateTexte('14 novembre 2026', 2026), '2026-11-14');
    assert.equal(lireDateTexte('1er déc. 2026', 2026), '2026-12-01');
    assert.equal(lireDateTexte('lun. 2 nov 2026', 2026), '2026-11-02');
    assert.equal(lireDateTexte('March 3, 2027', 2026), '2027-03-03');
    assert.equal(lireDateTexte(46000, 2026), '2025-12-09');
    assert.equal(lireDateTexte('31/02/2026', 2026), null);
    assert.equal(lireDateTexte('bientôt', 2026), null);
    assert.equal(lireDateTexte(12, 2026), null);
  });
  it('durées', () => {
    assert.equal(lireDuree(5, true), 5);
    assert.equal(lireDuree('5 j', true), 5);
    assert.equal(lireDuree('2 sem', true), 10);
    assert.equal(lireDuree('2 semaines', false), 14);
    assert.equal(lireDuree('1,5 jours', true), 2);
    assert.equal(lireDuree('4 h', true), 1);
    assert.equal(lireDuree('1 mois', true), 22);
    assert.equal(lireDuree(0, true), 0);
    assert.equal(lireDuree('5 j?', true), 5);
    assert.equal(lireDuree('beaucoup', true), null);
  });
  it('priorité et état', () => {
    assert.equal(lirePriorite('Haute'), 'haute');
    assert.equal(lirePriorite('Élevée'), 'haute');
    assert.equal(lirePriorite('Basse'), 'basse');
    assert.equal(lirePriorite('normal'), 'moyenne');
    assert.equal(lirePriorite('???'), null);
    assert.deepEqual(lireEtat('Terminé'), { fait: true, avancement: 100 });
    assert.deepEqual(lireEtat('40 %'), { fait: false, avancement: 40 });
    assert.deepEqual(lireEtat(0.4), { fait: false, avancement: 40 });
    assert.deepEqual(lireEtat(1), { fait: true, avancement: 100 });
    assert.deepEqual(lireEtat('À faire'), { fait: false, avancement: null });
    assert.deepEqual(lireEtat(''), { fait: null, avancement: null });
  });
  it('prédécesseurs', () => {
    assert.deepEqual(lireReferences('3', true).map((r) => [r.ref, r.delai]), [['3', 0]]);
    assert.deepEqual(lireReferences('4;6FS+2j', true).map((r) => [r.ref, r.delai, r.type]), [['4', 0, null], ['6', 2, 'FS']]);
    assert.deepEqual(lireReferences('7, 8', true).map((r) => r.ref), ['7', '8']);
    assert.deepEqual(lireReferences('5SS-1j', true).map((r) => [r.ref, r.delai, r.type]), [['5', -1, 'SS']]);
    assert.deepEqual(lireReferences('Maquettes', true).map((r) => [r.ref, r.delai]), [['Maquettes', 0]]);
    assert.deepEqual(lireReferences('2+1sem', true).map((r) => [r.ref, r.delai]), [['2', 5]]);
    assert.deepEqual(lireReferences(null, true), []);
  });
});

describe('colonnes', () => {
  it('reconnaît les titres français et anglais, et saute les lignes de titre au-dessus', () => {
    const { d } = lire('Plan de lancement\n\nN°;Tâche;Début;Fin;Prédécesseurs;% réalisé\n1;A;;;;\n');
    assert.equal(d.ligneEntete, 2);
    assert.deepEqual(d.colonnes.map((c) => c.role), ['id', 'titre', 'debut', 'fin', 'apres', 'avancement']);
    const en = lire('Task Name,Start,Finish,Predecessors,Resource Names\nA,,,,Bob\n');
    assert.deepEqual(en.d.colonnes.map((c) => c.role), ['titre', 'debut', 'fin', 'apres', 'responsable']);
  });
  it('sans titres reconnus, la première colonne de texte sert de nom de tâche', () => {
    const { d } = lire('Acheter le pain\nFaire la vaisselle\nRanger\n');
    assert.equal(d.ligneEntete, -1);
    assert.equal(d.colonnes[0].role, 'titre');
    assert.ok(d.problemes.length);
  });
  it('catégories sur deux colonnes : les deux sont gardées', () => {
    const { d } = lire('Tâche;Catégorie;Tags\nA;x;y\n');
    assert.deepEqual(d.colonnes.map((c) => c.role), ['titre', 'categories', 'categories']);
  });
});

const parents = (texte: string) => {
  const t = lire(texte).plan.projets[0].taches;
  return Object.fromEntries(t.map((x) => [x.titre, t.find((y) => y.cle === x.parentCle)?.titre ?? null]));
};

describe('hiérarchie', () => {
  it('par niveaux', () => {
    assert.deepEqual(parents('Tâche;Niveau\nPhase;1\nA;2\nB;2\nC;3\nPhase 2;1\nD;2\n'), { Phase: null, A: 'Phase', B: 'Phase', C: 'B', 'Phase 2': null, D: 'Phase 2' });
  });
  it('par numéros 1.2.3', () => {
    const { plan } = lire('N°;Tâche\n1;Phase\n1.1;A\n1.2;B\n1.2.1;C\n2;Phase 2\n2.1;D\n');
    const p = Object.fromEntries(plan.projets[0].taches.map((x) => [x.cle, x.parentCle]));
    assert.deepEqual(p, { '1': null, '1.1': '1', '1.2': '1', '1.2.1': '1.2', '2': null, '2.1': '2' });
  });
  it('par retraits (espaces) avec puces', () => {
    assert.deepEqual(parents('Tâche\nPhase\n  A\n  B\n    - C\nSuite\n'), { Phase: null, A: 'Phase', B: 'Phase', C: 'B', Suite: null });
  });
  it('par colonne Parent (nom ou numéro)', () => {
    const { plan } = lire('N°;Tâche;Parent\n1;Phase;\n2;A;1\n3;B;Phase\n');
    assert.deepEqual(plan.projets[0].taches.map((x) => x.parentCle), [null, '1', '1']);
  });
});

describe('lecture du plan', () => {
  it('un projet par valeur de la colonne Projet, remplie vers le bas', () => {
    const { plan } = lire('Projet;Tâche\nSite;A\n;B\nAppli;C\n');
    assert.deepEqual(plan.projets.map((p) => [p.nom, p.taches.map((t) => t.titre)]), [['Site', ['A', 'B']], ['Appli', ['C']]]);
  });
  it('liens par numéro, par nom, avec délai ; avertit pour l’introuvable, le SS et l’avance', () => {
    const { plan } = lire('N°;Tâche;Prédécesseurs\n1;A;\n2;B;1\n3;C;A+2j\n4;D;9\n5;E;1SS\n6;F;2FS-3j\n');
    const t = plan.projets[0].taches;
    assert.deepEqual(t[1].apres, [{ cle: '1', delai: 0 }]);
    assert.deepEqual(t[2].apres, [{ cle: '1', delai: 2 }]);
    assert.deepEqual(t[3].apres, []);
    assert.equal(t[5].apres[0].delai, 0);
    assert.ok(plan.avertissements.some((a) => /introuvable/.test(a)));
    assert.ok(plan.avertissements.some((a) => /SS/.test(a)));
    assert.ok(plan.avertissements.some((a) => /avance/.test(a)));
  });
  it('lien d’une tâche vers sa propre phase : retiré', () => {
    const { plan } = lire('N°;Tâche;Prédécesseurs\n1;Phase;\n1.1;A;1\n');
    assert.deepEqual(plan.projets[0].taches[1].apres, []);
  });
  it('numéros en double : avertissement, pas de plantage ; lignes vides ignorées', () => {
    const { plan } = lire('N°;Tâche\n1;A\n1;B\n;\n2;\n');
    assert.equal(plan.projets[0].taches.length, 2);
    assert.ok(plan.avertissements.length >= 1);
  });
  it('catégories, sous-tâches, jalon, responsable', () => {
    const { plan } = lire('Tâche;Catégories;Sous-tâches;Jalon;Responsable\nA;Pro, Urgent;Écrire\\nRelire;;Bob\nB;;;oui;\n'.replace(/\\n/g, '\n').replace('Écrire\nRelire', '"Écrire\nRelire"'));
    const [a, b] = plan.projets[0].taches;
    assert.deepEqual(a.categories, ['Pro', 'Urgent']);
    assert.deepEqual(a.sousTaches, ['Écrire', 'Relire']);
    assert.equal(a.responsable, 'Bob');
    assert.equal(b.jalon, true);
  });
});

describe('construction', () => {
  it('dates imposées, durée, jalons et fait', () => {
    const { plan } = lire('Tâche;Début;Fin;Durée;Statut\nA;03/11/2026;05/11/2026;;\nB;04/11/2026;;3;\nC;;12/11/2026;2;\nD;;;;Terminé\nE;10/11/2026;;0;\n');
    const r = construire(plan, base);
    const t = (titre: string) => r.taches.find((x) => x.titre === titre)!;
    assert.deepEqual([t('A').debut, t('A').echeance, t('A').duree, t('A').fixe], ['2026-11-03', '2026-11-05', 3, true]);
    assert.deepEqual([t('B').debut, t('B').echeance], ['2026-11-04', '2026-11-06']);
    assert.deepEqual([t('C').debut, t('C').echeance], ['2026-11-11', '2026-11-12']);
    assert.equal(t('D').statut, 'fait');
    assert.equal(t('E').jalon, true);
    assert.equal(t('E').echeance, '2026-11-10');
    assert.equal(r.projets[0].debut, '2026-11-03');
  });
  it('les liens placent les tâches l’une après l’autre, et les phases deviennent des résumés', () => {
    const { plan } = lire('N°;Tâche;Durée;Prédécesseurs\n1;Phase 1;;\n1.1;A;2;\n1.2;B;3;1.1\n2;Phase 2;;1\n2.1;C;1;\n');
    const r = construire(plan, { ...base, debut: '2026-11-02' });
    const t = (titre: string) => r.taches.find((x) => x.titre === titre)!;
    assert.deepEqual([t('A').debut, t('A').echeance], ['2026-11-02', '2026-11-03']);
    assert.deepEqual([t('B').debut, t('B').echeance], ['2026-11-04', '2026-11-06']);
    assert.equal(t('C').debut, '2026-11-09');
    assert.equal(t('Phase 1').duree, undefined);
    assert.equal(t('Phase 1').echeance, '2026-11-06');
  });
  it('enchaîner : les tâches sans date ni lien se suivent', () => {
    const { plan } = lire('Tâche;Durée\nA;2\nB;2\nC;1\n');
    const sans = construire(plan, base);
    assert.deepEqual(sans.taches.map((t) => t.debut), ['2026-11-02', '2026-11-02', '2026-11-02']);
    const avec = construire(plan, { ...base, enchainer: true });
    assert.deepEqual(avec.taches.map((t) => t.debut), ['2026-11-02', '2026-11-04', '2026-11-06']);
  });
  it('sous-tâches d’une cellule : enfants enchaînés qui se partagent la durée', () => {
    const { plan } = lire('Tâche;Durée;Sous-tâches\nA;5;"Écrire\nRelire"\n');
    const r = construire(plan, base);
    const parent = r.taches.find((t) => t.titre === 'A')!;
    const e = r.taches.filter((t) => t.parent === parent.id);
    assert.deepEqual(e.map((t) => [t.titre, t.duree]), [['Écrire', 3], ['Relire', 2]]);
    assert.equal(parent.echeance, '2026-11-06');
  });
  it('catalogue : retrouve par nom (sans accents ni casse) et crée le reste', () => {
    const { plan } = lire('Tâche;Catégories\nA;"pro, Études"\n');
    const r = construire(plan, { ...base, categories: [{ id: 'c1', nom: 'Pro', emoji: '💼', couleur: '#000' }], couleurs: ['#111', '#222'] });
    assert.equal(r.categoriesCreees.length, 1);
    assert.equal(r.categoriesCreees[0].nom, 'Études');
    assert.deepEqual(r.taches[0].categories, ['c1', r.categoriesCreees[0].id]);
    const sans = construire(plan, { ...base, creerCategories: false });
    assert.equal(sans.categoriesCreees.length, 0);
    assert.equal(sans.taches[0].categories, undefined);
  });
  it('un cycle dans le fichier n’empêche pas la construction', () => {
    const { plan } = lire('N°;Tâche;Durée;Prédécesseurs\n1;A;1;2\n2;B;1;1\n3;C;1;2\n');
    const r = construire(plan, base);
    const p = planifier(tachesDuProjet(r.taches, r.projets[0].id), r.projets[0], AUJ);
    assert.ok(p.nbCycles > 0);
  });
});

describe('fichier Excel d’exemple', () => {
  const octets = new Uint8Array(readFileSync(new URL('./fixtures/plan-lancement.xlsx', import.meta.url)));
  const feuilles = lireFichier(octets, 'plan-lancement.xlsx');
  it('lit la feuille du plan : colonnes, hiérarchie par retraits, liens', () => {
    assert.ok(feuilles.length >= 2);
    const f = feuilles[0];
    const d = detecterColonnes(f);
    const roles = d.colonnes.map((c) => c.role) as Role[];
    for (const r of ['id', 'titre', 'duree', 'debut', 'fin', 'apres', 'responsable', 'priorite', 'avancement', 'categories'] as Role[]) assert.ok(roles.includes(r), `rôle ${r}`);
    const plan = lirePlan(f, { ligneEntete: d.ligneEntete, roles, nomFichier: 'plan-lancement', joursOuvres: true, aujourdhui: AUJ });
    assert.equal(plan.projets.length, 1);
    const t = plan.projets[0].taches;
    assert.ok(t.length >= 8);
    assert.ok(t.some((x) => x.parentCle), 'hiérarchie');
    assert.ok(t.some((x) => x.apres.length), 'liens');
    const r = construire(plan, { ...base, enchainer: false });
    const projet = r.projets[0];
    const p = planifier(tachesDuProjet(r.taches, projet.id), projet, AUJ);
    assert.equal(p.nbCycles, 0);
    assert.ok(p.fin && p.debut);
    for (const x of r.taches) assert.ok(x.projet === projet.id);
  });
});

describe('mise à jour', () => {
  it('reconnaît les tâches par leur repère, garde l’état, ajoute le nouveau, garde l’absent', () => {
    const v1 = lire('N°;Tâche;Durée\n1;A;2\n2;B;2\n3;C;2\n');
    const r1 = construire(v1.plan, base);
    const pid = r1.projets[0].id;
    const avance = r1.taches.map((t) => (t.titre === 'A' ? { ...t, statut: 'fait' as const, faitLe: '2026-11-03' } : t));
    const v2 = lire('N°;Tâche;Durée\n1;A renommée;2\n2;B;4\n4;D;1\n');
    const r2 = construire(v2.plan, base);
    const m = fusionnerImport(avance, r2.taches, pid, r2.projets[0].id);
    assert.deepEqual([m.ajoutees, m.modifiees, m.absentes], [1, 2, 1]);
    const a = m.taches.find((t) => t.ref === '1')!;
    assert.equal(a.titre, 'A renommée');
    assert.equal(a.statut, 'fait');
    assert.equal(m.taches.find((t) => t.ref === '2')!.duree, 4);
    assert.ok(m.taches.some((t) => t.ref === '3'));
    assert.equal(m.taches.find((t) => t.ref === '4')!.projet, pid);
    assert.equal(new Set(m.taches.map((t) => t.id)).size, m.taches.length);
  });
});
