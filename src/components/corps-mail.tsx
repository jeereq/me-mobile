import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { decouperCitation, morceauxTexte, premiereLigne, type MessageFil } from '@/lib/mails';
import { useStore } from '@/lib/store';
import type { LibelleDispo } from '@/lib/sync';
import { alpha, C, F } from '@/lib/theme';

import { Icone } from './icones';
import { Avatar, couleurLibelle, PuceLibelle, SaisieLigne, type CouleursLibelles } from './mail-ui';
import { T, tap } from './ui';

/**
 * Le corps d'un mail mieux lu : les liens, adresses et numéros s'ouvrent d'un toucher, la réponse citée
 * (le mail précédent recopié dessous) est repliée, les messages plus anciens du fil se déplient un par un,
 * et les étiquettes se posent ou s'ôtent depuis le volet de lecture.
 */

const ouvrirMorceau = (t: 'lien' | 'mail' | 'tel', v: string) => Linking.openURL(t === 'lien' ? v : t === 'mail' ? `mailto:${v}` : `tel:${v.replace(/[^\d+]/g, '')}`).catch(() => {});

/** Un texte dont les liens, adresses et numéros sont touchables. */
function TexteRiche({ texte, muted }: { texte: string; muted?: boolean }) {
  return (
    <Text selectable style={{ color: muted ? C.muted : C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 23 }}>
      {morceauxTexte(texte).map((m, i) =>
        m.t === 'texte' ? (
          m.v
        ) : (
          <Text key={i} accessibilityRole="link" onPress={() => ouvrirMorceau(m.t as 'lien', m.v)} style={{ color: C.accent, textDecorationLine: 'underline' }}>
            {m.v}
          </Text>
        ),
      )}
    </Text>
  );
}

