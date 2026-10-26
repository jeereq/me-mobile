import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { alpha, C, F } from '@/lib/theme';

import { type IconeNom, Icone } from './icones';
import { LiensLegaux } from './liens-legaux';
import { Btn, Screen } from './ui';

/** Phrases d'exemple : ce que l'app comprend vraiment (voir `lirePhrase`). La première puce est le genre. */
const EXEMPLES = [
  { phrase: 'Relancer Paul jeudi pour le devis', puces: ['Relance', 'Paul', 'jeudi', 'Devis'], suite: 'Ajoutée à tes relances, avec un rappel jeudi.' },
  { phrase: 'Envoyer la facture demain urgent', puces: ['Tâche', 'Envoyer la facture', 'demain', 'importante'], suite: 'Ajoutée à tes tâches, pour demain.' },
  { phrase: 'Sport tous les jours', puces: ['Habitude', 'Sport', 'chaque jour'], suite: 'Ajoutée à tes habitudes, à cocher chaque jour.' },
  { phrase: '20 usd resto hier', puces: ['Dépense', '20 $', 'Resto', 'hier'], suite: 'Ajoutée à tes dépenses, convertie dans ta devise.' },
];

const ATOUTS: { icone: IconeNom; titre: string; texte: string }[] = [
  { icone: 'relances', titre: 'Les relances ne tombent plus dans l’oubli', texte: 'me te dit qui relancer et quand, et prépare le brouillon du message.' },
  { icone: 'taches', titre: 'Un rappel à ta façon pour chaque chose', texte: 'Discret, insistant ou en coach : tu choisis le mode de chaque tâche et habitude, et tu règles ce que fait chaque mode.' },
  { icone: 'portefeuille', titre: 'Tes finances dans ta devise', texte: 'Budgets, revenus, paiements récurrents et prévisions en dollars, euros, FCFA ou 15 autres devises, converties pour toi.' },
  { icone: 'stats', titre: 'Ton historique bancaire dans tes graphiques', texte: 'Importe le relevé CSV de ta banque : les opérations sont rangées par budget, avec leurs doublons repérés.' },
  { icone: 'onde', titre: 'Sur tous tes appareils', texte: 'Téléphone ou ordinateur : ce que tu modifies à deux endroits est fusionné, jamais écrasé.' },
];

/** La phrase se tape, puis se range en puces : le seul mouvement de la page. Figé si l'appareil demande de réduire les animations. */
function Demo() {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const [vues, setVues] = useState(0);
  const [fige, setFige] = useState(false);
  const ex = EXEMPLES[i];

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setFige)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (fige) {
      setN(ex.phrase.length);
      setVues(ex.puces.length);
      return;
    }
    const t =
      n < ex.phrase.length
        ? setTimeout(() => setN(n + 1), n === 0 ? 600 : 45)
        : vues < ex.puces.length
          ? setTimeout(() => setVues(vues + 1), 280)
          : setTimeout(() => {
              setI((i + 1) % EXEMPLES.length);
              setN(0);
              setVues(0);
            }, 2800);
    return () => clearTimeout(t);
  }, [i, n, vues, fige, ex]);

  return (
    <View
      accessible
      accessibilityLabel={`Exemple : « ${EXEMPLES[0].phrase} » devient une relance pour Paul, jeudi, au sujet du devis.`}
      style={{ gap: 14, padding: 18, borderRadius: 22, backgroundColor: C.surface, borderWidth: 1, borderColor: C.accentLine, width: '100%', maxWidth: 440 }}>
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Dis-le en une phrase</Text>
      <View style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
        <Text style={{ color: C.ink, fontFamily: F.texte, fontSize: 17, lineHeight: 24 }}>
          {ex.phrase.slice(0, n)}
          {!fige && n < ex.phrase.length ? <Text style={{ color: C.accent }}>▏</Text> : null}
        </Text>
      </View>
      <View style={{ minHeight: 72, gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 6 }}>
        {ex.puces.slice(0, vues).map((p, k) => (
          <Text
            key={`${i}-${p}`}
            style={{
              fontSize: 13,
              paddingHorizontal: 11,
              paddingVertical: 5,
              borderRadius: 999,
              overflow: 'hidden',
              fontFamily: k ? F.texteM : F.texteF,
              color: k ? C.ink : C.accentInk,
              backgroundColor: k ? alpha(C.accent, 0.12) : C.accent,
            }}>
            {p}
          </Text>
        ))}
        </View>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, opacity: vues >= ex.puces.length && n >= ex.phrase.length ? 1 : 0 }}>{ex.suite}</Text>
      </View>
    </View>
  );
}

