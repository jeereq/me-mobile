import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, View } from 'react-native';
import { Text } from '@/components/texte';

import { Empty, T } from '@/components/ui';
import { fmtCourt } from '@/lib/dates';
import { Puce } from '@/components/finances-plus';
import { frise, grouperBarres, tachesFrise, type ModeGroupe, type TacheFrise } from '@/lib/frise-projets';
import { piliersDe, piliersUtilises } from '@/lib/piliers';
import { useStore } from '@/lib/store';
import type { Plan } from '@/lib/planning';
import { alpha, C, F } from '@/lib/theme';
import type { Projet, Tache } from '@/lib/types';

const HAUTEUR_LIGNE = 62;
const HAUTEUR_AXE = 44;
const HAUTEUR_GROUPE = 30;
const HAUTEUR_TACHE = 30;

/** La colonne des noms : étroite sur téléphone pour laisser voir les barres, large sur grand écran pour ne pas couper les noms. */
const largeurDesNoms = (total: number) => (total < 460 ? 142 : total < 760 ? 180 : Math.min(260, Math.round(total * 0.22)));
/** Sur un écran étroit, un mois plus large qu'un ongle : la frise défile, mais les barres restent lisibles. */
const pxJourMin = (total: number) => (total < 760 ? 3 : 2.2);

type Entree = { projet: Projet; plan: Plan; taches: Tache[] };

/**
 * Les projets dans l'ordre où ils s'exécutent, sur une timeline : un projet par ligne, une barre du début à la fin de
 * son planning (la part faite est pleine), un repère « aujourd'hui ». Un toucher ouvre le projet ; la flèche à droite du nom déplie ses tâches, qu'un toucher ouvre à son tour.
 */
