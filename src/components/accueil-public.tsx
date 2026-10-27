import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, type ImageSourcePropType, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { fmtPrix, INCLUS_GRATUIT, TARIFS } from '@/lib/abonnement';
import { teinte, vive, type Vive } from '@/lib/teinte';
import { alpha, C, F } from '@/lib/theme';

import { type IconeNom, Icone } from './icones';
import { LiensLegaux, urlLegale } from './liens-legaux';
import { SousOnglets } from './onglets';
import { Btn, Screen } from './ui';

/** Phrases d'exemple : ce que l'app comprend vraiment (voir `lirePhrase`). La première puce est le genre. */
const EXEMPLES: { phrase: string; puces: string[]; suite: string; couleur: Vive }[] = [
  { phrase: 'Relancer Paul jeudi pour le devis', puces: ['Relance', 'Paul', 'jeudi', 'Devis'], suite: 'Ajoutée à tes relances, avec un rappel jeudi.', couleur: 'corail' },
  { phrase: 'Envoyer la facture demain urgent', puces: ['Tâche', 'Envoyer la facture', 'demain', 'importante'], suite: 'Ajoutée à tes tâches, pour demain.', couleur: 'ambre' },
  { phrase: 'Sport tous les jours', puces: ['Habitude', 'Sport', 'chaque jour'], suite: 'Ajoutée à tes habitudes, à cocher chaque jour.', couleur: 'menthe' },
  { phrase: '20 usd resto hier', puces: ['Dépense', '20 $', 'Resto', 'hier'], suite: 'Ajoutée à tes dépenses, convertie dans ta devise.', couleur: 'indigo' },
];

const ATOUTS: { icone: IconeNom; titre: string; texte: string; couleur: Vive }[] = [
  { icone: 'relances', titre: 'Les relances ne tombent plus dans l’oubli', texte: 'Me te dit qui relancer et quand, et prépare le brouillon du message.', couleur: 'corail' },
  { icone: 'taches', titre: 'Un rappel à ta façon pour chaque chose', texte: 'Discret, insistant ou en coach : tu choisis le mode de chaque tâche et habitude, et tu règles ce que fait chaque mode.', couleur: 'ambre' },
  { icone: 'portefeuille', titre: 'Tes finances dans ta devise', texte: 'Budgets, revenus, paiements récurrents et prévisions en dollars, euros, FCFA ou 15 autres devises, converties pour toi.', couleur: 'indigo' },
  { icone: 'stats', titre: 'Ton historique bancaire dans tes graphiques', texte: 'Importe le relevé CSV de ta banque : les opérations sont rangées par budget, avec leurs doublons repérés.', couleur: 'lagon' },
  { icone: 'onde', titre: 'Sur tous tes appareils', texte: 'Téléphone ou ordinateur : ce que tu modifies à deux endroits est fusionné, jamais écrasé.', couleur: 'menthe' },
];

/** Captures de l'app (données d'exemple), prises sur téléphone (390 px) et sur ordinateur (1280 px). */
const ECRANS: { image: ImageSourcePropType; titre: string; texte: string; alt: string }[] = [
  { image: require('@/assets/images/apercu/tel-accueil.jpg'), titre: 'Ta journée en un coup d’œil', texte: 'La mission du jour : qui relancer, quoi faire, quelles habitudes cocher, et les points à gagner.', alt: "L'écran Aujourd'hui : la carte de la mission du jour, le prochain rendez-vous et la liste des choses à faire" },
  { image: require('@/assets/images/apercu/tel-budgets.jpg'), titre: 'Des budgets qui tiennent', texte: 'Par jour, par mois ou jusqu’à une date, avec ce qu’il te reste à dépenser.', alt: "L'onglet Budgets de Finances : un budget total, des budgets par catégorie et un budget de vacances jusqu'à une date" },
  { image: require('@/assets/images/apercu/tel-projet.jpg'), titre: 'Des projets planifiés', texte: 'Tâches, sous-tâches et liens, ajoutés à la main ou importés d’Excel.', alt: 'Un projet et ses tâches, avec les dates, les responsables et la voie critique' },
];
const BUREAU = [
  { key: 'finances' as const, label: 'Finances', image: require('@/assets/images/apercu/pc-finances.jpg') as ImageSourcePropType, alt: "Finances sur ordinateur : le dépensé du mois, le reste, et les dépenses jour par jour face au budget" },
  { key: 'planning' as const, label: 'Planning', image: require('@/assets/images/apercu/pc-planning.jpg') as ImageSourcePropType, alt: "Le planning d'un projet sur ordinateur : un diagramme de Gantt avec la voie critique et la date du jour" },
];

