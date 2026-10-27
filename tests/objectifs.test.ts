import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { acquisDe, ajouterVersement, capaciteMensuelle, compterDepense, depensesLiees, creerObjectif, datesVersements, echeanceTenable, erreurObjectif, etapesObjectif, faisabilite, fondsUrgenceConseille, planReduction, resumeObjectifs, retirerVersement, suiviObjectif } from '../src/lib/objectifs.ts';
import type { Finances, Objectif } from '../src/lib/types.ts';

const obj = (o: Partial<Objectif> = {}): Objectif => ({ id: 'o1', nom: 'Voyage', emoji: '✈️', genre: 'epargne', cible: 1200, debut: '2026-01-01', echeance: '2026-07-01', versements: [], creeLe: '', ...o });
const v = (id: string, date: string, montant: number) => ({ id, date, montant });
const fin = (f: Partial<Finances> = {}): Finances => ({ devise: '€', budgets: [], depenses: [], revenus: [], ...f });
const dep = (id: string, date: string, montant: number, budget: string | null = null) => ({ id, date, montant, note: '', budget, creeLe: '' });
const rev = (id: string, date: string, montant: number) => ({ id, date, montant, note: '', creeLe: '' });

describe('plan de versements', () => {
  it('répartit le reste sur les versements mensuels jusqu’à l’échéance', () => {
    const o = obj();
    assert.deepEqual(datesVersements(o), ['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01']);
    const s = suiviObjectif(o, '2026-01-01');
    assert.equal(s.requis, 200);
    assert.equal(s.versement, 200);
    assert.equal(s.requisMensuel, 200);
    assert.equal(s.prochain, '2026-02-01');
    assert.equal(s.etat, 'dans_les_temps');
    assert.equal(s.ecartEcheance, 0);
    assert.equal(s.dateAtteinte, '2026-07-01');
  });

  it('recalcule le montant requis quand on prend du retard, et le dit', () => {
    const o = obj({ versements: [v('a', '2026-02-01', 200), v('b', '2026-03-01', 200)] });
    const s = suiviObjectif(o, '2026-03-15');
    assert.equal(s.acquis, 400);
    assert.equal(s.reste, 800);
    assert.equal(s.versementsRestants, 4);
    assert.equal(s.requis, 200);
    assert.equal(s.etat, 'en_retard');
    const tard = suiviObjectif(obj({ versements: [v('a', '2026-02-01', 200)] }), '2026-05-15');
    assert.equal(tard.versementsRestants, 2);
    assert.equal(tard.requis, 500);
  });

  it('dit qu’on est en avance, puis que c’est atteint', () => {
    const avance = suiviObjectif(obj({ versements: [v('a', '2026-01-10', 700)] }), '2026-02-01');
    assert.equal(avance.etat, 'en_avance');
    const fait = suiviObjectif(obj({ versements: [v('a', '2026-01-10', 1200)] }), '2026-02-01');
    assert.equal(fait.etat, 'atteint');
    assert.equal(fait.reste, 0);
    assert.equal(fait.pct, 1);
    assert.equal(fait.prochain, null);
  });

  it('compte le point de départ comme déjà acquis', () => {
    const s = suiviObjectif(obj({ depart: 300 }), '2026-01-01');
    assert.equal(s.acquis, 300);
    assert.equal(s.reste, 900);
    assert.equal(s.requis, 150);
  });

  it('projette la date avec un montant choisi trop petit', () => {
    const s = suiviObjectif(obj({ plan: { cadence: 'mois', versement: 150 } }), '2026-01-01');
    assert.equal(s.choisi, true);
    assert.equal(s.requis, 200);
    assert.equal(s.versement, 150);
    // 8 versements de 150 : le 1er septembre, 62 jours après l'échéance.
    assert.equal(s.dateAtteinte, '2026-09-01');
    assert.equal(s.ecartEcheance, 62);
  });

  it('gère un plan à la semaine et le ramène au mois', () => {
    const o = obj({ cible: 520, debut: '2026-01-05', echeance: '2026-04-06', plan: { cadence: 'semaine' } });
    const s = suiviObjectif(o, '2026-01-05');
    assert.equal(s.versementsRestants, 13);
    assert.equal(s.requis, 40);
    assert.equal(s.requisMensuel, 173.33);
  });

  it('mesure le rythme réel des 90 derniers jours', () => {
    const o = obj({ cible: 3000, versements: [v('a', '2026-02-20', 300), v('b', '2026-03-20', 300), v('c', '2025-09-01', 100)] });
    const s = suiviObjectif(o, '2026-04-01');
    assert.equal(s.rythmeReel, 200);
    assert.ok(s.dateAtteinteReelle && s.dateAtteinteReelle > '2026-07-01');
  });

  it('signale une échéance passée', () => {
    assert.equal(suiviObjectif(obj(), '2026-08-01').etat, 'depasse');
    assert.equal(suiviObjectif(obj(), '2025-12-01').etat, 'a_venir');
  });

  it('prévoit un seul versement quand l’échéance est plus proche qu’une période', () => {
    assert.deepEqual(datesVersements(obj({ echeance: '2026-01-15' })), ['2026-01-15']);
  });
});

