import * as Linking from 'expo-linking';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Image, type ImageSourcePropType, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, type ScrollViewInstance, useWindowDimensions, View } from 'react-native';
import { Text, TextInput } from '@/components/texte';

import { CONTACT, lienTel, TELEPHONE } from '@/lib/contact';
import { arreterEve, essayerEve, eveDisponible, jouerExtraitEve, MAX_ESSAI_EVE, PHRASE_EVE } from '@/lib/eve';
import { fmtPrix, INCLUS_FINANCES, INCLUS_GRATUIT, INCLUS_PRO, INCLUS_REUNIONS, parMois, TARIFS } from '@/lib/abonnement';
import { useZonesSures } from '@/lib/mise-en-page';
import { teinte, vive, type Vive } from '@/lib/teinte';
import { alpha, C, F, ombreAvant } from '@/lib/theme';
import { useThemeCle } from '@/lib/theme-cle';

import { type IconeNom, Icone } from './icones';
import { PAGES_LEGALES, urlLegale } from './liens-legaux';
import { SousOnglets } from './onglets';

/** Largeur du contenu de la page, et seuil à partir duquel elle passe en colonnes. */
const LARGEUR = 1200;
const SEUIL = 860;

/** Phrases d'exemple : ce que l'app comprend vraiment (voir `lirePhrase`). La première puce est le genre. */
const EXEMPLES: { label: string; phrase: string; puces: string[]; rubrique: string; titre: string; detail: string; badge: string; suite: string; couleur: Vive }[] = [
  { label: 'Relance', phrase: 'Relancer Paul jeudi pour le devis', puces: ['Relance', 'Paul', 'jeudi', 'Devis'], rubrique: 'Relances', titre: 'Relancer Paul', detail: 'Au sujet du devis', badge: 'Jeudi', suite: 'Ajoutée à tes relances, avec un rappel jeudi.', couleur: 'corail' },
  { label: 'Tâche', phrase: 'Envoyer la facture demain urgent', puces: ['Tâche', 'Envoyer la facture', 'demain', 'importante'], rubrique: 'Tâches', titre: 'Envoyer la facture', detail: 'Importante', badge: 'Demain', suite: 'Ajoutée à tes tâches, pour demain.', couleur: 'ambre' },
  { label: 'Habitude', phrase: 'Sport tous les jours', puces: ['Habitude', 'Sport', 'chaque jour'], rubrique: 'Habitudes', titre: 'Sport', detail: 'Chaque jour', badge: '+10 pts', suite: 'Ajoutée à tes habitudes, à cocher chaque jour.', couleur: 'menthe' },
  { label: 'Dépense', phrase: '20 usd resto hier', puces: ['Dépense', '20 $', 'Resto', 'hier'], rubrique: 'Finances', titre: 'Resto', detail: 'Hier', badge: '20 $', suite: 'Ajoutée à tes dépenses, dans la catégorie Restaurants.', couleur: 'indigo' },
];

/** Les rubriques, chacune dans sa couleur, comme dans l'app. */
const RUBRIQUES: { nom: string; texte: string; exemple: string; etat: string; couleur: Vive; pro?: boolean }[] = [
  { nom: 'Relances', texte: 'Qui relancer et quand.', exemple: 'Paul · devis', etat: 'Jeudi', couleur: 'corail' },
  { nom: 'Tâches', texte: 'Tâches, projets et sous-tâches, avec un rappel à la date qui compte.', exemple: 'Envoyer le contrat signé', etat: 'Aujourd’hui', couleur: 'ambre' },
  { nom: 'Habitudes', texte: 'Coche chaque jour, garde ta série et gagne des points.', exemple: 'Lecture · 20 min', etat: '6 j de série', couleur: 'menthe' },
  { nom: 'Finances', texte: 'Ce qu’il te reste à dépenser chaque jour.', exemple: 'Courses · reste du mois', etat: '74 $', couleur: 'indigo' },
  { nom: 'Mails', texte: 'Un mail devient une relance ou une tâche.', exemple: 'Sophie · proposition', etat: 'Lié', couleur: 'lagon', pro: true },
  { nom: 'Copilote', texte: 'Ton plan du jour et tes brouillons de relance.', exemple: 'Plan du jour', etat: '5 étapes', couleur: 'lilas', pro: true },
];

const ATOUTS: { icone: IconeNom; titre: string; texte: string; court: string; couleur: Vive }[] = [
  { icone: 'cloche', titre: 'Un rappel à ta façon', texte: 'Discret, insistant ou en coach.', court: 'Discret, insistant ou en coach.', couleur: 'ambre' },
  { icone: 'portefeuille', titre: 'Dans ta devise', texte: 'Dollars, francs congolais, euros, FCFA ou 14 autres.', court: 'Dollars, francs, euros, FCFA et 14 autres.', couleur: 'indigo' },
  { icone: 'micro', titre: 'À la voix ou au clavier', texte: 'Dicte ta phrase, Me la comprend.', court: 'Dicte ta phrase, les mains prises.', couleur: 'lilas' },
  { icone: 'onde', titre: 'Sur tous tes appareils', texte: 'Téléphone ou ordinateur : rien n’est écrasé.', court: 'Téléphone et ordinateur, toujours à jour.', couleur: 'menthe' },
];

