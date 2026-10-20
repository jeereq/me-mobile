import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { HabitudeItem, RelanceItem, TacheItem } from '@/components/items';
import { Btn, Empty, Header, Input, Panel, Screen, Sep, T, Tag, couleur } from '@/components/ui';
import { briefing, demanderIA, iaDisponible, parler, resumeDonnees, taire } from '@/lib/assistant';
import { SOURCE_DEFS } from '@/lib/defaults';
import { addDays, doneIn, fmtLong, habitToday, hm, today } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C, MONO } from '@/lib/theme';
import type { SourceKey } from '@/lib/types';

function Ring({ pct, empty }: { pct: number; empty: boolean }) {
  const r = 46;
  const L = 2 * Math.PI * r;
  return (
    <View style={{ width: 116, height: 116, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={116} height={116} viewBox="0 0 116 116" style={{ position: 'absolute' }}>
        <Circle cx="58" cy="58" r="55" stroke={C.accent} strokeOpacity={0.5} strokeWidth={2} strokeDasharray="2 6" fill="none" />
        <Circle cx="58" cy="58" r={r} stroke={C.accentSoft} strokeWidth={11} fill="none" />
        {pct > 0 ? (
          <Circle cx="58" cy="58" r={r} stroke={C.accent} strokeWidth={11} fill="none" strokeLinecap="round" strokeDasharray={`${(pct / 100) * L} ${L}`} transform="rotate(-90 58 58)" />
        ) : null}
      </Svg>
      <Text style={{ color: C.accent, fontSize: 26, fontWeight: '700', textShadowColor: C.glow, textShadowRadius: 12 }}>{empty ? '—' : `${pct}%`}</Text>
      <Text style={{ color: C.muted, fontSize: 10 }}>habitudes</Text>
    </View>
  );
}

function Stat({ n, label, warn }: { n: string | number; label: string; warn?: boolean }) {
  return (
    <View style={{ flexBasis: '46%', flexGrow: 1, borderLeftWidth: 1, borderLeftColor: C.line, paddingLeft: 10 }}>
      <Text style={{ color: warn ? C.agressif : C.ink, fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {n}
      </Text>
      <Text style={{ color: C.muted, fontSize: 10, fontFamily: MONO, letterSpacing: 1, textTransform: 'uppercase' }} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export default function Aujourdhui() {
  const { espace, update, profil, config } = useStore();
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState('');
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const d = today();
  const soon = addDays(d, 2);

  const ev = espace.agenda[d] || [];
  const next = ev.find((e) => (e.debut || '') >= hm());
  const relToday = espace.relances.filter((r) => r.statut === 'a_faire' && r.date <= d);
  const tacToday = espace.taches.filter((t) => t.statut !== 'fait' && (t.priorite === 'haute' || (t.echeance && t.echeance <= soon)));
  const habToday = espace.habitudes.filter((h) => habitToday(h, d));
  const habDone = habToday.filter((h) => doneIn(h, d)).length;
  const pct = habToday.length ? Math.round((habDone / habToday.length) * 100) : 0;
  const jour = espace.journal[d]?.entrees || [];
  const prenom = (profil?.nom || '').split(' ')[0];
  const iaOn = config.assistant.ia && iaDisponible();

  const noter = () => {
    const texte = note.trim();
    if (!texte) return;
    update((e) => ({ ...e, journal: { ...e.journal, [d]: { date: d, entrees: [...(e.journal[d]?.entrees || []), { h: hm(), texte }] } } }));
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

  return (
    <Screen>
      <Header
        eyebrow={fmtLong()}
        title={prenom ? `Bonjour ${prenom}` : 'Bonjour'}
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="Écouter mon briefing" onPress={ecouter} style={{ borderWidth: 1, borderColor: C.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Text style={{ color: C.accent, fontWeight: '700' }}>{speaking ? '■ Stop' : '▶ Briefing'}</Text>
          </Pressable>
        }
      />

      <Panel accent>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Ring pct={pct} empty={!habToday.length} />
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 8 }}>
            <Stat n={relToday.length} label="relances dues" warn={relToday.some((r) => r.date < d)} />
            <Stat n={tacToday.length} label="tâches urgentes" />
            <Stat n={habToday.length - habDone} label="habitudes restantes" />
            <Stat n={next ? next.debut : '—'} label={next ? next.titre : 'prochain rdv'} />
          </View>
        </View>
      </Panel>

      {iaOn ? (
        <Panel title="Mon copilote">
          <T small muted>
            L'IA classe tes priorités et te propose un déroulé de journée.
          </T>
          <Btn label={busy ? 'Je réfléchis…' : 'Planifier ma journée'} onPress={planifier} disabled={busy} />
          {plan ? (
            <>
              <T>{plan}</T>
              {!busy ? <Btn kind="sec" small label="Écouter" onPress={() => parler(plan, espace.audio)} /> : null}
            </>
          ) : null}
        </Panel>
      ) : null}

      <Panel title="Agenda du jour" count={ev.length || undefined}>
        {ev.length ? (
          ev.map((e, i) => (
            <View key={e.id || i} style={{ flexDirection: 'row', gap: 12 }}>
              <Text style={{ color: C.muted, fontFamily: MONO, width: 92 }}>
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
          ))
        ) : (
          <Empty>
            Tes agendas apparaîtront ici une fois synchronisés. Active-les dans{' '}
            <Text style={{ color: C.accent }} onPress={() => router.push('/sources')}>
              Agendas & outils
            </Text>
            .
          </Empty>
        )}
      </Panel>

      <Panel title="Habitudes du jour" count={habToday.length || undefined}>
        {habToday.length ? habToday.map((h, i) => <View key={h.id}>{i ? <Sep /> : null}<HabitudeItem h={h} /></View>) : <Empty>Aucune habitude prévue aujourd'hui.</Empty>}
      </Panel>

      <Panel title="Relances dues" count={relToday.length || undefined}>
        {relToday.length ? relToday.map((r, i) => <View key={r.id}>{i ? <Sep /> : null}<RelanceItem r={r} compact /></View>) : <Empty>Aucune relance prévue aujourd'hui.</Empty>}
      </Panel>

      <Panel title="Tâches urgentes" count={tacToday.length || undefined}>
        {tacToday.length ? tacToday.map((t, i) => <View key={t.id}>{i ? <Sep /> : null}<TacheItem t={t} compact /></View>) : <Empty>Rien d'urgent : pas de priorité haute ni d'échéance sous 48 h.</Empty>}
      </Panel>

      <Panel title="Ce que j'ai fait aujourd'hui">
        {jour.length ? (
          jour.map((j, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
              <Text style={{ color: C.muted, fontFamily: MONO }}>{j.h}</Text>
              <T style={{ flex: 1 }}>{j.texte}</T>
            </View>
          ))
        ) : (
          <Empty>Rien noté pour l'instant.</Empty>
        )}
        <Input value={note} onChangeText={setNote} placeholder="Ex. Appel avec le comptable, devis envoyé" returnKeyType="done" onSubmitEditing={noter} />
        <Btn kind="sec" label="Noter" onPress={noter} disabled={!note.trim()} />
      </Panel>
    </Screen>
  );
}
