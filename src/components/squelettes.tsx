import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, View, type DimensionValue, type ViewStyle } from 'react-native';

import { alpha, C, S } from '@/lib/theme';

import { Panel, Screen } from './ui';

/**
 * Squelettes de chargement : la forme de ce qui va s'afficher, en gris qui pulse, à la place d'un cercle qui tourne.
 * Chaque écran a le sien (liste de tâches, courbes de finances, comptes, import…), construit avec les mêmes briques :
 * `Bloc` (un rectangle), `Texte` (des lignes), `Rang` (une ligne de liste), `Tuiles`, `Barres`, `Onglets`.
 * Tout pulse ensemble ; figé si l'appareil demande de réduire les animations.
 */

/** Zone qui pulse : tous les blocs qu'elle contient partagent la même animation. */
export function ZoneSquelette({ children, label = 'Chargement en cours', style }: { children: ReactNode; label?: string; style?: ViewStyle }) {
  const [o] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let boucle: Animated.CompositeAnimation | null = null;
    let fini = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((fige) => {
        if (fini || fige) return;
        boucle = Animated.loop(
          Animated.sequence([
            Animated.timing(o, { toValue: 0.45, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(o, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        );
        boucle.start();
      })
      .catch(() => {});
    return () => {
      fini = true;
      boucle?.stop();
    };
  }, [o]);
  return (
    <Animated.View accessibilityRole="progressbar" accessibilityLabel={label} aria-busy accessibilityLiveRegion="polite" style={[{ gap: S.lg, opacity: o }, style]}>
      {children}
    </Animated.View>
  );
}

/** Un rectangle gris aux bords arrondis. */
export function Bloc({ l = '100%', h = 12, r = 6, style }: { l?: DimensionValue; h?: number; r?: number; style?: ViewStyle }) {
  return <View style={[{ width: l, height: h, borderRadius: r, backgroundColor: alpha(C.muted, 0.22) }, style]} />;
}

/** Des lignes de texte ; la dernière est plus courte, comme à la fin d'un paragraphe. */
export function Texte({ lignes = 2, h = 11 }: { lignes?: number; h?: number }) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: lignes }, (_, i) => (
        <Bloc key={i} h={h} l={i === lignes - 1 && lignes > 1 ? '62%' : '100%'} />
      ))}
    </View>
  );
}

/** Titre d'écran : une ligne d'introduction et le titre. */
export function EnTete({ retour }: { retour?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.md, marginTop: S.sm }}>
      {retour ? <Bloc l={38} h={38} r={19} /> : null}
      <View style={{ gap: 8, flex: 1 }}>
        <Bloc l={90} h={11} />
        <Bloc l="55%" h={26} r={8} />
      </View>
    </View>
  );
}

/** Une ligne de liste : pastille ou case à cocher, deux lignes de texte, un détail à droite. */
export function Rang({ pastille = 'rond', droite = true, lignes = 2 }: { pastille?: 'rond' | 'carre' | 'aucune'; droite?: boolean; lignes?: 1 | 2 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
      {pastille === 'rond' ? <Bloc l={26} h={26} r={13} /> : pastille === 'carre' ? <Bloc l={34} h={34} r={10} /> : null}
      <View style={{ flex: 1, gap: 7 }}>
        <Bloc l="68%" h={13} />
        {lignes === 2 ? <Bloc l="42%" h={10} /> : null}
      </View>
      {droite ? <Bloc l={54} h={13} /> : null}
    </View>
  );
}

/** `n` lignes de liste, sans panneau : pour un endroit déjà posé dans un panneau. */
export function LignesSquelette({ n = 3, pastille = 'rond', droite = true }: { n?: number; pastille?: 'rond' | 'carre' | 'aucune'; droite?: boolean }) {
  return (
    <View>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: alpha(C.muted, 0.12) } : undefined}>
          <Rang pastille={pastille} droite={droite} />
        </View>
      ))}
    </View>
  );
}

/** Un panneau avec son titre et `n` lignes de liste. */
export function PanneauListe({ n = 4, titre = true, pastille = 'rond', droite = true, lignes = 2 }: { n?: number; titre?: boolean; pastille?: 'rond' | 'carre' | 'aucune'; droite?: boolean; lignes?: 1 | 2 }) {
  return (
    <Panel>
      {titre ? <Bloc l="34%" h={16} r={6} /> : null}
      <View>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: alpha(C.muted, 0.12) } : undefined}>
            <Rang pastille={pastille} droite={droite} lignes={lignes} />
          </View>
        ))}
      </View>
    </Panel>
  );
}

/** Des chiffres clés côte à côte. */
export function Tuiles({ n = 3 }: { n?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ flex: 1, gap: 8, padding: 10, borderRadius: 12, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
          <Bloc l="50%" h={10} />
          <Bloc l="80%" h={18} r={6} />
          <Bloc l="65%" h={9} />
        </View>
      ))}
    </View>
  );
}

