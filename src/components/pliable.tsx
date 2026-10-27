import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { limiter } from '@/lib/vue-courte';
import { alpha, C, F } from '@/lib/theme';

import { styles, tap } from './ui';

/**
 * Une section qu'on déplie d'un geste : le titre et le nombre d'éléments restent visibles, le contenu seulement si on l'ouvre.
 * `panneau` : une carte à part (comme un Panel) ; sinon, un simple titre de groupe dans une carte.
 */
export function Pliable({ titre, count, ouvert = false, panneau, couleur, alerte, children }: { titre: string; count?: number | string; ouvert?: boolean; panneau?: boolean; /** Couleur du titre et du nombre. */ couleur?: string; /** Le groupe demande de l'attention (retard) : nombre en rouge. */ alerte?: boolean; children: ReactNode }) {
  const [o, setO] = useState(ouvert);
  const teinte = alerte ? C.agressif : (couleur ?? C.ink);
  const tete = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: o }}
      accessibilityLabel={`${titre}${count !== undefined ? `, ${count}` : ''}. ${o ? 'Replier' : 'Déplier'}`}
      onPress={() => {
        tap();
        setO(!o);
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, opacity: pressed ? 0.7 : 1 })}>
      <Text accessibilityElementsHidden style={{ width: 14, color: C.muted, fontSize: 13 }}>
        {o ? '▾' : '▸'}
      </Text>
      <Text style={{ flexShrink: 1, color: teinte, fontFamily: panneau ? F.titreM : F.texteF, fontSize: panneau ? 17 : 14 }}>{titre}</Text>
      {count !== undefined && count !== '' ? (
        <View style={{ minWidth: 22, height: 20, paddingHorizontal: 7, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(alerte ? C.agressif : (couleur ?? C.accent), 0.16) }}>
          <Text style={{ color: alerte ? C.agressif : (couleur ?? C.accent), fontFamily: F.texteF, fontSize: 12 }}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
  if (panneau)
    return (
      <View style={styles.panel}>
        {tete}
        {o ? <View style={{ gap: 10 }}>{children}</View> : null}
      </View>
    );
  return (
    <View style={{ gap: 4 }}>
      {tete}
      {o ? <View style={{ gap: 8 }}>{children}</View> : null}
    </View>
  );
}

/** Les premiers éléments d'une liste, puis « Voir les N autres » ; un second appui replie. */
export function Limitee<T>({ items, n = 8, rendu, nom = 'autres' }: { items: T[]; n?: number; rendu: (x: T, i: number) => ReactNode; nom?: string }) {
  const [tout, setTout] = useState(false);
  const { vues, reste } = limiter(items, n, tout);
  return (
    <>
      {vues.map(rendu)}
      {reste > 0 || (tout && items.length > n + 1) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tout ? 'Replier la liste' : `Voir les ${reste} ${nom}`}
          onPress={() => {
            tap();
            setTout(!tout);
          }}
          style={({ pressed }) => ({ minHeight: 40, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 13 }}>{tout ? 'Réduire' : `Voir les ${reste} ${nom}`}</Text>
        </Pressable>
      ) : null}
    </>
  );
}

/** Une pastille de chiffre cliquable ou non, pour les résumés du haut de page. */
export function Pastille({ valeur, label, couleur, alerte }: { valeur: number | string; label: string; couleur?: string; alerte?: boolean }) {
  const c = alerte ? C.agressif : (couleur ?? C.ink);
  return (
    <View accessible accessibilityLabel={`${label} : ${valeur}`} style={{ flexGrow: 1, flexBasis: 90, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: alerte ? alpha(C.agressif, 0.5) : C.line, backgroundColor: alerte ? alpha(C.agressif, C.sombre ? 0.14 : 0.08) : C.sunk }}>
      <Text style={{ color: c, fontFamily: F.titreM, fontSize: 20, letterSpacing: -0.4 }}>{valeur}</Text>
      <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}
