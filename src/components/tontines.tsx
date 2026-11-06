import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';

import { ActionDiscrete, Cadre, EnteteDetail, Erreur, Etat, GrandTitre, Ligne, Liste, Rang, Recap } from '@/components/cotisations-ui';
import { Jauge } from '@/components/jauge';
import { urlLegale } from '@/components/liens-legaux';
import { ChampTelephone, useTelephone } from '@/components/telephone';
import { Text } from '@/components/texte';
import { Btn, Dialogue, Empty, Input, Seg, T } from '@/components/ui';
import { montantCotisation, montantTontine, repartitionCagnotte, type RythmeTontine } from '@/lib/commun/cotisations';
import { echeanceDepassee, pretADemarrer } from '@/lib/cotisations';
import { lireMontant } from '@/lib/finances';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';
import { Tontines, type CarteGroupe, type Groupe, type MembreGroupe, type TourGroupe } from '@/lib/tontines';

const SUIVI_MS = 5000;
const LISTE_MS = 30000;
const RYTHMES: { key: RythmeTontine; label: string }[] = [
  { key: 'quotidien', label: 'Jour' },
  { key: 'hebdomadaire', label: 'Semaine' },
  { key: 'mensuel', label: 'Mois' },
];
const DEVISES: { key: 'USD' | 'CDF'; label: string }[] = [
  { key: 'USD', label: 'USD' },
  { key: 'CDF', label: 'CDF' },
];
const dateCourte = (jour: string) => `${jour.slice(8)}/${jour.slice(5, 7)}/${jour.slice(0, 4)}`;

function Conditions({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const url = urlLegale('conditions-tontines');
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel="J’accepte les conditions des tontines" onPress={() => onChange(!on)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? C.accent : C.line, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Text style={{ color: C.bg, fontFamily: F.texteM, fontSize: 14, lineHeight: 16 }}>✓</Text> : null}
      </View>
      <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
        J’accepte les{' '}
        <Text accessibilityRole="link" onPress={() => url && Linking.openURL(url)} style={{ color: C.accent, textDecorationLine: 'underline', fontFamily: F.texte, fontSize: 14 }}>
          conditions
        </Text>
      </Text>
    </Pressable>
  );
}

function FormGroupe({ devise, onCreer, onFermer }: { devise: 'USD' | 'CDF'; onCreer: (c: Parameters<typeof Tontines.creer>[0]) => void; onFermer: () => void }) {
  const [nom, setNom] = useState('');
  const [montant, setMontant] = useState('');
  const [d, setD] = useState<'USD' | 'CDF'>(devise);
  const [rythme, setRythme] = useState<RythmeTontine>('mensuel');
  const [places, setPlaces] = useState('');
  const [accepte, setAccepte] = useState(false);
  const tel = useTelephone();
  const m = lireMontant(montant);
  const centimes = m === null ? null : Math.round(m * 100);
  const n = Number(places);
  const nombreOk = Number.isInteger(n) && n >= 2 && n <= 50;
  const montantOk = centimes !== null && centimes >= 100;
  const part = montantOk && nombreOk ? repartitionCagnotte(centimes, n) : null;
  return (
    <Dialogue titre="Nouveau groupe" onFermer={onFermer}>
      <Input label="Nom" placeholder="Tontine de la famille" value={nom} onChangeText={setNom} autoFocus />
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Input label="Cotisation" placeholder="10" value={montant} onChangeText={setMontant} keyboardType="decimal-pad" />
        </View>
        <View style={{ width: 128 }}>
          <Seg options={DEVISES} value={d} onChange={setD} />
        </View>
      </View>
      <Seg label="Chaque" options={RYTHMES} value={rythme} onChange={setRythme} />
      <Input label="Membres, toi compris" placeholder="10" value={places} onChangeText={setPlaces} keyboardType="number-pad" />
      {part ? <Recap lignes={[['Chacun reçoit', montantCotisation(part.net, d)], ['Commission', montantCotisation(part.commission, d)]]} /> : null}
      <ChampTelephone tel={tel} label="Ton numéro mobile money" />
      <Conditions on={accepte} onChange={setAccepte} />
      <Btn label="Créer le groupe" disabled={nom.trim().length < 2 || !part || !tel.valide || !accepte} onPress={() => onCreer({ nom: nom.trim(), montant: centimes!, devise: d, rythme, places: n, telephone: tel.complet, accepte: true })} />
    </Dialogue>
  );
}

