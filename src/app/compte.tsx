import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Switch, View } from 'react-native';

import { ChoixApparence, ChoixTailleTexte } from '@/components/apparence';
import { useVueMobile } from '@/components/texte';
import { ChoixBarre } from '@/components/choix-barre';
import { ChoixVoix } from '@/components/choix-voix';
import { LiensLegaux } from '@/components/liens-legaux';
import { PanneauMotCle } from '@/components/mot-cle';
import { PanneauNomApp } from '@/components/nom-app';
import { NavInterne, useSection, type SectionInterne } from '@/components/nav-interne';
import { ChampMotDePasse, Force } from '@/components/mot-de-passe';
import { MentionPro } from '@/components/reserve-pro';
import { SmsCompte } from '@/components/sms-compte';
import { Btn, Header, Input, Panel, Screen, T, Tag } from '@/components/ui';
import { resumeAbonnement } from '@/lib/abonnement';
import { api } from '@/lib/api';
import { depensesCsv, exportLocal, telecharger } from '@/lib/export';
import { refusMotDePasse } from '@/lib/commun/mot-de-passe';
import { financesDe } from '@/lib/finances';
import { emailDouteux } from '@/lib/identifiant';
import { activerPush, couperPush, etatPush, type EtatPush } from '@/lib/push';
import { calculerRappels, demanderPermission, planifierRappels } from '@/lib/reminders';
import { jouer } from '@/lib/sons';
import { useStore } from '@/lib/store';
import { C, THEMES } from '@/lib/theme';

