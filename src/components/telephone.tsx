import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { api } from '@/lib/api';
import { chercherPays, composer, drapeau, numeroPlausible, PAYS, paysDe, PAYS_DEFAUT, separer, type Pays } from '@/lib/indicatifs';
import { C, F } from '@/lib/theme';

import { Text } from './texte';
import { Dialogue, Input } from './ui';

const RDC = [PAYS_DEFAUT.code];
let chargement: Promise<string[]> | null = null;
const chargerIndicatifs = () =>
  (chargement ??= api<{ indicatifs?: string[] }>('/auth/options', { discret: true })
    .then((o) => o.indicatifs ?? RDC)
    .catch(() => {
      chargement = null;
      return RDC;
    }));

/** L'admin vient de changer la liste : on la relira. */
export const indicatifsPerimes = () => {
  chargement = null;
};

/** Les pays ouverts par l'admin : la RD Congo seule tant qu'il n'en a pas ouvert d'autres. */
export function useIndicatifs() {
  const [codes, setCodes] = useState(RDC);
  useEffect(() => {
    let vivant = true;
    chargerIndicatifs().then((c) => {
      if (vivant) setCodes(c);
    });
    return () => {
      vivant = false;
    };
  }, []);
  return useMemo(() => paysDe(codes), [codes]);
}

/** Le pays et le numéro tapé. Coller « +33 6… » choisit le pays tout seul, s'il est ouvert. */
export function useTelephone(options?: { /** Tous les pays, pour l'admin qui en ouvre. */ tous?: boolean }) {
  const ouverts = useIndicatifs();
  const liste = options?.tous ? PAYS : ouverts;
  const [pays, choisirPays] = useState(PAYS_DEFAUT);
  const [national, setNational] = useState('');
  // Un indicatif resté dans le champ : celui d'un pays qui n'est pas ouvert.
  const ferme = /^\s*(\+|00)/.test(national);
  return {
    liste,
    pays,
    choisirPays,
    national,
    saisir: (x: string) => {
      const s = separer(x);
      if (s && liste.some((p) => p.code === s.pays.code)) {
        choisirPays(s.pays);
        setNational(s.national);
      } else setNational(x);
    },
    ferme,
    complet: ferme ? '' : composer(pays, national),
    valide: !ferme && numeroPlausible(pays, national),
    vide: !national.trim(),
    vider: () => setNational(''),
  };
}

/** Le bouton « 🇨🇩 +243 » posé devant le champ, et la liste des pays. */
export function BoutonIndicatif({ pays, liste, onChoix }: { pays: Pays; liste: Pays[]; onChoix: (p: Pays) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState('');
  const fermer = () => {
    setOuvert(false);
    setQ('');
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Indicatif : ${pays.nom}, +${pays.code}${liste.length > 1 ? '. Changer' : ''}`}
        disabled={liste.length <= 1}
        onPress={() => setOuvert(true)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk, opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ fontSize: 16 }}>{drapeau(pays.iso)}</Text>
        <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14, fontVariant: ['tabular-nums'] }}>+{pays.code}</Text>
      </Pressable>
      {ouvert ? (
        <Dialogue titre="Indicatif" onFermer={fermer}>
          <Input placeholder="Pays ou indicatif" value={q} onChangeText={setQ} autoCorrect={false} accessibilityLabel="Chercher un pays" />
          <View>
            {chercherPays(q, liste).map((p) => (
              <Pressable
                key={p.iso}
                accessibilityRole="button"
                accessibilityState={{ selected: p.iso === pays.iso }}
                onPress={() => {
                  onChoix(p);
                  fermer();
                }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 18 }}>{drapeau(p.iso)}</Text>
                <Text numberOfLines={1} style={{ flex: 1, color: p.iso === pays.iso ? C.accent : C.ink, fontFamily: p.iso === pays.iso ? F.texteF : F.texte, fontSize: 15 }}>
                  {p.nom}
                </Text>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 14, fontVariant: ['tabular-nums'] }}>+{p.code}</Text>
              </Pressable>
            ))}
          </View>
        </Dialogue>
      ) : null}
    </>
  );
}

/** Un champ de numéro de téléphone, avec son indicatif. */
export function ChampTelephone({ tel, ...props }: { tel: ReturnType<typeof useTelephone> } & Omit<ComponentProps<typeof Input>, 'value' | 'onChangeText' | 'gauche'>) {
  return (
    <Input
      placeholder={tel.pays.code === PAYS_DEFAUT.code ? '81 234 5678' : 'Numéro'}
      keyboardType="phone-pad"
      autoComplete="tel"
      {...props}
      value={tel.national}
      onChangeText={tel.saisir}
      erreur={tel.ferme ? 'Ce pays n’est pas ouvert pour l’instant.' : props.erreur}
      gauche={<BoutonIndicatif pays={tel.pays} liste={tel.liste} onChoix={tel.choisirPays} />}
    />
  );
}
