import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { AnnulerFinances, BarreAnnuler, useAnnulation, useSignalerSuppression } from '@/components/annuler';
import { ChampDate } from '@/components/calendrier';
import { ChoixBudget, ChoixPoste, ChoixRepetition, creerRecurrence, PanneauDevises, useDateFin, PanneauRecurrences, PanneauRevenus, PlansDepenses, Puce, useChoixDate, useChoixDevise, type Repetition } from '@/components/finances-plus';
import { Barres, Part, Tuile } from '@/components/graphiques';
import { DUREE_CHARGEMENT, Differe, SqueletteLignes, SqueletteOperations, SqueletteVueFinances } from '@/components/squelettes';
import { PanneauComptes } from '@/components/comptes';
import { ApercuObjectifs, PanneauObjectifs } from '@/components/objectifs';
import { ImportReleve } from '@/components/import-releve';
import { PanneauReports, ReporterReste } from '@/components/reports';
import { Operations } from '@/components/operations';
import { JourParJour } from '@/components/jour-par-jour';
import { couleurRatio, Jauge } from '@/components/jauge';
import { ChoixCategories, EtiquettesCategories } from '@/components/categories';
import { ChampJustificatifs, MarqueJustificatifs } from '@/components/justificatifs';
import { PanneauAlertes, PanneauPrevisions } from '@/components/previsions';
import { BarreSelection, BoutonSelection, Selectionnable, useSelection } from '@/components/selection';
import { Filtre, Onglets, SousOnglets } from '@/components/onglets';
import { Limitee, Pliable } from '@/components/pliable';
import { Btn, Collant, Colonnes, Dialogue, Empty, Header, IconBtn, Input, Panel, Screen, Sep, Seg, T } from '@/components/ui';
import { useActions } from '@/lib/actions';
import type { Filtres } from '@/lib/analyse-operations';
import { categoriesDe, idBudgetDe, poser } from '@/lib/categories';
import { operationsDe } from '@/lib/analyse-operations';
import { comptesDe, listeVirements, nomCompte } from '@/lib/comptes';
import { libelleOrigine } from '@/lib/devises';
import { addDays, fmtCourt, parse, today, uid } from '@/lib/dates';
import { dateFr, statsFinances, titreJour } from '@/lib/stats-finances';
import { bilan, type Bilan, bornes, type Ligne, BUDGETS_SUGGERES, decaler, depensesEntre, ecartPeriodes, EMOJIS_BUDGET, epargneEntre, etatBudget, financesDe, fmtMontant, genererRecurrences, libelle, lireMontant, parPeriode, PERIODES, periodePourDates, revenusEntre, suiviPlan, type SuiviPoste, totalRevenus } from '@/lib/finances';
import { sansAccents } from '@/lib/recherche';
import { restesReportables } from '@/lib/reports';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Budget, Depense, Finances, Justificatif, Periode, Poste } from '@/lib/types';


const jours = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5) + 1;

/** Les dates d'un poste, en clair : « Du 3 nov. au 12 nov. », « À partir du … », « Jusqu'au … ». */
function datesPoste(p: Poste) {
  return p.debut && p.fin ? `Du ${fmtCourt(p.debut)} au ${fmtCourt(p.fin)}` : p.debut ? `À partir du ${fmtCourt(p.debut)}` : p.fin ? `Jusqu'au ${fmtCourt(p.fin)}` : 'Sur toute la durée du budget';
}

/**
 * Créer ou modifier un poste, dans sa propre fenêtre : nom, icône, montant et dates au calendrier.
 * `libre` : ce qu'il reste à répartir dans le budget sans compter ce poste (null si le montant du budget n'est pas encore connu).
 */
function PosteDialogue({ init, devise, libre, bornes, brouillon, onEnregistrer, onRetirer, onFermer }: { init?: Poste; devise: string; libre: number | null; bornes?: { min?: string; max?: string }; /** Ouvert depuis le formulaire du budget : rien n'est enregistré avant « Enregistrer » du budget. */ brouillon?: boolean; onEnregistrer: (p: Poste) => void; onRetirer?: () => void; onFermer: () => void }) {
  const [nom, setNom] = useState(init?.nom ?? '');
  const [emoji, setEmoji] = useState<string | undefined>(init?.emoji);
  const [montant, setMontant] = useState(init?.montant ? String(init.montant).replace('.', ',') : '');
  const [debut, setDebut] = useState(init?.debut);
  const [fin, setFin] = useState(init?.fin);
  const m = lireMontant(montant);
  const valide = !!nom.trim() && !!m && m > 0;
  const enregistrer = () => {
    if (!valide) return;
    onEnregistrer({ id: init?.id ?? uid(), nom: nom.trim(), montant: m!, ...(emoji ? { emoji } : {}), ...(debut ? { debut } : {}), ...(fin && (!debut || fin >= debut) ? { fin } : {}) });
    onFermer();
  };
  const apres = libre === null || !m ? null : Math.round((libre - m) * 100) / 100;
  return (
    <Dialogue titre={init ? 'Modifier le poste' : 'Nouveau poste'} onFermer={onFermer}>
      <Input label="À quoi sert cet argent" value={nom} onChangeText={setNom} placeholder="Ex. Billets, Hôtel, Cadeaux" autoFocus={!init} returnKeyType="next" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {EMOJIS_BUDGET.map((x) => (
          <Pressable key={x} accessibilityRole="radio" aria-checked={x === emoji} accessibilityLabel={`Icône ${x}`} onPress={() => setEmoji(x === emoji ? undefined : x)} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: x === emoji ? C.accent : C.line, backgroundColor: x === emoji ? alpha(C.accent, 0.14) : 'transparent' }}>
            <Text style={{ fontSize: 18 }}>{x}</Text>
          </Pressable>
        ))}
      </View>
      <Input
        label={`Montant prévu (${devise})`}
        value={montant}
        onChangeText={setMontant}
        keyboardType="decimal-pad"
        placeholder="0"
        erreur={montant.trim() && !m ? 'Montant non reconnu : écris par exemple 120 ou 49,90.' : undefined}
        aide={apres === null ? undefined : apres < 0 ? `Dépasse ce qui reste à répartir de ${fmtMontant(-apres, devise)}.` : `Il restera ${fmtMontant(apres, devise)} à répartir dans le budget.`}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <ChampDate label="Du (facultatif)" value={debut} onChange={setDebut} min={bornes?.min} max={fin ?? bornes?.max} effacable placeholder="Dès le début" />
        <ChampDate label="Au (facultatif)" value={fin} onChange={setFin} min={debut ?? bornes?.min} max={bornes?.max} effacable placeholder="Jusqu’à la fin" />
      </View>
      <T small muted>
        Sans dates, le poste court sur toute la durée du budget.
        {brouillon ? ' Le poste sera enregistré avec le budget.' : ''}
      </T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={brouillon ? (init ? 'Valider' : 'Ajouter au budget') : init ? 'Enregistrer' : 'Ajouter'} onPress={enregistrer} disabled={!valide} />
        <Btn kind="sec" label="Annuler" onPress={onFermer} />
        {onRetirer ? (
          <Btn
            kind="danger"
            label="Retirer"
            onPress={() => {
              onRetirer();
              onFermer();
            }}
          />
        ) : null}
      </View>
    </Dialogue>
  );
}

