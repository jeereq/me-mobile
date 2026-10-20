import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type TextInputProps, type ViewStyle } from 'react-native';
import { router } from 'expo-router';

import { Icone, type IconeNom } from '@/components/icones';
import { alpha, C, COULEURS, F, MODE_COLORS, MONO, R, S, surTheme } from '@/lib/theme';
import { useBarreOnglets, useZonesSures } from '@/lib/mise-en-page';
import { useThemeCle } from '@/lib/theme-cle';
import { MODE_LABELS, type Mode } from '@/lib/types';

const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

export function Screen({ children, scroll = true, large, pied }: { children: ReactNode; scroll?: boolean; large?: boolean; /** Élément flottant hors défilement (barre d'actions groupées). */ pied?: ReactNode }) {
  // Nouvelle clé = contenu redessiné avec les couleurs du thème choisi.
  const cle = useThemeCle();
  const { reserve } = useBarreOnglets();
  const { haut } = useZonesSures();
  return (
    <View key={cle} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, paddingTop: haut }}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.scroll, styles.colonne, { paddingBottom: reserve + (pied ? 140 : 0) }, large && { maxWidth: 1180 }]} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.scroll, styles.colonne, { flex: 1, paddingBottom: reserve }]}>{children}</View>
        )}
      </View>
      {pied}
    </View>
  );
}

/** Titre d'écran. `retour` ajoute le bouton de retour des écrans ouverts depuis Plus. */
/** Deux colonnes sur un écran d'ordinateur, une seule pile sur téléphone. */
export function Colonnes({ gauche, droite }: { gauche: ReactNode; droite: ReactNode }) {
  const large = useWindowDimensions().width >= 1150;
  if (!large)
    return (
      <>
        {gauche}
        {droite}
      </>
    );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.lg }}>
      <View style={{ flex: 1, gap: S.lg }}>{gauche}</View>
      <View style={{ flex: 1, gap: S.lg }}>{droite}</View>
    </View>
  );
}

export function Header({ eyebrow, title, right, retour }: { eyebrow?: string; title: string; right?: ReactNode; retour?: boolean }) {
  return (
    <View style={styles.header}>
      {retour ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/plus'))}
          style={({ pressed }) => [styles.retour, pressed && { opacity: 0.7 }]}>
          <Icone nom="retour" color={C.accent} size={18} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        <Text style={styles.h1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Panel({ title, count, children, style, accent, right }: { title?: string; count?: number | string; children: ReactNode; style?: ViewStyle; accent?: boolean; right?: ReactNode }) {
  return (
    <View style={[styles.panel, accent && { borderColor: C.accentLine }, style]}>
      {title ? (
        <View style={styles.panelHead}>
          <Text style={styles.h2}>{title}</Text>
          {count ? (
            <View style={styles.countPill}>
              <Text style={styles.count}>{count}</Text>
            </View>
          ) : null}
          {right ? <View style={{ marginLeft: 'auto' }}>{right}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function T({ children, muted, small, mono, style, strike }: { children: ReactNode; muted?: boolean; small?: boolean; mono?: boolean; style?: object; strike?: boolean }) {
  // Une police par graisse : un texte en gras prend la variante Inter correspondante.
  const poids = (StyleSheet.flatten(style) as { fontWeight?: string } | undefined)?.fontWeight;
  const gras = poids === 'bold' || Number(poids) >= 600;
  return (
    <Text
      style={[
        { color: muted ? C.muted : C.ink, fontSize: small ? 13 : 15, lineHeight: small ? 18 : 22, fontFamily: gras ? F.texteF : F.texte },
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
    <View style={[styles.chip, { backgroundColor: alpha(MODE_COLORS[mode], 0.12) }]}>
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
      aria-checked={checked}
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
        disabled && styles.btnOff,
      ]}>
      <Text style={[styles.btnText, kind !== 'primary' && { color: kind === 'danger' ? C.agressif : C.accent }, disabled && { color: C.muted }]}>{label}</Text>
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
/** État vide : un encart discret avec un pictogramme, plutôt qu'une phrase perdue dans le panneau. */
export function Empty({ children, icone = 'vide' }: { children: ReactNode; icone?: IconeNom }) {
  return (
    <View style={styles.vide}>
      <View style={styles.videIcone}>
        <Icone nom={icone} color={C.accent} size={18} />
      </View>
      <Text style={[styles.empty, { flex: 1 }]}>{children}</Text>
    </View>
  );
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
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: S.md, marginTop: S.sm },
  retour: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.sunk, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  eyebrow: { color: C.muted, fontFamily: F.texteM, fontSize: 13, marginBottom: 2 },
  h1: { color: C.ink, fontSize: 30, fontFamily: F.titre, letterSpacing: -0.6 },
  h2: { color: C.ink, fontSize: 16, fontFamily: F.titreM, letterSpacing: -0.1, flex: 1 },
  count: { color: C.muted, fontFamily: F.texteF, fontSize: 12, fontVariant: ['tabular-nums'] },
  countPill: { backgroundColor: C.sunk, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  panel: { backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: R, padding: S.lg, gap: S.md, shadowColor: '#000', shadowOpacity: C.sombre ? 0.18 : 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontFamily: F.texteF },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, opacity: 0.85 },
  tagText: { fontSize: 11, fontFamily: F.texteM },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  checkOn: { backgroundColor: C.accent, borderColor: C.accent },
  btn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  btnSec: { backgroundColor: C.accentSoft, borderWidth: 0 },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  btnOff: { backgroundColor: C.sunk },
  btnText: { color: C.accentInk, fontFamily: F.texteF, fontSize: 15, letterSpacing: 0.2 },
  label: { color: C.muted, fontSize: 13, fontFamily: F.texteM },
  input: { backgroundColor: C.sunk, borderColor: C.line, borderWidth: 1, borderRadius: 12, color: C.ink, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: F.texte },
  seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  segItem: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: 'transparent' },
  segText: { color: C.muted, fontSize: 13, fontFamily: F.texteM },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: S.md, paddingVertical: 10 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  empty: { color: C.muted, fontSize: 14, lineHeight: 20, fontFamily: F.texte },
  vide: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderRadius: 12, backgroundColor: C.sunk },
  videIcone: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { paddingHorizontal: 4, paddingVertical: 2 },
});

// Recalculées quand le thème change : les composants lisent toujours la version courante.
export let styles = creer();
surTheme(() => {
  styles = creer();
});
