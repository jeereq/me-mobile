import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';

import { Jauge } from '@/components/jauge';
import { Filtre } from '@/components/onglets';
import { Pliable } from '@/components/pliable';
import { ReserveFinances } from '@/components/reserve-pro';
import { ChampTelephone, useTelephone } from '@/components/telephone';
import { Text } from '@/components/texte';
import { Btn, Dialogue, Empty, Input, Panel, Seg, Sep, T } from '@/components/ui';
import { libellePeriode, lienSms, lienWhatsapp, messageCotisation, montantCotisation, montantEtRythme, type RythmeCotisation } from '@/lib/commun/cotisations';
import { etatMembre, suiviPeriode, type Cotisation, type EtatMembre, type MembreCotisation } from '@/lib/cotisations';
import { Cotisations } from '@/lib/cotisations-api';
import { lireMontant } from '@/lib/finances';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

const SUIVI_MS = 30000;
const RYTHMES: { key: RythmeCotisation; label: string }[] = [
  { key: 'unique', label: 'Une fois' },
  { key: 'hebdomadaire', label: 'Par semaine' },
  { key: 'mensuel', label: 'Par mois' },
];
const DEVISES = [
  { key: 'USD', label: 'USD' },
  { key: 'CDF', label: 'CDF' },
] as const;
const ETATS: Record<EtatMembre, string> = { paye: 'Payé', en_attente: 'En cours', demande: 'Demandé', a_payer: 'À payer', hors: '' };
const couleurEtat = (e: EtatMembre) => (e === 'paye' ? C.coach : e === 'en_attente' || e === 'demande' ? C.hebdo : C.muted);
const enCentimes = (texte: string) => {
  const m = lireMontant(texte);
  return m === null ? null : Math.round(m * 100);
};
const enTexte = (centimes: number) => String(centimes / 100).replace('.', ',');

function Chiffre({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 130, gap: 2, padding: 12, borderRadius: 14, backgroundColor: C.sunk }}>
      <T small muted>
        {titre}
      </T>
      <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 20 }}>{valeur}</Text>
    </View>
  );
}

