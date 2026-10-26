import type { Espace } from './types';

/**
 * Synchro entre appareils sans écrasement.
 *
 * Le serveur numérote chaque version de l'espace (`revision`) et refuse (409) une écriture faite sur une version périmée.
 * L'app fusionne alors, à trois voies :
 *   - base   : la dernière version confirmée par le serveur, d'où est parti cet appareil ;
 *   - local  : ce que cet appareil a maintenant ;
 *   - distant: ce que le serveur a maintenant (écrit par un autre appareil).
 * Ce qui n'a changé que d'un côté est repris tel quel ; ce qui a changé des deux côtés est fusionné, élément par élément.
 *
 * Ce fichier n'importe que des types : il se teste avec `npm test`, sans l'app.
 */

type Json = unknown;
type Objet = Record<string, Json>;

const estObjet = (v: Json): v is Objet => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Une clé à `undefined` compte comme absente : après un aller-retour JSON, elle aurait disparu. */
const defini = (o: Objet, k: string) => Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined;
const cles = (o: Objet) => Object.keys(o).filter((k) => o[k] !== undefined);

/** Égalité profonde, sans tenir compte de l'ordre des clés (la base JSON du serveur ne le garde pas). */
export function egal(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => egal(x, b[i]));
  if (estObjet(a) && estObjet(b)) {
    const ka = cles(a);
    return ka.length === cles(b).length && ka.every((k) => defini(b, k) && egal(a[k], b[k]));
  }
  return false;
}

