import { useState } from 'react';
import { Text, View } from 'react-native';

import { useSignalerSuppression } from '@/components/annuler';
import { ChampDate } from '@/components/calendrier';
import { Puce, type SetF } from '@/components/finances-plus';
import { Btn, Dialogue, IconBtn, Input, Panel, Sep, Seg, T } from '@/components/ui';
import { uid } from '@/lib/dates';
import { bornes, etatBudget, fmtMontant, lireMontant } from '@/lib/finances';
import { objectifsActifs, suiviObjectif } from '@/lib/objectifs';
import { annulerReport, type Arrivee, arriveesProposees, caseDe, erreurReport, libelleCase, libelleMinuscule, reportsDeLaPeriode, reporter, restesReportables } from '@/lib/reports';
import { alpha, C, F } from '@/lib/theme';
import type { Finances, Periode, Report } from '@/lib/types';

const enTexte = (n: number) => String(n).replace('.', ',');
/** « le mardi 27 octobre 2026 », « du 26 oct. au 1er nov. », « en octobre 2026 ». */
const quand = (p: Periode, d: string) => {
  const bas = libelleMinuscule(p, d);
  return p === 'jour' ? `le ${bas}` : p === 'semaine' ? bas : p === 'trimestre' ? `au ${bas}` : `en ${bas}`;
};
const DUREES: { key: Periode; label: string }[] = [
  { key: 'jour', label: 'Un jour' },
  { key: 'semaine', label: 'Une semaine' },
  { key: 'mois', label: 'Un mois' },
];

/** Remet un report annulé tel qu'il était, versement compris (à sa date d'origine). */
function remettre(g: Finances, r: Report, dateVersement: string) {
  if ((g.reports ?? []).some((x) => x.id === r.id)) return g;
  const vers: Arrivee = 'objectif' in r.vers ? { objectif: r.vers.objectif } : { case: r.vers };
  const h = reporter(g, r.de, r.montant, vers, r.id, dateVersement);
  return { ...h, reports: [r, ...(g.reports ?? [])] };
}

/**
 * Fenêtre « Reporter le reste » : le reste non dépensé d'un budget sur une période, à mettre sur le budget d'une autre
 * période (le jour, la semaine ou le mois suivant, ou une date choisie) ou à verser sur un objectif.
 */
