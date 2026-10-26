import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  candidatesApres,
  changerParent,
  creeBoucle,
  decalerDate,
  decalerTache,
  delierApres,
  deplacerTache,
  descendantes,
  desindenter,
  dureeEntre,
  depuisPosition,
  estOuvre,
  etapesDepuisTexte,
  etatProjet,
  finDepuis,
  genererSousTaches,
  indenter,
  lierApres,
  ordreAffichage,
  planifier,
  prochainesTaches,
  replanifier,
  resumes,
  sansResumes,
  supprimerTaches,
  tachesActives,
  versPosition,
} from '../src/lib/planning.ts';
import type { Projet, Tache } from '../src/lib/types.ts';

// 2026-11-02 est un lundi.
const LUN = '2026-11-02';
const projet = (p: Partial<Projet> = {}): Projet => ({ id: 'p', nom: 'Projet', emoji: '📁', debut: LUN, joursOuvres: true, creeLe: '', ...p });
let ordre = 0;
const t = (id: string, p: Partial<Tache> = {}): Tache => ({ id, titre: id.toUpperCase(), source: 'pro', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: '', projet: 'p', ordre: ordre++, ...p });
const plan = (taches: Tache[], p = projet()) => planifier(taches, p, '2026-10-26');
const dates = (taches: Tache[], p = projet()) => Object.fromEntries([...plan(taches, p).lignes].map(([id, l]) => [id, `${l.debut}>${l.fin}`]));

describe('planning : jours ouvrés et calendrier', () => {
  it('numérote les jours ouvrés et replie le week-end sur le lundi (début) ou le vendredi (fin)', () => {
    assert.equal(estOuvre('2026-11-06'), true);
    assert.equal(estOuvre('2026-11-07'), false);
    assert.equal(versPosition('2026-11-07', true, 'debut'), versPosition('2026-11-09', true));
    assert.equal(versPosition('2026-11-08', true, 'fin'), versPosition('2026-11-06', true));
    assert.equal(versPosition('2026-11-09', true) - versPosition('2026-11-06', true), 1);
  });

  it('aller-retour sans perte sur trois semaines, avant et après 1970', () => {
    for (const ouvres of [true, false])
      for (let i = 0; i < 24; i++) {
        const d = new Date(Date.UTC(2026, 10, 2 + i)).toISOString().slice(0, 10);
        if (ouvres && !estOuvre(d)) continue;
        assert.equal(depuisPosition(versPosition(d, ouvres), ouvres), d);
      }
    assert.equal(depuisPosition(versPosition('1969-12-29', true), true), '1969-12-29');
  });

  it('finDepuis et decalerDate : le week-end ne compte pas en jours ouvrés, compte en jours civils', () => {
    assert.equal(finDepuis('2026-11-02', 5, true), '2026-11-06');
    assert.equal(finDepuis('2026-11-06', 2, true), '2026-11-09');
    assert.equal(finDepuis('2026-11-06', 2, false), '2026-11-07');
    assert.equal(finDepuis('2026-11-02', 1, true), '2026-11-02');
    assert.equal(decalerDate('2026-11-06', 1, true), '2026-11-09');
    assert.equal(decalerDate('2026-11-09', -1, true), '2026-11-06');
    assert.equal(dureeEntre('2026-11-02', '2026-11-10', true), 7);
    assert.equal(dureeEntre('2026-11-02', '2026-11-10', false), 9);
  });
});

