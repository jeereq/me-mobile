import { router } from 'expo-router';
import { Fragment, type ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useCopiloteVisible } from '@/components/copilote';
import { BoutonEspace } from '@/components/espace-actif';
import { Icone } from '@/components/icones';
import { Header, Panel, Screen, Sep, T } from '@/components/ui';
import { badgeAbonnement, resumeAbonnement } from '@/lib/abonnement';
import { today } from '@/lib/dates';
import { jeuDe, niveauDe, xpTotal } from '@/lib/jeu';
import { compteursDuJour, page, pagesMasquees, type ClePage } from '@/lib/navigation';
import { useStore } from '@/lib/store';
import { teinteDe, vive } from '@/lib/teinte';
import { alpha, C, MONO } from '@/lib/theme';

/** Une entrée de l'écran : titre, icône et adresse viennent de la liste des pages (`navigation.ts`). */
function Item({ cle, desc, badge, couleur = C.accent }: { cle: ClePage; desc: string; badge?: string; couleur?: string }) {
  const { titre, href, icone } = page(cle);
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
  const hab = compteursDuJour(espace, today()).habitudes;
  const sync = { ok: 'Synchronisé', en_cours: 'Synchronisation…', erreur: 'Hors ligne', local: 'Mode local' }[syncState];
  // Les pages masquées depuis Mon compte > Préférences n'apparaissent pas ici non plus (le compte, lui, reste toujours).
  const masquees = pagesMasquees(espace);
  const outils: ReactElement[] = [
    <Item key="calendrier" cle="calendrier" couleur={C.accent} desc="Tout ce qui a une date" />,
    <Item key="projets" cle="projets" couleur={C.normal} desc={projets.length ? `${projets.length} projet${projets.length > 1 ? 's' : ''}` : 'Importe un plan Excel : tâches, sous-tâches, liens et planning'} />,
    <Item key="comptes-rendus" cle="comptes-rendus" couleur={C.normal} desc={comptesRendus ? `${comptesRendus} compte${comptesRendus > 1 ? 's' : ''} rendu${comptesRendus > 1 ? 's' : ''}${aOuvrir ? ` · ${aOuvrir} point${aOuvrir > 1 ? 's' : ''} à ouvrir` : ''}` : 'Réunions et appels : clôture ce qui est réglé, ouvre ce qui en sort'} />,
    <Item key="categories" cle="categories" couleur={C.hebdo} desc={categories.length ? `${categories.length} catégorie${categories.length > 1 ? 's' : ''}` : 'Crée tes propres catégories pour tout classer'} />,
    <Item key="bilan" cle="bilan" couleur={C.normal} desc="Tes tendances et conseils" />,
    <Item key="recompenses" cle="recompenses" couleur={C.hebdo} desc={`Niveau ${n.niveau} · ${n.titre} · ${xp} pts`} />,
    <Item key="notifications" cle="notifications" couleur={C.agressif} desc="Rappels envoyés dans l'app et par email" badge={notifs.nonLues ? `${notifs.nonLues} non lus` : undefined} />,
    <Item key="journal" cle="journal" couleur={C.coach} desc="Historique de tes journées et dernier échange avec chacun" />,
    <Item key="messages" cle="messages" couleur={C.agressif} desc="Lire, répondre et écrire depuis Gmail et Outlook" badge={mailsNonLus ? `${mailsNonLus} non lus` : undefined} />,
    <Item key="sources" cle="sources" couleur={C.normal} desc="Google, Outlook, Trello, Slack, Notion…" badge={actives ? `${actives} actives` : undefined} />,
    <Item key="assistant" cle="assistant" couleur={C.accent} desc="Voix, vitesse, ton et questions à l'IA" />,
    <Item key="config" cle="config" couleur={C.muted} desc={isAdmin ? 'Réglages du système (admin)' : 'Réglages du système, en lecture seule'} badge={isAdmin ? 'ADMIN' : undefined} />,
    <Item key="equipes" cle="equipes" couleur={C.accent} desc={equipes.length ? `${equipes.length} équipe${equipes.length > 1 ? 's' : ''} · espace affiché : ${equipeActive ? equipeActive.nom : 'le mien'}` : 'Partage budgets, projets, tâches et habitudes avec d’autres comptes'} badge={equipeActive ? 'ACTIVE' : undefined} />,
    ...(mode === 'cloud' && abonnement?.actif ? [<Item key="abonnement" cle="abonnement" couleur={C.coach} desc={resumeAbonnement(abonnement)} badge={badgeAbonnement(abonnement)} />] : []),
    <Item key="compte" cle="compte" couleur={C.passif} desc={mode === 'cloud' ? profil?.email || 'Connecté' : 'Données gardées sur ce téléphone'} />,
  ];
  const visibles = outils.filter((el) => !masquees.has(el.key as ClePage));
  return (
    <Screen>
      <Header eyebrow={sync} title="Plus" right={<BoutonEspace />} />
      {copilote && !masquees.has('copilote') ? (
        <Panel accent>
          <Item cle="copilote" couleur={vive('lilas')} desc="Plan de la journée, tâches proposées et réponses à tes mails" badge={pro ? undefined : 'PRO'} />
        </Panel>
      ) : null}
      {/* Les relances sont dans l'onglet « À faire », avec les tâches ; les habitudes restent ici, en tête. */}
      {masquees.has('habitudes') ? null : (
        <Panel>
          <Item cle="habitudes" couleur={teinteDe('/habitudes')} desc={hab ? `${hab} encore à cocher aujourd'hui` : 'Tes routines du quotidien et tes séries'} badge={hab ? `${hab} à faire` : undefined} />
        </Panel>
      )}
      <Panel>
        {visibles.map((el, i) => (
          <Fragment key={el.key}>
            {i ? <Sep /> : null}
            {el}
          </Fragment>
        ))}
      </Panel>
    </Screen>
  );
}
