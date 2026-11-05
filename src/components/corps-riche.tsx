import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/texte';

import { morceauxTexte, type BlocMail, type CelluleMail, type ImageDeMail, type MailRiche, type MorceauMail } from '@/lib/mails';
import { alpha, C, F } from '@/lib/theme';

/** Le corps d'un mail mis en forme : tableaux, images, listes ; la signature à part, en plus discret ; le message cité replié. */

type Ton = { muted?: boolean; petit?: boolean };

export const ouvrirMorceau = (t: 'lien' | 'mail' | 'tel', v: string) => Linking.openURL(t === 'lien' ? v : t === 'mail' ? `mailto:${v}` : `tel:${v.replace(/[^\d+]/g, '')}`).catch(() => {});
const ouvrirLien = (h: string) => Linking.openURL(h).catch(() => {});
const couleur = (t: Ton) => (t.muted ? C.muted : C.ink);
const taille = (t: Ton) => (t.petit ? { fontSize: 13, lineHeight: 19 } : { fontSize: 15, lineHeight: 23 });

function Morceaux({ m, ton, gras }: { m: MorceauMail[]; ton: Ton; gras?: boolean }) {
  return (
    <Text selectable style={{ color: couleur(ton), fontFamily: gras ? F.texteF : F.texte, ...taille(ton) }}>
      {m.map((x, i) => {
        const style = { ...(x.g ? { fontFamily: F.texteF } : null), ...(x.i ? { fontStyle: 'italic' as const } : null), ...(x.s ? { textDecorationLine: 'underline' as const } : null) };
        if (x.h) {
          const h = x.h;
          return (
            <Text key={i} accessibilityRole="link" onPress={() => ouvrirLien(h)} style={{ ...style, color: C.accent, textDecorationLine: 'underline' }}>
              {x.v}
            </Text>
          );
        }
        // Un numéro ou une adresse écrits en clair se touchent aussi.
        return (
          <Text key={i} style={style}>
            {morceauxTexte(x.v).map((p, j) =>
              p.t === 'texte' ? (
                p.v
              ) : (
                <Text key={j} accessibilityRole="link" onPress={() => ouvrirMorceau(p.t as 'lien', p.v)} style={{ color: C.accent, textDecorationLine: 'underline' }}>
                  {p.v}
                </Text>
              ),
            )}
          </Text>
        );
      })}
    </Text>
  );
}

function ImageMail({ im, petit }: { im: ImageDeMail; petit?: boolean }) {
  const [ratio, setRatio] = useState(im.l && im.h ? im.l / im.h : 0);
  const [rate, setRate] = useState(false);
  if (rate) return im.alt ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{im.alt}</Text> : null;
  const large = petit ? Math.min(im.l ?? 160, 180) : im.l;
  const image = (
    <Image
      accessibilityLabel={im.alt}
      source={{ uri: im.src }}
      resizeMode="contain"
      onError={() => setRate(true)}
      onLoad={(e) => {
        const s = e.nativeEvent?.source;
        if (!ratio && s?.width && s?.height) setRatio(s.width / s.height);
      }}
      style={{ width: large ?? '100%', maxWidth: '100%', aspectRatio: ratio || 1.6, borderRadius: 4 }}
    />
  );
  // La largeur écrite dans le mail, sans jamais déborder de l'écran.
  const cadre = { maxWidth: '100%' as const, ...(large ? { width: large } : { width: '100%' as const }) };
  if (!im.lien) return <View style={cadre}>{image}</View>;
  const lien = im.lien;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={im.alt || 'Ouvrir le lien de l’image'} onPress={() => ouvrirLien(lien)} style={cadre}>
      {image}
    </Pressable>
  );
}

/** Largeur d'une colonne, d'après le plus long texte qu'elle contient. */
export function largeursColonnes(lignes: CelluleMail[][]): number[] {
  const n = Math.max(...lignes.map((l) => l.reduce((s, c) => s + (c.span ?? 1), 0)));
  const out = new Array<number>(n).fill(0);
  for (const l of lignes) {
    let col = 0;
    for (const c of l) {
      const span = c.span ?? 1;
      if (span === 1 && col < n) {
        const plusLongue = Math.max(0, ...c.m.map((x) => x.v).join('').split('\n').map((t) => t.length));
        out[col] = Math.max(out[col], plusLongue);
      }
      col += span;
    }
  }
  return out.map((x) => Math.max(72, Math.min(240, x * 7.6 + 22)));
}

