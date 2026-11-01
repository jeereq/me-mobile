import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Btn, Empty, Header, Panel, Screen, T } from '@/components/ui';
import { useActions } from '@/lib/actions';
import { demanderIA, iaDisponible } from '@/lib/assistant';
import { mailDuLien } from '@/lib/liens-mail';
import { rangRelance } from '@/lib/suivi';
import { useStore } from '@/lib/store';

export default function Brouillon() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { espace, config, mails } = useStore();
  const { statutRelance } = useActions();
  const r = espace.relances.find((x) => x.id === id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [copie, setCopie] = useState(false);

  const rediger = async () => {
    if (!r) return;
    setBusy(true);
    setText('Je rédige…');
    try {
      setText(await demanderIA('relance', { contact: r.contact, sujet: r.sujet, boite: r.boite, ...(r.note ? { note: r.note } : {}), ...(r.nbRelances ? { deja: r.nbRelances } : {}) }));
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
  const ia = config.assistant.ia && iaDisponible();
  // Le mail de la relance, s'il est dans la boîte : on répond dans le fil, le message déjà écrit.
  const mail = r.mail ? mailDuLien(r.mail, mails) : null;
  const fait = () => {
    statutRelance(r, 'relance');
    if (router.canGoBack()) router.back();
  };

  return (
    <Screen>
      <Header retour title={`Relancer ${r.contact}`} eyebrow={r.sujet} />
      <Panel title={ia ? 'Message proposé par Me' : 'Ta relance'} accent>
        {ia ? <T>{text}</T> : <T muted>La rédaction par Me demande la connexion au serveur et l'option IA activée. Tu peux relancer à ta façon, puis le noter ici.</T>}
        {ia ? (
          <Btn
            label={copie ? 'Copié' : 'Copier le message'}
            disabled={busy || !text}
            onPress={async () => {
              await Clipboard.setStringAsync(text);
              setCopie(true);
            }}
          />
        ) : null}
        {mail ? <Btn kind={ia ? 'sec' : 'primary'} label={`Répondre dans le fil « ${mail.sujet} »`} onPress={() => router.push({ pathname: '/messages', params: { repondre: mail.id, ...(ia && text && !busy ? { texte: text } : {}) } } as never)} /> : null}
        {ia ? <Btn kind="sec" label="Rédiger une autre version" onPress={rediger} disabled={busy} /> : null}
        {r.nbRelances ? <T small muted>{`Déjà relancé ${r.nbRelances} fois : ce message sera la ${rangRelance(r.nbRelances + 1)}.`}</T> : null}
        <Btn kind="sec" label="C'est fait, noter la relance" onPress={fait} />
      </Panel>
    </Screen>
  );
}
