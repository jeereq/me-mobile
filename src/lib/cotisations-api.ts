import { api, tokenStore } from './api';
import type { Cotisation } from './cotisations';

async function appel<T>(chemin: string, method: 'GET' | 'DELETE' = 'GET') {
  return api<T>(`/cotisations${chemin}`, { method, token: await tokenStore.get(), discret: true });
}

/** Les anciennes collectes, en lecture : seul l'effacement reste possible. */
export const Collectes = {
  liste: () => appel<{ cotisations: Cotisation[] }>(''),
  supprimer: (id: string) => appel<{ ok: boolean }>(`/${id}`, 'DELETE'),
  retirerMembre: async (id: string) => (await appel<{ cotisation: Cotisation }>(`/membres/${id}`, 'DELETE')).cotisation,
};
