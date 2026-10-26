import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import {
  ancre,
  appliquer,
  bornes,
  cumul,
  FILTRES_VIDES,
  JOURS_COURTS,
  JOURS_LONGS,
  libelleMois,
  nbFiltres,
  operationsDe,
  parCategorie,
  parJourSemaine,
  parLibelle,
  parMois,
  periodesDisponibles,
  recommandations,
  totaux,
  type Filtres,
  type Operation,
  type Reco,
} from '@/lib/analyse-operations';
import { autreMoitie, candidatsLien, changerCompte, comptesDe, delier, lier, nomCompte, resumerComptes, virements as resumeVirements } from '@/lib/comptes';
import { today } from '@/lib/dates';
import { libelleOrigine } from '@/lib/devises';
import { categoriesDe, idBudgetDe, poser, repartitionParCategorie } from '@/lib/categories';
import { fmtMontant, lireMontant } from '@/lib/finances';
import { useStore } from '@/lib/store';
import { titreJour } from '@/lib/stats-finances';
import { C, F } from '@/lib/theme';
import type { Finances } from '@/lib/types';

import { ChoixCategories } from './categories';
import { Barres, Part } from './graphiques';
import { Courbe, EntreesSorties } from './graphiques-operations';
import { ChoixBudget, ChoixPoste, Puce, type SetF } from './finances-plus';
import { Differe, SqueletteConseils, SqueletteGraphiques, SqueletteOperations } from './squelettes';
import { Btn, Empty, Input, Panel, Seg, T } from './ui';

type Vue = 'liste' | 'graphiques' | 'conseils';

const PAR_PAGE = 60;
const arrondi = (n: number) => Math.round(n * 100) / 100;
const dateCourte = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
const TRIS: { key: Filtres['tri']; label: string }[] = [
  { key: 'recentes', label: 'Plus récentes' },
  { key: 'anciennes', label: 'Plus anciennes' },
  { key: 'gros', label: 'Plus gros montants' },
  { key: 'petits', label: 'Plus petits montants' },
];

/**
 * Toutes les opérations, sorties (dépenses) et entrées (revenus) ensemble : l'endroit où l'on retrouve ce qu'on a importé
 * d'un relevé bancaire, quelle que soit sa période. Des filtres (période, sens, budget, montant, origine, recherche, tri)
 * décident de ce qu'on voit, et les trois vues — liste, graphiques, conseils — travaillent sur la même sélection.
 */
