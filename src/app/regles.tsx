import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Icone } from '@/components/icones';
import { ReservePro } from '@/components/reserve-pro';
import { Bloc, ZoneSquelette } from '@/components/squelettes';
import { Btn, Empty, Header, Panel, Screen, T, tap } from '@/components/ui';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import type { Regle } from '@/lib/sync';
import { alpha, C, F } from '@/lib/theme';

/**
 * Les règles de la boîte Outlook, comme dans Outlook › Paramètres › Règles : chacune dit « Si … alors … »,
 * dans l'ordre où Outlook les applique, et un interrupteur l'active ou la coupe. Les créer et les modifier
 * se fait dans Outlook (le lien ouvre la page des règles).
 */
export default function Regles() {
  const { compte: id } = useLocalSearchParams<{ compte?: string }>();
  const { session, externes } = useStore();
  const compte = externes.find((x) => x.id === id) ?? externes.find((x) => x.regles);
  const [regles, setRegles] = useState<Regle[] | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const token = session?.token;

  useEffect(() => {
    if (!compte || !token) return;
    let vivant = true;
    api<{ regles: Regle[] }>(`/integrations/${compte.id}/regles`, { token })
      .then((r) => vivant && setRegles(r.regles))
      .catch((e: Error) => vivant && (setMsg(e.message), setRegles([])));
    return () => {
      vivant = false;
    };
  }, [compte, token]);

  const basculer = async (r: Regle) => {
    if (!compte) return;
    tap();
    setBusy(r.id);
    setMsg('');
    setRegles((l) => l?.map((x) => (x.id === r.id ? { ...x, active: !r.active } : x)) ?? l);
    try {
      const res = await api<{ regles: Regle[] }>(`/integrations/${compte.id}/regles/${encodeURIComponent(r.id)}`, { method: 'PATCH', body: { active: !r.active }, token });
      setRegles(res.regles);
    } catch (e) {
      setRegles((l) => l?.map((x) => (x.id === r.id ? r : x)) ?? l);
      setMsg((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <Screen>
      <Header retour eyebrow={compte?.compte ?? 'Outlook'} title="Règles" />
      <ReservePro fonction="integrations" />
      {!compte ? (
        <View style={{ gap: 12 }}>
          <Empty icone="regles">Connecte un compte Microsoft dans Agendas & outils pour voir les règles de ta boîte Outlook.</Empty>
          <Btn kind="sec" label="Agendas & outils" onPress={() => router.push('/sources')} />
        </View>
      ) : (
        <>
          <T small muted>
            Outlook applique ces règles aux mails qui arrivent, de haut en bas. Tu peux en couper une ici ; pour en créer ou en changer une, ouvre Outlook.
          </T>
          {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
          {!regles ? (
            <ZoneSquelette label="Chargement des règles">
              <Bloc h={96} r={16} />
              <Bloc h={96} r={16} />
            </ZoneSquelette>
          ) : !regles.length && !msg ? (
            <Empty icone="regles">Aucune règle dans cette boîte.</Empty>
          ) : null}
          {regles?.map((r, i) => (
            <Panel key={r.id} title={`${i + 1}. ${r.nom}`} right={<Switch value={r.active} disabled={busy === r.id} onValueChange={() => basculer(r)} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} accessibilityLabel={`${r.active ? 'Couper' : 'Activer'} la règle ${r.nom}`} />}>
              <View style={{ gap: 8, opacity: r.active ? 1 : 0.55 }}>
                <Etape mot="Si" lignes={r.conditions.length ? r.conditions : ['Tous les mails']} couleur={C.accent} />
                <Etape mot="Alors" lignes={r.actions.length ? r.actions : ['Aucune action']} couleur={C.hebdo} />
                {r.enErreur ? <T small style={{ color: C.agressif }}>Outlook signale une erreur sur cette règle : ouvre-la dans Outlook pour la corriger.</T> : null}
              </View>
            </Panel>
          ))}
          <Pressable accessibilityRole="link" onPress={() => router.push('/sources')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icone nom="reglages" color={C.accent} size={16} />
            <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13.5 }}>Chargement des mails et boîtes partagées</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

/** « Si … » ou « Alors … » : le mot en pastille, puis une ligne par condition ou action. */
function Etape({ mot, lignes, couleur }: { mot: string; lignes: string[]; couleur: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ minWidth: 48, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: alpha(couleur, 0.16) }}>
        <Text style={{ color: couleur, fontFamily: F.texteF, fontSize: 12 }}>{mot}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        {lignes.map((l, i) => (
          <Text key={i} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14, lineHeight: 20 }}>
            {i ? `et ${l.charAt(0).toLowerCase()}${l.slice(1)}` : l}
          </Text>
        ))}
      </View>
    </View>
  );
}