function FormAdhesion({ g, onEnvoyer, onFermer }: { g: CarteGroupe; onEnvoyer: (telephone: string) => void; onFermer: () => void }) {
  const tel = useTelephone();
  const [accepte, setAccepte] = useState(false);
  return (
    <Dialogue titre={g.nom} onFermer={onFermer}>
      <Recap
        lignes={[
          ['Cotisation', montantTontine(g.montant, g.devise, g.rythme)],
          ['Caution', montantCotisation(g.montant, g.devise)],
          ['Tu reçois', montantCotisation(g.net, g.devise)],
          ['Commission', montantCotisation(g.commission, g.devise)],
        ]}
      />
      <ChampTelephone tel={tel} label="Ton numéro mobile money" />
      <Conditions on={accepte} onChange={setAccepte} />
      <Btn label="Demander à rejoindre" disabled={!tel.valide || !accepte} onPress={() => onEnvoyer(tel.complet)} />
    </Dialogue>
  );
}

/** Ce qui se passe maintenant dans le groupe, et la seule action utile à cet instant. */
function Maintenant({ g, agir }: { g: Groupe; agir: (a: () => Promise<Groupe>) => void }) {
  const encours = g.etat === 'en_cours';
  const actuel = g.tours.find((t) => t.numero === g.tourCourant);
  const cotises = g.membres.filter((m) => m.aCotise).length;
  const cautions = g.membres.filter((m) => m.cautionPayee).length;
  const pret = pretADemarrer(g);

  if (g.etat === 'termine' || g.etat === 'annule') {
    return (
      <Cadre>
        <GrandTitre>{g.etat === 'termine' ? 'Tontine terminée' : 'Groupe annulé'}</GrandTitre>
      </Cadre>
    );
  }
  if (g.moi?.etat === 'demande') {
    return (
      <Cadre>
        <GrandTitre>Demande envoyée</GrandTitre>
        <T muted>Réponse de {g.organisateur || 'l’organisateur'} à venir.</T>
      </Cadre>
    );
  }

  const titre = encours && actuel ? `${actuel.pourMoi ? 'Tu reçois' : `${actuel.beneficiaire.split(' ')[0]} reçoit`} ${montantCotisation(actuel.net, g.devise)}` : `${g.inscrits} membres sur ${g.places}`;
  const ratio = encours ? cotises / g.places : g.inscrits / g.places;
  const detail = encours && actuel ? `${cotises} sur ${g.places} ont cotisé, avant le ${dateCourte(actuel.echeance)}` : g.inscrits < g.places ? `Il manque ${g.places - g.inscrits} membre${g.places - g.inscrits > 1 ? 's' : ''}` : `${cautions} caution${cautions > 1 ? 's' : ''} sur ${g.places}`;

  return (
    <Cadre>
      <GrandTitre>{titre}</GrandTitre>
      <View style={{ gap: 6 }}>
        <Jauge ratio={ratio} hauteur={6} />
        <T small muted>
          {detail}
        </T>
      </View>
      {actuel?.etat === 'a_verser' ? <T>Cagnotte complète. Versement en cours de validation.</T> : null}
      {g.refus && !g.enAttente ? <Erreur texte="Le paiement n’a pas abouti. Réessaie." /> : null}
      {g.enAttente ? (
        <>
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={C.accent} />
            <T style={{ flex: 1 }}>Valide sur le {g.moi?.telephone}</T>
          </View>
          <Btn kind="sec" label="Je n’ai rien reçu" onPress={() => agir(() => Tontines.abandonner(g.id))} />
        </>
      ) : g.aPayer && g.paiementOuvert ? (
        <>
          <Btn label={`Payer ${g.aPayer.genre === 'caution' ? 'la caution' : ''} ${montantCotisation(g.aPayer.montant, g.devise)}`.replace('  ', ' ')} onPress={() => agir(() => Tontines.payer(g.id, g.aPayer!.genre))} />
          <T small muted>
            Sur le {g.moi?.telephone}
          </T>
        </>
      ) : g.aPayer ? (
        <T small muted>
          Paiement bientôt ouvert
        </T>
      ) : null}
      {g.suisOrganisateur && g.etat === 'ouvert' && !g.aPayer && !g.enAttente ? <Btn label="Démarrer et tirer au sort" disabled={!pret} onPress={() => agir(() => Tontines.demarrer(g.id))} /> : null}
    </Cadre>
  );
}

