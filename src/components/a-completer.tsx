import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { aCompleter, MANQUES, type Manque } from '@/lib/a-completer';
import type { Plan } from '@/lib/planning';
import { alpha, C, F } from '@/lib/theme';
import type { Projet, Tache } from '@/lib/types';

import { Puce } from './finances-plus';
import { Empty, Panel, T } from './ui';

const MAX_LISTE = 60;
type Filtre = 'tout' | Manque;

/** Les actions auxquelles il manque un responsable, un budget ou une date : un geste ouvre la tâche pour la compléter. */
export function ACompleterVue({ entrees, ouvrir }: { entrees: { projet: Projet; plan: Plan; taches: Tache[] }[]; ouvrir: (projet: string, tache: string) => void }) {
  const r = useMemo(() => aCompleter(entrees), [entrees]);
  const [filtre, setFiltre] = useState<Filtre>('tout');
  if (!r.nbActions) return <Empty icone="vide">Aucune action à faire : importe un plan ou ajoute des tâches à tes projets.</Empty>;
  if (!r.actions.length) return <Empty icone="vide">{`Tout est renseigné : les ${r.nbActions} actions ont un responsable, un budget et une date.`}</Empty>;

  const liste = r.actions.filter((a) => filtre === 'tout' || a.manques.includes(filtre));
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Puce label={`Tout · ${r.actions.length}`} on={filtre === 'tout'} onPress={() => setFiltre('tout')} />
        {MANQUES.map((m) => (
          <Puce key={m.cle} label={`Sans ${m.nom.toLowerCase()} · ${r.parManque[m.cle]}`} on={filtre === m.cle} onPress={() => setFiltre(filtre === m.cle ? 'tout' : m.cle)} />
        ))}
      </View>
      <T small muted>{`${r.actions.length} action${r.actions.length > 1 ? 's' : ''} sur ${r.nbActions} ${r.actions.length > 1 ? 'sont incomplètes' : 'est incomplète'}. Touche-en une pour la compléter.`}</T>
      <Panel title="À compléter" count={liste.length}>
        {liste.slice(0, MAX_LISTE).map(({ tache, projet, manques }) => (
          <Pressable key={tache.id} accessibilityRole="button" accessibilityLabel={`Compléter ${tache.titre}`} onPress={() => ouvrir(projet.id, tache.id)} style={({ pressed }) => ({ gap: 4, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
            <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14 }}>{tache.titre}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{`${projet.emoji} ${projet.nom}`}</Text>
              {manques.map((m) => (
                <View key={m} style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: alpha(C.hebdo, 0.16) }}>
                  <Text style={{ color: C.hebdo, fontFamily: F.texteM, fontSize: 11 }}>{`Sans ${MANQUES.find((x) => x.cle === m)!.nom.toLowerCase()}`}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        ))}
        {liste.length > MAX_LISTE ? <T small muted>{`+ ${liste.length - MAX_LISTE} autres`}</T> : null}
      </Panel>
    </View>
  );
}
