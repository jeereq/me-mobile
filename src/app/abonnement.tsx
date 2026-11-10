import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/texte';

import { urlLegale } from '@/components/liens-legaux';
import { SousOnglets } from '@/components/onglets';
import { Bloc, Texte, ZoneSquelette } from '@/components/squelettes';
import { ChampTelephone, useTelephone } from '@/components/telephone';
import { Icone } from '@/components/icones';
import { Btn, Check, Grille, Header, Panel, Screen, Sep, T, Tag, tap } from '@/components/ui';
import { fmtPrix, INCLUS_FINANCES, INCLUS_GRATUIT, INCLUS_PRO, INCLUS_REUNIONS, joursConvertis, nomOffre, parMois, prixOffre, resteReunions, resumeAbonnement, type CompteurReunions, type EtatAbonnement, type Formule, type Offres, type Paiement, type Palier, type Periode } from '@/lib/abonnement';
import { api, ApiError } from '@/lib/api';
import { useStore } from '@/lib/store';
import { alpha, C, encre, F, ombreAvant } from '@/lib/theme';
import { teinte, vive, type Vive } from '@/lib/teinte';

const LIBELLE_OFFRE: Record<EtatAbonnement['offre'], string> = { gratuit: 'Gratuit', essai: 'Essai', finances: 'Finances', pro: 'Pro', libre: 'Tout inclus' };
/** L'offre du compte, avec son palier : « Pro 2 ». */
const libelleEtat = (e: EtatAbonnement) => (e.offre === 'pro' ? nomOffre('pro', e.palier) : LIBELLE_OFFRE[e.offre]);
// Les couleurs sont lues à l'affichage : elles suivent le thème choisi après le chargement.
const STATUT: Record<Paiement['statut'], { label: string; couleur: () => string }> = {
  en_attente: { label: 'En attente', couleur: () => C.hebdo },
  paye: { label: 'Payé', couleur: () => C.coach },
  echoue: { label: 'Échoué', couleur: () => C.agressif },
  expire: { label: 'Expiré', couleur: () => C.muted },
  abandonne: { label: 'Abandonné', couleur: () => C.muted },
};

type Reponse = { paiement: Paiement; paiements: Paiement[] };
/** Une offre à payer : une formule et, pour Pro, son palier de réunions. */
type Choix = { formule: Formule; palier: Palier };

/** Lien vers une page légale, ouvert dans le navigateur. */
function LienLegal({ page, children }: { page: string; children: string }) {
  const url = urlLegale(page);
  if (!url) return <Text style={{ color: C.ink }}>{children}</Text>;
  return (
    <Text accessibilityRole="link" onPress={() => Linking.openURL(url)} style={{ color: C.accent, textDecorationLine: 'underline' }}>
      {children}
    </Text>
  );
}

function Case({ on, onToggle, label, children }: { on: boolean; onToggle: () => void; label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 }}>
      <Check checked={on} onToggle={onToggle} label={label} />
      <Text onPress={onToggle} style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 13, lineHeight: 19 }}>
        {children}
      </Text>
    </View>
  );
}

type NomOffre = 'gratuit' | 'finances' | 'pro';
const CARTES: Record<NomOffre, { nom: string; couleur: Vive; avant: string | null; lignes: readonly string[] }> = {
  gratuit: { nom: 'Gratuit', couleur: 'menthe', avant: null, lignes: INCLUS_GRATUIT },
  finances: { nom: 'Finances', couleur: 'indigo', avant: 'Tout Gratuit, plus :', lignes: INCLUS_FINANCES },
  pro: { nom: 'Pro', couleur: 'lilas', avant: 'Tout Finances, plus :', lignes: INCLUS_PRO },
};
const NOM_CHOIX = (c: Choix) => nomOffre(c.formule, c.palier);
const memeChoix = (a: Choix | null, b: Choix | null) => !!a && !!b && a.formule === b.formule && a.palier === b.palier;
/** Les heures de réunion par mois d'un palier. */
const HEURES = { 1: 5, 2: 20, 3: 40 } as const;

/** Une formule pendant le chargement des offres : nom, prix, ce qu'elle comprend, bouton. */
function CarteSquelette() {
  return (
    <Panel>
      <Bloc l="40%" h={16} />
      <Bloc l="55%" h={28} r={8} />
      <Texte lignes={4} />
      <Bloc l="100%" h={44} r={14} />
    </Panel>
  );
}

