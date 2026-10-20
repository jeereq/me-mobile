import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_CONFIG, nouvelEspace } from './defaults';
import { planifierRappels } from './reminders';
import { supabase } from './supabase';
import type { Config, Espace } from './types';

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
  syncState: 'ok' | 'en_cours' | 'erreur' | 'local';
  signOut: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
const keyEspace = (id: string) => `me:espace:${id}`;
const KEY_CONFIG = 'me:config';

const mergeConfig = (c?: Partial<Config> | null): Config => ({
  ...DEFAULT_CONFIG,
  ...(c || {}),
  modes: { ...DEFAULT_CONFIG.modes, ...(c?.modes || {}) },
  canaux: { ...DEFAULT_CONFIG.canaux, ...(c?.canaux || {}) },
  defauts: { ...DEFAULT_CONFIG.defauts, ...(c?.defauts || {}) },
  sourcesAutorisees: { ...DEFAULT_CONFIG.sourcesAutorisees, ...(c?.sourcesAutorisees || {}) },
  assistant: { ...DEFAULT_CONFIG.assistant, ...(c?.assistant || {}) },
});

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [espace, setEspace] = useState<Espace>(() => nouvelEspace(DEFAULT_CONFIG));
  const [membres, setMembres] = useState<Profil[]>([]);
  const [syncState, setSyncState] = useState<Store['syncState']>(supabase ? 'ok' : 'local');
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = supabase ? session?.user.id ?? null : 'local';

  // Session Supabase
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') supabase?.auth.startAutoRefresh();
      else supabase?.auth.stopAutoRefresh();
    });
    return () => {
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  // Chargement : cache local d'abord, puis le cloud s'il est configuré
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [rawE, rawC] = await Promise.all([AsyncStorage.getItem(keyEspace(userId)), AsyncStorage.getItem(KEY_CONFIG)]);
      let cfg = mergeConfig(rawC ? JSON.parse(rawC) : null);
      let esp: Espace | null = rawE ? JSON.parse(rawE) : null;
      if (supabase && session) {
        try {
          const [{ data: c }, { data: e }, { data: p }] = await Promise.all([
            supabase.from('config').select('data').eq('id', 1).maybeSingle(),
            supabase.from('espaces').select('data').eq('user_id', userId).maybeSingle(),
            supabase.from('profiles').select('id, nom, role').eq('id', userId).maybeSingle(),
          ]);
          if (c?.data) cfg = mergeConfig(c.data as Partial<Config>);
          const remote = e?.data as Espace | undefined;
          if (remote && (!esp || remote.majLe >= esp.majLe)) esp = remote;
          if (p) setProfil({ ...(p as Profil), email: session.user.email });
          if (!remote && esp) await supabase.from('espaces').upsert({ user_id: userId, data: esp });
        } catch {
          setSyncState('erreur');
        }
      } else {
        setProfil({ id: 'local', nom: '', role: 'admin' });
      }
      if (!esp) {
        esp = nouvelEspace(cfg);
        if (supabase) await supabase.from('espaces').upsert({ user_id: userId, data: esp });
      }
      if (cancelled) return;
      setConfig(cfg);
      setEspace(esp);
      AsyncStorage.setItem(KEY_CONFIG, JSON.stringify(cfg));
      setLoadedFor(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, session]);

  // Prêt quand l'espace de l'utilisateur courant est chargé (ou qu'il faut se connecter).
  const ready = (!!supabase && !session) || (!!userId && loadedFor === userId);
  const isAdmin = profil?.role === 'admin';

  // Liste des comptes pour l'admin
  useEffect(() => {
    if (!supabase || !isAdmin) return;
    supabase
      .from('profiles')
      .select('id, nom, role')
      .order('cree_le')
      .then(({ data }) => data && setMembres(data as Profil[]));
  }, [isAdmin, ready]);

  // Rappels : replanifiés à chaque changement utile
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => planifierRappels(espace, config), 800);
    return () => clearTimeout(t);
  }, [ready, espace, config]);

  const update = useCallback(
    (fn: (e: Espace) => Espace) => {
      setEspace((prev) => {
        const next = { ...fn(prev), majLe: new Date().toISOString() };
        if (userId) AsyncStorage.setItem(keyEspace(userId), JSON.stringify(next));
        if (supabase && userId) {
          if (pushTimer.current) clearTimeout(pushTimer.current);
          setSyncState('en_cours');
          pushTimer.current = setTimeout(async () => {
            const { error } = await supabase!.from('espaces').upsert({ user_id: userId, data: next, maj_le: next.majLe });
            setSyncState(error ? 'erreur' : 'ok');
          }, 1200);
        }
        return next;
      });
    },
    [userId],
  );

  const saveConfig = useCallback(
    async (c: Config) => {
      if (!isAdmin) throw new Error('Seul un admin peut modifier la configuration.');
      if (supabase) {
        const { error } = await supabase.from('config').upsert({ id: 1, data: c });
        if (error) throw new Error(error.message);
      }
      setConfig(c);
      await AsyncStorage.setItem(KEY_CONFIG, JSON.stringify(c));
    },
    [isAdmin],
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setProfil(null);
  }, []);

  const value = useMemo<Store>(
    () => ({
      ready,
      mode: supabase ? 'cloud' : 'local',
      session,
      profil,
      isAdmin,
      espace,
      config,
      update,
      saveConfig,
      membres,
      syncState,
      signOut,
    }),
    [ready, session, profil, isAdmin, espace, config, update, saveConfig, membres, syncState, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore doit être utilisé dans StoreProvider');
  return s;
}
