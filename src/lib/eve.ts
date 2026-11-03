import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';

import { api, API_URL, tokenStore } from './api';

/**
 * Eve, la voix de l'app. `audio.voix` vide : c'est elle, si le serveur la propose. Sinon, ou si une lecture échoue,
 * l'app reprend la voix du téléphone : parler ne doit jamais rester muet.
 */
export const VOIX_TELEPHONE = 'telephone';
export const PHRASE_EVE = 'Bonjour, je suis Eve, la voix de Me. Je te lis ta journée, tes mails et tes comptes rendus.';
export const MAX_ESSAI_EVE = 120;
const EXTRAIT: AudioSource = require('../../assets/sons/eve.mp3');

let options: Promise<boolean> | null = null;
export const eveDisponible = () =>
  API_URL
    ? (options ??= api<{ eve?: boolean }>('/auth/options', { discret: true })
        .then((o) => !!o.eve)
        .catch(() => {
          options = null;
          return false;
        }))
    : Promise.resolve(false);

type Suivi = { vitesse?: number; onStart?: () => void; onMot?: () => void; onFin: () => void; onErreur: () => void };

let enCours: (() => void) | null = null;

/** Coupe ce qu'Eve est en train de lire, sans prévenir personne. */
export function arreterEve() {
  enCours?.();
  enCours = null;
}

/** Joue une source ; `onErreur` si elle ne démarre pas à temps (adresse expirée, réseau coupé). */
function jouer(source: AudioSource, s: Suivi) {
  arreterEve();
  let p: AudioPlayer;
  try {
    p = createAudioPlayer(source);
  } catch {
    return s.onErreur();
  }
  let pouls: ReturnType<typeof setInterval> | undefined;
  let attente: ReturnType<typeof setTimeout> | undefined;
  let abonnement: { remove: () => void } | undefined;
  const nettoyer = () => {
    if (pouls) clearInterval(pouls);
    if (attente) clearTimeout(attente);
    abonnement?.remove();
    try {
      p.remove();
    } catch {
      // Le lecteur est déjà parti.
    }
  };
  const finir = (f: () => void) => {
    enCours = null;
    nettoyer();
    f();
  };
  enCours = nettoyer;
  let parti = false;
  abonnement = p.addListener('playbackStatusUpdate', (st) => {
    if (st.playing && !parti) {
      parti = true;
      if (attente) clearTimeout(attente);
      s.onStart?.();
      // Pas de signal par mot comme avec la voix du téléphone : l'animation suit un rythme de parole.
      if (s.onMot) pouls = setInterval(s.onMot, 280);
    }
    if (st.didJustFinish) finir(s.onFin);
  });
  attente = setTimeout(() => finir(s.onErreur), 15_000);
  try {
    if (s.vitesse && s.vitesse !== 1) p.setPlaybackRate(s.vitesse);
    p.play();
  } catch {
    finir(s.onErreur);
  }
}

const adresse = (jeton: string) => `${API_URL}/api/voix/audio/${jeton}`;

/** Lit un morceau de texte avec la voix d'Eve, pour un compte connecté. */
export async function direAvecEve(texte: string, s: Suivi, annule: () => boolean) {
  try {
    const token = await tokenStore.get();
    if (!token) return s.onErreur();
    const { jeton } = await api<{ jeton: string }>('/voix/eve', { method: 'POST', token, body: { texte }, discret: true });
    if (!annule()) jouer({ uri: adresse(jeton) }, s);
  } catch {
    if (!annule()) s.onErreur();
  }
}

/** La zone de test de la page d'accueil, sans compte. Lève l'erreur du serveur, à afficher telle quelle. */
export async function essayerEve(texte: string, s: Omit<Suivi, 'onErreur' | 'onMot'>) {
  const { jeton } = await api<{ jeton: string }>('/voix/essai', { method: 'POST', body: { texte }, discret: true });
  await new Promise<void>((ok, non) => jouer({ uri: adresse(jeton) }, { ...s, onFin: () => (s.onFin(), ok()), onErreur: () => non(new Error('La lecture n’a pas démarré. Réessaie.')) }));
}

/** L'extrait enregistré : gratuit et disponible même si le service de voix ne l'est pas. */
export const jouerExtraitEve = (s: Suivi) => jouer(EXTRAIT, s);
