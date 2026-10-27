import { useLocalSearchParams } from 'expo-router';

import { Header, Screen } from '@/components/ui';
import { VueCalendrier } from '@/components/vue-calendrier';

/** Le calendrier : tâches, projets, relances, habitudes, dépenses, revenus, budgets et objectifs sur un même plan. */
export default function Calendrier() {
  const params = useLocalSearchParams();
  return (
    <Screen>
      <Header retour eyebrow="Tout ce qui a une date" title="Calendrier" />
      <VueCalendrier dateInitiale={typeof params.date === 'string' ? params.date : undefined} />
    </Screen>
  );
}
