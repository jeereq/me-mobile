import { useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';

import { NOM_FORMULE } from '@/lib/abonnement';
import { BARRE_OUTILS, BARRE_PRINCIPAL, basculerPage, doitChoisirPages, masquable, masqueesParDefaut, page, PAGES_PRO, pagesMasquees, type ClePage } from '@/lib/navigation';
import { useStore } from '@/lib/store';
import { teinteDe } from '@/lib/teinte';
import { alpha, C, encre, F } from '@/lib/theme';
import { DESCRIPTION_PAGE, PROFILS_PAGES, visite } from '@/lib/visite';

import { Icone, type IconeNom } from './icones';
import { Text } from './texte';
import { Btn, Dialogue, Panel, T, Tag } from './ui';

function Ligne({ cle, visible, onChange, pro }: { cle: ClePage; visible: boolean; onChange: (v: boolean) => void; pro?: boolean }) {
  const p = page(cle);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
      <Icone nom={p.icone} color={visible ? teinteDe(p.chemin) : C.muted} size={20} />
      <T style={{ flex: 1, color: visible ? C.ink : C.muted }}>{p.titre}</T>
      {pro ? <Tag label="PRO" /> : null}
      <Switch value={visible} onValueChange={onChange} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} accessibilityLabel={`Afficher ${p.titre}`} />
    </View>
  );
}

/** Les interrupteurs des pages, groupés comme la barre latérale. `pro` marque les pages Pro quand la formule ne les a pas. */
function ListePages({ masquees, onChange, pro }: { masquees: Set<ClePage>; onChange: (cle: ClePage, visible: boolean) => void; pro: boolean }) {
  const { mode, abonnement, enEquipe, aModule } = useStore();
  const filtre = (cles: readonly ClePage[]) => cles.filter((c) => masquable(c) && (c !== 'utilisateurs' || (mode === 'cloud' && enEquipe)) && (c !== 'versements' || (mode === 'cloud' && aModule('versements'))) && (c !== 'abonnement' || (mode === 'cloud' && abonnement?.actif)));
  const groupes: [string, ClePage[]][] = [
    ['Mon quotidien', filtre(BARRE_PRINCIPAL)],
    ['Outils', filtre(BARRE_OUTILS)],
  ];
  return (
    <>
      {groupes.map(([titre, cles]) => (
        <View key={titre} style={{ gap: 2 }}>
          <T small muted style={{ marginTop: 8 }}>
            {titre}
          </T>
          {cles.map((c) => (
            <Ligne key={c} cle={c} visible={!masquees.has(c)} onChange={(v) => onChange(c, v)} pro={!pro && PAGES_PRO.includes(c)} />
          ))}
        </View>
      ))}
    </>
  );
}

const recherche = () => (Platform.OS === 'web' ? 'la recherche (Ctrl+K)' : 'la recherche');

/**
 * Mon compte > Préférences : choisir les pages affichées dans la barre latérale (ordinateur), l'écran Menu et la
 * barre d'onglets (téléphone). Aujourd'hui et Mon compte restent toujours ; une page masquée s'ouvre encore par la recherche.
 */
export function ChoixBarre() {
  const { espace, update, pro } = useStore();
  const masquees = pagesMasquees(espace);
  const changer = (cle: ClePage, visible: boolean) => update((e) => ({ ...e, barre: { ...e.barre, choisi: true, masquees: basculerPage(e, cle, visible) } }));
  return (
    <Panel title="Barre latérale" count={masquees.size ? `${masquees.size} masquée${masquees.size > 1 ? 's' : ''}` : undefined}>
      <T small muted>
        Garde seulement ce que tu utilises. Une page masquée disparaît de la barre latérale et de l'écran Menu, mais reste accessible par {recherche()}. Aujourd'hui et Mon compte restent toujours.
      </T>
      <ListePages masquees={masquees} onChange={changer} pro={pro} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {masquees.size ? <Btn kind="sec" label="Tout réafficher" onPress={() => update((e) => ({ ...e, barre: { ...e.barre, choisi: true, masquees: [] } }))} /> : null}
        <Btn kind="sec" label="Revoir la visite" onPress={() => visite.demarrer()} />
      </View>
    </Panel>
  );
}

