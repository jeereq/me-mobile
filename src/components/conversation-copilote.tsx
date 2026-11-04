import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text, TextInput } from '@/components/texte';
import { useActions } from '@/lib/actions';
import { demanderConversation, parler, taire } from '@/lib/assistant';
import { celebrer } from '@/lib/celebration';
import { ajouterEchange, marquerAction, type ActionConversation, type Echange } from '@/lib/conversation';
import { useEchanges } from '@/lib/conversation-garde';
import { addDays, today, uid } from '@/lib/dates';
import { clePortee } from '@/lib/equipes';
import { cle } from '@/lib/copilote';
import { tailleDansCercle, useNomApp } from '@/lib/nom';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { BoutonMail, useEcoute } from './boutons-mail';
import { teinteCopilote } from './copilote';
import { BoutonDicter } from './dictee';
import { Ondes } from './ondes';
import { Repondre } from './repondre';
import { SqueletteReponse } from './squelettes';
import { Btn, Panel, T } from './ui';

const VISIBLES = 5;
const CREE = { tache: 'Tâche ajoutée', relance: 'Relance ajoutée' } as const;

/** Un geste proposé sous une réponse : rien ne se fait sans ce toucher, et il s'annule. */
function Action({ a, echange, onMarquer, onMail }: { a: ActionConversation; echange: string; onMarquer: (echange: string, action: string, cree?: string) => void; onMail: (a: ActionConversation) => void }) {
  const { espace, update, config, mails } = useStore();
  const { ajouter } = useActions();
  const t = teinteCopilote();
  if (a.genre === 'mail') {
    if (!mails.some((m) => m.id === a.ref)) return null;
    return <Btn small couleur={t.c} kind="sec" label={a.titre} onPress={() => onMail(a)} />;
  }
  if (a.cree) {
    const existe = a.genre === 'tache' ? espace.taches.some((x) => x.id === a.cree) : espace.relances.some((x) => x.id === a.cree);
    if (existe)
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <Text style={{ color: C.coach, fontFamily: F.texteM, fontSize: 13 }}>{`${CREE[a.genre]} ✓`}</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => {
              update((e) => (a.genre === 'tache' ? { ...e, taches: e.taches.filter((x) => x.id !== a.cree) } : { ...e, relances: e.relances.filter((x) => x.id !== a.cree) }));
              onMarquer(echange, a.id);
            }}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Annuler</Text>
          </Pressable>
        </View>
      );
  }
  const deja =
    a.genre === 'tache'
      ? espace.taches.some((x) => x.statut !== 'fait' && cle(x.titre) === cle(a.titre))
      : espace.relances.some((x) => x.statut !== 'repondu' && cle(x.contact) === cle(a.contact ?? '') && cle(x.sujet) === cle(a.titre));
  if (deja) return <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13, paddingVertical: 6 }}>{a.genre === 'tache' ? `Déjà dans tes tâches : ${a.titre}` : `Déjà dans tes relances : ${a.contact}`}</Text>;
  const annonce = CREE[a.genre];
  const creer = () => {
    const id = uid();
    const creeLe = new Date().toISOString();
    if (a.genre === 'tache') ajouter('tache', { id, titre: a.titre, source: 'manuel', priorite: 'moyenne', echeance: a.echeance, statut: 'en_attente', faitLe: null, mode: config.defauts.tache, creeLe });
    else ajouter('relance', { id, contact: a.contact ?? '', sujet: a.titre, boite: 'pro', date: a.echeance ?? addDays(today(), Math.max(1, config.delaiRelanceJours || 3)), statut: 'a_faire', mode: config.defauts.relance, creeLe });
    onMarquer(echange, a.id, id);
    celebrer({ type: 'message', emoji: '✅', texte: annonce });
  };
  return <Btn small couleur={t.c} kind="sec" label={a.genre === 'tache' ? `+ ${a.titre}` : `+ Relancer ${a.contact}`} onPress={creer} />;
}

function Bulle({ e, onMarquer, onMail }: { e: Echange; onMarquer: (echange: string, action: string, cree?: string) => void; onMail: (a: ActionConversation) => void }) {
  const t = teinteCopilote();
  const { parle, lire, arreter } = useEcoute();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ alignSelf: 'flex-end', maxWidth: '88%', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, borderBottomRightRadius: 4, backgroundColor: t.douce }}>
        <Text selectable style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14.5, lineHeight: 20 }}>{e.question}</Text>
      </View>
      <Text selectable style={{ color: C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 22 }}>{e.reponse}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {e.actions.map((a) => (
          <Action key={a.id} a={a} echange={e.id} onMarquer={onMarquer} onMail={onMail} />
        ))}
        <BoutonMail icone="onde" actif={parle} label={parle ? 'Arrêter' : 'Écouter'} onPress={() => (parle ? arreter() : lire(e.reponse, 'Réponse du copilote'))} />
      </View>
    </View>
  );
}

