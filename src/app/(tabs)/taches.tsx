import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { ChoixCategories } from '@/components/categories';
import { DatePick, ModePick } from '@/components/forms';
import { TacheItem } from '@/components/items';
import { etatProjet } from '@/lib/planning';
import { BarreSelection, BoutonSelection, Selectionnable, useSelection } from '@/components/selection';
import { Btn, Collant, Dialogue, Empty, Header, Input, Panel, Screen, Sep, Seg, T } from '@/components/ui';
import { Filtre } from '@/components/onglets';
import { tTache, useActions } from '@/lib/actions';
import { addDays, today, uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { vive } from '@/lib/teinte';
import { C, F, S } from '@/lib/theme';
import type { Mode, Priorite, Tache } from '@/lib/types';

const PRIO: Record<Priorite, number> = { haute: 0, moyenne: 1, basse: 2 };

/** Les trois boîtes de tâches, chacune avec sa couleur (barre d'avancement, titres de groupe). */
const BOITES = [
  { key: 'pro', label: 'Pro', teinte: 'indigo' },
  { key: 'perso', label: 'Perso', teinte: 'menthe' },
  { key: 'manuel', label: 'Autres', teinte: 'lilas' },
] as const;

/** Avancement du jour : ce qui est fait aujourd'hui sur ce qui reste plus ce qui est fait, coloré par boîte. */
function Avancement({ taches }: { taches: Tache[] }) {
  const d = today();
  const faites = taches.filter((t) => t.statut === 'fait' && t.faitLe === d);
  const total = faites.length + taches.filter((t) => t.statut !== 'fait').length;
  if (!total) return null;
  const pct = Math.round((faites.length / total) * 100);
  return (
    <Panel>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 20, letterSpacing: -0.4 }}>
          {faites.length} sur {total} terminées
        </Text>
        <T small muted>
          {pct} %
        </T>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={{ height: 8, borderRadius: 4, backgroundColor: C.sunk, flexDirection: 'row', gap: 2, overflow: 'hidden' }}>
        {BOITES.map((b) => {
          const n = faites.filter((t) => t.source === b.key).length;
          return n ? <View key={b.key} style={{ width: `${(n / total) * 100}%`, backgroundColor: vive(b.teinte) }} /> : null;
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
        {BOITES.map((b) => (
          <View key={b.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: vive(b.teinte) }} />
            <T small muted>
              {b.label}
            </T>
          </View>
        ))}
      </View>
    </Panel>
  );
}

export default function Taches() {
  const { espace, update, config } = useStore();
  const [titre, setTitre] = useState('');
  const [source, setSource] = useState<Tache['source']>('pro');
  const [priorite, setPriorite] = useState<Priorite>('moyenne');
  const [echeance, setEcheance] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(config.defauts.tache);
  const [cats, setCats] = useState<string[] | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [filtre, setFiltre] = useState<'toutes' | 'perso' | 'pro' | 'manuel'>('toutes');
  const sel = useSelection();
  const { enLot } = useActions();

  // Les tâches d'un projet se suivent dans l'écran Projets ; ici, seulement celles qui n'en font pas partie.
  const projets = (espace.projets ?? []).filter((p) => !p.archive);
  const idsProjets = new Set((espace.projets ?? []).map((p) => p.id));
  const list = [...espace.taches]
    .filter((t) => !(t.projet && idsProjets.has(t.projet)))
    .filter((t) => filtre === 'toutes' || t.source === filtre)
    .sort((a, b) => (a.statut === 'fait' ? 1 : 0) - (b.statut === 'fait' ? 1 : 0) || PRIO[a.priorite] - PRIO[b.priorite] || (a.echeance || '9999').localeCompare(b.echeance || '9999'));
  const ouvertes = list.filter((t) => t.statut !== 'fait').length;
  // Les nombres de la barre de filtres : ce qu'il reste à faire dans chaque boîte.
  const hors = espace.taches.filter((t) => !(t.projet && idsProjets.has(t.projet)) && t.statut !== 'fait');
  const parSource = (src: Tache['source']) => hors.filter((t) => t.source === src).length;

  const ajouter = () => {
    update((e) => ({ ...e, taches: [...e.taches, { id: uid(), titre: titre.trim(), source, priorite, echeance, statut: 'en_attente', mode, ...(cats?.length ? { categories: cats } : {}), creeLe: new Date().toISOString() }] }));
    setTitre('');
    setCats(undefined);
    setOpen(false);
  };

  const ouvertesIds = (ids: string[]) => ids.filter((id) => espace.taches.find((t) => t.id === id)?.statut !== 'fait');
  const reporter = (ids: string[], jours: number) => update((e) => ({ ...e, taches: e.taches.map((t) => (ids.includes(t.id) ? { ...t, echeance: addDays(today(), jours) } : t)) }));
  const actions = [
    { label: 'Terminer', onPress: (ids: string[]) => enLot((e, d, h) => ouvertesIds(ids).reduce((acc, id) => tTache(acc, id, d, h), e)) },
    { label: 'Pour demain', onPress: (ids: string[]) => reporter(ids, 1) },
    { label: 'Dans 1 semaine', onPress: (ids: string[]) => reporter(ids, 7) },
    { label: 'Priorité haute', onPress: (ids: string[]) => update((e) => ({ ...e, taches: e.taches.map((t) => (ids.includes(t.id) ? { ...t, priorite: 'haute' as const } : t)) })) },
    { label: 'Supprimer', danger: true, onPress: (ids: string[]) => update((e) => ({ ...e, taches: e.taches.filter((t) => !ids.includes(t.id)) })) },
  ];

  return (
    <Screen pied={sel.actif ? <BarreSelection sel={sel} tous={list.map((t) => t.id)} actions={actions} /> : null}>
      <Header eyebrow="Boîtes perso et pro" title="Tâches" right={<Btn small label="+ Ajouter" onPress={() => setOpen(true)} />} />
      {open ? (
        <Dialogue titre="Nouvelle tâche" onFermer={() => setOpen(false)}>
          <Input label="Que faut-il faire ?" value={titre} onChangeText={setTitre} placeholder="Ex. Envoyer le contrat signé" />
          <Seg label="Origine" options={[{ key: 'perso', label: 'Mail perso' }, { key: 'pro', label: 'Mail pro' }, { key: 'manuel', label: 'Autre' }]} value={source} onChange={setSource} />
          <Seg label="Priorité" options={[{ key: 'haute', label: 'Haute' }, { key: 'moyenne', label: 'Moyenne' }, { key: 'basse', label: 'Basse' }]} value={priorite} onChange={setPriorite} />
          <DatePick label="Échéance" value={echeance} onChange={setEcheance} allowNone />
          <ChoixCategories value={cats} onChange={setCats} />
          <ModePick value={mode} onChange={setMode} config={config} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn label="Ajouter la tâche" onPress={ajouter} disabled={!titre.trim()} />
            <Btn kind="sec" label="Annuler" onPress={() => setOpen(false)} />
          </View>
        </Dialogue>
      ) : null}
      <Collant>
        <Filtre
          label="Filtrer les tâches"
          options={[
            { key: 'toutes', label: 'Toutes', compte: hors.length },
            { key: 'pro', label: 'Pro', compte: parSource('pro') },
            { key: 'perso', label: 'Perso', compte: parSource('perso') },
            { key: 'manuel', label: 'Autres', compte: parSource('manuel') },
          ]}
          value={filtre}
          onChange={setFiltre}
        />
      </Collant>
      <Avancement taches={espace.taches.filter((t) => !(t.projet && idsProjets.has(t.projet)))} />
      <Panel title="Projets" count={projets.length || undefined} right={<Btn small kind="sec" label={projets.length ? 'Ouvrir' : 'Importer un plan Excel'} onPress={() => router.push('/projets')} />}>
        {projets.length ? (
          projets.map((p, i) => {
            const etat = etatProjet(espace.taches, p, today());
            return (
              <View key={p.id}>
                {i ? <Sep /> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir le projet ${p.nom}`} onPress={() => router.push({ pathname: '/projets', params: { id: p.id } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>{p.nom}</Text>
                    <T small muted>{`${etat.nbFaites}/${etat.nbTaches} tâches${etat.enRetard ? ` · ${etat.enRetard} en retard` : ''}`}</T>
                  </View>
                  <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 14 }}>{etat.plan.avancement} %</Text>
                </Pressable>
              </View>
            );
          })
        ) : (
          <Empty icone="agenda">Un gros chantier ? Importe un plan Excel : Me crée les tâches, les sous-tâches, les liens entre elles et le planning.</Empty>
        )}
      </Panel>
      <Panel title="Mes tâches" count={ouvertes ? `${ouvertes} en attente` : undefined} right={list.length ? <BoutonSelection sel={sel} /> : null}>
        {list.length ? (
          // Toutes les boîtes : une liste par boîte, avec son titre en couleur. Sinon, une seule liste.
          (filtre === 'toutes' ? BOITES : BOITES.filter((b) => b.key === filtre)).map((b) => {
            const groupe = list.filter((t) => t.source === b.key);
            if (!groupe.length) return null;
            return (
              <View key={b.key} style={{ gap: S.sm }}>
                {filtre === 'toutes' ? <Text style={{ color: vive(b.teinte), fontFamily: F.texteF, fontSize: 13, marginTop: S.xs }}>{b.label}</Text> : null}
                {groupe.map((t, i) => (
                  <View key={t.id}>
                    {i ? <Sep /> : null}
                    <Selectionnable sel={sel} id={t.id} label={t.titre}>
                      <TacheItem t={t} />
                    </Selectionnable>
                  </View>
                ))}
              </View>
            );
          })
        ) : (
          <Empty>Aucune tâche en attente. Ajoute-en une avec « + Ajouter ».</Empty>
        )}
      </Panel>
    </Screen>
  );
}
