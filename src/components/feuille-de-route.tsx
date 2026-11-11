import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/texte';

import { Empty, Panel, T, tap } from '@/components/ui';
import { fmtCourt } from '@/lib/dates';
import { nomEtat } from '@/lib/etats-tache';
import { fmtSomme } from '@/lib/budget-projets';
import { feuilleDeRoute, tachesDe, type TacheRoute } from '@/lib/feuille-de-route';
import { type Plan } from '@/lib/planning';
import { alpha, C, F } from '@/lib/theme';
import type { Projet, Tache } from '@/lib/types';

const LARGEUR_NOM = 124;
const LARGEUR_COL_MIN = 88;
const MAX_LISTE = 40;

type Entree = { projet: Projet; plan: Plan; taches: Tache[] };
type Choix = { cle: string; projet: string | null };

/** Tous les projets sur une même page : une ligne par projet, une colonne par trimestre, la charge en barres. */
export function FeuilleDeRouteVue({ entrees, aujourdhui, ouvrir, devise = '$' }: { entrees: Entree[]; aujourdhui: string; ouvrir: (id: string) => void; devise?: string }) {
  const f = useMemo(() => feuilleDeRoute(entrees, aujourdhui), [entrees, aujourdhui]);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [zone, setZone] = useState(0);
  if (!f.colonnes.length) return <Empty icone="vide">Aucune tâche datée : importe un plan ou ajoute des tâches à tes projets.</Empty>;

  // Les colonnes se partagent la largeur quand elles tiennent, sinon la ligne défile.
  const LARGEUR_COL = Math.max(LARGEUR_COL_MIN, zone / f.colonnes.length);
  const avecBudget = f.colonnes.some((c) => c.prevu > 0);
  const noms = new Map(f.lignes.map((l) => [l.projet.id, l.projet]));
  const liste = choix ? tachesDe(f, choix.cle, choix.projet) : [];
  const colChoisie = choix ? f.colonnes.find((c) => c.cle === choix.cle) : undefined;
  const bascule = (c: Choix) => {
    tap();
    setChoix(choix && choix.cle === c.cle && choix.projet === c.projet ? null : c);
  };

  return (
    <View style={{ gap: 12 }}>
      <View onLayout={(e) => setZone(Math.floor(e.nativeEvent.layout.width) - LARGEUR_NOM - 2)} style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: C.surface, overflow: 'hidden' }}>
        <View style={{ width: LARGEUR_NOM, borderRightWidth: 1, borderRightColor: C.line }}>
          <View style={{ height: 56, borderBottomWidth: 1, borderBottomColor: C.line }} />
          {f.lignes.map((l) => (
            <Pressable key={l.projet.id} accessibilityRole="button" onPress={() => ouvrir(l.projet.id)} style={({ pressed }) => ({ height: 64, justifyContent: 'center', paddingHorizontal: 10, gap: 2, opacity: pressed ? 0.7 : 1, borderBottomWidth: 1, borderBottomColor: C.line })}>
              <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>{`${l.projet.emoji} ${l.projet.nom}`}</Text>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 11 }}>{`${l.faites}/${l.total} faites`}</Text>
            </Pressable>
          ))}
          {avecBudget ? (
            <View style={{ height: 40, justifyContent: 'center', paddingHorizontal: 10 }}>
              <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>Budget prévu</Text>
            </View>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View>
            <View style={{ flexDirection: 'row', height: 56, borderBottomWidth: 1, borderBottomColor: C.line }}>
              {f.colonnes.map((c) => {
                const on = choix?.cle === c.cle && choix.projet === null;
                return (
                  <Pressable key={c.cle} accessibilityRole="button" accessibilityLabel={`${c.nom} : ${c.restantes} à faire`} onPress={() => bascule({ cle: c.cle, projet: null })} style={{ width: LARGEUR_COL, paddingHorizontal: 8, justifyContent: 'center', gap: 1, backgroundColor: on ? alpha(C.accent, 0.12) : 'transparent', borderBottomWidth: 2, borderBottomColor: c.courant ? C.accent : 'transparent', marginBottom: -1 }}>
                    <Text style={{ color: c.passe ? C.muted : C.ink, fontFamily: F.texteF, fontSize: 13 }}>{c.nom}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <Text style={{ color: c.charge ? C.hebdo : C.ink, fontFamily: F.titre, fontSize: 16 }}>{c.restantes}</Text>
                      {c.enRetard ? <Text style={{ color: C.agressif, fontFamily: F.texteM, fontSize: 11 }}>{`${c.enRetard} retard`}</Text> : c.charge ? <Text style={{ color: C.hebdo, fontFamily: F.texteM, fontSize: 11 }}>chargé</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {f.lignes.map((l) => (
              <View key={l.projet.id} style={{ flexDirection: 'row', height: 64, borderBottomWidth: 1, borderBottomColor: C.line }}>
                {f.colonnes.map((c) => {
                  const k = l.cases[c.cle];
                  const reste = k ? k.total - k.faites : 0;
                  const on = choix?.cle === c.cle && choix.projet === l.projet.id;
                  const couleur = k?.enRetard ? C.agressif : c.charge ? C.hebdo : C.accent;
                  return (
                    <Pressable
                      key={c.cle}
                      disabled={!k}
                      accessibilityRole="button"
                      accessibilityLabel={k ? `${l.projet.nom}, ${c.nom} : ${reste} à faire` : undefined}
                      onPress={() => bascule({ cle: c.cle, projet: l.projet.id })}
                      style={{ width: LARGEUR_COL, paddingHorizontal: 8, justifyContent: 'center', gap: 6, backgroundColor: on ? alpha(C.accent, 0.12) : c.courant ? alpha(C.accent, 0.04) : 'transparent' }}>
                      {k ? (
                        <>
                          <Text style={{ color: reste ? C.ink : C.muted, fontFamily: F.chiffre, fontSize: 15 }}>{reste ? String(reste) : '✓'}</Text>
                          <View style={{ height: 6, borderRadius: 3, backgroundColor: alpha(C.muted, 0.18), overflow: 'hidden' }}>
                            {/* Plein : le travail confirmé ; pâle : ce qui est encore proposé, à valider ou en pipeline. */}
                            <View style={{ flexDirection: 'row' }}>
                              <View style={{ width: `${Math.round(((reste - k.incertaines) / Math.max(1, f.max)) * 100)}%`, minWidth: reste - k.incertaines > 0 ? 6 : 0, height: 6, backgroundColor: couleur, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, ...(k.incertaines ? {} : { borderTopRightRadius: 3, borderBottomRightRadius: 3 }) }} />
                              {k.incertaines ? <View style={{ width: `${Math.max(6, Math.round((k.incertaines / Math.max(1, f.max)) * 100))}%`, height: 6, backgroundColor: alpha(couleur, 0.35), borderTopRightRadius: 3, borderBottomRightRadius: 3 }} /> : null}
                            </View>
                          </View>
                        </>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {avecBudget ? (
              <View style={{ flexDirection: 'row', height: 40 }}>
                {f.colonnes.map((c) => (
                  <View key={c.cle} style={{ width: LARGEUR_COL, paddingHorizontal: 8, justifyContent: 'center' }}>
                    <Text style={{ color: c.prevu ? C.ink : C.muted, fontFamily: F.texteM, fontSize: 12 }}>{c.prevu ? fmtSomme(c.prevu, devise) : '—'}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>

      {choix && colChoisie ? (
        <Panel title={`${colChoisie.nom}${choix.projet ? ` · ${noms.get(choix.projet)?.nom ?? ''}` : ''}`} count={liste.length}>
          {liste.slice(0, MAX_LISTE).map((t) => (
            <LigneTache key={t.id} t={t} devise={devise} projet={choix.projet ? undefined : noms.get(t.projet)} />
          ))}
          {liste.length > MAX_LISTE ? <T small muted>{`+ ${liste.length - MAX_LISTE} autres`}</T> : null}
        </Panel>
      ) : (
        <T small muted>Touche un trimestre ou une case pour voir les tâches.</T>
      )}
    </View>
  );
}

function LigneTache({ t, projet, devise }: { t: TacheRoute; projet?: Projet; devise: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.fait ? C.coach : t.retard ? C.agressif : t.priorite === 'haute' ? C.hebdo : C.muted }} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ color: t.fait ? C.muted : C.ink, fontFamily: F.texte, fontSize: 14, textDecorationLine: t.fait ? 'line-through' : 'none' }}>{t.titre}</Text>
        {projet || t.responsable || t.etat ? <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 11 }}>{[projet ? `${projet.emoji} ${projet.nom}` : '', t.etat ? nomEtat(t.etat) : '', t.responsable].filter(Boolean).join(' · ')}</Text> : null}
      </View>
      <Text style={{ color: t.retard ? C.agressif : C.muted, fontFamily: F.texteM, fontSize: 12 }}>{t.budget ? `${fmtSomme(t.budget, devise)} · ` : ''}{fmtCourt(t.fin)}</Text>
    </View>
  );
}
