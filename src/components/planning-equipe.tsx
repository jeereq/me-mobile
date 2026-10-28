import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { addDays, fmtCourt, today } from '@/lib/dates';
import { elementsDePlan, NOM_GENRE, parMembre, type ElementPlan, type GroupeMembre } from '@/lib/equipe-taches';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { DetailTache } from './detail-tache';
import { FicheRelance } from './fiches';
import { FormRdvEquipe } from './rdv-equipe';
import { SousOnglets } from './onglets';
import { Limitee } from './pliable';
import { Avatar, couleurMembre } from './responsable';
import { Empty, Panel, Sep, T, tap } from './ui';

type Periode = '7j' | '30j' | 'tout';

const EMOJI = { tache: '✅', relance: '🔔', rdv: '📅' } as const;

/**
 * Un élément d'un membre : son jour d'abord (en rouge s'il est dépassé), le titre, le projet ; toucher l'ouvre — le détail
 * pour une tâche, la fiche pour une relance, le formulaire pour un rendez-vous (sauf en lecture seule).
 */
function LigneMembre({ x, aujourdhui }: { x: ElementPlan; aujourdhui: string }) {
  const { espace, lectureSeule } = useStore();
  const [ouvert, setOuvert] = useState(false);
  const projet = x.projet ? espace.projets?.find((p) => p.id === x.projet) : undefined;
  const retard = !!x.date && x.date < aujourdhui;
  const relance = x.genre === 'relance' ? espace.relances.find((r) => r.id === x.id) : undefined;
  const jourRdv = x.genre === 'rdv' ? x.date : null;
  const rdv = jourRdv ? espace.agenda?.[jourRdv]?.find((ev) => ev.id === x.id) : undefined;
  const jour = x.date ? (x.date === aujourdhui ? "Aujourd'hui" : fmtCourt(x.date)) : 'Sans date';
  const quand = x.heure ? `${jour} ${x.heure}` : jour;
  const sous = [x.genre !== 'tache' ? NOM_GENRE[x.genre].un.replace(/^./, (c) => c.toUpperCase()) : '', projet ? `${projet.emoji} ${projet.nom}` : '', x.priorite === 'haute' ? 'Priorité haute' : '', x.genre !== 'tache' ? x.detail ?? '' : ''].filter(Boolean).join(' · ');
  // Un rendez-vous importé d'un agenda connecté n'est pas modifiable ici ; il n'y en a pas dans une équipe.
  const ouvrable = x.genre === 'tache' || (x.genre === 'relance' && !!relance) || (x.genre === 'rdv' && !!rdv && !lectureSeule);
  return (
    <>
      <Pressable accessibilityRole="button" disabled={!ouvrable} accessibilityLabel={`${NOM_GENRE[x.genre].un} : ${x.titre}, ${x.date ? `pour le ${fmtCourt(x.date)}` : 'sans date'}${ouvrable ? '. Voir le détail' : ''}`} onPress={() => (tap(), setOuvert(true))} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ width: 92, color: retard ? C.agressif : C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{quand}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14.5, lineHeight: 19 }}>{`${EMOJI[x.genre]} ${x.titre}`}</Text>
          {sous ? <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{sous}</Text> : null}
        </View>
        {retard ? <Text style={{ color: C.agressif, fontFamily: F.texteF, fontSize: 11.5 }}>En retard</Text> : null}
      </Pressable>
      {ouvert && x.genre === 'tache' ? <DetailTache id={x.id} onFermer={() => setOuvert(false)} /> : null}
      {ouvert && relance ? <FicheRelance r={relance} onFermer={() => setOuvert(false)} /> : null}
      {ouvert && rdv && jourRdv ? <FormRdvEquipe date={jourRdv} jourActuel={jourRdv} evenement={rdv} onFermer={() => setOuvert(false)} /> : null}
    </>
  );
}

function CarteMembre({ g, aujourdhui, couleur }: { g: GroupeMembre; aujourdhui: string; couleur: string }) {
  const [ouvert, setOuvert] = useState(true);
  const afaire = g.parGenre.tache + g.parGenre.relance + g.parGenre.rdv;
  const detail = [g.parGenre.tache ? `${g.parGenre.tache} tâche${g.parGenre.tache > 1 ? 's' : ''}` : '', g.parGenre.relance ? `${g.parGenre.relance} relance${g.parGenre.relance > 1 ? 's' : ''}` : '', g.parGenre.rdv ? `${g.parGenre.rdv} rendez-vous` : ''].filter(Boolean).join(', ');
  const resume = [
    afaire ? `${afaire} à faire (${detail})` : 'Rien à faire',
    g.enRetard ? `${g.enRetard} en retard` : '',
    g.cetteSemaine ? `${g.cetteSemaine} cette semaine` : '',
    g.faites ? `${g.faites} terminé${g.faites > 1 ? 's' : ''}` : '',
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
            <Limitee items={[...g.ouvertes, ...g.sansEcheance]} n={6} nom="éléments" rendu={(x) => <LigneMembre key={x.cle} x={x} aujourdhui={aujourdhui} />} />
          ) : (
            <T small muted>Rien à faire sur cette période.</T>
          )}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Le planning de l'équipe : pour chaque membre, ses tâches, relances et rendez-vous à venir avec leurs dates, moi d'abord. Un
 * membre sans rien reste visible, et ce qui n'a pas de responsable est rassemblé à part. Les tâches des projets y sont aussi.
 * Dans l'espace d'une équipe seulement.
 */
export function PlanningEquipe({ titre = 'Planning de l’équipe' }: { titre?: string }) {
  const { espace, equipeActive, session } = useStore();
  const aujourdhui = today();
  const [periode, setPeriode] = useState<Periode>('30j');
  const membres = equipeActive?.membres ?? [];
  const moi = session?.user.id;
  const groupes = useMemo(() => parMembre(elementsDePlan(espace, aujourdhui), membres, moi, aujourdhui, periode === 'tout' ? undefined : addDays(aujourdhui, periode === '7j' ? 7 : 30)), [espace, membres, moi, aujourdhui, periode]);
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
      <T small muted>{periode === 'tout' ? 'Tout ce qui est à faire pour chaque membre — tâches, relances et rendez-vous — par date.' : `Ce qui est à faire d’ici ${periode === '7j' ? '7' : '30'} jours, et ce qui est déjà en retard.`}</T>
      {groupes.map((g, i) => (
        <View key={g.cle}>
          {i ? <Sep /> : null}
          <CarteMembre g={g} aujourdhui={aujourdhui} couleur={couleurMembre(membres, g.membre?.id)} />
        </View>
      ))}
    </Panel>
  );
}
