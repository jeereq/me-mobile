import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { decalerMois, grilleMois, parse, today } from '@/lib/dates';
import { useTeinte } from '@/lib/teinte';
import { alpha, C, F } from '@/lib/theme';

import { tap } from './ui';

const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const nomMois = (mois: string) => {
  const t = parse(`${mois}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
/** « mar. 12 nov. 2026 » : lisible d'un coup d'œil, sans ambiguïté jour/mois. */
export const dateLisible = (s: string) => parse(s).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Un champ de date qui s'ouvre sur un calendrier, au pouce : pas de format à deviner ni de clavier.
 * `min` / `max` grisent les jours hors limites ; `effacable` permet de laisser le champ vide.
 */
export function ChampDate({ label, value, onChange, min, max, effacable, placeholder = 'Choisir une date' }: { label: string; value?: string | null; onChange: (d: string | undefined) => void; min?: string; max?: string; effacable?: boolean; placeholder?: string }) {
  const t = useTeinte();
  const d = today();
  const [ouvert, setOuvert] = useState(false);
  const [mois, setMois] = useState((value || (min && min > d ? min : d)).slice(0, 7));
  const hors = (x: string) => (!!min && x < min) || (!!max && x > max);
  const choisir = (x: string | undefined) => {
    tap();
    onChange(x);
    setOuvert(false);
  };
  const ouvrir = () => {
    if (!ouvert) setMois((value || (min && min > d ? min : d)).slice(0, 7));
    setOuvert(!ouvert);
  };
  const cases = grilleMois(mois);

  return (
    <View style={{ gap: 6, flexGrow: 1, flexBasis: 220 }}>
      <Text style={{ color: C.muted, fontSize: 13, fontFamily: F.texteM }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value ? dateLisible(value) : 'aucune date'}`}
        accessibilityState={{ expanded: ouvert }}
        onPress={ouvrir}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.sunk, borderWidth: 1, borderColor: ouvert ? t.c : C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, opacity: pressed ? 0.8 : 1 })}>
        <Text style={{ fontSize: 15 }}>📅</Text>
        <Text numberOfLines={1} style={{ flex: 1, color: value ? C.ink : C.muted, fontFamily: F.texte, fontSize: 15 }}>
          {value ? dateLisible(value) : placeholder}
        </Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>{ouvert ? '▲' : '▼'}</Text>
      </Pressable>

      {ouvert ? (
        <View style={{ gap: 8, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Fleche label="Mois précédent" glyph="‹" onPress={() => setMois(decalerMois(mois, -1))} />
            <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>
              {nomMois(mois)}
            </Text>
            <Fleche label="Mois suivant" glyph="›" onPress={() => setMois(decalerMois(mois, 1))} />
          </View>
          <View style={{ flexDirection: 'row' }}>
            {JOURS_COURTS.map((j, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>
                {j}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cases.map((x, i) => {
              if (!x) return <View key={`v${i}`} style={{ width: `${100 / 7}%`, height: 40 }} />;
              const on = x === value;
              const off = hors(x);
              return (
                <View key={x} style={{ width: `${100 / 7}%`, height: 40, padding: 2 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={dateLisible(x)}
                    accessibilityState={{ selected: on, disabled: off }}
                    disabled={off}
                    onPress={() => choisir(x)}
                    style={({ pressed }) => ({ flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.c : pressed ? alpha(t.c, 0.14) : 'transparent', borderWidth: x === d && !on ? 1 : 0, borderColor: t.c })}>
                    <Text style={{ color: on ? t.encre : off ? alpha(C.muted, 0.45) : C.ink, fontFamily: on ? F.texteF : F.texte, fontSize: 14 }}>{Number(x.slice(8))}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'flex-end' }}>
            {!hors(d) ? <Action label="Aujourd’hui" onPress={() => choisir(d)} /> : null}
            {effacable && value ? <Action label="Effacer" onPress={() => choisir(undefined)} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Fleche({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => ({ width: 40, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.sunk : 'transparent' })}>
      <Text style={{ color: C.ink, fontSize: 22, lineHeight: 24 }}>{glyph}</Text>
    </Pressable>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTeinte();
  return (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress} style={({ pressed }) => ({ paddingVertical: 4, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
