import { type ReactNode, useEffect, useState } from 'react';
import { type Href, router } from 'expo-router';
import { Image, Platform, Pressable, Switch, useWindowDimensions, View } from 'react-native';

import { Recap } from '@/components/cotisations-ui';
import { Text } from '@/components/texte';
import { Btn, Dialogue, Input, Panel, Seg, Sep, T } from '@/components/ui';
import { type Devise, DEVISES, GROUPES_PLAFOND, libelleNiveau, libelleRythme, limitesDe, type LimitesType, MEMBRES_PLAFOND, montantCotisation, NIVEAUX, PENALITES_MAX_PCT, RETARDS_MAX, reglesPlateformeDe, RYTHMES, tauxCommission, type ReglesPlateforme, type ReglesPlateformeType, type Visibilite } from '@/lib/commun/cotisations';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import { nombreAVerser, Tontines, type Approbation, type DossierEligibilite, type MotifSignalement, type ResumeAdmin, type Signalement } from '@/lib/tontines';

export type AValider = { titre: string; detail: string; telephone: string; montant: string; action: (preuve?: string, montant?: number) => Promise<ResumeAdmin>; /** Versement en tranches : au plus ce qui est disponible, en centimes. */ tranche?: { max: number; devise: string; dejaVerse: number; complet: boolean } };

/** Confirmer avant de faire sortir de l'argent. Sans API de versement, l'admin verse hors de Me et note la référence. */
export function Validation({ v, api, onFait, onFermer }: { v: AValider; api: boolean; onFait: (r: ResumeAdmin) => void; onFermer: () => void }) {
  const [preuve, setPreuve] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [somme, setSomme] = useState(v.tranche ? String(v.tranche.max / 100).replace('.', ',') : '');
  const centimes = v.tranche ? Math.round(Number(somme.replace(/\s/g, '').replace(',', '.')) * 100) : 0;
  const sommeOk = !v.tranche || (Number.isFinite(centimes) && centimes >= 1 && centimes <= v.tranche.max);
  const ok = (api || preuve.trim().length >= 3) && sommeOk;
  const affiche = v.tranche && sommeOk ? montantCotisation(centimes, v.tranche.devise) : v.montant;
  const valider = async () => {
    setEnvoi(true);
    setErreur('');
    try {
      onFait(await v.action(api ? undefined : preuve.trim(), v.tranche && centimes !== v.tranche.max ? centimes : undefined));
    } catch (e) {
      setErreur((e as Error).message);
      setEnvoi(false);
    }
  };
  return (
    <Dialogue titre={v.titre} onFermer={onFermer}>
      <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 26 }}>{affiche}</Text>
      <T>{v.detail}</T>
      {v.tranche ? (
        <>
          <Input
            label={`Montant (${montantCotisation(v.tranche.max, v.tranche.devise)} disponibles)`}
            value={somme}
            onChangeText={setSomme}
            keyboardType="decimal-pad"
            erreur={somme && !sommeOk ? `Entre 0,01 et ${montantCotisation(v.tranche.max, v.tranche.devise)}` : undefined}
          />
          <T small muted>
            {v.tranche.dejaVerse ? `${montantCotisation(v.tranche.dejaVerse, v.tranche.devise)} déjà versés. ` : ''}
            {v.tranche.complet ? 'Cagnotte complète : le tour est clos quand tout est versé.' : 'Cagnotte pas encore complète : tu verses une tranche de ce qui est déjà arrivé, le reste suivra.'}
          </T>
        </>
      ) : null}
      <T>Numéro : +{v.telephone}</T>
      <T small muted>
        {`${api ? 'Me envoie l’argent à ce numéro par FlexPaie.' : 'Le versement automatique n’est pas activé : envoie l’argent à ce numéro depuis le compte mobile money de Me, puis note la référence de la transaction.'}${v.tranche && (!v.tranche.complet || centimes < v.tranche.max) ? '' : ' Le groupe passe ensuite au tour suivant.'}`}
      </T>
      {api ? null : <Input label="Référence du versement" placeholder="Numéro de transaction" value={preuve} onChangeText={setPreuve} autoCorrect={false} />}
      {erreur ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text> : null}
      <View style={{ flexDirection: 'row' }}>
        <Btn label={api ? `Verser ${affiche}` : 'Noter comme versé'} disabled={!ok || envoi} onPress={valider} />
      </View>
    </Dialogue>
  );
}

