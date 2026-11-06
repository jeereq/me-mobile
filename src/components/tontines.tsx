import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';

import { Jauge } from '@/components/jauge';
import { urlLegale } from '@/components/liens-legaux';
import { ChampTelephone, useTelephone } from '@/components/telephone';
import { Text } from '@/components/texte';
import { Btn, Dialogue, Empty, Input, Panel, Seg, Sep, T } from '@/components/ui';
import { montantCotisation, montantTontine, type RythmeTontine } from '@/lib/commun/cotisations';
import { echeanceDepassee, pretADemarrer } from '@/lib/cotisations';
import { lireMontant } from '@/lib/finances';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';
import { Tontines, type CarteGroupe, type Groupe, type TourGroupe } from '@/lib/tontines';

const SUIVI_MS = 5000;
const LISTE_MS = 30000;
const RYTHMES: { key: RythmeTontine; label: string }[] = [
  { key: 'quotidien', label: 'Chaque jour' },
  { key: 'hebdomadaire', label: 'Chaque semaine' },
  { key: 'mensuel', label: 'Chaque mois' },
];
const ETAT_TOUR: Record<TourGroupe['etat'], string> = { a_venir: 'À venir', collecte: 'Collecte', a_verser: 'À verser', verse: 'Versé' };
const dateCourte = (jour: string) => `${jour.slice(8)}/${jour.slice(5, 7)}/${jour.slice(0, 4)}`;

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

/** Ce qu'on accepte en rejoignant ou en créant un groupe. */
function Conditions({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const url = urlLegale('conditions-tontines');
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel="J’accepte les conditions des tontines" onPress={() => onChange(!on)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? C.accent : C.line, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Text style={{ color: C.bg, fontFamily: F.texteM, fontSize: 14, lineHeight: 16 }}>✓</Text> : null}
      </View>
      <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
        J’accepte les{' '}
        <Text accessibilityRole="link" onPress={() => url && Linking.openURL(url)} style={{ color: C.accent, textDecorationLine: 'underline', fontFamily: F.texte, fontSize: 14 }}>
          conditions des tontines
        </Text>
      </Text>
    </Pressable>
  );
}

function Resume({ g }: { g: Pick<CarteGroupe, 'montant' | 'devise' | 'rythme' | 'places' | 'commission' | 'net'> }) {
  return (
    <View style={{ gap: 4, padding: 12, borderRadius: 14, backgroundColor: C.sunk }}>
      <T small>Caution : {montantCotisation(g.montant, g.devise)}</T>
      <T small>Cotisation : {montantTontine(g.montant, g.devise, g.rythme)}</T>
      <T small>
        Tu reçois une fois : {montantCotisation(g.net, g.devise)} (5 % de commission : {montantCotisation(g.commission, g.devise)})
      </T>
      <T small muted>
        Ordre tiré au sort au démarrage.
      </T>
    </View>
  );
}

function FormGroupe({ devise, onCreer, onFermer }: { devise: 'USD' | 'CDF'; onCreer: (c: Parameters<typeof Tontines.creer>[0]) => void; onFermer: () => void }) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [montant, setMontant] = useState('');
  const [d, setD] = useState<'USD' | 'CDF'>(devise);
  const [rythme, setRythme] = useState<RythmeTontine>('mensuel');
  const [places, setPlaces] = useState('');
  const [accepte, setAccepte] = useState(false);
  const tel = useTelephone();
  const m = lireMontant(montant);
  const centimes = m === null ? null : Math.round(m * 100);
  const n = Number(places);
  const ok = nom.trim().length >= 2 && centimes !== null && centimes >= 100 && Number.isInteger(n) && n >= 2 && n <= 50 && tel.valide && accepte;
  return (
    <Dialogue titre="Nouveau groupe" onFermer={onFermer}>
      <Input label="Nom" placeholder="Tontine des commerçants" value={nom} onChangeText={setNom} autoFocus />
      <Input label="Description (facultatif)" value={description} onChangeText={setDescription} />
      <Input label={`Cotisation par membre (${d})`} placeholder="10" value={montant} onChangeText={setMontant} keyboardType="decimal-pad" />
      <Seg
        label="Devise"
        options={[
          { key: 'USD', label: 'USD' },
          { key: 'CDF', label: 'CDF' },
        ]}
        value={d}
        onChange={setD}
      />
      <Seg label="Rythme" options={RYTHMES} value={rythme} onChange={setRythme} />
      <Input label="Nombre de membres, toi compris" placeholder="10" value={places} onChangeText={setPlaces} keyboardType="number-pad" />
      <ChampTelephone tel={tel} label="Ton numéro mobile money" />
      <Conditions on={accepte} onChange={setAccepte} />
      <View style={{ flexDirection: 'row' }}>
        <Btn label="Créer le groupe" disabled={!ok} onPress={() => onCreer({ nom: nom.trim(), description: description.trim() || undefined, montant: centimes!, devise: d, rythme, places: n, telephone: tel.complet, accepte: true })} />
      </View>
    </Dialogue>
  );
}

