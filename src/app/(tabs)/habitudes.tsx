import { useState } from 'react';
import { View } from 'react-native';

import { ModePick } from '@/components/forms';
import { HabitudeItem } from '@/components/items';
import { Btn, Empty, Header, Input, Panel, Screen, Sep, Seg, T } from '@/components/ui';
import { JOURS, uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { MODE_COLORS } from '@/lib/theme';
import { MODE_LABELS, MODES, type Frequence, type Habitude, type Mode } from '@/lib/types';

const JOUR_OPTS = [1, 2, 3, 4, 5, 6, 0].map((j) => ({ key: String(j), label: JOURS[j].slice(0, 3) }));

function HabitudeForm({ init, onDone }: { init?: Habitude; onDone: () => void }) {
  const { update, config } = useStore();
  const [nom, setNom] = useState(init?.nom || '');
  const [categorie, setCategorie] = useState<Habitude['categorie']>(init?.categorie || 'perso');
  const [frequence, setFrequence] = useState<Frequence>(init?.frequence || 'quotidien');
  const [jour, setJour] = useState<number>(init?.jour ?? 1);
  const [mode, setMode] = useState<Mode>(init?.mode || config.defauts.perso);

  const save = () => {
    const h = { nom: nom.trim(), categorie, frequence, jour: frequence === 'quotidien' ? null : jour, mode };
    update((e) => ({
      ...e,
      habitudes: init ? e.habitudes.map((x) => (x.id === init.id ? { ...x, ...h } : x)) : [...e.habitudes, { id: uid(), coches: [], ordre: 99, ...h }],
    }));
    onDone();
  };
  const supprimer = () => {
    if (!init) return;
    update((e) => ({ ...e, habitudes: e.habitudes.filter((x) => x.id !== init.id) }));
    onDone();
  };

  return (
    <Panel title={init ? 'Modifier' : 'Nouvelle habitude'} accent>
      <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Ex. Payer l'assurance auto" />
      <Seg label="Catégorie" options={[{ key: 'finance', label: 'Finances' }, { key: 'perso', label: 'Personnel' }]} value={categorie} onChange={setCategorie} />
      <Seg label="Fréquence" options={[{ key: 'quotidien', label: 'Chaque jour' }, { key: 'hebdo', label: 'Chaque semaine' }, { key: 'mensuel', label: 'Chaque mois' }]} value={frequence} onChange={setFrequence} />
      {frequence === 'hebdo' ? <Seg label="Jour" options={JOUR_OPTS} value={String(jour)} onChange={(k) => setJour(Number(k))} /> : null}
      {frequence === 'mensuel' ? (
        <Input label="Jour du mois (1 à 31)" keyboardType="number-pad" value={String(jour || '')} onChangeText={(t) => setJour(Math.max(1, Math.min(31, Number(t.replace(/\D/g, '')) || 1)))} />
      ) : null}
      <ModePick value={mode} onChange={setMode} config={config} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Enregistrer" onPress={save} disabled={!nom.trim()} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
        {init ? <Btn kind="danger" label="Supprimer" onPress={supprimer} /> : null}
      </View>
    </Panel>
  );
}

export default function Habitudes() {
  const { espace, config } = useStore();
  const [edit, setEdit] = useState<Habitude | 'new' | null>(null);
  const groups: [Habitude['categorie'], string][] = [
    ['finance', 'Finances'],
    ['perso', 'Personnel'],
  ];
  return (
    <Screen>
      <Header eyebrow="Finances et vie perso" title="Habitudes" right={!edit ? <Btn small label="+ Ajouter" onPress={() => setEdit('new')} /> : null} />
      {edit ? <HabitudeForm key={edit === 'new' ? 'new' : edit.id} init={edit === 'new' ? undefined : edit} onDone={() => setEdit(null)} /> : null}
      {groups.map(([k, label]) => {
        const g = espace.habitudes.filter((h) => h.categorie === k).sort((a, b) => a.ordre - b.ordre);
        return (
          <Panel key={k} title={label} count={g.length || undefined}>
            {g.length ? g.map((h, i) => <View key={h.id}>{i ? <Sep /> : null}<HabitudeItem h={h} onEdit={() => setEdit(h)} /></View>) : <Empty>Aucune habitude dans cette catégorie.</Empty>}
          </Panel>
        );
      })}
      <Panel title="Modes de rappel">
        {MODES.filter((m) => config.modes[m]?.actif !== false).map((m) => (
          <View key={m} style={{ gap: 2 }}>
            <T style={{ color: MODE_COLORS[m], fontWeight: '700' }}>{MODE_LABELS[m]}</T>
            <T small muted>
              {config.modes[m].desc}
            </T>
          </View>
        ))}
      </Panel>
    </Screen>
  );
}
