import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { teinte, teinteDe, useTeinte } from '@/lib/teinte';
import { alpha, C, F } from '@/lib/theme';

import { Icone } from './icones';
import { tap } from './ui';

/**
 * L'ajout en une ligne, en haut des tâches et des relances : on écrit (ou on dicte au clavier) une phrase,
 * Me dit ce qu'il a compris (« demain · importante ») et Entrée l'ajoute. « Détails » ouvre la fenêtre
 * d'ajout, préremplie, pour ce qui ne tient pas dans une phrase.
 */
export function AjoutLigne({ placeholder, comprendre, onAjouter, onDetails, rubrique }: { placeholder: string; /** La rubrique dont prendre la couleur (« /relances » affichées dans l'écran Tâches). */ rubrique?: string; /** Ce que la phrase donne, en quelques mots ; null si rien d'ajoutable. */ comprendre: (texte: string) => string | null; onAjouter: (texte: string) => void; onDetails: (texte: string) => void }) {
  const parDefaut = useTeinte();
  const t = rubrique ? teinte(teinteDe(rubrique)) : parDefaut;
  const [texte, setTexte] = useState('');
  const [focus, setFocus] = useState(false);
  const compris = texte.trim() ? comprendre(texte) : null;
  const ajouter = () => {
    if (!compris) return;
    tap();
    onAjouter(texte);
    setTexte('');
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingLeft: 14, paddingRight: 6, borderRadius: 16, borderWidth: 1, borderColor: focus ? t.c : C.line, backgroundColor: C.surface }}>
        <Text accessibilityElementsHidden importantForAccessibility="no" style={{ color: C.muted, fontSize: 20, lineHeight: 22 }}>
          +
        </Text>
        <TextInput
          value={texte}
          onChangeText={setTexte}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onSubmitEditing={ajouter}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={C.muted}
          selectionColor={t.c}
          accessibilityLabel={placeholder}
          style={{ flex: 1, minWidth: 0, color: C.ink, fontFamily: F.texte, fontSize: 15, paddingVertical: 12, outlineStyle: 'none' } as object}
        />
        {texte.trim() ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Ajouter" disabled={!compris} onPress={ajouter} style={({ pressed }) => ({ height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: t.c, alignItems: 'center', justifyContent: 'center', opacity: !compris ? 0.4 : pressed ? 0.85 : 1 })}>
            <Text style={{ color: t.encre, fontFamily: F.texteF, fontSize: 14 }}>Ajouter</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Ajouter avec tous les détails" onPress={() => (tap(), onDetails(''))} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: C.sunk, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Icone nom="crayon" color={C.muted} size={18} />
          </Pressable>
        )}
      </View>
      {texte.trim() ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
          <Text style={{ flex: 1, color: compris ? t.c : C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{compris ? `Compris : ${compris}` : 'Écris au moins un mot'}</Text>
          <Pressable accessibilityRole="button" onPress={() => (tap(), onDetails(texte), setTexte(''))} hitSlop={8}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5, textDecorationLine: 'underline', textDecorationColor: alpha(C.muted, 0.5) }}>Plus de détails</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
