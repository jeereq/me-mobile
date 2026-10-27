import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import type { CompteConnecte } from '@/lib/sync';
import { alpha, C, F } from '@/lib/theme';

import { T, tap } from './ui';

const PERIODES = [3, 7, 14, 30, 90];
const NOMBRES = [25, 50, 100];

/**
 * Comment la boîte de réception d'un compte se charge dans Me : sur combien de jours, et combien de fils.
 * Le nombre sert aussi de taille de page quand on ouvre un dossier (« Charger plus » demande la suivante).
 */
export function ChargementMails({ compte }: { compte: CompteConnecte }) {
  const { session, synchroniser } = useStore();
  const [c, setC] = useState(compte.chargement ?? { jours: 7, max: 25 });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const choisir = async (patch: Partial<typeof c>) => {
    tap();
    const suivant = { ...c, ...patch };
    setC(suivant);
    setBusy(true);
    setMsg('');
    try {
      await api(`/integrations/${compte.id}`, { method: 'PATCH', body: { chargement: patch }, token: session?.token });
      setMsg(`Enregistré : les ${suivant.max} derniers fils sur ${suivant.jours} jours.`);
      await synchroniser(true);
    } catch (e) {
      setC(c);
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Ligne label="Période" options={PERIODES.map((j) => ({ v: j, label: j === 3 ? '3 jours' : j === 7 ? '1 semaine' : j === 14 ? '2 semaines' : j === 30 ? '1 mois' : '3 mois' }))} valeur={c.jours} disabled={busy} onChoisir={(jours) => choisir({ jours })} />
      <Ligne label="Conversations au plus" options={NOMBRES.map((n) => ({ v: n, label: String(n) }))} valeur={c.max} disabled={busy} onChoisir={(max) => choisir({ max })} />
      <T small muted>
        La réception se relit toutes les 15 minutes, ou quand tu touches « Actualiser ». Les autres dossiers s'ouvrent depuis Mails et se chargent page par page.
      </T>
      {msg ? <T small muted>{msg}</T> : null}
    </View>
  );
}

function Ligne({ label, options, valeur, onChoisir, disabled }: { label: string; options: { v: number; label: string }[]; valeur: number; onChoisir: (v: number) => void; disabled?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => {
          const on = o.v === valeur;
          return (
            <Pressable
              key={o.v}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled }}
              disabled={disabled}
              onPress={() => !on && onChoisir(o.v)}
              style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.16) : pressed ? alpha(C.ink, 0.06) : 'transparent', opacity: disabled && !on ? 0.6 : 1 })}>
              <Text style={{ color: on ? C.ink : C.muted, fontFamily: on ? F.texteF : F.texte, fontSize: 13 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
