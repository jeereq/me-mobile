import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ajouterCategorie, basculer, categoriesDe, categoriesDeItem, EMOJIS_CATEGORIE, PALETTE_CATEGORIES, verifierNom } from '@/lib/categories';
import { uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Categorie } from '@/lib/types';

import { Btn, Input, T } from './ui';

/** Une catégorie sous forme de pastille, à sa couleur ; cochée quand elle est posée sur l'élément. */
export function PuceCategorie({ c, on, onPress }: { c: Categorie; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      accessibilityLabel={c.nom}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? c.couleur : C.line, backgroundColor: on ? alpha(c.couleur, 0.18) : 'transparent', opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.couleur }} />
      <Text style={{ color: on ? C.ink : C.muted, fontFamily: F.texteM, fontSize: 13 }}>
        {c.emoji} {c.nom}
      </Text>
    </Pressable>
  );
}

/** Les catégories d'un élément, en petites étiquettes (rien s'il n'en a pas). */
export function EtiquettesCategories({ ids }: { ids?: string[] }) {
  const { espace } = useStore();
  const l = categoriesDeItem({ categories: ids }, categoriesDe(espace));
  if (!l.length) return null;
  return (
    <>
      {l.map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: alpha(c.couleur, 0.16) }}>
          <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 11 }}>
            {c.emoji} {c.nom}
          </Text>
        </View>
      ))}
    </>
  );
}

/**
 * Choix d'une ou plusieurs catégories pour un élément, avec création d'une nouvelle catégorie sur place.
 * `value` est la liste d'identifiants posée sur l'élément ; `onChange` reçoit la nouvelle liste (undefined si vide).
 */
export function ChoixCategories({ value, onChange, label = 'Catégories' }: { value?: string[]; onChange: (ids: string[] | undefined) => void; label?: string }) {
  const { espace, update } = useStore();
  const cats = categoriesDe(espace);
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS_CATEGORIE[0]);
  const erreur = nom.trim() ? verifierNom(cats, nom) : '';

  const creer = () => {
    if (!nom.trim() || erreur) return;
    const c: Categorie = { id: uid(), nom: nom.trim(), emoji, couleur: PALETTE_CATEGORIES[cats.length % PALETTE_CATEGORIES.length] };
    update((e) => ajouterCategorie(e, c));
    onChange([...(value ?? []), c.id]);
    setNom('');
    setCreation(false);
  };

  return (
    <View style={{ gap: 6 }}>
      <T small muted>
        {label}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {cats.map((c) => (
          <PuceCategorie key={c.id} c={c} on={!!value?.includes(c.id)} onPress={() => onChange(basculer(value, c.id))} />
        ))}
        <Pressable accessibilityRole="button" onPress={() => setCreation(!creation)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed' }}>
          <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>{creation ? 'Annuler' : '+ Nouvelle catégorie'}</Text>
        </Pressable>
      </View>
      {!cats.length && !creation ? <T small muted>Tu n’as pas encore de catégorie : crée la première, ou ajoute les courantes depuis Plus › Catégories.</T> : null}
      {creation ? (
        <View style={{ gap: 8 }}>
          <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Ex. Famille, Voyage, Client Dupont" returnKeyType="done" onSubmitEditing={creer} autoFocus />
          {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {EMOJIS_CATEGORIE.map((x) => (
              <Pressable key={x} accessibilityRole="radio" aria-checked={x === emoji} accessibilityLabel={`Icône ${x}`} onPress={() => setEmoji(x)} style={{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: x === emoji ? C.accent : C.line, backgroundColor: x === emoji ? alpha(C.accent, 0.14) : 'transparent' }}>
                <Text style={{ fontSize: 17 }}>{x}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Btn small label="Créer et choisir" onPress={creer} disabled={!nom.trim() || !!erreur} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
