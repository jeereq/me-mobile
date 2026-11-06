import { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { BarreAnnuaire, ListeAnnuaire, useAnnuaire } from '@/components/annuaire';
import { Cadre } from '@/components/cotisations-ui';
import { Bloc, Bouton, EntetePublic, SEUIL_PUBLIC, type Section } from '@/components/entete-public';
import { PiedPublic } from '@/components/pied-public';
import { Text } from '@/components/texte';
import { RecapGroupe } from '@/components/tontines';
import { Dialogue, T } from '@/components/ui';
import { FILTRES_VIDES } from '@/lib/annuaire';
import { useZonesSures } from '@/lib/mise-en-page';
import { C, F } from '@/lib/theme';
import { Tontines, type CarteGroupe } from '@/lib/tontines';

/** L'annuaire ouvert à tous (/annuaire) : on voit les groupes sans compte, et on s'inscrit pour demander à rejoindre. */
export function PageAnnuairePublic({ onAccueil, onSection, onContact, onConnexion, onInscription }: {
  onAccueil: () => void;
  onSection: (s: Section) => void;
  onContact: () => void;
  onConnexion: () => void;
  onInscription: () => void;
}) {
  const largeur = useWindowDimensions().width;
  const large = largeur >= SEUIL_PUBLIC;
  const { haut } = useZonesSures();
  const { q, setQ, filtres, setFiltres, groupes, erreur } = useAnnuaire(Tontines.annuairePublic);
  const [choisi, setChoisi] = useState<CarteGroupe | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: haut }}>
      <ScrollView stickyHeaderIndices={[0]}>
        <EntetePublic annuaireActif onLogo={onAccueil} logoLabel="Me, page d’accueil" onSection={onSection} onAnnuaire={() => {}} onConnexion={onConnexion} onInscription={onInscription} />
        <Bloc style={{ gap: large ? 24 : 16, paddingTop: large ? 44 : 20, paddingBottom: large ? 64 : 36 }}>
          <View style={{ gap: large ? 8 : 4 }}>
            <Text accessibilityRole="header" aria-level={1} style={{ color: C.ink, fontFamily: F.titre, fontSize: large ? 40 : 26, lineHeight: large ? 46 : 32, letterSpacing: large ? -1 : -0.5 }}>
              Annuaire des cotisations
            </Text>
            <T muted>Trouve un groupe et demande à le rejoindre.</T>
          </View>
          <BarreAnnuaire enLigne={large} q={q} setQ={setQ} filtres={filtres} setFiltres={setFiltres} />
          <ListeAnnuaire colonnes={largeur >= 1180 ? 3 : largeur >= 720 ? 2 : 1} groupes={groupes} erreur={erreur} filtres={filtres} onEffacer={() => setFiltres(FILTRES_VIDES)} onChoisir={(g) => () => setChoisi(g)} />
        </Bloc>
        <Bloc style={{ paddingBottom: large ? 88 : 48 }}>
          <Cadre>
            <View style={{ flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', justifyContent: 'space-between', gap: 14 }}>
              <Text style={{ flexShrink: 1, color: C.ink, fontFamily: F.titreM, fontSize: large ? 22 : 18 }}>Aucun groupe ne te convient ? Crée le tien.</Text>
              <Bouton label="Créer mon compte" onPress={onInscription} />
            </View>
          </Cadre>
        </Bloc>
        <PiedPublic large={large} aller={onSection} onContact={onContact} />
      </ScrollView>
      {choisi ? (
        <Dialogue titre={choisi.nom} onFermer={() => setChoisi(null)}>
          <RecapGroupe g={choisi} />
          <T small muted>
            Pour rejoindre : Finances, une photo de profil et un compte approuvé.
          </T>
          <View style={{ gap: 8 }}>
            <Bouton grand label="Créer mon compte" onPress={onInscription} />
            <Bouton kind="surface" label="Me connecter" onPress={onConnexion} />
          </View>
        </Dialogue>
      ) : null}
    </View>
  );
}
