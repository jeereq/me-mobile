import { router } from 'expo-router';
import { SqueletteInvitation } from '@/components/squelettes';
import { LARGEUR_PUBLIQUE } from '@/components/entete-public';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Erreur, GrandTitre } from '@/components/cotisations-ui';
import { Illustration } from '@/components/illustrations';
import { ReserveFinances } from '@/components/reserve-pro';
import { ChampTelephone, useTelephone } from '@/components/telephone';
import { Conditions, RecapGroupe } from '@/components/tontines';
import { Btn, T } from '@/components/ui';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';
import { Tontines, type CarteGroupe } from '@/lib/tontines';

/** Le lien d'invitation à un groupe privé (/g/<code>). Sans compte, on voit le groupe avant de se connecter. */
export function PageInvitation({ code, onConnexion, onInscription }: { code: string; onConnexion?: () => void; onInscription?: () => void }) {
  const { finances, session } = useStore();
  const [g, setG] = useState<CarteGroupe | null>(null);
  const [erreur, setErreur] = useState('');
  const [accepte, setAccepte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const tel = useTelephone();

  useEffect(() => {
    let fini = false;
    Tontines.invitation(code)
      .then((x) => {
        if (!fini) setG(x);
      })
      .catch((e: Error) => {
        if (!fini) setErreur(e.message);
      });
    return () => {
      fini = true;
    };
  }, [code]);

  const rejoindre = async () => {
    setEnvoi(true);
    setErreur('');
    try {
      await Tontines.rejoindre(code, tel.complet);
      router.replace('/finances?onglet=cotisations');
    } catch (e) {
      setErreur((e as Error).message);
      setEnvoi(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 16 }}>
      <View style={{ width: LARGEUR_PUBLIQUE, maxWidth: 420, gap: 14, padding: 20, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
        {!g ? (
          erreur ? <Erreur texte={erreur} /> : <SqueletteInvitation />
        ) : (
          <>
            <View style={{ alignItems: 'center' }}>
              <Illustration nom={g.mode === 'objectif' ? 'raison' : 'invitation'} largeur={180} />
            </View>
            <View style={{ gap: 2 }}>
              <T small muted>
                {g.organisateur ? `${g.organisateur} t’invite` : 'Invitation'}
              </T>
              <GrandTitre>{g.nom}</GrandTitre>
            </View>
            <RecapGroupe g={g} />
            <T small muted>
              L’initiateur répond de ce groupe.
            </T>
            {erreur ? <Erreur texte={erreur} /> : null}
            {session && !finances ? <ReserveFinances fonction="cotisations" /> : null}
            {session && finances ? (
              <>
                <ChampTelephone tel={tel} label="Ton numéro mobile money" />
                <Conditions on={accepte} onChange={setAccepte} />
                <Btn label="Rejoindre" disabled={!tel.valide || !accepte || envoi} onPress={rejoindre} />
              </>
            ) : null}
            {!session ? (
              <>
                <Btn label="Créer un compte" onPress={() => onInscription?.()} />
                <Btn kind="sec" label="Me connecter" onPress={() => onConnexion?.()} />
              </>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}
