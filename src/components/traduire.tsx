import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { api } from '@/lib/api';
import { LANGUES, traduire, voixDe, type Langue } from '@/lib/traduction';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { BoutonMail, useEcoute } from './boutons-mail';
import { useCopiloteVisible } from './copilote';
import { T } from './ui';

/** Traduire passe par le copilote : réservé à ceux qui l'ont. */
export function useTraducteur() {
  const { session, pro } = useStore();
  const copilote = useCopiloteVisible();
  const token = session?.token;
  return {
    disponible: !!(pro && copilote && token),
    traduire: (textes: string[], langue: Langue) => traduire(textes, langue, (lot, l) => api<{ textes: string[] }>('/assistant/traduire', { method: 'POST', token, body: { langue: l, textes: lot } }).then((r) => r.textes)),
  };
}

/** « Traduire : Original, FR, EN, PT ». */
export function ChoixLangue({ titre, valeur, charge, onChange }: { titre: string; valeur: Langue | null; charge?: boolean; onChange: (l: Langue | null) => void }) {
  const pastille = (cle: Langue | null, label: string, nom = label) => {
    const on = valeur === cle;
    return (
      <Pressable
        key={label}
        accessibilityRole="button"
        accessibilityLabel={nom}
        accessibilityState={{ selected: on }}
        onPress={() => onChange(cle)}
        style={({ pressed }) => ({ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.14) : pressed ? alpha(C.ink, 0.06) : 'transparent' })}>
        <Text style={{ color: on ? C.accent : C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{charge ? 'Traduction…' : titre}</Text>
      {pastille(null, 'Original')}
      {LANGUES.map((l) => pastille(l.cle, l.cle.toUpperCase(), l.label))}
    </View>
  );
}

/** Un message et, à la demande, sa traduction à sa place, à écouter avec la bonne voix. `texte` est ce qui se traduit : le message seul, sans sa signature. */
export function Traduisible({ texte, children }: { texte: string; children: ReactNode }) {
  const traducteur = useTraducteur();
  const { parle, lire, arreter } = useEcoute();
  const [langue, setLangue] = useState<Langue | null>(null);
  const [traduit, setTraduit] = useState('');
  const [charge, setCharge] = useState(false);
  const [msg, setMsg] = useState('');
  if (!traducteur.disponible || !texte.trim()) return <>{children}</>;
  const choisir = async (l: Langue | null) => {
    setLangue(l);
    setMsg('');
    if (!l) return;
    setCharge(true);
    try {
      const [t] = await traducteur.traduire([texte], l);
      setTraduit(t);
    } catch (e) {
      setLangue(null);
      setMsg((e as Error).message);
    } finally {
      setCharge(false);
    }
  };
  const vu = langue && !charge ? traduit : '';
  return (
    <View style={{ gap: 10 }}>
      <ChoixLangue titre="Traduire" valeur={langue} charge={charge} onChange={choisir} />
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
      {vu ? (
        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 23 }}>{vu}</Text>
          <View style={{ flexDirection: 'row' }}>
            <BoutonMail icone="onde" actif={parle} label={parle ? 'Arrêter' : 'Écouter la traduction'} onPress={() => (parle ? arreter() : lire(vu, 'Traduction', voixDe(langue!)))} />
          </View>
        </View>
      ) : (
        children
      )}
    </View>
  );
}
