import { useState } from 'react';
import { Text, View } from 'react-native';

import { ChoixCategories } from '@/components/categories';
import { ModePick } from '@/components/forms';
import { HabitudeItem } from '@/components/items';
import { Limitee, Pastille, Pliable } from '@/components/pliable';
import { BarreSelection, BoutonSelection, Selectionnable, useSelection } from '@/components/selection';
import { Btn, Collant, Dialogue, Empty, Header, Input, Panel, Screen, Sep, Seg, T } from '@/components/ui';
import { Filtre } from '@/components/onglets';
import { tHabitude, useActions } from '@/lib/actions';
import { poser } from '@/lib/categories';
import { doneIn, JOURS, today, uid } from '@/lib/dates';
import { decrireMode, reglesDuMode } from '@/lib/modes';
import { useStore } from '@/lib/store';
import { C, F, MODE_COLORS } from '@/lib/theme';
import { habitudesDuJour, resumeHabitudes } from '@/lib/vue-courte';
import { MODE_LABELS, MODES, type Frequence, type Habitude, type Mode } from '@/lib/types';

const JOUR_OPTS = [1, 2, 3, 4, 5, 6, 0].map((j) => ({ key: String(j), label: JOURS[j].slice(0, 3) }));

function HabitudeForm({ init, onDone }: { init?: Habitude; onDone: () => void }) {
  const { update, config } = useStore();
  const [nom, setNom] = useState(init?.nom || '');
  const [categorie, setCategorie] = useState<Habitude['categorie']>(init?.categorie || 'perso');
  const [frequence, setFrequence] = useState<Frequence>(init?.frequence || 'quotidien');
  const [jour, setJour] = useState<number>(init?.jour ?? 1);
  const [mode, setMode] = useState<Mode>(init?.mode || config.defauts.perso);
  const [cats, setCats] = useState<string[] | undefined>(init?.categories);

  const save = () => {
    const h = { nom: nom.trim(), categorie, frequence, jour: frequence === 'quotidien' ? null : jour, mode };
    const avecCats = <T extends object>(x: T) => poser({ ...x, ...h } as T & Habitude, cats);
    update((e) => ({
      ...e,
      habitudes: init ? e.habitudes.map((x) => (x.id === init.id ? avecCats(x) : x)) : [...e.habitudes, avecCats({ id: uid(), coches: [] as string[], ordre: 99 })],
    }));
    onDone();
  };
  const supprimer = () => {
    if (!init) return;
    update((e) => ({ ...e, habitudes: e.habitudes.filter((x) => x.id !== init.id) }));
    onDone();
  };

  return (
    <Dialogue titre={init ? 'Modifier l’habitude' : 'Nouvelle habitude'} onFermer={onDone}>
      <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Ex. Payer l'assurance auto" />
      <Seg label="Catégorie" options={[{ key: 'finance', label: 'Finances' }, { key: 'perso', label: 'Personnel' }]} value={categorie} onChange={setCategorie} />
      <Seg label="Fréquence" options={[{ key: 'quotidien', label: 'Chaque jour' }, { key: 'hebdo', label: 'Chaque semaine' }, { key: 'mensuel', label: 'Chaque mois' }]} value={frequence} onChange={setFrequence} />
      {frequence === 'hebdo' ? <Seg label="Jour" options={JOUR_OPTS} value={String(jour)} onChange={(k) => setJour(Number(k))} /> : null}
      {frequence === 'mensuel' ? (
        <Input label="Jour du mois (1 à 31)" keyboardType="number-pad" value={String(jour || '')} onChangeText={(t) => setJour(Math.max(1, Math.min(31, Number(t.replace(/\D/g, '')) || 1)))} />
      ) : null}
      <ChoixCategories value={cats} onChange={setCats} />
      <ModePick value={mode} onChange={setMode} config={config} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Enregistrer" onPress={save} disabled={!nom.trim()} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
        {init ? <Btn kind="danger" label="Supprimer" onPress={supprimer} /> : null}
      </View>
    </Dialogue>
  );
}