/** Captures de l'app (données d'exemple au 18 novembre 2026), prises sur téléphone (390 px) et sur ordinateur (1440 px). */
const ECRANS: { key: 'journee' | 'finances' | 'projets'; court: string; titre: string; texte: string; couleur: Vive; tel: ImageSourcePropType; altTel: string; pc: ImageSourcePropType; altPc: string }[] = [
  {
    key: 'journee',
    court: 'Ta journée',
    titre: 'Ta journée en un coup d’œil',
    texte: 'La mission du jour, le prochain rendez-vous, qui relancer et quelles habitudes cocher.',
    couleur: 'indigo',
    tel: require('@/assets/images/apercu/tel-accueil.jpg'),
    altTel: "L'écran Aujourd'hui : la mission du jour, le prochain rendez-vous et la liste des choses à faire",
    pc: require('@/assets/images/apercu/pc-accueil.jpg'),
    altPc: "L'écran Aujourd'hui sur ordinateur : la mission du jour, les choses à faire, le résumé des finances et des objectifs",
  },
  {
    key: 'finances',
    court: 'Finances',
    titre: 'Des budgets qui tiennent',
    texte: 'Par jour, par mois ou jusqu’à une date.',
    couleur: 'indigo',
    tel: require('@/assets/images/apercu/tel-budgets.jpg'),
    altTel: "L'onglet Budgets de Finances : le budget total, les budgets à surveiller et l'enveloppe des fêtes avec son plan",
    pc: require('@/assets/images/apercu/pc-finances.jpg'),
    altPc: 'Finances sur ordinateur : ce qu’il reste à dépenser ce mois-ci, les budgets et les paiements à venir',
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

/** Ce que Finances fait dès l'offre Gratuit. */
const FINANCES_GRATUIT: { icone: IconeNom; titre: string; texte: string }[] = [
  { icone: 'jour', titre: 'Des budgets à ta mesure', texte: 'Par jour, par semaine, par mois ou jusqu’à une date.' },
  { icone: 'crayon', titre: 'Une dépense en une phrase', texte: '« 20 usd resto hier » suffit.' },
  { icone: 'etoile', titre: 'Des objectifs qui avancent', texte: 'Me calcule le versement de chaque mois.' },
];

/** Ce que la formule Finances ajoute, dans l'ordre de `INCLUS_FINANCES` (lib/abonnement.ts). */
const FINANCES_FORMULE: { icone: IconeNom; titre: string; texte: string }[] = [
  { icone: 'trombone', titre: 'Reçus et factures', texte: 'La photo du reçu ou le PDF de la facture, joint à la dépense.' },
  { icone: 'dossier', titre: 'Relevés importés', texte: 'Le relevé CSV de ta banque ou de ton mobile money, rangé sans doublon.' },
  { icone: 'portefeuille', titre: 'Comptes et devises', texte: 'Banque, M-Pesa et cash, chacun avec son solde, en dollars comme en francs.' },
  { icone: 'equipe', titre: 'Prêts et dettes', texte: 'Qui te doit quoi, ce que tu dois, et un rappel le jour prévu.' },
  { icone: 'calendrier', titre: 'Paiements à venir', texte: 'Loyer, internet, abonnements : Me te prévient la veille.' },
  { icone: 'stats', titre: 'Bilan du mois', texte: 'Où est parti ton argent, comparé au mois d’avant, envoyé le 1er.' },
  { icone: 'cloche', titre: 'Alertes de budget', texte: 'En push ou par email, dès 80 %, 90 % ou au dépassement.' },
];

/** Ce que Me fait de tes données : repris de public/confidentialite.html, à garder d'accord avec elle. */
const DONNEES: { icone: IconeNom; titre: string; texte: string }[] = [
  { icone: 'bouclier', titre: 'Ni vendues, ni publicité', texte: 'Tes données n’entraînent aucun modèle d’IA.' },
  { icone: 'portefeuille', titre: 'Jamais d’accès à ta banque', texte: 'Me ne te demande pas tes identifiants bancaires. Un relevé importé est lu sur ton appareil.' },
  { icone: 'archive', titre: 'Tout exporter', texte: 'Exporte tout depuis Mon compte.' },
  { icone: 'corbeille', titre: 'Tout supprimer', texte: 'Supprimer ton compte efface aussitôt ton espace et tes comptes connectés, définitivement.' },
];

const QUESTIONS: { question: string; reponse: string }[] = [
  { question: 'Faut-il payer pour commencer ?', reponse: `Non. Ton compte commence avec ${TARIFS.essaiJours} jours de tout Pro offerts, sans moyen de paiement. À la fin, tu restes en Gratuit et tu gardes toutes tes données, ou tu choisis Finances (${fmtPrix(TARIFS.finances.mensuel, TARIFS.devise)} par mois) ou Pro (${fmtPrix(TARIFS.pro.mensuel, TARIFS.devise)} par mois).` },
  { question: 'Mes réunions enregistrées sont-elles gardées ?', reponse: 'Non. L’audio est transcrit, puis jamais conservé.' },
  { question: 'Comment se fait le paiement ?', reponse: 'Par mobile money (M-Pesa, Orange Money ou Airtel Money) avec FlexPaie, en une fois pour un mois ou pour un an.' },
  { question: 'L’abonnement se renouvelle-t-il tout seul ?', reponse: 'Non. Me te prévient avant la fin de ta période, et tu choisis de continuer ou non.' },
  { question: 'Me se connecte-t-il à ma banque ?', reponse: 'Non. Me n’a jamais tes identifiants bancaires.' },
  { question: 'Puis-je l’utiliser sur téléphone et ordinateur ?', reponse: 'Oui. Tes données sont les mêmes partout.' },
];

const SECTIONS = [
  { key: 'finances', label: 'Finances' },
  { key: 'rubriques', label: 'Fonctionnalités' },
  { key: 'apercu', label: 'Aperçu' },
  // Dans le pied de page seulement : le menu du haut reste court.
  { key: 'donnees', label: 'Tes données', menu: false },
  { key: 'tarifs', label: 'Tarifs' },
  { key: 'questions', label: 'Questions' },
] as const;
type Section = (typeof SECTIONS)[number]['key'];

/* ——— Petits éléments ——— */

export function Logo({ taille = 36 }: { taille?: number }) {
  const t = teinte(vive('indigo'));
  return (
    <View style={{ width: taille, height: taille, borderRadius: taille * 0.3, backgroundColor: t.c, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.encre, fontSize: taille * 0.44, fontFamily: F.titre, letterSpacing: -0.5 }}>Me</Text>
    </View>
  );
}

const Point = ({ c, taille = 8 }: { c: string; taille?: number }) => <View style={{ width: taille, height: taille, borderRadius: taille / 2, backgroundColor: c }} />;

/** Bouton de la page : plein (indigo), en surface, ou sans fond. */
function Bouton({ label, onPress, kind = 'plein', grand, compact, accessibilityLabel }: { label: string; onPress: () => void; kind?: 'plein' | 'surface' | 'texte'; grand?: boolean; compact?: boolean; accessibilityLabel?: string }) {
  const t = teinte(vive('indigo'));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: grand ? 52 : compact ? 40 : 44,
        paddingHorizontal: grand ? 24 : compact ? 12 : 18,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: kind === 'plein' ? t.c : kind === 'surface' ? C.surface : 'transparent',
        ...(kind === 'plein' && !compact ? ombreAvant(t.c) : null),
        borderWidth: kind === 'surface' ? 1 : 0,
        borderColor: C.line,
        opacity: pressed ? 0.85 : 1,
      })}>
      <Text style={{ color: kind === 'plein' ? t.encre : C.ink, fontFamily: F.texteF, fontSize: grand ? 16 : compact ? 14 : 15, textAlign: 'center' }}>{label}</Text>
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
            Relances, tâches, habitudes et dépenses au même endroit.
          </Text>
          <View style={{ flexDirection: large ? 'row' : 'column', flexWrap: 'wrap', gap: large ? 12 : 8, marginTop: 4 }}>
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

