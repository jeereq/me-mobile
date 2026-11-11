import { AudioQuality, IOSOutputFormat, RecordingPresets, type RecordingOptions } from 'expo-audio';
import { Platform } from 'react-native';

import { apiFormulaire, tokenStore } from './api';

/**
 * Enregistrer une réunion entière : de la voix, donc AAC mono à 32 kbit/s (environ 14 Mo l'heure) plutôt qu'un son de musique.
 * OpenAI refuse un fichier de plus de 25 Mo, et ses meilleurs modèles un audio de plus de 25 minutes : l'enregistrement
 * est donc coupé en morceaux de 20 minutes, transcrits un par un pendant la réunion, puis recollés. Il s'arrête de lui-même à 4 heures.
 */
export const MORCEAU_MS = 20 * 60 * 1000;
export const DUREE_MAX_MS = 4 * 60 * 60 * 1000;
export const AVERTIR_A_MS = DUREE_MAX_MS - 10 * 60 * 1000;

export { assembler, manquants, type Morceau } from './morceaux-reunion';

export const OPTIONS_REUNION: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { ...RecordingPresets.HIGH_QUALITY.ios, outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
};

/** « 1:05:09 » ou « 12:30 ». */
export function dureeTexte(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/** Le texte à envoyer comme aide à la reconnaissance : titre, participants et projets (noms propres). */
export const contexteTranscription = (parties: (string | undefined | null)[]) => parties.filter(Boolean).join(', ').slice(0, 400);

/** Envoie l'enregistrement à me-api, qui le transcrit en français sans le garder. */
export async function transcrireAudio(source: string | Blob, contexte?: string, dureeMs?: number): Promise<string> {
  const form = new FormData();
  const web = Platform.OS === 'web';
  const nom = web ? 'reunion.webm' : 'reunion.m4a';
  const uri = typeof source === 'string' ? source : '';
  if (typeof source !== 'string') form.append('audio', source, nom);
  else if (web) form.append('audio', await (await fetch(uri)).blob(), nom);
  // React Native lit lui-même le fichier local désigné par `uri`.
  else form.append('audio', { uri, name: nom, type: 'audio/m4a' } as unknown as Blob);
  if (contexte) form.append('contexte', contexte);
  // Le serveur compte cette durée sur les heures du palier, bornée par le poids du fichier.
  if (dureeMs && dureeMs > 0) form.append('duree', String(Math.round(dureeMs / 1000)));
  const { texte } = await apiFormulaire<{ texte: string }>('/assistant/transcription', form, await tokenStore.get());
  return texte;
}
