import { useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/texte';
import { Btn, Panel, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

type Etape = { etape: string; ok: boolean; detail: string };

/** Admin : vérifie tout le chemin d'un fichier envoyé (serveur, Cloudinary, dépôt d'essai effacé aussitôt). */
export function DiagnosticFichiers() {
  const { session } = useStore();
  const [etapes, setEtapes] = useState<Etape[] | null>(null);
  const [encours, setEncours] = useState(false);
  const [erreur, setErreur] = useState('');
  const tester = () => {
    setEncours(true);
    setErreur('');
    api<{ ok: boolean; etapes: Etape[] }>('/justificatifs/diagnostic', { token: session?.token })
      .then((r) => setEtapes(r.etapes))
      .catch((e: Error) => setErreur(e.message))
      .finally(() => setEncours(false));
  };
  return (
    <Panel title="Envoi de fichiers">
      <T small muted>
        Photos de profil, justificatifs et pièces d’identité passent par le serveur et Cloudinary.
      </T>
      {etapes ? (
        <View accessibilityLiveRegion="polite" style={{ gap: 6 }}>
          {etapes.map((e) => (
            <View key={e.etape} style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={{ width: 18, color: e.ok ? C.coach : C.agressif, fontFamily: F.texteF }}>{e.ok ? '✓' : '✕'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>{e.etape}</Text>
                <T small muted>
                  {e.detail}
                </T>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {erreur ? (
        <T small style={{ color: C.agressif }}>
          {erreur}
        </T>
      ) : null}
      <Btn small kind="sec" label={encours ? 'Test en cours…' : 'Tester l’envoi'} disabled={encours} onPress={tester} />
    </Panel>
  );
}
