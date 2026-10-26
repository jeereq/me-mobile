import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { addDays, today, uid } from '@/lib/dates';
import { convertirFinances, DEVISES, infoDevise, libelleDevise, libelleOrigine, saisie, tauxEffectif, tauxPerso, tauxValide, type Origine, type Taux } from '@/lib/devises';
import { echeance, etatBudget, FREQUENCES, fmtMontant, genererRecurrences, lireMontant, prochaineEcheance, revenusEntre, totalRevenus } from '@/lib/finances';
import { dateFr, lireDate, titreJour } from '@/lib/stats-finances';
import { alpha, C, F } from '@/lib/theme';
import type { Budget, Finances, Recurrence, Revenu } from '@/lib/types';

import { budgetDe, poser } from '@/lib/categories';

import { ChoixCategories } from './categories';
import { Btn, Dialogue, Empty, Input, Panel, Sep, T } from './ui';

/** Taux affiché sans bruit de décimales. */
const arrondiTaux = (t: number) => Number(t.toPrecision(6));
export type SetF = (fn: (f: Finances) => Finances) => void;
export type Repetition = 'une' | Recurrence['frequence'];

export function Puce({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" aria-checked={on} onPress={onPress} style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.14) : 'transparent', opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: on ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** Le poste du plan de dépenses du budget : à quoi cette dépense sert dans le budget (« Billets », « Hôtel »). */
export function ChoixPoste({ budget, value, onChange }: { budget: Budget | undefined; value: string | null; onChange: (id: string | null) => void }) {
  if (!budget?.plan?.length) return null;
  return (
    <Champ titre={`Poste de « ${budget.nom} »`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Puce label="Sans poste" on={!value} onPress={() => onChange(null)} />
        {budget.plan.map((p) => (
          <Puce key={p.id} label={`${p.emoji ? `${p.emoji} ` : ''}${p.nom}`} on={value === p.id} onPress={() => onChange(value === p.id ? null : p.id)} />
        ))}
      </View>
    </Champ>
  );
}

/**
 * Le budget d'une dépense, au choix : tous les budgets qui comptent à sa date (plus celui déjà choisi, même terminé).
 * Sans choix, elle va dans le budget qui suit l'une de ses catégories, sinon hors budget (voir `budgetDe`).
 */
export function ChoixBudget({ budgets, value, onChange, date, categories }: { budgets: Budget[]; value: string | null; onChange: (id: string | null) => void; date: string; categories?: string[] }) {
  const liste = budgets.filter((b) => !b.global && (b.id === value || etatBudget(b, date) === 'en_cours'));
  if (!liste.length) return null;
  const auto = budgetDe(budgets, { budget: null, categories, date });
  return (
    <View style={{ gap: 6 }}>
      <T small muted>
        Budget
      </T>
      <View accessibilityRole="radiogroup" accessibilityLabel="Budget de la dépense" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {liste.map((b) => (
          <Puce key={b.id} label={`${b.emoji} ${b.nom}`} on={value === b.id} onPress={() => onChange(value === b.id ? null : b.id)} />
        ))}
        <Puce label={auto ? `Selon la catégorie (${auto.emoji} ${auto.nom})` : 'Hors budget'} on={value === null} onPress={() => onChange(null)} />
      </View>
    </View>
  );
}

/**
 * Choix de la devise d'un montant. La devise principale est proposée en premier, puis celles déjà utilisées ;
 * « Autre… » ouvre tout le catalogue. Pour une devise sans taux, on demande combien elle vaut dans la devise principale.
 */
export function useChoixDevise(f: Finances, init?: Origine) {
  const [devise, setDevise] = useState(init?.devise ?? f.devise);
  const [tout, setTout] = useState(false);
  const connu = tauxEffectif(devise, f.devise, f.taux);
  const [texte, setTexte] = useState(devise !== f.devise && connu !== null ? String(arrondiTaux(connu)).replace('.', ',') : '');
  const saisi = Number(texte.replace(/[\s\u00a0]/g, '').replace(',', '.'));
  const taux: number | null = devise === f.devise ? null : tauxValide(saisi) ? saisi : null;
  const courantes = [f.devise, ...Object.keys(f.taux ?? {}).filter((k) => k !== f.devise)];
  if (!courantes.includes(devise)) courantes.push(devise);
  const choisir = (d: string) => {
    setDevise(d);
    const t = tauxEffectif(d, f.devise, f.taux);
    setTexte(d !== f.devise && t !== null ? String(arrondiTaux(t)).replace('.', ',') : '');
  };
  const proposees = tout ? DEVISES.map((d) => d.cle) : courantes;
  const element = (
    <Champ titre="Devise">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {proposees.map((k) => (
          <Puce key={k} label={tout ? libelleDevise(k) : k} on={devise === k} onPress={() => choisir(k)} />
        ))}
        <Puce label={tout ? 'Moins' : 'Autre…'} on={false} onPress={() => setTout(!tout)} />
      </View>
      {devise !== f.devise ? (
        <Input
          label={`1 ${devise} = … ${f.devise}`}
          value={texte}
          onChangeText={setTexte}
          keyboardType="decimal-pad"
          placeholder={`Ex. ${devise === '$' && f.devise === '€' ? '0,92' : '1'}`}
        />
      ) : null}
      {devise !== f.devise && taux === null ? <T small muted>Indique le taux pour convertir en {f.devise} ({infoDevise(devise).nom}).</T> : null}
    </Champ>
  );
  return {
    devise,
    /** Choisit une devise par programme (le compte choisi a la sienne). */
    choisir,
    element,
    /** Faux tant qu'une devise étrangère n'a pas de taux. */
    pret: devise === f.devise || taux !== null,
    /** Taux à appliquer, y compris celui saisi pour la devise choisie. */
    tauxCourants: (taux === null ? f.taux : { ...f.taux, [devise]: taux }) as Taux | undefined,
    /** Montant à enregistrer (devise principale) et origine éventuelle ; null sans taux. */
    convertir: (m: number) => saisie(m, devise, f.devise, taux === null ? f.taux : { ...f.taux, [devise]: taux }),
    /** À appliquer aux finances pour retenir le taux saisi. */
    avecTaux: (g: Finances): Finances => (taux !== null && devise !== g.devise && g.taux?.[devise] !== taux && (tauxPerso(devise, g.taux) || taux !== tauxEffectif(devise, g.devise, g.taux)) ? { ...g, taux: { ...(g.taux as Taux | undefined), [devise]: taux } } : g),
  };
}

/**
 * Réglages des devises : passer tout le tableau de bord dans une autre devise (en dollars, par exemple).
 * Budgets, dépenses, revenus et paiements récurrents sont convertis ; le montant d'avant reste en « origine », donc
 * revenir à la devise de départ redonne exactement les mêmes montants.
 */
export function PanneauDevises({ f, setF }: { f: Finances; setF: SetF }) {
  const [cible, setCible] = useState<string | null>(null);
  const [texte, setTexte] = useState('');
  const [fait, setFait] = useState<string | null>(null);
  const choisir = (d: string) => {
    setFait(null);
    setCible(d === f.devise ? null : d);
    const t = tauxEffectif(d, f.devise, f.taux);
    setTexte(t === null ? '' : String(arrondiTaux(t)).replace('.', ','));
  };
  const saisi = Number(texte.replace(/[\s\u00a0]/g, '').replace(',', '.'));
  const tauxOk = cible !== null && tauxValide(saisi);
  const nb = f.depenses.length + (f.revenus?.length ?? 0) + (f.recurrences?.length ?? 0) + f.budgets.length;
  const convertir = () => {
    if (!cible || !tauxOk) return;
    const de = f.devise;
    setF((g) => {
      const x = convertirFinances({ ...g, taux: { ...g.taux, [cible]: saisi } }, cible);
      return x ?? g;
    });
    setFait(`Tout est maintenant en ${cible} (${nb} élément${nb > 1 ? 's' : ''} converti${nb > 1 ? 's' : ''} depuis ${de}).`);
    setCible(null);
  };
  const taux = Object.entries(f.taux ?? {}).filter(([k]) => k !== f.devise);
  return (
    <Panel title="Devises">
      <T small muted>
        Devise du tableau de bord : budgets, totaux, prévisions et alertes sont calculés dedans.
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {DEVISES.map((d) => (
          <Puce key={d.cle} label={libelleDevise(d.cle)} on={(cible ?? f.devise) === d.cle} onPress={() => choisir(d.cle)} />
        ))}
      </View>
      {f.devise !== '$' ? <Btn kind="sec" label="Tableau de bord en dollars ($)" onPress={() => choisir('$')} /> : null}
      {cible ? (
        <>
          <Input label={`1 ${cible} = … ${f.devise}`} value={texte} onChangeText={setTexte} keyboardType="decimal-pad" />
          <T small muted>
            {tauxPerso(cible, f.taux) ? 'Ton taux.' : 'Taux de référence approximatif : corrige-le si tu connais le cours du jour.'} Les {nb} budgets, dépenses, revenus et paiements récurrents seront convertis en {cible} ; les montants d'avant restent visibles
            sous chaque ligne.
          </T>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn label={`Tout convertir en ${cible}`} onPress={convertir} disabled={!tauxOk} />
            <Btn kind="sec" label="Annuler" onPress={() => setCible(null)} />
          </View>
        </>
      ) : null}
      {fait ? <T small>{fait}</T> : null}
      {taux.length ? (
        <>
          <Sep />
          <T small muted>
            Taux utilisés pour les montants saisis dans une autre devise (modifiables à chaque saisie) :
          </T>
          {taux.map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <T>
                1 {k} = {String(arrondiTaux(v)).replace('.', ',')} {f.devise}
              </T>
              <Btn small kind="sec" label="Retirer" onPress={() => setF((g) => ({ ...g, taux: Object.fromEntries(Object.entries(g.taux ?? {}).filter(([x]) => x !== k)) }))} />
            </View>
          ))}
        </>
      ) : null}
    </Panel>
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

/**
 * « Jusqu'au … » : une date de fin, facultative ou non, en un geste (fin du mois, fin de l'année) ou tapée en JJ/MM/AAAA.
 * `min` : la date de fin ne peut pas être avant (aujourd'hui, ou le début). Renvoie null tant qu'aucune date valable n'est choisie.
 */
export function useDateFin({ init, min, titre = "Jusqu'au", obligatoire = false }: { init?: string | null; min: string; titre?: string; obligatoire?: boolean }) {
  const d = today();
  // Dernier jour du mois de `x`, n mois plus tard.
  const finMois = (x: string, n = 0) => {
    const [a, m] = x.split('-').map(Number);
    const z = new Date(a, m + n, 0);
    return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}-${String(z.getDate()).padStart(2, '0')}`;
  };
  const presets = [
    { key: finMois(min), label: 'Fin du mois' },
    { key: finMois(min, 1), label: 'Fin du mois prochain' },
    { key: `${min.slice(0, 4)}-12-31`, label: "Fin de l'année" },
  ].filter((x, i, l) => x.key >= min && l.findIndex((y) => y.key === x.key) === i);
  const [choix, setChoix] = useState<string | null>(init && presets.some((x) => x.key === init) ? init : null);
  const [autre, setAutre] = useState(init && !presets.some((x) => x.key === init) ? dateFr(init) : '');
  // Sans année, une date déjà passée cette année est comprise comme celle de l'année prochaine.
  const brut = autre.trim() ? lireDate(autre, d) : null;
  const sansAnnee = /^\d{1,2}[/.-]\d{1,2}$/.test(autre.trim());
  const lu = brut && sansAnnee && brut < min ? `${Number(brut.slice(0, 4)) + 1}${brut.slice(4)}` : brut;
  const fin = autre.trim() ? (lu && lu >= min ? lu : null) : choix;
  const invalide = (!!autre.trim() && !fin) || (obligatoire && !fin);
  const element = (
    <Champ titre={titre}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {obligatoire ? null : (
          <Puce
            label="Sans fin"
            on={!choix && !autre}
            onPress={() => {
              setChoix(null);
              setAutre('');
            }}
          />
        )}
        {presets.map((x) => (
          <Puce
            key={x.key}
            label={`${x.label} (${dateFr(x.key).slice(0, 5)})`}
            on={!autre && choix === x.key}
            onPress={() => {
              setChoix(x.key);
              setAutre('');
            }}
          />
        ))}
        <View style={{ width: 190 }}>
          <Input value={autre} onChangeText={setAutre} placeholder="Autre : JJ/MM/AAAA" accessibilityLabel={`${titre} : autre date, au format JJ/MM/AAAA`} keyboardType="numbers-and-punctuation" style={{ paddingVertical: 7, borderColor: autre ? (fin ? C.accent : C.agressif) : undefined }} />
        </View>
      </View>
      {autre.trim() && !fin ? (
        <T small style={{ color: C.agressif }}>
          {lu && lu < min ? `La date doit être le ${dateFr(min)} ou après.` : 'Date non reconnue : écris par exemple 15/12 ou 15/12/2026.'}
        </T>
      ) : fin ? (
        <T small muted>
          Jusqu'au {dateFr(fin)} inclus.
        </T>
      ) : null}
    </Champ>
  );
  return { fin, invalide, element };
}

/** « Une fois » ou un rythme ; avec un rythme, le formulaire crée un paiement récurrent (`fin` : sa date de fin, facultative). */
export function ChoixRepetition({ value, onChange, date, fin }: { value: Repetition; onChange: (r: Repetition) => void; date: string | null; fin?: ReactNode }) {
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
      {value !== 'une' ? fin : null}
    </Champ>
  );
}

/** Crée un paiement récurrent et ajoute tout de suite ses échéances passées (celle du jour comprise). */
export function creerRecurrence(setF: SetF, r: Omit<Recurrence, 'id' | 'derniere'>) {
  setF((g) => genererRecurrences({ ...g, recurrences: [...(g.recurrences || []), { ...r, id: uid(), derniere: null }] }, today()));
}

function RevenuForm({ f, init, onDone, setF }: { f: Finances; init?: Revenu; onDone: () => void; setF: SetF }) {
  const [montant, setMontant] = useState(init ? String(init.origine?.montant ?? init.montant).replace('.', ',') : '');
  const [note, setNote] = useState(init?.note || '');
  const [cats, setCats] = useState<string[] | undefined>(init?.categories);
  const [repetition, setRepetition] = useState<Repetition>('une');
  const { date, element } = useChoixDate(init?.date);
  const finRep = useDateFin({ min: date || today(), titre: "Jusqu'au (facultatif)" });
  const dev = useChoixDevise(f, init?.origine);
  const lu = lireMontant(montant);
  const conv = lu ? dev.convertir(lu) : null;

  const enregistrer = () => {
    if (!conv || !date) return;
    const { montant: m, origine } = conv;
    if (init) setF((g) => ({ ...dev.avecTaux(g), revenus: (g.revenus || []).map((x) => (x.id === init.id ? poser({ ...x, montant: m, origine, note: note.trim(), date }, cats) : x)) }));
    else if (repetition !== 'une') {
      setF((g) => dev.avecTaux(g));
      creerRecurrence(setF, { genre: 'revenu', montant: m, origine, note: note.trim(), budget: null, ...(cats?.length ? { categories: cats } : {}), frequence: repetition, debut: date, ...(finRep.fin ? { fin: finRep.fin } : {}) });
    } else setF((g) => ({ ...dev.avecTaux(g), revenus: [{ id: uid(), montant: m, origine, ...(cats?.length ? { categories: cats } : {}), note: note.trim(), date, creeLe: new Date().toISOString() }, ...(g.revenus || [])] }));
    onDone();
  };
  const supprimer = () => {
    if (!init) return;
    setF((g) => ({ ...g, revenus: (g.revenus || []).filter((x) => x.id !== init.id) }));
    onDone();
  };

  return (
    <Dialogue titre={init ? 'Modifier le revenu' : 'Nouveau revenu'} onFermer={onDone}>
      <Input label={`Montant (${dev.devise})`} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" placeholder="Ex. 2 100" autoFocus={!init} />
      {dev.element}
      {conv?.origine ? <T small muted>≈ {fmtMontant(conv.montant, f.devise)}</T> : null}
      <ChoixCategories value={cats} onChange={setCats} />
      <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Ex. Salaire, remboursement" returnKeyType="done" onSubmitEditing={enregistrer} />
      {element}
      {init ? (
        init.recurrence ? (
          <T small muted>
            Revenu récurrent : la modification ne change que cette fois-ci.
          </T>
        ) : null
      ) : (
        <ChoixRepetition value={repetition} onChange={setRepetition} date={date} fin={finRep.element} />
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={init ? 'Enregistrer' : 'Ajouter le revenu'} onPress={enregistrer} disabled={!conv || !date || (repetition !== 'une' && finRep.invalide)} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
        {init ? <Btn kind="danger" label="Supprimer" onPress={supprimer} /> : null}
      </View>
    </Dialogue>
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
      <Panel title="Revenus et solde" right={<Btn small kind="sec" label="+ Revenu" onPress={() => setForm('nouveau')} />}>
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
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: C.coach, fontFamily: F.texteF, fontSize: 15 }}>+{fmtMontant(x.montant, f.devise)}</Text>
                    {libelleOrigine(x.origine, f.devise) ? <T small muted>{libelleOrigine(x.origine, f.devise)}</T> : null}
                  </View>
                </Pressable>
              </View>
            ))}
          </>
        )}
      </Panel>
    </>
  );
}

/** Une ligne de paiement récurrent : prochaine échéance ou fin, et le réglage de sa date de fin. */
function LigneRecurrence({ f, r, setF }: { f: Finances; r: Recurrence; setF: SetF }) {
  const d = today();
  const [edition, setEdition] = useState(false);
  const finRep = useDateFin({ init: r.fin, min: r.derniere && r.derniere > d ? r.derniere : d, titre: 'Date de fin' });
  const bu = f.budgets.find((b) => b.id === r.budget);
  const prochaine = prochaineEcheance(r);
  const termine = !!r.fin && prochaine > r.fin;
  const changer = (fin: string | null) => setF((g) => ({ ...g, recurrences: (g.recurrences || []).map((x) => (x.id === r.id ? { ...x, fin } : x)) }));
  return (
    <View style={{ gap: 8, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: termine ? 0.6 : 1 }}>
        <Text style={{ fontSize: 18 }}>{r.genre === 'revenu' ? '💶' : bu?.emoji || '🔁'}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>
            {r.note || (r.genre === 'revenu' ? 'Revenu' : bu?.nom || 'Dépense')}
          </Text>
          <T small muted>
            {r.genre === 'revenu' ? '+' : ''}
            {fmtMontant(r.montant, f.devise)} {FREQUENCES.find((x) => x.key === r.frequence)?.chaque}
            {termine ? ` · terminé le ${dateFr(r.fin!)}` : ` · prochaine fois le ${dateFr(prochaine)}${r.fin ? ` · jusqu'au ${dateFr(r.fin)}` : ''}`}
          </T>
        </View>
        {termine ? null : <Btn small kind="sec" label={r.fin ? 'Fin' : 'Date de fin'} onPress={() => setEdition((v) => !v)} />}
        <Btn small kind="sec" label={termine ? 'Retirer' : 'Arrêter'} onPress={() => setF((g) => ({ ...g, recurrences: (g.recurrences || []).filter((x) => x.id !== r.id) }))} />
      </View>
      {edition ? (
        <View style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: C.sunk }}>
          {finRep.element}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn
              small
              label="Enregistrer"
              disabled={finRep.invalide}
              onPress={() => {
                changer(finRep.fin);
                setEdition(false);
              }}
            />
            <Btn small kind="sec" label="Annuler" onPress={() => setEdition(false)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Paiements récurrents (Réglages) : ce qui revient, la prochaine échéance, la date de fin, et l'arrêt. */
export function PanneauRecurrences({ f, setF }: { f: Finances; setF: SetF }) {
  const liste = f.recurrences || [];
  return (
    <Panel title="Paiements récurrents" count={liste.length || undefined}>
      {liste.length ? (
        liste.map((r, i) => (
          <View key={r.id}>
            {i ? <Sep /> : null}
            <LigneRecurrence f={f} r={r} setF={setF} />
          </View>
        ))
      ) : (
        <T small muted>
          Loyer, abonnements, salaire, remboursement d'un prêt : choisis « Chaque mois » en ajoutant une dépense ou un revenu, et ils seront notés tout seuls à chaque échéance, jusqu'à la date de fin si tu en fixes une.
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
