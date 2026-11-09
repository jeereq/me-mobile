import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

import { MentionPro } from './reserve-pro';
import { Rang, ZoneSquelette } from './squelettes';
import { ChampTelephone, useTelephone } from './telephone';
import { Btn, Input, T } from './ui';

type Etat = { disponible: boolean; telephone: string | null; enAttente: string | null };

/** Rappels par SMS, dans Mon compte : le numéro se vérifie par un code avant de recevoir quoi que ce soit. */
export function SmsCompte({ actif, onActif, repli }: { actif: boolean; onActif: (v: boolean) => void; /** Dit pourquoi le SMS n'est pas là, au lieu de ne rien montrer. */ repli?: boolean }) {
  const { session, pro, notifs, config, equipeActive } = useStore();
  const token = session?.token;
  const visible = notifs.sms === true && config.canaux.sms !== false;
  const [etat, setEtat] = useState<Etat | null>(null);
  const tel = useTelephone();
  const [code, setCode] = useState('');
  const [changer, setChanger] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!visible || !pro || equipeActive) return;
    let fini = false;
    api<Etat>('/sms', { token, discret: true })
      .then((r) => !fini && setEtat(r))
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, [visible, pro, token, equipeActive]);

  if (!visible)
    return repli ? (
      <View style={{ gap: 2, paddingVertical: 4 }}>
        <T>Par SMS</T>
        <T small muted>
          Le SMS n’est pas configuré sur le serveur.
        </T>
      </View>
    ) : null;
  // Le serveur lit ce réglage dans l'espace personnel : l'écrire dans celui d'une équipe ne servirait à rien.
  if (equipeActive)
    return (
      <View style={{ gap: 2, paddingVertical: 4 }}>
        <T>Par SMS</T>
        <T small muted>
          Se règle dans ton espace personnel.
        </T>
      </View>
    );
  if (!pro)
    return (
      <View style={{ gap: 2, paddingVertical: 4 }}>
        <T>Par SMS</T>
        <MentionPro />
      </View>
    );
  if (!etat)
    return (
      <ZoneSquelette label="Chargement des SMS" style={{ gap: 6, paddingVertical: 4 }}>
        <Rang pastille="aucune" droite lignes={2} />
      </ZoneSquelette>
    );

  const agir = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErreur('');
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setErreur((e as Error).message);
    }
    setBusy(false);
  };
  const demander = (telephone: string) =>
    agir(async () => {
      setEtat(await api<Etat>('/sms/telephone', { method: 'POST', token, body: { telephone } }));
      setChanger(false);
      setCode('');
    });
  const valider = () =>
    agir(async () => {
      setEtat(await api<Etat>('/sms/telephone/code', { method: 'POST', token, body: { code: code.trim() } }));
      setCode('');
      tel.vider();
      onActif(true);
    });
  const retirer = () =>
    agir(async () => {
      setEtat(await api<Etat>('/sms/telephone', { method: 'DELETE', token }));
      onActif(false);
    });
  const essayer = () =>
    agir(async () => {
      await api('/sms/test', { method: 'POST', token });
      setMsg('SMS envoyé.');
    });

  const verification = !!etat.enAttente && !changer;
  return (
    <View style={{ gap: 8, paddingVertical: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T>Par SMS</T>
          {etat.telephone ? (
            <T small muted>
              {`+${etat.telephone} · sert aussi à te connecter`}
            </T>
          ) : null}
        </View>
        {etat.telephone ? <Switch value={actif} onValueChange={onActif} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} accessibilityLabel="Rappels par SMS" /> : null}
      </View>

      {verification ? (
        <>
          <Input label={`Code envoyé au +${etat.enAttente}`} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn label="Valider" onPress={valider} disabled={busy || code.trim().length < 3} />
            <Btn kind="sec" label="Renvoyer le code" onPress={() => demander(`+${etat.enAttente}`)} disabled={busy} />
            <Btn kind="sec" label="Changer de numéro" onPress={() => setChanger(true)} disabled={busy} />
          </View>
        </>
      ) : etat.telephone && !changer ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn small kind="sec" label="Envoyer un essai" onPress={essayer} disabled={busy} />
          <Btn small kind="sec" label="Changer de numéro" onPress={() => setChanger(true)} disabled={busy} />
          {/* Sans email confirmé, le numéro est le seul moyen d'entrer dans le compte. */}
          {session?.user.email && session.user.emailVerifie !== false ? <Btn small kind="danger" label="Retirer" onPress={retirer} disabled={busy} /> : null}
        </View>
      ) : (
        <>
          <ChampTelephone tel={tel} label="Numéro de téléphone" />
          <View style={{ flexDirection: 'row' }}>
            <Btn label="Envoyer le code" onPress={() => demander(tel.complet)} disabled={busy || !tel.valide} />
          </View>
        </>
      )}
      {msg ? <T small muted>{msg}</T> : null}
      {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
    </View>
  );
}

/** Solde du compte SMS, pour l'admin. */
export function SoldeSms() {
  const { session, notifs, isAdmin } = useStore();
  const token = session?.token;
  const visible = notifs.sms === true && isAdmin;
  const [solde, setSolde] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    let fini = false;
    api<{ montant: number; devise: string }>('/sms/solde', { token, discret: true })
      .then((r) => !fini && setSolde(`${r.montant} ${r.devise}`.trim()))
      .catch(() => !fini && setSolde('indisponible'));
    return () => {
      fini = true;
    };
  }, [visible, token]);
  if (!visible || solde === null) return null;
  return <T small muted>{`Solde SMS : ${solde}`}</T>;
}
