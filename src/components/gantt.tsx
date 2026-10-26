import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { addDays, fmtCourt, parse } from '@/lib/dates';
import type { LignePlan, Plan } from '@/lib/planning';
import { alpha, C, F } from '@/lib/theme';
import type { Tache } from '@/lib/types';

export type Zoom = 'jour' | 'semaine' | 'mois';
/** Largeur minimale d'un jour selon le zoom ; le calendrier s'étire pour remplir la place quand le projet est court. */
export const ZOOMS: { key: Zoom; label: string; px: number }[] = [
  { key: 'jour', label: 'Jours', px: 40 },
  { key: 'semaine', label: 'Semaines', px: 18 },
  { key: 'mois', label: 'Mois', px: 7 },
];

const LIGNE = 48;
const ENTETE = 54;
const BARRE = 26;
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const ecart = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
const periode = (l: LignePlan) => (l.debut === l.fin ? fmtCourt(l.fin) : `${fmtCourt(l.debut)} → ${fmtCourt(l.fin)}`);

export type LigneGantt = { tache: Tache; ligne: LignePlan; niveau: number };

const couleurBarre = (l: LignePlan) => (l.fait ? C.muted : l.conflit || l.critique ? C.agressif : C.accent);

/** Ce qu'on lit à droite d'une barre : fait, la part faite, sinon la durée ; la date pour un jalon. */
const etiquette = (l: LignePlan) => (l.jalon && !l.resume ? fmtCourt(l.fin) : l.fait ? '✓' : l.avancement ? `${l.avancement} %` : l.resume ? '' : `${l.duree} j`);

/**
 * Planning de projet en diagramme de Gantt : une ligne par tâche (les résumés en barre fine), les jalons en losange,
 * les liens « après » en flèches, la voie critique en rouge, le jour courant en trait vertical.
 * Les noms restent à gauche pendant qu'on fait défiler le calendrier, qui s'ouvre sur aujourd'hui et remplit toute la largeur.
 */
