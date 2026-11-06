import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';

import { ActionDiscrete, Cadre, EnteteDetail, Erreur, Etat, GrandTitre, Ligne, Liste } from '@/components/cotisations-ui';
import { Icone } from '@/components/icones';
import { Jauge } from '@/components/jauge';
import { Filtre, SousOnglets } from '@/components/onglets';
import { Pliable } from '@/components/pliable';
import { ReserveFinances } from '@/components/reserve-pro';
import { ChampTelephone, useTelephone } from '@/components/telephone';
import { PanneauTontines } from '@/components/tontines';
import { Btn, Dialogue, Empty, Input, Seg, T } from '@/components/ui';
import { libellePeriode, lienSms, lienWhatsapp, messageCotisation, montantCotisation, montantEtRythme, type RythmeCotisation } from '@/lib/commun/cotisations';
import { etatMembre, suiviPeriode, type Cotisation, type EtatMembre, type MembreCotisation } from '@/lib/cotisations';
import { Cotisations } from '@/lib/cotisations-api';
import { lireMontant } from '@/lib/finances';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

const SUIVI_MS = 30000;
const RYTHMES: { key: RythmeCotisation; label: string }[] = [
  { key: 'unique', label: 'Une fois' },
  { key: 'hebdomadaire', label: 'Semaine' },
  { key: 'mensuel', label: 'Mois' },
];
const DEVISES: { key: 'USD' | 'CDF'; label: string }[] = [
  { key: 'USD', label: 'USD' },
  { key: 'CDF', label: 'CDF' },
];
const ETATS: Record<EtatMembre, string> = { paye: 'Payé', en_attente: 'En cours', demande: 'Demandé', a_payer: 'À payer', hors: '' };
const couleurEtat = (e: EtatMembre) => (e === 'paye' ? C.coach : e === 'en_attente' || e === 'demande' ? C.hebdo : C.muted);
const enCentimes = (texte: string) => {
  const m = lireMontant(texte);
  return m === null ? null : Math.round(m * 100);
};
const enTexte = (centimes: number) => String(centimes / 100).replace('.', ',');

type Agir = (action: () => Promise<Cotisation>) => void;
type Canaux = { mail: boolean; sms: boolean };

/** Nouvelle collecte, ou modification du titre et du montant. Devise et rythme ne changent plus ensuite. */
function FormCollecte({ init, deviseDefaut, onEnregistrer, onTerminer, onSupprimer, onFermer }: {
  init?: Cotisation;
  deviseDefaut: 'USD' | 'CDF';
  onEnregistrer: (c: { titre: string; montant: number; devise: string; rythme: RythmeCotisation }) => void;
  onTerminer?: () => void;
  onSupprimer?: () => void;
  onFermer: () => void;
}) {
  const [titre, setTitre] = useState(init?.titre ?? '');
  const [montant, setMontant] = useState(init ? enTexte(init.montant) : '');
  const [devise, setDevise] = useState<'USD' | 'CDF'>(init?.devise === 'CDF' ? 'CDF' : init ? 'USD' : deviseDefaut);
  const [rythme, setRythme] = useState<RythmeCotisation>(init?.rythme ?? 'mensuel');
  const m = enCentimes(montant);
  const ok = !!titre.trim() && m !== null && m >= 100;
  return (
    <Dialogue titre={init ? 'Modifier' : 'Nouvelle collecte'} onFermer={onFermer}>
      <Input label="Titre" placeholder="Mariage de Jean" value={titre} onChangeText={setTitre} autoFocus={!init} />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Input label={init ? `Montant (${devise})` : 'Montant par membre'} placeholder="10" value={montant} onChangeText={setMontant} keyboardType="decimal-pad" />
        </View>
        {init ? null : (
          <View style={{ width: 128 }}>
            <Seg options={DEVISES} value={devise} onChange={setDevise} />
          </View>
        )}
      </View>
      {init ? null : <Seg label="Rythme" options={RYTHMES} value={rythme} onChange={setRythme} />}
      <Btn label="Enregistrer" disabled={!ok} onPress={() => onEnregistrer({ titre: titre.trim(), montant: m!, devise, rythme })} />
      {onTerminer ? <Btn kind="sec" label={init?.archive ? 'Reprendre' : 'Terminer'} onPress={onTerminer} /> : null}
      {onSupprimer ? <ActionDiscrete danger label="Supprimer" onPress={onSupprimer} /> : null}
    </Dialogue>
  );
}

