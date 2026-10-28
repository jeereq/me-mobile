// Lancé par `npm test` (Node, sans l'app). Les imports en « .ts » ne sont pas compris par tsc : ce dossier est exclu de tsconfig.json.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { egal, fusion3, fusionEspace, memeContenu, pousserEspace, rapprocher, type Appeler, type EtatSync } from '../src/lib/fusion.ts';
import { appliquer, type Operation } from '../src/lib/commun/patch.ts';
import type { Espace } from '../src/lib/types.ts';

type Obj = Record<string, unknown>;
const T0 = '2026-10-26T08:00:00.000Z';
/** Un espace minimal ; `o` ajoute ou remplace des champs. */
const esp = (o: Obj = {}) => ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], majLe: T0, ...o }) as unknown as Espace;
const tache = (id: string, o: Obj = {}) => ({ id, titre: `Tâche ${id}`, statut: 'a_faire', mode: 'normal', echeance: null, ...o });
const ids = (e: Espace) => (e.taches as unknown as { id: string }[]).map((t) => t.id).sort();
const copie = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
/** Comme jsonb : mêmes données, clés dans un autre ordre. */
const melanger = (x: unknown): unknown => (Array.isArray(x) ? x.map(melanger) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).reverse().map(([k, v]) => [k, melanger(v)])) : x);

describe('egal', () => {
  it('ignore l’ordre des clés et les clés à undefined', () => {
    assert.equal(egal({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 }), true);
    assert.equal(egal({ a: 1, b: undefined }, { a: 1 }), true);
    assert.equal(egal([1, 2], [2, 1]), false);
    assert.equal(egal({ a: 1 }, { a: 2 }), false);
    assert.equal(egal(null, {}), false);
  });
});

describe('fusion3 : listes d’éléments à identifiant', () => {
  const base = esp({ taches: [tache('a')] });

  it('garde les ajouts faits sur les deux appareils', () => {
    const local = esp({ taches: [tache('a'), tache('l')] });
    const distant = esp({ taches: [tache('a'), tache('d')] });
    assert.deepEqual(ids(fusionEspace(base, local, distant)), ['a', 'd', 'l']);
  });

  it('supprime ce qu’un appareil a supprimé si l’autre n’y a pas touché', () => {
    const supprimeIci = fusionEspace(base, esp({ taches: [] }), esp({ taches: [tache('a'), tache('d')] }));
    assert.deepEqual(ids(supprimeIci), ['d']);
    const supprimeLa = fusionEspace(base, esp({ taches: [tache('a'), tache('l')] }), esp({ taches: [] }));
    assert.deepEqual(ids(supprimeLa), ['l']);
  });

  it('garde un élément supprimé d’un côté mais modifié de l’autre', () => {
    const r = fusionEspace(base, esp({ taches: [] }), esp({ taches: [tache('a', { titre: 'Modifiée ailleurs' })] }));
    assert.deepEqual(r.taches, [tache('a', { titre: 'Modifiée ailleurs' })]);
  });

  it('combine des changements de champs différents sur le même élément', () => {
    const r = fusionEspace(base, esp({ taches: [tache('a', { statut: 'fait' })] }), esp({ taches: [tache('a', { titre: 'Nouveau titre' })] }));
    assert.deepEqual(r.taches, [tache('a', { statut: 'fait', titre: 'Nouveau titre' })]);
  });

  it('sur un même champ modifié des deux côtés, cet appareil gagne', () => {
    const r = fusionEspace(base, esp({ taches: [tache('a', { titre: 'Ici' })] }), esp({ taches: [tache('a', { titre: 'Là' })] }));
    assert.equal((r.taches[0] as unknown as { titre: string }).titre, 'Ici');
  });
});

