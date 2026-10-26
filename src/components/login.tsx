import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';

import { api, ApiError, API_URL, type Session } from '@/lib/api';
import { nettoyerAdresse, type LienCompte } from '@/lib/liens-compte';
import { useStore } from '@/lib/store';
import { LARGEUR_FORMULAIRE } from '@/lib/mise-en-page';
import { alpha, C, F } from '@/lib/theme';

import { LiensLegaux } from './liens-legaux';
import { SousOnglets } from './onglets';
import { Btn, Input, Panel, Screen, T } from './ui';

type Mode = 'connexion' | 'inscription' | 'oubli' | 'envoye' | 'verification' | 'reinitialiser' | 'traitement';
type Options = { google: boolean; email: boolean };

function Lien({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => ({ alignSelf: 'center', paddingVertical: 4, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Un message qui compte : rouge quand ça coince, vert quand c'est fait. */
function Message({ texte, genre }: { texte: string; genre: 'erreur' | 'info' }) {
  const couleur = genre === 'erreur' ? C.agressif : C.coach;
  return (
    <View accessibilityRole={genre === 'erreur' ? 'alert' : undefined} style={{ flexDirection: 'row', gap: 8, padding: 10, borderRadius: 12, backgroundColor: alpha(couleur, 0.1), borderLeftWidth: 3, borderLeftColor: couleur }}>
      <Text style={{ flex: 1, color: genre === 'erreur' ? couleur : C.ink, fontFamily: F.texte, fontSize: 13, lineHeight: 18 }}>{texte}</Text>
    </View>
  );
}

/** Trois barres qui disent si le mot de passe choisi tient la route (longueur, chiffres, lettres, symboles). */
function Force({ mdp }: { mdp: string }) {
  const points = Number(mdp.length >= 8) + Number(mdp.length >= 12) + Number(/\d/.test(mdp)) + Number(/[^\w\s]/.test(mdp)) + Number(/[a-z]/.test(mdp) && /[A-Z]/.test(mdp));
  const niveau = mdp.length < 8 ? 0 : points >= 4 ? 3 : points >= 3 ? 2 : 1;
  const couleur = [C.line, C.agressif, C.hebdo, C.coach][niveau];
  const mot = ['8 caractères minimum', 'Ça peut être plus solide', 'Correct', 'Solide'][niveau];
  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= niveau ? couleur : C.line }} />
        ))}
      </View>
      <Text style={{ color: niveau ? couleur : C.muted, fontFamily: F.texte, fontSize: 12 }}>{mot}</Text>
    </View>
  );
}

/** L'email a-t-il la tête d'une adresse ? (le serveur tranche, ici c'est juste pour prévenir tout de suite) */
const emailDouteux = (x: string) => !!x.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x.trim());

function Ou() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>ou</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
    </View>
  );
}

/**
 * Écran de connexion : email et mot de passe, Google, mot de passe oublié, et les liens reçus par email
 * (`lien`, lu dans l'adresse au chargement de l'app web). `finLien` rend la main à l'app une fois le lien traité.
 */