describe('étapes', () => {
  it('place quatre étapes et date celle franchie par un versement', () => {
    const o = obj({ versements: [v('a', '2026-02-10', 200), v('b', '2026-03-10', 200)] });
    const e = etapesObjectif(o, '2026-04-10');
    assert.deepEqual(e.map((x) => x.montant), [300, 600, 900, 1200]);
    assert.equal(e[0].etat, 'fait');
    assert.equal(e[0].faitLe, '2026-03-10');
    assert.equal(e[1].etat, 'en_retard');
    assert.equal(e[3].etat, 'a_venir');
  });
});

describe('ce qu’on peut mettre de côté', () => {
  const histo = fin({
    revenus: [rev('r1', '2026-07-28', 2000), rev('r2', '2026-08-28', 2000), rev('r3', '2026-09-28', 2000)],
    depenses: [dep('d1', '2026-07-10', 1500), dep('d2', '2026-08-10', 1500), dep('d3', '2026-09-10', 1500), dep('d4', '2026-10-05', 99999)],
  });
  it('fait la moyenne des mois complets, sans le mois en cours', () => {
    const c = capaciteMensuelle(histo, '2026-10-12')!;
    assert.equal(c.mois, 3);
    assert.equal(c.parMois, 500);
    assert.equal(c.depenses, 1500);
  });
  it('ne conclut pas sans historique ni revenus', () => {
    assert.equal(capaciteMensuelle(fin(), '2026-10-12'), null);
    const f = fin({ depenses: [dep('d', '2026-09-10', 100)] });
    assert.equal(faisabilite(f, obj(), '2026-10-12').tient, null);
  });
  it('compare le plan à ce qui reste, une fois les autres objectifs servis', () => {
    const a = obj({ id: 'a', cible: 6000, debut: '2026-10-12', echeance: '2027-04-12' });
    const b = obj({ id: 'b', nom: 'Achat', cible: 600, debut: '2026-10-12', echeance: '2027-04-12' });
    const f = { ...histo, objectifs: [a, b] };
    const fa = faisabilite(f, a, '2026-10-12');
    assert.equal(fa.autres, 100);
    assert.equal(fa.libre, 400);
    assert.equal(fa.besoin, 1000);
    assert.equal(fa.manque, 600);
    assert.equal(fa.tient, false);
    const fb = faisabilite(f, b, '2026-10-12');
    assert.equal(fb.libre, -500);
    assert.equal(fb.tient, false);
  });
  it('dit qu’un plan tient quand il reste assez', () => {
    const f = { ...histo, objectifs: [obj({ debut: '2026-10-12', echeance: '2027-04-12', cible: 1200 })] };
    const r = faisabilite(f, f.objectifs[0], '2026-10-12');
    assert.equal(r.libre, 500);
    assert.equal(r.manque, 0);
    assert.equal(r.tient, true);
  });
  it('propose où trouver ce qui manque, puis une date tenable', () => {
    const f = fin({
      budgets: [
        { id: 'resto', nom: 'Restos', emoji: '🍽️', montant: 300, periode: 'mois' },
        { id: 'sorties', nom: 'Sorties', emoji: '🎉', montant: 200, periode: 'mois' },
      ],
      revenus: [rev('r1', '2026-09-28', 2000), rev('r2', '2026-08-28', 2000)],
      depenses: [dep('a', '2026-09-10', 400, 'resto'), dep('b', '2026-08-10', 400, 'resto'), dep('c', '2026-09-11', 200, 'sorties'), dep('d', '2026-08-11', 200, 'sorties')],
    });
    const p = planReduction(f, '2026-10-12', 70)!;
    assert.equal(p.pct, 20);
    assert.equal(p.total, 120);
    assert.equal(p.couvre, true);
    assert.deepEqual(p.leviers.map((x) => x.nom), ['Restos', 'Sorties']);
    assert.equal(planReduction(f, '2026-10-12', 500)!.couvre, false);
    assert.equal(planReduction(f, '2026-10-12', 0), null);
    assert.equal(echeanceTenable(obj({ debut: '2026-10-12', echeance: '2027-01-12' }), '2026-10-12', 400), '2027-01-12');
    assert.equal(echeanceTenable(obj(), '2026-10-12', 0), null);
  });
  it('conseille trois mois de dépenses pour un fonds d’urgence', () => {
    assert.equal(fondsUrgenceConseille(histo, '2026-10-12'), 4500);
    assert.equal(fondsUrgenceConseille(fin(), '2026-10-12'), null);
  });
});

