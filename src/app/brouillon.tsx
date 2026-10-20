import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Btn, Empty, Panel, Screen, T } from '@/components/ui';
import { demanderIA, iaDisponible } from '@/lib/assistant';
import { useStore } from '@/lib/store';

export default function Brouillon() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { espace, update, config } = useStore();
  const r = espace.relances.find((x) => x.id === id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [copie, setCopie] = useState(false);

  const rediger = async () => {
    if (!r) return;
    setBusy(true);
    setText('Je rédige…');
    try {
      setText(await demanderIA('relance', { contact: r.contact, sujet: r.sujet, boite: r.boite }));
    } catch (e) {
      setText((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!r || !config.assistant.ia || !iaDisponible()) return;
    const t = setTimeout(rediger, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!r) return <Screen><Empty>Cette relance n'existe plus.</Empty></Screen>;
  if (!config.assistant.ia || !iaDisponible())
    return (
      <Screen>
        <Empty>La rédaction par l'IA demande la connexion au serveur (Supabase) et l'option IA activée par l'admin.</Empty>
      </Screen>
    );

  return (
    <Screen>
      <Panel title={`Relance pour ${r.contact}`} accent>
        <T>{text}</T>
        <Btn
          label={copie ? 'Copié' : 'Copier le message'}
          disabled={busy || !text}
          onPress={async () => {
            await Clipboard.setStringAsync(text);
            setCopie(true);
          }}
        />
        <Btn kind="sec" label="Rédiger une autre version" onPress={rediger} disabled={busy} />
        <Btn kind="sec" label="Marquer comme relancé" onPress={() => update((e) => ({ ...e, relances: e.relances.map((x) => (x.id === r.id ? { ...x, statut: 'relance' } : x)) }))} />
      </Panel>
    </Screen>
  );
}