/** Page d'accueil montrée aux visiteurs non connectés : ce que fait l'app, puis connexion ou inscription. */
export function AccueilPublic({ onConnexion, onInscription }: { onConnexion: () => void; onInscription: () => void }) {
  const large = useWindowDimensions().width >= 860;
  return (
    <Screen>
      <View style={{ gap: large ? 72 : 52, paddingTop: 12, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.accentInk, fontSize: 16, fontFamily: F.titre, letterSpacing: -0.5 }}>me</Text>
            </View>
            <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>Ton assistant personnel</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onConnexion} hitSlop={8} style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
            <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 15 }}>Se connecter</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', gap: large ? 48 : 32 }}>
          <View style={{ flex: large ? 1.2 : undefined, gap: 20 }}>
            <View accessibilityRole="header" accessible accessibilityLabel="Dis-le en une phrase. me s’occupe du reste.">
              {['Dis-le en une phrase.', 'me s’occupe du reste.'].map((l) => (
                <Text key={l} style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 42 : 34, lineHeight: large ? 48 : 40, letterSpacing: -1 }}>
                  {l}
                </Text>
              ))}
            </View>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 17, lineHeight: 26, maxWidth: 460 }}>
              Relances, tâches, habitudes et dépenses au même endroit, dans la devise de ton choix. Chaque action te rapporte des points.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
              <Btn label="Créer mon compte" onPress={onInscription} />
              <Btn kind="sec" label="J’ai déjà un compte" onPress={onConnexion} />
            </View>
          </View>
          <View style={{ flex: large ? 1 : undefined, alignItems: large ? 'flex-end' : 'stretch' }}>
            <Demo />
          </View>
        </View>

        <View style={{ gap: 0 }}>
          {ATOUTS.map((a, k) => (
            <View
              key={a.titre}
              style={{
                flexDirection: 'row',
                gap: 16,
                paddingVertical: 20,
                borderTopWidth: 1,
                borderTopColor: C.line,
                ...(k === ATOUTS.length - 1 ? { borderBottomWidth: 1, borderBottomColor: C.line } : null),
              }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icone nom={a.icone} color={C.accent} size={20} />
              </View>
              <View style={{ flex: 1, flexDirection: large ? 'row' : 'column', gap: large ? 32 : 4 }}>
                <Text accessibilityRole="header" style={{ flex: large ? 1 : undefined, color: C.ink, fontFamily: F.titreM, fontSize: 18, lineHeight: 24 }}>
                  {a.titre}
                </Text>
                <Text style={{ flex: large ? 1.3 : undefined, color: C.muted, fontFamily: F.texte, fontSize: 15, lineHeight: 23, maxWidth: 520 }}>{a.texte}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ gap: 16, alignItems: large ? 'flex-start' : 'stretch' }}>
          <Text accessibilityRole="header" style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 32 : 26, lineHeight: large ? 38 : 32, letterSpacing: -0.6 }}>
            Ta première relance en moins d’une minute.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Btn label="Créer mon compte" onPress={onInscription} />
            <Btn kind="sec" label="Se connecter" onPress={onConnexion} />
          </View>
        </View>

        <LiensLegaux centre={!large} />
      </View>
    </Screen>
  );
}