const avecId = (t: Json[]) => t.every((x) => estObjet(x) && typeof x.id === 'string');
const primitifs = (t: Json[]) => t.every((x) => x === null || typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean');

/** Listes d'éléments à identifiant (relances, tâches, dépenses…) : fusionnées élément par élément. */
function fusionListeId(base: Objet[], local: Objet[], distant: Objet[]): Json[] {
  const index = (t: Objet[]) => new Map(t.map((x) => [x.id as string, x]));
  const b = index(base);
  const l = index(local);
  const r = index(distant);
  const ids = [...r.keys(), ...[...l.keys()].filter((id) => !r.has(id))];
  const sortie: Json[] = [];
  for (const id of ids) {
    const x = l.get(id);
    const y = r.get(id);
    const z = b.get(id);
    if (x && y) sortie.push(fusion3(z, x, y));
    // Absent d'un côté : si l'élément existait dans la base, il y a été supprimé ; on ne le garde que s'il a été modifié de l'autre côté.
    else if (x) {
      if (!z || !egal(z, x)) sortie.push(x);
    } else if (y) {
      if (!z || !egal(z, y)) sortie.push(y);
    }
  }
  return sortie;
}

/** Listes de valeurs simples (dates cochées, identifiants vus) : ajouts des deux côtés, retraits de l'un ou l'autre. */
function fusionListeSimple(base: Json[], local: Json[], distant: Json[]): Json[] {
  const b = new Set(base);
  const l = new Set(local);
  const r = new Set(distant);
  const retire = (v: Json) => b.has(v) && (!l.has(v) || !r.has(v));
  return [...new Set([...distant, ...local])].filter((v) => !retire(v));
}

/** Fusion à trois voies d'un document JSON. En cas de changement des deux côtés sur une même valeur simple, `local` gagne. */
export function fusion3(base: Json, local: Json, distant: Json): Json {
  if (egal(local, distant)) return local;
  if (egal(base, local)) return distant; // seul le serveur a changé
  if (egal(base, distant)) return local; // seul cet appareil a changé

  if (Array.isArray(local) && Array.isArray(distant)) {
    const b = Array.isArray(base) ? base : [];
    if (avecId(local) && avecId(distant) && avecId(b)) return fusionListeId(b as Objet[], local as Objet[], distant as Objet[]);
    if (primitifs(local) && primitifs(distant) && primitifs(b)) return fusionListeSimple(b, local, distant);
    return local;
  }

  if (estObjet(local) && estObjet(distant)) {
    const b = estObjet(base) ? base : {};
    const sortie: Objet = {};
    for (const k of new Set([...cles(local), ...cles(distant)])) {
      const dansL = defini(local, k);
      const dansD = defini(distant, k);
      const dansB = defini(b, k);
      if (dansL && dansD) sortie[k] = fusion3(b[k], local[k], distant[k]);
      else if (dansL) {
        if (!dansB || !egal(b[k], local[k])) sortie[k] = local[k];
      } else if (dansD) {
        if (!dansB || !egal(b[k], distant[k])) sortie[k] = distant[k];
      }
    }
    return sortie;
  }
  return local;
}

const sansMajLe = (e: Espace): Objet => {
  const c: Objet = { ...(e as unknown as Objet) };
  delete c.majLe;
  return c;
};
/** Même contenu, sans compter la date de dernière modification. */
export const memeContenu = (a: Espace, b: Espace) => egal(sansMajLe(a), sansMajLe(b));

/** Fusionne deux versions de l'espace. Sans base connue, rien n'est perdu : tout ce qui existe d'un côté ou de l'autre est gardé. */
export function fusionEspace(base: Espace | null | undefined, local: Espace, distant: Espace): Espace {
  const m = fusion3(base ?? undefined, local, distant) as Espace;
  return memeContenu(m, distant) ? distant : { ...m, majLe: new Date().toISOString() };
}

/** Ce que cet appareil sait de la synchro : la version du serveur qu'il a lue en dernier, et son contenu. `revision` est null avec un ancien serveur. */
export type EtatSync = { revision: number | null; base: Espace | null };
export type Distant = { data: Espace; majLe: string; revision?: number };
export type Rapprochement = { espace: Espace; etat: EtatSync; aPousser: boolean };

/**
 * À l'ouverture : que garder entre l'espace enregistré sur l'appareil et celui du serveur, et faut-il renvoyer quelque chose.
 * - serveur inchangé depuis la dernière synchro : on garde l'appareil (avec d'éventuelles modifications faites hors ligne) ;
 * - serveur plus avancé : fusion à trois voies ;
 * - aucun historique de synchro (première ouverture après la mise à jour) : l'ancienne règle, la version la plus récente gagne.
 */
export function rapprocher(distant: Distant | null, local: Espace | null, etat: EtatSync | null): Rapprochement {
  if (!distant) {
    if (!local) throw new Error('rapprocher : ni espace local ni espace du serveur');
    return { espace: local, etat: { revision: 0, base: null }, aPousser: true };
  }
  const revision = distant.revision ?? null;
  if (!local) return { espace: distant.data, etat: { revision, base: distant.data }, aPousser: false };

  if (revision !== null && etat?.base && etat.revision === revision) return { espace: local, etat, aPousser: !memeContenu(local, etat.base) };
  if (revision !== null && etat?.base) {
    const espace = fusionEspace(etat.base, local, distant.data);
    return { espace, etat: { revision, base: distant.data }, aPousser: !memeContenu(espace, distant.data) };
  }
  const espace = distant.data.majLe >= local.majLe ? distant.data : local;
  return { espace, etat: { revision, base: distant.data }, aPousser: !memeContenu(espace, distant.data) };
}

export type Appeler = <T>(chemin: string, options: { method: string; body: unknown }) => Promise<T>;
export type Poussee = {
  /** À mémoriser : la version du serveur après notre écriture. */
  etat: EtatSync;
  /** Renseigné quand un autre appareil avait écrit entre-temps : à appliquer à l'espace affiché. */
  fusion: { base: Espace | null; distant: Espace } | null;
};

const MAX_ESSAIS = 4;

/** Le serveur dit « conflit » (409) et joint sa version : on la récupère, sinon null. */
function conflit(err: unknown): { data: Espace; revision: number | null } | null {
  const e = err as { status?: number; code?: string; data?: { espace?: { data?: Espace; revision?: number } } } | null;
  if (e?.status !== 409 || e.code !== 'CONFLIT' || !e.data?.espace?.data) return null;
  return { data: e.data.espace.data, revision: e.data.espace.revision ?? null };
}

/**
 * Envoie l'espace au serveur. En cas de conflit, fusionne avec la version du serveur puis réessaie, au lieu d'écraser.
 * `courant` donne la dernière version de l'appareil, lue au moment de l'envoi.
 */
export async function pousserEspace(appeler: Appeler, etat: EtatSync, courant: () => Espace): Promise<Poussee> {
  const baseInitiale = etat.base;
  let local = courant();
  let base = etat.base;
  let revision = etat.revision;
  let dernierDistant: Espace | null = null;

  for (let essai = 0; essai < MAX_ESSAIS; essai++) {
    try {
      const r = await appeler<{ majLe: string; revision?: number }>('/espace', { method: 'PUT', body: { data: local, baseRevision: revision ?? undefined } });
      return { etat: { revision: r.revision ?? null, base: local }, fusion: dernierDistant ? { base: baseInitiale, distant: dernierDistant } : null };
    } catch (err) {
      const d = conflit(err);
      if (!d) throw err;
      local = fusionEspace(base, local, d.data);
      base = d.data;
      revision = d.revision;
      dernierDistant = d.data;
    }
  }
  throw new Error('Ton espace change sur plusieurs appareils en même temps : nouvel essai dans un instant.');
}
