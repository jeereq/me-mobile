import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionErrorCode, ExpoSpeechRecognitionModule as Module } from 'expo-speech-recognition';
import { Platform } from 'react-native';

import { assembleur } from './dictee';

/**
 * Reconnaissance vocale (micro → texte), en français, sur iOS, Android et le web (Chrome, Edge, Safari).
 * Une app installée avant l'arrivée du micro n'a pas le module natif : on ne charge alors pas le paquet
 * (il planterait au chargement) et l'écran de commande propose de taper la phrase à la place.
 */
let cache: typeof Module | null | undefined;
function module() {
  if (cache !== undefined) return cache;
  try {
    cache =
      Platform.OS === 'web' || requireOptionalNativeModule('ExpoSpeechRecognition')
        ? // eslint-disable-next-line @typescript-eslint/no-require-imports
          (require('expo-speech-recognition') as { ExpoSpeechRecognitionModule: typeof Module }).ExpoSpeechRecognitionModule
        : null;
  } catch {
    cache = null;
  }
  return cache;
}

export function ecouteDisponible() {
  try {
    return !!module()?.isRecognitionAvailable();
  } catch {
    return false;
  }
}

const ERREURS: Partial<Record<ExpoSpeechRecognitionErrorCode, string>> = {
  'no-speech': "Je n'ai rien entendu. Touche le micro et parle.",
  'speech-timeout': "Je n'ai rien entendu. Touche le micro et parle.",
  'not-allowed': 'Le micro n’est pas autorisé. Active-le pour Me dans les réglages du téléphone (ou du navigateur).',
  'service-not-allowed': 'La dictée est coupée sur cet appareil. Active-la dans les réglages (Siri et dictée sur iPhone).',
  'language-not-supported': 'La dictée dans cette langue n’est pas disponible sur cet appareil.',
  network: 'La dictée a besoin d’internet sur cet appareil.',
  'audio-capture': 'Le micro ne répond pas. Il est peut-être utilisé par une autre app.',
  busy: 'Le micro est déjà occupé. Réessaie dans un instant.',
};

export type Ecoute = { arreter: () => void; annuler: () => void };

// Qui utilise le micro : le mot-clé ne doit écouter que quand personne d'autre ne le fait (dictée, commande vocale), sinon il se
// battrait avec elles pour le micro, et entendrait la voix de l'app.
let microsOccupes = 0;
let voixOuverte = false;
const surveillants = new Set<() => void>();
const prevenir = () => surveillants.forEach((f) => f());
export const microLibre = () => microsOccupes === 0 && !voixOuverte;
/** Appelé quand le micro est pris ou libéré par une autre écoute, ou quand la fenêtre de commande vocale s'ouvre ou se ferme. */
export function surEtatMicro(f: () => void) {
  surveillants.add(f);
  return () => {
    surveillants.delete(f);
  };
}
export function signalerVoixOuverte(ouverte: boolean) {
  if (voixOuverte === ouverte) return;
  voixOuverte = ouverte;
  prevenir();
}
/** Compte une écoute de plus, et rend la fonction qui la libère (une seule fois). */
function occuper() {
  microsOccupes++;
  prevenir();
  let libre = false;
  return () => {
    if (libre) return;
    libre = true;
    microsOccupes = Math.max(0, microsOccupes - 1);
    prevenir();
  };
}

/**
 * Écoute une phrase et la rend au fil de l'eau (`texte`), puis `fin` quand l'écoute s'arrête (silence, `arreter`, erreur).
 * `mots` : noms propres de l'espace (budgets, contacts) pour aider la reconnaissance. Rend null si le micro n'est pas utilisable.
 */
export async function ecouter(
  cb: { texte: (t: string, final: boolean, alternatives: string[]) => void; volume?: (v: number) => void; fin: () => void; erreur: (message: string) => void },
  mots: string[] = [],
  /** `silence` : la pause, en ms, qui marque la fin ; `attente` : combien de temps attendre un premier mot. */
  o: { langue?: string; silence?: number; attente?: number; ponctuation?: boolean } = {},
): Promise<Ecoute | null> {
  const m = module();
  if (!m) {
    cb.erreur('La dictée demande la dernière version de l’app. Tu peux taper ta phrase en attendant.');
    return null;
  }
  try {
    const p = await m.requestPermissionsAsync();
    if (!p.granted) {
      cb.erreur(ERREURS['not-allowed']!);
      return null;
    }
  } catch {
    cb.erreur(ERREURS['not-allowed']!);
    return null;
  }
  const liberer = occuper();
  // Sur le web, la dictée du navigateur ne donne pas le volume : on le mesure nous-mêmes sur le micro.
  const couperVolume = Platform.OS === 'web' && cb.volume ? volumeWeb(cb.volume) : () => {};
  // Le micro écoute en continu et c'est nous qui décidons de la fin : on peut chercher ses mots au milieu d'une phrase.
  const silence = o.silence ?? 1800;
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const patienter = (ms: number) => {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(() => m.stop(), ms);
  };
  patienter(o.attente ?? 8000);
  const phrase = assembleur();
  const abonnements = [
    m.addListener('result', (e) => {
      const alternatives = e.results.map((r) => r.transcript ?? '');
      const variantes = phrase.variantes(alternatives, false);
      const tout = phrase.recevoir(alternatives[0] ?? '', e.isFinal);
      if (tout.trim()) patienter(silence);
      cb.texte(tout, e.isFinal, variantes);
    }),
    m.addListener('volumechange', (e) => cb.volume?.(e.value)),
    m.addListener('error', (e) => {
      if (e.error !== 'aborted') cb.erreur(ERREURS[e.error] ?? 'La dictée a été interrompue. Réessaie.');
    }),
    m.addListener('end', () => {
      if (minuteur) clearTimeout(minuteur);
      abonnements.forEach((a) => a.remove());
      couperVolume();
      liberer();
      cb.fin();
    }),
  ];
  // L'écoute continue n'existe qu'à partir d'Android 13 ; avant, le système coupe à la première pause, qu'on allonge.
  const continu = Platform.OS !== 'android' || Number(Platform.Version) >= 33;
  m.start({ lang: o.langue ?? 'fr-FR', interimResults: true, continuous: continu, maxAlternatives: 3, addsPunctuation: !!o.ponctuation, androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: silence }, contextualStrings: mots.slice(0, 100), volumeChangeEventOptions: { enabled: !!cb.volume, intervalMillis: 120 } });
  return { arreter: () => m.stop(), annuler: () => m.abort() };
}

