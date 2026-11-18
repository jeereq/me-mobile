import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ContexteNouveauMail, OutilsNouveauMail } from '@/components/outils-nouveau-mail';
import { Btn, Empty, Header, Input, Panel, Screen, T } from '@/components/ui';
import { useActions } from '@/lib/actions';
import { demanderIA, iaDisponible } from '@/lib/assistant';
import { mailDuLien } from '@/lib/liens-mail';
import { useStore } from '@/lib/store';
import { rangRelance } from '@/lib/suivi';

/**
 * Préparer une relance : le copilote propose un message, l'utilisateur le retouche comme n'importe quel mail
 * (son contexte, d'autres mails à mélanger, plus court, plus formel, écouter, dicter, fautes, traduire),
 * puis part l'envoyer — dans le fil d'origine s'il y en a un, sinon dans un nouveau mail, là où vivent les pièces jointes.
 */
export default function Brouillon() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { espace, config, mails } = useStore();
  const { statutRelance } = useActions();
  const r = espace.relances.find((x) => x.id === id);
  const [texte, setTexte] = useState('');
  const [sujet, setSujet] = useState(r?.sujet ?? '');
  const [busy, setBusy] = useState(false);
  const [copie, setCopie] = useState(false);

  const rediger = async () => {
    if (!r) return;
    setBusy(true);
    try {
      setTexte(await demanderIA('relance', { contact: r.contact, sujet: r.sujet, boite: r.boite, ...(r.note ? { note: r.note } : {}), ...(r.nbRelances ? { deja: r.nbRelances } : {}) }));
    } catch (e) {
      setTexte((e as Error).message);
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
  const adresse = mail?.adresse ?? '';
  const fait = () => {
    statutRelance(r, 'relance');
    if (router.canGoBack()) router.back();
  };
  const ecrire = () =>
    router.push({ pathname: '/messages', params: { ecrire: '1', ...(adresse ? { a: adresse } : {}), nom: r.contact, sujet: sujet.trim() || r.sujet, ...(texte.trim() ? { texte } : {}) } } as never);
  const outils = { a: adresse || r.contact, sujet: sujet.trim() || r.sujet, boite: r.boite, texte, onTexte: setTexte, onObjet: setSujet };

  return (
    <Screen>
      <Header retour title={`Relancer ${r.contact}`} eyebrow={r.sujet} />
      <Panel title="Ton message" accent>
        <Input label="Objet" value={sujet} onChangeText={setSujet} placeholder={r.sujet} />
        <Input
          label={ia ? 'Message proposé par Me' : 'Ta relance'}
          value={busy ? 'Je rédige…' : texte}
          onChangeText={setTexte}
          editable={!busy}
          placeholder={ia ? '' : 'Écris ta relance, ou dicte-la avec les outils ci-dessous.'}
          multiline
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />
        {r.note ? <T small muted>{`Ta note : ${r.note}`}</T> : null}
        {r.nbRelances ? <T small muted>{`Déjà relancé ${r.nbRelances} fois : ce message sera la ${rangRelance(r.nbRelances + 1)}.`}</T> : null}
        {ia ? <ContexteNouveauMail {...outils} /> : <T small muted>Rédaction par le copilote indisponible : serveur ou IA non activés.</T>}
        <OutilsNouveauMail {...outils} />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {mail ? (
            <Btn label={`Répondre dans le fil « ${mail.sujet} »`} onPress={() => router.push({ pathname: '/messages', params: { repondre: mail.id, ...(texte.trim() ? { texte } : {}) } } as never)} />
          ) : null}
          {/* Le mail s'écrit dans la boîte : c'est là que vivent les pièces jointes, le Cc et la signature. */}
          <Btn kind={mail ? 'sec' : 'primary'} label={mail ? 'Écrire un nouveau mail' : 'Écrire le mail'} onPress={ecrire} />
          <Btn
            kind="sec"
            label={copie ? 'Copié' : 'Copier'}
            disabled={busy || !texte.trim()}
            onPress={async () => {
              await Clipboard.setStringAsync(texte);
              setCopie(true);
            }}
          />
          <Btn kind="sec" label="C'est fait, noter la relance" onPress={fait} />
        </View>
      </Panel>
    </Screen>
  );
}
