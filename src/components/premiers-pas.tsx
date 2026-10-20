import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { financesDe } from '@/lib/finances';
import { etatPush, type EtatPush } from '@/lib/push';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { Panel, T } from './ui';

type Etape = { cle: string; titre: string; detail: string; fait: boolean; ouvrir: () => void };

/**
 * Carte « Premiers pas » de l'accueil : les quelques réglages qui rendent l'app utile dès le premier jour.
 * Chaque étape se coche d'elle-même quand la donnée existe ; la carte disparaît une fois tout fait ou masquée.
 */
export function PremiersPas({ onAjout }: { onAjout: () => void }) {
  const { espace, mode, externes, update } = useStore();
  const [push, setPush] = useState<EtatPush | null>(null);
  useEffect(() => {
    if (mode === 'cloud') etatPush().then(setPush);
  }, [mode]);

  const aller = (h: Href) => () => router.push(h);
  const etapes: Etape[] = [
    { cle: 'mission', titre: 'Ajoute une tâche ou une relance', detail: 'Elle rejoint ta mission du jour.', fait: espace.taches.length + espace.relances.length > 0, ouvrir: onAjout },
    // L'espace arrive avec des habitudes suggérées : l'étape compte la première coche, pas la création.
    { cle: 'habitude', titre: 'Coche une habitude', detail: 'Garde celles qui te ressemblent, ajoute les tiennes.', fait: espace.habitudes.some((h) => h.coches.length > 0), ouvrir: aller('/habitudes') },
    { cle: 'budget', titre: 'Fixe un budget', detail: 'Pour suivre tes dépenses du mois.', fait: financesDe(espace).budgets.length > 0, ouvrir: aller('/finances') },
  ];
  if (mode === 'cloud') {
    etapes.push({ cle: 'agenda', titre: 'Connecte ton agenda', detail: 'Tes rendez-vous apparaissent ici.', fait: externes.length > 0 || Object.keys(espace.agenda).length > 0, ouvrir: aller('/sources') });
    if (push && push !== 'indisponible') etapes.push({ cle: 'push', titre: 'Active les notifications', detail: 'Tes rappels, même app fermée.', fait: push === 'actif', ouvrir: aller('/compte') });
  }

  const faites = etapes.filter((e) => e.fait).length;
  if (espace.premiersPas?.masque || faites === etapes.length) return null;
  const masquer = () => update((e) => ({ ...e, premiersPas: { ...e.premiersPas, masque: true } }));

  return (
    <Panel
      title="Premiers pas"
      count={`${faites}/${etapes.length}`}
      right={
        <Pressable accessibilityRole="button" onPress={masquer} hitSlop={8}>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Masquer</Text>
        </Pressable>
      }>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.sunk, overflow: 'hidden' }}>
        <View style={{ width: `${(faites / etapes.length) * 100}%`, height: '100%', backgroundColor: C.coach }} />
      </View>
      {etapes.map((e) => (
        <Pressable
          key={e.cle}
          accessibilityRole="button"
          accessibilityState={{ checked: e.fait }}
          disabled={e.fait}
          onPress={e.ouvrir}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: e.fait ? C.coach : 'transparent', borderWidth: e.fait ? 0 : 1.5, borderColor: alpha(C.muted, 0.6) }}>
            {e.fait ? <Text style={{ color: C.bg, fontSize: 13, fontFamily: F.texteF }}>✓</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: e.fait ? C.muted : C.ink, fontFamily: F.texteM, fontSize: 15, textDecorationLine: e.fait ? 'line-through' : 'none' }}>{e.titre}</Text>
            {e.fait ? null : <T small muted>{e.detail}</T>}
          </View>
          {e.fait ? null : <Text style={{ color: C.accent, fontSize: 18 }}>›</Text>}
        </Pressable>
      ))}
    </Panel>
  );
}
