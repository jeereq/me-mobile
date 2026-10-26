import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { View } from 'react-native';

import { PanneauPrevisions } from '@/components/previsions';
import { EtatDesLieux, ResumeFinances } from '@/components/tableau-de-bord';
import { Btn, Colonnes, Header, Screen, T } from '@/components/ui';
import { fmtLong, today } from '@/lib/dates';
import { rapportTexte } from '@/lib/etat-des-lieux';
import { financesDe } from '@/lib/finances';
import { useStore } from '@/lib/store';

/** Rapport complet : résumé des finances, prévisions, état des lieux et toutes les recommandations, à copier en texte. */
export default function Rapport() {
  const { espace } = useStore();
  const d = today();
  const f = financesDe(espace);
  const [copie, setCopie] = useState('');
  const copier = async () => {
    try {
      await Clipboard.setStringAsync(rapportTexte(espace, d));
      setCopie('Rapport copié : colle-le dans un message ou une note.');
    } catch {
      setCopie('Impossible de copier sur cet appareil.');
    }
  };
  return (
    <Screen>
      <Header retour eyebrow={`Rapport du ${fmtLong().replace(/^./, (c) => c.toLowerCase())}`} title="État des lieux" right={<Btn small kind="sec" label="Copier" onPress={copier} />} />
      {copie ? <T small muted>{copie}</T> : null}
      <Colonnes
        gauche={<EtatDesLieux espace={espace} d={d} />}
        droite={
          <View style={{ gap: 16 }}>
            <ResumeFinances espace={espace} d={d} />
            {f.budgets.length ? <PanneauPrevisions f={f} d={d} seuil={f.alertes?.seuil ?? 1} /> : null}
          </View>
        }
      />
    </Screen>
  );
}
