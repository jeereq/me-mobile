import { useState } from 'react';
import { View } from 'react-native';

import { DatePick, ModePick } from '@/components/forms';
import { RelanceItem } from '@/components/items';
import { Btn, Empty, Header, Input, Panel, Screen, Sep, Seg } from '@/components/ui';
import { today, uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import type { Boite, Mode } from '@/lib/types';

export default function Relances() {
  const { espace, update, config } = useStore();
  const [contact, setContact] = useState('');
  const [sujet, setSujet] = useState('');
  const [boite, setBoite] = useState<Boite>('pro');
  const [date, setDate] = useState<string | null>(today());
  const [mode, setMode] = useState<Mode>(config.defauts.relance);
  const [open, setOpen] = useState(false);

  const list = [...espace.relances].sort((a, b) => (a.statut === 'repondu' ? 1 : 0) - (b.statut === 'repondu' ? 1 : 0) || a.date.localeCompare(b.date));
  const ouvertes = list.filter((r) => r.statut !== 'repondu').length;

  const ajouter = () => {
    update((e) => ({
      ...e,
      relances: [...e.relances, { id: uid(), contact: contact.trim(), sujet: sujet.trim(), boite, date: date || today(), statut: 'a_faire', mode, creeLe: new Date().toISOString() }],
    }));
    setContact('');
    setSujet('');
    setOpen(false);
  };

  return (
    <Screen>
      <Header eyebrow="Suivi" title="Relances" right={<Btn small label={open ? 'Fermer' : '+ Ajouter'} kind={open ? 'sec' : 'primary'} onPress={() => setOpen(!open)} />} />
      {open ? (
        <Panel title="Nouvelle relance" accent>
          <Input label="Qui ?" value={contact} onChangeText={setContact} placeholder="Ex. Marie, cabinet Dupont" />
          <Input label="À quel sujet ?" value={sujet} onChangeText={setSujet} placeholder="Ex. Devis du site web" />
          <Seg label="Boîte" options={[{ key: 'perso', label: 'Perso' }, { key: 'pro', label: 'Pro' }]} value={boite} onChange={setBoite} />
          <DatePick label="Relancer le" value={date} onChange={setDate} />
          <ModePick value={mode} onChange={setMode} config={config} />
          <Btn label="Ajouter la relance" onPress={ajouter} disabled={!contact.trim() || !sujet.trim()} />
        </Panel>
      ) : null}
      <Panel title="Toutes mes relances" count={ouvertes ? `${ouvertes} ouvertes` : undefined}>
        {list.length ? (
          list.map((r, i) => (
            <View key={r.id}>
              {i ? <Sep /> : null}
              <RelanceItem r={r} />
            </View>
          ))
        ) : (
          <Empty>Aucune relance. Ajoute la première avec « + Ajouter », ou laisse la synchro de tes mails les trouver.</Empty>
        )}
      </Panel>
    </Screen>
  );
}