/** Une image à ses proportions sur toute la largeur disponible (sur le web, Image prendrait sinon la hauteur du fichier). */
function Capture({ image, alt, ratio, rayon = 0 }: { image: ImageSourcePropType; alt: string; ratio: number; rayon?: number }) {
  return (
    <View style={{ width: '100%', aspectRatio: ratio, borderRadius: rayon, overflow: 'hidden' }}>
      <Image source={image} accessibilityLabel={alt} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
    </View>
  );
}

/** Une capture de l'app dans un cadre de téléphone. */
function Telephone({ image, alt, largeur }: { image: ImageSourcePropType; alt: string; largeur: number }) {
  return (
    <View style={{ width: largeur, padding: 6, borderRadius: 34, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 }}>
      <Capture image={image} alt={alt} ratio={600 / 1298} rayon={28} />
    </View>
  );
}

/** Captures de l'app : trois écrans de téléphone (qui défilent sur un petit écran), puis l'app sur ordinateur. */
function Apercu({ large }: { large: boolean }) {
  const [bureau, setBureau] = useState<(typeof BUREAU)[number]['key']>('finances');
  const vue = BUREAU.find((x) => x.key === bureau)!;
  const legende = (e: (typeof ECRANS)[number]) => (
    <View style={{ gap: 4 }}>
      <Text accessibilityRole="header" aria-level={3} style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17, lineHeight: 23 }}>{e.titre}</Text>
      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14, lineHeight: 21 }}>{e.texte}</Text>
    </View>
  );
  return (
    <View style={{ gap: large ? 40 : 28 }}>
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" aria-level={2} style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 32 : 26, lineHeight: large ? 38 : 32, letterSpacing: -0.6 }}>
          Voilà à quoi ça ressemble.
        </Text>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 16, lineHeight: 24, maxWidth: 520 }}>Sur ton téléphone comme sur ton ordinateur, avec les mêmes données.</Text>
      </View>
      {large ? (
        <View style={{ flexDirection: 'row', gap: 28 }}>
          {ECRANS.map((e) => (
            <View key={e.titre} style={{ flex: 1, gap: 18, alignItems: 'center' }}>
              <Telephone image={e.image} alt={e.alt} largeur={260} />
              <View style={{ width: 260 }}>{legende(e)}</View>
            </View>
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={256} decelerationRate="fast" style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingBottom: 16 }}>
          {ECRANS.map((e) => (
            <View key={e.titre} style={{ width: 240, gap: 14 }}>
              <Telephone image={e.image} alt={e.alt} largeur={240} />
              {legende(e)}
            </View>
          ))}
        </ScrollView>
      )}
      <View style={{ gap: 14 }}>
        <SousOnglets label="Écran affiché sur ordinateur" options={BUREAU.map((x) => ({ key: x.key, label: x.label }))} value={bureau} onChange={setBureau} />
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.line }}>
            {[0, 1, 2].map((k) => (
              <View key={k} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.line }} />
            ))}
          </View>
          <Capture image={vue.image} alt={vue.alt} ratio={1440 / 900} />
        </View>
      </View>
    </View>
  );
}

/** La phrase se tape, puis se range en puces : le seul mouvement de la page. Figé si l'appareil demande de réduire les animations. */
function Demo() {
  const [i, setI] = useState(0);
  const [lettres, setN] = useState(0);
  const [puces, setVues] = useState(0);
  const [fige, setFige] = useState(false);
  const ex = EXEMPLES[i];
  // Animations réduites : la phrase et les puces s'affichent en entier, sans défiler.
  const n = fige ? ex.phrase.length : lettres;
  const vues = fige ? ex.puces.length : puces;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setFige)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (fige) return;
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

  const c = vive(ex.couleur);
  return (
    <View style={{ width: '100%', maxWidth: 440 }}>
    {/* Une carte de couleur derrière, décalée : la démo a l'air posée sur la page. */}
    <View pointerEvents="none" style={{ position: 'absolute', left: 10, right: -6, top: 12, bottom: -10, borderRadius: 24, backgroundColor: alpha(c, 0.55), transform: [{ rotate: '2.5deg' }] }} />
    <View
      accessible
      accessibilityLabel={`Exemple : « ${EXEMPLES[0].phrase} » devient une relance pour Paul, jeudi, au sujet du devis.`}
      style={{ gap: 14, padding: 18, borderRadius: 22, backgroundColor: C.surface, borderWidth: 1, borderColor: alpha(c, 0.5), transform: [{ rotate: '-1deg' }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
        <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Dis-le en une phrase</Text>
      </View>
      <View style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
        <Text style={{ color: C.ink, fontFamily: F.texte, fontSize: 17, lineHeight: 24 }}>
          {ex.phrase.slice(0, n)}
          {!fige && n < ex.phrase.length ? <Text style={{ color: c }}>▏</Text> : null}
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
              color: k ? C.ink : teinte(c).encre,
              backgroundColor: k ? alpha(c, 0.14) : c,
            }}>
            {p}
          </Text>
        ))}
        </View>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, opacity: vues >= ex.puces.length && n >= ex.phrase.length ? 1 : 0 }}>{ex.suite}</Text>
      </View>
    </View>
    </View>
  );
}

