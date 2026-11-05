import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, View, type TextInputProps } from 'react-native';

import { Text, TextInput } from '@/components/texte';
import { api } from '@/lib/api';
import { adressesSaisies, completerSaisie, fusionPersonnes, saisieEnCours, suggestionsPersonnes, type Personne } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { ChampLigne, SaisieLigne } from './mail-ui';

type Touche = Parameters<NonNullable<TextInputProps['onKeyPress']>>[0];

const MAX = 6;

/**
 * Les personnes qui correspondent à la saisie : tout de suite celles des mails déjà là, puis celles que le serveur
 * trouve dans les comptes. Se pilote au clavier : flèches, Entrée ou Tab pour choisir, Échap pour fermer.
 */
export function usePersonnes(saisie: string, exclus: string[], choisir: (p: Personne) => void) {
  const { mails, espace, externes, session } = useStore();
  const token = session?.token;
  const q = saisie.trim();
  const boites = externes.filter((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft');
  const connues = useMemo(() => [...(mails ?? []), ...espace.relances.flatMap((r) => (r.mail ? [r.mail] : [])), ...espace.taches.flatMap((t) => (t.mail ? [t.mail] : []))], [mails, espace.relances, espace.taches]);
  const sans = [...exclus, ...externes.flatMap((x) => (x.compte ? [x.compte] : []))];
  const locales = suggestionsPersonnes(connues, q, sans, MAX);

  const [trouvees, setTrouvees] = useState<Record<string, Personne[]>>({});
  const aChercher = q.length >= 2 && !!token && boites.length > 0 && locales.length < MAX && !trouvees[q];
  useEffect(() => {
    if (!aChercher) return;
    const t = setTimeout(() => {
      api<{ personnes: Personne[] }>(`/integrations/personnes?q=${encodeURIComponent(q)}`, { token, discret: true })
        .then((r) => setTrouvees((x) => ({ ...x, [q]: r.personnes })))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [aChercher, q, token]);

  const [fermee, setFermee] = useState('');
  const [rang, setRang] = useState(0);
  const proposees = fermee === q ? [] : fusionPersonnes(locales, trouvees[q] ?? [], sans, MAX);
  // L'adresse est déjà écrite en entier : rien à compléter.
  const liste = proposees.length === 1 && proposees[0].adresse.toLowerCase() === q.toLowerCase() ? [] : proposees;
  const actif = Math.min(rang, Math.max(0, liste.length - 1));

  const surTouche = (e: Touche) => {
    if (!liste.length) return;
    const touche = e.nativeEvent.key;
    if (touche === 'ArrowDown' || touche === 'ArrowUp') {
      e.preventDefault();
      setRang((actif + (touche === 'ArrowDown' ? 1 : liste.length - 1)) % liste.length);
    } else if (touche === 'Enter' || touche === 'Tab') {
      e.preventDefault();
      setRang(0);
      choisir(liste[actif]);
    } else if (touche === 'Escape') {
      setFermee(q);
    }
  };
  return { liste, actif, surTouche };
}

const nomDe = (p: Personne) => p.nom?.trim() || p.adresse;

/** Une ligne par personne, à toucher pour la choisir. `droite` : des actions à la place de ce geste. */
export function ListePersonnes({ liste, actif, onChoisir, onAppui, droite }: { liste: Personne[]; actif: number; onChoisir?: (p: Personne) => void; /** Le doigt se pose sur la liste, ou la quitte. */ onAppui?: (pose: boolean) => void; droite?: (p: Personne) => ReactNode }) {
  return (
    <View accessibilityRole="list">
      {liste.map((p, i) => {
        const ligne = { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 6, paddingHorizontal: 14 } as const;
        const fond = (presse: boolean) => (presse || i === actif ? alpha(C.accent, 0.12) : 'transparent');
        const identite = (
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 13.5 }}>{nomDe(p)}</Text>
            {p.nom ? <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{p.adresse}</Text> : null}
          </View>
        );
        return droite ? (
          <View key={p.adresse} style={{ ...ligne, backgroundColor: fond(false) }}>
            {identite}
            {droite(p)}
          </View>
        ) : (
          <Pressable key={p.adresse} accessibilityRole="button" accessibilityLabel={p.nom ? `${p.nom}, ${p.adresse}` : p.adresse} onPressIn={() => onAppui?.(true)} onPressOut={() => onAppui?.(false)} onPress={() => onChoisir?.(p)} style={({ pressed }) => ({ ...ligne, backgroundColor: fond(pressed) })}>
            {identite}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Une ligne « À » ou « Cc » : plusieurs adresses séparées par des virgules, la dernière se complète. */
export function ChampPersonnes({ label, valeur, onChange, autres = [], ouvert, onFocus, onQuitter, droite, ...rest }: { label: string; valeur: string; onChange: (v: string) => void; autres?: string[]; ouvert: boolean; onFocus: () => void; onQuitter: () => void; droite?: ReactNode } & Pick<TextInputProps, 'placeholder' | 'accessibilityLabel' | 'autoFocus'>) {
  const champ = useRef<ComponentRef<typeof TextInput>>(null);
  // Toucher la liste fait perdre le curseur au champ : elle reste ouverte le temps du choix.
  const dansListe = useRef(false);
  const choisir = (p: Personne) => {
    onChange(completerSaisie(valeur, p.adresse));
    champ.current?.focus();
  };
  const { liste, actif, surTouche } = usePersonnes(saisieEnCours(valeur), [...adressesSaisies(valeur), ...autres], choisir);
  return (
    <>
      <ChampLigne label={label} droite={droite}>
        <SaisieLigne
          ref={champ}
          value={valeur}
          onChangeText={(v: string) => {
            onFocus();
            onChange(v);
          }}
          onFocus={onFocus}
          onBlur={() => {
            if (!dansListe.current) onQuitter();
          }}
          onKeyPress={surTouche} onSubmitEditing={() => liste[actif] && choisir(liste[actif])} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" {...rest} />
      </ChampLigne>
      {ouvert && liste.length ? (
        <View style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
          <ListePersonnes liste={liste} actif={actif} onChoisir={choisir} onAppui={(pose) => (dansListe.current = pose)} />
        </View>
      ) : null}
    </>
  );
}
