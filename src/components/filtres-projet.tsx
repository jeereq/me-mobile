import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ETATS } from '@/lib/etats-tache';
import { elementsDeTaches } from '@/lib/equipe-taches';
import { CRITERES_VIDES, etiquettesCriteres, nbCriteres, nbCriteresPlus, piliersDesTaches, sansCritere, type Criteres, type PeriodeFiltre, type StatutFiltre } from '@/lib/filtres-taches';
import { nomPilier, piliersDe } from '@/lib/piliers';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Tache } from '@/lib/types';

import { Filtre } from './onglets';
import { Text } from './texte';
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
function Groupes({ criteres, poser, taches }: { criteres: Criteres; poser: (x: Partial<Criteres>) => void; taches: Tache[] }) {
  const { equipeActive, espace } = useStore();
  const noms = piliersDe(espace);
  const piliers = piliersDesTaches(taches);
  return (
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
          <Filtre<string> label="Filtrer par pilier" options={[{ key: 'tous', label: 'Tous' }, ...piliers.map((n) => ({ key: String(n), label: nomPilier(n, noms) }))]} value={criteres.pilier === null ? 'tous' : String(criteres.pilier)} onChange={(k) => poser({ pilier: k === 'tous' ? null : Number(k) })} />
        </View>
      ) : null}
      {equipeActive ? (
        <View style={{ gap: 6 }}>
          <T small muted>Membre</T>
          <FiltreMembres elements={elementsDeTaches(taches)} value={criteres.membre} onChange={(membre) => poser({ membre })} />
        </View>
      ) : null}
    </View>
  );
}

/** Tous les filtres d'un coup, dans un panneau : recherche, statut, période, état, pilier, membre. Sert au plein écran. */
export function PanneauFiltres({ criteres, onChange, taches, comptes }: { criteres: Criteres; onChange: (c: Criteres) => void; taches: Tache[]; comptes: Record<StatutFiltre, number> }) {
  const poser = (x: Partial<Criteres>) => onChange({ ...criteres, ...x });
  return (
    <View style={{ gap: 12 }}>
      <Input value={criteres.recherche} onChangeText={(v: string) => poser({ recherche: v })} placeholder="Rechercher" accessibilityLabel="Rechercher une tâche" returnKeyType="search" />
      <View style={{ gap: 6 }}>
        <T small muted>Statut</T>
        <Filtre<StatutFiltre> label="Filtrer par statut" options={STATUTS.map((s) => ({ ...s, compte: s.key === 'toutes' ? undefined : comptes[s.key] || undefined }))} value={criteres.statut} onChange={(statut) => poser({ statut })} />
      </View>
      <Groupes criteres={criteres} poser={poser} taches={taches} />
    </View>
  );
}

/** Les critères posés, en étiquettes qu'on retire d'un geste, avec « Effacer » pour tout remettre à zéro. */
export function EtiquettesFiltres({ criteres, onChange }: { criteres: Criteres; onChange: (c: Criteres) => void }) {
  const { equipeActive, espace } = useStore();
  const etiquettes = etiquettesCriteres(criteres, equipeActive?.membres ?? [], piliersDe(espace));
  if (!etiquettes.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ alignItems: 'center', gap: 6 }}>
      {etiquettes.map((e) => (
        <Pressable key={e.cle} accessibilityRole="button" accessibilityLabel={`Retirer le filtre ${e.label}`} onPress={() => onChange(sansCritere(criteres, e.cle))} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.accent, backgroundColor: alpha(C.accent, 0.14), opacity: pressed ? 0.7 : 1 })}>
          <Text numberOfLines={1} style={{ color: C.accent, fontFamily: F.texteF, fontSize: 13, maxWidth: 160 }}>{e.label}</Text>
          <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 12 }}>✕</Text>
        </Pressable>
      ))}
      {etiquettes.length > 1 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Effacer les filtres" onPress={() => onChange(CRITERES_VIDES)} style={{ paddingHorizontal: 6, paddingVertical: 6 }}>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Effacer</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

export function FiltresProjet({ criteres, onChange, taches, comptes }: { criteres: Criteres; onChange: (c: Criteres) => void; taches: Tache[]; comptes: Record<StatutFiltre, number> }) {
  const [ouvert, setOuvert] = useState(false);
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
      {ouvert ? <Groupes criteres={criteres} poser={poser} taches={taches} /> : null}
    </View>
  );
}