export function Login({ lien, finLien, modeInitial, retour }: { lien?: LienCompte | null; finLien?: () => void; /** Écran d'ouverture quand on arrive de la page d'accueil. */ modeInitial?: 'connexion' | 'inscription'; /** Revient à la page d'accueil. */ retour?: () => void }) {
  const [mode, setMode] = useState<Mode>(lien?.type === 'reinitialiser' ? 'reinitialiser' : lien?.type === 'verifier' || lien?.type === 'google' ? 'traitement' : modeInitial ?? 'connexion');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [nom, setNom] = useState('');
  const [msg, setMsg] = useState(lien?.type === 'erreur_google' ? lien.message : '');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<Options>({ google: false, email: false });
  const [montrerMdp, setMontrerMdp] = useState(false);
  const { signIn, signUp, ouvrirSession, session } = useStore();
  // Le formulaire est prêt quand l'adresse a la bonne tête et le mot de passe la bonne longueur.
  const prete = !!email.trim() && !emailDouteux(email) && mdp.length >= (mode === 'inscription' ? 8 : 1);
  // Le titre de la page suit ce qu'on est en train de faire : on sait toujours où on est.
  const [titrePage, sousTitrePage] =
    mode === 'inscription'
      ? ['Crée ton compte', 'Deux minutes, et tes relances, tâches, habitudes et budgets te suivent sur tous tes appareils.']
      : mode === 'oubli'
        ? ['Mot de passe oublié', 'On t’envoie un lien pour en choisir un nouveau.']
        : mode === 'reinitialiser'
          ? ['Nouveau mot de passe', 'Choisis-en un, et te voilà reconnecté.']
          : mode === 'verification' || mode === 'envoye'
            ? ['Regarde tes emails', 'Un lien t’attend dans ta boîte.']
            : ['Content de te revoir', 'Relances, tâches, habitudes et budgets au même endroit. Chaque action te rapporte des points.'];

  useEffect(() => {
    if (lien) nettoyerAdresse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api<Options>('/auth/options', { discret: true })
      .then(setOptions)
      .catch(() => {});
  }, []);

  // Lien de confirmation ou retour de Google : on l'échange contre une session.
  useEffect(() => {
    const l = lien;
    if (l?.type !== 'verifier' && l?.type !== 'google') return;
    (async () => {
      try {
        const s = l.type === 'google' ? await api<Session>('/auth/google/echange', { method: 'POST', body: { code: l.code } }) : await api<Session>('/auth/verifier', { method: 'POST', body: { jeton: l.jeton } });
        await ouvrirSession(s);
        finLien?.();
      } catch (e) {
        // Déjà connecté (lien rouvert, page rechargée) : on retourne simplement à l'app.
        if (session) return finLien?.();
        setMsg((e as Error).message);
        setMode('connexion');
      }
    })();
    // Une seule fois par lien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lien]);

  const changer = (m: Mode) => {
    setMode(m);
    setMsg('');
    setInfo('');
    if (lien && m === 'connexion') finLien?.();
  };

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

  const go = () =>
    tenter(async () => {
      try {
        if (mode === 'connexion') await signIn(email.trim(), mdp);
        else {
          const aConfirmer = await signUp(email.trim(), mdp, nom.trim());
          if (aConfirmer) {
            setEmail(aConfirmer);
            setMode('verification');
            setInfo(`On t'a envoyé un lien à ${aConfirmer}. Ouvre-le pour activer ton compte, puis reviens ici.`);
          }
        }
      } catch (e) {
        if (e instanceof ApiError && e.code === 'EMAIL_NON_VERIFIE') {
          setMode('verification');
          setInfo(`Ton compte attend la confirmation de ${email.trim()}. Ouvre le lien reçu par email, ou demande-en un nouveau.`);
          return;
        }
        throw e;
      }
    });

  const renvoyer = () =>
    tenter(async () => {
      await api('/auth/verifier/renvoyer', { method: 'POST', body: { email: email.trim() } });
      setInfo(`Nouveau lien envoyé à ${email.trim()}. Pense à regarder dans les spams.`);
    });

  const oubli = () =>
    tenter(async () => {
      await api('/auth/oubli', { method: 'POST', body: { email: email.trim() } });
      setMode('envoye');
      setInfo(`Si un compte existe pour ${email.trim()}, un lien pour choisir un nouveau mot de passe vient de partir. Il est valable 1 heure.`);
    });

  const reinitialiser = () =>
    tenter(async () => {
      if (lien?.type !== 'reinitialiser') return;
      await ouvrirSession(await api<Session>('/auth/reinitialiser', { method: 'POST', body: { jeton: lien.jeton, password: mdp } }));
      finLien?.();
    });

  const google = () =>
    tenter(async () => {
      const debut = `${API_URL}/api/auth/google/debut?retour=`;
      if (Platform.OS === 'web') {
        // Toute la page part chez Google puis revient avec ?google=… : pas de fenêtre bloquée par le navigateur.
        window.location.assign(debut + encodeURIComponent(`${window.location.origin}/`));
        return;
      }
      const retour = Linking.createURL('/');
      const res = await WebBrowser.openAuthSessionAsync(debut + encodeURIComponent(retour), retour);
      if (res.type !== 'success') return;
      const q = Linking.parse(res.url).queryParams || {};
      if (q.erreur_google) throw new Error(String(q.erreur_google));
      if (!q.google) throw new Error('Connexion Google interrompue, recommence.');
      await ouvrirSession(await api<Session>('/auth/google/echange', { method: 'POST', body: { code: String(q.google) } }));
    });

  // Ce qui empêche d'envoyer, dit au moment où on le tape plutôt qu'après un aller-retour avec le serveur.
  const erreurEmail = emailDouteux(email) ? 'Cette adresse n’a pas l’air complète.' : '';
  const voirMdp = (
    <Pressable accessibilityRole="button" accessibilityLabel={montrerMdp ? 'Masquer le mot de passe' : 'Voir le mot de passe'} hitSlop={6} onPress={() => setMontrerMdp(!montrerMdp)} style={({ pressed }) => ({ paddingHorizontal: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>{montrerMdp ? 'Masquer' : 'Voir'}</Text>
    </Pressable>
  );

  let panneau;
  if (mode === 'traitement')
    panneau = (
      <Panel>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
          <ActivityIndicator color={C.accent} />
          <T muted>{lien?.type === 'google' ? 'Connexion avec Google…' : 'Confirmation de ton email…'}</T>
        </View>
      </Panel>
    );
  else if (mode === 'verification' || mode === 'envoye')
    panneau = (
      <Panel title={mode === 'verification' ? 'Confirme ton email' : 'Regarde tes emails'}>
        <Message texte={info} genre="info" />
        <T small muted>Le lien n’arrive pas ? Regarde dans les spams, l’email vient de « Me ».</T>
        {mode === 'verification' && options.email ? <Btn kind="sec" label={busy ? 'Envoi…' : 'Renvoyer le lien'} onPress={renvoyer} disabled={busy || !email.trim()} /> : null}
        {msg ? <Message texte={msg} genre="erreur" /> : null}
        <Lien label="Retour à la connexion" onPress={() => changer('connexion')} />
      </Panel>
    );
  else if (mode === 'oubli')
    panneau = (
      <Panel title="Mot de passe oublié">
        <T small muted>
          Indique l'email de ton compte : tu recevras un lien pour choisir un nouveau mot de passe.
        </T>
        <Input
          label="Email"
          placeholder="toi@exemple.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          autoFocus
          returnKeyType="send"
          onSubmitEditing={() => !busy && email.trim() && oubli()}
          erreur={erreurEmail}
        />
        {msg ? <Message texte={msg} genre="erreur" /> : null}
        <Btn label={busy ? 'Envoi…' : 'Envoyer le lien'} onPress={oubli} disabled={busy || !email.trim() || !!erreurEmail} />
        <Lien label="Retour à la connexion" onPress={() => changer('connexion')} />
      </Panel>
    );
  else if (mode === 'reinitialiser')
    panneau = (
      <Panel title="Nouveau mot de passe">
        <T small muted>
          Choisis un nouveau mot de passe. Tes autres appareils seront déconnectés.
        </T>
        <Input
          label="Nouveau mot de passe"
          placeholder="8 caractères minimum"
          value={mdp}
          onChangeText={setMdp}
          secureTextEntry={!montrerMdp}
          autoComplete="new-password"
          autoFocus
          returnKeyType="go"
          onSubmitEditing={() => !busy && mdp.length >= 8 && reinitialiser()}
          droite={voirMdp}
        />
        <Force mdp={mdp} />
        {msg ? <Message texte={msg} genre="erreur" /> : null}
        <Btn label={busy ? 'Enregistrement…' : 'Enregistrer et me connecter'} onPress={reinitialiser} disabled={busy || mdp.length < 8} />
        <Lien label="Retour à la connexion" onPress={() => changer('connexion')} />
      </Panel>
    );
  else
    panneau = (
      <Panel>
        <SousOnglets
          label="Connexion ou inscription"
          options={[
            { key: 'connexion', label: 'Se connecter' },
            { key: 'inscription', label: 'Créer un compte' },
          ]}
          value={mode}
          onChange={changer}
        />
        {options.google ? (
          <>
            <Btn kind="sec" label="Continuer avec Google" onPress={google} disabled={busy} />
            <Ou />
          </>
        ) : null}
        {mode === 'inscription' ? <Input label="Prénom" placeholder="Prénom" value={nom} onChangeText={setNom} autoComplete="given-name" returnKeyType="next" /> : null}
        <Input
          label="Email"
          placeholder="toi@exemple.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          autoFocus={mode === 'connexion'}
          returnKeyType="next"
          erreur={erreurEmail}
        />
        <Input
          label="Mot de passe"
          placeholder={mode === 'inscription' ? '8 caractères minimum' : 'Mot de passe'}
          value={mdp}
          onChangeText={setMdp}
          secureTextEntry={!montrerMdp}
          autoComplete={mode === 'inscription' ? 'new-password' : 'password'}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (prete && !busy) go();
          }}
          droite={voirMdp}
        />
        {mode === 'inscription' ? <Force mdp={mdp} /> : null}
        {msg ? <Message texte={msg} genre="erreur" /> : null}
        <Btn label={busy ? (mode === 'connexion' ? 'Connexion…' : 'Création…') : mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'} onPress={go} disabled={busy || !prete} />
        {mode === 'connexion' && options.email ? <Lien label="Mot de passe oublié ?" onPress={() => changer('oubli')} /> : null}
        {mode === 'inscription' ? (
          <T small muted style={{ textAlign: 'center' }}>
            En créant un compte, tu acceptes les conditions d'utilisation et la politique de confidentialité, en bas de cette page.
          </T>
        ) : null}
      </Panel>
    );

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', maxWidth: LARGEUR_FORMULAIRE, alignSelf: 'center', gap: 20, paddingTop: 32 }}>
        {retour ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retour à la page d'accueil" onPress={retour} hitSlop={8} style={({ pressed }) => ({ alignSelf: 'flex-start', paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 14 }}>‹ Accueil</Text>
          </Pressable>
        ) : null}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }}>
            <Text style={{ color: C.accentInk, fontSize: 30, fontFamily: F.titre, letterSpacing: -1 }}>Me</Text>
          </View>
          <Text accessibilityRole="header" style={{ color: C.ink, fontSize: 26, fontFamily: F.titre, letterSpacing: -0.5, marginTop: 6, textAlign: 'center' }}>{titrePage}</Text>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 340 }}>{sousTitrePage}</Text>
        </View>
        {panneau}
        <LiensLegaux centre />
      </KeyboardAvoidingView>
    </Screen>
  );
}
