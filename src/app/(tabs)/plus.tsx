import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useCopiloteVisible } from '@/components/copilote';
import { BoutonEspace } from '@/components/espace-actif';
import { Icone, type IconeNom } from '@/components/icones';
import { Header, Panel, Screen, Sep, T } from '@/components/ui';
import { badgeAbonnement, resumeAbonnement } from '@/lib/abonnement';
import { doneIn, habitToday, today } from '@/lib/dates';
import { jeuDe, niveauDe, xpTotal } from '@/lib/jeu';
import { useStore } from '@/lib/store';
import { teinteDe, vive } from '@/lib/teinte';
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
  const { isAdmin, mode, profil, espace, syncState, notifs, equipes, equipeActive, mails, abonnement, pro } = useStore();
  const copilote = useCopiloteVisible();
  const mailsNonLus = mails.filter((m) => m.nonLu).length;
  const xp = xpTotal(jeuDe(espace));
  const n = niveauDe(xp);
  const actives = Object.values(espace.sources).filter((s) => s?.actif).length;
  const projets = (espace.projets ?? []).filter((p) => !p.archive);
  const categories = espace.categories ?? [];
  const comptesRendus = (espace.comptesRendus ?? []).filter((x) => x.notes.trim() || x.actions.length).length;
  const aOuvrir = (espace.comptesRendus ?? []).reduce((n, x) => n + x.actions.filter((a) => !a.cree).length, 0);
  const d = today();
  const hab = espace.habitudes.filter((h) => habitToday(h, d) && !doneIn(h, d)).length;
  const sync = { ok: 'Synchronisé', en_cours: 'Synchronisation…', erreur: 'Hors ligne', local: 'Mode local' }[syncState];
  return (
    <Screen>
      <Header eyebrow={sync} title="Plus" right={<BoutonEspace />} />
      {copilote ? (
        <Panel accent>
          <Item icone="copilote" couleur={vive('lilas')} titre="Mon copilote" desc="Plan de la journée, tâches proposées et réponses à tes mails" href={'/copilote' as Href} badge={pro ? undefined : 'PRO'} />
        </Panel>
      ) : null}
      {/* Les relances sont dans l'onglet « À faire », avec les tâches ; les habitudes restent ici, en tête. */}
      <Panel>
        <Item icone="habitudes" couleur={teinteDe('/habitudes')} titre="Habitudes" desc={hab ? `${hab} encore à cocher aujourd'hui` : 'Tes routines du quotidien et tes séries'} href="/habitudes" badge={hab ? `${hab} à faire` : undefined} />
      </Panel>
      <Panel>
        <Item icone="calendrier" couleur={C.accent} titre="Calendrier" desc="Tâches, projets, relances, habitudes, dépenses et objectifs : tout ce qui a une date" href="/calendrier" />
        <Sep />
        <Item icone="projets" couleur={C.normal} titre="Projets" desc={projets.length ? `${projets.length} projet${projets.length > 1 ? 's' : ''} · tâches, sous-tâches, liens et planning` : 'Importe un plan Excel : tâches, sous-tâches, liens et planning'} href="/projets" />
        <Sep />
        <Item icone="compteRendu" couleur={C.normal} titre="Comptes rendus" desc={comptesRendus ? `${comptesRendus} compte${comptesRendus > 1 ? 's' : ''} rendu${comptesRendus > 1 ? 's' : ''}${aOuvrir ? ` · ${aOuvrir} point${aOuvrir > 1 ? 's' : ''} à ouvrir` : ''}` : 'Réunions et appels : clôture ce qui est réglé, ouvre ce qui en sort'} href={'/comptes-rendus' as Href} />
        <Sep />
        <Item icone="etiquette" couleur={C.hebdo} titre="Catégories" desc={categories.length ? `${categories.length} catégorie${categories.length > 1 ? 's' : ''} pour tes dépenses, budgets, tâches et projets` : 'Crée tes propres catégories pour tout classer'} href="/categories" />
        <Sep />
        <Item icone="stats" couleur={C.normal} titre="Statistiques" desc="Tes tendances : tâches, relances, habitudes, dépenses" href="/statistiques" />
        <Sep />
        <Item icone="eclair" couleur={C.hebdo} titre="État des lieux" desc="Rapport du jour : finances, tâches, relances, habitudes et recommandations" href="/rapport" />
        <Sep />
        <Item icone="trophee" couleur={C.hebdo} titre="Récompenses" desc={`Niveau ${n.niveau} · ${n.titre} · ${xp} pts`} href="/recompenses" />
        <Sep />
        <Item icone="cloche" couleur={C.agressif} titre="Notifications" desc="Rappels envoyés dans l'app et par email" href="/notifications" badge={notifs.nonLues ? `${notifs.nonLues} non lus` : undefined} />
        <Sep />
        <Item icone="livre" couleur={C.coach} titre="Journal & contacts" desc="Historique de tes journées et dernier échange avec chacun" href="/journal" />
        <Sep />
        <Item icone="mail" couleur={C.agressif} titre="Mails" desc="Lire, répondre et écrire depuis Gmail et Outlook" href="/messages" badge={mailsNonLus ? `${mailsNonLus} non lus` : undefined} />
        <Sep />
        <Item icone="agenda" couleur={C.normal} titre="Agendas & outils" desc="Google, Outlook, Trello, Slack, Notion…" href="/sources" badge={actives ? `${actives} actives` : undefined} />
        <Sep />
        <Item icone="onde" couleur={C.accent} titre="Assistant audio" desc="Voix, vitesse, ton et questions à l'IA" href="/assistant" />
        <Sep />
        <Item icone="reglages" couleur={C.muted} titre="Configuration" desc={isAdmin ? 'Réglages du système (admin)' : 'Réglages du système, en lecture seule'} href="/config" badge={isAdmin ? 'ADMIN' : undefined} />
        <Sep />
        <Item icone="equipe" couleur={C.accent} titre="Équipes" desc={equipes.length ? `${equipes.length} équipe${equipes.length > 1 ? 's' : ''} · espace affiché : ${equipeActive ? equipeActive.nom : 'le mien'}` : 'Partage budgets, projets, tâches et habitudes avec d’autres comptes'} href="/equipes" badge={equipeActive ? 'ACTIVE' : undefined} />
        <Sep />
        {mode === 'cloud' && abonnement?.actif ? (
          <>
            <Item icone="trophee" couleur={C.coach} titre="Abonnement" desc={resumeAbonnement(abonnement)} href="/abonnement" badge={badgeAbonnement(abonnement)} />
            <Sep />
          </>
        ) : null}
        <Item icone="profil" couleur={C.passif} titre="Mon compte" desc={mode === 'cloud' ? profil?.email || 'Connecté' : 'Données gardées sur ce téléphone'} href="/compte" />
      </Panel>
    </Screen>
  );
}
