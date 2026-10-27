import type { Frequence, Habitude } from './types';

export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => ymd(new Date());
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const hm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fmtCourt = (s?: string | null) =>
  s ? parse(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
export const fmtLong = (d = new Date()) =>
  d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function weekKey(s: string) {
  const d = parse(s);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - y0.getTime()) / 864e5 + 1) / 7)}`;
}
export const periodKey = (f: Frequence, s: string) => (f === 'mensuel' ? s.slice(0, 7) : f === 'hebdo' ? weekKey(s) : s);
const prevPeriod = (f: Frequence, s: string) => {
  const d = parse(s);
  if (f === 'mensuel') d.setMonth(d.getMonth() - 1, 1);
  else d.setDate(d.getDate() - (f === 'hebdo' ? 7 : 1));
  return ymd(d);
};

export function habitDue(h: Habitude, s: string) {
  if (h.frequence === 'hebdo') return parse(s).getDay() === (h.jour ?? 1);
  if (h.frequence === 'mensuel') {
    const d = parse(s);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return d.getDate() === Math.min(h.jour || 1, last);
  }
  return true;
}
export function pastDue(h: Habitude, s: string) {
  if (h.frequence === 'mensuel') return parse(s).getDate() > (h.jour || 1);
  if (h.frequence === 'hebdo') {
    const d = parse(s).getDay() || 7;
    const j = (h.jour ?? 1) || 7;
    return d > j;
  }
  return false;
}
export const doneIn = (h: Habitude, s: string) => h.coches.some((c) => periodKey(h.frequence, c) === periodKey(h.frequence, s));
export function streak(h: Habitude, s: string) {
  let n = 0;
  let cur = doneIn(h, s) ? s : prevPeriod(h.frequence, s);
  while (doneIn(h, cur) && n < 400) {
    n++;
    cur = prevPeriod(h.frequence, cur);
  }
  return n;
}
/** Habitudes à afficher aujourd'hui : prévues ce jour, ou en retard en mode agressif. */
export const habitToday = (h: Habitude, s: string) =>
  habitDue(h, s) || (!doneIn(h, s) && h.frequence !== 'quotidien' && h.mode === 'agressif' && pastDue(h, s));
export const habitWhen = (h: Habitude) =>
  h.frequence === 'hebdo' ? `Chaque ${JOURS[h.jour ?? 1]}` : h.frequence === 'mensuel' ? `Le ${h.jour || 1} du mois` : 'Chaque jour';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Les cases d'un mois de calendrier (« AAAA-MM »), semaine commençant le lundi : null pour les cases vides avant le 1er et après le dernier jour. */
export function grilleMois(mois: string) {
  const [a, m] = mois.split('-').map(Number);
  const vides = (new Date(a, m - 1, 1).getDay() + 6) % 7;
  const n = new Date(a, m, 0).getDate();
  const cases: (string | null)[] = [...Array(vides).fill(null), ...Array.from({ length: n }, (_, i) => `${a}-${pad(m)}-${pad(i + 1)}`)];
  while (cases.length % 7) cases.push(null);
  return cases;
}
/** Le mois d'avant ou d'après (« AAAA-MM »). */
export const decalerMois = (mois: string, n: number) => {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
