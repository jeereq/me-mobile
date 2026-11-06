import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/texte';

import { api, ApiError, API_URL, type Session } from '@/lib/api';
import { nettoyerAdresse, type LienCompte } from '@/lib/liens-compte';
import { useStore } from '@/lib/store';
import { refusMotDePasse } from '@/lib/commun/mot-de-passe';
import { emailDouteux } from '@/lib/identifiant';
import { LARGEUR_FORMULAIRE } from '@/lib/mise-en-page';
import { teinte, vive } from '@/lib/teinte';
import { alpha, C, F, ligneHaute, ombreAvant, surfaceHaute } from '@/lib/theme';

import { Logo, Telephone } from './accueil-public';
import { LiensLegaux } from './liens-legaux';
import { ChampMotDePasse, Force } from './mot-de-passe';
import { SousOnglets } from './onglets';
import { ChampTelephone, useTelephone } from './telephone';
import { Btn, Input, Screen, Seg, T } from './ui';

type Mode = 'connexion' | 'inscription' | 'oubli' | 'envoye' | 'verification' | 'code' | 'reinitialiser' | 'traitement';
type Options = { google: boolean; email: boolean; oubli?: boolean; sms?: boolean };

/** Le formulaire : la seule chose posée en avant sur l'écran. */
function Carte({ children }: { children: ReactNode }) {
  return <View style={{ gap: 14, padding: 20, borderRadius: 24, backgroundColor: surfaceHaute(), borderWidth: 1, borderColor: ligneHaute(), ...ombreAvant() }}>{children}</View>;
}

/** Sur grand écran, à côté du formulaire : ce qu'on retrouve en se connectant. */
function PanneauMarque() {
  const t = teinte(vive('indigo'));
  return (
    <View style={{ flex: 1, overflow: 'hidden', backgroundColor: alpha(t.c, C.sombre ? 0.1 : 0.08), borderRightWidth: 1, borderRightColor: C.line, padding: 48, gap: 28 }}>
      <Logo taille={44} />
      <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 40, lineHeight: 46, letterSpacing: -1, maxWidth: 460 }}>Qui relancer, quoi faire, où va ton argent.</Text>
      <View style={{ position: 'absolute', top: 310, left: 0, right: 0, alignItems: 'center', transform: [{ rotate: '-5deg' }] }}>
        <Telephone image={require('@/assets/images/apercu/tel-accueil.jpg')} alt="L'écran Aujourd'hui de Me : la mission du jour, le prochain rendez-vous et les choses à faire" largeur={320} />
      </View>
    </View>
  );
}

