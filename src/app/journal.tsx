import { useState } from 'react';
import { Text, View } from 'react-native';

import { DatePick } from '@/components/forms';
import { Btn, Empty, Header, IconBtn, Input, Panel, Screen, Sep, T } from '@/components/ui';
import { parse, today, uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C, MONO } from '@/lib/theme';

export default function Journal() {
  const { espace, update } = useStore();
  const [nom, setNom] = useState('');
  const [org, setOrg] = useState('');
  const [date, setDate] = useState<string | null>(today());
  const jours = Object.values(espace.journal).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  const contacts = [...espace.contacts].sort((a, b) => b.dernierEchange.localeCompare(a.dernierEchange));
  const d = today();

  return (
    <Screen>
      <Header retour eyebrow="Historique" title="Journal & contacts" />
      <Panel title="14 derniers jours">
        {jours.length ? (
          jours.map((j) => (
            <View key={j.date} style={{ gap: 6 }}>
              <Text style={{ color: C.accent, fontFamily: MONO, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
                {parse(j.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              {j.entrees.map((e, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                  <Text style={{ color: C.muted, fontFamily: MONO }}>{e.h}</Text>
                  <T style={{ flex: 1 }}>{e.texte}</T>
                </View>
              ))}
            </View>
          ))
        ) : (
          <Empty>Ton journal se remplit depuis l'écran Aujourd'hui.</Empty>
        )}
      </Panel>

      <Panel title="Contacts" count={contacts.length || undefined}>
        {contacts.length ? (
          contacts.map((c, i) => {
            const jours = Math.round((parse(d).getTime() - parse(c.dernierEchange).getTime()) / 864e5);
            return (
              <View key={c.id}>
                {i ? <Sep /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
                  <View style={{ flex: 1 }}>
                    <T>{c.nom}</T>
                    <T small muted>
                      {c.organisation ? `${c.organisation} · ` : ''}
                      <Text style={{ color: jours > 30 ? C.agressif : C.muted }}>{jours === 0 ? "échange aujourd'hui" : `dernier échange il y a ${jours} j`}</Text>
                    </T>
                  </View>
                  <IconBtn label="Échange aujourd'hui" glyph="↻" onPress={() => update((e) => ({ ...e, contacts: e.contacts.map((x) => (x.id === c.id ? { ...x, dernierEchange: d } : x)) }))} />
                  <IconBtn label="Supprimer" glyph="×" danger onPress={() => update((e) => ({ ...e, contacts: e.contacts.filter((x) => x.id !== c.id) }))} />
                </View>
              </View>
            );
          })
        ) : (
          <Empty>Aucun contact pour l'instant.</Empty>
        )}
        <Sep />
        <Input label="Nom" value={nom} onChangeText={setNom} />
        <Input label="Organisation ou lien" value={org} onChangeText={setOrg} />
        <DatePick label="Dernier échange" value={date} onChange={setDate} />
        <Btn
          label="Ajouter le contact"
          disabled={!nom.trim()}
          onPress={() => {
            update((e) => ({ ...e, contacts: [...e.contacts, { id: uid(), nom: nom.trim(), organisation: org.trim(), dernierEchange: date || d }] }));
            setNom('');
            setOrg('');
          }}
        />
      </Panel>
    </Screen>
  );
}
