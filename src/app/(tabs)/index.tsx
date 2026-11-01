import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Animated, Linking, Pressable, Text, View } from 'react-native';

import { MaJournee, ProchainRdv } from '@/components/accueil';
import { useComptesAFaire } from '@/components/a-faire';
import { AjoutRapide } from '@/components/ajout-rapide';
import { CarteCopilote, teinteCopilote, useCopiloteVisible } from '@/components/copilote';
import { Icone } from '@/components/icones';
import { PremiersPas } from '@/components/premiers-pas';
import { ApercuObjectifs } from '@/components/objectifs';
import { EtatDesLieux, ResumeFinances } from '@/components/tableau-de-bord';
import { Btn, Colonnes, Header, Input, Panel, Screen, T, Tag, couleur } from '@/components/ui';
import { avecAgendaPerso } from '@/lib/agenda-perso';
import { useActions } from '@/lib/actions';
import { briefing, parler, taire } from '@/lib/assistant';
import { SOURCE_DEFS } from '@/lib/defaults';
import { today } from '@/lib/dates';
import { financesDe } from '@/lib/finances';
import { jeuDe, POINTS } from '@/lib/jeu';
import { Limitee } from '@/components/pliable';
import { useBarreOnglets } from '@/lib/mise-en-page';
import { missionDuJour, type ElementMission } from '@/lib/mission';
import { ouvrirRecherche } from '@/lib/recherche';
import { ouvrirVoix } from '@/lib/ecoute';
import { useStore } from '@/lib/store';
import { teinteDe } from '@/lib/teinte';
import { alpha, C, F, MODE_COLORS } from '@/lib/theme';
import type { SourceKey } from '@/lib/types';

const salutation = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
};
const LIBELLE = { habitude: 'Habitude', relance: 'Relance', tache: 'Tâche' } as const;
const RUBRIQUE = { habitude: '/habitudes', relance: '/relances', tache: '/taches' } as const;

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: teinteDe(RUBRIQUE[m.type]) }} />
            <Text numberOfLines={1} style={{ flex: 1, color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
              {LIBELLE[m.type]} · {m.detail}
            </Text>
          </View>
        </View>
        <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: m.fait ? alpha(C.coach, 0.12) : C.surface }}>
          <Text style={{ color: m.fait ? C.coach : C.muted, fontFamily: F.texteF, fontSize: 12 }}>+{m.points}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Présentation du système de points, une seule fois. */
function Intro() {
  const { update } = useStore();
  return (
    <Panel>
      <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>Chaque action te rapporte des points</Text>
      {[
        [C.coach, `Coche une habitude : +${POINTS.habitude} pts. Une tâche ou une relance : +${POINTS.relance} pts.`],
        [C.accent, `Finis toute ta mission du jour : +${POINTS.parfait} pts de bonus.`],
        [C.hebdo, 'Agis chaque jour pour faire grandir ta série. Tous les 7 jours, un joker la protège d’un jour manqué.'],
        [C.agressif, 'Monte de niveau et débloque des badges.'],
      ].map(([c, t]) => (
        <View key={t} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: c }} />
          <T small muted style={{ flex: 1 }}>
            {t}
          </T>
        </View>
      ))}
      <Btn label="C'est parti" onPress={() => update((x) => ({ ...x, jeu: { ...jeuDe(x), intro: true } }))} />
    </Panel>
  );
}

/** Les mails non lus du jour à qui répondre, en tête de « Ce qui t'attend » (deux au plus, le reste dans Mails). */
function MailsAttente() {
  const { mails } = useStore();
  const d = today();
  const nonLus = mails.filter((m) => m.nonLu && m.sens === 'recu' && m.date === d).slice(0, 2);
  if (!nonLus.length) return null;
  return (
    <>
      {nonLus.map((m) => (
        <Pressable
          key={m.id}
          accessibilityRole="link"
          accessibilityLabel={`Répondre à ${m.contact} : ${m.sujet}`}
          onPress={() => router.push({ pathname: '/messages', params: { lire: m.id } } as never)}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.sunk, opacity: pressed ? 0.85 : 1 })}>
          <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(teinteDe('/messages'), 0.16) }}>
            <Icone nom="mail" color={teinteDe('/messages')} size={15} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 16 }}>
              Répondre à {m.contact}
            </Text>
            <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
              Mail · {m.sujet}
            </Text>
          </View>
        </Pressable>
      ))}
    </>
  );
}

