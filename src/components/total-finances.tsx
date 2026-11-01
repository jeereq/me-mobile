import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Jauge } from '@/components/jauge';
import { Btn, Dialogue, IconBtn, Sep, Seg, T } from '@/components/ui';
import { type Bilan, decaler, ecartPeriodes, fmtMontant, libelle, PERIODES } from '@/lib/finances';
import { comparaison, rythme, type Rythme } from '@/lib/rythme-finances';
import { fmtCourt } from '@/lib/dates';
import { alpha, C, F } from '@/lib/theme';
import type { Finances, Periode } from '@/lib/types';

/** La couleur qui dit où l'on en est : vert dans le rythme, ambre en avance, rouge une fois dépassé. */
const couleurEtat = (r: Rythme) => (r.etat === 'depasse' ? C.agressif : r.etat === 'avance' ? C.hebdo : C.coach);

/** Une petite étiquette de couleur : l'état du total, d'un objectif. */
export function Pastille({ label, couleur }: { label: string; couleur: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: alpha(couleur, 0.14) }}>
      <Text style={{ color: couleur, fontFamily: F.texteM, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function libelleEtat(r: Rythme, depasses: number) {
  if (r.etat === 'depasse') return depasses > 1 ? `${depasses} budgets dépassés` : 'Budget dépassé';
  if (r.etat === 'avance') return `En avance d’environ ${r.avance} jour${r.avance > 1 ? 's' : ''}`;
  if (r.etat === 'termine') return 'Terminé';
  if (r.etat === 'avenir') return 'Pas encore commencé';
  return 'Dans le rythme';
}

/** « ↓ 6 % vs septembre », « ↑ 12 % vs la semaine d'avant à la même date ». */
function texteComparaison(c: ReturnType<typeof comparaison>) {
  if (c.ecart === null) return '';
  const fleche = c.ecart > 0 ? '↑' : c.ecart < 0 ? '↓' : '=';
  return `${fleche} ${Math.abs(c.ecart)} % vs ${c.nom}`;
}

type Props = {
  f: Finances;
  b: Bilan;
  d: string;
  vue: Periode;
  jourRef: string;
  /** Pas de budget « toutes les dépenses » : le hors budget se compte à part. */
  sansGlobal: boolean;
  revenus: number;
  /** Revenus moins dépenses de la période. */
  solde: number;
  /** Versé à des objectifs sur la période. */
  epargne: number;
  /** Ce qu'il faut savoir de plus sur le calcul (budgets d'une autre durée, reports). */
  note?: string;
  onVoirDepenses: () => void;
  onBudgets: () => void;
};

/**
 * Le total de la période, en une carte : ce qu'on peut encore dépenser (en grand), par jour jusqu'à la fin, la jauge avec
 * le trait « aujourd'hui », l'état (dans le rythme, en avance, dépassé) et l'écart avec la période d'avant à la même
 * date. Un appui ouvre le détail du calcul.
 */
export function TotalFinances(p: Props) {
  const { f, b, d } = p;
  const [detail, setDetail] = useState(false);
  const r = rythme(b, d);
  const cmp = comparaison(f, p.vue, p.jourRef, d, b);
  const depasses = b.lignes.filter((l) => l.reste < 0 && !l.budget.global).length;
  const couleur = couleurEtat(r);
  const m = (x: number) => fmtMontant(x, f.devise);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Ouvre le détail du total"
        onPress={() => setDetail(true)}
        style={({ pressed }) => ({ gap: 10, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, opacity: pressed ? 0.85 : 1 })}>
        {r.etat === 'sans' ? (
          <>
            <T muted>Dépensé {b.enCours ? 'jusqu’ici' : 'sur la période'}</T>
            <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 44, lineHeight: 50 }}>{m(b.total)}</Text>
            {cmp.ecart !== null ? <T small muted>{texteComparaison(cmp)}{cmp.memeDate ? ' à la même date' : ''}</T> : null}
            <Pressable accessibilityRole="button" onPress={p.onBudgets} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
              <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Crée un budget pour voir ce qu’il te reste ›</Text>
            </Pressable>
          </>
        ) : (
          <>
            <T muted>{r.etat === 'depasse' ? 'Tu as dépassé de' : r.etat === 'termine' ? 'Pas dépensé' : 'Tu peux encore dépenser'}</T>
            <Text style={{ color: couleur, fontFamily: F.chiffre, fontSize: 48, lineHeight: 54 }}>{m(Math.abs(r.reste))}</Text>
            {r.parJour !== null ? (
              <T small muted>
                soit <Text style={{ color: C.ink, fontFamily: F.texteF }}>{m(r.parJour)} par jour</Text> jusqu’au {fmtCourt(b.fin)}
              </T>
            ) : null}
            <View style={{ gap: 6, marginTop: 4 }}>
              <Jauge ratio={r.ratio} hauteur={12} repere={r.repere} couleur={couleur} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <T small muted>
                  <Text style={{ color: C.ink, fontFamily: F.texteF }}>{m(b.compte)}</Text> dépensés
                </T>
                <T small muted>sur {m(b.plafondTotal)}</T>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Pastille label={libelleEtat(r, depasses)} couleur={r.etat === 'termine' || r.etat === 'avenir' ? C.muted : couleur} />
              {cmp.ecart !== null ? <T small muted>{texteComparaison(cmp)}</T> : null}
            </View>
          </>
        )}
      </Pressable>
      {detail ? <DetailTotal {...p} r={r} cmp={cmp} onFermer={() => setDetail(false)} /> : null}
    </>
  );
}