describe('planning : enchaînement des tâches', () => {
  it('une tâche commence le lendemain de la fin de la précédente ; un jalon tombe le jour même', () => {
    const l = [t('a', { duree: 3 }), t('b', { duree: 2, apres: ['a'] }), t('c', { jalon: true, apres: ['b'] }), t('d', { duree: 1, apres: ['c'] })];
    assert.deepEqual(dates(l), { a: '2026-11-02>2026-11-04', b: '2026-11-05>2026-11-06', c: '2026-11-06>2026-11-06', d: '2026-11-09>2026-11-09' });
    assert.equal(plan(l).lignes.get('c')!.duree, 0);
  });

  it('le délai ajoute des jours d’attente', () => {
    const l = [t('a', { duree: 3 }), t('b', { duree: 1, apres: ['a'], delai: 2 })];
    assert.equal(dates(l).b, '2026-11-09>2026-11-09');
  });

  it('plusieurs tâches précédentes : on attend la dernière', () => {
    const l = [t('a', { duree: 3 }), t('b', { duree: 5 }), t('c', { duree: 1, apres: ['a', 'b'] })];
    assert.deepEqual(dates(l), { a: '2026-11-02>2026-11-04', b: '2026-11-02>2026-11-06', c: '2026-11-09>2026-11-09' });
  });

  it('en jours civils, le week-end compte', () => {
    const l = [t('a', { duree: 5 }), t('b', { duree: 2, apres: ['a'] })];
    assert.deepEqual(dates(l, projet({ joursOuvres: false })), { a: '2026-11-02>2026-11-06', b: '2026-11-07>2026-11-08' });
  });

  it('sans date de départ : la plus ancienne date figée, sinon aujourd’hui', () => {
    const figee = [t('a', { duree: 1, debut: '2026-12-07', fixe: true }), t('b', { duree: 1, apres: ['a'] })];
    assert.deepEqual(dates(figee, projet({ debut: null })), { a: '2026-12-07>2026-12-07', b: '2026-12-08>2026-12-08' });
    assert.equal(dates([t('x', { duree: 2 })], projet({ debut: null })).x, '2026-10-26>2026-10-27');
  });

  it('une date de début qui tombe un week-end est ramenée au lundi', () => {
    assert.equal(dates([t('a', { duree: 1 })], projet({ debut: '2026-11-07' })).a, '2026-11-09>2026-11-09');
  });
});

describe('planning : sous-tâches et résumés', () => {
  const l = () => [t('p1'), t('c1', { parent: 'p1', duree: 2 }), t('c2', { parent: 'p1', duree: 3, apres: ['c1'] }), t('fin', { duree: 1, apres: ['p1'] })];

  it('un résumé couvre ses sous-tâches ; un lien vers un résumé attend sa dernière sous-tâche', () => {
    const p = plan(l());
    assert.deepEqual(dates(l()), { p1: '2026-11-02>2026-11-06', c1: '2026-11-02>2026-11-03', c2: '2026-11-04>2026-11-06', fin: '2026-11-09>2026-11-09' });
    assert.equal(p.lignes.get('p1')!.resume, true);
    assert.equal(p.lignes.get('p1')!.duree, 5);
    assert.deepEqual(p.ordre, ['p1', 'c1', 'c2', 'fin']);
    assert.equal(p.lignes.get('c1')!.niveau, 1);
  });

  it('les liens du parent valent pour ses sous-tâches', () => {
    const x = [t('x', { duree: 4 }), t('p1', { apres: ['x'], delai: 1 }), t('c1', { parent: 'p1', duree: 1 }), t('c2', { parent: 'p1', duree: 1 })];
    const d = dates(x);
    assert.equal(d.c1, '2026-11-09>2026-11-09'); // x finit le jeudi 5, +1 jour d'attente : lundi
    assert.equal(d.c2, '2026-11-09>2026-11-09');
    assert.equal(d.p1, '2026-11-09>2026-11-09');
  });

  it('l’avancement d’un résumé pèse chaque sous-tâche selon sa durée ; un résumé est fait quand toutes le sont', () => {
    const x = [t('p1'), t('c1', { parent: 'p1', duree: 2, statut: 'fait' }), t('c2', { parent: 'p1', duree: 3, avancement: 50 })];
    const p = plan(x);
    assert.equal(p.lignes.get('p1')!.avancement, 70); // (2 × 100 + 3 × 50) / 5
    assert.equal(p.lignes.get('p1')!.fait, false);
    assert.equal(plan([t('p1'), t('c1', { parent: 'p1', statut: 'fait' })]).lignes.get('p1')!.fait, true);
  });

  it('resumes et sansResumes isolent les vraies tâches', () => {
    const x = l();
    assert.deepEqual([...resumes(x)], ['p1']);
    assert.deepEqual(sansResumes(x).map((y) => y.id), ['c1', 'c2', 'fin']);
    const sansParents = [t('a'), t('b')];
    assert.equal(sansResumes(sansParents), sansParents, 'rien à retirer : même tableau');
  });

  it('un parent absent du projet ou une boucle de parents ne cassent rien', () => {
    const x = [t('a', { parent: 'fantome', duree: 1 }), t('b', { parent: 'c', duree: 1 }), t('c', { parent: 'b', duree: 1 })];
    const p = plan(x);
    assert.equal(p.lignes.size, 3);
    assert.equal(p.ordre.length, 3);
  });
});

