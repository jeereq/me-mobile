import { rappelsDesElements } from './commun/calcul';
import { addDays, parse, today } from './dates';
import type { Config, Espace, Mode } from './types';

/** Les notifications du téléphone, calculées sans rien programmer (fichier sans Expo : il se teste avec `npm test`). */

/** Jours de notifications programmées à l'avance. */
const HORIZON_JOURS = 21;

export type Planned = { date: Date; title: string; body: string; mode: Mode };

const at = (day: string, time: string) => {
  const d = parse(day);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

/**
 * Calcule les rappels des prochaines semaines selon le mode de chaque élément et les règles de ce mode (voir `modes.ts`).
 * Les règles sont celles du serveur (`commun/calcul.ts`, `rappelsDesElements`) : le téléphone et les emails disent la même chose.
 */
export function calculerRappels(e: Espace, c: Config, now = new Date()): Planned[] {
  const t0 = today();
  const out: Planned[] = [];
  for (let i = 0; i < HORIZON_JOURS; i++) {
    const d = addDays(t0, i);
    for (const x of rappelsDesElements(e, c, d, t0)) out.push({ date: at(d, x.heure), title: x.titre, body: x.corps, mode: x.mode });
  }
  return out.filter((p) => p.date > now).sort((a, b) => a.date.getTime() - b.date.getTime());
}

