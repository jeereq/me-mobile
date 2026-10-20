import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { addDays, today, uid } from '@/lib/dates';
import { echeance, FREQUENCES, fmtMontant, genererRecurrences, lireMontant, prochaineEcheance, revenusEntre, totalRevenus } from '@/lib/finances';
import { dateFr, lireDate, titreJour } from '@/lib/stats-finances';
import { alpha, C, F } from '@/lib/theme';
import type { Finances, Recurrence, Revenu } from '@/lib/types';

import { Btn, Empty, Input, Panel, Sep, T } from './ui';

export type SetF = (fn: (f: Finances) => Finances) => void;
export type Repetition = 'une' | Recurrence['frequence'];

export function Puce({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" aria-checked={on} onPress={onPress} style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.14) : 'transparent', opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: on ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function Champ({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <T small muted>
        {titre}
      </T>
      {children}
    </View>
  );
}

/** Date d'une dépense ou d'un revenu : aujourd'hui, hier, avant-hier, ou une autre date tapée en JJ/MM. */
export function useChoixDate(init?: string) {
  const d = today();
  const presets = [
    { key: d, label: "Aujourd'hui" },
    { key: addDays(d, -1), label: 'Hier' },
    { key: addDays(d, -2), label: 'Avant-hier' },
  ];
  const [quand, setQuand] = useState(init || d);
  const [autre, setAutre] = useState(init && !presets.some((x) => x.key === init) ? dateFr(init) : '');
  const dateAutre = autre ? lireDate(autre, d) : null;
  const date = autre ? dateAutre : quand;
  const element = (
    <Champ titre="Date">
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
    </Champ>
  );
  return { date, element };
}

/** « Une fois » ou un rythme ; avec un rythme, le formulaire crée un paiement récurrent. */
export function ChoixRepetition({ value, onChange, date }: { value: Repetition; onChange: (r: Repetition) => void; date: string | null }) {
  const suivante = value !== 'une' && date ? echeance({ debut: date, frequence: value }, 1) : null;
  return (
    <Champ titre="Répéter">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Puce label="Une fois" on={value === 'une'} onPress={() => onChange('une')} />
        {FREQUENCES.map((x) => (
          <Puce key={x.key} label={x.label} on={value === x.key} onPress={() => onChange(x.key)} />
        ))}
      </View>
      {suivante ? (
        <T small muted>
          Ajouté automatiquement {FREQUENCES.find((x) => x.key === value)!.chaque} : prochaine fois le {dateFr(suivante)}.
        </T>
      ) : null}
    </Champ>
  );
}

/** Crée un paiement récurrent et ajoute tout de suite ses échéances passées (celle du jour comprise). */
export function creerRecurrence(setF: SetF, r: Omit<Recurrence, 'id' | 'derniere'>) {
  setF((g) => genererRecurrences({ ...g, recurrences: [...(g.recurrences || []), { ...r, id: uid(), derniere: null }] }, today()));
}

function RevenuForm({ f, init, onDone, setF }: { f: Finances; init?: Revenu; onDone: () => void; setF: SetF }) {
  const [montant, setMontant] = useState(init ? String(init.montant).replace('.', ',') : '');
  const [note, setNote] = useState(init?.note || '');
  const [repetition, setRepetition] = useState<Repetition>('une');
  const { date, element } = useChoixDate(init?.date);
  const m = lireMontant(montant);

  const enregistrer = () => {
    if (!m || !date) return;
    if (init) setF((g) => ({ ...g, revenus: (g.revenus || []).map((x) => (x.id === init.id ? { ...x, montant: m, note: note.trim(), date } : x)) }));
    else if (repetition !== 'une') creerRecurrence(setF, { genre: 'revenu', montant: m, note: note.trim(), budget: null, frequence: repetition, debut: date });
    else setF((g) => ({ ...g, revenus: [{ id: uid(), montant: m, note: note.trim(), date, creeLe: new Date().toISOString() }, ...(g.revenus || [])] }));
    onDone();
  };
  const supprimer = () => {
    if (!init) return;
    setF((g) => ({ ...g, revenus: (g.revenus || []).filter((x) => x.id !== init.id) }));
    onDone();
  };

  return (
    <Panel title={init ? 'Modifier le revenu' : 'Nouveau revenu'} accent>
      <Input label={`Montant (${f.devise})`} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" placeholder="Ex. 2 100" autoFocus={!init} />
      <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Ex. Salaire, remboursement" returnKeyType="done" onSubmitEditing={enregistrer} />
      {element}
      {init ? (
        init.recurrence ? (
          <T small muted>
            Revenu récurrent : la modification ne change que cette fois-ci.
          </T>
        ) : null
      ) : (
        <ChoixRepetition value={repetition} onChange={setRepetition} date={date} />
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={init ? 'Enregistrer' : 'Ajouter le revenu'} onPress={enregistrer} disabled={!m || !date} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
        {init ? <Btn kind="danger" label="Supprimer" onPress={supprimer} /> : null}
      </View>
    </Panel>
  );
}

function Chiffre({ titre, valeur, couleur, large }: { titre: string; valeur: string; couleur?: string; large?: boolean }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: large ? '100%' : '40%', minWidth: 120, backgroundColor: C.sunk, borderRadius: 14, padding: 12, gap: 2 }}>
      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{titre}</Text>
      <Text numberOfLines={1} style={{ color: couleur || C.ink, fontFamily: F.chiffre, fontSize: large ? 24 : 18 }}>{valeur}</Text>
    </View>
  );
}