/** La demande d'approbation d'un compte. La photo ne s'ouvre qu'ici, et disparaît à la décision. */
function DecisionCompte({ a, onFait, onFermer }: { a: Approbation; onFait: (l: Approbation[]) => void; onFermer: () => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [dossier, setDossier] = useState<DossierEligibilite | null>(null);
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState('');
  const soumise = a.statut === 'soumise';
  useEffect(() => {
    let fini = false;
    Tontines.dossier(a.userId)
      .then((p) => {
        if (fini) return;
        setDossier(p.dossier);
        if (p.base64) setPhoto(`data:${p.type};base64,${p.base64}`);
      })
      .catch((e: Error) => {
        if (!fini) setErreur(e.message);
      });
    return () => {
      fini = true;
    };
  }, [a.userId]);
  const decider = async (approuve: boolean) => {
    setErreur('');
    try {
      onFait((await Tontines.deciderApprobation(a.userId, approuve, approuve ? undefined : motif.trim())).approbations);
    } catch (e) {
      setErreur((e as Error).message);
    }
  };
  return (
    <Dialogue titre={a.nom} onFermer={onFermer}>
      <T>{[a.telephone ? `+${a.telephone}` : '', a.email ?? ''].filter(Boolean).join(', ')}</T>
      {dossier ? (
        <Recap
          lignes={[
            ['Nom complet', dossier.nomComplet],
            ['Naissance', `${dossier.dateNaissance.slice(8)}/${dossier.dateNaissance.slice(5, 7)}/${dossier.dateNaissance.slice(0, 4)}`],
            ['Lieu', `${dossier.commune}, ${dossier.ville}`],
            ['Activité', dossier.activite],
            ['Par mois', `${dossier.capaciteMensuelle} USD`],
            ['Pièce', { carte_electeur: 'Carte d’électeur', passeport: 'Passeport', permis: 'Permis', autre: 'Autre' }[dossier.typePiece]],
            ['Contact', `${dossier.contactNom}, ${dossier.contactTelephone}`],
          ]}
        />
      ) : null}
      {photo ? <Image source={{ uri: photo }} accessibilityLabel={`Pièce d’identité de ${a.nom}`} style={{ width: '100%', height: 260, borderRadius: 14 }} resizeMode="contain" /> : null}
      {erreur ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text> : null}
      {soumise ? <Btn label="Approuver" disabled={!photo} onPress={() => decider(true)} /> : null}
      <Input label={soumise ? 'Motif du refus' : 'Motif du retrait'} value={motif} onChangeText={setMotif} />
      <Btn kind="danger" label={soumise ? 'Refuser' : 'Retirer l’approbation'} disabled={motif.trim().length < 3} onPress={() => decider(false)} />
    </Dialogue>
  );
}

const DUREES = [3, 6, 12, 24, 36];
const enTexte = (centimes: number) => String(centimes / 100).replace('.', ',');

/** Un montant en centimes, saisi en unités. Rien n'est changé tant que la saisie n'est pas un montant valable. */
function ChampMontant({ label, valeur, onChange }: { label: string; valeur: number; onChange: (centimes: number) => void }) {
  const [texte, setTexte] = useState(enTexte(valeur));
  const n = Number(texte.replace(/\s/g, '').replace(',', '.'));
  const ok = Number.isFinite(n) && n >= 0.01 && n <= 1000000;
  return (
    <Input
      label={label}
      value={texte}
      keyboardType="decimal-pad"
      erreur={texte && !ok ? 'Montant invalide' : undefined}
      onChangeText={(t) => {
        setTexte(t);
        const x = Number(t.replace(/\s/g, '').replace(',', '.'));
        if (Number.isFinite(x) && x >= 0.01 && x <= 1000000) onChange(Math.round(x * 100));
      }}
    />
  );
}

function ChampEntier({ label, valeur, min, max, onChange }: { label: string; valeur: number; min: number; max: number; onChange: (n: number) => void }) {
  const [texte, setTexte] = useState(String(valeur));
  const n = Number(texte);
  return (
    <Input
      label={label}
      value={texte}
      keyboardType="number-pad"
      erreur={texte && !(Number.isInteger(n) && n >= min && n <= max) ? `De ${min} à ${max}` : undefined}
      onChangeText={(t) => {
        setTexte(t);
        const x = Number(t);
        if (Number.isInteger(x) && x >= min && x <= max) onChange(x);
      }}
    />
  );
}

/** Deux champs côte à côte sur un écran large, l'un sous l'autre sur un téléphone. */
function Paire({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>;
}
const Moitie = ({ children }: { children: ReactNode }) => <View style={{ flexGrow: 1, flexBasis: 150, minWidth: 140 }}>{children}</View>;

type OngletLimites = Visibilite | 'niveaux';

/**
 * Les limites par cas, réservées à l'admin : pour chaque sorte de groupe (invitation, annuaire), la cotisation au moins et
 * au plus selon le rythme et la devise, les membres et la durée ; pour chaque niveau de compte, les groupes en cours et la
 * cotisation au plus. Pour les nouveaux groupes et les nouvelles adhésions.
 */
export function LimitesAdmin() {
  const { config, saveConfig } = useStore();
  const anciennes = limitesDe(config.limitesCotisations);
  const [r, setR] = useState<ReglesPlateforme>(() => reglesPlateformeDe(config.reglesPlateforme, anciennes));
  const [onglet, setOnglet] = useState<OngletLimites>('prive');
  const [devise, setDevise] = useState<Devise>('USD');
  const [info, setInfo] = useState('');
  const enregistrer = async () => {
    setInfo('');
    // Seules les limites changent : le reste des règles de la plateforme reste celui enregistré.
    const courant = reglesPlateformeDe(config.reglesPlateforme, anciennes);
    const suivant = reglesPlateformeDe({ ...courant, prive: { ...courant.prive, limites: r.prive.limites }, public: { ...courant.public, limites: r.public.limites }, niveaux: r.niveaux }, anciennes);
    try {
      await saveConfig({ ...config, reglesPlateforme: suivant });
      setR(suivant);
      setInfo('Limites enregistrées.');
    } catch (e) {
      setInfo((e as Error).message);
    }
  };
  const majType = (v: Visibilite, patch: Partial<LimitesType>) => setR((x) => ({ ...x, [v]: { ...x[v], limites: { ...x[v].limites, ...patch } } }));
  const l = onglet === 'niveaux' ? null : r[onglet].limites;
  const minTrop = l ? RYTHMES.some((y) => l.montantMax[y][devise] < l.montantMin[devise]) : false;
  return (
    <Panel title="Limites des cotisations">
      <Seg<OngletLimites>
        options={[
          { key: 'prive', label: 'Sur invitation' },
          { key: 'public', label: 'Annuaire' },
          { key: 'niveaux', label: 'Niveaux de compte' },
        ]}
        value={onglet}
        onChange={setOnglet}
      />
      <Seg<Devise> label="Montants en" options={DEVISES.map((d) => ({ key: d, label: d }))} value={devise} onChange={setDevise} />
      {l && onglet !== 'niveaux' ? (
        <View key={`${onglet}-${devise}`} style={{ gap: 12 }}>
          <ChampMontant label={`Cotisation minimum (${devise})`} valeur={l.montantMin[devise]} onChange={(c) => majType(onglet, { montantMin: { ...l.montantMin, [devise]: c } })} />
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Cotisation maximum ({devise})</Text>
          <Paire>
            {RYTHMES.map((y) => (
              <Moitie key={y}>
                <ChampMontant label={libelleRythme(y)} valeur={l.montantMax[y][devise]} onChange={(c) => majType(onglet, { montantMax: { ...l.montantMax, [y]: { ...l.montantMax[y], [devise]: c } } })} />
              </Moitie>
            ))}
          </Paire>
          {minTrop ? (
            <T small style={{ color: C.hebdo }}>
              Un maximum est sous le minimum : il sera relevé au minimum.
            </T>
          ) : null}
          <Paire>
            <Moitie>
              <ChampEntier label={`Membres au plus (${MEMBRES_PLAFOND} max)`} valeur={l.membresMax} min={2} max={MEMBRES_PLAFOND} onChange={(membresMax) => majType(onglet, { membresMax })} />
            </Moitie>
          </Paire>
          <Seg<string> label="Durée d’une raison précise, au plus" options={DUREES.map((m) => ({ key: String(m), label: `${m} mois` }))} value={String(l.dureeMaxMois)} onChange={(k) => majType(onglet, { dureeMaxMois: Number(k) })} />
        </View>
      ) : (
        <View key={`niveaux-${devise}`} style={{ gap: 14 }}>
          {NIVEAUX.map((n) => (
            <View key={n} style={{ gap: 8 }}>
              <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>{libelleNiveau(n)}</Text>
              <Paire>
                <Moitie>
                  <ChampEntier label="Groupes en cours au plus" valeur={r.niveaux[n].groupesMax} min={1} max={GROUPES_PLAFOND} onChange={(groupesMax) => setR((x) => ({ ...x, niveaux: { ...x.niveaux, [n]: { ...x.niveaux[n], groupesMax } } }))} />
                </Moitie>
                <Moitie>
                  <ChampMontant label={`Cotisation au plus (${devise})`} valeur={r.niveaux[n].montantMax[devise]} onChange={(c) => setR((x) => ({ ...x, niveaux: { ...x.niveaux, [n]: { ...x.niveaux[n], montantMax: { ...x.niveaux[n].montantMax, [devise]: c } } } }))} />
                </Moitie>
              </Paire>
            </View>
          ))}
          <T small muted>
            Abonné Pro : formule Pro payée. Compte approuvé : pièce d’identité vérifiée par Me.
          </T>
        </View>
      )}
      <View style={{ flexDirection: 'row' }}>
        <Btn kind="sec" label="Enregistrer" onPress={enregistrer} />
      </View>
      <T small muted>
        {info || `Pour les nouveaux groupes et les nouvelles adhésions. Exemple : ${montantCotisation(r.public.limites.montantMax.mensuel.USD, 'USD')} par mois au plus dans l’annuaire.`}
      </T>
    </Panel>
  );
}

/** Une sorte de groupe : ses règles imposées par la plateforme. */
function CadreType({ v, r, onChange }: { v: Visibilite; r: ReglesPlateformeType; onChange: (r: ReglesPlateformeType) => void }) {
  const [taux, setTaux] = useState(String(r.commissionBps / 100).replace('.', ','));
  const prive = v === 'prive';
  const ligne = (titre: string, desc: string, valeur: boolean, change?: (x: boolean) => void) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <T>{titre}</T>
        <T small muted>
          {desc}
        </T>
      </View>
      <Switch value={valeur} disabled={!change} onValueChange={change} accessibilityLabel={titre} trackColor={{ true: C.accent, false: C.line }} thumbColor={Platform.OS === 'android' ? C.ink : undefined} />
    </View>
  );
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>{prive ? 'Groupes sur invitation' : 'Groupes de l’annuaire'}</Text>
      <Input
        label="Commission de Me (%)"
        value={taux}
        keyboardType="decimal-pad"
        onChangeText={(t) => {
          setTaux(t);
          const n = Number(t.replace(',', '.'));
          if (Number.isFinite(n) && n >= 0 && n <= 20) onChange({ ...r, commissionBps: Math.round(n * 100) });
        }}
        aide="Entre 0 et 20 %. Figée à la création de chaque groupe."
      />
      <Seg<'initiateur' | 'tous'>
        label="Demandes de paiement lancées par"
        options={[
          { key: 'initiateur', label: 'L’initiateur' },
          { key: 'tous', label: 'L’initiateur et chaque membre' },
        ]}
        value={r.demandes}
        onChange={(demandes) => onChange({ ...r, demandes })}
      />
      {ligne('Caution obligatoire', 'Pour chaque rotation.', r.cautionObligatoire, prive ? (cautionObligatoire) => onChange({ ...r, cautionObligatoire }) : undefined)}
      {prive ? ligne('Espèces permises', 'L’initiateur peut les accepter dans les règles de son groupe.', r.especes, (especes) => onChange({ ...r, especes })) : ligne('Espèces', 'Jamais dans l’annuaire : Me garantit les paiements.', false)}
      {ligne('Compte approuvé exigé', prive ? 'Même sur invitation.' : 'Toujours, dans l’annuaire.', r.compteApprouve, prive ? (compteApprouve) => onChange({ ...r, compteApprouve }) : undefined)}
      <Seg<string> label="Pénalité de retard au plus" options={PENALITES_MAX_PCT.map((p) => ({ key: String(p), label: p ? `${p} %` : 'Aucune' }))} value={String(r.penaliteMaxPct)} onChange={(k) => onChange({ ...r, penaliteMaxPct: Number(k) })} />
      <Seg<string> label="Retards permis ailleurs pour entrer" options={RETARDS_MAX.map((n) => ({ key: String(n), label: n < 0 ? 'Au choix du groupe' : n ? `${n} au plus` : 'Aucun' }))} value={String(r.retardsMax)} onChange={(k) => onChange({ ...r, retardsMax: Number(k) })} />
    </View>
  );
}

