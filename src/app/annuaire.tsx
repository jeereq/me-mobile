import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { PanneauTontines } from '@/components/tontines';
import { Header, Screen } from '@/components/ui';
import { filtresDuLien } from '@/lib/commande-cotisations';

/** L'annuaire pour une personne connectée, avec la recherche et les filtres dits à la voix. Sans compte, `Gate` ouvre sa version publique. */
export default function Annuaire() {
  const { q, mode, rythme, montant } = useLocalSearchParams<{ q?: string; mode?: string; rythme?: string; montant?: string }>();
  const [ouvert, setOuvert] = useState<string | null>(null);
  return (
    <Screen>
      <Header retour title="Annuaire" />
      <PanneauTontines key={`${q}|${mode}|${rythme}|${montant}`} vue="annuaire" devise="USD" ouvert={ouvert} setOuvert={setOuvert} onAnnuaire={() => {}} rechercheInitiale={q} filtresInitiaux={filtresDuLien({ mode, rythme, montant })} />
    </Screen>
  );
}
