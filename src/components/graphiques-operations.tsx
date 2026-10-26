import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { libelleMois, libelleMoisCourt, type MoisOps } from '@/lib/analyse-operations';
import { alpha, C, F } from '@/lib/theme';

/** Graphiques de l'onglet Opérations : barres entrées/sorties par mois et courbe du solde cumulé. */

const signe = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');

/**
 * Deux barres par mois : ce qui est entré (vert) à côté de ce qui est sorti (couleur du thème). Toucher un mois affiche ses chiffres au-dessus.
 * Les barres partent de la même ligne de base ; la hauteur est partagée entre les deux séries pour qu'on puisse les comparer.
 */
export function EntreesSorties({ mois, fmt, hauteur = 130 }: { mois: MoisOps[]; fmt: (n: number) => string; hauteur?: number }) {
  const [interne, setInterne] = useState(mois.length - 1);
  const choisi = Math.min(interne, mois.length - 1);
  const max = Math.max(1, ...mois.flatMap((m) => [m.entrees, m.sorties]));
  const n = mois.length;
  const pas = n > 18 ? 4 : n > 9 ? 2 : 1;
  const m = mois[choisi];
  if (!m) return null;
  const solde = Math.round((m.entrees - m.sorties) * 100) / 100;
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityLiveRegion="polite" style={{ color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>
        {libelleMois(m.mois)} · entrées +{fmt(m.entrees)} · sorties −{fmt(m.sorties)} · solde {signe(solde)}{fmt(Math.abs(solde))}
      </Text>
      <View style={{ height: hauteur, flexDirection: 'row', alignItems: 'flex-end', gap: n > 12 ? 3 : 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
        {mois.map((x, i) => {
          const on = i === choisi;
          return (
            <Pressable key={x.mois} accessibilityRole="button" accessibilityLabel={`${libelleMois(x.mois)} : entrées ${fmt(x.entrees)}, sorties ${fmt(x.sorties)}`} onPress={() => setInterne(i)} style={{ flex: 1, height: '100%', flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
              <View style={{ flex: 1, height: x.entrees ? Math.max(3, (x.entrees / max) * (hauteur - 4)) : 2, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: x.entrees ? (on ? C.coach : alpha(C.coach, 0.5)) : C.line }} />
              <View style={{ flex: 1, height: x.sorties ? Math.max(3, (x.sorties / max) * (hauteur - 4)) : 2, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: x.sorties ? (on ? C.accent : alpha(C.accent, 0.45)) : C.line }} />
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: 14 }}>
        {mois.map((x, i) =>
          (n - 1 - i) % pas === 0 ? (
            <Text key={x.mois} numberOfLines={1} style={{ position: 'absolute', left: `${((i + 0.5) / n) * 100}%`, width: 64, marginLeft: -32, textAlign: 'center', color: i === choisi ? C.ink : C.muted, fontFamily: F.texte, fontSize: 11 }}>
              {libelleMoisCourt(x.mois)}
              {x.mois.slice(5) === '01' || i === 0 ? ` ${x.mois.slice(2, 4)}` : ''}
            </Text>
          ) : null,
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Legende couleur={C.coach} texte="Entrées" />
        <Legende couleur={C.accent} texte="Sorties" />
      </View>
    </View>
  );
}

function Legende({ couleur, texte }: { couleur: string; texte: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: couleur }} />
      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{texte}</Text>
    </View>
  );
}

const MAX_POINTS = 120;

/** Réduit une longue série à `MAX_POINTS` points en gardant le dernier de chaque paquet (c'est un cumul : la dernière valeur dit tout). */
function reduire<T>(l: T[]): T[] {
  if (l.length <= MAX_POINTS) return l;
  const pas = l.length / MAX_POINTS;
  const r: T[] = [];
  for (let i = 0; i < MAX_POINTS; i++) r.push(l[Math.min(l.length - 1, Math.floor((i + 1) * pas) - 1)]);
  return r;
}

const dateFr = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

/**
 * Courbe d'une valeur cumulée (entrées − sorties depuis le début de la sélection), avec la ligne du zéro.
 * Au-dessus du zéro on a reçu plus qu'on n'a dépensé. Toucher la courbe affiche la date et la valeur la plus proche.
 */
export function Courbe({ points, fmt, hauteur = 130 }: { points: { date: string; v: number }[]; fmt: (n: number) => string; hauteur?: number }) {
  const [largeur, setLargeur] = useState(0);
  const [choisi, setChoisi] = useState<number | null>(null);
  const l = reduire(points);
  if (l.length < 2) return <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>Pas assez de jours pour tracer une courbe.</Text>;
  const bas = Math.min(0, ...l.map((p) => p.v));
  const haut = Math.max(0, ...l.map((p) => p.v));
  const etendue = haut - bas || 1;
  const pad = 6;
  const x = (i: number) => pad + (i / (l.length - 1)) * Math.max(1, largeur - 2 * pad);
  const y = (v: number) => pad + (1 - (v - bas) / etendue) * (hauteur - 2 * pad);
  const zero = y(0);
  const trace = l.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const aire = `${trace} L${x(l.length - 1).toFixed(1)} ${zero.toFixed(1)} L${x(0).toFixed(1)} ${zero.toFixed(1)} Z`;
  const i = choisi == null ? l.length - 1 : Math.min(choisi, l.length - 1);
  const p = l[i];
  const fin = l[l.length - 1].v;
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityLiveRegion="polite" style={{ color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>
        {choisi == null ? `Au ${dateFr(p.date)} : ` : `${dateFr(p.date)} : `}
        {signe(p.v)}
        {fmt(Math.abs(p.v))}
        {choisi == null ? ` depuis le début (plus bas ${signe(bas)}${fmt(Math.abs(bas))}, plus haut ${signe(haut)}${fmt(Math.abs(haut))})` : ''}
      </Text>
      <Pressable
        accessibilityRole="image"
        accessibilityLabel={`Solde cumulé, ${signe(fin)}${fmt(Math.abs(fin))} à la fin`}
        onPress={(e: { nativeEvent: { locationX: number } }) => setChoisi(Math.max(0, Math.min(l.length - 1, Math.round(((e.nativeEvent.locationX - pad) / Math.max(1, largeur - 2 * pad)) * (l.length - 1)))))}
        onLayout={(e: { nativeEvent: { layout: { width: number } } }) => setLargeur(e.nativeEvent.layout.width)}
        style={{ height: hauteur }}>
        {largeur ? (
          <Svg width={largeur} height={hauteur}>
            <Line x1={0} x2={largeur} y1={zero} y2={zero} stroke={C.muted} strokeWidth={1} strokeDasharray="4 4" />
            <Path d={aire} fill={alpha(fin < 0 ? C.agressif : C.coach, 0.14)} />
            <Path d={trace} stroke={fin < 0 ? C.agressif : C.coach} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={x(i)} cy={y(p.v)} r={4} fill={fin < 0 ? C.agressif : C.coach} />
          </Svg>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 11 }}>{dateFr(l[0].date)}</Text>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 11 }}>{dateFr(l[l.length - 1].date)}</Text>
      </View>
    </View>
  );
}
