import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { parler, taire } from '@/lib/assistant';
import { refExterne } from '@/lib/externe';
import type { ContenuMail, Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

import { Bloc, ZoneSquelette } from './squelettes';
import { Btn, Dialogue, T } from './ui';

/** Ce que la voix lit d'un mail : qui, quoi, puis le texte (les longs mails sont coupés, la suite reste à l'écran). */
const aLire = (m: ContenuMail) => `Mail de ${m.de || 'quelqu’un'}. Objet : ${m.sujet}. ${m.texte.length > 1500 ? `${m.texte.slice(0, 1500)}… La suite est à l'écran.` : m.texte || 'Ce mail ne contient pas de texte.'}`;

/**
 * Un mail lu en entier dans Me : le serveur va chercher le texte à la demande (rien n'est gardé) et le marque comme lu.
 * `aVoix` le lit tout de suite à voix haute (commande « Lis le mail de Paul »).
 */
export function LireMail({ mail, aVoix, onRepondre, onFermer }: { mail: Mail; aVoix?: boolean; onRepondre: () => void; onFermer: () => void }) {
  const { session, espace, synchroniser } = useStore();
  const [contenu, setContenu] = useState<ContenuMail | null>(null);
  const [msg, setMsg] = useState('');
  const [parle, setParle] = useState(false);
  const ref = refExterne(mail.id);
  const token = session?.token;

  useEffect(() => {
    if (!ref || !token) return;
    let vivant = true;
    api<{ mail: ContenuMail }>(`/integrations/${ref.compte}/mails/${encodeURIComponent(ref.element)}`, { token })
      .then((r) => {
        if (!vivant) return;
        setContenu(r.mail);
        if (aVoix) lire(r.mail);
        // Le serveur a noté le mail comme lu : la pastille « non lu » disparaît à la relecture.
        if (mail.nonLu) synchroniser(false, true).catch(() => {});
      })
      .catch((e: Error) => vivant && setMsg(e.message));
    return () => {
      vivant = false;
      taire();
    };
    // Une seule lecture par mail ouvert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mail.id, token]);

  function lire(m: ContenuMail) {
    setParle(true);
    parler(aLire(m), espace.audio, { onDone: () => setParle(false) });
  }

  const service = mail.source === 'gmail' ? 'Gmail' : 'Outlook';
  const quand = contenu?.date ? `${new Date(`${contenu.date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}${contenu.heure ? ` à ${contenu.heure}` : ''}` : '';

  return (
    <Dialogue titre={contenu?.sujet || mail.sujet} onFermer={onFermer} large>
      <View style={{ gap: 2 }}>
        <T style={{ fontWeight: '700' }}>{contenu?.de || mail.contact}</T>
        {contenu?.adresse && contenu.adresse !== contenu.de ? <T small muted>{contenu.adresse}</T> : null}
        {contenu?.a.length ? <T small muted>À {contenu.a.join(', ')}</T> : null}
        {contenu?.cc.length ? <T small muted>Cc {contenu.cc.join(', ')}</T> : null}
        {quand ? <T small muted>{quand}</T> : null}
      </View>

      {!ref ? <T small style={{ color: C.agressif }}>Ce message ne vient pas d'un compte connecté : impossible de le lire depuis Me.</T> : null}
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
      {!contenu && !msg && ref ? (
        <ZoneSquelette label="Chargement du mail">
          <Bloc h={14} r={6} />
          <Bloc h={14} r={6} />
          <Bloc h={14} r={6} l="70%" />
        </ZoneSquelette>
      ) : null}
      {contenu ? (
        <Text selectable style={{ color: C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 22 }}>
          {contenu.texte || 'Ce mail ne contient pas de texte (peut-être seulement des images) : ouvre-le dans ' + service + '.'}
        </Text>
      ) : null}
      {contenu?.piecesJointes.length ? (
        <T small muted>
          📎 {contenu.piecesJointes.join(', ')} · à ouvrir dans {service}
        </T>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Répondre" disabled={!ref} onPress={onRepondre} />
        {contenu ? <Btn kind="sec" label={parle ? 'Arrêter la lecture' : 'Lire à voix haute'} onPress={() => (parle ? (taire(), setParle(false)) : lire(contenu))} /> : null}
        {mail.lien ? <Btn kind="sec" label={`Ouvrir dans ${service}`} onPress={() => Linking.openURL(mail.lien!).catch(() => {})} /> : null}
      </View>
    </Dialogue>
  );
}
