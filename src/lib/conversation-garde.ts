import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

import { lireEchanges, type Echange } from './conversation';

/** Le fil des échanges reste sur cet appareil ; il est effacé à la déconnexion, car il parle de tes mails et de tes tâches. */
const CLE = 'me.conversation';

export function oublierConversation() {
  AsyncStorage.removeItem(CLE).catch(() => {});
}

/** Le fil de ce compte et de cet espace, relu puis gardé à chaque changement. */
export function useEchanges(pour: string) {
  const [echanges, poser] = useState<Echange[]>([]);
  const lu = useRef('');
  useEffect(() => {
    let vivant = true;
    lu.current = '';
    AsyncStorage.getItem(CLE)
      .then((brut) => (brut ? JSON.parse(brut) : null))
      .catch(() => null)
      .then((brut) => {
        if (!vivant) return;
        lu.current = pour;
        poser(lireEchanges(brut, pour));
      });
    return () => {
      vivant = false;
    };
  }, [pour]);
  const changer = (f: (e: Echange[]) => Echange[]) =>
    poser((avant) => {
      const n = f(avant);
      if (pour && lu.current === pour) AsyncStorage.setItem(CLE, JSON.stringify({ pour, echanges: n })).catch(() => {});
      return n;
    });
  return [echanges, changer] as const;
}