/* ——— Finances, mises en avant ——— */

/** Une fonction de Finances : pictogramme, titre et une phrase. */
function Fonction({ icone, titre, texte, c, large }: { icone: IconeNom; titre: string; texte: string; c: string; large: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
      <View style={{ width: large ? 40 : 36, height: large ? 40 : 36, borderRadius: 12, backgroundColor: alpha(c, C.sombre ? 0.16 : 0.12), alignItems: 'center', justifyContent: 'center' }}>
        <Icone nom={icone} color={c} size={large ? 19 : 18} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text accessibilityRole="header" aria-level={3} style={{ color: C.ink, fontFamily: F.titreM, fontSize: large ? 17 : 16, lineHeight: large ? 23 : 21 }}>
          {titre}
        </Text>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: large ? 15 : 14, lineHeight: large ? 23 : 21 }}>{texte}</Text>
      </View>
    </View>
  );
}

/** Deux écrans de Finances, l'un devant l'autre : ce qu'il reste à dépenser et le bilan du mois. */
function DeuxTelephones({ largeur }: { largeur: number }) {
  const decale = Math.round(largeur * 0.62);
  const hauteur = Math.round((largeur - 12) * (1298 / 600)) + 12;
  return (
    <View style={{ width: largeur + decale, height: hauteur + 40, alignSelf: 'center' }}>
      <View style={{ position: 'absolute', left: 0, top: 40, opacity: 0.9 }}>
        <Telephone image={require('@/assets/images/apercu/tel-bilan.jpg')} alt="Le bilan du mois : dépensé, reçu, mis de côté, et où est parti l'argent par catégorie" largeur={largeur} />
      </View>
      <View style={{ position: 'absolute', left: decale, top: 0 }}>
        <Telephone image={require('@/assets/images/apercu/tel-finances.jpg')} alt="L'aperçu de Finances : ce qu'il reste à dépenser ce mois-ci, par jour, et le reste de chaque budget" largeur={largeur} />
      </View>
    </View>
  );
}

