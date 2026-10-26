import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { libelleOrigine } from '@/lib/devises';
import { fmtMontant } from '@/lib/finances';
import { today } from '@/lib/dates';
import { titreJour } from '@/lib/stats-finances';
import { C, F } from '@/lib/theme';
import type { Finances } from '@/lib/types';

import { Puce } from './finances-plus';
import { Btn, Empty, Input, Panel, T } from './ui';

type Sens = 'toutes' | 'sorties' | 'entrees';
type Operation = { id: string; sens: 'sortie' | 'entree'; date: string; montant: number; note: string; budget: string | null; origine?: { montant: number; devise: string }; importee: boolean };

const PAR_PAGE = 60;
const arrondi = (n: number) => Math.round(n * 100) / 100;

/**
 * Toutes les opérations, sorties (dépenses) et entrées (revenus) ensemble : l'endroit où l'on retrouve ce qu'on a importé
 * d'un relevé bancaire, quelle que soit sa période. Sur « tout l'historique » ou seulement sur la période choisie en haut de l'écran.
 */
export function Operations({ f, debut, fin, historique }: { f: Finances; debut: string; fin: string; historique: boolean }) {
  const d = today();
  const [sens, setSens] = useState<Sens>('toutes');
  const [cherche, setCherche] = useState('');
  const [limite, setLimite] = useState(PAR_PAGE);
  const nomBudget = (id: string | null) => f.budgets.find((b) => b.id === id);

  const toutes = useMemo<Operation[]>(
    () => [
      ...f.depenses.map((x) => ({ id: x.id, sens: 'sortie' as const, date: x.date, montant: x.montant, note: x.note, budget: x.budget, origine: x.origine, importee: !!x.reference })),
      ...(f.revenus || []).map((x) => ({ id: x.id, sens: 'entree' as const, date: x.date, montant: x.montant, note: x.note, budget: null, origine: x.origine, importee: !!x.reference })),
    ],
    [f.depenses, f.revenus],
  );
  const q = cherche.trim().toLowerCase();
  const dansLaPeriode = useMemo(() => (historique ? toutes : toutes.filter((x) => x.date >= debut && x.date <= fin)), [toutes, historique, debut, fin]);
  const liste = useMemo(
    () =>
      dansLaPeriode
        .filter((x) => (sens === 'toutes' ? true : sens === 'sorties' ? x.sens === 'sortie' : x.sens === 'entree'))
        .filter((x) => !q || `${x.note} ${nomBudget(x.budget)?.nom ?? ''} ${x.montant}`.toLowerCase().includes(q))
        .sort((a, z) => z.date.localeCompare(a.date) || a.sens.localeCompare(z.sens)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dansLaPeriode, sens, q, f.budgets],
  );
  const entrees = arrondi(dansLaPeriode.filter((x) => x.sens === 'entree').reduce((s, x) => s + x.montant, 0));
  const sorties = arrondi(dansLaPeriode.filter((x) => x.sens === 'sortie').reduce((s, x) => s + x.montant, 0));
  const solde = arrondi(entrees - sorties);
  const nbEntrees = dansLaPeriode.filter((x) => x.sens === 'entree').length;
  const nbSorties = dansLaPeriode.length - nbEntrees;
  const visibles = liste.slice(0, limite);
  const jours = [...new Set(visibles.map((x) => x.date))];
  const plage = dansLaPeriode.length ? `du ${dateCourte(dansLaPeriode.reduce((m, x) => (x.date < m ? x.date : m), dansLaPeriode[0].date))} au ${dateCourte(dansLaPeriode.reduce((m, x) => (x.date > m ? x.date : m), dansLaPeriode[0].date))}` : '';

  return (
    <Panel title="Opérations" count={liste.length || undefined}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Total titre="Entrées" valeur={`+${fmtMontant(entrees, f.devise)}`} detail={`${nbEntrees} opération${nbEntrees > 1 ? 's' : ''}`} couleur={C.coach} />
        <Total titre="Sorties" valeur={`−${fmtMontant(sorties, f.devise)}`} detail={`${nbSorties} opération${nbSorties > 1 ? 's' : ''}`} couleur={C.ink} />
        <Total titre="Solde" valeur={`${solde > 0 ? '+' : solde < 0 ? '−' : ''}${fmtMontant(Math.abs(solde), f.devise)}`} detail={historique ? plage : 'sur la période'} couleur={solde < 0 ? C.agressif : C.coach} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Puce label="Toutes" on={sens === 'toutes'} onPress={() => setSens('toutes')} />
        <Puce label="Sorties" on={sens === 'sorties'} onPress={() => setSens('sorties')} />
        <Puce label="Entrées" on={sens === 'entrees'} onPress={() => setSens('entrees')} />
      </View>
      {toutes.length > 6 ? <Input value={cherche} onChangeText={(t) => { setCherche(t); setLimite(PAR_PAGE); }} placeholder="Rechercher un libellé, un budget, un montant" accessibilityLabel="Rechercher une opération" /> : null}
      {liste.length ? (
        jours.map((jour) => {
          const du = visibles.filter((x) => x.date === jour);
          const net = arrondi(du.reduce((s, x) => s + (x.sens === 'entree' ? x.montant : -x.montant), 0));
          return (
            <View key={jour} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{titreJour(jour, d)}</Text>
                <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>
                  {net > 0 ? '+' : net < 0 ? '−' : ''}
                  {fmtMontant(Math.abs(net), f.devise)}
                </Text>
              </View>
              {du.map((x) => {
                const bu = nomBudget(x.budget);
                const origine = libelleOrigine(x.origine, f.devise);
                return (
                  <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 15 }}>
                        {x.note || (x.sens === 'entree' ? 'Entrée' : bu?.nom || 'Sortie')}
                      </Text>
                      <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
                        {x.sens === 'entree' ? 'Entrée' : bu ? `${bu.emoji} ${bu.nom}` : 'Sortie · hors budget'}
                        {x.importee ? ' · importée' : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: x.sens === 'entree' ? C.coach : C.ink, fontFamily: F.texteF, fontSize: 15 }}>
                        {x.sens === 'entree' ? '+' : '−'}
                        {fmtMontant(x.montant, f.devise)}
                      </Text>
                      {origine ? <T small muted>{origine}</T> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })
      ) : (
        <Empty icone="portefeuille">{toutes.length ? 'Aucune opération ne correspond.' : 'Aucune opération pour le moment. Importe un relevé bancaire depuis l’onglet Dépenses.'}</Empty>
      )}
      {liste.length > limite ? <Btn small kind="sec" label={`Voir ${Math.min(PAR_PAGE, liste.length - limite)} de plus (${liste.length - limite} restantes)`} onPress={() => setLimite(limite + PAR_PAGE)} /> : null}
    </Panel>
  );
}

const dateCourte = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

function Total({ titre, valeur, detail, couleur }: { titre: string; valeur: string; detail: string; couleur: string }) {
  return (
    <View style={{ flex: 1, gap: 2, padding: 10, borderRadius: 12, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{titre}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: couleur, fontFamily: F.chiffre, fontSize: 17 }}>
        {valeur}
      </Text>
      <Text numberOfLines={2} style={{ color: C.muted, fontFamily: F.texte, fontSize: 11 }}>
        {detail}
      </Text>
    </View>
  );
}
