import { useState } from 'react';
import { View } from 'react-native';

import { DatePick, ModePick } from '@/components/forms';
import { TacheItem } from '@/components/items';
import { Btn, Empty, Header, Input, Panel, Screen, Sep, Seg } from '@/components/ui';
import { uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import type { Mode, Priorite, Tache } from '@/lib/types';

const PRIO: Record<Priorite, number> = { haute: 0, moyenne: 1, basse: 2 };

export default function Taches() {
  const { espace, update, config } = useStore();
  const [titre, setTitre] = useState('');
  const [source, setSource] = useState<Tache['source']>('pro');
  const [priorite, setPriorite] = useState<Priorite>('moyenne');
  const [echeance, setEcheance] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(config.defauts.tache);
  const [open, setOpen] = useState(false);
  const [filtre, setFiltre] = useState<'toutes' | 'perso' | 'pro'>('toutes');

  const list = [...espace.taches]
    .filter((t) => filtre === 'toutes' || t.source === filtre)
    .sort((a, b) => (a.statut === 'fait' ? 1 : 0) - (b.statut === 'fait' ? 1 : 0) || PRIO[a.priorite] - PRIO[b.priorite] || (a.echeance || '9999').localeCompare(b.echeance || '9999'));
  const ouvertes = list.filter((t) => t.statut !== 'fait').length;

  const ajouter = () => {
    update((e) => ({ ...e, taches: [...e.taches, { id: uid(), titre: titre.trim(), source, priorite, echeance, statut: 'en_attente', mode, creeLe: new Date().toISOString() }] }));
    setTitre('');
    setOpen(false);
  };

  return (
    <Screen>
      <Header eyebrow="Boîtes perso et pro" title="Tâches" right={<Btn small label={open ? 'Fermer' : '+ Ajouter'} kind={open ? 'sec' : 'primary'} onPress={() => setOpen(!open)} />} />
      {open ? (
        <Panel title="Nouvelle tâche" accent>
          <Input label="Que faut-il faire ?" value={titre} onChangeText={setTitre} placeholder="Ex. Envoyer le contrat signé" />
          <Seg label="Origine" options={[{ key: 'perso', label: 'Mail perso' }, { key: 'pro', label: 'Mail pro' }, { key: 'manuel', label: 'Autre' }]} value={source} onChange={setSource} />
          <Seg label="Priorité" options={[{ key: 'haute', label: 'Haute' }, { key: 'moyenne', label: 'Moyenne' }, { key: 'basse', label: 'Basse' }]} value={priorite} onChange={setPriorite} />
          <DatePick label="Échéance" value={echeance} onChange={setEcheance} allowNone />
          <ModePick value={mode} onChange={setMode} config={config} />
          <Btn label="Ajouter la tâche" onPress={ajouter} disabled={!titre.trim()} />
        </Panel>
      ) : null}
      <Seg options={[{ key: 'toutes', label: 'Toutes' }, { key: 'perso', label: 'Perso' }, { key: 'pro', label: 'Pro' }]} value={filtre} onChange={setFiltre} />
      <Panel title="Mes tâches" count={ouvertes ? `${ouvertes} en attente` : undefined}>
        {list.length ? (
          list.map((t, i) => (
            <View key={t.id}>
              {i ? <Sep /> : null}
              <TacheItem t={t} />
            </View>
          ))
        ) : (
          <Empty>Aucune tâche en attente. Ajoute-en une avec « + Ajouter ».</Empty>
        )}
      </Panel>
    </Screen>
  );
}
