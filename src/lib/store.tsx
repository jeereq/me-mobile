import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { api, ApiError, API_URL, tokenStore, type ApiUser, type Session } from './api';
import { DEFAULT_CONFIG, nouvelEspace } from './defaults';
import { fusionEspace, pousserEspace, rapprocher, type Distant, type EtatSync } from './fusion';
import { planifierRappels } from './reminders';
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
  espace: Espace;
  config: Config;
  /** Applique une modification à l'espace de l'utilisateur, sauvegardée et synchronisée. */
  update: (fn: (e: Espace) => Espace) => void;
  /** Réservé à l'admin : enregistre la configuration système. */
  saveConfig: (c: Config) => Promise<void>;
  membres: Profil[];
  /** Réservé à l'admin : nomme ou retire un admin. */
  changerRole: (id: string, role: Profil['role']) => Promise<void>;
  syncState: 'ok' | 'en_cours' | 'erreur' | 'local';
  /** Renvoie l'espace au serveur après une coupure (ou reprend celui du serveur s'il est plus récent). */
  reessayer: () => Promise<void>;
  /** Comptes externes connectés (Google, Microsoft, Trello, Slack). */
  externes: CompteConnecte[];
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
  const [externes, setExternes] = useState<CompteConnecte[]>([]);
  const [notifs, setNotifs] = useState<Notifs>({ notifications: [], nonLues: 0, email: false });
  const [nouvelle, setNouvelle] = useState<NotificationMe | null>(null);
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

  const ouvrir = useCallback(async (s: Session) => {
    await Promise.all([tokenStore.set(s.token), AsyncStorage.setItem(KEY_USER, JSON.stringify(s.user))]);
    setSession(s);
  }, []);

  const signOut = useCallback(async () => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    await Promise.all([tokenStore.clear(), AsyncStorage.removeItem(KEY_USER)]);
    setSession(null);
    setMembres([]);
    setExternes([]);
    setNotifs({ notifications: [], nonLues: 0, email: false });
    setNouvelle(null);
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
      if (userId) AsyncStorage.setItem(keyEtat(userId), JSON.stringify(etat));
    },
    [userId],
  );

  /** Compare l'espace du téléphone à celui du serveur (fusion si un autre appareil a écrit). Renvoie vrai s'il reste des changements à envoyer. */
  const reconcilier = useCallback(async () => {
    const { espace: distant } = await call<{ espace: Distant | null }>('/espace', { discret: true });
    const local = espaceRef.current;
    const r = rapprocher(distant, local, etatRef.current);
    memoriserEtat(r.etat);
    if (r.espace !== local) {
      espaceRef.current = r.espace;
      setEspace(r.espace);
      if (userId) AsyncStorage.setItem(keyEspace(userId), JSON.stringify(r.espace));
    }
    return r.aPousser;
  }, [call, memoriserEtat, userId]);

  /**
   * Synchronise l'espace avec le serveur, un envoi à la fois.
   * `recuperer` : lit d'abord le serveur (reprise après une coupure) ; sinon envoie directement, et fusionne si le serveur répond par un conflit.
   */
  const synchroEspace = useCallback(
    (recuperer: boolean): Promise<void> => {
      if (!API_URL || !token || !userId) return Promise.resolve();
      const faire = async () => {
        setSyncState('en_cours');
        try {
          // Sans historique de synchro (première ouverture hors ligne), on lit le serveur avant d'écrire : jamais d'écriture à l'aveugle.
          if ((recuperer || !etatRef.current) && !(await reconcilier())) {
            setSyncState('ok');
            return;
          }
          const poussee = await pousserEspace((chemin, o) => call(chemin, { ...o, discret: true }), etatRef.current ?? { revision: null, base: null }, () => espaceRef.current);
          memoriserEtat(poussee.etat);
          if (poussee.fusion) {
            // Un autre appareil avait écrit : on affiche aussi ses changements.
            const { base, distant } = poussee.fusion;
            setEspace((prev) => {
              const m = fusionEspace(base, prev, distant);
              espaceRef.current = m;
              AsyncStorage.setItem(keyEspace(userId), JSON.stringify(m));
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
    [call, token, userId, reconcilier, memoriserEtat],
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

  // Chargement : cache local d'abord, puis le serveur s'il est configuré
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [rawE, rawC, rawS] = await Promise.all([AsyncStorage.getItem(keyEspace(userId)), AsyncStorage.getItem(KEY_CONFIG), AsyncStorage.getItem(keyEtat(userId))]);
      let cfg = mergeConfig(rawC ? JSON.parse(rawC) : null);
      let esp: Espace | null = rawE ? JSON.parse(rawE) : null;
      let etat: EtatSync | null = rawS ? JSON.parse(rawS) : null;
      let aPousser = false;
      let enLigne = !API_URL;
      if (API_URL && token) {
        try {
          const [c, e] = await Promise.all([
            api<{ config: Partial<Config> }>('/config', { token }),
            api<{ espace: Distant | null }>('/espace', { token }),
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
      AsyncStorage.setItem(keyEspace(userId), JSON.stringify(esp));
      if (etat) AsyncStorage.setItem(keyEtat(userId), JSON.stringify(etat));
      setLoadedFor(userId);
      if (aPousser) synchroEspace(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, token, synchroEspace]);

  // Prêt quand l'espace de l'utilisateur courant est chargé (ou qu'il faut se connecter).
  const ready = authChecked && ((!!API_URL && !session) || (!!userId && loadedFor === userId));
  const isAdmin = profil?.role === 'admin';

  // Liste des comptes pour l'admin
  useEffect(() => {
    if (!API_URL || !isAdmin || !ready || !token) return;
    api<{ membres: ApiUser[] }>('/membres', { token })
      .then(({ membres: m }) => setMembres(m.map(toProfil)))
      .catch(() => {});
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
      setEspace((prev) => {
        const res = fn(prev);
        if (res === prev) return prev;
        const next = { ...res, majLe: new Date().toISOString() };
        if (userId) AsyncStorage.setItem(keyEspace(userId), JSON.stringify(next));
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
    [userId, token, synchroEspace],
  );

  const synchroniser = useCallback(
    async (forcer = false, discret = false) => {
      if (!API_URL || !token) return;
      const r = await call<Synchro>('/sync', { method: forcer ? 'POST' : 'GET', discret });
      setExternes(r.integrations);
      update((e) => {
        const n = fusionner(e, r, config);
        return differe(e, n) ? n : e;
      });
    },
    [token, call, update, config],
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
      espace,
      config,
      update,
      saveConfig,
      membres,
      changerRole,
      syncState,
      reessayer,
      externes,
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
    [ready, session, profil, isAdmin, espace, config, update, saveConfig, membres, changerRole, syncState, reessayer, externes, synchroniser, notifs, chargerNotifs, nouvelle, fermerNouvelle, marquerLues, signIn, signUp, signOut, ouvrir, changerMotDePasse, supprimerCompte, deconnecterTout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore doit être utilisé dans StoreProvider');
  return s;
}
