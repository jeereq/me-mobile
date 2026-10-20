import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { couleurRatio, Jauge } from '@/components/jauge';
import { BarreSelection, BoutonSelection, Selectionnable, useSelection } from '@/components/selection';
import { Btn, Empty, Header, IconBtn, Input, Panel, Screen, Sep, Seg, T } from '@/components/ui';
import { useActions } from '@/lib/actions';
import { addDays, fmtCourt, today, uid } from '@/lib/dates';
import { bilan, BUDGETS_SUGGERES, decaler, EMOJIS_BUDGET, financesDe, fmtMontant, libelle, lireMontant, parPeriode, PERIODES } from '@/lib/finances';
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

function DepenseForm({ f, onDone }: { f: Finances; onDone: () => void }) {
  const { ajouterDepense } = useActions();
  const d = today();
  const [montant, setMontant] = useState('');
  const [budget, setBudget] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [quand, setQuand] = useState<string>(d);
  const m = lireMontant(montant);
  const categories = f.budgets.filter((b) => !b.global);
  const ajouter = () => {
    if (!m) return;
    ajouterDepense({ id: uid(), montant: m, budget, note: note.trim(), date: quand, creeLe: new Date().toISOString() });
    onDone();
  };
  return (
    <Panel title="Nouvelle dépense" accent>
      <Input label={`Montant (${f.devise})`} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" placeholder="Ex. 12,50" autoFocus />
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
      <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Ex. Marché du samedi" returnKeyType="done" onSubmitEditing={ajouter} />
      <Seg
        label="Quand ?"
        options={[
          { key: d, label: "Aujourd'hui" },
          { key: addDays(d, -1), label: 'Hier' },
          { key: addDays(d, -2), label: 'Avant-hier' },
          { key: addDays(d, -7), label: 'Il y a 1 sem.' },
        ]}
        value={quand}
        onChange={setQuand}
      />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Ajouter la dépense" onPress={ajouter} disabled={!m} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
      </View>
    </Panel>
  );
}

export default function FinancesEcran() {
  const { espace, update } = useStore();
  const f = financesDe(espace);
  const d = today();
  const [vue, setVue] = useState<Periode>('mois');
  const [decal, setDecal] = useState(0);
  const [form, setForm] = useState<'depense' | 'budget' | Budget | null>(null);
  const sel = useSelection();
  const setF = (fn: (f: Finances) => Finances) => update((e) => ({ ...e, finances: fn(financesDe(e)) }));

  const ref = decaler(vue, d, decal);
  const b = bilan(f, vue, ref, d);
  const precedent = bilan(f, vue, decaler(vue, ref, -1), d).total;
  const ecart = precedent ? Math.round(((b.total - precedent) / precedent) * 100) : null;
  const ratio = b.plafondTotal ? b.total / b.plafondTotal : 0;
  const nomBudget = (id: string | null) => f.budgets.find((x) => x.id === id && !x.global);
  const categories = f.budgets.filter((x) => !x.global);
  const idees = BUDGETS_SUGGERES.filter((x) => !f.budgets.some((y) => y.nom.toLowerCase() === x.nom.toLowerCase()));

  const actionsLot = [
    ...categories.slice(0, 4).map((c) => ({ label: `→ ${c.emoji} ${c.nom}`, onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (ids.includes(x.id) ? { ...x, budget: c.id } : x)) })) })),
    ...(categories.length ? [{ label: '→ Hors budget', onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (ids.includes(x.id) ? { ...x, budget: null } : x)) })) }] : []),
    { label: 'Supprimer', danger: true, onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.filter((x) => !ids.includes(x.id)) })) },
  ];

  return (
    <Screen pied={sel.actif ? <BarreSelection sel={sel} tous={b.depenses.map((x) => x.id)} actions={actionsLot} onglets={false} /> : null}>
      <Header retour eyebrow="Budgets et dépenses" title="Finances" right={form !== 'depense' ? <Btn small label="+ Dépense" onPress={() => setForm('depense')} /> : null} />

      {form === 'depense' ? <DepenseForm f={f} onDone={() => setForm(null)} /> : null}

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
        <Text style={{ flex: 1, textAlign: 'center', color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>{libelle(vue, ref)}</Text>
        <IconBtn label="Période suivante" glyph="›" onPress={() => setDecal(decal + 1)} />
      </View>
      {decal ? (
        <Pressable accessibilityRole="button" onPress={() => setDecal(0)} style={{ alignSelf: 'center' }}>
          <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Revenir à la période en cours</Text>
        </Pressable>
      ) : null}

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
      </Panel>

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

      <Panel title="Dépenses" count={b.depenses.length || undefined} right={b.depenses.length ? <BoutonSelection sel={sel} /> : null}>
        {b.depenses.length ? (
          b.depenses.map((x: Depense, i) => {
            const bu = nomBudget(x.budget);
            return (
              <View key={x.id}>
                {i ? <Sep /> : null}
                <Selectionnable sel={sel} id={x.id} label={`${fmtMontant(x.montant, f.devise)} ${x.note || bu?.nom || ''}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{bu?.emoji || '💸'}</Text>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T>{x.note || bu?.nom || 'Dépense'}</T>
                      <T small muted>
                        {x.date === d ? "Aujourd'hui" : x.date === addDays(d, -1) ? 'Hier' : fmtCourt(x.date)}
                        {bu && x.note ? ` · ${bu.nom}` : !bu ? ' · hors budget' : ''}
                      </T>
                    </View>
                    <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>{fmtMontant(x.montant, f.devise)}</Text>
                    {!sel.actif ? <IconBtn label="Supprimer" glyph="×" danger onPress={() => setF((g) => ({ ...g, depenses: g.depenses.filter((y) => y.id !== x.id) }))} /> : null}
                  </View>
                </Selectionnable>
              </View>
            );
          })
        ) : (
          <Empty icone="portefeuille">Aucune dépense sur cette période. Ajoute-en une avec « + Dépense », ou écris « 12 € courses » avec le bouton + de l'accueil.</Empty>
        )}
      </Panel>

      <Panel title="Devise">
        <Seg options={DEVISES.map((x) => ({ key: x, label: x }))} value={DEVISES.includes(f.devise) ? f.devise : '€'} onChange={(devise) => setF((g) => ({ ...g, devise }))} />
      </Panel>
    </Screen>
  );
}