/** Une ligne de poste, compacte : icône, nom, dates, montant. Un appui ouvre sa fenêtre. */
function LignePoste({ p, devise, onPress }: { p: Poste; devise: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Modifier le poste ${p.nom}`} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: C.sunk, opacity: pressed ? 0.75 : 1 })}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 15 }}>{p.emoji || '•'}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>
          {p.nom}
        </Text>
        <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
          {datesPoste(p)}
        </Text>
      </View>
      <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 14 }}>{fmtMontant(p.montant, devise)}</Text>
      <Text style={{ color: C.muted, fontSize: 16 }}>›</Text>
    </Pressable>
  );
}

/**
 * Comment le budget sera dépensé : des postes avec leur part (« Billets 300, Hôtel 400 »). C'est facultatif ;
 * sans plan, le budget se comporte comme avant. La somme des postes n'a pas à tomber juste.
 * Chaque poste se crée et se modifie dans sa propre fenêtre.
 */
function PlanBudget({ plan, setPlan, montant, devise, bornes }: { plan: Poste[]; setPlan: (p: Poste[]) => void; montant: number | null; devise: string; bornes?: { min?: string; max?: string } }) {
  const total = Math.round(plan.reduce((s, p) => s + p.montant, 0) * 100) / 100;
  const reste = montant === null ? null : Math.round((montant - total) * 100) / 100;
  // Le poste ouvert dans sa fenêtre : 'nouveau', ou celui qu'on modifie.
  const [ouvert, setOuvert] = useState<Poste | 'nouveau' | null>(null);
  const edite = ouvert && ouvert !== 'nouveau' ? ouvert : undefined;
  return (
    <View style={{ gap: 8 }}>
      <T small muted>
        Comment il sera dépensé (facultatif)
      </T>
      {plan.map((p) => (
        <LignePoste key={p.id} p={p} devise={devise} onPress={() => setOuvert(p)} />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Btn small kind="sec" label="+ Poste" onPress={() => setOuvert('nouveau')} />
        {plan.length && montant !== null ? (
          <T small style={{ color: reste !== null && reste < 0 ? C.agressif : C.muted }}>
            {reste !== null && reste < 0 ? `${fmtMontant(total, devise)} répartis pour un budget de ${fmtMontant(montant, devise)} : ${fmtMontant(-reste, devise)} de trop.` : `${fmtMontant(total, devise)} répartis, ${fmtMontant(reste ?? 0, devise)} encore libres.`}
          </T>
        ) : (
          <T small muted>
            Dis à quoi cet argent est destiné, et quand : chaque dépense pourra se ranger dans un poste, et Me suivra ce qui est prévu, dépensé et encore libre.
          </T>
        )}
      </View>
      {ouvert ? (
        <PosteDialogue
          key={edite?.id ?? 'nouveau'}
          init={edite}
          devise={devise}
          libre={reste === null ? null : Math.round((reste + (edite?.montant ?? 0)) * 100) / 100}
          bornes={bornes}
          brouillon
          onEnregistrer={(p) => setPlan(edite ? plan.map((x) => (x.id === p.id ? p : x)) : [...plan, p])}
          onRetirer={edite ? () => setPlan(plan.filter((x) => x.id !== edite.id)) : undefined}
          onFermer={() => setOuvert(null)}
        />
      ) : null}
    </View>
  );
}

function BudgetForm({ f, init, onDone, setF, extra }: { f: Finances; init?: Budget; onDone: () => void; setF: (fn: (f: Finances) => Finances) => void; /** Montré dans la même fenêtre, sous le formulaire (les dépenses du budget). */ extra?: ReactNode }) {
  const signaler = useSignalerSuppression();
  const [nom, setNom] = useState(init?.nom || '');
  const [emoji, setEmoji] = useState(init?.emoji || '🛒');
  const [montant, setMontant] = useState(init ? String(init.montant).replace('.', ',') : '');
  const [periode, setPeriode] = useState<Periode>(init?.periode || 'mois');
  const [portee, setPortee] = useState<'categorie' | 'global'>(init?.global ? 'global' : 'categorie');
  const [suit, setSuit] = useState<string[] | undefined>(init?.categories);
  // Durée : sans fin, ou jusqu'à une date ; le montant revient chaque période ou couvre toute la durée (enveloppe).
  const [duree, setDuree] = useState<'sans' | 'date'>(init?.fin ? 'date' : 'sans');
  const [couvre, setCouvre] = useState<'periode' | 'tout'>(init?.enveloppe ? 'tout' : 'periode');
  const [plan, setPlan] = useState<Poste[]>(init?.plan ?? []);
  const debut = init?.debut || today();
  const finB = useDateFin({ init: init?.fin, min: init?.fin && init.fin < today() ? init.fin : today(), titre: 'Jusqu’au', obligatoire: true });
  const m = lireMontant(montant);
  const valide = !!m && (portee === 'global' || !!nom.trim()) && (duree === 'sans' || !!finB.fin);
  // Des changements pas encore enregistrés (postes compris) : on prévient avant de fermer la fenêtre.
  const etat = JSON.stringify([nom, emoji, montant, periode, portee, suit, duree, couvre, plan, finB.fin]);
  const [depart] = useState(etat);
  const [quitter, setQuitter] = useState(false);
  const fermer = () => (etat !== depart && !quitter ? setQuitter(true) : onDone());

  const enregistrer = () => {
    if (!m || !valide) return;
    const dates = duree === 'date' && finB.fin ? { fin: finB.fin, ...(couvre === 'tout' ? { debut, enveloppe: true } : init?.debut ? { debut: init.debut } : {}) } : {};
    const postes = plan.filter((p) => p.nom.trim() && p.montant > 0).map((p) => ({ ...p, nom: p.nom.trim() }));
    const b: Budget = { id: init?.id || uid(), nom: portee === 'global' ? nom.trim() || 'Budget total' : nom.trim(), emoji: portee === 'global' ? '💰' : emoji, montant: m, periode, ...(portee === 'global' ? { global: true } : suit?.length ? { categories: suit } : {}), ...dates, ...(postes.length ? { plan: postes } : {}) };
    // Un seul budget global : en créer un remplace l'ancien.
    setF((f) => ({ ...f, budgets: init ? f.budgets.map((x) => (x.id === init.id ? b : b.global ? { ...x, global: undefined } : x)) : [...f.budgets.filter((x) => !(b.global && x.global)), b] }));
    onDone();
  };
  const supprimer = () => {
    if (!init) return;
    const lies = new Set(f.depenses.filter((x) => x.budget === init.id).map((x) => x.id));
    setF((f) => ({ ...f, budgets: f.budgets.filter((x) => x.id !== init.id), depenses: f.depenses.map((x) => (x.budget === init.id ? { ...x, budget: null } : x)) }));
    signaler({
      texte: `Budget « ${init.nom} » supprimé.`,
      restaurer: (g) => ({ ...g, budgets: g.budgets.some((x) => x.id === init.id) ? g.budgets : [...g.budgets, init], depenses: g.depenses.map((x) => (lies.has(x.id) && x.budget === null ? { ...x, budget: init.id } : x)) }),
    });
    onDone();
  };

  // En haut et à la place des boutons du bas : visible d'où qu'on ait demandé à fermer.
  const avertissement = quitter ? (
    <View style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: alpha(C.hebdo, 0.12) }}>
      <T>Tes changements ne sont pas enregistrés.</T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn small label="Enregistrer" onPress={enregistrer} disabled={!valide} />
        <Btn small kind="danger" label="Abandonner" onPress={onDone} />
        <Btn small kind="sec" label="Continuer" onPress={() => setQuitter(false)} />
      </View>
    </View>
  ) : null;

  return (
    <Dialogue titre={init ? 'Modifier le budget' : 'Nouveau budget'} onFermer={fermer}>
      {avertissement}
      <Seg
        label="Ce budget couvre"
        options={[
          { key: 'categorie', label: 'Une catégorie' },
          { key: 'global', label: 'Toutes mes dépenses' },
        ]}
        value={portee}
        onChange={setPortee}
      />
      <Input label={portee === 'global' ? 'Nom (facultatif)' : 'Nom du budget'} value={nom} onChangeText={setNom} placeholder={portee === 'global' ? 'Budget total' : 'Ex. Courses, Sorties, Transport'} />
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
      <Sep />
      <PlanBudget plan={plan} setPlan={setPlan} montant={m} devise={f.devise} bornes={duree === 'date' && couvre === 'tout' ? { min: debut, max: finB.fin ?? undefined } : duree === 'date' ? { max: finB.fin ?? undefined } : undefined} />
      {avertissement ?? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn label="Enregistrer" onPress={enregistrer} disabled={!valide} />
          <Btn kind="sec" label="Annuler" onPress={fermer} />
          {init ? <Btn kind="danger" label="Supprimer" onPress={supprimer} /> : null}
        </View>
      )}
      {extra}
    </Dialogue>
  );
}

/** Nouvelle dépense, ou modification d'une dépense déjà notée (`init`). */
function DepenseForm({ f, init, onDone, setF }: { f: Finances; init?: Depense; onDone: () => void; setF: (fn: (f: Finances) => Finances) => void }) {
  const { ajouterDepense } = useActions();
  const signaler = useSignalerSuppression();
  const [montant, setMontant] = useState(init ? String(init.origine?.montant ?? init.montant).replace('.', ',') : '');
  const [budget, setBudget] = useState<string | null>(init?.budget ?? null);
  const [poste, setPoste] = useState<string | null>(init?.poste ?? null);
  const [note, setNote] = useState(init?.note || '');
  const [cats, setCats] = useState<string[] | undefined>(init?.categories);
  const [repetition, setRepetition] = useState<Repetition>('une');
  const [justifs, setJustifs] = useState<Justificatif[]>(init?.justificatifs ?? []);
  const { date, element: choixDate } = useChoixDate(init?.date);
  const finRep = useDateFin({ min: date || today(), titre: "Jusqu'au (facultatif)" });
  const dev = useChoixDevise(f, init?.origine);
  const lu = lireMontant(montant);
  const conv = lu ? dev.convertir(lu) : null;
  const valide = !!conv && !!date && !(repetition !== 'une' && finRep.invalide);
  // Le budget qui comptera cette dépense (choisi, ou celui qui suit l'une de ses catégories) : c'est lui qui a les postes.
  const budgetChoisi = f.budgets.find((x) => x.id === idBudgetDe(f.budgets, { budget, categories: cats, date: date || today() }));

  const enregistrer = () => {
    if (!conv || !date || !valide) return;
    const { montant: m, origine } = conv;
    const avecPoste = poste && budgetChoisi?.plan?.some((p) => p.id === poste) ? { poste } : { poste: undefined };
    if (init) setF((g) => ({ ...dev.avecTaux(g), depenses: g.depenses.map((x) => (x.id === init.id ? poser({ ...x, montant: m, origine, budget, ...avecPoste, note: note.trim(), date, justificatifs: justifs.length ? justifs : undefined }, cats) : x)) }));
    else if (repetition !== 'une') {
      setF((g) => dev.avecTaux(g));
      creerRecurrence(setF, { genre: 'depense', montant: m, origine, note: note.trim(), budget, ...(cats?.length ? { categories: cats } : {}), frequence: repetition, debut: date, ...(finRep.fin ? { fin: finRep.fin } : {}) });
    } else {
      setF((g) => dev.avecTaux(g));
      ajouterDepense({ id: uid(), montant: m, origine, budget, ...(avecPoste.poste ? { poste: avecPoste.poste } : {}), ...(cats?.length ? { categories: cats } : {}), ...(justifs.length ? { justificatifs: justifs } : {}), note: note.trim(), date, creeLe: new Date().toISOString() });
    }
    onDone();
  };
  const supprimer = () => {
    if (!init) return;
    setF((g) => ({ ...g, depenses: g.depenses.filter((x) => x.id !== init.id) }));
    signaler({ texte: `Dépense de ${fmtMontant(init.montant, f.devise)} supprimée.`, restaurer: (g) => (g.depenses.some((x) => x.id === init.id) ? g : { ...g, depenses: [init, ...g.depenses] }) });
    onDone();
  };

  return (
    <Dialogue titre={init ? 'Modifier la dépense' : 'Nouvelle dépense'} onFermer={onDone}>
      <Input label={`Montant (${dev.devise})`} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" placeholder="Ex. 12,50" autoFocus={!init} returnKeyType="done" onSubmitEditing={enregistrer} />
      {dev.element}
      {conv?.origine ? <T small muted>≈ {fmtMontant(conv.montant, f.devise)}</T> : null}
      {/* Les catégories d'abord : elles décident du budget « selon la catégorie » proposé juste en dessous. */}
      <ChoixCategories value={cats} onChange={setCats} />
      <ChoixBudget budgets={f.budgets} value={budget} onChange={(b) => (setBudget(b), setPoste(null))} date={date || today()} categories={cats} />
      <ChoixPoste budget={budgetChoisi} value={poste} onChange={setPoste} />
      <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Ex. Marché du samedi" returnKeyType="done" onSubmitEditing={enregistrer} />
      {choixDate}
      {/* Un paiement qui revient crée une dépense par échéance : les justificatifs se joignent ensuite à chacune. */}
      {init || repetition === 'une' ? <ChampJustificatifs value={justifs} onChange={setJustifs} /> : null}
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
    </Dialogue>
  );
}

/**
 * Depuis un budget : les dépenses qui y comptent et celles à y lier, en un geste. Fenêtre : les dates du budget,
 * sinon les 60 derniers jours. Une dépense comptée d'office par sa catégorie se sort en changeant sa catégorie ou celles du budget.
 * Une dépense liée compte sur sa propre période (un relevé importé de septembre compte en septembre) : on le dit, avec
 * le reste de la période affichée, pour que lier change un chiffre visible.
 */
function DepensesDuBudget({ f, b, setF, vue, jourRef, onVoir }: { f: Finances; b: Budget; setF: (fn: (f: Finances) => Finances) => void; vue: Periode; jourRef: string; /** Ouvre la période qui contient cette date. */ onVoir: (date: string) => void }) {
  const d = today();
  const bl = bilan(f, vue, jourRef, d);
  const ici = bl.lignes.find((l) => l.budget.id === b.id);
  const { espace } = useStore();
  const [cherche, setCherche] = useState('');
  const [tout, setTout] = useState(false);
  const debut = b.debut ?? addDays(b.fin && b.fin < d ? b.fin : d, -59);
  const fin = b.fin && b.fin < d ? b.fin : d;
  const q = sansAccents(cherche.trim());
  const liste = f.depenses.filter((x) => !x.lien && x.date >= debut && x.date <= fin && (!q || sansAccents(`${x.note} ${x.montant}`).includes(q))).sort((x, y) => y.date.localeCompare(x.date));
  const dedans = (x: Depense) => idBudgetDe(f.budgets, x) === b.id;
  // Deux façons de compter dans ce budget : choisie à la main (« Lier »), ou d'office par une catégorie que le budget suit.
  const aLaMain = liste.filter((x) => dedans(x) && x.budget === b.id);
  const parCategorie = liste.filter((x) => dedans(x) && x.budget !== b.id);
  const autres = liste.filter((x) => !dedans(x));
  // Une dépense compte sur la période du budget qui la contient (son mois pour un budget au mois), pas forcément celle affichée.
  const horsVue = (x: Depense) => x.date < (ici ?? bl).debut || x.date > (ici ?? bl).fin;
  const ailleursEnTemps = [...aLaMain, ...parCategorie].filter(horsVue);
  const visibles = tout ? autres : autres.slice(0, 8);
  const suivies = categoriesDe(espace).filter((c) => b.categories?.includes(c.id));
  const nomsSuivies = suivies.map((c) => `« ${c.nom} »`).join(', ');
  const categorieDe = (x: Depense) => suivies.find((c) => x.categories?.includes(c.id));
  const poserBudget = (id: string, budget: string | null) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (x.id === id ? { ...x, budget } : x)) }));
  const ligne = (x: Depense, action: ReactNode, detail?: string) => (
    <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
          {x.note || 'Dépense'}
        </Text>
        <T small muted>
          {dateFr(x.date)} · {fmtMontant(x.montant, f.devise)}
          {detail ? ` · ${detail}` : ''}
        </T>
      </View>
      {action}
    </View>
  );
  const titre = (t: string) => <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 13, marginTop: 6 }}>{t}</Text>;
  const ailleurs = (x: Depense) => {
    const autre = f.budgets.find((y) => y.id === idBudgetDe(f.budgets, x));
    return autre ? `compte dans ${autre.nom}` : undefined;
  };
  return (
    <Panel title={`Ce qui compte dans « ${b.nom} »`} count={aLaMain.length + parCategorie.length || undefined}>
      <T small muted>
        {b.debut || b.fin ? `Du ${dateFr(debut)} au ${dateFr(fin)}.` : 'Sur les 60 derniers jours.'} Une dépense compte dans ce budget de deux façons :{' '}
        {suivies.length ? `d’office si elle porte la catégorie ${nomsSuivies} que ce budget suit, ou ` : ''}à la main, avec « Lier ». Lier et Retirer s’enregistrent tout de suite.
      </T>
      <View style={{ padding: 10, borderRadius: 12, backgroundColor: C.sunk, gap: 2 }}>
        <T small muted>{ici ? periodeBudget(ici) : libelle(vue, jourRef)}</T>
        <T small>
          {ici ? `${fmtMontant(ici.depense, f.devise)} dépensés · ${ici.reste < 0 ? `dépassé de ${fmtMontant(-ici.reste, f.devise)}` : `reste ${fmtMontant(ici.reste, f.devise)}`}` : 'Ce budget ne compte pas sur cette période.'}
        </T>
      </View>
      {ailleursEnTemps.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: 10, borderRadius: 12, backgroundColor: alpha(C.coach, 0.1) }}>
          <T small style={{ flex: 1, minWidth: 180 }}>
            {ailleursEnTemps.length > 1 ? `${ailleursEnTemps.length} dépenses liées tombent` : 'Une dépense liée tombe'} sur une autre période que celle-ci : {ailleursEnTemps.length > 1 ? 'elles comptent' : 'elle compte'} dans le budget de {ailleursEnTemps.length > 1 ? 'leur' : 'sa'} période, pas dans ce reste.
          </T>
          <Btn small kind="sec" label={voirPeriode(b.enveloppe ? vue : b.periode, ailleursEnTemps[0].date)} onPress={() => onVoir(ailleursEnTemps[0].date)} />
        </View>
      ) : null}
      <Input value={cherche} onChangeText={setCherche} placeholder="Rechercher une note, un montant" accessibilityLabel="Rechercher une dépense à lier" />
      {parCategorie.length ? (
        <>
          {titre(`D’office, par la catégorie · ${parCategorie.length}`)}
          {parCategorie.map((x) =>
            ligne(
              x,
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: alpha(categorieDe(x)?.couleur ?? C.accent, 0.16) }}>
                <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 12 }}>
                  {categorieDe(x) ? `${categorieDe(x)!.emoji} ${categorieDe(x)!.nom}` : 'Catégorie'}
                </Text>
              </View>,
              horsVue(x) ? `compte sur ${periodeDite(b.enveloppe ? vue : b.periode, x.date)}` : undefined,
            ),
          )}
          <T small muted>
            Pour en sortir une, change sa catégorie dans Mouvements, ou retire {nomsSuivies || 'la catégorie'} de « Ce budget suit », plus haut.
          </T>
        </>
      ) : null}
      {aLaMain.length ? (
        <>
          {titre(`Liées à la main · ${aLaMain.length}`)}
          {aLaMain.map((x) => ligne(x, <Btn small kind="sec" label="Retirer" onPress={() => poserBudget(x.id, null)} />, horsVue(x) ? `compte sur ${periodeDite(b.enveloppe ? vue : b.periode, x.date)}` : undefined))}
        </>
      ) : null}
      {autres.length ? (
        <>
          {parCategorie.length || aLaMain.length ? <Sep /> : null}
          {titre('Pas dans ce budget, à lier si tu veux')}
          {visibles.map((x) => {
            const detail = ailleurs(x);
            return ligne(x, <Btn small label={detail ? 'Déplacer ici' : 'Lier'} onPress={() => poserBudget(x.id, b.id)} />, detail);
          })}
          {!tout && autres.length > visibles.length ? <Btn small kind="sec" label={`Voir les ${autres.length - visibles.length} autres`} onPress={() => setTout(true)} /> : null}
        </>
      ) : null}
      {!liste.length ? (
        <T small muted>
          Aucune dépense sur ces dates{q ? ' pour cette recherche' : ''}.
        </T>
      ) : null}
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
  const epargne = epargneEntre(f, b.debut, b.fin);
  const total = Math.round(liste.reduce((s, x) => s + x.montant, 0) * 100) / 100;

  return (
    <Panel title="Dépenses" count={liste.length || undefined} right={liste.length ? <BoutonSelection sel={sel} /> : null}>
      {edition && b.depenses.some((x) => x.id === edition) ? <DepenseForm key={edition} f={f} init={b.depenses.find((x) => x.id === edition)} onDone={() => setEdition(null)} setF={setF} /> : null}
      {b.depenses.length > 4 || q ? <Input value={cherche} onChangeText={setCherche} placeholder="Rechercher une note, un budget, un montant" accessibilityLabel="Rechercher une dépense" /> : null}
      {categories.length && b.depenses.length ? (
        <Filtre
          label="Filtrer les dépenses par budget"
          options={[
            { key: 'tous', label: 'Toutes', compte: b.depenses.length },
            ...categories.map((c) => ({ key: c.id, label: `${c.emoji} ${c.nom}`, compte: b.depenses.filter((x) => effectif(x) === c.id).length })),
            { key: 'hors', label: 'Hors budget', compte: b.depenses.filter((x) => !effectif(x)).length },
          ]}
          value={filtre}
          onChange={setFiltre}
        />
      ) : null}
      {catalogue.length && b.depenses.length ? (
        <Filtre
          label="Filtrer les dépenses par catégorie"
          options={[
            { key: 'toutes', label: 'Toutes catégories' },
            ...catalogue.map((c) => ({ key: c.id, label: `${c.emoji} ${c.nom}`, compte: b.depenses.filter((x) => x.categories?.includes(c.id)).length })),
            { key: 'aucune', label: 'Sans catégorie', compte: b.depenses.filter((x) => !x.categories?.length).length },
          ]}
          value={filtreCat}
          onChange={setFiltreCat}
        />
      ) : null}
      {filtre !== 'tous' || filtreCat !== 'toutes' || q ? (
        <T small muted>
          {liste.length} dépense{liste.length > 1 ? 's' : ''} · {fmtMontant(total, f.devise)}
        </T>
      ) : null}
      {/* Un filtre de budget ou de catégorie choisi recharge la liste (pas la recherche tapée). */}
      <Differe key={`${filtre}-${filtreCat}`} duree={DUREE_CHARGEMENT} repli={<SqueletteLignes />}>
      {liste.length ? (
        <Limitee items={jours} n={7} nom="jours plus anciens" rendu={(jour) => {
          const du = liste.filter((x) => x.date === jour);
          return (
            <View key={jour} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{titreJour(jour, d)}</Text>
                <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{fmtMontant(Math.round(du.reduce((s, x) => s + x.montant, 0) * 100) / 100, f.devise)}</Text>
              </View>
              {du.map((x) => {
                const bu = nomBudget(effectif(x));
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
                          <MarqueJustificatifs n={x.justificatifs?.length} />
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
        }} />
      ) : b.depenses.length ? (
        <Empty icone="portefeuille">Aucune dépense ne correspond.</Empty>
      ) : (
        <Empty icone="portefeuille">Aucune dépense sur cette période. Ajoute-en une avec « + Dépense », ou écris « 12 € courses » avec le bouton + de l'accueil.</Empty>
      )}
      </Differe>
      {epargne.nb ? (
        <T small muted>
          {epargne.nb > 1 ? `${epargne.nb} versements` : '1 versement'} vers tes objectifs ({fmtMontant(epargne.total, f.devise)}) {epargne.nb > 1 ? 'ne sont pas comptés' : 'n’est pas compté'} ici : c’est de l’argent mis de côté. Tu {epargne.nb > 1 ? 'les' : 'le'} retrouves dans Objectifs et dans l’Historique.
        </T>
      ) : null}
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
              <Tuile emoji="📆" titre="reste sur tes budgets" valeur={s.bilan.plafondTotal ? fmtMontant(Math.round((s.bilan.plafondTotal - s.bilan.compte) * 100) / 100, f.devise) : '–'} evolution={s.bilan.plafondTotal ? `${fmtMontant(s.bilan.compte, f.devise)} notés sur ${fmtMontant(s.bilan.plafondTotal, f.devise)}` : undefined} />
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
            <Barres key={`${vue}-${jourRef}`} seuil={vue === 'jour' && s.bilan.plafondTotal ? s.bilan.plafondTotal : undefined} points={s.historique.map((x) => ({ cle: x.cle, axe: x.axe, v: x.v, detail: `${x.libelle} : ${fmtMontant(x.v, f.devise)} dépensés${x.plafond ? `, dont ${fmtMontant(x.compte, f.devise)} dans tes budgets sur ${fmtMontant(Math.round(x.plafond), f.devise)}` : ''}` }))} />
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
          <PlansDepenses f={f} bilan={s.bilan} />
          {s.postes.length ? (
            <Panel title="Ce que tu notes le plus">
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
            {s.historique.length > 1 ? `Sur les ${s.historique.length} ${derniers} ${plusieurs}, jusqu'au ${dateFr(s.bilan.fin)}` : `Sur ${derniers === 'derniers' ? 'ce' : 'cette'} ${un}`}
            {s.jourLePlusCher ? ` : c'est le ${s.jourLePlusCher} que tu dépenses le plus.` : '.'}
          </T>
        </Panel>
      ) : null}
    </>
  );
}

