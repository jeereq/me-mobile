import { useState } from 'react';

import { addDays, parse, today } from '@/lib/dates';
import { bilan, bornes, depensesEntre, fmtMontant } from '@/lib/finances';
import { budgetJournalier } from '@/lib/previsions';
import { titreJour } from '@/lib/stats-finances';
import type { Finances, Periode } from '@/lib/types';

import { Barres } from './graphiques';
import { Btn, Panel, T } from './ui';

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Le budget d'une journée : le budget fixé par jour, ou celui de la période ramené à un jour. */
export const budgetDuJour = (f: Finances, d: string) => bilan(f, 'jour', d, d).plafondTotal;

/**
 * Dépenses jour par jour sur la semaine ou le mois affiché, face au budget du jour (ligne pointillée) :
 * jours au-dessus, jours sans dépense, moyenne. Toucher une barre puis « Voir » ouvre les dépenses de ce jour.
 */
export function JourParJour({ f, vue, jourRef, voirJour }: { f: Finances; vue: Periode; jourRef: string; voirJour: (date: string) => void }) {
  const d = today();
  const { debut, fin } = bornes(vue, jourRef);
  const dates: string[] = [];
  for (let x = debut; x <= fin; x = addDays(x, 1)) dates.push(x);
  const parJour = new Map<string, number>();
  for (const x of depensesEntre(f, debut, fin)) parJour.set(x.date, (parJour.get(x.date) || 0) + x.montant);
  const seuil = budgetDuJour(f, d);
  const journalier = budgetJournalier(f);

  const passes = dates.filter((x) => x <= d);
  const v = (x: string) => arrondi(parJour.get(x) || 0);
  const indexDefaut = Math.max(0, dates.indexOf(d) >= 0 ? dates.indexOf(d) : passes.length ? passes.length - 1 : dates.length - 1);
  const [choisi, setChoisi] = useState(indexDefaut);
  const jour = dates[Math.min(choisi, dates.length - 1)];

  const total = arrondi(passes.reduce((s, x) => s + v(x), 0));
  const auDessus = seuil ? passes.filter((x) => v(x) > seuil).length : 0;
  const sans = passes.filter((x) => !v(x)).length;
  const pl = (n: number) => (n > 1 ? 's' : '');
  const nomJour = (x: string) => {
    const t = titreJour(x, d);
    return /^(Aujourd'hui|Hier)$/.test(t) ? t.toLowerCase() : `le ${t[0].toLowerCase()}${t.slice(1)}`;
  };

  if (!passes.length) return null;
  return (
    <Panel title="Jour par jour">
      <Barres
        points={dates.map((x) => ({
          cle: x,
          axe: vue === 'semaine' ? `${'LMMJVSD'[(parse(x).getDay() + 6) % 7]} ${parse(x).getDate()}` : String(parse(x).getDate()),
          v: v(x),
          detail: x > d ? `${titreJour(x, d)} : à venir` : `${titreJour(x, d)} : ${fmtMontant(v(x), f.devise)}${seuil ? ` sur ${fmtMontant(seuil, f.devise)}` : ''}`,
        }))}
        seuil={seuil || undefined}
        choisi={choisi}
        onChoisir={setChoisi}
      />
      <T small muted>
        {seuil
          ? `Budget du jour : ${fmtMontant(seuil, f.devise)}${journalier ? '' : ' (le budget de la période réparti par jour)'}. ${auDessus ? `${auDessus} jour${pl(auDessus)} au-dessus` : 'Aucun jour au-dessus'} sur ${passes.length}.`
          : 'Fixe un budget pour voir les jours au-dessus.'}{' '}
        {`En moyenne ${fmtMontant(arrondi(total / passes.length), f.devise)} par jour, ${sans ? `${sans} jour${pl(sans)}` : 'aucun jour'} sans dépense.`}
      </T>
      {jour <= d ? <Btn small kind="sec" label={`Voir les dépenses ${jour === d || jour === addDays(d, -1) ? "d'" : 'du '}${nomJour(jour).replace(/^le /, '')}`} onPress={() => voirJour(jour)} /> : null}
    </Panel>
  );
}