/**
 * Volume du micro sur le web, à la même échelle que sur mobile (de -2 en silence à 10 fort), toutes les 120 ms.
 * Rend la fonction qui coupe la mesure et libère le micro. Sans accès au micro, ne fait rien (les ondes restent calmes).
 */
function volumeWeb(rendre: (v: number) => void) {
  let fini = false;
  let couper = () => {};
  const g = globalThis as unknown as { navigator?: Navigator; AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Contexte = g.AudioContext ?? g.webkitAudioContext;
  if (!Contexte || !g.navigator?.mediaDevices?.getUserMedia) return () => {};
  g.navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((flux) => {
      if (fini) return flux.getTracks().forEach((t) => t.stop());
      const ctx = new Contexte();
      const analyse = ctx.createAnalyser();
      analyse.fftSize = 512;
      ctx.createMediaStreamSource(flux).connect(analyse);
      const donnees = new Float32Array(analyse.fftSize);
      const minuterie = setInterval(() => {
        analyse.getFloatTimeDomainData(donnees);
        let somme = 0;
        for (const x of donnees) somme += x * x;
        const db = 20 * Math.log10(Math.sqrt(somme / donnees.length) || 1e-6);
        // Environ -60 dB (silence) à -10 dB (voix forte).
        rendre(Math.max(-2, Math.min(10, ((db + 60) / 50) * 12 - 2)));
      }, 120);
      couper = () => {
        clearInterval(minuterie);
        flux.getTracks().forEach((t) => t.stop());
        void ctx.close().catch(() => {});
      };
    })
    .catch(() => {});
  return () => {
    fini = true;
    couper();
  };
}

/**
 * Écoute en continu pour repérer le mot-clé : `texte` reçoit tout ce qui s'entend au fil de l'eau, `fin` est appelé quand la
 * reconnaissance s'arrête d'elle-même (silence, limite de durée du système) : à l'appelant de la relancer. `bloque` est vrai
 * quand le système refuse définitivement (micro ou dictée non autorisés, français indisponible) : inutile de réessayer.
 */
export async function ecouterMotCle(cb: { texte: (t: string, final: boolean) => void; fin: () => void; erreur: (message: string, bloque: boolean) => void }): Promise<Ecoute | null> {
  const m = module();
  if (!m) {
    cb.erreur('La dictée demande la dernière version de l’app.', true);
    return null;
  }
  try {
    const p = await m.requestPermissionsAsync();
    if (!p.granted) {
      cb.erreur(ERREURS['not-allowed']!, true);
      return null;
    }
  } catch {
    cb.erreur(ERREURS['not-allowed']!, true);
    return null;
  }
  const abonnements = [
    m.addListener('result', (e) => cb.texte(e.results[0]?.transcript ?? '', e.isFinal)),
    m.addListener('error', (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech' || e.error === 'speech-timeout') return;
      const bloque = e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'language-not-supported';
      cb.erreur(ERREURS[e.error] ?? 'L’écoute du mot-clé a été interrompue.', bloque);
    }),
    m.addListener('end', () => {
      abonnements.forEach((a) => a.remove());
      cb.fin();
    }),
  ];
  m.start({ lang: 'fr-FR', interimResults: true, continuous: true, addsPunctuation: false });
  return { arreter: () => m.stop(), annuler: () => m.abort() };
}

// Ouverture de la commande vocale depuis n'importe où (accueil, barre latérale, lien me://voix), comme la recherche.
// Au démarrage par le lien, l'écran peut demander l'ouverture avant que la fenêtre ne soit montée : la demande attend.
// `phrase` : une demande déjà prononcée (« Hey Me, ouvre les finances ») que la fenêtre exécute sans réécouter.
const abonnes = new Set<(phrase?: string) => void>();
let enAttente: { phrase?: string } | null = null;
export function ouvrirVoix(phrase?: string) {
  // Un gestionnaire d'appui passé tel quel enverrait son événement : seul un texte est une phrase.
  if (typeof phrase !== 'string' || !phrase.trim()) phrase = undefined;
  if (!abonnes.size) enAttente = { phrase };
  abonnes.forEach((f) => f(phrase));
}
export function surVoix(f: (phrase?: string) => void) {
  abonnes.add(f);
  if (enAttente) {
    const { phrase } = enAttente;
    enAttente = null;
    f(phrase);
  }
  return () => {
    abonnes.delete(f);
  };
}