/** Le texte du mail, avec la réponse citée repliée sous « Afficher le message cité ». */
export function TexteMail({ texte }: { texte: string }) {
  const { corps, cite } = decouperCitation(texte);
  const [voir, setVoir] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <TexteRiche texte={corps} />
      {cite ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: voir }}
            accessibilityLabel={voir ? 'Masquer le message cité' : 'Afficher le message cité'}
            onPress={() => setVoir((v) => !v)}
            style={({ pressed }) => ({ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? alpha(C.ink, 0.06) : C.sunk })}>
            <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 13 }}>{voir ? 'Masquer le message cité' : '··· Afficher le message cité'}</Text>
          </Pressable>
          {voir ? (
            <View style={{ paddingLeft: 12, borderLeftWidth: 3, borderLeftColor: C.line }}>
              <TexteRiche texte={cite} muted />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const quand = (m: Pick<MessageFil, 'date' | 'heure'>) => {
  if (!m.date) return '';
  const d = new Date(`${m.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${d.charAt(0).toUpperCase()}${d.slice(1)}${m.heure ? ` · ${m.heure}` : ''}`;
};

/** Un message plus ancien du fil : replié sur qui, quand et sa première ligne ; un toucher le déplie. */
function MessageReplie({ m }: { m: MessageFil }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.sunk, overflow: 'hidden' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: ouvert }}
        accessibilityLabel={`Message de ${m.de || 'quelqu’un'}, ${quand(m)}${ouvert ? '' : ', déplier'}`}
        onPress={() => {
          tap();
          setOuvert((v) => !v);
        }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: pressed ? alpha(C.ink, 0.05) : 'transparent' })}>
        <Avatar nom={m.de || m.adresse || '?'} taille={30} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>
              {m.de || 'Sans expéditeur'}
            </Text>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{quand(m)}</Text>
          </View>
          {!ouvert ? (
            <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
              {premiereLigne(m.texte) || '(sans texte)'}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {ouvert ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
          <TexteMail texte={m.texte || '(sans texte)'} />
          {m.piecesJointes.length ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icone nom="trombone" color={C.muted} size={14} />
              <Text numberOfLines={1} style={{ flex: 1, color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>
                {m.piecesJointes.join(', ')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Les messages plus anciens du fil, sous le mail ouvert, du plus récent au plus ancien comme dans Outlook. */
export function FilConversation({ messages }: { messages: MessageFil[] }) {
  if (!messages.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        Plus tôt dans la conversation · {messages.length}
      </Text>
      {[...messages].reverse().map((m) => (
        <MessageReplie key={m.id} m={m} />
      ))}
    </View>
  );
}

/** Les couleurs d'étiquettes d'un ou plusieurs comptes, par nom en minuscules. */
export const couleursDe = (l: LibelleDispo[] = []): CouleursLibelles => Object.fromEntries(l.filter((x) => x.couleur).map((x) => [x.nom.toLowerCase(), x.couleur!]));

/**
 * Les étiquettes d'un mail : celles posées (une croix les ôte) et, en mode édition, celles du compte à poser d'un toucher,
 * ou une nouvelle à taper. Le serveur les écrit chez Gmail (libellés, tout le fil) ou Outlook (catégories).
 */
export function EtiquettesMail({ compteId, mailId, libelles, dispo, edition, onFini }: { compteId: string; mailId: string; libelles: string[]; dispo: LibelleDispo[]; edition: boolean; onFini: () => void }) {
  const { session, synchroniser } = useStore();
  const [poses, setPoses] = useState(libelles);
  const [nouvelle, setNouvelle] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const couleurs = couleursDe(dispo);
  const pose = (n: string) => poses.some((x) => x.toLowerCase() === n.toLowerCase());

  const changer = async (corps: { ajouter?: string[]; retirer?: string[] }) => {
    tap();
    setBusy(true);
    setMsg('');
    const avant = poses;
    // Affiché tout de suite ; remis comme avant si le service refuse.
    setPoses((p) => [...p.filter((x) => !(corps.retirer ?? []).some((r) => r.toLowerCase() === x.toLowerCase())), ...(corps.ajouter ?? []).filter((a) => !p.some((x) => x.toLowerCase() === a.toLowerCase()))]);
    try {
      const r = await api<{ libelles: string[] }>(`/integrations/${compteId}/mails/${encodeURIComponent(mailId)}/libelles`, { method: 'POST', body: corps, token: session?.token });
      setPoses(r.libelles);
      synchroniser(false, true).catch(() => {});
    } catch (e) {
      setPoses(avant);
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const creer = () => {
    const n = nouvelle.trim();
    if (!n) return;
    setNouvelle('');
    if (!pose(n)) changer({ ajouter: [n] });
  };

  if (!poses.length && !edition && !msg) return null;
  return (
    <View style={{ gap: 8 }}>
      {poses.length ? (
        <View accessibilityLabel="Étiquettes du mail" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {poses.map((l) => (
            <PuceLibelle key={l} nom={l} couleurs={couleurs} onRetirer={edition && !busy ? () => changer({ retirer: [l] }) : undefined} />
          ))}
        </View>
      ) : null}
      {edition ? (
        <View style={{ gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: C.muted, fontFamily: F.texteF, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>Étiqueter</Text>
            <Pressable accessibilityRole="button" onPress={onFini} hitSlop={8}>
              <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 13.5 }}>Terminé</Text>
            </Pressable>
          </View>
          {dispo.filter((d) => !pose(d.nom)).length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {dispo
                .filter((d) => !pose(d.nom))
                .map((d) => (
                  <Pressable
                    key={d.nom}
                    accessibilityRole="button"
                    accessibilityLabel={`Poser l'étiquette ${d.nom}`}
                    disabled={busy}
                    onPress={() => changer({ ajouter: [d.nom] })}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: alpha(couleurLibelle(d.nom, couleurs), 0.6), opacity: pressed || busy ? 0.6 : 1 })}>
                    <Text style={{ color: couleurLibelle(d.nom, couleurs), fontFamily: F.texteF, fontSize: 13 }}>+</Text>
                    <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 12.5 }}>{d.nom}</Text>
                  </Pressable>
                ))}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 10, backgroundColor: C.surface }}>
            <View style={{ flex: 1 }}>
              <SaisieLigne value={nouvelle} onChangeText={setNouvelle} placeholder="Nouvelle étiquette (Facture, Client…)" accessibilityLabel="Nouvelle étiquette" onSubmitEditing={creer} returnKeyType="done" maxLength={100} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Ajouter cette étiquette" disabled={!nouvelle.trim() || busy} onPress={creer} hitSlop={6}>
              <Text style={{ color: nouvelle.trim() ? C.accent : C.muted, fontFamily: F.texteF, fontSize: 13.5 }}>Ajouter</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {msg ? (
        <T small style={{ color: C.agressif }}>
          {msg}
        </T>
      ) : null}
    </View>
  );
}
