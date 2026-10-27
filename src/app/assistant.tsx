import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { ChoixVoix } from '@/components/choix-voix';
import { Btn, Empty, Header, Input, Panel, Screen, Seg, T } from '@/components/ui';
import { SqueletteReponse } from '@/components/squelettes';
import { ReservePro } from '@/components/reserve-pro';
import { briefing, demanderIA, iaDisponible, parler, resumeDonnees, taire } from '@/lib/assistant';
import { useStore } from '@/lib/store';
import { C, MONO } from '@/lib/theme';
import type { AudioPrefs, Ton } from '@/lib/types';

const SECTIONS: { key: AudioPrefs['sections'][number]; label: string }[] = [
  { key: 'agenda', label: 'Agenda' },
  { key: 'relances', label: 'Relances' },
  { key: 'taches', label: 'Tâches' },
  { key: 'habitudes', label: 'Habitudes' },
];

export default function Assistant() {
  const { espace, update, profil, config } = useStore();
  const a = espace.audio;
  const [speaking, setSpeaking] = useState(false);
  const [q, setQ] = useState('');
  const [rep, setRep] = useState('');
  const [busy, setBusy] = useState(false);
  const setA = (patch: Partial<AudioPrefs>) => update((e) => ({ ...e, audio: { ...e.audio, ...patch } }));
  const prenom = (profil?.nom || '').split(' ')[0];

  const play = (text: string) => parler(text, espace.audio, { onStart: () => setSpeaking(true), onDone: () => setSpeaking(false) });
  const demander = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setRep('');
    try {
      const text = await demanderIA('question', { question: q.trim(), ton: a.ton, donnees: resumeDonnees(espace) });
      setRep(text);
      if (a.lireReponses) play(text);
    } catch (e) {
      setRep((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!config.assistant.actif) {
    return (
      <Screen>
        <Header retour eyebrow="Voix et IA" title="Assistant audio" />
        <Empty>L'assistant audio est désactivé par l'admin.</Empty>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header retour eyebrow="Voix et IA" title="Assistant audio" />
      <ReservePro fonction="assistant" />
      <Panel accent>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40 }}>
          {[10, 22, 34, 22, 10].map((h, i) => (
            <View key={i} style={{ width: 5, height: speaking ? h : 8, borderRadius: 3, backgroundColor: C.accent }} />
          ))}
          <Text style={{ color: C.accent, fontFamily: MONO, fontSize: 11, letterSpacing: 2, marginLeft: 8 }}>{speaking ? 'EN LECTURE' : 'PRÊT'}</Text>
        </View>
        <T muted small>
          Ton briefing du jour : agenda, relances, tâches et habitudes, lus avec ta voix.
        </T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn label="Écouter mon briefing" onPress={() => play(briefing(espace, prenom))} />
          <Btn
            kind="sec"
            label="Arrêter"
            onPress={() => {
              taire();
              setSpeaking(false);
            }}
          />
        </View>
      </Panel>

      <Panel title="Ma voix">
        <ChoixVoix />
        <Seg<Ton>
          label="Ton"
          options={[
            { key: 'neutre', label: 'Neutre' },
            { key: 'motivant', label: 'Motivant' },
            { key: 'direct', label: 'Direct' },
            { key: 'coach', label: 'Coach exigeant' },
          ]}
          value={a.ton}
          onChange={(ton) => setA({ ton })}
        />
        <View style={{ gap: 6 }}>
          <Text style={{ color: C.muted, fontSize: 12, fontFamily: MONO, letterSpacing: 1 }}>DANS MON BRIEFING</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {SECTIONS.map((s) => {
              const on = a.sections.includes(s.key);
              return (
                <Pressable
                  key={s.key}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => setA({ sections: on ? a.sections.filter((x) => x !== s.key) : [...a.sections, s.key] })}
                  style={{ borderWidth: 1, borderColor: on ? C.accent : C.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                  <Text style={{ color: on ? C.accent : C.muted, fontWeight: '600' }}>
                    {on ? '✓ ' : ''}
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Panel>

      {config.assistant.ia ? (
        <Panel title="Poser une question">
          {iaDisponible() ? (
            <>
              <Input value={q} onChangeText={setQ} multiline placeholder="Ex. Qui dois-je relancer en priorité cette semaine ?" style={{ minHeight: 80, textAlignVertical: 'top' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T small muted>
                  Lire la réponse à voix haute
                </T>
                <Switch value={a.lireReponses} onValueChange={(lireReponses) => setA({ lireReponses })} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} />
              </View>
              <Btn label={busy ? 'Je réfléchis…' : 'Demander'} onPress={demander} disabled={busy || !q.trim()} />
              {busy ? <SqueletteReponse /> : rep ? <T>{rep}</T> : null}
            </>
          ) : (
            <Empty>Les questions à l'IA demandent la connexion au serveur me-api. Le README explique comment l'activer.</Empty>
          )}
        </Panel>
      ) : null}
    </Screen>
  );
}