function LigneMontant({ label, aide, valeur, fort, couleur }: { label: string; aide?: string; valeur: string; fort?: boolean; couleur?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }}>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ color: C.ink, fontFamily: fort ? F.texteF : F.texte, fontSize: 15 }}>{label}</Text>
        {aide ? <T small muted>{aide}</T> : null}
      </View>
      <Text style={{ color: couleur ?? C.ink, fontFamily: F.chiffre, fontSize: fort ? 18 : 16 }}>{valeur}</Text>
    </View>
  );
}

const Titre = ({ children }: { children: string }) => <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 }}>{children}</Text>;

/** Le détail du total : d'où vient chaque chiffre, ce qui est entré et mis de côté, et la comparaison. */
function DetailTotal({ f, b, vue, jourRef, sansGlobal, revenus, solde, epargne, note, onVoirDepenses, r, cmp, onFermer }: Props & { r: Rythme; cmp: ReturnType<typeof comparaison>; onFermer: () => void }) {
  const m = (x: number) => fmtMontant(x, f.devise);
  const horsAPart = sansGlobal && b.horsBudget > 0 && b.plafondTotal > 0;
  return (
    <Dialogue titre={libelle(vue, jourRef)} onFermer={onFermer}>
      <View style={{ gap: 2 }}>
        <Titre>Dépensé</Titre>
        {b.plafondTotal ? <LigneMontant label="Dans tes budgets" aide={`sur ${m(b.plafondTotal)} prévus`} valeur={m(b.compte)} /> : null}
        {horsAPart ? <LigneMontant label="Hors budget" aide="ne touche pas à ton reste" valeur={m(b.horsBudget)} /> : null}
        {b.plafondTotal ? <Sep /> : null}
        <LigneMontant label="Total" valeur={m(b.total)} fort />
        {b.plafondTotal ? <LigneMontant label={r.reste < 0 ? 'Dépassé de' : 'Reste à dépenser'} valeur={m(Math.abs(r.reste))} couleur={r.reste < 0 ? C.agressif : C.coach} /> : null}
      </View>

      <View style={{ gap: 2 }}>
        <Titre>Entré et mis de côté</Titre>
        <LigneMontant label="Revenus" valeur={m(revenus)} couleur={C.coach} />
        <LigneMontant label={solde < 0 ? 'Dépensé de plus que gagné' : 'Mis de côté'} aide={epargne ? `dont ${m(epargne)} versés à tes objectifs` : 'revenus moins dépenses'} valeur={m(Math.abs(solde))} couleur={solde < 0 ? C.agressif : undefined} />
      </View>

      {cmp.avant || cmp.ecart !== null ? (
        <View style={{ gap: 2 }}>
          <Titre>Comparé</Titre>
          <LigneMontant label={`${cmp.nom[0].toUpperCase()}${cmp.nom.slice(1)}${cmp.memeDate ? ', à la même date' : ''}`} aide={cmp.ecart === null ? undefined : cmp.ecart === 0 ? 'autant que maintenant' : `tu dépenses ${Math.abs(cmp.ecart)} % ${cmp.ecart > 0 ? 'de plus' : 'de moins'}`} valeur={m(cmp.avant)} />
        </View>
      ) : null}

      <View style={{ padding: 12, borderRadius: 14, backgroundColor: C.sunk }}>
        <T small muted>
          {b.plafondTotal
            ? sansGlobal
              ? `Le reste, c’est la somme de tes budgets moins ce que tu y as dépensé.${horsAPart ? ' Le hors budget est compté à part.' : ''}`
              : 'Le reste, c’est ton budget total moins tout ce que tu as dépensé.'
            : 'Tout ce que tu as noté sur la période.'}
          {r.parJour !== null ? ` Par jour : le reste divisé par les ${r.joursRestants} jours qui restent, aujourd’hui compris.` : ''}
          {note ? ` ${note}` : ''}
        </T>
      </View>

      {b.depenses.length ? (
        <Btn
          kind="sec"
          label={b.depenses.length > 1 ? `Voir les ${b.depenses.length} dépenses` : 'Voir la dépense'}
          onPress={() => {
            onFermer();
            onVoirDepenses();
          }}
        />
      ) : null}
    </Dialogue>
  );
}