export function Operations({ f, setF, filtreInitial }: { f: Finances; setF: SetF; /** Filtres de départ (« Voir les opérations » d'un compte, des virements…). */ filtreInitial?: Partial<Filtres> }) {
  const d = today();
  const [fi, setFi] = useState<Filtres>({ ...FILTRES_VIDES, ...filtreInitial });
  const [plus, setPlus] = useState(() => !!filtreInitial?.virements);
  const comptes = comptesDe(f);
  const [vue, setVue] = useState<Vue>('liste');
  const [limite, setLimite] = useState(PAR_PAGE);
  const [minT, setMinT] = useState('');
  const [maxT, setMaxT] = useState('');
  const fmt = (n: number) => fmtMontant(n, f.devise);
  const nomBudget = (id: string | null) => f.budgets.find((b) => b.id === id)?.nom ?? '';
  const { espace } = useStore();
  const catalogue = categoriesDe(espace);
  const nomsCategories = (ids: string[]) => catalogue.filter((c) => ids.includes(c.id)).map((c) => c.nom).join(' ');

  // Une dépense compte dans son budget, ou dans celui qui suit l'une de ses catégories.
  const toutes = useMemo(() => operationsDe(f, (x) => idBudgetDe(f.budgets, x)), [f]);
  const ref = useMemo(() => ancre(toutes, d), [toutes, d]);
  const dispo = useMemo(() => periodesDisponibles(toutes), [toutes]);
  const liste = useMemo(
    () => appliquer(toutes, fi, ref, nomBudget, nomsCategories),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toutes, fi, ref, f.budgets, catalogue],
  );
  // Les virements entre mes comptes restent dans la liste, mais ne comptent ni dans les totaux, ni dans les graphiques, ni dans les conseils.
  const reelles = useMemo(() => liste.filter((x) => !x.lien), [liste]);
  const t = useMemo(() => totaux(reelles), [reelles]);
  const vir = useMemo(() => resumeVirements(liste), [liste]);
  const actifs = nbFiltres(fi);
  const change = (p: Partial<Filtres>) => {
    setFi((x) => ({ ...x, ...p }));
    setLimite(PAR_PAGE);
  };
  const effacer = () => {
    setFi({ ...FILTRES_VIDES, tri: fi.tri });
    setMinT('');
    setMaxT('');
    setLimite(PAR_PAGE);
  };
  const periode = bornes(fi.periode, ref);
  const plage = liste.length ? `du ${dateCourte(liste.reduce((m, x) => (x.date < m ? x.date : m), liste[0].date))} au ${dateCourte(liste.reduce((m, x) => (x.date > m ? x.date : m), liste[0].date))}` : '';

  /** Un clic sur un poste ou un conseil : on affiche les opérations concernées dans la liste. */
  const voir = (p: Partial<Filtres>) => {
    setFi((x) => ({ ...x, recherche: '', budget: 'tous', categorie: 'toutes', sens: 'toutes', compte: 'tous', virements: 'tous', ...p }));
    setMinT('');
    setMaxT('');
    setLimite(PAR_PAGE);
    setVue('liste');
  };

  const mois = dispo.mois;
  const presets = [
    { key: 'tout', label: 'Tout' },
    { key: '30j', label: '30 jours' },
    { key: '90j', label: '3 mois' },
    { key: '12m', label: '12 mois' },
  ];

  return (
    <Panel title="Opérations" count={toutes.length ? liste.length : undefined}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Total titre="Entrées" valeur={`+${fmt(t.entrees)}`} detail={`${t.nbEntrees} opération${t.nbEntrees > 1 ? 's' : ''}`} couleur={C.coach} />
        <Total titre="Sorties" valeur={`−${fmt(t.sorties)}`} detail={`${t.nbSorties} opération${t.nbSorties > 1 ? 's' : ''}`} couleur={C.ink} />
        <Total titre="Solde" valeur={`${t.solde > 0 ? '+' : t.solde < 0 ? '−' : ''}${fmt(Math.abs(t.solde))}`} detail={plage || 'aucune opération'} couleur={t.solde < 0 ? C.agressif : C.coach} />
      </View>
      {vir.nb ? <T small muted>{`${vir.nb} virement${vir.nb > 1 ? 's' : ''} entre tes comptes (${fmt(vir.total)}) ne ${vir.nb > 1 ? 'sont' : 'est'} pas compté${vir.nb > 1 ? 's' : ''} dans ces totaux.`}</T> : null}

      {toutes.length ? (
        <View style={{ gap: 10 }}>
          {comptes.length ? (
            <Groupe titre="Compte">
              <Rangee defile>
                <Puce label="Tous" on={fi.compte === 'tous'} onPress={() => change({ compte: 'tous' })} />
                {comptes.map((c) => (
                  <Puce key={c.id} label={`${c.emoji} ${c.nom}`} on={fi.compte === c.id} onPress={() => change({ compte: c.id })} />
                ))}
                {toutes.some((x) => !x.compte) ? <Puce label="Sans compte" on={fi.compte === 'aucun'} onPress={() => change({ compte: 'aucun' })} /> : null}
              </Rangee>
            </Groupe>
          ) : null}
          <Groupe titre="Période">
            <Rangee>
              {presets.map((p) => (
                <Puce key={p.key} label={p.label} on={fi.periode === p.key} onPress={() => change({ periode: p.key })} />
              ))}
              {dispo.annees.length > 1 ? dispo.annees.map((a) => <Puce key={a} label={a} on={fi.periode === a} onPress={() => change({ periode: a })} />) : null}
            </Rangee>
            {mois.length > 1 ? (
              <Rangee defile>
                {mois.slice(0, 36).map((m) => (
                  <Puce key={m} label={libelleMois(m)} on={fi.periode === m} onPress={() => change({ periode: m })} />
                ))}
              </Rangee>
            ) : null}
            {fi.periode !== 'tout' && periode.debut ? <T small muted>{`Du ${dateCourte(periode.debut)} au ${dateCourte(periode.fin ?? ref)}`}</T> : null}
          </Groupe>

          <Groupe titre="Sens">
            <Rangee>
              <Puce label="Toutes" on={fi.sens === 'toutes'} onPress={() => change({ sens: 'toutes' })} />
              <Puce label="Sorties" on={fi.sens === 'sorties'} onPress={() => change({ sens: 'sorties' })} />
              <Puce label="Entrées" on={fi.sens === 'entrees'} onPress={() => change({ sens: 'entrees' })} />
            </Rangee>
          </Groupe>

          <Input value={fi.recherche} onChangeText={(x) => change({ recherche: x })} placeholder="Rechercher un libellé, un budget, un montant" accessibilityLabel="Rechercher une opération" />

          {plus ? (
            <View style={{ gap: 10 }}>
              <Groupe titre="Budget">
                <Rangee defile>
                  <Puce label="Tous" on={fi.budget === 'tous'} onPress={() => change({ budget: 'tous' })} />
                  <Puce label="Hors budget" on={fi.budget === 'hors'} onPress={() => change({ budget: 'hors' })} />
                  {f.budgets.map((b) => (
                    <Puce key={b.id} label={`${b.emoji} ${b.nom}`} on={fi.budget === b.id} onPress={() => change({ budget: b.id })} />
                  ))}
                </Rangee>
                {fi.budget !== 'tous' && fi.sens === 'entrees' ? <T small muted>Les entrées n’ont pas de budget : ce filtre ne garde que des sorties.</T> : null}
              </Groupe>
              {catalogue.length ? (
                <Groupe titre="Catégorie">
                  <Rangee defile>
                    <Puce label="Toutes" on={fi.categorie === 'toutes'} onPress={() => change({ categorie: 'toutes' })} />
                    <Puce label="Sans catégorie" on={fi.categorie === 'aucune'} onPress={() => change({ categorie: 'aucune' })} />
                    {catalogue.map((c) => (
                      <Puce key={c.id} label={`${c.emoji} ${c.nom}`} on={fi.categorie === c.id} onPress={() => change({ categorie: c.id })} />
                    ))}
                  </Rangee>
                </Groupe>
              ) : null}
              <Groupe titre={`Montant (${f.devise})`}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Input
                    value={minT}
                    onChangeText={(x) => {
                      setMinT(x);
                      change({ min: lireMontant(x) });
                    }}
                    placeholder="Au moins"
                    keyboardType="decimal-pad"
                    accessibilityLabel="Montant minimum"
                  />
                  <Input
                    value={maxT}
                    onChangeText={(x) => {
                      setMaxT(x);
                      change({ max: lireMontant(x) });
                    }}
                    placeholder="Au plus"
                    keyboardType="decimal-pad"
                    accessibilityLabel="Montant maximum"
                  />
                </View>
              </Groupe>
              <Groupe titre="Virements entre mes comptes">
                <Rangee>
                  <Puce label="Tous" on={fi.virements === 'tous'} onPress={() => change({ virements: 'tous' })} />
                  <Puce label="Sans les virements" on={fi.virements === 'sans'} onPress={() => change({ virements: 'sans' })} />
                  <Puce label="Virements seulement" on={fi.virements === 'seuls'} onPress={() => change({ virements: 'seuls' })} />
                </Rangee>
              </Groupe>
              <Groupe titre="Origine">
                <Rangee>
                  <Puce label="Toutes" on={fi.origine === 'toutes'} onPress={() => change({ origine: 'toutes' })} />
                  <Puce label="Importées" on={fi.origine === 'importees'} onPress={() => change({ origine: 'importees' })} />
                  <Puce label="Saisies à la main" on={fi.origine === 'saisies'} onPress={() => change({ origine: 'saisies' })} />
                </Rangee>
              </Groupe>
              <Groupe titre="Trier par">
                <Rangee>
                  {TRIS.map((x) => (
                    <Puce key={x.key} label={x.label} on={fi.tri === x.key} onPress={() => change({ tri: x.key })} />
                  ))}
                </Rangee>
              </Groupe>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn small kind="sec" label={plus ? 'Moins de filtres' : 'Plus de filtres'} onPress={() => setPlus(!plus)} />
            {actifs ? <Btn small kind="sec" label={`Effacer ${actifs > 1 ? `les ${actifs} filtres` : 'le filtre'}`} onPress={effacer} /> : null}
          </View>

          <Seg
            options={[
              { key: 'liste', label: 'Liste' },
              { key: 'graphiques', label: 'Graphiques' },
              { key: 'conseils', label: 'Conseils' },
            ]}
            value={vue}
            onChange={(k: Vue) => setVue(k)}
          />
        </View>
      ) : null}

      {!toutes.length ? <Empty icone="portefeuille">Aucune opération pour le moment. Importe un relevé bancaire depuis l’onglet Comptes.</Empty> : null}
      {toutes.length ? (
        <Differe key={vue} actif={toutes.length > 300} repli={vue === 'liste' ? <SqueletteOperations /> : vue === 'graphiques' ? <SqueletteGraphiques /> : <SqueletteConseils />}>
          {vue === 'liste' ? <Liste f={f} setF={setF} liste={liste} toutes={toutes} limite={limite} setLimite={setLimite} nomBudget={nomBudget} d={d} /> : null}
          {vue === 'graphiques' ? <Graphiques f={f} liste={reelles} fmt={fmt} voir={voir} /> : null}
          {vue === 'conseils' ? <Conseils f={f} liste={reelles} fmt={fmt} refDate={ref} voir={voir} /> : null}
        </Differe>
      ) : null}
    </Panel>
  );
}

function Rangee({ children, defile }: { children: ReactNode; defile?: boolean }) {
  return defile ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
      {children}
    </ScrollView>
  ) : (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>
  );
}

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{titre}</Text>
      {children}
    </View>
  );
}