describe('planning : dates figées et conflits', () => {
  it('une date figée ne bouge pas et ses suivantes s’y accrochent', () => {
    const x = [t('a', { duree: 2 }), t('b', { debut: '2026-11-09', echeance: '2026-11-11', fixe: true, apres: ['a'] }), t('c', { duree: 1, apres: ['b'] })];
    assert.deepEqual(dates(x), { a: '2026-11-02>2026-11-03', b: '2026-11-09>2026-11-11', c: '2026-11-12>2026-11-12' });
    assert.equal(plan(x).nbConflits, 0);
  });

  it('une date figée qui commence avant la fin de la précédente est signalée en conflit, sans être déplacée', () => {
    const x = [t('a', { duree: 5 }), t('b', { debut: '2026-11-04', echeance: '2026-11-05', fixe: true, apres: ['a'] })];
    const p = plan(x);
    assert.equal(dates(x).b, '2026-11-04>2026-11-05');
    assert.equal(p.lignes.get('b')!.conflit, true);
    assert.equal(p.nbConflits, 1);
    assert.equal(p.lignes.get('a')!.conflit, false);
  });

  it('une tâche faite garde ses dates', () => {
    const x = [t('a', { duree: 2, statut: 'fait', debut: '2026-11-03', echeance: '2026-11-04' }), t('b', { duree: 1, apres: ['a'] })];
    assert.deepEqual(dates(x), { a: '2026-11-03>2026-11-04', b: '2026-11-05>2026-11-05' });
  });

  it('un jalon figé garde sa date ; une date figée sans fin utilise la durée', () => {
    const x = [t('j', { jalon: true, debut: '2026-11-10', fixe: true }), t('a', { debut: '2026-11-03', duree: 3, fixe: true })];
    assert.deepEqual(dates(x), { j: '2026-11-10>2026-11-10', a: '2026-11-03>2026-11-05' });
  });
});

