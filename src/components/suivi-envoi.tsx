import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

import { useStore } from '@/lib/store';
import { teinteDe } from '@/lib/teinte';
import { C, F } from '@/lib/theme';

import { Seg, tap } from './ui';

export type SuiviEnvoi = { actif: boolean; jours: number };

/** L'état de l'interrupteur « Me rappeler s'il ne répond pas » : éteint d'emblée, au délai de relance des réglages. */
export function useSuiviEnvoi(actif = false) {
  const { config } = useStore();
  return useState<SuiviEnvoi>({ actif, jours: Math.max(1, config.delaiRelanceJours || 3) });
}

/**
 * Sous un mail à envoyer : « Me rappeler si [Paul] ne répond pas », et dans combien de jours.
 * À l'envoi, une relance liée naît (ou celle qui existe est reprogrammée) : plus besoin d'y penser.
 */
export function ChoixSuiviEnvoi({ qui, valeur, onChange }: { qui?: string; valeur: SuiviEnvoi; onChange: (v: SuiviEnvoi) => void }) {
  const delais = [1, 3, 7];
  const options = (delais.includes(valeur.jours) ? delais : [...delais, valeur.jours].sort((a, b) => a - b)).map((j) => ({ key: String(j), label: j === 1 ? 'Demain' : j === 7 ? '+1 semaine' : `Dans ${j} jours` }));
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14.5 }}>{`Me rappeler si ${qui || 'on'} ne répond pas`}</Text>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>Crée une relance liée à ce mail</Text>
        </View>
        <Switch accessibilityLabel="Me rappeler s'il n'y a pas de réponse" value={valeur.actif} onValueChange={(actif) => (tap(), onChange({ ...valeur, actif }))} trackColor={{ true: teinteDe('/relances'), false: C.line }} thumbColor={C.ink} />
      </View>
      {valeur.actif ? <Seg options={options} value={String(valeur.jours)} onChange={(k) => onChange({ ...valeur, jours: Number(k) })} /> : null}
    </View>
  );
}