function Finances({ large, onInscription }: { large: boolean; onInscription: () => void }) {
  const t = teinte(vive('indigo'));
  const prix = fmtPrix(TARIFS.finances.mensuel, TARIFS.devise);
  const prixAn = fmtPrix(TARIFS.finances.annuel, TARIFS.devise);
  const formule = (
    <View style={{ gap: large ? 28 : 20, padding: large ? 32 : 20, borderRadius: large ? 28 : 22, backgroundColor: C.surface, borderWidth: 1.5, borderColor: t.ligne }}>
      <View style={{ flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', justifyContent: 'space-between', gap: large ? 32 : 14 }}>
        <View style={{ gap: 6, flexShrink: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Point c={t.c} taille={10} />
            <Text accessibilityRole="header" aria-level={3} style={{ color: C.ink, fontFamily: F.titreM, fontSize: large ? 22 : 19 }}>
              Va plus loin avec la formule Finances
            </Text>
          </View>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: large ? 15 : 14, lineHeight: large ? 23 : 21 }}>
            Tout ce qui précède reste gratuit.
          </Text>
        </View>
        <View style={{ flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', gap: large ? 20 : 12 }}>
          <View style={{ gap: 2, alignItems: large ? 'flex-end' : 'flex-start' }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 30 : 28, letterSpacing: -0.8 }}>{prix}</Text>
              <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>par mois</Text>
            </View>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>ou {prixAn} par an</Text>
          </View>
          <Bouton label={`Essayer ${TARIFS.essaiJours} jours gratuits`} accessibilityLabel="Créer mon compte et essayer Finances" onPress={onInscription} />
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: C.line }} />
      <View style={{ flexDirection: large ? 'row' : 'column', flexWrap: 'wrap', rowGap: large ? 28 : 18, columnGap: 28 }}>
        {FINANCES_FORMULE.map((x) => (
          <View key={x.titre} style={large ? { flexBasis: '22%', flexGrow: 1 } : undefined}>
            <Fonction {...x} c={t.c} large={large} />
          </View>
        ))}
        {large ? (
          <View style={{ flexBasis: '22%', flexGrow: 1, justifyContent: 'center', padding: 16, borderRadius: 16, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14, lineHeight: 21 }}>
              Pendant les {TARIFS.essaiJours} jours d’essai, tout est ouvert. Ensuite, tu choisis : Gratuit, Finances ou Pro.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={{ backgroundColor: alpha(t.c, C.sombre ? 0.05 : 0.06), borderTopWidth: 1, borderBottomWidth: 1, borderColor: t.ligne }}>
      <Bloc large={large} style={{ paddingVertical: large ? 104 : 40, gap: large ? 64 : 28 }}>
        <View style={{ flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', gap: large ? 64 : 28 }}>
          <View style={{ flex: large ? 1 : undefined, gap: large ? 32 : 20 }}>
            <View style={{ gap: 12 }}>
              <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, paddingRight: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: t.douce, borderWidth: 1, borderColor: t.ligne }}>
                <Point c={t.c} />
                <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>Finances</Text>
              </View>
              <Titre2 large={large}>Sache chaque jour ce qu’il te reste à dépenser.</Titre2>
              <Intro>Budgets, dépenses, revenus et objectifs sont gratuits.</Intro>
            </View>
            {/* Sur téléphone, les écrans viennent avant le détail. */}
            {large ? null : <DeuxTelephones largeur={190} />}
            <View style={{ gap: large ? 24 : 18 }}>
              {FINANCES_GRATUIT.map((x) => (
                <Fonction key={x.titre} {...x} c={t.c} large={large} />
              ))}
            </View>
          </View>
          {large ? (
            <View style={{ flex: 1, alignItems: 'center' }}>
              <DeuxTelephones largeur={250} />
            </View>
          ) : null}
        </View>
        {formule}
      </Bloc>
    </View>
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
    <Bloc large={large} style={{ gap: large ? 40 : 20, paddingVertical: large ? 112 : 40 }}>
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

export function Telephone({ image, alt, largeur }: { image: ImageSourcePropType; alt: string; largeur: number }) {
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

/* ——— Réunions ——— */

const ETAPES_REUNION: { icone: IconeNom; titre: string; texte: string }[] = [
  { icone: 'micro', titre: 'Tu enregistres', texte: 'Il continue écran verrouillé.' },
  { icone: 'compteRendu', titre: 'Me transcrit et résume', texte: 'Texte, résumé et décisions. L’audio n’est jamais conservé.' },
  { icone: 'taches', titre: 'Tu relis, puis tu ouvres', texte: 'Tâches et relances attribuées à ton équipe. Rien ne s’ouvre sans toi.' },
];

function Reunions({ large }: { large: boolean }) {
  const t = teinte(vive('lilas'));
  return (
    <Bloc large={large} style={{ paddingBottom: large ? 112 : 40, paddingTop: large ? 0 : 40, borderTopWidth: large ? 0 : 1, borderTopColor: C.line }}>
      <View style={{ gap: 10, alignItems: large ? 'center' : 'flex-start', marginBottom: large ? 32 : 20 }}>
        <Titre2 large={large} centre={large}>
          Enregistre ta réunion, Me s’occupe du reste.
        </Titre2>
        <Intro centre={large}>De la réunion à la liste de ce qui reste à faire, sans prendre une note : en Pro 1, 2 et 3, de {TARIFS.paliers[1].heures} à {TARIFS.paliers[3].heures} heures par mois.</Intro>
      </View>
      <View style={{ flexDirection: large ? 'row' : 'column', gap: large ? 20 : 12 }}>
        {ETAPES_REUNION.map((e, k) => (
          <View key={e.titre} style={{ flex: large ? 1 : undefined, gap: 12, padding: large ? 26 : 18, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: t.douce, alignItems: 'center', justifyContent: 'center' }}>
                <Icone nom={e.icone} color={t.c} size={20} />
              </View>
              <Text style={{ color: t.c, fontFamily: F.texteF, fontSize: 14 }}>{`Étape ${k + 1}`}</Text>
            </View>
            <Text accessibilityRole="header" aria-level={3} style={{ color: C.ink, fontFamily: F.titreM, fontSize: large ? 19 : 17 }}>
              {e.titre}
            </Text>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: large ? 15 : 14, lineHeight: large ? 23 : 21 }}>{e.texte}</Text>
          </View>
        ))}
      </View>
    </Bloc>
  );
}

/* ——— Tes données ——— */

function Donnees({ large }: { large: boolean }) {
  const menthe = teinte(vive('menthe'));
  const politique = urlLegale('confidentialite');
  return (
    <Bloc large={large} style={{ paddingBottom: large ? 112 : 40, paddingTop: large ? 0 : 40, borderTopWidth: large ? 0 : 1, borderTopColor: C.line }}>
      <View style={{ flexDirection: large ? 'row' : 'column', gap: large ? 56 : 20 }}>
        <View style={{ width: large ? 360 : undefined, gap: 10 }}>
          <Titre2 large={large}>Tes données restent à toi.</Titre2>
          <Intro>Tes budgets et tes dépenses restent à toi.</Intro>
          {politique ? (
            <Text accessibilityRole="link" onPress={() => Linking.openURL(politique)} style={{ color: vive('indigo'), fontFamily: F.texteM, fontSize: 15, textDecorationLine: 'underline', marginTop: 4 }}>
              Lire la politique de confidentialité
            </Text>
          ) : null}
        </View>
        <View style={{ flex: large ? 1 : undefined, flexDirection: 'row', flexWrap: 'wrap', gap: large ? 16 : 12 }}>
          {DONNEES.map((d) => (
            <View key={d.titre} style={{ flexBasis: large ? '45%' : '100%', flexGrow: 1, flexDirection: 'row', gap: 14, padding: large ? 22 : 16, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: menthe.douce, alignItems: 'center', justifyContent: 'center' }}>
                <Icone nom={d.icone} color={menthe.c} size={19} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text accessibilityRole="header" aria-level={3} style={{ color: C.ink, fontFamily: F.titreM, fontSize: large ? 17 : 16 }}>
                  {d.titre}
                </Text>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: large ? 15 : 14, lineHeight: large ? 23 : 21 }}>{d.texte}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Bloc>
  );
}

/* ——— Tarifs ——— */

type NomOffre = 'gratuit' | 'finances' | 'pro' | 'pro1' | 'pro2' | 'pro3';
const PALIER_DE = { pro1: 1, pro2: 2, pro3: 3 } as const;
const OFFRE_PUBLIQUE: Record<NomOffre, { nom: string; couleur: Vive; avant: string | null; lignes: readonly string[]; note: string }> = {
  gratuit: { nom: 'Gratuit', couleur: 'menthe', avant: null, lignes: INCLUS_GRATUIT, note: 'L’essentiel, sans limite de durée.' },
  finances: { nom: 'Finances', couleur: 'indigo', avant: 'Tout Gratuit, plus :', lignes: INCLUS_FINANCES, note: 'Pour tenir ton argent au propre.' },
  pro: { nom: 'Pro', couleur: 'lilas', avant: 'Tout Finances, plus :', lignes: INCLUS_PRO, note: 'Tout Me, avec le copilote IA.' },
  pro1: { nom: 'Pro 1', couleur: 'lilas', avant: 'Tout Pro, plus les réunions :', lignes: INCLUS_REUNIONS, note: 'Pour tes points de la semaine.' },
  pro2: { nom: 'Pro 2', couleur: 'lilas', avant: 'Tout Pro, plus les réunions :', lignes: INCLUS_REUNIONS, note: 'Pour un responsable d’équipe.' },
  pro3: { nom: 'Pro 3', couleur: 'lilas', avant: 'Tout Pro, plus les réunions :', lignes: INCLUS_REUNIONS, note: 'Pour qui enregistre tout.' },
};

function Offre({ offre, annuel, large, onInscription }: { offre: NomOffre; annuel: boolean; large: boolean; onInscription: () => void }) {
  const o = OFFRE_PUBLIQUE[offre];
  const t = teinte(vive(o.couleur));
  const payant = offre !== 'gratuit';
  const vedette = offre === 'pro';
  const palier = offre === 'pro1' || offre === 'pro2' || offre === 'pro3' ? PALIER_DE[offre] : 0;
  // Le prix d'un palier de réunions est celui de Pro plus ses heures.
  const tarifs = !payant ? null : palier ? { mensuel: TARIFS.pro.mensuel + TARIFS.paliers[palier].mensuel, annuel: TARIFS.pro.annuel + TARIFS.paliers[palier].annuel } : TARIFS[offre as 'finances' | 'pro'];
  const prix = tarifs ? fmtPrix(annuel ? tarifs.annuel : tarifs.mensuel, TARIFS.devise) : `0 ${fmtPrix(0, TARIFS.devise).split(' ').pop()}`;
  const periode = payant ? (annuel ? 'par an' : 'par mois') : 'pour toujours';
  const note = tarifs ? (annuel ? `Soit ${fmtPrix(parMois(tarifs.annuel), TARIFS.devise)} par mois.` : 'Sans engagement.') : o.note;
  const nom = o.nom;
  return (
    <View style={{ flex: large ? 1 : undefined, gap: large ? 20 : 16, padding: large ? 26 : 22, borderRadius: large ? 24 : 22, backgroundColor: vedette ? t.douce : C.surface, borderWidth: vedette ? 2 : 1, borderColor: vedette ? t.c : C.line, ...(vedette ? ombreAvant(t.c) : null) }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text accessibilityRole="header" aria-level={3} style={{ color: C.ink, fontFamily: F.titreM, fontSize: large ? 20 : 18 }}>
            {nom}
          </Text>
          {vedette ? (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: t.c }}>
              <Text style={{ color: t.encre, fontFamily: F.texteF, fontSize: 12 }}>{`${TARIFS.essaiJours} jours offerts`}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 40 : 36, lineHeight: large ? 48 : 44, letterSpacing: -1 }}>{prix}</Text>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 15 }}>{periode}</Text>
        </View>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14 }}>{note}</Text>
        {palier ? <Text style={{ color: t.c, fontFamily: F.texteF, fontSize: 15 }}>{`${TARIFS.paliers[palier].heures} h de réunion par mois`}</Text> : null}
      </View>
      <View style={{ gap: 10, flex: large ? 1 : undefined }}>
        {o.avant ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14 }}>{o.avant}</Text> : null}
        {o.lignes.map((l) => (
          <View key={l} style={{ flexDirection: 'row', gap: 10 }}>
            <Coche c={t.c} size={15} />
            <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 22 }}>{l}</Text>
          </View>
        ))}
      </View>
      {payant ? (
        <Bouton
          kind={vedette ? undefined : 'surface'}
          label={`Essayer ${TARIFS.essaiJours} jours gratuits`}
          accessibilityLabel={`Créer mon compte, formule ${nom} ${annuel ? 'annuelle' : 'mensuelle'}`}
          onPress={onInscription}
        />
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
        <Intro centre={large}>Chaque compte commence avec {TARIFS.essaiJours} jours de tout Pro offerts. Ensuite, tu restes en Gratuit ou tu choisis une formule.</Intro>
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
      <View style={{ width: '100%', maxWidth: 1120, flexDirection: large ? 'row' : 'column', alignItems: 'stretch', gap: large ? 20 : 16 }}>
        {/* Sur ordinateur, du moins cher au plus complet ; sur téléphone, Pro d'abord, Gratuit en dernier. */}
        {(large ? (['gratuit', 'finances', 'pro'] as const) : (['pro', 'finances', 'gratuit'] as const)).map((o) => (
          <Offre key={o} offre={o} annuel={annuel} large={large} onInscription={onInscription} />
        ))}
      </View>
      <View style={{ gap: 8, alignItems: large ? 'center' : 'flex-start', marginTop: large ? 24 : 8 }}>
        <Titre2 large={large} centre={large}>
          Pro, avec tes réunions.
        </Titre2>
        <Intro centre={large}>Pro 1, 2 et 3 ajoutent les réunions à Pro. Les heures ne se reportent pas.</Intro>
      </View>
      <View style={{ width: '100%', maxWidth: 1120, flexDirection: large ? 'row' : 'column', alignItems: 'stretch', gap: large ? 20 : 16 }}>
        {(['pro1', 'pro2', 'pro3'] as const).map((o) => (
          <Offre key={o} offre={o} annuel={annuel} large={large} onInscription={onInscription} />
        ))}
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

/** Un lien du pied de page : une section de la page, une page légale ou une adresse. */
/* ——— Eve ——— */

/** Entendre Eve avant de créer un compte : un extrait tout de suite, et une phrase à soi si le service de voix est branché. */
function EssaiEve({ large }: { large: boolean }) {
  const [texte, setTexte] = useState('');
  const [etat, setEtat] = useState<'repos' | 'extrait' | 'phrase'>('repos');
  const [phrase, setPhrase] = useState(false);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    eveDisponible().then(setPhrase);
    return arreterEve;
  }, []);
  const repos = () => setEtat('repos');
  const extrait = () => {
    setErreur('');
    if (etat === 'extrait') {
      arreterEve();
      return repos();
    }
    setEtat('extrait');
    jouerExtraitEve({ onFin: repos, onErreur: () => (repos(), setErreur('L’extrait n’a pas pu démarrer.')) });
  };
  const dire = async () => {
    setErreur('');
    setEtat('phrase');
    try {
      await essayerEve(texte.trim() || PHRASE_EVE, { onFin: repos });
    } catch (e) {
      setErreur((e as Error).message);
      repos();
    }
  };
  const t = teinte(vive('indigo'));
  return (
    <Bloc large={large} style={{ paddingBottom: large ? 96 : 56 }}>
      <View style={{ gap: 16, padding: large ? 32 : 20, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, ...ombreAvant(), flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', columnGap: 48 }}>
        <View style={{ flex: large ? 1 : undefined, gap: 8 }}>
          <Titre2 large={large}>Écoute Eve</Titre2>
          <Intro>La voix de Me. Elle te lit ta journée, tes mails et tes comptes rendus.</Intro>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={etat === 'extrait' ? 'Arrêter Eve' : 'Écouter Eve'} onPress={extrait} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 20, borderRadius: 14, backgroundColor: t.c, opacity: pressed ? 0.85 : 1, ...ombreAvant(t.c) })}>
              <Icone nom="onde" color={t.encre} size={20} />
              <Text style={{ color: t.encre, fontFamily: F.texteF, fontSize: 15 }}>{etat === 'extrait' ? 'Arrêter' : 'Écouter Eve'}</Text>
            </Pressable>
          </View>
        </View>
        {phrase ? (
          <View style={{ flex: large ? 1 : undefined, gap: 10 }}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Ou fais-lui dire ta phrase</Text>
            <TextInput
              accessibilityLabel="Ta phrase pour Eve"
              value={texte}
              onChangeText={setTexte}
              placeholder={PHRASE_EVE}
              placeholderTextColor={C.muted}
              multiline
              maxLength={MAX_ESSAI_EVE}
              style={{ minHeight: 84, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk, color: C.ink, fontFamily: F.texte, fontSize: 15, textAlignVertical: 'top' }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{`${texte.length}/${MAX_ESSAI_EVE}`}</Text>
              <Bouton kind="surface" label={etat === 'phrase' ? 'Eve lit…' : 'Faire lire'} onPress={() => etat === 'repos' && dire()} />
            </View>
          </View>
        ) : null}
        {erreur ? <Text accessibilityLiveRegion="polite" style={{ color: C.agressif, fontFamily: F.texte, fontSize: 13.5 }}>{erreur}</Text> : null}
      </View>
    </Bloc>
  );
}

