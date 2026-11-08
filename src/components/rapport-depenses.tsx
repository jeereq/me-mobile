import { Pressable, View } from 'react-native';

import { Text } from '@/components/texte';
import { Panel, T } from '@/components/ui';
import { categoriesDe } from '@/lib/categories';
import { type Conseil, rapportDepenses, resumeRapport, somme } from '@/lib/commun/rapport';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Finances, Periode } from '@/lib/types';

/** Couleur d'un conseil, lue au rendu : elle suit le thème. */
const couleurTon = (t: Conseil['ton']) => (t === 'alerte' ? C.agressif : t === 'bravo' ? C.coach : C.hebdo);

/**
 * Le rapport de la période affichée dans Finances (le jour, la semaine, le mois, le trimestre ou l'année) :
 * le même que celui reçu le soir, avec ses conseils et les postes qui pèsent le plus.
 */
export function PanneauRapport({ f, vue, jourRef, d, onReglages }: { f: Finances; vue: Periode; jourRef: string; d: string; onReglages?: () => void }) {
  const { espace } = useStore();
  const r = rapportDepenses(f, vue, jourRef, d, categoriesDe(espace));
  if (r.debut > d) return null;
  const reglages = f.alertes?.rapport ?? {};
  const envoye = vue === 'jour' ? reglages.soir !== false : !!reglages.periodes?.[vue];
  return (
    <Panel
      title="Rapport"
      right={
        onReglages ? (
          <Pressable accessibilityRole="button" onPress={onReglages} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <T small style={{ color: C.accent }}>
              {envoye ? 'Reçu le soir' : 'Le recevoir'}
            </T>
          </Pressable>
        ) : null
      }>
      <View style={{ gap: 2 }}>
        <T small muted>
          {r.titre}
        </T>
        <T small>{resumeRapport(r)}</T>
      </View>
      {r.conseils.length ? (
        <View style={{ gap: 8 }}>
          {r.conseils.map((c, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, backgroundColor: alpha(couleurTon(c.ton), 0.08), borderLeftWidth: 3, borderLeftColor: couleurTon(c.ton) }}>
              <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14, lineHeight: 20 }}>{c.texte}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {r.categories.length > 1 ? (
        <View accessibilityLabel="Où est parti l’argent" style={{ gap: 8 }}>
          {r.categories.slice(0, 3).map((c) => (
            <View key={c.nom} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 13 }}>
                  {c.nom}
                </Text>
                <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13, fontVariant: ['tabular-nums'] }}>
                  {somme(c.montant, r.devise)} · {c.part} %
                </Text>
              </View>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: C.sunk }}>
                <View style={{ height: 4, borderRadius: 2, width: `${Math.max(2, c.part)}%`, backgroundColor: C.accent }} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Panel>
  );
}