export function FriseProjets({ entrees, aujourdhui, ouvrir }: { entrees: Entree[]; aujourdhui: string; ouvrir: (id: string, tache?: string) => void }) {
  const { espace } = useStore();
  // Les projets dont les tâches sont dépliées sous leur ligne.
  const [deplies, setDeplies] = useState<Set<string>>(new Set());
  const basculer = (id: string) => setDeplies((d) => { const n = new Set(d); if (!n.delete(id)) n.add(id); return n; });
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState<ModeGroupe>('aucun');
  const largeurNom = largeurDesNoms(total);
  const zone = total ? Math.max(120, total - largeurNom - 2) : 0;
  const defile = useRef<ScrollViewInstance>(null);
  const f = frise(
    entrees.map((e) => {
      const feuilles = [...e.plan.lignes.values()].filter((l) => !l.resume);
      return { projet: e.projet, plan: e.plan, total: feuilles.length, faites: feuilles.filter((l) => l.fait).length, enRetard: feuilles.filter((l) => !l.fait && l.fin < aujourdhui).length };
    }),
    aujourdhui,
  );
  const avecPiliers = piliersUtilises(entrees).length > 0;
  const modeActif: ModeGroupe = mode === 'pilier' && !avecPiliers ? 'aucun' : mode;
  const taches = new Map(entrees.map((e) => [e.projet.id, e.taches]));
  const groupes = f ? grouperBarres(f.barres, modeActif, { piliers: piliersDe(espace), taches }) : [];
  const tachesDe = new Map(entrees.map((e) => [e.projet.id, f ? tachesFrise(e.taches, e.plan, f.debut, aujourdhui) : []]));
  const toutesDepliees = f ? f.barres.length > 0 && f.barres.every((b) => !(tachesDe.get(b.projet.id)?.length) || deplies.has(b.projet.id)) : false;
  // Le numéro reste celui de l'ordre d'exécution, quel que soit le regroupement.
  const rang = new Map((f?.barres ?? []).map((b, i) => [b.projet.id, i + 1]));
  const pxJour = f && zone ? Math.max(pxJourMin(total), zone / f.jours) : pxJourMin(total);

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: 'center', gap: 6 }}>
        <Text numberOfLines={1} style={{ flexShrink: 0, color: C.muted, fontFamily: F.texte, fontSize: 13 }}>Regrouper par</Text>
        <Puce label="Aucun" on={modeActif === 'aucun'} onPress={() => setMode('aucun')} />
        {avecPiliers ? <Puce label="Pilier" on={modeActif === 'pilier'} onPress={() => setMode('pilier')} /> : null}
        <Puce label="Trimestre" on={modeActif === 'trimestre'} onPress={() => setMode('trimestre')} />
        <Puce label="Mois" on={modeActif === 'mois'} onPress={() => setMode('mois')} />
        <Puce label={toutesDepliees ? 'Replier les tâches' : 'Voir les tâches'} on={toutesDepliees} onPress={() => setDeplies(toutesDepliees ? new Set() : new Set((f?.barres ?? []).filter((b) => tachesDe.get(b.projet.id)?.length).map((b) => b.projet.id)))} />
      </ScrollView>
      <View onLayout={(e) => setTotal(Math.floor(e.nativeEvent.layout.width))} style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: C.surface, overflow: 'hidden' }}>
        <View style={{ width: largeurNom, borderRightWidth: 1, borderRightColor: C.line }}>
          <View style={{ height: HAUTEUR_AXE, borderBottomWidth: 1, borderBottomColor: C.line, justifyContent: 'center', paddingHorizontal: 10 }}>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>Dans l'ordre d'exécution</Text>
          </View>
          {groupes.map((g) => (
            <View key={g.cle}>
              {modeActif !== 'aucun' ? (
                <View style={{ height: HAUTEUR_GROUPE, justifyContent: 'center', paddingHorizontal: 10, backgroundColor: alpha(C.accent, 0.1), borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 13 }}>{`${g.titre} · ${g.barres.length}`}</Text>
                </View>
              ) : null}
              {g.barres.map((b) => {
                const sous = tachesDe.get(b.projet.id) ?? [];
                const ouvert = deplies.has(b.projet.id);
                return (
                  <View key={b.projet.id}>
                    <View style={{ height: HAUTEUR_LIGNE, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line }}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`${rang.get(b.projet.id)}. ${b.projet.nom}, ${b.faites} sur ${b.total} faites, du ${fmtCourt(b.debut)} au ${fmtCourt(b.fin)}`} onPress={() => ouvrir(b.projet.id)} style={({ pressed }) => ({ flex: 1, minWidth: 0, height: HAUTEUR_LIGNE, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, paddingRight: sous.length ? 2 : 10, opacity: pressed ? 0.7 : 1 })}>
                        <Text style={{ width: 16, color: C.muted, fontFamily: F.chiffre, fontSize: 13 }}>{rang.get(b.projet.id)}</Text>
                        <View style={{ flex: 1, gap: 1 }}>
                          <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>{`${b.projet.emoji} ${b.projet.nom}`}</Text>
                          {/* L'état de la ligne, lisible même quand la barre est hors de l'écran. */}
                          <Text numberOfLines={1} style={{ color: b.enRetard ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 12 }}>{b.enRetard ? `${b.enRetard} en retard` : b.termine ? 'Terminé' : `${b.faites}/${b.total} faites`}</Text>
                        </View>
                      </Pressable>
                      {sous.length ? (
                        <Pressable accessibilityRole="button" aria-expanded={ouvert} accessibilityLabel={`${ouvert ? 'Replier' : 'Voir'} les ${sous.length} tâches de ${b.projet.nom}`} onPress={() => basculer(b.projet.id)} hitSlop={4} style={({ pressed }) => ({ width: 34, height: HAUTEUR_LIGNE, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
                          <Text style={{ color: ouvert ? C.accent : C.muted, fontSize: 13 }}>{ouvert ? '▾' : '▸'}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {ouvert ? sous.map((t) => (
                      <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Tâche ${t.titre}${t.fait ? ', faite' : t.enRetard ? ', en retard' : ''}, du ${fmtCourt(t.debut)} au ${fmtCourt(t.fin)}`} onPress={() => ouvrir(b.projet.id, t.id)} style={({ pressed }) => ({ height: HAUTEUR_TACHE, justifyContent: 'center', paddingLeft: 26 + Math.min(t.niveau, 3) * 8, paddingRight: 8, backgroundColor: alpha(C.ink, pressed ? 0.08 : 0.03), borderBottomWidth: 1, borderBottomColor: alpha(C.line, 0.6) })}>
                        <Text numberOfLines={1} style={{ color: t.fait ? C.muted : C.ink, fontFamily: F.texte, fontSize: 12, textDecorationLine: t.fait ? 'line-through' : 'none' }}>{t.titre}</Text>
                      </Pressable>
                    )) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <ScrollView ref={defile} horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={{ width: largeur }}>
            <View style={{ height: HAUTEUR_AXE, borderBottomWidth: 1, borderBottomColor: C.line }}>
              {f.mois.map((m, i) => (
                <View key={m.cle} style={{ position: 'absolute', left: m.decalage * pxJour, width: m.jours * pxJour, height: HAUTEUR_AXE, paddingHorizontal: 6, justifyContent: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: C.line }}>
                  <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 13 }}>{m.nom}</Text>
                  {m.nom === 'janv.' || i === 0 ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{m.annee}</Text> : null}
                </View>
              ))}
            </View>
            {groupes.map((g) => (
              <View key={g.cle}>
                {modeActif !== 'aucun' ? <View style={{ height: HAUTEUR_GROUPE, backgroundColor: alpha(C.accent, 0.1), borderBottomWidth: 1, borderBottomColor: C.line }} /> : null}
                {g.barres.map((b) => {
                  const couleur = b.termine ? C.coach : b.enRetard ? C.agressif : (b.projet.couleur ?? C.accent);
                  const largeurBarre = Math.max(8, b.duree * pxJour);
                  const sous = deplies.has(b.projet.id) ? tachesDe.get(b.projet.id) ?? [] : [];
                  return (
                    <View key={b.projet.id}>
                      <View style={{ height: HAUTEUR_LIGNE, borderBottomWidth: 1, borderBottomColor: C.line, justifyContent: 'center' }}>
                        {f.mois.map((m, i) => (i ? <View key={m.cle} style={{ position: 'absolute', left: m.decalage * pxJour, top: 0, bottom: 0, width: 1, backgroundColor: alpha(C.line, 0.5) }} /> : null))}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${b.projet.nom} : ${b.avancement} % fait, du ${fmtCourt(b.debut)} au ${fmtCourt(b.fin)}`}
                          onPress={() => ouvrir(b.projet.id)}
                          style={{ position: 'absolute', top: 10, left: b.decalage * pxJour, width: largeurBarre, height: 24, borderRadius: 8, backgroundColor: alpha(couleur, 0.22), borderWidth: 1, borderColor: alpha(couleur, 0.6), overflow: 'hidden', justifyContent: 'center' }}>
                          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${b.avancement}%`, backgroundColor: alpha(couleur, 0.55) }} />
                        </Pressable>
                        <Text numberOfLines={1} style={{ position: 'absolute', left: b.decalage * pxJour + 2, top: 38, color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{`${fmtCourt(b.debut)} → ${fmtCourt(b.fin)}`}</Text>
                      </View>
                      {sous.map((t) => <BarreTache key={t.id} t={t} pxJour={pxJour} couleur={b.projet.couleur ?? C.accent} mois={f.mois} onPress={() => ouvrir(b.projet.id, t.id)} />)}
                    </View>
                  );
                })}
              </View>
            ))}
            {f.aujourdhui !== null ? (
              <View pointerEvents="none" style={{ position: 'absolute', left: f.aujourdhui * pxJour, top: 0, bottom: 0, width: 2, backgroundColor: C.accent }}>
                {/* Ce que dit le trait bleu, une fois pour toutes. */}
                <View style={{ position: 'absolute', top: 2, left: 3, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, backgroundColor: C.accent }}>
                  <Text style={{ color: C.accentInk, fontFamily: F.texteF, fontSize: 12 }}>Auj.</Text>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
      {f.sansDates.length ? <T small muted>{`Sans dates, donc absents de la timeline : ${f.sansDates.map((p) => `${p.emoji} ${p.nom}`).join(', ')}.`}</T> : null}
      <T small muted>{`La barre va du début à la fin du planning ; la partie pleine est la part faite. En rouge : des tâches en retard.${largeur > zone ? ' Fais glisser la frise pour voir la suite.' : ''}`}</T>
    </View>
  );
}

/** Une tâche sur l'axe : une fine barre (un losange pour un jalon), verte si faite, rouge si en retard. */
function BarreTache({ t, pxJour, couleur, mois, onPress }: { t: TacheFrise; pxJour: number; couleur: string; mois: { cle: string; decalage: number }[]; onPress: () => void }) {
  const c = t.fait ? C.coach : t.enRetard ? C.agressif : couleur;
  const largeur = Math.max(8, t.duree * pxJour);
  return (
    <View style={{ height: HAUTEUR_TACHE, borderBottomWidth: 1, borderBottomColor: alpha(C.line, 0.6), backgroundColor: alpha(C.ink, 0.03), justifyContent: 'center' }}>
      {mois.map((m, i) => (i ? <View key={m.cle} style={{ position: 'absolute', left: m.decalage * pxJour, top: 0, bottom: 0, width: 1, backgroundColor: alpha(C.line, 0.4) }} /> : null))}
      <Pressable accessibilityRole="button" accessibilityLabel={`Tâche ${t.titre}, du ${fmtCourt(t.debut)} au ${fmtCourt(t.fin)}`} onPress={onPress} hitSlop={6} style={t.jalon ? { position: 'absolute', left: t.decalage * pxJour - 6, top: 9, width: 12, height: 12, backgroundColor: c, transform: [{ rotate: '45deg' }] } : { position: 'absolute', left: t.decalage * pxJour, top: 9, width: largeur, height: 12, borderRadius: 5, backgroundColor: t.fait ? alpha(c, 0.7) : alpha(c, 0.3), borderWidth: 1, borderColor: alpha(c, 0.7) }} />
    </View>
  );
}
