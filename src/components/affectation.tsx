import { View } from 'react-native';

import { basculerExecutant, basculerSuivi, brouillonMailTache, executantsDe, membreDe, nomMembre, patchAffectation, patchExecutants, suivisDe, type Affectes } from '@/lib/affectation';
import { useStore } from '@/lib/store';
import type { Tache } from '@/lib/types';

import { EcrireMail } from './ecrire-mail';
import { Puce } from './finances-plus';
import { T } from './ui';

type Patch = Affectes;
type Qui = Pick<Tache, 'affecteA' | 'responsable' | 'executants' | 'suivis'>;
const CONFIE = { tache: 'la tâche lui est confiée', relance: 'la relance lui est confiée', rdv: 'le rendez-vous lui est confié' } as const;

/**
 * Qui s'en occupe, dans l'espace d'une équipe. Une tâche a une liste de personnes pour l'effectuer et une liste pour la
 * suivre ; une relance ou un rendez-vous, une seule personne. Chacune est prévenue par le serveur (dans Me, en push et par
 * email) quand elle est choisie. Hors équipe, ou pour un lecteur, rien ne s'affiche. `onChoisir` reçoit ce qui change
 * (des clés à `undefined` sont à retirer).
 */
export function ChoixAffectation({ t, onChoisir, genre = 'tache' }: { t: Qui; onChoisir: (patch: Patch) => void; /** Ce qui est confié : la phrase d'aide s'accorde. */ genre?: 'tache' | 'relance' | 'rdv' }) {
  const { equipeActive, lectureSeule, session } = useStore();
  if (!equipeActive || lectureSeule) return null;
  const membres = equipeActive.membres;
  const moi = session?.user.id;
  const nom = (m: (typeof membres)[number]) => `${nomMembre(m)}${m.id === moi ? ' (moi)' : ''}`;

  if (genre !== 'tache') {
    const actuel = membreDe(membres, t);
    return (
      <View style={{ gap: 6 }}>
        <T small muted>Affecter à</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Puce label="Personne" on={!actuel} onPress={() => onChoisir(patchAffectation(membres, t, null))} />
          {membres.map((m) => (
            <Puce key={m.id} label={nom(m)} on={actuel?.id === m.id} onPress={() => onChoisir(patchAffectation(membres, t, m))} />
          ))}
        </View>
        <T small muted>{actuel && actuel.id !== moi ? `${nomMembre(actuel)} est prévenu(e) dans Me et par email quand ${CONFIE[genre]}.` : `La personne choisie est prévenue dans Me et par email quand ${CONFIE[genre]}.`}</T>
      </View>
    );
  }

  const eux = executantsDe(membres, t);
  const suivants = suivisDe(membres, t);
  const autres = membres.filter((m) => !eux.some((x) => x.id === m.id));
  const prevenus = [...eux, ...suivants].filter((m) => m.id !== moi);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 6 }}>
        <T small muted>À faire par</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Puce label="Personne" on={!eux.length} onPress={() => onChoisir(patchExecutants(membres, t, []))} />
          {membres.map((m) => (
            <Puce key={m.id} label={nom(m)} on={eux.some((x) => x.id === m.id)} onPress={() => onChoisir(basculerExecutant(membres, t, m))} />
          ))}
        </View>
      </View>
      {autres.length ? (
        <View style={{ gap: 6 }}>
          <T small muted>Suivi par</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {autres.map((m) => (
              <Puce key={m.id} label={nom(m)} on={suivants.some((x) => x.id === m.id)} onPress={() => onChoisir(basculerSuivi(t, m))} />
            ))}
          </View>
        </View>
      ) : null}
      <T small muted>
        {prevenus.length ? `${prevenus.length > 1 ? 'Les personnes choisies sont prévenues' : `${nomMembre(prevenus[0])} est prévenu(e)`} dans Me et par email.` : 'Les personnes choisies sont prévenues dans Me et par email.'}
      </T>
    </View>
  );
}

/**
 * Écrire un mail à propos d'une tâche : depuis un compte connecté (Gmail ou Outlook), adressé à la personne à qui
 * elle est confiée s'il y en a une, sinon l'adresse est à écrire. Rien ne part sans « Oui, envoyer ».
 */
export function MailDeTache({ t, onFermer }: { t: Pick<Tache, 'titre' | 'echeance' | 'note' | 'affecteA' | 'responsable' | 'executants'>; onFermer: () => void }) {
  const { equipeActive } = useStore();
  const eux = equipeActive ? executantsDe(equipeActive.membres, t) : [];
  return <EcrireMail brouillon={brouillonMailTache(t, eux)} onFermer={onFermer} />;
}
