import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type TextInputProps, type ViewStyle } from 'react-native';
import { router } from 'expo-router';

import { Icone, type IconeNom } from '@/components/icones';
import { alpha, C, COULEURS, encre, F, MODE_COLORS, MONO, R, S, surTheme } from '@/lib/theme';
import { LARGEUR_DIALOGUE, LARGEUR_LARGE, LARGEUR_PAGE, SEUIL_COLONNES, useBarreOnglets, useZonesSures } from '@/lib/mise-en-page';
import { useTeinte } from '@/lib/teinte';
import { useThemeCle } from '@/lib/theme-cle';
import { MODE_LABELS, type Mode } from '@/lib/types';

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

export function Screen({ children, scroll = true, pied }: { children: ReactNode; scroll?: boolean; /** Élément flottant hors défilement (barre d'actions groupées). */ pied?: ReactNode }) {
  // Nouvelle clé = contenu redessiné avec les couleurs du thème choisi.
  const cle = useThemeCle();
  const { reserve } = useBarreOnglets();
  const { haut } = useZonesSures();
  return (
    <View key={cle} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1, paddingTop: haut }}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.scroll, styles.colonne, { paddingBottom: reserve + (pied ? 140 : 0) }]} keyboardShouldPersistTaps="handled">
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

/** Deux colonnes sur un écran d'ordinateur, une seule pile sur téléphone. */
export function Colonnes({ gauche, droite }: { gauche: ReactNode; droite: ReactNode }) {
  const large = useWindowDimensions().width >= SEUIL_COLONNES;
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

/**
 * Des cartes de même nature côte à côte quand la place le permet : une colonne sur téléphone, plusieurs ensuite.
 * Le nombre de colonnes vient de la place réellement disponible (`min` par carte), pas d'un seuil de largeur
 * d'écran : la grille se comporte donc pareil dans une page pleine largeur et dans une colonne.
 */
export function Grille({ children, min = 300 }: { children: ReactNode; /** Largeur souhaitée d'une carte ; en dessous, la grille passe à moins de colonnes. */ min?: number }) {
  const liste = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  if (liste.length < 2) return <>{liste}</>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.lg }}>
      {liste.map((c, i) => (
        <View key={i} style={{ flexGrow: 1, flexBasis: min, minWidth: 0, maxWidth: '100%' }}>
          {c}
        </View>
      ))}
    </View>
  );
}

/** Titre d'écran. `retour` ajoute le bouton de retour des écrans ouverts depuis Plus ; `onRetour` remplace son action (revenir à une liste dans le même écran). */
/**
 * Barre qui reste visible en haut de l'écran pendant qu'on fait défiler (onglets, filtres) : sur le web, la position
 * « collante » du navigateur ; ailleurs, un bloc ordinaire. Le fond est opaque pour que le contenu passe dessous.
 */
export function Collant({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View
      style={[
        // Les marges négatives mangent l'écart de la pile : le fond couvre toute la bande quand la barre est collée.
        { backgroundColor: C.bg, zIndex: 2, marginTop: -S.sm, paddingTop: S.sm, marginBottom: -S.xs, paddingBottom: S.xs, gap: S.sm },
        { position: 'sticky', top: 0 } as object,
      ]}>
      {children}
    </View>
  );
}