/** Nouvelle cotisation, ou modification du titre et du montant. Devise et rythme ne changent plus ensuite. */
function FormCotisation({ init, deviseDefaut, onEnregistrer, onTerminer, onSupprimer, onFermer }: {
  init?: Cotisation;
  deviseDefaut: 'USD' | 'CDF';
  onEnregistrer: (c: { titre: string; montant: number; devise: string; rythme: RythmeCotisation }) => void;
  onTerminer?: () => void;
  onSupprimer?: () => void;
  onFermer: () => void;
}) {
  const [titre, setTitre] = useState(init?.titre ?? '');
  const [montant, setMontant] = useState(init ? enTexte(init.montant) : '');
  const [devise, setDevise] = useState<string>(init?.devise ?? deviseDefaut);
  const [rythme, setRythme] = useState<RythmeCotisation>(init?.rythme ?? 'mensuel');
  const m = enCentimes(montant);
  const ok = !!titre.trim() && m !== null && m >= 100;
  return (
    <Dialogue titre={init ? 'Modifier' : 'Nouvelle cotisation'} onFermer={onFermer}>
      <Input label="Titre" placeholder="Tontine de la famille" value={titre} onChangeText={setTitre} autoFocus={!init} />
      <Input label={`Montant par membre (${devise})`} placeholder="10" value={montant} onChangeText={setMontant} keyboardType="decimal-pad" />
      {init ? null : (
        <>
          <Seg label="Devise" options={[...DEVISES]} value={devise as 'USD' | 'CDF'} onChange={setDevise} />
          <Seg label="Rythme" options={RYTHMES} value={rythme} onChange={setRythme} />
        </>
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Enregistrer" disabled={!ok} onPress={() => onEnregistrer({ titre: titre.trim(), montant: m!, devise, rythme })} />
        {onTerminer ? <Btn kind="sec" label={init?.archive ? 'Reprendre' : 'Terminer'} onPress={onTerminer} /> : null}
        {onSupprimer ? <Btn kind="danger" label="Supprimer" onPress={onSupprimer} /> : null}
      </View>
    </Dialogue>
  );
}

function FormMembre({ init, onEnregistrer, onRetirer, onFermer }: { init?: MembreCotisation; onEnregistrer: (m: { nom: string; telephone: string }) => void; onRetirer?: () => void; onFermer: () => void }) {
  const [nom, setNom] = useState(init?.nom ?? '');
  const tel = useTelephone();
  const { saisir } = tel;
  const initial = init?.telephone;
  // Le numéro enregistré s'ouvre séparé de son indicatif.
  useEffect(() => {
    if (initial) saisir(`+${initial}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);
  return (
    <Dialogue titre={init ? 'Modifier le membre' : 'Ajouter un membre'} onFermer={onFermer}>
      <Input label="Nom" placeholder="Marie" value={nom} onChangeText={setNom} autoFocus={!init} />
      <ChampTelephone tel={tel} label="Numéro mobile money" />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Enregistrer" disabled={!nom.trim() || !tel.valide} onPress={() => onEnregistrer({ nom: nom.trim(), telephone: tel.complet })} />
        {onRetirer ? <Btn kind="danger" label="Retirer" onPress={onRetirer} /> : null}
      </View>
    </Dialogue>
  );
}

/** Le message préparé : l'organisateur l'envoie lui-même, depuis son WhatsApp ou ses SMS. */
function Demande({ c, m, periode, onEnvoye, onFermer }: { c: Cotisation; m: MembreCotisation; periode: string; onEnvoye: () => void; onFermer: () => void }) {
  const texte = messageCotisation({ nom: m.nom, titre: c.titre, montant: c.montant, devise: c.devise, periode, lien: m.lien });
  const ouvrir = (url: string) => {
    Linking.openURL(url).catch(() => {});
    onEnvoye();
  };
  return (
    <Dialogue titre={`Demander à ${m.nom}`} onFermer={onFermer}>
      <View style={{ padding: 12, borderRadius: 14, backgroundColor: C.sunk }}>
        <T>{texte}</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="WhatsApp" onPress={() => ouvrir(lienWhatsapp(m.telephone, texte))} />
        <Btn kind="sec" label="SMS" onPress={() => ouvrir(lienSms(m.telephone, texte))} />
      </View>
    </Dialogue>
  );
}

type Agir = (action: () => Promise<Cotisation>) => void;

function Detail({ c, enLigne, modifiable, agir, onRetour, onSupprimer, deviseDefaut }: { c: Cotisation; enLigne: boolean; modifiable: boolean; agir: Agir; onRetour: () => void; onSupprimer: () => void; deviseDefaut: 'USD' | 'CDF' }) {
  const [periode, setPeriode] = useState(c.periode);
  const [form, setForm] = useState(false);
  const [membre, setMembre] = useState<'nouveau' | string | null>(null);
  const [aDemander, setADemander] = useState<string | null>(null);
  const s = suiviPeriode(c, periode);
  const enEdition = membre && membre !== 'nouveau' ? c.membres.find((m) => m.id === membre) : undefined;
  const cible = aDemander ? c.membres.find((m) => m.id === aDemander) : undefined;
  const prochain = c.archive || !modifiable ? undefined : s.aDemander[0];
  const dernieres = [...c.periodes].reverse().slice(0, 6);
  const concernes = c.membres.filter((m) => etatMembre(m, periode) !== 'hors');

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Btn kind="sec" small label="Retour" onPress={onRetour} />
        <View style={{ flex: 1, minWidth: 160 }}>
          <Text accessibilityRole="header" numberOfLines={2} style={{ color: C.ink, fontFamily: F.titreM, fontSize: 20 }}>
            {c.titre}
          </Text>
          <T small muted>
            {montantEtRythme(c.montant, c.devise, c.rythme)}
            {c.archive ? ', terminée' : ''}
          </T>
        </View>
        {modifiable ? <Btn kind="sec" small label="Modifier" onPress={() => setForm(true)} /> : null}
      </View>

      {dernieres.length > 1 ? <Filtre label="Période" options={dernieres.map((p) => ({ key: p, label: libellePeriode(p) }))} value={periode} onChange={setPeriode} /> : null}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chiffre titre={`Payé (${s.payes} sur ${s.total})`} valeur={montantCotisation(s.recu, c.devise)} />
        <Chiffre titre="Reste" valeur={montantCotisation(s.reste, c.devise)} />
        {c.encaisse ? <Chiffre titre="Encaissé en ligne" valeur={montantCotisation(c.encaisse, c.devise)} /> : null}
      </View>

      {prochain ? (
        <Btn label={s.aDemander.length > 1 ? `Demander à ${prochain.nom} (${s.aDemander.length} restants)` : `Demander à ${prochain.nom}`} onPress={() => setADemander(prochain.id)} />
      ) : null}
      {!enLigne && c.membres.length ? (
        <T small muted>
          Paiement en ligne pas encore ouvert : note les paiements reçus.
        </T>
      ) : null}

      <Panel
        title="Membres"
        count={c.membres.length}
        right={modifiable && !c.archive ? <Btn kind="sec" small label="Ajouter" onPress={() => setMembre('nouveau')} /> : undefined}>
        {!c.membres.length ? <Empty icone="vide">Ajoute les membres : un nom et un numéro.</Empty> : null}
        {concernes.map((m, i) => {
          const e = etatMembre(m, periode);
          const main = m.paiements.some((p) => p.periode === periode && p.statut === 'paye' && p.mode === 'main');
          return (
            <View key={m.id} style={{ gap: 10 }}>
              {i ? <Sep /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Modifier ${m.nom}`} disabled={!modifiable} onPress={() => setMembre(m.id)} style={{ flex: 1, minWidth: 140, gap: 1 }}>
                  <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>
                    {m.nom}
                  </Text>
                  <Text style={{ color: couleurEtat(e), fontFamily: F.texteM, fontSize: 13 }}>{ETATS[e]}</Text>
                </Pressable>
                {modifiable && !c.archive && (e === 'a_payer' || e === 'demande') ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Btn kind="sec" small label={e === 'demande' ? 'Redemander' : 'Demander'} onPress={() => setADemander(m.id)} />
                    <Btn kind="sec" small label="Noter payé" onPress={() => agir(() => Cotisations.marquer(m.id, periode, true))} />
                  </View>
                ) : null}
                {modifiable && main ? <Btn kind="sec" small label="Annuler" onPress={() => agir(() => Cotisations.marquer(m.id, periode, false))} /> : null}
              </View>
            </View>
          );
        })}
      </Panel>

      {form ? (
        <FormCotisation
          init={c}
          deviseDefaut={deviseDefaut}
          onFermer={() => setForm(false)}
          onEnregistrer={({ titre, montant }) => {
            setForm(false);
            agir(() => Cotisations.modifier(c.id, { titre, montant }));
          }}
          onTerminer={() => {
            setForm(false);
            agir(() => Cotisations.modifier(c.id, { archive: !c.archive }));
          }}
          onSupprimer={() => {
            setForm(false);
            onSupprimer();
          }}
        />
      ) : null}
      {membre ? (
        <FormMembre
          init={enEdition}
          onFermer={() => setMembre(null)}
          onEnregistrer={(x) => {
            setMembre(null);
            agir(() => (enEdition ? Cotisations.modifierMembre(enEdition.id, x) : Cotisations.ajouterMembre(c.id, x)));
          }}
          onRetirer={
            enEdition
              ? () => {
                  setMembre(null);
                  agir(() => Cotisations.retirerMembre(enEdition.id));
                }
              : undefined
          }
        />
      ) : null}
      {cible ? (
        <Demande
          c={c}
          m={cible}
          periode={periode}
          onFermer={() => setADemander(null)}
          onEnvoye={() => {
            setADemander(null);
            agir(() => Cotisations.noterDemande(cible.id, periode));
          }}
        />
      ) : null}
    </View>
  );
}

