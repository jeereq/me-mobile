import { useState } from 'react';
import { View } from 'react-native';

import { addDays, parse, today } from '@/lib/dates';
import { bilan, bornes, fmtMontant } from '@/lib/finances';
import { budgetJournalier } from '@/lib/previsions';
import { restesReportables } from '@/lib/reports';
import { titreJour } from '@/lib/stats-finances';
import type { Finances, Periode } from '@/lib/types';

import { Barres } from './graphiques';
import { Btn, Panel, T } from './ui';

const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Dépenses jour par jour sur la semaine ou le mois affiché (celles qui comptent dans les budgets, comme la jauge de l'Aperçu),
 * face au budget d'aujourd'hui (ligne pointillée) ;
 * chaque jour passé est comparé à son propre budget du jour (voir `budgetDuJour`) :
 * jours au-dessus, jours sans dépense, moyenne. Toucher une barre puis « Voir » ouvre les dépenses de ce jour.
 */
export function JourParJour({ f, vue, jourRef, voirJour, onReporter }: { f: Finances; vue: Periode; jourRef: string; voirJour: (date: string) => void; /** Reporter le reste non dépensé du jour choisi. */ onReporter?: (date: string) => void }) {
  const d = today();
  const { debut, fin } = bornes(vue, jourRef);
  const dates: string[] = [];
  for (let x = debut; x <= fin; x = addDays(x, 1)) dates.push(x);
  // Chaque jour passé : ce qui compte face au budget (sans le hors budget, comme partout) et son propre budget du jour.
  const parJour = new Map(dates.filter((x) => x <= d).map((x) => [x, bilan(f, 'jour', x, x)]));
  const budgets = new Map([...parJour].map(([x, j]) => [x, j.plafondTotal]));
  // La ligne : le budget d'aujourd'hui, si la période l'affiche ; chaque barre a le sien dans son détail.
  const seuil = budgets.get(d) ?? 0;
  const hors = (x: string) => arrondi(parJour.get(x)?.horsBudget || 0);
  const journalier = budgetJournalier(f);

  const passes = dates.filter((x) => x <= d);
  const v = (x: string) => arrondi(parJour.get(x)?.compte || 0);
  const indexDefaut = Math.max(0, dates.indexOf(d) >= 0 ? dates.indexOf(d) : passes.length ? passes.length - 1 : dates.length - 1);
  const [choisi, setChoisi] = useState(indexDefaut);
  const jour = dates[Math.min(choisi, dates.length - 1)];

  // Ce qui reste du budget du jour choisi : celui du budget total, sinon la somme des budgets qui ne sont pas dépassés.
  const resteJour = jour <= d ? arrondi(restesReportables(f, 'jour', jour, d).reduce((s, x) => s + (x.budget.global || !f.budgets.some((y) => y.global) ? x.reste : 0), 0)) : 0;
  const total = arrondi(passes.reduce((s, x) => s + v(x), 0));
  const totalHors = arrondi(passes.reduce((s, x) => s + hors(x), 0));
  const auDessus = passes.filter((x) => budgets.get(x) && v(x) > budgets.get(x)!).length;
  const avecBudget = passes.some((x) => budgets.get(x));
  const sans = passes.filter((x) => !v(x) && !hors(x)).length;
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
          detail: x > d ? `${titreJour(x, d)} : à venir` : `${titreJour(x, d)} : ${fmtMontant(v(x), f.devise)}${budgets.get(x) ? ` sur ${fmtMontant(budgets.get(x)!, f.devise)} de budget du jour` : ''}${hors(x) ? `, et ${fmtMontant(hors(x), f.devise)} hors budget` : ''}`,
        }))}
        seuil={seuil || undefined}
        choisi={choisi}
        onChoisir={setChoisi}
      />
      <T small muted>
        {avecBudget
          ? `${seuil ? `Budget d'aujourd'hui : ${fmtMontant(seuil, f.devise)}${journalier ? '' : ' (ce qui reste de tes budgets, de la semaine ou du mois, réparti sur les jours restants)'}. ` : ''}${auDessus ? `${auDessus} jour${pl(auDessus)} au-dessus de leur budget` : 'Aucun jour au-dessus de son budget'} sur ${passes.length}.`
          : 'Fixe un budget pour voir les jours au-dessus.'}{' '}
        {`En moyenne ${fmtMontant(arrondi(total / passes.length), f.devise)} par jour dans tes budgets, ${sans ? `${sans} jour${pl(sans)}` : 'aucun jour'} sans dépense.`}{totalHors ? ` Le hors budget (${fmtMontant(totalHors, f.devise)}) n'est pas dans ces barres.` : ''}
      </T>
      {jour <= d ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn small kind="sec" label={`Voir les dépenses ${jour === d || jour === addDays(d, -1) ? "d'" : 'du '}${nomJour(jour).replace(/^le /, '')}`} onPress={() => voirJour(jour)} />
          {onReporter && resteJour > 0 ? <Btn small kind="sec" label={`Reporter ${fmtMontant(resteJour, f.devise)} non dépensés`} onPress={() => onReporter(jour)} /> : null}
        </View>
      ) : null}
    </Panel>
  );
}