function LienPied({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
      {(e) => <Text style={{ color: (e as { hovered?: boolean }).hovered ? C.ink : C.muted, fontFamily: F.texte, fontSize: 14, lineHeight: 22 }}>{label}</Text>}
    </Pressable>
  );
}

function Pied({ large, aller, onContact }: { large: boolean; aller: (s: Section) => void; onContact: () => void }) {
  const pages = [{ page: 'a-propos', label: 'À propos' }, ...PAGES_LEGALES].map((p) => ({ ...p, url: urlLegale(p.page) })).filter((p) => p.url);
  const titre = (t: string) => <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14, marginBottom: 4 }}>{t}</Text>;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.sunk }}>
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
            <View style={{ gap: 6, minWidth: 130 }}>
              {titre('Découvrir')}
              {SECTIONS.map((x) => (
                <LienPied key={x.key} label={x.label} onPress={() => aller(x.key)} />
              ))}
            </View>
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
              <LienPied label="Écrire un message" onPress={onContact} />
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

/* ——— La page ——— */

/** Page d'accueil montrée aux visiteurs non connectés : ce que fait l'app, puis connexion ou inscription. */
export function AccueilPublic({ onConnexion, onInscription, onContact }: { onConnexion: () => void; onInscription: () => void; onContact: () => void }) {
  const largeur = useWindowDimensions().width;
  const large = largeur >= SEUIL;
  const cle = useThemeCle();
  const { haut, bas } = useZonesSures();
  const defile = useRef<ScrollViewInstance>(null);
  // Position de chaque section, mesurée à l'affichage : le menu du haut y fait défiler la page et montre où l'on est.
  const [positions, setPositions] = useState<Partial<Record<Section, number>>>({});
  const [hautEntete, setHautEntete] = useState(0);
  const [active, setActive] = useState<Section | null>(null);
  const repere = (s: Section) => ({ onLayout: (e: LayoutChangeEvent) => setPositions((p) => ({ ...p, [s]: e.nativeEvent.layout.y })) });
  // La barre du haut reste visible : la section commence juste dessous, avec un peu d'air.
  const aller = (s: Section) => defile.current?.scrollTo({ y: Math.max(0, (positions[s] ?? 0) - hautEntete - 24), animated: true });
  const suivre = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y + hautEntete + 80;
    const vue = SECTIONS.filter((x) => (positions[x.key] ?? Infinity) <= y).pop()?.key ?? null;
    if (vue !== active) setActive(vue);
  };

  return (
    <View key={cle} style={{ flex: 1, backgroundColor: C.bg, paddingTop: haut }}>
      <ScrollView ref={defile} stickyHeaderIndices={[0]} onScroll={suivre} scrollEventThrottle={100} contentContainerStyle={{ paddingBottom: bas }}>
        <View onLayout={(e) => setHautEntete(e.nativeEvent.layout.height)} style={{ backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.line }}>
          <Bloc large={large} style={{ paddingVertical: large ? 16 : 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: large ? 16 : 8 }}>
            <Pressable accessibilityRole="link" accessibilityLabel="Me, haut de la page" onPress={() => defile.current?.scrollTo({ y: 0, animated: true })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Logo taille={large ? 36 : 32} />
              {largeur >= 400 && (largeur >= 1100 || !large) ? <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: large ? 17 : 16 }}>Me</Text> : null}
            </Pressable>
            {large ? (
              <View accessibilityRole="menu" style={{ flexDirection: 'row', gap: largeur >= 1100 ? 28 : 16 }}>
                {SECTIONS.filter((x) => !('menu' in x)).map((x) => {
                  const on = x.key === active;
                  return (
                    <Pressable key={x.key} accessibilityRole="link" accessibilityState={{ selected: on }} onPress={() => aller(x.key)} hitSlop={8}>
                      {(e) => (
                        <View style={{ gap: 4, alignItems: 'center' }}>
                          <Text style={{ color: on || (e as { hovered?: boolean }).hovered ? C.ink : C.muted, fontFamily: F.texteM, fontSize: 15 }}>{x.label}</Text>
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: on ? vive('indigo') : 'transparent' }} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
                <Pressable accessibilityRole="link" onPress={onContact} hitSlop={8}>
                  {(e) => (
                    <View style={{ gap: 4, alignItems: 'center' }}>
                      <Text style={{ color: (e as { hovered?: boolean }).hovered ? C.ink : C.muted, fontFamily: F.texteM, fontSize: 15 }}>Contact</Text>
                      <View style={{ width: 4, height: 4 }} />
                    </View>
                  )}
                </Pressable>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: large ? 8 : 4 }}>
              {largeur >= 1100 ? (
                <>
                  <Bouton kind="texte" label="Se connecter" onPress={onConnexion} />
                  <Bouton label="Créer mon compte" onPress={onInscription} />
                </>
              ) : large ? (
                <>
                  <Bouton compact kind="texte" label="Connexion" accessibilityLabel="Se connecter" onPress={onConnexion} />
                  <Bouton compact label="Commencer" accessibilityLabel="Créer mon compte" onPress={onInscription} />
                </>
              ) : (
                <>
                  <Bouton compact kind="texte" label="Contact" onPress={onContact} />
                  <Bouton compact kind="texte" label="Connexion" accessibilityLabel="Se connecter" onPress={onConnexion} />
                  <Bouton compact label="Commencer" accessibilityLabel="Créer mon compte" onPress={onInscription} />
                </>
              )}
            </View>
          </Bloc>
        </View>

        <Heros large={large} onConnexion={onConnexion} onInscription={onInscription} />
        <View {...repere('finances')}>
          <Finances large={large} onInscription={onInscription} />
        </View>
        <View {...repere('rubriques')}>
          <Rubriques large={large} />
        </View>
        <EssaiEve large={large} />
        <View {...repere('apercu')}>
          <Apercu large={large} />
        </View>
        <Atouts large={large} />
        <Reunions large={large} />
        <View {...repere('donnees')}>
          <Donnees large={large} />
        </View>
        <View {...repere('tarifs')}>
          <Tarifs large={large} onInscription={onInscription} />
        </View>
        <View {...repere('questions')}>
          <Questions large={large} />
        </View>
        <Final large={large} onConnexion={onConnexion} onInscription={onInscription} />
        <Pied large={large} aller={aller} onContact={onContact} />
      </ScrollView>
    </View>
  );
}