describe('planning : boucles de liens', () => {
  it('deux tâches qui se suivent l’une l’autre sont signalées, leurs liens ignorés, et le reste est planifié', () => {
    const x = [t('a', { duree: 1, apres: ['b'] }), t('b', { duree: 1, apres: ['a'] }), t('c', { duree: 2 })];
    const p = plan(x);
    assert.equal(p.nbCycles, 2);
    assert.equal(p.lignes.get('a')!.cycle, true);
    assert.equal(p.lignes.get('c')!.cycle, false);
    assert.equal(dates(x).a, '2026-11-02>2026-11-02');
    assert.equal(p.lignes.get('a')!.critique, false);
  });

  it('refuse un lien qui ferait une boucle, directe ou en chaîne, avec un message', () => {
    const x = [t('a'), t('b', { apres: ['a'] }), t('c', { apres: ['b'] })];
    assert.equal(creeBoucle(x, 'a', 'c'), true);
    assert.equal(creeBoucle(x, 'a', 'b'), true);
    assert.equal(creeBoucle(x, 'c', 'a'), false, 'déjà indirectement vrai, mais pas une boucle');
    const r = lierApres(x, 'a', 'c');
    assert.match(r.erreur!, /boucle/);
    assert.equal(r.taches, x);
    assert.match(lierApres(x, 'a', 'a').erreur!, /elle-même/);
  });

  it('ajoute un lien valide, ne le double pas, et sait le retirer', () => {
    const x = [t('a'), t('b')];
    const r = lierApres(x, 'b', 'a');
    assert.deepEqual(r.taches.find((y) => y.id === 'b')!.apres, ['a']);
    assert.equal(lierApres(r.taches, 'b', 'a').taches, r.taches);
    const d = delierApres(r.taches, 'b', 'a');
    assert.equal('apres' in d.find((y) => y.id === 'b')!, false);
  });

  it('un lien entre une tâche et sa sous-tâche, ou entre deux projets, est refusé', () => {
    const x = [t('p1'), t('c1', { parent: 'p1' }), t('z', { projet: 'autre' })];
    assert.match(lierApres(x, 'c1', 'p1').erreur!, /parenté/);
    assert.match(lierApres(x, 'p1', 'c1').erreur!, /parenté/);
    assert.match(lierApres(x, 'c1', 'z').erreur!, /même projet/);
  });

  it('une boucle passant par un résumé est détectée', () => {
    const x = [t('p1'), t('c1', { parent: 'p1' }), t('c2', { parent: 'p1' }), t('y', { apres: ['p1'] })];
    assert.equal(creeBoucle(x, 'c1', 'y'), true, 'y attend tout p1, dont c1 : c1 ne peut pas attendre y');
    assert.equal(creeBoucle(x, 'y', 'c1'), false);
  });

  it('propose seulement les tâches qui peuvent précéder', () => {
    const x = [t('p1'), t('c1', { parent: 'p1' }), t('a'), t('b', { apres: ['a'] }), t('z', { projet: 'autre' })];
    assert.deepEqual(candidatesApres(x, 'a').map((y) => y.id), ['p1', 'c1'], 'b suit déjà a : b est exclue');
    assert.deepEqual(candidatesApres(x, 'p1').map((y) => y.id), ['a', 'b'], 'ni elle-même ni ses sous-tâches');
  });
});

describe('planning : marge et chemin critique', () => {
  // a(3) → b(5) → d(1) ; a → c(2) → d : la voie par b est la plus longue.
  const x = () => [t('a', { duree: 3 }), t('b', { duree: 5, apres: ['a'] }), t('c', { duree: 2, apres: ['a'] }), t('d', { duree: 1, apres: ['b', 'c'] }), t('seul', { duree: 1 })];
  it('la voie la plus longue est critique, les autres ont de la marge', () => {
    const p = plan(x());
    for (const id of ['a', 'b', 'd']) assert.equal(p.lignes.get(id)!.critique, true, id);
    assert.equal(p.lignes.get('c')!.critique, false);
    assert.equal(p.lignes.get('c')!.marge, 3);
    assert.equal(p.lignes.get('b')!.marge, 0);
  });
  it('une tâche isolée n’est pas un « chemin » critique, même si elle finit avant la fin', () => {
    const p = plan(x());
    assert.equal(p.lignes.get('seul')!.critique, false);
    assert.ok(p.lignes.get('seul')!.marge > 0);
  });
  it('une tâche faite n’est plus critique', () => {
    const y = x().map((z) => (z.id === 'a' ? { ...z, statut: 'fait' as const } : z));
    assert.equal(plan(y).lignes.get('a')!.critique, false);
  });
  it('tâches bloquées : tant que l’une des précédentes n’est pas faite', () => {
    const y = [t('a', { duree: 1 }), t('b', { duree: 1, apres: ['a'] })];
    assert.equal(plan(y).lignes.get('b')!.bloquee, true);
    assert.equal(plan(y).lignes.get('a')!.bloquee, false);
    assert.equal(plan(y.map((z) => (z.id === 'a' ? { ...z, statut: 'fait' as const } : z))).lignes.get('b')!.bloquee, false);
  });
});

