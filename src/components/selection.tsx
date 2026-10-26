import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { LARGEUR_DIALOGUE, useBarreOnglets, useZonesSures } from '@/lib/mise-en-page';
import { alpha, C, F } from '@/lib/theme';

/**
 * Sélection multiple dans une liste : un appui long (ou « Sélectionner ») passe en mode sélection,
 * chaque ligne devient une case à cocher, et une barre d'actions en bas agit sur tout ce qui est coché.
 */
export function useSelection() {
  const [ids, setIds] = useState<Set<string> | null>(null);
  return {
    actif: ids !== null,
    n: ids?.size ?? 0,
    liste: () => [...(ids ?? [])],
    a: (id: string) => !!ids?.has(id),
    demarrer: (id?: string) => setIds(new Set(id ? [id] : [])),
    fermer: () => setIds(null),
    basculer: (id: string) =>
      setIds((s) => {
        const n = new Set(s ?? []);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    /** Tout cocher, ou tout décocher si tout l'est déjà. */
    tout: (l: string[]) => setIds((s) => (s && l.length && l.every((x) => s.has(x)) ? new Set() : new Set(l))),
  };
}
export type Selection = ReturnType<typeof useSelection>;

export function BoutonSelection({ sel }: { sel: Selection }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => (sel.actif ? sel.fermer() : sel.demarrer())} style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: sel.actif ? C.accent : C.line, backgroundColor: sel.actif ? alpha(C.accent, 0.12) : 'transparent', opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: sel.actif ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 13 }}>{sel.actif ? 'Terminé' : 'Sélectionner'}</Text>
    </Pressable>
  );
}

/** Une ligne de liste : normale hors sélection (appui long pour commencer), case à cocher en mode sélection. */
export function Selectionnable({ sel, id, label, children }: { sel: Selection; id: string; label: string; children: ReactNode }) {
  if (!sel.actif)
    return (
      <Pressable onLongPress={() => sel.demarrer(id)} delayLongPress={450}>
        {children}
      </Pressable>
    );
  const on = sel.a(id);
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={on}
      accessibilityLabel={label}
      onPress={() => sel.basculer(id)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, marginHorizontal: -8, paddingHorizontal: 8, backgroundColor: on ? alpha(C.accent, 0.08) : 'transparent' }}>
      <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: on ? C.accent : C.muted, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Text style={{ color: C.accentInk, fontSize: 13, fontFamily: F.texteF, lineHeight: 15 }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }} pointerEvents="none">
        {children}
        {/* Sur le web, les boutons de la ligne prenaient encore l'appui : ce calque le rend à la case à cocher. */}
        <View pointerEvents="auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      </View>
    </Pressable>
  );
}

/** Une action groupée ; avec `choix`, elle ouvre une liste (un budget, une catégorie…) au lieu d'agir tout de suite. */
export type ActionLot = { label: string; onPress: (ids: string[]) => void; danger?: boolean; choix?: { label: string; onPress: (ids: string[]) => void }[] };

function BoutonLot({ a, ids, onFait, ouvrir }: { a: ActionLot; ids: string[]; onFait: () => void; ouvrir: (a: ActionLot) => void }) {
  // Une action destructrice demande un second appui pour confirmer.
  const [confirmer, setConfirmer] = useState(false);
  useEffect(() => {
    if (!confirmer) return;
    const t = setTimeout(() => setConfirmer(false), 3500);
    return () => clearTimeout(t);
  }, [confirmer]);
  const off = !ids.length;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={off}
      onPress={() => {
        if (a.choix) return ouvrir(a);
        if (a.danger && !confirmer) return setConfirmer(true);
        a.onPress(ids);
        onFait();
      }}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 12,
        backgroundColor: a.danger ? (confirmer ? C.agressif : alpha(C.agressif, 0.12)) : alpha(C.accent, 0.14),
        opacity: off ? 0.4 : pressed ? 0.75 : 1,
      })}>
      <Text style={{ color: a.danger ? (confirmer ? C.bg : C.agressif) : C.accent, fontFamily: F.texteF, fontSize: 13 }}>{confirmer ? `Confirmer (${ids.length})` : a.choix ? `${a.label} ›` : a.label}</Text>
    </Pressable>
  );
}

/** Barre flottante des actions groupées, au-dessus de la barre d'onglets (ou du bas de l'écran hors onglets). */
export function BarreSelection({ sel, tous, actions, onglets = true }: { sel: Selection; tous: string[]; actions: ActionLot[]; onglets?: boolean }) {
  const barre = useBarreOnglets();
  const { bas } = useZonesSures();
  const [menu, setMenu] = useState<ActionLot | null>(null);
  if (!sel.actif) return null;
  const ids = sel.liste().filter((x) => tous.includes(x));
  const toutCoche = !!tous.length && ids.length === tous.length;
  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: barre.bureau ? 24 : onglets ? barre.haut + 10 : Math.max(bas, 12) + 8,
        alignItems: 'center',
        zIndex: 20,
      }}>
      <View style={{ width: '100%', maxWidth: LARGEUR_DIALOGUE, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 12, gap: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>
            {ids.length ? `${ids.length} sélectionné${ids.length > 1 ? 's' : ''}` : 'Touche les lignes à sélectionner'}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => sel.tout(tous)} hitSlop={8}>
            <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>{toutCoche ? 'Tout décocher' : 'Tout sélectionner'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Quitter la sélection" onPress={sel.fermer} hitSlop={8} style={{ paddingHorizontal: 4 }}>
            <Text style={{ color: C.muted, fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
        {menu?.choix ? (
          <View style={{ gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Retour aux actions (${menu.label})`} onPress={() => setMenu(null)} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
              <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>‹ {menu.label}</Text>
            </Pressable>
            <ScrollView style={{ maxHeight: 156 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {menu.choix.map((c) => (
                <BoutonLot
                  key={c.label}
                  a={c}
                  ids={ids}
                  ouvrir={setMenu}
                  onFait={() => {
                    setMenu(null);
                    sel.fermer();
                  }}
                />
              ))}
            </ScrollView>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {actions.map((a) => (
              <BoutonLot key={a.label} a={a} ids={ids} onFait={sel.fermer} ouvrir={setMenu} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
