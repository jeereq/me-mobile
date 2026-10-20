import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Header, Panel, Screen, Sep, T } from '@/components/ui';
import { useStore } from '@/lib/store';
import { C, MONO } from '@/lib/theme';

function Item({ titre, desc, href, badge }: { titre: string; desc: string; href: Href; badge?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontWeight: '600' }}>{titre}</T>
        <T small muted>
          {desc}
        </T>
      </View>
      {badge ? <Text style={{ color: C.accent, fontFamily: MONO, fontSize: 11 }}>{badge}</Text> : null}
      <Text style={{ color: C.accent, fontSize: 20 }}>›</Text>
    </Pressable>
  );
}

export default function Plus() {
  const { isAdmin, mode, profil, espace, syncState } = useStore();
  const actives = Object.values(espace.sources).filter((s) => s?.actif).length;
  const sync = { ok: 'Synchronisé', en_cours: 'Synchronisation…', erreur: 'Hors ligne', local: 'Mode local' }[syncState];
  return (
    <Screen>
      <Header eyebrow={sync} title="Plus" />
      <Panel>
        <Item titre="Journal & contacts" desc="Historique de tes journées et dernier échange avec chacun" href="/journal" />
        <Sep />
        <Item titre="Agendas & outils" desc="Google, Outlook, Trello, Slack, Notion…" href="/sources" badge={actives ? `${actives} actives` : undefined} />
        <Sep />
        <Item titre="Assistant audio" desc="Voix, vitesse, ton et questions à l'IA" href="/assistant" />
        <Sep />
        <Item titre="Configuration" desc={isAdmin ? 'Réglages du système (admin)' : 'Réglages du système, en lecture seule'} href="/config" badge={isAdmin ? 'ADMIN' : undefined} />
        <Sep />
        <Item titre="Mon compte" desc={mode === 'cloud' ? profil?.email || 'Connecté' : 'Données gardées sur ce téléphone'} href="/compte" />
      </Panel>
    </Screen>
  );
}