describe('planning : propriétés sur des réseaux aléatoires', () => {
  it('chaque tâche suit ses précédentes, les marges sont positives, rien n’est NaN', () => {
    let s = 7;
    const alea = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let essai = 0; essai < 60; essai++) {
      const n = 4 + Math.floor(alea() * 25);
      const taches: Tache[] = [];
      for (let i = 0; i < n; i++) {
        const apres = Array.from({ length: i }, (_, k) => k).filter(() => alea() < 0.2).map((k) => `t${k}`);
        const parent = i > 3 && alea() < 0.3 ? `t${Math.floor(alea() * i)}` : undefined;
        taches.push(t(`t${i}`, { duree: Math.floor(alea() * 6), ...(apres.length ? { apres } : {}), ...(parent && !apres.includes(parent) ? { parent } : {}), ...(alea() < 0.15 ? { delai: 1 } : {}) }));
      }
      for (const ouvres of [true, false]) {
        const p = planifier(taches, projet({ joursOuvres: ouvres }), '2026-10-26');
        for (const l of p.lignes.values()) {
          assert.ok(/^\d{4}-\d\d-\d\d$/.test(l.debut) && /^\d{4}-\d\d-\d\d$/.test(l.fin), `${l.id} dates valides`);
          assert.ok(l.fin >= l.debut, `${l.id} fin après début`);
          assert.ok(l.marge >= 0 && Number.isFinite(l.marge));
          if (l.critique) assert.equal(l.marge, 0);
          assert.ok(l.avancement >= 0 && l.avancement <= 100);
        }
        // Chaque tâche non figée commence après la fin de celles qu'elle suit (hors boucles).
        for (const tk of taches) {
          const l = p.lignes.get(tk.id)!;
          if (l.cycle || l.resume) continue;
          for (const a of tk.apres ?? []) {
            const la = p.lignes.get(a);
            // Un lien vers un ancêtre n'a pas de sens (la tâche en fait partie) ; l'app le refuse.
            if (la && !la.cycle && !descendantes(taches, a).has(tk.id)) assert.ok(l.debut >= la.fin, `${tk.id} commence après ${a}`);
          }
        }
      }
    }
  });
});

describe('planning : écrire les dates calculées', () => {
  it('écrit début et échéance, ne touche pas aux dates figées, et ne change rien la deuxième fois', () => {
    const x = [t('a', { duree: 2 }), t('b', { duree: 1, apres: ['a'] }), t('c', { debut: '2026-11-20', echeance: '2026-11-20', fixe: true })];
    const y = replanifier(x, projet(), '2026-10-26');
    assert.equal(y.find((z) => z.id === 'a')!.debut, '2026-11-02');
    assert.equal(y.find((z) => z.id === 'b')!.echeance, '2026-11-04');
    assert.equal(y.find((z) => z.id === 'c'), x[2], 'figée : même objet');
    assert.equal(replanifier(y, projet(), '2026-10-26'), y, 'déjà à jour : même tableau');
  });
  it('quand une durée change, les suivantes sont recalculées', () => {
    const y = replanifier([t('a', { duree: 2 }), t('b', { duree: 1, apres: ['a'] })], projet(), '2026-10-26');
    const z = replanifier(y.map((q) => (q.id === 'a' ? { ...q, duree: 5 } : q)), projet(), '2026-10-26');
    assert.equal(z.find((q) => q.id === 'b')!.debut, '2026-11-09');
  });
  it('les tâches d’un autre projet restent telles quelles', () => {
    const autre = t('z', { projet: 'autre', duree: 1 });
    const y = replanifier([t('a', { duree: 1 }), autre], projet(), '2026-10-26');
    assert.equal(y.find((q) => q.id === 'z'), autre);
  });
  it('un résumé reçoit les dates de ses sous-tâches', () => {
    const y = replanifier([t('p1'), t('c1', { parent: 'p1', duree: 2 }), t('c2', { parent: 'p1', duree: 2, apres: ['c1'] })], projet(), '2026-10-26');
    assert.equal(y.find((q) => q.id === 'p1')!.echeance, '2026-11-05');
  });
});

