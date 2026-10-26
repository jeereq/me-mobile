import { Text, useWindowDimensions, View } from 'react-native';

import { LARGEUR_PAGE, SEUIL_COLONNES } from '@/lib/mise-en-page';
import { alpha, C, F } from '@/lib/theme';

import { LiensLegaux } from './liens-legaux';
import { Btn, Screen } from './ui';

const ATOUTS = [
  { emoji: '📨', titre: 'Relances', texte: 'Ne laisse plus un message sans réponse : l\'app te rappelle qui relancer et prépare le brouillon.' },
  { emoji: '✅', titre: 'Tâches', texte: 'Une phrase suffit : « Envoyer la facture demain, urgent ». Date et priorité sont comprises.' },
  { emoji: '🔥', titre: 'Habitudes', texte: 'Séries, jokers et badges : chaque action te rapporte des points, sans te mettre la pression.' },
  { emoji: '💶', titre: 'Finances multi-devises', texte: 'Budgets, revenus, paiements récurrents et prévisions, dans la devise de ton choix (€, $, FCFA, CAD…).' },
  { emoji: '🤖', titre: 'Assistant', texte: 'Pose une question sur ta semaine ou tes dépenses, il répond avec tes propres données.' },
  { emoji: '🔄', titre: 'Sur tous tes appareils', texte: 'Téléphone, tablette, ordinateur : tes modifications sont fusionnées, jamais écrasées.' },
];

const ETAPES = ['Crée ton compte en une minute.', 'Dis ce que tu as à faire, en une phrase.', 'Laisse l\'app te rappeler et te féliciter.'];

/** Page d'accueil montrée aux visiteurs non connectés : ce que fait l'app, puis connexion ou inscription. */
export function AccueilPublic({ onConnexion, onInscription }: { onConnexion: () => void; onInscription: () => void }) {
  const large = useWindowDimensions().width >= SEUIL_COLONNES;
  return (
    <Screen>
      <View style={{ gap: 32, paddingTop: 32 }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.accentInk, fontSize: 30, fontFamily: F.titre, letterSpacing: -1 }}>me</Text>
          </View>
          <Text accessibilityRole="header" style={{ color: C.ink, fontSize: 32, fontFamily: F.titre, letterSpacing: -0.5, textAlign: 'center', marginTop: 6 }}>
            Ton assistant personnel
          </Text>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 460 }}>
            Relances, tâches, habitudes et finances au même endroit. Chaque action te rapporte des points.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 8 }}>
            <Btn label="Créer mon compte" onPress={onInscription} />
            <Btn kind="sec" label="J'ai déjà un compte" onPress={onConnexion} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, maxWidth: LARGEUR_PAGE }}>
          {ATOUTS.map((a) => (
            <View
              key={a.titre}
              style={{ flexGrow: 1, flexBasis: large ? '31%' : 260, gap: 6, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
              <Text style={{ fontSize: 24 }}>{a.emoji}</Text>
              <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 16 }}>{a.titre}</Text>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14, lineHeight: 20 }}>{a.texte}</Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 10, padding: 16, borderRadius: 18, backgroundColor: alpha(C.accent, 0.08) }}>
          <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 20 }}>Comment ça marche</Text>
          {ETAPES.map((e, i) => (
            <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ width: 28, height: 28, lineHeight: 28, textAlign: 'center', borderRadius: 14, overflow: 'hidden', color: C.accentInk, backgroundColor: C.accent, fontFamily: F.texteF, fontSize: 14 }}>{i + 1}</Text>
              <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 15 }}>{e}</Text>
            </View>
          ))}
        </View>

        <LiensLegaux centre />
      </View>
    </Screen>
  );
}
