import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, Text, View } from 'react-native';

import { Btn, Dialogue, T } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { detailJustificatif, type FichierChoisi, MAX_PAR_DEPENSE, refus, typeDe } from '@/lib/justificatifs';
import { envoyerJustificatif, useJustificatifsDisponibles } from '@/lib/justificatifs-api';
import { dateFr } from '@/lib/stats-finances';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Justificatif } from '@/lib/types';

const COTE = 72;

/** La vignette en plus grand pour l'aperçu : même transformation Cloudinary, sans recadrage. */
const apercuGrand = (j: Justificatif) => (j.apercu ? j.apercu.replace(/c_fill,w_\d+,h_\d+/, 'c_limit,w_1200,h_1200') : j.url);

function Vignette({ j, onOuvrir, onRetirer }: { j: Justificatif; onOuvrir: () => void; onRetirer?: () => void }) {
  return (
    <View style={{ width: COTE, height: COTE }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Voir ${j.nom}`}
        onPress={onOuvrir}
        style={({ pressed }) => ({ flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line, opacity: pressed ? 0.8 : 1, alignItems: 'center', justifyContent: 'center' })}>
        {j.apercu ? <Image source={{ uri: j.apercu }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ fontSize: 26 }}>{j.sorte === 'pdf' ? '📄' : '🧾'}</Text>}
        {j.sorte === 'pdf' ? (
          <View style={{ position: 'absolute', left: 4, bottom: 4, backgroundColor: alpha(C.bg, 0.85), borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
            <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 10 }}>PDF</Text>
          </View>
        ) : null}
      </Pressable>
      {onRetirer ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retirer ${j.nom}`}
          hitSlop={8}
          onPress={onRetirer}
          style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.muted, fontSize: 11, lineHeight: 13 }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Un justificatif en grand : la photo ou la première page du PDF, et de quoi l'ouvrir ou le retirer. */
function ApercuJustificatif({ j, onRetirer, onFermer }: { j: Justificatif; onRetirer?: () => void; onFermer: () => void }) {
  return (
    <Dialogue titre={j.nom} onFermer={onFermer}>
      <View style={{ height: 380, borderRadius: 14, overflow: 'hidden', backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
        <Image source={{ uri: apercuGrand(j) }} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityLabel={j.sorte === 'pdf' ? `Première page de ${j.nom}` : j.nom} />
      </View>
      <T small muted>
        {detailJustificatif(j)} · ajouté le {dateFr(j.ajouteLe)}
      </T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={j.sorte === 'pdf' ? 'Ouvrir le PDF' : 'Ouvrir en grand'} onPress={() => Linking.openURL(j.url).catch(() => {})} />
        {onRetirer ? <Btn kind="danger" label="Retirer de la dépense" onPress={onRetirer} /> : null}
        <Btn kind="sec" label="Fermer" onPress={onFermer} />
      </View>
    </Dialogue>
  );
}

/**
 * Les justificatifs d'une dépense dans son formulaire : vignettes, ajout depuis l'appareil photo, la galerie
 * ou les fichiers, aperçu et retrait. Chaque fichier part tout de suite sur le serveur ; il n'est gardé
 * dans la dépense qu'à « Enregistrer ».
 */
export function ChampJustificatifs({ value, onChange }: { value: Justificatif[]; onChange: (fn: (l: Justificatif[]) => Justificatif[]) => void }) {
  const { portee, lectureSeule } = useStore();
  const disponible = useJustificatifsDisponibles();
  const [envois, setEnvois] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<Justificatif | null>(null);
  // Sans serveur qui les garde, on montre quand même ceux déjà joints (sans pouvoir en ajouter).
  if (!disponible && !value.length) return null;
  const modifiable = disponible && !lectureSeule;
  const reste = MAX_PAR_DEPENSE - value.length - envois.length;

  const envoyer = async (fichiers: FichierChoisi[]) => {
    setErreur(null);
    const refuses: string[] = [];
    for (const f of fichiers.slice(0, Math.max(0, reste))) {
      const r = refus(f);
      if (r) {
        refuses.push(r);
        continue;
      }
      setEnvois((l) => [...l, f.nom]);
      try {
        const j = await envoyerJustificatif(f, portee.type === 'equipe' ? portee.id : undefined);
        onChange((l) => [...l, j]);
      } catch (e) {
        refuses.push(e instanceof ApiError ? e.message : `« ${f.nom} » n'a pas pu être envoyé.`);
      } finally {
        setEnvois((l) => {
          const i = l.indexOf(f.nom);
          return i < 0 ? l : [...l.slice(0, i), ...l.slice(i + 1)];
        });
      }
    }
    if (fichiers.length > reste) refuses.push(`${MAX_PAR_DEPENSE} justificatifs au plus par dépense.`);
    if (refuses.length) setErreur(refuses.join(' '));
  };

  const depuisImages = (r: ImagePicker.ImagePickerResult) => {
    if (r.canceled) return;
    envoyer(r.assets.map((a, n) => {
      const nom = a.fileName || `recu-${Date.now()}-${n + 1}.jpg`;
      return { uri: a.uri, nom, type: typeDe(nom, a.mimeType), taille: a.fileSize, file: a.file };
    }));
  };
  const photo = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) {
      setErreur("Me n'a pas accès à l'appareil photo : autorise-le dans les réglages du téléphone.");
      return;
    }
    depuisImages(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 }));
  };
  const galerie = async () => depuisImages(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: Math.max(1, reste) }));
  const fichier = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return;
    envoyer(r.assets.map((a) => ({ uri: a.uri, nom: a.name, type: typeDe(a.name, a.mimeType), taille: a.size, file: a.file })));
  };
  const retirer = (id: string) => onChange((l) => l.filter((x) => x.id !== id));

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: C.muted, fontSize: 13, fontFamily: F.texteM }}>Justificatifs{value.length ? ` (${value.length})` : ''}</Text>
      {value.length || envois.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 6 }}>
          {value.map((j) => (
            <Vignette key={j.id} j={j} onOuvrir={() => setOuvert(j)} onRetirer={modifiable ? () => retirer(j.id) : undefined} />
          ))}
          {envois.map((nom, n) => (
            <View key={`${nom}-${n}`} accessibilityLabel={`Envoi de ${nom}`} style={{ width: COTE, height: COTE, borderRadius: 12, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <ActivityIndicator color={C.accent} />
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 10 }}>Envoi…</Text>
            </View>
          ))}
        </View>
      ) : modifiable ? (
        <T small muted>
          Photo du reçu ou PDF de la facture, pour la retrouver plus tard.
        </T>
      ) : null}
      {modifiable && reste > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {Platform.OS !== 'web' ? <Btn small kind="sec" label="📷 Photo" onPress={photo} /> : null}
          <Btn small kind="sec" label="🖼️ Galerie" onPress={galerie} />
          <Btn small kind="sec" label="📄 Fichier ou PDF" onPress={fichier} />
        </View>
      ) : null}
      {erreur ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 12 }}>{erreur}</Text> : null}
      {ouvert ? (
        <ApercuJustificatif
          j={ouvert}
          onFermer={() => setOuvert(null)}
          onRetirer={
            modifiable
              ? () => {
                  retirer(ouvert.id);
                  setOuvert(null);
                }
              : undefined
          }
        />
      ) : null}
    </View>
  );
}

/** Le trombone d'une ligne de dépense : « 📎 2 ». */
export function MarqueJustificatifs({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <Text accessibilityLabel={`${n} justificatif${n > 1 ? 's' : ''}`} style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>
      📎 {n}
    </Text>
  );
}
