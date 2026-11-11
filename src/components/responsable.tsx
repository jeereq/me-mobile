import { View } from 'react-native';
import { Text, useEchelleTexte } from '@/components/texte';

import type { MembreEquipe } from '@/lib/equipes';
import { comptesParFiltre, filtreDeMembre, initiales, responsablesDe, type ElementPlan, type FiltreMembre, type GenreElement } from '@/lib/equipe-taches';
import { nomMembre, suivisDe } from '@/lib/affectation';
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
export function Avatar({ nom, couleur, taille: base = 20 }: { nom: string; couleur: string; taille?: number }) {
  const taille = Math.round(base * useEchelleTexte());
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: taille, height: taille, borderRadius: taille / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(couleur, 0.22), borderWidth: 1, borderColor: alpha(couleur, 0.6) }}>
      <Text fixe style={{ color: couleur, fontFamily: F.texteF, fontSize: Math.round(taille * 0.46) }}>{initiales(nom)}</Text>
    </View>
  );
}

/**
 * Qui s'occupe de la tâche. Dans l'espace d'une équipe : le membre (ses initiales dans sa couleur, « moi » pour soi), ou
 * « Non affectée » tant qu'elle est à faire sans responsable. Hors équipe : le nom écrit, s'il y en a un.
 */
export function PuceResponsable({ t, fait, genre = 'tache' }: { t: Pick<Tache, 'affecteA' | 'responsable'> & Partial<Pick<Tache, 'executants' | 'suivis'>>; /** Terminée, ou relance obtenue : plus besoin de rappeler qu'elle n'est à personne. */ fait?: boolean; genre?: GenreElement }) {
  const { equipeActive, session } = useStore();
  const membres = equipeActive?.membres ?? [];
  const rs = responsablesDe(t, membres, session?.user.id);
  if (!rs.length) return equipeActive && !fait ? <Tag label={genre === 'rdv' ? 'Non affecté' : 'Non affectée'} color={C.muted} /> : null;
  if (!equipeActive) return <Tag label={`👤 ${rs[0].nom}`} />;
  const r = rs[0];
  const suivants = suivisDe(membres, t);
  const noms = rs.map((x) => `${x.nom}${x.moi ? ' (moi)' : ''}`).join(', ');
  const etiquette = `Responsable${rs.length > 1 ? 's' : ''} : ${noms}${r.parti && rs.length === 1 ? ', n’est plus dans l’équipe' : ''}${suivants.length ? `. Suivi par ${suivants.map(nomMembre).join(', ')}` : ''}`;
  return (
    <View accessible accessibilityLabel={etiquette} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ flexDirection: 'row' }}>
        {rs.slice(0, 3).map((x, i) => (
          <View key={x.membre?.id ?? x.nom} style={{ marginLeft: i ? -6 : 0 }}>
            <Avatar nom={x.nom} couleur={x.membre ? couleurMembre(membres, x.membre.id) : C.muted} />
          </View>
        ))}
      </View>
      <Text numberOfLines={1} style={{ color: r.moi ? C.ink : C.muted, fontFamily: r.moi ? F.texteM : F.texte, fontSize: 12.5 }}>
        {r.moi ? 'Moi' : r.nom}
        {rs.length > 1 ? ` +${rs.length - 1}` : r.parti ? ' · plus dans l’équipe' : r.membre ? '' : ' · hors équipe'}
      </Text>
      {suivants.length ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>👁 {suivants.length}</Text> : null}
    </View>
  );
}

/** Les membres pour filtrer : toute l'équipe, moi, chaque membre, les tâches sans responsable. Rien hors équipe. */
export function FiltreMembres({ elements, value, onChange }: { elements: ElementPlan[]; value: FiltreMembre; onChange: (f: FiltreMembre) => void }) {
  const { equipeActive, session } = useStore();
  if (!equipeActive) return null;
  const moi = session?.user.id;
  const membres = equipeActive.membres;
  const n = comptesParFiltre(elements, membres, moi);
  const options: { key: FiltreMembre; label: string; compte?: number }[] = [
    { key: 'tous', label: 'Toute l’équipe', compte: n.get('tous') },
    { key: 'moi', label: 'Moi', compte: n.get('moi') },
    ...membres.filter((m) => m.id !== moi).map((m) => ({ key: filtreDeMembre(m.id), label: nomMembre(m), compte: n.get(filtreDeMembre(m.id)) })),
    { key: 'non', label: 'Non affecté', compte: n.get('non') },
    ...(n.get('suivi') ? [{ key: 'suivi' as const, label: 'Que je suis', compte: n.get('suivi') }] : []),
  ];
  return <Filtre<FiltreMembre> label="Filtrer par membre de l’équipe" options={options} value={value} onChange={onChange} />;
}
