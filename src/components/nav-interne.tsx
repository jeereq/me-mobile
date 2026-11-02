import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/texte';

import { C, F } from '@/lib/theme';
import { useTeinte } from '@/lib/teinte';

import { type IconeNom, Icone } from './icones';
import { Filtre } from './onglets';
import { Collant, tap } from './ui';

export type SectionInterne<K extends string> = { key: K; label: string; icone: IconeNom };

/** En dessous, la barre latérale n'aurait pas la place : les sections passent en haut de l'écran. */
const SEUIL = 760;

/** La section affichée : celle du lien (?section=…) au départ, puis celle choisie ; la première si elle n'existe pas sur ce compte. */
export function useSection<K extends string>(sections: SectionInterne<K>[]) {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [choisie, setChoisie] = useState<K | null>(sections.some((s) => s.key === section) ? (section as K) : null);
  const valeur = sections.some((s) => s.key === choisie) ? (choisie as K) : sections[0].key;
  return [valeur, setChoisie] as const;
}

/** Navigation à l'intérieur d'un écran de réglages : une barre latérale sur grand écran, une ligne de choix sur téléphone. */
export function NavInterne<K extends string>({ label, sections, value, onChange, children }: { label: string; sections: SectionInterne<K>[]; value: K; onChange: (k: K) => void; children: ReactNode }) {
  const large = useWindowDimensions().width >= SEUIL;
  const t = useTeinte();
  if (!large)
    return (
      <>
        <Collant>
          <Filtre label={label} options={sections.map((s) => ({ key: s.key, label: s.label }))} value={value} onChange={onChange} />
        </Collant>
        {children}
      </>
    );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel={label}
        style={[{ width: 208, gap: 2, padding: 8, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }, Platform.OS === 'web' ? ({ position: 'sticky', top: 16 } as object) : null]}
      >
        {sections.map((s) => {
          const on = s.key === value;
          return (
            <Pressable
              key={s.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                tap();
                onChange(s.key);
              }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10, backgroundColor: on ? t.douce : 'transparent', opacity: pressed ? 0.7 : 1 })}
            >
              <Icone nom={s.icone} color={on ? t.c : C.muted} size={18} />
              <Text numberOfLines={1} style={{ flex: 1, color: on ? C.ink : C.muted, fontFamily: on ? F.texteF : F.texteM, fontSize: 14 }}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 16 }}>{children}</View>
    </View>
  );
}
