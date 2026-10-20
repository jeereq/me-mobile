import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Barres, Part, Tuile } from '@/components/graphiques';
import { couleurRatio, Jauge } from '@/components/jauge';
import { PanneauAlertes, PanneauPrevisions } from '@/components/previsions';
import { BarreSelection, BoutonSelection, Selectionnable, useSelection } from '@/components/selection';
import { Btn, Empty, Header, IconBtn, Input, Panel, Screen, Sep, Seg, T } from '@/components/ui';
import { useActions } from '@/lib/actions';
import { addDays, fmtCourt, today, uid } from '@/lib/dates';
import { dateFr, lireDate, statsFinances, titreJour } from '@/lib/stats-finances';
import { bilan, type Bilan, BUDGETS_SUGGERES, decaler, EMOJIS_BUDGET, financesDe, fmtMontant, libelle, lireMontant, parPeriode, PERIODES } from '@/lib/finances';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Budget, Depense, Finances, Periode } from '@/lib/types';

const DEVISES = ['€', '$', 'FCFA', '£', 'CHF'];

function Puce({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" aria-checked={on} onPress={onPress} style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.14) : 'transparent', opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: on ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function BudgetForm({ init, onDone, setF }: { init?: Budget; onDone: () => void; setF: (fn: (f: Finances) => Finances) => void }) {
  const [nom, setNom] = useState(init?.nom || '');
  const [emoji, setEmoji] = useState(init?.emoji || '🛒');
  const [montant, setMontant] = useState(init ? String(init.montant).replace('.', ',') : '');
  const [periode, setPeriode] = useState<Periode>(init?.periode || 'mois');
  const [portee, setPortee] = useState<'categorie' | 'global'>(init?.global ? 'global' : 'categorie');
  const m = lireMontant(montant);
  const valide = !!m && (portee === 'global' || !!nom.trim());

  const enregistrer = () => {
    if (!m) return;
    const b: Budget = { id: init?.id || uid(), nom: portee === 'global' ? nom.trim() || 'Budget total' : nom.trim(), emoji: portee === 'global' ? '💰' : emoji, montant: m, periode, ...(portee === 'global' ? { global: true } : {}) };
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
      <Input label="Montant maximum" value={montant} onChangeText={setMontant} keyboardType="decimal-pad" placeholder="Ex. 400" />
      <Seg label="Pour chaque" options={PERIODES.map((p) => ({ key: p.key, label: p.label }))} value={periode} onChange={setPeriode} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Enregistrer" onPress={enregistrer} disabled={!valide} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
        {init ? <Btn kind="danger" label="Supprimer" onPress={supprimer} /> : null}
      </View>
    </Panel>
  );
}

const QUAND = (d: string) => [
  { key: d, label: "Aujourd'hui" },
  { key: addDays(d, -1), label: 'Hier' },
  { key: addDays(d, -2), label: 'Avant-hier' },
];

/** Nouvelle dépense, ou modification d'une dépense déjà notée (`init`). */
function DepenseForm({ f, init, onDone, setF }: { f: Finances; init?: Depense; onDone: () => void; setF: (fn: (f: Finances) => Finances) => void }) {
  const { ajouterDepense } = useActions();
  const d = today();
  const [montant, setMontant] = useState(init ? String(init.montant).replace('.', ',') : '');
  const [budget, setBudget] = useState<string | null>(init?.budget ?? null);
  const [note, setNote] = useState(init?.note || '');
  const [quand, setQuand] = useState<string>(init?.date || d);
  const presets = QUAND(d);
  const [autre, setAutre] = useState(init && !presets.some((x) => x.key === init.date) ? dateFr(init.date) : '');
  const m = lireMontant(montant);
  const dateAutre = autre ? lireDate(autre, d) : null;
  const date = autre ? dateAutre : quand;
  const categories = f.budgets.filter((b) => !b.global);
  const valide = !!m && !!date;

  const enregistrer = () => {
    if (!m || !date) return;
    if (init) setF((g) => ({ ...g, depenses: g.depenses.map((x) => (x.id === init.id ? { ...x, montant: m, budget, note: note.trim(), date } : x)) }));
    else ajouterDepense({ id: uid(), montant: m, budget, note: note.trim(), date, creeLe: new Date().toISOString() });
    onDone();
  };
  const supprimer = () => {
    if (!init) return;
    setF((g) => ({ ...g, depenses: g.depenses.filter((x) => x.id !== init.id) }));
    onDone();
  };

  return (
    <Panel title={init ? 'Modifier la dépense' : 'Nouvelle dépense'} accent>
      <Input label={`Montant (${f.devise})`} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" placeholder="Ex. 12,50" autoFocus={!init} returnKeyType="done" onSubmitEditing={enregistrer} />
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
      <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Ex. Marché du samedi" returnKeyType="done" onSubmitEditing={enregistrer} />
      <View style={{ gap: 6 }}>
        <T small muted>
          Date
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {presets.map((x) => (
            <Puce
              key={x.key}
              label={x.label}
              on={!autre && quand === x.key}
              onPress={() => {
                setQuand(x.key);
                setAutre('');
              }}
            />
          ))}
          <View style={{ width: 150 }}>
            <Input value={autre} onChangeText={setAutre} placeholder="Autre : JJ/MM" accessibilityLabel="Autre date, au format JJ/MM ou JJ/MM/AAAA" keyboardType="numbers-and-punctuation" style={{ paddingVertical: 7, borderColor: autre ? (dateAutre ? C.accent : C.agressif) : undefined }} />
          </View>
        </View>
        {autre && !dateAutre ? (
          <T small style={{ color: C.agressif }}>
            Date non reconnue : écris par exemple 14/10 ou 14/10/2026.
          </T>
        ) : null}
      </View>
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
  const [cherche, setCherche] = useState('');
  const [edition, setEdition] = useState<string | null>(null);
  const categories = f.budgets.filter((x) => !x.global);
  const ids = new Set(categories.map((x) => x.id));
  const nomBudget = (id: string | null) => categories.find((x) => x.id === id);
  const q = cherche.trim().toLowerCase();
  const liste = b.depenses.filter(
    (x) =>
      (filtre === 'tous' || (filtre === 'hors' ? !x.budget || !ids.has(x.budget) : x.budget === filtre)) &&
      (!q || x.note.toLowerCase().includes(q) || (nomBudget(x.budget)?.nom.toLowerCase().includes(q) ?? false) || String(x.montant).includes(q)),
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
      {filtre !== 'tous' || q ? (
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
                const bu = nomBudget(x.budget);
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
                        <Text style={{ fontSize: 16 }}>{bu?.emoji || '💸'}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 15 }}>
                          {x.note || bu?.nom || 'Dépense'}
                        </Text>
                        <T small muted>
                          {bu ? (x.note ? bu.nom : 'Budget') : 'Hors budget'}
                        </T>
                      </View>
                      <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>{fmtMontant(x.montant, f.devise)}</Text>
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
const NOM_PERIODE: Record<Periode, [string, string, string]> = { semaine: ['semaine', 'semaines', 'dernières'], mois: ['mois', 'mois', 'derniers'], trimestre: ['trimestre', 'trimestres', 'derniers'], annee: ['année', 'années', 'dernières'] };

function StatsFinances({ f, vue, jourRef }: { f: Finances; vue: Periode; jourRef: string }) {
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Tuile emoji="💸" titre="dépensés sur la période" valeur={fmtMontant(s.bilan.total, f.devise)} evolution={s.totalAvant ? `${fmtEcart(ecart)} vs la période d'avant` : undefined} />
        <Tuile emoji="📆" titre="en moyenne par jour" valeur={s.parJourMoyen !== null ? fmtMontant(s.parJourMoyen, f.devise) : '–'} evolution={s.joursEcoules ? `sur ${s.joursEcoules} jour${s.joursEcoules > 1 ? 's' : ''}` : undefined} />
        <Tuile emoji="🧾" titre={`dépense${pl(s.nombre)} notée${pl(s.nombre)}`} valeur={String(s.nombre)} evolution={s.panier !== null ? `${fmtMontant(s.panier, f.devise)} en moyenne` : undefined} />
        <Tuile emoji="🌿" titre={`jour${pl(s.joursSansDepense ?? 0)} sans dépense`} valeur={s.joursSansDepense !== null ? String(s.joursSansDepense) : '–'} evolution={s.plusGrosse ? `Plus grosse : ${fmtMontant(s.plusGrosse.montant, f.devise)}${s.plusGrosse.note ? ` (${s.plusGrosse.note})` : ''}` : undefined} />
      </View>

      <Panel title={`Évolution par ${un}`}>
        <Barres key={`${vue}-${jourRef}`} points={s.historique.map((x) => ({ cle: x.cle, axe: x.axe, v: x.v, detail: `${x.libelle} : ${fmtMontant(x.v, f.devise)}${x.plafond ? ` sur ${fmtMontant(Math.round(x.plafond), f.devise)}` : ''}` }))} />
        <T small muted>
          {s.moyenne !== null ? `Moyenne des ${s.historique.length - 1} ${s.historique.length - 1 > 1 ? plusieurs : un} d'avant : ${fmtMontant(Math.round(s.moyenne), f.devise)}.` : `Pas encore de ${un} précédent pour comparer.`}
          {s.respect ? ` Budget tenu ${s.respect.tenues} fois sur ${s.respect.sur}.` : ''}
        </T>
      </Panel>

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

      <Panel title="Par jour de la semaine">
        {s.parJourSemaine.map((x) => (
          <Part key={x.jour} libelle={x.jour[0].toUpperCase() + x.jour.slice(1)} valeur={fmtMontant(x.v, f.devise)} ratio={x.v / maxJour} />
        ))}
        <T small muted>
          {s.historique.length > 1 ? `Sur les ${s.historique.length} ${derniers} ${plusieurs}` : `Sur ${derniers === 'derniers' ? 'ce' : 'cette'} ${un}`}
          {s.jourLePlusCher ? ` : c'est le ${s.jourLePlusCher} que tu dépenses le plus.` : '.'}
        </T>
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
  );
}

type Onglet = 'apercu' | 'depenses' | 'stats' | 'reglages';

export default function FinancesEcran() {
  const { espace, update } = useStore();
  const f = financesDe(espace);
  const d = today();
  const [onglet, setOnglet] = useState<Onglet>('apercu');
  const [vue, setVue] = useState<Periode>('mois');
  const [decal, setDecal] = useState(0);
  const [form, setForm] = useState<'depense' | 'budget' | Budget | null>(null);
  const sel = useSelection();
  const setF = (fn: (f: Finances) => Finances) => update((e) => ({ ...e, finances: fn(financesDe(e)) }));

  const jourRef = decaler(vue, d, decal);
  const b = bilan(f, vue, jourRef, d);
  const precedent = bilan(f, vue, decaler(vue, jourRef, -1), d).total;
  const ecart = precedent ? Math.round(((b.total - precedent) / precedent) * 100) : null;
  const ratio = b.plafondTotal ? b.total / b.plafondTotal : 0;
  const categories = f.budgets.filter((x) => !x.global);
  const idees = BUDGETS_SUGGERES.filter((x) => !f.budgets.some((y) => y.nom.toLowerCase() === x.nom.toLowerCase()));

  const actionsLot = [
    ...categories.slice(0, 4).map((c) => ({ label: `→ ${c.emoji} ${c.nom}`, onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (ids.includes(x.id) ? { ...x, budget: c.id } : x)) })) })),
    ...(categories.length ? [{ label: '→ Hors budget', onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (ids.includes(x.id) ? { ...x, budget: null } : x)) })) }] : []),
    { label: 'Supprimer', danger: true, onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.filter((x) => !ids.includes(x.id)) })) },
  ];

  const periode = (
    <>
      <Seg
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

  return (
    <Screen pied={sel.actif && onglet === 'depenses' ? <BarreSelection sel={sel} tous={b.depenses.map((x) => x.id)} actions={actionsLot} onglets={false} /> : null}>
      <Header retour eyebrow="Budgets et dépenses" title="Finances" right={form !== 'depense' ? <Btn small label="+ Dépense" onPress={() => setForm('depense')} /> : null} />

      {form === 'depense' ? <DepenseForm f={f} onDone={() => setForm(null)} setF={setF} /> : null}

      <Seg
        options={[
          { key: 'apercu', label: 'Aperçu' },
          { key: 'depenses', label: 'Dépenses' },
          { key: 'stats', label: 'Stats' },
          { key: 'reglages', label: 'Réglages' },
        ]}
        value={onglet}
        onChange={(o: Onglet) => {
          setOnglet(o);
          if (sel.actif) sel.fermer();
        }}
      />

      {onglet !== 'reglages' ? periode : null}

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
              <T small muted>
                Crée un budget pour voir ce qu'il te reste à dépenser.
              </T>
            )}
            {b.enCours && b.parJour !== null && b.total <= b.plafondTotal ? (
              <T small>
                Tu peux encore dépenser environ <Text style={{ fontFamily: F.texteF, color: C.ink }}>{fmtMontant(b.parJour, f.devise)} par jour</Text> jusqu'au {fmtCourt(b.fin).replace(/\.$/, '')}.
              </T>
            ) : null}
            {b.projection !== null && b.plafondTotal ? (
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
              <Pressable accessibilityRole="button" onPress={() => setOnglet('depenses')} style={{ alignSelf: 'flex-start' }}>
                <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>
                  Voir les {b.depenses.length} dépense{b.depenses.length > 1 ? 's' : ''} ›
                </Text>
              </Pressable>
            ) : null}
          </Panel>

          {decal === 0 ? <PanneauPrevisions f={f} d={d} seuil={f.alertes?.seuil ?? 1} /> : null}

          {form && form !== 'depense' ? <BudgetForm key={form === 'budget' ? 'nouveau' : form.id} init={form === 'budget' ? undefined : form} onDone={() => setForm(null)} setF={setF} /> : null}

          <Panel title="Budgets" count={f.budgets.length || undefined} right={form !== 'budget' ? <Btn small kind="sec" label="+ Budget" onPress={() => setForm('budget')} /> : null}>
            {b.lignes.length ? (
              [...b.lignes]
                .sort((x, y) => Number(!!y.budget.global) - Number(!!x.budget.global) || y.ratio - x.ratio)
                .map((l, i) => (
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
                            {fmtMontant(l.budget.montant, f.devise)} {parPeriode(l.budget.periode)}
                            {l.converti ? ` · ≈ ${fmtMontant(Math.round(l.plafond), f.devise)} sur la période` : ''}
                          </T>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>{fmtMontant(l.depense, f.devise)}</Text>
                          <Text style={{ color: couleurRatio(l.ratio), fontFamily: F.texteM, fontSize: 12 }}>{l.reste >= 0 ? `reste ${fmtMontant(Math.round(l.reste * 100) / 100, f.devise)}` : `+${fmtMontant(-l.reste, f.devise)}`}</Text>
                        </View>
                      </View>
                      <Jauge ratio={l.ratio} />
                    </Pressable>
                  </View>
                ))
            ) : (
              <Empty icone="portefeuille">Aucun budget. Choisis une catégorie et un montant pour une semaine, un mois, un trimestre ou une année.</Empty>
            )}
            {idees.length && f.budgets.length < 4 ? (
              <View style={{ gap: 8 }}>
                <T small muted>
                  {f.budgets.length ? 'Autres idées, en un geste :' : 'Pour commencer en un geste :'}
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
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
        </>
      ) : null}

      {onglet === 'depenses' ? <ListeDepenses key={`${vue}-${jourRef}`} f={f} b={b} sel={sel} setF={setF} /> : null}

      {onglet === 'stats' ? <StatsFinances f={f} vue={vue} jourRef={jourRef} /> : null}

      {onglet === 'reglages' ? (
        <>
          {f.budgets.length ? (
            <PanneauAlertes f={f} setF={setF} />
          ) : (
            <Panel title="Alertes de budget">
              <T small muted>
                Crée un budget dans Aperçu pour régler les alertes de prévision.
              </T>
            </Panel>
          )}
          <Panel title="Devise">
            <Seg options={DEVISES.map((x) => ({ key: x, label: x }))} value={DEVISES.includes(f.devise) ? f.devise : '€'} onChange={(devise) => setF((g) => ({ ...g, devise }))} />
          </Panel>
        </>
      ) : null}
    </Screen>
  );
}
