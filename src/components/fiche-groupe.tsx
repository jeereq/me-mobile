import { useWindowDimensions, View } from 'react-native';

import { AvatarMembre } from '@/components/photo-profil';
import { Text } from '@/components/texte';
import { COMMISSION_BPS, montantCotisation, montantTontine, repartitionCagnotte, tauxCommission } from '@/lib/commun/cotisations';
import type { Groupe } from '@/lib/tontines';
import { C, F } from '@/lib/theme';

const dateCourte = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

/** Une case de la fiche : son titre, la valeur en grand, et une précision. */
function Case({ titre, valeur, detail, avatar, accent }: { titre: string; valeur: string; detail?: string; avatar?: { nom: string; photo?: string | null } | null; accent?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${titre} : ${valeur}${detail ? `, ${detail}` : ''}`} style={{ flexGrow: 1, flexBasis: '45%', minWidth: 140, gap: 6, padding: 14, borderRadius: 14, backgroundColor: C.sunk }}>
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{titre}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {avatar ? <AvatarMembre nom={avatar.nom} photo={avatar.photo} taille={28} /> : null}
        <Text numberOfLines={2} style={{ flex: 1, color: accent ? C.accent : C.ink, fontFamily: F.titreM, fontSize: 17 }}>
          {valeur}
        </Text>
      </View>
      {detail ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5, lineHeight: 17 }}>{detail}</Text> : null}
    </View>
  );
}

/**
 * L'essentiel d'un groupe, en tête de sa page : la cotisation en grand, puis le bénéficiaire, l'initiateur, la cagnotte
 * et la commission de Me. Les mêmes chiffres que ceux du serveur : rien n'est recalculé autrement.
 */
export function FicheGroupe({ g }: { g: Groupe }) {
  const large = useWindowDimensions().width >= 700;
  const objectif = g.mode === 'objectif';
  const bps = g.commissionBps ?? COMMISSION_BPS;
  const actuel = g.tours.find((t) => t.numero === g.tourCourant && (t.etat === 'collecte' || t.etat === 'a_verser'));
  const prochain = g.tours.find((t) => t.etat === 'a_venir');
  const recu = objectif ? repartitionCagnotte(g.collecte, 1, bps) : null;

  const beneficiaire = objectif
    ? { valeur: g.beneficiaireNom || 'Bénéficiaire', detail: g.raison ?? undefined, avatar: g.beneficiaireNom ? { nom: g.beneficiaireNom } : undefined }
    : actuel
      ? { valeur: actuel.pourMoi ? 'Toi' : actuel.beneficiaire, detail: `Tour ${actuel.numero} sur ${g.places}, le ${dateCourte(actuel.echeance)}${prochain ? `. Ensuite : ${prochain.pourMoi ? 'toi' : prochain.beneficiaire.split(' ')[0]}` : ''}`, avatar: { nom: actuel.beneficiaire } }
      : g.etat === 'termine'
        ? { valeur: 'Tous servis', detail: `${g.places} tours versés` }
        : { valeur: 'Au démarrage', detail: g.regles?.ordre === 'organisateur' ? 'Ordre choisi par l’initiateur.' : g.regles?.ordre === 'arrivee' ? 'Ordre d’arrivée dans le groupe.' : 'Ordre tiré au sort.' };

  return (
    <View style={{ gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>Cotisation</Text>
        <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: large ? 32 : 28 }}>{montantTontine(g.montant, g.devise, g.rythme)}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Case titre={objectif ? 'Bénéficiaire' : 'Reçoit ce tour'} valeur={beneficiaire.valeur} detail={beneficiaire.detail} avatar={large ? beneficiaire.avatar : null} accent={!objectif && actuel?.pourMoi} />
        <Case titre="Initiateur" valeur={g.suisOrganisateur ? 'Toi' : g.organisateur || 'Inconnu'} detail={g.visibilite === 'prive' ? 'Groupe sur invitation' : 'Groupe de l’annuaire'} avatar={large ? { nom: g.organisateur, photo: g.organisateurPhoto } : null} />
        <Case
          titre={objectif ? 'Collecté' : 'Cagnotte par tour'}
          valeur={montantCotisation(objectif ? g.collecte : g.brut, g.devise)}
          detail={objectif ? `Sur ${montantCotisation(g.totalPrevu, g.devise)} prévus${recu ? `, ${montantCotisation(recu.net, g.devise)} pour le bénéficiaire` : ''}` : `${montantCotisation(g.net, g.devise)} versés au bénéficiaire`}
        />
        <Case titre="Commission de Me" valeur={tauxCommission(bps)} detail={objectif ? `${montantCotisation(recu?.commission ?? 0, g.devise)} sur ce qui est collecté` : `${montantCotisation(g.commission, g.devise)} par tour, retenus sur la cagnotte`} />
      </View>
    </View>
  );
}
