import { useEffect, useState } from 'react';
import { Platform, Switch, View } from 'react-native';

import { ChoixApparence } from '@/components/apparence';
import { LiensLegaux } from '@/components/liens-legaux';
import { Btn, Header, Input, Panel, Screen, Sep, T, Tag } from '@/components/ui';
import { api } from '@/lib/api';
import { depensesCsv, exportLocal, telecharger } from '@/lib/export';
import { financesDe } from '@/lib/finances';
import { activerPush, couperPush, etatPush, type EtatPush } from '@/lib/push';
import { calculerRappels, demanderPermission, planifierRappels } from '@/lib/reminders';
import { jouer } from '@/lib/sons';
import { useStore } from '@/lib/store';
import { C, THEMES } from '@/lib/theme';

/** Mot de passe et suppression du compte (mode serveur). */
function Securite() {
  const { session, changerMotDePasse, supprimerCompte, deconnecterTout } = useStore();
  const u = session?.user;
  const sansMdp = u?.motDePasse === false;
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [suppr, setSuppr] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [msgSuppr, setMsgSuppr] = useState('');
  const [msgAppareils, setMsgAppareils] = useState('');

  const changer = async () => {
    setBusy(true);
    setMsg('');
    try {
      await changerMotDePasse(actuel, nouveau);
      setActuel('');
      setNouveau('');
      setMsg(sansMdp ? 'Mot de passe enregistré : tu peux aussi te connecter avec ton email.' : 'Mot de passe changé. Tes autres appareils sont déconnectés.');
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };
  const fermerAutres = async () => {
    setBusy(true);
    setMsgAppareils('');
    try {
      await deconnecterTout();
      setMsgAppareils('Tes autres appareils sont déconnectés. Ils devront se reconnecter.');
    } catch (e) {
      setMsgAppareils((e as Error).message);
    }
    setBusy(false);
  };
  const supprimer = async () => {
    setBusy(true);
    setMsgSuppr('');
    try {
      await supprimerCompte(confirmation);
    } catch (e) {
      setMsgSuppr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Panel title="Connexion et sécurité">
      {u?.google ? <T small muted>Connexion avec Google activée pour ce compte.</T> : null}
      <T>{sansMdp ? 'Choisir un mot de passe' : 'Changer de mot de passe'}</T>
      {sansMdp ? null : <Input label="Mot de passe actuel" placeholder="Mot de passe actuel" value={actuel} onChangeText={setActuel} secureTextEntry autoComplete="current-password" />}
      <Input label="Nouveau mot de passe" placeholder="8 caractères minimum" value={nouveau} onChangeText={setNouveau} secureTextEntry autoComplete="new-password" />
      {msg ? <T small muted>{msg}</T> : null}
      <Btn kind="sec" label="Enregistrer le mot de passe" onPress={changer} disabled={busy || nouveau.length < 8 || (!sansMdp && !actuel)} />
      <Sep />
      <T>Appareils connectés</T>
      <T small muted>
        Un téléphone perdu ou un ordinateur partagé ? Ferme toutes les sessions ouvertes ailleurs ; celle-ci reste ouverte.
      </T>
      {msgAppareils ? <T small muted>{msgAppareils}</T> : null}
      <Btn kind="sec" label="Déconnecter mes autres appareils" onPress={fermerAutres} disabled={busy} />
      <Sep />
      {suppr ? (
        <>
          <T>Supprimer mon compte</T>
          <T small muted>
            Ton compte, tes tâches, relances, habitudes, finances, notifications et comptes connectés seront effacés définitivement, et l'accès à Google sera retiré. Pour confirmer, tape ton adresse email.
          </T>
          <Input label="Ton email" placeholder={u?.email} value={confirmation} onChangeText={setConfirmation} autoCapitalize="none" keyboardType="email-address" />
          {msgSuppr ? <T small style={{ color: C.agressif }}>{msgSuppr}</T> : null}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn kind="danger" label="Supprimer définitivement" onPress={supprimer} disabled={busy || confirmation.trim().toLowerCase() !== u?.email} />
            <Btn kind="sec" label="Annuler" onPress={() => setSuppr(false)} />
          </View>
        </>
      ) : (
        <Btn kind="danger" label="Supprimer mon compte…" onPress={() => setSuppr(true)} />
      )}
    </Panel>
  );
}

/** Export des données : tout le compte en JSON (droit d'accès et de portabilité) et les dépenses en CSV. */
function MesDonnees() {
  const { mode, session, espace } = useStore();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const tenter = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };
  const tout = () =>
    tenter(async () => {
      if (mode === 'cloud') {
        const r = await api<{ exporteLe: string }>('/auth/me/export', { token: session?.token });
        await telecharger(`me-donnees-${r.exporteLe.slice(0, 10)}.json`, JSON.stringify(r, null, 2), 'application/json');
      } else {
        const x = exportLocal(espace);
        await telecharger(x.nom, x.contenu, 'application/json');
      }
    });
  const csv = () =>
    tenter(async () => {
      const x = depensesCsv(financesDe(espace), espace.categories ?? []);
      await telecharger(x.nom, x.contenu, 'text/csv;charset=utf-8');
    });
  const nb = financesDe(espace).depenses.length;
  return (
    <Panel title="Mes données">
      <T small muted>
        {mode === 'cloud'
          ? 'Récupère une copie de tout ce que Me garde pour toi : compte, tâches, relances, habitudes, finances, notifications et comptes connectés (sans leurs clés d’accès).'
          : 'Récupère une copie de tout ce que Me garde sur cet appareil.'}
      </T>
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn kind="sec" label="Tout exporter (JSON)" onPress={tout} disabled={busy} />
        <Btn kind="sec" label={`Dépenses (CSV${nb ? `, ${nb}` : ''})`} onPress={csv} disabled={busy || !nb} />
      </View>
    </Panel>
  );
}

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
  const [push, setPush] = useState<EtatPush>('indisponible');
  const [msgPush, setMsgPush] = useState('');
  useEffect(() => {
    etatPush().then(setPush);
  }, []);
  const basculerPush = async (on: boolean) => {
    if (!session?.token) return;
    setMsgPush(on ? 'Activation…' : '');
    try {
      if (on) await activerPush(session.token);
      else await couperPush(session.token);
      setMsgPush(on ? 'Activé : tes rappels s’afficheront sur cet appareil, même app fermée.' : '');
    } catch (e) {
      setMsgPush((e as Error).message);
    }
    setPush(await etatPush());
  };
  const descPush: Record<EtatPush, string> = {
    actif: 'Activé sur cet appareil, même quand Me est fermée.',
    inactif: 'Affiche tes rappels sur cet appareil, même quand Me est fermée.',
    refuse: 'Bloqué par le navigateur : autorise les notifications pour ce site dans ses réglages.',
    a_installer: "Sur iPhone : ajoute Me à l'écran d'accueil (Partager > Sur l'écran d'accueil), puis ouvre-la depuis son icône.",
    indisponible: 'Ce navigateur ne gère pas les notifications push.',
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
            { k: 'recompenses' as const, titre: 'Mission et série', desc: 'Le matin, ta mission et les points à gagner. Le soir, un coup de pouce si ta série est en danger.', on: n.recompenses !== false, dispo: true },
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
          {Platform.OS === 'web' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
              <View style={{ flex: 1 }}>
                <T>Sur cet appareil (push)</T>
                <T small muted>
                  {descPush[push]}
                </T>
              </View>
              <Switch value={push === 'actif'} disabled={push === 'indisponible' || push === 'a_installer' || push === 'refuse'} onValueChange={basculerPush} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} accessibilityLabel="Notifications push sur cet appareil" />
            </View>
          ) : null}
          {msgPush ? <T small muted>{msgPush}</T> : null}
          <Btn kind="sec" label="Envoyer un essai" onPress={essai} />
          {msgNotif ? <T small muted>{msgNotif}</T> : null}
        </Panel>
      ) : null}
      <Panel title="Sons">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T>Sons de l'app</T>
            <T small muted>
              Un tintement quand tu coches, une petite fanfare quand toutes tes habitudes du jour sont faites, une cloche quand un rappel arrive.
            </T>
          </View>
          <Switch
            value={espace.sons !== false}
            onValueChange={(v) => {
              update((e) => ({ ...e, sons: v }));
              if (v) setTimeout(() => jouer('valide'), 50);
            }}
            trackColor={{ true: C.accent, false: C.line }}
            thumbColor={C.ink}
            accessibilityLabel="Sons de l'app"
          />
        </View>
      </Panel>
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
      {mode === 'cloud' ? <Securite /> : null}
      <MesDonnees />
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
      <LiensLegaux />
    </Screen>
  );
}
