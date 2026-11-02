import * as Linking from 'expo-linking';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Image, type ImageSourcePropType, type LayoutChangeEvent, Pressable, ScrollView, type ScrollViewInstance, Text, useWindowDimensions, View } from 'react-native';

import { fmtPrix, INCLUS_GRATUIT, TARIFS } from '@/lib/abonnement';
import { useZonesSures } from '@/lib/mise-en-page';
import { teinte, vive, type Vive } from '@/lib/teinte';
import { alpha, C, F } from '@/lib/theme';
import { useThemeCle } from '@/lib/theme-cle';

import { type IconeNom, Icone } from './icones';
import { LiensLegaux, urlLegale } from './liens-legaux';
import { SousOnglets } from './onglets';

/** Largeur du contenu de la page, et seuil à partir duquel elle passe en colonnes. */
const LARGEUR = 1200;
const SEUIL = 860;

/** Phrases d'exemple : ce que l'app comprend vraiment (voir `lirePhrase`). La première puce est le genre. */
const EXEMPLES: { label: string; phrase: string; puces: string[]; rubrique: string; titre: string; detail: string; badge: string; suite: string; couleur: Vive }[] = [
  { label: 'Relance', phrase: 'Relancer Paul jeudi pour le devis', puces: ['Relance', 'Paul', 'jeudi', 'Devis'], rubrique: 'Relances', titre: 'Relancer Paul', detail: 'Au sujet du devis', badge: 'Jeudi', suite: 'Ajoutée à tes relances, avec un rappel jeudi.', couleur: 'corail' },
  { label: 'Tâche', phrase: 'Envoyer la facture demain urgent', puces: ['Tâche', 'Envoyer la facture', 'demain', 'importante'], rubrique: 'Tâches', titre: 'Envoyer la facture', detail: 'Importante', badge: 'Demain', suite: 'Ajoutée à tes tâches, pour demain.', couleur: 'ambre' },
  { label: 'Habitude', phrase: 'Sport tous les jours', puces: ['Habitude', 'Sport', 'chaque jour'], rubrique: 'Habitudes', titre: 'Sport', detail: 'Chaque jour', badge: '+10 pts', suite: 'Ajoutée à tes habitudes, à cocher chaque jour.', couleur: 'menthe' },
  { label: 'Dépense', phrase: '20 usd resto hier', puces: ['Dépense', '20 $', 'Resto', 'hier'], rubrique: 'Finances', titre: 'Resto', detail: 'Hier', badge: '20 $', suite: 'Ajoutée à tes dépenses, convertie dans ta devise.', couleur: 'indigo' },
];

/** Les rubriques, chacune dans sa couleur, comme dans l'app. */
const RUBRIQUES: { nom: string; texte: string; exemple: string; etat: string; couleur: Vive; pro?: boolean }[] = [
  { nom: 'Relances', texte: 'Me te dit qui relancer et quand, et prépare le brouillon du message.', exemple: 'Paul · devis', etat: 'Jeudi', couleur: 'corail' },
  { nom: 'Tâches', texte: 'Tâches, projets et sous-tâches, avec un rappel à la date qui compte.', exemple: 'Envoyer le contrat signé', etat: 'Aujourd’hui', couleur: 'ambre' },
  { nom: 'Habitudes', texte: 'Coche chaque jour, garde ta série et gagne des points.', exemple: 'Lecture · 20 min', etat: '6 j de série', couleur: 'menthe' },
  { nom: 'Finances', texte: 'Budgets, revenus et prévisions dans ta devise, avec ton relevé bancaire importé.', exemple: 'Courses · reste du mois', etat: '120 $', couleur: 'indigo' },
  { nom: 'Mails', texte: 'Gmail et Outlook dans l’app : un mail devient une relance ou une tâche.', exemple: 'Sophie · proposition', etat: 'Lié', couleur: 'lagon', pro: true },
  { nom: 'Copilote', texte: 'Pose une question, reçois ton plan du jour et tes brouillons de relance.', exemple: 'Plan du jour', etat: '5 étapes', couleur: 'lilas', pro: true },
];

