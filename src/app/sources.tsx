import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Btn, Empty, IconBtn, Input, Panel, Screen, Seg, Sep, T, Tag, couleur } from '@/components/ui';
import { IMPORT_LABELS, SOURCE_DEFS } from '@/lib/defaults';
import { uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C, COULEURS } from '@/lib/theme';
import type { Boite, ImportKind, SourceKey, SourcePrefs } from '@/lib/types';

function SourceCard({ k }: { k: SourceKey }) {
  const { espace, update } = useStore();
  const def = SOURCE_DEFS[k];
  const cur: SourcePrefs = espace.sources[k] || { actif: false, imports: def.imports, ctx: def.ctx, couleur: def.couleur, filtre: '' };
  const [filtre, setFiltre] = useState(cur.filtre);
  const save = (patch: Partial<SourcePrefs>) => update((e) => ({ ...e, sources: { ...e.sources, [k]: { ...cur, ...patch } } }));
  const col = couleur(cur.couleur);

  return (
    <Panel style={!cur.actif ? { opacity: 0.75 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.accentInk, fontWeight: '800', fontSize: 17 }}>{def.lettre}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T style={{ fontWeight: '700' }}>{def.nom}</T>
          <Tag label={cur.actif ? 'À connecter' : 'Désactivé'} color={cur.actif ? C.hebdo : C.muted} />
        </View>
        <Switch value={cur.actif} onValueChange={(actif) => save({ actif })} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} accessibilityLabel={`Synchroniser ${def.nom}`} />
      </View>
      {cur.actif ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {def.imports.map((i: ImportKind) => {
              const on = cur.imports.includes(i);
              return (
                <Pressable
                  key={i}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => save({ imports: on ? cur.imports.filter((x) => x !== i) : [...cur.imports, i] })}
                  style={{ borderWidth: 1, borderColor: on ? C.accent : C.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                  <Text style={{ color: on ? C.accent : C.muted, fontWeight: '600', fontSize: 13 }}>
                    {on ? '✓ ' : ''}
                    {IMPORT_LABELS[i]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Seg label="Contexte" options={[{ key: 'perso', label: 'Perso' }, { key: 'pro', label: 'Pro' }]} value={cur.ctx} onChange={(ctx: Boite) => save({ ctx })} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {Object.entries(COULEURS).map(([name, hex]) => (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityLabel={`Couleur ${name}`}
                accessibilityState={{ selected: cur.couleur === name }}
                onPress={() => save({ couleur: name })}
                style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: hex, borderWidth: 2, borderColor: cur.couleur === name ? C.ink : 'transparent' }}
              />
            ))}
          </View>
          <Input label={def.filtre} value={filtre} onChangeText={setFiltre} onEndEditing={() => save({ filtre: filtre.trim() })} placeholder="Tout inclure" />
        </>
      ) : null}
    </Panel>
  );
}

export default function Sources() {
  const { espace, update, config } = useStore();
  const [nom, setNom] = useState('');
  const [note, setNote] = useState('');
  const [ctx, setCtx] = useState<Boite>('perso');
  const keys = (Object.keys(SOURCE_DEFS) as SourceKey[]).filter((k) => config.sourcesAutorisees[k] !== false);
  return (
    <Screen>
      <T muted small>
        Choisis ce que me rassemble : tous tes agendas s'affichent ensemble dans Aujourd'hui, et les tâches et relances trouvées arrivent dans leurs onglets. La connexion de chaque compte se fait une fois, côté serveur (voir le README).
      </T>
      {keys.map((k) => (
        <SourceCard key={k} k={k} />
      ))}
      <Panel title="Autres agendas et outils">
        {espace.sourcesAutres.length ? (
          espace.sourcesAutres.map((a, i) => (
            <View key={a.id}>
              {i ? <Sep /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <T>{a.nom}</T>
                  <T small muted>
                    {a.ctx === 'pro' ? 'Pro' : 'Perso'}
                    {a.note ? ` · ${a.note}` : ''} · à brancher
                  </T>
                </View>
                <IconBtn label="Retirer" glyph="×" danger onPress={() => update((e) => ({ ...e, sourcesAutres: e.sourcesAutres.filter((x) => x.id !== a.id) }))} />
              </View>
            </View>
          ))
        ) : (
          <Empty>Ajoute un agenda ou un outil absent de la liste (iCloud, ClickUp…).</Empty>
        )}
        <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Ex. Agenda iCloud" />
        <Input label="Lien ou précision" value={note} onChangeText={setNote} />
        <Seg options={[{ key: 'perso', label: 'Perso' }, { key: 'pro', label: 'Pro' }]} value={ctx} onChange={setCtx} />
        <Btn
          kind="sec"
          label="Ajouter"
          disabled={!nom.trim()}
          onPress={() => {
            update((e) => ({ ...e, sourcesAutres: [...e.sourcesAutres, { id: uid(), nom: nom.trim(), note: note.trim(), ctx }] }));
            setNom('');
            setNote('');
          }}
        />
      </Panel>
    </Screen>
  );
}