export function Header({ eyebrow, title, right, retour, onRetour }: { eyebrow?: string; title: string; right?: ReactNode; retour?: boolean; onRetour?: () => void }) {
  return (
    <View style={styles.header}>
      {retour ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          onPress={() => (onRetour ? onRetour() : router.canGoBack() ? router.back() : router.replace('/plus'))}
          style={({ pressed }) => [styles.retour, pressed && { opacity: 0.7 }]}>
          <Icone nom="retour" color={C.ink} size={18} />
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
  const t = useTeinte();
  return (
    <View style={[styles.panel, accent && { borderColor: t.ligne, backgroundColor: C.sombre ? alpha(t.c, 0.05) : C.surface }, style]}>
      {title ? (
        <View style={styles.panelHead}>
          <View style={[styles.puce, { backgroundColor: t.c }]} />
          <Text style={styles.h2}>{title}</Text>
          {count ? (
            <View style={[styles.countPill, { backgroundColor: t.douce }]}>
              <Text style={[styles.count, { color: t.c }]}>{count}</Text>
            </View>
          ) : null}
          {right ? <View style={{ marginLeft: 'auto' }}>{right}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Un formulaire (ou un détail) dans une fenêtre par-dessus la page : le contenu de la page ne saute plus quand on ouvre
 * « + Dépense » ou qu'on modifie un budget, et le formulaire a toute la place.
 * Sur téléphone la fenêtre monte du bas, sur grand écran elle se place au centre. Pour fermer : la croix, la zone
 * sombre, Échap sur le web ou le bouton retour d'Android.
 */
export function Dialogue({ titre, count, onFermer, children, large }: { titre?: string; count?: number | string; onFermer: () => void; children: ReactNode; /** Fenêtre plus large (listes, import). */ large?: boolean }) {
  // Nouvelle clé = contenu redessiné avec les couleurs du thème choisi (la fenêtre est hors de l'arbre de l'écran).
  const cle = useThemeCle();
  const { width, height } = useWindowDimensions();
  const { haut, bas } = useZonesSures();
  // Assez de place pour une fenêtre centrée ? Sinon, une feuille qui monte du bas, comme sur téléphone.
  const centre = width >= 700;
  const t = useTeinte();

  // Sur le web, Échap ferme la fenêtre (le navigateur ne déclenche pas `onRequestClose`).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [onFermer]);

  return (
    <Modal visible transparent statusBarTranslucent animationType={centre ? 'fade' : 'slide'} onRequestClose={onFermer}>
      <View key={cle} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: centre ? 'center' : 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', maxWidth: large ? LARGEUR_PAGE : LARGEUR_DIALOGUE, alignSelf: 'center', paddingHorizontal: centre ? S.lg : 0 }}>
          <View style={[styles.dialogue, centre ? { borderRadius: 20, maxHeight: height * 0.88 } : { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderBottomWidth: 0, maxHeight: height - haut - S.lg }]}>
            <View style={styles.dialogueHead}>
              <Text accessibilityRole="header" numberOfLines={2} style={styles.h2}>
                {titre}
              </Text>
              {count ? (
                <View style={[styles.countPill, { backgroundColor: t.douce }]}>
                  <Text style={[styles.count, { color: t.c }]}>{count}</Text>
                </View>
              ) : null}
              <IconBtn label="Fermer" glyph="✕" onPress={onFermer} />
            </View>
            <ScrollView contentContainerStyle={{ padding: S.lg, paddingTop: S.md, paddingBottom: S.lg + (centre ? 0 : bas), gap: S.md }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  // Léger rebond quand on coche, avec une vibration de réussite.
  const [echelle] = useState(() => new Animated.Value(1));
  const rebond = () =>
    Animated.sequence([
      Animated.timing(echelle, { toValue: 1.15, duration: 80, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(echelle, { toValue: 1, friction: 5, tension: 160, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  return (
    <Animated.View style={{ transform: [{ scale: echelle }] }}>
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => {
        if (!checked) {
          rebond();
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        } else tap();
        onToggle();
      }}
      style={[styles.check, checked && styles.checkOn]}>
      {checked ? <Text style={{ color: encre(C.coach), fontWeight: '800', fontSize: 14 }}>✓</Text> : null}
    </Pressable>
    </Animated.View>
  );
}

export function Btn({ label, onPress, kind = 'primary', disabled, small }: { label: string; onPress: () => void; kind?: 'primary' | 'sec' | 'danger'; disabled?: boolean; small?: boolean }) {
  // Les boutons prennent la couleur de la rubrique : indigo sur l'accueil, ambre sur les tâches, etc.
  const t = useTeinte();
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
        { backgroundColor: t.c },
        small && { paddingVertical: 7, paddingHorizontal: 12 },
        kind === 'sec' && [styles.btnSec, { backgroundColor: t.douce }],
        kind === 'danger' && styles.btnDanger,
        pressed && !disabled && { transform: [{ scale: 0.97 }], opacity: 0.9 },
        disabled && styles.btnOff,
      ]}>
      <Text style={[styles.btnText, { color: t.encre }, kind !== 'primary' && { color: kind === 'danger' ? C.agressif : t.c }, disabled && { color: C.muted }]}>{label}</Text>
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string; /** Message sous le champ, en rouge : ce qui ne va pas dans ce qui est tapé. */ erreur?: string; /** Aide sous le champ, en gris. */ aide?: string; /** Bouton posé dans le champ, à droite (voir le mot de passe). */ droite?: ReactNode }) {
  const { label, style, erreur, aide, droite, ...rest } = props;
  return (
    <View style={{ gap: 6, flexGrow: 1 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={{ justifyContent: 'center' }}>
        <TextInput placeholderTextColor={C.muted} selectionColor={C.accent} style={[styles.input, erreur ? { borderColor: C.agressif } : null, droite ? { paddingRight: 92 } : null, style]} {...rest} />
        {droite ? <View style={{ position: 'absolute', right: 8 }}>{droite}</View> : null}
      </View>
      {erreur || aide ? <Text style={{ color: erreur ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 12 }}>{erreur || aide}</Text> : null}
    </View>
  );
}

/** Sélecteur à pastilles : remplace les listes déroulantes, plus simple au pouce. */
export function Seg<K extends string>({ options, value, onChange, label, colors }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; label?: string; colors?: Partial<Record<K, string>> }) {
  const t = useTeinte();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.seg}>
        {options.map((o) => {
          const on = o.key === value;
          const col = colors?.[o.key] || t.c;
          return (
            <Pressable
              key={o.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                onChange(o.key);
              }}
              style={({ pressed }) => [styles.segItem, on && { borderColor: col, backgroundColor: alpha(col, C.sombre ? 0.16 : 0.1) }, pressed && { opacity: 0.8 }]}>
              <Text style={[styles.segText, on && { color: col, fontFamily: F.texteF }]}>{o.label}</Text>
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
export function Empty({ children, icone = 'vide' }: { children: ReactNode; icone?: IconeNom }) {
  const t = useTeinte();
  return (
    <View style={styles.vide}>
      <View style={[styles.videIcone, { backgroundColor: t.douce }]}>
        <Icone nom={icone} color={t.c} size={18} />
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
  // Toutes les pages ont la même largeur : celle des projets, qui laisse la place au planning et aux tableaux.
  colonne: { width: '100%', maxWidth: LARGEUR_LARGE, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: S.md, marginTop: S.sm },
  retour: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  eyebrow: { color: C.muted, fontFamily: F.texte, fontSize: 14, marginBottom: 4 },
  h1: { color: C.ink, fontSize: 28, fontFamily: F.titreM, letterSpacing: -0.6 },
  h2: { color: C.ink, fontSize: 16, fontFamily: F.titreM, letterSpacing: -0.1, flex: 1 },
  count: { color: C.muted, fontFamily: F.texteF, fontSize: 12, fontVariant: ['tabular-nums'] },
  countPill: { backgroundColor: C.sunk, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  puce: { width: 8, height: 8, borderRadius: 4 },
  panel: { backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: R, padding: S.lg, gap: S.md, shadowColor: '#000', shadowOpacity: C.sombre ? 0.18 : 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  dialogue: { backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: C.sombre ? 0.4 : 0.18, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 20 },
  // Le titre reste visible : seule la partie basse défile.
  dialogueHead: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingLeft: S.lg, paddingRight: S.sm, paddingTop: S.lg, paddingBottom: S.sm, borderBottomWidth: 1, borderBottomColor: C.line },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 12, fontFamily: F.texteF },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, opacity: 0.85 },
  tagText: { fontSize: 11, fontFamily: F.texteM },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  checkOn: { backgroundColor: C.coach, borderColor: C.coach },
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
  vide: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderRadius: 14, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line },
  videIcone: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { paddingHorizontal: 4, paddingVertical: 2 },
});

// Recalculées quand le thème change : les composants lisent toujours la version courante.
export let styles = creer();
surTheme(() => {
  styles = creer();
});
