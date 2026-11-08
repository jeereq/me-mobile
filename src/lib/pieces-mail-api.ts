import { Platform } from 'react-native';

import { API_URL, api, apiFormulaire } from './api';
import type { FichierChoisi } from './justificatifs';
import type { AnalysePiece, Tableau } from './pieces-mail';

const cheminPiece = (compte: string, mail: string, piece: string) => `/integrations/${compte}/mails/${encodeURIComponent(mail)}/pieces/${encodeURIComponent(piece)}`;

/** Envoie un mail : en JSON sans fichier, en formulaire avec. Le serveur attend les mêmes données dans les deux cas. */
export async function envoyerMail(chemin: string, donnees: object, pieces: FichierChoisi[] | undefined, token: string) {
  if (!pieces?.length) return api(chemin, { method: 'POST', body: donnees, token });
  const form = new FormData();
  form.append('donnees', JSON.stringify(donnees));
  for (const f of pieces) {
    if (Platform.OS === 'web') form.append('pieces', f.file ?? (await (await fetch(f.uri)).blob()), f.nom);
    // React Native lit lui-même le fichier local désigné par `uri`.
    else form.append('pieces', { uri: f.uri, name: f.nom, type: f.type || 'application/octet-stream' } as unknown as Blob);
  }
  return apiFormulaire(`${chemin}/pieces`, form, token);
}

/** L'adresse courte d'une pièce jointe. `message` : un ancien message du fil de `mail`. */
export async function lienPiece(compte: string, mail: string, piece: string, message: string | undefined, token: string) {
  const { url } = await api<{ url: string }>(`${cheminPiece(compte, mail, piece)}/lien`, { method: 'POST', body: message ? { message } : {}, token });
  return `${API_URL}${url}`;
}

/** Les lignes d'un CSV ou d'un Excel joint, lues par le serveur. */
export async function donneesPiece(compte: string, mail: string, piece: string, message: string | undefined, token: string) {
  const { tableau } = await api<{ tableau: Tableau | null }>(`${cheminPiece(compte, mail, piece)}/donnees`, { method: 'POST', body: message ? { message } : {}, token });
  return tableau;
}

/** Fait lire la pièce jointe par l'IA : ce qu'elle est, ce qu'elle dit, la dépense à préparer. */
export async function analyserPiece(compte: string, mail: string, piece: string, o: { message?: string; aujourdhui: string; devise: string }, token: string) {
  const { analyse } = await api<{ analyse: AnalysePiece }>(`${cheminPiece(compte, mail, piece)}/analyse`, { method: 'POST', body: o, token });
  return analyse;
}