describe('création et versements', () => {
  it('refuse un objectif qui n’a pas de sens', () => {
    const b = { nom: 'Voyage', cible: 1000, echeance: '2026-12-01' };
    assert.equal(erreurObjectif(b, '2026-10-01'), null);
    assert.match(erreurObjectif({ ...b, nom: ' ' }, '2026-10-01')!, /nom/);
    assert.match(erreurObjectif({ ...b, cible: 0 }, '2026-10-01')!, /plus grande/);
    assert.match(erreurObjectif({ ...b, depart: 1000 }, '2026-10-01')!, /déjà/);
    assert.match(erreurObjectif({ ...b, echeance: '2026-10-01' }, '2026-10-01')!, /après/);
    assert.match(erreurObjectif({ ...b, echeance: '' }, '2026-10-01')!, /date/);
  });
  it('crée, ajoute et retire un versement', () => {
    const o = creerObjectif({ nom: ' Voyage ', emoji: '✈️', genre: 'epargne', cible: 1000, echeance: '2026-12-01' }, 'o', '2026-10-01');
    assert.equal(o.nom, 'Voyage');
    assert.equal(o.debut, '2026-10-01');
    const p = ajouterVersement(o, v('a', '2026-10-05', 100));
    assert.equal(suiviObjectif(p, '2026-10-06').acquis, 100);
    assert.equal(suiviObjectif(retirerVersement(p, 'a'), '2026-10-06').acquis, 0);
  });
  it('résume tous les objectifs en cours', () => {
    const f = fin({ objectifs: [obj({ versements: [v('a', '2026-01-02', 1200)] }), obj({ id: 'o2', cible: 1000, versements: [v('b', '2026-01-02', 100)] }), obj({ id: 'o3', archive: true })] });
    const r = resumeObjectifs(f, '2026-05-01');
    assert.equal(r.nb, 2);
    assert.equal(r.atteints, 1);
    assert.equal(r.enRetard, 1);
    assert.equal(r.acquis, 1300);
    assert.equal(r.cible, 2200);
  });
});

describe('dépenses reliées à un objectif', () => {
  const dep = (id: string, date: string, montant: number, categories?: string[], extra: Record<string, unknown> = {}) => ({ id, date, montant, note: `Achat ${id}`, budget: null, categories, creeLe: `${date}T10:00`, ...extra });
  const f = (depenses: unknown[]) => ({ devise: '€', budgets: [], depenses, revenus: [] }) as unknown as Finances;
  const o = (x: Partial<Objectif> = {}): Objectif => ({ id: 'o', nom: 'Dette', emoji: '💳', genre: 'dette', cible: 500, debut: '2026-10-01', echeance: '2026-12-01', versements: [], categories: ['rembt'], creeLe: '', ...x });

  it('relie les dépenses des catégories de l’objectif, depuis son début', () => {
    const l = depensesLiees(f([dep('a', '2026-10-05', 100, ['rembt']), dep('b', '2026-09-20', 80, ['rembt']), dep('c', '2026-10-06', 30, ['autre']), dep('d', '2026-10-07', 10)]), o());
    assert.deepEqual(l.aCompter.map((x) => x.id), ['a']);
    assert.deepEqual(l.comptees, []);
  });
  it('ignore la moitié d’un virement entre comptes', () => {
    assert.deepEqual(depensesLiees(f([dep('a', '2026-10-05', 100, ['rembt'], { lien: 'v' })]), o()).aCompter, []);
  });
  it('ne relie rien sans catégorie sur l’objectif', () => {
    assert.deepEqual(depensesLiees(f([dep('a', '2026-10-05', 100, ['rembt'])]), o({ categories: undefined })).aCompter, []);
  });
  it('compte une dépense comme versement, une seule fois', () => {
    const x = dep('a', '2026-10-05', 100, ['rembt']);
    const une = compterDepense(o(), x);
    assert.equal(une.versements.length, 1);
    assert.equal(une.versements[0].depense, 'a');
    assert.equal(une.versements[0].id, 'dep:a');
    assert.equal(compterDepense(une, x), une);
    assert.equal(acquisDe(une), 100);
  });
  it('sépare les dépenses déjà comptées de celles à compter, et rend la dépense si le versement est retiré', () => {
    const fin = f([dep('a', '2026-10-05', 100, ['rembt']), dep('b', '2026-10-08', 50, ['rembt'])]);
    const compte = compterDepense(o(), fin.depenses[0]);
    const l = depensesLiees(fin, compte);
    assert.deepEqual(l.aCompter.map((x) => x.id), ['b']);
    assert.deepEqual(l.comptees.map((x) => x.id), ['a']);
    assert.deepEqual(depensesLiees(fin, retirerVersement(compte, 'dep:a')).aCompter.map((x) => x.id), ['b', 'a']);
  });
});
