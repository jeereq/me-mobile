import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { debutChargement } from './chargement';

/**
 * Adresse de me-api, ou null quand l'app tourne en mode local (aucune variable configurée).
 * En mode local, tout reste sur le téléphone et l'unique utilisateur est admin.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || null;

export type ApiUser = { id: string; email: string; nom: string; role: 'ADMIN' | 'UTILISATEUR' };
export type Session = { token: string; user: ApiUser };

const KEY_TOKEN = 'me.token';

// Le token va dans le trousseau du téléphone ; le web n'en a pas, il garde le stockage du navigateur.
export const tokenStore = {
  get: () => (Platform.OS === 'web' ? AsyncStorage.getItem(KEY_TOKEN) : SecureStore.getItemAsync(KEY_TOKEN)),
  set: (t: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(KEY_TOKEN, t) : SecureStore.setItemAsync(KEY_TOKEN, t)),
  clear: () => (Platform.OS === 'web' ? AsyncStorage.removeItem(KEY_TOKEN) : SecureStore.deleteItemAsync(KEY_TOKEN)),
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type OptionsApi = { method?: string; body?: unknown; token?: string | null; /** Sans barre de chargement (synchro en arrière-plan). */ discret?: boolean };

/** Appelle me-api et renvoie le JSON, ou lève une ApiError avec un message lisible. */
export async function api<T>(path: string, opts: OptionsApi = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, "Aucun serveur configuré (EXPO_PUBLIC_API_URL, voir le README).");
  const fin = opts.discret ? () => {} : debutChargement();
  try {
    return await appeler<T>(path, opts);
  } finally {
    fin();
  }
}

async function appeler<T>(path: string, opts: OptionsApi): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Serveur injoignable. Vérifie ta connexion.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error || data?.message || `Erreur ${res.status}`);
  return data as T;
}