/** Les pages que l'on peut choisir, dans l'ordre de la barre (les pages d'équipe seulement pour l'équipe). */
function usePagesProposees() {
  const { mode, abonnement, enEquipe, aModule } = useStore();
  const filtre = (cles: readonly ClePage[]) => cles.filter((c) => masquable(c) && (c !== 'utilisateurs' || (mode === 'cloud' && enEquipe)) && (c !== 'versements' || (mode === 'cloud' && aModule('versements'))) && (c !== 'abonnement' || (mode === 'cloud' && abonnement?.actif)));
  return { principal: filtre(BARRE_PRINCIPAL), outils: filtre(BARRE_OUTILS) };
}

/** Pages de l'équipe ou du compte : toujours gardées par une sélection toute faite. */
const GARDEES: readonly ClePage[] = ['config', 'utilisateurs', 'versements', 'abonnement'];

/** Une page à cocher : icône à sa couleur, nom, à quoi elle sert. Cochée, elle prend sa couleur. */
function CartePage({ cle, visible, pro, onChange }: { cle: ClePage; visible: boolean; pro: boolean; onChange: (v: boolean) => void }) {
  const p = page(cle);
  const t = teinteDe(p.chemin);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: visible }}
      accessibilityLabel={`${p.titre}${pro ? ', Pro' : ''}`}
      onPress={() => onChange(!visible)}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: 220, minWidth: 200, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1.5, borderColor: visible ? alpha(t, 0.6) : C.line, backgroundColor: visible ? alpha(t, C.sombre ? 0.07 : 0.05) : 'transparent', opacity: pressed ? 0.75 : 1 })}>
      <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: visible ? alpha(t, 0.18) : C.sunk }}>
        <Icone nom={p.icone} color={visible ? t : C.muted} size={18} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, color: visible ? C.ink : C.muted, fontFamily: F.texteM, fontSize: 14 }}>
            {p.titre}
          </Text>
          {pro ? <Tag label="PRO" /> : null}
        </View>
        {DESCRIPTION_PAGE[cle] ? (
          <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
            {DESCRIPTION_PAGE[cle]}
          </Text>
        ) : null}
      </View>
      <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: visible ? t : 'transparent', borderWidth: visible ? 0 : 1.5, borderColor: alpha(C.muted, 0.6) }}>
        {visible ? <Text style={{ color: encre(t), fontFamily: F.texteF, fontSize: 11 }}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

/** Une promesse de l'app, sur l'écran de bienvenue. */
function Atout({ icone, chemin, titre, texte }: { icone: IconeNom; chemin: string; titre: string; texte: string }) {
  const t = teinteDe(chemin);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(t, 0.16) }}>
        <Icone nom={icone} color={t} size={20} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>{titre}</Text>
        <T small muted>
          {texte}
        </T>
      </View>
    </View>
  );
}

/** Où en est l'accueil : deux points, le courant allongé. */
function Points({ n, sur }: { n: number; sur: number }) {
  return (
    <View accessibilityLabel={`Étape ${n + 1} sur ${sur}`} style={{ flexDirection: 'row', gap: 6 }}>
      {Array.from({ length: sur }, (_, i) => (
        <View key={i} style={{ width: i === n ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === n ? C.accent : C.line }} />
      ))}
    </View>
  );
}

/**
 * Première connexion, en deux temps : la bienvenue (ce que fait Me), puis « Que veux-tu voir ? » avec des sélections
 * toutes faites et des cartes à cocher. Valider lance la visite guidée ; fermer garde le choix affiché, sans visite.
 * Les pages sont pré-cochées selon la formule (sans Pro, les pages Pro sont décochées). Rien n'est demandé dans un espace
 * d'équipe ni à un compte qui a déjà des données ; le réglage reste dans Mon compte > Préférences.
 */
