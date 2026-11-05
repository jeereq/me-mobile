import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import type { FichierChoisi } from '@/lib/justificatifs';
import { envoyerMail } from '@/lib/pieces-mail-api';
import { addDays, today } from '@/lib/dates';
import { liesAuMail, relanceDepuisMail } from '@/lib/liens-mail';
import { refExterne } from '@/lib/externe';
import { sansPrenomFinal, personnesChoisies, resumePersonnes, type ChoixDest, type Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

import { CadreMail, ChampLigne, CorpsMail, nomService, Outil } from './mail-ui';
import { ChoixDestinataires, QuiRecoit, useDestinataires } from './destinataires';
import { ContexteReponse, OutilsReponse } from './outils-reponse';
import { ChampPieces } from './pieces-mail';
import { SignatureEnvoi, type ChoixSignature } from './signatures-mail';
import { ChoixSuiviEnvoi, useSuiviEnvoi } from './suivi-envoi';
import { Btn, Dialogue, T } from './ui';

export type ResumeDeBoucle = { resume: string; ouverts?: string[] };

/** Ce que l'analyse a compris de la boucle : replié, pour laisser la place à la réponse. */
function RappelBoucle({ boucle }: { boucle: ResumeDeBoucle }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: ouvert }} onPress={() => setOuvert((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 }}>
        <Text style={{ flex: 1, color: C.ink, fontFamily: F.texteM, fontSize: 13.5 }}>La boucle</Text>
        <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 13 }}>{ouvert ? '−' : '+'}</Text>
      </Pressable>
      {ouvert ? (
        <View style={{ gap: 6, paddingHorizontal: 12, paddingBottom: 12 }}>
          <T small>{boucle.resume}</T>
          {boucle.ouverts?.map((o) => (
            <T key={o} small muted>{`• ${o}`}</T>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Répondre à un fil depuis Me : le destinataire, l'objet et le rattachement au fil viennent du serveur
 * (qui les a gardés en relisant la boîte), on n'écrit ici que le texte. L'envoi demande une confirmation.
 * `texteInitial` : la réponse dictée à la voix (« Réponds à Paul que c'est bon »), à relire avant l'envoi.
 */
export function Repondre({ mail, texteInitial, boucle, onFermer, onEnvoye }: { mail: Mail; texteInitial?: string; /** Ce que l'analyse a compris de la boucle, à garder sous les yeux. */ boucle?: ResumeDeBoucle; onFermer: () => void; onEnvoye?: () => void }) {
  const { session, espace, config, update } = useStore();
  const [suivi, setSuivi] = useSuiviEnvoi(false);
  const [texte, setTexte] = useState(sansPrenomFinal(texteInitial ?? ''));
  const [confirme, setConfirme] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const ref = refExterne(mail.id);
  const personnes = useDestinataires(mail);
  const [dest, setDest] = useState<ChoixDest>(null);
  const [pieces, setPieces] = useState<FichierChoisi[]>([]);
  const [signature, setSignature] = useState<ChoixSignature>(undefined);

  const envoyer = async () => {
    if (!ref || !session?.token) return;
    setBusy(true);
    setMsg('');
    try {
      await envoyerMail(`/integrations/${ref.compte}/repondre`, { mail: ref.element, texte, ...(dest ?? {}), ...(signature !== undefined ? { signature } : {}) }, pieces, session.token);
      if (suivi.actif) {
        // La relance liée à ce fil est reprogrammée ; sans relance liée, une nouvelle naît, rattachée au fil.
        const date = addDays(today(), suivi.jours);
        const liee = liesAuMail(mail, espace).find((x) => x.genre === 'relance' && !x.fait);
        update((e) => (liee ? { ...e, relances: e.relances.map((r) => (r.id === liee.id ? { ...r, date } : r)) } : { ...e, relances: [...e.relances, { ...relanceDepuisMail(mail, config), date }] }));
      }
      setEnvoye(true);
      onEnvoye?.();
    } catch (e) {
      setMsg((e as Error).message);
      setConfirme(false);
    } finally {
      setBusy(false);
    }
  };

  const valeur = (t: string) => (
    <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 15 }}>
      {t}
    </Text>
  );

  if (envoye)
    return (
      <Dialogue titre="Réponse envoyée" onFermer={onFermer}>
        <T>Ta réponse est partie dans le fil « {mail.sujet} ».</T>
        {suivi.actif ? <T small>{`Je te rappelle de relancer ${mail.contact} dans ${suivi.jours} jour${suivi.jours > 1 ? 's' : ''} s'il ne répond pas.`}</T> : null}
        <T small muted>
          Tu la retrouveras dans tes messages envoyés, chez {nomService(mail)}.
        </T>
        <Btn label="Fermer" onPress={onFermer} />
      </Dialogue>
    );

  return (
    <Dialogue
      plein
      titre="Répondre"
      onFermer={onFermer}
      pied={
        <>
          {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
          {confirme ? <QuiRecoit mail={mail} choix={dest} pieces={pieces.length} /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {confirme ? <Outil grand label="Modifier" onPress={() => setConfirme(false)} /> : null}
            {confirme ? (
              <Outil principal grand etire icone="envoyer" label={busy ? 'Envoi…' : 'Oui, envoyer'} disabled={busy} onPress={envoyer} />
            ) : (
              <Outil principal grand etire icone="envoyer" label="Envoyer" disabled={!texte.trim() || !ref} onPress={() => setConfirme(true)} />
            )}
          </View>
        </>
      }>
      {boucle ? <RappelBoucle boucle={boucle} /> : null}
      <CadreMail>
        {mail.compte ? <ChampLigne label="De">{valeur(mail.compte)}</ChampLigne> : null}
        <ChampLigne label="À">{valeur(personnes.d ? resumePersonnes(personnesChoisies(personnes.d, dest)) : mail.adresse && mail.adresse !== mail.contact ? `${mail.contact} · ${mail.adresse.replace(/^.*<([^>]+)>.*$/, '$1')}` : mail.contact)}</ChampLigne>
        <ChampLigne label="Objet" dernier>
          {valeur(`Re: ${mail.sujet.replace(/^(\s*re\s*:\s*)+/i, '')}`)}
        </ChampLigne>
        <CorpsMail
          value={texte}
          onChangeText={(v: string) => {
            setTexte(v);
            setConfirme(false);
          }}
          placeholder="Bonjour, …"
          accessibilityLabel="Ta réponse"
          autoFocus={!texteInitial}
        />
      </CadreMail>
      {ref ? <SignatureEnvoi compte={ref.compte} valeur={signature} onChange={(v) => (setSignature(v), setConfirme(false))} /> : null}
      {ref ? (
        <ContexteReponse
          mail={mail}
          texte={texte}
          onTexte={(v) => {
            setTexte(v);
            setConfirme(false);
          }}
        />
      ) : null}
      {ref ? <ChoixDestinataires mail={mail} valeur={dest} onChange={(v) => (setDest(v), setConfirme(false))} /> : null}
      {ref ? <ChampPieces pieces={pieces} onChange={(p) => (setPieces(p), setConfirme(false))} /> : null}
      {ref ? (
        <OutilsReponse
          mail={mail}
          texte={texte}
          onTexte={(v) => {
            setTexte(v);
            setConfirme(false);
          }}
        />
      ) : null}
      {ref ? <ChoixSuiviEnvoi qui={mail.contact} valeur={suivi} onChange={setSuivi} /> : null}
      {!ref ? <T small style={{ color: C.agressif }}>Ce message ne vient pas d'un compte connecté : impossible d'y répondre depuis Me.</T> : null}
    </Dialogue>
  );
}
