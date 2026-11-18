import type { Mail } from './mails';

/** Une étiquette du compte : son nom et, chez Outlook, sa couleur. */
export type Etiquette = { nom: string; couleur?: string };

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Combien de fois chaque étiquette est posée dans les mails chargés : de quoi mettre les plus utilisées devant. */
export function usageEtiquettes(mails: Mail[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const mail of mails) for (const l of mail.libelles ?? []) m.set(l.toLowerCase(), (m.get(l.toLowerCase()) ?? 0) + 1);
  return m;
}

/**
 * Les étiquettes à proposer : celles qui ne sont pas déjà posées, gardées si elles contiennent ce qui est tapé
 * (accents et majuscules ignorés), les plus utilisées d'abord, puis par ordre alphabétique.
 */
export function etiquettesAProposer(dispo: Etiquette[], posees: string[], recherche = '', usage?: Map<string, number>): Etiquette[] {
  const q = sansAccents(recherche.trim());
  const deja = new Set(posees.map((p) => p.toLowerCase()));
  return dispo
    .filter((d) => !deja.has(d.nom.toLowerCase()) && (!q || sansAccents(d.nom).includes(q)))
    .sort((a, b) => (usage?.get(b.nom.toLowerCase()) ?? 0) - (usage?.get(a.nom.toLowerCase()) ?? 0) || a.nom.localeCompare(b.nom, 'fr'));
}

/** Ce qui est tapé est une étiquette à créer tant qu'aucune étiquette du compte ne porte déjà ce nom. */
export function etiquetteACreer(dispo: Etiquette[], posees: string[], recherche: string): string | null {
  const n = recherche.trim();
  if (!n) return null;
  const connue = [...dispo.map((d) => d.nom), ...posees].some((x) => x.toLowerCase() === n.toLowerCase());
  return connue ? null : n;
}

/** Les mails de la sélection, rangés par compte connecté : chaque service écrit ses étiquettes de son côté. */
export function parCompte(mails: Mail[]): Map<string, Mail[]> {
  const m = new Map<string, Mail[]>();
  for (const mail of mails) {
    const i = mail.id.startsWith('ext:') ? mail.id.indexOf(':', 4) : -1;
    if (i <= 0) continue;
    const compte = mail.id.slice(4, i);
    m.set(compte, [...(m.get(compte) ?? []), mail]);
  }
  return m;
}

/** Les étiquettes posées sur la sélection, avec le nombre de mails qui les portent : celles qu'on peut retirer. */
export function etiquettesDeLaSelection(mails: Mail[]): { nom: string; nombre: number }[] {
  const m = new Map<string, { nom: string; nombre: number }>();
  for (const mail of mails)
    for (const l of mail.libelles ?? []) {
      const cle = l.toLowerCase();
      const e = m.get(cle) ?? m.set(cle, { nom: l, nombre: 0 }).get(cle)!;
      e.nombre++;
    }
  return [...m.values()].sort((a, b) => b.nombre - a.nombre || a.nom.localeCompare(b.nom, 'fr'));
}
