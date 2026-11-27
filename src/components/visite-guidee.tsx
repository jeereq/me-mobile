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
import { aide } from '@/lib/guide-aide';
import { etapesVisite, useEtapeVisite, visite } from '@/lib/visite';

/**
 * La visite guidée : une carte posée au-dessus de la barre d'onglets (téléphone) ou en bas à droite (ordinateur). Chaque
 * page a plusieurs points (ce qu'on y voit, ce qu'on y fait) ; la page reste visible derrière la carte et s'allume dans
 * la barre. La première étape explique comment on se déplace ; « Page suivante » saute au reste de la page, « Passer » ou
 * « Terminer » clôt la visite pour de bon (elle se relance depuis Mon compte, ou page par page depuis l'aide).
 */
export function VisiteGuidee() {
  const n = useEtapeVisite();
  const { espace, update } = useStore();
  const { bureau, haut } = useBarreOnglets();
  const masquees = pagesMasquees(espace);
  const etapes = etapesVisite(masquees);
  const courante = n === null ? null : n === 0 ? null : etapes[n - 1];
  const total = etapes.length + 1;
  const pages = [...new Set(etapes.map((e) => e.cle))];
  const rangPage = courante ? pages.indexOf(courante.cle) : -1;
  // La première étape suivante qui change de page ; sans elle, la visite est finie.
  const pageSuivante = courante ? etapes.findIndex((e, k) => k > n! - 1 && e.cle !== courante.cle) : -1;

  // Lancée depuis l'aide d'une page : on commence à cette page.
  useEffect(() => {
    if (n !== 0) return;
    const d = visite.departDemande();
    const k = d ? etapes.findIndex((e) => e.cle === d) : -1;
    if (k >= 0) visite.aller(k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  useEffect(() => {
    if (n === null) return;
    const href = (n === 0 ? '/' : (etapes[n - 1] ? page(etapes[n - 1].cle).href : '/')) as Href;
    try {
      router.navigate(href);
    } catch {
      // Hors navigation (aperçu) : la carte suffit.
    }
    // On ne navigue qu'au changement de page : les points d'une même page se lisent sans la recharger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n === null ? null : n === 0 ? '/' : courante?.cle]);

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
          {/* Un segment par page ; celui de la page en cours se remplit point après point. */}
          {Array.from({ length: pages.length + 1 }, (_, k) => {
            const fait = k <= rangPage + 1 ? 1 : 0;
            const part = courante && k === rangPage + 1 ? (courante.i + 1) / courante.n : fait;
            return (
              <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: C.line, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(part * 100)}%`, height: '100%', backgroundColor: t }} />
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(t, 0.16) }}>
            <Icone nom={p ? p.icone : 'eclair'} color={t} size={20} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{courante ? `Page ${rangPage + 1} sur ${pages.length} · point ${courante.i + 1} sur ${courante.n}` : 'Pour commencer'}</Text>
            <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>{titre}</Text>
          </View>
        </View>
        <T>{texte}</T>
        {courante ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => aide.ouvrir(courante.cle)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: t, fontFamily: F.texteM, fontSize: 13 }}>Toutes les actions de cette page ›</Text>
            </Pressable>
            {pageSuivante >= 0 && courante.i < courante.n - 1 ? (
              <Pressable accessibilityRole="button" onPress={() => visite.aller(pageSuivante + 1)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Page suivante</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {derniere ? (
            <View style={{ flex: 1 }} />
          ) : (
            <Pressable accessibilityRole="button" onPress={finir} hitSlop={8} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 15 }}>Passer</Text>
            </Pressable>
          )}
          {n > 0 ? <Btn small kind="sec" couleur={t} label="Retour" onPress={() => visite.aller(n - 1)} /> : null}
          <Btn small couleur={t} label={derniere ? 'Terminer' : n === 0 ? 'Commencer' : 'Suivant'} onPress={derniere ? finir : () => visite.aller(n + 1)} />
        </View>
      </View>
    </View>
  );
}
