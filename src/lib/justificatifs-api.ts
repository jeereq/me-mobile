import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { API_URL, api, apiFormulaire, tokenStore } from './api';
import { type FichierChoisi, typeDe } from './justificatifs';
import type { Justificatif } from './types';

/** Dépose le fichier sur me-api ; `equipe` quand la dépense est dans l'espace d'une équipe. */
export async function envoyerJustificatif(f: FichierChoisi, equipe?: string): Promise<Justificatif> {
  const form = new FormData();
  const type = typeDe(f.nom, f.type);
  if (Platform.OS === 'web') form.append('fichier', f.file ?? (await (await fetch(f.uri)).blob()), f.nom);
  // React Native lit lui-même le fichier local désigné par `uri`.
  else form.append('fichier', { uri: f.uri, name: f.nom, type } as unknown as Blob);
  if (equipe) form.append('equipe', equipe);
  const { justificatif } = await apiFormulaire<{ justificatif: Justificatif }>('/justificatifs', form, await tokenStore.get());
  return justificatif;
}

let dispo: Promise<boolean> | null = null;

/** Le serveur sait-il garder des justificatifs (Cloudinary configuré) ? Demandé une fois par lancement de l'app. */
export function useJustificatifsDisponibles() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!API_URL) return;
    dispo ??= tokenStore
      .get()
      .then((token) => api<{ disponible: boolean }>('/justificatifs', { token, discret: true }))
      .then((r) => !!r.disponible)
      .catch(() => {
        dispo = null;
        return false;
      });
    let actif = true;
    dispo.then((v) => actif && setOk(v));
    return () => {
      actif = false;
    };
  }, []);
  return ok;
}
