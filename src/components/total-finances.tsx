import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { Jauge } from '@/components/jauge';
import { Btn, Dialogue, IconBtn, Sep, T } from '@/components/ui';
import { SousOnglets } from '@/components/onglets';
import { type Bilan, decaler, ecartPeriodes, fmtMontant, libelle, PERIODES } from '@/lib/finances';
import { comparaison, rythme, type Rythme } from '@/lib/rythme-finances';
import { fmtCourt } from '@/lib/dates';
import { alpha, C, F, ombreAvant } from '@/lib/theme';
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
        style={({ pressed }) => ({ gap: 10, padding: 18, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, ...ombreAvant(), opacity: pressed ? 0.85 : 1 })}>
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
const JOURS_COURTS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
const COURTES: Record<Periode, string> = { jour: 'Jour', semaine: 'Semaine', mois: 'Mois', trimestre: 'Trim.', annee: 'Année' };

/** La période dite court, pour un téléphone : « Lun. 9 nov. », « Du 9 au 15 novembre », « Novembre 2026 », « 4e trim. 2026 ». */
function libelleCourt(vue: Periode, jourRef: string) {
  if (vue === 'jour') {
    const x = new Date(`${jourRef}T00:00:00`);
    return `${JOURS_COURTS[(x.getDay() + 6) % 7]} ${x.getDate()} ${MOIS_COURTS[x.getMonth()].toLowerCase()}`;
  }
  return libelle(vue, jourRef).replace('trimestre', 'trim.');
}

/**
 * Sur téléphone, sous les onglets : la durée en un geste (Jour, Semaine, Mois, Trim., Année), puis la période elle-même
 * avec ses flèches. Toucher la période ouvre le choix précis ; « Aujourd'hui » apparaît dès qu'on s'en éloigne.
 */
export function BarrePeriodeTel({ vue, jourRef, decal, onVue, onDecal, onOuvrir }: { vue: Periode; jourRef: string; decal: number; onVue: (v: Periode) => void; onDecal: (n: number) => void; onOuvrir: () => void }) {
  return (
    <View style={{ gap: 8 }}>
      <SousOnglets label="Durée" options={PERIODES.map((p) => ({ key: p.key, label: COURTES[p.key] }))} value={vue} onChange={onVue} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconBtn label="Période précédente" glyph="‹" onPress={() => onDecal(decal - 1)} />
        <Pressable accessibilityRole="button" accessibilityLabel={`${libelle(vue, jourRef)}. Choisir une autre période`} onPress={onOuvrir} style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, borderRadius: 12, opacity: pressed ? 0.7 : 1 })}>
          <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>
            {libelleCourt(vue, jourRef)}
          </Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>▾</Text>
        </Pressable>
        <IconBtn label="Période suivante" glyph="›" onPress={() => onDecal(decal + 1)} />
        {decal ? (
          <Pressable accessibilityRole="button" onPress={() => onDecal(0)} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: alpha(C.accent, 0.5), backgroundColor: alpha(C.accent, 0.12), opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 13 }}>Aujourd’hui</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Une case de la grille du choix précis : cochée, ou entourée si c'est la période d'aujourd'hui. */
function CasePeriode({ label, sous, on, actuelle, onPress, base = '30%' }: { label: string; sous?: string; on: boolean; actuelle: boolean; onPress: () => void; base?: `${number}%` }) {
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={on}
      accessibilityLabel={sous ? `${label} ${sous}` : label}
      onPress={onPress}
      style={({ pressed }) => ({ flexBasis: base, flexGrow: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 1, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: on ? C.accent : actuelle ? C.muted : C.line, backgroundColor: on ? alpha(C.accent, 0.16) : 'transparent', opacity: pressed ? 0.75 : 1 })}>
      {sous ? <Text style={{ color: on ? C.accent : C.muted, fontFamily: F.texteM, fontSize: 11.5 }}>{sous}</Text> : null}
      <Text style={{ color: on ? C.accent : C.ink, fontFamily: on ? F.texteF : F.texte, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Choisir la période affichée : sa durée, puis laquelle (les mois de l'année en grille), et le retour à aujourd'hui. */
export function FenetrePeriode({ vue, decal, d, onChoisir, onFermer }: { vue: Periode; decal: number; d: string; onChoisir: (vue: Periode, decal: number) => void; onFermer: () => void }) {
  const jourRef = decaler(vue, d, decal);
  const annee = Number(jourRef.slice(0, 4));
  const ref = (x: string) => ({ ref: x, ecart: ecartPeriodes(vue, d, x) });
  // Les périodes proposées d'un toucher : la semaine du jour, quelques semaines, les mois ou trimestres de l'année, des années.
  const choix: { ref: string; ecart: number; label: string; sous?: string; base?: `${number}%` }[] =
    vue === 'jour'
      ? Array.from({ length: 7 }, (_, i) => decaler('jour', decaler('semaine', jourRef, 0), i - ((new Date(`${jourRef}T00:00:00`).getDay() + 6) % 7))).map((x) => ({ ...ref(x), label: String(new Date(`${x}T00:00:00`).getDate()), sous: JOURS_COURTS[(new Date(`${x}T00:00:00`).getDay() + 6) % 7].replace('.', ''), base: '12%' }))
      : vue === 'semaine'
        ? Array.from({ length: 6 }, (_, i) => decaler('semaine', jourRef, i - 4)).map((x) => ({ ...ref(x), label: libelle('semaine', x), base: '100%' }))
        : vue === 'mois'
          ? Array.from({ length: 12 }, (_, i) => `${annee}-${String(i + 1).padStart(2, '0')}-01`).map((x, i) => ({ ...ref(x), label: MOIS_COURTS[i] }))
          : vue === 'trimestre'
            ? [0, 3, 6, 9].map((m, i) => `${annee}-${String(m + 1).padStart(2, '0')}-01`).map((x, i) => ({ ...ref(x), label: `T${i + 1}`, sous: `${MOIS_COURTS[i * 3]} – ${MOIS_COURTS[i * 3 + 2]}`, base: '45%' }))
            : Array.from({ length: 4 }, (_, i) => `${annee + i - 2}-01-01`).map((x) => ({ ...ref(x), label: x.slice(0, 4), base: '45%' }));
  const pas = vue === 'mois' || vue === 'trimestre' ? (vue === 'mois' ? 12 : 4) : vue === 'jour' ? 7 : vue === 'semaine' ? 6 : 4;
  return (
    <Dialogue titre="Période" onFermer={onFermer}>
      <SousOnglets label="Durée" options={PERIODES.map((x) => ({ key: x.key, label: COURTES[x.key] }))} value={vue} onChange={(v) => onChoisir(v, 0)} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn label="Plus tôt" glyph="‹" onPress={() => onChoisir(vue, decal - pas)} />
        <Text style={{ flex: 1, textAlign: 'center', color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>{vue === 'mois' || vue === 'trimestre' ? String(annee) : libelleCourt(vue, jourRef)}</Text>
        <IconBtn label="Plus tard" glyph="›" onPress={() => onChoisir(vue, decal + pas)} />
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {choix.map((c) => (
          <CasePeriode
            key={c.ref}
            label={c.label}
            sous={c.sous}
            base={c.base}
            on={c.ecart === decal}
            actuelle={c.ecart === 0}
            onPress={() => {
              onChoisir(vue, c.ecart);
              onFermer();
            }}
          />
        ))}
      </View>
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
