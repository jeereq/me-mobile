import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { addDays, doneIn, habitToday, today } from '@/lib/dates';
import { tachesUrgentes } from '@/lib/planning';
import { ouvrirRecherche } from '@/lib/recherche';
import { ouvrirVoix } from '@/lib/ecoute';
import { useStore } from '@/lib/store';
import { alpha, C, encre, F } from '@/lib/theme';
import { teinteDe } from '@/lib/teinte';
import { relanceAttendue } from '@/lib/suivi';

import { Icone, type IconeNom } from './icones';

const CLE = 'me.barre.repliee';
export const LARGEUR_OUVERTE = 248;
export const LARGEUR_REPLIEE = 72;

type Entree = { titre: string; href: Href; chemin: string; icone: IconeNom; compte?: number };

/** Repliée ou non, gardé sur cet appareil. */
function useRepliee() {
  const [repliee, setRepliee] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(CLE)
      .then((v) => setRepliee(v === '1'))
      .catch(() => {});
  }, []);
  const basculer = () =>
    setRepliee((r) => {
      AsyncStorage.setItem(CLE, r ? '0' : '1').catch(() => {});
      return !r;
    });
  // Ctrl+B (⌘+B sur Mac) replie ou déplie, comme dans la plupart des éditeurs.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const touche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        basculer();
      }
    };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, []);
  return { repliee, basculer };
}

function Lien({ e, actif, repliee }: { e: Entree; actif: boolean; repliee: boolean }) {
  const [survol, setSurvol] = useState(false);
  // Chaque rubrique garde sa couleur dans la barre : l'icône est toujours teintée, le fond l'est quand on y est.
  const t = teinteDe(e.chemin);
  const couleur = actif || survol ? t : alpha(t, 0.85);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={e.compte ? `${e.titre}, ${e.compte}` : e.titre}
      accessibilityState={{ selected: actif }}
      onPress={() => router.navigate(e.href)}
      onHoverIn={() => setSurvol(true)}
      onHoverOut={() => setSurvol(false)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        height: 40,
        paddingHorizontal: 12,
        marginHorizontal: 12,
        borderRadius: 10,
        justifyContent: repliee ? 'center' : 'flex-start',
        backgroundColor: actif ? alpha(t, C.sombre ? 0.16 : 0.1) : survol ? alpha(t, 0.07) : 'transparent',
        zIndex: survol ? 20 : 0,
      }}>
      <View>
        <Icone nom={e.icone} color={couleur} size={20} />
        {repliee && e.compte ? <View style={{ position: 'absolute', top: -2, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, borderWidth: 1.5, borderColor: C.surface }} /> : null}
      </View>
      {repliee ? null : (
        <>
          <Text numberOfLines={1} style={{ flex: 1, color: actif || survol ? C.ink : C.muted, fontFamily: actif ? F.texteF : F.texteM, fontSize: 14 }}>
            {e.titre}
          </Text>
          {e.compte ? (
            <View style={{ minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: actif ? t : alpha(t, 0.16) }}>
              <Text style={{ color: actif ? encre(t) : t, fontFamily: F.texteF, fontSize: 11 }}>{e.compte > 99 ? '99+' : e.compte}</Text>
            </View>
          ) : null}
        </>
      )}
      {/* Repliée : le nom apparaît au survol, à droite de l'icône. */}
      {repliee && survol ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 54, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.ink }}>
          <Text numberOfLines={1} style={{ color: C.bg, fontFamily: F.texteM, fontSize: 12 }}>
            {e.compte ? `${e.titre} · ${e.compte}` : e.titre}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Section({ titre, repliee }: { titre: string; repliee: boolean }) {
  if (repliee) return <View style={{ height: 1, backgroundColor: C.line, marginHorizontal: 20, marginVertical: 10 }} />;
  return <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 24, marginTop: 18, marginBottom: 6 }}>{titre}</Text>;
}

