import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { urlLegale } from '@/components/liens-legaux';
import { Btn, Check, Header, Input, Panel, Screen, Seg, Sep, T, Tag } from '@/components/ui';
import { fmtPrix, INCLUS_GRATUIT, resumeAbonnement, type EtatAbonnement, type Offres, type Paiement, type Periode } from '@/lib/abonnement';
import { api, ApiError } from '@/lib/api';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

const LIBELLE_OFFRE: Record<EtatAbonnement['offre'], string> = { gratuit: 'Gratuit', essai: 'Essai Pro', pro: 'Pro', libre: 'Tout inclus' };
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

export default function Abonnement() {
  const { mode, abonnement, rafraichirCompte, session } = useStore();
  const [offres, setOffres] = useState<Offres | null>(null);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [periode, setPeriode] = useState<Periode>('annuel');
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
        setMsg('Paiement reçu, merci ! Pro est ouvert.');
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
      const r = await api<{ paiement: Paiement }>('/abonnement/paiement', { method: 'POST', token, body: { periode, telephone, accepteCgv: cgv, accesImmediat: immediat } });
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
  const prix = offres ? offres.pro[periode] : null;
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
          <Panel title="Les offres">
            <T style={{ fontFamily: F.texteF }}>Gratuit</T>
            {INCLUS_GRATUIT.map((x) => (
              <T key={x} small muted>
                • {x}
              </T>
            ))}
            <Sep />
            <T style={{ fontFamily: F.texteF }}>
              Pro · {offres.pro.mensuel.libelle} ou {offres.pro.annuel.libelle}
            </T>
            <T small muted>
              Tout Gratuit, plus :
            </T>
            {Object.values(offres.fonctions).map((x) => (
              <T key={x} small>
                • {x}
              </T>
            ))}
            <T small muted>
              Chaque nouveau compte commence par {offres.essaiJours} jours d’essai Pro, sans paiement.
            </T>
          </Panel>

          <Panel title={e?.offre === 'pro' ? 'Prolonger Pro' : 'Passer à Pro'}>
            {!offres.paiement ? (
              <T small muted>
                Le paiement n’est pas encore ouvert sur ce serveur. Réessaie un peu plus tard.
              </T>
            ) : enCours ? (
              <>
                <T>Valide le paiement de {fmtPrix(enCours.montant, enCours.devise)} sur ton téléphone.</T>
                <T small muted>
                  {pause
                    ? 'Toujours en attente. Si tu as validé sur ton téléphone, Pro s’ouvrira dès que FlexPaie confirme le paiement. Si la demande n’est jamais arrivée, abandonne-la pour en faire une autre.'
                    : 'Une demande de ton opérateur mobile money vient d’arriver : confirme-la avec ton code. Cette page se met à jour toute seule.'}
                </T>
                {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Btn label="Vérifier" onPress={verifier} disabled={busy} />
                  <Btn label="Abandonner cette demande" kind="sec" onPress={abandonner} disabled={busy} />
                </View>
              </>
            ) : (
              <>
                <Seg
                  label="Durée"
                  options={[
                    { key: 'annuel', label: `1 an · ${fmtPrix(offres.pro.annuel.prix, offres.devise)}` },
                    { key: 'mensuel', label: `1 mois · ${fmtPrix(offres.pro.mensuel.prix, offres.devise)}` },
                  ]}
                  value={periode}
                  onChange={setPeriode}
                />
                {periode === 'annuel' && offres.pro.annuel.economie ? <T small style={{ color: C.coach }}>{offres.pro.annuel.economie}</T> : null}
                <T small muted>
                  Paiement unique par mobile money (M-Pesa, Orange Money, Airtel Money) avec FlexPaie. Pas de renouvellement automatique : Me te prévient avant la fin
                  {e?.offre === 'pro' ? ', et la nouvelle période s’ajoute à celle en cours.' : '.'}
                </T>
                <Input label="Numéro mobile money" placeholder="243 81 234 5678" value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" autoComplete="tel" />
                <Case on={cgv} onToggle={() => setCgv((v) => !v)} label="J’accepte les conditions générales de vente">
                  <>
                    J’accepte les <LienLegal page="cgv">conditions générales de vente</LienLegal> et les <LienLegal page="conditions">conditions d’utilisation</LienLegal>.
                  </>
                </Case>
                <Case on={immediat} onToggle={() => setImmediat((v) => !v)} label="Je demande l’accès immédiat à Pro">
                  Je demande l’accès à Pro dès le paiement, avant la fin du délai de rétractation de 14 jours. Si je me rétracte, seule la part déjà utilisée reste due.
                </Case>
                {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
                <View style={{ flexDirection: 'row' }}>
                  <Btn label={prix ? `Payer ${fmtPrix(prix.prix, offres.devise)}` : 'Payer'} onPress={payer} disabled={busy || !cgv || !immediat || telephone.replace(/\D/g, '').length < 9} />
                </View>
              </>
            )}
          </Panel>
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
                    Pro {p.periode === 'annuel' ? '1 an' : '1 mois'} · {fmtPrix(p.montant, p.devise)}
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