function ActionsMembre({ g, m, onRappeler, onCaution, onFermer }: { g: Groupe; m: MembreGroupe; onRappeler?: () => void; onCaution?: () => void; onFermer: () => void }) {
  return (
    <Dialogue titre={m.nom} onFermer={onFermer}>
      {onRappeler ? <Btn label="Rappeler par mail et SMS" onPress={onRappeler} /> : null}
      {onCaution ? <Btn kind="sec" label={`Couvrir avec sa caution (${montantCotisation(g.montant, g.devise)})`} onPress={onCaution} /> : null}
    </Dialogue>
  );
}

function sousTour(t: TourGroupe) {
  if (t.etat === 'verse') return 'A reçu';
  if (t.etat === 'a_verser') return 'Versement en cours';
  if (t.etat === 'collecte') return `Reçoit à ce tour, ${dateCourte(t.echeance)}`;
  return `Reçoit le ${dateCourte(t.echeance)}`;
}

function DetailGroupe({ g, agir, onRetour }: { g: Groupe; agir: (a: () => Promise<Groupe>) => void; onRetour: () => void }) {
  const [info, setInfo] = useState('');
  const [choisi, setChoisi] = useState<string | null>(null);
  const orga = g.suisOrganisateur;
  const encours = g.etat === 'en_cours';
  const actuel = g.tours.find((t) => t.numero === g.tourCourant);
  const depasse = echeanceDepassee(g);

  const peutRappeler = (m: MembreGroupe) => orga && m.id !== g.moi?.id && (encours ? !m.aCotise && actuel?.etat === 'collecte' : g.etat === 'ouvert' && !m.cautionPayee);
  const peutCouvrir = (m: MembreGroupe) => orga && m.id !== g.moi?.id && encours && depasse && !m.aCotise && m.cautionStatut === 'payee';
  const aDesActions = (m: MembreGroupe) => peutRappeler(m) || peutCouvrir(m);
  const cible = choisi ? g.membres.find((m) => m.id === choisi) : undefined;

  const rappeler = async (m: MembreGroupe) => {
    setChoisi(null);
    setInfo('');
    try {
      const r = await Tontines.rappeler(m.id);
      const canaux = [r.mail ? 'mail' : '', r.sms ? 'SMS' : ''].filter(Boolean).join(' et ');
      setInfo(!r.nouveau ? `${m.nom} a déjà été rappelé aujourd’hui.` : canaux ? `Rappel envoyé par ${canaux}.` : 'Rappel envoyé dans l’app.');
    } catch (e) {
      setInfo((e as Error).message);
    }
  };

  // Une fois le tirage fait, une seule liste : l'ordre de réception et qui a cotisé.
  const lignesTours = g.tours.map((t, i) => {
    const m = g.membres.find((x) => x.rang === t.numero);
    const courant = encours && t.numero === g.tourCourant;
    return (
      <Ligne
        key={t.numero}
        premiere={i === 0}
        gauche={<Rang n={t.numero} actif={courant} />}
        titre={t.pourMoi ? 'Toi' : t.beneficiaire}
        accent={t.pourMoi}
        sous={sousTour(t)}
        droite={encours && m ? <Etat texte={m.aCotise ? 'Payé' : 'À payer'} couleur={m.aCotise ? C.coach : C.hebdo} /> : undefined}
        onPress={m && aDesActions(m) ? () => setChoisi(m.id) : undefined}
      />
    );
  });

  return (
    <View style={{ gap: 14 }}>
      <EnteteDetail titre={g.nom} sousTitre={montantTontine(g.montant, g.devise, g.rythme)} onRetour={onRetour} />
      <Maintenant g={g} agir={agir} />
      {info ? (
        <T small muted>
          {info}
        </T>
      ) : null}

      {orga && g.demandes.length ? (
        <Liste titre="Demandes">
          {g.demandes.map((d, i) => (
            <Ligne
              key={d.id}
              premiere={i === 0}
              titre={d.nom}
              droite={
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn small kind="sec" label="Refuser" onPress={() => agir(() => Tontines.decider(d.id, false))} />
                  <Btn small label="Accepter" onPress={() => agir(() => Tontines.decider(d.id, true))} />
                </View>
              }
            />
          ))}
        </Liste>
      ) : null}

      {g.tours.length ? <Liste titre="Ordre de réception">{lignesTours}</Liste> : null}
      {!g.tours.length && g.membres.length ? (
        <Liste titre="Membres">
          {g.membres.map((m, i) => (
            <Ligne
              key={m.id}
              premiere={i === 0}
              titre={m.id === g.moi?.id ? 'Toi' : m.nom}
              accent={m.id === g.moi?.id}
              droite={<Etat texte={m.cautionPayee ? 'Caution payée' : 'Caution due'} couleur={m.cautionPayee ? C.coach : C.hebdo} />}
              onPress={aDesActions(m) ? () => setChoisi(m.id) : undefined}
            />
          ))}
        </Liste>
      ) : null}

      {orga && g.etat === 'ouvert' ? <ActionDiscrete danger label="Annuler le groupe" onPress={() => agir(() => Tontines.annuler(g.id))} /> : null}
      {!orga && g.etat === 'ouvert' && g.moi ? <ActionDiscrete label="Quitter le groupe" onPress={() => agir(() => Tontines.quitter(g.id))} /> : null}

      {cible ? (
        <ActionsMembre
          g={g}
          m={cible}
          onFermer={() => setChoisi(null)}
          onRappeler={peutRappeler(cible) ? () => rappeler(cible) : undefined}
          onCaution={
            peutCouvrir(cible)
              ? () => {
                  setChoisi(null);
                  agir(() => Tontines.utiliserCaution(cible.id));
                }
              : undefined
          }
        />
      ) : null}
    </View>
  );
}