function Liste({ f, setF, liste, toutes, limite, setLimite, nomBudget, d }: { f: Finances; setF: SetF; liste: Operation[]; toutes: Operation[]; limite: number; setLimite: (n: number) => void; nomBudget: (id: string | null) => string; d: string }) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const visibles = liste.slice(0, limite);
  const parDate = visibles.length > 0 && ordreParDate(liste);
  const groupes: { cle: string; titre: string | null; ops: typeof visibles }[] = [];
  if (parDate) {
    for (const x of visibles) {
      const g = groupes[groupes.length - 1];
      if (g && g.cle === x.date) g.ops.push(x);
      else groupes.push({ cle: x.date, titre: x.date, ops: [x] });
    }
  } else if (visibles.length) groupes.push({ cle: 'tous', titre: null, ops: visibles });
  const fmt = (n: number) => fmtMontant(n, f.devise);
  const aDesComptes = comptesDe(f).length > 0;
  const catalogue = categoriesDe(useStore().espace);
  if (!liste.length) return <Empty icone="portefeuille">Aucune opération ne correspond à ces filtres.</Empty>;
  return (
    <>
      {groupes.map((g) => {
        const net = arrondi(g.ops.filter((x) => !x.lien).reduce((s, x) => s + (x.sens === 'entree' ? x.montant : -x.montant), 0));
        return (
          <View key={g.cle} style={{ gap: 2 }}>
            {g.titre ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{titreJour(g.titre, d)}</Text>
                {g.ops.every((x) => x.lien) ? null : (
                  <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>
                    {net > 0 ? '+' : net < 0 ? '−' : ''}
                    {fmt(Math.abs(net))}
                  </Text>
                )}
              </View>
            ) : null}
            {g.ops.map((x) => {
              const bu = f.budgets.find((b) => b.id === x.budget);
              const origine = libelleOrigine(x.origine, f.devise);
              const virement = !!x.lien;
              const ouvert = ouverte === x.id;
              return (
                <View key={x.id}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: ouvert }} accessibilityLabel={`${x.note || 'Opération'}, ${fmt(x.montant)}. ${ouvert ? 'Masquer' : 'Afficher'} le budget, le compte et le lien`} onPress={() => setOuverte(ouvert ? null : x.id)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 15 }}>
                        {x.note || (x.sens === 'entree' ? 'Entrée' : bu?.nom || 'Sortie')}
                      </Text>
                      <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
                        {g.titre ? '' : `${dateCourte(x.date)} · `}
                        {virement ? 'Virement entre comptes' : x.sens === 'entree' ? 'Entrée' : bu ? `${bu.emoji} ${nomBudget(x.budget)}` : 'Sortie · hors budget'}
                        {aDesComptes ? ` · ${nomCompte(f, x.compte)}` : ''}
                        {x.importee ? ' · importée' : ''}
                        {x.categories.length ? ` · ${catalogue.filter((c) => x.categories.includes(c.id)).map((c) => `${c.emoji} ${c.nom}`).join(', ')}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: virement ? C.muted : x.sens === 'entree' ? C.coach : C.ink, fontFamily: F.texteF, fontSize: 15 }}>
                        {virement ? '⇄ ' : x.sens === 'entree' ? '+' : '−'}
                        {fmt(x.montant)}
                      </Text>
                      {origine ? <T small muted>{origine}</T> : null}
                    </View>
                  </Pressable>
                  {ouvert ? <DetailOperation f={f} setF={setF} op={x} toutes={toutes} /> : null}
                </View>
              );
            })}
          </View>
        );
      })}
      {liste.length > limite ? <Btn small kind="sec" label={`Voir ${Math.min(PAR_PAGE, liste.length - limite)} de plus (${liste.length - limite} restantes)`} onPress={() => setLimite(limite + PAR_PAGE)} /> : null}
    </>
  );
}

/** Sous une opération touchée : son budget (une sortie), ses catégories, son compte, et de quelle autre opération elle est l'autre moitié (virement). */
function DetailOperation({ f, setF, op, toutes }: { f: Finances; setF: SetF; op: Operation; toutes: Operation[] }) {
  const [cherche, setCherche] = useState(false);
  const comptes = comptesDe(f);
  const autre = autreMoitie(toutes, op);
  const candidats = useMemo(() => (cherche ? candidatsLien(toutes, op) : []), [cherche, toutes, op]);
  const depense = f.depenses.find((x) => x.id === op.id);
  // Le budget qui compte cette dépense : c'est lui qui porte les postes du plan.
  const budgetDepense = depense ? f.budgets.find((x) => x.id === idBudgetDe(f.budgets, depense)) : undefined;
  const fmt = (n: number) => fmtMontant(n, f.devise);
  const decrire = (x: Operation) => `${x.sens === 'entree' ? 'Entrée' : 'Sortie'} de ${fmt(x.montant)} le ${dateCourte(x.date)}${x.note ? ` (${x.note})` : ''} · ${nomCompte(f, x.compte)}`;
  return (
    <View style={{ gap: 10, padding: 12, marginBottom: 6, borderRadius: 12, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
      {!op.lien && op.sens === 'sortie' ? (
        <>
          <ChoixBudget
            budgets={f.budgets}
            value={depense?.budget ?? null}
            onChange={(id) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (x.id === op.id ? { ...x, budget: id, poste: undefined } : x)) }))}
            date={op.date}
            categories={op.categories}
          />
          <ChoixPoste budget={budgetDepense} value={depense?.poste ?? null} onChange={(id) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (x.id === op.id ? { ...x, poste: id ?? undefined } : x)) }))} />
        </>
      ) : null}
      {!op.lien ? (
        <ChoixCategories
          value={op.categories}
          onChange={(ids) =>
            setF((g) => ({
              ...g,
              depenses: g.depenses.map((x) => (x.id === op.id ? poser(x, ids) : x)),
              ...(g.revenus ? { revenus: g.revenus.map((x) => (x.id === op.id ? poser(x, ids) : x)) } : {}),
            }))
          }
        />
      ) : null}
      {comptes.length ? (
        <View style={{ gap: 6 }}>
          <T small muted>Compte</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {comptes.map((c) => (
              <Puce key={c.id} label={`${c.emoji} ${c.nom}`} on={op.compte === c.id} onPress={() => setF((g) => changerCompte(g, op.id, c.id))} />
            ))}
            <Puce label="Aucun" on={!op.compte} onPress={() => setF((g) => changerCompte(g, op.id, null))} />
          </View>
        </View>
      ) : (
        <T small muted>Crée un compte dans l’onglet Comptes pour y ranger cette opération.</T>
      )}
      {op.lien ? (
        <View style={{ gap: 6 }}>
          <T small muted>Virement entre tes comptes</T>
          <T small>{autre ? decrire(autre) : 'L’autre moitié de ce virement n’existe plus.'}</T>
          <View style={{ alignSelf: 'flex-start' }}>
            <Btn small kind="sec" label="Défaire le lien" onPress={() => setF((g) => delier(g, op.lien!))} />
          </View>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <T small muted>{op.sens === 'sortie' ? 'Cette sortie est le virement vers un autre de tes comptes ?' : 'Cette entrée vient d’un autre de tes comptes ?'}</T>
          {cherche ? (
            candidats.length ? (
              candidats.map((c) => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <T small>{decrire(c)}</T>
                  </View>
                  <Btn
                    small
                    label="Lier"
                    onPress={() => {
                      setF((g) => (op.sens === 'sortie' ? lier(g, op.id, c.id) : lier(g, c.id, op.id)) ?? g);
                      setCherche(false);
                    }}
                  />
                </View>
              ))
            ) : (
              <T small muted>Aucune {op.sens === 'sortie' ? 'entrée' : 'sortie'} libre à moins de 10 jours.</T>
            )
          ) : (
            <View style={{ alignSelf: 'flex-start' }}>
              <Btn small kind="sec" label="Lier à une autre opération" onPress={() => setCherche(true)} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** Les jours ne sont regroupés que si la liste est triée par date ; triée par montant, elle reste une liste plate. */
function ordreParDate(l: { date: string }[]) {
  let croissant = true;
  let decroissant = true;
  for (let i = 1; i < l.length; i++) {
    if (l[i].date > l[i - 1].date) decroissant = false;
    if (l[i].date < l[i - 1].date) croissant = false;
    if (!croissant && !decroissant) return false;
  }
  return true;
}

function Titre({ children, aide }: { children: ReactNode; aide?: string }) {
  return (
    <View style={{ gap: 2, paddingTop: 6 }}>
      <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 15 }}>{children}</Text>
      {aide ? <T small muted>{aide}</T> : null}
    </View>
  );
}

function Graphiques({ f, liste, fmt, voir }: { f: Finances; liste: Operation[]; fmt: (n: number) => string; voir: (p: Partial<Filtres>) => void }) {
  const mois = useMemo(() => parMois(liste), [liste]);
  const courbe = useMemo(() => cumul(liste), [liste]);
  const categories = useMemo(() => parCategorie(liste, f.budgets), [liste, f.budgets]);
  const { espace } = useStore();
  const parCats = useMemo(() => repartitionParCategorie(liste.filter((x) => x.sens === 'sortie').map((x) => ({ montant: x.montant, categories: x.categories })), categoriesDe(espace)), [liste, espace]);
  const libelles = useMemo(() => parLibelle(liste).slice(0, 8), [liste]);
  const jours = useMemo(() => parJourSemaine(liste), [liste]);
  const parCompte = useMemo(() => resumerComptes(liste, comptesDe(f)).filter((x) => x.sorties > 0 || x.entrees > 0), [liste, f]);
  const S = liste.filter((x) => x.sens === 'sortie').reduce((s, x) => s + x.montant, 0);
  const plusCharge = jours.reduce((m, j, i) => (j.total > jours[m].total ? i : m), 0);
  const [jourChoisi, setJourChoisi] = useState<number | null>(null);
  if (!liste.length) return <Empty icone="portefeuille">Aucune opération à représenter avec ces filtres.</Empty>;
  return (
    <View style={{ gap: 14 }}>
      {mois.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Titre aide="Touche un mois pour lire ses chiffres.">Entrées et sorties par mois</Titre>
          <EntreesSorties mois={mois} fmt={fmt} />
        </View>
      ) : null}
      {courbe.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Titre aide="Entrées moins sorties depuis le début de la sélection : sous la ligne pointillée, tu as dépensé plus que reçu.">Évolution du solde</Titre>
          <Courbe points={courbe} fmt={fmt} />
        </View>
      ) : null}
      {parCompte.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Titre aide="Sans les virements entre tes comptes. Touche un compte pour voir ses opérations.">Sorties par compte</Titre>
          {[...parCompte].sort((a, z) => z.sorties - a.sorties).map((c) => (
            <Pressable key={c.id ?? 'aucun'} accessibilityRole="button" accessibilityLabel={`Voir les opérations de ${c.compte?.nom ?? 'sans compte'}`} onPress={() => voir({ compte: c.id ?? 'aucun' })}>
              <Part libelle={c.compte ? `${c.compte.emoji} ${c.compte.nom}` : 'Sans compte'} valeur={`−${fmt(c.sorties)} · +${fmt(c.entrees)}`} ratio={c.sorties / Math.max(1, ...parCompte.map((x) => x.sorties))} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {categories.length ? (
        <View style={{ gap: 8 }}>
          <Titre aide="Touche une ligne pour voir ses opérations.">Sorties par budget</Titre>
          {categories.map((c) => (
            <Pressable key={c.cle} accessibilityRole="button" accessibilityLabel={`Voir les sorties de ${c.nom}`} onPress={() => voir({ budget: c.cle, sens: 'sorties' })}>
              <Part libelle={`${c.emoji ? `${c.emoji} ` : ''}${c.nom}`} valeur={`${fmt(c.total)} · ${S ? Math.round((c.total / S) * 100) : 0} %`} ratio={c.total / categories[0].total} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {parCats.length && categoriesDe(espace).length ? (
        <View style={{ gap: 8 }}>
          <Titre aide="Une sortie à plusieurs catégories compte dans chacune : la somme peut dépasser le total. Touche une ligne pour voir ses opérations.">Sorties par catégorie</Titre>
          {parCats.map((c) => (
            <Pressable key={c.cle} accessibilityRole="button" accessibilityLabel={`Voir les sorties de ${c.nom}`} onPress={() => voir({ categorie: c.cle === 'aucune' ? 'aucune' : c.cle, sens: 'sorties' })}>
              <Part libelle={`${c.emoji ? `${c.emoji} ` : ''}${c.nom}`} valeur={`${fmt(c.total)} · ${c.n} fois`} ratio={c.total / parCats[0].total} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {libelles.length ? (
        <View style={{ gap: 8 }}>
          <Titre aide="Les libellés qui reviennent le plus. Touche-en un pour le retrouver dans la liste.">Où part l’argent</Titre>
          {libelles.map((p) => (
            <Pressable key={p.cle} accessibilityRole="button" accessibilityLabel={`Voir les opérations « ${p.nom} »`} onPress={() => voir({ recherche: p.nom, sens: 'sorties' })}>
              <Part libelle={p.nom} valeur={`${fmt(p.total)} · ${p.n} fois`} ratio={p.total / libelles[0].total} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {S > 0 ? (
        <View style={{ gap: 8 }}>
          <Titre aide="Total des sorties, tous les lundis ensemble, tous les mardis ensemble…">Sorties par jour de la semaine</Titre>
          <Barres
            hauteur={90}
            choisi={jourChoisi ?? plusCharge}
            onChoisir={setJourChoisi}
            points={jours.map((j, i) => ({ cle: JOURS_COURTS[i], axe: JOURS_COURTS[i].replace('.', ''), v: j.total, detail: `${JOURS_LONGS[i][0].toUpperCase()}${JOURS_LONGS[i].slice(1)} : ${fmt(j.total)} en ${j.n} sortie${j.n > 1 ? 's' : ''}${i === plusCharge ? ' (le plus chargé)' : ''}` }))}
          />
        </View>
      ) : null}
    </View>
  );
}

const COULEUR_NIVEAU: Record<Reco['niveau'], string> = { alerte: C.agressif, conseil: C.hebdo, info: C.accent, bien: C.coach };
const LABEL_NIVEAU: Record<Reco['niveau'], string> = { alerte: 'À surveiller', conseil: 'Conseil', info: 'À savoir', bien: 'Bien joué' };

function Conseils({ f, liste, fmt, refDate, voir }: { f: Finances; liste: Operation[]; fmt: (n: number) => string; refDate: string; voir: (p: Partial<Filtres>) => void }) {
  const recos = useMemo(() => recommandations(liste, { budgets: f.budgets, recurrences: (f.recurrences || []).map((r) => r.note), fmt, ref: refDate }), [liste, f.budgets, f.recurrences, fmt, refDate]);
  return (
    <View style={{ gap: 10 }}>
      <T small muted>Calculés sur les opérations sélectionnées ci-dessus : change la période ou les filtres pour regarder ailleurs.</T>
      {recos.map((r) => {
        const col = COULEUR_NIVEAU[r.niveau];
        return (
          <View key={r.id} style={{ gap: 6, padding: 12, borderRadius: 12, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line, borderLeftWidth: 3, borderLeftColor: col }}>
            <Text style={{ color: col, fontFamily: F.texteM, fontSize: 12 }}>{LABEL_NIVEAU[r.niveau]}</Text>
            <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 15 }}>{r.titre}</Text>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, lineHeight: 19 }}>{r.texte}</Text>
            {r.voir ? (
              <View style={{ alignSelf: 'flex-start' }}>
                <Btn small kind="sec" label="Voir les opérations" onPress={() => voir(r.voir!)} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

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
