import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { estPro, type EtatAbonnement } from './abonnement';
import { api, ApiError, API_URL, tokenStore, type ApiUser, type Session } from './api';
import { DEFAULT_CONFIG, nouvelEspace } from './defaults';
import { cheminEspace, clePortee, memePortee, peutEcrireEquipe, PORTEE_MOI, type ApercuInvitation, type Equipe, type Portee, type ResultatInvitation, type RoleEquipe } from './equipes';
import { fusionEspace, pousserEspace, rapprocher, type Distant, type EtatSync } from './fusion';
import { planifierRappels } from './reminders';
import type { Mail } from './mails';
import { differe, fusionner, type CompteConnecte, type Synchro } from './sync';
import type { Config, Espace } from './types';

export type NotificationMe = { id: string; titre: string; corps: string; mode: string; quand: string; lu: boolean; parEmail: boolean; createdAt: string };
type Notifs = { notifications: NotificationMe[]; nonLues: number; email: boolean };

type Profil = { id: string; nom: string; role: 'admin' | 'utilisateur'; email?: string };

type Store = {
  ready: boolean;
  mode: 'local' | 'cloud';
  session: Session | null;
  profil: Profil | null;
  isAdmin: boolean;
  /** Offre en cours (null en mode local ou avec un serveur sans abonnements). */
  abonnement: EtatAbonnement | null;
  /** Les fonctions Pro sont ouvertes (Pro, essai, admin, ou abonnements coupés). */
  pro: boolean;
  /** Relit le compte (après un paiement, par exemple). */
  rafraichirCompte: () => Promise<void>;
  espace: Espace;
  config: Config;
  /** Applique une modification à l'espace affiché, sauvegardée et synchronisée. Sans effet sur l'espace d'une équipe où je suis lecteur. */
  update: (fn: (e: Espace) => Espace) => void;
  /** Quel espace est affiché : le mien, ou celui d'une équipe. */
  portee: Portee;
  /** Change d'espace ; celui de l'équipe se charge comme le mien (cache d'abord, puis serveur). */
  choisirPortee: (p: Portee) => void;
  /** L'équipe affichée, ou null quand c'est mon espace. */
  equipeActive: Equipe | null;
  /** Vrai quand l'espace affiché est celui d'une équipe où je ne suis que lecteur. */
  lectureSeule: boolean;
  /** Horodatage du dernier changement refusé faute de droits : sert à prévenir l'utilisateur. */
  refusEcriture: number;
  /** Mes équipes, avec leurs membres (et les invitations en attente quand j'en suis propriétaire). */
  equipes: Equipe[];
  equipesChargees: boolean;
  /** Vrai quand le serveur ne connaît pas encore les équipes (me-api pas à jour) : l'écran le dit au lieu d'un message obscur. */
  equipesIndisponibles: boolean;
  rechargerEquipes: () => Promise<void>;
  creerEquipe: (nom: string, emoji?: string) => Promise<string>;
  renommerEquipe: (id: string, patch: { nom?: string; emoji?: string }) => Promise<void>;
  supprimerEquipe: (id: string) => Promise<void>;
  inviterEquipe: (id: string, email: string, role: RoleEquipe) => Promise<ResultatInvitation>;
  annulerInvitation: (id: string, invitationId: string) => Promise<void>;
  changerRoleEquipe: (id: string, membreId: string, role: RoleEquipe) => Promise<void>;
  retirerDeLEquipe: (id: string, membreId: string) => Promise<void>;
  apercuInvitation: (jeton: string) => Promise<ApercuInvitation>;
  /** Accepte une invitation reçue par email et bascule sur l'espace de l'équipe. */
  rejoindreEquipe: (jeton: string) => Promise<string>;
  /** Réservé à l'admin : enregistre la configuration système. */
  saveConfig: (c: Config) => Promise<void>;
  membres: Profil[];
  /** La liste des comptes (admin) a répondu, même par une erreur. */
  membresCharges: boolean;
  /** Réservé à l'admin : nomme ou retire un admin. */
  changerRole: (id: string, role: Profil['role']) => Promise<void>;
  /** Vrai le temps de charger un autre espace après un changement d'équipe. */
  chargementEspace: boolean;
  syncState: 'ok' | 'en_cours' | 'erreur' | 'local';
  /** Renvoie l'espace au serveur après une coupure (ou reprend celui du serveur s'il est plus récent). */
  reessayer: () => Promise<void>;
  /** Comptes externes connectés (Google, Microsoft, Trello, Slack). */
  externes: CompteConnecte[];
  /** Fils récents des boîtes mail connectées (pas gardés dans l'espace : ils se relisent à chaque synchronisation). */
  mails: Mail[];
  /** Récupère les éléments importés ; `forcer` demande au serveur de relire les comptes tout de suite. */
  synchroniser: (forcer?: boolean, discret?: boolean) => Promise<void>;
  /** Rappels envoyés par le serveur (centre de notifications). */
  notifs: Notifs;
  chargerNotifs: () => Promise<void>;
  /** Rappel arrivé pendant que l'app est ouverte, affiché en bandeau puis effacé. */
  nouvelle: NotificationMe | null;
  fermerNouvelle: () => void;
  marquerLues: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Renvoie l'email à confirmer quand le serveur l'exige, sinon ouvre la session. */
  signUp: (email: string, password: string, nom: string) => Promise<string | null>;
  /** Ouvre une session reçue autrement (lien de confirmation, Google, nouveau mot de passe). */
  ouvrirSession: (s: Session) => Promise<void>;
  changerMotDePasse: (actuel: string, nouveau: string) => Promise<void>;
  supprimerCompte: (confirmation: string) => Promise<void>;
  /** Ferme les sessions de tous les appareils ; celui-ci reste connecté avec un nouveau jeton. */
  deconnecterTout: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
const keyEspace = (id: string) => `me:espace:${id}`;
const keyEtat = (id: string) => `me:sync:${id}`;
const KEY_CONFIG = 'me:config';
const KEY_USER = 'me:user';
const keyPortee = (userId: string) => `me:portee:${userId}`;

const mergeConfig = (c?: Partial<Config> | null): Config => ({
  ...DEFAULT_CONFIG,
  ...(c || {}),
  modes: { ...DEFAULT_CONFIG.modes, ...(c?.modes || {}) },
  canaux: { ...DEFAULT_CONFIG.canaux, ...(c?.canaux || {}) },
  defauts: { ...DEFAULT_CONFIG.defauts, ...(c?.defauts || {}) },
  sourcesAutorisees: { ...DEFAULT_CONFIG.sourcesAutorisees, ...(c?.sourcesAutorisees || {}) },
  assistant: { ...DEFAULT_CONFIG.assistant, ...(c?.assistant || {}) },
  theme: { ...DEFAULT_CONFIG.theme, ...(c?.theme || {}) },
});

const toProfil = (u: ApiUser): Profil => ({ id: u.id, nom: u.nom, email: u.email, role: u.role === 'ADMIN' ? 'admin' : 'utilisateur' });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [authChecked, setAuthChecked] = useState(!API_URL);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [espace, setEspace] = useState<Espace>(() => nouvelEspace(DEFAULT_CONFIG));
  const [membres, setMembres] = useState<Profil[]>([]);
  const [membresCharges, setMembresCharges] = useState(false);
  const [externes, setExternes] = useState<CompteConnecte[]>([]);
  const [mails, setMails] = useState<Mail[]>([]);
  const [notifs, setNotifs] = useState<Notifs>({ notifications: [], nonLues: 0, email: false });
  const [nouvelle, setNouvelle] = useState<NotificationMe | null>(null);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipesChargees, setEquipesChargees] = useState(false);
  const [equipesIndisponibles, setEquipesIndisponibles] = useState(false);
  const [porteeChoisie, setPortee] = useState<Portee>(PORTEE_MOI);
  const [refusEcriture, setRefusEcriture] = useState(0);
  // Ids déjà vus : null tant que la première liste n'est pas chargée (rien n'est « nouveau » à l'ouverture).
  const vues = useRef<Set<string> | null>(null);
  const [syncState, setSyncState] = useState<Store['syncState']>(API_URL ? 'ok' : 'local');
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dernier espace connu, pour la reprise après une coupure réseau.
  const espaceRef = useRef(espace);
  useEffect(() => {
    espaceRef.current = espace;
  }, [espace]);
  // Version du serveur lue en dernier et son contenu : sert à fusionner au lieu d'écraser quand un autre appareil a écrit entre-temps.
  const etatRef = useRef<EtatSync | null>(null);
  // Les envois se font un par un : un envoi lancé pendant un autre attend son tour.
  const file = useRef<Promise<void>>(Promise.resolve());
  const token = session?.token ?? null;
  const userId = API_URL ? session?.user.id ?? null : 'local';
  const user = session?.user;
  const profil = useMemo<Profil | null>(() => (API_URL ? (user ? toProfil(user) : null) : { id: 'local', nom: '', role: 'admin' }), [user]);

  // La portée dit quel espace est affiché ; sa clé sert au cache sur l'appareil comme à l'adresse de synchro.
  // Une équipe quittée ou supprimée ailleurs disparaît de la liste : on retombe sur mon espace plutôt que d'afficher du vide.
  const portee = useMemo<Portee>(
    () => (porteeChoisie.type === 'equipe' && equipesChargees && !equipes.some((e) => e.id === porteeChoisie.id) ? PORTEE_MOI : porteeChoisie),
    [porteeChoisie, equipes, equipesChargees],
  );
  const equipeActive = useMemo(() => (portee.type === 'equipe' ? equipes.find((e) => e.id === portee.id) ?? null : null), [portee, equipes]);
  const lectureSeule = !!equipeActive && !peutEcrireEquipe(equipeActive.monRole);
  const scope = userId ? clePortee(userId, portee) : null;
  // La portée au moment d'un envoi : une synchro lancée avant un changement d'espace ne doit pas écrire dans le nouveau.
  const porteeRef = useRef(portee);
  useEffect(() => {
    porteeRef.current = portee;
  }, [portee]);

  const ouvrir = useCallback(async (s: Session) => {
    await Promise.all([tokenStore.set(s.token), AsyncStorage.setItem(KEY_USER, JSON.stringify(s.user))]);
    setSession(s);
  }, []);

  const signOut = useCallback(async () => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    await Promise.all([tokenStore.clear(), AsyncStorage.removeItem(KEY_USER)]);
    setSession(null);
    setLoadedFor(null);
    setMembres([]);
    setExternes([]);
    setNotifs({ notifications: [], nonLues: 0, email: false });
    setNouvelle(null);
    setEquipes([]);
    setEquipesChargees(false);
    setPortee(PORTEE_MOI);
    vues.current = null;
    etatRef.current = null;
  }, []);

  /** Un 401 veut dire session expirée ou compte supprimé : retour à l'écran de connexion. */
  const call = useCallback(
    async <T,>(path: string, opts: { method?: string; body?: unknown; discret?: boolean } = {}) => {
      try {
        return await api<T>(path, { ...opts, token });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) signOut();
        throw e;
      }
    },
    [token, signOut],
  );

  const memoriserEtat = useCallback(
    (etat: EtatSync) => {
      etatRef.current = etat;
      if (scope) AsyncStorage.setItem(keyEtat(scope), JSON.stringify(etat));
    },
    [scope],
  );

  /** Compare l'espace du téléphone à celui du serveur (fusion si quelqu'un d'autre a écrit). Renvoie vrai s'il reste des changements à envoyer. */
  const reconcilier = useCallback(async () => {
    const { espace: distant } = await call<{ espace: Distant | null }>(cheminEspace(portee), { discret: true });
    const local = espaceRef.current;
    const r = rapprocher(distant, local, etatRef.current);
    memoriserEtat(r.etat);
    if (r.espace !== local) {
      espaceRef.current = r.espace;
      setEspace(r.espace);
      if (scope) AsyncStorage.setItem(keyEspace(scope), JSON.stringify(r.espace));
    }
    return r.aPousser;
  }, [call, memoriserEtat, scope, portee]);

  /**
   * Synchronise l'espace avec le serveur, un envoi à la fois.
   * `recuperer` : lit d'abord le serveur (reprise après une coupure) ; sinon envoie directement, et fusionne si le serveur répond par un conflit.
   */
  const synchroEspace = useCallback(
    (recuperer: boolean): Promise<void> => {
      if (!API_URL || !token || !scope) return Promise.resolve();
      const faire = async () => {
        // Le temps d'attendre son tour, l'utilisateur a pu changer d'espace : cet envoi n'a plus lieu d'être.
        if (!memePortee(porteeRef.current, portee)) return;
        setSyncState('en_cours');
        try {
          // Sans historique de synchro (première ouverture hors ligne), on lit le serveur avant d'écrire : jamais d'écriture à l'aveugle.
          if ((recuperer || !etatRef.current) && !(await reconcilier())) {
            setSyncState('ok');
            return;
          }
          const poussee = await pousserEspace((chemin, o) => call(chemin, { ...o, discret: true }), etatRef.current ?? { revision: null, base: null }, () => espaceRef.current, cheminEspace(portee));
          memoriserEtat(poussee.etat);
          if (poussee.fusion) {
            // Quelqu'un d'autre avait écrit : on affiche aussi ses changements.
            const { base, distant } = poussee.fusion;
            setEspace((prev) => {
              const m = fusionEspace(base, prev, distant);
              espaceRef.current = m;
              AsyncStorage.setItem(keyEspace(scope), JSON.stringify(m));
              return m;
            });
          }
          setSyncState('ok');
        } catch {
          setSyncState('erreur');
        }
      };
      const tour = file.current.then(faire);
      file.current = tour;
      return tour;
    },
    [call, token, scope, portee, reconcilier, memoriserEtat],
  );

  // Session enregistrée sur le téléphone : on la vérifie auprès du serveur.
  useEffect(() => {
    if (!API_URL) return;
    (async () => {
      const t = await tokenStore.get();
      if (t) {
        try {
          const { user } = await api<{ user: ApiUser }>('/auth/me', { token: t });
          await AsyncStorage.setItem(KEY_USER, JSON.stringify(user));
          setSession({ token: t, user });
        } catch (e) {
          const cache = await AsyncStorage.getItem(KEY_USER);
          // Hors ligne : on garde la session connue, l'espace en cache s'affiche et se synchronisera plus tard.
          if (!(e instanceof ApiError && e.status === 401) && cache) setSession({ token: t, user: JSON.parse(cache) });
          else await tokenStore.clear();
        }
      }
      setAuthChecked(true);
    })();
  }, []);

  // Chargement : cache local d'abord, puis le serveur s'il est configuré. Refait à chaque changement d'espace.
  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    (async () => {
      const [rawE, rawC, rawS] = await Promise.all([AsyncStorage.getItem(keyEspace(scope)), AsyncStorage.getItem(KEY_CONFIG), AsyncStorage.getItem(keyEtat(scope))]);
      let cfg = mergeConfig(rawC ? JSON.parse(rawC) : null);
      let esp: Espace | null = rawE ? JSON.parse(rawE) : null;
      let etat: EtatSync | null = rawS ? JSON.parse(rawS) : null;
      let aPousser = false;
      let enLigne = !API_URL;
      if (API_URL && token) {
        try {
          const [c, e] = await Promise.all([
            api<{ config: Partial<Config> }>('/config', { token }),
            api<{ espace: Distant | null }>(cheminEspace(portee), { token }),
          ]);
          cfg = mergeConfig(c.config);
          enLigne = true;
          if (e.espace || esp) {
            // Serveur inchangé : on garde le téléphone ; serveur plus avancé : on fusionne ; jamais d'écrasement.
            const r = rapprocher(e.espace, esp, etat);
            esp = r.espace;
            etat = r.etat;
            aPousser = r.aPousser;
          }
        } catch {
          setSyncState('erreur');
        }
      }
      if (!esp) {
        esp = nouvelEspace(cfg);
        if (API_URL && token && enLigne) {
          etat = { revision: 0, base: null };
          aPousser = true;
        }
      }
      if (cancelled) return;
      etatRef.current = etat;
      espaceRef.current = esp;
      setConfig(cfg);
      setEspace(esp);
      AsyncStorage.setItem(KEY_CONFIG, JSON.stringify(cfg));
      AsyncStorage.setItem(keyEspace(scope), JSON.stringify(esp));
      if (etat) AsyncStorage.setItem(keyEtat(scope), JSON.stringify(etat));
      setLoadedFor(scope);
      if (aPousser) synchroEspace(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, portee, token, synchroEspace]);

  // Prêt dès qu'un espace est chargé (ou qu'il faut se connecter) : pendant un changement d'espace, la navigation reste en place.
  const ready = authChecked && ((!!API_URL && !session) || (!!scope && !!loadedFor));
  /** Vrai le temps de charger un autre espace : l'écran affiche encore le précédent, à masquer. */
  const chargementEspace = !!scope && loadedFor !== scope;
  const isAdmin = profil?.role === 'admin';

  // Liste des comptes pour l'admin
  useEffect(() => {
    if (!API_URL || !isAdmin || !ready || !token) return;
    api<{ membres: ApiUser[] }>('/membres', { token })
      .then(({ membres: m }) => setMembres(m.map(toProfil)))
      .catch(() => {})
      .finally(() => setMembresCharges(true));
  }, [isAdmin, ready, token]);

  // Rappels : replanifiés à chaque changement utile
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => planifierRappels(espace, config), 800);
    return () => clearTimeout(t);
  }, [ready, espace, config]);

  const reessayer = useCallback(() => synchroEspace(true), [synchroEspace]);

  // Hors ligne : nouvel essai au retour du réseau, et toutes les 30 s en attendant.
  useEffect(() => {
    if (syncState !== 'erreur') return;
    const t = setInterval(reessayer, 30000);
    const enLigne = () => reessayer();
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('online', enLigne);
    return () => {
      clearInterval(t);
      if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('online', enLigne);
    };
  }, [syncState, reessayer]);

  const update = useCallback(
    (fn: (e: Espace) => Espace) => {
      // Lecteur d'une équipe : rien n'est modifié, ni sur l'appareil ni sur le serveur (qui refuserait de toute façon).
      if (lectureSeule) {
        // Un clic sans effet passerait pour un bug : on le dit à l'écran.
        setRefusEcriture(Date.now());
        return;
      }
      setEspace((prev) => {
        const res = fn(prev);
        if (res === prev) return prev;
        const next = { ...res, majLe: new Date().toISOString() };
        if (scope) AsyncStorage.setItem(keyEspace(scope), JSON.stringify(next));
        if (API_URL && token) {
          if (pushTimer.current) clearTimeout(pushTimer.current);
          setSyncState('en_cours');
          pushTimer.current = setTimeout(() => {
            synchroEspace(false);
          }, 1200);
        }
        return next;
      });
    },
    [scope, token, synchroEspace, lectureSeule],
  );

  const synchroniser = useCallback(
    async (forcer = false, discret = false) => {
      // Les comptes connectés (Gmail, agendas…) alimentent mon espace, pas celui d'une équipe.
      if (!API_URL || !token || portee.type !== 'moi') return;
      const r = await call<Synchro>('/sync', { method: forcer ? 'POST' : 'GET', discret });
      setExternes(r.integrations);
      setMails(r.mails ?? []);
      update((e) => {
        const n = fusionner(e, r, config);
        return differe(e, n) ? n : e;
      });
    },
    [token, call, update, config, portee],
  );

  const chargerNotifs = useCallback(async () => {
    if (!API_URL || !token) return;
    const n = await call<Notifs>('/notifications', { discret: true });
    const deja = vues.current;
    const neuves = deja ? n.notifications.filter((x) => !x.lu && !deja.has(x.id)) : [];
    vues.current = new Set(n.notifications.map((x) => x.id));
    setNotifs(n);
    if (neuves.length) setNouvelle(neuves[0]);
  }, [token, call]);
  const fermerNouvelle = useCallback(() => setNouvelle(null), []);

  const marquerLues = useCallback(async () => {
    if (!API_URL || !token) return;
    setNotifs((n) => ({ ...n, nonLues: 0, notifications: n.notifications.map((x) => ({ ...x, lu: true })) }));
    await call('/notifications/lues', { method: 'POST', body: {}, discret: true });
  }, [token, call]);

  // Éléments importés et rappels : à l'ouverture, au retour dans l'app et toutes les 10 minutes.
  useEffect(() => {
    if (!API_URL || !ready || !token) return;
    const tirer = () => {
      synchroniser(false, true).catch(() => {});
      chargerNotifs().catch(() => {});
      // L'offre change sans l'app (fin d'essai, paiement validé sur le téléphone) : on relit le compte.
      api<{ user: ApiUser }>('/auth/me', { token, discret: true })
        .then(({ user }) => setSession((s) => (s ? { ...s, user } : s)))
        .catch(() => {});
    };
    const fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (fuseau) api('/auth/me', { method: 'PATCH', body: { fuseau }, token, discret: true }).catch(() => {});
    tirer();
    const t = setInterval(tirer, 10 * 60 * 1000);
    // Les rappels arrivent sans attendre la synchro : on les relit chaque minute tant que l'app est ouverte.
    const t2 = setInterval(() => {
      if (AppState.currentState === 'active') chargerNotifs().catch(() => {});
    }, 60 * 1000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && tirer());
    return () => {
      clearInterval(t);
      clearInterval(t2);
      sub.remove();
    };
    // La synchro suit la session, pas chaque modification de l'espace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  const changerRole = useCallback(
    async (id: string, role: Profil['role']) => {
      const { membre } = await call<{ membre: ApiUser }>(`/membres/${id}`, { method: 'PATCH', body: { role: role === 'admin' ? 'ADMIN' : 'UTILISATEUR' } });
      setMembres((ms) => ms.map((m) => (m.id === id ? toProfil(membre) : m)));
    },
    [call],
  );

  // --- Équipes -------------------------------------------------------------

  const rechargerEquipes = useCallback(async () => {
    if (!API_URL || !token) return;
    try {
      const { equipes: l } = await call<{ equipes: Equipe[] }>('/equipes', { discret: true });
      setEquipes(l);
      setEquipesIndisponibles(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setEquipesIndisponibles(true);
      throw e;
    } finally {
      setEquipesChargees(true);
    }
  }, [token, call]);

  // La liste arrive avec la session ; un serveur plus ancien (404) laisse simplement la liste vide.
  useEffect(() => {
    if (!API_URL || !token) return;
    let annule = false;
    void (async () => {
      try {
        await rechargerEquipes();
      } catch {
        // Serveur injoignable ou trop ancien : la liste reste vide, le reste de l'app continue.
        if (!annule) setEquipesChargees(true);
      }
    })();
    return () => {
      annule = true;
    };
  }, [token, rechargerEquipes]);

  // Portée retenue d'une fois sur l'autre, rechargée avec la session.
  useEffect(() => {
    if (!userId) return;
    let annule = false;
    AsyncStorage.getItem(keyPortee(userId)).then((raw) => {
      if (annule || !raw) return;
      try {
        const p = JSON.parse(raw) as Portee;
        if (p?.type === 'equipe' && p.id) setPortee(p);
      } catch {
        /* portée illisible : on reste sur mon espace */
      }
    });
    return () => {
      annule = true;
    };
  }, [userId]);

  const choisirPortee = useCallback(
    (p: Portee) => {
      setPortee((prev) => (memePortee(prev, p) ? prev : p));
      if (userId) AsyncStorage.setItem(keyPortee(userId), JSON.stringify(p));
    },
    [userId],
  );

  const creerEquipe = useCallback(
    async (nom: string, emoji?: string) => {
      const { id } = await call<{ id: string }>('/equipes', { method: 'POST', body: { nom, emoji } });
      await rechargerEquipes();
      return id;
    },
    [call, rechargerEquipes],
  );

  const renommerEquipe = useCallback(
    async (id: string, patch: { nom?: string; emoji?: string }) => {
      await call(`/equipes/${id}`, { method: 'PATCH', body: patch });
      await rechargerEquipes();
    },
    [call, rechargerEquipes],
  );

  const supprimerEquipe = useCallback(
    async (id: string) => {
      await call(`/equipes/${id}`, { method: 'DELETE' });
      await Promise.all([AsyncStorage.removeItem(keyEspace(`equipe:${id}`)), AsyncStorage.removeItem(keyEtat(`equipe:${id}`))]);
      await rechargerEquipes();
    },
    [call, rechargerEquipes],
  );

  const inviterEquipe = useCallback(
    async (id: string, email: string, role: RoleEquipe) => {
      const r = await call<ResultatInvitation>(`/equipes/${id}/invitations`, { method: 'POST', body: { email, role } });
      await rechargerEquipes();
      return r;
    },
    [call, rechargerEquipes],
  );

  const annulerInvitation = useCallback(
    async (id: string, invitationId: string) => {
      await call(`/equipes/${id}/invitations/${invitationId}`, { method: 'DELETE' });
      await rechargerEquipes();
    },
    [call, rechargerEquipes],
  );

  const changerRoleEquipe = useCallback(
    async (id: string, membreId: string, role: RoleEquipe) => {
      await call(`/equipes/${id}/membres/${membreId}`, { method: 'PATCH', body: { role } });
      await rechargerEquipes();
    },
    [call, rechargerEquipes],
  );

  const retirerDeLEquipe = useCallback(
    async (id: string, membreId: string) => {
      await call(`/equipes/${id}/membres/${membreId}`, { method: 'DELETE' });
      await rechargerEquipes();
    },
    [call, rechargerEquipes],
  );

  const apercuInvitation = useCallback((jeton: string) => call<ApercuInvitation>('/equipes/invitation/apercu', { method: 'POST', body: { jeton } }), [call]);

  const rejoindreEquipe = useCallback(
    async (jeton: string) => {
      const { id } = await call<{ id: string }>('/equipes/invitation/rejoindre', { method: 'POST', body: { jeton } });
      await rechargerEquipes();
      choisirPortee({ type: 'equipe', id });
      return id;
    },
    [call, rechargerEquipes, choisirPortee],
  );

  const saveConfig = useCallback(
    async (c: Config) => {
      if (!isAdmin) throw new Error('Seul un admin peut modifier la configuration.');
      if (API_URL) await call('/config', { method: 'PUT', body: { data: c } });
      setConfig(c);
      await AsyncStorage.setItem(KEY_CONFIG, JSON.stringify(c));
    },
    [isAdmin, call],
  );

  const signIn = useCallback(
    async (email: string, password: string) => ouvrir(await api<Session>('/auth/login', { method: 'POST', body: { email, password } })),
    [ouvrir],
  );
  const signUp = useCallback(
    async (email: string, password: string, nom: string) => {
      const r = await api<Session | { verification: true; email: string }>('/auth/register', { method: 'POST', body: { email, password, nom } });
      if ('verification' in r) return r.email;
      await ouvrir(r);
      return null;
    },
    [ouvrir],
  );
  // Le serveur ferme les autres sessions et renvoie un nouveau jeton pour celle-ci.
  const changerMotDePasse = useCallback(
    async (actuel: string, nouveau: string) => {
      const r = await call<Partial<Session>>('/auth/me', { method: 'PATCH', body: { motDePasseActuel: actuel || undefined, nouveauMotDePasse: nouveau } });
      if (r.token && r.user) await ouvrir({ token: r.token, user: r.user });
    },
    [call, ouvrir],
  );
  const deconnecterTout = useCallback(async () => {
    await ouvrir(await call<Session>('/auth/me/deconnecter-tout', { method: 'POST' }));
  }, [call, ouvrir]);
  const rafraichirCompte = useCallback(async () => {
    if (!token) return;
    const { user } = await call<{ user: ApiUser }>('/auth/me', { discret: true });
    await AsyncStorage.setItem(KEY_USER, JSON.stringify(user));
    setSession((s) => (s ? { ...s, user } : s));
  }, [call, token]);
  const abonnement = session?.user.abonnement ?? null;
  const pro = estPro(abonnement);
  const supprimerCompte = useCallback(
    async (confirmation: string) => {
      await call('/auth/me', { method: 'DELETE', body: { confirmation } });
      await signOut();
    },
    [call, signOut],
  );

  const value = useMemo<Store>(
    () => ({
      ready,
      mode: API_URL ? 'cloud' : 'local',
      session,
      profil,
      isAdmin,
      abonnement,
      pro,
      rafraichirCompte,
      espace,
      config,
      update,
      portee,
      choisirPortee,
      equipeActive,
      lectureSeule,
      refusEcriture,
      equipes,
      equipesChargees,
      equipesIndisponibles,
      rechargerEquipes,
      creerEquipe,
      renommerEquipe,
      supprimerEquipe,
      inviterEquipe,
      annulerInvitation,
      changerRoleEquipe,
      retirerDeLEquipe,
      apercuInvitation,
      rejoindreEquipe,
      chargementEspace,
      saveConfig,
      membres,
      membresCharges,
      changerRole,
      syncState,
      reessayer,
      externes,
      mails,
      synchroniser,
      notifs,
      chargerNotifs,
      nouvelle,
      fermerNouvelle,
      marquerLues,
      signIn,
      signUp,
      signOut,
      ouvrirSession: ouvrir,
      changerMotDePasse,
      supprimerCompte,
      deconnecterTout,
    }),
    // prettier-ignore
    [ready, session, profil, isAdmin, abonnement, pro, rafraichirCompte, espace, config, update, portee, choisirPortee, equipeActive, lectureSeule, refusEcriture, equipes, equipesChargees, equipesIndisponibles, rechargerEquipes, creerEquipe, renommerEquipe, supprimerEquipe, inviterEquipe, annulerInvitation, changerRoleEquipe, retirerDeLEquipe, apercuInvitation, rejoindreEquipe, chargementEspace, saveConfig, membres, changerRole, syncState, reessayer, membresCharges, externes, mails, synchroniser, notifs, chargerNotifs, nouvelle, fermerNouvelle, marquerLues, signIn, signUp, signOut, ouvrir, changerMotDePasse, supprimerCompte, deconnecterTout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore doit être utilisé dans StoreProvider');
  return s;
}