describe('fusion3 : valeurs simples et dictionnaires', () => {
  it('fusionne les dates cochées : ajouts des deux côtés, décochage respecté', () => {
    const h = (coches: string[]) => esp({ habitudes: [{ id: 'h1', nom: 'Sport', coches }] });
    const r = fusionEspace(h(['2026-10-24', '2026-10-25']), h(['2026-10-25', '2026-10-26']), h(['2026-10-24', '2026-10-25', '2026-10-27']));
    assert.deepEqual((r.habitudes[0] as unknown as { coches: string[] }).coches.sort(), ['2026-10-25', '2026-10-26', '2026-10-27']);
  });

  it('fusionne un dictionnaire clé par clé (journal, gains de points)', () => {
    const base = esp({ journal: { '2026-10-24': { texte: 'a' } }, jeu: { gains: { g1: { d: '2026-10-24', p: 10 } } } });
    const local = esp({ journal: { '2026-10-24': { texte: 'a' }, '2026-10-25': { texte: 'ici' } }, jeu: { gains: { g1: { d: '2026-10-24', p: 10 }, g2: { d: '2026-10-25', p: 15 } } } });
    const distant = esp({ journal: { '2026-10-24': { texte: 'a' }, '2026-10-26': { texte: 'là' } }, jeu: { gains: { g1: { d: '2026-10-24', p: 10 }, g3: { d: '2026-10-26', p: 20 } } } });
    const r = fusionEspace(base, local, distant) as unknown as { journal: Obj; jeu: { gains: Obj } };
    assert.deepEqual(Object.keys(r.journal).sort(), ['2026-10-24', '2026-10-25', '2026-10-26']);
    assert.deepEqual(Object.keys(r.jeu.gains).sort(), ['g1', 'g2', 'g3']);
  });

  it('un gain décoché ici disparaît, même si le serveur a avancé ailleurs', () => {
    const base = esp({ jeu: { gains: { g1: { d: 'x', p: 10 }, g2: { d: 'y', p: 5 } } } });
    const r = fusionEspace(base, esp({ jeu: { gains: { g2: { d: 'y', p: 5 } } } }), esp({ jeu: { gains: { g1: { d: 'x', p: 10 }, g2: { d: 'y', p: 5 }, g3: { d: 'z', p: 1 } } }, notifs: { app: false } })) as unknown as { jeu: { gains: Obj } };
    assert.deepEqual(Object.keys(r.jeu.gains).sort(), ['g2', 'g3']);
  });
});

describe('fusionEspace', () => {
  it('rend la version du serveur telle quelle quand seul le serveur a changé', () => {
    const base = esp({ taches: [tache('a')] });
    const distant = esp({ taches: [tache('a'), tache('d')], majLe: '2026-10-26T09:00:00.000Z' });
    assert.equal(fusionEspace(base, copie(base), distant), distant);
  });

  it('garde les changements de cet appareil quand le serveur n’a pas bougé, et met à jour majLe', () => {
    const base = esp({ taches: [tache('a')] });
    const local = esp({ taches: [tache('a'), tache('l')] });
    const r = fusionEspace(base, local, copie(base));
    assert.deepEqual(ids(r), ['a', 'l']);
    assert.notEqual(r.majLe, T0);
  });

  it('ne voit pas de changement quand le serveur renvoie les mêmes données dans un autre ordre', () => {
    const base = esp({ taches: [tache('a')], apparence: { theme: 'clair', accent: '#fff' } });
    const r = fusionEspace(base, esp({ taches: [tache('a'), tache('l')], apparence: { theme: 'clair', accent: '#fff' } }), melanger(copie(base)) as Espace);
    assert.deepEqual(ids(r), ['a', 'l']);
  });

  it('sans base connue, ne perd rien (union des deux côtés)', () => {
    const r = fusionEspace(null, esp({ taches: [tache('l')] }), esp({ taches: [tache('d')] }));
    assert.deepEqual(ids(r), ['d', 'l']);
  });
});

describe('rapprocher (ouverture de l’app)', () => {
  const serveur = (e: Espace, revision: number) => ({ data: e, majLe: e.majLe, revision });
  const base = esp({ taches: [tache('a')] });

  it('serveur vide : envoie l’espace de l’appareil, avec la révision 0', () => {
    const r = rapprocher(null, base, null);
    assert.deepEqual([r.aPousser, r.etat.revision], [true, 0]);
  });

  it('appareil neuf : reprend le serveur, rien à envoyer', () => {
    const r = rapprocher(serveur(base, 4), null, null);
    assert.equal(r.espace, base);
    assert.deepEqual([r.aPousser, r.etat.revision], [false, 4]);
  });

  it('serveur inchangé : garde l’appareil et envoie ses changements faits hors ligne', () => {
    const etat: EtatSync = { revision: 4, base };
    const horsLigne = esp({ taches: [tache('a'), tache('l')] });
    const r = rapprocher(serveur(base, 4), horsLigne, etat);
    assert.equal(r.espace, horsLigne);
    assert.equal(r.aPousser, true);
    assert.equal(rapprocher(serveur(base, 4), copie(base), etat).aPousser, false);
  });

  it('serveur plus avancé : fusionne, et n’envoie que s’il reste des changements locaux', () => {
    const etat: EtatSync = { revision: 4, base };
    const distant = esp({ taches: [tache('a'), tache('d')] });
    const sansChangement = rapprocher(serveur(distant, 5), copie(base), etat);
    assert.deepEqual([ids(sansChangement.espace), sansChangement.aPousser, sansChangement.etat.revision], [['a', 'd'], false, 5]);
    const avecChangement = rapprocher(serveur(distant, 5), esp({ taches: [tache('a'), tache('l')] }), etat);
    assert.deepEqual([ids(avecChangement.espace), avecChangement.aPousser], [['a', 'd', 'l'], true]);
  });

  it('sans historique de synchro (mise à jour de l’app) : la version la plus récente gagne, comme avant', () => {
    const recent = esp({ taches: [tache('r')], majLe: '2026-10-26T10:00:00.000Z' });
    assert.equal(rapprocher(serveur(recent, 2), esp({ taches: [tache('o')], majLe: T0 }), null).espace, recent);
    const local = esp({ taches: [tache('o')], majLe: '2026-10-26T11:00:00.000Z' });
    const r = rapprocher(serveur(recent, 2), local, null);
    assert.deepEqual([r.espace, r.aPousser], [local, true]);
  });

  it('avec un ancien serveur sans revision, retombe sur l’ancienne règle', () => {
    const r = rapprocher({ data: base, majLe: base.majLe }, esp({ majLe: '2026-10-26T12:00:00.000Z' }), { revision: 3, base });
    assert.equal(r.etat.revision, null);
  });
});

