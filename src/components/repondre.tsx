import { useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '@/lib/api';
import { refExterne } from '@/lib/externe';
import type { Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

import { CadreMail, ChampLigne, CorpsMail, nomService, Outil } from './mail-ui';
import { Btn, Dialogue, T } from './ui';

/**
 * Répondre à un fil depuis Me : le destinataire, l'objet et le rattachement au fil viennent du serveur
 * (qui les a gardés en relisant la boîte), on n'écrit ici que le texte. L'envoi demande une confirmation.
 * `texteInitial` : la réponse dictée à la voix (« Réponds à Paul que c'est bon »), à relire avant l'envoi.
 */
export function Repondre({ mail, texteInitial, onFermer }: { mail: Mail; texteInitial?: string; onFermer: () => void }) {
  const { session } = useStore();
  const [texte, setTexte] = useState(texteInitial ?? '');
  const [confirme, setConfirme] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const ref = refExterne(mail.id);

  const envoyer = async () => {
    if (!ref || !session?.token) return;
    setBusy(true);
    setMsg('');
    try {
      await api(`/integrations/${ref.compte}/repondre`, { method: 'POST', body: { mail: ref.element, texte }, token: session.token });
      setEnvoye(true);
    } catch (e) {
      setMsg((e as Error).message);
      setConfirme(false);
    } finally {
      setBusy(false);
    }
  };

  const valeur = (t: string) => (
    <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 15 }}>
      {t}
    </Text>
  );

  if (envoye)
    return (
      <Dialogue titre="Réponse envoyée" onFermer={onFermer}>
        <T>Ta réponse est partie dans le fil « {mail.sujet} ».</T>
        <T small muted>
          Tu la retrouveras dans tes messages envoyés, chez {nomService(mail)}.
        </T>
        <Btn label="Fermer" onPress={onFermer} />
      </Dialogue>
    );

  return (
    <Dialogue titre="Répondre" onFermer={onFermer}>
      <CadreMail>
        {mail.compte ? <ChampLigne label="De">{valeur(mail.compte)}</ChampLigne> : null}
        <ChampLigne label="À">{valeur(mail.adresse && mail.adresse !== mail.contact ? `${mail.contact} · ${mail.adresse.replace(/^.*<([^>]+)>.*$/, '$1')}` : mail.contact)}</ChampLigne>
        <ChampLigne label="Objet" dernier>
          {valeur(`Re: ${mail.sujet.replace(/^(\s*re\s*:\s*)+/i, '')}`)}
        </ChampLigne>
        <CorpsMail
          value={texte}
          onChangeText={(v: string) => {
            setTexte(v);
            setConfirme(false);
          }}
          placeholder="Bonjour, …"
          accessibilityLabel="Ta réponse"
          autoFocus={!texteInitial}
        />
      </CadreMail>
      <T small muted>
        Texte simple, sans mise en forme ni pièce jointe.
      </T>
      {!ref ? <T small style={{ color: C.agressif }}>Ce message ne vient pas d'un compte connecté : impossible d'y répondre depuis Me.</T> : null}
      {confirme ? <T small>Envoyer cette réponse à {mail.contact} maintenant ?</T> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {confirme ? (
          <Outil principal icone="envoyer" label={busy ? 'Envoi…' : 'Oui, envoyer'} disabled={busy} onPress={envoyer} />
        ) : (
          <Outil principal icone="envoyer" label="Envoyer" disabled={!texte.trim() || !ref} onPress={() => setConfirme(true)} />
        )}
        <Outil label="Annuler" onPress={onFermer} />
      </View>
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
    </Dialogue>
  );
}
