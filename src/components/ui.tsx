import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { C, COULEURS, MODE_COLORS, MONO, R, S, surTheme } from '@/lib/theme';
import { useThemeCle } from '@/lib/theme-cle';
import { MODE_LABELS, type Mode } from '@/lib/types';

const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

/** Fond quadrillé façon HUD, derrière tout l'écran. */
function GridBackdrop() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id="g" width="36" height="36" patternUnits="userSpaceOnUse">
          <Line x1="0" y1="0" x2="36" y2="0" stroke={C.grille} strokeWidth="1" />
          <Line x1="0" y1="0" x2="0" y2="36" stroke={C.grille} strokeWidth="1" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#g)" />
    </Svg>
  );
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  // Nouvelle clé = contenu redessiné avec les couleurs du thème choisi.
  const cle = useThemeCle();
  return (
    <View key={cle} style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient pointerEvents="none" colors={[C.halo, 'transparent']} style={styles.degrade} />
      <GridBackdrop />
      <View pointerEvents="none" style={styles.glow} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.scroll, styles.colonne]} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.scroll, styles.colonne, { flex: 1 }]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

export function Header({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <View style={styles.pulse} />
            <Text style={styles.eyebrow}>{eyebrow}</Text>
          </View>
        ) : null}
        <Text style={styles.h1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Panel({ title, count, children, style, accent }: { title?: string; count?: number | string; children: ReactNode; style?: ViewStyle; accent?: boolean }) {
  return (
    <View style={[styles.panel, accent && { borderColor: C.accentLine }, style]}>
      <View style={[styles.coin, styles.coinHG]} />
      <View style={[styles.coin, styles.coinHD]} />
      <View style={[styles.coin, styles.coinBG]} />
      <View style={[styles.coin, styles.coinBD]} />
      {title ? (
        <View style={styles.panelHead}>
          <View style={styles.losange} />
          <Text style={styles.h2}>{title}</Text>
          {count ? <Text style={styles.count}>{String(count).padStart(2, '0')}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function T({ children, muted, small, mono, style, strike }: { children: ReactNode; muted?: boolean; small?: boolean; mono?: boolean; style?: object; strike?: boolean }) {
  return (
    <Text
      style={[
        { color: muted ? C.muted : C.ink, fontSize: small ? 13 : 15, lineHeight: small ? 18 : 21 },
        mono && { fontFamily: MONO, fontVariant: ['tabular-nums'] },
        strike && { textDecorationLine: 'line-through', color: C.muted },
        style,
      ]}>
      {children}
    </Text>
  );
}

export function ModeChip({ mode }: { mode: Mode }) {
  return (
    <View style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: MODE_COLORS[mode] }]} />
      <Text style={[styles.chipText, { color: MODE_COLORS[mode] }]}>{MODE_LABELS[mode]}</Text>
    </View>
  );
}

export function Tag({ label, color = C.accent }: { label: string; color?: string }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}
export const couleur = (k?: string) => COULEURS[(k || 'accent') as keyof typeof COULEURS] || C.accent;

export function Check({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => {
        tap();
        onToggle();
      }}
      style={[styles.check, checked && styles.checkOn]}>
      {checked ? <Text style={{ color: C.accentInk, fontWeight: '800', fontSize: 14 }}>✓</Text> : null}
    </Pressable>
  );
}

export function Btn({ label, onPress, kind = 'primary', disabled, small }: { label: string; onPress: () => void; kind?: 'primary' | 'sec' | 'danger'; disabled?: boolean; small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        small && { paddingVertical: 7, paddingHorizontal: 12 },
        kind === 'sec' && styles.btnSec,
        kind === 'danger' && styles.btnDanger,
        pressed && !disabled && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        disabled && { opacity: 0.45 },
      ]}>
      <Text style={[styles.btnText, kind !== 'primary' && { color: kind === 'danger' ? C.agressif : C.accent }]}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6, flexGrow: 1 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={C.muted} selectionColor={C.accent} style={[styles.input, style]} {...rest} />
    </View>
  );
}

/** Sélecteur à pastilles : remplace les listes déroulantes, plus simple au pouce. */
export function Seg<K extends string>({ options, value, onChange, label, colors }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; label?: string; colors?: Partial<Record<K, string>> }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.seg}>
        {options.map((o) => {
          const on = o.key === value;
          const col = colors?.[o.key] || C.accent;
          return (
            <Pressable
              key={o.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                onChange(o.key);
              }}
              style={[styles.segItem, on && { borderColor: col, backgroundColor: C.accentSoft }]}>
              <Text style={[styles.segText, on && { color: col }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}
export function Meta({ children }: { children: ReactNode }) {
  return <View style={styles.meta}>{children}</View>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}
export function Sep() {
  return <View style={{ height: 1, backgroundColor: C.line }} />;
}
export function IconBtn({ label, glyph, onPress, danger }: { label: string; glyph: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress} style={styles.iconBtn}>
      <Text style={{ color: danger ? C.agressif : C.muted, fontSize: 18 }}>{glyph}</Text>
    </Pressable>
  );
}

const creer = () =>
  StyleSheet.create({
  scroll: { padding: S.lg, paddingBottom: 120, gap: S.lg },
  // Sur un grand écran, le contenu reste une colonne lisible au centre.
  colonne: { width: '100%', maxWidth: 880, alignSelf: 'center' },
  degrade: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  glow: { position: 'absolute', top: -160, right: -120, width: 360, height: 360, borderRadius: 180, backgroundColor: C.halo },
  pulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.9, shadowRadius: 5 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: S.md, marginTop: S.sm },
  eyebrow: { color: C.accent, fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  h1: { color: C.ink, fontSize: 30, fontWeight: '700', letterSpacing: 0.3 },
  h2: { color: C.ink, fontSize: 12, fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase', flex: 1 },
  count: { color: C.accent, fontFamily: MONO, fontSize: 12, fontVariant: ['tabular-nums'] },
  panel: { backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: R, padding: S.lg, gap: S.md, shadowColor: '#000', shadowOpacity: C.sombre ? 0.35 : 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  coin: { position: 'absolute', width: 12, height: 12, borderColor: C.accent, opacity: 0.85 },
  coinHG: { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: R },
  coinHD: { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: R },
  coinBG: { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: R, opacity: 0.35 },
  coinBD: { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: R, opacity: 0.35 },
  losange: { width: 7, height: 7, backgroundColor: C.accent, transform: [{ rotate: '45deg' }] },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: '600' },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: C.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: C.sunk },
  checkOn: { backgroundColor: C.accent, borderColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.7, shadowRadius: 8 },
  btn: { backgroundColor: C.accent, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', shadowColor: C.accent, shadowOpacity: C.sombre ? 0.45 : 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  btnSec: { backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentLine, shadowOpacity: 0 },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.agressif, shadowOpacity: 0 },
  btnText: { color: C.accentInk, fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  label: { color: C.muted, fontSize: 12, fontFamily: MONO, letterSpacing: 1, textTransform: 'uppercase' },
  input: { backgroundColor: C.sunk, borderColor: C.line, borderWidth: 1, borderRadius: 12, color: C.ink, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segItem: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: C.sunk },
  segText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md, paddingVertical: 10 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  empty: { color: C.muted, fontSize: 14, lineHeight: 20 },
  iconBtn: { paddingHorizontal: 4, paddingVertical: 2 },
});

// Recalculées quand le thème change : les composants lisent toujours la version courante.
export let styles = creer();
surTheme(() => {
  styles = creer();
});
