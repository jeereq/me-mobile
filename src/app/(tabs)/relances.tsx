import { useState } from 'react';
import { View } from 'react-native';

import { ChoixAffectation } from '@/components/affectation';
import { ChoixCategories } from '@/components/categories';
import { DatePick, ModePick } from '@/components/forms';
import { RelanceItem } from '@/components/items';
import { FiltreMembres } from '@/components/responsable';
import { BarreSelection, BoutonSelection, Selectionnable, useSelection } from '@/components/selection';
import { Btn, Collant, Dialogue, Empty, Header, Input, Panel, Screen, Sep, Seg } from '@/components/ui';
import { Filtre } from '@/components/onglets';
import { tRelance, useActions } from '@/lib/actions';
import { addDays, today, uid } from '@/lib/dates';
import { elementsDePlan, estDeMembre, libelleFiltre, proprietaireParDefaut, type FiltreMembre } from '@/lib/equipe-taches';
import { useStore } from '@/lib/store';
import type { Boite, Mode, Relance } from '@/lib/types';

export default function Relances() {
  const { espace, update, config, equipeActive, session } = useStore();
  const [contact, setContact] = useState('');
  const [sujet, setSujet] = useState('');
  const [boite, setBoite] = useState<Boite>('pro');
  const [date, setDate] = useState<string | null>(today());
  const [mode, setMode] = useState<Mode>(config.defauts.relance);
  const [cats, setCats] = useState<string[] | undefined>(undefined);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  // Dans une équipe, une relance est à quelqu'un : à moi tant que je n'en choisis pas un autre.
  const membres = equipeActive?.membres ?? [];
  const moi = session?.user.id;
  const [choisi, setChoisi] = useState<{ affecteA?: string; responsable?: string } | null>(null);
  const affectation = choisi ?? proprietaireParDefaut(membres, moi);
  const [membre, setMembre] = useState<FiltreMembre>('tous');
  const filtreMembre: FiltreMembre = equipeActive ? membre : 'tous';
  const sel = useSelection();
  const { enLot } = useActions();

  const [filtre, setFiltre] = useState<'toutes' | 'afaire' | 'relance' | 'repondu'>('toutes');
  const triees = [...espace.relances].sort((a, b) => (a.statut === 'repondu' ? 1 : 0) - (b.statut === 'repondu' ? 1 : 0) || a.date.localeCompare(b.date));
  const list = triees.filter((r) => filtre === 'toutes' || (filtre === 'afaire' ? r.statut === 'a_faire' : r.statut === filtre)).filter((r) => estDeMembre(r, filtreMembre, membres, moi));
  const ouvertes = triees.filter((r) => r.statut !== 'repondu').length;
  const parStatut = (st: Relance['statut']) => triees.filter((r) => r.statut === st).length;

  const ajouter = () => {
    update((e) => ({
      ...e,
      relances: [...e.relances, { id: uid(), contact: contact.trim(), sujet: sujet.trim(), boite, date: date || today(), statut: 'a_faire', mode, ...(equipeActive && affectation.affecteA ? { affecteA: affectation.affecteA, ...(affectation.responsable ? { responsable: affectation.responsable } : {}) } : {}), ...(cats?.length ? { categories: cats } : {}), ...(note.trim() ? { note: note.trim() } : {}), creeLe: new Date().toISOString() }],
    }));
    setChoisi(null);
    setContact('');
    setSujet('');
    setCats(undefined);
    setNote('');
    setOpen(false);
  };

  const reporter = (ids: string[], jours: number) => update((e) => ({ ...e, relances: e.relances.map((r) => (ids.includes(r.id) ? { ...r, date: addDays(today(), jours) } : r)) }));
  const statut = (ids: string[], s: 'repondu' | 'relance') => enLot((e, d, h) => ids.filter((id) => e.relances.find((r) => r.id === id)?.statut !== s).reduce((acc, id) => tRelance(acc, id, s, d, h, config.delaiRelanceJours), e));
  const actions = [
    { label: 'Répondu', onPress: (ids: string[]) => statut(ids, 'repondu') },
    { label: 'Relancé', onPress: (ids: string[]) => statut(ids, 'relance') },
    { label: 'Pour demain', onPress: (ids: string[]) => reporter(ids, 1) },
    { label: 'Dans 1 semaine', onPress: (ids: string[]) => reporter(ids, 7) },
    { label: 'Supprimer', danger: true, onPress: (ids: string[]) => update((e) => ({ ...e, relances: e.relances.filter((r) => !ids.includes(r.id)) })) },
  ];

  return (
    <Screen pied={sel.actif ? <BarreSelection sel={sel} tous={list.map((r) => r.id)} actions={actions} /> : null}>
      <Header eyebrow="Suivi" title="Relances" right={<Btn small label="+ Ajouter" onPress={() => setOpen(true)} />} />
      {open ? (
        <Dialogue titre="Nouvelle relance" onFermer={() => setOpen(false)}>
          <Input label="Qui ?" value={contact} onChangeText={setContact} placeholder="Ex. Marie, cabinet Dupont" />
          <Input label="À quel sujet ?" value={sujet} onChangeText={setSujet} placeholder="Ex. Devis du site web" />
          <Seg label="Boîte" options={[{ key: 'perso', label: 'Perso' }, { key: 'pro', label: 'Pro' }]} value={boite} onChange={setBoite} />
          <DatePick label="Relancer le" value={date} onChange={setDate} />
          <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Ce qu'il faut savoir avant de relancer" multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
          <ChoixAffectation t={affectation} genre="relance" onChoisir={(p) => setChoisi((a) => ({ ...(a ?? affectation), ...p }))} />
          <ChoixCategories value={cats} onChange={setCats} />
          <ModePick value={mode} onChange={setMode} config={config} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn label="Ajouter la relance" onPress={ajouter} disabled={!contact.trim() || !sujet.trim()} />
            <Btn kind="sec" label="Annuler" onPress={() => setOpen(false)} />
          </View>
        </Dialogue>
      ) : null}
      <Collant>
        <Filtre
          label="Filtrer les relances"
          options={[
            { key: 'toutes', label: 'Toutes', compte: triees.length },
            { key: 'afaire', label: 'À faire', compte: parStatut('a_faire') },
            { key: 'relance', label: 'Relancées', compte: parStatut('relance') },
            { key: 'repondu', label: 'Répondues', compte: parStatut('repondu') },
          ]}
          value={filtre}
          onChange={setFiltre}
        />
      </Collant>
      <FiltreMembres elements={elementsDePlan(espace, today()).filter((x) => x.genre === 'relance')} value={membre} onChange={setMembre} />
      <Panel title={equipeActive ? libelleFiltre(filtreMembre, membres, 'relance') : 'Toutes mes relances'} count={ouvertes ? `${ouvertes} ouvertes` : undefined} right={triees.length ? <BoutonSelection sel={sel} /> : null}>
        {list.length ? (
          list.map((r, i) => (
            <View key={r.id}>
              {i ? <Sep /> : null}
              <Selectionnable sel={sel} id={r.id} label={`${r.contact}, ${r.sujet}`}>
                <RelanceItem r={r} />
              </Selectionnable>
            </View>
          ))
        ) : (
          <Empty>{triees.length ? 'Aucune relance dans ce filtre.' : 'Aucune relance. Ajoute la première avec « + Ajouter », ou laisse la synchro de tes mails les trouver.'}</Empty>
        )}
      </Panel>
    </Screen>
  );
}
