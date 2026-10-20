import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icone, type IconeNom } from '@/components/icones';
import { Header, Panel, Screen, Sep, T } from '@/components/ui';
import { bilan, financesDe, fmtMontant } from '@/lib/finances';
import { today } from '@/lib/dates';
import { jeuDe, niveauDe, xpTotal } from '@/lib/jeu';
import { useStore } from '@/lib/store';
import { alpha, C, MONO } from '@/lib/theme';

function Item({ titre, desc, href, badge, icone, couleur = C.accent }: { titre: string; desc: string; href: Href; badge?: string; icone: IconeNom; couleur?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 }, pressed && { opacity: 0.7 }]}>
      <View style={{ width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: alpha(couleur, 0.35), backgroundColor: alpha(couleur, 0.1), alignItems: 'center', justifyContent: 'center' }}>
        <Icone nom={icone} color={couleur} />
      </View>
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
  const { isAdmin, mode, profil, espace, syncState, notifs } = useStore();
  const xp = xpTotal(jeuDe(espace));
  const n = niveauDe(xp);
  const actives = Object.values(espace.sources).filter((s) => s?.actif).length;
  const f = financesDe(espace);
  const mois = bilan(f, 'mois', today(), today());
  const sync = { ok: 'Synchronisé', en_cours: 'Synchronisation…', erreur: 'Hors ligne', local: 'Mode local' }[syncState];
  return (
    <Screen>
      <Header eyebrow={sync} title="Plus" />
      <Panel>
        <Item icone="portefeuille" couleur={C.coach} titre="Finances" desc={f.budgets.length ? `${fmtMontant(mois.total, f.devise)} dépensés ce mois${mois.plafondTotal ? ` sur ${fmtMontant(mois.plafondTotal, f.devise)}` : ''}` : 'Budgets par semaine, mois ou année, et dépenses'} href="/finances" />
        <Sep />
        <Item icone="stats" couleur={C.normal} titre="Statistiques" desc="Tes tendances : tâches, relances, habitudes, dépenses" href="/statistiques" />
        <Sep />
        <Item icone="trophee" couleur={C.hebdo} titre="Récompenses" desc={`Niveau ${n.niveau} · ${n.titre} · ${xp} pts`} href="/recompenses" />
        <Sep />
        <Item icone="cloche" couleur={C.agressif} titre="Notifications" desc="Rappels envoyés dans l'app et par email" href="/notifications" badge={notifs.nonLues ? `${notifs.nonLues} non lus` : undefined} />
        <Sep />
        <Item icone="livre" couleur={C.coach} titre="Journal & contacts" desc="Historique de tes journées et dernier échange avec chacun" href="/journal" />
        <Sep />
        <Item icone="agenda" couleur={C.normal} titre="Agendas & outils" desc="Google, Outlook, Trello, Slack, Notion…" href="/sources" badge={actives ? `${actives} actives` : undefined} />
        <Sep />
        <Item icone="onde" couleur={C.accent} titre="Assistant audio" desc="Voix, vitesse, ton et questions à l'IA" href="/assistant" />
        <Sep />
        <Item icone="reglages" couleur={C.muted} titre="Configuration" desc={isAdmin ? 'Réglages du système (admin)' : 'Réglages du système, en lecture seule'} href="/config" badge={isAdmin ? 'ADMIN' : undefined} />
        <Sep />
        <Item icone="profil" couleur={C.passif} titre="Mon compte" desc={mode === 'cloud' ? profil?.email || 'Connecté' : 'Données gardées sur ce téléphone'} href="/compte" />
      </Panel>
    </Screen>
  );
}