function FormAdhesion({ g, onEnvoyer, onFermer }: { g: CarteGroupe; onEnvoyer: (telephone: string) => void; onFermer: () => void }) {
  const tel = useTelephone();
  const [accepte, setAccepte] = useState(false);
  return (
    <Dialogue titre={`Rejoindre ${g.nom}`} onFermer={onFermer}>
      <Resume g={g} />
      <ChampTelephone tel={tel} label="Ton numéro mobile money" />
      <Conditions on={accepte} onChange={setAccepte} />
      <View style={{ flexDirection: 'row' }}>
        <Btn label="Envoyer ma demande" disabled={!tel.valide || !accepte} onPress={() => onEnvoyer(tel.complet)} />
      </View>
    </Dialogue>
  );
}

function CarteAnnuaire({ g, onRejoindre }: { g: CarteGroupe; onRejoindre: () => void }) {
  return (
    <View style={{ gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
      <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>
        {g.nom}
      </Text>
      {g.description ? (
        <T small muted>
          {g.description}
        </T>
      ) : null}
      <T small>{montantTontine(g.montant, g.devise, g.rythme)}</T>
      <Jauge ratio={g.inscrits / g.places} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <T small muted>
          {g.inscrits} sur {g.places} membres{g.organisateur ? `, par ${g.organisateur}` : ''}
        </T>
        {g.monEtat === 'demande' ? (
          <T small muted>
            Demande envoyée
          </T>
        ) : g.monEtat === 'accepte' ? (
          <T small muted>
            Tu es membre
          </T>
        ) : g.monEtat === 'refuse' ? null : (
          <Btn small label="Rejoindre" onPress={onRejoindre} />
        )}
      </View>
    </View>
  );
}

/** Le paiement du membre : la demande arrive sur son téléphone, l'app suit la validation. */
function MonPaiement({ g, agir }: { g: Groupe; agir: (a: () => Promise<Groupe>) => void }) {
  if (g.enAttente) {
    return (
      <Panel accent>
        <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator color={C.accent} />
          <T style={{ flex: 1 }}>Valide la demande sur le {g.moi?.telephone}.</T>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Btn kind="sec" small label="Je n’ai rien reçu" onPress={() => agir(() => Tontines.abandonner(g.id))} />
        </View>
      </Panel>
    );
  }
  if (!g.aPayer) return null;
  const { genre, montant } = g.aPayer;
  return (
    <Panel accent>
      {g.refus ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>Le paiement n’a pas abouti. Réessaie.</Text> : null}
      {g.paiementOuvert ? (
        <>
          <Btn label={`Payer ${genre === 'caution' ? 'ma caution' : 'ma cotisation'} : ${montantCotisation(montant, g.devise)}`} onPress={() => agir(() => Tontines.payer(g.id, genre))} />
          <T small muted>
            La demande arrivera sur le {g.moi?.telephone}.
          </T>
        </>
      ) : (
        <T small muted>
          Paiement pas encore ouvert.
        </T>
      )}
    </Panel>
  );
}

function DetailGroupe({ g, agir, onRetour }: { g: Groupe; agir: (a: () => Promise<Groupe>) => void; onRetour: () => void }) {
  const [info, setInfo] = useState('');
  const orga = g.suisOrganisateur;
  const encours = g.etat === 'en_cours';
  const actuel = g.tours.find((t) => t.numero === g.tourCourant);
  const depasse = echeanceDepassee(g);
  const rappeler = async (id: string, nom: string) => {
    setInfo('');
    try {
      const r = await Tontines.rappeler(id);
      const canaux = [r.mail ? 'mail' : '', r.sms ? 'SMS' : ''].filter(Boolean).join(' et ');
      setInfo(!r.nouveau ? `${nom} a déjà été rappelé aujourd’hui.` : canaux ? `Rappel envoyé à ${nom} par ${canaux}.` : `Rappel envoyé à ${nom} dans l’app.`);
    } catch (e) {
      setInfo((e as Error).message);
    }
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Btn kind="sec" small label="Retour" onPress={onRetour} />
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" numberOfLines={2} style={{ color: C.ink, fontFamily: F.titreM, fontSize: 20 }}>
            {g.nom}
          </Text>
          <T small muted>
            {montantTontine(g.montant, g.devise, g.rythme)}
            {g.etat === 'termine' ? ', terminé' : g.etat === 'annule' ? ', annulé' : ''}
          </T>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chiffre titre="Cagnotte versée" valeur={montantCotisation(g.net, g.devise)} />
        <Chiffre titre="Commission (5 %)" valeur={montantCotisation(g.commission, g.devise)} />
        <Chiffre titre={encours ? 'Tour' : 'Membres'} valeur={encours ? `${g.tourCourant} sur ${g.places}` : `${g.inscrits} sur ${g.places}`} />
      </View>

      {g.moi?.etat === 'demande' ? <T muted>Ta demande attend la réponse de {g.organisateur || 'l’organisateur'}.</T> : null}
      <MonPaiement g={g} agir={agir} />

      {actuel && encours ? (
        <T>
          {actuel.pourMoi ? 'Tu reçois' : `${actuel.beneficiaire} reçoit`} {montantCotisation(actuel.net, g.devise)} à ce tour. Échéance : {dateCourte(actuel.echeance)}.
          {actuel.etat === 'a_verser' ? ' Versement en cours de validation.' : ''}
        </T>
      ) : null}

      {orga && g.demandes.length ? (
        <Panel title="Demandes" count={g.demandes.length}>
          {g.demandes.map((d, i) => (
            <View key={d.id} style={{ gap: 10 }}>
              {i ? <Sep /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <T style={{ flex: 1, minWidth: 120 }}>{d.nom}</T>
                <Btn small label="Accepter" onPress={() => agir(() => Tontines.decider(d.id, true))} />
                <Btn small kind="sec" label="Refuser" onPress={() => agir(() => Tontines.decider(d.id, false))} />
              </View>
            </View>
          ))}
        </Panel>
      ) : null}

      {orga && g.etat === 'ouvert' ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn label="Démarrer et tirer au sort" disabled={!pretADemarrer(g)} onPress={() => agir(() => Tontines.demarrer(g.id))} />
          <Btn kind="danger" label="Annuler le groupe" onPress={() => agir(() => Tontines.annuler(g.id))} />
        </View>
      ) : null}
      {!orga && g.etat === 'ouvert' && g.moi ? (
        <View style={{ flexDirection: 'row' }}>
          <Btn kind="sec" small label="Quitter le groupe" onPress={() => agir(() => Tontines.quitter(g.id))} />
        </View>
      ) : null}

      {info ? (
        <T small muted>
          {info}
        </T>
      ) : null}

      {g.membres.length ? (
        <Panel title="Membres" count={g.membres.length}>
          {g.membres.map((m, i) => {
            const aRelancer = orga && (encours ? !m.aCotise && actuel?.etat === 'collecte' : g.etat === 'ouvert' && !m.cautionPayee) && m.id !== g.moi?.id;
            return (
              <View key={m.id} style={{ gap: 10 }}>
                {i ? <Sep /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <View style={{ flex: 1, minWidth: 140, gap: 1 }}>
                    <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>
                      {m.nom}
                    </Text>
                    <Text style={{ color: (encours ? m.aCotise : m.cautionPayee) ? C.coach : C.muted, fontFamily: F.texteM, fontSize: 13 }}>
                      {encours ? (m.aCotise ? 'A cotisé' : 'À payer') : m.cautionPayee ? 'Caution payée' : 'Caution à payer'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {aRelancer ? <Btn small kind="sec" label="Rappeler" onPress={() => rappeler(m.id, m.nom)} /> : null}
                    {orga && encours && depasse && !m.aCotise && m.cautionStatut === 'payee' && m.id !== g.moi?.id ? <Btn small kind="sec" label="Utiliser sa caution" onPress={() => agir(() => Tontines.utiliserCaution(m.id))} /> : null}
                  </View>
                </View>
              </View>
            );
          })}
        </Panel>
      ) : null}

      {g.tours.length ? (
        <Panel title="Ordre de réception">
          {g.tours.map((t, i) => (
            <View key={t.numero} style={{ gap: 8 }}>
              {i ? <Sep /> : null}
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <T style={{ width: 24 }} muted>
                  {t.numero}
                </T>
                <Text numberOfLines={1} style={{ flex: 1, color: t.pourMoi ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 15 }}>
                  {t.pourMoi ? 'Toi' : t.beneficiaire}
                </Text>
                <T small muted>
                  {dateCourte(t.echeance)}
                </T>
                <Text style={{ width: 62, textAlign: 'right', color: t.etat === 'verse' ? C.coach : t.etat === 'a_venir' ? C.muted : C.hebdo, fontFamily: F.texteM, fontSize: 13 }}>{ETAT_TOUR[t.etat]}</Text>
              </View>
            </View>
          ))}
        </Panel>
      ) : null}
    </View>
  );
}

function LigneGroupe({ g, onPress }: { g: Groupe; onPress: () => void }) {
  const payes = g.etat === 'en_cours' ? g.membres.filter((m) => m.aCotise).length : g.membres.filter((m) => m.cautionPayee).length;
  const texte =
    g.moi?.etat === 'demande'
      ? 'Demande envoyée'
      : g.etat === 'ouvert'
        ? `${g.inscrits} sur ${g.places} membres`
        : g.etat === 'en_cours'
          ? `Tour ${g.tourCourant} sur ${g.places}, ${payes} sur ${g.places} ont cotisé`
          : g.etat === 'termine'
            ? 'Terminé'
            : 'Annulé';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${g.nom}`} onPress={onPress} style={({ pressed }) => ({ gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>
          {g.nom}
        </Text>
        <T small muted>
          {montantTontine(g.montant, g.devise, g.rythme)}
        </T>
      </View>
      {g.etat === 'en_cours' ? <Jauge ratio={payes / g.places} /> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <T small muted>
          {texte}
        </T>
        {g.aPayer ? <Text style={{ color: C.hebdo, fontFamily: F.texteM, fontSize: 13 }}>{g.aPayer.genre === 'caution' ? 'Caution à payer' : 'À payer'}</Text> : null}
      </View>
    </Pressable>
  );
}

/** Les tontines : mes groupes et l'annuaire. */
export function PanneauTontines({ vue, devise }: { vue: 'groupes' | 'annuaire'; devise: 'USD' | 'CDF' }) {
  const { finances, session } = useStore();
  const [groupes, setGroupes] = useState<Groupe[] | null>(null);
  const [annuaire, setAnnuaire] = useState<CarteGroupe[] | null>(null);
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState<string | null>(null);
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

  if (!session) return <Empty>Connecte-toi pour rejoindre un groupe.</Empty>;
  const message = erreur ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text> : null;

  if (vue === 'annuaire')
    return (
      <View style={{ gap: 12 }}>
        {message}
        <Input placeholder="Chercher un groupe" value={q} onChangeText={setQ} accessibilityLabel="Chercher un groupe" />
        {!annuaire ? <ActivityIndicator color={C.accent} /> : null}
        {annuaire && !annuaire.length ? <Empty>Aucun groupe ouvert.</Empty> : null}
        {annuaire?.map((g) => <CarteAnnuaire key={g.id} g={g} onRejoindre={() => setARejoindre(g)} />)}
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
      {finances ? (
        <View style={{ flexDirection: 'row' }}>
          <Btn label="Créer un groupe" onPress={() => setNouveau(true)} />
        </View>
      ) : null}
      {!groupes && !erreur ? <ActivityIndicator color={C.accent} /> : null}
      {groupes && !groupes.length ? <Empty>Aucun groupe. Rejoins-en un depuis l’annuaire.</Empty> : null}
      {groupes?.map((g) => <LigneGroupe key={g.id} g={g} onPress={() => setOuvert(g.id)} />)}
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