/** Mensuel ou annuel : deux grandes cases, l'année avec son mois offert. */
function ChoixPeriode({ value, onChange, large }: { value: Periode; onChange: (p: Periode) => void; large: boolean }) {
  const opts: { key: Periode; label: string; note?: string }[] = [
    { key: 'mensuel', label: 'Mensuel' },
    { key: 'annuel', label: 'Annuel', note: '1 mois offert' },
  ];
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Payer pour" style={{ flexDirection: 'row', alignSelf: large ? 'center' : 'stretch', padding: 4, gap: 4, borderRadius: 16, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
      {opts.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              onChange(o.key);
            }}
            style={({ pressed }) => [{ flexGrow: 1, flexBasis: large ? 'auto' : 0, minWidth: large ? 150 : 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: on ? C.surface : 'transparent', borderWidth: 1, borderColor: on ? C.line : 'transparent' }, pressed && { opacity: 0.8 }]}>
            <Text style={{ color: on ? C.ink : C.muted, fontFamily: on ? F.texteF : F.texteM, fontSize: 14 }}>{o.label}</Text>
            {o.note ? (
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: alpha(C.coach, C.sombre ? 0.16 : 0.12) }}>
                <Text style={{ color: C.coach, fontFamily: F.texteF, fontSize: 11 }}>{o.note}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Une formule de l'écran des offres : prix de la période choisie, ce qu'elle comprend, et son bouton. */
function Carte({ offre, prix, prixMois, periode, devise, actuelle, action, onChoisir, palier = 0, onPalier, heures, compacte, ligne }: {
  offre: NomOffre;
  /** En centimes ; null : formule pas encore proposée par ce serveur. */
  prix: number | null;
  /** Le prix au mois de la même offre : montre ce que l'année fait gagner. */
  prixMois?: number | null;
  periode: Periode;
  devise: string;
  actuelle: boolean;
  action: string | null;
  onChoisir?: () => void;
  /** Pro : le palier de réunions choisi sur la carte. */
  palier?: Palier;
  onPalier?: (p: Palier) => void;
  heures?: Record<1 | 2 | 3, number>;
  /** Sur téléphone, l'offre gratuite tient en quelques lignes. */
  compacte?: boolean;
  /** Côte à côte avec les autres : même largeur pour toutes. */
  ligne?: boolean;
}) {
  const c = CARTES[offre];
  const t = teinte(vive(c.couleur));
  const payant = offre !== 'gratuit';
  const vedette = offre === 'pro';
  const parMoisAn = payant && prix !== null && periode === 'annuel' ? parMois(prix) : null;
  const note = !payant
    ? 'Pour toujours.'
    : prix === null
      ? 'Bientôt sur ce serveur.'
      : parMoisAn !== null
        ? `Soit ${fmtPrix(parMoisAn, devise)} par mois${prixMois ? `, au lieu de ${fmtPrix(prixMois, devise)}` : ''}.`
        : 'Sans engagement.';
  const lignes = [...c.lignes, ...(palier ? INCLUS_REUNIONS : [])];
  return (
    <View style={{ flexGrow: 1, ...(ligne ? { flexBasis: 0 } : null), gap: 16, padding: compacte ? 18 : 22, borderRadius: 22, backgroundColor: vedette ? (C.sombre ? alpha(t.c, 0.08) : C.surface) : C.surface, borderWidth: vedette ? 1.5 : 1, borderColor: vedette ? t.ligne : C.line, ...(vedette ? ombreAvant(t.c) : null) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.c }} />
        <Text accessibilityRole="header" style={{ color: C.ink, fontFamily: F.titreM, fontSize: 18 }}>
          {palier ? `Pro ${palier}` : c.nom}
        </Text>
        <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 6 }}>
          {actuelle ? <Tag label="Ton offre" color={t.c} /> : vedette ? <Pastille couleur={t.c} label="Conseillé" /> : null}
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: compacte ? 30 : 40, letterSpacing: -1 }}>{payant ? (prix === null ? '—' : fmtPrix(prix, devise)) : fmtPrix(0, devise)}</Text>
          {payant ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>{periode === 'annuel' ? 'par an' : 'par mois'}</Text> : null}
        </View>
        <Text style={{ color: parMoisAn !== null && prixMois ? C.coach : C.muted, fontFamily: F.texteM, fontSize: 13 }}>{note}</Text>
      </View>
      {vedette && onPalier && heures ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 13 }}>Réunions enregistrées par mois</Text>
          <SousOnglets
            label="Réunions enregistrées par mois"
            options={[
              { key: '0', label: 'Sans' },
              { key: '1', label: `${heures[1]} h` },
              { key: '2', label: `${heures[2]} h` },
              { key: '3', label: `${heures[3]} h` },
            ]}
            value={String(palier) as '0' | '1' | '2' | '3'}
            onChange={(k) => onPalier(Number(k) as Palier)}
          />
        </View>
      ) : null}
      <View style={{ height: 1, backgroundColor: C.line }} />
      {compacte ? (
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14, lineHeight: 21 }}>{lignes.map((l, i) => (i ? l.charAt(0).toLowerCase() + l.slice(1) : l)).join(', ')}.</Text>
      ) : (
        <View style={{ gap: 9, flexGrow: 1 }}>
          {c.avant ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>{c.avant}</Text> : null}
          {lignes.map((l) => (
            <View key={l} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 18, height: 18, marginTop: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: t.douce }}>
                <Text style={{ color: t.c, fontFamily: F.texteF, fontSize: 11 }}>✓</Text>
              </View>
              <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14, lineHeight: 20 }}>{l}</Text>
            </View>
          ))}
        </View>
      )}
      {action && onChoisir ? <Btn label={action} kind={vedette ? 'primary' : 'sec'} couleur={t.c} onPress={onChoisir} /> : null}
    </View>
  );
}