/** Trois raccourcis sous la liste : mails non lus, relances et tâches du jour, chacun vers son écran. */
function Compteurs() {
  const { mails } = useStore();
  const n = useComptesAFaire();
  const nonLus = mails.filter((m) => m.nonLu).length;
  const tuiles: { label: string; nombre: number; href: Href; c: string }[] = [
    { label: nonLus > 1 ? 'mails non lus' : 'mail non lu', nombre: nonLus, href: '/messages' as Href, c: teinteDe('/messages') },
    { label: 'à relancer', nombre: n.relances, href: '/relances', c: teinteDe('/relances') },
    { label: n.taches > 1 ? 'tâches urgentes' : 'tâche urgente', nombre: n.taches, href: '/taches', c: teinteDe('/taches') },
  ];
  if (!tuiles.some((t) => t.nombre)) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingTop: 4 }}>
      {tuiles.map((t) => (
        <Pressable key={t.label} accessibilityRole="link" accessibilityLabel={`${t.nombre} ${t.label}`} onPress={() => router.push(t.href)} style={({ pressed }) => ({ flex: 1, gap: 2, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ color: t.nombre ? t.c : C.muted, fontFamily: F.titreM, fontSize: 22, letterSpacing: -0.4 }}>{t.nombre}</Text>
          <Text numberOfLines={2} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Aujourdhui() {
  const { espace, profil, mode, notifs, equipeActive, agendaPerso } = useStore();
  const { basculerHabitude, basculerRelance, basculerTache, noter } = useActions();
  const [note, setNote] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [ajout, setAjout] = useState(false);
  const [voirFaits, setVoirFaits] = useState(false);
  const [tousLesMots, setTousLesMots] = useState(false);
  const barre = useBarreOnglets();
  const d = today();

  const mission = missionDuJour(espace, d);
  const aFaire = mission.filter((m) => !m.fait);
  const faits = mission.filter((m) => m.fait);
  // Dans une équipe, mon agenda personnel s'ajoute (pour moi seul) à celui de l'équipe.
  const ev = equipeActive ? avecAgendaPerso(espace.agenda, agendaPerso)[d] || [] : espace.agenda[d] || [];
  const jour = espace.journal[d]?.entrees || [];
  const prenom = (profil?.nom || '').split(' ')[0];
  const copilote = useCopiloteVisible();
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
  const rond = (pressed: boolean, actif = false) => ({ width: 42, height: 42, borderRadius: 21, backgroundColor: actif ? C.accent : C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center' as const, justifyContent: 'center' as const, opacity: pressed ? 0.8 : 1 });

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Header
          eyebrow={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase())}
          title={`${salutation()}${prenom ? ` ${prenom}` : ''}`}
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
              {copilote ? (
                <Pressable accessibilityRole="link" accessibilityLabel="Mon copilote" onPress={() => router.push('/copilote' as Href)} style={({ pressed }) => ({ ...rond(pressed), backgroundColor: teinteCopilote().douce, borderColor: teinteCopilote().ligne })}>
                  <Icone nom="copilote" color={teinteCopilote().c} />
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" accessibilityLabel="Parler à l'app" onPress={() => ouvrirVoix()} style={({ pressed }) => rond(pressed)}>
                <Icone nom="micro" color={C.ink} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={speaking ? 'Arrêter le briefing' : 'Écouter mon briefing'} onPress={ecouter} style={({ pressed }) => rond(pressed, speaking)}>
                {speaking ? <Text style={{ color: C.accentInk, fontSize: 14 }}>■</Text> : <Icone nom="onde" color={C.ink} />}
              </Pressable>
            </View>
          }
        />

        <MaJournee mission={mission} />

        {copilote ? <CarteCopilote /> : null}

        {!jeuDe(espace).intro ? <Intro /> : null}

        <Colonnes
          gauche={
            <>
              <ProchainRdv ev={ev} />
              <View style={{ gap: 8 }}>
                {aFaire.length ? (
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 4, paddingTop: 4 }}>
                    <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 18, letterSpacing: -0.3 }}>Ce qui t'attend</Text>
                    <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>{aFaire.length}</Text>
                  </View>
                ) : null}
                <MailsAttente />
                <Limitee items={aFaire} n={6} nom="éléments à faire" rendu={(m) => <Carte key={m.cle} m={m} onPress={() => cocher(m)} />} />
                <Compteurs />
                {mission.length && !aFaire.length ? (
                  <View style={{ alignItems: 'center', gap: 6, padding: 20, borderRadius: 16, backgroundColor: alpha(C.coach, 0.08) }}>
                    <Icone nom="trophee" color={C.coach} size={28} />
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
              {jeuDe(espace).intro ? <PremiersPas onAjout={() => setAjout(true)} /> : null}
            </>
          }
          droite={
            <>
              <ResumeFinances espace={espace} d={d} />
              <ApercuObjectifs f={financesDe(espace)} invitation={false} onVoir={() => router.push('/finances?onglet=objectifs' as Href)} />
              <EtatDesLieux espace={espace} d={d} limite={3} />

              {ev.length ? (
                <Panel
                  title="Agenda"
                  count={ev.length}
                  right={
                    <Pressable accessibilityRole="button" accessibilityLabel="Ouvrir le calendrier" onPress={() => router.push('/calendrier')} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                      <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Calendrier ›</Text>
                    </Pressable>
                  }>
                  <Limitee items={ev} n={4} nom="rendez-vous" rendu={(e, i) => (
                    <View key={e.id || i} style={{ flexDirection: 'row', gap: 12 }}>
                      <Text style={{ color: C.muted, fontFamily: F.texteM, width: 92, fontVariant: ['tabular-nums'] }}>
                        {e.debut}
                        {e.fin ? `–${e.fin}` : ''}
                      </Text>
                      <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: e.source ? couleur(espace.sources[e.source as SourceKey]?.couleur || SOURCE_DEFS[e.source as SourceKey]?.couleur) : C.accent }} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <T>
                          <Text onPress={e.lien ? () => Linking.openURL(e.lien!).catch(() => {}) : undefined}>{e.titre}</Text>
                          {e.lien ? <Text style={{ color: C.muted }}> ↗</Text> : null}
                        </T>
                        {e.lieu ? <T small muted>{e.lieu}</T> : null}
                        {e.source ? <Tag label={SOURCE_DEFS[e.source as SourceKey]?.nom || e.source} color={couleur(espace.sources[e.source as SourceKey]?.couleur || SOURCE_DEFS[e.source as SourceKey]?.couleur)} /> : null}
                      </View>
                    </View>
                  )} />
                </Panel>
              ) : null}

              <Panel title="Mon journal">
                {jour.length > 3 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={tousLesMots ? 'Ne montrer que les dernières notes' : `Voir les ${jour.length - 3} notes plus tôt`} onPress={() => setTousLesMots((v) => !v)} style={{ minHeight: 36, justifyContent: 'center' }}>
                    <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 13 }}>{tousLesMots ? 'Réduire' : `Voir les ${jour.length - 3} notes plus tôt`}</Text>
                  </Pressable>
                ) : null}
                {(tousLesMots ? jour : jour.slice(-3)).map((j, i) => (
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
        style={({ pressed }) => ({ position: 'absolute', right: 20, bottom: barre.bureau ? 28 : barre.haut + 14, width: 56, height: 56, borderRadius: 18, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8, transform: [{ scale: pressed ? 0.95 : 1 }] })}>
        <Text style={{ color: C.bg, fontSize: 30, lineHeight: 32, fontFamily: F.texte }}>+</Text>
      </Pressable>
      <AjoutRapide visible={ajout} onClose={() => setAjout(false)} />
    </View>
  );
}
