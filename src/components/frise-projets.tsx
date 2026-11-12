import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, View } from 'react-native';
import { Text } from '@/components/texte';

import { Empty, T } from '@/components/ui';
import { fmtCourt } from '@/lib/dates';
import { frise } from '@/lib/frise-projets';
import type { Plan } from '@/lib/planning';
import { alpha, C, F } from '@/lib/theme';
import type { Projet, Tache } from '@/lib/types';

const LARGEUR_NOM = 168;
const HAUTEUR_LIGNE = 56;
const HAUTEUR_AXE = 44;
const PX_JOUR_MIN = 2.2;

type Entree = { projet: Projet; plan: Plan; taches: Tache[] };

/**
 * Les projets dans l'ordre où ils s'exécutent, sur une timeline : un projet par ligne, une barre du début à la fin de
 * son planning (la part faite est pleine), un repère « aujourd'hui ». Un toucher ouvre le projet.
 */
export function FriseProjets({ entrees, aujourdhui, ouvrir }: { entrees: Entree[]; aujourdhui: string; ouvrir: (id: string) => void }) {
  const [zone, setZone] = useState(0);
  const defile = useRef<ScrollViewInstance>(null);
  const f = frise(
    entrees.map((e) => {
      const feuilles = [...e.plan.lignes.values()].filter((l) => !l.resume);
      return { projet: e.projet, plan: e.plan, total: feuilles.length, faites: feuilles.filter((l) => l.fait).length, enRetard: feuilles.filter((l) => !l.fait && l.fin < aujourdhui).length };
    }),
    aujourdhui,
  );
  const pxJour = f && zone ? Math.max(PX_JOUR_MIN, zone / f.jours) : PX_JOUR_MIN;

  // À l'ouverture, la timeline se cale un peu avant aujourd'hui.
  useEffect(() => {
    if (!f || f.aujourdhui === null || !zone) return;
    const x = Math.max(0, f.aujourdhui * pxJour - zone / 4);
    const t = setTimeout(() => defile.current?.scrollTo({ x, animated: false }), 0);
    return () => clearTimeout(t);
    // Une seule fois par largeur connue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone, !!f]);

  if (!f) return <Empty icone="vide">Aucun projet n'a de dates : ajoute des tâches datées ou importe un plan.</Empty>;
  const largeur = Math.ceil(f.jours * pxJour);

  return (
    <View style={{ gap: 12 }}>
      <View onLayout={(e) => setZone(Math.floor(e.nativeEvent.layout.width) - LARGEUR_NOM - 2)} style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: C.surface, overflow: 'hidden' }}>
        <View style={{ width: LARGEUR_NOM, borderRightWidth: 1, borderRightColor: C.line }}>
          <View style={{ height: HAUTEUR_AXE, borderBottomWidth: 1, borderBottomColor: C.line, justifyContent: 'center', paddingHorizontal: 10 }}>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>Dans l'ordre d'exécution</Text>
          </View>
          {f.barres.map((b, i) => (
            <Pressable key={b.projet.id} accessibilityRole="button" accessibilityLabel={`${i + 1}. ${b.projet.nom}, du ${fmtCourt(b.debut)} au ${fmtCourt(b.fin)}`} onPress={() => ouvrir(b.projet.id)} style={({ pressed }) => ({ height: HAUTEUR_LIGNE, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, opacity: pressed ? 0.7 : 1, borderBottomWidth: 1, borderBottomColor: C.line })}>
              <Text style={{ width: 18, color: C.muted, fontFamily: F.chiffre, fontSize: 13 }}>{i + 1}</Text>
              <Text numberOfLines={2} style={{ flex: 1, color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>{`${b.projet.emoji} ${b.projet.nom}`}</Text>
            </Pressable>
          ))}
        </View>
        <ScrollView ref={defile} horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ width: largeur }}>
            <View style={{ height: HAUTEUR_AXE, borderBottomWidth: 1, borderBottomColor: C.line }}>
              {f.mois.map((m, i) => (
                <View key={m.cle} style={{ position: 'absolute', left: m.decalage * pxJour, width: m.jours * pxJour, height: HAUTEUR_AXE, paddingHorizontal: 6, justifyContent: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: C.line }}>
                  <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 12.5 }}>{m.nom}</Text>
                  {m.nom === 'janv.' || i === 0 ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 11 }}>{m.annee}</Text> : null}
                </View>
              ))}
            </View>
            {f.barres.map((b) => {
              const couleur = b.termine ? C.coach : b.enRetard ? C.agressif : (b.projet.couleur ?? C.accent);
              const largeurBarre = Math.max(8, b.duree * pxJour);
              return (
                <View key={b.projet.id} style={{ height: HAUTEUR_LIGNE, borderBottomWidth: 1, borderBottomColor: C.line, justifyContent: 'center' }}>
                  {f.mois.map((m, i) => (i ? <View key={m.cle} style={{ position: 'absolute', left: m.decalage * pxJour, top: 0, bottom: 0, width: 1, backgroundColor: alpha(C.line, 0.5) }} /> : null))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${b.projet.nom} : ${b.avancement} % fait, du ${fmtCourt(b.debut)} au ${fmtCourt(b.fin)}`}
                    onPress={() => ouvrir(b.projet.id)}
                    style={{ position: 'absolute', top: 10, left: b.decalage * pxJour, width: largeurBarre, height: 24, borderRadius: 8, backgroundColor: alpha(couleur, 0.22), borderWidth: 1, borderColor: alpha(couleur, 0.6), overflow: 'hidden', justifyContent: 'center' }}>
                    <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${b.avancement}%`, backgroundColor: alpha(couleur, 0.55) }} />
                  </Pressable>
                  <Text numberOfLines={1} style={{ position: 'absolute', left: b.decalage * pxJour + 2, top: 38, color: C.muted, fontFamily: F.texte, fontSize: 11 }}>{`${fmtCourt(b.debut)} → ${fmtCourt(b.fin)}`}</Text>
                </View>
              );
            })}
            {f.aujourdhui !== null ? <View pointerEvents="none" style={{ position: 'absolute', left: f.aujourdhui * pxJour, top: 0, bottom: 0, width: 2, backgroundColor: C.accent }} /> : null}
          </View>
        </ScrollView>
      </View>
      {f.sansDates.length ? <T small muted>{`Sans dates, donc absents de la timeline : ${f.sansDates.map((p) => `${p.emoji} ${p.nom}`).join(', ')}.`}</T> : null}
      <T small muted>La barre va du début à la fin du planning ; la partie pleine est la part faite. En rouge : des tâches en retard.</T>
    </View>
  );
}
