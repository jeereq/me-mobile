import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { AVERTIR_A_MS, contexteTranscription, DUREE_MAX_MS, dureeTexte, OPTIONS_REUNION, transcrireAudio } from '@/lib/enregistrement';
import { signalerVoixOuverte } from '@/lib/ecoute';
import { C } from '@/lib/theme';

import { SqueletteReponse } from './squelettes';
import { Btn, T } from './ui';

type Etape = 'repos' | 'enregistre' | 'pause' | 'transcrit';

/**
 * Enregistrer toute une réunion : le micro tourne (même écran verrouillé), puis le serveur transcrit l'audio.
 * Le texte rejoint le compte rendu (`onTexte`), qui lance l'analyse. L'audio n'est jamais gardé ;
 * si la transcription échoue, il reste ici le temps de « Réessayer ».
 */
export function EnregistrerReunion({ contexte, onTexte, desactive }: { contexte: (string | undefined)[]; onTexte: (texte: string) => void | Promise<void>; desactive?: boolean }) {
  const recorder = useAudioRecorder(OPTIONS_REUNION);
  const etat = useAudioRecorderState(recorder, 500);
  const [etape, setEtape] = useState<Etape>('repos');
  const [message, setMessage] = useState('');
  const [uri, setUri] = useState<string | null>(null);
  const [duree, setDuree] = useState(0);
  const arrete = useRef(false);

  // Le mot-clé « Hey Me » ne doit pas se battre pour le micro.
  useEffect(() => {
    signalerVoixOuverte(etape === 'enregistre' || etape === 'pause');
    return () => signalerVoixOuverte(false);
  }, [etape]);

  const demarrer = async () => {
    setMessage('');
    try {
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) return setMessage('Le micro n’est pas autorisé. Active-le pour Me dans les réglages du téléphone (ou du navigateur).');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: true });
      arrete.current = false;
      await recorder.prepareToRecordAsync();
      recorder.record();
      setEtape('enregistre');
    } catch {
      setMessage('Le micro ne répond pas. Il est peut-être utilisé par une autre app, ou l’app doit être mise à jour.');
    }
  };

  const transcrire = async (fichier: string) => {
    setMessage('');
    setEtape('transcrit');
    try {
      const texte = await transcrireAudio(fichier, contexteTranscription(contexte));
      setUri(null);
      setEtape('repos');
      await onTexte(texte);
    } catch (e) {
      setUri(fichier);
      setEtape('repos');
      setMessage(`${(e as Error).message || 'La transcription a échoué.'} L’enregistrement est gardé : tu peux réessayer.`);
    }
  };

  const terminer = async () => {
    if (arrete.current) return;
    arrete.current = true;
    const d = etat.durationMillis;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false }).catch(() => {});
    } catch {
      setEtape('repos');
      return setMessage('L’enregistrement n’a pas pu être terminé.');
    }
    const fichier = recorder.uri;
    if (!fichier || d < 2000) {
      setEtape('repos');
      return setMessage('Enregistrement trop court : rien à transcrire.');
    }
    setDuree(d);
    await transcrire(fichier);
  };

  // Au bout de 90 minutes, l'enregistrement s'arrête seul : le fichier dépasserait ce que le serveur accepte.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (etape === 'enregistre' && etat.durationMillis >= DUREE_MAX_MS) void terminer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat.durationMillis, etape]);

  const pause = () => {
    recorder.pause();
    setEtape('pause');
  };
  const reprendre = () => {
    recorder.record();
    setEtape('enregistre');
  };

  if (etape === 'transcrit')
    return (
      <View style={{ gap: 8 }}>
        <T small muted>{`Transcription de ${dureeTexte(duree)} d’enregistrement… Garde l’app ouverte, cela peut prendre quelques minutes.`}</T>
        <SqueletteReponse />
      </View>
    );

  if (etape === 'enregistre' || etape === 'pause')
    return (
      <View style={{ gap: 8 }}>
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: etape === 'enregistre' ? C.agressif : C.muted }} />
          <T style={{ fontVariant: ['tabular-nums'] }}>{`${etape === 'enregistre' ? 'Enregistrement' : 'En pause'} · ${dureeTexte(etat.durationMillis)}`}</T>
        </View>
        {etat.durationMillis >= AVERTIR_A_MS ? <T small style={{ color: C.agressif }}>L’enregistrement s’arrête à 1 h 30.</T> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn label="Terminer et transcrire" onPress={terminer} />
          {etape === 'enregistre' ? <Btn kind="sec" label="Pause" onPress={pause} /> : <Btn kind="sec" label="Reprendre" onPress={reprendre} />}
        </View>
        <T small muted>Le micro reste actif écran verrouillé. Quitter cette page arrête l’enregistrement.</T>
      </View>
    );

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {uri ? <Btn label="Réessayer la transcription" onPress={() => transcrire(uri)} /> : null}
        <Btn kind="sec" label={uri ? 'Enregistrer à nouveau' : '🎙 Enregistrer la réunion'} onPress={demarrer} disabled={desactive} />
      </View>
      {message ? <T small style={{ color: C.agressif }}>{message}</T> : null}
    </View>
  );
}