function TableauMail({ lignes, ton }: { lignes: CelluleMail[][]; ton: Ton }) {
  const largeurs = largeursColonnes(lignes);
  const bord = alpha(C.ink, 0.14);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }} style={{ borderWidth: 1, borderColor: bord, borderRadius: 10 }}>
      <View style={{ flexGrow: 1 }}>
        {lignes.map((l, i) => {
          let col = 0;
          return (
            <View key={i} style={{ flexDirection: 'row', borderTopWidth: i ? 1 : 0, borderTopColor: bord }}>
              {l.map((c, j) => {
                const span = c.span ?? 1;
                const w = largeurs.slice(col, col + span).reduce((a, b) => a + b, 0);
                col += span;
                return (
                  <View key={j} style={{ flexBasis: w, flexGrow: w, width: w, paddingVertical: 8, paddingHorizontal: 10, borderLeftWidth: j ? 1 : 0, borderLeftColor: bord, backgroundColor: c.entete ? C.sunk : 'transparent' }}>
                    <Morceaux m={c.m} ton={{ ...ton, petit: true }} gras={c.entete} />
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const queDesImages = (c: BlocMail[]) => c.every((b) => b.t === 'images');
/** Des initiales seules, à la place de la photo : « MK ». */
const initialesDe = (c: BlocMail[]) => {
  const b = c.length === 1 ? c[0] : null;
  const v = b?.t === 'p' ? b.m.map((x) => x.v).join('').trim() : '';
  return /^\p{Lu}{1,3}$/u.test(v) ? v : null;
};

function Blocs({ blocs, ton }: { blocs: BlocMail[]; ton: Ton }) {
  return (
    <View style={{ gap: ton.petit ? 6 : 10 }}>
      {blocs.map((b, i) => {
        switch (b.t) {
          case 'p':
            return <Morceaux key={i} m={b.m} ton={ton} />;
          case 'titre':
            return (
              <Text key={i} accessibilityRole="header" selectable style={{ color: couleur(ton), fontFamily: F.titre, fontSize: ton.petit ? 14 : 17, lineHeight: ton.petit ? 20 : 24 }}>
                {b.m.map((x) => x.v).join('')}
              </Text>
            );
          case 'liste':
            return (
              <View key={i} style={{ gap: 4 }}>
                {b.items.map((m, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ color: C.muted, fontFamily: F.texte, ...taille(ton) }}>{b.ordonnee ? `${j + 1}.` : '•'}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Morceaux m={m} ton={ton} />
                    </View>
                  </View>
                ))}
              </View>
            );
          case 'table':
            return <TableauMail key={i} lignes={b.lignes} ton={ton} />;
          case 'images':
            return (
              <View key={i} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                {b.items.map((im, j) => (
                  <ImageMail key={j} im={im} petit={ton.petit} />
                ))}
              </View>
            );
          case 'rangee':
            return (
              <View key={i} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {b.cellules.map((c, j) => {
                  const initiales = initialesDe(c);
                  if (initiales) {
                    return (
                      <View key={j} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(C.accent, 0.18) }}>
                        <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>{initiales}</Text>
                      </View>
                    );
                  }
                  return (
                    <View key={j} style={queDesImages(c) ? { maxWidth: '100%' } : { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0 }}>
                      <Blocs blocs={c} ton={ton} />
                    </View>
                  );
                })}
              </View>
            );
          case 'citation':
            return (
              <View key={i} style={{ paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: C.line }}>
                <Blocs blocs={b.blocs} ton={{ ...ton, muted: true }} />
              </View>
            );
          case 'trait':
            return <View key={i} style={{ height: 1, backgroundColor: C.line }} />;
          case 'bouton':
            return (
              <Pressable
                key={i}
                accessibilityRole="link"
                onPress={() => ouvrirLien(b.h)}
                style={({ pressed }) => ({ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 10, backgroundColor: C.accent, opacity: pressed ? 0.85 : 1 })}>
                <Text style={{ color: C.accentInk, fontFamily: F.texteM, fontSize: 14.5 }}>{b.v}</Text>
              </Pressable>
            );
        }
      })}
    </View>
  );
}

export function CorpsRiche({ riche }: { riche: MailRiche }) {
  const [voir, setVoir] = useState(false);
  return (
    <View style={{ gap: 14 }}>
      {riche.blocs.length ? <Blocs blocs={riche.blocs} ton={{}} /> : null}
      {riche.signature.length ? (
        <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line }}>
          <Blocs blocs={riche.signature} ton={{ muted: true, petit: true }} />
        </View>
      ) : null}
      {riche.cite.length ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: voir }}
            accessibilityLabel={voir ? 'Masquer le message cité' : 'Afficher le message cité'}
            onPress={() => setVoir((v) => !v)}
            style={({ pressed }) => ({ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? alpha(C.ink, 0.06) : C.sunk })}>
            <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 13 }}>{voir ? 'Masquer le message cité' : '··· Afficher le message cité'}</Text>
          </Pressable>
          {voir ? (
            <View style={{ paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: C.line }}>
              <Blocs blocs={riche.cite} ton={{ muted: true }} />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
