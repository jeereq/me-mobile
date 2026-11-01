import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { addDays, today } from '@/lib/dates';
import { tachesUrgentes } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { relanceAttendue } from '@/lib/suivi';
import { teinteDe } from '@/lib/teinte';
import { alpha, C, F } from '@/lib/theme';

import { tap } from './ui';

export type VueAFaire = 'taches' | 'relances';

/** Les nombres de l'onglet « À faire » : tâches urgentes et relances dont le jour est venu. */
export function useComptesAFaire() {
  const { espace } = useStore();
  const d = today();
  return {
    taches: tachesUrgentes(espace, d, addDays(d, 2)).length,
    relances: espace.relances.filter((r) => relanceAttendue(r) && r.date <= d).length,
  };
}

/**
 * Sur téléphone, l'onglet « À faire » réunit les tâches et les relances : deux boutons en haut de l'écran
 * pour passer de l'une à l'autre, chacun avec ce qu'il reste à faire aujourd'hui.
 */
export function BasculeAFaire({ vue }: { vue: VueAFaire }) {
  const n = useComptesAFaire();
  const options: { cle: VueAFaire; label: string; nombre: number; couleur: string }[] = [
    { cle: 'taches', label: 'Tâches', nombre: n.taches, couleur: teinteDe('/taches') },
    { cle: 'relances', label: 'Relances', nombre: n.relances, couleur: teinteDe('/relances') },
  ];
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk }}>
      {options.map((o) => {
        const on = o.cle === vue;
        return (
          <Pressable
            key={o.cle}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${o.label}${o.nombre ? `, ${o.nombre} pour aujourd'hui` : ''}`}
            onPress={() => {
              if (on) return;
              tap();
              router.setParams({ vue: o.cle === 'relances' ? 'relances' : undefined } as never);
            }}
            style={({ pressed }) => ({ flex: 1, minHeight: 40, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: on ? C.surface : 'transparent', borderWidth: on ? 1 : 0, borderColor: C.line, opacity: pressed ? 0.8 : 1 })}>
            <Text style={{ color: on ? C.ink : C.muted, fontFamily: on ? F.texteF : F.texteM, fontSize: 14 }}>{o.label}</Text>
            {o.nombre ? (
              <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? o.couleur : alpha(o.couleur, 0.2) }}>
                <Text style={{ color: on ? C.bg : o.couleur, fontFamily: F.texteF, fontSize: 11 }}>{o.nombre}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