function LienHaut({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={accessibilityLabel} onPress={onPress} hitSlop={8} style={({ pressed }) => ({ paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

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
 * Écran de connexion : email ou téléphone et mot de passe, Google, mot de passe oublié, et les liens reçus par email
 * (`lien`, lu dans l'adresse au chargement de l'app web). `finLien` rend la main à l'app une fois le lien traité.
 */
export function Login({ lien, finLien, modeInitial, retour, contact }: { /** Ouvre la section Contact de la page d'accueil. */ contact?: () => void; lien?: LienCompte | null; finLien?: () => void; /** Écran d'ouverture quand on arrive de la page d'accueil. */ modeInitial?: 'connexion' | 'inscription'; /** Revient à la page d'accueil. */ retour?: () => void }) {
  const [mode, setMode] = useState<Mode>(lien?.type === 'reinitialiser' ? 'reinitialiser' : lien?.type === 'verifier' || lien?.type === 'google' ? 'traitement' : modeInitial ?? 'connexion');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const { width: largeur, height: hauteur } = useWindowDimensions();
  const bureau = largeur >= 1000 && hauteur >= 600;
  const [nom, setNom] = useState('');
  const [msg, setMsg] = useState(lien?.type === 'erreur_google' ? lien.message : '');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<Options>({ google: false, email: false });
  const tel = useTelephone();
  const [typeCompte, setTypeCompte] = useState<'email' | 'telephone'>('email');
  const [code, setCode] = useState('');
  const { signIn, signUp, ouvrirSession, session } = useStore();
  // S'inscrire avec son numéro suppose que le serveur peut envoyer le code.
  const parTel = typeCompte === 'telephone' && (mode !== 'inscription' || !!options.sms);
  // Pour retrouver un compte, un numéro d'un pays refermé depuis reste valable.
  const numero = tel.ferme ? tel.national.trim() : tel.complet;
  const numeroPret = tel.ferme ? tel.national.replace(/\D/g, '').length >= 8 : tel.valide;
  const identifiant = parTel ? numero : email.trim();
  const emailPret = !!email.trim() && !emailDouteux(email);
  const compteSaisi = { email: parTel ? null : email, nom, telephone: parTel ? tel.complet : null };
  // À la connexion, n'importe quel mot de passe : celui d'un ancien compte reste valable même s'il serait refusé aujourd'hui.
  const prete = mode === 'inscription' ? (parTel ? tel.valide && !!nom.trim() : emailPret) && !refusMotDePasse(mdp, compteSaisi) : (parTel ? numeroPret : emailPret) && !!mdp;
  // Le titre de la page suit ce qu'on est en train de faire : on sait toujours où on est.
  const [titrePage, sousTitrePage] =
    mode === 'inscription'
      ? ['Crée ton compte', 'Tes données, sur tous tes appareils.']
      : mode === 'oubli'
        ? ['Mot de passe oublié', 'On t’envoie un lien pour en choisir un nouveau.']
        : mode === 'reinitialiser'
          ? ['Nouveau mot de passe', 'Choisis-en un, et te voilà reconnecté.']
          : mode === 'code'
            ? ['Regarde tes SMS', 'Un code t’attend sur ton téléphone.']
            : mode === 'envoye' && parTel
              ? ['Regarde tes SMS', 'Un lien t’attend sur ton téléphone.']
            : mode === 'verification' || mode === 'envoye'
              ? ['Regarde tes emails', 'Un lien t’attend dans ta boîte.']
            : ['Content de te revoir', 'Relances, tâches, habitudes et budgets au même endroit.'];

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
        if (mode === 'connexion') await signIn(identifiant, mdp);
        else {
          const aConfirmer = await signUp(parTel ? undefined : email.trim(), mdp, nom.trim(), parTel ? tel.complet : undefined);
          if (aConfirmer?.telephone) {
            setCode('');
            setMode('code');
            setInfo(`Code envoyé au +${aConfirmer.telephone}.`);
          } else if (aConfirmer) {
            setMode('verification');
            setInfo(`On t'a envoyé un lien à ${aConfirmer.email}. Ouvre-le pour activer ton compte, puis reviens ici.`);
          }
        }
      } catch (e) {
        if (e instanceof ApiError && e.code === 'SMS_NON_VERIFIE') {
          setCode('');
          setMode('code');
          setInfo('Ton compte attend le code reçu par SMS. Demande-en un nouveau s’il a expiré.');
          return;
        }
        if (e instanceof ApiError && e.code === 'EMAIL_NON_VERIFIE') {
          setMode('verification');
          setInfo(`Ton compte attend la confirmation de ${email.trim()}. Ouvre le lien reçu par email, ou demande-en un nouveau.`);
          return;
        }
        throw e;
      }
    });

  const validerCode = () =>
    tenter(async () => {
      await ouvrirSession(await api<Session>('/auth/verifier/sms', { method: 'POST', body: { identifiant, code: code.trim() } }));
    });

  const renvoyerCode = () =>
    tenter(async () => {
      await api('/auth/verifier/sms/renvoyer', { method: 'POST', body: { identifiant } });
      setInfo('Nouveau code envoyé.');
    });

  const lienParEmail = () =>
    tenter(async () => {
      await api('/auth/verifier/renvoyer', { method: 'POST', body: { identifiant } });
      setMode('verification');
      setInfo(`On t'a envoyé un lien à ${email.trim()}. Ouvre-le pour activer ton compte, puis reviens ici.`);
    });

  const renvoyer = () =>
    tenter(async () => {
      await api('/auth/verifier/renvoyer', { method: 'POST', body: { identifiant } });
      setInfo(`Nouveau lien envoyé à ${email.trim()}. Pense à regarder dans les spams.`);
    });

  const oubli = () =>
    tenter(async () => {
      await api('/auth/oubli', { method: 'POST', body: { identifiant } });
      setMode('envoye');
      setInfo(`Si un compte existe pour ${identifiant}, un lien pour choisir un nouveau mot de passe vient de partir, par email et par SMS si ton numéro est vérifié. Il est valable 1 heure.`);
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
  const choixType = (
    <Seg
      options={[
        { key: 'email', label: 'Email' },
        { key: 'telephone', label: 'Téléphone' },
      ]}
      value={typeCompte}
      onChange={setTypeCompte}
    />
  );
  let panneau;
  if (mode === 'traitement')
    panneau = (
      <Carte>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
          <ActivityIndicator color={C.accent} />
          <T muted>{lien?.type === 'google' ? 'Connexion avec Google…' : 'Confirmation de ton email…'}</T>
        </View>
      </Carte>
    );
  else if (mode === 'verification' || mode === 'envoye')
    panneau = (
      <Carte>
        <Message texte={info} genre="info" />
        {parTel ? null : <T small muted>Le lien n’arrive pas ? Regarde dans les spams, l’email vient de « Me ».</T>}
        {mode === 'verification' && options.email ? <Btn kind="sec" label={busy ? 'Envoi…' : 'Renvoyer le lien'} onPress={renvoyer} disabled={busy || !email.trim()} /> : null}
        {msg ? <Message texte={msg} genre="erreur" /> : null}
        <Lien label="Retour à la connexion" onPress={() => changer('connexion')} />
      </Carte>
    );
  else if (mode === 'code')
    panneau = (
      <Carte>
        <Message texte={info} genre="info" />
        <Input label="Code à 6 chiffres" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" maxLength={6} autoFocus returnKeyType="go" onSubmitEditing={() => !busy && /^\d{6}$/.test(code.trim()) && validerCode()} />
        {msg ? <Message texte={msg} genre="erreur" /> : null}
        <Btn label={busy ? 'Vérification…' : 'Activer mon compte'} onPress={validerCode} disabled={busy || !/^\d{6}$/.test(code.trim())} />
        <Btn kind="sec" label="Renvoyer le code" onPress={renvoyerCode} disabled={busy} />
        {options.email && !parTel ? <Lien label="Recevoir plutôt un lien par email" onPress={lienParEmail} /> : null}
        <Lien label="Retour à la connexion" onPress={() => changer('connexion')} />
      </Carte>
    );
  else if (mode === 'oubli')
    panneau = (
      <Carte>
        {choixType}
        {parTel ? (
          <ChampTelephone tel={tel} accessibilityLabel="Téléphone" pourRetrouver autoFocus returnKeyType="send" onSubmitEditing={() => !busy && numeroPret && oubli()} />
        ) : (
          <Input
            accessibilityLabel="Email"
            placeholder="toi@exemple.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            autoFocus
            returnKeyType="send"
            onSubmitEditing={() => !busy && emailPret && oubli()}
            erreur={erreurEmail}
          />
        )}
        {msg ? <Message texte={msg} genre="erreur" /> : null}
        <Btn label={busy ? 'Envoi…' : 'Envoyer le lien'} onPress={oubli} disabled={busy || !(parTel ? numeroPret : emailPret)} />
        <Lien label="Retour à la connexion" onPress={() => changer('connexion')} />
      </Carte>
    );
  else if (mode === 'reinitialiser')
    panneau = (
      <Carte>
        <T small muted>
          Choisis un nouveau mot de passe. Tes autres appareils seront déconnectés.
        </T>
        <ChampMotDePasse
          label="Nouveau mot de passe"
          placeholder="8 caractères minimum"
          value={mdp}
          onChangeText={setMdp}
          autoComplete="new-password"
          autoFocus
          returnKeyType="go"
          onSubmitEditing={() => !busy && !refusMotDePasse(mdp) && reinitialiser()}
        />
        <Force mdp={mdp} />
        {msg ? <Message texte={msg} genre="erreur" /> : null}
        <Btn label={busy ? 'Enregistrement…' : 'Enregistrer et me connecter'} onPress={reinitialiser} disabled={busy || !!refusMotDePasse(mdp)} />
        <Lien label="Retour à la connexion" onPress={() => changer('connexion')} />
      </Carte>
    );
  else
    panneau = (
      <Carte>
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
        {mode === 'inscription' ? <Input accessibilityLabel="Prénom" placeholder="Prénom" value={nom} onChangeText={setNom} autoComplete="given-name" returnKeyType="next" /> : null}
        {mode === 'connexion' || options.sms ? choixType : null}
        {parTel ? (
          <ChampTelephone tel={tel} accessibilityLabel="Téléphone" pourRetrouver={mode === 'connexion'} autoFocus={mode === 'connexion'} returnKeyType="next" />
        ) : (
          <Input
            label={mode === 'connexion' || options.sms ? undefined : 'Email'}
            accessibilityLabel="Email"
            placeholder="toi@exemple.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            autoFocus={mode === 'connexion'}
            returnKeyType="next"
            erreur={erreurEmail}
          />
        )}
        <ChampMotDePasse
          accessibilityLabel="Mot de passe"
          placeholder="Mot de passe"
          value={mdp}
          onChangeText={setMdp}
          autoComplete={mode === 'inscription' ? 'new-password' : 'password'}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (prete && !busy) go();
          }}
        />
        {mode === 'inscription' ? <Force mdp={mdp} compte={compteSaisi} /> : null}
        {msg ? <Message texte={msg} genre="erreur" /> : null}
        <Btn label={busy ? (mode === 'connexion' ? 'Connexion…' : 'Création…') : mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'} onPress={go} disabled={busy || !prete} />
        {mode === 'connexion' && (options.email || options.oubli) ? <Lien label="Mot de passe oublié ?" onPress={() => changer('oubli')} /> : null}
        {mode === 'inscription' ? (
          <T small muted style={{ textAlign: 'center' }}>
            En créant un compte, tu acceptes les conditions d'utilisation et la politique de confidentialité, en bas de cette page.
          </T>
        ) : null}
      </Carte>
    );

  const formulaire = (
    <Screen>
      <View style={{ width: Math.min(largeur * (10 / 12), LARGEUR_FORMULAIRE), alignSelf: 'center', gap: 20, paddingTop: bureau ? Math.max(16, (hauteur - 820) / 2) : 4 }}>
        {retour || contact ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {retour ? <LienHaut label="‹ Accueil" accessibilityLabel="Retour à la page d'accueil" onPress={retour} /> : <View />}
            {contact ? <LienHaut label="Contact" onPress={contact} /> : null}
          </View>
        ) : null}
        <View style={{ gap: 6 }}>
          {bureau ? null : (
            <View style={{ marginBottom: 10, alignSelf: 'flex-start', borderRadius: 16, ...ombreAvant(teinte(vive('indigo')).c) }}>
              <Logo taille={52} />
            </View>
          )}
          <Text accessibilityRole="header" style={{ color: C.ink, fontSize: 28, lineHeight: 33, fontFamily: F.titre, letterSpacing: -0.6 }}>{titrePage}</Text>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 15, lineHeight: 21 }}>{sousTitrePage}</Text>
        </View>
        {panneau}
        <LiensLegaux centre />
      </View>
    </Screen>
  );
  if (!bureau) return formulaire;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
      <PanneauMarque />
      <View style={{ width: Math.min(620, largeur * 0.5) }}>{formulaire}</View>
    </View>
  );
}
