import { useState, type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { forceMotDePasse, refusMotDePasse, MDP_MIN } from '@/lib/commun/mot-de-passe';
import { C, F } from '@/lib/theme';

import { Text } from './texte';
import { Input } from './ui';

type Compte = { email?: string; nom?: string; telephone?: string };

/** Un champ de mot de passe qu'on peut afficher le temps de vérifier ce qu'on a tapé. */
export function ChampMotDePasse(props: Omit<ComponentProps<typeof Input>, 'secureTextEntry' | 'droite'>) {
  const [voir, setVoir] = useState(false);
  return (
    <Input
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      secureTextEntry={!voir}
      droite={
        <Pressable accessibilityRole="button" accessibilityLabel={voir ? 'Masquer le mot de passe' : 'Voir le mot de passe'} hitSlop={6} onPress={() => setVoir(!voir)} style={({ pressed }) => ({ paddingHorizontal: 6, paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>{voir ? 'Masquer' : 'Voir'}</Text>
        </Pressable>
      }
    />
  );
}

/** Trois barres, et ce qui ne va pas s'il y a quelque chose à changer. */
export function Force({ mdp, compte }: { mdp: string; compte?: Compte }) {
  const refus = refusMotDePasse(mdp, compte);
  const niveau = forceMotDePasse(mdp, compte);
  const couleur = [C.line, C.hebdo, C.hebdo, C.coach][niveau];
  const mot = refus ?? ['', 'Ça peut être plus solide', 'Correct', 'Solide'][niveau];
  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= niveau ? couleur : C.line }} />
        ))}
      </View>
      <Text style={{ color: niveau ? couleur : mdp.length >= MDP_MIN ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 12 }}>{mot}</Text>
    </View>
  );
}