export function Gantt({ lignes, plan, zoom, aujourdhui, onOuvrir, ouverte }: { lignes: LigneGantt[]; plan: Plan; zoom: Zoom; aujourdhui: string; onOuvrir: (id: string) => void; ouverte?: string | null }) {
  const largeurEcran = useWindowDimensions().width;
  // Colonne des noms : étroite au téléphone pour laisser la place au calendrier, avec les dates en dessous sur grand écran.
  const largeurNoms = largeurEcran < 600 ? 116 : largeurEcran < 1100 ? 210 : 260;
  const detaille = largeurNoms >= 200;
  const [dispo, setDispo] = useState(0);
  const defile = useRef<ScrollViewInstance>(null);

  const ok = !!lignes.length && !!plan.debut && !!plan.fin;
  // Le calendrier commence quelques jours avant le premier travail et finit après le dernier, et montre aujourd'hui s'il est proche.
  const marge = zoom === 'jour' ? 2 : zoom === 'semaine' ? 5 : 12;
  const pdebut = plan.debut ?? aujourdhui;
  const pfin = plan.fin ?? aujourdhui;
  const premier = aujourdhui < pdebut && ecart(aujourdhui, pdebut) <= 30 ? aujourdhui : pdebut;
  const dernier = aujourdhui > pfin && ecart(pfin, aujourdhui) <= 30 ? aujourdhui : pfin;
  const debut = addDays(premier, -marge);
  const fin = addDays(dernier, marge);
  const nbJours = ecart(debut, fin) + 1;
  const px = Math.max(ZOOMS.find((z) => z.key === zoom)!.px, dispo ? dispo / nbJours : 0);
  const largeur = Math.max(nbJours * px, dispo);
  const hauteur = ENTETE + lignes.length * LIGNE;
  const x = (d: string) => ecart(debut, d) * px;
  const y = (i: number) => ENTETE + i * LIGNE;
  const visibleAujourdhui = aujourdhui >= debut && aujourdhui <= fin;

  // À l'ouverture et à chaque zoom, le calendrier se place un peu avant aujourd'hui.
  useEffect(() => {
    if (!ok || !dispo || largeur <= dispo) return;
    const cible = visibleAujourdhui ? x(aujourdhui) - dispo * 0.2 : 0;
    defile.current?.scrollTo({ x: Math.max(0, Math.min(largeur - dispo, cible)), animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, dispo, ok]);

  if (!ok) return null;
  const rang = new Map(lignes.map((l, i) => [l.tache.id, i]));

  // Graduations : un repère par mois ; chaque jour quand il y a la place, sinon chaque lundi.
  const mois: { x: number; l: number; texte: string; court: string }[] = [];
  const jours: { x: number; d: string; texte: string; we: boolean }[] = [];
  for (let i = 0; i < nbJours; i++) {
    const d = addDays(debut, i);
    const dt = parse(d);
    const we = dt.getDay() === 0 || dt.getDay() === 6;
    if (i === 0 || dt.getDate() === 1) mois.push({ x: i * px, l: 0, texte: `${MOIS[dt.getMonth()]} ${dt.getFullYear()}`, court: MOIS[dt.getMonth()] });
    const texte = px >= 30 ? `${JOURS[dt.getDay()]} ${dt.getDate()}` : px >= 20 ? String(dt.getDate()) : px >= 6 && dt.getDay() === 1 ? String(dt.getDate()) : '';
    jours.push({ x: i * px, d, texte, we });
  }
  mois.forEach((m, i) => (m.l = (mois[i + 1]?.x ?? largeur) - m.x));

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
        const coude = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 10));
        const critique = p.critique && s.critique;
        return { cle: `${a}>${t.id}`, d: `M${x1},${y1} H${coude} V${y2} H${x2 - 4}`, tete: `${x2},${y2} ${x2 - 7},${y2 - 4.5} ${x2 - 7},${y2 + 4.5}`, critique };
      }),
  );

  return (
    <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.line, borderRadius: 14, overflow: 'hidden', backgroundColor: C.surface }}>
      <View style={{ width: largeurNoms, borderRightWidth: 1, borderRightColor: C.line }}>
        <View style={{ height: ENTETE, justifyContent: 'flex-end', paddingHorizontal: 12, paddingBottom: 8, backgroundColor: C.sunk }}>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Tâche</Text>
        </View>
        {lignes.map(({ tache: t, ligne: l, niveau }) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`${t.titre}, ${periode(l)}`}
            onPress={() => onOuvrir(t.id)}
            style={({ pressed }) => ({ height: LIGNE, justifyContent: 'center', gap: 1, paddingLeft: (detaille ? 12 : 10) + niveau * (detaille ? 12 : 8), paddingRight: 6, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: ouverte === t.id ? alpha(C.accent, 0.12) : pressed ? alpha(C.accent, 0.06) : 'transparent' })}>
            <Text numberOfLines={detaille ? 1 : 2} style={{ color: l.fait ? C.muted : C.ink, fontFamily: l.resume ? F.texteF : F.texte, fontSize: detaille ? 14 : 13, lineHeight: detaille ? 18 : 16, textDecorationLine: l.fait ? 'line-through' : 'none' }}>
              {l.jalon && !l.resume ? '◆ ' : ''}
              {t.titre}
            </Text>
            {detaille ? (
              <Text numberOfLines={1} style={{ color: !l.fait && l.fin < aujourdhui ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 12 }}>
                {periode(l)}
                {t.responsable ? ` · ${t.responsable}` : ''}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }} onLayout={(e) => setDispo(Math.floor(e.nativeEvent.layout.width))}>
        <ScrollView ref={defile} horizontal showsHorizontalScrollIndicator>
          <Svg width={largeur} height={hauteur}>
            <Rect x={0} y={0} width={largeur} height={ENTETE} fill={C.sunk} />
            {lignes.map(({ tache: t }, i) => (ouverte === t.id ? <Rect key={`s${t.id}`} x={0} y={y(i)} width={largeur} height={LIGNE} fill={alpha(C.accent, 0.08)} /> : null))}
            {px >= 6
              ? jours.filter((j) => j.we).map((j) => <Rect key={`w${j.d}`} x={j.x} y={ENTETE} width={px} height={hauteur - ENTETE} fill={alpha(C.muted, 0.08)} />)
              : null}
            {mois.map((m) => (
              <G key={`m${m.x}`}>
                <Line x1={m.x} y1={0} x2={m.x} y2={hauteur} stroke={C.line} strokeWidth={1} />
                <SvgText x={m.x + 8} y={20} fontSize={13} fontFamily={F.texteM} fill={C.ink}>
                  {m.l > 80 ? m.texte : m.l > 34 ? m.court : ''}
                </SvgText>
              </G>
            ))}
            {jours.filter((j) => j.texte).map((j) => (
              <SvgText key={`j${j.d}`} x={j.x + (px >= 20 ? px / 2 : 2)} y={44} fontSize={12} fontFamily={j.d === aujourdhui ? F.texteF : F.texte} fill={j.d === aujourdhui ? C.hebdo : C.muted} textAnchor={px >= 20 ? 'middle' : 'start'}>
                {j.texte}
              </SvgText>
            ))}
            {lignes.map((_, i) => (
              <Line key={`l${i}`} x1={0} y1={y(i)} x2={largeur} y2={y(i)} stroke={C.line} strokeWidth={1} />
            ))}
            {/* Aujourd'hui */}
            {visibleAujourdhui ? (
              <G>
                <Line x1={x(aujourdhui) + px / 2} y1={ENTETE} x2={x(aujourdhui) + px / 2} y2={hauteur} stroke={C.hebdo} strokeWidth={2} strokeDasharray="5 4" />
                <Circle cx={x(aujourdhui) + px / 2} cy={ENTETE} r={4} fill={C.hebdo} />
              </G>
            ) : null}
            {fleches.map((f) => (
              <G key={f.cle}>
                <Path d={f.d} stroke={f.critique ? C.agressif : C.muted} strokeWidth={1.5} fill="none" />
                <Polygon points={f.tete} fill={f.critique ? C.agressif : C.muted} />
              </G>
            ))}
            {lignes.map(({ tache: t, ligne: l }, i) => {
              const x0 = x(l.debut);
              const w = Math.max(px, (ecart(l.debut, l.fin) + 1) * px);
              const cy = y(i) + LIGNE / 2;
              const sel = ouverte === t.id;
              const texte = etiquette(l);
              const finBarre = l.jalon && !l.resume ? x0 + px / 2 + 13 : x0 + w;
              const label = texte && finBarre + 8 + texte.length * 7 < largeur ? (
                <SvgText x={finBarre + 8} y={cy + 4.5} fontSize={12} fontFamily={F.texteM} fill={l.fait ? C.coach : C.muted}>
                  {texte}
                </SvgText>
              ) : null;
              if (l.jalon && !l.resume)
                return (
                  <G key={t.id} onPress={() => onOuvrir(t.id)}>
                    <Polygon points={`${x0 + px / 2},${cy - 12} ${x0 + px / 2 + 12},${cy} ${x0 + px / 2},${cy + 12} ${x0 + px / 2 - 12},${cy}`} fill={l.fait ? C.muted : C.hebdo} stroke={sel ? C.ink : 'none'} strokeWidth={2} />
                    {label}
                  </G>
                );
              if (l.resume)
                return (
                  <G key={t.id} onPress={() => onOuvrir(t.id)}>
                    <Rect x={x0} y={cy - 5} width={w} height={10} rx={3} fill={alpha(C.ink, 0.72)} stroke={sel ? C.accent : 'none'} strokeWidth={2} />
                    <Polygon points={`${x0},${cy + 5} ${x0 + 8},${cy + 5} ${x0},${cy + 13}`} fill={alpha(C.ink, 0.72)} />
                    <Polygon points={`${x0 + w},${cy + 5} ${x0 + w - 8},${cy + 5} ${x0 + w},${cy + 13}`} fill={alpha(C.ink, 0.72)} />
                    {l.avancement ? (
                      <SvgText x={x0 + w + 8} y={cy + 4.5} fontSize={12} fontFamily={F.texteM} fill={C.muted}>
                        {`${l.avancement} %`}
                      </SvgText>
                    ) : null}
                  </G>
                );
              const col = couleurBarre(l);
              return (
                <G key={t.id} onPress={() => onOuvrir(t.id)}>
                  <Rect x={x0} y={cy - BARRE / 2} width={w} height={BARRE} rx={7} fill={alpha(col, l.fait ? 0.35 : 0.24)} stroke={sel ? C.ink : col} strokeWidth={sel ? 2 : l.conflit ? 1.5 : 1} strokeDasharray={l.conflit ? '4 3' : undefined} />
                  {l.avancement > 0 ? <Rect x={x0} y={cy - BARRE / 2} width={(w * Math.min(100, l.avancement)) / 100} height={BARRE} rx={7} fill={col} opacity={l.fait ? 0.6 : 0.9} /> : null}
                  {label}
                </G>
              );
            })}
          </Svg>
        </ScrollView>
      </View>
    </View>
  );
}

function Repere({ couleur, label, forme = 'barre' }: { couleur: string; label: string; forme?: 'barre' | 'losange' | 'trait' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {forme === 'losange' ? (
        <View style={{ width: 10, height: 10, marginHorizontal: 2, backgroundColor: couleur, transform: [{ rotate: '45deg' }] }} />
      ) : forme === 'trait' ? (
        <View style={{ width: 14, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: couleur }} />
      ) : (
        <View style={{ width: 18, height: 10, borderRadius: 3, backgroundColor: couleur }} />
      )}
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

/** Légende du planning : ce que veut dire chaque couleur et chaque forme. */
export function LegendeGantt() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 8 }}>
      <Repere couleur={C.accent} label="Tâche" />
      <Repere couleur={C.agressif} label="Voie critique" />
      <Repere couleur={C.muted} label="Terminée" />
      <Repere couleur={C.hebdo} label="Jalon" forme="losange" />
      <Repere couleur={C.hebdo} label="Aujourd’hui" forme="trait" />
    </View>
  );
}