/** Parler au copilote : il garde le fil, et chaque réponse peut devenir une tâche, une relance ou un mail. */
export function ConversationCopilote() {
  const { espace, mails, session, portee } = useStore();
  const nomApp = useNomApp();
  const t = teinteCopilote();
  const [echanges, changer] = useEchanges(session?.user.id ? clePortee(session.user.id, portee) : '');
  const [q, setQ] = useState('');
  const [reflechit, setReflechit] = useState(false);
  const [echec, setEchec] = useState('');
  const [tout, setTout] = useState(false);
  const [mail, setMail] = useState<ActionConversation | null>(null);
  // La réponse lue à voix haute : les ondes du copilote bougent avec elle.
  const [parle, setParle] = useState(false);
  const [mot, setMot] = useState(0);
  useEffect(() => () => void taire(), []);

  const demander = async () => {
    const question = q.trim();
    if (!question || reflechit) return;
    setReflechit(true);
    setEchec('');
    try {
      const r = await demanderConversation(question, echanges, espace, mails);
      changer((l) => ajouterEchange(l, { id: uid(), question, ...r }));
      setQ('');
      if (espace.audio.lireReponses) parler(r.reponse, espace.audio, { onStart: () => setParle(true), onDone: () => setParle(false), onMot: () => setMot((x) => x + 1) });
    } catch (e) {
      setEchec((e as Error).message);
    } finally {
      setReflechit(false);
    }
  };
  const marquer = (echange: string, action: string, cree?: string) => changer((l) => marquerAction(l, echange, action, cree));
  const vus = tout ? echanges : echanges.slice(-VISIBLES);
  const cachees = echanges.length - vus.length;
  const mailOuvert = mail ? mails.find((m) => m.id === mail.ref) : undefined;

  return (
    <Panel
      title="Poser une question"
      right={
        echanges.length ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => (changer(() => []), setTout(false), setEchec(''))}>
            <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>Nouvelle conversation</Text>
          </Pressable>
        ) : undefined
      }>
      {cachees ? (
        <Pressable accessibilityRole="button" hitSlop={6} onPress={() => setTout(true)} style={{ alignSelf: 'center' }}>
          <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>{`Voir ${cachees > 1 ? `les ${cachees} précédents` : 'le précédent'}`}</Text>
        </Pressable>
      ) : null}
      {vus.map((e) => (
        <Bulle key={e.id} e={e} onMarquer={marquer} onMail={setMail} />
      ))}
      {reflechit ? <SqueletteReponse /> : null}
      {parle ? (
        <Ondes mode="parle" mot={mot} couleur={t.c} couleur2={C.accent} taille={150}>
          <Text fixe style={{ color: t.c, fontFamily: F.titre, fontSize: tailleDansCercle(nomApp, 22), letterSpacing: -0.5 }}>{nomApp}</Text>
        </Ondes>
      ) : null}
      {echec ? (
        <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
          <T small style={{ color: C.agressif }}>{echec}</T>
          <View style={{ flexDirection: 'row' }}>
            <Btn small kind="sec" label="Réessayer" onPress={demander} />
          </View>
        </View>
      ) : null}
      <View style={{ gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: alpha(C.line, 1), backgroundColor: C.sunk }}>
        <TextInput
          multiline
          value={q}
          onChangeText={setQ}
          maxLength={2000}
          accessibilityLabel="Ta question"
          placeholder={echanges.length ? 'Continue…' : 'Ex. Qui dois-je relancer cette semaine ?'}
          placeholderTextColor={C.muted}
          selectionColor={C.accent}
          textAlignVertical="top"
          style={{ minHeight: 44, padding: 0, color: C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 21, outlineStyle: 'none' } as object}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Btn small couleur={t.c} label={reflechit ? 'Je réfléchis…' : 'Demander'} onPress={demander} disabled={reflechit || !q.trim()} />
          <BoutonDicter valeur={q} onTexte={setQ} />
        </View>
      </View>
      {mailOuvert ? <Repondre key={mailOuvert.id} mail={mailOuvert} texteInitial={mail?.brouillon} onFermer={() => setMail(null)} /> : null}
    </Panel>
  );
}
