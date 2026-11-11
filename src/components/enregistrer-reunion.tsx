import { requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { router, type Href } from 'expo-router';
import { Platform, View } from 'react-native';

import { api, tokenStore } from '@/lib/api';
import { type CompteurReunions, resteReunions } from '@/lib/abonnement';
import { useStore } from '@/lib/store';
import { assembler, AVERTIR_A_MS, contexteTranscription, DUREE_MAX_MS, dureeTexte, manquants, MORCEAU_MS, OPTIONS_REUNION, transcrireAudio, type Morceau } from '@/lib/enregistrement';
import { signalerVoixOuverte } from '@/lib/ecoute';
import { C } from '@/lib/theme';

import { SqueletteReponse } from './squelettes';
import { Btn, T } from './ui';

type Etape = 'repos' | 'enregistre' | 'pause' | 'transcrit';

/**
 * Enregistrer toute une réunion, jusqu'à 4 heures : le micro tourne (même écran verrouillé) et l'enregistrement part
 * au serveur par morceaux de 20 minutes, transcrits pendant que la réunion continue. À la fin, les textes sont recollés
 * et rejoignent le compte rendu (`onTexte`), qui lance l'analyse. L'audio n'est jamais gardé par le serveur ;
 * un morceau dont la transcription échoue reste ici le temps de « Réessayer ».
 */
export function EnregistrerReunion({ contexte, onTexte, desactive }: { contexte: (string | undefined)[]; onTexte: (texte: string) => void | Promise<void>; desactive?: boolean }) {
  const { abonnement } = useStore();
  const [compteur, setCompteur] = useState<CompteurReunions | null>(null);
  const essai = abonnement?.offre === 'essai';
  const rafraichir = () =>
    tokenStore
      .get()
      .then((token) => api<{ reunions?: CompteurReunions | null }>('/abonnement', { token, discret: true }))
      .then((r) => setCompteur(r.reunions ?? null))
      .catch(() => {});
  useEffect(() => {
    void rafraichir();
  }, []);
  const recorder = useAudioRecorder(OPTIONS_REUNION);
  const etat = useAudioRecorderState(recorder, 500);
  const [etape, setEtape] = useState<Etape>('repos');
  const [message, setMessage] = useState('');
  // Les morceaux de la réunion en cours : la référence pour le travail, la copie pour l'affichage.
  const morceaux = useRef<Morceau[]>([]);
  const [vus, setVus] = useState<Morceau[]>([]);
  const publier = () => setVus(morceaux.current.map((m) => ({ ...m })));
  // La durée des morceaux déjà fermés, et celle du dernier : le compteur du micro repart de zéro à chaque morceau.
  const [passe, setPasse] = useState(0);
  const [dernier, setDernier] = useState(0);
  const arrete = useRef(false);
  /** Les transcriptions partent une par une, dans l'ordre. */
  const file = useRef<Promise<void>>(Promise.resolve());
  /** Le changement de morceau en cours, que « Terminer » attend. */
  const rotation = useRef<Promise<void> | null>(null);
  /** Après un changement, le compteur du micro montre encore l'ancien morceau un instant : on attend qu'il reparte de zéro. */
  const attendFrais = useRef(false);
  const aide = contexteTranscription(contexte);

  // Le mot-clé « Hey Me » ne doit pas se battre pour le micro.
  useEffect(() => {
    signalerVoixOuverte(etape === 'enregistre' || etape === 'pause');
    return () => signalerVoixOuverte(false);
  }, [etape]);

  const envoyer = (m: Morceau) => {
    file.current = file.current.then(async () => {
      try {
        m.texte = await transcrireAudio(m.blob ?? m.uri, aide, m.dureeMs);
        m.erreur = undefined;
      } catch (e) {
        m.erreur = (e as Error).message || 'La transcription a échoué.';
      }
      publier();
    });
  };

  /** Ferme le morceau en cours et l'envoie à la transcription. */
  const fermerMorceau = async (d: number) => {
    await recorder.stop();
    const fichier = recorder.uri;
    if (!fichier || d < 2000) return;
    // Sur le web, l'adresse du fichier peut ne pas survivre au morceau suivant : on garde son contenu.
    const blob = Platform.OS === 'web' ? await (await fetch(fichier)).blob() : undefined;
    const m: Morceau = { n: morceaux.current.length + 1, uri: fichier, blob, dureeMs: d };
    morceaux.current.push(m);
    setPasse((p) => p + d);
    setDernier(d);
    publier();
    envoyer(m);
  };

  const demarrer = async () => {
    setMessage('');
    try {
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) return setMessage('Le micro n’est pas autorisé. Active-le pour Me dans les réglages du téléphone (ou du navigateur).');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: true });
      arrete.current = false;
      morceaux.current = [];
      file.current = Promise.resolve();
      publier();
      setPasse(0);
      setDernier(0);
      await recorder.prepareToRecordAsync();
      recorder.record();
      attendFrais.current = false;
      setEtape('enregistre');
    } catch {
      setMessage('Le micro ne répond pas. Il est peut-être utilisé par une autre app, ou l’app doit être mise à jour.');
    }
  };

  /** Tous les morceaux sont passés : le texte part au compte rendu, ou on dit ce qui manque. */
  const conclure = async () => {
    void rafraichir();
    const reste = manquants(morceaux.current);
    if (!reste.length) {
      const texte = assembler(morceaux.current);
      morceaux.current = [];
      publier();
      setEtape('repos');
      return onTexte(texte);
    }
    setEtape('repos');
    const total = morceaux.current.length;
    const quoi = total === 1 ? 'L’enregistrement est gardé' : `${reste.length} partie${reste.length > 1 ? 's' : ''} sur ${total} ${reste.length > 1 ? 'manquent' : 'manque'}, l’enregistrement est gardé`;
    setMessage(`${reste[0].erreur || 'La transcription a échoué.'} ${quoi} : tu peux réessayer.`);
  };

  const attendre = async () => {
    setMessage('');
    setEtape('transcrit');
    await file.current;
    await conclure();
  };

  const reessayer = () => {
    for (const m of manquants(morceaux.current)) envoyer(m);
    void attendre();
  };

  /** Le compte rendu se fait avec les parties transcrites ; les autres sont abandonnées. */
  const garder = () => {
    const texte = assembler(morceaux.current);
    morceaux.current = [];
    publier();
    setMessage('');
    void onTexte(texte);
  };

  const terminer = async () => {
    if (arrete.current) return;
    arrete.current = true;
    const d = etat.durationMillis;
    try {
      // Un changement de morceau en cours a déjà fermé le sien.
      if (rotation.current) await rotation.current;
      else await fermerMorceau(d);
      if (recorder.isRecording) await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false }).catch(() => {});
    } catch {
      if (!morceaux.current.length) {
        setEtape('repos');
        return setMessage('L’enregistrement n’a pas pu être terminé.');
      }
    }
    if (!morceaux.current.length) {
      setEtape('repos');
      return setMessage('Enregistrement trop court : rien à transcrire.');
    }
    await attendre();
  };

  /** Toutes les 20 minutes : le morceau part à la transcription et le micro reprend aussitôt sur un nouveau fichier. */
  const tourner = (d: number) => {
    if (rotation.current || arrete.current) return;
    attendFrais.current = true;
    setDernier(0);
    rotation.current = (async () => {
      try {
        await fermerMorceau(d);
        if (arrete.current) return;
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch {
        // Le micro n'a pas repris : on s'arrête là, avec ce qui est déjà enregistré.
        if (!arrete.current) {
          arrete.current = true;
          await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false }).catch(() => {});
          if (morceaux.current.length) await attendre();
          else setEtape('repos');
          setMessage((x) => x || 'Le micro s’est arrêté pendant la réunion. Ce qui était enregistré est transcrit.');
        }
      } finally {
        rotation.current = null;
      }
    })();
  };

  // Le compteur du micro affiche encore l'ancien morceau un instant après le changement : il ne compte pas deux fois.
  const courant = dernier && etat.durationMillis >= dernier ? 0 : etat.durationMillis;
  const total = passe + courant;

  useEffect(() => {
    if (etape !== 'enregistre') return;
    // Au bout de 4 heures, l'enregistrement s'arrête seul.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (total >= DUREE_MAX_MS) return void terminer();
    if (attendFrais.current && etat.durationMillis < MORCEAU_MS) attendFrais.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!attendFrais.current && etat.durationMillis >= MORCEAU_MS) tourner(etat.durationMillis);
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

  const faits = vus.filter((m) => m.texte !== undefined || m.erreur).length;
  const enAttente = vus.some((m) => m.texte === undefined);
  const dejaTranscrit = vus.some((m) => m.texte);

  if (etape === 'transcrit')
    return (
      <View style={{ gap: 8 }}>
        <T small muted>{`Transcription de ${dureeTexte(passe)} d’enregistrement${vus.length > 1 ? `, partie ${Math.min(vus.length, faits + 1)} sur ${vus.length}` : ''}… Garde l’app ouverte, cela peut prendre quelques minutes.`}</T>
        <SqueletteReponse />
      </View>
    );

  if (etape === 'enregistre' || etape === 'pause')
    return (
      <View style={{ gap: 8 }}>
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: etape === 'enregistre' ? C.agressif : C.muted }} />
          <T style={{ fontVariant: ['tabular-nums'] }}>{`${etape === 'enregistre' ? 'Enregistrement' : 'En pause'} · ${dureeTexte(total)}`}</T>
        </View>
        {total >= AVERTIR_A_MS ? <T small style={{ color: C.agressif }}>L’enregistrement s’arrête à 4 h.</T> : null}
        {vus.some((m) => m.erreur) ? <T small style={{ color: C.agressif }}>Une partie n’a pas pu être transcrite : tu pourras réessayer à la fin.</T> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn label="Terminer et transcrire" onPress={terminer} />
          {etape === 'enregistre' ? <Btn kind="sec" label="Pause" onPress={pause} /> : <Btn kind="sec" label="Reprendre" onPress={reprendre} />}
        </View>
        <T small muted>Jusqu’à 4 h, transcrites au fur et à mesure. Le micro reste actif écran verrouillé ; quitter cette page arrête l’enregistrement.</T>
      </View>
    );

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {enAttente ? <Btn label="Réessayer la transcription" onPress={reessayer} /> : null}
        {enAttente && dejaTranscrit ? <Btn kind="sec" label="Garder ce qui est transcrit" onPress={garder} /> : null}
        <Btn kind="sec" label={enAttente ? 'Enregistrer à nouveau' : '🎙 Enregistrer la réunion'} onPress={demarrer} disabled={desactive} />
      </View>
      {message ? <T small style={{ color: C.agressif }}>{message}</T> : null}
      {resteReunions(compteur, essai) ? <T small muted>{resteReunions(compteur, essai)}</T> : null}
      {compteur && !compteur.illimite && compteur.restantesSecondes === 0 ? <Btn small kind="sec" label="Passer au palier supérieur" onPress={() => router.push('/abonnement' as Href)} /> : null}
    </View>
  );
}
