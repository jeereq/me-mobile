import { router } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/texte';

import { PhotoProfil } from '@/components/photo-profil';
import { Btn, Panel, T } from '@/components/ui';
import { fmtPrix, TARIFS, type FonctionFinances, type FonctionPro } from '@/lib/abonnement';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

const TEXTES: Record<FonctionPro, string> = {
  assistant: 'Ton plan du jour, tes réponses aux mails et tes questions.',
  integrations: 'Gmail, Outlook, Google Agenda, To Do, Trello et Slack.',
  equipes: 'Partage budgets, projets, tâches et habitudes. Rejoindre une équipe reste gratuit.',
  emails: 'Reçois tes rappels par email.',
  push: 'Reçois tes rappels sur tes appareils, même quand Me est fermée.',
  sms: 'Reçois tes rappels par SMS.',
};

/** Bandeau affiché à la place d'une fonction Pro quand l'essai est fini et qu'il n'y a pas d'abonnement. Rien sinon. */
export function ReservePro({ fonction }: { fonction: FonctionPro }) {
  const { pro } = useStore();
  if (pro) return null;
  return (
    <Panel accent title="Inclus dans Me Pro">
      <T small>{TEXTES[fonction]}</T>
      <T small muted>
        Ton essai est terminé.
      </T>
      <View style={{ flexDirection: 'row' }}>
        <Btn label="Voir les offres" onPress={() => router.push('/abonnement')} />
      </View>
    </Panel>
  );
}

/** Une ligne discrète pour un réglage Pro (email, push) dans une liste. */
export function MentionPro() {
  const { pro } = useStore();
  if (pro) return null;
  return (
    <T small style={{ color: C.hebdo }}>
      Inclus dans Pro : Mon compte › Abonnement.
    </T>
  );
}

const TEXTES_FINANCES: Record<FonctionFinances, string> = {
  justificatifs: 'Reçus et factures joints à tes dépenses.',
  releves: 'Relevés de banque et de mobile money, sans doublon.',
  comptes: 'Plusieurs comptes et devises, avec les virements.',
  prets: 'L’argent prêté ou emprunté, avec rappels.',
  echeances: 'Vois les paiements qui arrivent (loyer, électricité, abonnements) et sois prévenu la veille.',
  bilan: 'Chaque 1er du mois, ton bilan.',
  cotisations: 'Crée ou rejoins des groupes de cotisation.',
  alertes: 'Reçois les alertes de budget et d’objectifs en notification push et par email.',
};

/** Bandeau à la place d'une fonction des finances avancées sans la formule Finances (ni Pro, ni essai). Rien sinon. */
export function ReserveFinances({ fonction, compact }: { fonction: FonctionFinances; /** Une ligne et un lien, dans un formulaire. */ compact?: boolean }) {
  const { finances, photoManquante } = useStore();
  if (finances) return null;
  if (photoManquante) {
    if (compact)
      return (
        <Text accessibilityRole="link" onPress={() => router.push('/compte')} style={{ color: C.hebdo, fontFamily: F.texte, fontSize: 13 }}>
          Ajoute ta photo de profil pour utiliser cette option.
        </Text>
      );
    return (
      <Panel accent title="Ajoute ta photo de profil">
        <T small>Les options de Finances demandent une photo.</T>
        <PhotoProfil />
      </Panel>
    );
  }
  if (compact)
    return (
      <Text accessibilityRole="link" onPress={() => router.push('/abonnement')} style={{ color: C.hebdo, fontFamily: F.texte, fontSize: 13, lineHeight: 18 }}>
        {TEXTES_FINANCES[fonction]} Inclus dans Finances ({fmtPrix(TARIFS.finances.mensuel, 'USD')} par mois) : voir les offres.
      </Text>
    );
  return (
    <Panel accent title="Inclus dans Me Finances">
      <T small>{TEXTES_FINANCES[fonction]}</T>
      <T small muted>
        {fmtPrix(TARIFS.finances.mensuel, 'USD')} par mois, ou compris dans Pro.
      </T>
      <View style={{ flexDirection: 'row' }}>
        <Btn label="Voir les offres" onPress={() => router.push('/abonnement')} />
      </View>
    </Panel>
  );
}
