import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, useWindowDimensions, View } from 'react-native';

import { Cadre, Erreur, GrandTitre, Ligne, Liste } from '@/components/cotisations-ui';
import { Bloc, Bouton, EntetePublic, SEUIL_PUBLIC } from '@/components/entete-public';
import { BadgeGroupe, Illustration } from '@/components/illustrations';
import { RecapGroupe } from '@/components/tontines';
import { Dialogue, Input, T } from '@/components/ui';
import { montantTontine } from '@/lib/commun/cotisations';
import { useZonesSures } from '@/lib/mise-en-page';
import { C } from '@/lib/theme';
import { Tontines, type CarteGroupe } from '@/lib/tontines';

/** L'annuaire ouvert à tous (/annuaire) : on voit les groupes sans compte, et on s'inscrit pour demander à rejoindre. */
export function PageAnnuairePublic({ onAccueil, onConnexion, onInscription }: { onAccueil: () => void; onConnexion: () => void; onInscription: () => void }) {
  const large = useWindowDimensions().width >= SEUIL_PUBLIC;
  const { haut } = useZonesSures();
  const [q, setQ] = useState('');
  const [groupes, setGroupes] = useState<CarteGroupe[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [choisi, setChoisi] = useState<CarteGroupe | null>(null);

  useEffect(() => {
    let fini = false;
    const t = setTimeout(() => {
      Tontines.annuairePublic(q.trim())
        .then((r) => {
          if (!fini) setGroupes(r.groupes);
        })
        .catch((e: Error) => {
          if (!fini) setErreur(e.message);
        });
    }, 250);
    return () => {
      fini = true;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: haut }}>
      <ScrollView stickyHeaderIndices={[0]}>
        <EntetePublic onLogo={onAccueil} logoLabel="Me, page d’accueil" onConnexion={onConnexion} onInscription={onInscription} />
        <Bloc large={large} style={{ gap: 16, paddingVertical: large ? 56 : 24, maxWidth: 760 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <GrandTitre>Annuaire des cotisations</GrandTitre>
              <T muted>Trouve un groupe et demande à le rejoindre.</T>
            </View>
            <Illustration nom="annuaire" largeur={large ? 170 : 110} />
          </View>
          <Input placeholder="Chercher un groupe" value={q} onChangeText={setQ} accessibilityLabel="Chercher un groupe" />
          {erreur ? <Erreur texte={erreur} /> : null}
          {!groupes && !erreur ? <ActivityIndicator color={C.accent} /> : null}
          {groupes && !groupes.length ? (
            <Cadre>
              <T muted>Aucun groupe ouvert pour l’instant.</T>
            </Cadre>
          ) : null}
          {groupes?.length ? (
            <Liste>
              {groupes.map((g, i) => {
                const libres = g.places - g.inscrits;
                return (
                  <Ligne
                    key={g.id}
                    premiere={i === 0}
                    gauche={<BadgeGroupe mode={g.mode} />}
                    titre={g.nom}
                    sous={`${g.mode === 'objectif' && g.raison ? `${g.raison}, ` : ''}${montantTontine(g.montant, g.devise, g.rythme)}, ${libres} place${libres > 1 ? 's' : ''}${g.organisateur ? `, par ${g.organisateur}` : ''}`}
                    onPress={() => setChoisi(g)}
                    label={`Voir ${g.nom}`}
                  />
                );
              })}
            </Liste>
          ) : null}
          <T small muted>
            Pour rejoindre : un compte avec Finances, une photo de profil et un compte approuvé.
          </T>
        </Bloc>
      </ScrollView>
      {choisi ? (
        <Dialogue titre={choisi.nom} onFermer={() => setChoisi(null)}>
          <RecapGroupe g={choisi} />
          <View style={{ gap: 8 }}>
            <Bouton grand label="Créer mon compte" onPress={onInscription} />
            <Bouton kind="surface" label="Me connecter" onPress={onConnexion} />
          </View>
        </Dialogue>
      ) : null}
    </View>
  );
}
