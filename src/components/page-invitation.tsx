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
import { Tontines, type CarteGroupe, type Remplacement } from '@/lib/tontines';

const dateLongue = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/** Le lien d'invitation à un groupe privé (/g/<code>). Sans compte, on voit le groupe avant de se connecter. */
export function PageInvitation({ code, onConnexion, onInscription }: { code: string; onConnexion?: () => void; onInscription?: () => void }) {
  const { finances, session } = useStore();
  const [g, setG] = useState<CarteGroupe | null>(null);
  const [place, setPlace] = useState<Remplacement | null>(null);
  const [attente, setAttente] = useState(false);
  const [erreur, setErreur] = useState('');
  const [accepte, setAccepte] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const tel = useTelephone();

  useEffect(() => {
    let fini = false;
    Tontines.invitationComplete(code)
      .then((x) => {
        if (fini) return;
        setG(x.groupe);
        setPlace(x.remplacement ?? null);
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
      const r = await Tontines.rejoindreComplet(code, tel.complet);
      // Une place à reprendre attend parfois encore l'accord du membre ou de l'initiateur.
      if (r.remplacement && r.remplacement.etat === 'en_attente') {
        setPlace(r.remplacement);
        setAttente(true);
        setEnvoi(false);
        return;
      }
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
                {place ? `${place.place} te cède sa place` : g.organisateur ? `${g.organisateur} t’invite` : 'Invitation'}
              </T>
              <GrandTitre>{g.nom}</GrandTitre>
            </View>
            <RecapGroupe g={g} />
            {place ? (
              <View style={{ gap: 4, padding: 12, borderRadius: 12, backgroundColor: C.sunk }}>
                {place.tour ? <T>Tu recevras la cagnotte au tour {place.tour.numero}, le {dateLongue(place.tour.echeance)}.</T> : null}
                <T small muted>
                  {place.payees || place.caution
                    ? `Déjà payé par ${place.place} : ${[place.payees ? `${place.payees} cotisation${place.payees > 1 ? 's' : ''}` : '', place.caution ? 'la caution' : ''].filter(Boolean).join(' et ')}. Ça reste sur la place : réglez-le entre vous.`
                    : 'Rien n’est encore payé sur cette place.'}
                </T>
              </View>
            ) : null}
            {attente && place ? (
              <T style={{ color: C.coach }}>
                C’est noté. {place.attenteMembre && place.attenteInitiateur ? `${place.place} et l’initiateur doivent encore accepter.` : place.attenteMembre ? `${place.place} doit encore accepter.` : 'L’initiateur doit encore accepter.'} Tu seras prévenu.
              </T>
            ) : null}
            <T small muted>
              L’initiateur répond de ce groupe.
            </T>
            {erreur ? <Erreur texte={erreur} /> : null}
            {session && !finances ? <ReserveFinances fonction="cotisations" /> : null}
            {session && finances && !attente ? (
              <>
                <ChampTelephone tel={tel} label="Ton numéro mobile money" />
                <Conditions on={accepte} onChange={setAccepte} />
                <Btn label={place ? 'Reprendre la place' : 'Rejoindre'} disabled={!tel.valide || !accepte || envoi} onPress={rejoindre} />
              </>
            ) : null}
            {!session && !attente ? (
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
