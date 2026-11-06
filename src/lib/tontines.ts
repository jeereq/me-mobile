import { api, apiFormulaire, tokenStore } from './api';
import type { RappelsGroupe, RythmeObjectif } from './commun/cotisations';

export type CarteGroupe = {
  id: string;
  nom: string;
  description: string | null;
  montant: number;
  devise: string;
  rythme: RythmeObjectif;
  places: number;
  mode: 'rotation' | 'objectif';
  visibilite: 'public' | 'prive';
  cautionRequise: boolean;
  raison: string | null;
  beneficiaireNom: string | null;
  dateFin: string | null;
  totalPrevu: number;
  inscrits: number;
  etat: 'ouvert' | 'en_cours' | 'termine' | 'annule';
  organisateur: string;
  organisateurPhoto?: string | null;
  brut: number;
  commission: number;
  net: number;
  monEtat: 'demande' | 'accepte' | 'refuse' | 'parti' | null;
};
export type MembreGroupe = { id: string; nom: string; photo?: string | null; rang: number | null; cautionPayee: boolean; cautionStatut: string | null; aCotise: boolean; enCours?: boolean };
export type TourGroupe = { numero: number; beneficiaire: string; pourMoi: boolean; echeance: string; etat: 'a_venir' | 'collecte' | 'a_verser' | 'verse'; net: number };
export type Groupe = CarteGroupe & {
  paiementOuvert: boolean;
  suisOrganisateur: boolean;
  lienInvitation: string | null;
  rappels: RappelsGroupe;
  collecte: number;
  final: { etat: string; net: number; commission: number } | null;
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
  versements: { tourId: string; raison?: string | null; groupe: string; numero: number; places: number; beneficiaire: string; telephone: string; brut: number; commission: number; net: number; devise: string }[];
  cautions: { membreId: string; groupe: string; nom: string; telephone: string; montant: number; devise: string }[];
};

export type Eligibilite = { statut: 'aucune' | 'soumise' | 'approuvee' | 'refusee'; motif: string | null; telephone: string | null };
export type Approbation = { userId: string; statut: 'soumise' | 'approuvee'; demandeLe: string; nom: string; telephone: string | null; email: string | null };
export type NouveauGroupe = {
  nom: string;
  montant: number;
  devise: string;
  rythme: RythmeObjectif;
  places: number;
  mode: 'rotation' | 'objectif';
  visibilite: 'public' | 'prive';
  cautionRequise?: boolean;
  telephone?: string;
  raison?: string;
  beneficiaire?: { nom: string; telephone: string };
  dateFin?: string;
  rappels?: RappelsGroupe;
  accepte: true;
};

async function appel<T>(chemin: string, method: 'GET' | 'POST' = 'GET', body?: unknown, discret?: boolean) {
  return api<T>(`/tontines${chemin}`, { method, body, token: await tokenStore.get(), discret });
}
const un = async (chemin: string, body?: unknown, method: 'GET' | 'POST' = 'POST', discret?: boolean) => (await appel<{ groupe: Groupe }>(chemin, method, body ?? (method === 'POST' ? {} : undefined), discret)).groupe;

export const Tontines = {
  mesGroupes: (discret?: boolean) => appel<{ groupes: Groupe[] }>('', 'GET', undefined, discret),
  annuaire: (q: string, discret?: boolean) => appel<{ groupes: CarteGroupe[] }>(`/annuaire?q=${encodeURIComponent(q)}`, 'GET', undefined, discret),
  detail: (id: string, discret?: boolean) => un(`/${id}`, undefined, 'GET', discret),
  creer: (c: NouveauGroupe) => un('', c),
  reglerRappels: (id: string, r: RappelsGroupe) => un(`/${id}/rappels`, r),
  adherer: (id: string) => un(`/${id}/adherer`, { accepte: true }),
  invitation: async (code: string) => (await api<{ groupe: CarteGroupe }>(`/tontines/invitation/${code}`, { discret: true })).groupe,
  rejoindre: (code: string, telephone: string) => un(`/invitation/${code}`, { telephone, accepte: true }),
  inviter: (id: string, telephone: string) => appel<{ mail: boolean; sms: boolean }>(`/${id}/inviter`, 'POST', { telephone }),
  payerPour: (membreId: string) => un(`/membres/${membreId}/payer-pour`),
  retirer: (membreId: string) => un(`/membres/${membreId}/retirer`),
  eligibilite: (discret?: boolean) => appel<Eligibilite>('/eligibilite', 'GET', undefined, discret),
  demanderCode: (telephone: string) => appel<Eligibilite>('/eligibilite/code', 'POST', { telephone }),
  confirmerCode: (code: string) => appel<Eligibilite>('/eligibilite/confirmer', 'POST', { code }),
  soumettrePiece: async (form: FormData) => apiFormulaire<Eligibilite>('/tontines/eligibilite', form, await tokenStore.get()),
  approbations: (discret?: boolean) => appel<{ approbations: Approbation[] }>('/admin/approbations', 'GET', undefined, discret),
  piece: (userId: string) => appel<{ type: string; base64: string }>(`/admin/approbations/${userId}/piece`),
  deciderApprobation: (userId: string, approuve: boolean, motif?: string) => appel<{ approbations: Approbation[] }>(`/admin/approbations/${userId}`, 'POST', { approuve, motif }),
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
