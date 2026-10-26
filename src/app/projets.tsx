import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DatePick } from '@/components/forms';
import { Puce } from '@/components/finances-plus';
import { ImportPlan, MODELE_PLAN } from '@/components/import-plan';
import { ProjetDetail } from '@/components/projet-detail';
import { Btn, Empty, Header, Input, Panel, Screen, Seg, T } from '@/components/ui';
import { fmtCourt, today, uid } from '@/lib/dates';
import { etatProjet, prochainesTaches } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';
import type { Projet } from '@/lib/types';

const EMOJIS_PROJET = ['📁', '🚀', '🏗️', '📣', '🎓', '🛠️', '🌍', '🧪', '🏠', '💼', '🎉', '📦'];

function NouveauProjet({ onDone }: { onDone: (id?: string) => void }) {
  const { update } = useStore();
  const [nom, setNom] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS_PROJET[0]);
  const [debut, setDebut] = useState<string | null>(today());
  const [ouvres, setOuvres] = useState(true);
  const creer = () => {
    const p: Projet = { id: uid(), nom: nom.trim(), emoji, debut, joursOuvres: ouvres, creeLe: new Date().toISOString() };
    update((e) => ({ ...e, projets: [...(e.projets ?? []), p] }));
    onDone(p.id);
  };
  return (
    <Panel title="Nouveau projet" accent>
      <Input label="Nom" value={nom} onChangeText={(v: string) => setNom(v)} placeholder="Ex. Lancement du site, Déménagement" autoFocus returnKeyType="done" onSubmitEditing={() => nom.trim() && creer()} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {EMOJIS_PROJET.map((x) => (
          <Puce key={x} label={x} on={emoji === x} onPress={() => setEmoji(x)} />
        ))}
      </View>
      <DatePick label="Début du planning" value={debut} onChange={setDebut} allowNone />
      <Seg label="Jours de travail" options={[{ key: 'ouvres', label: 'Lundi au vendredi' }, { key: 'tous', label: 'Tous les jours' }]} value={ouvres ? 'ouvres' : 'tous'} onChange={(k) => setOuvres(k === 'ouvres')} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Créer le projet" onPress={creer} disabled={!nom.trim()} />
        <Btn kind="sec" label="Annuler" onPress={() => onDone()} />
      </View>
    </Panel>
  );
}

function CarteProjet({ p, ouvrir }: { p: Projet; ouvrir: () => void }) {
  const { espace } = useStore();
  const aujourdhui = today();
  const etat = etatProjet(espace.taches, p, aujourdhui);
  const suivantes = prochainesTaches(espace.taches, p, aujourdhui, 2);
  const pct = etat.plan.avancement;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir le projet ${p.nom}`} onPress={ouvrir} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.sunk, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>
              {p.nom}
            </Text>
            <T small muted>
              {etat.nbTaches ? `${etat.nbFaites}/${etat.nbTaches} tâches${etat.fin ? ` · fin prévue le ${fmtCourt(etat.fin)}` : ''}` : 'Aucune tâche pour l’instant'}
            </T>
          </View>
          <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 15 }}>{pct} %</Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: C.sunk, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: C.coach }} />
        </View>
        {etat.enRetard ? <T small style={{ color: C.agressif }}>{`${etat.enRetard} tâche${etat.enRetard > 1 ? 's' : ''} en retard`}</T> : null}
        {suivantes.length ? (
          <T small muted>
            À faire ensuite : {suivantes.map((s) => s.tache.titre).join(' · ')}
          </T>
        ) : null}
      </Panel>
    </Pressable>
  );
}

export default function Projets() {
  const { espace } = useStore();
  const params = useLocalSearchParams();
  const idUrl = typeof params.id === 'string' ? params.id : null;
  const [ouvert, setOuvert] = useState<string | null>(idUrl);
  const [vue, setVue] = useState<'liste' | 'import' | 'nouveau'>('liste');
  const [message, setMessage] = useState('');
  const projets = (espace.projets ?? []).filter((p) => !p.archive);
  const archives = (espace.projets ?? []).filter((p) => p.archive);
  const [archivesVisibles, setArchivesVisibles] = useState(false);
  const courant = ouvert ? (espace.projets ?? []).find((p) => p.id === ouvert) : undefined;

  const fin = (m: string, id?: string) => {
    setMessage(m);
    setVue('liste');
    if (id) setOuvert(id);
  };

  if (vue === 'import')
    return (
      <Screen>
        <Header retour eyebrow="Excel, CSV ou cellules collées" title="Importer un plan" />
        <ImportPlan onDone={fin} />
      </Screen>
    );

  if (courant)
    return (
      <Screen>
        <Header retour eyebrow="Projet" title="Projets" />
        {message ? <T small style={{ color: C.accent }}>{message}</T> : null}
        <ProjetDetail projet={courant} retour={() => (setOuvert(null), setMessage(''))} onImporter={() => setVue('import')} />
      </Screen>
    );

  return (
    <Screen>
      <Header
        retour
        eyebrow="Tâches, sous-tâches, liens et planning"
        title="Projets"
        right={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Btn small kind="sec" label="Importer Excel" onPress={() => setVue('import')} />
            <Btn small label="+ Projet" onPress={() => setVue(vue === 'nouveau' ? 'liste' : 'nouveau')} />
          </View>
        }
      />
      {message ? <T small style={{ color: C.accent }}>{message}</T> : null}
      {vue === 'nouveau' ? <NouveauProjet onDone={(id) => (setVue('liste'), id && setOuvert(id))} /> : null}

      {projets.length ? (
        projets.map((p) => <CarteProjet key={p.id} p={p} ouvrir={() => (setOuvert(p.id), setMessage(''))} />)
      ) : vue === 'nouveau' ? null : (
        <Panel title="Pars d’un fichier Excel" accent>
          <T small muted>
            Importe un tableau (Excel, CSV, ou des cellules copiées) : Me crée le projet, ses tâches et sous-tâches, les liens entre elles et le planning. Tu peux ensuite découper une tâche en sous-tâches générées, lier des tâches entre elles, et suivre le tout dans un diagramme de Gantt.
          </T>
          <T small muted>{`Exemple de colonnes :\n${MODELE_PLAN.split('\n').slice(0, 4).join('\n')}`}</T>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn label="Importer un fichier Excel" onPress={() => setVue('import')} />
            <Btn kind="sec" label="Créer un projet vide" onPress={() => setVue('nouveau')} />
          </View>
        </Panel>
      )}

      {archives.length ? (
        <Panel title="Archivés" count={archives.length} right={<Btn small kind="sec" label={archivesVisibles ? 'Masquer' : 'Afficher'} onPress={() => setArchivesVisibles(!archivesVisibles)} />}>
          {archivesVisibles ? (
            archives.map((p) => <ArchiveLigne key={p.id} p={p} />)
          ) : (
            <Empty icone="vide">Les projets terminés que tu as rangés.</Empty>
          )}
        </Panel>
      ) : null}
    </Screen>
  );
}

function ArchiveLigne({ p }: { p: Projet }) {
  const { update } = useStore();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
      <Text style={{ fontSize: 18 }}>{p.emoji}</Text>
      <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
        {p.nom}
      </Text>
      <Btn small kind="sec" label="Désarchiver" onPress={() => update((e) => ({ ...e, projets: (e.projets ?? []).map((x) => (x.id === p.id ? { ...x, archive: undefined } : x)) }))} />
    </View>
  );
}