/** Le bouton de la période, dans le titre sur téléphone : « Octobre ▾ ». */
export function BoutonPeriode({ vue, jourRef, onPress }: { vue: Periode; jourRef: string; onPress: () => void }) {
  const l = libelle(vue, jourRef);
  const court = vue === 'mois' ? l.split(' ')[0] : vue === 'jour' ? l.replace(/ \d{4}$/, '') : l;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Changer de période, ${l}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, opacity: pressed ? 0.75 : 1 })}>
      <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14, maxWidth: 150 }}>
        {court}
      </Text>
      <Text style={{ color: C.muted, fontSize: 12 }}>▾</Text>
    </Pressable>
  );
}

const MOIS_COURTS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

/** Choisir la période affichée : sa durée, puis laquelle (les mois de l'année en grille), et le retour à aujourd'hui. */
export function FenetrePeriode({ vue, decal, d, onChoisir, onFermer }: { vue: Periode; decal: number; d: string; onChoisir: (vue: Periode, decal: number) => void; onFermer: () => void }) {
  const jourRef = decaler(vue, d, decal);
  const annee = Number(jourRef.slice(0, 4));
  const mois = Array.from({ length: 12 }, (_, i) => `${annee}-${String(i + 1).padStart(2, '0')}-01`);
  return (
    <Dialogue titre="Période" onFermer={onFermer}>
      <Seg label="Durée" options={PERIODES.map((x) => ({ key: x.key, label: x.key === 'trimestre' ? 'Trim.' : x.label }))} value={vue} onChange={(v) => onChoisir(v, 0)} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn label={vue === 'mois' ? 'Année précédente' : 'Période précédente'} glyph="‹" onPress={() => onChoisir(vue, decal - (vue === 'mois' ? 12 : 1))} />
        <Text style={{ flex: 1, textAlign: 'center', color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>{vue === 'mois' ? String(annee) : libelle(vue, jourRef)}</Text>
        <IconBtn label={vue === 'mois' ? 'Année suivante' : 'Période suivante'} glyph="›" onPress={() => onChoisir(vue, decal + (vue === 'mois' ? 12 : 1))} />
      </View>
      {vue === 'mois' ? (
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {mois.map((x, i) => {
            const ecart = ecartPeriodes('mois', d, x);
            const on = ecart === decal;
            return (
              <Pressable
                key={x}
                accessibilityRole="radio"
                aria-checked={on}
                accessibilityLabel={libelle('mois', x)}
                onPress={() => {
                  onChoisir('mois', ecart);
                  onFermer();
                }}
                style={({ pressed }) => ({ flexBasis: '30%', flexGrow: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: on ? C.accent : ecart === 0 ? C.muted : C.line, backgroundColor: on ? alpha(C.accent, 0.16) : 'transparent', opacity: pressed ? 0.75 : 1 })}>
                <Text style={{ color: on ? C.accent : C.ink, fontFamily: on ? F.texteF : F.texte, fontSize: 14 }}>{MOIS_COURTS[i]}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {decal ? (
        <Btn
          kind="sec"
          label="Revenir à aujourd’hui"
          onPress={() => {
            onChoisir(vue, 0);
            onFermer();
          }}
        />
      ) : (
        <Btn kind="sec" label="Fermer" onPress={onFermer} />
      )}
    </Dialogue>
  );
}