/** Un faux serveur qui applique la règle de l'API : écriture refusée en 409 si baseRevision n'est plus la version courante. */
function fauxServeur(initial: Espace) {
  let data: Espace = copie(initial);
  let revision = 1;
  let ecritures = 0;
  const requetes: { method: string; body: unknown }[] = [];
  // Comme me-api : PUT enregistre tout, PATCH rejoue les différences sur la version du serveur (`commun/patch.ts`).
  const appeler: Appeler = async (_chemin, o) => {
    requetes.push(copie(o));
    const { data: d, baseRevision, operations } = o.body as { data: Espace; baseRevision?: number; operations?: Operation[] };
    if (baseRevision !== undefined && baseRevision !== revision) throw Object.assign(new Error('conflit'), { status: 409, code: 'CONFLIT', data: { espace: { data: melanger(copie(data)), majLe: data.majLe, revision } } });
    const nouveau = o.method === 'PATCH' ? (appliquer(data, copie(operations!)) as Espace) : copie(d);
    data = melanger({ ...nouveau, majLe: new Date().toISOString() }) as Espace;
    revision++;
    ecritures++;
    return { majLe: data.majLe, revision } as never;
  };
  return { appeler, lire: () => ({ data: copie(data), revision }), ecritures: () => ecritures, requetes };
}

