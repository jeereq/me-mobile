import * as Linking from 'expo-linking';
import { Pressable, View } from 'react-native';

import { CONTACT, lienTel, TELEPHONE } from '@/lib/contact';
import { C, F } from '@/lib/theme';

import { Bloc, Logo, SECTIONS, type Section } from './entete-public';
import { PAGES_LEGALES, urlLegale } from './liens-legaux';
import { Text } from './texte';

function LienPied({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
      {(e) => <Text style={{ color: (e as { hovered?: boolean }).hovered ? C.ink : C.muted, fontFamily: F.texte, fontSize: 14, lineHeight: 22 }}>{label}</Text>}
    </Pressable>
  );
}

/** Le pied des pages publiques. Sans `aller`, pas de sections où aller ; sans `onContact`, on est déjà sur la page Contact. `marge` : de quoi laisser la barre du bas. */
export function PiedPublic({ large, aller, onContact, marge = 0 }: { large: boolean; aller?: (s: Section) => void; onContact?: () => void; marge?: number }) {
  const pages = [{ page: 'a-propos', label: 'À propos' }, ...PAGES_LEGALES].map((p) => ({ ...p, url: urlLegale(p.page) })).filter((p) => p.url);
  const titre = (t: string) => <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14, marginBottom: 4 }}>{t}</Text>;
  return (
    <View style={{ paddingBottom: marge, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.sunk }}>
      <Bloc large={large} style={{ paddingTop: large ? 48 : 32, paddingBottom: 40, gap: large ? 40 : 28 }}>
        <View style={{ flexDirection: large ? 'row' : 'column', gap: large ? 64 : 28 }}>
          <View style={{ flex: large ? 1.4 : undefined, gap: 12, maxWidth: 360 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Logo taille={32} />
              <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>Me</Text>
            </View>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14, lineHeight: 22 }}>Ton assistant personnel, sur téléphone et ordinateur.</Text>
          </View>
          <View style={{ flex: large ? 2 : undefined, flexDirection: 'row', flexWrap: 'wrap', rowGap: 28, columnGap: large ? 64 : 40 }}>
            {aller ? (
              <View style={{ gap: 6, minWidth: 130 }}>
                {titre('Découvrir')}
                {SECTIONS.map((x) => (
                  <LienPied key={x.key} label={x.label} onPress={() => aller(x.key)} />
                ))}
              </View>
            ) : null}
            {pages.length ? (
              <View style={{ gap: 6, minWidth: 130 }}>
                {titre('Informations')}
                {pages.map((x) => (
                  <LienPied key={x.page} label={x.label} onPress={() => Linking.openURL(x.url!)} />
                ))}
              </View>
            ) : null}
            <View style={{ gap: 6, minWidth: 130 }}>
              {titre('Contact')}
              {onContact ? <LienPied label="Écrire un message" onPress={onContact} /> : null}
              <LienPied label={CONTACT} onPress={() => Linking.openURL(`mailto:${CONTACT}`)} />
              <LienPied label={TELEPHONE} onPress={() => Linking.openURL(lienTel)} />
            </View>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: C.line }} />
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, lineHeight: 20 }}>
          Prix en dollars, payés par mobile money avec FlexPaie. Tes données ne sont ni vendues ni utilisées pour de la publicité.
        </Text>
      </Bloc>
    </View>
  );
}
