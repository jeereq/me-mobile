import { api, apiFormulaire, tokenStore } from './api';
import type { Alerte, Confiance, FiltresAlerte } from './annuaire';
import type { LimitesCotisation, RappelsGroupe, ReglesGroupe, ReglesPartielles, ReglesPlateforme, RythmeObjectif } from './commun/cotisations';

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
  monEtat: 'demande' | 'accepte' | 'refuse' | 'parti' | 'exclu' | null;
  /** Absent avec un ancien serveur. */
  confiance?: Confiance | null;
  /** La page du groupe dans l'annuaire, à partager. */
  lien?: string | null;
};
export type MembreGroupe = { id: string; nom: string; photo?: string | null; rang: number | null; cautionPayee: boolean; cautionStatut: string | null; aCotise: boolean; enCours?: boolean; /** Absents avec un ancien serveur. */ retards?: number; /** Pour l'organisateur : la cotisation due (pénalité comprise), ce qu'il a noté en espèces. */ du?: number | null; especes?: number };
export type TourGroupe = { numero: number; beneficiaire: string; pourMoi: boolean; echeance: string; etat: 'a_venir' | 'collecte' | 'a_verser' | 'verse'; net: number; especes?: number; /** L'initiateur a demandé le versement (absent avec un ancien serveur). */ versementDemandeLe?: string | null };
/** Une invitation envoyée par Me : le numéro est masqué. */
export type InvitationEnvoyee = { id: string; numero: string; mail: boolean; sms: boolean; envois: number; envoyeLe: string; rejointLe: string | null };
export type MotifSignalement = 'arnaque' | 'trompeur' | 'inapproprie' | 'autre';
export const MOTIFS: { key: MotifSignalement; titre: string; sous: string }[] = [
  { key: 'arnaque', titre: 'Arnaque', sous: 'Demande de payer hors de Me, promesses de gains.' },
  { key: 'trompeur', titre: 'Informations fausses', sous: 'Nom, raison ou bénéficiaire trompeurs.' },
  { key: 'inapproprie', titre: 'Contenu choquant', sous: 'Nom ou description offensants.' },
  { key: 'autre', titre: 'Autre chose', sous: 'Explique ce qui ne va pas.' },
];
export type Signalement = { tontineId: string; groupe: string; organisateur: string; organisateurId: string | null; membres: number; retire: boolean; nombre: number; motifs: { motif: MotifSignalement; texte: string | null; le: string }[] };

export type Groupe = CarteGroupe & {
  paiementOuvert: boolean;
  /** Absents avec un ancien serveur. */
  commissionBps?: number;
  demandesParInitiateur?: boolean;
  suisOrganisateur: boolean;
  lienInvitation: string | null;
  rappels: RappelsGroupe;
  /** Absents avec un ancien serveur. */
  regles?: ReglesGroupe;
  texteRegles?: string[];
  reglesModifiables?: boolean;
  invitations?: InvitationEnvoyee[];
  collecte: number;
  final: { etat: string; net: number; commission: number; versementDemandeLe?: string | null } | null;
  tourCourant: number;
  jour: string;
  moi: { id: string; etat: string; rang: number | null; cautionStatut: string; telephone: string } | null;
  aPayer: { genre: 'caution' | 'cotisation'; montant: number; penalite?: number } | null;
  enAttente: boolean;
  refus: boolean;
  membres: MembreGroupe[];
  demandes: { id: string; nom: string }[];
  tours: TourGroupe[];
};
export type ResumeAdmin = {
  versementApi: boolean;
  totaux: { devise: string; detenu: number; commission: number }[];
  versements: { tourId: string; raison?: string | null; groupe: string; numero: number; places: number; beneficiaire: string; telephone: string; brut: number; commission: number; net: number; devise: string; especes?: number; demandeLe?: string | null; demandes?: number }[];
  cautions: { membreId: string; groupe: string; nom: string; telephone: string; montant: number; devise: string }[];
};

export type Eligibilite = { statut: 'aucune' | 'soumise' | 'approuvee' | 'refusee'; motif: string | null; telephone: string | null };
export type DossierEligibilite = {
  nomComplet: string;
  dateNaissance: string;
  ville: string;
  commune: string;
  activite: string;
  typePiece: 'carte_electeur' | 'passeport' | 'permis' | 'autre';
  capaciteMensuelle: number;
  contactNom: string;
  contactTelephone: string;
};
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
  regles?: ReglesPartielles;
  accepte: true;
};

