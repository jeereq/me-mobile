import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { addDays, parse } from '@/lib/dates';
import type { LignePlan, Plan } from '@/lib/planning';
import { alpha, C, F } from '@/lib/theme';
import type { Tache } from '@/lib/types';

export type Zoom = 'jour' | 'semaine' | 'mois';
export const ZOOMS: { key: Zoom; label: string; px: number }[] = [
  { key: 'jour', label: 'Jours', px: 26 },
  { key: 'semaine', label: 'Semaines', px: 11 },
  { key: 'mois', label: 'Mois', px: 4 },
];

const LIGNE = 34;
const ENTETE = 44;
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const ecart = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);

export type LigneGantt = { tache: Tache; ligne: LignePlan; niveau: number };

/**
 * Planning de projet en diagramme de Gantt : une ligne par tâche (les résumés en barre fine), les jalons en losange,
 * les liens « après » en flèches, la voie critique en rouge, le jour courant en trait vertical.
 * Les noms restent à gauche pendant qu'on fait défiler le calendrier.
 */
export function Gantt({ lignes, plan, zoom, aujourdhui, onOuvrir, ouverte, largeurNoms = 170 }: { lignes: LigneGantt[]; plan: Plan; zoom: Zoom; aujourdhui: string; onOuvrir: (id: string) => void; ouverte?: string | null; largeurNoms?: number }) {
  if (!lignes.length || !plan.debut || !plan.fin) return null;
  const px = ZOOMS.find((z) => z.key === zoom)!.px;
  // Le calendrier commence quelques jours avant le premier travail et finit après le dernier, et montre aujourd'hui s'il est proche.
  const marge = zoom === 'jour' ? 3 : zoom === 'semaine' ? 7 : 14;
  const premier = aujourdhui < plan.debut && ecart(aujourdhui, plan.debut) <= 30 ? aujourdhui : plan.debut;
  const dernier = aujourdhui > plan.fin && ecart(plan.fin, aujourdhui) <= 30 ? aujourdhui : plan.fin;
  const debut = addDays(premier, -marge);
  const fin = addDays(dernier, marge);
  const nbJours = ecart(debut, fin) + 1;
  const largeur = nbJours * px;
  const hauteur = ENTETE + lignes.length * LIGNE;
  const x = (d: string) => ecart(debut, d) * px;
  const y = (i: number) => ENTETE + i * LIGNE;
  const rang = new Map(lignes.map((l, i) => [l.tache.id, i]));

  // Graduations : un repère par mois ; par semaine ou par jour selon le zoom.
  const mois: { x: number; l: number; texte: string }[] = [];
  const jours: { x: number; d: string; texte: string; we: boolean }[] = [];
  for (let i = 0; i < nbJours; i++) {
    const d = addDays(debut, i);
    const dt = parse(d);
    const we = dt.getDay() === 0 || dt.getDay() === 6;
    if (i === 0 || dt.getDate() === 1) mois.push({ x: i * px, l: 0, texte: `${MOIS[dt.getMonth()]} ${dt.getFullYear()}` });
    if (zoom === 'jour') jours.push({ x: i * px, d, texte: String(dt.getDate()), we });
    else if (zoom === 'semaine') jours.push({ x: i * px, d, texte: dt.getDay() === 1 ? String(dt.getDate()) : '', we });
    else jours.push({ x: i * px, d, texte: '', we });
  }
  mois.forEach((m, i) => (m.l = (mois[i + 1]?.x ?? largeur) - m.x));

  const couleurBarre = (l: LignePlan) => (l.fait ? C.muted : l.conflit ? C.agressif : l.critique ? C.agressif : C.accent);

  // Flèches de dépendance : de la fin de la tâche précédente au début de la suivante.
  const fleches = lignes.flatMap(({ tache: t }) =>
    (t.apres ?? [])
      .filter((a) => rang.has(a) && rang.has(t.id))
      .map((a) => {
        const p = lignes[rang.get(a)!].ligne;
        const s = lignes[rang.get(t.id)!].ligne;
        const x1 = x(p.fin) + px;
        const y1 = y(rang.get(a)!) + LIGNE / 2;
        const x2 = x(s.debut);
        const y2 = y(rang.get(t.id)!) + LIGNE / 2;
        const coude = Math.max(x1 + 5, Math.min(x2 - 5, x1 + 8));
        const critique = p.critique && s.critique;
        return { cle: `${a}>${t.id}`, d: `M${x1},${y1} H${coude} V${y2} H${x2 - 3}`, tete: `${x2},${y2} ${x2 - 5},${y2 - 3.5} ${x2 - 5},${y2 + 3.5}`, critique };
      }),
  );

  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.line, borderRadius: 12, overflow: 'hidden', backgroundColor: C.surface }}>
      <View style={{ width: largeurNoms, borderRightWidth: 1, borderRightColor: C.line }}>
        <View style={{ height: ENTETE, justifyContent: 'flex-end', paddingHorizontal: 10, paddingBottom: 6, backgroundColor: C.sunk }}>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>Tâche</Text>
        </View>
        {lignes.map(({ tache: t, ligne: l, niveau }) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`${t.titre}, du ${l.debut} au ${l.fin}`}
            onPress={() => onOuvrir(t.id)}
            style={{ height: LIGNE, justifyContent: 'center', paddingLeft: 10 + niveau * 12, paddingRight: 8, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: ouverte === t.id ? alpha(C.accent, 0.1) : 'transparent' }}>
            <Text numberOfLines={1} style={{ color: l.fait ? C.muted : C.ink, fontFamily: l.resume ? F.texteF : F.texte, fontSize: 13, textDecorationLine: l.fait ? 'line-through' : 'none' }}>
              {t.titre}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator style={{ flex: 1 }}>
        <Svg width={largeur} height={hauteur}>
          <Rect x={0} y={0} width={largeur} height={ENTETE} fill={C.sunk} />
          {jours.filter((j) => j.we).map((j) => (
            <Rect key={`w${j.d}`} x={j.x} y={ENTETE} width={px} height={hauteur - ENTETE} fill={alpha(C.muted, 0.08)} />
          ))}
          {mois.map((m) => (
            <G key={`m${m.x}`}>
              <Line x1={m.x} y1={0} x2={m.x} y2={hauteur} stroke={C.line} strokeWidth={1} />
              <SvgText x={m.x + 6} y={15} fontSize={11} fontFamily={F.texteM} fill={C.muted}>
                {m.l > 60 ? m.texte : MOIS[parse(addDays(debut, m.x / px)).getMonth()]}
              </SvgText>
            </G>
          ))}
          {jours.filter((j) => j.texte).map((j) => (
            <SvgText key={`j${j.d}`} x={j.x + px / 2} y={36} fontSize={10} fontFamily={F.texte} fill={C.muted} textAnchor="middle">
              {j.texte}
            </SvgText>
          ))}
          {lignes.map((_, i) => (
            <Line key={`l${i}`} x1={0} y1={y(i)} x2={largeur} y2={y(i)} stroke={C.line} strokeWidth={1} />
          ))}
          {/* Aujourd'hui */}
          {aujourdhui >= debut && aujourdhui <= fin ? <Line x1={x(aujourdhui) + px / 2} y1={ENTETE - 6} x2={x(aujourdhui) + px / 2} y2={hauteur} stroke={C.hebdo} strokeWidth={1.5} strokeDasharray="4 3" /> : null}
          {fleches.map((f) => (
            <G key={f.cle}>
              <Path d={f.d} stroke={f.critique ? C.agressif : C.muted} strokeWidth={1.2} fill="none" />
              <Polygon points={f.tete} fill={f.critique ? C.agressif : C.muted} />
            </G>
          ))}
          {lignes.map(({ tache: t, ligne: l }, i) => {
            const x0 = x(l.debut);
            const w = Math.max(px, (ecart(l.debut, l.fin) + 1) * px);
            const cy = y(i) + LIGNE / 2;
            const sel = ouverte === t.id;
            if (l.jalon && !l.resume)
              return (
                <G key={t.id} onPress={() => onOuvrir(t.id)}>
                  <Polygon points={`${x0 + px / 2},${cy - 9} ${x0 + px / 2 + 9},${cy} ${x0 + px / 2},${cy + 9} ${x0 + px / 2 - 9},${cy}`} fill={l.fait ? C.muted : C.hebdo} stroke={sel ? C.ink : 'none'} strokeWidth={2} />
                </G>
              );
            if (l.resume)
              return (
                <G key={t.id} onPress={() => onOuvrir(t.id)}>
                  <Rect x={x0} y={cy - 4} width={w} height={8} rx={2} fill={alpha(C.ink, 0.7)} />
                  <Polygon points={`${x0},${cy + 4} ${x0 + 7},${cy + 4} ${x0},${cy + 11}`} fill={alpha(C.ink, 0.7)} />
                  <Polygon points={`${x0 + w},${cy + 4} ${x0 + w - 7},${cy + 4} ${x0 + w},${cy + 11}`} fill={alpha(C.ink, 0.7)} />
                </G>
              );
            const col = couleurBarre(l);
            return (
              <G key={t.id} onPress={() => onOuvrir(t.id)}>
                <Rect x={x0} y={cy - 9} width={w} height={18} rx={5} fill={alpha(col, l.fait ? 0.35 : 0.28)} stroke={sel ? C.ink : col} strokeWidth={sel ? 2 : l.conflit ? 1.5 : 1} strokeDasharray={l.conflit ? '3 2' : undefined} />
                {l.avancement > 0 ? <Rect x={x0} y={cy - 9} width={(w * Math.min(100, l.avancement)) / 100} height={18} rx={5} fill={col} opacity={l.fait ? 0.6 : 0.9} /> : null}
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}
