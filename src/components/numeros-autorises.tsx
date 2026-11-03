import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { api } from '@/lib/api';
import { chiffresNationaux, drapeau, PAYS, PAYS_DEFAUT } from '@/lib/indicatifs';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

import { ChampTelephone, indicatifsPerimes, useTelephone } from './telephone';
import { Btn, Panel, T } from './ui';

type Ligne = { id: string; indicatif: string; numero: string; parNom: string };

/** Réservé à l'admin : la RD Congo est toujours ouverte, le reste s'ouvre pays par pays ou numéro par numéro. */
export function NumerosAutorises() {
  const { session } = useStore();
  const token = session?.token;
  const tel = useTelephone({ tous: true });
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!token) return;
    api<Ligne[]>('/sms/numeros', { token, discret: true })
      .then(setLignes)
      .catch(() => setLignes([]));
  }, [token]);

  const agir = async (fn: () => Promise<Ligne[]>) => {
    setBusy(true);
    setErreur('');
    try {
      setLignes(await fn());
      tel.vider();
      indicatifsPerimes();
    } catch (e) {
      setErreur((e as Error).message);
    }
    setBusy(false);
  };

  const rdc = tel.pays.code === PAYS_DEFAUT.code;
  const ajouter = () => agir(() => api<Ligne[]>('/sms/numeros', { method: 'POST', token, body: { indicatif: tel.pays.code, numero: chiffresNationaux(tel.pays, tel.national) } }));

  return (
    <Panel title="Numéros autorisés" count={lignes?.length || undefined}>
      <T small muted>
        RD Congo : toujours ouverte.
      </T>
      <ChampTelephone tel={tel} label="Autres pays" placeholder="Vide = tout le pays" />
      <View style={{ flexDirection: 'row' }}>
        <Btn kind="sec" label={rdc ? 'Choisis un pays' : tel.vide ? `Ouvrir ${tel.pays.nom}` : 'Autoriser ce numéro'} onPress={ajouter} disabled={busy || rdc || (!tel.vide && !tel.valide)} />
      </View>
      {erreur ? (
        <T small style={{ color: C.agressif }}>
          {erreur}
        </T>
      ) : null}
      {(lignes ?? []).map((l) => {
        const pays = PAYS.find((p) => p.code === l.indicatif);
        return (
          <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <T>{`${pays ? `${drapeau(pays.iso)} ` : ''}+${l.indicatif}${l.numero ? ` ${l.numero}` : ` · ${pays?.nom ?? ''} entier`}`}</T>
              <T small muted>
                {l.parNom}
              </T>
            </View>
            <Btn small kind="danger" label="Retirer" onPress={() => agir(() => api<Ligne[]>(`/sms/numeros/${l.id}`, { method: 'DELETE', token }))} disabled={busy} />
          </View>
        );
      })}
    </Panel>
  );
}