const Pastille = ({ couleur, label }: { couleur: string; label: string }) => (
  <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: couleur }}>
    <Text style={{ color: encre(couleur), fontFamily: F.texteF, fontSize: 11 }}>{label}</Text>
  </View>
);

/** L'offre du compte en tête de page : son nom, jusqu'à quand, et les heures de réunion qui restent. */
function MonOffre({ e, reunions, msg }: { e: EtatAbonnement | null | undefined; reunions: string | null; msg: string }) {
  const gratuit = !e || e.offre === 'gratuit';
  const c = vive(e?.offre === 'pro' || e?.offre === 'essai' ? 'lilas' : e?.offre === 'finances' ? 'indigo' : 'menthe');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(c, C.sombre ? 0.16 : 0.12) }}>
        <Icone nom="trophee" color={c} size={20} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>Ton offre</Text>
        <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 18 }}>{e ? libelleEtat(e) : 'Gratuit'}</Text>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, lineHeight: 19 }}>{gratuit ? 'Passe à Finances ou Pro quand tu veux.' : resumeAbonnement(e)}</Text>
        {reunions ? <Text style={{ color: C.coach, fontFamily: F.texteM, fontSize: 13 }}>{reunions}</Text> : null}
        {msg ? <Text style={{ color: C.coach, fontFamily: F.texteM, fontSize: 13 }}>{msg}</Text> : null}
      </View>
    </View>
  );
}

