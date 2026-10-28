import { View } from 'react-native';

import { brouillonMailTache, membreDe, nomMembre, patchAffectation } from '@/lib/affectation';
import { useStore } from '@/lib/store';
import type { Tache } from '@/lib/types';

import { EcrireMail } from './ecrire-mail';
import { Puce } from './finances-plus';
import { T } from './ui';

type Patch = { affecteA?: string; responsable?: string };
const CONFIE = { tache: 'la tâche lui est confiée', relance: 'la relance lui est confiée', rdv: 'le rendez-vous lui est confié' } as const;

/**
 * « Affecter à » : dans l'espace d'une équipe, confier une tâche à l'un de ses membres d'un geste. La personne en est
 * prévenue par le serveur (dans Me, en push et par email) quand la tâche lui est confiée. Hors équipe, ou pour un
 * lecteur, rien ne s'affiche. `onChoisir` reçoit ce qui change dans la tâche (des clés à `undefined` sont à retirer).
 */
export function ChoixAffectation({ t, onChoisir, genre = 'tache' }: { t: Pick<Tache, 'affecteA' | 'responsable'>; onChoisir: (patch: Patch) => void; /** Ce qui est confié : la phrase d'aide s'accorde. */ genre?: 'tache' | 'relance' | 'rdv' }) {
  const { equipeActive, lectureSeule, session } = useStore();
  if (!equipeActive || lectureSeule) return null;
  const membres = equipeActive.membres;
  const actuel = membreDe(membres, t);
  const moi = session?.user.id;
  return (
    <View style={{ gap: 6 }}>
      <T small muted>Affecter à</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Puce label="Personne" on={!actuel} onPress={() => onChoisir(patchAffectation(membres, t, null))} />
        {membres.map((m) => (
          <Puce key={m.id} label={`${nomMembre(m)}${m.id === moi ? ' (moi)' : ''}`} on={actuel?.id === m.id} onPress={() => onChoisir(patchAffectation(membres, t, m))} />
        ))}
      </View>
      <T small muted>{actuel && actuel.id !== moi ? `${nomMembre(actuel)} est prévenu(e) dans Me et par email quand ${CONFIE[genre]}.` : `La personne choisie est prévenue dans Me et par email quand ${CONFIE[genre]}.`}</T>
    </View>
  );
}

/**
 * Écrire un mail à propos d'une tâche : depuis un compte connecté (Gmail ou Outlook), adressé à la personne à qui
 * elle est confiée s'il y en a une, sinon l'adresse est à écrire. Rien ne part sans « Oui, envoyer ».
 */
export function MailDeTache({ t, onFermer }: { t: Pick<Tache, 'titre' | 'echeance' | 'note' | 'affecteA' | 'responsable'>; onFermer: () => void }) {
  const { equipeActive } = useStore();
  const membre = equipeActive ? membreDe(equipeActive.membres, t) : null;
  return <EcrireMail brouillon={brouillonMailTache(t, membre)} onFermer={onFermer} />;
}