function Ligne({ c, onPress }: { c: Cotisation; onPress: () => void }) {
  const s = suiviPeriode(c, c.periode);
  const quand = libellePeriode(c.periode);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${c.titre}`} onPress={onPress} style={({ pressed }) => ({ gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>
          {c.titre}
        </Text>
        <T small muted>
          {montantEtRythme(c.montant, c.devise, c.rythme)}
        </T>
      </View>
      {s.total ? <Jauge ratio={s.payes / s.total} /> : null}
      <T small muted>
        {s.total ? `${s.payes} sur ${s.total} payé${s.payes > 1 ? 's' : ''}` : 'Aucun membre'}
        {quand && s.total ? `, ${quand}` : ''}
      </T>
    </Pressable>
  );
}

/** L'onglet Cotisations des Finances : le suivi vient du serveur, car les membres paient sans compte Me. */
export function PanneauCotisations({ devise }: { devise: string }) {
  const { finances, session } = useStore();
  const [liste, setListe] = useState<Cotisation[] | null>(null);
  const [enLigne, setEnLigne] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState(false);
  const [erreur, setErreur] = useState('');
  const deviseDefaut = devise === 'CDF' ? 'CDF' : 'USD';

  const charger = useCallback(async (discret?: boolean) => {
    if (!session) return;
    try {
      const r = await Cotisations.liste(discret);
      setListe(r.cotisations);
      setEnLigne(r.enLigne);
    } catch (e) {
      if (!discret) setErreur((e as Error).message);
    }
  }, [session]);
  useEffect(() => {
    charger();
    const t = setInterval(() => charger(true), SUIVI_MS);
    return () => clearInterval(t);
  }, [charger]);

  const agir: Agir = useCallback(async (action) => {
    setErreur('');
    try {
      const c = await action();
      setListe((l) => (l?.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [c, ...(l ?? [])]));
      setOuverte(c.id);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }, []);
  const supprimer = async (id: string) => {
    setErreur('');
    try {
      await Cotisations.supprimer(id);
      setListe((l) => l?.filter((x) => x.id !== id) ?? null);
      setOuverte(null);
    } catch (e) {
      setErreur((e as Error).message);
    }
  };

  const enCours = useMemo(() => (liste ?? []).filter((c) => !c.archive), [liste]);
  const terminees = useMemo(() => (liste ?? []).filter((c) => c.archive), [liste]);
  const detail = ouverte ? liste?.find((c) => c.id === ouverte) : undefined;

  if (!session) return <Empty icone="vide">Connecte-toi pour créer une cotisation.</Empty>;
  if (!liste && !erreur) return <ActivityIndicator color={C.accent} />;
  if (!finances && !liste?.length) return <ReserveFinances fonction="cotisations" />;

  return (
    <View style={{ gap: 12 }}>
      {erreur ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text> : null}
      {detail ? (
        <Detail key={detail.id} c={detail} enLigne={enLigne} modifiable={finances} agir={agir} deviseDefaut={deviseDefaut} onRetour={() => setOuverte(null)} onSupprimer={() => supprimer(detail.id)} />
      ) : (
        <>
          {finances ? (
            <View style={{ flexDirection: 'row' }}>
              <Btn label="Nouvelle cotisation" onPress={() => setNouvelle(true)} />
            </View>
          ) : null}
          {!enCours.length && !terminees.length ? <Empty icone="vide">Aucune cotisation.</Empty> : null}
          {enCours.map((c) => (
            <Ligne key={c.id} c={c} onPress={() => setOuverte(c.id)} />
          ))}
          {terminees.length ? (
            <Pliable titre="Terminées" count={terminees.length}>
              <View style={{ gap: 8 }}>
                {terminees.map((c) => (
                  <Ligne key={c.id} c={c} onPress={() => setOuverte(c.id)} />
                ))}
              </View>
            </Pliable>
          ) : null}
        </>
      )}
      {nouvelle ? (
        <FormCotisation
          deviseDefaut={deviseDefaut}
          onFermer={() => setNouvelle(false)}
          onEnregistrer={(c) => {
            setNouvelle(false);
            agir(() => Cotisations.creer(c));
          }}
        />
      ) : null}
    </View>
  );
}
