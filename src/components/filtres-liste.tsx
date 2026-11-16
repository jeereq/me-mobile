import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/texte';

import { filtresPoses, type GroupeFiltre } from '@/lib/filtres-liste';
import { alpha, C, F } from '@/lib/theme';

import { Filtre } from './onglets';
import { Btn, Dialogue, Input, T } from './ui';

export type { GroupeFiltre, OptionFiltre } from '@/lib/filtres-liste';

/**
 * Une liste longue se filtre sans se faire enterrer : une ligne (recherche + « Filtres »), les critères dans une fenêtre,
 * et seules les étiquettes des filtres posés restent sous la ligne, chacune retirable d'un geste.
 */
export function FiltresListe({ recherche, onRecherche, placeholder, groupes, compte, extra }: { recherche?: string; onRecherche?: (v: string) => void; placeholder?: string; groupes: GroupeFiltre[]; /** « 7 dépenses sur 23 », quand un filtre est posé. */ compte?: string; /** D'autres réglages, au bas de la fenêtre. */ extra?: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const poses = filtresPoses(groupes);
  const utiles = groupes.filter((g) => g.options.length > 1);
  const effacer = () => poses.forEach((p) => p.groupe.onChange(p.groupe.defaut));
  if (!utiles.length && !onRecherche) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {onRecherche ? (
          <View style={{ flexGrow: 1, flexBasis: 110, maxWidth: 420 }}>
            <Input value={recherche ?? ''} onChangeText={onRecherche} placeholder={placeholder} accessibilityLabel={placeholder} returnKeyType="search" />
          </View>
        ) : null}
        {utiles.length ? <Btn small kind="sec" label={poses.length ? `Filtres · ${poses.length}` : 'Filtres'} onPress={() => setOuvert(true)} /> : null}
      </View>
      {poses.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: 'center', gap: 6 }}>
          {poses.map((p) => (
            <Pressable key={p.groupe.cle} accessibilityRole="button" accessibilityLabel={`Retirer le filtre ${p.label}`} onPress={() => p.groupe.onChange(p.groupe.defaut)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.accent, backgroundColor: alpha(C.accent, 0.14), opacity: pressed ? 0.7 : 1 })}>
              <Text numberOfLines={1} style={{ color: C.accent, fontFamily: F.texteF, fontSize: 13, maxWidth: 160 }}>{p.label}</Text>
              <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 12 }}>✕</Text>
            </Pressable>
          ))}
          {poses.length > 1 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Effacer les filtres" onPress={effacer} style={{ paddingHorizontal: 6, paddingVertical: 6 }}>
              <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Effacer</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}
      {compte && poses.length ? <T small muted>{compte}</T> : null}
      {ouvert ? (
        <Dialogue
          titre="Filtres"
          onFermer={() => setOuvert(false)}
          pied={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {poses.length ? <Btn kind="sec" label="Tout effacer" onPress={effacer} /> : null}
              <Btn label={compte ?? 'Voir'} onPress={() => setOuvert(false)} />
            </View>
          }>
          {utiles.map((g) => (
            <View key={g.cle} style={{ gap: 6 }}>
              <T small muted>{g.titre}</T>
              <Filtre label={g.titre} options={g.options} value={g.valeur} onChange={g.onChange} />
            </View>
          ))}
          {extra}
        </Dialogue>
      ) : null}
    </View>
  );
}