describe('planning : structure', () => {
  const base = () => [t('a'), t('b'), t('c', { parent: 'b' }), t('d', { parent: 'b' }), t('e')];
  it('affiche parent puis sous-tâches, dans l’ordre des rangs', () => {
    assert.deepEqual(ordreAffichage(base()).map((x) => `${x.tache.id}:${x.niveau}`), ['a:0', 'b:0', 'c:1', 'd:1', 'e:0']);
  });
  it('supprime une tâche avec ses sous-tâches et nettoie les liens qui y menaient', () => {
    const x = [...base().slice(0, 4), t('e', { apres: ['c', 'a'] })];
    const y = supprimerTaches(x, ['b']);
    assert.deepEqual(y.map((z) => z.id), ['a', 'e']);
    assert.deepEqual(y[1].apres, ['a']);
    assert.equal('apres' in supprimerTaches([t('a'), t('e', { apres: ['a'] })], ['a'])[0], false);
    assert.deepEqual([...descendantes(base(), 'b')].sort(), ['b', 'c', 'd']);
  });
  it('change de parent, refuse de se mettre sous soi-même ou sous une descendante', () => {
    const y = changerParent(base(), 'e', 'b').taches;
    assert.equal(y.find((z) => z.id === 'e')!.parent, 'b');
    assert.ok(y.find((z) => z.id === 'e')!.ordre! > y.find((z) => z.id === 'd')!.ordre!, 'à la fin des sous-tâches');
    assert.match(changerParent(base(), 'b', 'c').erreur!, /elle-même/);
    assert.equal('parent' in changerParent(base(), 'c', null).taches.find((z) => z.id === 'c')!, false);
  });
  it('monte et descend parmi les frères, sans sortir des bornes', () => {
    const y = deplacerTache(base(), 'e', -1);
    assert.deepEqual(ordreAffichage(y).map((x) => x.tache.id), ['a', 'e', 'b', 'c', 'd']);
    assert.deepEqual(ordreAffichage(deplacerTache(base(), 'c', 1)).map((x) => x.tache.id), ['a', 'b', 'd', 'c', 'e']);
    const premier = base();
    assert.equal(deplacerTache(premier, 'a', -1), premier);
  });
  it('indente sous le frère précédent, désindente juste après le parent', () => {
    const y = indenter(base(), 'e');
    assert.equal(y.find((z) => z.id === 'e')!.parent, 'b');
    const z = desindenter(y, 'e');
    assert.deepEqual(ordreAffichage(z).map((q) => `${q.tache.id}:${q.niveau}`), ['a:0', 'b:0', 'c:1', 'd:1', 'e:0']);
    const w = desindenter(base(), 'c');
    assert.deepEqual(ordreAffichage(w).map((q) => `${q.tache.id}:${q.niveau}`), ['a:0', 'b:0', 'd:1', 'c:0', 'e:0'], 'c vient après b et ce qui lui reste de sous-tâches');
    const premier = base();
    assert.equal(indenter(premier, 'a'), premier, 'rien avant elle : inchangé');
  });
});

