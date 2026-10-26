import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { alpha, C, F } from '@/lib/theme';

import { tap } from './ui';

type Option<K extends string> = { key: K; label: string; compte?: number };

/**
 * Onglets d'un écran : une ligne qui défile à l'horizontale (jamais sur deux lignes), l'onglet choisi souligné.
 * Chaque onglet ne montre qu'une partie de l'écran, ce qui garde les pages courtes.
 */
export function Onglets<K extends string>({ options, value, onChange }: { options: Option<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
        {options.map((o) => {
          const on = o.key === value;
          return (
            <Pressable
              key={o.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                onChange(o.key);
              }}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: on ? C.accent : 'transparent', marginBottom: -1, opacity: pressed ? 0.7 : 1 }, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}>
              <Text style={{ color: on ? C.ink : C.muted, fontFamily: on ? F.texteF : F.texteM, fontSize: 15 }}>{o.label}</Text>
              {o.compte ? (
                <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.accent : alpha(C.accent, 0.16) }}>
                  <Text style={{ color: on ? C.accentInk : C.accent, fontFamily: F.texteF, fontSize: 11 }}>{o.compte}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * La barre qui choisit quels éléments une liste montre : la même sur toutes les vues (tâches, relances, habitudes,
 * dépenses, opérations, projets). Jusqu'à quatre choix, c'est une barre segmentée ; au-delà (les budgets, les
 * catégories), des pastilles qui défilent à l'horizontale. Chaque choix peut porter son nombre d'éléments.
 */
export function Filtre<K extends string>({ options, value, onChange, label }: { options: Option<K>[]; value: K; onChange: (k: K) => void; /** Dit à voix haute ce que la barre filtre (« Filtrer les tâches »). */ label: string }) {
  if (options.length <= 4) return <SousOnglets label={label} options={options} value={value} onChange={onChange} />;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={label} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 6 }}>
        {options.map((o) => {
          const on = o.key === value;
          return (
            <Pressable
              key={o.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                onChange(o.key);
              }}
              style={({ pressed }) => [{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.14) : 'transparent', opacity: pressed ? 0.7 : 1 }, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}>
              <Text numberOfLines={1} style={{ color: on ? C.accent : C.ink, fontFamily: on ? F.texteF : F.texteM, fontSize: 13 }}>
                {o.label}
                {o.compte ? ` · ${o.compte}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/** Choix secondaire à l'intérieur d'un onglet (vue, période) : une barre compacte qui défile si elle est trop large. */
export function SousOnglets<K extends string>({ options, value, onChange, label }: { options: Option<K>[]; value: K; onChange: (k: K) => void; label?: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={label} contentContainerStyle={{ flexGrow: 1 }}>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', padding: 3, gap: 2, borderRadius: 12, backgroundColor: C.sunk, flexGrow: 1 }}>
        {options.map((o) => {
          const on = o.key === value;
          return (
            <Pressable
              key={o.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                onChange(o.key);
              }}
              style={{ flexGrow: 1, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9, backgroundColor: on ? C.surface : 'transparent', borderWidth: 1, borderColor: on ? C.line : 'transparent' }}>
              <Text numberOfLines={1} style={{ color: on ? C.ink : C.muted, fontFamily: on ? F.texteF : F.texteM, fontSize: 13 }}>
                {o.label}
                {o.compte ? ` · ${o.compte}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