function sousGroupe(g: Groupe) {
  if (g.moi?.etat === 'demande') return 'Demande envoyée';
  if (g.etat === 'ouvert') return `${g.inscrits} membres sur ${g.places}, ${montantTontine(g.montant, g.devise, g.rythme)}`;
  if (g.etat === 'en_cours') return `Tour ${g.tourCourant} sur ${g.places}, ${montantTontine(g.montant, g.devise, g.rythme)}`;
  return g.etat === 'termine' ? 'Terminé' : 'Annulé';
}

/** Les tontines : mes groupes et l'annuaire. */
export function PanneauTontines({ vue, devise, ouvert, setOuvert, onAnnuaire }: { vue: 'groupes' | 'annuaire'; devise: 'USD' | 'CDF'; ouvert: string | null; setOuvert: (id: string | null) => void; onAnnuaire: () => void }) {
  const { finances, session } = useStore();
  const [groupes, setGroupes] = useState<Groupe[] | null>(null);
  const [annuaire, setAnnuaire] = useState<CarteGroupe[] | null>(null);
  const [q, setQ] = useState('');
  const [nouveau, setNouveau] = useState(false);
  const [aRejoindre, setARejoindre] = useState<CarteGroupe | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!session || vue !== 'groupes') return;
    const lire = (discret?: boolean) =>
      Tontines.mesGroupes(discret)
        .then((r) => setGroupes(r.groupes))
        .catch((e: Error) => {
          if (!discret) setErreur(e.message);
        });
    lire();
    const t = setInterval(() => lire(true), LISTE_MS);
    return () => clearInterval(t);
  }, [session, vue]);

  useEffect(() => {
    if (!session || vue !== 'annuaire') return;
    let fini = false;
    const t = setTimeout(() => {
      Tontines.annuaire(q.trim(), true)
        .then((r) => {
          if (!fini) setAnnuaire(r.groupes);
        })
        .catch((e: Error) => {
          if (!fini) setErreur(e.message);
        });
    }, 250);
    return () => {
      fini = true;
      clearTimeout(t);
    };
  }, [session, vue, q]);

  const maj = useCallback((g: Groupe) => {
    setGroupes((l) => (l?.some((x) => x.id === g.id) ? l.map((x) => (x.id === g.id ? g : x)) : [g, ...(l ?? [])]));
  }, []);
  const agir = useCallback(
    async (action: () => Promise<Groupe>) => {
      setErreur('');
      try {
        maj(await action());
      } catch (e) {
        setErreur((e as Error).message);
      }
    },
    [maj],
  );

  const detail = ouvert ? groupes?.find((g) => g.id === ouvert) : undefined;
  // Pendant la validation sur le téléphone, le groupe se met à jour seul.
  const attente = !!detail?.enAttente;
  useEffect(() => {
    if (!attente || !ouvert) return;
    const t = setInterval(() => {
      Tontines.detail(ouvert, true)
        .then(maj)
        .catch(() => {});
    }, SUIVI_MS);
    return () => clearInterval(t);
  }, [attente, ouvert, maj]);

  // Ce qui demande un geste passe en premier.
  const tries = useMemo(() => [...(groupes ?? [])].sort((a, b) => Number(!!b.aPayer) - Number(!!a.aPayer)), [groupes]);

  if (!session) return <Empty>Connecte-toi pour rejoindre un groupe.</Empty>;
  const message = erreur ? <Erreur texte={erreur} /> : null;

  if (vue === 'annuaire')
    return (
      <View style={{ gap: 12 }}>
        {message}
        <Input placeholder="Chercher un groupe" value={q} onChangeText={setQ} accessibilityLabel="Chercher un groupe" />
        {!annuaire ? <ActivityIndicator color={C.accent} /> : null}
        {annuaire && !annuaire.length ? <Empty>Aucun groupe ouvert.</Empty> : null}
        {annuaire?.length ? (
          <Liste>
            {annuaire.map((g, i) => {
              const libres = g.places - g.inscrits;
              return (
                <Ligne
                  key={g.id}
                  premiere={i === 0}
                  titre={g.nom}
                  sous={`${montantTontine(g.montant, g.devise, g.rythme)}, ${libres} place${libres > 1 ? 's' : ''}`}
                  droite={g.monEtat === 'demande' ? <Etat texte="Envoyée" couleur={C.muted} /> : g.monEtat === 'accepte' ? <Etat texte="Membre" couleur={C.coach} /> : g.monEtat === 'refuse' ? undefined : <Btn small label="Rejoindre" onPress={() => setARejoindre(g)} />}
                />
              );
            })}
          </Liste>
        ) : null}
        {aRejoindre ? (
          <FormAdhesion
            g={aRejoindre}
            onFermer={() => setARejoindre(null)}
            onEnvoyer={(telephone) => {
              const id = aRejoindre.id;
              setARejoindre(null);
              Tontines.adherer(id, telephone)
                .then((g) => {
                  setAnnuaire((l) => l?.map((x) => (x.id === id ? { ...x, monEtat: g.monEtat } : x)) ?? null);
                  maj(g);
                })
                .catch((e: Error) => setErreur(e.message));
            }}
          />
        ) : null}
      </View>
    );

  if (detail)
    return (
      <View style={{ gap: 12 }}>
        {message}
        <DetailGroupe key={detail.id} g={detail} agir={agir} onRetour={() => setOuvert(null)} />
      </View>
    );

  return (
    <View style={{ gap: 12 }}>
      {message}
      {!groupes && !erreur ? <ActivityIndicator color={C.accent} /> : null}
      {groupes && !groupes.length ? (
        <Cadre>
          <GrandTitre>Aucun groupe</GrandTitre>
          <Btn label="Voir l’annuaire" onPress={onAnnuaire} />
        </Cadre>
      ) : null}
      {tries.length ? (
        <Liste>
          {tries.map((g, i) => (
            <Ligne key={g.id} premiere={i === 0} titre={g.nom} sous={sousGroupe(g)} droite={g.enAttente ? <Etat texte="En cours" couleur={C.hebdo} /> : g.aPayer ? <Etat texte="À payer" couleur={C.hebdo} /> : undefined} onPress={() => setOuvert(g.id)} label={`Ouvrir ${g.nom}`} />
          ))}
        </Liste>
      ) : null}
      {finances ? <Btn kind={groupes?.length ? 'sec' : 'primary'} label="Créer un groupe" onPress={() => setNouveau(true)} /> : null}
      {nouveau ? (
        <FormGroupe
          devise={devise}
          onFermer={() => setNouveau(false)}
          onCreer={(c) => {
            setNouveau(false);
            Tontines.creer(c)
              .then((g) => {
                maj(g);
                setOuvert(g.id);
              })
              .catch((e: Error) => setErreur(e.message));
          }}
        />
      ) : null}
    </View>
  );
}
