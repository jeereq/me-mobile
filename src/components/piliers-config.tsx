import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/texte';

import { ajouterPilier, MAX_PILIERS, nbTachesDuPilier, nomParDefaut, piliersDe, piliersParDefaut, renommerPilier, retirerPilier } from '@/lib/piliers';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { Btn, Input, Panel, T } from './ui';

/** Les piliers du groupe : leur nom, leur nombre. Chaque action peut en porter un ou plusieurs ; on filtre et on rapporte par pilier. */
export function ConfigPiliers() {
  const { espace, update, lectureSeule } = useStore();
  const piliers = piliersDe(espace);
  const [noms, setNoms] = useState<Record<number, string>>({});
  const [aRetirer, setARetirer] = useState<number | null>(null);
  const valeur = (n: number, nom: string) => noms[n] ?? (nomParDefaut({ id: '', n, nom }) ? '' : nom);
  const enregistrer = (n: number) => {
    if (noms[n] === undefined) return;
    const nom = noms[n].trim() || `Pilier ${n}`;
    update((e) => ({ ...e, piliers: renommerPilier(piliersDe(e), n, nom) }));
    setNoms((x) => Object.fromEntries(Object.entries(x).filter(([k]) => Number(k) !== n)));
  };
  const retirer = (n: number) => {
    update((e) => retirerPilier(e, n));
    setARetirer(null);
  };
  return (
    <Panel title="Piliers du groupe" count={piliers.length}>
      {!piliers.length ? <T small muted>Aucun pilier. Ajoute-en un pour classer tes actions.</T> : null}
      {piliers.map((p) => {
        const nb = nbTachesDuPilier(espace.taches, p.n);
        return (
          <View key={p.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: alpha(C.accent, 0.14), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.accent, fontFamily: F.chiffre, fontSize: 15 }}>{p.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  value={valeur(p.n, p.nom)}
                  onChangeText={(v: string) => setNoms((x) => ({ ...x, [p.n]: v }))}
                  onEndEditing={() => enregistrer(p.n)}
                  onBlur={() => enregistrer(p.n)}
                  placeholder={`Pilier ${p.n}`}
                  accessibilityLabel={`Nom du pilier ${p.n}`}
                  editable={!lectureSeule}
                  returnKeyType="done"
                />
              </View>
              {aRetirer === p.n ? null : <Btn small kind="sec" label="Retirer" onPress={() => (nb ? setARetirer(p.n) : retirer(p.n))} disabled={lectureSeule} />}
            </View>
            {aRetirer === p.n ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 44 }}>
                <T small muted>{`Il sera retiré de ${nb} action${nb > 1 ? 's' : ''}.`}</T>
                <Btn small kind="danger" label="Retirer" onPress={() => retirer(p.n)} />
                <Btn small kind="sec" label="Garder" onPress={() => setARetirer(null)} />
              </View>
            ) : nb ? (
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12, paddingLeft: 44 }}>{`${nb} action${nb > 1 ? 's' : ''}`}</Text>
            ) : null}
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn small label="+ Pilier" onPress={() => update((e) => ({ ...e, piliers: ajouterPilier(piliersDe(e)) }))} disabled={lectureSeule || piliers.length >= MAX_PILIERS} />
        {espace.piliers ? <Btn small kind="sec" label="Remettre les dix d’origine" onPress={() => update((e) => ({ ...e, piliers: piliersParDefaut() }))} disabled={lectureSeule} /> : null}
      </View>
    </Panel>
  );
}