export function ChoixPremiereConnexion() {
  const { espace, update, session, profil, equipeActive, abonnement, pro, syncState, chargementEspace } = useStore();
  const { principal, outils } = usePagesProposees();
  const [choix, setChoix] = useState<Set<ClePage> | null>(null);
  const [etape, setEtape] = useState<'bienvenue' | 'pages'>('bienvenue');
  const [fait, setFait] = useState(false);
  // On attend la première lecture du serveur : sur un nouvel appareil, l'espace d'un compte existant arrive vide d'abord.
  if (fait || !session || chargementEspace || syncState !== 'ok' || !doitChoisirPages(espace, !!equipeActive)) return null;
  // Pré-choix calculé une fois la formule connue (elle vient avec la session).
  const masquees = choix ?? new Set(masqueesParDefaut(abonnement));
  const toutes = [...principal, ...outils];
  const visibles = toutes.filter((c) => !masquees.has(c)).length + 2;

  const valider = (avecVisite: boolean) => {
    setFait(true);
    const liste = [...masquees];
    update((e) => ({ ...e, barre: { ...e.barre, choisi: true, masquees: liste }, ...(avecVisite ? {} : { visite: { ...e.visite, faite: true } }) }));
    if (avecVisite) visite.demarrer();
  };
  const changer = (cle: ClePage, v: boolean) => setChoix(new Set(basculerPage({ barre: { masquees: [...masquees] } }, cle, v)));
  // Les pages masquées par une sélection toute faite.
  const masqueesPar = (pages: readonly ClePage[] | null | 'formule') => new Set(pages === 'formule' ? masqueesParDefaut(abonnement) : pages ? toutes.filter((c) => !pages.includes(c) && !GARDEES.includes(c)) : []);
  const appliquer = (pages: readonly ClePage[] | null | 'formule') => setChoix(masqueesPar(pages));
  const profilActif = PROFILS_PAGES.find((x) => {
    const m = masqueesPar(x.pages);
    return toutes.every((c) => m.has(c) === masquees.has(c));
  })?.cle;
  const prenom = (profil?.nom ?? '').trim().split(/\s+/)[0];
  const offre = abonnement?.actif ? ({ gratuit: 'Gratuite', essai: "d'essai", finances: NOM_FORMULE.finances, projets: NOM_FORMULE.projets, pro: NOM_FORMULE.pro, libre: 'libre' } as const)[abonnement.offre] : null;
  const grille = (titre: string, cles: ClePage[]) =>
    cles.length ? (
      <View style={{ gap: 8 }}>
        <T small muted>
          {titre}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {cles.map((c) => (
            <CartePage key={c} cle={c} visible={!masquees.has(c)} pro={!pro && PAGES_PRO.includes(c)} onChange={(v) => changer(c, v)} />
          ))}
        </View>
      </View>
    ) : null;

  if (etape === 'bienvenue')
    return (
      <Dialogue
        titre={prenom ? `Bienvenue, ${prenom}` : 'Bienvenue sur Me'}
        onFermer={() => valider(false)}
        pied={
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Points n={0} sur={2} />
            <Btn label="Choisir mes pages" onPress={() => setEtape('pages')} />
          </View>
        }>
        <T muted>Me range ta journée, ton argent et tes cotisations.</T>
        <View style={{ gap: 14 }}>
          <Atout icone="jour" chemin="/taches" titre="Ta journée" texte="Tâches, relances, rendez-vous et habitudes." />
          <Atout icone="portefeuille" chemin="/finances" titre="Ton argent" texte="Budgets, dépenses et un rapport chaque soir." />
          <Atout icone="equipe" chemin="/versements" titre="Tes cotisations" texte="Groupes, tours et versements, l’argent gardé par Me." />
        </View>
        <T small muted>
          Ensuite, une visite d’une minute te montre où tout se trouve.
        </T>
      </Dialogue>
    );

  return (
    <Dialogue
      titre="Que veux-tu voir ?"
      count={offre ? `Formule ${offre}` : undefined}
      onFermer={() => valider(false)}
      pied={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Btn kind="sec" label="Retour" onPress={() => setEtape('bienvenue')} />
          <T small muted style={{ flex: 1, textAlign: 'right' }}>
            {`${visibles} pages`}
          </T>
          <Btn label="C’est parti" onPress={() => valider(true)} />
        </View>
      }>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PROFILS_PAGES.map((x) => {
          const on = x.cle === profilActif;
          return (
            <Pressable key={x.cle} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => appliquer(x.pages)} style={({ pressed }) => ({ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.14) : 'transparent', opacity: pressed ? 0.75 : 1 })}>
              <Text style={{ color: on ? C.accent : C.ink, fontFamily: on ? F.texteF : F.texteM, fontSize: 13.5 }}>{x.titre}</Text>
            </Pressable>
          );
        })}
      </View>
      <T small muted>
        Aujourd’hui et Mon compte restent toujours. Tout se change ensuite dans Mon compte.
      </T>
      {grille('Mon quotidien', principal)}
      {grille('Outils', outils)}
    </Dialogue>
  );
}
