import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';

import type { VoixEve } from './voix-eve';
import { choisirVoixEve } from './voix-eve';

/**
 * Eve, la voix de l'app. Elle lit tout directement sur l'appareil, sans service extérieur : `audio.voix` vide choisit la meilleure
 * voix française féminine installée (voir `voix-eve.ts`). L'enregistrement `assets/sons/eve.mp3` est sa présentation sur la page d'accueil :
 * c'est un fichier, il dit toujours le même texte.
 */
export const VOIX_TELEPHONE = 'telephone';
export const PHRASE_EVE = 'Bonjour, je suis Eve, la voix de Me. Je te lis ta journée, tes mails et tes comptes rendus.';
export const MAX_ESSAI_EVE = 120;
const EXTRAIT: AudioSource = require('../../assets/sons/eve.mp3');

let choisie: Promise<string | undefined> | null = null;
/** L'identifiant de la voix d'Eve sur cet appareil, cherché une fois ; rien si l'appareil n'a que sa voix par défaut. */
export const voixEve = (lister: () => Promise<VoixEve[]>) => (choisie ??= lister().then(choisirVoixEve).catch(() => undefined));

let enCours: (() => void) | null = null;

/** Coupe l'extrait en cours. */
export function arreterExtraitEve() {
  enCours?.();
  enCours = null;
}

/** Joue l'enregistrement d'Eve. */
export function jouerExtraitEve(s: { onFin: () => void; onErreur: () => void }) {
  arreterExtraitEve();
  let p: AudioPlayer;
  try {
    p = createAudioPlayer(EXTRAIT);
  } catch {
    return s.onErreur();
  }
  let abonnement: { remove: () => void } | undefined;
  const nettoyer = () => {
    abonnement?.remove();
    try {
      p.remove();
    } catch {
      // Le lecteur est déjà parti.
    }
  };
  enCours = nettoyer;
  abonnement = p.addListener('playbackStatusUpdate', (st) => {
    if (!st.didJustFinish) return;
    enCours = null;
    nettoyer();
    s.onFin();
  });
  try {
    p.play();
  } catch {
    enCours = null;
    nettoyer();
    s.onErreur();
  }
}