function FormMembre({ init, onEnregistrer, onRetirer, onFermer }: { init?: MembreCotisation; onEnregistrer: (m: { nom: string; telephone: string; email?: string }) => void; onRetirer?: () => void; onFermer: () => void }) {
  const [nom, setNom] = useState(init?.nom ?? '');
  const [email, setEmail] = useState(init?.email ?? '');
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
      <ChampTelephone tel={tel} label="Numéro" />
      <Input label="Email (facultatif)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <Btn label="Enregistrer" disabled={!nom.trim() || !tel.valide} onPress={() => onEnregistrer({ nom: nom.trim(), telephone: tel.complet, email: email.trim() })} />
      {onRetirer ? <ActionDiscrete danger label="Retirer du groupe" onPress={onRetirer} /> : null}
    </Dialogue>
  );
}

/** Le message préparé : WhatsApp et SMS depuis son téléphone, ou envoi direct par Me. */
function Demande({ c, m, periode, canaux, onParMe, onEnvoye, onFermer }: { c: Cotisation; m: MembreCotisation; periode: string; canaux: Canaux; onParMe: () => void; onEnvoye: () => void; onFermer: () => void }) {
  const texte = messageCotisation({ nom: m.nom, titre: c.titre, montant: c.montant, devise: c.devise, periode, lien: m.lien });
  const ouvrir = (url: string) => {
    Linking.openURL(url).catch(() => {});
    onEnvoye();
  };
  const viaMe = [canaux.mail && m.email ? 'mail' : '', canaux.sms ? 'SMS' : ''].filter(Boolean).join(' et ');
  return (
    <Dialogue titre={`Demander à ${m.nom}`} onFermer={onFermer}>
      <View style={{ padding: 12, borderRadius: 14, backgroundColor: C.sunk }}>
        <T small>{texte}</T>
      </View>
      <Btn label="WhatsApp" onPress={() => ouvrir(lienWhatsapp(m.telephone, texte))} />
      <Btn kind="sec" label="SMS depuis mon téléphone" onPress={() => ouvrir(lienSms(m.telephone, texte))} />
      {viaMe ? <Btn kind="sec" label={`Envoyer par Me (${viaMe})`} onPress={onParMe} /> : null}
    </Dialogue>
  );
}

function ActionsMembre({ m, e, main, onDemander, onNoter, onAnnuler, onModifier, onFermer }: { m: MembreCotisation; e: EtatMembre; main: boolean; onDemander: () => void; onNoter: () => void; onAnnuler: () => void; onModifier: () => void; onFermer: () => void }) {
  const aPayer = e === 'a_payer' || e === 'demande';
  return (
    <Dialogue titre={m.nom} onFermer={onFermer}>
      {aPayer ? <Btn label={e === 'demande' ? 'Redemander' : 'Demander'} onPress={onDemander} /> : null}
      {aPayer ? <Btn kind="sec" label="Noter payé" onPress={onNoter} /> : null}
      {main ? <Btn kind="sec" label="Annuler le paiement noté" onPress={onAnnuler} /> : null}
      <Btn kind="sec" label="Modifier" onPress={onModifier} />
    </Dialogue>
  );
}

