import { Platform, Switch, View } from 'react-native';

import { BARRE_OUTILS, BARRE_PRINCIPAL, basculerPage, masquable, page, pagesMasquees, type ClePage } from '@/lib/navigation';
import { useStore } from '@/lib/store';
import { teinteDe } from '@/lib/teinte';
import { C } from '@/lib/theme';

import { Icone } from './icones';
import { Btn, Panel, T } from './ui';

function Ligne({ cle, visible, onChange }: { cle: ClePage; visible: boolean; onChange: (v: boolean) => void }) {
  const p = page(cle);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
      <Icone nom={p.icone} color={visible ? teinteDe(p.chemin) : C.muted} size={20} />
      <T style={{ flex: 1, color: visible ? C.ink : C.muted }}>{p.titre}</T>
      <Switch value={visible} onValueChange={onChange} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} accessibilityLabel={`Afficher ${p.titre}`} />
    </View>
  );
}

/**
 * Mon compte > Préférences : choisir les pages affichées dans la barre latérale (ordinateur), l'écran Plus et la
 * barre d'onglets (téléphone). Aujourd'hui et Mon compte restent toujours ; une page masquée s'ouvre encore par la recherche.
 */
export function ChoixBarre() {
  const { espace, update, mode, abonnement } = useStore();
  const masquees = pagesMasquees(espace);
  const changer = (cle: ClePage, visible: boolean) => update((e) => ({ ...e, barre: { ...e.barre, masquees: basculerPage(e, cle, visible) } }));
  const filtre = (cles: readonly ClePage[]) => cles.filter((c) => masquable(c) && (c !== 'abonnement' || (mode === 'cloud' && abonnement?.actif)));
  const groupes: [string, ClePage[]][] = [
    ['Mon quotidien', filtre(BARRE_PRINCIPAL)],
    ['Outils', filtre(BARRE_OUTILS)],
  ];
  const recherche = Platform.OS === 'web' ? 'la recherche (Ctrl+K)' : 'la recherche';
  return (
    <Panel title="Barre latérale" count={masquees.size ? `${masquees.size} masquée${masquees.size > 1 ? 's' : ''}` : undefined}>
      <T small muted>
        Garde seulement ce que tu utilises. Une page masquée disparaît de la barre latérale et de l'écran Plus, mais reste accessible par {recherche}. Aujourd'hui et Mon compte restent toujours.
      </T>
      {groupes.map(([titre, cles]) => (
        <View key={titre} style={{ gap: 2 }}>
          <T small muted style={{ marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {titre}
          </T>
          {cles.map((c) => (
            <Ligne key={c} cle={c} visible={!masquees.has(c)} onChange={(v) => changer(c, v)} />
          ))}
        </View>
      ))}
      {masquees.size ? <Btn kind="sec" label="Tout réafficher" onPress={() => update((e) => ({ ...e, barre: { ...e.barre, masquees: [] } }))} /> : null}
    </Panel>
  );
}
