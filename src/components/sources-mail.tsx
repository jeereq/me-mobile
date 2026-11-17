import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/texte';

import { fmtCourt } from '@/lib/dates';
import { nomBoite } from '@/lib/mails';
import { basculerSource, boitesDesSources, mailsChoisissables, MAX_SOURCES } from '@/lib/sources-mail';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { Filtre } from './onglets';
import { Btn, Dialogue, Input, T } from './ui';

/**
 * Mélanger d'autres mails : l'utilisateur en choisit jusqu'à 5, que le copilote lit ensemble
 * pour écrire un mail ou une réponse qui tient compte de tout ce contexte. `sauf` : le mail auquel on répond.
 */
export function ChoixSources({ valeur, onChange, sauf }: { valeur: string[]; onChange: (v: string[]) => void; sauf?: string }) {
  const { mails } = useStore();
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [boite, setBoite] = useState('toutes');
  const boites = useMemo(() => boitesDesSources(mails, sauf), [mails, sauf]);
  const choix = mailsChoisissables(mails, recherche, sauf, boite === 'toutes' ? undefined : boite);
  const par = (id: string) => mails.find((m) => m.id === id);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <Btn small kind="sec" label={valeur.length ? `Mails mélangés · ${valeur.length}` : 'Mélanger des mails'} onPress={() => setOuvert(true)} />
        {valeur.map((id) => {
          const m = par(id);
          return (
            <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Retirer ${m?.sujet || 'ce mail'}`} onPress={() => onChange(valeur.filter((x) => x !== id))} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: C.accent, backgroundColor: alpha(C.accent, 0.14), opacity: pressed ? 0.7 : 1 })}>
              <Text numberOfLines={1} style={{ color: C.accent, fontFamily: F.texteF, fontSize: 13, maxWidth: 170 }}>{m?.sujet || m?.contact || 'Mail'}</Text>
              <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 12 }}>✕</Text>
            </Pressable>
          );
        })}
      </View>
      {ouvert ? (
        <Dialogue titre="Mélanger des mails" count={`${valeur.length}/${MAX_SOURCES}`} large onFermer={() => setOuvert(false)} pied={<Btn label={valeur.length ? `Utiliser ${valeur.length} mail${valeur.length > 1 ? 's' : ''}` : 'Fermer'} onPress={() => setOuvert(false)} />}>
          <Input value={recherche} onChangeText={setRecherche} placeholder="Rechercher un mail" accessibilityLabel="Rechercher un mail" returnKeyType="search" />
          {boites.length > 1 ? (
            <Filtre
              label="Boîte"
              value={boite}
              onChange={setBoite}
              options={[
                { key: 'toutes', label: 'Toutes les boîtes' },
                ...boites.map((b) => ({ key: b.adresse, label: b.partagee ? `${nomBoite(b.adresse)} (partagée)` : b.adresse, compte: b.nombre })),
              ]}
            />
          ) : null}
          {!choix.length ? <T small muted>{mails.length ? 'Aucun mail ne correspond.' : 'Aucun mail chargé : ouvre d’abord ta boîte.'}</T> : null}
          <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
            {choix.slice(0, 60).map((m) => {
              const on = valeur.includes(m.id);
              const plein = !on && valeur.length >= MAX_SOURCES;
              return (
                <Pressable key={m.id} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: plein }} disabled={plein} onPress={() => onChange(basculerSource(valeur, m.id))} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, opacity: plein ? 0.45 : pressed ? 0.7 : 1 })}>
                  <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: on ? C.accent : C.line, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Text style={{ color: C.accentInk, fontSize: 12, fontFamily: F.texteF }}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>{m.sujet || '(sans objet)'}</Text>
                    <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{`${m.contact} · ${fmtCourt(m.date)}`}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          {valeur.length >= MAX_SOURCES ? <T small muted>{`${MAX_SOURCES} mails au plus : retire-en un pour en choisir un autre.`}</T> : null}
        </Dialogue>
      ) : null}
    </View>
  );
}