describe('pousserEspace : deux appareils contre le même serveur', () => {
  const depart = esp({ taches: [tache('a')] });

  it('écriture sans conflit : une seule requête, révision mémorisée', async () => {
    const s = fauxServeur(depart);
    const r = await pousserEspace(s.appeler, { revision: 1, base: depart }, () => esp({ taches: [tache('a'), tache('l')] }));
    assert.deepEqual([r.etat.revision, r.fusion, s.ecritures()], [2, null, 1]);
  });

  it('deux appareils éditent hors ligne : aucun ne perd ses changements', async () => {
    const s = fauxServeur(depart);
    const etatA: EtatSync = { revision: 1, base: depart };
    const etatB: EtatSync = { revision: 1, base: depart };
    const A = esp({ taches: [tache('a'), tache('deA')] });
    const B = esp({ taches: [tache('a'), tache('deB')], relances: [{ id: 'r1', contact: 'Marie', statut: 'a_faire' }] });

    const pa = await pousserEspace(s.appeler, etatA, () => A); // A passe en premier
    assert.equal(pa.fusion, null);
    const pb = await pousserEspace(s.appeler, etatB, () => B); // B est périmé : conflit, fusion, nouvel envoi

    assert.ok(pb.fusion, 'B doit avoir fusionné');
    const final = s.lire();
    assert.deepEqual(ids(final.data), ['a', 'deA', 'deB']);
    assert.equal((final.data.relances as unknown[]).length, 1);
    // B affiche aussi ce que A avait ajouté.
    assert.deepEqual(ids(fusionEspace(pb.fusion!.base, B, pb.fusion!.distant)), ['a', 'deA', 'deB']);
    // Et le serveur est à la version suivante de B.
    assert.equal(pb.etat.revision, final.revision);
  });

  it('A réessaie ensuite : à jour, il n’y a plus de conflit', async () => {
    const s = fauxServeur(depart);
    const A = esp({ taches: [tache('a'), tache('deA')] });
    const pa = await pousserEspace(s.appeler, { revision: 1, base: depart }, () => A);
    const B = esp({ taches: [tache('a'), tache('deB')] });
    const pb = await pousserEspace(s.appeler, { revision: 1, base: depart }, () => B);
    const A2 = esp({ taches: [...(fusionEspace(pb.fusion!.base, A, pb.fusion!.distant).taches as never[]), tache('deA2')] });
    const pa2 = await pousserEspace(s.appeler, { revision: pa.etat.revision, base: pa.etat.base }, () => A2);
    assert.ok(pa2.fusion, 'A est périmé après l’écriture de B');
    assert.deepEqual(ids(s.lire().data), ['a', 'deA', 'deA2', 'deB']);
  });

  it('plusieurs conflits d’affilée sont résolus, sans boucle infinie', async () => {
    const s = fauxServeur(depart);
    let n = 0;
    // Un autre appareil écrit juste avant chacun des deux premiers envois de B.
    const appeler: Appeler = async (c, o) => {
      if (n < 2) {
        n++;
        const cur = s.lire();
        await s.appeler(c, { method: 'PUT', body: { data: { ...cur.data, taches: [...(cur.data.taches as never[]), tache(`autre${n}`)] }, baseRevision: cur.revision } });
      }
      return s.appeler(c, o);
    };
    await pousserEspace(appeler, { revision: 1, base: depart }, () => esp({ taches: [tache('a'), tache('moi')] }));
    assert.deepEqual(ids(s.lire().data), ['a', 'autre1', 'autre2', 'moi']);
  });

  it('abandonne proprement si le serveur reste en conflit, et relaie les autres erreurs', async () => {
    const conflitSansFin: Appeler = async () => {
      throw Object.assign(new Error('c'), { status: 409, code: 'CONFLIT', data: { espace: { data: depart, revision: 9 } } });
    };
    const change = esp({ taches: [tache('a'), tache('l')] });
    await assert.rejects(() => pousserEspace(conflitSansFin, { revision: 1, base: depart }, () => change), /plusieurs appareils/);
    const reseau: Appeler = async () => {
      throw Object.assign(new Error('Serveur injoignable'), { status: 0 });
    };
    await assert.rejects(() => pousserEspace(reseau, { revision: 1, base: depart }, () => change), /injoignable/);
  });

  it('avec un ancien serveur (sans revision), n’envoie pas baseRevision et ne plante pas', async () => {
    let corps: Obj = {};
    const ancien: Appeler = async (_c, o) => {
      corps = o.body as Obj;
      return { majLe: T0 } as never;
    };
    const r = await pousserEspace(ancien, { revision: null, base: null }, () => depart);
    assert.equal('baseRevision' in JSON.parse(JSON.stringify(corps)), false);
    assert.equal(r.etat.revision, null);
  });

  it('n’envoie que les différences quand le serveur connaît la version de départ', async () => {
    const grand = esp({ taches: Array.from({ length: 300 }, (_, i) => tache(`t${i}`, { titre: 'x'.repeat(200) })) });
    const s = fauxServeur(grand);
    const local = esp({ taches: [...(grand.taches as never[]), tache('nouvelle')] });
    const r = await pousserEspace(s.appeler, { revision: 1, base: grand }, () => local);
    const [req] = s.requetes;
    assert.equal(req.method, 'PATCH');
    assert.ok(JSON.stringify(req.body).length < 500, 'seule la nouvelle tâche part');
    assert.equal(r.etat.revision, 2);
    assert.deepEqual(ids(s.lire().data), ids(local));
  });

  it('conflit pendant un envoi de différences : fusion, puis différences avec la version du serveur', async () => {
    const s = fauxServeur(depart);
    await pousserEspace(s.appeler, { revision: 1, base: depart }, () => esp({ taches: [tache('a'), tache('deA')] }));
    const pb = await pousserEspace(s.appeler, { revision: 1, base: depart }, () => esp({ taches: [tache('a'), tache('deB')] }));
    assert.ok(pb.fusion);
    assert.deepEqual(s.requetes.map((q) => q.method), ['PATCH', 'PATCH', 'PATCH']);
    assert.deepEqual(ids(s.lire().data), ['a', 'deA', 'deB']);
  });

  it('serveur sans PATCH ou différences refusées : renvoie l’espace en entier', async () => {
    for (const status of [404, 422]) {
      const s = fauxServeur(depart);
      const appeler: Appeler = async (c, o) => {
        if (o.method === 'PATCH') throw Object.assign(new Error('non'), { status });
        return s.appeler(c, o);
      };
      const local = esp({ taches: [tache('a'), tache('l')] });
      const r = await pousserEspace(appeler, { revision: 1, base: depart }, () => local);
      assert.equal(r.etat.revision, 2);
      assert.deepEqual(s.requetes.map((q) => q.method), ['PUT']);
      assert.deepEqual(ids(s.lire().data), ['a', 'l']);
    }
  });

  it('rien de changé : aucune requête', async () => {
    const s = fauxServeur(depart);
    const r = await pousserEspace(s.appeler, { revision: 1, base: depart }, () => copie(depart));
    assert.deepEqual([s.requetes.length, r.etat.revision], [0, 1]);
  });

  it('memeContenu ignore majLe', () => {
    assert.equal(memeContenu(esp({ majLe: 'a' }), esp({ majLe: 'b' })), true);
    assert.equal(fusion3(1, 2, 3), 2);
  });
});
