import type { Evenement } from './types';

/**
 * Mon agenda personnel (comptes Google et Microsoft connectés), montré dans l'espace d'une équipe sans y être écrit :
 * l'espace d'une équipe est partagé avec tous ses membres, mes rendez-vous n'y entrent donc jamais. Ils restent dans
 * l'app, pour moi seul, et se relisent à chaque synchronisation. Module pur : il ne dépend que des types.
 */

type Importe = { id: string; date: string; debut: string; fin?: string; titre: string; lieu?: string; source: string; ctx?: Evenement['calendrier']; lien?: string; agenda?: string };
export type Agenda = Record<string, Evenement[]>;

const parHeure = (a: Evenement, b: Evenement) => a.debut.localeCompare(b.debut) || a.titre.localeCompare(b.titre, 'fr');

/** Les rendez-vous importés, par jour, confiés à moi : ils sortent donc avec « Moi » dans le filtre par membre, pas avec les autres. */
export function agendaPerso(importes: Importe[] | undefined, moiId?: string): Agenda {
  const out: Agenda = {};
  for (const x of importes ?? []) (out[x.date] ||= []).push({ id: x.id, debut: x.debut, ...(x.fin ? { fin: x.fin } : {}), titre: x.titre, ...(x.lieu ? { lieu: x.lieu } : {}), source: x.source, ...(x.ctx ? { calendrier: x.ctx } : {}), ...(x.lien ? { lien: x.lien } : {}), ...(x.agenda ? { agenda: x.agenda } : {}), ...(moiId ? { affecteA: moiId } : {}) });
  for (const l of Object.values(out)) l.sort(parHeure);
  return out;
}

/** L'agenda de l'équipe avec le mien par-dessus, pour l'affichage. Aucun des deux n'est modifié ; un même identifiant n'apparaît qu'une fois. */
export function avecAgendaPerso(equipe: Agenda | undefined, perso: Agenda): Agenda {
  const jours = Object.keys(perso);
  if (!jours.length) return equipe ?? {};
  const out: Agenda = { ...(equipe ?? {}) };
  for (const j of jours) {
    const deja = new Set((out[j] ?? []).map((x) => x.id).filter(Boolean));
    out[j] = [...(out[j] ?? []), ...perso[j].filter((x) => !x.id || !deja.has(x.id))].sort(parHeure);
  }
  return out;
}

/** Un rendez-vous venu de mon agenda personnel (et non de l'équipe) : lecture seule dans l'équipe, visible par moi seul. */
export const estAgendaPerso = (id?: string) => !!id && id.startsWith('ext:');
