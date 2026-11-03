import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { taire } from '@/lib/assistant';
import { aLaSuite } from '@/lib/dictee';
import { ecouteDisponible, ecouter, type Ecoute } from '@/lib/ecoute';
import { alpha, C, F } from '@/lib/theme';
import { choisirLangueDictee, langueDictee, LANGUES_DICTEE, type LangueDictee } from '@/lib/voix-pref';

import { BoutonMail } from './boutons-mail';
import { T, tap } from './ui';

const NOMS: Record<LangueDictee, string> = { 'fr-FR': 'FR', 'en-US': 'EN', 'pt-PT': 'PT' };

/** Dicter un texte : il s'écrit à la suite du brouillon, en français, anglais ou portugais. Une longue pause ou « Terminer » arrête. */
export function BoutonDicter({ valeur, onTexte, label = 'Dicter' }: { valeur: string; onTexte: (v: string) => void; label?: string }) {
  const [actif, setActif] = useState(false);
  const [msg, setMsg] = useState('');
  const [langue, setLangue] = useState<LangueDictee>(langueDictee);
  const ecoute = useRef<Ecoute | null>(null);
  useEffect(() => () => ecoute.current?.annuler(), []);
  if (!ecouteDisponible()) return null;

  const dicter = async () => {
    tap();
    if (ecoute.current) return ecoute.current.arreter();
    taire();
    setMsg('');
    setActif(true);
    const base = valeur;
    ecoute.current = await ecouter(
      {
        texte: (t) => onTexte(aLaSuite(base, t)),
        fin: () => {
          ecoute.current = null;
          setActif(false);
        },
        erreur: setMsg,
      },
      [],
      { langue, silence: 5000, attente: 10000, ponctuation: true },
    );
    if (!ecoute.current) setActif(false);
  };
  const changerLangue = () => {
    const l = LANGUES_DICTEE[(LANGUES_DICTEE.indexOf(langue) + 1) % LANGUES_DICTEE.length];
    setLangue(l);
    choisirLangueDictee(l);
  };

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <BoutonMail icone="micro" actif={actif} label={actif ? 'Terminer' : label} onPress={dicter} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Langue de la dictée : ${NOMS[langue]}. Changer`} disabled={actif} hitSlop={6} onPress={changerLangue} style={({ pressed }) => ({ paddingVertical: 7, paddingHorizontal: 8, borderRadius: 999, backgroundColor: pressed ? alpha(C.ink, 0.06) : 'transparent', opacity: actif ? 0.5 : 1 })}>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{NOMS[langue]}</Text>
        </Pressable>
      </View>
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
    </View>
  );
}
