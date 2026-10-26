import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DatePick } from '@/components/forms';
import { Puce } from '@/components/finances-plus';
import { ImportPlan, MODELE_PLAN } from '@/components/import-plan';
import { BarreAvancement, echeance, EMOJIS_PROJET, Pastille, ProjetDetail, statutProjet, Tuile } from '@/components/projet-detail';
import { Btn, Dialogue, Empty, Header, Input, Panel, Screen, Seg, T } from '@/components/ui';
import { fmtCourt, today, uid } from '@/lib/dates';
import { etatProjet, prochainesTaches, type EtatProjet } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { C, F, S } from '@/lib/theme';
import type { Projet } from '@/lib/types';

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
    <Dialogue titre="Nouveau projet" onFermer={() => onDone()}>
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
    </Dialogue>
  );
}

type Resume = { p: Projet; etat: EtatProjet };

function CarteProjet({ p, etat, largeur, ouvrir }: Resume & { largeur: number; ouvrir: () => void }) {
  const { espace } = useStore();
  const aujourdhui = today();
  const suivantes = prochainesTaches(espace.taches, p, aujourdhui, 3);
  const pct = etat.plan.avancement;
  const statut = statutProjet(etat.nbTaches, etat.nbFaites, etat.enRetard);
  const enCours = etat.nbTaches > etat.nbFaites;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir le projet ${p.nom}, ${pct} % terminé, ${statut.label}`} onPress={ouvrir} style={({ pressed }) => ({ width: largeur, opacity: pressed ? 0.85 : 1 })}>
      <Panel style={{ flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: C.sunk, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.titreM, fontSize: 18 }}>
              {p.nom}
            </Text>
            <Pastille label={statut.label} couleur={statut.couleur} />
          </View>
          <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 24 }}>{pct} %</Text>
        </View>
        <BarreAvancement pct={pct} />
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14 }}>
          {etat.nbTaches ? `${etat.nbFaites}/${etat.nbTaches} tâches faites` : 'Aucune tâche pour l’instant'}
          {etat.fin && enCours ? ` · fin le ${fmtCourt(etat.fin)} (${echeance(etat.fin, aujourdhui)})` : ''}
        </Text>
        {etat.enRetard ? <Text style={{ color: C.agressif, fontFamily: F.texteM, fontSize: 14 }}>{`${etat.enRetard} tâche${etat.enRetard > 1 ? 's' : ''} en retard`}</Text> : null}
        {suivantes.length ? (
          <View style={{ gap: 6, paddingTop: 2 }}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase' }}>À faire ensuite</Text>
            {suivantes.map(({ tache, ligne }) => (
              <View key={tache.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ligne.fin < aujourdhui ? C.agressif : ligne.critique ? C.hebdo : C.accent }} />
                <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
                  {tache.titre}
                </Text>
                <Text style={{ color: ligne.fin < aujourdhui ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 13 }}>{fmtCourt(ligne.fin)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Panel>
    </Pressable>
  );
}

/** Ordre de la liste : les projets en retard, puis ceux en cours (fin la plus proche d'abord), ceux à planifier, les terminés. */
const rangProjet = ({ etat }: Resume) => (!etat.nbTaches ? 2 : etat.nbFaites >= etat.nbTaches ? 3 : etat.enRetard ? 0 : 1);

export default function Projets() {
  const { espace } = useStore();
  const params = useLocalSearchParams();
  const idUrl = typeof params.id === 'string' ? params.id : null;
  const [ouvert, setOuvert] = useState<string | null>(idUrl);
  const [vue, setVue] = useState<'liste' | 'import' | 'nouveau'>('liste');
  const [message, setMessage] = useState('');
  const [largeurGrille, setLargeurGrille] = useState(0);
  const aujourdhui = today();
  const actifs: Resume[] = (espace.projets ?? [])
    .filter((p) => !p.archive)
    .map((p) => ({ p, etat: etatProjet(espace.taches, p, aujourdhui) }))
    .sort((a, b) => rangProjet(a) - rangProjet(b) || (a.etat.fin ?? '9999').localeCompare(b.etat.fin ?? '9999'));
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
        <Header retour onRetour={() => setVue('liste')} eyebrow="Excel, CSV ou cellules collées" title="Importer un plan" />
        <ImportPlan onDone={fin} />
      </Screen>
    );

  if (courant)
    return (
      <Screen>
        <Header retour onRetour={() => (setOuvert(null), setMessage(''))} eyebrow="Projet" title={`${courant.emoji} ${courant.nom}`} />
        {message ? <T small style={{ color: C.accent }}>{message}</T> : null}
        <ProjetDetail projet={courant} retour={() => (setOuvert(null), setMessage(''))} onImporter={() => setVue('import')} />
      </Screen>
    );

  // Grille de cartes : une colonne au téléphone, deux ou trois sur un grand écran.
  const colonnes = largeurGrille >= 1000 ? 3 : largeurGrille >= 640 ? 2 : 1;
  const largeurCarte = largeurGrille ? (largeurGrille - S.lg * (colonnes - 1)) / colonnes : 0;
  const enCours = actifs.filter(({ etat }) => etat.nbTaches > etat.nbFaites);
  const aFaire = actifs.reduce((n, { etat }) => n + etat.nbTaches - etat.nbFaites, 0);
  const enRetard = actifs.reduce((n, { etat }) => n + etat.enRetard, 0);
  const prochaineFin = enCours.filter(({ etat }) => etat.fin && etat.fin >= aujourdhui).sort((a, b) => a.etat.fin!.localeCompare(b.etat.fin!))[0];

  return (
    <Screen>
      <Header
        retour
        eyebrow="Tâches et planning"
        title="Projets"
        right={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Btn small kind="sec" label="Importer" onPress={() => setVue('import')} />
            <Btn small label="+ Projet" onPress={() => setVue(vue === 'nouveau' ? 'liste' : 'nouveau')} />
          </View>
        }
      />
      {message ? <T small style={{ color: C.accent }}>{message}</T> : null}
      {vue === 'nouveau' ? <NouveauProjet onDone={(id) => (setVue('liste'), id && setOuvert(id))} /> : null}

      {actifs.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Tuile titre="Projets en cours" valeur={String(enCours.length)} />
          <Tuile titre="Tâches à faire" valeur={String(aFaire)} />
          <Tuile titre="En retard" valeur={enRetard ? `${enRetard} tâche${enRetard > 1 ? 's' : ''}` : 'Aucune'} couleur={enRetard ? C.agressif : C.coach} />
          <Tuile titre="Prochaine fin" valeur={prochaineFin ? `${prochaineFin.p.emoji} ${prochaineFin.p.nom} · ${fmtCourt(prochaineFin.etat.fin)}` : '—'} />
        </View>
      ) : null}

      {actifs.length ? (
        <View onLayout={(e) => setLargeurGrille(Math.floor(e.nativeEvent.layout.width))} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.lg, alignItems: 'stretch' }}>
          {largeurCarte ? actifs.map(({ p, etat }) => <CarteProjet key={p.id} p={p} etat={etat} largeur={largeurCarte} ouvrir={() => (setOuvert(p.id), setMessage(''))} />) : null}
        </View>
      ) : (
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