export default function Habitudes() {
  const { espace, config, update } = useStore();
  const [edit, setEdit] = useState<Habitude | 'new' | null>(null);
  const [filtre, setFiltre] = useState<'toutes' | Habitude['categorie']>('toutes');
  const sel = useSelection();
  const { enLot } = useActions();
  const actions = [
    { label: "Cocher pour aujourd'hui", onPress: (ids: string[]) => enLot((e, d, h) => ids.filter((id) => { const x = e.habitudes.find((y) => y.id === id); return x && !doneIn(x, d); }).reduce((acc, id) => tHabitude(acc, id, d, h), e)) },
    { label: 'Décocher', onPress: (ids: string[]) => enLot((e, d, h) => ids.filter((id) => { const x = e.habitudes.find((y) => y.id === id); return x && doneIn(x, d); }).reduce((acc, id) => tHabitude(acc, id, d, h), e)) },
    { label: 'Mode coach', onPress: (ids: string[]) => update((e) => ({ ...e, habitudes: e.habitudes.map((x) => (ids.includes(x.id) ? { ...x, mode: 'coach' as const } : x)) })) },
    { label: 'Mode passif', onPress: (ids: string[]) => update((e) => ({ ...e, habitudes: e.habitudes.map((x) => (ids.includes(x.id) ? { ...x, mode: 'passif' as const } : x)) })) },
    { label: 'Supprimer', danger: true, onPress: (ids: string[]) => update((e) => ({ ...e, habitudes: e.habitudes.filter((x) => !ids.includes(x.id)) })) },
  ];
  const nbCat = (k: Habitude['categorie']) => espace.habitudes.filter((h) => h.categorie === k).length;
  const jour = today();
  const vues = espace.habitudes.filter((h) => filtre === 'toutes' || h.categorie === filtre);
  const { aujourdhui, autres } = habitudesDuJour(vues, jour);
  const r = resumeHabitudes(vues, jour);
  const ligne = (h: Habitude, i: number) => (
    <View key={h.id}>
      {i ? <Sep /> : null}
      <Selectionnable sel={sel} id={h.id} label={h.nom}>
        <HabitudeItem h={h} onEdit={() => setEdit(h)} />
      </Selectionnable>
    </View>
  );
  return (
    <Screen pied={sel.actif ? <BarreSelection sel={sel} tous={espace.habitudes.map((h) => h.id)} actions={actions} /> : null}>
      <Header eyebrow="Finances et vie perso" title="Habitudes" right={<Btn small label="+ Ajouter" onPress={() => setEdit('new')} />} />
      {edit ? <HabitudeForm key={edit === 'new' ? 'new' : edit.id} init={edit === 'new' ? undefined : edit} onDone={() => setEdit(null)} /> : null}
      <Collant>
        <Filtre
          label="Filtrer les habitudes"
          options={[
            { key: 'toutes', label: 'Toutes', compte: espace.habitudes.length },
            { key: 'finance', label: 'Finances', compte: nbCat('finance') },
            { key: 'perso', label: 'Personnel', compte: nbCat('perso') },
          ]}
          value={filtre}
          onChange={setFiltre}
        />
      </Collant>
      {vues.length ? (
        <Panel>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={{ flexShrink: 1, color: C.ink, fontFamily: F.titreM, fontSize: 20, letterSpacing: -0.4 }}>{r.dues ? `${r.faites} sur ${r.dues} faites aujourd'hui` : "Rien de prévu aujourd'hui"}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {r.dues ? <T small muted>{r.pct} %</T> : null}
              <BoutonSelection sel={sel} />
            </View>
          </View>
          {r.dues ? (
            <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: r.pct }} style={{ height: 8, borderRadius: 4, backgroundColor: C.sunk, overflow: 'hidden' }}>
              <View style={{ width: `${r.pct}%`, height: 8, backgroundColor: C.coach }} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pastille valeur={r.meilleureSerie ? `🔥 ${r.meilleureSerie}` : '0'} label="Meilleure série" />
            <Pastille valeur={r.enSerie} label="Habitudes en série" couleur={C.coach} />
            <Pastille valeur={vues.length} label="Habitudes suivies" />
          </View>
        </Panel>
      ) : null}
      {aujourdhui.length ? (
        <Panel title="Aujourd'hui" count={aujourdhui.length}>
          {aujourdhui.map(ligne)}
        </Panel>
      ) : null}
      {autres.length ? (
        <Pliable panneau titre={aujourdhui.length ? 'Les autres jours' : 'Mes habitudes'} count={autres.length} ouvert={!aujourdhui.length}>
          <Limitee items={autres} n={8} nom="habitudes" rendu={ligne} />
        </Pliable>
      ) : null}
      {!vues.length ? (
        <Panel>
          <Empty>Aucune habitude pour l'instant. Ajoute-en une avec « + Ajouter ».</Empty>
        </Panel>
      ) : null}
      <Pliable panneau titre="Modes de rappel">
        {MODES.filter((m) => config.modes[m]?.actif !== false).map((m) => (
          <View key={m} style={{ gap: 2 }}>
            <T style={{ color: MODE_COLORS[m], fontWeight: '700' }}>{MODE_LABELS[m]}</T>
            <T small muted>
              {config.modes[m].desc}
            </T>
            <T small muted>
              {decrireMode(reglesDuMode(config, m), config.routineHeure, config.rappelSoir)}
            </T>
          </View>
        ))}
      </Pliable>
    </Screen>
  );
}
