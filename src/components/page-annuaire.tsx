import { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { BarreAnnuaire, ListeAnnuaire, useAnnuaire } from '@/components/annuaire';
import { GrandTitre } from '@/components/cotisations-ui';
import { Bloc, Bouton, EntetePublic, SEUIL_PUBLIC } from '@/components/entete-public';
import { Illustration } from '@/components/illustrations';
import { RecapGroupe } from '@/components/tontines';
import { Dialogue, T } from '@/components/ui';
import { FILTRES_VIDES } from '@/lib/annuaire';
import { useZonesSures } from '@/lib/mise-en-page';
import { C } from '@/lib/theme';
import { Tontines, type CarteGroupe } from '@/lib/tontines';

/** L'annuaire ouvert à tous (/annuaire) : on voit les groupes sans compte, et on s'inscrit pour demander à rejoindre. */
export function PageAnnuairePublic({ onAccueil, onConnexion, onInscription }: { onAccueil: () => void; onConnexion: () => void; onInscription: () => void }) {
  const large = useWindowDimensions().width >= SEUIL_PUBLIC;
  const { haut } = useZonesSures();
  const { q, setQ, filtres, setFiltres, groupes, erreur } = useAnnuaire(Tontines.annuairePublic);
  const [choisi, setChoisi] = useState<CarteGroupe | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: haut }}>
      <ScrollView stickyHeaderIndices={[0]}>
        <EntetePublic onLogo={onAccueil} logoLabel="Me, page d’accueil" onConnexion={onConnexion} onInscription={onInscription} />
        <Bloc large={large} style={{ gap: 16, paddingVertical: large ? 56 : 24, maxWidth: 960, width: '100%', alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <GrandTitre>Annuaire des cotisations</GrandTitre>
              <T muted>Trouve un groupe et demande à le rejoindre.</T>
            </View>
            <Illustration nom="annuaire" largeur={large ? 170 : 110} />
          </View>
          <BarreAnnuaire q={q} setQ={setQ} filtres={filtres} setFiltres={setFiltres} />
          <ListeAnnuaire groupes={groupes} erreur={erreur} filtres={filtres} onEffacer={() => setFiltres(FILTRES_VIDES)} onChoisir={(g) => () => setChoisi(g)} />
        </Bloc>
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
