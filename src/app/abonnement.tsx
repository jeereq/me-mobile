import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { urlLegale } from '@/components/liens-legaux';
import { Btn, Check, Grille, Header, Input, Panel, Screen, Seg, Sep, T, Tag } from '@/components/ui';
import { fmtPrix, INCLUS_FINANCES, INCLUS_GRATUIT, INCLUS_PRO, joursConvertis, NOM_FORMULE, parMois, resumeAbonnement, tarif, type EtatAbonnement, type Formule, type Offres, type Paiement, type Periode } from '@/lib/abonnement';
import { api, ApiError } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';
import { teinte, vive, type Vive } from '@/lib/teinte';

const LIBELLE_OFFRE: Record<EtatAbonnement['offre'], string> = { gratuit: 'Gratuit', essai: 'Essai', finances: 'Finances', pro: 'Pro', libre: 'Tout inclus' };
const STATUT: Record<Paiement['statut'], { label: string; couleur: string }> = {
  en_attente: { label: 'En attente', couleur: C.hebdo },
  paye: { label: 'Payé', couleur: C.coach },
  echoue: { label: 'Échoué', couleur: C.agressif },
  expire: { label: 'Expiré', couleur: C.muted },
  abandonne: { label: 'Abandonné', couleur: C.muted },
};

type Reponse = { paiement: Paiement; paiements: Paiement[] };

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

type NomOffre = 'gratuit' | Formule;
const CARTES: Record<NomOffre, { nom: string; couleur: Vive; avant: string | null; lignes: readonly string[] }> = {
  gratuit: { nom: 'Gratuit', couleur: 'menthe', avant: null, lignes: INCLUS_GRATUIT },
  finances: { nom: 'Finances', couleur: 'indigo', avant: 'Tout Gratuit, plus :', lignes: INCLUS_FINANCES },
  pro: { nom: 'Pro', couleur: 'lilas', avant: 'Tout Finances, plus :', lignes: INCLUS_PRO },
};

/** Une formule de l'écran des offres : prix de la période choisie, ce qu'elle comprend, et son bouton. */
function Carte({ offre, prix, periode, devise, actuelle, choisie, largeur, action, onChoisir }: {
  offre: NomOffre;
  /** En centimes ; null : formule pas encore proposée par ce serveur. */
  prix: number | null;
  periode: Periode;
  devise: string;
  actuelle: boolean;
  choisie: boolean;
  /** Largeur fixe (cartes qui défilent sur téléphone). */
  largeur?: number;
  action: string | null;
  onChoisir?: () => void;
}) {
  const c = CARTES[offre];
  const t = teinte(vive(c.couleur));
  const payant = offre !== 'gratuit';
  const vedette = offre === 'pro';
  const note = !payant ? 'Pour toujours.' : prix === null ? 'Bientôt sur ce serveur.' : periode === 'annuel' ? `Soit ${fmtPrix(parMois(prix), devise)} par mois.` : 'Payé pour un mois, sans engagement.';
  return (
    <View
      style={{
        width: largeur,
        flexGrow: largeur ? 0 : 1,
        gap: 12,
        padding: 18,
        borderRadius: 20,
        backgroundColor: payant ? t.douce : C.surface,
        borderWidth: choisie ? 2.5 : vedette ? 2 : 1,
        borderColor: choisie || payant ? t.c : C.line,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.c }} />
        <Text accessibilityRole="header" style={{ color: C.ink, fontFamily: F.titreM, fontSize: 18 }}>
          {c.nom}
        </Text>
        <View style={{ marginLeft: 'auto' }}>
          {actuelle ? <Tag label="Ton offre" color={t.c} /> : vedette ? <Tag label="Le plus complet" color={t.c} /> : null}
        </View>
      </View>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 32, letterSpacing: -0.5 }}>{payant ? (prix === null ? '—' : fmtPrix(prix, devise)) : fmtPrix(0, devise)}</Text>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>{payant ? (periode === 'annuel' ? 'par an' : 'par mois') : ''}</Text>
        </View>
        <T small muted>
          {note}
        </T>
      </View>
      <View style={{ gap: 6, flexGrow: 1 }}>
        {c.avant ? (
          <T small muted>
            {c.avant}
          </T>
        ) : null}
        {c.lignes.map((l) => (
          <View key={l} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={{ color: t.c, fontFamily: F.texteF, fontSize: 14 }}>✓</Text>
            <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14, lineHeight: 20 }}>{l}</Text>
          </View>
        ))}
      </View>
      {action && onChoisir ? <Btn label={action} kind={vedette || choisie ? 'primary' : 'sec'} couleur={vedette || choisie ? t.c : undefined} onPress={onChoisir} /> : null}
    </View>
  );
}

