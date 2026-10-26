import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, Linking, Pressable, Text, View } from 'react-native';

import { AjoutRapide } from '@/components/ajout-rapide';
import { Icone } from '@/components/icones';
import { PremiersPas } from '@/components/premiers-pas';
import { EtatDesLieux, ResumeFinances } from '@/components/tableau-de-bord';
import { Btn, Colonnes, Header, Input, Panel, Screen, T, Tag, couleur } from '@/components/ui';
import { useActions } from '@/lib/actions';
import { briefing, demanderIA, iaDisponible, parler, resumeDonnees, taire } from '@/lib/assistant';
import { SOURCE_DEFS } from '@/lib/defaults';
import { hm, today } from '@/lib/dates';
import { jeuDe, niveauDe, POINTS, serie, xpDuJour, xpTotal } from '@/lib/jeu';
import { useBarreOnglets } from '@/lib/mise-en-page';
import { missionDuJour, type ElementMission } from '@/lib/mission';
import { ouvrirRecherche } from '@/lib/recherche';
import { useStore } from '@/lib/store';
import { teinteDe } from '@/lib/teinte';
import { alpha, C, encre, F, MODE_COLORS } from '@/lib/theme';
import type { SourceKey } from '@/lib/types';

const salutation = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
};
const emojiDuMoment = () => {
  const h = new Date().getHours();
  return h < 5 ? '🌙' : h < 12 ? '☀️' : h < 18 ? '🌤️' : '🌆';
};

/** Une petite phrase qui change chaque jour, pour démarrer avec le sourire. */
const CLINS_DOEIL = [
  'On attaque ?',
  'Petit pas, grand jour',
  'Le café est prêt ?',
  'Aujourd’hui, on coche tout',
  'Mode héros activé',
  'Une chose à la fois',
  'Tu gères, vraiment',
  'Allez, on s’y met',
  'Journée parfaite en vue',
  'Ta série t’attend',
];
const clinDoeil = () => {
  const j = Math.floor(Date.now() / 86400000);
  return CLINS_DOEIL[j % CLINS_DOEIL.length];
};

const LIBELLE = { habitude: 'Habitude', relance: 'Relance', tache: 'Tâche' } as const;

/** Une ligne de la mission : on touche n'importe où pour cocher, les points s'affichent à droite. */
function Carte({ m, onPress }: { m: ElementMission; onPress: () => void }) {
  const [echelle] = useState(() => new Animated.Value(1));
  const col = MODE_COLORS[m.mode];
  const presser = () => {
    Animated.sequence([
      Animated.timing(echelle, { toValue: 0.96, duration: 70, useNativeDriver: true }),
      Animated.spring(echelle, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale: echelle }] }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: m.fait }}
        aria-checked={m.fait}
        accessibilityLabel={`${m.titre}, ${m.points} points`}
        onPress={presser}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16, backgroundColor: m.fait ? 'transparent' : C.sunk, opacity: pressed ? 0.85 : 1 })}>
        <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: m.fait ? C.coach : alpha(col, 0.7), backgroundColor: m.fait ? C.coach : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {m.fait ? <Text style={{ color: C.bg, fontFamily: F.texteF, fontSize: 14 }}>✓</Text> : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={{ color: m.fait ? C.muted : C.ink, fontFamily: F.texteM, fontSize: 16, textDecorationLine: m.fait ? 'line-through' : 'none' }}>
            {m.titre}
          </Text>
          <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
            {LIBELLE[m.type]} · {m.detail}
          </Text>
        </View>
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: m.fait ? alpha(C.coach, 0.12) : C.surface }}>
          <Text style={{ color: m.fait ? C.coach : C.muted, fontFamily: F.texteF, fontSize: 12 }}>+{m.points}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Ma journée : progression de la mission, niveau, série et points du jour. Touche pour voir les récompenses. */
