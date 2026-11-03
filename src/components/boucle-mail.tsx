import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/texte';

import { useReglagesAnalyse } from '@/lib/analyse-pref';
import { api } from '@/lib/api';
import type { AnalyseBoucle } from '@/lib/copilote';
import { fmtCourt } from '@/lib/dates';
import type { Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Langue } from '@/lib/traduction';

import { teinteCopilote } from './copilote';
import { Outil } from './mail-ui';
import { ChoixLangue, useTraducteur } from './traduire';
import { Bloc, ZoneSquelette } from './squelettes';
import { Btn, Dialogue, T } from './ui';

const ATTENTE = { toi: 'À toi de jouer', eux: 'En attente de leur réponse', personne: 'Terminé' } as const;

function Liste({ titre, lignes }: { titre: string; lignes: string[] }) {
  if (!lignes.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>{titre}</Text>
      {lignes.map((l) => (
        <T key={l}>{`• ${l}`}</T>
      ))}
    </View>
  );
}

/**
 * Comprendre une boucle de mails d'un coup d'œil : de quoi il s'agit, ce qui s'est passé, qui doit agir.
 * S'il faut répondre, une réponse est prête : elle s'ouvre pour être relue, rien ne part sans confirmation.
 */
export function BoucleMail({ mail, onFermer, onRepondre, onTaches }: { mail: Mail; onFermer: () => void; onRepondre: (texte?: string) => void; /** L'analyse complète : tâche, rendez-vous, montant. */ onTaches: () => void }) {
  const { session, espace } = useStore();
  const { reglages } = useReglagesAnalyse();
  const t = teinteCopilote();
  const [b, setB] = useState<(AnalyseBoucle & { messages: number }) | null>(null);
  const [msg, setMsg] = useState('');
  const [essai, setEssai] = useState(0);
  const token = session?.token;

  useEffect(() => {
    if (!token) return;
    let vivant = true;
    api<AnalyseBoucle & { messages: number }>('/assistant/mails/boucle', { method: 'POST', token, body: { mail: mail.id, ton: espace.audio.ton, ...(reglages.consignes ? { consignes: reglages.consignes } : {}) } })
      .then((r) => vivant && setB(r))
      .catch((e: Error) => vivant && setMsg(e.message));
    return () => {
      vivant = false;
    };
    // Une seule lecture par mail ouvert, ou à la demande.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mail.id, token, essai]);

  const traducteur = useTraducteur();
  const [langue, setLangue] = useState<Langue | null>(null);
  const [traduit, setTraduit] = useState<Record<string, string>>({});
  const [traduction, setTraduction] = useState(false);
  const tr = (x: string) => (langue ? (traduit[x] ?? x) : x);
  const choisir = async (l: Langue | null) => {
    setLangue(l);
    if (!l || !b) return;
    const textes = [b.sujet, b.resume, b.attenteDetail, ...b.etapes.map((e) => e.quoi), ...b.decisions, ...b.ouverts, b.reponse].filter(Boolean);
    setTraduction(true);
    try {
      const r = await traducteur.traduire(textes, l);
      setTraduit(Object.fromEntries(textes.map((x, i) => [x, r[i]])));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setTraduction(false);
    }
  };

  const couleurAttente = b?.attente === 'toi' ? t.c : C.muted;

  return (
    <Dialogue
      plein
      large
      titre={b && b.messages > 1 ? `La boucle · ${b.messages} messages` : 'Ce mail'}
      onFermer={onFermer}
      pied={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Outil principal grand etire icone="repondre" label={b?.reponse ? 'Utiliser cette réponse' : 'Répondre'} onPress={() => onRepondre(b?.reponse ? tr(b.reponse) : undefined)} />
          <Outil grand masquerLabel icone="taches" label="Tâches et rendez-vous" onPress={onTaches} />
        </View>
      }>
      {!b && !msg ? (
        <ZoneSquelette label="Analyse de la boucle">
          <Bloc h={22} r={8} l="80%" />
          <Bloc h={14} r={6} />
          <Bloc h={14} r={6} />
          <Bloc h={14} r={6} l="60%" />
        </ZoneSquelette>
      ) : null}
      {msg ? (
        <View style={{ gap: 10 }}>
          <T small style={{ color: C.agressif }}>{msg}</T>
          <View style={{ flexDirection: 'row' }}>
            <Btn
              kind="sec"
              label="Réessayer"
              onPress={() => {
                setMsg('');
                setEssai((x) => x + 1);
              }}
            />
          </View>
        </View>
      ) : null}
      {b ? (
        <>
          {traducteur.disponible ? <ChoixLangue titre="Traduire" valeur={langue} charge={traduction} onChange={choisir} /> : null}
          <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 19, lineHeight: 25 }}>{tr(b.sujet)}</Text>
          <View style={{ gap: 4, padding: 12, borderRadius: 12, backgroundColor: alpha(couleurAttente, 0.12) }}>
            <Text style={{ color: couleurAttente, fontFamily: F.texteF, fontSize: 13.5 }}>{ATTENTE[b.attente]}</Text>
            {b.attenteDetail ? <T small>{tr(b.attenteDetail)}</T> : null}
          </View>
          {b.resume ? <T>{tr(b.resume)}</T> : null}
          {b.etapes.length > 1 ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>Ce qui s'est passé</Text>
              {b.etapes.map((e, i) => (
                <View key={`${i}-${e.quoi}`} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ alignItems: 'center', paddingTop: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === b.etapes.length - 1 ? t.c : C.line }} />
                    {i < b.etapes.length - 1 ? <View style={{ flex: 1, width: 1, marginTop: 4, marginBottom: -14, backgroundColor: C.line }} /> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 13.5 }}>
                      {e.qui}
                      {e.date ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{`  ${fmtCourt(e.date)}`}</Text> : null}
                    </Text>
                    <T small>{tr(e.quoi)}</T>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          <Liste titre="Acquis" lignes={b.decisions.map(tr)} />
          <Liste titre="Sans réponse" lignes={b.ouverts.map(tr)} />
          {b.reponse ? (
            <View style={{ gap: 6, padding: 12, borderRadius: 12, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
              <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>Réponse proposée</Text>
              <T>{tr(b.reponse)}</T>
            </View>
          ) : null}
        </>
      ) : null}
    </Dialogue>
  );
}
