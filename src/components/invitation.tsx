import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Btn, Dialogue, T } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { NOM_ROLE, type ApercuInvitation } from '@/lib/equipes';
import { invitationEnAttente, oublierInvitationGardee } from '@/lib/liens-compte';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

/**
 * Invitation reçue par email : le jeton est lu à l'ouverture de l'app (/equipe?invitation=…), puis cette fenêtre
 * montre quelle équipe et qui invite, avant d'accepter. Il faut être connecté avec le compte qui porte l'adresse invitée.
 */
export function Invitation() {
  const { apercuInvitation, rejoindreEquipe, profil, signOut } = useStore();
  const [jeton, setJeton] = useState(invitationEnAttente);
  const [apercu, setApercu] = useState<ApercuInvitation | null>(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!jeton) return;
    let annule = false;
    apercuInvitation(jeton)
      .then((a) => !annule && setApercu(a))
      .catch((e) => {
        if (annule) return;
        setErreur(e instanceof Error ? e.message : 'Cette invitation n’est plus valable.');
        // Périmée, déjà utilisée ou inconnue : inutile de la garder (une panne réseau, elle, laisse le jeton pour réessayer).
        if (e instanceof ApiError && e.status === 400) oublierInvitationGardee();
      });
    return () => {
      annule = true;
    };
  }, [jeton, apercuInvitation]);

  if (!jeton || (!apercu && !erreur)) return null;
  const fermer = () => setJeton(null);

  if (erreur || !apercu)
    return (
      <Dialogue titre="Invitation" onFermer={fermer}>
        <T small style={{ color: C.agressif }}>{erreur}</T>
        <Btn label="Fermer" onPress={fermer} />
      </Dialogue>
    );

  const rejoindre = async () => {
    if (enCours) return;
    setEnCours(true);
    try {
      await rejoindreEquipe(jeton);
      oublierInvitationGardee();
      fermer();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible pour le moment.');
      if (e instanceof ApiError && e.status === 400) oublierInvitationGardee();
      setEnCours(false);
    }
  };

  return (
    <Dialogue titre="Invitation" onFermer={fermer}>
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 4 }}>
        <Text style={{ fontSize: 34 }}>{apercu.emoji}</Text>
        <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 19, textAlign: 'center' }}>{apercu.equipe}</Text>
        <T small muted style={{ textAlign: 'center' }}>
          {apercu.parNom} t’invite comme {NOM_ROLE[apercu.role].toLowerCase()}.
        </T>
      </View>
      <T small muted>En acceptant, tu verras les budgets, projets, tâches et habitudes de l’équipe, à côté des tiens. Ton espace à toi reste séparé.</T>
      {apercu.pourMoi ? null : (
        <T small style={{ color: C.agressif }}>
          Cette invitation a été envoyée à {apercu.email}. Tu es connecté avec {profil?.email} : connecte-toi avec l’autre compte pour l’accepter.
        </T>
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Rejoindre l'équipe" onPress={rejoindre} disabled={!apercu.pourMoi || enCours} />
        <Btn kind="sec" label="Plus tard" onPress={fermer} />
        {apercu.pourMoi ? <Btn kind="sec" label="Refuser" onPress={() => (oublierInvitationGardee(), fermer())} /> : null}
        {apercu.pourMoi ? null : <Btn kind="sec" label="Changer de compte" onPress={() => void signOut()} />}
      </View>
      <T small muted>« Plus tard » garde l’invitation : elle te sera proposée à ta prochaine ouverture de l’app, tant que le lien reste valable (7 jours).</T>
    </Dialogue>
  );
}
