import { type Href, router } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Icone } from '@/components/icones';
import { Text } from '@/components/texte';
import { Btn, T } from '@/components/ui';
import { useBarreOnglets } from '@/lib/mise-en-page';
import { page, pagesMasquees } from '@/lib/navigation';
import { useStore } from '@/lib/store';
import { teinteDe } from '@/lib/teinte';
import { alpha, C, F, ombre } from '@/lib/theme';
import { ETAPES_VISITE, useEtapeVisite, visite } from '@/lib/visite';

/**
 * La visite guidée : une carte posée au-dessus de la barre d'onglets (téléphone) ou en bas à droite (ordinateur). Chaque
 * étape ouvre sa page, qui se voit derrière la carte et s'allume dans la barre. La première explique comment on se
 * déplace ; « Passer » ou « Terminer » la clôt pour de bon (elle se relance depuis Mon compte).
 */
export function VisiteGuidee() {
  const n = useEtapeVisite();
  const { espace, update } = useStore();
  const { bureau, haut } = useBarreOnglets();
  const masquees = pagesMasquees(espace);
  const etapes = ETAPES_VISITE.filter((e) => !masquees.has(e.cle));
  const courante = n === null ? null : n === 0 ? null : etapes[n - 1];
  const total = etapes.length + 1;

  useEffect(() => {
    if (n === null) return;
    const href = (n === 0 ? '/' : (etapes[n - 1] ? page(etapes[n - 1].cle).href : '/')) as Href;
    try {
      router.navigate(href);
    } catch {
      // Hors navigation (aperçu) : la carte suffit.
    }
    // `etapes` suit `n` : on ne navigue qu'au changement d'étape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  if (n === null) return null;
  const finir = () => {
    visite.arreter();
    update((e) => ({ ...e, visite: { ...e.visite, faite: true } }));
    if (n > 0)
      try {
        router.navigate('/');
      } catch {
        // Hors navigation.
      }
  };
  const derniere = n >= total - 1;
  const p = courante ? page(courante.cle) : null;
  const t = p ? teinteDe(p.chemin) : C.accent;
  const titre = p ? p.titre : 'Visite rapide';
  const texte = courante
    ? courante.texte
    : bureau
      ? `La barre à gauche mène partout. ${Platform.OS === 'web' ? 'Ctrl+K' : 'La recherche'} ouvre une page, une tâche ou un contact.`
      : 'Les onglets en bas mènent aux pages principales, « Plus » à tout le reste. Une minute pour faire le tour.';

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40, justifyContent: 'flex-end', alignItems: bureau ? 'flex-end' : 'stretch', padding: bureau ? 24 : 12, paddingBottom: bureau ? 24 : haut + 10 }}>
      <View accessibilityRole="alert" accessibilityLabel={`Visite, étape ${n + 1} sur ${total} : ${titre}. ${texte}`} style={{ width: bureau ? 380 : undefined, gap: 12, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: alpha(t, 0.55), backgroundColor: C.surface, ...ombre() }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= n ? t : C.line }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(t, 0.16) }}>
            <Icone nom={p ? p.icone : 'eclair'} color={t} size={20} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{`${n + 1} sur ${total}`}</Text>
            <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>{titre}</Text>
          </View>
        </View>
        <T>{texte}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {derniere ? (
            <View style={{ flex: 1 }} />
          ) : (
            <Pressable accessibilityRole="button" onPress={finir} hitSlop={8} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>Passer</Text>
            </Pressable>
          )}
          {n > 0 ? <Btn small kind="sec" couleur={t} label="Retour" onPress={() => visite.aller(n - 1)} /> : null}
          <Btn small couleur={t} label={derniere ? 'Terminer' : n === 0 ? 'Commencer' : 'Suivant'} onPress={derniere ? finir : () => visite.aller(n + 1)} />
        </View>
      </View>
    </View>
  );
}