function Progression({ faits, total }: { faits: number; total: number }) {
  const { espace } = useStore();
  const d = today();
  const j = jeuDe(espace);
  const xp = xpTotal(j);
  const n = niveauDe(xp);
  const s = serie(j, d);
  const pct = total ? faits / total : 0;
  const message = !total ? 'Rien de prévu : ajoute quelque chose avec +' : faits === total ? 'Journée parfaite, bravo !' : faits === 0 ? 'Coche ta première action pour lancer la journée.' : `Encore ${total - faits} pour la journée parfaite (+${POINTS.parfait} pts).`;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Voir mes récompenses" onPress={() => router.push('/recompenses')} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Mission du jour</Text>
            <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 28, letterSpacing: -0.5 }}>
              {faits}
              <Text style={{ color: C.muted, fontSize: 20 }}> / {total}</Text>
            </Text>
          </View>
          <Text style={{ color: C.coach, fontFamily: F.titre, fontSize: 18 }}>+{xpDuJour(j, d)} pts</Text>
        </View>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: C.sunk, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', borderRadius: 5, backgroundColor: pct === 1 ? C.coach : C.accent }} />
        </View>
        <T small muted>
          {message}
        </T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: C.sunk, borderRadius: 14, padding: 12, gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>Niveau {n.niveau}</Text>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{n.titre}</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(n.progression * 100)}%`, height: '100%', backgroundColor: C.accent }} />
            </View>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{n.restant} pts avant le niveau {n.niveau + 1}</Text>
          </View>
          <View style={{ width: 104, backgroundColor: C.sunk, borderRadius: 14, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Text style={{ fontSize: 22, opacity: s ? 1 : 0.35 }}>🔥</Text>
            <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 18 }}>{s}</Text>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 11 }}>{s > 1 ? 'jours de suite' : 'jour de suite'}</Text>
          </View>
        </View>
      </Panel>
    </Pressable>
  );
}

/** Présentation du système de points, une seule fois. */
function Intro() {
  const { update } = useStore();
  return (
    <Panel>
      <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>Chaque action te rapporte des points</Text>
      {[
        ['✓', `Coche une habitude : +${POINTS.habitude} pts. Une tâche ou une relance : +${POINTS.relance} pts.`],
        ['⭐', `Finis toute ta mission du jour : +${POINTS.parfait} pts de bonus.`],
        ['🔥', 'Agis chaque jour pour faire grandir ta série. Tous les 7 jours, un joker la protège d’un jour manqué.'],
        ['🏅', 'Monte de niveau et débloque des badges.'],
      ].map(([e, t]) => (
        <View key={e} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{e}</Text>
          <T small muted style={{ flex: 1 }}>
            {t}
          </T>
        </View>
      ))}
      <Btn label="C'est parti" onPress={() => update((x) => ({ ...x, jeu: { ...jeuDe(x), intro: true } }))} />
    </Panel>
  );
}

export default function Aujourdhui() {
  const { espace, profil, config, mode, notifs } = useStore();
  const { basculerHabitude, basculerRelance, basculerTache, noter } = useActions();
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState('');
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ajout, setAjout] = useState(false);
  const [voirFaits, setVoirFaits] = useState(false);
  const barre = useBarreOnglets();
  const d = today();

  const mission = missionDuJour(espace, d);
  const aFaire = mission.filter((m) => !m.fait);
  const faits = mission.filter((m) => m.fait);
  const ev = espace.agenda[d] || [];
  const jour = espace.journal[d]?.entrees || [];
  const prenom = (profil?.nom || '').split(' ')[0];
  const iaOn = config.assistant.ia && iaDisponible();
  const notesDuJour = Object.keys(jeuDe(espace).gains).filter((k) => k.startsWith(`j:${d}:`)).length;

  const cocher = (m: ElementMission) => (m.type === 'habitude' ? basculerHabitude(m.item) : m.type === 'relance' ? basculerRelance(m.item) : basculerTache(m.item));
  const ajouterNote = () => {
    const texte = note.trim();
    if (!texte) return;
    noter(texte);
    setNote('');
  };
  const ecouter = () => {
    if (speaking) {
      taire();
      setSpeaking(false);
      return;
    }
    parler(briefing(espace, prenom), espace.audio, { onStart: () => setSpeaking(true), onDone: () => setSpeaking(false) });
  };
  const planifier = async () => {
    setBusy(true);
    setPlan('Je prépare ta journée…');
    try {
      setPlan(await demanderIA('plan', { ton: espace.audio.ton, heure: hm(), donnees: resumeDonnees(espace) }));
    } catch (e) {
      setPlan((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const rond = (pressed: boolean, actif = false) => ({ width: 42, height: 42, borderRadius: 21, backgroundColor: actif ? C.accent : C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center' as const, justifyContent: 'center' as const, opacity: pressed ? 0.8 : 1 });

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Header
          eyebrow={`${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase())} · ${clinDoeil()}`}
          title={`${salutation()}${prenom ? ` ${prenom}` : ''} ${emojiDuMoment()}`}
          right={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {barre.bureau ? null : (
                <Pressable accessibilityRole="button" accessibilityLabel="Rechercher" onPress={ouvrirRecherche} style={({ pressed }) => rond(pressed)}>
                  <Icone nom="loupe" color={C.ink} />
                </Pressable>
              )}
              {mode === 'cloud' ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Notifications${notifs.nonLues ? `, ${notifs.nonLues} non lues` : ''}`} onPress={() => router.push('/notifications')} style={({ pressed }) => rond(pressed)}>
                  <Icone nom="cloche" color={C.ink} />
                  {notifs.nonLues ? <View style={{ position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: C.agressif, borderWidth: 2, borderColor: C.surface }} /> : null}
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel={speaking ? 'Arrêter le briefing' : 'Écouter mon briefing'} onPress={ecouter} style={({ pressed }) => rond(pressed, speaking)}>
                {speaking ? <Text style={{ color: C.accentInk, fontSize: 14 }}>■</Text> : <Icone nom="onde" color={C.ink} />}
              </Pressable>
            </View>
          }
        />

        {!jeuDe(espace).intro ? <Intro /> : <PremiersPas onAjout={() => setAjout(true)} />}

        <Colonnes
          gauche={
            <>
              <Progression faits={faits.length} total={mission.length} />
              <View style={{ gap: 8 }}>
                {aFaire.map((m) => (
                  <Carte key={m.cle} m={m} onPress={() => cocher(m)} />
                ))}
                {mission.length && !aFaire.length ? (
                  <View style={{ alignItems: 'center', gap: 6, padding: 20, borderRadius: 16, backgroundColor: alpha(C.coach, 0.08) }}>
                    <Text style={{ fontSize: 34 }}>⭐</Text>
                    <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>Tout est fait pour aujourd'hui</Text>
                    <T small muted>
                      Profite, ou avance sur la suite avec +.
                    </T>
                  </View>
                ) : null}
                {!mission.length ? (
                  <Pressable onPress={() => setAjout(true)} style={{ alignItems: 'center', gap: 6, padding: 20, borderRadius: 16, backgroundColor: C.sunk }}>
                    <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>Ta mission est vide</Text>
                    <T small muted>
                      Touche ici pour ajouter une tâche, une relance ou une habitude.
                    </T>
                  </Pressable>
                ) : null}
                {faits.length ? (
                  <>
                    <Pressable accessibilityRole="button" onPress={() => setVoirFaits((v) => !v)} style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
                      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>
                        {voirFaits ? '▾' : '▸'} Fait aujourd'hui ({faits.length})
                      </Text>
                    </Pressable>
                    {voirFaits ? faits.map((m) => <Carte key={m.cle} m={m} onPress={() => cocher(m)} />) : null}
                  </>
                ) : null}
              </View>
            </>
          }
          droite={
            <>
              <ResumeFinances espace={espace} d={d} />
              <EtatDesLieux espace={espace} d={d} limite={3} />

              {ev.length ? (
                <Panel title="Agenda" count={ev.length}>
                  {ev.map((e, i) => (
                    <View key={e.id || i} style={{ flexDirection: 'row', gap: 12 }}>
                      <Text style={{ color: C.muted, fontFamily: F.texteM, width: 92 }}>
                        {e.debut}
                        {e.fin ? `–${e.fin}` : ''}
                      </Text>
                      <View style={{ flex: 1, gap: 4 }}>
                        <T>
                          <Text onPress={e.lien ? () => Linking.openURL(e.lien!).catch(() => {}) : undefined}>{e.titre}</Text>
                          {e.lien ? <Text style={{ color: C.muted }}> ↗</Text> : null}
                        </T>
                        {e.lieu ? <T small muted>{e.lieu}</T> : null}
                        {e.source ? <Tag label={SOURCE_DEFS[e.source as SourceKey]?.nom || e.source} color={couleur(espace.sources[e.source as SourceKey]?.couleur || SOURCE_DEFS[e.source as SourceKey]?.couleur)} /> : null}
                      </View>
                    </View>
                  ))}
                </Panel>
              ) : null}

              {iaOn ? (
                <Panel title="Mon copilote">
                  <T small muted>
                    L'IA classe tes priorités et te propose un déroulé de journée.
                  </T>
                  <Btn kind="sec" label={busy ? 'Je réfléchis…' : 'Planifier ma journée'} onPress={planifier} disabled={busy} />
                  {plan ? (
                    <>
                      <T>{plan}</T>
                      {!busy ? <Btn kind="sec" small label="Écouter" onPress={() => parler(plan, espace.audio)} /> : null}
                    </>
                  ) : null}
                </Panel>
              ) : null}

              <Panel title="Mon journal">
                {jour.map((j, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                    <Text style={{ color: C.muted, fontFamily: F.texteM }}>{j.h}</Text>
                    <T style={{ flex: 1 }}>{j.texte}</T>
                  </View>
                ))}
                <Input value={note} onChangeText={setNote} placeholder="Qu'as-tu accompli ? Ex. devis envoyé" returnKeyType="done" onSubmitEditing={ajouterNote} />
                <Btn kind="sec" label={notesDuJour < POINTS.journalMaxParJour ? `Noter (+${POINTS.journal} pts)` : 'Noter'} onPress={ajouterNote} disabled={!note.trim()} />
                {!ev.length ? (
                  <T small muted>
                    Ton agenda s'affiche ici une fois tes comptes connectés dans{' '}
                    <Text style={{ color: C.accent }} onPress={() => router.push('/sources')}>
                      Agendas & outils
                    </Text>
                    .
                  </T>
                ) : null}
              </Panel>
            </>
          }
        />
      </Screen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter une tâche, une relance ou une habitude"
        onPress={() => setAjout(true)}
        style={({ pressed }) => ({ position: 'absolute', right: 20, bottom: barre.bureau ? 28 : barre.haut + 14, width: 58, height: 58, borderRadius: 29, backgroundColor: teinteDe('/'), alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8, transform: [{ scale: pressed ? 0.9 : 1 }, { rotate: pressed ? '90deg' : '0deg' }] })}>
        <Text style={{ color: encre(teinteDe('/')), fontSize: 30, lineHeight: 32, fontFamily: F.texte }}>+</Text>
      </Pressable>
      <AjoutRapide visible={ajout} onClose={() => setAjout(false)} />
    </View>
  );
}