const ATOUTS: { icone: IconeNom; titre: string; texte: string; court: string; couleur: Vive }[] = [
  { icone: 'cloche', titre: 'Un rappel à ta façon', texte: 'Discret, insistant ou en coach : tu choisis le ton de chaque tâche et de chaque habitude.', court: 'Discret, insistant ou en coach.', couleur: 'ambre' },
  { icone: 'portefeuille', titre: 'Dans ta devise', texte: 'Dollars, euros, FCFA ou 15 autres devises, converties pour toi. Ton relevé CSV s’importe en un geste.', court: 'Dollars, euros, FCFA et 15 autres.', couleur: 'indigo' },
  { icone: 'micro', titre: 'À la voix ou au clavier', texte: 'Dicte ta phrase quand tu as les mains prises. Me la comprend comme si tu l’avais tapée.', court: 'Dicte ta phrase, les mains prises.', couleur: 'lilas' },
  { icone: 'onde', titre: 'Sur tous tes appareils', texte: 'Téléphone ou ordinateur : ce que tu modifies à deux endroits est fusionné, jamais écrasé.', court: 'Téléphone et ordinateur, toujours à jour.', couleur: 'menthe' },
];

/** Captures de l'app (données d'exemple), prises sur téléphone (390 px) et sur ordinateur (1280 px). */
const ECRANS: { key: 'journee' | 'budgets' | 'projets'; court: string; titre: string; texte: string; couleur: Vive; tel: ImageSourcePropType; altTel: string; pc: ImageSourcePropType; altPc: string }[] = [
  {
    key: 'journee',
    court: 'Ta journée',
    titre: 'Ta journée en un coup d’œil',
    texte: 'Qui relancer, quoi faire, quelles habitudes cocher.',
    couleur: 'indigo',
    tel: require('@/assets/images/apercu/tel-accueil.jpg'),
    altTel: "L'écran Aujourd'hui : la mission du jour, le prochain rendez-vous et la liste des choses à faire",
    pc: require('@/assets/images/apercu/pc-finances.jpg'),
    altPc: 'Finances sur ordinateur : le dépensé du mois, le reste, et les dépenses jour par jour face au budget',
  },
  {
    key: 'budgets',
    court: 'Budgets',
    titre: 'Des budgets qui tiennent',
    texte: 'Par jour, par mois ou jusqu’à une date, avec ce qu’il te reste à dépenser.',
    couleur: 'indigo',
    tel: require('@/assets/images/apercu/tel-budgets.jpg'),
    altTel: "L'onglet Budgets de Finances : un budget total, des budgets par catégorie et un budget de vacances",
    pc: require('@/assets/images/apercu/pc-finances.jpg'),
    altPc: 'Finances sur ordinateur : le dépensé du mois, le reste, et les dépenses jour par jour face au budget',
  },
  {
    key: 'projets',
    court: 'Projets',
    titre: 'Des projets planifiés',
    texte: 'Tâches, sous-tâches et planning, ajoutés à la main ou importés d’Excel.',
    couleur: 'rose',
    tel: require('@/assets/images/apercu/tel-projet.jpg'),
    altTel: 'Un projet et ses tâches, avec les dates, les responsables et la voie critique',
    pc: require('@/assets/images/apercu/pc-planning.jpg'),
    altPc: "Le planning d'un projet sur ordinateur : un diagramme de Gantt avec la voie critique et la date du jour",
  },
];

const QUESTIONS: { question: string; reponse: string }[] = [
  { question: 'Faut-il payer pour commencer ?', reponse: `Non. Ton compte commence avec ${TARIFS.essaiJours} jours de Pro offerts, sans moyen de paiement. À la fin, tu restes en Gratuit et tu gardes toutes tes données.` },
  { question: 'Comment se fait le paiement ?', reponse: 'Par mobile money (M-Pesa, Orange Money ou Airtel Money) avec FlexPaie, en une fois pour un mois ou pour un an.' },
  { question: 'L’abonnement se renouvelle-t-il tout seul ?', reponse: 'Non. Me te prévient avant la fin de ta période, et tu choisis de continuer ou non.' },
  { question: 'Puis-je l’utiliser sur téléphone et ordinateur ?', reponse: 'Oui. Tu retrouves les mêmes données partout, et ce que tu modifies à deux endroits est fusionné.' },
];

const SECTIONS = [
  { key: 'rubriques', label: 'Fonctionnalités' },
  { key: 'apercu', label: 'Aperçu' },
  { key: 'tarifs', label: 'Tarifs' },
  { key: 'questions', label: 'Questions' },
] as const;
type Section = (typeof SECTIONS)[number]['key'];

/* ——— Petits éléments ——— */

