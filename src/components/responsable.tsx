import { Text, View } from 'react-native';

import type { MembreEquipe } from '@/lib/equipes';
import { comptesParFiltre, filtreDeMembre, initiales, responsableDe, type FiltreMembre } from '@/lib/equipe-taches';
import { nomMembre } from '@/lib/affectation';
import { useStore } from '@/lib/store';
import { vive, type Vive } from '@/lib/teinte';
import { alpha, C, F } from '@/lib/theme';
import type { Tache } from '@/lib/types';

import { Filtre } from './onglets';
import { Tag } from './ui';

/** Une couleur par membre, toujours la même d'un écran à l'autre (selon sa place dans l'équipe). */
const TEINTES: Vive[] = ['indigo', 'menthe', 'corail', 'lilas', 'rose', 'lagon', 'ambre', 'citron'];
export function couleurMembre(membres: MembreEquipe[], id?: string) {
  const i = membres.findIndex((m) => m.id === id);
  return i < 0 ? C.muted : vive(TEINTES[i % TEINTES.length]);
}

/** Les initiales d'une personne dans un rond de sa couleur. */
export function Avatar({ nom, couleur, taille = 20 }: { nom: string; couleur: string; taille?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: taille, height: taille, borderRadius: taille / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(couleur, 0.22), borderWidth: 1, borderColor: alpha(couleur, 0.6) }}>
      <Text style={{ color: couleur, fontFamily: F.texteF, fontSize: Math.round(taille * 0.46) }}>{initiales(nom)}</Text>
    </View>
  );
}

/**
 * Qui s'occupe de la tâche. Dans l'espace d'une équipe : le membre (ses initiales dans sa couleur, « moi » pour soi), ou
 * « Non affectée » tant qu'elle est à faire sans responsable. Hors équipe : le nom écrit, s'il y en a un.
 */
export function PuceResponsable({ t }: { t: Pick<Tache, 'affecteA' | 'responsable' | 'statut'> }) {
  const { equipeActive, session } = useStore();
  const membres = equipeActive?.membres ?? [];
  const r = responsableDe(t, membres, session?.user.id);
  if (!r) return equipeActive && t.statut !== 'fait' ? <Tag label="Non affectée" color={C.muted} /> : null;
  if (!equipeActive) return <Tag label={`👤 ${r.nom}`} />;
  const couleur = r.membre ? couleurMembre(membres, r.membre.id) : C.muted;
  return (
    <View accessible accessibilityLabel={`Responsable : ${r.nom}${r.moi ? ' (moi)' : ''}${r.parti ? ', n’est plus dans l’équipe' : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Avatar nom={r.nom} couleur={couleur} />
      <Text numberOfLines={1} style={{ color: r.moi ? C.ink : C.muted, fontFamily: r.moi ? F.texteM : F.texte, fontSize: 12.5 }}>
        {r.moi ? 'Moi' : r.nom}
        {r.parti ? ' · plus dans l’équipe' : r.membre ? '' : ' · hors équipe'}
      </Text>
    </View>
  );
}

/** Les membres pour filtrer : toute l'équipe, moi, chaque membre, les tâches sans responsable. Rien hors équipe. */
export function FiltreMembres({ taches, value, onChange }: { taches: Tache[]; value: FiltreMembre; onChange: (f: FiltreMembre) => void }) {
  const { equipeActive, session } = useStore();
  if (!equipeActive) return null;
  const moi = session?.user.id;
  const membres = equipeActive.membres;
  const n = comptesParFiltre(taches, membres, moi);
  const options: { key: FiltreMembre; label: string; compte?: number }[] = [
    { key: 'tous', label: 'Toute l’équipe', compte: n.get('tous') },
    { key: 'moi', label: 'Moi', compte: n.get('moi') },
    ...membres.filter((m) => m.id !== moi).map((m) => ({ key: filtreDeMembre(m.id), label: nomMembre(m), compte: n.get(filtreDeMembre(m.id)) })),
    { key: 'non', label: 'Non affectées', compte: n.get('non') },
  ];
  return <Filtre<FiltreMembre> label="Filtrer par membre de l’équipe" options={options} value={value} onChange={onChange} />;
}
