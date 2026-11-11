import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { aCompleter, MANQUES, type Manque } from '@/lib/a-completer';
import { filtrerPilier, nomPilier, piliersDe, piliersUtilises } from '@/lib/piliers';
import type { Plan } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Projet, Tache } from '@/lib/types';

import { FenetreFiltres } from './filtres-projet';
import { Puce } from './finances-plus';
import { Empty, Panel, T } from './ui';

const MAX_LISTE = 60;
type Filtre = 'tout' | Manque;

/** Les actions auxquelles il manque un responsable, un budget ou une date : un geste ouvre la tâche pour la compléter. */
export function ACompleterVue({ entrees, ouvrir }: { entrees: { projet: Projet; plan: Plan; taches: Tache[] }[]; ouvrir: (projet: string, tache: string) => void }) {
  const { espace } = useStore();
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const [pilier, setPilier] = useState<number | null>(null);
  const piliers = useMemo(() => piliersUtilises(entrees), [entrees]);
  const choisi = pilier !== null && piliers.includes(pilier) ? pilier : null;
  const r = useMemo(() => aCompleter(filtrerPilier(entrees, choisi)), [entrees, choisi]);
  const nb = (filtre !== 'tout' ? 1 : 0) + (choisi !== null ? 1 : 0);
  const liste = r.actions.filter((a) => filtre === 'tout' || a.manques.includes(filtre));
  const efface = () => (setFiltre('tout'), setPilier(null));
  if (!r.nbActions && choisi === null) return <Empty icone="vide">Aucune action à faire : importe un plan ou ajoute des tâches à tes projets.</Empty>;

  return (
    <View style={{ gap: 12 }}>
      <FenetreFiltres nb={nb} resultat={liste.length} onEffacer={efface}>
        <View style={{ gap: 6 }}>
          <T small muted>Il manque</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Puce label={`Tout · ${r.actions.length}`} on={filtre === 'tout'} onPress={() => setFiltre('tout')} />
            {MANQUES.map((m) => (
              <Puce key={m.cle} label={`Sans ${m.nom.toLowerCase()} · ${r.parManque[m.cle]}`} on={filtre === m.cle} onPress={() => setFiltre(filtre === m.cle ? 'tout' : m.cle)} />
            ))}
          </View>
        </View>
        {piliers.length ? (
          <View style={{ gap: 6 }}>
            <T small muted>Pilier</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Puce label="Tous" on={choisi === null} onPress={() => setPilier(null)} />
              {piliers.map((n) => (
                <Puce key={n} label={nomPilier(n, piliersDe(espace))} on={choisi === n} onPress={() => setPilier(choisi === n ? null : n)} />
              ))}
            </View>
          </View>
        ) : null}
      </FenetreFiltres>
      {!r.actions.length ? <Empty icone="vide">{r.nbActions ? `Tout est renseigné : les ${r.nbActions} actions ont un responsable, un budget et une date.` : 'Aucune action de ce pilier.'}</Empty> : null}
      {r.actions.length ? <T small muted>{`${r.actions.length} action${r.actions.length > 1 ? 's' : ''} sur ${r.nbActions} ${r.actions.length > 1 ? 'sont incomplètes' : 'est incomplète'}. Touche-en une pour la compléter.`}</T> : null}
      {r.actions.length ? (
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
      ) : null}
    </View>
  );
}
