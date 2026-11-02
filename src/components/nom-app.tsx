import { useState } from 'react';
import { View } from 'react-native';

import { Btn, Input, Panel, T } from '@/components/ui';
import { parler } from '@/lib/assistant';
import { erreurNomApp, nettoyerNomApp, NOM_APP_DEFAUT, NOM_APP_MAX } from '@/lib/commun/nom-app';
import { useStore } from '@/lib/store';

/**
 * Le nom de l'app, dans Mon compte › Préférences : « Jarvis », « Alfred »… à la place de « Me ». Il s'affiche dans la barre
 * et la commande vocale, l'IA se présente sous ce nom, la voix le dit, et les mots-clés proposés le reprennent (« Hey Jarvis »).
 */
export function PanneauNomApp() {
  const { nomApp, renommerApp, espace } = useStore();
  const [saisie, setSaisie] = useState(nomApp === NOM_APP_DEFAUT ? '' : nomApp);
  const [vu, setVu] = useState(nomApp);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (nomApp !== vu) {
    setVu(nomApp);
    setSaisie(nomApp === NOM_APP_DEFAUT ? '' : nomApp);
  }
  const propre = nettoyerNomApp(saisie);
  const erreur = erreurNomApp(saisie);
  const change = (propre || NOM_APP_DEFAUT) !== nomApp;

  const enregistrer = async (nom: string) => {
    setEnvoi(true);
    setMessage(null);
    try {
      await renommerApp(nom);
      setMessage(nom ? `L’app s’appelle maintenant ${nom}.` : 'L’app s’appelle de nouveau Me.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Le nom n’a pas pu être enregistré. Réessaie.');
    } finally {
      setEnvoi(false);
    }
  };
  // L'essai se fait avec le nom tapé, même pas encore enregistré, et la voix choisie plus bas.
  const essayer = () => parler(`Bonjour, je suis ${propre || NOM_APP_DEFAUT}. Dis « Hey ${propre || NOM_APP_DEFAUT} » pour me parler.`, espace.audio);

  return (
    <Panel title="Nom de l’app">
      <T small muted>
        Donne à ton assistant le nom que tu veux. Il s’affiche dans la barre et la commande vocale, l’IA se présente sous ce nom, la voix le dit, et le mot-clé vocal le reconnaît (« Hey {nomApp} »). Il suit ton compte sur tous tes appareils.
      </T>
      <Input
        label="Nom"
        value={saisie}
        onChangeText={(t) => {
          setSaisie(t);
          setMessage(null);
        }}
        onSubmitEditing={() => !erreur && change && enregistrer(propre)}
        placeholder={NOM_APP_DEFAUT}
        maxLength={NOM_APP_MAX + 6}
        autoCorrect={false}
        erreur={propre && erreur ? erreur : undefined}
        aide="Deux ou trois syllabes se reconnaissent mieux."
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn small label={envoi ? 'Enregistrement…' : 'Enregistrer'} onPress={() => enregistrer(propre)} disabled={envoi || !!erreur || !change} />
        <Btn small kind="sec" label="Écouter" onPress={essayer} disabled={!!erreur} />
        {nomApp !== NOM_APP_DEFAUT ? <Btn small kind="sec" label="Revenir à Me" onPress={() => enregistrer('')} disabled={envoi} /> : null}
      </View>
      {message ? <T small muted>{message}</T> : null}
      <T small muted>
        L’icône du téléphone garde le nom « Me ».
      </T>
    </Panel>
  );
}