function Logo({ taille = 36 }: { taille?: number }) {
  const t = teinte(vive('indigo'));
  return (
    <View style={{ width: taille, height: taille, borderRadius: taille * 0.3, backgroundColor: t.c, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.encre, fontSize: taille * 0.44, fontFamily: F.titre, letterSpacing: -0.5 }}>Me</Text>
    </View>
  );
}

const Point = ({ c, taille = 8 }: { c: string; taille?: number }) => <View style={{ width: taille, height: taille, borderRadius: taille / 2, backgroundColor: c }} />;

/** Bouton de la page : plein (indigo), en surface, ou sans fond. */
function Bouton({ label, onPress, kind = 'plein', grand, accessibilityLabel }: { label: string; onPress: () => void; kind?: 'plein' | 'surface' | 'texte'; grand?: boolean; accessibilityLabel?: string }) {
  const t = teinte(vive('indigo'));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: grand ? 52 : 44,
        paddingHorizontal: grand ? 24 : 18,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: kind === 'plein' ? t.c : kind === 'surface' ? C.surface : 'transparent',
        borderWidth: kind === 'surface' ? 1 : 0,
        borderColor: C.line,
        opacity: pressed ? 0.85 : 1,
      })}>
      <Text style={{ color: kind === 'plein' ? t.encre : C.ink, fontFamily: F.texteF, fontSize: grand ? 16 : 15, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

function Titre2({ children, large, centre }: { children: string; large: boolean; centre?: boolean }) {
  return (
    <Text accessibilityRole="header" aria-level={2} style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 40 : 28, lineHeight: large ? 46 : 33, letterSpacing: large ? -0.8 : -0.6, textAlign: centre ? 'center' : 'left' }}>
      {children}
    </Text>
  );
}

const Intro = ({ children, centre }: { children: ReactNode; centre?: boolean }) => (
  <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 16, lineHeight: 25, maxWidth: 580, textAlign: centre ? 'center' : 'left' }}>{children}</Text>
);

const Coche = ({ c, size = 16 }: { c: string; size?: number }) => <Text style={{ color: c, fontFamily: F.texteF, fontSize: size, lineHeight: size + 6 }}>✓</Text>;

/** Le contenu de la page, centré, avec une marge sur les côtés. */
const Bloc = ({ children, large, style }: { children: ReactNode; large: boolean; style?: object }) => (
  <View style={[{ width: '100%', maxWidth: LARGEUR + (large ? 64 : 32), alignSelf: 'center', paddingHorizontal: large ? 32 : 16 }, style]}>{children}</View>
);

/* ——— Héros : la démo de l'ajout en une phrase ——— */