const HAUTEURS = [0.45, 0.7, 0.5, 0.85, 0.6, 0.95, 0.55, 0.75, 0.4, 0.65, 0.8, 0.5];
/** Un graphique en barres ; les hauteurs sont fixes pour que rien ne bouge d'un rendu à l'autre. */
export function Barres({ n = 8, hauteur = 110 }: { n?: number; hauteur?: number }) {
  return (
    <View style={{ gap: 8 }}>
      <Bloc l="48%" h={12} />
      <View style={{ height: hauteur, flexDirection: 'row', alignItems: 'flex-end', gap: 6, borderBottomWidth: 1, borderBottomColor: C.line }}>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={{ flex: 1, height: HAUTEURS[i % HAUTEURS.length] * hauteur, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: alpha(C.muted, 0.22) }} />
        ))}
      </View>
    </View>
  );
}

/** Une rangée de puces ou d'onglets. */
export function Onglets({ n = 4 }: { n?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {Array.from({ length: n }, (_, i) => (
        <Bloc key={i} l={[74, 92, 70, 84, 66][i % 5]} h={32} r={999} />
      ))}
    </View>
  );
}

/** Une barre horizontale avec son libellé (répartition par budget). */
function Parts({ n = 4 }: { n?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Bloc l="34%" h={12} />
            <Bloc l="20%" h={12} />
          </View>
          <Bloc h={6} r={3} l={`${100 - i * 17}%`} />
        </View>
      ))}
    </View>
  );
}

// ——— Un squelette par écran ———

export function SqueletteAccueil() {
  return (
    <>
      <EnTete />
      <Panel>
        <Bloc l="40%" h={16} />
        <Texte lignes={3} h={12} />
        <Bloc l={150} h={42} r={14} />
      </Panel>
      <PanneauListe n={3} />
      <PanneauListe n={3} pastille="carre" />
    </>
  );
}

export function SqueletteTaches() {
  return (
    <>
      <EnTete />
      <Onglets n={3} />
      <PanneauListe n={5} lignes={2} />
    </>
  );
}

/** Liste de projets : une carte par projet, avec sa jauge d'avancement. */
export function SqueletteProjets() {
  return (
    <>
      <EnTete />
      {Array.from({ length: 3 }, (_, i) => (
        <Panel key={i}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Bloc l={40} h={40} r={12} />
            <View style={{ flex: 1, gap: 7 }}>
              <Bloc l="55%" h={15} />
              <Bloc l="35%" h={10} />
            </View>
          </View>
          <Bloc l="100%" h={8} r={4} />
          <Bloc l="70%" h={10} />
        </Panel>
      ))}
    </>
  );
}

export function SqueletteRelances() {
  return (
    <>
      <EnTete />
      <PanneauListe n={4} pastille="carre" />
      <PanneauListe n={2} pastille="carre" />
    </>
  );
}

export function SqueletteHabitudes() {
  return (
    <>
      <EnTete />
      <Panel>
        <Bloc l="36%" h={16} />
        {Array.from({ length: 4 }, (_, i) => (
          <View key={i} style={{ gap: 8, paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Bloc l={26} h={26} r={13} />
              <Bloc l="50%" h={13} />
            </View>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {Array.from({ length: 10 }, (_, k) => (
                <Bloc key={k} l={16} h={16} r={4} />
              ))}
            </View>
          </View>
        ))}
      </Panel>
    </>
  );
}

export function SqueletteFinances() {
  return (
    <>
      <EnTete retour />
      <Onglets n={5} />
      <Panel>
        <Bloc l="40%" h={16} />
        <Tuiles n={3} />
        <Parts n={3} />
      </Panel>
      <Panel>
        <Barres n={8} />
      </Panel>
    </>
  );
}

/** Contenu de l'onglet Opérations : totaux, filtres et lignes. */
export function SqueletteOperations() {
  return (
    <Panel>
      <Bloc l="32%" h={16} />
      <Tuiles n={3} />
      <Onglets n={4} />
      <Bloc h={44} r={12} />
      <View>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: alpha(C.muted, 0.12) } : undefined}>
            <Rang pastille="aucune" />
          </View>
        ))}
      </View>
    </Panel>
  );
}

/** Vue « Graphiques » des opérations. */
export function SqueletteGraphiques() {
  return (
    <View style={{ gap: S.lg }}>
      <Barres n={12} hauteur={130} />
      <Bloc h={110} r={10} />
      <Parts n={4} />
    </View>
  );
}

