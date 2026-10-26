import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { LARGEUR_DIALOGUE, useZonesSures } from '@/lib/mise-en-page';
import { rechercher, surRecherche } from '@/lib/recherche';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { AjoutRapide } from './ajout-rapide';
import { Icone } from './icones';

type Ligne = { cle: string; groupe: string; titre: string; detail?: string; agir: () => void };

/**
 * Recherche globale : Ctrl+K (⌘+K sur Mac) ou la loupe. Trouve une page, une tâche, une relance, une habitude,
 * une dépense, un contact ou une note du journal, et propose d'ajouter ce qui est tapé.
 */
export function Recherche() {
  const { espace } = useStore();
  const { haut } = useZonesSures();
  const { height } = useWindowDimensions();
  const [ouverte, setOuverte] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [ajout, setAjout] = useState<{ n: number; texte: string } | null>(null);

  const ouvrir = () => {
    setQ('');
    setSel(0);
    setOuverte(true);
  };
  useEffect(() => surRecherche(ouvrir), []);

  const fermer = () => setOuverte(false);
  const aller = (href: Parameters<typeof router.push>[0]) => () => {
    fermer();
    router.push(href);
  };
  const ajouter = (texte: string) => () => {
    fermer();
    setAjout((a) => ({ n: (a?.n ?? 0) + 1, texte }));
  };

  const texte = q.trim();
  const lignes: Ligne[] = [
    { cle: 'ajout', groupe: 'Actions', titre: texte ? `Ajouter « ${texte} »` : 'Ajouter une tâche, une relance, une habitude ou une dépense', detail: texte ? 'Tâche, relance, habitude ou dépense, selon la phrase' : undefined, agir: ajouter(texte) },
    ...rechercher(espace, texte).map((r) => ({ ...r, agir: aller(r.href) })),
  ];
  const choix = Math.min(sel, lignes.length - 1);

  // Ctrl+K partout ; flèches, Entrée et Échap dans la recherche ouverte.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const touche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (ouverte) fermer();
        else ouvrir();
        return;
      }
      if (!ouverte) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => (Math.min(s, lignes.length - 1) + (e.key === 'ArrowDown' ? 1 : lignes.length - 1)) % lignes.length);
      } else if (e.key === 'Enter') {
        // Arrêtée ici, Entrée ne déclenche pas aussi la validation du champ.
        e.preventDefault();
        e.stopPropagation();
        lignes[choix]?.agir();
      } else if (e.key === 'Escape') fermer();
    };
    // En phase de capture : la fenêtre modale ne laisse pas remonter les touches tapées à l'intérieur.
    window.addEventListener('keydown', touche, true);
    return () => window.removeEventListener('keydown', touche, true);
  });

  let groupe = '';
  return (
    <>
      <Modal visible={ouverte} transparent animationType="fade" onRequestClose={fermer}>
        <Pressable accessibilityLabel="Fermer la recherche" onPress={fermer} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', paddingTop: haut + Math.min(80, height * 0.08), paddingHorizontal: 12 }}>
          <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: LARGEUR_DIALOGUE, maxHeight: height * 0.75, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Icone nom="loupe" color={C.muted} />
              <TextInput
                autoFocus
                value={q}
                onChangeText={(v) => {
                  setQ(v);
                  setSel(0);
                }}
                onSubmitEditing={() => lignes[choix]?.agir()}
                placeholder="Rechercher ou ajouter…"
                placeholderTextColor={C.muted}
                selectionColor={C.accent}
                accessibilityLabel="Rechercher"
                returnKeyType="go"
                style={[{ flex: 1, paddingVertical: 16, color: C.ink, fontFamily: F.texte, fontSize: 16 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
              />
              {Platform.OS === 'web' ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>Échap</Text> : null}
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 8 }}>
              {lignes.length === 1 && texte ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14, padding: 12 }}>Rien ne correspond à « {texte} ».</Text> : null}
              {lignes.map((l, i) => {
                const titreGroupe = l.groupe !== groupe ? (groupe = l.groupe) : null;
                return (
                  <View key={l.cle}>
                    {titreGroupe ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 12, paddingTop: i ? 12 : 4, paddingBottom: 4 }}>{titreGroupe}</Text> : null}
                    <Pressable
                      accessibilityRole="button"
                      onPress={l.agir}
                      onHoverIn={() => setSel(i)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: i === choix ? alpha(C.accent, 0.12) : 'transparent' }}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>
                          {l.titre}
                        </Text>
                        {l.detail ? (
                          <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
                            {l.detail}
                          </Text>
                        ) : null}
                      </View>
                      {i === choix && Platform.OS === 'web' ? <Text style={{ color: C.muted, fontSize: 13 }}>↵</Text> : null}
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      {ajout ? <AjoutRapide key={ajout.n} visible texte={ajout.texte} onClose={() => setAjout(null)} /> : null}
    </>
  );
}
