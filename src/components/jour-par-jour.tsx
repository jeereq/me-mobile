import { useState } from 'react';

import { addDays, parse, today } from '@/lib/dates';
import { bornes, budgetDuJour, depensesEntre, fmtMontant } from '@/lib/finances';
import { budgetJournalier } from '@/lib/previsions';
import { titreJour } from '@/lib/stats-finances';
import type { Finances, Periode } from '@/lib/types';

import { Barres } from './graphiques';
import { Btn, Panel, T } from './ui';

const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Dépenses jour par jour sur la semaine ou le mois affiché, face au budget d'aujourd'hui (ligne pointillée) ;
 * chaque jour passé est comparé à son propre budget du jour (voir `budgetDuJour`) :
 * jours au-dessus, jours sans dépense, moyenne. Toucher une barre puis « Voir » ouvre les dépenses de ce jour.
 */
export function JourParJour({ f, vue, jourRef, voirJour }: { f: Finances; vue: Periode; jourRef: string; voirJour: (date: string) => void }) {
  const d = today();
  const { debut, fin } = bornes(vue, jourRef);
  const dates: string[] = [];
  for (let x = debut; x <= fin; x = addDays(x, 1)) dates.push(x);
  const parJour = new Map<string, number>();
  for (const x of depensesEntre(f, debut, fin)) parJour.set(x.date, (parJour.get(x.date) || 0) + x.montant);
  // La ligne : le budget d'aujourd'hui, si la période l'affiche ; chaque barre a le sien dans son détail.
  const seuil = d >= debut && d <= fin ? budgetDuJour(f, d) : 0;
  const budgets = new Map(dates.filter((x) => x <= d).map((x) => [x, budgetDuJour(f, x)]));
  const journalier = budgetJournalier(f);

  const passes = dates.filter((x) => x <= d);
  const v = (x: string) => arrondi(parJour.get(x) || 0);
  const indexDefaut = Math.max(0, dates.indexOf(d) >= 0 ? dates.indexOf(d) : passes.length ? passes.length - 1 : dates.length - 1);
  const [choisi, setChoisi] = useState(indexDefaut);
  const jour = dates[Math.min(choisi, dates.length - 1)];

  const total = arrondi(passes.reduce((s, x) => s + v(x), 0));
  const auDessus = passes.filter((x) => budgets.get(x) && v(x) > budgets.get(x)!).length;
  const avecBudget = passes.some((x) => budgets.get(x));
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
          plafond: budgets.get(x),
          detail: x > d ? `${titreJour(x, d)} : à venir` : `${titreJour(x, d)} : ${fmtMontant(v(x), f.devise)}${budgets.get(x) ? ` sur ${fmtMontant(budgets.get(x)!, f.devise)} de budget du jour` : ''}`,
        }))}
        seuil={seuil || undefined}
        choisi={choisi}
        onChoisir={setChoisi}
      />
      <T small muted>
        {avecBudget
          ? `${seuil ? `Budget d'aujourd'hui : ${fmtMontant(seuil, f.devise)}${journalier ? '' : ' (ce qui reste du mois, réparti sur les jours restants)'}. ` : ''}${auDessus ? `${auDessus} jour${pl(auDessus)} au-dessus de leur budget` : 'Aucun jour au-dessus de son budget'} sur ${passes.length}.`
          : 'Fixe un budget pour voir les jours au-dessus.'}{' '}
        {`En moyenne ${fmtMontant(arrondi(total / passes.length), f.devise)} par jour, ${sans ? `${sans} jour${pl(sans)}` : 'aucun jour'} sans dépense.`}
      </T>
      {jour <= d ? <Btn small kind="sec" label={`Voir les dépenses ${jour === d || jour === addDays(d, -1) ? "d'" : 'du '}${nomJour(jour).replace(/^le /, '')}`} onPress={() => voirJour(jour)} /> : null}
    </Panel>
  );
}