/** Les règles de la plateforme, une colonne par sorte de groupe. Réservées à l'admin, pour les nouveaux groupes (et les demandes de paiement, tout de suite). */
export function ReglesPlateformeAdmin() {
  const { config, saveConfig } = useStore();
  const [r, setR] = useState<ReglesPlateforme>(() => reglesPlateformeDe(config.reglesPlateforme, limitesDe(config.limitesCotisations)));
  const [info, setInfo] = useState('');
  const large = useWindowDimensions().width >= 900;
  const enregistrer = async () => {
    setInfo('');
    try {
      // Les limites se règlent à part (Limites des cotisations) : on garde celles enregistrées.
      const anciennes = limitesDe(config.limitesCotisations);
      const courant = reglesPlateformeDe(config.reglesPlateforme, anciennes);
      await saveConfig({ ...config, reglesPlateforme: reglesPlateformeDe({ ...r, prive: { ...r.prive, limites: courant.prive.limites }, public: { ...r.public, limites: courant.public.limites }, niveaux: courant.niveaux }, anciennes) });
      setInfo(`Règles enregistrées : ${tauxCommission(r.prive.commissionBps)} sur invitation, ${tauxCommission(r.public.commissionBps)} dans l’annuaire.`);
    } catch (e) {
      setInfo((e as Error).message);
    }
  };
  return (
    <Panel title="Règles de la plateforme">
      <View style={large ? { flexDirection: 'row', gap: 24, alignItems: 'flex-start' } : { gap: 24 }}>
        {(['prive', 'public'] as const).map((v) => (
          <View key={v} style={{ flex: large ? 1 : undefined }}>
            <CadreType v={v} r={r[v]} onChange={(x) => setR((y) => ({ ...y, [v]: { ...y[v], ...x } }))} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Btn kind="sec" label="Enregistrer" onPress={enregistrer} />
      </View>
      <T small muted>
        {info || 'Commission, caution et règles d’entrée : pour les nouveaux groupes. Qui lance les demandes : pour tous les groupes, tout de suite.'}
      </T>
    </Panel>
  );
}

/** Le nombre d'éléments à traiter, pour l'onglet de l'écran. */
export function useAValider(relire: unknown) {
  const { aModule } = useStore();
  const versements = aModule('versements');
  const verifications = aModule('verifications');
  const [nombre, setNombre] = useState({ argent: 0, comptes: 0, signales: 0 });
  useEffect(() => {
    let fini = false;
    if (versements)
      Tontines.resumeAdmin(true)
        .then((r) => {
          if (!fini) setNombre((x) => ({ ...x, argent: nombreAVerser(r) + r.cautions.length }));
        })
        .catch(() => {});
    if (verifications)
      Tontines.approbations(true)
        .then((r) => {
          if (!fini) setNombre((x) => ({ ...x, comptes: r.approbations.filter((a) => a.statut === 'soumise').length }));
        })
        .catch(() => {});
    if (verifications)
      Tontines.signalements(true)
        .then((r) => {
          if (!fini) setNombre((x) => ({ ...x, signales: r.signalements.length }));
        })
        .catch(() => {});
    return () => {
      fini = true;
    };
  }, [versements, verifications, relire]);
  return nombre.argent + nombre.comptes + nombre.signales;
}

const MOTIF_COURT: Record<MotifSignalement, string> = { arnaque: 'Arnaque', trompeur: 'Informations fausses', inapproprie: 'Contenu choquant', autre: 'Autre' };

/** Pour l'équipe : les groupes signalés. Retirer de l'annuaire garde le groupe pour ses membres. */
export function SignalementsAdmin() {
  const [liste, setListe] = useState<Signalement[] | null>(null);
  const [confirmer, setConfirmer] = useState<Signalement | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    let fini = false;
    Tontines.signalements(true)
      .then((r) => {
        if (!fini) setListe(r.signalements);
      })
      // Un serveur plus ancien ne connaît pas les signalements : rien à montrer.
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, []);
  const decider = (id: string, decision: 'retirer' | 'rejeter') => {
    setConfirmer(null);
    Tontines.deciderSignalement(id, decision)
      .then((r) => setListe(r.signalements))
      .catch((e: Error) => setErreur(e.message));
  };
  if (!liste?.length && !erreur) return null;
  return (
    <Panel title="Groupes signalés" count={liste?.length || undefined}>
      {erreur ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text> : null}
      {liste?.map((x) => (
        <View key={x.tontineId} style={{ gap: 8 }}>
          <Sep />
          <View style={{ gap: 2 }}>
            <T>{x.groupe}</T>
            <T small muted>
              {`${x.nombre} signalement${x.nombre > 1 ? 's' : ''}. Organisé par ${x.organisateur || 'un ancien compte'}, ${x.membres} membre${x.membres > 1 ? 's' : ''}${x.retire ? ', déjà retiré' : ''}.`}
            </T>
          </View>
          {x.motifs.slice(0, 3).map((m, i) => (
            <T key={i} small>
              {MOTIF_COURT[m.motif]}
              {m.texte ? ` : « ${m.texte} »` : ''}
            </T>
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {x.retire ? null : <Btn small label="Retirer de l’annuaire" onPress={() => setConfirmer(x)} />}
            <Btn small kind="sec" label={x.retire ? 'Classer' : 'Rejeter'} onPress={() => decider(x.tontineId, 'rejeter')} />
          </View>
        </View>
      ))}
      {confirmer ? (
        <Dialogue titre="Retirer de l’annuaire ?" onFermer={() => setConfirmer(null)}>
          <T>{`« ${confirmer.groupe} » ne sera plus visible, et personne ne pourra plus le rejoindre. Ses ${confirmer.membres} membres et leur argent ne changent pas. L’organisateur est prévenu.`}</T>
          <Btn label="Retirer" onPress={() => decider(confirmer.tontineId, 'retirer')} />
        </Dialogue>
      ) : null}
    </Panel>
  );
}

/**
 * Pour l'équipe des versements, en tête de « Mes groupes » : combien de cagnottes et de cautions attendent d'être versées,
 * avec le chemin vers l'écran où on les verse (Utilisateurs › Cotisations).
 */
export function VersementsAFaire({ toujours }: { /** Montrer le lien même sans rien à verser (page de l'équipe). */ toujours?: boolean } = {}) {
  const { aModule } = useStore();
  const permis = aModule('versements');
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!permis) return;
    let fini = false;
    Tontines.resumeAdmin(true)
      .then((r) => !fini && setN(nombreAVerser(r) + r.cautions.length))
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, [permis]);
  if (!permis || (!n && !toujours)) return null;
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push('/versements' as Href)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: alpha(C.hebdo, 0.45), backgroundColor: alpha(C.hebdo, 0.08), opacity: pressed ? 0.8 : 1 })}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>{!n ? 'Versements' : n === 1 ? '1 versement à faire' : `${n} versements à faire`}</Text>
        <T small muted>
          {n ? 'Équipe Me : cagnottes complètes, tranches demandées et cautions à rendre.' : 'Rien à verser. Solde FlexPaie et historique.'}
        </T>
      </View>
      <Text style={{ color: C.hebdo, fontFamily: F.texteF, fontSize: 14 }}>{n ? 'Verser' : 'Ouvrir'}</Text>
    </Pressable>
  );
}

