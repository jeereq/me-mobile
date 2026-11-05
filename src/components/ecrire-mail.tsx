import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { useActions } from '@/lib/actions';
import { addDays, today, uid } from '@/lib/dates';
import type { FichierChoisi } from '@/lib/justificatifs';
import { adresseEmail, adressesSaisies } from '@/lib/mails';
import { avecPieces } from '@/lib/pieces-mail';
import { envoyerMail } from '@/lib/pieces-mail-api';
import { objetPropre } from '@/lib/liens-mail';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { CadreMail, ChampLigne, CorpsMail, Outil, SaisieLigne } from './mail-ui';
import { ContexteNouveauMail, OutilsNouveauMail } from './outils-nouveau-mail';
import { ChampPersonnes } from './saisie-personnes';
import { ChampPieces } from './pieces-mail';
import { SignatureEnvoi, type ChoixSignature } from './signatures-mail';
import { ChoixSuiviEnvoi, useSuiviEnvoi } from './suivi-envoi';
import { Btn, Dialogue, T } from './ui';

export type Brouillon = { a?: string; sujet?: string; texte?: string; /** Le nom dicté quand l'adresse est inconnue : « Sophie ». */ nom?: string };

/**
 * Écrire un nouveau mail depuis un compte connecté (Gmail ou Outlook), comme dans Outlook : De, À, Cc et Objet
 * en lignes, puis le message et ses pièces jointes. Le brouillon peut venir de la voix
 * (« Écris un mail à Paul pour lui dire que… ») : rien ne part sans « Oui, envoyer ».
 */