/** Les quatre rubriques, chacune dans sa couleur, posées comme des autocollants. */
const RUBRIQUES: { icone: IconeNom; nom: string; couleur: Vive }[] = [
  { icone: 'relances', nom: 'Relances', couleur: 'corail' },
  { icone: 'taches', nom: 'Tâches', couleur: 'ambre' },
  { icone: 'habitudes', nom: 'Habitudes', couleur: 'menthe' },
  { icone: 'portefeuille', nom: 'Finances', couleur: 'indigo' },
];

function Autocollants() {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {RUBRIQUES.map((r, k) => {
        const t = teinte(vive(r.couleur));
        return (
          <View key={r.nom} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 7, paddingRight: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: t.douce, borderWidth: 1, borderColor: t.ligne, transform: [{ rotate: ['-2deg', '1.5deg', '-1deg', '2deg'][k % 4] }] }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.c, alignItems: 'center', justifyContent: 'center' }}>
              <Icone nom={r.icone} color={t.encre} size={14} />
            </View>
            <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>{r.nom}</Text>
          </View>
        );
      })}
    </View>
  );
}

type Offre = { nom: string; prix: string; periode: string; note?: string; avant: string; lignes: readonly string[]; couleur: Vive; plein?: boolean; sticker?: string };

const OFFRES: Offre[] = [
  { nom: 'Gratuit', prix: '0 $', periode: 'pour toujours', avant: 'L’essentiel, sans limite de durée :', lignes: INCLUS_GRATUIT, couleur: 'menthe' },
  { nom: 'Pro mensuel', prix: fmtPrix(TARIFS.mensuel, TARIFS.devise), periode: 'par mois', avant: 'Tout Gratuit, plus :', lignes: TARIFS.pro, couleur: 'indigo' },
  {
    nom: 'Pro annuel',
    prix: fmtPrix(TARIFS.annuel, TARIFS.devise),
    periode: 'par an',
    note: `soit ${fmtPrix(Math.round(TARIFS.annuel / 12), TARIFS.devise)} par mois`,
    avant: 'Tout Gratuit, plus :',
    lignes: TARIFS.pro,
    couleur: 'indigo',
    plein: true,
    sticker: '2 mois offerts',
  },
];