function Detail({ c, enLigne, canaux, modifiable, agir, onRetour, onSupprimer, deviseDefaut }: { c: Cotisation; enLigne: boolean; canaux: Canaux; modifiable: boolean; agir: Agir; onRetour: () => void; onSupprimer: () => void; deviseDefaut: 'USD' | 'CDF' }) {
  const [periode, setPeriode] = useState(c.periode);
  const [form, setForm] = useState(false);
  const [edition, setEdition] = useState<'nouveau' | string | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [aDemander, setADemander] = useState<string | null>(null);
  const s = suiviPeriode(c, periode);
  const enEdition = edition && edition !== 'nouveau' ? c.membres.find((m) => m.id === edition) : undefined;
  const cible = aDemander ? c.membres.find((m) => m.id === aDemander) : undefined;
  const menu = choisi ? c.membres.find((m) => m.id === choisi) : undefined;
  const prochain = c.archive || !modifiable ? undefined : s.aDemander[0];
  const dernieres = [...c.periodes].reverse().slice(0, 6);
  const concernes = c.membres.filter((m) => etatMembre(m, periode) !== 'hors');
  const estMain = (m: MembreCotisation) => m.paiements.some((p) => p.periode === periode && p.statut === 'paye' && p.mode === 'main');

  return (
    <View style={{ gap: 14 }}>
      <EnteteDetail
        titre={c.titre}
        sousTitre={`${montantEtRythme(c.montant, c.devise, c.rythme)}${c.archive ? ', terminée' : ''}`}
        onRetour={onRetour}
        droite={
          modifiable ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Modifier" onPress={() => setForm(true)} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
              <Icone nom="crayon" color={C.muted} size={20} />
            </Pressable>
          ) : undefined
        }
      />

      {dernieres.length > 1 ? <Filtre label="Période" options={dernieres.map((p) => ({ key: p, label: libellePeriode(p) }))} value={periode} onChange={setPeriode} /> : null}

      <Cadre>
        <GrandTitre>
          {montantCotisation(s.recu, c.devise)} sur {montantCotisation(s.recu + s.reste, c.devise)}
        </GrandTitre>
        <View style={{ gap: 6 }}>
          <Jauge ratio={s.total ? s.payes / s.total : 0} hauteur={6} />
          <T small muted>
            {s.payes} sur {s.total} ont payé{c.encaisse ? `, ${montantCotisation(c.encaisse, c.devise)} encaissés en ligne` : ''}
          </T>
        </View>
        {prochain ? <Btn label={s.aDemander.length > 1 ? `Demander à ${prochain.nom.split(' ')[0]} (${s.aDemander.length} restants)` : `Demander à ${prochain.nom.split(' ')[0]}`} onPress={() => setADemander(prochain.id)} /> : null}
        {!enLigne && c.membres.length ? (
          <T small muted>
            Paiement en ligne bientôt ouvert
          </T>
        ) : null}
      </Cadre>

      <Liste titre="Membres">
        {concernes.map((m, i) => {
          const e = etatMembre(m, periode);
          return <Ligne key={m.id} premiere={i === 0} titre={m.nom} droite={<Etat texte={ETATS[e]} couleur={couleurEtat(e)} />} onPress={modifiable && !c.archive ? () => setChoisi(m.id) : undefined} />;
        })}
        {modifiable && !c.archive ? <Ligne premiere={!concernes.length} titre="Ajouter un membre" accent onPress={() => setEdition('nouveau')} /> : null}
        {!concernes.length && (!modifiable || c.archive) ? <Ligne premiere titre="Aucun membre" /> : null}
      </Liste>

      {form ? (
        <FormCollecte
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
      {menu ? (
        <ActionsMembre
          m={menu}
          e={etatMembre(menu, periode)}
          main={estMain(menu)}
          onFermer={() => setChoisi(null)}
          onDemander={() => {
            setChoisi(null);
            setADemander(menu.id);
          }}
          onNoter={() => {
            setChoisi(null);
            agir(() => Cotisations.marquer(menu.id, periode, true));
          }}
          onAnnuler={() => {
            setChoisi(null);
            agir(() => Cotisations.marquer(menu.id, periode, false));
          }}
          onModifier={() => {
            setChoisi(null);
            setEdition(menu.id);
          }}
        />
      ) : null}
      {edition ? (
        <FormMembre
          init={enEdition}
          onFermer={() => setEdition(null)}
          onEnregistrer={(x) => {
            setEdition(null);
            agir(() => (enEdition ? Cotisations.modifierMembre(enEdition.id, x) : Cotisations.ajouterMembre(c.id, x)));
          }}
          onRetirer={
            enEdition
              ? () => {
                  setEdition(null);
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
          canaux={canaux}
          onFermer={() => setADemander(null)}
          onParMe={() => {
            setADemander(null);
            agir(() => Cotisations.envoyer(cible.id, periode));
          }}
          onEnvoye={() => {
            setADemander(null);
            agir(() => Cotisations.noterDemande(cible.id, periode));
          }}
        />
      ) : null}
    </View>
  );
}

function sousCollecte(c: Cotisation) {
  const s = suiviPeriode(c, c.periode);
  if (!s.total) return montantEtRythme(c.montant, c.devise, c.rythme);
  return `${s.payes} sur ${s.total} ont payé, ${montantEtRythme(c.montant, c.devise, c.rythme)}`;
}

/** Le suivi vient du serveur, car les membres paient sans compte Me. */
function PanneauCollectes({ devise, ouverte, setOuverte }: { devise: string; ouverte: string | null; setOuverte: (id: string | null) => void }) {
  const { finances, session } = useStore();
  const [liste, setListe] = useState<Cotisation[] | null>(null);
  const [enLigne, setEnLigne] = useState(false);
  const [canaux, setCanaux] = useState<Canaux>({ mail: false, sms: false });
  const [nouvelle, setNouvelle] = useState(false);
  const [erreur, setErreur] = useState('');
  const deviseDefaut = devise === 'CDF' ? 'CDF' : 'USD';

  useEffect(() => {
    if (!session) return;
    const charger = (discret?: boolean) =>
      Cotisations.liste(discret)
        .then((r) => {
          setListe(r.cotisations);
          setEnLigne(r.enLigne);
          if (r.canaux) setCanaux(r.canaux);
        })
        .catch((e: Error) => {
          if (!discret) setErreur(e.message);
        });
    charger();
    const t = setInterval(() => charger(true), SUIVI_MS);
    return () => clearInterval(t);
  }, [session]);

  const agir: Agir = useCallback(
    async (action) => {
      setErreur('');
      try {
        const c = await action();
        setListe((l) => (l?.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? c : x)) : [c, ...(l ?? [])]));
        setOuverte(c.id);
      } catch (e) {
        setErreur((e as Error).message);
      }
    },
    [setOuverte],
  );
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

  if (!session) return <Empty>Connecte-toi pour créer une collecte.</Empty>;
  if (!liste && !erreur) return <ActivityIndicator color={C.accent} />;
  if (!finances && !liste?.length) return <ReserveFinances fonction="cotisations" />;

  return (
    <View style={{ gap: 12 }}>
      {erreur ? <Erreur texte={erreur} /> : null}
      {detail ? (
        <Detail key={detail.id} c={detail} enLigne={enLigne} canaux={canaux} modifiable={finances} agir={agir} deviseDefaut={deviseDefaut} onRetour={() => setOuverte(null)} onSupprimer={() => supprimer(detail.id)} />
      ) : (
        <>
          {!enCours.length && !terminees.length ? <Empty>Aucune collecte.</Empty> : null}
          {enCours.length ? (
            <Liste>
              {enCours.map((c, i) => (
                <Ligne key={c.id} premiere={i === 0} titre={c.titre} sous={sousCollecte(c)} onPress={() => setOuverte(c.id)} label={`Ouvrir ${c.titre}`} />
              ))}
            </Liste>
          ) : null}
          {finances ? <Btn kind={enCours.length ? 'sec' : 'primary'} label="Nouvelle collecte" onPress={() => setNouvelle(true)} /> : null}
          {terminees.length ? (
            <Pliable titre="Terminées" count={terminees.length}>
              <Liste>
                {terminees.map((c, i) => (
                  <Ligne key={c.id} premiere={i === 0} titre={c.titre} sous={sousCollecte(c)} onPress={() => setOuverte(c.id)} label={`Ouvrir ${c.titre}`} />
                ))}
              </Liste>
            </Pliable>
          ) : null}
        </>
      )}
      {nouvelle ? (
        <FormCollecte
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

/** L'onglet Cotisations des Finances : les tontines, l'annuaire, et les collectes auprès de personnes sans compte. */
export function PanneauCotisations({ devise }: { devise: string }) {
  const [vue, setVue] = useState<'groupes' | 'annuaire' | 'collectes'>('groupes');
  const [groupe, setGroupe] = useState<string | null>(null);
  const [collecte, setCollecte] = useState<string | null>(null);
  // Dans un groupe ou une collecte, les onglets s'effacent : l'écran ne montre que ce qui compte.
  const dansDetail = vue === 'groupes' ? !!groupe : vue === 'collectes' ? !!collecte : false;
  return (
    <View style={{ gap: 12 }}>
      {dansDetail ? null : (
        <SousOnglets
          label="Cotisations"
          options={[
            { key: 'groupes', label: 'Mes groupes' },
            { key: 'annuaire', label: 'Annuaire' },
            { key: 'collectes', label: 'Collectes' },
          ]}
          value={vue}
          onChange={setVue}
        />
      )}
      {vue === 'collectes' ? <PanneauCollectes devise={devise} ouverte={collecte} setOuverte={setCollecte} /> : <PanneauTontines vue={vue} devise={devise === 'CDF' ? 'CDF' : 'USD'} ouvert={groupe} setOuvert={setGroupe} onAnnuaire={() => setVue('annuaire')} />}
    </View>
  );
}
