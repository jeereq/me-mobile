import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { addDays, fmtCourt, today } from '@/lib/dates';
import { parMembre, type GroupeMembre } from '@/lib/equipe-taches';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Tache } from '@/lib/types';

import { DetailTache } from './detail-tache';
import { SousOnglets } from './onglets';
import { Limitee } from './pliable';
import { Avatar, couleurMembre } from './responsable';
import { Empty, Panel, Sep, T, tap } from './ui';

type Periode = '7j' | '30j' | 'tout';

/** Une tâche d'un membre : son échéance d'abord (en rouge si elle est dépassée), le projet, le titre ; toucher ouvre le détail. */
function LigneMembre({ t, aujourdhui }: { t: Tache; aujourdhui: string }) {
  const { espace } = useStore();
  const [detail, setDetail] = useState(false);
  const projet = t.projet ? espace.projets?.find((p) => p.id === t.projet) : undefined;
  const retard = !!t.echeance && t.echeance < aujourdhui;
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t.titre}, ${t.echeance ? `pour le ${fmtCourt(t.echeance)}` : 'sans échéance'}. Voir le détail`} onPress={() => (tap(), setDetail(true))} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ width: 76, color: retard ? C.agressif : C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{t.echeance ? (t.echeance === aujourdhui ? "Aujourd'hui" : fmtCourt(t.echeance)) : 'Sans date'}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14.5, lineHeight: 19 }}>{t.titre}</Text>
          {projet || t.priorite === 'haute' ? (
            <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
              {[projet ? `${projet.emoji} ${projet.nom}` : '', t.priorite === 'haute' ? 'Priorité haute' : ''].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        {retard ? <Text style={{ color: C.agressif, fontFamily: F.texteF, fontSize: 11.5 }}>En retard</Text> : null}
      </Pressable>
      {detail ? <DetailTache id={t.id} onFermer={() => setDetail(false)} /> : null}
    </>
  );
}

function CarteMembre({ g, aujourdhui, couleur }: { g: GroupeMembre; aujourdhui: string; couleur: string }) {
  const [ouvert, setOuvert] = useState(true);
  const resume = [
    g.ouvertes.length + g.sansEcheance.length ? `${g.ouvertes.length + g.sansEcheance.length} à faire` : 'Rien à faire',
    g.enRetard ? `${g.enRetard} en retard` : '',
    g.cetteSemaine ? `${g.cetteSemaine} cette semaine` : '',
    g.faites ? `${g.faites} terminée${g.faites > 1 ? 's' : ''}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={{ gap: 4 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: ouvert }} accessibilityLabel={`${g.nom}${g.moi ? ' (moi)' : ''} : ${resume}`} onPress={() => (tap(), setOuvert(!ouvert))} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
        {g.membre ? <Avatar nom={g.nom} couleur={couleur} taille={30} /> : <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.sunk }}><Text style={{ color: C.muted, fontSize: 14 }}>{g.cle === 'non' ? '∅' : '👤'}</Text></View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15.5 }}>
            {g.moi ? `${g.nom} (moi)` : g.nom}
            {g.cle.startsWith('ext:') ? <Text style={{ color: C.muted, fontFamily: F.texte }}> · hors équipe</Text> : null}
          </Text>
          <Text numberOfLines={2} style={{ color: g.enRetard ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{resume}</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 16 }}>{ouvert ? '▾' : '›'}</Text>
      </Pressable>
      {ouvert ? (
        <View style={{ marginLeft: 14, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: alpha(couleur, 0.5) }}>
          {g.ouvertes.length || g.sansEcheance.length ? (
            <Limitee items={[...g.ouvertes, ...g.sansEcheance]} n={6} nom="tâches" rendu={(t) => <LigneMembre key={t.id} t={t} aujourdhui={aujourdhui} />} />
          ) : (
            <T small muted>Aucune tâche à faire sur cette période.</T>
          )}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Le planning de l'équipe : pour chaque membre, ses tâches à faire et leurs échéances, moi d'abord. Un membre sans tâche
 * reste visible, et les tâches sans responsable sont rassemblées à part. Les tâches des projets y sont aussi.
 * Dans l'espace d'une équipe seulement.
 */
export function PlanningEquipe({ titre = 'Planning de l’équipe' }: { titre?: string }) {
  const { espace, equipeActive, session } = useStore();
  const aujourdhui = today();
  const [periode, setPeriode] = useState<Periode>('30j');
  const membres = equipeActive?.membres ?? [];
  const moi = session?.user.id;
  const groupes = useMemo(() => parMembre(espace.taches, membres, moi, aujourdhui, periode === 'tout' ? undefined : addDays(aujourdhui, periode === '7j' ? 7 : 30)), [espace.taches, membres, moi, aujourdhui, periode]);
  if (!equipeActive)
    return (
      <Panel title={titre}>
        <Empty icone="agenda">Le planning par membre s’affiche dans l’espace d’une équipe. Choisis ton équipe en haut de l’écran.</Empty>
      </Panel>
    );
  const total = groupes.reduce((n, g) => n + g.ouvertes.length + g.sansEcheance.length, 0);
  return (
    <Panel title={titre} count={total ? `${total} à faire` : undefined}>
      <SousOnglets<Periode>
        label="Période du planning de l’équipe"
        options={[
          { key: '7j', label: '7 jours' },
          { key: '30j', label: '30 jours' },
          { key: 'tout', label: 'Tout' },
        ]}
        value={periode}
        onChange={setPeriode}
      />
      <T small muted>{periode === 'tout' ? 'Toutes les tâches à faire de chaque membre, par échéance.' : `Les tâches à finir d’ici ${periode === '7j' ? '7' : '30'} jours, et celles déjà en retard.`}</T>
      {groupes.map((g, i) => (
        <View key={g.cle}>
          {i ? <Sep /> : null}
          <CarteMembre g={g} aujourdhui={aujourdhui} couleur={couleurMembre(membres, g.membre?.id)} />
        </View>
      ))}
    </Panel>
  );
}