/** Pour l'admin : les versements et cautions à valider, l'argent détenu et la commission gagnée. */
export function AdminTontines() {
  const [erreur, setErreur] = useState('');
  const [comptes, setComptes] = useState<Approbation[]>([]);
  const [compte, setCompte] = useState<string | null>(null);

  const { aModule } = useStore();
  const versements = aModule('versements');
  const verifications = aModule('verifications');

  useEffect(() => {
    if (verifications)
      Tontines.approbations(true)
        .then((x) => setComptes(x.approbations))
        .catch((e: Error) => setErreur(e.message));
  }, [verifications]);

  const aTraiter = comptes.filter((c) => c.statut === 'soumise');
  const approuves = comptes.filter((c) => c.statut === 'approuvee');
  const choisi = compte ? comptes.find((c) => c.userId === compte) : undefined;
  return (
    <>
      {/* L'argent a sa propre page : cagnottes, tranches, cautions, solde FlexPaie et historique. */}
      {versements ? <VersementsAFaire toujours /> : null}
      {verifications ? (
        <Panel title="Comptes" count={aTraiter.length || undefined}>
          {erreur ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text> : null}
          {!comptes.length && !erreur ? (
            <T small muted>
              Aucun compte à vérifier.
            </T>
          ) : null}
          {[...aTraiter, ...approuves].map((c, i) => (
            <View key={c.userId} style={{ gap: 8 }}>
              {i ? <Sep /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 180 }}>
                  <T>{c.nom}</T>
                  <T small muted>
                    {c.statut === 'soumise' ? 'Compte à vérifier' : 'Compte approuvé'}
                  </T>
                </View>
                <Btn small kind={c.statut === 'soumise' ? 'primary' : 'sec'} label={c.statut === 'soumise' ? 'Vérifier' : 'Gérer'} onPress={() => setCompte(c.userId)} />
              </View>
            </View>
          ))}
          {choisi ? (
            <DecisionCompte
              a={choisi}
              onFermer={() => setCompte(null)}
              onFait={(l) => {
                setComptes(l);
                setCompte(null);
              }}
            />
          ) : null}
        </Panel>
      ) : null}
    </>
  );
}
