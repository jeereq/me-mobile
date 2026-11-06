import { api, tokenStore } from './api';
import type { RythmeCotisation } from './commun/cotisations';
import type { Cotisation } from './cotisations';

export type PageCotisationPublique = {
  titre: string;
  organisateur: string;
  nom: string;
  montant: number;
  devise: string;
  periode: string;
  restantes: number;
  telephone: string;
  enLigne: boolean;
  etat: 'a_payer' | 'en_attente' | 'a_jour' | 'terminee';
  refus: boolean;
};

async function appel<T>(chemin: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', body?: unknown, discret?: boolean) {
  return api<T>(`/cotisations${chemin}`, { method, body, token: await tokenStore.get(), discret });
}
const une = async (chemin: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => (await appel<{ cotisation: Cotisation }>(chemin, method, body)).cotisation;

export const Cotisations = {
  liste: (discret?: boolean) => appel<{ enLigne: boolean; canaux?: { mail: boolean; sms: boolean }; cotisations: Cotisation[] }>('', 'GET', undefined, discret),
  creer: (c: { titre: string; montant: number; devise: string; rythme: RythmeCotisation }) => une('', 'POST', c),
  modifier: (id: string, c: { titre?: string; montant?: number; archive?: boolean }) => une(`/${id}`, 'PATCH', c),
  supprimer: (id: string) => appel<{ ok: boolean }>(`/${id}`, 'DELETE'),
  ajouterMembre: (id: string, m: { nom: string; telephone: string; email?: string }) => une(`/${id}/membres`, 'POST', m),
  modifierMembre: (id: string, m: { nom: string; telephone: string; email?: string }) => une(`/membres/${id}`, 'PATCH', m),
  retirerMembre: (id: string) => une(`/membres/${id}`, 'DELETE'),
  noterDemande: (id: string, periode: string) => une(`/membres/${id}/demande`, 'POST', { periode }),
  envoyer: (id: string, periode: string) => une(`/membres/${id}/envoi`, 'POST', { periode }),
  marquer: (id: string, periode: string, paye: boolean) => une(`/membres/${id}/paye`, 'POST', { periode, paye }),
};

/** La page ouverte depuis le message : sans compte, le jeton du lien suffit. */
export const CotisationPublique = {
  lire: (jeton: string, discret?: boolean) => api<PageCotisationPublique>(`/cotisations/public/${jeton}`, { discret }),
  payer: (jeton: string) => api<PageCotisationPublique>(`/cotisations/public/${jeton}/payer`, { method: 'POST' }),
  abandonner: (jeton: string) => api<PageCotisationPublique>(`/cotisations/public/${jeton}/abandon`, { method: 'POST' }),
};