/** Revenus de la période et solde (revenus − dépenses), sur l'aperçu des finances. */
export function PanneauRevenus({ f, debut, fin, depense, setF }: { f: Finances; debut: string; fin: string; depense: number; setF: SetF }) {
  const d = today();
  const [form, setForm] = useState<'nouveau' | Revenu | null>(null);
  const liste = revenusEntre(f, debut, fin).sort((a, z) => z.date.localeCompare(a.date));
  const total = totalRevenus(liste);
  const solde = Math.round((total - depense) * 100) / 100;
  const jamais = !(f.revenus || []).length;

  return (
    <>
      {form ? <RevenuForm key={form === 'nouveau' ? 'nouveau' : form.id} f={f} init={form === 'nouveau' ? undefined : form} onDone={() => setForm(null)} setF={setF} /> : null}
      <Panel title="Revenus et solde" right={form !== 'nouveau' ? <Btn small kind="sec" label="+ Revenu" onPress={() => setForm('nouveau')} /> : null}>
        {jamais ? (
          <Empty icone="portefeuille">Note ton salaire et tes autres rentrées pour voir ce qu'il te reste une fois les dépenses payées.</Empty>
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chiffre titre="Revenus" valeur={fmtMontant(total, f.devise)} />
              <Chiffre titre="Dépenses" valeur={fmtMontant(depense, f.devise)} />
              <Chiffre large titre="Solde de la période" valeur={`${solde > 0 ? '+' : solde < 0 ? '−' : ''}${fmtMontant(Math.abs(solde), f.devise)}`} couleur={solde < 0 ? C.agressif : solde > 0 ? C.coach : undefined} />
            </View>
            {total ? (
              <T small muted>
                {solde >= 0 ? `Tu as mis de côté ${Math.round((solde / total) * 100)} % de tes revenus sur la période.` : 'Tu as dépensé plus que tes revenus sur la période.'}
              </T>
            ) : (
              <T small muted>
                Aucun revenu noté sur cette période.
              </T>
            )}
            {liste.map((x, i) => (
              <View key={x.id}>
                {i ? <Sep /> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={`Modifier ${fmtMontant(x.montant, f.devise)} ${x.note || 'revenu'}`} onPress={() => setForm(x)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: alpha(C.coach, 0.14), alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16 }}>{x.recurrence ? '🔁' : '💶'}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 15 }}>
                      {x.note || 'Revenu'}
                    </Text>
                    <T small muted>
                      {titreJour(x.date, d)}
                    </T>
                  </View>
                  <Text style={{ color: C.coach, fontFamily: F.texteF, fontSize: 15 }}>+{fmtMontant(x.montant, f.devise)}</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}
      </Panel>
    </>
  );
}

/** Paiements récurrents (Réglages) : ce qui revient, la prochaine échéance, et l'arrêt. */
export function PanneauRecurrences({ f, setF }: { f: Finances; setF: SetF }) {
  const liste = f.recurrences || [];
  const nomBudget = (id: string | null) => f.budgets.find((b) => b.id === id);
  return (
    <Panel title="Paiements récurrents" count={liste.length || undefined}>
      {liste.length ? (
        liste.map((r, i) => {
          const bu = nomBudget(r.budget);
          return (
            <View key={r.id}>
              {i ? <Sep /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 18 }}>{r.genre === 'revenu' ? '💶' : bu?.emoji || '🔁'}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>
                    {r.note || (r.genre === 'revenu' ? 'Revenu' : bu?.nom || 'Dépense')}
                  </Text>
                  <T small muted>
                    {r.genre === 'revenu' ? '+' : ''}
                    {fmtMontant(r.montant, f.devise)} {FREQUENCES.find((x) => x.key === r.frequence)?.chaque} · prochaine fois le {dateFr(prochaineEcheance(r))}
                  </T>
                </View>
                <Btn small kind="sec" label="Arrêter" onPress={() => setF((g) => ({ ...g, recurrences: (g.recurrences || []).filter((x) => x.id !== r.id) }))} />
              </View>
            </View>
          );
        })
      ) : (
        <T small muted>
          Loyer, abonnements, salaire : choisis « Chaque mois » en ajoutant une dépense ou un revenu, et ils seront notés tout seuls à chaque échéance.
        </T>
      )}
      {liste.length ? (
        <T small muted>
          Arrêter garde ce qui est déjà noté.
        </T>
      ) : null}
    </Panel>
  );
}