describe('planning : sous-tâches générées', () => {
  const ids = () => {
    let n = 0;
    return () => `g${++n}`;
  };
  it('découpe la durée entre les étapes (au moins un jour chacune) et les enchaîne', () => {
    const x = [t('a', { duree: 5 }), t('s', { duree: 1, apres: ['a'] })];
    const y = genererSousTaches(x, projet(), 'a', ['Cadrer', 'Faire', 'Tester', 'Livrer'], { enchainer: true, repartir: true }, ids(), '2026-10-26');
    const enfants = y.filter((z) => z.parent === 'a');
    assert.deepEqual(enfants.map((z) => z.duree), [2, 1, 1, 1]);
    assert.deepEqual(enfants.map((z) => z.apres), [undefined, ['g1'], ['g2'], ['g3']]);
    const d = dates(y);
    assert.equal(d.a, '2026-11-02>2026-11-06', 'le parent couvre ses étapes');
    assert.equal(d.g1, '2026-11-02>2026-11-03');
    assert.equal(d.s, '2026-11-09>2026-11-09', 'la tâche qui suivait le parent attend toujours la dernière étape');
    assert.equal('duree' in y.find((z) => z.id === 'a')!, false, 'la durée vient maintenant des étapes');
  });
  it('sans chaînage les étapes partent ensemble ; sans répartition elles durent un jour', () => {
    const y = genererSousTaches([t('a', { duree: 5 })], projet(), 'a', ['x', 'y'], { enchainer: false, repartir: false }, ids(), '2026-10-26');
    assert.deepEqual(dates(y), { a: '2026-11-02>2026-11-02', g1: '2026-11-02>2026-11-02', g2: '2026-11-02>2026-11-02' });
  });
  it('les étapes héritent de la priorité, du mode, des catégories et du responsable ; un parent aux dates figées passe son début à la première étape', () => {
    const parent = t('a', { priorite: 'haute', mode: 'agressif', categories: ['c1'], responsable: 'Awa', debut: '2026-11-10', echeance: '2026-11-12', fixe: true });
    const y = genererSousTaches([parent], projet(), 'a', ['x', 'y', 'z'], { enchainer: true, repartir: true }, ids(), '2026-10-26');
    const e = y.filter((z) => z.parent === 'a');
    assert.ok(e.every((z) => z.priorite === 'haute' && z.mode === 'agressif' && z.responsable === 'Awa' && z.categories?.[0] === 'c1'));
    assert.equal(e[0].debut, '2026-11-10');
    assert.deepEqual(e.map((z) => z.duree), [1, 1, 1]);
    assert.equal(dates(y).g3, '2026-11-12>2026-11-12');
    assert.equal('fixe' in y.find((z) => z.id === 'a')!, false);
  });
  it('ne fait rien sans étape ou sans tâche', () => {
    const x = [t('a')];
    assert.equal(genererSousTaches(x, projet(), 'a', ['  ', ''], { enchainer: true, repartir: true }, ids(), '2026-10-26'), x);
    assert.equal(genererSousTaches(x, projet(), 'nope', ['x'], { enchainer: true, repartir: true }, ids(), '2026-10-26'), x);
  });
  it('lit des étapes saisies : lignes, points-virgules, puces et numéros', () => {
    assert.deepEqual(etapesDepuisTexte('1. Cadrer\n2) Faire\n- Tester ; • Livrer\n\n  a) bonus'), ['Cadrer', 'Faire', 'Tester', 'Livrer', 'bonus']);
    assert.deepEqual(etapesDepuisTexte('  \n'), []);
    assert.deepEqual(etapesDepuisTexte('Réunion 2025 ; Plan'), ['Réunion 2025', 'Plan']);
  });
});

