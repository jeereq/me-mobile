import { useState } from 'react';
import { Switch, View } from 'react-native';

import { ChoixApparence } from '@/components/apparence';
import { Btn, Header, Panel, Screen, T, Tag } from '@/components/ui';
import { api } from '@/lib/api';
import { calculerRappels, demanderPermission, planifierRappels } from '@/lib/reminders';
import { useStore } from '@/lib/store';
import { C, THEMES } from '@/lib/theme';

export default function Compte() {
  const { mode, profil, isAdmin, signOut, espace, config, syncState, update, notifs, session, chargerNotifs } = useStore();
  const [msg, setMsg] = useState('');
  const [msgNotif, setMsgNotif] = useState('');
  const n = espace.notifs || {};
  const setN = (patch: Partial<NonNullable<typeof espace.notifs>>) => update((e) => ({ ...e, notifs: { ...e.notifs, ...patch } }));
  const essai = async () => {
    setMsgNotif('Envoi…');
    try {
      const r = await api<{ email: boolean; raison?: string }>('/notifications/test', { method: 'POST', token: session?.token });
      await chargerNotifs();
      setMsgNotif(r.email ? `Essai envoyé dans l'app et à ${profil?.email}.` : `Essai envoyé dans l'app. ${r.raison || ''}`);
    } catch (e) {
      setMsgNotif((e as Error).message);
    }
  };
  const prochains = calculerRappels(espace, config).slice(0, 5);
  return (
    <Screen>
      <Header retour eyebrow={mode === 'cloud' ? profil?.email : 'Mode local'} title="Mon compte" />
      <Panel title="Compte">
        <Tag label={isAdmin ? 'Admin' : 'Utilisateur'} color={isAdmin ? C.accent : C.muted} />
        {mode === 'cloud' ? (
          <>
            <T>{profil?.nom || 'Sans nom'}</T>
            <T small muted>
              {profil?.email} · {syncState === 'ok' ? 'synchronisé' : syncState === 'en_cours' ? 'synchronisation…' : 'hors ligne'}
            </T>
            <Btn kind="danger" label="Se déconnecter" onPress={signOut} />
          </>
        ) : (
          <T small muted>
            Mode local : tes données restent sur ce téléphone. Pour avoir un compte, plusieurs utilisateurs et l'IA, connecte l'app à ton serveur me-api (voir le README).
          </T>
        )}
      </Panel>
      {mode === 'cloud' ? (
        <Panel title="Notifications">
          <T small muted>
            Le serveur t'envoie tes rappels à l'heure prévue, selon le mode de chaque élément.
          </T>
          {[
            { k: 'app' as const, titre: "Dans l'app", desc: 'Centre de notifications (cloche sur Aujourd’hui).', on: n.app !== false, dispo: true },
            { k: 'email' as const, titre: 'Par email', desc: notifs.email && config.canaux.mail ? `À ${profil?.email}` : config.canaux.mail ? "SendGrid n'est pas encore configuré sur le serveur." : "Canal coupé par l'admin dans Configuration.", on: n.email !== false, dispo: notifs.email && config.canaux.mail },
          ].map((x) => (
            <View key={x.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
              <View style={{ flex: 1 }}>
                <T>{x.titre}</T>
                <T small muted>
                  {x.desc}
                </T>
              </View>
              <Switch value={x.on && x.dispo} disabled={!x.dispo} onValueChange={(v) => setN({ [x.k]: v })} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} accessibilityLabel={`Rappels ${x.titre.toLowerCase()}`} />
            </View>
          ))}
          <Btn kind="sec" label="Envoyer un essai" onPress={essai} />
          {msgNotif ? <T small muted>{msgNotif}</T> : null}
        </Panel>
      ) : null}
      <Panel title="Apparence">
        <T small muted>
          Les couleurs de base de ton app. Elles ne changent que pour ton compte.
        </T>
        <ChoixApparence
          heriter={THEMES[config.theme.nom]?.nom || 'Jarvis'}
          value={{ nom: espace.apparence?.theme || '', accent: espace.apparence?.accent || '' }}
          onChange={(v) => update((e) => ({ ...e, apparence: v.nom ? { theme: v.nom, accent: v.accent } : undefined }))}
        />
      </Panel>
      <Panel title="Rappels programmés">
        {prochains.length ? (
          prochains.map((p, i) => (
            <T key={i} small>
              {p.date.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {p.title}
            </T>
          ))
        ) : (
          <T small muted>
            Aucun rappel dans les 3 prochaines semaines.
          </T>
        )}
        <Btn
          kind="sec"
          label="Réactiver les notifications"
          onPress={async () => {
            const ok = await demanderPermission();
            if (ok) await planifierRappels(espace, config);
            setMsg(ok ? 'Rappels reprogrammés.' : 'Les notifications sont refusées : active-les dans les réglages du téléphone.');
          }}
        />
        {msg ? <T small muted>{msg}</T> : null}
      </Panel>
    </Screen>
  );
}
