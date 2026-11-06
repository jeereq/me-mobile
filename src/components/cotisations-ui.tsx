import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icone } from '@/components/icones';
import { Text } from '@/components/texte';
import { C, F } from '@/lib/theme';

/** Le haut d'un écran de détail : retour, titre, et une action facultative. */
export function EnteteDetail({ titre, sousTitre, onRetour, droite }: { titre: string; sousTitre?: string; onRetour: () => void; droite?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={onRetour} style={({ pressed }) => ({ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
        <Icone nom="retour" color={C.ink} size={22} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text accessibilityRole="header" numberOfLines={2} style={{ color: C.ink, fontFamily: F.titreM, fontSize: 19 }}>
          {titre}
        </Text>
        {sousTitre ? (
          <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
            {sousTitre}
          </Text>
        ) : null}
      </View>
      {droite}
    </View>
  );
}

/** Le cadre de ce qui compte maintenant : une phrase, sa progression et une seule action. */
export function Cadre({ children }: { children: ReactNode }) {
  return <View style={{ gap: 12, padding: 16, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>{children}</View>;
}

export function GrandTitre({ children, couleur }: { children: ReactNode; couleur?: string }) {
  return <Text style={{ color: couleur ?? C.ink, fontFamily: F.titreM, fontSize: 22, lineHeight: 28 }}>{children}</Text>;
}

/** Une liste sobre : un seul cadre, des lignes séparées par un trait. */
export function Liste({ titre, children }: { titre?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      {titre ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13, paddingHorizontal: 4 }}>{titre}</Text> : null}
      <View style={{ borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

/** Une ligne de liste, assez haute pour le pouce. Sans `onPress`, elle n'est pas cliquable. */
export function Ligne({ titre, sous, sousCouleur, gauche, droite, onPress, label, premiere, accent }: {
  titre: string;
  sous?: string;
  sousCouleur?: string;
  gauche?: ReactNode;
  droite?: ReactNode;
  onPress?: () => void;
  label?: string;
  premiere?: boolean;
  accent?: boolean;
}) {
  const contenu = (
    <>
      {gauche}
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: accent ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 15 }}>
          {titre}
        </Text>
        {sous ? (
          <Text numberOfLines={2} style={{ color: sousCouleur ?? C.muted, fontFamily: F.texte, fontSize: 13 }}>
            {sous}
          </Text>
        ) : null}
      </View>
      {droite}
      {onPress ? <Text style={{ color: C.muted, fontSize: 18 }}>›</Text> : null}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: premiere ? 0 : 1, borderTopColor: C.line };
  if (!onPress) return <View style={style}>{contenu}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label ?? titre} onPress={onPress} style={({ pressed }) => [style, pressed ? { backgroundColor: C.sunk } : null]}>
      {contenu}
    </Pressable>
  );
}

/** Plusieurs choix possibles parmi des pastilles, assez hautes pour le pouce. */
export function Pastilles<K extends string | number>({ options, valeurs, onChange }: { options: { key: K; label: string }[]; valeurs: K[]; onChange: (v: K[]) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = valeurs.includes(o.key);
        return (
          <Pressable
            key={String(o.key)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(on ? valeurs.filter((v) => v !== o.key) : [...valeurs, o.key])}
            style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? C.sunk : 'transparent' }}>
            <Text style={{ color: on ? C.accent : C.muted, fontFamily: F.texteM, fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Le rang dans l'ordre de réception. */
export function Rang({ n, actif }: { n: number; actif?: boolean }) {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: actif ? C.accent : C.sunk }}>
      <Text style={{ color: actif ? C.bg : C.muted, fontFamily: F.texteM, fontSize: 12 }}>{n}</Text>
    </View>
  );
}

/** Un état court à droite d'une ligne. */
export function Etat({ texte, couleur }: { texte: string; couleur: string }) {
  return <Text style={{ color: couleur, fontFamily: F.texteM, fontSize: 13 }}>{texte}</Text>;
}

/** Un geste discret en bas d'écran, à l'écart des actions courantes. */
export function ActionDiscrete({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: danger ? C.agressif : C.muted, fontFamily: F.texteM, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Libellé à gauche, valeur à droite. */
export function Recap({ lignes }: { lignes: [string, string][] }) {
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: 14, backgroundColor: C.sunk }}>
      {lignes.map(([l, v]) => (
        <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14 }}>{l}</Text>
          <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

export const Erreur = ({ texte }: { texte: string }) => <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{texte}</Text>;
