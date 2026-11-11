import { useState } from 'react';
import { View } from 'react-native';

import { ETATS } from '@/lib/etats-tache';
import { elementsDeTaches } from '@/lib/equipe-taches';
import { CRITERES_VIDES, nbCriteres, nbCriteresPlus, piliersDesTaches, type Criteres, type PeriodeFiltre, type StatutFiltre } from '@/lib/filtres-taches';
import { nomPilier } from '@/lib/piliers';
import { useStore } from '@/lib/store';
import type { Tache } from '@/lib/types';

import { Filtre } from './onglets';
import { FiltreMembres } from './responsable';
import { Btn, Input, T } from './ui';

const STATUTS: { key: StatutFiltre; label: string }[] = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'afaire', label: 'À faire' },
  { key: 'retard', label: 'En retard' },
  { key: 'critique', label: 'Critiques' },
  { key: 'jalons', label: 'Jalons' },
  { key: 'faites', label: 'Faites' },
];
const PERIODES: { key: PeriodeFiltre; label: string }[] = [
  { key: 'toutes', label: 'Toutes' },
  { key: '7', label: '7 jours' },
  { key: '30', label: '30 jours' },
  { key: '90', label: '90 jours' },
];

/**
 * Les filtres d'un projet, les mêmes pour la liste des tâches et le planning : recherche, statut, puis sous « Filtres »
 * la période, l'état, le pilier et le membre de l'équipe. `comptes` donne le nombre de tâches par statut.
 */
export function FiltresProjet({ criteres, onChange, taches, comptes }: { criteres: Criteres; onChange: (c: Criteres) => void; taches: Tache[]; comptes: Record<StatutFiltre, number> }) {
  const { equipeActive } = useStore();
  const [ouvert, setOuvert] = useState(false);
  const piliers = piliersDesTaches(taches);
  const plus = nbCriteresPlus(criteres);
  const poser = (x: Partial<Criteres>) => onChange({ ...criteres, ...x });
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flexGrow: 1, flexBasis: 180 }}>
          <Input value={criteres.recherche} onChangeText={(v: string) => poser({ recherche: v })} placeholder="Rechercher" accessibilityLabel="Rechercher une tâche" returnKeyType="search" />
        </View>
        <Btn small kind="sec" label={plus ? `Filtres · ${plus}` : 'Filtres'} onPress={() => setOuvert(!ouvert)} />
        {nbCriteres(criteres) ? <Btn small kind="sec" label="Effacer" onPress={() => onChange(CRITERES_VIDES)} /> : null}
      </View>
      <Filtre<StatutFiltre> label="Filtrer par statut" options={STATUTS.map((s) => ({ ...s, compte: s.key === 'toutes' ? undefined : comptes[s.key] || undefined }))} value={criteres.statut} onChange={(statut) => poser({ statut })} />
      {ouvert ? (
        <View style={{ gap: 10 }}>
          <View style={{ gap: 6 }}>
            <T small muted>Période</T>
            <Filtre<PeriodeFiltre> label="Filtrer par période" options={PERIODES} value={criteres.periode} onChange={(periode) => poser({ periode })} />
          </View>
          <View style={{ gap: 6 }}>
            <T small muted>État</T>
            <Filtre<Criteres['etat']> label="Filtrer par état" options={[{ key: 'tous', label: 'Tous' }, { key: 'normal', label: 'Normal' }, ...ETATS.map((e) => ({ key: e.cle, label: e.nom }))]} value={criteres.etat} onChange={(etat) => poser({ etat })} />
          </View>
          {piliers.length ? (
            <View style={{ gap: 6 }}>
              <T small muted>Pilier</T>
              <Filtre<string> label="Filtrer par pilier" options={[{ key: 'tous', label: 'Tous' }, ...piliers.map((n) => ({ key: String(n), label: nomPilier(n) }))]} value={criteres.pilier === null ? 'tous' : String(criteres.pilier)} onChange={(k) => poser({ pilier: k === 'tous' ? null : Number(k) })} />
            </View>
          ) : null}
          {equipeActive ? (
            <View style={{ gap: 6 }}>
              <T small muted>Membre</T>
              <FiltreMembres elements={elementsDeTaches(taches)} value={criteres.membre} onChange={(membre) => poser({ membre })} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