async function appel<T>(chemin: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: unknown, discret?: boolean) {
  return api<T>(`/tontines${chemin}`, { method, body, token: await tokenStore.get(), discret });
}
const un = async (chemin: string, body?: unknown, method: 'GET' | 'POST' = 'POST', discret?: boolean) => (await appel<{ groupe: Groupe }>(chemin, method, body ?? (method === 'POST' ? {} : undefined), discret)).groupe;

export const Tontines = {
  mesGroupes: (discret?: boolean) => appel<{ groupes: Groupe[] }>('', 'GET', undefined, discret),
  annuairePublic: (requete: string) => api<{ groupes: CarteGroupe[] }>(`/tontines/public/annuaire?${requete}`, { discret: true }),
  limites: () => api<LimitesCotisation & { plateforme?: ReglesPlateforme }>('/tontines/limites', { discret: true }),
  annuaire: (requete: string) => appel<{ groupes: CarteGroupe[] }>(`/annuaire?${requete}`, 'GET', undefined, true),
  groupePublic: async (id: string) => (await api<{ groupe: CarteGroupe }>(`/tontines/public/annuaire/${encodeURIComponent(id)}`, { discret: true })).groupe,
  groupeAnnuaire: async (id: string) => (await appel<{ groupe: CarteGroupe }>(`/annuaire/${encodeURIComponent(id)}`, 'GET', undefined, true)).groupe,
  signaler: (id: string, motif: MotifSignalement, texte?: string) => appel<{ ok: true }>(`/annuaire/${id}/signaler`, 'POST', { motif, texte }),
  alertes: () => appel<{ alertes: Alerte[] }>('/alertes', 'GET', undefined, true),
  creerAlerte: (f: FiltresAlerte) => appel<{ alertes: Alerte[] }>('/alertes', 'POST', f),
  supprimerAlerte: (id: string) => appel<{ alertes: Alerte[] }>(`/alertes/${id}`, 'DELETE'),
  signalements: (discret?: boolean) => appel<{ signalements: Signalement[] }>('/admin/signalements', 'GET', undefined, discret),
  deciderSignalement: (id: string, decision: 'retirer' | 'rejeter') => appel<{ signalements: Signalement[] }>(`/admin/signalements/${id}`, 'POST', { decision }),
  detail: (id: string, discret?: boolean) => un(`/${id}`, undefined, 'GET', discret),
  creer: (c: NouveauGroupe) => un('', c),
  reglerRappels: (id: string, r: RappelsGroupe) => un(`/${id}/rappels`, r),
  adherer: (id: string) => un(`/${id}/adherer`, { accepte: true }),
  invitation: async (code: string) => (await api<{ groupe: CarteGroupe }>(`/tontines/invitation/${code}`, { discret: true })).groupe,
  rejoindre: (code: string, telephone: string) => un(`/invitation/${code}`, { telephone, accepte: true }),
  inviter: (id: string, telephone: string) => appel<{ mail: boolean; sms: boolean; groupe?: Groupe }>(`/${id}/inviter`, 'POST', { telephone }),
  reglerRegles: (id: string, r: ReglesPartielles) => un(`/${id}/regles`, r),
  ordonner: (id: string, membres: string[]) => un(`/${id}/ordre`, { membres }),
  demanderPaiement: (membreId: string) => un(`/membres/${membreId}/demander`),
  demanderVersement: (id: string) => un(`/${id}/demander-versement`),
  demanderATous: (id: string) => appel<{ envoyees: number; enCours: number; limite: number; groupe: Groupe }>(`/${id}/demander-tous`, 'POST', {}),
  noterEspeces: (membreId: string) => un(`/membres/${membreId}/especes`),
  exclure: (membreId: string) => un(`/membres/${membreId}/exclure`),
  payerPour: (membreId: string) => un(`/membres/${membreId}/payer-pour`),
  retirer: (membreId: string) => un(`/membres/${membreId}/retirer`),
  eligibilite: (discret?: boolean) => appel<Eligibilite>('/eligibilite', 'GET', undefined, discret),
  demanderCode: (telephone: string) => appel<Eligibilite>('/eligibilite/code', 'POST', { telephone }),
  confirmerCode: (code: string) => appel<Eligibilite>('/eligibilite/confirmer', 'POST', { code }),
  soumettrePiece: async (form: FormData) => apiFormulaire<Eligibilite>('/tontines/eligibilite', form, await tokenStore.get()),
  approbations: (discret?: boolean) => appel<{ approbations: Approbation[] }>('/admin/approbations', 'GET', undefined, discret),
  dossier: (userId: string) => appel<{ type: string | null; base64: string | null; dossier: DossierEligibilite | null }>(`/admin/approbations/${userId}/piece`, 'GET', undefined, true),
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
