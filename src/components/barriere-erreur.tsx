import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/texte';
import { tokenStore } from '@/lib/api';
import { C, F } from '@/lib/theme';
import { estFichierPerime, rechargerUneFois } from '@/lib/version-web';

type Props = { children: ReactNode };
type Etat = { erreur: string | null };

/** Sans elle, une erreur d'affichage laisse une page vide : on dit ce qui se passe et on donne une sortie. */
export class BarriereErreur extends Component<Props, Etat> {
  state: Etat = { erreur: null };

  static getDerivedStateFromError(e: unknown): Etat {
    return { erreur: e instanceof Error ? e.message : String(e) };
  }

  componentDidCatch(e: unknown, info: ErrorInfo) {
    // Une nouvelle version est en ligne et cet onglet cherche un fichier de l'ancienne : on recharge une fois, sans rien demander.
    if (Platform.OS === 'web' && estFichierPerime(e instanceof Error ? e.message : String(e)) && rechargerUneFois()) return;
    console.error('Me : affichage impossible', e, info.componentStack);
    // Dans le navigateur, l'écran de démarrage de public/index.html recouvrirait ce message.
    (globalThis as { __fermerSplash?: () => void }).__fermerSplash?.();
  }

  relancer = () => {
    if (Platform.OS === 'web') window.location.reload();
    else this.setState({ erreur: null });
  };

  // La session reste sur l'appareil : une donnée qui fait planter l'écran le ferait à chaque ouverture.
  deconnecter = async () => {
    await Promise.resolve(tokenStore.clear()).catch(() => {});
    this.relancer();
  };

  render() {
    const { erreur } = this.state;
    if (erreur === null) return this.props.children;
    const perime = estFichierPerime(erreur);
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, backgroundColor: C.bg }}>
        <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 20, textAlign: 'center' }}>{perime ? 'Une nouvelle version de Me est en ligne' : "Me n'a pas pu s'afficher"}</Text>
        <Text selectable style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, textAlign: 'center', maxWidth: 420 }}>
          {perime ? 'Recharge pour la prendre.' : erreur}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            onPress={this.relancer}
            style={{ minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12, backgroundColor: C.accent }}
          >
            <Text style={{ color: C.accentInk, fontFamily: F.titreM, fontSize: 15 }}>Recharger</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={this.deconnecter}
            style={{ minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: C.muted }}
          >
            <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 15 }}>Se déconnecter</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}
