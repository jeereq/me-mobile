import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { parler, taire } from '@/lib/assistant';
import { refExterne } from '@/lib/externe';
import type { ContenuMail, Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { EtiquettesMail, FilConversation, TexteMail } from './corps-mail';
import { DeplacerMail } from './dossiers-mail';
import { Icone } from './icones';
import { SuiviMail } from './lien-mail';
import { Avatar, BadgeBoite, nomService, Outil } from './mail-ui';
import { Bloc, ZoneSquelette } from './squelettes';
import { Dialogue, T } from './ui';

/** Ce que la voix lit d'un mail : qui, quoi, puis le texte (les longs mails sont coupés, la suite reste à l'écran). */
const aLire = (m: ContenuMail) => `Mail de ${m.de || 'quelqu’un'}. Objet : ${m.sujet}. ${m.texte.length > 1500 ? `${m.texte.slice(0, 1500)}… La suite est à l'écran.` : m.texte || 'Ce mail ne contient pas de texte.'}`;

const dateLongue = (c: ContenuMail) => {
  if (!c.date) return '';
  const d = new Date(`${c.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return `${d.charAt(0).toUpperCase()}${d.slice(1)}${c.heure ? ` · ${c.heure}` : ''}`;
};

/**
 * Le contenu d'un mail, demandé au serveur à l'ouverture (rien n'est gardé) ; le serveur le marque comme lu.
 * `aVoix` le lit tout de suite à voix haute (commande « Lis le mail de Paul »).
 */
function useContenu(mail: Mail, aVoix?: boolean) {
  const { session, espace, synchroniser } = useStore();
  const [contenu, setContenu] = useState<ContenuMail | null>(null);
  const [msg, setMsg] = useState('');
  const [parle, setParle] = useState(false);
  const ref = refExterne(mail.id);
  const token = session?.token;

  const lire = (m: ContenuMail) => {
    setParle(true);
    parler(aLire(m), espace.audio, { onDone: () => setParle(false) });
  };
  const arreter = () => {
    taire();
    setParle(false);
  };

  useEffect(() => {
    if (!ref || !token) return;
    let vivant = true;
    api<{ mail: ContenuMail }>(`/integrations/${ref.compte}/mails/${encodeURIComponent(ref.element)}`, { token })
      .then((r) => {
        if (!vivant) return;
        setContenu(r.mail);
        if (aVoix) lire(r.mail);
        // Le serveur a noté le mail comme lu : la barre « non lu » disparaît à la relecture.
        if (mail.nonLu) synchroniser(false, true).catch(() => {});
      })
      .catch((e: Error) => vivant && setMsg(e.message));
    return () => {
      vivant = false;
      taire();
    };
    // Une seule lecture par mail ouvert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mail.id, token]);

  return { ref, contenu, msg, parle, lire, arreter };
}

/**
 * Un mail lu en entier, comme le volet de lecture d'Outlook : l'objet, la barre d'outils, l'expéditeur et
 * les destinataires, puis le texte et les pièces jointes. Sert au volet de droite (ordinateur) et à la fenêtre (téléphone).
 */
export function VueMail({ mail, aVoix, onRepondre, onRelancer, onDeplace, onAnalyser, etroit }: { mail: Mail; aVoix?: boolean; onRepondre: () => void; onRelancer?: () => void; /** Le copilote analyse ce mail et propose une réponse. */ onAnalyser?: () => void; /** Le mail a été rangé dans un autre dossier : la liste le retire. */ onDeplace?: (nom: string) => void; /** Barre d'outils en icônes seules. */ etroit?: boolean }) {
  const { ref, contenu, msg, parle, lire, arreter } = useContenu(mail, aVoix);
  const { externes } = useStore();
  const [etiqueter, setEtiqueter] = useState(false);
  const [deplacer, setDeplacer] = useState(false);
  const [range, setRange] = useState('');
  const compte = ref ? externes.find((x) => x.id === ref.compte) : undefined;
  const boite = contenu?.boite ?? mail.boite;
  const service = nomService(mail);
  const ouvrir = () => mail.lien && Linking.openURL(mail.lien).catch(() => {});
  const de = contenu?.de || mail.contact || 'Sans expéditeur';
  const adresse = contenu?.adresse && contenu.adresse !== contenu.de ? contenu.adresse.replace(/^.*<([^>]+)>.*$/, '$1') : '';

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 22, lineHeight: 28 }}>{contenu?.sujet || mail.sujet}</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Outil principal icone="repondre" label="Répondre" disabled={!ref} onPress={onRepondre} />
        {onAnalyser && ref ? <Outil icone="copilote" label="Analyser" onPress={onAnalyser} masquerLabel={etroit} /> : null}
        {onRelancer ? <Outil icone="relances" label="Relancer" onPress={onRelancer} masquerLabel={etroit} /> : null}
        {ref && contenu ? <Outil icone="etiquette" label="Étiqueter" onPress={() => setEtiqueter((v) => !v)} masquerLabel={etroit} /> : null}
        {ref && compte?.dossiers && !range ? <Outil icone="deplacer" label="Déplacer" onPress={() => setDeplacer((v) => !v)} masquerLabel={etroit} /> : null}
        {contenu ? <Outil icone="onde" label={parle ? 'Arrêter' : 'Écouter'} onPress={() => (parle ? arreter() : lire(contenu))} masquerLabel={etroit} /> : null}
        {mail.lien ? <Outil icone="ouvrir" label={`Ouvrir dans ${service}`} onPress={ouvrir} masquerLabel={etroit} /> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Avatar nom={de} taille={42} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 }}>
            <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>{de}</Text>
            {adresse ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{adresse}</Text> : null}
          </View>
          {contenu?.a.length ? (
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }} numberOfLines={2}>
              À : {contenu.a.join(', ')}
            </Text>
          ) : null}
          {contenu?.cc.length ? (
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }} numberOfLines={2}>
              Cc : {contenu.cc.join(', ')}
            </Text>
          ) : null}
          {contenu && etroit ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{dateLongue(contenu)}</Text> : null}
        </View>
        {contenu && !etroit ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{dateLongue(contenu)}</Text> : null}
      </View>

      {boite ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <BadgeBoite adresse={boite} />
          <Text style={{ flex: 1, minWidth: 180, color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>Boîte partagée {boite} · une réponse part de cette boîte.</Text>
        </View>
      ) : null}

      {ref && deplacer ? (
        <DeplacerMail
          compte={ref.compte}
          boite={boite}
          depuis={mail.dossier}
          mailId={ref.element}
          onAnnuler={() => setDeplacer(false)}
          onFini={(nom) => {
            setDeplacer(false);
            setRange(nom);
            onDeplace?.(nom);
          }}
        />
      ) : null}
      {range ? <T small style={{ color: C.accent }}>Rangé dans « {range} ».</T> : null}

      {ref ? <EtiquettesMail key={`${mail.id}-${contenu ? 'lu' : 'liste'}`} compteId={ref.compte} mailId={ref.element} libelles={contenu?.libelles ?? mail.libelles ?? []} dispo={compte?.libelles ?? []} edition={etiqueter} onFini={() => setEtiqueter(false)} /> : null}

      {ref ? <SuiviMail mail={mail} /> : null}

      <View style={{ height: 1, backgroundColor: C.line }} />

      {!ref ? <T small style={{ color: C.agressif }}>Ce message ne vient pas d'un compte connecté : impossible de le lire depuis Me.</T> : null}
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
      {!contenu && !msg && ref ? (
        <ZoneSquelette label="Chargement du mail">
          <Bloc h={14} r={6} />
          <Bloc h={14} r={6} />
          <Bloc h={14} r={6} l="85%" />
          <Bloc h={14} r={6} l="60%" />
        </ZoneSquelette>
      ) : null}
      {contenu ? contenu.texte ? <TexteMail texte={contenu.texte} /> : <T muted>Ce mail ne contient pas de texte (peut-être seulement des images) : ouvre-le dans {service}.</T> : null}

      {contenu?.piecesJointes.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>
            {contenu.piecesJointes.length} pièce{contenu.piecesJointes.length > 1 ? 's' : ''} jointe{contenu.piecesJointes.length > 1 ? 's' : ''} · à ouvrir dans {service}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {contenu.piecesJointes.map((p, i) => (
              <Pressable
                key={`${p}-${i}`}
                accessibilityRole="link"
                accessibilityLabel={`${p}, ouvrir dans ${service}`}
                disabled={!mail.lien}
                onPress={ouvrir}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 260, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? alpha(C.ink, 0.06) : C.sunk })}>
                <Icone nom="trombone" color={C.muted} size={16} />
                <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {contenu?.fil?.length ? <FilConversation messages={contenu.fil} /> : null}
    </View>
  );
}

/** Le mail en fenêtre, sur téléphone (sur ordinateur, il s'ouvre dans le volet de lecture). */
export function LireMail({ mail, aVoix, onRepondre, onRelancer, onDeplace, onAnalyser, onFermer }: { mail: Mail; aVoix?: boolean; onRepondre: () => void; onRelancer?: () => void; onDeplace?: (nom: string) => void; onAnalyser?: () => void; onFermer: () => void }) {
  return (
    <Dialogue titre={mail.contact || 'Mail'} onFermer={onFermer} large>
      <VueMail mail={mail} aVoix={aVoix} onRepondre={onRepondre} onRelancer={onRelancer} onDeplace={onDeplace} onAnalyser={onAnalyser} etroit />
    </Dialogue>
  );
}