describe('planning : décaler et suivre', () => {
  it('décaler une tâche fige ses dates et pousse les suivantes', () => {
    const p = projet();
    const x = replanifier([t('a', { duree: 2 }), t('b', { duree: 1, apres: ['a'] }), t('c', { duree: 1 })], p, '2026-10-26');
    const y = decalerTache(x, p, 'a', 2, '2026-10-26');
    const a = y.find((z) => z.id === 'a')!;
    assert.equal(a.debut, '2026-11-04');
    assert.equal(a.fixe, true);
    assert.equal(y.find((z) => z.id === 'b')!.debut, '2026-11-06');
    assert.equal(y.find((z) => z.id === 'c')!.debut, '2026-11-02', 'indépendante : ne bouge pas');
    const z = decalerTache(y, p, 'a', -2, '2026-10-26');
    assert.equal(z.find((q) => q.id === 'b')!.debut, '2026-11-04', 'on peut aussi avancer');
  });
  it('décaler un résumé décale toutes ses sous-tâches', () => {
    const p = projet();
    const x = replanifier([t('p1'), t('c1', { parent: 'p1', duree: 1 }), t('c2', { parent: 'p1', duree: 1, apres: ['c1'] })], p, '2026-10-26');
    const y = decalerTache(x, p, 'p1', 7, '2026-10-26');
    assert.equal(y.find((q) => q.id === 'c1')!.debut, '2026-11-11');
    assert.equal(y.find((q) => q.id === 'c2')!.debut, '2026-11-12');
  });
  it('les prochaines tâches sont les débloquées, dans l’ordre du planning', () => {
    const x = [t('a', { duree: 2, statut: 'fait', debut: '2026-11-02', echeance: '2026-11-03' }), t('b', { duree: 1, apres: ['a'] }), t('c', { duree: 1, apres: ['b'] }), t('d', { duree: 1 })];
    assert.deepEqual(prochainesTaches(x, projet(), '2026-10-26').map((q) => q.tache.id), ['d', 'b'], 'c attend b ; d (11-02) passe avant b (11-04)');
    assert.deepEqual(prochainesTaches(x, projet(), '2026-10-26', 1).length, 1);
  });
  it('résume l’état : tâches, faites, en retard, fin prévue', () => {
    const x = [t('a', { duree: 2, statut: 'fait', debut: '2026-11-02', echeance: '2026-11-03' }), t('b', { duree: 3, apres: ['a'] }), t('p1'), t('c1', { parent: 'p1', duree: 1 })];
    const e = etatProjet(x, projet(), '2026-11-10');
    assert.equal(e.nbTaches, 3, 'le résumé ne compte pas');
    assert.equal(e.nbFaites, 1);
    assert.equal(e.enRetard, 2, 'b et c1 devraient être finies');
    assert.equal(e.fin, '2026-11-06');
  });
});

describe('tachesActives', () => {
  const projet: Projet = { id: 'p', nom: 'P', emoji: '📁', debut: '2026-11-02', joursOuvres: true, creeLe: 'x' };
  const t = (id: string, extra: Partial<Tache> = {}): Tache => ({ id, titre: id, source: 'manuel', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'passif', creeLe: 'x', ...extra });
  it('sans projet : toutes les tâches pas faites', () => {
    const l = tachesActives({ taches: [t('a'), t('b', { statut: 'fait' })] }, '2026-11-02');
    assert.deepEqual(l.map((x) => x.id), ['a']);
  });
  it('dans un projet : ni résumés, ni faites, ni bloquées ; les tâches simples restent', () => {
    const taches = [
      t('s'),
      t('phase', { projet: 'p' }),
      t('a', { projet: 'p', parent: 'phase', duree: 2 }),
      t('b', { projet: 'p', parent: 'phase', duree: 2, apres: ['a'] }),
      t('c', { projet: 'p', duree: 1, statut: 'fait' }),
    ];
    assert.deepEqual(tachesActives({ taches, projets: [projet] }, '2026-11-02').map((x) => x.id), ['s', 'a']);
    const apres = taches.map((x) => (x.id === 'a' ? { ...x, statut: 'fait' as const, faitLe: '2026-11-03' } : x));
    assert.deepEqual(tachesActives({ taches: apres, projets: [projet] }, '2026-11-04').map((x) => x.id), ['s', 'b']);
  });
  it('un projet supprimé : ses tâches redeviennent des tâches simples', () => {
    const l = tachesActives({ taches: [t('a', { projet: 'inconnu' })], projets: [projet] }, '2026-11-02');
    assert.deepEqual(l.map((x) => x.id), ['a']);
  });
});
