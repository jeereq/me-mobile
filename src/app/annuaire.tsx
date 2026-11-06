import { useState } from 'react';

import { PanneauTontines } from '@/components/tontines';
import { Header, Screen } from '@/components/ui';

/** L'annuaire pour une personne connectée. Sans compte, `Gate` ouvre sa version publique. */
export default function Annuaire() {
  const [ouvert, setOuvert] = useState<string | null>(null);
  return (
    <Screen>
      <Header retour title="Annuaire" />
      <PanneauTontines vue="annuaire" devise="USD" ouvert={ouvert} setOuvert={setOuvert} onAnnuaire={() => {}} />
    </Screen>
  );
}
