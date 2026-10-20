import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Petits sons de l'app : une case cochée, toutes les habitudes du jour faites, un rappel qui arrive.
 * Coupés depuis Compte > Notifications (espace.sons === false) ; sur téléphone, le mode silencieux les coupe aussi.
 */
const SOURCES = {
  valide: require('../../assets/sons/valide.wav'),
  bravo: require('../../assets/sons/bravo.wav'),
  notif: require('../../assets/sons/notif.wav'),
};
export type Son = keyof typeof SOURCES;

let actifs = true;
export const activerSons = (on: boolean) => {
  actifs = on;
};

const lecteurs: Partial<Record<Son, AudioPlayer>> = {};

export function jouer(son: Son) {
  if (!actifs) return;
  try {
    const p = (lecteurs[son] ??= createAudioPlayer(SOURCES[son]));
    p.volume = 0.6;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Un navigateur peut refuser le son tant qu'on n'a pas touché la page : on s'en passe.
  }
}