/** Une offre : prix en grand, ce qu'elle contient, et le bouton d'inscription. L'offre annuelle est pleine couleur. */
function CarteOffre({ o, large, onInscription }: { o: Offre; large: boolean; onInscription: () => void }) {
  const t = teinte(vive(o.couleur));
  const encre = o.plein ? t.encre : C.ink;
  const doux = o.plein ? alpha(t.encre, 0.75) : C.muted;
  return (
    <View
      style={{
        flex: large ? 1 : undefined,
        gap: 14,
        padding: 22,
        borderRadius: 24,
        backgroundColor: o.plein ? t.c : C.surface,
        borderWidth: o.plein ? 0 : 1.5,
        borderColor: o.plein ? 'transparent' : t.ligne,
      }}>
      {o.sticker ? (
        <View style={{ position: 'absolute', top: -12, right: 18, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: vive('ambre'), transform: [{ rotate: '3deg' }] }}>
          <Text style={{ color: teinte(vive('ambre')).encre, fontFamily: F.texteF, fontSize: 13 }}>{o.sticker}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: o.plein ? t.encre : t.c }} />
        <Text accessibilityRole="header" aria-level={3} style={{ color: encre, fontFamily: F.titreM, fontSize: 18 }}>
          {o.nom}
        </Text>
      </View>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ color: encre, fontFamily: F.titre, fontSize: 40, lineHeight: 46, letterSpacing: -1 }}>{o.prix}</Text>
          <Text style={{ color: doux, fontFamily: F.texteM, fontSize: 15 }}>{o.periode}</Text>
        </View>
        <Text style={{ color: doux, fontFamily: F.texte, fontSize: 13, minHeight: 18 }}>{o.note ?? ' '}</Text>
      </View>
      <View style={{ gap: 8, flex: large ? 1 : undefined }}>
        <Text style={{ color: doux, fontFamily: F.texteM, fontSize: 14 }}>{o.avant}</Text>
        {o.lignes.map((l) => (
          <View key={l} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ color: o.plein ? t.encre : t.c, fontFamily: F.texteF, fontSize: 14, lineHeight: 21 }}>✓</Text>
            <Text style={{ flex: 1, color: encre, fontFamily: F.texte, fontSize: 14, lineHeight: 21 }}>{l}</Text>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Créer mon compte, offre ${o.nom}`}
        onPress={onInscription}
        style={({ pressed }) => ({ marginTop: 4, paddingVertical: 13, borderRadius: 14, backgroundColor: o.plein ? t.encre : t.douce, borderWidth: o.plein ? 0 : 1, borderColor: t.ligne, opacity: pressed ? 0.85 : 1 })}>
        <Text style={{ color: o.plein ? t.c : C.ink, fontFamily: F.texteF, fontSize: 15, textAlign: 'center' }}>{o.nom === 'Gratuit' ? 'Commencer gratuitement' : `Essayer ${TARIFS.essaiJours} jours gratuits`}</Text>
      </Pressable>
    </View>
  );
}

/** Tarifs : les trois offres côte à côte (empilées sur téléphone), l'essai et les règles de paiement. */
function Tarifs({ large, onInscription }: { large: boolean; onInscription: () => void }) {
  const cgv = urlLegale('cgv');
  return (
    <View style={{ gap: large ? 32 : 24 }}>
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" aria-level={2} style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 32 : 26, lineHeight: large ? 38 : 32, letterSpacing: -0.6 }}>
          Des tarifs simples.
        </Text>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 16, lineHeight: 24, maxWidth: 560 }}>
          Chaque compte commence par{' '}
          <Text style={{ color: teinte(vive('menthe')).encre, backgroundColor: vive('menthe'), fontFamily: F.texteF }}> {TARIFS.essaiJours} jours de Pro offerts </Text>, sans moyen de paiement. Ensuite, tu restes en Gratuit ou tu passes à Pro.
        </Text>
      </View>
      <View style={{ flexDirection: large ? 'row' : 'column', alignItems: 'stretch', gap: large ? 18 : 22 }}>
        {OFFRES.map((o) => (
          <CarteOffre key={o.nom} o={o} large={large} onInscription={onInscription} />
        ))}
      </View>
      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, lineHeight: 20, maxWidth: 680 }}>
        Prix TTC en dollars. Paiement unique par mobile money (M-Pesa, Orange Money, Airtel Money) avec FlexPaie,{' '}
        <Text style={{ color: C.ink, fontFamily: F.texteM }}>sans renouvellement automatique</Text> : Me te prévient avant la fin, et tu choisis de continuer ou non.
        {cgv ? (
          <>
            {' '}
            <Text accessibilityRole="link" onPress={() => Linking.openURL(cgv)} style={{ color: vive('indigo'), textDecorationLine: 'underline' }}>
              Conditions de vente
            </Text>
          </>
        ) : null}
      </Text>
    </View>
  );
}

/** Dernier appel, dans un bloc de couleur : ce qui reste en tête en bas de la page. */
function Final({ large, onConnexion, onInscription }: { large: boolean; onConnexion: () => void; onInscription: () => void }) {
  const t = teinte(vive('indigo'));
  return (
    <View style={{ gap: 18, padding: large ? 40 : 24, borderRadius: 28, backgroundColor: t.c, overflow: 'hidden', alignItems: large ? 'flex-start' : 'stretch' }}>
      <View pointerEvents="none" style={{ position: 'absolute', right: -40, bottom: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: alpha(vive('rose'), 0.55) }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: -18, top: -24, width: 72, height: 72, borderRadius: 36, backgroundColor: alpha(vive('ambre'), 0.6) }} />
      <Text accessibilityRole="header" aria-level={2} style={{ color: t.encre, fontFamily: F.titre, fontSize: large ? 34 : 27, lineHeight: large ? 40 : 33, letterSpacing: -0.6, maxWidth: 560 }}>
        Ta première relance en moins d’une minute.
      </Text>
      <Text style={{ color: alpha(t.encre, 0.75), fontFamily: F.texte, fontSize: 16, lineHeight: 24, maxWidth: 480 }}>Sur ton téléphone et ton ordinateur, avec les mêmes données.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Pressable accessibilityRole="button" onPress={onInscription} style={({ pressed }) => ({ paddingVertical: 14, paddingHorizontal: 22, borderRadius: 14, backgroundColor: t.encre, opacity: pressed ? 0.9 : 1 })}>
          <Text style={{ color: t.c, fontFamily: F.texteF, fontSize: 16, textAlign: 'center' }}>Créer mon compte</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onConnexion} style={({ pressed }) => ({ paddingVertical: 14, paddingHorizontal: 22, borderRadius: 14, borderWidth: 1.5, borderColor: alpha(t.encre, 0.5), opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ color: t.encre, fontFamily: F.texteF, fontSize: 16, textAlign: 'center' }}>Se connecter</Text>
        </Pressable>
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
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: vive('indigo'), alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] }}>
              <Text style={{ color: teinte(vive('indigo')).encre, fontSize: 16, fontFamily: F.titre, letterSpacing: -0.5 }}>Me</Text>
            </View>
            <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>Ton assistant personnel</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onConnexion} hitSlop={8} style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
            <Text style={{ color: vive('indigo'), fontFamily: F.texteF, fontSize: 15 }}>Se connecter</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', gap: large ? 48 : 36 }}>
          {/* Une tache de couleur derrière le titre : la page a l'air dessinée, pas sortie d'un modèle. */}
          <View pointerEvents="none" style={{ position: 'absolute', left: large ? -60 : -70, top: large ? -70 : -50, width: 220, height: 220, borderRadius: 110, backgroundColor: alpha(vive('indigo'), C.sombre ? 0.07 : 0.06) }} />
          <View style={{ flex: large ? 1.2 : undefined, gap: 20 }}>
            <View accessibilityRole="header" aria-level={1} accessible accessibilityLabel="Dis-le en une phrase. Me s’occupe du reste.">
              <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 46 : 34, lineHeight: large ? 56 : 44, letterSpacing: -1 }}>
                Dis-le en <Text style={{ color: teinte(vive('ambre')).encre, backgroundColor: vive('ambre') }}>une phrase.</Text>
              </Text>
              <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 46 : 34, lineHeight: large ? 56 : 44, letterSpacing: -1 }}>
                <Text style={{ color: vive('indigo') }}>Me</Text> s’occupe du reste.
              </Text>
            </View>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 17, lineHeight: 26, maxWidth: 460 }}>
              Relances, tâches, habitudes et dépenses au même endroit, dans la devise de ton choix. Chaque action te rapporte des points.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
              <Btn label="Créer mon compte" onPress={onInscription} />
              <Btn kind="sec" label="J’ai déjà un compte" onPress={onConnexion} />
            </View>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>
              Gratuit pour l’essentiel · Pro dès {fmtPrix(TARIFS.mensuel, TARIFS.devise)} par mois · {TARIFS.essaiJours} jours de Pro offerts
            </Text>
            <Autocollants />
          </View>
          <View style={{ flex: large ? 1 : undefined, alignItems: large ? 'flex-end' : 'stretch' }}>
            <Demo />
          </View>
        </View>

        <Apercu large={large} />

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
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: vive(a.couleur), alignItems: 'center', justifyContent: 'center', transform: [{ rotate: k % 2 ? '4deg' : '-4deg' }] }}>
                <Icone nom={a.icone} color={teinte(vive(a.couleur)).encre} size={20} />
              </View>
              <View style={{ flex: 1, flexDirection: large ? 'row' : 'column', gap: large ? 32 : 4 }}>
                <Text accessibilityRole="header" aria-level={3} style={{ flex: large ? 1 : undefined, color: C.ink, fontFamily: F.titreM, fontSize: 18, lineHeight: 24 }}>
                  {a.titre}
                </Text>
                <Text style={{ flex: large ? 1.3 : undefined, color: C.muted, fontFamily: F.texte, fontSize: 15, lineHeight: 23, maxWidth: 520 }}>{a.texte}</Text>
              </View>
            </View>
          ))}
        </View>

        <Tarifs large={large} onInscription={onInscription} />

        <Final large={large} onConnexion={onConnexion} onInscription={onInscription} />

        <LiensLegaux centre={!large} />
      </View>
    </Screen>
  );
}
