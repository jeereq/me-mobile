import { type Href, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Barres, Part, Tuile } from '@/components/graphiques';
import { BarreObjectif, couleurEtat } from '@/components/objectifs';
import { Btn, Empty, Panel, Sep, T } from '@/components/ui';
import type { Conseil } from '@/lib/conseils';
import { fmtCourt } from '@/lib/dates';
import type { Niveau } from '@/lib/etat-des-lieux';
import { financesDe, fmtMontant } from '@/lib/finances';
import { ETATS_OBJECTIF, objectifsActifs, resumeObjectifs, suiviObjectif } from '@/lib/objectifs';
import { budgetParMois, budgetsDuMois, moisTenus, verseParMois } from '@/lib/stats-budget';
import { alpha, C, F } from '@/lib/theme';
import type { Espace } from '@/lib/types';

const couleurNiveau = (n: Niveau) => (n === 'alerte' ? C.agressif : n === 'conseil' ? C.hebdo : n === 'bien' ? C.coach : C.accent);

/** Les conseils pour tenir le budget et atteindre les objectifs, le plus urgent d'abord ; chacun mène à l'écran où agir. */
export function PanneauConseils({ titre, conseils, vide }: { titre: string; conseils: Conseil[]; vide: string }) {
  return (
    <Panel title={titre} count={conseils.length || undefined}>
      {conseils.length ? (
        conseils.map((c, i) => (
          <View key={c.id} style={{ gap: 8 }}>
            {i ? <Sep /> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 4, borderRadius: 2, backgroundColor: couleurNiveau(c.niveau) }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>{c.titre}</Text>
                <T small muted>
                  {c.texte}
                </T>
                <View style={{ alignSelf: 'flex-start', marginTop: 2 }}>
                  <Btn small kind="sec" label={c.action} onPress={() => router.push(c.href as Href)} />
                </View>
              </View>
            </View>
          </View>
        ))
      ) : (
        <Empty>{vide}</Empty>
      )}
    </Panel>
  );
}

/** Le budget total mois après mois (rouge quand il a été dépassé), puis chaque budget du mois en cours. */
export function PanneauBudget({ espace, d }: { espace: Espace; d: string }) {
  const f = financesDe(espace);
  const mois = budgetParMois(espace, d, 6);
  const { tenus, sur } = moisTenus(mois);
  const lignes = budgetsDuMois(espace, d);
  return (
    <>
      <Panel title="Respect du budget">
        {sur ? (
          <>
            <Barres
              hauteur={120}
              points={mois.map((m) => ({
                cle: m.cle,
                axe: m.axe,
                v: m.depense,
                plafond: m.fixe ? m.plafond : undefined,
                detail: m.fixe ? `${m.mois} : ${fmtMontant(m.depense, f.devise)} sur ${fmtMontant(m.plafond, f.devise)} (${Math.round(m.ratio * 100)} %)` : `${m.mois} : ${fmtMontant(m.depense, f.devise)}, pas de budget fixé`,
              }))}
            />
            <T small muted>
              Budget tenu {tenus} mois sur {sur}. Une barre rouge est un mois où il a été dépassé.
            </T>
          </>
        ) : (
          <Empty>Fixe un budget total ou des budgets par catégorie dans Finances : tu verras ici mois après mois si tu les tiens.</Empty>
        )}
      </Panel>
      {lignes.length ? (
        <Panel title="Budgets ce mois-ci">
          {lignes.map((l, i) => (
            <View key={l.id} style={{ gap: 6 }}>
              {i ? <Sep /> : null}
              <Part libelle={`${l.emoji} ${l.nom}`} valeur={`${fmtMontant(l.depense, f.devise)} / ${fmtMontant(l.plafond, f.devise)}`} ratio={l.ratio} />
              <Text style={{ color: l.reste < 0 ? C.agressif : l.ratio >= 0.8 ? C.hebdo : C.muted, fontFamily: F.texte, fontSize: 12 }}>{l.reste < 0 ? `Dépassé de ${fmtMontant(-l.reste, f.devise)}` : `Reste ${fmtMontant(l.reste, f.devise)} · ${Math.round(l.ratio * 100)} % utilisé`}</Text>
            </View>
          ))}
        </Panel>
      ) : null}
    </>
  );
}

/** Où en sont les objectifs : le total, chacun avec son état, et ce qui a été versé mois après mois. */
export function PanneauObjectifsStats({ espace, d }: { espace: Espace; d: string }) {
  const f = financesDe(espace);
  const r = resumeObjectifs(f, d);
  const l = objectifsActifs(f);
  const verse = verseParMois(espace, d, 6);
  if (!l.length)
    return (
      <Panel title="Objectifs">
        <Empty>Aucun objectif. Fixe une somme et une date dans Finances › Objectifs : tu suivras ici ta progression.</Empty>
        <Btn small kind="sec" label="Créer un objectif" onPress={() => router.push('/finances?onglet=objectifs' as Href)} />
      </Panel>
    );
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Tuile emoji="🎯" titre="réuni sur le total visé" valeur={`${Math.round(r.pct * 100)} %`} evolution={`${fmtMontant(r.acquis, f.devise)} sur ${fmtMontant(r.cible, f.devise)}`} />
        <Tuile emoji="✅" titre="objectifs atteints" valeur={`${r.atteints} / ${r.nb}`} evolution={r.enRetard ? `${r.enRetard} en retard` : undefined} />
        <Tuile emoji="🗓️" titre="demandé par mois" valeur={fmtMontant(r.parMois, f.devise)} />
      </View>
      <Panel title="Mes objectifs" count={l.length}>
        {l.map((o, i) => {
          const s = suiviObjectif(o, d);
          const c = couleurEtat(s.etat);
          return (
            <View key={o.id} style={{ gap: 6 }}>
              {i ? <Sep /> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`${o.nom}, ${Math.round(s.pct * 100)} %`} onPress={() => router.push('/finances?onglet=objectifs' as Href)} style={({ pressed }) => ({ gap: 6, opacity: pressed ? 0.75 : 1 })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>
                    {o.emoji} {o.nom}
                  </Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: alpha(c, 0.16) }}>
                    <Text style={{ color: c, fontFamily: F.texteF, fontSize: 11 }}>{ETATS_OBJECTIF[s.etat]}</Text>
                  </View>
                </View>
                <BarreObjectif pct={s.pct} couleur={c} hauteur={8} />
                <T small muted>
                  {fmtMontant(Math.min(s.acquis, o.cible), f.devise)} sur {fmtMontant(o.cible, f.devise)} · {Math.round(s.pct * 100)} %{s.atteint ? '' : s.prochain ? ` · prochain versement le ${fmtCourt(s.prochain)}` : ''}
                </T>
              </Pressable>
            </View>
          );
        })}
      </Panel>
      <Panel title="Versé par mois">
        <Barres points={verse.map((m) => ({ cle: m.cle, axe: m.axe, v: m.v, detail: `${m.mois} : ${fmtMontant(m.v, f.devise)}` }))} />
        <T small muted>
          Ce que tu as versé sur tes objectifs en cours, sans ce qui était déjà de côté au départ.
        </T>
      </Panel>
    </>
  );
}
