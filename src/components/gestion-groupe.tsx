import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ActionDiscrete, Etat, Ligne, Liste } from '@/components/cotisations-ui';
import { AvatarMembre } from '@/components/photo-profil';
import { ChampTelephone, useTelephone } from '@/components/telephone';
import { Text } from '@/components/texte';
import { Btn, Dialogue, T } from '@/components/ui';
import { montantCotisation, repartitionCagnotte } from '@/lib/commun/cotisations';
import { type ChangementGroupe, type Groupe, type MembreGroupe, Tontines } from '@/lib/tontines';
import { alpha, C, F } from '@/lib/theme';

const dateLongue = (s: string) => new Date(s.length === 10 ? `${s}T12:00:00Z` : s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
const prenom = (nom: string) => nom.split(' ')[0] ?? nom;

/** Le tour qu'attend un versement : complet (à verser) ou en collecte. */
export function versementAttendu(g: Groupe) {
  if (g.mode === 'objectif') return g.final?.etat === 'a_verser' ? { pret: true, demandeLe: g.final.versementDemandeLe } : null;
  const t = g.tours.find((x) => x.etat === 'a_verser');
  return t ? { pret: true, demandeLe: t.versementDemandeLe } : null;
}

/** Pour l'initiateur : les cagnottes complètes dont le versement n'est pas encore demandé. */
export function aDemanderVersement(groupes: Groupe[]) {
  return groupes.filter((g) => g.suisOrganisateur && versementAttendu(g)?.pret && !versementAttendu(g)?.demandeLe);
}

/** En tête de « Mes groupes » : les versements que l'initiateur doit demander. */
export function VersementsADemander({ groupes, onOuvrir }: { groupes: Groupe[]; onOuvrir: (id: string) => void }) {
  const liste = aDemanderVersement(groupes);
  if (!liste.length) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOuvrir(liste[0].id)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: alpha(C.coach, 0.45), backgroundColor: alpha(C.coach, 0.08), opacity: pressed ? 0.8 : 1 })}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>{liste.length === 1 ? 'Cagnotte complète' : `${liste.length} cagnottes complètes`}</Text>
        <T small muted>
          {liste.length === 1 ? `« ${liste[0].nom} » : demande le versement.` : 'Demande leur versement.'}
        </T>
      </View>
      <Text style={{ color: C.coach, fontFamily: F.texteF, fontSize: 14 }}>Demander</Text>
    </Pressable>
  );
}

/**
 * Pour l'initiateur et ses adjoints : où en est le versement, à tout moment. Ce qui manque avant de pouvoir le demander,
 * le bouton quand la cagnotte est complète, et la clôture anticipée d'une raison précise.
 */
