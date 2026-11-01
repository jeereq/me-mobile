import { useState } from 'react';
import { View } from 'react-native';

import { addDays, parse, today } from '@/lib/dates';
import { bilan, bornes, fmtMontant } from '@/lib/finances';
import { depassementsComblables, restesReportables } from '@/lib/reports';
import { titreJour } from '@/lib/stats-finances';
import type { Finances, Periode } from '@/lib/types';

import { Barres } from './graphiques';
import { Btn, Panel, T } from './ui';

const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Dépenses notées jour par jour sur la semaine ou le mois affiché (celles qui comptent dans les budgets, comme la jauge
 * de l'Aperçu). Seuls les budgets fixés par jour donnent une ligne à chaque jour : un budget à la semaine ou au mois
 * n'est pas réparti par jour. Jours au-dessus, jours sans dépense, moyenne. Toucher une barre puis « Voir » ouvre les dépenses de ce jour.
 */
export function JourParJour({ f, vue, jourRef, voirJour, onReporter, onCombler }: { f: Finances; vue: Periode; jourRef: string; voirJour: (date: string) => void; /** Reporter le reste non dépensé du jour choisi. */ onReporter?: (date: string) => void; /** Combler un budget du jour choisi dépassé avec un autre budget. */ onCombler?: (date: string) => void }) {
  const d = today();
  const { debut, fin } = bornes(vue, jourRef);
  const dates: string[] = [];
  for (let x = debut; x <= fin; x = addDays(x, 1)) dates.push(x);
  // Chaque jour passé : ses dépenses notées (sans le hors budget, comme partout) et, s'il y en a, ses budgets fixés par jour.
  const parJour = new Map(dates.filter((x) => x <= d).map((x) => [x, bilan(f, 'jour', x, x)]));
  const avecGlobal = f.budgets.some((b) => b.global);
  const duJour = (x: string) => (parJour.get(x)?.lignes ?? []).filter((l) => l.budget.periode === 'jour' && !l.budget.enveloppe && (!avecGlobal || l.budget.global));
  const budgets = new Map([...parJour.keys()].map((x) => [x, arrondi(duJour(x).reduce((s, l) => s + l.plafond, 0))]));
  // La ligne : le budget fixé pour aujourd'hui, si la période l'affiche ; chaque barre a le sien dans son détail.
  const seuil = budgets.get(d) ?? 0;
  const hors = (x: string) => arrondi(parJour.get(x)?.horsBudget || 0);

  const passes = dates.filter((x) => x <= d);
  const v = (x: string) => arrondi((parJour.get(x)?.total || 0) - (avecGlobal ? 0 : hors(x)));
  const indexDefaut = Math.max(0, dates.indexOf(d) >= 0 ? dates.indexOf(d) : passes.length ? passes.length - 1 : dates.length - 1);
  const [choisi, setChoisi] = useState(indexDefaut);
  const jour = dates[Math.min(choisi, dates.length - 1)];

  // Ce qui reste des budgets fixés par jour, le jour choisi : celui du budget total, sinon la somme des budgets non dépassés.
  const resteJour = jour <= d ? arrondi(restesReportables(f, 'jour', jour, d).filter((x) => x.case.periode === 'jour').reduce((s, x) => s + (x.budget.global || !avecGlobal ? x.reste : 0), 0)) : 0;
  // Ce qui dépasse sur les budgets du jour choisi et qu'un autre budget peut combler.
  const depasseJour = jour <= d ? arrondi(depassementsComblables(f, 'jour', jour, d).reduce((s, x) => s + x.depasse, 0)) : 0;
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
          detail: x > d ? `${titreJour(x, d)} : à venir` : `${titreJour(x, d)} : ${fmtMontant(v(x), f.devise)}${budgets.get(x) ? ` sur ${fmtMontant(budgets.get(x)!, f.devise)} de budget fixé pour ce jour` : ''}${hors(x) ? `, et ${fmtMontant(hors(x), f.devise)} hors budget` : ''}`,
        }))}
        seuil={seuil || undefined}
        choisi={choisi}
        onChoisir={setChoisi}
      />
      <T small muted>
        {avecBudget
          ? `${seuil ? `Budget fixé pour aujourd'hui : ${fmtMontant(seuil, f.devise)}. ` : ''}${auDessus ? `${auDessus} jour${pl(auDessus)} au-dessus de leur budget` : 'Aucun jour au-dessus de son budget'} sur ${passes.length}.`
          : 'Tes budgets à la semaine ou au mois ne sont pas répartis par jour : seules tes dépenses notées comptent.'}{' '}
        {`En moyenne ${fmtMontant(arrondi(total / passes.length), f.devise)} par jour dans tes budgets, ${sans ? `${sans} jour${pl(sans)}` : 'aucun jour'} sans dépense.`}{totalHors ? ` Le hors budget (${fmtMontant(totalHors, f.devise)}) n'est pas dans ces barres.` : ''}
      </T>
      {jour <= d ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn small kind="sec" label={`Voir les dépenses ${jour === d || jour === addDays(d, -1) ? "d'" : 'du '}${nomJour(jour).replace(/^le /, '')}`} onPress={() => voirJour(jour)} />
          {onReporter && resteJour > 0 ? <Btn small kind="sec" label={`Reporter ${fmtMontant(resteJour, f.devise)} non dépensés`} onPress={() => onReporter(jour)} /> : null}
          {onCombler && depasseJour > 0 ? <Btn small kind="sec" label={`Déplacer ${fmtMontant(depasseJour, f.devise)} pour combler`} onPress={() => onCombler(jour)} /> : null}
        </View>
      ) : null}
    </Panel>
  );
}
