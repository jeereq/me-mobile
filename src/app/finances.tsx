import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChoixRepetition, creerRecurrence, PanneauDevises, useDateFin, PanneauRecurrences, PanneauRevenus, Puce, useChoixDate, useChoixDevise, type Repetition } from '@/components/finances-plus';
import { Barres, Part, Tuile } from '@/components/graphiques';
import { PanneauComptes } from '@/components/comptes';
import { ImportReleve } from '@/components/import-releve';
import { Operations } from '@/components/operations';
import { JourParJour } from '@/components/jour-par-jour';
import { couleurRatio, Jauge } from '@/components/jauge';
import { ChoixCategories, EtiquettesCategories } from '@/components/categories';
import { PanneauAlertes, PanneauPrevisions } from '@/components/previsions';
import { BarreSelection, BoutonSelection, Selectionnable, useSelection } from '@/components/selection';
import { Onglets, SousOnglets } from '@/components/onglets';
import { Btn, Empty, Header, IconBtn, Input, Panel, Screen, Sep, Seg, T } from '@/components/ui';
import { useActions } from '@/lib/actions';
import type { Filtres } from '@/lib/analyse-operations';
import { budgetDe, categoriesDe, idBudgetDe, poser } from '@/lib/categories';
import { comptesDe } from '@/lib/comptes';
import { libelleOrigine } from '@/lib/devises';
import { addDays, fmtCourt, parse, today, uid } from '@/lib/dates';
import { dateFr, statsFinances, titreJour } from '@/lib/stats-finances';
import { bilan, type Bilan, BUDGETS_SUGGERES, decaler, depensesEntre, EMOJIS_BUDGET, etatBudget, financesDe, fmtMontant, genererRecurrences, libelle, lireMontant, parPeriode, PERIODES, suiviBudgetDate } from '@/lib/finances';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Budget, Depense, Finances, Periode } from '@/lib/types';


const jours = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5) + 1;

