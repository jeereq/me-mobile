import { useState } from 'react';
import { View } from 'react-native';

import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

import { Btn, Dialogue, Input, Seg, T } from './ui';

export type Brouillon = { a?: string; sujet?: string; texte?: string; /** Le nom dicté quand l'adresse est inconnue : « Sophie ». */ nom?: string };

/**
 * Écrire un nouveau mail depuis un compte connecté (Gmail ou Outlook). Texte simple, sans pièce jointe.
 * Le brouillon peut venir de la voix (« Écris un mail à Paul pour lui dire que… ») : rien ne part sans « Oui, envoyer ».
 */
export function EcrireMail({ brouillon, onFermer }: { brouillon?: Brouillon; onFermer: () => void }) {
  const { session, externes } = useStore();
  const comptes = externes.filter((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft');
  const [compte, setCompte] = useState(comptes[0]?.id ?? '');
  const [a, setA] = useState(brouillon?.a ?? '');
  const [cc, setCc] = useState('');
  const [avecCc, setAvecCc] = useState(false);
  const [sujet, setSujet] = useState(brouillon?.sujet ?? '');
  const [texte, setTexte] = useState(brouillon?.texte ?? '');
  const [confirme, setConfirme] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const choisi = comptes.find((x) => x.id === compte);

  const changer = (f: (v: string) => void) => (v: string) => {
    f(v);
    setConfirme(false);
  };

  const envoyer = async () => {
    if (!session?.token || !compte) return;
    setBusy(true);
    setMsg('');
    try {
      await api(`/integrations/${compte}/envoyer`, { method: 'POST', body: { a, ...(cc.trim() ? { cc } : {}), sujet, texte }, token: session.token });
      setEnvoye(true);
    } catch (e) {
      setMsg((e as Error).message);
      setConfirme(false);
    } finally {
      setBusy(false);
    }
  };

  if (envoye)
    return (
      <Dialogue titre="Mail envoyé" onFermer={onFermer}>
        <T>
          « {sujet.trim() || '(sans objet)'} » est parti vers {a}.
        </T>
        <T small muted>
          Tu le retrouveras dans tes messages envoyés, chez {choisi?.fournisseur === 'microsoft' ? 'Outlook' : 'Gmail'}.
        </T>
        <Btn label="Fermer" onPress={onFermer} />
      </Dialogue>
    );

  return (
    <Dialogue titre="Nouveau mail" onFermer={onFermer}>
      {!comptes.length ? (
        <T small style={{ color: C.agressif }}>Connecte Gmail ou Outlook dans Agendas & outils pour écrire depuis Me.</T>
      ) : comptes.length > 1 ? (
        <Seg label="Envoyer depuis" options={comptes.map((x) => ({ key: x.id, label: x.compte }))} value={compte} onChange={changer(setCompte)} />
      ) : (
        <T small muted>De {comptes[0].compte}</T>
      )}
      <Input
        label="À"
        value={a}
        onChangeText={changer(setA)}
        placeholder="paul@exemple.fr"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        aide={!brouillon?.a && brouillon?.nom ? `Je n'ai pas trouvé l'adresse de ${brouillon.nom} : écris-la ici.` : 'Plusieurs adresses ? Sépare-les par des virgules.'}
      />
      {avecCc ? (
        <Input label="Cc" value={cc} onChangeText={changer(setCc)} placeholder="marie@exemple.fr" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
      ) : (
        <Btn small kind="sec" label="Ajouter un Cc" onPress={() => setAvecCc(true)} />
      )}
      <Input label="Objet" value={sujet} onChangeText={changer(setSujet)} placeholder="(sans objet)" />
      <Input
        label="Message"
        value={texte}
        onChangeText={changer(setTexte)}
        placeholder="Bonjour, …"
        multiline
        numberOfLines={8}
        style={{ minHeight: 160, textAlignVertical: 'top' }}
        aide="Me envoie du texte simple, sans mise en forme ni pièce jointe."
      />
      {confirme ? <T small muted>Envoyer ce mail à {a} maintenant ?</T> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {confirme ? (
          <Btn label={busy ? 'Envoi…' : 'Oui, envoyer'} disabled={busy} onPress={envoyer} />
        ) : (
          <Btn label="Envoyer" disabled={!compte || !a.trim() || !texte.trim()} onPress={() => setConfirme(true)} />
        )}
        <Btn kind="sec" label="Annuler" onPress={onFermer} />
      </View>
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
    </Dialogue>
  );
}