/** Mot de passe et suppression du compte (mode serveur). */
/** Un compte créé avec son numéro : l'email ouvre les mails et les invitations d'équipe. */
function AjoutEmail() {
  const { session, rafraichirCompte } = useStore();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const ajouter = async () => {
    setBusy(true);
    setMsg('');
    try {
      await api('/auth/me', { method: 'PATCH', token: session?.token, body: { email: email.trim() } });
      await rafraichirCompte();
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <>
      <Input label="Ajouter un email" placeholder="toi@exemple.com" aide="Pour les mails et les invitations d’équipe." value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" erreur={msg || (emailDouteux(email) ? 'Cette adresse n’a pas l’air complète.' : '')} />
      <View style={{ flexDirection: 'row' }}>
        <Btn kind="sec" label="Ajouter" onPress={ajouter} disabled={busy || !email.trim() || emailDouteux(email)} />
      </View>
    </>
  );
}

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
      setMsg(sansMdp ? 'Mot de passe enregistré : tu peux aussi te connecter avec ton email ou ton numéro vérifié.' : 'Mot de passe changé. Tes autres appareils sont déconnectés.');
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };
  const oublie = async () => {
    setBusy(true);
    setMsg('');
    try {
      await api('/auth/oubli', { method: 'POST', body: { identifiant: u?.email ?? (u?.telephone ? `+${u.telephone}` : '') } });
      setMsg('Lien envoyé : regarde tes emails ou tes SMS.');
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };
  const compte = { email: u?.email, nom: u?.nom, telephone: u?.telephone };
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
    <>
      <Panel title={sansMdp ? 'Choisir un mot de passe' : 'Mot de passe'}>
        {u?.google ? <T small muted>Connexion avec Google activée.</T> : null}
        {sansMdp ? null : <ChampMotDePasse label="Mot de passe actuel" placeholder="Mot de passe actuel" value={actuel} onChangeText={setActuel} autoComplete="current-password" />}
        <ChampMotDePasse label="Nouveau mot de passe" placeholder="8 caractères minimum" value={nouveau} onChangeText={setNouveau} autoComplete="new-password" />
        {nouveau ? <Force mdp={nouveau} compte={compte} /> : null}
        {msg ? <T small muted>{msg}</T> : null}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn kind="sec" label="Enregistrer" onPress={changer} disabled={busy || !!refusMotDePasse(nouveau, compte) || (!sansMdp && !actuel)} />
          {sansMdp ? null : <Btn kind="sec" label="Mot de passe oublié ?" onPress={oublie} disabled={busy} />}
        </View>
      </Panel>
      <Panel title="Appareils connectés">
        <T small muted>
          Ferme les sessions ouvertes ailleurs ; celle-ci reste ouverte.
        </T>
        {msgAppareils ? <T small muted>{msgAppareils}</T> : null}
        <View style={{ flexDirection: 'row' }}>
          <Btn kind="sec" label="Déconnecter mes autres appareils" onPress={fermerAutres} disabled={busy} />
        </View>
      </Panel>
      <Panel title="Supprimer mon compte">
        {suppr ? (
          <>
            <T small muted>
              Toutes tes données seront effacées définitivement et l’accès à Google retiré. Tape {u?.email ? 'ton adresse email' : 'ton numéro'} pour confirmer.
            </T>
            {u?.email ? (
              <Input label="Ton email" placeholder={u.email} value={confirmation} onChangeText={setConfirmation} autoCapitalize="none" keyboardType="email-address" />
            ) : (
              <Input label="Ton numéro" placeholder={u?.telephone ? `+${u.telephone}` : undefined} value={confirmation} onChangeText={setConfirmation} keyboardType="phone-pad" />
            )}
            {msgSuppr ? <T small style={{ color: C.agressif }}>{msgSuppr}</T> : null}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Btn kind="danger" label="Supprimer définitivement" onPress={supprimer} disabled={busy || (u?.email ? confirmation.trim().toLowerCase() !== u.email : confirmation.replace(/\D/g, '').length < 9)} />
              <Btn kind="sec" label="Annuler" onPress={() => setSuppr(false)} />
            </View>
          </>
        ) : (
          <View style={{ flexDirection: 'row' }}>
            <Btn kind="danger" label="Supprimer mon compte…" onPress={() => setSuppr(true)} />
          </View>
        )}
      </Panel>
    </>
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
          ? 'Une copie de tout ce que Me garde pour toi.'
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
  const vueMobile = useVueMobile();
  const { mode, profil, isAdmin, signOut, espace, config, syncState, update, notifs, session, chargerNotifs, abonnement } = useStore();
  const nomCompte = profil?.email || (profil?.telephone ? `+${profil.telephone}` : undefined);
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
  type Section = 'profil' | 'abonnement' | 'securite' | 'notifications' | 'apparence' | 'assistant' | 'donnees';
  const sections: SectionInterne<Section>[] = [
    { key: 'profil', label: 'Profil', icone: 'profil' },
    ...(mode === 'cloud' && abonnement?.actif ? [{ key: 'abonnement', label: 'Abonnement', icone: 'etoile' } as const] : []),
    ...(mode === 'cloud' ? [{ key: 'securite', label: 'Sécurité', icone: 'bouclier' } as const] : []),
    { key: 'notifications', label: 'Notifications', icone: 'cloche' },
    { key: 'apparence', label: 'Apparence', icone: 'reglages' },
    { key: 'assistant', label: 'Assistant', icone: 'onde' },
    { key: 'donnees', label: 'Mes données', icone: 'archive' },
  ];
  const [section, setSection] = useSection(sections);
  return (
    <Screen>
      <Header retour eyebrow={mode === 'cloud' ? nomCompte : 'Mode local'} title="Mon compte" />
      <NavInterne label="Sections du compte" sections={sections} value={section} onChange={setSection}>
      {section === 'profil' ? (
        <Panel title="Compte">
          <Tag label={isAdmin ? 'Admin' : 'Utilisateur'} color={isAdmin ? C.accent : C.muted} />
          {mode === 'cloud' ? (
            <>
              <T>{profil?.nom || 'Sans nom'}</T>
              <T small muted>
                {nomCompte} · {syncState === 'ok' ? 'synchronisé' : syncState === 'en_cours' ? 'synchronisation…' : 'hors ligne'}
              </T>
              {profil?.email ? null : <AjoutEmail />}
              <View style={{ flexDirection: 'row' }}>
                <Btn kind="danger" label="Se déconnecter" onPress={signOut} />
              </View>
            </>
          ) : (
            <T small muted>
              Mode local : tes données restent sur ce téléphone.
            </T>
          )}
        </Panel>
      ) : null}
      {section === 'abonnement' && abonnement ? (
        <Panel title="Abonnement">
          <T small>{resumeAbonnement(abonnement)}</T>
          <View style={{ flexDirection: 'row' }}>
            <Btn kind="sec" label={abonnement.offre === 'pro' ? 'Gérer mon abonnement' : 'Voir les offres'} onPress={() => router.push('/abonnement')} />
          </View>
        </Panel>
      ) : null}
      {section === 'securite' ? <Securite /> : null}
      {section === 'donnees' ? (
        <>
          <MesDonnees />
          <LiensLegaux />
        </>
      ) : null}
      {section === 'notifications' && mode === 'cloud' ? (
        <Panel title="Notifications">
          <T small muted>
            Tes rappels, à l’heure prévue.
          </T>
          {profil?.email && profil.emailVerifie === false ? (
            <View style={{ gap: 8 }}>
              <T small style={{ color: C.hebdo }}>{`Adresse non confirmée : aucun email ne part à ${profil.email}.`}</T>
              <View style={{ flexDirection: 'row' }}>
                <Btn
                  small
                  kind="sec"
                  label="Recevoir le lien"
                  onPress={() => {
                    api('/auth/verifier/renvoyer', { method: 'POST', body: { email: profil.email } })
                      .then(() => setMsgNotif(`Lien envoyé à ${profil.email}.`))
                      .catch((e: Error) => setMsgNotif(e.message));
                  }}
                />
              </View>
            </View>
          ) : null}
          {[
            { k: 'app' as const, titre: "Dans l'app", desc: 'Centre de notifications (cloche sur Aujourd’hui).', on: n.app !== false, dispo: true },
            { k: 'recompenses' as const, titre: 'Mission et série', desc: 'Le matin, ta mission. Le soir, si ta série est en danger.', on: n.recompenses !== false, dispo: true },
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
          <SmsCompte actif={n.sms === true} onActif={(sms) => setN({ sms })} />
          <MentionPro />
          <Btn kind="sec" label="Envoyer un essai" onPress={essai} />
          {msgNotif ? <T small muted>{msgNotif}</T> : null}
        </Panel>
      ) : null}
      {section === 'apparence' ? (
        <>
          {vueMobile ? (
            <Panel title="Taille du texte">
              <ChoixTailleTexte />
            </Panel>
          ) : null}
          <Panel title="Apparence">
            <T small muted>
              Pour ton compte seulement.
            </T>
            <ChoixApparence
              heriter={THEMES[config.theme.nom]?.nom || 'Jarvis'}
              value={{ nom: espace.apparence?.theme || '', accent: espace.apparence?.accent || '' }}
              onChange={(v) => update((e) => ({ ...e, apparence: v.nom ? { theme: v.nom, accent: v.accent } : undefined }))}
            />
          </Panel>
          <Panel title="Sons">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <T>Sons de l'app</T>
                <T small muted>
                  Quand tu coches, finis tes habitudes ou reçois un rappel.
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
          <ChoixBarre />
        </>
      ) : null}
      {section === 'assistant' ? (
        <>
          <PanneauNomApp />
          <PanneauMotCle />
          <Panel title="Voix de l'app">
            <ChoixVoix />
          </Panel>
        </>
      ) : null}
      {section === 'notifications' ? (
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
      ) : null}
      </NavInterne>
    </Screen>
  );
}