export default function Abonnement() {
  const { mode, abonnement, rafraichirCompte, session } = useStore();
  const [offres, setOffres] = useState<Offres | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [periode, setPeriode] = useState<Periode>('annuel');
  /** Formule choisie pour payer : le formulaire de paiement s'ouvre sous les cartes. */
  const [choix, setChoix] = useState<Choix | null>(null);
  const [compteur, setCompteur] = useState<CompteurReunions | null>(null);
  /** Le palier de réunions montré sur la carte Pro ; null : celui du compte. */
  const [palierVu, setPalierVu] = useState<Palier | null>(null);
  const etroit = useWindowDimensions().width < 760;
  const tel = useTelephone();
  const [cgv, setCgv] = useState(false);
  const [immediat, setImmediat] = useState(false);
  const [enCours, setEnCours] = useState<Paiement | null>(null);
  /** Plus de vérification automatique (5 minutes passées) : la demande reste affichée, avec Vérifier et Abandonner. */
  const [pause, setPause] = useState(false);
  const [msg, setMsg] = useState('');
  const [erreur, setErreur] = useState('');
  const [busy, setBusy] = useState(false);
  const token = session?.token;

  useEffect(() => {
    if (mode !== 'cloud') return;
    let fini = false;
    Promise.all([api<Offres>('/abonnement/offres', { discret: true }), api<{ paiements: Paiement[]; reunions?: CompteurReunions | null }>('/abonnement', { token, discret: true })])
      .then(([o, r]) => {
        if (fini) return;
        setOffres(o);
        setPaiements(r.paiements);
        setCompteur(r.reunions ?? null);
        // Une demande encore en attente (app fermée pendant la validation) : on la reprend.
        const attente = r.paiements.find((p) => p.statut === 'en_attente');
        if (attente) setEnCours(attente);
      })
      .catch((e: Error) => !fini && setErreur(e.message));
    return () => {
      fini = true;
    };
  }, [mode, token]);

  // Le client valide sur son téléphone : on demande où en est le paiement toutes les 4 secondes, 5 minutes au plus.
  /** Applique la réponse du serveur sur un paiement suivi. */
  const appliquer = useCallback(
    async (r: Reponse) => {
      setPaiements(r.paiements);
      if (r.paiement.statut === 'en_attente') return;
      setEnCours(null);
      setPause(false);
      if (r.paiement.statut === 'paye') {
        await rafraichirCompte();
        setMsg(`Paiement reçu, merci ! ${nomOffre(r.paiement.formule ?? 'pro', r.paiement.palier)} est ouvert.`);
        setChoix(null);
      } else if (r.paiement.statut === 'echoue') setErreur(r.paiement.message || 'Le paiement n’a pas abouti.');
    },
    [rafraichirCompte],
  );

  useEffect(() => {
    if (!enCours || enCours.statut !== 'en_attente' || pause) return;
    let essais = 0;
    const t = setInterval(async () => {
      essais += 1;
      try {
        await appliquer(await api<Reponse>(`/abonnement/paiements/${enCours.reference}`, { token, discret: true }));
      } catch {
        // Réseau coupé un instant : on réessaie au tour suivant.
      }
      if (essais >= 75) setPause(true);
    }, 4000);
    return () => clearInterval(t);
  }, [enCours, pause, token, appliquer]);

  const verifier = async () => {
    if (!enCours) return;
    setBusy(true);
    setErreur('');
    try {
      await appliquer(await api<Reponse>(`/abonnement/paiements/${enCours.reference}`, { token }));
    } catch (e) {
      setErreur((e as Error).message);
    }
    setBusy(false);
  };

  const abandonner = async () => {
    if (!enCours) return;
    setBusy(true);
    setErreur('');
    try {
      const r = await api<Reponse>(`/abonnement/paiements/${enCours.reference}/abandon`, { method: 'POST', token });
      await appliquer(r);
      if (r.paiement.statut === 'abandonne') setMsg('Demande abandonnée. Si elle est validée quand même, elle comptera.');
    } catch (e) {
      setErreur((e as Error).message);
    }
    setBusy(false);
  };

  const payer = async () => {
    setBusy(true);
    setErreur('');
    setMsg('');
    try {
      const r = await api<{ paiement: Paiement }>('/abonnement/paiement', { method: 'POST', token, body: { formule: choix?.formule ?? 'pro', palier: choix?.palier ?? 0, periode, telephone: tel.complet, accepteCgv: cgv, accesImmediat: immediat } });
      setPause(false);
      setEnCours(r.paiement);
    } catch (e) {
      setErreur((e as Error).message);
      // Une demande attend déjà (lancée depuis un autre appareil) : on l'affiche pour la valider ou l'abandonner.
      if (e instanceof ApiError && e.code === 'PAIEMENT_EN_COURS') {
        const r = await api<{ paiements: Paiement[] }>('/abonnement', { token, discret: true }).catch(() => null);
        const attente = r?.paiements.find((p) => p.statut === 'en_attente');
        if (r) setPaiements(r.paiements);
        if (attente) {
          setErreur('');
          setEnCours(attente);
        }
      }
    }
    setBusy(false);
  };

  if (mode !== 'cloud')
    return (
      <Screen>
        <Header retour eyebrow="Mode local" title="Abonnement" />
        <Panel>
          <T small muted>
            Mode local : tout est inclus.
          </T>
        </Panel>
      </Screen>
    );

  const e = abonnement;
  const palierActuel: Palier = e?.offre === 'pro' ? (e.palier ?? 0) : 0;
  const choixActuel: Choix | null = !e ? null : e.offre === 'finances' ? { formule: 'finances', palier: 0 } : e.offre === 'pro' ? { formule: 'pro', palier: palierActuel } : null;
  const prixChoisi = choix ? prixOffre(offres, choix.formule, choix.palier, periode) : null;
  const conversion = choix ? joursConvertis(e, offres, choix.formule, choix.palier) : null;
  const palierPro: Palier = palierVu ?? palierActuel;
  const choixDe = (o: NomOffre): Choix | null => (o === 'gratuit' ? null : o === 'finances' ? { formule: 'finances', palier: 0 } : { formule: 'pro', palier: palierPro });
  const actionDe = (o: NomOffre): string | null => {
    const c = choixDe(o);
    if (!c || !offres?.paiement) return null;
    if (prixOffre(offres, c.formule, c.palier, periode) === null) return null;
    if (memeChoix(choixActuel, c)) return `Prolonger ${NOM_CHOIX(c)}`;
    return `Choisir ${NOM_CHOIX(c)}`;
  };
  const choisir = (c: Choix) => {
    setChoix(c);
    setErreur('');
    setMsg('');
  };
  const heures = { 1: offres?.paliers?.[1]?.heures ?? HEURES[1], 2: offres?.paliers?.[2]?.heures ?? HEURES[2], 3: offres?.paliers?.[3]?.heures ?? HEURES[3] };
  // Sur téléphone, Pro d'abord ; sur ordinateur, du moins cher au plus complet.
  const cartes = (etroit ? (['pro', 'finances', 'gratuit'] as const) : (['gratuit', 'finances', 'pro'] as const)).map((o) => {
    const c = choixDe(o);
    return (
      <Carte
        key={o}
        offre={o}
        prix={!c ? 0 : prixOffre(offres, c.formule, c.palier, periode)}
        prixMois={c ? prixOffre(offres, c.formule, c.palier, 'mensuel') : null}
        compacte={etroit && o === 'gratuit'}
        ligne={!etroit}
        periode={periode}
        devise={offres?.devise ?? 'USD'}
        actuelle={o === 'gratuit' ? e?.offre === 'gratuit' : o === 'pro' ? e?.offre === 'pro' && palierPro === palierActuel : e?.offre === 'finances'}
        action={actionDe(o)}
        onChoisir={c ? () => choisir(c) : undefined}
        palier={o === 'pro' ? palierPro : 0}
        onPalier={o === 'pro' && offres?.paliers ? setPalierVu : undefined}
        heures={o === 'pro' ? heures : undefined}
      />
    );
  });
  return (
    <Screen>
      <Header retour eyebrow="Mon compte" title="Abonnement" />

      <MonOffre e={e} reunions={resteReunions(compteur, e?.offre === 'essai')} msg={msg} />

      {offres && !offres.actif ? (
        <Panel>
          <T small muted>
            Toutes les fonctions sont incluses.
          </T>
        </Panel>
      ) : offres ? (
        <>
          {/* Une chose à la fois : pendant le paiement, seul le formulaire reste à l'écran. */}
          {enCours || (choix && prixChoisi !== null) ? null : (
            <>
              <ChoixPeriode value={periode} onChange={setPeriode} large={!etroit} />
              {etroit ? <View style={{ gap: 14 }}>{cartes}</View> : <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 16 }}>{cartes}</View>}
              <T small muted style={{ textAlign: etroit ? 'left' : 'center' }}>
                Paiement unique par mobile money, sans renouvellement automatique. Les heures de réunion ne se reportent pas d’un mois à l’autre.
              </T>
            </>
          )}

          {!offres.paiement ? (
            <Panel>
              <T small muted>
                Paiement indisponible pour l’instant.
              </T>
            </Panel>
          ) : enCours ? (
            <Panel title="Paiement en cours" accent>
              <T>Valide le paiement de {fmtPrix(enCours.montant, enCours.devise)} sur ton téléphone.</T>
              <T small muted>
                {pause
                  ? 'Toujours en attente. Validé ? Ta formule s’ouvrira à la confirmation. Rien reçu ? Abandonne et recommence.'
                  : 'Confirme la demande reçue sur ton téléphone avec ton code.'}
              </T>
              {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Btn label="Vérifier" onPress={verifier} disabled={busy} />
                <Btn label="Abandonner cette demande" kind="sec" onPress={abandonner} disabled={busy} />
              </View>
            </Panel>
          ) : choix && prixChoisi !== null ? (
            <Panel title={`${memeChoix(choixActuel, choix) ? 'Prolonger' : 'Passer à'} ${NOM_CHOIX(choix)}`} accent right={<Btn small kind="sec" label="Changer d’offre" onPress={() => setChoix(null)} />}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 30, letterSpacing: -0.8 }}>{fmtPrix(prixChoisi, offres.devise)}</Text>
                <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>pour {periode === 'annuel' ? '1 an' : '1 mois'}</Text>
              </View>
              <T small muted>
                Paiement unique par mobile money (M-Pesa, Orange Money, Airtel Money) avec FlexPaie. Pas de renouvellement automatique : Me te prévient avant la fin
                {memeChoix(choixActuel, choix) ? ', et la nouvelle période s’ajoute à celle en cours.' : '.'}
              </T>
              {conversion ? (
                <T small style={{ color: C.coach }}>
                  Il te reste {conversion.joursAvant} jours de {conversion.de} : ils deviennent {conversion.jours} jours de {NOM_CHOIX(choix)}, puis {periode === 'annuel' ? 'l’année payée' : 'le mois payé'} s’y ajoute.
                </T>
              ) : null}
              {e?.offre === 'essai' ? (
                <T small muted>
                  Ton essai continue : la période payée commencera à sa fin.
                </T>
              ) : null}
              <ChampTelephone tel={tel} label="Numéro mobile money" />
              <Case on={cgv} onToggle={() => setCgv((v) => !v)} label="J’accepte les conditions générales de vente">
                <>
                  J’accepte les <LienLegal page="cgv">conditions générales de vente</LienLegal> et les <LienLegal page="conditions">conditions d’utilisation</LienLegal>.
                </>
              </Case>
              <Case on={immediat} onToggle={() => setImmediat((v) => !v)} label={`Je demande l’accès immédiat à ${NOM_CHOIX(choix)}`}>
                Je demande l’accès à {NOM_CHOIX(choix)} dès le paiement, avant la fin du délai de rétractation de 14 jours. Si je me rétracte, seule la part déjà utilisée reste due.
              </Case>
              {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
              <View style={{ flexDirection: 'row' }}>
                <Btn label={`Payer ${fmtPrix(prixChoisi, offres.devise)}`} onPress={payer} disabled={busy || !cgv || !immediat || !tel.valide} />
              </View>
            </Panel>
          ) : erreur ? (
            <Panel>
              <T small style={{ color: C.agressif }}>{erreur}</T>
            </Panel>
          ) : null}
        </>
      ) : erreur ? (
        <Panel>
          <T small style={{ color: C.agressif }}>{erreur}</T>
        </Panel>
      ) : (
        <ZoneSquelette label="Chargement des offres">
          <Bloc l="60%" h={34} r={999} />
          {etroit ? (
            <>
              <CarteSquelette />
              <CarteSquelette />
            </>
          ) : (
            <Grille min={260}>
              <CarteSquelette />
              <CarteSquelette />
              <CarteSquelette />
            </Grille>
          )}
        </ZoneSquelette>
      )}

      {paiements.length ? (
        <Panel title="Mes paiements" count={paiements.length}>
          {paiements.map((p, i) => (
            <View key={p.reference}>
              {i ? <Sep /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                <View style={{ flex: 1 }}>
                  <T>
                    {nomOffre(p.formule ?? 'pro', p.palier)} {p.periode === 'annuel' ? '1 an' : '1 mois'} · {fmtPrix(p.montant, p.devise)}
                  </T>
                  <T small muted>
                    {new Date(p.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} · réf. {p.reference}
                    {(p.statut === 'echoue' || p.statut === 'expire') && p.message ? ` · ${p.message}` : ''}
                  </T>
                </View>
                <Tag label={STATUT[p.statut].label} color={STATUT[p.statut].couleur()} />
              </View>
            </View>
          ))}
        </Panel>
      ) : null}

      <T small muted style={{ textAlign: etroit ? 'left' : 'center' }}>
        Une question ou une rétractation ? Donne la référence du paiement : voir les <LienLegal page="cgv">conditions générales de vente</LienLegal>.
      </T>
    </Screen>
  );
}
