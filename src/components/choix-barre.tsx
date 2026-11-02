import { useState } from 'react';
import { Platform, Switch, View } from 'react-native';

import { NOM_FORMULE } from '@/lib/abonnement';
import { BARRE_OUTILS, BARRE_PRINCIPAL, basculerPage, doitChoisirPages, masquable, masqueesParDefaut, page, PAGES_PRO, pagesMasquees, type ClePage } from '@/lib/navigation';
import { useStore } from '@/lib/store';
import { teinteDe } from '@/lib/teinte';
import { C } from '@/lib/theme';

import { Icone } from './icones';
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
  const { mode, abonnement, isAdmin } = useStore();
  const filtre = (cles: readonly ClePage[]) => cles.filter((c) => masquable(c) && (c !== 'utilisateurs' || (mode === 'cloud' && isAdmin)) && (c !== 'abonnement' || (mode === 'cloud' && abonnement?.actif)));
  const groupes: [string, ClePage[]][] = [
    ['Mon quotidien', filtre(BARRE_PRINCIPAL)],
    ['Outils', filtre(BARRE_OUTILS)],
  ];
  return (
    <>
      {groupes.map(([titre, cles]) => (
        <View key={titre} style={{ gap: 2 }}>
          <T small muted style={{ marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
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
 * Mon compte > Préférences : choisir les pages affichées dans la barre latérale (ordinateur), l'écran Plus et la
 * barre d'onglets (téléphone). Aujourd'hui et Mon compte restent toujours ; une page masquée s'ouvre encore par la recherche.
 */
export function ChoixBarre() {
  const { espace, update, pro } = useStore();
  const masquees = pagesMasquees(espace);
  const changer = (cle: ClePage, visible: boolean) => update((e) => ({ ...e, barre: { ...e.barre, choisi: true, masquees: basculerPage(e, cle, visible) } }));
  return (
    <Panel title="Barre latérale" count={masquees.size ? `${masquees.size} masquée${masquees.size > 1 ? 's' : ''}` : undefined}>
      <T small muted>
        Garde seulement ce que tu utilises. Une page masquée disparaît de la barre latérale et de l'écran Plus, mais reste accessible par {recherche()}. Aujourd'hui et Mon compte restent toujours.
      </T>
      <ListePages masquees={masquees} onChange={changer} pro={pro} />
      {masquees.size ? <Btn kind="sec" label="Tout réafficher" onPress={() => update((e) => ({ ...e, barre: { ...e.barre, choisi: true, masquees: [] } }))} /> : null}
    </Panel>
  );
}

/**
 * Première connexion : « Que veux-tu voir ? ». Les pages sont pré-cochées selon la formule (sans Pro, les pages Pro
 * sont décochées), l'utilisateur ajuste puis valide. Fermer la fenêtre garde le choix affiché. Rien n'est demandé
 * dans un espace d'équipe ni à un compte qui a déjà des données ; le réglage reste dans Mon compte > Préférences.
 */
export function ChoixPremiereConnexion() {
  const { espace, update, session, equipeActive, abonnement, pro, syncState, chargementEspace } = useStore();
  const [choix, setChoix] = useState<Set<ClePage> | null>(null);
  const [fait, setFait] = useState(false);
  // On attend la première lecture du serveur : sur un nouvel appareil, l'espace d'un compte existant arrive vide d'abord.
  if (fait || !session || chargementEspace || syncState !== 'ok' || !doitChoisirPages(espace, !!equipeActive)) return null;
  // Pré-choix calculé une fois la formule connue (elle vient avec la session).
  const masquees = choix ?? new Set(masqueesParDefaut(abonnement));

  const valider = () => {
    setFait(true);
    const liste = [...masquees];
    update((e) => ({ ...e, barre: { ...e.barre, choisi: true, masquees: liste } }));
  };
  const changer = (cle: ClePage, visible: boolean) => setChoix(new Set(basculerPage({ barre: { masquees: [...masquees] } }, cle, visible)));
  const offre = abonnement?.actif ? ({ gratuit: 'Gratuite', essai: "d'essai", finances: NOM_FORMULE.finances, pro: NOM_FORMULE.pro, libre: 'libre' } as const)[abonnement.offre] : null;

  return (
    <Dialogue titre="Que veux-tu voir ?" onFermer={valider} count={offre ? `Formule ${offre}` : undefined}>
      <T small muted>
        Choisis les pages que tu veux voir dans l'app. {pro ? 'Ta formule ouvre tout : décoche ce dont tu ne te sers pas.' : 'Les pages marquées PRO sont décochées : ta formule ne les inclut pas, mais tu peux les afficher pour voir l’offre.'} Tu pourras changer d'avis dans Mon compte &gt; Préférences, et une page masquée reste accessible par {recherche()}.
      </T>
      <ListePages masquees={masquees} onChange={changer} pro={pro} />
      <Btn label="C'est parti" onPress={valider} />
    </Dialogue>
  );
}
