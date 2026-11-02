import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Btn, Panel, T } from '@/components/ui';
import type { FonctionFinances, FonctionPro } from '@/lib/abonnement';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

const TEXTES: Record<FonctionPro, string> = {
  assistant: 'Le copilote IA planifie ta journée, te propose des tâches à ajouter d’un geste, prépare tes réponses aux mails et répond à tes questions.',
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

const TEXTES_FINANCES: Record<FonctionFinances, string> = {
  justificatifs: 'Joins la photo d’un reçu ou le PDF d’une facture à chaque dépense, et retrouve-les en un toucher.',
  releves: 'Importe le relevé de ta banque ou de ton mobile money : Me range les opérations et évite les doublons.',
  comptes: 'Suis plusieurs comptes (banque, M-Pesa, caisse) et plusieurs devises, avec les virements entre eux.',
  prets: 'Note l’argent prêté ou emprunté à quelqu’un, les remboursements, et sois prévenu quand il doit être rendu.',
  echeances: 'Vois les paiements qui arrivent (loyer, électricité, abonnements) et sois prévenu la veille.',
  bilan: 'Chaque 1er du mois, ton bilan : dépensé, reçu, mis de côté, tes plus gros postes et l’écart avec le mois d’avant.',
  alertes: 'Reçois les alertes de budget et d’objectifs en notification push et par email.',
};

/** Bandeau à la place d'une fonction des finances avancées sans la formule Finances (ni Pro, ni essai). Rien sinon. */
export function ReserveFinances({ fonction, compact }: { fonction: FonctionFinances; /** Une ligne et un lien, dans un formulaire. */ compact?: boolean }) {
  const { finances } = useStore();
  if (finances) return null;
  if (compact)
    return (
      <Text accessibilityRole="link" onPress={() => router.push('/abonnement')} style={{ color: C.hebdo, fontFamily: F.texte, fontSize: 13, lineHeight: 18 }}>
        {TEXTES_FINANCES[fonction]} Inclus dans Finances (1,99 $ par mois) : voir les offres.
      </Text>
    );
  return (
    <Panel accent title="Inclus dans Me Finances">
      <T small>{TEXTES_FINANCES[fonction]}</T>
      <T small muted>
        Finances : 1,99 $ par mois, ou compris dans Pro. Tes données restent visibles sans abonnement.
      </T>
      <View style={{ flexDirection: 'row' }}>
        <Btn label="Voir les offres" onPress={() => router.push('/abonnement')} />
      </View>
    </Panel>
  );
}