type Onglet = 'apercu' | 'budgets' | 'operations' | 'comptes' | 'objectifs' | 'analyses' | 'reglages';
type SousOps = 'depenses' | 'revenus' | 'tout';
type SousReglages = 'alertes' | 'recurrents' | 'devises';
/** Les onglets qu'un lien peut ouvrir directement (?onglet=…). */
const ONGLETS_LIEN: Onglet[] = ['apercu', 'budgets', 'operations', 'comptes', 'objectifs', 'analyses'];

/** La ligne de dates sous un poste : quand il est prévu, et ce qu'il en reste une fois sa date passée. */
function quandPoste(x: SuiviPoste) {
  if (!x.poste.debut && !x.poste.fin) return '';
  const quand = datesPoste(x.poste);
  if (x.etat === 'avenir') return `${quand} · pas encore commencé`;
  if (x.etat === 'termine') return `${quand} · terminé${x.resteApres ? ', non dépensé en entier' : ''}`;
  return quand;
}

/** Le plan de dépenses d'un budget, sous sa jauge : chaque poste avec ce qui était prévu et ce qui est dépensé. Un appui sur un poste l'ouvre pour le modifier. */
function PlanSuivi({ b, depenses, plafond, devise, onPoste }: { b: Budget; depenses: Depense[]; plafond: number; devise: string; onPoste?: (p: Poste) => void }) {
  const suivi = suiviPlan(b, depenses, plafond);
  if (!suivi) return null;
  return (
    <View style={{ gap: 8, padding: 10, borderRadius: 12, backgroundColor: C.sunk }}>
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>Prévu pour</Text>
      {suivi.postes.map((x) => (
        <Pressable key={x.poste.id} accessibilityRole="button" accessibilityLabel={`Modifier le poste ${x.poste.nom}`} disabled={!onPoste} onPress={() => onPoste?.(x.poste)} hitSlop={4} style={({ pressed }) => ({ gap: 4, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={{ flex: 1, color: x.etat === 'avenir' ? C.muted : C.ink, fontFamily: F.texte, fontSize: 14 }}>
              {x.poste.emoji ? `${x.poste.emoji} ` : ''}
              {x.poste.nom}
            </Text>
            <Text style={{ color: x.depasse ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 13 }}>
              {fmtMontant(x.depense, devise)} / {fmtMontant(x.prevu, devise)}
            </Text>
          </View>
          <Jauge ratio={x.ratio} hauteur={5} />
          {quandPoste(x) ? (
            <Text style={{ color: x.resteApres ? C.hebdo : C.muted, fontFamily: F.texte, fontSize: 12 }}>{quandPoste(x)}</Text>
          ) : null}
        </Pressable>
      ))}
      {suivi.horsPostes ? (
        <T small muted>
          {fmtMontant(suivi.horsPostes, devise)} dépensés sans poste.
        </T>
      ) : null}
    </View>
  );
}

/** Renvoi vers un autre onglet de l'écran, dans le coin d'un panneau. */
function Lien({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>{label} ›</Text>
    </Pressable>
  );
}

/** Sous-titre d'un budget : son montant et, s'il en a, ses dates. */
/** La période d'une date, à glisser dans une phrase : « septembre 2026 », « la semaine du 5 au 11 octobre », « le lundi 5 octobre 2026 ». */
function periodeDite(vue: Periode, x: string) {
  const l = libelle(vue, x);
  return vue === 'semaine' ? `la semaine ${l.toLowerCase()}` : vue === 'jour' ? `le ${l.toLowerCase()}` : vue === 'annee' ? `l’année ${l}` : l.toLowerCase();
}
/** Le bouton qui ouvre cette période : « Voir septembre 2026 », ou « Voir cette semaine-là » quand le libellé est long. */
const voirPeriode = (vue: Periode, x: string) => (vue === 'mois' || vue === 'trimestre' || vue === 'annee' ? `Voir ${libelle(vue, x).toLowerCase()}` : vue === 'semaine' ? 'Voir cette semaine-là' : 'Voir ce jour-là');

/** La période sur laquelle un budget se compte : « Octobre 2026 », « Du 26 octobre au 1er novembre », « Du 3 nov. au 30 nov. ». */
function periodeBudget(l: Pick<Ligne, 'budget' | 'debut' | 'fin'>) {
  const p = bornes(l.budget.periode, l.debut);
  return !l.budget.enveloppe && p.debut === l.debut && p.fin === l.fin ? libelle(l.budget.periode, l.debut) : `Du ${dateFr(l.debut)} au ${dateFr(l.fin)}`;
}

function detailBudget(b: Budget, devise: string) {
  const m = fmtMontant(b.montant, devise);
  if (b.fin && b.enveloppe && b.debut) return `${m} du ${dateFr(b.debut)} au ${dateFr(b.fin)}`;
  return `${m} ${parPeriode(b.periode)}${b.fin ? ` · jusqu'au ${dateFr(b.fin)}` : ''}`;
}

export default function FinancesEcran() {
  const { espace, update } = useStore();
  const f = financesDe(espace);
  const d = today();
  // Un lien peut ouvrir un onglet précis (?onglet=objectifs depuis le calendrier) ; le bouton « Dépense » de la barre
  // du bas ouvre la saisie d'une dépense (?ajout=…, une valeur nouvelle à chaque appui pour rouvrir la fenêtre).
  const { onglet: ongletDemande, ajout } = useLocalSearchParams<{ onglet?: string; ajout?: string }>();
  const ongletLien = ongletDemande && ONGLETS_LIEN.includes(ongletDemande as Onglet) ? (ongletDemande as Onglet) : null;
  const [onglet, setOnglet] = useState<Onglet>(ongletLien ?? 'apercu');
  const [ongletVu, setOngletVu] = useState(ongletDemande);
  if (ongletDemande !== ongletVu) {
    setOngletVu(ongletDemande);
    if (ongletLien) setOnglet(ongletLien);
  }
  const [sousOps, setSousOps] = useState<SousOps>('depenses');
  const [sousStats, setSousStats] = useState<PartieStats>('evolution');
  const [sousReglages, setSousReglages] = useState<SousReglages>('alertes');
  const [vue, setVue] = useState<Periode>('mois');
  const [decal, setDecal] = useState(0);
  const [form, setForm] = useState<'depense' | 'budget' | Budget | null>(ajout ? 'depense' : null);
  const [ajoutVu, setAjoutVu] = useState(ajout);
  if (ajout !== ajoutVu) {
    setAjoutVu(ajout);
    if (ajout) setForm('depense');
  }
  // Un poste ouvert depuis la liste des budgets, pour le modifier sans passer par tout le budget.
  const [posteOuvert, setPosteOuvert] = useState<{ b: Budget; p: Poste } | null>(null);
  const [choixPeriode, setChoixPeriode] = useState(false);
  // Le reste non dépensé d'une période, à reporter sur une autre ou à verser sur un objectif.
  const [aReporter, setAReporter] = useState<{ periode: Periode; ref: string } | null>(null);
  // Sur téléphone, chaque barre d'options mange l'écran : on en montre moins et on range le reste dans des fenêtres.
  const telephone = useWindowDimensions().width < 600;
  const sel = useSelection();
  // Import d'un relevé en cours (avec le compte déjà choisi, le cas échéant) ; filtres d'ouverture de « Historique ».
  const [importer, setImporter] = useState<{ compte: string | null } | null>(null);
  const [msgImport, setMsgImport] = useState('');
  const [opsFiltre, setOpsFiltre] = useState<Partial<Filtres> | undefined>(undefined);
  const [opsCle, setOpsCle] = useState(0);
  const setF = (fn: (f: Finances) => Finances) => update((e) => ({ ...e, finances: fn(financesDe(e)) }));
  // « Supprimé · Annuler » après une suppression faite dans l'une des fenêtres de l'écran.
  const annulation = useAnnulation(setF);
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
  // Un relevé importé d'un mois passé ne change pas les budgets du mois affiché : on propose d'aller voir le sien.
  const derniereImportee = b.enCours && !b.depenses.some((x) => x.reference) ? f.depenses.reduce<string | null>((m, x) => (x.reference && !x.lien && x.date < b.debut && (!m || x.date > m) ? x.date : m), null) : null;
  const precedent = bilan(f, vue, decaler(vue, jourRef, -1), d).total;
  const ecart = precedent ? Math.round(((b.total - precedent) / precedent) * 100) : null;
  // Face au plafond, seulement ce qui compte dans les budgets (sans budget global, le hors budget est à part).
  const ratio = b.plafondTotal ? b.compte / b.plafondTotal : 0;
  const reste = Math.round((b.plafondTotal - b.compte) * 100) / 100;
  const sansGlobal = !f.budgets.some((x) => x.global);
  // Ce qu'on peut reporter de la période affichée, et ce que les reports y ont déjà changé (déjà compté dans le plafond).
  const reportables = restesReportables(f, vue, jourRef, d);
  // Proposé une fois la période du budget finie (dès aujourd'hui pour un budget par jour) : un mois en cours peut encore se dépenser.
  const finis = reportables.filter((x) => {
    const l = b.lignes.find((y) => y.budget.id === x.budget.id);
    return !!l && (l.fin < d || (l.budget.periode === 'jour' && !l.budget.enveloppe));
  });
  const resteFinis = Math.round(finis.reduce((s2, x) => s2 + (x.budget.global || sansGlobal ? x.reste : 0), 0) * 100) / 100;
  const reporte = Math.round((sansGlobal ? b.lignes.reduce((s2, l) => s2 + l.reporte, 0) : (b.lignes.find((l) => l.budget.global)?.reporte ?? 0)) * 100) / 100;
  // Des budgets suivis sur une autre période que celle affichée (un budget au mois vu sur une semaine) : on le dit.
  const autresPeriodes = b.lignes.some((l) => l.autrePeriode);
  // Revenus de la période et ce qu'il en reste : le même calcul que l'accueil, pour que les deux écrans disent la même chose.
  const revenus = totalRevenus(revenusEntre(f, b.debut, b.fin));
  const solde = Math.round((revenus - b.total) * 100) / 100;
  // Versements vers un objectif notés comme dépenses : mis de côté, pas dépensés (voir `depensesEntre`).
  const epargne = epargneEntre(f, b.debut, b.fin);
  const categories = f.budgets.filter((x) => !x.global);
  // Les budgets montrés en aperçu : les plus consommés d'abord, le budget total en tête.
  const apercuBudgets = [...b.lignes].sort((x, y) => Number(!!y.budget.global) - Number(!!x.budget.global) || y.ratio - x.ratio).slice(0, 5);
  // Budget journalier proposé : la moyenne des 30 derniers jours, arrondie aux 5 du dessus (20 sans historique).
  const moyenne30 = depensesEntre(f, addDays(d, -29), d).reduce((s, x) => s + x.montant, 0) / 30;
  const suggestionJour = moyenne30 > 0 ? Math.max(5, Math.ceil(moyenne30 / 5) * 5) : 20;
  const idees = BUDGETS_SUGGERES.filter((x) => !f.budgets.some((y) => y.nom.toLowerCase() === x.nom.toLowerCase()));
  // Budgets arrivés à leur date de fin : ils ne comptent plus, mais restent modifiables (pour les prolonger) ou supprimables.
  // Les virements entre mes comptes de la période : ni dépenses ni revenus, mais ils se voient ici.
  const virementsPeriode = listeVirements(operationsDe(f).filter((x) => x.date >= b.debut && x.date <= b.fin));
  const termines = f.budgets.filter((x) => x.fin && x.fin < d).sort((x, y) => y.fin!.localeCompare(x.fin!));

  // Ranger d'un coup dans le budget de son choix (ceux qui comptent aujourd'hui), ou poser une catégorie.
  const ranger = (budget: string | null) => (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (ids.includes(x.id) ? { ...x, budget } : x)) }));
  const actionsLot = [
    ...(categories.length
      ? [{ label: 'Budget', onPress: () => {}, choix: [...categories.filter((c) => etatBudget(c, d) === 'en_cours').map((c) => ({ label: `${c.emoji} ${c.nom}`, onPress: ranger(c.id) })), { label: 'Selon la catégorie ou hors budget', onPress: ranger(null) }] }]
      : []),
    ...(categoriesDe(espace).length
      ? [
          {
            label: 'Catégories',
            onPress: () => {},
            choix: [
              ...categoriesDe(espace).map((c) => ({ label: `+ ${c.emoji} ${c.nom}`, onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (ids.includes(x.id) ? poser(x, x.categories?.includes(c.id) ? x.categories : [...(x.categories ?? []), c.id]) : x)) })) })),
              { label: 'Retirer les catégories', onPress: (ids: string[]) => setF((g) => ({ ...g, depenses: g.depenses.map((x) => (ids.includes(x.id) ? poser(x, undefined) : x)) })) },
            ],
          },
        ]
      : []),
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
      {/* Sur téléphone, le choix de la durée tient dans le titre (il ouvre une fenêtre) : une barre en moins avant les chiffres. */}
      {telephone ? null : (
        <SousOnglets
          label="Période"
          options={PERIODES.map((p) => ({ key: p.key, label: p.label }))}
          value={vue}
          onChange={(v) => {
            setVue(v);
            setDecal(0);
          }}
        />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn label="Période précédente" glyph="‹" onPress={() => setDecal(decal - 1)} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={telephone ? `${libelle(vue, jourRef)}. Changer la durée affichée` : decal ? 'Revenir à la période en cours' : libelle(vue, jourRef)}
          disabled={!telephone && !decal}
          onPress={() => (telephone ? setChoixPeriode(true) : setDecal(0))}
          style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>
            {libelle(vue, jourRef)}
            {telephone ? ' ▾' : ''}
          </Text>
          {decal ? (
            <Pressable accessibilityRole="button" onPress={() => setDecal(0)} hitSlop={8}>
              <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 12 }}>Revenir à la période en cours</Text>
            </Pressable>
          ) : null}
        </Pressable>
        <IconBtn label="Période suivante" glyph="›" onPress={() => setDecal(decal + 1)} />
      </View>
      {choixPeriode ? (
        <Dialogue titre="Durée affichée" onFermer={() => setChoixPeriode(false)}>
          {PERIODES.map((p) => (
            <Btn
              key={p.key}
              kind={p.key === vue ? 'primary' : 'sec'}
              label={p.label}
              onPress={() => {
                setVue(p.key);
                setDecal(0);
                setChoixPeriode(false);
              }}
            />
          ))}
        </Dialogue>
      ) : null}
    </>
  );
  const avecPeriode = onglet === 'apercu' || onglet === 'budgets' || onglet === 'analyses' || (onglet === 'operations' && sousOps !== 'tout');
  const enDepenses = onglet === 'operations' && sousOps === 'depenses';
  // Chaque changement d'onglet, de sous-onglet ou de période recharge la vue : un squelette de sa forme le montre.
  const cleVue = `${onglet}-${sousOps}-${sousStats}-${sousReglages}-${vue}-${decal}`;
  const repliVue =
    onglet === 'operations' && sousOps === 'tout' ? (
      <SqueletteOperations />
    ) : onglet === 'operations' ? (
      <Panel>
        <SqueletteLignes />
      </Panel>
    ) : (
      <SqueletteVueFinances />
    );

  return (
    <AnnulerFinances value={annulation.signaler}>
    <Screen pied={sel.actif && enDepenses ? <BarreSelection sel={sel} tous={b.depenses.map((x) => x.id)} actions={actionsLot} onglets={false} /> : annulation.texte ? <BarreAnnuler texte={annulation.texte} annuler={annulation.annuler} fermer={annulation.fermer} /> : null}>
      {onglet === 'reglages' ? (
        <Header retour onRetour={() => aller('apercu')} eyebrow="Finances" title="Réglages" />
      ) : (
        <Header
          eyebrow="Budgets et dépenses"
          title="Finances"
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconBtn label="Réglages : alertes, paiements récurrents, devises" glyph="⚙" onPress={() => aller('reglages')} />
              <Btn small label="+ Dépense" onPress={() => setForm('depense')} />
            </View>
          }
        />
      )}

      {form === 'depense' ? <DepenseForm f={f} onDone={() => setForm(null)} setF={setF} /> : null}
      {form && form !== 'depense' ? (
        <BudgetForm
          key={form === 'budget' ? 'nouveau' : form.id}
          f={f}
          init={form === 'budget' ? undefined : form}
          onDone={() => setForm(null)}
          setF={setF}
          extra={form !== 'budget' && !form.global ? <DepensesDuBudget
                key={`lier-${form.id}`}
                f={f}
                b={f.budgets.find((x) => x.id === form.id) ?? form}
                setF={setF}
                vue={vue}
                jourRef={jourRef}
                onVoir={(x) => {
                  setForm(null);
                  setDecal(ecartPeriodes(vue, d, x));
                  aller('budgets');
                }}
              /> : null}
        />
      ) : null}

      {aReporter ? <ReporterReste key={`${aReporter.periode}-${aReporter.ref}`} f={f} periode={aReporter.periode} refDate={aReporter.ref} d={d} setF={setF} onFermer={() => setAReporter(null)} /> : null}

      {posteOuvert ? (
        <PosteDialogue
          key={posteOuvert.p.id}
          init={posteOuvert.p}
          devise={f.devise}
          libre={Math.round((posteOuvert.b.montant - (posteOuvert.b.plan ?? []).reduce((s, x) => s + (x.id === posteOuvert.p.id ? 0 : x.montant), 0)) * 100) / 100}
          bornes={posteOuvert.b.enveloppe ? { min: posteOuvert.b.debut, max: posteOuvert.b.fin } : { max: posteOuvert.b.fin }}
          onEnregistrer={(p) => setF((g) => ({ ...g, budgets: g.budgets.map((x) => (x.id === posteOuvert.b.id ? { ...x, plan: (x.plan ?? []).map((y) => (y.id === p.id ? p : y)) } : x)) }))}
          onRetirer={() => {
            const { b: bu, p } = posteOuvert;
            const rang = (bu.plan ?? []).findIndex((y) => y.id === p.id);
            const ranges = new Set(f.depenses.filter((x) => x.poste === p.id).map((x) => x.id));
            setF((g) => ({
              ...g,
              budgets: g.budgets.map((x) => (x.id === bu.id ? { ...x, plan: x.plan?.filter((y) => y.id !== p.id) } : x)),
              depenses: g.depenses.map((x) => (x.poste === p.id ? { ...x, poste: undefined } : x)),
            }));
            annulation.signaler({
              texte: `Poste « ${p.nom} » retiré de « ${bu.nom} ».`,
              restaurer: (g) => ({
                ...g,
                budgets: g.budgets.map((x) => (x.id !== bu.id || x.plan?.some((y) => y.id === p.id) ? x : { ...x, plan: [...(x.plan ?? []).slice(0, rang), p, ...(x.plan ?? []).slice(rang)] })),
                depenses: g.depenses.map((x) => (ranges.has(x.id) && !x.poste ? { ...x, poste: p.id } : x)),
              }),
            });
          }}
          onFermer={() => setPosteOuvert(null)}
        />
      ) : null}

      <Collant>
        {onglet === 'reglages' ? null : (
          <Onglets
            options={[
              { key: 'apercu', label: 'Aperçu' },
              { key: 'budgets', label: 'Budgets', compte: f.budgets.length - termines.length || undefined },
              { key: 'mouvements', label: 'Mouvements' },
              { key: 'comptes', label: 'Comptes' },
              { key: 'objectifs', label: 'Objectifs' },
            ]}
            value={onglet === 'operations' || onglet === 'analyses' ? 'mouvements' : onglet}
            onChange={(o) => aller(o === 'mouvements' ? 'operations' : o)}
          />
        )}

        {onglet === 'operations' || onglet === 'analyses' ? (
          <SousOnglets
            label="Mouvements"
            options={[
              { key: 'depenses', label: 'Dépenses' },
              { key: 'revenus', label: 'Revenus' },
              { key: 'tout', label: 'Historique' },
              { key: 'analyses', label: 'Analyses' },
            ]}
            value={onglet === 'analyses' ? 'analyses' : sousOps}
            onChange={(o) => (o === 'analyses' ? aller('analyses') : aller('operations', o))}
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
      </Collant>

      <Differe key={cleVue} duree={DUREE_CHARGEMENT} repli={repliVue}>

      {onglet === 'apercu' ? (
        <Colonnes
          gauche={
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
                      {reste < 0 ? 'Dépassé de' : 'Reste à dépenser'}
                    </T>
                    <Text style={{ color: couleurRatio(ratio), fontFamily: F.chiffre, fontSize: 22 }}>{fmtMontant(Math.abs(reste), f.devise)}</Text>
                  </View>
                ) : null}
              </View>
              {b.plafondTotal ? (
                <>
                  <Jauge ratio={ratio} hauteur={10} />
                  <T small muted>
                    {sansGlobal
                      ? `Dans tes budgets : ${fmtMontant(b.compte, f.devise)} notés sur ${fmtMontant(b.plafondTotal, f.devise)} (${Math.round(ratio * 100)} %).`
                      : `${fmtMontant(b.compte, f.devise)} notés, ${Math.round(ratio * 100)} % de ton budget total de ${fmtMontant(b.plafondTotal, f.devise)}.`}
                    {autresPeriodes ? ' Chaque budget compte sur sa propre période (son mois pour un budget au mois), sans être réparti par jour.' : ''}
                    {sansGlobal && b.horsBudget ? ` Hors budget : ${fmtMontant(b.horsBudget, f.devise)}, à part (ni dans la jauge, ni dans le reste).` : ''}
                    {reporte > 0 ? ` Dont ${fmtMontant(reporte, f.devise)} reportés d’une autre période.` : reporte < 0 ? ` ${fmtMontant(-reporte, f.devise)} déjà reportés ailleurs.` : ''}
                  </T>
                  {/* Une semaine ou un mois en cours peut encore se dépenser : on propose le report une fois fini (un jour, dès aujourd'hui). */}
                  {resteFinis > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: 10, borderRadius: 12, backgroundColor: alpha(C.coach, 0.1) }}>
                      <T small style={{ flex: 1, minWidth: 180 }}>
                        {finis.some((x) => x.case.debut === d) ? 'Pas encore dépensé' : 'Pas dépensé'} : <Text style={{ fontFamily: F.texteF, color: C.coach }}>{fmtMontant(resteFinis, f.devise)}</Text>. Mets-le sur une autre période ou sur un objectif.
                      </T>
                      <Btn small kind="sec" label="Reporter le reste" onPress={() => setAReporter({ periode: vue, ref: jourRef })} />
                    </View>
                  ) : null}
                </>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => aller('budgets')} style={{ alignSelf: 'flex-start' }}>
                  <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Crée un budget pour voir ce qu'il te reste à dépenser ›</Text>
                </Pressable>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="Voir les revenus" onPress={() => aller('operations', 'revenus')} style={({ pressed }) => ({ flexGrow: 1, flexBasis: '45%', minWidth: 140, opacity: pressed ? 0.75 : 1 })}>
                  <Tuile emoji="💰" titre="Revenus de la période" valeur={fmtMontant(revenus, f.devise)} evolution="Voir et ajouter ›" />
                </Pressable>
                <Tuile emoji={solde < 0 ? '⚠️' : '🟢'} titre={solde < 0 ? 'Dépensé de plus que gagné' : 'Mis de côté'} valeur={fmtMontant(Math.abs(solde), f.devise)} evolution={epargne.total ? `dont ${fmtMontant(epargne.total, f.devise)} versés à tes objectifs` : undefined} />
              </View>
              {ecart !== null ? (
                <T small muted>
                  Dépensé : {ecart === 0 ? 'autant que' : `${ecart > 0 ? '+' : ''}${ecart} % par rapport à`} la période précédente ({fmtMontant(precedent, f.devise)}).
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
              <PanneauReports f={f} debut={b.debut} fin={b.fin} setF={setF} />
              {vue === 'semaine' || vue === 'mois' ? <JourParJour key={`${vue}-${jourRef}`} f={f} vue={vue} jourRef={jourRef} voirJour={voirJour} onReporter={(x) => setAReporter({ periode: 'jour', ref: x })} /> : null}
            </>
          }
          droite={
            <>
              {decal === 0 ? <PanneauPrevisions f={f} d={d} seuil={f.alertes?.seuil ?? 1} /> : null}
              <Panel title="Mes budgets" count={apercuBudgets.length || undefined} right={<Lien label="Tous les budgets" onPress={() => aller('budgets')} />}>
                {apercuBudgets.length ? (
                  apercuBudgets.map((l) => (
                    <Pressable key={l.budget.id} accessibilityRole="button" accessibilityLabel={`Modifier le budget ${l.budget.nom}`} onPress={() => (aller('budgets'), setForm(l.budget))} style={({ pressed }) => ({ gap: 6, paddingVertical: 4, opacity: pressed ? 0.7 : 1 })}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 15 }}>{l.budget.emoji}</Text>
                        <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
                          {l.budget.nom}
                        </Text>
                        <Text style={{ color: couleurRatio(l.ratio), fontFamily: F.texteM, fontSize: 13 }}>
                          {l.reste >= 0 ? `reste ${fmtMontant(Math.round(l.reste * 100) / 100, f.devise)}` : `dépassé de ${fmtMontant(-l.reste, f.devise)}`}
                        </Text>
                      </View>
                      <Jauge ratio={l.ratio} hauteur={6} />
                    </Pressable>
                  ))
                ) : (
                  <Empty icone="portefeuille">Aucun budget sur cette période. Crée-en un dans l’onglet Budgets.</Empty>
                )}
              </Panel>

              <ApercuObjectifs f={f} onVoir={() => aller('objectifs')} />

              <Panel title="Dernières dépenses" right={b.depenses.length ? <Lien label="Toutes" onPress={() => aller('operations', 'depenses')} /> : null}>
                {b.depenses.length ? (
                  b.depenses.slice(0, 5).map((x, n) => {
                    const bu = categories.find((c) => c.id === idBudgetDe(f.budgets, x));
                    return (
                      <View key={x.id}>
                        {n ? <Sep /> : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}>
                          <Text style={{ fontSize: 16 }}>{bu?.emoji || (x.recurrence ? '🔁' : '💸')}</Text>
                          <View style={{ flex: 1, gap: 1 }}>
                            <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
                              {x.note || bu?.nom || 'Dépense'}
                            </Text>
                            <T small muted>
                              {titreJour(x.date, d)}
                              {bu ? ` · ${bu.nom}` : ''}
                            </T>
                          </View>
                          <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>{fmtMontant(x.montant, f.devise)}</Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Empty icone="portefeuille">Aucune dépense sur cette période.</Empty>
                )}
              </Panel>

              {virementsPeriode.length ? (
                <Panel title="Virements entre tes comptes" count={virementsPeriode.length} right={<Lien label="Comptes" onPress={() => aller('comptes')} />}>
                  {virementsPeriode.slice(0, 3).map((v) => (
                    <View key={v.lien} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: alpha(C.accent, 0.1) }}>
                      <Text style={{ color: C.accent, fontSize: 16 }}>⇄</Text>
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>
                          {nomCompte(f, v.de)} → {nomCompte(f, v.vers)}
                        </Text>
                        <T small muted>{titreJour(v.date, d)}</T>
                      </View>
                      <Text style={{ color: C.accent, fontFamily: F.chiffre, fontSize: 15 }}>{fmtMontant(v.montant, f.devise)}</Text>
                    </View>
                  ))}
                  <T small muted>Ce n’est ni une dépense ni un revenu : ça ne change pas tes budgets.</T>
                </Panel>
              ) : null}

              {!comptesDe(f).length ? (
                <Panel accent>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <View style={{ flex: 1, minWidth: 180, gap: 2 }}>
                      <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>Importe ton relevé bancaire (CSV)</Text>
                      <T small muted>
                        Toutes tes opérations d’un coup, rangées par compte, sans doublons.
                      </T>
                    </View>
                    <Btn small label="Importer un CSV" onPress={() => importerReleve(null)} />
                  </View>
                </Panel>
              ) : null}
            </>
          }
        />
      ) : null}

      {onglet === 'budgets' ? (
        <Colonnes
          gauche={<>
              <Panel title="Budgets" count={b.lignes.length || undefined} right={<Btn small kind="sec" label="+ Budget" onPress={() => setForm('budget')} />}>
                {b.lignes.length ? (
                  [...b.lignes]
                    .sort((x, y) => Number(!!y.budget.global) - Number(!!x.budget.global) || y.ratio - x.ratio)
                    .map((l, i) => {
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
                                  {l.autrePeriode && !l.budget.enveloppe ? ` · ${periodeBudget(l).replace(/^D/, 'd')}` : ''}
                                </T>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>{fmtMontant(l.depense, f.devise)}</Text>
                                <Text style={{ color: couleurRatio(l.ratio), fontFamily: F.texteM, fontSize: 12 }}>{l.reste >= 0 ? `reste ${fmtMontant(Math.round(l.reste * 100) / 100, f.devise)}` : `dépassé de ${fmtMontant(-l.reste, f.devise)}`}</Text>
                              </View>
                            </View>
                            <Jauge ratio={l.ratio} />
                            {l.budget.plan?.length ? <PlanSuivi b={l.budget} depenses={l.budget.global ? b.depenses : b.depenses.filter((x) => idBudgetDe(f.budgets, x) === l.budget.id)} plafond={l.plafond} devise={f.devise} onPoste={(p) => setPosteOuvert({ b: l.budget, p })} /> : null}
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
                {derniereImportee ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: 10, borderRadius: 12, backgroundColor: alpha(C.coach, 0.1) }}>
                    <T small style={{ flex: 1, minWidth: 180 }}>
                      Tes dernières opérations importées sont sur {periodeDite(vue, derniereImportee)} : elles comptent dans les budgets de cette période-là, pas de celle-ci.
                    </T>
                    <Btn small kind="sec" label={voirPeriode(vue, derniereImportee)} onPress={() => setDecal(ecartPeriodes(vue, d, derniereImportee))} />
                  </View>
                ) : null}
                {b.horsBudget && categories.length ? (
                  <T small muted>
                    Hors budget sur la période : {fmtMontant(b.horsBudget, f.devise)}, compté dans aucun budget.
                  </T>
                ) : null}
              </Panel>
          </>}
          droite={<>
            {termines.length ? (
              <Pliable panneau titre="Budgets terminés" count={termines.length}>
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
              </Pliable>
            ) : null}
          </>}
        />
      ) : null}

      {enDepenses ? (
        <>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <View style={{ alignSelf: 'flex-start' }}>
              <Btn small kind="sec" label="Importer un relevé bancaire (CSV)" onPress={() => importerReleve(null)} />
            </View>
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
              onDone={(m, compte, dates) => {
                setImporter(null);
                // Les opérations gardent la date de la banque : si elle est hors de la période affichée, les budgets n'y bougeraient pas.
                // On affiche donc la période qui contient les dépenses importées, et on le dit.
                const ou = m && dates ? periodePourDates(vue, jourRef, d, dates) : null;
                if (ou) {
                  setVue(ou.vue);
                  setDecal(ou.decal);
                }
                setMsgImport(ou ? `${m} Les budgets affichent maintenant ${libelle(ou.vue, decaler(ou.vue, d, ou.decal)).toLowerCase()}, la période de ces dépenses.` : m);
                // Ce qui vient d'être importé a souvent une autre date que la période affichée : on l'ouvre dans « Historique ».
                if (m) voirOperations(compte ? { compte } : {});
              }}
            />
          ) : (
            <PanneauComptes f={f} setF={setF} onImporter={importerReleve} onVoir={voirOperations} />
          )}
        </>
      ) : null}

      {onglet === 'objectifs' ? <PanneauObjectifs f={f} setF={setF} /> : null}

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
      </Differe>
    </Screen>
    </AnnulerFinances>
  );
}
