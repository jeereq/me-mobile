import { router } from 'expo-router';
import { View } from 'react-native';

import { Btn, Panel, T } from '@/components/ui';
import type { FonctionPro } from '@/lib/abonnement';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

const TEXTES: Record<FonctionPro, string> = {
  assistant: 'Le copilote IA répond à tes questions, prépare ton plan et rédige tes relances.',
  integrations: 'Connecte Gmail, Outlook, Google Agenda, To Do, Trello et Slack : Me les relit pour toi toutes les 15 minutes.',
  equipes: 'Crée une équipe et invite d’autres comptes à partager budgets, projets, tâches et habitudes. Rejoindre une équipe sur invitation reste gratuit.',
  emails: 'Reçois tes rappels par email.',
  push: 'Reçois tes rappels sur tes appareils, même quand Me est fermée.',
};

/** Bandeau affiché à la place d'une fonction Pro quand l'essai est fini et qu'il n'y a pas d'abonnement. Rien sinon. */
export function ReservePro({ fonction }: { fonction: FonctionPro }) {
  const { pro } = useStore();
  if (pro) return null;
  return (
    <Panel accent title="Inclus dans Me Pro">
      <T small>{TEXTES[fonction]}</T>
      <T small muted>
        Ton essai est terminé. Tout le reste de Me reste gratuit.
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
