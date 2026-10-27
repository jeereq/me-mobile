import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import type { AgendaDispo, CompteConnecte } from '@/lib/sync';
import { alpha, C, F } from '@/lib/theme';

import { Bloc, ZoneSquelette } from './squelettes';
import { Btn, Empty, T, tap } from './ui';

/**
 * Les agendas d'un compte connecté, à cocher un par un : seuls ceux qui sont cochés sont synchronisés.
 * Rien de coché = ceux que le service affiche par défaut (comportement d'avant ce réglage).
 */
export function AgendasDuCompte({ compte }: { compte: CompteConnecte }) {
  const { session, synchroniser } = useStore();
  const token = session?.token;
  const [dispo, setDispo] = useState<AgendaDispo[] | null>(null);
  const [choisis, setChoisis] = useState<string[]>(compte.agendas ?? []);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [modifie, setModifie] = useState(false);

  useEffect(() => {
    if (!token) return;
    let vivant = true;
    api<{ agendas: AgendaDispo[]; choisis: string[] }>(`/integrations/${compte.id}/agendas`, { token })
      .then((r) => {
        if (!vivant) return;
        setDispo(r.agendas);
        setChoisis(r.choisis);
      })
      .catch((e: Error) => {
        if (!vivant) return;
        setDispo([]);
        setMsg(e.message);
      });
    return () => {
      vivant = false;
    };
  }, [token, compte.id]);

  const basculer = (id: string) => {
    tap();
    setModifie(true);
    setChoisis((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  };

  const enregistrer = async () => {
    setBusy(true);
    setMsg('');
    try {
      await api(`/integrations/${compte.id}`, { method: 'PATCH', body: { agendas: choisis }, token });
      setModifie(false);
      setMsg(choisis.length ? 'Agendas enregistrés. Les rendez-vous arrivent.' : 'Tous les agendas affichés dans le service seront repris.');
      await synchroniser(true);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!dispo)
    return (
      <ZoneSquelette label="Chargement des agendas">
        <Bloc h={34} r={10} />
        <Bloc h={34} r={10} />
      </ZoneSquelette>
    );

  if (!dispo.length)
    return (
      <>
        <Empty icone="agenda">{msg || 'Aucun agenda lisible sur ce compte.'}</Empty>
        {msg ? null : <T small muted>Si tu viens d'activer l'API Agenda, touche « Synchroniser maintenant » puis rouvre cet écran.</T>}
      </>
    );

  return (
    <View style={{ gap: 8 }}>
      <T small muted>
        {choisis.length ? `${choisis.length} agenda${choisis.length > 1 ? 's' : ''} synchronisé${choisis.length > 1 ? 's' : ''} sur ${dispo.length}.` : `Aucun choix : Me reprend les ${dispo.length} agendas affichés dans le service.`}
      </T>
      <View style={{ gap: 2 }}>
        {dispo.map((a) => {
          const on = choisis.includes(a.id);
          return (
            <Pressable
              key={a.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`Synchroniser l'agenda ${a.nom}${a.principal ? ', agenda principal' : ''}`}
              onPress={() => basculer(a.id)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42, paddingHorizontal: 8, borderRadius: 10, backgroundColor: on ? alpha(C.accent, C.sombre ? 0.14 : 0.08) : 'transparent', opacity: pressed ? 0.7 : 1 })}>
              <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: on ? 0 : 1, borderColor: C.line, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Text style={{ color: C.accentInk, fontSize: 12, lineHeight: 14 }}>✓</Text> : null}
              </View>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: a.couleur || C.muted }} />
              <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>
                {a.nom}
              </Text>
              {a.principal ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>principal</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn small label={busy ? 'Enregistrement…' : 'Enregistrer'} disabled={busy || !modifie} onPress={enregistrer} />
        {choisis.length ? <Btn small kind="sec" label="Tout décocher" onPress={() => (setChoisis([]), setModifie(true))} /> : <Btn small kind="sec" label="Tout cocher" onPress={() => (setChoisis(dispo.map((a) => a.id)), setModifie(true))} />}
      </View>
      {msg ? <T small muted>{msg}</T> : null}
    </View>
  );
}
