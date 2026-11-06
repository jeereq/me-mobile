import type { ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { teinte, vive } from '@/lib/teinte';
import { C, F, ombreAvant } from '@/lib/theme';

import { Text } from './texte';

/** Le conteneur de toutes les vues sans compte : 10/12 de l'écran. */
export const LARGEUR_PUBLIQUE = '83.333%';
export const SEUIL_PUBLIC = 860;

export const SECTIONS = [
  { key: 'cotisations', label: 'Cotisations' },
  // `menu: false` : dans le pied de page seulement, le menu du haut reste court.
  { key: 'finances', label: 'Finances', menu: false },
  { key: 'rubriques', label: 'Fonctionnalités' },
  { key: 'mails', label: 'Mails', menu: false },
  { key: 'apercu', label: 'Aperçu', menu: false },
  { key: 'donnees', label: 'Tes données', menu: false },
  { key: 'tarifs', label: 'Tarifs' },
  { key: 'questions', label: 'Questions', menu: false },
] as const;
export type Section = (typeof SECTIONS)[number]['key'];

export const Bloc = ({ children, style }: { children: ReactNode; large?: boolean; style?: object }) => (
  <View style={[{ width: LARGEUR_PUBLIQUE, alignSelf: 'center' }, style]}>{children}</View>
);

export function Logo({ taille = 36 }: { taille?: number }) {
  const t = teinte(vive('indigo'));
  return (
    <View style={{ width: taille, height: taille, borderRadius: taille * 0.3, backgroundColor: t.c, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.encre, fontSize: taille * 0.44, fontFamily: F.titre, letterSpacing: -0.5 }}>Me</Text>
    </View>
  );
}

/** Bouton de la page : plein (indigo), en surface, ou sans fond. */
export function Bouton({ label, onPress, kind = 'plein', grand, compact, accessibilityLabel }: { label: string; onPress: () => void; kind?: 'plein' | 'surface' | 'texte'; grand?: boolean; compact?: boolean; accessibilityLabel?: string }) {
  const t = teinte(vive('indigo'));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: grand ? 52 : compact ? 40 : 44,
        paddingHorizontal: grand ? 24 : compact ? 12 : 18,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: kind === 'plein' ? t.c : kind === 'surface' ? C.surface : 'transparent',
        ...(kind === 'plein' && !compact ? ombreAvant(t.c) : null),
        borderWidth: kind === 'surface' ? 1 : 0,
        borderColor: C.line,
        opacity: pressed ? 0.85 : 1,
      })}>
      <Text style={{ color: kind === 'plein' ? t.encre : C.ink, fontFamily: F.texteF, fontSize: grand ? 16 : compact ? 14 : 15, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

/**
 * La barre du haut des pages publiques : l'accueil et la page Contact. Sans `onSection`, elle se réduit au logo :
 * quelqu'un de connecté qui écrit un message n'a pas besoin du menu de présentation.
 */
export function EntetePublic({ actif, annuaireActif, surHauteur, onLogo, logoLabel = 'Me, haut de la page', onSection, onAnnuaire, onConnexion, onInscription, droite }: {
  actif?: Section | null;
  annuaireActif?: boolean;
  surHauteur?: (h: number) => void;
  onLogo: () => void;
  logoLabel?: string;
  onSection?: (s: Section) => void;
  onAnnuaire?: () => void;
  onConnexion?: () => void;
  onInscription?: () => void;
  droite?: ReactNode;
}) {
  const largeur = useWindowDimensions().width;
  const large = largeur >= SEUIL_PUBLIC;
  const lien = (cle: string, label: string, on: boolean, press: () => void) => (
    <Pressable key={cle} accessibilityRole="link" accessibilityState={{ selected: on }} onPress={press} hitSlop={8}>
      {(e) => (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: on || (e as { hovered?: boolean }).hovered ? C.ink : C.muted, fontFamily: F.texteM, fontSize: 15 }}>{label}</Text>
          <View style={{ position: 'absolute', bottom: -7, width: 4, height: 4, borderRadius: 2, backgroundColor: on ? vive('indigo') : 'transparent' }} />
        </View>
      )}
    </Pressable>
  );
  return (
    <View onLayout={surHauteur ? (e) => surHauteur(e.nativeEvent.layout.height) : undefined} style={{ backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <Bloc large={large} style={{ paddingVertical: large ? 16 : 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: large ? 16 : 8 }}>
        <Pressable accessibilityRole="link" accessibilityLabel={logoLabel} onPress={onLogo} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Logo taille={large ? 36 : 32} />
        </Pressable>
        {large && onSection ? (
          <View accessibilityRole="menu" style={{ flexDirection: 'row', gap: largeur >= 1100 ? 28 : 16 }}>
            {SECTIONS.filter((x) => !('menu' in x)).map((x) => lien(x.key, x.label, x.key === actif, () => onSection(x.key)))}
            {onAnnuaire ? lien('annuaire', 'Annuaire', !!annuaireActif, onAnnuaire) : null}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: large ? 8 : 4 }}>
          {droite}
          {onConnexion && onInscription ? (
            largeur >= 1100 ? (
              <>
                <Bouton kind="texte" label="Se connecter" onPress={onConnexion} />
                <Bouton label="Créer mon compte" onPress={onInscription} />
              </>
            ) : (
              <>
                <Bouton compact kind="texte" label="Connexion" accessibilityLabel="Se connecter" onPress={onConnexion} />
                <Bouton compact label="Commencer" accessibilityLabel="Créer mon compte" onPress={onInscription} />
              </>
            )
          ) : null}
        </View>
      </Bloc>
    </View>
  );
}