/** Vue « Conseils » des opérations. */
export function SqueletteConseils() {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: 3 }, (_, i) => (
        <View key={i} style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line, borderLeftWidth: 3 }}>
          <Bloc l={70} h={10} />
          <Bloc l="72%" h={15} />
          <Texte lignes={2} />
          <Bloc l={130} h={32} r={12} />
        </View>
      ))}
    </View>
  );
}

/** Cartes de comptes bancaires. */
export function SqueletteComptes({ n = 2 }: { n?: number }) {
  return (
    <View style={{ gap: S.md }}>
      {Array.from({ length: n }, (_, i) => (
        <Panel key={i}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Bloc l={40} h={40} r={12} />
            <View style={{ flex: 1, gap: 7 }}>
              <Bloc l="50%" h={15} />
              <Bloc l="32%" h={10} />
            </View>
            <Bloc l={80} h={18} r={6} />
          </View>
          <Tuiles n={3} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Bloc l={140} h={38} r={12} />
            <Bloc l={110} h={38} r={12} />
          </View>
        </Panel>
      ))}
    </View>
  );
}

/** Aperçu d'un relevé en cours de lecture : cases à cocher, libellés, montants. */
export function SqueletteImport() {
  return (
    <ZoneSquelette label="Lecture du relevé en cours">
      <Bloc l="60%" h={12} />
      <View>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={i ? { borderTopWidth: 1, borderTopColor: alpha(C.muted, 0.12) } : undefined}>
            <Rang pastille="carre" />
          </View>
        ))}
      </View>
    </ZoneSquelette>
  );
}

export function SqueletteStatistiques() {
  return (
    <>
      <EnTete retour />
      <Tuiles n={2} />
      <Panel>
        <Barres n={10} />
      </Panel>
      <Panel>
        <Parts n={4} />
      </Panel>
    </>
  );
}

/** Les notifications du jour : une barre de couleur, un titre, un texte, une heure. */
export function PanneauNotifications() {
  return (
    <Panel>
      <Bloc l="26%" h={16} />
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
          <Bloc l={4} h={52} r={2} />
          <View style={{ flex: 1, gap: 8 }}>
            <Bloc l="60%" h={13} />
            <Bloc l="90%" h={10} />
            <Bloc l={46} h={9} />
          </View>
        </View>
      ))}
    </Panel>
  );
}

export function SqueletteNotifications() {
  return (
    <>
      <EnTete retour />
      <PanneauNotifications />
    </>
  );
}

/** Fournisseurs de comptes connectés (Google, Microsoft, Trello, Slack). */
export function SqueletteSources() {
  return <PanneauListe n={4} pastille="carre" droite />;
}

/** Liste des comptes utilisateurs (admin). */
export function SqueletteMembres() {
  return <PanneauListe n={3} pastille="rond" />;
}

/** Réponse de l'assistant en cours d'écriture. */
export function SqueletteReponse() {
  return (
    <ZoneSquelette label="L’assistant réfléchit">
      <Texte lignes={4} h={12} />
    </ZoneSquelette>
  );
}

export function SqueletteGenerique() {
  return (
    <>
      <EnTete />
      <PanneauListe n={3} />
      <PanneauListe n={3} />
    </>
  );
}

/** Le squelette qui correspond à l'adresse de l'écran : affiché pendant que l'espace de l'utilisateur se charge. */
export function SqueletteVue({ chemin }: { chemin?: string | null }) {
  const c = (chemin || '/').replace(/\/+$/, '') || '/';
  const contenu =
    c === '/' ? <SqueletteAccueil /> : c === '/taches' ? <SqueletteTaches /> : c === '/projets' ? <SqueletteProjets /> : c === '/relances' ? <SqueletteRelances /> : c === '/habitudes' ? <SqueletteHabitudes /> : c === '/finances' ? <SqueletteFinances /> : c === '/statistiques' ? <SqueletteStatistiques /> : c === '/notifications' ? <SqueletteNotifications /> : <SqueletteGenerique />;
  return (
    <Screen scroll={false}>
      <ZoneSquelette label="Chargement de ton espace">{contenu}</ZoneSquelette>
    </Screen>
  );
}

/**
 * Affiche d'abord `repli`, puis `children` une fois le squelette peint : pour un calcul long (des centaines d'opérations),
 * l'écran montre sa forme tout de suite au lieu de se figer. Sans `actif`, les enfants s'affichent directement.
 */
export function Differe({ actif = true, repli, children }: { actif?: boolean; repli: ReactNode; children: ReactNode }) {
  const [pret, setPret] = useState(!actif);
  useEffect(() => {
    if (!actif) return;
    const t = setTimeout(() => setPret(true), 30);
    return () => clearTimeout(t);
  }, [actif]);
  return <>{pret ? children : <ZoneSquelette>{repli}</ZoneSquelette>}</>;
}