export function EcrireMail({ brouillon, onFermer }: { brouillon?: Brouillon; onFermer: () => void }) {
  const { session, externes, config } = useStore();
  const { ajouter } = useActions();
  const [suivi, setSuivi] = useSuiviEnvoi(false);
  const comptes = externes.filter((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft');
  const [compte, setCompte] = useState(comptes[0]?.id ?? '');
  const [a, setA] = useState(brouillon?.a ?? '');
  const [cc, setCc] = useState('');
  const [avecCc, setAvecCc] = useState(false);
  const [champ, setChamp] = useState<'a' | 'cc' | null>(null);
  const [sujet, setSujet] = useState(brouillon?.sujet ?? '');
  const [texte, setTexte] = useState(brouillon?.texte ?? '');
  const [pieces, setPieces] = useState<FichierChoisi[]>([]);
  const [signature, setSignature] = useState<ChoixSignature>(undefined);
  const [confirme, setConfirme] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const choisi = comptes.find((x) => x.id === compte);
  // Pour la relance : le nom dicté (« Sophie »), sinon la première adresse.
  const destinataire = brouillon?.nom?.trim() || adresseEmail(a.split(/[,;]/)[0] ?? '') || a.trim();

  const changer = (f: (v: string) => void) => (v: string) => {
    f(v);
    setConfirme(false);
  };

  const envoyer = async () => {
    if (!session?.token || !compte) return;
    setBusy(true);
    setMsg('');
    try {
      await envoyerMail(`/integrations/${compte}/envoyer`, { a, ...(cc.trim() ? { cc } : {}), sujet, texte, ...(signature !== undefined ? { signature } : {}) }, pieces, session.token);
      if (suivi.actif) ajouter('relance', { id: uid(), contact: destinataire, sujet: objetPropre(sujet.trim()) || 'Suivi', boite: choisi?.ctx ?? 'pro', date: addDays(today(), suivi.jours), statut: 'a_faire', mode: config.defauts.relance, creeLe: new Date().toISOString() });
      setEnvoye(true);
    } catch (e) {
      setMsg((e as Error).message);
      setConfirme(false);
    } finally {
      setBusy(false);
    }
  };

  if (envoye)
    return (
      <Dialogue titre="Mail envoyé" onFermer={onFermer}>
        <T>
          « {sujet.trim() || '(sans objet)'} » est parti vers {a}.
        </T>
        {suivi.actif ? <T small>{`La relance « ${destinataire} » est prévue dans ${suivi.jours} jour${suivi.jours > 1 ? 's' : ''}, dans À faire › Relances.`}</T> : null}
        <T small muted>
          Tu le retrouveras dans tes messages envoyés, chez {choisi?.fournisseur === 'microsoft' ? 'Outlook' : 'Gmail'}.
        </T>
        <Btn label="Fermer" onPress={onFermer} />
      </Dialogue>
    );

  const adresseInconnue = !brouillon?.a && !!brouillon?.nom && !a.trim();
  const brouillonIA = { a, sujet, boite: choisi?.ctx, texte, onTexte: changer(setTexte), onObjet: changer(setSujet) };

  return (
    <Dialogue
      plein
      titre="Nouveau mail"
      onFermer={onFermer}
      pied={
        <>
          {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
          {confirme ? <T small>Envoyer à {a}{avecPieces(pieces.length)} ?</T> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {confirme ? <Outil grand label="Modifier" onPress={() => setConfirme(false)} /> : null}
            {confirme ? (
              <Outil principal grand etire icone="envoyer" label={busy ? 'Envoi…' : 'Oui, envoyer'} disabled={busy} onPress={envoyer} />
            ) : (
              <Outil principal grand etire icone="envoyer" label="Envoyer" disabled={!compte || !a.trim() || !texte.trim()} onPress={() => setConfirme(true)} />
            )}
          </View>
        </>
      }>
      {!comptes.length ? <T small style={{ color: C.agressif }}>Connecte Gmail ou Outlook dans Agendas & outils pour écrire depuis Me.</T> : null}
      <CadreMail>
        <ChampLigne label="De">
          {comptes.length > 1 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 8 }}>
              {comptes.map((x) => {
                const on = x.id === compte;
                return (
                  <Pressable
                    key={x.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => changer(setCompte)(x.id)}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.16) : 'transparent' }}>
                    <Text style={{ color: on ? C.ink : C.muted, fontFamily: on ? F.texteM : F.texte, fontSize: 13 }}>{x.compte}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text numberOfLines={1} style={{ color: comptes.length ? C.ink : C.muted, fontFamily: F.texte, fontSize: 15 }}>
              {comptes[0]?.compte ?? 'Aucun compte connecté'}
            </Text>
          )}
        </ChampLigne>
        <ChampPersonnes
          label="À"
          valeur={a}
          onChange={changer(setA)}
          autres={adressesSaisies(cc)}
          ouvert={champ === 'a'}
          onFocus={() => setChamp('a')}
          onQuitter={() => setChamp((x) => (x === 'a' ? null : x))}
          placeholder={brouillon?.nom && !brouillon.a ? `Adresse de ${brouillon.nom}` : 'paul@exemple.fr, marie@exemple.fr'}
          accessibilityLabel="Destinataires" autoFocus={!a}
          droite={
            avecCc ? null : (
              <Pressable accessibilityRole="button" accessibilityLabel="Ajouter un destinataire en copie" hitSlop={8} onPress={() => setAvecCc(true)}>
                <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Cc</Text>
              </Pressable>
            )
          }
        />
        {avecCc ? (
          <ChampPersonnes label="Cc" valeur={cc} onChange={changer(setCc)} autres={adressesSaisies(a)} ouvert={champ === 'cc'} onFocus={() => setChamp('cc')} onQuitter={() => setChamp((x) => (x === 'cc' ? null : x))} placeholder="marie@exemple.fr" accessibilityLabel="Copie à" autoFocus />
        ) : null}
        <ChampLigne label="Objet" dernier>
          <SaisieLigne value={sujet} onChangeText={changer(setSujet)} placeholder="Ajouter un objet" accessibilityLabel="Objet" />
        </ChampLigne>
        <CorpsMail value={texte} onChangeText={changer(setTexte)} placeholder="Bonjour, …" accessibilityLabel="Message" />
      </CadreMail>
      {compte ? <SignatureEnvoi compte={compte} valeur={signature} onChange={(v) => (setSignature(v), setConfirme(false))} /> : null}
      {comptes.length ? <ContexteNouveauMail {...brouillonIA} /> : null}
      <ChampPieces pieces={pieces} onChange={(p) => (setPieces(p), setConfirme(false))} />
      <OutilsNouveauMail {...brouillonIA} />
      {adresseInconnue ? <T small muted>{`Je n'ai pas trouvé l'adresse de ${brouillon?.nom} : écris-la dans « À ».`}</T> : null}
      <ChoixSuiviEnvoi qui={brouillon?.nom?.trim() || undefined} valeur={suivi} onChange={setSuivi} />
    </Dialogue>
  );
}
