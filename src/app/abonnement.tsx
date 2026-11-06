import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/texte';

import { urlLegale } from '@/components/liens-legaux';
import { SousOnglets } from '@/components/onglets';
import { ChampTelephone, useTelephone } from '@/components/telephone';
import { Btn, Check, Grille, Header, Panel, Screen, Seg, Sep, T, Tag } from '@/components/ui';
import { fmtPrix, INCLUS_FINANCES, INCLUS_GRATUIT, INCLUS_PRO, INCLUS_REUNIONS, joursConvertis, nomOffre, parMois, prixOffre, resteReunions, resumeAbonnement, type CompteurReunions, type EtatAbonnement, type Formule, type Offres, type Paiement, type Palier, type Periode } from '@/lib/abonnement';
import { api, ApiError } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C, F, ombreAvant } from '@/lib/theme';
import { teinte, vive, type Vive } from '@/lib/teinte';

const LIBELLE_OFFRE: Record<EtatAbonnement['offre'], string> = { gratuit: 'Gratuit', essai: 'Essai', finances: 'Finances', pro: 'Pro', libre: 'Tout inclus' };
/** L'offre du compte, avec son palier : « Pro 2 ». */
const libelleEtat = (e: EtatAbonnement) => (e.offre === 'pro' ? nomOffre('pro', e.palier) : LIBELLE_OFFRE[e.offre]);
const STATUT: Record<Paiement['statut'], { label: string; couleur: string }> = {
  en_attente: { label: 'En attente', couleur: C.hebdo },
  paye: { label: 'Payé', couleur: C.coach },
  echoue: { label: 'Échoué', couleur: C.agressif },
  expire: { label: 'Expiré', couleur: C.muted },
  abandonne: { label: 'Abandonné', couleur: C.muted },
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
const HEURES = { 1: 3, 2: 10, 3: 25 } as const;

/** Une formule de l'écran des offres : prix de la période choisie, ce qu'elle comprend, et son bouton. */
function Carte({ offre, prix, periode, devise, actuelle, action, onChoisir, palier = 0, onPalier, heures }: {
  offre: NomOffre;
  /** En centimes ; null : formule pas encore proposée par ce serveur. */
  prix: number | null;
  periode: Periode;
  devise: string;
  actuelle: boolean;
  action: string | null;
  onChoisir?: () => void;
  /** Pro : le palier de réunions choisi sur la carte. */
  palier?: Palier;
  onPalier?: (p: Palier) => void;
  heures?: Record<1 | 2 | 3, number>;
}) {
  const c = CARTES[offre];
  const t = teinte(vive(c.couleur));
  const payant = offre !== 'gratuit';
  const vedette = offre === 'pro';
  const note = !payant ? 'Pour toujours.' : prix === null ? 'Bientôt sur ce serveur.' : periode === 'annuel' ? `Soit ${fmtPrix(parMois(prix), devise)} par mois.` : 'Sans engagement.';
  return (
    <View style={{ flexGrow: 1, gap: 14, padding: 20, borderRadius: 20, backgroundColor: vedette ? t.douce : C.surface, borderWidth: vedette ? 2 : 1, borderColor: vedette ? t.c : C.line, ...(vedette ? ombreAvant(t.c) : null) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text accessibilityRole="header" style={{ color: C.ink, fontFamily: F.titreM, fontSize: 18 }}>
          {palier ? `Pro ${palier}` : c.nom}
        </Text>
        <View style={{ marginLeft: 'auto' }}>{actuelle ? <Tag label="Ton offre" color={t.c} /> : null}</View>
      </View>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 34, letterSpacing: -0.5 }}>{payant ? (prix === null ? '—' : fmtPrix(prix, devise)) : fmtPrix(0, devise)}</Text>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>{payant ? (periode === 'annuel' ? 'par an' : 'par mois') : ''}</Text>
        </View>
        <T small muted>
          {note}
        </T>
      </View>
      {vedette && onPalier && heures ? (
        <View style={{ gap: 6 }}>
          <T small muted>
            Réunions enregistrées par mois
          </T>
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
      <View style={{ gap: 7, flexGrow: 1 }}>
        {c.avant ? (
          <T small muted>
            {c.avant}
          </T>
        ) : null}
        {[...c.lignes, ...(palier ? INCLUS_REUNIONS : [])].map((l) => (
          <View key={l} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ color: t.c, fontFamily: F.texteF, fontSize: 14 }}>✓</Text>
            <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14, lineHeight: 20 }}>{l}</Text>
          </View>
        ))}
      </View>
      {action && onChoisir ? <Btn label={action} kind={vedette ? 'primary' : 'sec'} couleur={t.c} onPress={onChoisir} /> : null}
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
      <Header retour eyebrow={e ? libelleEtat(e) : 'Mon compte'} title="Abonnement" />

      <Panel title="Ton offre" accent>
        {e ? <Tag label={libelleEtat(e)} color={e.offre === 'gratuit' ? C.muted : C.accent} /> : null}
        <T>{resumeAbonnement(e)}</T>
        {resteReunions(compteur, e?.offre === 'essai') ? <T small style={{ color: C.coach }}>{resteReunions(compteur, e?.offre === 'essai')}</T> : null}
        {msg ? <T small style={{ color: C.coach }}>{msg}</T> : null}
      </Panel>

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
              <Seg
                label="Payer pour"
                options={[
                  { key: 'mensuel', label: '1 mois' },
                  { key: 'annuel', label: '1 an · 1 mois offert' },
                ]}
                value={periode}
                onChange={setPeriode}
              />
              {etroit ? <View style={{ gap: 12 }}>{cartes}</View> : <Grille min={260}>{cartes}</Grille>}
              <T small muted>
                Pro 1, 2 et 3 : les heures ne se reportent pas d’un mois à l’autre.
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
            <Panel title={`${memeChoix(choixActuel, choix) ? 'Prolonger' : 'Passer à'} ${NOM_CHOIX(choix)} · ${periode === 'annuel' ? '1 an' : '1 mois'}`} accent right={<Btn small kind="sec" label="Changer d’offre" onPress={() => setChoix(null)} />}>
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
      ) : null}

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
                <Tag label={STATUT[p.statut].label} color={STATUT[p.statut].couleur} />
              </View>
            </View>
          ))}
        </Panel>
      ) : null}

      <T small muted>
        Une question ou une rétractation ? Donne la référence du paiement : voir les <LienLegal page="cgv">conditions générales de vente</LienLegal>.
      </T>
    </Screen>
  );
}