function Liste({ repliee, children }: { repliee: boolean; children: ReactNode }) {
  if (repliee) return <View style={{ flex: 1, gap: 2, paddingBottom: 12 }}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

/**
 * Barre latérale de la version ordinateur, présente sur tous les écrans : la marque, les onglets avec leurs compteurs,
 * tous les outils (sans passer par Plus), puis le compte. Elle se replie en une colonne d'icônes (bouton ou Ctrl+B).
 */
export function BarreLaterale() {
  const { espace, profil, mode, isAdmin, notifs, syncState, mails, abonnement } = useStore();
  const { repliee, basculer } = useRepliee();
  const chemin = usePathname();
  const [survolBouton, setSurvolBouton] = useState(false);
  const [survolCompte, setSurvolCompte] = useState(false);
  const [survolRecherche, setSurvolRecherche] = useState(false);
  const [survolVoix, setSurvolVoix] = useState(false);

  const d = today();
  const bientot = addDays(d, 2);
  const principal: Entree[] = [
    { titre: "Aujourd'hui", href: '/', chemin: '/', icone: 'jour' },
    { titre: 'Mon copilote', href: '/copilote', chemin: '/copilote', icone: 'copilote' },
    { titre: 'Relances', href: '/relances', chemin: '/relances', icone: 'relances', compte: espace.relances.filter((r) => relanceAttendue(r) && r.date <= d).length },
    { titre: 'Mails', href: '/messages', chemin: '/messages', icone: 'mail', compte: mails.filter((m) => m.nonLu).length },
    { titre: 'Tâches', href: '/taches', chemin: '/taches', icone: 'taches', compte: tachesUrgentes(espace, d, bientot).length },
    { titre: 'Habitudes', href: '/habitudes', chemin: '/habitudes', icone: 'habitudes', compte: espace.habitudes.filter((h) => habitToday(h, d) && !doneIn(h, d)).length },
  ];
  const outils: Entree[] = [
    { titre: 'Calendrier', href: '/calendrier', chemin: '/calendrier', icone: 'calendrier' },
    { titre: 'Projets', href: '/projets', chemin: '/projets', icone: 'projets' },
    { titre: 'Finances', href: '/finances', chemin: '/finances', icone: 'portefeuille' },
    { titre: 'Catégories', href: '/categories', chemin: '/categories', icone: 'etiquette' },
    { titre: 'Statistiques', href: '/statistiques', chemin: '/statistiques', icone: 'stats' },
    { titre: 'État des lieux', href: '/rapport', chemin: '/rapport', icone: 'eclair' },
    { titre: 'Récompenses', href: '/recompenses', chemin: '/recompenses', icone: 'trophee' },
    { titre: 'Journal & contacts', href: '/journal', chemin: '/journal', icone: 'livre' },
    { titre: 'Agendas & outils', href: '/sources', chemin: '/sources', icone: 'agenda' },
    { titre: 'Équipes', href: '/equipes', chemin: '/equipes', icone: 'equipe' },
    { titre: 'Assistant audio', href: '/assistant', chemin: '/assistant', icone: 'onde' },
    { titre: 'Notifications', href: '/notifications', chemin: '/notifications', icone: 'cloche', compte: notifs.nonLues },
    { titre: 'Configuration', href: '/config', chemin: '/config', icone: 'reglages' },
    ...(mode === 'cloud' && abonnement?.actif ? [{ titre: 'Abonnement', href: '/abonnement' as Href, chemin: '/abonnement', icone: 'trophee' as IconeNom }] : []),
  ];
  const actif = (e: Entree) => (e.chemin === '/' ? chemin === '/' : chemin.startsWith(e.chemin));

  const nom = mode === 'cloud' ? profil?.nom || profil?.email || 'Mon compte' : 'Mode local';
  const detail = mode === 'cloud' ? `${isAdmin ? 'Admin' : 'Utilisateur'} · ${{ ok: 'synchronisé', en_cours: 'synchro…', erreur: 'hors ligne', local: '' }[syncState]}` : 'Données sur cet appareil';
  const sync = { ok: C.coach, en_cours: C.hebdo, erreur: C.agressif, local: C.muted }[syncState];
  const compteActif = chemin.startsWith('/compte');

  return (
    <View
      style={[
        { width: repliee ? LARGEUR_REPLIEE : LARGEUR_OUVERTE, backgroundColor: C.surface, borderRightWidth: 1, borderRightColor: C.line, paddingTop: 16, paddingBottom: 12, zIndex: 5 },
        Platform.OS === 'web' ? ({ transitionProperty: 'width', transitionDuration: '160ms' } as object) : null,
      ]}>
      <View style={{ flexDirection: repliee ? 'column' : 'row', alignItems: 'center', gap: 10, paddingHorizontal: repliee ? 0 : 20, marginBottom: 8 }}>
        <Pressable accessibilityRole="link" accessibilityLabel="Accueil" onPress={() => router.navigate('/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: repliee ? undefined : 1 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.accentInk, fontFamily: F.titre, fontSize: 15 }}>Me</Text>
          </View>
          {repliee ? null : (
            <View>
              <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 17 }}>Me</Text>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>Assistant perso</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={repliee ? 'Déplier la barre latérale (Ctrl+B)' : 'Replier la barre latérale (Ctrl+B)'}
          onPress={basculer}
          onHoverIn={() => setSurvolBouton(true)}
          onHoverOut={() => setSurvolBouton(false)}
          hitSlop={6}
          style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: survolBouton ? alpha(C.ink, 0.06) : 'transparent' }}>
          <Icone nom="panneau" color={survolBouton ? C.ink : C.muted} size={18} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Rechercher (Ctrl+K)"
        onPress={ouvrirRecherche}
        onHoverIn={() => setSurvolRecherche(true)}
        onHoverOut={() => setSurvolRecherche(false)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: repliee ? 'center' : 'flex-start',
          gap: 10,
          marginHorizontal: 12,
          marginTop: 4,
          marginBottom: 4,
          paddingVertical: 9,
          paddingHorizontal: repliee ? 0 : 12,
          borderRadius: 10,
          backgroundColor: survolRecherche ? alpha(C.ink, 0.06) : C.sunk,
          borderWidth: 1,
          borderColor: C.line,
        }}>
        <Icone nom="loupe" color={survolRecherche ? C.ink : C.muted} size={18} />
        {repliee ? null : (
          <>
            <Text style={{ flex: 1, color: C.muted, fontFamily: F.texte, fontSize: 14 }}>Rechercher</Text>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: C.line }}>Ctrl K</Text>
          </>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Parler à l'app"
        onPress={() => ouvrirVoix()}
        onHoverIn={() => setSurvolVoix(true)}
        onHoverOut={() => setSurvolVoix(false)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: repliee ? 'center' : 'flex-start', gap: 10, marginHorizontal: 12, marginBottom: 4, paddingVertical: 9, paddingHorizontal: repliee ? 0 : 12, borderRadius: 10, backgroundColor: survolVoix ? alpha(C.ink, 0.06) : 'transparent' }}>
        <Icone nom="micro" color={survolVoix ? C.ink : C.muted} size={18} />
        {repliee ? null : <Text style={{ flex: 1, color: C.muted, fontFamily: F.texte, fontSize: 14 }}>Parler à Me</Text>}
      </Pressable>

      {/* Repliée, pas de défilement : il couperait les noms affichés au survol. */}
      <Liste repliee={repliee}>
        <Section titre="Mon quotidien" repliee={repliee} />
        {principal.map((e) => (
          <Lien key={e.chemin} e={e} actif={actif(e)} repliee={repliee} />
        ))}
        <Section titre="Outils" repliee={repliee} />
        {outils.map((e) => (
          <Lien key={e.chemin} e={e} actif={actif(e)} repliee={repliee} />
        ))}
      </Liste>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Mon compte : ${nom}`}
        onPress={() => router.navigate('/compte')}
        onHoverIn={() => setSurvolCompte(true)}
        onHoverOut={() => setSurvolCompte(false)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginHorizontal: 12,
          padding: repliee ? 6 : 10,
          borderRadius: 12,
          justifyContent: repliee ? 'center' : 'flex-start',
          backgroundColor: compteActif ? C.accentSoft : survolCompte ? alpha(C.ink, 0.05) : C.sunk,
          borderWidth: 1,
          borderColor: C.line,
        }}>
        <View>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: alpha(C.accent, 0.18), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.accent, fontFamily: F.titre, fontSize: 14 }}>{(nom.trim()[0] || 'm').toUpperCase()}</Text>
          </View>
          <View style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: sync, borderWidth: 2, borderColor: C.sunk }} />
        </View>
        {repliee ? null : (
          <View style={{ flex: 1, gap: 1 }}>
            <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>
              {nom}
            </Text>
            <Text numberOfLines={1} style={{ color: C.muted, fontSize: 12 }}>
              {detail}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}
