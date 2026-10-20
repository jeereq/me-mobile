import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';

import { C, COULEURS, MODE_COLORS, MONO, R, S } from '@/lib/theme';
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
          <Line x1="0" y1="0" x2="36" y2="0" stroke={C.accent} strokeOpacity={0.05} strokeWidth="1" />
          <Line x1="0" y1="0" x2="0" y2="36" stroke={C.accent} strokeOpacity={0.05} strokeWidth="1" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#g)" />
    </Svg>
  );
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <GridBackdrop />
      <View pointerEvents="none" style={styles.glow} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.scroll, { flex: 1 }]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

export function Header({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.h1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Panel({ title, count, children, style, accent }: { title?: string; count?: number | string; children: ReactNode; style?: ViewStyle; accent?: boolean }) {
  return (
    <View style={[styles.panel, accent && { borderColor: 'rgba(56,217,255,0.35)' }, style]}>
      <View style={styles.panelMark} />
      {title ? (
        <View style={styles.panelHead}>
          <Text style={styles.h2}>{title}</Text>
          {count ? <Text style={styles.count}>{count}</Text> : null}
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
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 },
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
              style={[styles.segItem, on && { borderColor: col, backgroundColor: 'rgba(56,217,255,0.08)' }]}>
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

export const styles = StyleSheet.create({
  scroll: { padding: S.lg, paddingBottom: 120, gap: S.lg },
  glow: { position: 'absolute', top: -160, right: -120, width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(56,217,255,0.10)' },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: S.md, marginTop: S.sm },
  eyebrow: { color: C.accent, fontFamily: MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  h1: { color: C.ink, fontSize: 30, fontWeight: '700', letterSpacing: 0.3 },
  h2: { color: C.ink, fontSize: 13, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  count: { color: C.muted, fontFamily: MONO, fontSize: 12 },
  panel: { backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: R, padding: S.lg, gap: S.md },
  panelMark: { position: 'absolute', top: -1, left: 16, width: 42, height: 2, borderRadius: 2, backgroundColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.9, shadowRadius: 6 },
  panelHead: { flexDirection: 'row', alignItems: 'baseline', gap: S.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12, fontWeight: '600' },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: C.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: C.sunk },
  checkOn: { backgroundColor: C.accent, borderColor: C.accent, shadowColor: C.accent, shadowOpacity: 0.7, shadowRadius: 8 },
  btn: { backgroundColor: C.accent, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 18, alignItems: 'center', shadowColor: C.accent, shadowOpacity: 0.45, shadowRadius: 12 },
  btnSec: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line, shadowOpacity: 0 },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.agressif, shadowOpacity: 0 },
  btnText: { color: C.accentInk, fontWeight: '700', fontSize: 15 },
  label: { color: C.muted, fontSize: 12, fontFamily: MONO, letterSpacing: 1, textTransform: 'uppercase' },
  input: { backgroundColor: C.sunk, borderColor: C.line, borderWidth: 1, borderRadius: 10, color: C.ink, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segItem: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  segText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md, paddingVertical: 10 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  empty: { color: C.muted, fontSize: 14, lineHeight: 20 },
  iconBtn: { paddingHorizontal: 4, paddingVertical: 2 },
});
