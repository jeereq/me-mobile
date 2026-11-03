import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { api } from '@/lib/api';
import { refExterne } from '@/lib/externe';
import { avecPieces } from '@/lib/pieces-mail';
import { personnesChoisies, resumePersonnes, sansRetires, type ChoixDest, type Destinataires, type Mail, type Personne } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { Seg, T } from './ui';

// Qui est sur un mail change peu : lu une fois par mail, le temps de la session.
const lus = new Map<string, Promise<Destinataires>>();

export function lireDestinataires(mail: Mail, token: string): Promise<Destinataires> {
  const ref = refExterne(mail.id);
  if (!ref) return Promise.reject(new Error('Ce mail ne vient pas d’un compte connecté.'));
  const enCours = lus.get(mail.id);
  if (enCours) return enCours;
  const p = api<Destinataires>(`/integrations/${ref.compte}/mails/${encodeURIComponent(ref.element)}/destinataires`, { token });
  lus.set(mail.id, p);
  p.catch(() => lus.delete(mail.id));
  return p;
}

export function useDestinataires(mail: Mail) {
  const { session } = useStore();
  const token = session?.token;
  const [d, setD] = useState<Destinataires | null>(null);
  useEffect(() => {
    if (!token) return;
    let vivant = true;
    lireDestinataires(mail, token)
      .then((x) => vivant && setD(x))
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [mail, token]);
  return { d };
}

/** « Envoyer à Paul, Ana et 2 autres ? » */
export function QuiRecoit({ mail, choix, pieces = 0 }: { mail: Mail; choix: ChoixDest; pieces?: number }) {
  const { d } = useDestinataires(mail);
  const noms = d ? resumePersonnes(personnesChoisies(d, choix)) : '';
  return <T small>{`Envoyer à ${noms || mail.contact || 'ce contact'}${avecPieces(pieces)} ?`}</T>;
}

const nomDe = (p: Personne) => p.nom?.trim() || p.adresse;

/** Répondre à tous, en retirant quelqu'un si besoin, ou à une seule personne. Sans choix, toutes les personnes du mail restent. */
export function ChoixDestinataires({ mail, valeur, onChange }: { mail: Mail; valeur: ChoixDest; onChange: (v: ChoixDest) => void }) {
  const { d } = useDestinataires(mail);
  const [mode, setMode] = useState<'tous' | 'une'>('tous');
  const [retires, setRetires] = useState<string[]>([]);
  if (!d) return null;
  const toutes = [...d.a, ...d.cc];
  if (toutes.length < 2) return null;

  const choisirMode = (m: 'tous' | 'une') => {
    setMode(m);
    if (m === 'tous') return onChange(sansRetires(d, retires));
    onChange({ a: [toutes[0].adresse], cc: [] });
  };
  const retirer = (adresse: string) => {
    const r = [...retires, adresse];
    setRetires(r);
    onChange(sansRetires(d, r));
  };
  const remettre = (adresse: string) => {
    const r = retires.filter((x) => x !== adresse);
    setRetires(r);
    onChange(sansRetires(d, r));
  };
  const restants = toutes.length - retires.length;
  const pastille = (p: Personne, enCopie: boolean) => {
    const retire = retires.includes(p.adresse);
    return (
      <Pressable
        key={p.adresse}
        accessibilityRole="button"
        accessibilityLabel={retire ? `Remettre ${nomDe(p)}` : `Retirer ${nomDe(p)}`}
        // Une réponse a toujours au moins un destinataire.
        disabled={!retire && restants <= 1}
        onPress={() => (retire ? remettre(p.adresse) : retirer(p.adresse))}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: retire ? C.line : alpha(C.accent, 0.4), backgroundColor: pressed ? alpha(C.ink, 0.06) : retire ? 'transparent' : alpha(C.accent, 0.1) })}>
        {enCopie ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 11.5 }}>Cc</Text> : null}
        <Text numberOfLines={1} style={{ flexShrink: 1, color: retire ? C.muted : C.ink, fontFamily: F.texteM, fontSize: 13, textDecorationLine: retire ? 'line-through' : 'none' }}>
          {nomDe(p)}
        </Text>
        {restants > 1 || retire ? <Text style={{ color: C.muted, fontSize: 12 }}>{retire ? '+' : '✕'}</Text> : null}
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 8 }}>
      <Seg label="Répondre à" options={[{ key: 'tous', label: `Tous · ${toutes.length}` }, { key: 'une', label: 'Une personne' }]} value={mode} onChange={choisirMode} />
      {mode === 'tous' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {d.a.map((p) => pastille(p, false))}
          {d.cc.map((p) => pastille(p, true))}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {toutes.map((p) => {
            const on = valeur?.a[0]?.toLowerCase() === p.adresse.toLowerCase();
            return (
              <Pressable key={p.adresse} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange({ a: [p.adresse], cc: [] })} style={({ pressed }) => ({ maxWidth: '100%', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.14) : pressed ? alpha(C.ink, 0.06) : 'transparent' })}>
                <Text numberOfLines={1} style={{ color: on ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 13 }}>
                  {nomDe(p)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
