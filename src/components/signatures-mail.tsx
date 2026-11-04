import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/texte';
import { api } from '@/lib/api';
import { uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import type { CompteConnecte, SignatureMail } from '@/lib/sync';
import { alpha, C, F } from '@/lib/theme';

import { Btn, Dialogue, Input, T, Tag } from './ui';

const MAX = 10;
const service = (c: CompteConnecte) => (c.fournisseur === 'google' ? 'Gmail' : 'Outlook');

/** Écrire, modifier et choisir les signatures d'un compte, ou reprendre celle qu'il utilise déjà. */
export function GestionSignatures({ compte }: { compte: CompteConnecte }) {
  const { session, synchroniser } = useStore();
  const [liste, setListe] = useState<SignatureMail[]>(compte.signatures ?? []);
  const [defaut, setDefaut] = useState<string | null>(compte.signatureDefaut ?? null);
  const [edition, setEdition] = useState<SignatureMail | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const sauver = async (l: SignatureMail[], d: string | null) => {
    setBusy(true);
    setMsg('');
    try {
      await api(`/integrations/${compte.id}`, { method: 'PATCH', body: { signatures: l, signatureDefaut: d }, token: session?.token });
      setListe(l);
      setDefaut(d);
      setEdition(null);
      await synchroniser(false, true);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const enregistrer = () => {
    if (!edition) return;
    const s = { ...edition, nom: edition.nom.trim() || 'Ma signature', texte: edition.texte.trim() };
    const l = liste.some((x) => x.id === s.id) ? liste.map((x) => (x.id === s.id ? s : x)) : [...liste, s];
    // La première devient celle par défaut.
    sauver(l, defaut ?? s.id);
  };
  const reprendre = async () => {
    setBusy(true);
    setMsg('');
    try {
      const { texte } = await api<{ texte: string }>(`/integrations/${compte.id}/signature`, { token: session?.token });
      setEdition({ id: uid(), nom: service(compte), texte });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (edition)
    return (
      <View style={{ gap: 10 }}>
        <Input label="Nom" value={edition.nom} onChangeText={(nom: string) => setEdition({ ...edition, nom })} maxLength={60} placeholder="Pro, Perso…" />
        <Input label="Signature" value={edition.texte} onChangeText={(texte: string) => setEdition({ ...edition, texte })} multiline maxLength={2000} placeholder={'Prénom Nom\nFonction\n+243 …'} style={{ minHeight: 110, textAlignVertical: 'top' }} />
        {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn small label={busy ? 'Enregistrement…' : 'Enregistrer'} disabled={busy || !edition.texte.trim()} onPress={enregistrer} />
          <Btn small kind="sec" label="Annuler" onPress={() => setEdition(null)} />
        </View>
      </View>
    );

  return (
    <View style={{ gap: 10 }}>
      {liste.map((s) => (
        <View key={s.id} style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>{s.nom}</Text>
            {s.id === defaut ? <Tag label="Par défaut" /> : null}
          </View>
          <Text selectable style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, lineHeight: 19 }}>{s.texte}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {s.id !== defaut ? <Btn small kind="sec" label="Par défaut" disabled={busy} onPress={() => sauver(liste, s.id)} /> : null}
            <Btn small kind="sec" label="Modifier" disabled={busy} onPress={() => setEdition(s)} />
            <Btn small kind="sec" label="Supprimer" disabled={busy} onPress={() => sauver(liste.filter((x) => x.id !== s.id), defaut === s.id ? null : defaut)} />
          </View>
        </View>
      ))}
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {liste.length < MAX ? <Btn small label="+ Nouvelle signature" disabled={busy} onPress={() => setEdition({ id: uid(), nom: '', texte: '' })} /> : null}
        {compte.signatureImportable && liste.length < MAX ? <Btn small kind="sec" label={busy ? 'Recherche…' : `Reprendre de ${service(compte)}`} disabled={busy} onPress={reprendre} /> : null}
      </View>
    </View>
  );
}

/** Le choix pour un envoi : un identifiant ; `null` : aucune ; rien : celle par défaut. */
export type ChoixSignature = string | null | undefined;

/** Sous le message : quelle signature part avec ce mail, et de quoi en écrire une. */
export function SignatureEnvoi({ compte, valeur, onChange }: { compte: string; valeur: ChoixSignature; onChange: (v: ChoixSignature) => void }) {
  const { externes } = useStore();
  const [gerer, setGerer] = useState(false);
  const c = externes.find((x) => x.id === compte);
  if (!c) return null;
  const liste = c.signatures ?? [];
  // Comme le serveur : une signature retirée entre-temps laisse la place à celle par défaut.
  const active = valeur === null ? null : (liste.find((s) => s.id === valeur)?.id ?? c.signatureDefaut ?? null);
  const texte = liste.find((s) => s.id === active)?.texte;
  const fenetre = gerer ? (
    <Dialogue titre="Signatures" onFermer={() => setGerer(false)}>
      <GestionSignatures compte={c} />
    </Dialogue>
  ) : null;
  if (!liste.length)
    return (
      <>
        <Pressable accessibilityRole="button" hitSlop={6} onPress={() => setGerer(true)} style={{ alignSelf: 'flex-start' }}>
          <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>+ Ajouter une signature</Text>
        </Pressable>
        {fenetre}
      </>
    );
  const puce = (id: string | null, nom: string) => {
    const on = active === id;
    return (
      <Pressable key={id ?? 'aucune'} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(id)} style={({ pressed }) => ({ maxWidth: '100%', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: pressed ? alpha(C.ink, 0.06) : on ? alpha(C.accent, C.sombre ? 0.16 : 0.1) : 'transparent' })}>
        <Text numberOfLines={1} style={{ color: on ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 13 }}>{nom}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: 6 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Signature" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>Signature</Text>
        {liste.map((s) => puce(s.id, s.nom))}
        {puce(null, 'Aucune')}
        <Pressable accessibilityRole="button" accessibilityLabel="Gérer les signatures" hitSlop={6} onPress={() => setGerer(true)} style={{ paddingHorizontal: 4 }}>
          <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Gérer</Text>
        </Pressable>
      </View>
      {texte ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, lineHeight: 19 }}>{texte}</Text> : null}
      {fenetre}
    </View>
  );
}