function BudgetForm({ f, init, onDone, setF }: { f: Finances; init?: Budget; onDone: () => void; setF: (fn: (f: Finances) => Finances) => void }) {
  const [nom, setNom] = useState(init?.nom || '');
  const [emoji, setEmoji] = useState(init?.emoji || '🛒');
  const [montant, setMontant] = useState(init ? String(init.montant).replace('.', ',') : '');
  const [periode, setPeriode] = useState<Periode>(init?.periode || 'mois');
  const [portee, setPortee] = useState<'categorie' | 'global'>(init?.global ? 'global' : 'categorie');
  const [suit, setSuit] = useState<string[] | undefined>(init?.categories);
  // Durée : sans fin, ou jusqu'à une date ; le montant revient chaque période ou couvre toute la durée (enveloppe).
  const [duree, setDuree] = useState<'sans' | 'date'>(init?.fin ? 'date' : 'sans');
  const [couvre, setCouvre] = useState<'periode' | 'tout'>(init?.enveloppe ? 'tout' : 'periode');
  const debut = init?.debut || today();
  const finB = useDateFin({ init: init?.fin, min: init?.fin && init.fin < today() ? init.fin : today(), titre: 'Jusqu’au', obligatoire: true });
  const m = lireMontant(montant);
  const valide = !!m && (portee === 'global' || !!nom.trim()) && (duree === 'sans' || !!finB.fin);

  const enregistrer = () => {
    if (!m || !valide) return;
    const dates = duree === 'date' && finB.fin ? { fin: finB.fin, ...(couvre === 'tout' ? { debut, enveloppe: true } : init?.debut ? { debut: init.debut } : {}) } : {};
    const b: Budget = { id: init?.id || uid(), nom: portee === 'global' ? nom.trim() || 'Budget total' : nom.trim(), emoji: portee === 'global' ? '💰' : emoji, montant: m, periode, ...(portee === 'global' ? { global: true } : suit?.length ? { categories: suit } : {}), ...dates };
    // Un seul budget global : en créer un remplace l'ancien.
    setF((f) => ({ ...f, budgets: init ? f.budgets.map((x) => (x.id === init.id ? b : b.global ? { ...x, global: undefined } : x)) : [...f.budgets.filter((x) => !(b.global && x.global)), b] }));
    onDone();
  };
  const supprimer = () => {
    if (!init) return;
    setF((f) => ({ ...f, budgets: f.budgets.filter((x) => x.id !== init.id), depenses: f.depenses.map((x) => (x.budget === init.id ? { ...x, budget: null } : x)) }));
    onDone();
  };

  return (
    <Panel title={init ? 'Modifier le budget' : 'Nouveau budget'} accent>
      <Seg
        label="Ce budget couvre"
        options={[
          { key: 'categorie', label: 'Une catégorie' },
          { key: 'global', label: 'Toutes mes dépenses' },
        ]}
        value={portee}
        onChange={setPortee}
      />
      <Input label={portee === 'global' ? 'Nom (facultatif)' : 'Catégorie'} value={nom} onChangeText={setNom} placeholder={portee === 'global' ? 'Budget total' : 'Ex. Courses, Sorties, Transport'} />
      {portee === 'categorie' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {EMOJIS_BUDGET.map((x) => (
            <Pressable key={x} accessibilityRole="radio" aria-checked={x === emoji} accessibilityLabel={`Icône ${x}`} onPress={() => setEmoji(x)} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: x === emoji ? C.accent : C.line, backgroundColor: x === emoji ? alpha(C.accent, 0.14) : 'transparent' }}>
              <Text style={{ fontSize: 18 }}>{x}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {portee === 'categorie' ? (
        <>
          <ChoixCategories label="Ce budget suit (facultatif)" value={suit} onChange={setSuit} />
          <T small muted>Les dépenses qui portent l’une de ces catégories comptent dans ce budget, sans le choisir à chaque fois.</T>
        </>
      ) : null}
      <Seg
        label="Durée"
        options={[
          { key: 'sans', label: 'Sans fin' },
          { key: 'date', label: 'Jusqu’à une date' },
        ]}
        value={duree}
        onChange={setDuree}
      />
      {duree === 'date' ? (
        <>
          {finB.element}
          <Seg
            label="Le montant"
            options={[
              { key: 'tout', label: 'Pour toute la durée' },
              { key: 'periode', label: 'Revient chaque période' },
            ]}
            value={couvre}
            onChange={setCouvre}
          />
        </>
      ) : null}
      <Input label={duree === 'date' && couvre === 'tout' ? 'Montant pour toute la durée' : 'Montant maximum'} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" placeholder={duree === 'date' && couvre === 'tout' ? 'Ex. 500' : 'Ex. 400'} />
      {duree === 'date' && couvre === 'tout' ? (
        m && finB.fin ? (
          <T small muted>
            Du {dateFr(debut)} au {dateFr(finB.fin)} : {fmtMontant(m, f.devise)} en tout, soit environ {fmtMontant(Math.round((m / jours(debut, finB.fin)) * 100) / 100, f.devise)} par jour.
          </T>
        ) : null
      ) : (
        <Seg label="Pour chaque" options={PERIODES.map((p) => ({ key: p.key, label: p.label }))} value={periode} onChange={setPeriode} />
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Enregistrer" onPress={enregistrer} disabled={!valide} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
        {init ? <Btn kind="danger" label="Supprimer" onPress={supprimer} /> : null}
      </View>
    </Panel>
  );
}

/** Nouvelle dépense, ou modification d'une dépense déjà notée (`init`). */
function DepenseForm({ f, init, onDone, setF }: { f: Finances; init?: Depense; onDone: () => void; setF: (fn: (f: Finances) => Finances) => void }) {
  const { ajouterDepense } = useActions();
  const [montant, setMontant] = useState(init ? String(init.origine?.montant ?? init.montant).replace('.', ',') : '');
  const [budget, setBudget] = useState<string | null>(init?.budget ?? null);
  const [note, setNote] = useState(init?.note || '');
  const [cats, setCats] = useState<string[] | undefined>(init?.categories);
  const [repetition, setRepetition] = useState<Repetition>('une');
  const { date, element: choixDate } = useChoixDate(init?.date);
  const finRep = useDateFin({ min: date || today(), titre: "Jusqu'au (facultatif)" });
  const dev = useChoixDevise(f, init?.origine);
  const lu = lireMontant(montant);
  const conv = lu ? dev.convertir(lu) : null;
  // Les budgets qui comptent à la date de la dépense (un budget terminé ne se propose plus), plus celui déjà choisi.
  const categories = f.budgets.filter((b) => !b.global && (b.id === budget || etatBudget(b, date || today()) === 'en_cours'));
  // Budget qui comptera la dépense : celui choisi, sinon celui qui suit l'une de ses catégories.
  const suivi = budgetDe(f.budgets, { budget, categories: cats, date: date || today() });
  const valide = !!conv && !!date && !(repetition !== 'une' && finRep.invalide);

  const enregistrer = () => {
    if (!conv || !date || !valide) return;
    const { montant: m, origine } = conv;
    if (init) setF((g) => ({ ...dev.avecTaux(g), depenses: g.depenses.map((x) => (x.id === init.id ? poser({ ...x, montant: m, origine, budget, note: note.trim(), date }, cats) : x)) }));
    else if (repetition !== 'une') {
      setF((g) => dev.avecTaux(g));
      creerRecurrence(setF, { genre: 'depense', montant: m, origine, note: note.trim(), budget, ...(cats?.length ? { categories: cats } : {}), frequence: repetition, debut: date, ...(finRep.fin ? { fin: finRep.fin } : {}) });
    } else {
      setF((g) => dev.avecTaux(g));
      ajouterDepense({ id: uid(), montant: m, origine, budget, ...(cats?.length ? { categories: cats } : {}), note: note.trim(), date, creeLe: new Date().toISOString() });
    }
    onDone();
  };
  const supprimer = () => {
    if (!init) return;
    setF((g) => ({ ...g, depenses: g.depenses.filter((x) => x.id !== init.id) }));
    onDone();
  };

  return (
    <Panel title={init ? 'Modifier la dépense' : 'Nouvelle dépense'} accent>
      <Input label={`Montant (${dev.devise})`} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" placeholder="Ex. 12,50" autoFocus={!init} returnKeyType="done" onSubmitEditing={enregistrer} />
      {dev.element}
      {conv?.origine ? <T small muted>≈ {fmtMontant(conv.montant, f.devise)}</T> : null}
      {categories.length ? (
        <View style={{ gap: 6 }}>
          <T small muted>
            Budget
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {categories.map((b) => (
              <Puce key={b.id} label={`${b.emoji} ${b.nom}`} on={budget === b.id} onPress={() => setBudget(budget === b.id ? null : b.id)} />
            ))}
            <Puce label="Hors budget" on={budget === null} onPress={() => setBudget(null)} />
          </View>
        </View>
      ) : null}
      <ChoixCategories value={cats} onChange={setCats} />
      {!budget && suivi ? <T small muted>{`Comptée dans « ${suivi.emoji} ${suivi.nom} », qui suit ${cats && cats.length > 1 ? 'ces catégories' : 'cette catégorie'}.`}</T> : null}
      <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Ex. Marché du samedi" returnKeyType="done" onSubmitEditing={enregistrer} />
      {choixDate}
      {init ? (
        init.recurrence ? (
          <T small muted>
            Paiement récurrent : la modification ne change que cette fois-ci.
          </T>
        ) : null
      ) : (
        <ChoixRepetition value={repetition} onChange={setRepetition} date={date} fin={finRep.element} />
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={init ? 'Enregistrer' : 'Ajouter la dépense'} onPress={enregistrer} disabled={!valide} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
        {init ? <Btn kind="danger" label="Supprimer" onPress={supprimer} /> : null}
      </View>
    </Panel>
  );
}

/** Les dépenses de la période, regroupées par jour, avec filtre par budget et recherche ; toucher une dépense la modifie. */
function ListeDepenses({ f, b, sel, setF }: { f: Finances; b: Bilan; sel: ReturnType<typeof useSelection>; setF: (fn: (f: Finances) => Finances) => void }) {
  const d = today();
  const [filtre, setFiltre] = useState<string>('tous');
  const [filtreCat, setFiltreCat] = useState<string>('toutes');
  const [cherche, setCherche] = useState('');
  const [edition, setEdition] = useState<string | null>(null);
  const { espace } = useStore();
  const catalogue = categoriesDe(espace);
  const categories = f.budgets.filter((x) => !x.global);
  const ids = new Set(categories.map((x) => x.id));
  const nomBudget = (id: string | null) => categories.find((x) => x.id === id);
  // Le budget qui compte une dépense : celui choisi, sinon celui qui suit l'une de ses catégories.
  const effectif = (x: Depense) => idBudgetDe(f.budgets, x);
  const nomsCategories = (x: Depense) => catalogue.filter((c) => x.categories?.includes(c.id)).map((c) => c.nom.toLowerCase());
  const q = cherche.trim().toLowerCase();
  const liste = b.depenses.filter(
    (x) =>
      (filtre === 'tous' || (filtre === 'hors' ? !effectif(x) : effectif(x) === filtre)) &&
      (filtreCat === 'toutes' || (filtreCat === 'aucune' ? !x.categories?.length : !!x.categories?.includes(filtreCat))) &&
      (!q || x.note.toLowerCase().includes(q) || (nomBudget(effectif(x))?.nom.toLowerCase().includes(q) ?? false) || nomsCategories(x).some((n) => n.includes(q)) || String(x.montant).includes(q)),
  );
  const jours = [...new Set(liste.map((x) => x.date))];
  const total = Math.round(liste.reduce((s, x) => s + x.montant, 0) * 100) / 100;

  return (
    <Panel title="Dépenses" count={liste.length || undefined} right={liste.length ? <BoutonSelection sel={sel} /> : null}>
      {b.depenses.length > 4 || q ? <Input value={cherche} onChangeText={setCherche} placeholder="Rechercher une note, un budget, un montant" accessibilityLabel="Rechercher une dépense" /> : null}
      {categories.length && b.depenses.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Puce label="Toutes" on={filtre === 'tous'} onPress={() => setFiltre('tous')} />
          {categories.map((c) => (
            <Puce key={c.id} label={`${c.emoji} ${c.nom}`} on={filtre === c.id} onPress={() => setFiltre(filtre === c.id ? 'tous' : c.id)} />
          ))}
          <Puce label="Hors budget" on={filtre === 'hors'} onPress={() => setFiltre(filtre === 'hors' ? 'tous' : 'hors')} />
        </View>
      ) : null}
      {catalogue.length && b.depenses.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Puce label="Toutes catégories" on={filtreCat === 'toutes'} onPress={() => setFiltreCat('toutes')} />
          {catalogue.map((c) => (
            <Puce key={c.id} label={`${c.emoji} ${c.nom}`} on={filtreCat === c.id} onPress={() => setFiltreCat(filtreCat === c.id ? 'toutes' : c.id)} />
          ))}
          <Puce label="Sans catégorie" on={filtreCat === 'aucune'} onPress={() => setFiltreCat(filtreCat === 'aucune' ? 'toutes' : 'aucune')} />
        </View>
      ) : null}
      {filtre !== 'tous' || filtreCat !== 'toutes' || q ? (
        <T small muted>
          {liste.length} dépense{liste.length > 1 ? 's' : ''} · {fmtMontant(total, f.devise)}
        </T>
      ) : null}
      {liste.length ? (
        jours.map((jour) => {
          const du = liste.filter((x) => x.date === jour);
          return (
            <View key={jour} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{titreJour(jour, d)}</Text>
                <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{fmtMontant(Math.round(du.reduce((s, x) => s + x.montant, 0) * 100) / 100, f.devise)}</Text>
              </View>
              {du.map((x) => {
                const bu = nomBudget(effectif(x));
                if (edition === x.id) return <DepenseForm key={x.id} f={f} init={x} onDone={() => setEdition(null)} setF={setF} />;
                return (
                  <Selectionnable key={x.id} sel={sel} id={x.id} label={`${fmtMontant(x.montant, f.devise)} ${x.note || bu?.nom || ''}`}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Modifier ${fmtMontant(x.montant, f.devise)} ${x.note || bu?.nom || 'dépense'}`}
                      disabled={sel.actif}
                      onPress={() => setEdition(x.id)}
                      onLongPress={() => sel.demarrer(x.id)}
                      delayLongPress={450}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
                      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.sunk, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 16 }}>{bu?.emoji || (x.recurrence ? '🔁' : '💸')}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 15 }}>
                          {x.note || bu?.nom || 'Dépense'}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                          <T small muted>
                            {bu ? (x.note ? bu.nom : 'Budget') : 'Hors budget'}
                            {x.recurrence ? ' · récurrent' : ''}
                          </T>
                          <EtiquettesCategories ids={x.categories} />
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>{fmtMontant(x.montant, f.devise)}</Text>
                        {libelleOrigine(x.origine, f.devise) ? <T small muted>{libelleOrigine(x.origine, f.devise)}</T> : null}
                      </View>
                      {!sel.actif ? <Text style={{ color: C.muted, fontSize: 18 }}>›</Text> : null}
                    </Pressable>
                  </Selectionnable>
                );
              })}
            </View>
          );
        })
      ) : b.depenses.length ? (
        <Empty icone="portefeuille">Aucune dépense ne correspond.</Empty>
      ) : (
        <Empty icone="portefeuille">Aucune dépense sur cette période. Ajoute-en une avec « + Dépense », ou écris « 12 € courses » avec le bouton + de l'accueil.</Empty>
      )}
    </Panel>
  );
}

const ecartPct = (v: number, avant: number) => (avant ? Math.round(((v - avant) / avant) * 100) : null);
const fmtEcart = (e: number | null) => (e === null ? '' : e === 0 ? 'stable' : `${e > 0 ? '+' : '−'}${Math.abs(e)} %`);
// Singulier, pluriel, et l'accord de « dernier » (une semaine, un mois…).
const NOM_PERIODE: Record<Periode, [string, string, string]> = { jour: ['jour', 'jours', 'derniers'], semaine: ['semaine', 'semaines', 'dernières'], mois: ['mois', 'mois', 'derniers'], trimestre: ['trimestre', 'trimestres', 'derniers'], annee: ['année', 'années', 'dernières'] };

export type PartieStats = 'evolution' | 'repartition' | 'jours';

function StatsFinances({ f, vue, jourRef, partie }: { f: Finances; vue: Periode; jourRef: string; partie: PartieStats }) {
  const d = today();
  const s = useMemo(() => statsFinances(f, vue, jourRef, d), [f, vue, jourRef, d]);
  const [un, plusieurs, derniers] = NOM_PERIODE[vue];
  const pl = (n: number) => (n > 1 ? 's' : '');
  if (!f.depenses.length) return <Empty icone="stats">Les statistiques apparaissent dès ta première dépense.</Empty>;
  const maxBudget = Math.max(1, ...s.parBudget.map((x) => x.v));
  const maxJour = Math.max(1, ...s.parJourSemaine.map((x) => x.v));
  const ecart = ecartPct(s.bilan.total, s.totalAvant);

  return (
    <>
      {partie === 'evolution' ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Tuile emoji="💸" titre="dépensés sur la période" valeur={fmtMontant(s.bilan.total, f.devise)} evolution={s.totalAvant ? `${fmtEcart(ecart)} vs la période d'avant` : undefined} />
            {vue === 'jour' ? (
              <Tuile emoji="📆" titre="budget du jour" valeur={s.bilan.plafondTotal ? fmtMontant(s.bilan.plafondTotal, f.devise) : '–'} evolution={s.bilan.plafondTotal ? (s.bilan.total > s.bilan.plafondTotal ? `dépassé de ${fmtMontant(Math.round((s.bilan.total - s.bilan.plafondTotal) * 100) / 100, f.devise)}` : `reste ${fmtMontant(Math.round((s.bilan.plafondTotal - s.bilan.total) * 100) / 100, f.devise)}`) : undefined} />
            ) : (
              <Tuile emoji="📆" titre="en moyenne par jour" valeur={s.parJourMoyen !== null ? fmtMontant(s.parJourMoyen, f.devise) : '–'} evolution={s.joursEcoules ? `sur ${s.joursEcoules} jour${s.joursEcoules > 1 ? 's' : ''}` : undefined} />
            )}
            <Tuile emoji="🧾" titre={`dépense${pl(s.nombre)} notée${pl(s.nombre)}`} valeur={String(s.nombre)} evolution={s.panier !== null ? `${fmtMontant(s.panier, f.devise)} en moyenne` : undefined} />
            <Tuile
              emoji="🌿"
              titre={vue === 'jour' ? `jour${pl(s.historique.filter((x) => !x.v).length)} sans dépense sur les ${s.historique.length} derniers` : `jour${pl(s.joursSansDepense ?? 0)} sans dépense`}
              valeur={vue === 'jour' ? String(s.historique.filter((x) => !x.v).length) : s.joursSansDepense !== null ? String(s.joursSansDepense) : '–'} evolution={s.plusGrosse ? `Plus grosse : ${fmtMontant(s.plusGrosse.montant, f.devise)}${s.plusGrosse.note ? ` (${s.plusGrosse.note})` : ''}` : undefined} />
          </View>

          <Panel title={`Évolution par ${un}`}>
            <Barres key={`${vue}-${jourRef}`} seuil={vue === 'jour' && s.bilan.plafondTotal ? s.bilan.plafondTotal : undefined} points={s.historique.map((x) => ({ cle: x.cle, axe: x.axe, v: x.v, detail: `${x.libelle} : ${fmtMontant(x.v, f.devise)}${x.plafond ? ` sur ${fmtMontant(Math.round(x.plafond), f.devise)}` : ''}` }))} />
            <T small muted>
              {s.moyenne !== null ? `Moyenne des ${s.historique.length - 1} ${s.historique.length - 1 > 1 ? plusieurs : un} d'avant : ${fmtMontant(Math.round(s.moyenne), f.devise)}.` : `Pas encore de ${un} précédent pour comparer.`}
              {s.respect ? ` Budget tenu ${s.respect.tenues} fois sur ${s.respect.sur}.` : ''}
            </T>
          </Panel>
        </>
      ) : null}

      {partie === 'repartition' ? (
        <>
          <Panel title="Par budget">
            {s.parBudget.length ? (
              s.parBudget.map((x) => (
                <Part key={x.id} libelle={x.nom} valeur={x.v ? `${fmtMontant(x.v, f.devise)} · ${s.bilan.total ? Math.round((x.v / s.bilan.total) * 100) : 0} %${x.avant ? ` · ${fmtEcart(ecartPct(x.v, x.avant))}` : ''}` : `0 · avant ${fmtMontant(x.avant, f.devise)}`} ratio={x.v / maxBudget} />
              ))
            ) : (
              <T small muted>
                Aucune dépense sur la période.
              </T>
            )}
            {s.parBudget.some((x) => x.avant) ? (
              <T small muted>
                Le dernier chiffre compare avec la période d'avant.
              </T>
            ) : null}
          </Panel>
          {s.postes.length ? (
            <Panel title="Où part ton argent">
              {s.postes.map((x) => (
                <Part key={x.nom} libelle={x.nom} valeur={`${fmtMontant(x.v, f.devise)} · ${x.n} fois`} ratio={x.v / s.postes[0].v} />
              ))}
              <T small muted>
                Les notes qui reviennent le plus sur la période.
              </T>
            </Panel>
          ) : null}
        </>
      ) : null}

      {partie === 'jours' ? (
        <Panel title="Par jour de la semaine">
          {s.parJourSemaine.map((x) => (
            <Part key={x.jour} libelle={x.jour[0].toUpperCase() + x.jour.slice(1)} valeur={fmtMontant(x.v, f.devise)} ratio={x.v / maxJour} />
          ))}
          <T small muted>
            {s.historique.length > 1 ? `Sur les ${s.historique.length} ${derniers} ${plusieurs}` : `Sur ${derniers === 'derniers' ? 'ce' : 'cette'} ${un}`}
            {s.jourLePlusCher ? ` : c'est le ${s.jourLePlusCher} que tu dépenses le plus.` : '.'}
          </T>
        </Panel>
      ) : null}
    </>
  );
}

type Onglet = 'apercu' | 'budgets' | 'operations' | 'comptes' | 'analyses' | 'reglages';
type SousOps = 'depenses' | 'revenus' | 'tout';
type SousReglages = 'alertes' | 'recurrents' | 'devises';

/** Sous-titre d'un budget : son montant et, s'il en a, ses dates. */
function detailBudget(b: Budget, devise: string) {
  const m = fmtMontant(b.montant, devise);
  if (b.fin && b.enveloppe && b.debut) return `${m} du ${dateFr(b.debut)} au ${dateFr(b.fin)}`;
  return `${m} ${parPeriode(b.periode)}${b.fin ? ` · jusqu'au ${dateFr(b.fin)}` : ''}`;
}

export default function FinancesEcran() {
  const { espace, update } = useStore();
  const f = financesDe(espace);
  const d = today();
  const [onglet, setOnglet] = useState<Onglet>('apercu');
  const [sousOps, setSousOps] = useState<SousOps>('depenses');
  const [sousStats, setSousStats] = useState<PartieStats>('evolution');
  const [sousReglages, setSousReglages] = useState<SousReglages>('alertes');
  const [vue, setVue] = useState<Periode>('mois');
  const [decal, setDecal] = useState(0);
  const [form, setForm] = useState<'depense' | 'budget' | Budget | null>(null);
  const sel = useSelection();
  // Import d'un relevé en cours (avec le compte déjà choisi, le cas échéant) ; filtres d'ouverture de « Tout l'historique ».
  const [importer, setImporter] = useState<{ compte: string | null } | null>(null);
  const [msgImport, setMsgImport] = useState('');
  const [opsFiltre, setOpsFiltre] = useState<Partial<Filtres> | undefined>(undefined);
  const [opsCle, setOpsCle] = useState(0);
  const setF = (fn: (f: Finances) => Finances) => update((e) => ({ ...e, finances: fn(financesDe(e)) }));
  // Une échéance a pu tomber depuis l'ouverture de l'app (passage à minuit, au mois suivant).
  useEffect(() => {
    update((e) => {
      const g = e.finances && genererRecurrences(e.finances, today());
      return g && g !== e.finances ? { ...e, finances: g } : e;
    });
  }, [update]);

  const aller = (o: Onglet, sous?: SousOps) => {
    setOnglet(o);
    if (sous) setSousOps(sous);
    if (sel.actif) sel.fermer();
  };
  const jourRef = decaler(vue, d, decal);
  // Depuis « Jour par jour » : la vue Jour, sur les dépenses de ce jour-là.
  const voirJour = (x: string) => {
    setVue('jour');
    setDecal(Math.round((parse(x).getTime() - parse(d).getTime()) / 864e5));
    aller('operations', 'depenses');
  };
  const b = bilan(f, vue, jourRef, d);
  const precedent = bilan(f, vue, decaler(vue, jourRef, -1), d).total;
  const ecart = precedent ? Math.round(((b.total - precedent) / precedent) * 100) : null;
  const ratio = b.plafondTotal ? b.total / b.plafondTotal : 0;
  const categories = f.budgets.filter((x) => !x.global);
  // Budget journalier proposé : la moyenne des 30 derniers jours, arrondie aux 5 du dessus (20 sans historique).
  const moyenne30 = depensesEntre(f, addDays(d, -29), d).reduce((s, x) => s + x.montant, 0) / 30;
  const suggestionJour = moyenne30 > 0 ? Math.max(5, Math.ceil(moyenne30 / 5) * 5) : 20;
  const idees = BUDGETS_SUGGERES.filter((x) => !f.budgets.some((y) => y.nom.toLowerCase() === x.nom.toLowerCase()));
  // Budgets arrivés à leur date de fin : ils ne comptent plus, mais restent modifiables (pour les prolonger) ou supprimables.
  const termines = f.budgets.filter((x) => x.fin && x.fin < d).sort((x, y) => y.fin!.localeCompare(x.fin!));

  const actionsLot = [
    ...categories.slice(0, 4).map((c) => ({ label: `→ ${c.emoji} ${c.nom}`, onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (ids.includes(x.id) ? { ...x, budget: c.id } : x)) })) })),
    ...categoriesDe(espace).slice(0, 4).map((c) => ({ label: `+ ${c.emoji} ${c.nom}`, onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (ids.includes(x.id) ? poser(x, x.categories?.includes(c.id) ? x.categories : [...(x.categories ?? []), c.id]) : x)) })) })),
    ...(categoriesDe(espace).length ? [{ label: 'Retirer les catégories', onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (ids.includes(x.id) ? poser(x, undefined) : x)) })) }] : []),
    ...(categories.length ? [{ label: '→ Hors budget', onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (ids.includes(x.id) ? { ...x, budget: null } : x)) })) }] : []),
    { label: 'Supprimer', danger: true, onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.filter((x) => !ids.includes(x.id)) })) },
  ];

  const importerReleve = (compte?: string | null) => {
    setImporter({ compte: compte ?? null });
    setMsgImport('');
    aller('comptes');
  };
  const voirOperations = (filtre: Partial<Filtres>) => {
    setOpsFiltre(filtre);
    setOpsCle((k) => k + 1);
    aller('operations', 'tout');
  };

  const periode = (
    <>
      <SousOnglets
        label="Période"
        options={PERIODES.map((p) => ({ key: p.key, label: p.label }))}
        value={vue}
        onChange={(v) => {
          setVue(v);
          setDecal(0);
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn label="Période précédente" glyph="‹" onPress={() => setDecal(decal - 1)} />
        <Pressable accessibilityRole="button" accessibilityLabel={decal ? 'Revenir à la période en cours' : libelle(vue, jourRef)} disabled={!decal} onPress={() => setDecal(0)} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>{libelle(vue, jourRef)}</Text>
          {decal ? <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 12 }}>Revenir à la période en cours</Text> : null}
        </Pressable>
        <IconBtn label="Période suivante" glyph="›" onPress={() => setDecal(decal + 1)} />
      </View>
    </>
  );
  const avecPeriode = onglet === 'apercu' || onglet === 'budgets' || onglet === 'analyses' || (onglet === 'operations' && sousOps !== 'tout');
  const enDepenses = onglet === 'operations' && sousOps === 'depenses';

  return (
    <Screen pied={sel.actif && enDepenses ? <BarreSelection sel={sel} tous={b.depenses.map((x) => x.id)} actions={actionsLot} onglets={false} /> : null}>
      <Header retour eyebrow="Budgets et dépenses" title="Finances" right={form !== 'depense' ? <Btn small label="+ Dépense" onPress={() => setForm('depense')} /> : null} />

      {form === 'depense' ? <DepenseForm f={f} onDone={() => setForm(null)} setF={setF} /> : null}

      <Onglets
        options={[
          { key: 'apercu', label: 'Aperçu' },
          { key: 'budgets', label: 'Budgets', compte: f.budgets.length - termines.length || undefined },
          { key: 'operations', label: 'Opérations' },
          { key: 'comptes', label: 'Comptes' },
          { key: 'analyses', label: 'Analyses' },
          { key: 'reglages', label: 'Réglages' },
        ]}
        value={onglet}
        onChange={(o) => aller(o)}
      />

      {onglet === 'operations' ? (
        <SousOnglets
          label="Opérations"
          options={[
            { key: 'depenses', label: 'Dépenses' },
            { key: 'revenus', label: 'Revenus' },
            { key: 'tout', label: "Tout l'historique" },
          ]}
          value={sousOps}
          onChange={(o) => aller('operations', o)}
        />
      ) : null}
      {onglet === 'analyses' ? (
        <SousOnglets
          label="Analyses"
          options={[
            { key: 'evolution', label: 'Évolution' },
            { key: 'repartition', label: 'Répartition' },
            { key: 'jours', label: 'Jours' },
          ]}
          value={sousStats}
          onChange={setSousStats}
        />
      ) : null}

      {avecPeriode ? periode : null}

      {onglet === 'apercu' ? (
        <>
          <Panel>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <View>
                <T small muted>
                  Dépensé
                </T>
                <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 32 }}>{fmtMontant(b.total, f.devise)}</Text>
              </View>
              {b.plafondTotal ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <T small muted>
                    {b.total > b.plafondTotal ? 'Dépassé de' : 'Reste'}
                  </T>
                  <Text style={{ color: couleurRatio(ratio), fontFamily: F.chiffre, fontSize: 22 }}>{fmtMontant(Math.abs(b.plafondTotal - b.total), f.devise)}</Text>
                </View>
              ) : null}
            </View>
            {b.plafondTotal ? (
              <>
                <Jauge ratio={ratio} hauteur={10} />
                <T small muted>
                  {Math.round(ratio * 100)} % de {fmtMontant(b.plafondTotal, f.devise)}
                  {f.budgets.some((x) => x.global) ? ' (budget total)' : ' (somme des budgets)'}
                </T>
              </>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => aller('budgets')} style={{ alignSelf: 'flex-start' }}>
                <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Crée un budget pour voir ce qu'il te reste à dépenser ›</Text>
              </Pressable>
            )}
            {vue !== 'jour' && b.enCours && b.parJour !== null && b.total <= b.plafondTotal ? (
              <T small>
                Tu peux encore dépenser environ <Text style={{ fontFamily: F.texteF, color: C.ink }}>{fmtMontant(b.parJour, f.devise)} par jour</Text> jusqu'au {fmtCourt(b.fin).replace(/\.$/, '')}.
              </T>
            ) : null}
            {vue !== 'jour' && b.projection !== null && b.plafondTotal ? (
              <T small style={{ color: b.projection > b.plafondTotal ? C.agressif : C.muted }}>
                À ce rythme : environ {fmtMontant(Math.round(b.projection), f.devise)} à la fin de la période{b.projection > b.plafondTotal ? ', au-dessus du budget.' : '.'}
              </T>
            ) : null}
            {ecart !== null ? (
              <T small muted>
                {ecart === 0 ? 'Autant que' : `${ecart > 0 ? '+' : ''}${ecart} % par rapport à`} la période précédente ({fmtMontant(precedent, f.devise)}).
              </T>
            ) : null}
            {b.depenses.length ? (
              <Pressable accessibilityRole="button" onPress={() => aller('operations', 'depenses')} style={{ alignSelf: 'flex-start' }}>
                <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>
                  {b.depenses.length > 1 ? `Voir les ${b.depenses.length} dépenses` : 'Voir la dépense'} ›
                </Text>
              </Pressable>
            ) : null}
          </Panel>

          {!comptesDe(f).length ? (
            <Panel accent>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 200, gap: 2 }}>
                  <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>Importe ton relevé bancaire (CSV)</Text>
                  <T small muted>
                    Toutes tes opérations d’un coup, rangées par compte, sans doublons.
                  </T>
                </View>
                <Btn small label="Importer un CSV" onPress={() => importerReleve(null)} />
              </View>
            </Panel>
          ) : null}

          {vue === 'semaine' || vue === 'mois' ? <JourParJour key={`${vue}-${jourRef}`} f={f} vue={vue} jourRef={jourRef} voirJour={voirJour} /> : null}
        </>
      ) : null}

      {onglet === 'budgets' ? (
        <>
          {form && form !== 'depense' ? <BudgetForm key={form === 'budget' ? 'nouveau' : form.id} f={f} init={form === 'budget' ? undefined : form} onDone={() => setForm(null)} setF={setF} /> : null}

          <Panel title="Budgets" count={b.lignes.length || undefined} right={form !== 'budget' ? <Btn small kind="sec" label="+ Budget" onPress={() => setForm('budget')} /> : null}>
            {b.lignes.length ? (
              [...b.lignes]
                .sort((x, y) => Number(!!y.budget.global) - Number(!!x.budget.global) || y.ratio - x.ratio)
                .map((l, i) => {
                  const suivi = l.budget.enveloppe ? suiviBudgetDate(f, l.budget, d) : null;
                  return (
                    <View key={l.budget.id}>
                      {i ? <Sep /> : null}
                      <Pressable accessibilityRole="button" accessibilityLabel={`Modifier le budget ${l.budget.nom}`} onPress={() => setForm(l.budget)} style={({ pressed }) => ({ gap: 8, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.sunk, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 18 }}>{l.budget.emoji}</Text>
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <T style={{ fontFamily: F.texteF }}>{l.budget.nom}</T>
                            <T small muted>
                              {detailBudget(l.budget, f.devise)}
                              {l.converti ? ` · ≈ ${fmtMontant(Math.round(l.plafond), f.devise)} sur la période` : ''}
                            </T>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>{fmtMontant(l.depense, f.devise)}</Text>
                            <Text style={{ color: couleurRatio(l.ratio), fontFamily: F.texteM, fontSize: 12 }}>{l.reste >= 0 ? `reste ${fmtMontant(Math.round(l.reste * 100) / 100, f.devise)}` : `+${fmtMontant(-l.reste, f.devise)}`}</Text>
                          </View>
                        </View>
                        <Jauge ratio={l.ratio} />
                        {suivi ? (
                          <T small muted>
                            {`Depuis le ${dateFr(suivi.debut)} : ${fmtMontant(suivi.depense, f.devise)} sur ${fmtMontant(suivi.total, f.devise)}. `}
                            {suivi.reste < 0 ? `Dépassé de ${fmtMontant(-suivi.reste, f.devise)}.` : suivi.joursRestants ? `Reste ${fmtMontant(suivi.reste, f.devise)}, soit environ ${fmtMontant(suivi.parJour, f.devise)} par jour pendant ${suivi.joursRestants} jour${suivi.joursRestants > 1 ? 's' : ''}.` : `Reste ${fmtMontant(suivi.reste, f.devise)}.`}
                          </T>
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })
            ) : (
              <Empty icone="portefeuille">{f.budgets.length ? 'Aucun budget ne compte sur cette période.' : 'Aucun budget. Choisis une catégorie et un montant pour un jour, une semaine, un mois, ou jusqu’à une date.'}</Empty>
            )}
            {(idees.length || !f.budgets.some((x) => x.global)) && f.budgets.length < 4 ? (
              <View style={{ gap: 8 }}>
                <T small muted>
                  {f.budgets.length ? 'Autres idées, en un geste :' : 'Pour commencer en un geste :'}
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {!f.budgets.some((x) => x.global) ? (
                    <Puce key="jour" label={`💰 Budget total · ${fmtMontant(suggestionJour, f.devise)} par jour`} on={false} onPress={() => setF((g) => ({ ...g, budgets: [...g.budgets.filter((x) => !x.global), { id: uid(), nom: 'Budget du jour', emoji: '💰', montant: suggestionJour, periode: 'jour', global: true }] }))} />
                  ) : null}
                  {idees.map((x) => (
                    <Puce key={x.nom} label={`${x.emoji} ${x.nom} · ${fmtMontant(x.montant, f.devise)} ${parPeriode(x.periode)}`} on={false} onPress={() => setF((g) => ({ ...g, budgets: [...g.budgets, { ...x, id: uid() }] }))} />
                  ))}
                </View>
              </View>
            ) : null}
            {b.horsBudget && categories.length ? (
              <T small muted>
                Hors budget sur la période : {fmtMontant(b.horsBudget, f.devise)}
              </T>
            ) : null}
          </Panel>

          {decal === 0 ? <PanneauPrevisions f={f} d={d} seuil={f.alertes?.seuil ?? 1} /> : null}

          {termines.length ? (
            <Panel title="Budgets terminés" count={termines.length}>
              {termines.map((x, i) => (
                <View key={x.id}>
                  {i ? <Sep /> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Modifier le budget ${x.nom}`} onPress={() => setForm(x)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
                    <Text style={{ fontSize: 16 }}>{x.emoji}</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T>{x.nom}</T>
                      <T small muted>
                        {detailBudget(x, f.devise)} · terminé
                      </T>
                    </View>
                    <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Prolonger ›</Text>
                  </Pressable>
                </View>
              ))}
            </Panel>
          ) : null}
        </>
      ) : null}

      {enDepenses ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn small kind="sec" label="Importer un relevé bancaire (CSV)" onPress={() => importerReleve(null)} />
            {msgImport ? <T small muted>{msgImport}</T> : null}
          </View>
          <ListeDepenses key={`${vue}-${jourRef}`} f={f} b={b} sel={sel} setF={setF} />
        </>
      ) : null}

      {onglet === 'operations' && sousOps === 'revenus' ? <PanneauRevenus f={f} debut={b.debut} fin={b.fin} depense={b.total} setF={setF} /> : null}

      {onglet === 'operations' && sousOps === 'tout' ? (
        <>
          {msgImport ? <T small muted>{msgImport}</T> : null}
          <Operations key={opsCle} f={f} setF={setF} filtreInitial={opsFiltre} />
        </>
      ) : null}

      {onglet === 'comptes' ? (
        <>
          {msgImport && !importer ? <T small muted>{msgImport}</T> : null}
          {importer ? (
            <ImportReleve
              f={f}
              setF={setF}
              compteInitial={importer.compte}
              onDone={(m, compte) => {
                setImporter(null);
                setMsgImport(m);
                // Ce qui vient d'être importé a souvent une autre date que la période affichée : on l'ouvre dans « Tout l'historique ».
                if (m) voirOperations(compte ? { compte } : {});
              }}
            />
          ) : (
            <PanneauComptes f={f} setF={setF} onImporter={importerReleve} onVoir={voirOperations} />
          )}
        </>
      ) : null}

      {onglet === 'analyses' ? <StatsFinances f={f} vue={vue} jourRef={jourRef} partie={sousStats} /> : null}

      {onglet === 'reglages' ? (
        <>
          <SousOnglets
            label="Réglages"
            options={[
              { key: 'alertes', label: 'Alertes' },
              { key: 'recurrents', label: 'Récurrents', compte: (f.recurrences ?? []).length || undefined },
              { key: 'devises', label: 'Devises' },
            ]}
            value={sousReglages}
            onChange={setSousReglages}
          />
          {sousReglages === 'alertes' ? (
            f.budgets.length ? (
              <PanneauAlertes f={f} setF={setF} />
            ) : (
              <Panel title="Alertes de budget">
                <T small muted>
                  Crée un budget dans l’onglet Budgets pour régler les alertes de prévision.
                </T>
              </Panel>
            )
          ) : null}
          {sousReglages === 'recurrents' ? <PanneauRecurrences f={f} setF={setF} /> : null}
          {sousReglages === 'devises' ? <PanneauDevises f={f} setF={setF} /> : null}
        </>
      ) : null}
    </Screen>
  );
}
