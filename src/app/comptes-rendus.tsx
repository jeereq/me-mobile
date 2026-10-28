import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { CompteRenduDetail, LigneCR, suiviCR } from '@/components/comptes-rendus';
import { Filtre } from '@/components/onglets';
import { Btn, Collant, Empty, Header, Panel, Screen, Sep, T } from '@/components/ui';
import { comptesRendusDe, etatCompteRendu, genreCR, nouveauCompteRendu, titreParDefaut, trierComptesRendus } from '@/lib/comptes-rendus';
import { fmtCourt, today, uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import type { CompteRendu } from '@/lib/types';

const estVide = (x: CompteRendu) => !(x.notes.trim() || x.titre.trim() || x.actions.length || x.decisions?.length || x.clotures?.length || x.resume);
const param = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

export default function ComptesRendus() {
  const { espace, update } = useStore();
  const params = useLocalSearchParams();
  const [ouvert, setOuvert] = useState<string | null>(param(params.id) ?? null);
  const [filtre, setFiltre] = useState<'tous' | 'suivre' | 'projets'>('tous');
  const tous = trierComptesRendus(comptesRendusDe(espace));
  const courant = ouvert ? tous.find((x) => x.id === ouvert) : undefined;

  const creer = (lien?: { projet?: string; tache?: string; relance?: string }) => {
    const cr = nouveauCompteRendu({ id: uid(), date: today(), maintenant: new Date().toISOString(), genre: lien?.relance ? 'appel' : lien?.projet ? 'point' : 'reunion', projets: lien?.projet ? [lien.projet] : undefined, taches: lien?.tache ? [lien.tache] : undefined, relances: lien?.relance ? [lien.relance] : undefined });
    // Une tâche de projet rattachée amène aussi son projet : ses autres tâches deviennent clôturables.
    const t = lien?.tache ? espace.taches.find((x) => x.id === lien.tache) : undefined;
    if (t?.projet && !cr.projets) cr.projets = [t.projet];
    update((e) => ({ ...e, comptesRendus: [...comptesRendusDe(e), cr] }));
    setOuvert(cr.id);
  };

  // « + Compte rendu » depuis un projet, une tâche ou une relance : un compte rendu déjà rattaché, une seule fois.
  const fait = useRef(false);
  useEffect(() => {
    if (fait.current || params.nouveau !== '1') return;
    fait.current = true;
    creer({ projet: param(params.projet), tache: param(params.tache), relance: param(params.relance) });
    router.setParams({ nouveau: undefined, projet: undefined, tache: undefined, relance: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.nouveau]);

  // Un compte rendu laissé vide (ouvert par erreur) disparaît quand on le quitte.
  const quitter = () => {
    const id = ouvert;
    setOuvert(null);
    router.setParams({ id: undefined });
    update((e) => ({ ...e, comptesRendus: comptesRendusDe(e).filter((x) => x.id !== id || !estVide(x)) }));
  };

  if (courant)
    return (
      <Screen>
        <Header retour onRetour={quitter} eyebrow={`${genreCR(courant.genre).emoji} ${genreCR(courant.genre).label} · ${fmtCourt(courant.date)}`} title={courant.titre.trim() || titreParDefaut(courant, espace)} />
        {suiviCR(courant, espace) ? <T small muted>{suiviCR(courant, espace)}</T> : null}
        <CompteRenduDetail key={courant.id} cr={courant} retour={() => (setOuvert(null), router.setParams({ id: undefined }))} />
      </Screen>
    );

  // Les comptes rendus vides (créés puis abandonnés) ne s'affichent pas dans la liste.
  const visibles = tous.filter((x) => !estVide(x));
  const aSuivre = visibles.filter((x) => {
    const s = etatCompteRendu(x, espace);
    return s.aConvertir || s.enCours;
  });
  const avecProjet = visibles.filter((x) => x.projets?.length);
  const liste = filtre === 'suivre' ? aSuivre : filtre === 'projets' ? avecProjet : visibles;
  // Par mois : « Octobre 2026 ».
  const mois = new Map<string, typeof liste>();
  for (const x of liste) {
    const k = x.date.slice(0, 7);
    mois.set(k, [...(mois.get(k) ?? []), x]);
  }
  const nomMois = (k: string) => {
    const s = new Date(`${k}-01T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return s[0].toUpperCase() + s.slice(1);
  };

  return (
    <Screen>
      <Header retour eyebrow="Réunions et appels" title="Comptes rendus" right={<Btn small label="+ Ajouter" onPress={() => creer()} />} />
      {visibles.length ? (
        <Collant>
          <Filtre
            label="Filtrer les comptes rendus"
            options={[
              { key: 'tous', label: 'Tous', compte: visibles.length },
              { key: 'suivre', label: 'À suivre', compte: aSuivre.length },
              { key: 'projets', label: 'Projets', compte: avecProjet.length },
            ]}
            value={filtre}
            onChange={setFiltre}
          />
        </Collant>
      ) : null}
      {visibles.length ? (
        liste.length ? (
          [...mois.entries()].map(([k, crs]) => (
            <Panel key={k} title={nomMois(k)} count={crs.length}>
              {crs.map((x, i) => (
                <View key={x.id}>
                  {i ? <Sep /> : null}
                  <LigneCR cr={x} onPress={() => setOuvert(x.id)} />
                </View>
              ))}
            </Panel>
          ))
        ) : (
          <Empty icone="livre">{filtre === 'suivre' ? 'Rien à suivre : tous les points d’action sont ouverts et terminés.' : 'Aucun compte rendu rattaché à un projet.'}</Empty>
        )
      ) : (
        <Panel title="Garde une trace de chaque échange" accent>
          <T small muted>
            Note ta réunion, ton appel ou ton point d’avancement comme il vient. Me y repère les décisions, les choses à faire et ce qui est réglé : tu ouvres les nouvelles tâches et relances d’un geste, et tu clôtures celles du projet qui sont terminées. Chacune garde le lien vers le compte rendu.
          </T>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn label="Écrire un compte rendu" onPress={() => creer()} />
          </View>
        </Panel>
      )}
    </Screen>
  );
}
