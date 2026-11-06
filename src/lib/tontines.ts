import { api, tokenStore } from './api';
import type { RythmeTontine } from './commun/cotisations';

export type CarteGroupe = {
  id: string;
  nom: string;
  description: string | null;
  montant: number;
  devise: string;
  rythme: RythmeTontine;
  places: number;
  inscrits: number;
  etat: 'ouvert' | 'en_cours' | 'termine' | 'annule';
  organisateur: string;
  brut: number;
  commission: number;
  net: number;
  monEtat: 'demande' | 'accepte' | 'refuse' | 'parti' | null;
};
export type MembreGroupe = { id: string; nom: string; rang: number | null; cautionPayee: boolean; cautionStatut: string | null; aCotise: boolean };
export type TourGroupe = { numero: number; beneficiaire: string; pourMoi: boolean; echeance: string; etat: 'a_venir' | 'collecte' | 'a_verser' | 'verse'; net: number };
export type Groupe = CarteGroupe & {
  paiementOuvert: boolean;
  suisOrganisateur: boolean;
  tourCourant: number;
  jour: string;
  moi: { id: string; etat: string; rang: number | null; cautionStatut: string; telephone: string } | null;
  aPayer: { genre: 'caution' | 'cotisation'; montant: number } | null;
  enAttente: boolean;
  refus: boolean;
  membres: MembreGroupe[];
  demandes: { id: string; nom: string }[];
  tours: TourGroupe[];
};
export type ResumeAdmin = {
  versementApi: boolean;
  totaux: { devise: string; detenu: number; commission: number }[];
  versements: { tourId: string; groupe: string; numero: number; places: number; beneficiaire: string; telephone: string; brut: number; commission: number; net: number; devise: string }[];
  cautions: { membreId: string; groupe: string; nom: string; telephone: string; montant: number; devise: string }[];
};

async function appel<T>(chemin: string, method: 'GET' | 'POST' = 'GET', body?: unknown, discret?: boolean) {
  return api<T>(`/tontines${chemin}`, { method, body, token: await tokenStore.get(), discret });
}
const un = async (chemin: string, body?: unknown, method: 'GET' | 'POST' = 'POST', discret?: boolean) => (await appel<{ groupe: Groupe }>(chemin, method, body ?? (method === 'POST' ? {} : undefined), discret)).groupe;

export const Tontines = {
  mesGroupes: (discret?: boolean) => appel<{ groupes: Groupe[] }>('', 'GET', undefined, discret),
  annuaire: (q: string, discret?: boolean) => appel<{ groupes: CarteGroupe[] }>(`/annuaire?q=${encodeURIComponent(q)}`, 'GET', undefined, discret),
  detail: (id: string, discret?: boolean) => un(`/${id}`, undefined, 'GET', discret),
  creer: (c: { nom: string; description?: string; montant: number; devise: string; rythme: RythmeTontine; places: number; telephone: string; accepte: true }) => un('', c),
  adherer: (id: string, telephone: string) => un(`/${id}/adherer`, { telephone, accepte: true }),
  quitter: (id: string) => un(`/${id}/quitter`),
  annuler: (id: string) => un(`/${id}/annuler`),
  demarrer: (id: string) => un(`/${id}/demarrer`),
  payer: (id: string, genre: 'caution' | 'cotisation') => un(`/${id}/payer`, { genre }),
  abandonner: (id: string) => un(`/${id}/abandon`),
  decider: (membreId: string, accepte: boolean) => un(`/membres/${membreId}/decision`, { accepte }),
  rappeler: async (membreId: string) => appel<{ groupe: Groupe; nouveau: boolean; mail: boolean; sms: boolean }>(`/membres/${membreId}/rappel`, 'POST', {}),
  utiliserCaution: (membreId: string) => un(`/membres/${membreId}/caution`),
  resumeAdmin: (discret?: boolean) => appel<ResumeAdmin>('/admin/resume', 'GET', undefined, discret),
  verser: (tourId: string, preuve?: string) => appel<ResumeAdmin>(`/admin/tours/${tourId}/verser`, 'POST', { preuve }),
  rendre: (membreId: string, preuve?: string) => appel<ResumeAdmin>(`/admin/membres/${membreId}/rendre`, 'POST', { preuve }),
};