export function ReporterReste({ f, periode, refDate, d, setF, onFermer }: { f: Finances; periode: Periode; refDate: string; d: string; setF: SetF; onFermer: () => void }) {
  const signaler = useSignalerSuppression();
  const restes = restesReportables(f, periode, refDate, d);
  const [budget, setBudget] = useState(restes[0]?.budget.id ?? '');
  const source = restes.find((x) => x.budget.id === budget) ?? restes[0];
  const [montant, setMontant] = useState(source ? enTexte(source.reste) : '');
  const [mode, setMode] = useState<'periode' | 'objectif'>('periode');
  // Le reste part de la période du budget (son mois pour un budget au mois), même vu depuis une autre période.
  const de = source?.case ?? caseDe('', periode, refDate);
  const proposees = arriveesProposees(de);
  const [arrivee, setArrivee] = useState<string>(proposees[0]?.cle ?? 'autre');
  const [duree, setDuree] = useState<Periode>('jour');
  const [date, setDate] = useState<string | undefined>(undefined);
  const [budgetArrivee, setBudgetArrivee] = useState<string | null>(null);
  const objectifs = objectifsActifs(f).filter((o) => !suiviObjectif(o, d).atteint);
  const [objectif, setObjectif] = useState<string | null>(objectifs[0]?.id ?? null);

  if (!source) {
    return (
      <Dialogue titre="Reporter le reste" onFermer={onFermer}>
        <T muted>Il ne reste rien à reporter {quand(periode, refDate)}.</T>
        <Btn kind="sec" label="Fermer" onPress={onFermer} />
      </Dialogue>
    );
  }

  const cible = budgetArrivee ?? source.budget.id;
  const choisie = proposees.find((x) => x.cle === arrivee);
  const caseArrivee = choisie ? { ...choisie.case, budget: cible } : date ? caseDe(cible, duree, date) : null;
  const vers: Arrivee | null = mode === 'objectif' ? (objectif ? { objectif } : null) : caseArrivee ? { case: caseArrivee } : null;
  const m = lireMontant(montant);
  const erreur = erreurReport(f, de, m, vers, d);
  const enCours = bornes(de.periode, de.debut).fin >= d;
  const budgetsArrivee = f.budgets.filter((b) => b.id === source.budget.id || etatBudget(b, caseArrivee?.debut ?? d) !== 'termine');

  const valider = () => {
    if (erreur || !m || !vers) return;
    const id = uid();
    setF((g) => reporter(g, de, m, vers, id, d));
    signaler({ texte: `${fmtMontant(m, f.devise)} ${'objectif' in vers ? 'versés sur l’objectif' : 'reportés'}.`, restaurer: (g) => annulerReport(g, id) });
    onFermer();
  };

  return (
    <Dialogue titre="Reporter le reste" onFermer={onFermer}>
      <View style={{ gap: 4, padding: 12, borderRadius: 14, backgroundColor: alpha(C.coach, 0.12) }}>
        <T small muted>
          Pas dépensé {quand(de.periode, de.debut)}
        </T>
        <Text style={{ color: C.coach, fontFamily: F.chiffre, fontSize: 26 }}>{fmtMontant(source.reste, f.devise)}</Text>
        <T small muted>
          {fmtMontant(source.depense, f.devise)} dépensés sur {fmtMontant(source.plafond, f.devise)} prévus.
        </T>
      </View>

      {restes.length > 1 ? (
        <View style={{ gap: 6 }}>
          <T small muted>
            Le reste de quel budget ?
          </T>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {restes.map((x) => (
              <Puce
                key={x.budget.id}
                label={`${x.budget.emoji} ${x.budget.nom} · ${fmtMontant(x.reste, f.devise)}`}
                on={x.budget.id === source.budget.id}
                onPress={() => {
                  setBudget(x.budget.id);
                  setMontant(enTexte(x.reste));
                  setBudgetArrivee(null);
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Input label={`Montant à reporter (${f.devise})`} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" aide={`Jusqu’à ${fmtMontant(source.reste, f.devise)}.`} returnKeyType="done" onSubmitEditing={valider} />

      <Seg
        label="Où le mettre"
        options={[
          { key: 'periode', label: 'Sur un autre budget' },
          { key: 'objectif', label: 'Sur un objectif' },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'periode' ? (
        <>
          <View accessibilityRole="radiogroup" accessibilityLabel="Période d’arrivée" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {proposees.map((x) => (
              <Puce key={x.cle} label={`${x.label} (${libelleMinuscule(x.case.periode, x.case.debut)})`} on={arrivee === x.cle} onPress={() => setArrivee(x.cle)} />
            ))}
            <Puce label="Choisir…" on={arrivee === 'autre'} onPress={() => setArrivee('autre')} />
          </View>
          {arrivee === 'autre' ? (
            <>
              <Seg label="Durée" options={DUREES} value={duree} onChange={setDuree} />
              <ChampDate label={duree === 'jour' ? 'Quel jour' : duree === 'semaine' ? 'Un jour de la semaine' : 'Un jour du mois'} value={date} onChange={setDate} />
            </>
          ) : null}
          {budgetsArrivee.length > 1 ? (
            <View style={{ gap: 6 }}>
              <T small muted>
                Dans quel budget
              </T>
              <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {budgetsArrivee.map((b) => (
                  <Puce key={b.id} label={`${b.emoji} ${b.nom}`} on={cible === b.id} onPress={() => setBudgetArrivee(b.id)} />
                ))}
              </View>
            </View>
          ) : null}
          {caseArrivee ? (
            <T small muted>
              {libelleCase(f, caseArrivee)} : {fmtMontant(m ?? 0, f.devise)} de plus à dépenser.
            </T>
          ) : null}
        </>
      ) : objectifs.length ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="Objectif" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {objectifs.map((o) => {
            const s = suiviObjectif(o, d);
            return <Puce key={o.id} label={`${o.emoji} ${o.nom} · ${Math.round(s.pct * 100)} %`} on={objectif === o.id} onPress={() => setObjectif(o.id)} />;
          })}
        </View>
      ) : (
        <T small muted>
          Tu n’as pas d’objectif en cours. Crée-en un dans l’onglet Objectifs pour y verser tes restes.
        </T>
      )}
      {mode === 'objectif' && objectif ? (
        <T small muted>
          Compté comme un versement : il fait avancer l’objectif et sort de tes budgets.
        </T>
      ) : null}

      {enCours ? (
        <T small style={{ color: C.hebdo }}>
          Cette période n’est pas finie : ce que tu reportes ne pourra plus y être dépensé.
        </T>
      ) : null}
      {erreur && m ? (
        <T small style={{ color: C.agressif }}>
          {erreur}
        </T>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={`${mode === 'objectif' ? 'Verser' : 'Reporter'}${m ? ` ${fmtMontant(m, f.devise)}` : ''}`} onPress={valider} disabled={!!erreur} />
        <Btn kind="sec" label="Annuler" onPress={onFermer} />
      </View>
    </Dialogue>
  );
}

/** Les restes partis de la période affichée ou arrivés dessus, chacun annulable. */
export function PanneauReports({ f, debut, fin, setF }: { f: Finances; debut: string; fin: string; setF: SetF }) {
  const signaler = useSignalerSuppression();
  const l = reportsDeLaPeriode(f, debut, fin);
  if (!l.length) return null;
  const annuler = (r: Report) => {
    const date = (f.objectifs ?? []).flatMap((o) => o.versements).find((v) => v.report === r.id)?.date ?? r.creeLe.slice(0, 10);
    setF((g) => annulerReport(g, r.id));
    signaler({ texte: `Report de ${fmtMontant(r.montant, f.devise)} annulé.`, restaurer: (g) => remettre(g, r, date) });
  };
  return (
    <Panel title="Restes reportés" count={l.length}>
      {l.map((x, n) => (
        <View key={`${x.report.id}-${x.sens}`}>
          {n ? <Sep /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <Text style={{ color: x.sens === 'recu' ? C.coach : C.accent, fontSize: 16 }}>{x.sens === 'recu' ? '↩' : '↪'}</Text>
            <View style={{ flex: 1, gap: 1 }}>
              <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>
                {x.titre}
              </Text>
              <T small muted>
                {x.detail}
              </T>
            </View>
            <IconBtn label="Annuler ce report" glyph="✕" onPress={() => annuler(x.report)} />
          </View>
        </View>
      ))}
    </Panel>
  );
}
