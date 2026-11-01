import { Redirect } from 'expo-router';

import { VueRelances } from '@/components/vue-relances';
import { useBarreOnglets } from '@/lib/mise-en-page';

/**
 * Sur ordinateur, les relances ont leur entrée dans la barre latérale. Sur téléphone, elles vivent dans
 * l'onglet « À faire », à côté des tâches : tous les liens vers /relances y mènent.
 */
export default function Relances() {
  const { bureau } = useBarreOnglets();
  if (!bureau) return <Redirect href={'/taches?vue=relances' as never} />;
  return <VueRelances />;
}
