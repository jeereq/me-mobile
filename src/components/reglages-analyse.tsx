import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { LOT_OPTIONS, MAX_CONSIGNES, nettoyerConsignes } from '@/lib/copilote';
import { alpha, C, F } from '@/lib/theme';

import { teinteCopilote } from './copilote';
import { Input, T } from './ui';

export function Puce({ on, onPress, children }: { on: boolean; onPress: () => void; children: ReactNode }) {
  const t = teinteCopilote();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? t.c : C.line, backgroundColor: on ? t.douce : pressed ? alpha(C.ink, 0.06) : 'transparent' })}>
      <Text numberOfLines={1} style={{ color: on ? C.ink : C.muted, fontFamily: on ? F.texteM : F.texte, fontSize: 13 }}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Rubrique({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 11.5, letterSpacing: 0.4, textTransform: 'uppercase' }}>{titre}</Text>
      {children}
    </View>
  );
}

/** Des consignes toutes prêtes : un toucher les ajoute à celles déjà écrites. */
const IDEES = ['Repère ce qui est urgent', 'Factures et paiements en attente', 'Ce qui change dans le temps', 'Réponses courtes'];

/** Ajoute une idée à la suite des consignes, sans doublon ni dépassement. */
export function ajouterIdee(consignes: string, idee: string): string {
  if (consignes.toLowerCase().includes(idee.toLowerCase())) return consignes;
  const base = consignes.trim().replace(/[.\s]+$/, '');
  return nettoyerConsignes(base ? `${base}. ${idee}.` : `${idee}.`);
}

/**
 * Dire au copilote comment analyser : un contexte libre (ce qu'on cherche, ce qui compte, le style des réponses). Facultatif ;
 * gardé sur l'appareil pour les analyses suivantes.
 */
export function ChampConsignes({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  return (
    <Rubrique titre="Consignes pour l'analyse (facultatif)">
      <Input
        value={valeur}
        onChangeText={(v) => onChange(v.slice(0, MAX_CONSIGNES))}
        multiline
        numberOfLines={3}
        maxLength={MAX_CONSIGNES}
        placeholder="Ex. : je suis en litige avec ce prestataire, repère les montants contestés et les dates limites."
        accessibilityLabel="Consignes pour l'analyse"
        aide={`${valeur.length}/${MAX_CONSIGNES} · gardées pour tes prochaines analyses`}
        style={{ minHeight: 76, textAlignVertical: 'top' }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {IDEES.map((x) => (
          <Puce key={x} on={valeur.toLowerCase().includes(x.toLowerCase())} onPress={() => onChange(ajouterIdee(valeur, x))}>
            + {x}
          </Puce>
        ))}
      </View>
    </Rubrique>
  );
}

/** Combien de mails le copilote charge au plus (les plus récents d'abord). */
export function ChoixNombre({ valeur, onChange }: { valeur: number; onChange: (n: number) => void }) {
  return (
    <Rubrique titre="Nombre de mails chargés">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {LOT_OPTIONS.map((n) => (
          <Puce key={n} on={valeur === n} onPress={() => onChange(n)}>
            {n} mails
          </Puce>
        ))}
      </View>
      <T small muted>
        Les plus récents d&apos;abord. Plus il y en a, plus l&apos;analyse est longue et moins chaque mail est lu en détail : les 10 premiers sont lus en entier, les autres sur leur début.
      </T>
    </Rubrique>
  );
}
