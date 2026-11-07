import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { PanneauTontines } from '@/components/tontines';
import { Header, Screen } from '@/components/ui';
import { idDuLien } from '@/lib/annuaire';
import { filtresDuLien } from '@/lib/commande-cotisations';

/**
 * L'annuaire pour une personne connectée, avec la recherche et les filtres dits à la voix.
 * `/annuaire/nom-du-groupe-id` ouvre ce groupe. Sans compte, `Gate` ouvre la version publique.
 */
export function EcranAnnuaire() {
  const { q, mode, rythme, montant, id } = useLocalSearchParams<{ q?: string; mode?: string; rythme?: string; montant?: string; id?: string }>();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const groupe = id ? (idDuLien(id) ?? undefined) : undefined;
  return (
    <Screen>
      <Header retour title="Annuaire" />
      <PanneauTontines key={`${q}|${mode}|${rythme}|${montant}|${groupe}`} vue="annuaire" devise="USD" ouvert={ouvert} setOuvert={setOuvert} onAnnuaire={() => {}} rechercheInitiale={q} filtresInitiaux={filtresDuLien({ mode, rythme, montant })} groupeInitial={groupe} />
    </Screen>
  );
}
