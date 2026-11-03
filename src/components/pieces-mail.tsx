import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, View } from 'react-native';

import { Icone } from '@/components/icones';
import { Text } from '@/components/texte';
import { type FichierChoisi, tailleLisible } from '@/lib/justificatifs';
import { refExterne } from '@/lib/externe';
import { ajouterPieces, type PieceMail } from '@/lib/pieces-mail';
import { lienPiece } from '@/lib/pieces-mail-api';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { Outil } from './mail-ui';
import { T } from './ui';

const typeFichier = (type?: string | null) => type || 'application/octet-stream';
const styleCarte = { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 280, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.line } as const;

/** Joindre des fichiers à un mail : choisir, voir ce qui part, retirer. */
export function ChampPieces({ pieces, onChange }: { pieces: FichierChoisi[]; onChange: (p: FichierChoisi[]) => void }) {
  const [refus, setRefus] = useState<string | null>(null);
  const ajouter = (nouvelles: FichierChoisi[]) => {
    const r = ajouterPieces(pieces, nouvelles);
    setRefus(r.refus);
    onChange(r.liste);
  };
  const fichier = async () => {
    const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (!r.canceled) ajouter(r.assets.map((a) => ({ uri: a.uri, nom: a.name, type: typeFichier(a.mimeType), taille: a.size, file: a.file })));
  };
  const photo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true });
    if (!r.canceled) ajouter(r.assets.map((a, n) => ({ uri: a.uri, nom: a.fileName || `photo-${Date.now()}-${n + 1}.jpg`, type: typeFichier(a.mimeType ?? 'image/jpeg'), taille: a.fileSize, file: a.file })));
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Outil icone="trombone" label="Joindre un fichier" onPress={fichier} />
        {Platform.OS !== 'web' ? <Outil glyphe="🖼️" label="Photo" onPress={photo} /> : null}
      </View>
      {pieces.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {pieces.map((p) => (
            <View key={`${p.nom}-${p.taille}`} style={{ ...styleCarte, paddingRight: 6, backgroundColor: C.sunk }}>
              <View style={{ flexShrink: 0 }}>
                <Icone nom="trombone" color={C.muted} size={16} />
              </View>
              <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>
                {p.nom}
              </Text>
              {p.taille ? <Text numberOfLines={1} style={{ flexShrink: 0, color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{tailleLisible(p.taille)}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${p.nom}`}
                hitSlop={8}
                onPress={() => {
                  setRefus(null);
                  onChange(pieces.filter((x) => x !== p));
                }}
                style={({ pressed }) => ({ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? alpha(C.ink, 0.08) : 'transparent' })}>
                <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 15, lineHeight: 18 }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {refus ? <T small style={{ color: C.agressif }}>{refus}</T> : null}
    </View>
  );
}

/**
 * Les pièces jointes d'un mail : un toucher les ouvre. Sans repère (ancienne version du serveur, mail hors compte connecté),
 * les noms renvoient au mail chez le service.
 * `message` : un ancien message du fil de `mailId`.
 */
export function PiecesDuMail({ mailId, message, pieces, noms, lien, service, sansTitre }: { mailId: string; message?: string; pieces?: PieceMail[]; noms: string[]; lien?: string; service: string; sansTitre?: boolean }) {
  const { session } = useStore();
  const [ouvre, setOuvre] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const ref = refExterne(mailId);
  const ouvrables = !!(ref && session?.token && pieces?.length);
  const liste: PieceMail[] = ouvrables ? pieces! : noms.map((nom, i) => ({ id: `${i}`, nom }));
  if (!liste.length) return null;

  const ouvrir = async (p: PieceMail) => {
    if (!ouvrables) {
      if (lien) Linking.openURL(lien).catch(() => {});
      return;
    }
    setErreur('');
    setOuvre(p.id);
    // Sur le web, la fenêtre s'ouvre avant d'attendre le serveur : après, le navigateur la bloquerait.
    const fenetre = Platform.OS === 'web' ? window.open('', '_blank') : null;
    if (fenetre) fenetre.opener = null;
    try {
      const url = await lienPiece(ref!.compte, ref!.element, p.id, message, session!.token!);
      if (fenetre) fenetre.location.assign(url);
      else if (Platform.OS === 'web') window.location.assign(url);
      else await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      fenetre?.close();
      setErreur((e as Error).message);
    } finally {
      setOuvre(null);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      {!sansTitre ? (
        <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>
          {liste.length} pièce{liste.length > 1 ? 's' : ''} jointe{liste.length > 1 ? 's' : ''}{ouvrables ? '' : ` · à ouvrir dans ${service}`}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {liste.map((p, i) => (
          <Pressable
            key={`${p.id}-${i}`}
            accessibilityRole="link"
            accessibilityLabel={ouvrables ? `Ouvrir ${p.nom}` : `${p.nom}, ouvrir dans ${service}`}
            disabled={!ouvrables && !lien}
            onPress={() => ouvrir(p)}
            style={({ pressed }) => ({ ...styleCarte, backgroundColor: pressed ? alpha(C.ink, 0.06) : C.surface })}>
            <View style={{ flexShrink: 0 }}>{ouvre === p.id ? <ActivityIndicator size="small" color={C.accent} /> : <Icone nom="trombone" color={C.muted} size={16} />}</View>
            <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>
              {p.nom}
            </Text>
            {p.taille ? <Text numberOfLines={1} style={{ flexShrink: 0, color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{tailleLisible(p.taille)}</Text> : null}
          </Pressable>
        ))}
      </View>
      {erreur ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <T small style={{ flexShrink: 1, color: C.agressif }}>{erreur}</T>
          {lien ? <Outil icone="ouvrir" label={`Ouvrir dans ${service}`} onPress={() => Linking.openURL(lien).catch(() => {})} /> : null}
        </View>
      ) : null}
    </View>
  );
}
