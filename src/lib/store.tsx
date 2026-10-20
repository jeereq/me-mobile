import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { api, ApiError, API_URL, tokenStore, type ApiUser, type Session } from './api';
import { DEFAULT_CONFIG, nouvelEspace } from './defaults';
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
  /** Comptes externes connectés (Google, Microsoft, Trello, Slack). */
  externes: CompteConnecte[];
  /** Récupère les éléments importés ; `forcer` demande au serveur de relire les comptes tout de suite. */
  synchroniser: (forcer?: boolean) => Promise<void>;
  /** Rappels envoyés par le serveur (centre de notifications). */
  notifs: Notifs;
  chargerNotifs: () => Promise<void>;
  /** Rappel arrivé pendant que l'app est ouverte, affiché en bandeau puis effacé. */
  nouvelle: NotificationMe | null;
  fermerNouvelle: () => void;
  marquerLues: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nom: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
const keyEspace = (id: string) => `me:espace:${id}`;
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
  }, []);

  /** Un 401 veut dire session expirée ou compte supprimé : retour à l'écran de connexion. */
  const call = useCallback(
    async <T,>(path: string, opts: { method?: string; body?: unknown } = {}) => {
      try {
        return await api<T>(path, { ...opts, token });
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) signOut();
        throw e;
      }
    },
    [token, signOut],
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
      const [rawE, rawC] = await Promise.all([AsyncStorage.getItem(keyEspace(userId)), AsyncStorage.getItem(KEY_CONFIG)]);
      let cfg = mergeConfig(rawC ? JSON.parse(rawC) : null);
      let esp: Espace | null = rawE ? JSON.parse(rawE) : null;
      let enLigne = !API_URL;
      if (API_URL && token) {
        try {
          const [c, e] = await Promise.all([
            api<{ config: Partial<Config> }>('/config', { token }),
            api<{ espace: { data: Espace; majLe: string } | null }>('/espace', { token }),
          ]);
          cfg = mergeConfig(c.config);
          const remote = e.espace?.data;
          if (remote && (!esp || remote.majLe >= esp.majLe)) esp = remote;
          if (!remote && esp) await api('/espace', { method: 'PUT', body: { data: esp }, token });
          enLigne = true;
        } catch {
          setSyncState('erreur');
        }
      }
      if (!esp) {
        esp = nouvelEspace(cfg);
        if (API_URL && token && enLigne) await api('/espace', { method: 'PUT', body: { data: esp }, token }).catch(() => setSyncState('erreur'));
      }
      if (cancelled) return;
      setConfig(cfg);
      setEspace(esp);
      AsyncStorage.setItem(KEY_CONFIG, JSON.stringify(cfg));
      AsyncStorage.setItem(keyEspace(userId), JSON.stringify(esp));
      setLoadedFor(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, token]);

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
            call('/espace', { method: 'PUT', body: { data: next } })
              .then(() => setSyncState('ok'))
              .catch(() => setSyncState('erreur'));
          }, 1200);
        }
        return next;
      });
    },
    [userId, token, call],
  );

  const synchroniser = useCallback(
    async (forcer = false) => {
      if (!API_URL || !token) return;
      const r = await call<Synchro>('/sync', { method: forcer ? 'POST' : 'GET' });
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
    const n = await call<Notifs>('/notifications');
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
    await call('/notifications/lues', { method: 'POST', body: {} });
  }, [token, call]);

  // Éléments importés et rappels : à l'ouverture, au retour dans l'app et toutes les 10 minutes.
  useEffect(() => {
    if (!API_URL || !ready || !token) return;
    const tirer = () => {
      synchroniser().catch(() => {});
      chargerNotifs().catch(() => {});
    };
    const fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (fuseau) api('/auth/me', { method: 'PATCH', body: { fuseau }, token }).catch(() => {});
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
    async (email: string, password: string, nom: string) => ouvrir(await api<Session>('/auth/register', { method: 'POST', body: { email, password, nom } })),
    [ouvrir],
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
    }),
    [ready, session, profil, isAdmin, espace, config, update, saveConfig, membres, changerRole, syncState, externes, synchroniser, notifs, chargerNotifs, nouvelle, fermerNouvelle, marquerLues, signIn, signUp, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore doit être utilisé dans StoreProvider');
  return s;
}
