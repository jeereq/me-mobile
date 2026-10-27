import { useState } from 'react';
import { View } from 'react-native';

import { api } from '@/lib/api';
import { refExterne } from '@/lib/externe';
import type { Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

import { Btn, Dialogue, Input, T } from './ui';

/**
 * Répondre à un fil depuis Me : le destinataire, l'objet et le rattachement au fil viennent du serveur
 * (qui les a gardés en relisant la boîte), on n'écrit ici que le texte. L'envoi demande une confirmation.
 */
export function Repondre({ mail, onFermer }: { mail: Mail; onFermer: () => void }) {
  const { session } = useStore();
  const [texte, setTexte] = useState('');
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

  return (
    <Dialogue titre={envoye ? 'Réponse envoyée' : 'Répondre'} onFermer={onFermer}>
      {envoye ? (
        <>
          <T>Ta réponse est partie dans le fil « {mail.sujet} ».</T>
          <T small muted>
            Tu la retrouveras dans tes messages envoyés, chez {mail.source === 'gmail' ? 'Gmail' : 'Outlook'}.
          </T>
          <Btn label="Fermer" onPress={onFermer} />
        </>
      ) : (
        <>
          <T small muted>
            À {mail.contact}
            {mail.adresse && mail.adresse !== mail.contact ? ` · ${mail.adresse}` : ''}
          </T>
          <T style={{ fontWeight: '700' }}>Re: {mail.sujet.replace(/^(\s*re\s*:\s*)+/i, '')}</T>
          <Input
            label="Ta réponse"
            value={texte}
            onChangeText={(v: string) => {
              setTexte(v);
              setConfirme(false);
            }}
            placeholder="Bonjour, …"
            multiline
            numberOfLines={6}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
            aide="Me envoie du texte simple, sans mise en forme ni pièce jointe."
          />
          {!ref ? <T small style={{ color: C.agressif }}>Ce message ne vient pas d'un compte connecté : impossible d'y répondre depuis Me.</T> : null}
          {confirme ? <T small muted>Envoyer cette réponse maintenant ?</T> : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {confirme ? (
              <Btn label={busy ? 'Envoi…' : 'Oui, envoyer'} disabled={busy} onPress={envoyer} />
            ) : (
              <Btn label="Envoyer" disabled={!texte.trim() || !ref} onPress={() => setConfirme(true)} />
            )}
            <Btn kind="sec" label="Annuler" onPress={onFermer} />
          </View>
          {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
        </>
      )}
    </Dialogue>
  );
}
