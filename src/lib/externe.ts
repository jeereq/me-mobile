/**
 * Les éléments venus d'un compte connecté portent un identifiant en trois morceaux : `ext:<compte>:<élément>`.
 * Ce module le lit et dit ce que Me peut faire avec, sans rien appeler : l'écran s'en sert pour
 * n'afficher « Répondre », « Modifier » ou « Cocher dans la source » que là où c'est possible.
 */

export type RefExterne = { compte: string; element: string };

/** Découpe `ext:<compte>:<élément>`. L'élément peut contenir des « : » (Google Tasks, To Do) : seul le premier compte. */
export function refExterne(id: string): RefExterne | null {
  if (!id?.startsWith('ext:')) return null;
  const reste = id.slice(4);
  const coupe = reste.indexOf(':');
  if (coupe <= 0 || coupe === reste.length - 1) return null;
  return { compte: reste.slice(0, coupe), element: reste.slice(coupe + 1) };
}

export const estExterne = (id: string) => !!refExterne(id);

/**
 * Une tâche importée d'une liste : `gtask:<liste>:<tâche>` (Google Tasks) ou `todo:<liste>:<tâche>` (Microsoft To Do).
 * C'est ce qui permet de la cocher à la source. Les tâches venues d'un mail suivi n'en sont pas.
 */
export function tacheDeListe(id: string): { compte: string; liste: string; tache: string } | null {
  const r = refExterne(id);
  if (!r) return null;
  const m = r.element.match(/^(?:gtask|todo):([^:]+):(.+)$/);
  return m ? { compte: r.compte, liste: m[1], tache: m[2] } : null;
}

/** L'identifiant d'un rendez-vous Google, qui s'écrit `<agenda>:<événement>`. Outlook n'a qu'un identifiant. */
export function evenementDeAgenda(id: string, agendaParDefaut?: string): { compte: string; agenda: string; evenement: string } | null {
  const r = refExterne(id);
  if (!r) return null;
  const coupe = r.element.indexOf(':');
  if (coupe > 0) return { compte: r.compte, agenda: r.element.slice(0, coupe), evenement: r.element.slice(coupe + 1) };
  if (!agendaParDefaut) return null;
  return { compte: r.compte, agenda: agendaParDefaut, evenement: r.element };
}
