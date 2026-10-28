import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { missionDuJour as missionCommune, rappelsDesElements } from '../src/lib/commun/calcul.ts';
import * as jours from '../src/lib/commun/jours.ts';
import { tachesActives as activesCommunes } from '../src/lib/commun/projets.ts';
import * as dates from '../src/lib/dates.ts';
import { DEFAULT_CONFIG } from '../src/lib/defaults.ts';
import { missionDuJour } from '../src/lib/mission.ts';
import { tachesActives } from '../src/lib/planning.ts';
import { calculerRappels } from '../src/lib/rappels-telephone.ts';
import type { Espace, Habitude, Relance, Tache } from '../src/lib/types.ts';

/**
 * Tests de contrat : l'app garde ses propres versions de certaines règles (planning des projets, mission du jour, dates
 * en heure locale), le serveur utilise celles de `src/lib/commun/` (copiées de me-api). Sur des espaces tirés au hasard,
 * les deux doivent dire la même chose : un écart fait échouer la CI au lieu de passer inaperçu.
 */

const MODES = ['passif', 'normal', 'agressif', 'coach', 'hebdo'] as const;
const T0 = '2026-11-02';

function tirage(graine: number) {
  let g = graine;
  const h = () => ((g = (g * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const choix = <T>(t: readonly T[]) => t[Math.floor(h() * t.length)];
  const jour = () => dates.addDays(T0, Math.floor(h() * 30) - 8);
  return { h, choix, jour };
}

function espaceAuHasard(graine: number): Espace {
  const { h, choix, jour } = tirage(graine);
  const projets = h() < 0.6 ? [{ id: 'p', nom: 'P', emoji: '📁', debut: dates.addDays(T0, -5), joursOuvres: h() < 0.5, creeLe: '' }, ...(h() < 0.3 ? [{ id: 'q', nom: 'Q', emoji: '📁', debut: null, joursOuvres: true, creeLe: '' }] : [])] : [];
  const taches: Tache[] = Array.from({ length: Math.floor(h() * 9) }, (_, i) => ({
    id: `t${i}`,
    titre: `T${i}`,
    source: 'manuel',
    priorite: choix(['basse', 'moyenne', 'haute'] as const),
    echeance: h() < 0.8 ? jour() : null,
    statut: h() < 0.2 ? 'fait' : 'en_attente',
    faitLe: h() < 0.2 ? T0 : null,
    mode: choix(MODES),
    creeLe: '',
    ordre: i,
    ...(projets.length && h() < 0.7
      ? { projet: choix(projets).id, duree: Math.floor(h() * 3), ...(i && h() < 0.4 ? { apres: [`t${Math.floor(h() * i)}`] } : {}), ...(i && h() < 0.3 ? { parent: `t${Math.floor(h() * i)}` } : {}) }
      : {}),
  }) as Tache);
  const relances = Array.from({ length: Math.floor(h() * 4) }, (_, i) => ({ id: `r${i}`, contact: `C${i}`, sujet: 's', date: jour(), statut: choix(['a_faire', 'relance', 'repondu'] as const), reponduLe: h() < 0.5 ? T0 : null, derniereRelance: h() < 0.5 ? T0 : undefined, mode: choix(MODES) })) as Relance[];
  const habitudes = Array.from({ length: Math.floor(h() * 4) }, (_, i) => ({ id: `h${i}`, nom: `H${i}`, categorie: 'perso', frequence: choix(['quotidien', 'hebdo', 'mensuel'] as const), jour: Math.floor(h() * 28), mode: choix(MODES), coches: h() < 0.5 ? [dates.addDays(T0, -Math.floor(h() * 10))] : [], ordre: i })) as Habitude[];
  return { relances, taches, habitudes, projets } as unknown as Espace;
}

const ids = (t: { id: string }[]) => t.map((x) => x.id);

describe('contrat app ↔ code commun', () => {
  it('tâches de projet actives : même règle que le planning de l’app', () => {
    for (let i = 0; i < 1500; i++) {
      const e = espaceAuHasard(i + 1);
      assert.deepEqual(ids(activesCommunes(e)), ids(tachesActives(e, T0)), JSON.stringify(e.taches));
    }
  });

  it('mission du jour : mêmes éléments, mêmes points, même état', () => {
    const resume = (t: { titre: string; fait: boolean; points: number }[]) => t.map((x) => `${x.titre}|${x.fait}|${x.points}`).sort();
    for (let i = 0; i < 1500; i++) {
      const e = espaceAuHasard(i + 1);
      assert.deepEqual(resume(missionCommune(e, T0)), resume(missionDuJour(e, T0)), JSON.stringify(e));
    }
  });

  it('jours : décalage, période, habitude prévue, en retard et cochée comme dates.ts', () => {
    const { choix } = tirage(3);
    for (let i = -400; i < 400; i++) {
      const d = dates.addDays(T0, i);
      assert.equal(jours.addDays(T0, i), d);
      for (const frequence of ['quotidien', 'hebdo', 'mensuel'] as const) {
        const h = { frequence, jour: i % 32 < 0 ? 0 : i % 32, mode: choix(MODES), coches: [dates.addDays(d, -(i % 9 < 0 ? 0 : i % 9))] } as unknown as Habitude;
        assert.equal(jours.periodKey(frequence, d), dates.periodKey(frequence, d));
        assert.equal(jours.habitDue(h, d), dates.habitDue(h, d));
        assert.equal(jours.pastDue(h, d), dates.pastDue(h, d));
        assert.equal(jours.doneIn(h, d), dates.doneIn(h, d));
        assert.equal(jours.habitToday(h, d), dates.habitToday(h, d));
      }
    }
  });
});

describe('notifications du téléphone', () => {
  it('reprennent les rappels du code commun, jour après jour, à l’heure locale', () => {
    const today = dates.today();
    const e = { relances: [{ id: 'r', contact: 'Marie', sujet: 'Devis', date: dates.addDays(today, 2), statut: 'a_faire', mode: 'normal' }], taches: [], habitudes: [], projets: [] } as unknown as Espace;
    const attendus = rappelsDesElements(e, DEFAULT_CONFIG, dates.addDays(today, 2), today);
    const vus = calculerRappels(e, DEFAULT_CONFIG, new Date(0)).filter((p) => dates.ymd(p.date) === dates.addDays(today, 2));
    assert.deepEqual(vus.map((p) => p.title), attendus.map((x) => x.titre));
    assert.deepEqual(vus.map((p) => `${String(p.date.getHours()).padStart(2, '0')}:${String(p.date.getMinutes()).padStart(2, '0')}`), attendus.map((x) => x.heure));
  });
});