export default function Abonnement() {
  const { mode, abonnement, rafraichirCompte, session } = useStore();
  const [offres, setOffres] = useState<Offres | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [periode, setPeriode] = useState<Periode>('annuel');
  /** Formule choisie pour payer : le formulaire de paiement s'ouvre sous les cartes. */
  const [choix, setChoix] = useState<Formule | null>(null);
  const etroit = useWindowDimensions().width < 760;
  const [telephone, setTelephone] = useState('');
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
    Promise.all([api<Offres>('/abonnement/offres', { discret: true }), api<{ paiements: Paiement[] }>('/abonnement', { token, discret: true })])
      .then(([o, r]) => {
        if (fini) return;
        setOffres(o);
        setPaiements(r.paiements);
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
        setMsg(`Paiement reçu, merci ! ${NOM_FORMULE[r.paiement.formule ?? 'pro']} est ouvert.`);
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
      const r = await api<{ paiement: Paiement }>('/abonnement/paiement', { method: 'POST', token, body: { formule: choix ?? 'pro', periode, telephone, accepteCgv: cgv, accesImmediat: immediat } });
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
            En mode local, tes données restent sur ce téléphone et tout est inclus. Les abonnements concernent les comptes Me en ligne.
          </T>
        </Panel>
      </Screen>
    );

  const e = abonnement;
  const formuleActuelle: NomOffre | null = !e ? null : e.offre === 'finances' || e.offre === 'pro' ? e.offre : e.offre === 'gratuit' ? 'gratuit' : null;
  const prixChoisi = choix ? tarif(offres, choix, periode) : null;
  const conversion = choix ? joursConvertis(e, offres, choix) : null;
  const actionDe = (o: NomOffre): string | null => {
    if (o === 'gratuit' || !offres?.paiement) return null;
    if (tarif(offres, o, periode) === null) return null;
    if (formuleActuelle === o) return `Prolonger ${NOM_FORMULE[o]}`;
    return `Choisir ${NOM_FORMULE[o]}`;
  };
  const choisir = (f: Formule) => {
    setChoix(f);
    setErreur('');
    setMsg('');
  };
  const cartes = (['gratuit', 'finances', 'pro'] as const).map((o) => (
    <Carte
      key={o}
      offre={o}
      prix={o === 'gratuit' ? 0 : tarif(offres, o, periode)}
      periode={periode}
      devise={offres?.devise ?? 'USD'}
      actuelle={formuleActuelle === o}
      choisie={choix === o}
      largeur={etroit ? 272 : undefined}
      action={actionDe(o)}
      onChoisir={o === 'gratuit' ? undefined : () => choisir(o)}
    />
  ));
  return (
    <Screen>
      <Header retour eyebrow={e ? LIBELLE_OFFRE[e.offre] : 'Mon compte'} title="Abonnement" />

      <Panel title="Ton offre" accent>
        {e ? <Tag label={LIBELLE_OFFRE[e.offre]} color={e.offre === 'gratuit' ? C.muted : C.accent} /> : null}
        <T>{resumeAbonnement(e)}</T>
        {msg ? <T small style={{ color: C.coach }}>{msg}</T> : null}
      </Panel>

      {offres && !offres.actif ? (
        <Panel>
          <T small muted>
            Les abonnements ne sont pas activés sur ce serveur : toutes les fonctions sont incluses.
          </T>
        </Panel>
      ) : offres ? (
        <>
          <View style={{ gap: 6 }}>
            <Seg
              label="Payer pour"
              options={[
                { key: 'mensuel', label: '1 mois' },
                { key: 'annuel', label: '1 an · 2 mois offerts' },
              ]}
              value={periode}
              onChange={setPeriode}
            />
            <T small muted>
              Chaque nouveau compte commence par {offres.essaiJours} jours d’essai de tout Pro, sans paiement.
            </T>
          </View>

          {etroit ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={284} decelerationRate="fast" contentContainerStyle={{ gap: 12, paddingRight: 16 }} style={{ marginHorizontal: -4 }}>
              {cartes}
            </ScrollView>
          ) : (
            <Grille min={240}>{cartes}</Grille>
          )}

          {!offres.paiement ? (
            <Panel>
              <T small muted>
                Le paiement n’est pas encore ouvert sur ce serveur. Réessaie un peu plus tard.
              </T>
            </Panel>
          ) : enCours ? (
            <Panel title="Paiement en cours" accent>
              <T>Valide le paiement de {fmtPrix(enCours.montant, enCours.devise)} sur ton téléphone.</T>
              <T small muted>
                {pause
                  ? 'Toujours en attente. Si tu as validé sur ton téléphone, ta formule s’ouvrira dès que FlexPaie confirme le paiement. Si la demande n’est jamais arrivée, abandonne-la pour en faire une autre.'
                  : 'Une demande de ton opérateur mobile money vient d’arriver : confirme-la avec ton code. Cette page se met à jour toute seule.'}
              </T>
              {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Btn label="Vérifier" onPress={verifier} disabled={busy} />
                <Btn label="Abandonner cette demande" kind="sec" onPress={abandonner} disabled={busy} />
              </View>
            </Panel>
          ) : choix && prixChoisi !== null ? (
            <Panel title={`${formuleActuelle === choix ? 'Prolonger' : 'Passer à'} ${NOM_FORMULE[choix]} · ${periode === 'annuel' ? '1 an' : '1 mois'}`} accent right={<Btn small kind="sec" label="Fermer" onPress={() => setChoix(null)} />}>
              <T small muted>
                Paiement unique par mobile money (M-Pesa, Orange Money, Airtel Money) avec FlexPaie. Pas de renouvellement automatique : Me te prévient avant la fin
                {formuleActuelle === choix ? ', et la nouvelle période s’ajoute à celle en cours.' : '.'}
              </T>
              {conversion ? (
                <T small style={{ color: C.coach }}>
                  Il te reste {conversion.joursAvant} jours de {NOM_FORMULE[conversion.de]} : ils deviennent {conversion.jours} jours de {NOM_FORMULE[choix]}, puis {periode === 'annuel' ? 'l’année payée' : 'le mois payé'} s’y ajoute.
                </T>
              ) : null}
              {e?.offre === 'essai' ? (
                <T small muted>
                  Ton essai continue : la période payée commencera à sa fin.
                </T>
              ) : null}
              <Input label="Numéro mobile money" placeholder="243 81 234 5678" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" autoComplete="tel" />
              <Case on={cgv} onToggle={() => setCgv((v) => !v)} label="J’accepte les conditions générales de vente">
                <>
                  J’accepte les <LienLegal page="cgv">conditions générales de vente</LienLegal> et les <LienLegal page="conditions">conditions d’utilisation</LienLegal>.
                </>
              </Case>
              <Case on={immediat} onToggle={() => setImmediat((v) => !v)} label={`Je demande l’accès immédiat à ${NOM_FORMULE[choix]}`}>
                Je demande l’accès à {NOM_FORMULE[choix]} dès le paiement, avant la fin du délai de rétractation de 14 jours. Si je me rétracte, seule la part déjà utilisée reste due.
              </Case>
              {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
              <View style={{ flexDirection: 'row' }}>
                <Btn label={`Payer ${fmtPrix(prixChoisi, offres.devise)}`} onPress={payer} disabled={busy || !cgv || !immediat || telephone.replace(/\D/g, '').length < 9} />
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
                    {NOM_FORMULE[p.formule ?? 'pro']} {p.periode === 'annuel' ? '1 an' : '1 mois'} · {fmtPrix(p.montant, p.devise)}
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
        Une question sur un paiement, ou une demande de rétractation ? Écris-nous en donnant la référence du paiement : voir les <LienLegal page="cgv">conditions générales de vente</LienLegal>.
      </T>
    </Screen>
  );
}