/** La phrase se tape, se range en puces, puis devient une ligne de l'app. Figée si l'appareil demande de réduire les animations. */
function Demo({ large }: { large: boolean }) {
  const [i, setI] = useState(0);
  const [lettres, setN] = useState(0);
  const [puces, setVues] = useState(0);
  const [fige, setFige] = useState(false);
  const [auto, setAuto] = useState(true);
  const ex = EXEMPLES[i];
  const n = fige ? ex.phrase.length : lettres;
  const vues = fige ? ex.puces.length : puces;
  const fini = n >= ex.phrase.length && vues >= ex.puces.length;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setFige)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (fige) return;
    const t =
      n < ex.phrase.length
        ? setTimeout(() => setN(n + 1), n === 0 ? 500 : 40)
        : vues < ex.puces.length
          ? setTimeout(() => setVues(vues + 1), 240)
          : auto
            ? setTimeout(() => choisir((i + 1) % EXEMPLES.length, true), 3200)
            : undefined;
    return () => clearTimeout(t);
  }, [i, n, vues, fige, ex, auto]);

  function choisir(k: number, suite = false) {
    if (!suite) setAuto(false);
    setI(k);
    setN(0);
    setVues(0);
  }

  const t = teinte(vive(ex.couleur));
  return (
    <View style={{ width: '100%', maxWidth: 520, gap: 14, alignSelf: large ? 'flex-end' : 'stretch' }}>
      <View
        accessible
        accessibilityLabel={`Exemple : « ${ex.phrase} » devient : ${ex.rubrique}, ${ex.titre}, ${ex.badge}.`}
        style={{ gap: 14, padding: large ? 20 : 16, borderRadius: 22, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, shadowColor: '#000', shadowOpacity: C.sombre ? 0.35 : 0.08, shadowRadius: 30, shadowOffset: { width: 0, height: 16 }, elevation: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Point c={t.c} />
          <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 15 }}>Ajouter en une phrase</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingLeft: 14, paddingRight: 10, paddingVertical: 10, borderRadius: 14, backgroundColor: C.sunk, borderWidth: 1, borderColor: t.ligne }}>
          <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: large ? 18 : 16, lineHeight: large ? 26 : 23 }}>
            {ex.phrase.slice(0, n)}
            {!fige && n < ex.phrase.length ? <Text style={{ color: t.c }}>▏</Text> : null}
          </Text>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icone nom="micro" color={C.ink} size={17} />
          </View>
        </View>
        <View style={{ gap: 8, minHeight: 58 }}>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, opacity: vues ? 1 : 0 }}>Me a compris</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {ex.puces.slice(0, vues).map((p, k) => (
              <Text
                key={`${i}-${p}`}
                style={{ fontSize: 13, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', fontFamily: k ? F.texteM : F.texteF, color: k ? C.ink : t.encre, backgroundColor: k ? alpha(t.c, 0.14) : t.c }}>
                {p}
              </Text>
            ))}
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: C.line }} />
        <View style={{ gap: 10, opacity: fini ? 1 : 0.35 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Point c={t.c} taille={6} />
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>{ex.rubrique}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: t.douce, borderWidth: 1, borderColor: t.ligne }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: t.c }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>{ex.titre}</Text>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{ex.detail}</Text>
            </View>
            <Text style={{ color: t.c, fontFamily: F.texteF, fontSize: 13 }}>{ex.badge}</Text>
          </View>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{ex.suite}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, marginRight: 4 }}>Essaie :</Text>
        {EXEMPLES.map((e, k) => {
          const on = k === i;
          const c = vive(e.couleur);
          return (
            <Pressable
              key={e.label}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Exemple : ${e.label}`}
              onPress={() => choisir(k)}
              style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: on ? c : C.line, backgroundColor: on ? alpha(c, C.sombre ? 0.16 : 0.1) : 'transparent', opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ color: on ? C.ink : C.muted, fontFamily: F.texteF, fontSize: 14 }}>{e.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Heros({ large, onConnexion, onInscription }: { large: boolean; onConnexion: () => void; onInscription: () => void }) {
  const menthe = teinte(vive('menthe'));
  return (
    <Bloc large={large} style={{ paddingTop: large ? 88 : 32, paddingBottom: large ? 104 : 40 }}>
      <View style={{ flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', gap: large ? 64 : 32 }}>
        <View style={{ flex: large ? 1 : undefined, gap: large ? 24 : 20 }}>
          <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, paddingRight: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: menthe.douce, borderWidth: 1, borderColor: menthe.ligne }}>
            <Point c={menthe.c} />
            <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>{large ? `${TARIFS.essaiJours} jours de Pro offerts, sans moyen de paiement` : `${TARIFS.essaiJours} jours de Pro offerts`}</Text>
          </View>
          <Text accessibilityRole="header" aria-level={1} style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 60 : 38, lineHeight: large ? 64 : 42, letterSpacing: large ? -1.6 : -1 }}>
            Dis-le en une phrase. <Text style={{ color: vive('indigo') }}>Me</Text> s’occupe du reste.
          </Text>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: large ? 18 : 16, lineHeight: large ? 28 : 24, maxWidth: 500 }}>
            Relances, tâches, habitudes et dépenses au même endroit. Tu écris ou tu dis ce que tu as en tête, Me le range au bon endroit et te le rappelle au bon moment.
          </Text>
          <View style={{ flexDirection: large ? 'row' : 'column', gap: large ? 12 : 8, marginTop: 4 }}>
            <Bouton grand label="Créer mon compte gratuit" onPress={onInscription} />
            <Bouton grand kind={large ? 'surface' : 'texte'} label="J’ai déjà un compte" onPress={onConnexion} />
          </View>
          {large ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
              {['Gratuit pour l’essentiel', 'Téléphone et ordinateur', 'Dans ta devise'].map((x) => (
                <View key={x} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Coche c={menthe.c} size={14} />
                  <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14 }}>{x}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <View style={{ flex: large ? 1 : undefined }}>
          <Demo large={large} />
        </View>
      </View>
    </Bloc>
  );
}

/* ——— Rubriques ——— */

function Rubriques({ large }: { large: boolean }) {
  const lilas = vive('lilas');
  const badgePro = (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: alpha(lilas, 0.45) }}>
      <Text style={{ color: lilas, fontFamily: F.texteF, fontSize: 11 }}>Pro</Text>
    </View>
  );
  return (
    <Bloc large={large} style={{ gap: large ? 40 : 20, paddingBottom: large ? 112 : 40, paddingTop: large ? 0 : 40, borderTopWidth: large ? 0 : 1, borderTopColor: C.line }}>
      <View style={{ gap: 8 }}>
        <Titre2 large={large}>Tout ce que tu suis, au même endroit.</Titre2>
        <Intro>Chaque rubrique a sa couleur, ici comme dans l’app.</Intro>
      </View>
      {large ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {RUBRIQUES.map((r) => {
            const t = teinte(vive(r.couleur));
            return (
              <View key={r.nom} style={{ flexBasis: '31%', flexGrow: 1, gap: 14, padding: 24, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Point c={t.c} taille={10} />
                    <Text accessibilityRole="header" aria-level={3} style={{ color: C.ink, fontFamily: F.titreM, fontSize: 20 }}>
                      {r.nom}
                    </Text>
                  </View>
                  {r.pro ? badgePro : null}
                </View>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 15, lineHeight: 23, minHeight: 46 }}>{r.texte}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
                  <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: t.c }} />
                  <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 13 }}>{r.exemple}</Text>
                  <Text style={{ color: t.c, fontFamily: F.texteF, fontSize: 13 }}>{r.etat}</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={{ borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
          {RUBRIQUES.map((r, k) => {
            const t = teinte(vive(r.couleur));
            return (
              <View key={r.nom} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, borderTopWidth: k ? 1 : 0, borderTopColor: C.line }}>
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: t.douce, alignItems: 'center', justifyContent: 'center' }}>
                  <Point c={t.c} taille={10} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text accessibilityRole="header" aria-level={3} style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>
                      {r.nom}
                    </Text>
                    {r.pro ? badgePro : null}
                  </View>
                  <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14, lineHeight: 21 }}>{r.texte}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Bloc>
  );
}

/* ——— Aperçu : les captures de l'app ——— */

function Capture({ image, alt, ratio, rayon = 0 }: { image: ImageSourcePropType; alt: string; ratio: number; rayon?: number }) {
  return (
    <View style={{ width: '100%', aspectRatio: ratio, borderRadius: rayon, overflow: 'hidden' }}>
      <Image source={image} accessibilityLabel={alt} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
    </View>
  );
}

function Telephone({ image, alt, largeur }: { image: ImageSourcePropType; alt: string; largeur: number }) {
  return (
    <View style={{ width: largeur, padding: 6, borderRadius: 32, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 6 }}>
      <Capture image={image} alt={alt} ratio={600 / 1298} rayon={26} />
    </View>
  );
}

function Apercu({ large }: { large: boolean }) {
  const [cle, setCle] = useState<(typeof ECRANS)[number]['key']>('journee');
  const e = ECRANS.find((x) => x.key === cle)!;
  return (
    <View style={{ backgroundColor: C.sunk, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line }}>
      <Bloc large={large} style={{ paddingVertical: large ? 104 : 40 }}>
        {large ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 56 }}>
            <View style={{ width: 360, gap: 28 }}>
              <View style={{ gap: 10 }}>
                <Titre2 large>Voilà à quoi ça ressemble.</Titre2>
                <Intro>Les mêmes données sur ton téléphone et sur ton ordinateur.</Intro>
              </View>
              <View accessibilityRole="radiogroup" style={{ gap: 6 }}>
                {ECRANS.map((x) => {
                  const on = x.key === cle;
                  return (
                    <Pressable
                      key={x.key}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setCle(x.key)}
                      style={({ pressed }) => ({ gap: 4, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 16, borderWidth: 1, borderColor: on ? C.line : 'transparent', backgroundColor: on ? C.surface : 'transparent', opacity: pressed ? 0.85 : 1 })}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Point c={on ? vive(x.couleur) : C.line} />
                        <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 18 }}>{x.titre}</Text>
                      </View>
                      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14, lineHeight: 21, paddingLeft: 18 }}>{x.texte}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ flex: 1, paddingBottom: 48, paddingRight: 24 }}>
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  {[0, 1, 2].map((k) => (
                    <Point key={k} c={C.line} taille={10} />
                  ))}
                </View>
                <Capture image={e.pc} alt={e.altPc} ratio={1440 / 900} />
              </View>
              <View style={{ position: 'absolute', right: 0, bottom: 0 }}>
                <Telephone image={e.tel} alt={e.altTel} largeur={200} />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 20 }}>
            <View style={{ gap: 8 }}>
              <Titre2 large={false}>Voilà à quoi ça ressemble.</Titre2>
              <Intro>Les mêmes données sur ton téléphone et sur ton ordinateur.</Intro>
            </View>
            <SousOnglets label="Écran affiché" options={ECRANS.map((x) => ({ key: x.key, label: x.court }))} value={cle} onChange={setCle} />
            <View style={{ alignItems: 'center', gap: 16 }}>
              <Telephone image={e.tel} alt={e.altTel} largeur={240} />
              <View style={{ gap: 4 }}>
                <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 18, textAlign: 'center' }}>{e.titre}</Text>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>{e.texte}</Text>
              </View>
            </View>
          </View>
        )}
      </Bloc>
    </View>
  );
}

/* ——— Atouts ——— */

function Atouts({ large }: { large: boolean }) {
  return (
    <Bloc large={large} style={{ gap: large ? 40 : 20, paddingVertical: large ? 112 : 40 }}>
      <Titre2 large={large}>Pensé pour ta façon de faire.</Titre2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: large ? 32 : 12 }}>
        {ATOUTS.map((a) => {
          const t = teinte(vive(a.couleur));
          return (
            <View
              key={a.titre}
              style={[
                { flexGrow: 1, gap: large ? 12 : 10 },
                large ? { flexBasis: '22%' } : { flexBasis: '45%', padding: 16, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
              ]}>
              <View style={{ width: large ? 44 : 36, height: large ? 44 : 36, borderRadius: large ? 13 : 11, backgroundColor: t.douce, alignItems: 'center', justifyContent: 'center' }}>
                <Icone nom={a.icone} color={t.c} size={large ? 20 : 18} />
              </View>
              <Text accessibilityRole="header" aria-level={3} style={{ color: C.ink, fontFamily: F.titreM, fontSize: large ? 18 : 15, lineHeight: large ? 24 : 20 }}>
                {a.titre}
              </Text>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: large ? 15 : 13, lineHeight: large ? 23 : 19 }}>{large ? a.texte : a.court}</Text>
            </View>
          );
        })}
      </View>
    </Bloc>
  );
}

/* ——— Tarifs ——— */

function Offre({ pro, annuel, large, onInscription }: { pro: boolean; annuel: boolean; large: boolean; onInscription: () => void }) {
  const t = teinte(vive(pro ? 'indigo' : 'menthe'));
  const prix = pro ? fmtPrix(annuel ? TARIFS.annuel : TARIFS.mensuel, TARIFS.devise) : `0 ${fmtPrix(0, TARIFS.devise).split(' ').pop()}`;
  const periode = pro ? (annuel ? 'par an' : 'par mois') : 'pour toujours';
  const note = pro ? (annuel ? `Soit ${fmtPrix(Math.round(TARIFS.annuel / 12), TARIFS.devise)} par mois.` : 'Payé pour un mois, sans engagement.') : 'L’essentiel, sans limite de durée.';
  const lignes = pro ? TARIFS.pro : INCLUS_GRATUIT;
  return (
    <View style={{ flex: large ? 1 : undefined, gap: large ? 20 : 16, padding: large ? 28 : 22, borderRadius: large ? 24 : 22, backgroundColor: pro ? t.douce : C.surface, borderWidth: pro ? 1.5 : 1, borderColor: pro ? t.c : C.line }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Point c={t.c} taille={10} />
            <Text accessibilityRole="header" aria-level={3} style={{ color: C.ink, fontFamily: F.titreM, fontSize: large ? 20 : 18 }}>
              {pro ? 'Pro' : 'Gratuit'}
            </Text>
          </View>
          {pro ? (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: t.c }}>
              <Text style={{ color: t.encre, fontFamily: F.texteF, fontSize: 12 }}>{TARIFS.essaiJours} jours offerts</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 44 : 38, lineHeight: large ? 52 : 46, letterSpacing: -1 }}>{prix}</Text>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 15 }}>{periode}</Text>
        </View>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14 }}>{note}</Text>
      </View>
      <View style={{ gap: 10, flex: large ? 1 : undefined }}>
        {pro ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14 }}>Tout Gratuit, plus :</Text> : null}
        {lignes.map((l) => (
          <View key={l} style={{ flexDirection: 'row', gap: 10 }}>
            <Coche c={t.c} size={15} />
            <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 22 }}>{l}</Text>
          </View>
        ))}
      </View>
      {pro ? (
        <Bouton label={`Essayer ${TARIFS.essaiJours} jours gratuits`} accessibilityLabel={`Créer mon compte, offre Pro ${annuel ? 'annuelle' : 'mensuelle'}`} onPress={onInscription} />
      ) : (
        <Bouton kind="surface" label="Commencer gratuitement" accessibilityLabel="Créer mon compte, offre Gratuit" onPress={onInscription} />
      )}
    </View>
  );
}

function Tarifs({ large, onInscription }: { large: boolean; onInscription: () => void }) {
  const [periode, setPeriode] = useState<'mois' | 'an'>('an');
  const cgv = urlLegale('cgv');
  const annuel = periode === 'an';
  return (
    <Bloc large={large} style={{ gap: large ? 32 : 20, paddingBottom: large ? 112 : 40, paddingTop: large ? 0 : 40, borderTopWidth: large ? 0 : 1, borderTopColor: C.line, alignItems: large ? 'center' : 'stretch' }}>
      <View style={{ gap: 8, alignItems: large ? 'center' : 'flex-start' }}>
        <Titre2 large={large} centre={large}>
          Des tarifs simples.
        </Titre2>
        <Intro centre={large}>Chaque compte commence avec {TARIFS.essaiJours} jours de Pro offerts. Ensuite, tu restes en Gratuit ou tu passes à Pro.</Intro>
      </View>
      <View style={{ width: large ? 380 : '100%' }}>
        <SousOnglets
          label="Période de paiement"
          options={[
            { key: 'mois', label: 'Mensuel' },
            { key: 'an', label: 'Annuel · 2 mois offerts' },
          ]}
          value={periode}
          onChange={setPeriode}
        />
      </View>
      <View style={{ width: '100%', maxWidth: 880, flexDirection: large ? 'row' : 'column', alignItems: 'stretch', gap: large ? 20 : 16 }}>
        {large ? <Offre pro={false} annuel={annuel} large onInscription={onInscription} /> : null}
        <Offre pro annuel={annuel} large={large} onInscription={onInscription} />
        {large ? null : <Offre pro={false} annuel={annuel} large={false} onInscription={onInscription} />}
      </View>
      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: large ? 14 : 13, lineHeight: large ? 22 : 20, maxWidth: 720, textAlign: large ? 'center' : 'left' }}>
        Prix TTC en dollars. Paiement par mobile money (M-Pesa, Orange Money, Airtel Money) avec FlexPaie,{' '}
        <Text style={{ color: C.ink, fontFamily: F.texteM }}>sans renouvellement automatique</Text> : Me te prévient avant la fin.
        {cgv ? (
          <>
            {' '}
            <Text accessibilityRole="link" onPress={() => Linking.openURL(cgv)} style={{ color: vive('indigo'), textDecorationLine: 'underline' }}>
              Conditions de vente
            </Text>
          </>
        ) : null}
      </Text>
    </Bloc>
  );
}

/* ——— Questions ——— */

function Questions({ large }: { large: boolean }) {
  const [ouverte, setOuverte] = useState(0);
  return (
    <Bloc large={large} style={{ paddingBottom: large ? 112 : 40, paddingTop: large ? 0 : 40, borderTopWidth: large ? 0 : 1, borderTopColor: C.line }}>
      <View style={{ flexDirection: large ? 'row' : 'column', gap: large ? 56 : 16 }}>
        <View style={{ width: large ? 360 : undefined }}>
          <Titre2 large={large}>Questions fréquentes</Titre2>
        </View>
        <View style={{ flex: large ? 1 : undefined, borderTopWidth: 1, borderTopColor: C.line }}>
          {QUESTIONS.map((q, k) => {
            const on = k === ouverte;
            return (
              <View key={q.question} style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: on }}
                  onPress={() => setOuverte(on ? -1 : k)}
                  style={({ pressed }) => ({ minHeight: large ? 64 : 56, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 })}>
                  <Text style={{ flex: 1, color: C.ink, fontFamily: F.texteF, fontSize: large ? 17 : 15 }}>{q.question}</Text>
                  <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 18, transform: [{ rotate: on ? '45deg' : '0deg' }] }}>+</Text>
                </Pressable>
                {on ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: large ? 15 : 14, lineHeight: large ? 24 : 22, paddingBottom: 18, paddingRight: large ? 40 : 0 }}>{q.reponse}</Text> : null}
              </View>
            );
          })}
        </View>
      </View>
    </Bloc>
  );
}

/* ——— Dernier appel et pied de page ——— */

function Final({ large, onConnexion, onInscription }: { large: boolean; onConnexion: () => void; onInscription: () => void }) {
  return (
    <Bloc large={large} style={{ paddingBottom: large ? 96 : 40 }}>
      <View style={{ flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', justifyContent: 'space-between', gap: large ? 40 : 14, padding: large ? 56 : 24, borderRadius: large ? 28 : 24, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
        <View style={{ gap: 12, maxWidth: 620, flexShrink: 1 }}>
          <Titre2 large={large}>Ta première relance en moins d’une minute.</Titre2>
          <Intro>Crée ton compte, écris une phrase, Me fait le reste.</Intro>
        </View>
        <View style={{ gap: 8 }}>
          <Bouton grand label="Créer mon compte gratuit" onPress={onInscription} />
          {large ? <Bouton kind="texte" label="Se connecter" onPress={onConnexion} /> : null}
        </View>
      </View>
    </Bloc>
  );
}

function Pied({ large }: { large: boolean }) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.line }}>
      <Bloc large={large} style={{ paddingTop: large ? 28 : 24, paddingBottom: 40, flexDirection: large ? 'row' : 'column', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Logo taille={28} />
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14 }}>Ton assistant personnel</Text>
        </View>
        <LiensLegaux centre={!large} />
      </Bloc>
    </View>
  );
}

/* ——— La page ——— */

/** Page d'accueil montrée aux visiteurs non connectés : ce que fait l'app, puis connexion ou inscription. */
export function AccueilPublic({ onConnexion, onInscription }: { onConnexion: () => void; onInscription: () => void }) {
  const large = useWindowDimensions().width >= SEUIL;
  const cle = useThemeCle();
  const { haut, bas } = useZonesSures();
  const defile = useRef<ScrollViewInstance>(null);
  // Position de chaque section, mesurée à l'affichage : le menu du haut y fait défiler la page.
  const [positions, setPositions] = useState<Partial<Record<Section, number>>>({});
  const repere = (s: Section) => ({ onLayout: (e: LayoutChangeEvent) => setPositions((p) => ({ ...p, [s]: e.nativeEvent.layout.y })) });
  const aller = (s: Section) => defile.current?.scrollTo({ y: Math.max(0, (positions[s] ?? 0) - 16), animated: true });

  return (
    <View key={cle} style={{ flex: 1, backgroundColor: C.bg, paddingTop: haut }}>
      <ScrollView ref={defile} contentContainerStyle={{ paddingBottom: bas }}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
          <Bloc large={large} style={{ paddingVertical: large ? 20 : 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Logo taille={large ? 36 : 32} />
              <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: large ? 17 : 16 }}>Me</Text>
            </View>
            {large ? (
              <View accessibilityRole="menu" style={{ flexDirection: 'row', gap: 28 }}>
                {SECTIONS.map((s) => (
                  <Pressable key={s.key} accessibilityRole="link" onPress={() => aller(s.key)} hitSlop={8}>
                    {(e) => <Text style={{ color: (e as { hovered?: boolean }).hovered ? C.ink : C.muted, fontFamily: F.texteM, fontSize: 15 }}>{s.label}</Text>}
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Bouton kind={large ? 'texte' : 'surface'} label="Se connecter" onPress={onConnexion} />
              {large ? <Bouton label="Créer mon compte" onPress={onInscription} /> : null}
            </View>
          </Bloc>
        </View>

        <Heros large={large} onConnexion={onConnexion} onInscription={onInscription} />
        <View {...repere('rubriques')}>
          <Rubriques large={large} />
        </View>
        <View {...repere('apercu')}>
          <Apercu large={large} />
        </View>
        <Atouts large={large} />
        <View {...repere('tarifs')}>
          <Tarifs large={large} onInscription={onInscription} />
        </View>
        <View {...repere('questions')}>
          <Questions large={large} />
        </View>
        <Final large={large} onConnexion={onConnexion} onInscription={onInscription} />
        <Pied large={large} />
      </ScrollView>
    </View>
  );
}
