import { Pressable, Text, View } from 'react-native';

import { ACCENTS, C, MONO, THEME_NOMS, THEMES, type ThemeNom } from '@/lib/theme';

import * as ui from './ui';

export type Apparence = { nom: ThemeNom | ''; accent: string };

/** Aperçu d'un thème : son fond, une carte et sa couleur d'accent. */
function Apercu({ nom, actif, onPress, accent }: { nom: ThemeNom; actif: boolean; onPress: () => void; accent?: string }) {
  const t = THEMES[nom];
  const a = accent || t.accent;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
      accessibilityLabel={`Thème ${t.nom}`}
      onPress={onPress}
      style={{ width: '31%', minWidth: 92, flexGrow: 1, gap: 6 }}>
      <View style={{ height: 76, borderRadius: 12, backgroundColor: t.bg, borderWidth: 2, borderColor: actif ? C.accent : C.line, padding: 8, gap: 5, overflow: 'hidden' }}>
        <View style={{ height: 6, width: 34, borderRadius: 3, backgroundColor: a }} />
        <View style={{ flex: 1, borderRadius: 6, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, padding: 5, gap: 4 }}>
          <View style={{ height: 4, width: '70%', borderRadius: 2, backgroundColor: t.ink, opacity: 0.8 }} />
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {[t.agressif, t.normal, t.coach, t.hebdo].map((c) => (
              <View key={c} style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: c }} />
            ))}
          </View>
        </View>
      </View>
      <Text style={{ color: actif ? C.accent : C.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{t.nom}</Text>
    </Pressable>
  );
}

/**
 * Choix des couleurs de base : un thème, puis une couleur d'accent (ou celle du thème).
 * `heriter` ajoute l'option « comme l'admin » (nom vide).
 */
export function ChoixApparence({ value, onChange, heriter, disabled }: { value: Apparence; onChange: (v: Apparence) => void; heriter?: string; disabled?: boolean }) {
  const set = (v: Apparence) => !disabled && onChange(v);
  return (
    <View style={{ gap: 14 }}>
      {heriter ? (
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: !value.nom }} onPress={() => set({ nom: '', accent: '' })} style={[ui.styles.segItem, { alignSelf: 'flex-start' }, !value.nom && { borderColor: C.accent, backgroundColor: C.accentSoft }]}>
          <Text style={[ui.styles.segText, !value.nom && { color: C.accent }]}>Comme la configuration ({heriter})</Text>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {THEME_NOMS.map((n) => (
          <Apercu key={n} nom={n} actif={value.nom === n} accent={value.nom === n ? value.accent : undefined} onPress={() => set({ nom: n, accent: value.nom === n ? value.accent : '' })} />
        ))}
      </View>
      {value.nom ? (
        <View style={{ gap: 8 }}>
          <Text style={ui.styles.label}>Couleur d'accent</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="Couleur du thème"
              accessibilityState={{ selected: !value.accent }}
              onPress={() => set({ ...value, accent: '' })}
              style={{ height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 2, borderColor: !value.accent ? C.ink : C.line, justifyContent: 'center' }}>
              <Text style={{ color: C.muted, fontFamily: MONO, fontSize: 11 }}>THÈME</Text>
            </Pressable>
            {ACCENTS.map((a) => (
              <Pressable
                key={a}
                accessibilityRole="radio"
                accessibilityLabel={`Accent ${a}`}
                accessibilityState={{ selected: value.accent === a }}
                onPress={() => set({ ...value, accent: a })}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: a, borderWidth: 2, borderColor: value.accent === a ? C.ink : 'transparent' }}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