export function EtapeVersement({ g, agir }: { g: Groupe; agir: (a: () => Promise<Groupe>) => void }) {
  const [confirmer, setConfirmer] = useState(false);
  if (!g.suisOrganisateur || g.etat !== 'en_cours') return null;
  const objectif = g.mode === 'objectif';
  const pret = versementAttendu(g);
  const tourPret = objectif ? null : g.tours.find((t) => t.etat === 'a_verser');
  const actuel = g.tours.find((t) => t.numero === g.tourCourant && t.etat === 'collecte');
  const pour = objectif ? g.beneficiaireNom || 'le bénéficiaire' : tourPret ? (tourPret.pourMoi ? 'toi' : prenom(tourPret.beneficiaire)) : actuel ? (actuel.pourMoi ? 'toi' : prenom(actuel.beneficiaire)) : '';
  const net = objectif ? (g.final?.net ?? repartitionCagnotte(g.collecte, 1, g.commissionBps ?? 500).net) : (tourPret ?? actuel)?.net ?? g.net;
  const manquent = objectif ? [] : g.membres.filter((m) => !m.aCotise);
  // Versement en tranches (serveur récent) : ce qui est déjà arrivé peut partir avant la cagnotte complète.
  const v = g.versement;
  const dejaVerse = v?.verse ?? 0;
  const disponible = v?.disponible ?? 0;
  const tranche = !pret && !!v && disponible > 0;
  const trancheDemandee = !!v?.trancheDemandeLe && v.trancheDemandeLe.slice(0, 10) >= g.jour;

  let etat: string;
  let detail: string | null = null;
  if (pret) {
    etat = pret.demandeLe ? `Demandé le ${dateLongue(pret.demandeLe)}` : 'Cagnotte complète';
    detail = pret.demandeLe ? 'L’équipe de Me valide puis verse sur le numéro du bénéficiaire.' : 'Demande le versement : l’équipe de Me valide puis verse.';
  } else if (objectif) {
    etat = g.dateFin ? `Après le ${dateLongue(g.dateFin)}` : 'À la clôture';
    detail = 'Tu peux clôturer avant pour demander le versement de ce qui est réuni.';
  } else {
    const noms = manquent.map((m) => (m.id === g.moi?.id ? 'toi' : prenom(m.nom)));
    const liste = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}` : (noms[0] ?? '');
    etat = manquent.length ? `Il manque ${manquent.length} cotisation${manquent.length > 1 ? 's' : ''}` : 'Paiements en validation';
    detail = manquent.length ? `${liste.charAt(0).toUpperCase()}${liste.slice(1)} ${manquent.length > 1 ? 'doivent' : 'doit'} encore payer.${v ? '' : ' Le versement se demande quand tout le monde a payé.'}` : null;
  }
  const lignesTranche = [dejaVerse ? `Déjà versé : ${montantCotisation(dejaVerse, g.devise)}.` : '', tranche ? `Disponible maintenant : ${montantCotisation(disponible, g.devise)}.` : ''].filter(Boolean).join(' ');
  const relance = !!pret?.demandeLe && pret.demandeLe.slice(0, 10) < g.jour;

  return (
    <View accessibilityLabel={`Versement à ${pour}`} style={{ gap: 10, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: pret && !pret.demandeLe ? alpha(C.coach, 0.5) : C.line, backgroundColor: C.surface }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
        <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>
          Versement à {pour} : {montantCotisation(v?.net || net, g.devise)}
        </Text>
        <Etat texte={etat} couleur={pret ? C.coach : C.muted} />
      </View>
      {detail ? (
        <T small muted>
          {detail}
        </T>
      ) : null}
      {lignesTranche ? <T small>{lignesTranche}</T> : null}
      {tranche ? (
        trancheDemandee ? (
          <T small style={{ color: C.coach }}>
            Tranche demandée le {dateLongue(v!.trancheDemandeLe!)} : l’équipe de Me la verse.
          </T>
        ) : (
          <Btn kind="sec" label={`Demander une tranche de ${montantCotisation(disponible, g.devise)}`} onPress={() => agir(() => Tontines.demanderVersement(g.id))} />
        )
      ) : null}
      {pret && (!pret.demandeLe || relance) ? <Btn kind={pret.demandeLe ? 'sec' : 'primary'} label={pret.demandeLe ? 'Relancer la demande' : `Demander le versement${dejaVerse ? ` du reste (${montantCotisation(disponible, g.devise)})` : ''} à ${pour}`} onPress={() => agir(() => Tontines.demanderVersement(g.id))} /> : null}
      {!pret && objectif && g.cloturable && g.collecte > 0 ? (
        confirmer ? (
          <View style={{ gap: 8 }}>
            <T small>Plus personne ne cotise ensuite. {montantCotisation(net, g.devise)} seront versés à {pour}.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Btn
                label="Clôturer maintenant"
                onPress={() => {
                  setConfirmer(false);
                  agir(() => Tontines.cloturer(g.id));
                }}
              />
              <Btn kind="sec" label="Garder ouvert" onPress={() => setConfirmer(false)} />
            </View>
          </View>
        ) : (
          <ActionDiscrete label="Clôturer avant la date" onPress={() => setConfirmer(true)} />
        )
      ) : null}
    </View>
  );
}

/** Les changements en attente : une place cédée, deux tours échangés. Chacun voit ce qu'il doit accepter. */
export function ChangementsEnAttente({ g, agir }: { g: Groupe; agir: (a: () => Promise<Groupe>) => void }) {
  const liste = g.changements ?? [];
  if (!liste.length) return null;
  const titre = (c: ChangementGroupe) => (c.genre === 'echange' ? `${prenom(c.membre)} et ${prenom(c.avec)} échangent leurs tours` : `${prenom(c.membre)} cède sa place${c.avec ? ` à ${prenom(c.avec)}` : c.numero ? ` au ${c.numero}` : ''}`);
  const attente = (c: ChangementGroupe) => {
    const qui = [!c.accords.membre ? prenom(c.membre) : '', !c.accords.autre ? (c.genre === 'echange' ? prenom(c.avec) : c.avec ? prenom(c.avec) : 'la personne invitée') : '', !c.accords.initiateur ? 'l’initiateur' : ''].filter(Boolean);
    return qui.length ? `Attend ${qui.join(', ')}` : 'Accepté';
  };
  return (
    <Liste titre="Changements demandés">
      {liste.map((c, i) => (
        <View key={c.id} style={{ gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>{titre(c)}</Text>
            <T small muted>
              {attente(c)}
            </T>
          </View>
          {c.aDonner ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Btn small label="Accepter" onPress={() => agir(() => Tontines.repondreChangement(c.id, true))} />
              <Btn small kind="sec" label="Refuser" onPress={() => agir(() => Tontines.repondreChangement(c.id, false))} />
            </View>
          ) : c.annulable ? (
            <View style={{ flexDirection: 'row' }}>
              <Btn small kind="sec" label="Annuler la demande" onPress={() => agir(() => Tontines.annulerChangement(c.id))} />
            </View>
          ) : null}
        </View>
      ))}
    </Liste>
  );
}

/** Céder une place : la personne reçoit un lien pour la reprendre. */
export function FormCeder({ g, m, onFermer, onEnvoye }: { g: Groupe; m: MembreGroupe; onFermer: () => void; onEnvoye: (g: Groupe, texte: string) => void }) {
  const tel = useTelephone();
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const moi = m.id === g.moi?.id;
  const envoyer = async () => {
    setEnvoi(true);
    setErreur('');
    try {
      const r = await Tontines.ceder(g.id, m.id, tel.complet);
      const canaux = [r.mail ? 'mail' : '', r.sms ? 'SMS' : ''].filter(Boolean).join(' et ');
      onEnvoye(r.groupe, `Lien envoyé${canaux ? ` par ${canaux}` : ''}. La place change de main quand tout le monde a accepté.`);
    } catch (e) {
      setErreur((e as Error).message);
      setEnvoi(false);
    }
  };
  return (
    <Dialogue titre={moi ? 'Céder ma place' : `Remplacer ${prenom(m.nom)}`} onFermer={onFermer}>
      <T small muted>
        La personne reçoit un lien pour reprendre la place : même tour, et ce qui est déjà payé reste sur la place.{moi ? ' L’initiateur doit accepter.' : ` ${prenom(m.nom)} doit accepter.`}
      </T>
      <ChampTelephone tel={tel} label="Numéro de la personne" />
      {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
      <Btn label="Envoyer le lien" disabled={!tel.valide || envoi} onPress={envoyer} />
    </Dialogue>
  );
}

/** Échanger un tour à venir avec un autre membre dont le tour est aussi à venir. */
export function FormEchanger({ g, m, onFermer, onChoisir }: { g: Groupe; m: MembreGroupe; onFermer: () => void; onChoisir: (avec: MembreGroupe) => void }) {
  const tourDe = (x: MembreGroupe) => g.tours.find((t) => t.numero === x.rang);
  const mien = tourDe(m);
  const autres = g.membres.filter((x) => x.id !== m.id && tourDe(x)?.etat === 'a_venir');
  const moi = m.id === g.moi?.id;
  return (
    <Dialogue titre={moi ? 'Échanger mon tour' : `Échanger le tour de ${prenom(m.nom)}`} onFermer={onFermer}>
      {mien ? (
        <T small muted>
          {moi ? 'Tu reçois' : `${prenom(m.nom)} reçoit`} au tour {mien.numero}, le {dateLongue(mien.echeance)}. L’autre membre et l’initiateur doivent accepter.
        </T>
      ) : null}
      {autres.length ? (
        <Liste>
          {autres.map((x, i) => {
            const t = tourDe(x)!;
            return <Ligne key={x.id} premiere={i === 0} gauche={<AvatarMembre nom={x.nom} photo={x.photo} taille={36} />} titre={x.id === g.moi?.id ? 'Toi' : x.nom} sous={`Tour ${t.numero}, le ${dateLongue(t.echeance)}`} onPress={() => onChoisir(x)} />;
          })}
        </Liste>
      ) : (
        <T small muted>
          Aucun autre tour à venir.
        </T>
      )}
    </Dialogue>
  );
}
