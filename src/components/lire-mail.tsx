import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { api } from '@/lib/api';
import { parler, taire } from '@/lib/assistant';
import { refExterne } from '@/lib/externe';
import { lectureMail, type ContenuMail, type Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { EtiquettesMail, FilConversation, TexteMail } from './corps-mail';
import { CorpsRiche } from './corps-riche';
import { DeplacerMail } from './dossiers-mail';
import { Icone, type IconeNom } from './icones';
import { SuiviMail } from './lien-mail';
import { Avatar, BadgeBoite, nomService, Outil } from './mail-ui';
import { Bloc, ZoneSquelette } from './squelettes';
import { Dialogue, T } from './ui';

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
  const { session, espace, synchroniser, marquerLu } = useStore();
  const [contenu, setContenu] = useState<ContenuMail | null>(null);
  const [msg, setMsg] = useState('');
  const [parle, setParle] = useState(false);
  const ref = refExterne(mail.id);
  const token = session?.token;

  const lire = (m: ContenuMail) => {
    setParle(true);
    parler(lectureMail(m), espace.audio, { titre: `Mail de ${m.de || 'quelqu’un'}`, onDone: () => setParle(false) });
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
        // Le serveur a noté le mail (et son fil) comme lu chez le service : la liste suit tout de suite, puis se relit.
        if (mail.nonLu) {
          marquerLu(mail.id);
          synchroniser(false, true).catch(() => {});
        }
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

/** Ce que partagent les outils et le détail d'un mail ouvert. */
function useMailOuvert(mail: Mail, aVoix?: boolean) {
  const c = useContenu(mail, aVoix);
  const { externes } = useStore();
  const [etiqueter, setEtiqueter] = useState(false);
  const [deplacer, setDeplacer] = useState(false);
  const [range, setRange] = useState('');
  const compte = c.ref ? externes.find((x) => x.id === c.ref?.compte) : undefined;
  return { ...c, etiqueter, setEtiqueter, deplacer, setDeplacer, range, setRange, compte, service: nomService(mail), ouvrir: () => mail.lien && Linking.openURL(mail.lien).catch(() => {}) };
}
type MailOuvert = ReturnType<typeof useMailOuvert>;
type Actions = { onRepondre: () => void; onRelancer?: () => void; /** Le copilote analyse ce mail et propose une réponse. */ onAnalyser?: () => void };

/** Les actions d'un mail. Sur téléphone, dans la barre du bas : Répondre au pouce, les deux suivantes en icônes, le reste derrière « ⋯ ». */
function OutilsMail({ o, mail, onRepondre, onRelancer, onAnalyser, etroit }: Actions & { o: MailOuvert; mail: Mail; etroit?: boolean }) {
  const [plus, setPlus] = useState(false);
  const { ref, contenu, compte, range, parle, service } = o;
  const directes = [
    onAnalyser && ref ? { icone: 'copilote' as const, label: 'Analyser', onPress: onAnalyser } : null,
    onRelancer ? { icone: 'relances' as const, label: 'Relancer', onPress: onRelancer } : null,
    contenu ? { icone: 'onde' as const, label: parle ? 'Arrêter la lecture' : 'Écouter le mail', onPress: () => (parle ? o.arreter() : o.lire(contenu)) } : null,
  ].filter((x) => x !== null);
  const autres = [
    ref && contenu ? { icone: 'etiquette' as const, label: 'Étiqueter', onPress: () => o.setEtiqueter((v) => !v) } : null,
    ref && compte?.dossiers && !range ? { icone: 'deplacer' as const, label: 'Déplacer', onPress: () => o.setDeplacer((v) => !v) } : null,
    mail.lien ? { icone: 'ouvrir' as const, label: `Ouvrir dans ${service}`, onPress: o.ouvrir } : null,
  ].filter((x) => x !== null);

  if (!etroit)
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Outil principal icone="repondre" label="Répondre" disabled={!ref} onPress={onRepondre} />
        {[...directes, ...autres].map((x) => (
          <Outil key={x.icone} icone={x.icone} label={x.label} onPress={x.onPress} />
        ))}
      </View>
    );
  return (
    <View style={{ gap: 8 }}>
      {plus && autres.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {autres.map((x) => (
            <Outil
              key={x.icone}
              icone={x.icone}
              label={x.label}
              onPress={() => {
                setPlus(false);
                x.onPress();
              }}
            />
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Outil principal grand etire icone="repondre" label="Répondre" disabled={!ref} onPress={onRepondre} />
        {directes.map((x) => (
          <Outil key={x.icone} grand masquerLabel icone={x.icone} label={x.label} onPress={x.onPress} />
        ))}
        {autres.length ? <Outil grand masquerLabel glyphe="⋯" label={plus ? 'Moins d’actions' : 'Plus d’actions'} onPress={() => setPlus((v) => !v)} /> : null}
      </View>
    </View>
  );
}

function ObjetMail({ o, mail, etroit }: { o: MailOuvert; mail: Mail; etroit?: boolean }) {
  return <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: etroit ? 20 : 22, lineHeight: etroit ? 26 : 28 }}>{o.contenu?.sujet || mail.sujet}</Text>;
}

function CorpsDuMail({ contenu, service }: { contenu: ContenuMail; service: string }) {
  if (contenu.riche) return <CorpsRiche riche={contenu.riche} />;
  if (contenu.texte) return <TexteMail texte={contenu.texte} />;
  return <T muted>Ce mail ne contient pas de texte (peut-être seulement des images) : ouvre-le dans {service}.</T>;
}

function PiecesJointes({ contenu, mail }: { contenu: ContenuMail; mail: Mail }) {
  if (!contenu.piecesJointes.length) return null;
  const service = nomService(mail);
  return (
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
            onPress={() => mail.lien && Linking.openURL(mail.lien).catch(() => {})}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 260, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? alpha(C.ink, 0.06) : C.sunk })}>
            <Icone nom="trombone" color={C.muted} size={16} />
            <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>
              {p}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Un petit bouton à icône, le même pour écouter et faire relire. */
export function BoutonMail({ icone, label, actif, disabled, onPress }: { icone: IconeNom; label: string; actif?: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: actif ? C.accent : C.line, backgroundColor: actif ? alpha(C.accent, 0.14) : pressed ? alpha(C.ink, 0.06) : C.sunk, opacity: disabled ? 0.6 : 1 })}>
      <Icone nom={icone} color={actif ? C.accent : C.ink} size={15} />
      <Text style={{ color: actif ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/** Faire lire un texte à voix haute depuis un bouton : la lecture s'arrête avec le bouton, ou quand une autre commence. */
export function useEcoute() {
  const { espace } = useStore();
  const [parle, setParle] = useState(false);
  const mien = useRef(false);
  useEffect(
    () => () => {
      if (mien.current) taire();
    },
    [],
  );
  const lire = (texte: string, titre: string) => {
    mien.current = true;
    setParle(true);
    parler(texte, espace.audio, {
      titre,
      onDone: () => {
        mien.current = false;
        setParle(false);
      },
    });
  };
  return { parle, lire, arreter: () => void taire() };
}

/** « Écouter le mail » : relit le mail si besoin, sans le marquer comme lu, puis le lit sans sa signature. */
export function EcouterMail({ mail, contenu: connu }: { mail: Mail; contenu?: ContenuMail }) {
  const { session } = useStore();
  const { parle, lire, arreter } = useEcoute();
  const [charge, setCharge] = useState(false);
  const [msg, setMsg] = useState('');
  const ref = refExterne(mail.id);
  const titre = `Mail de ${mail.contact || 'quelqu’un'}`;
  const ecouter = async () => {
    if (connu) return lire(lectureMail(connu), titre);
    if (!ref || !session?.token) return;
    setCharge(true);
    setMsg('');
    try {
      const r = await api<{ mail: ContenuMail }>(`/integrations/${ref.compte}/mails/${encodeURIComponent(ref.element)}?lu=0`, { token: session.token });
      lire(lectureMail(r.mail), titre);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setCharge(false);
    }
  };
  if (!ref && !connu) return null;
  return (
    <View style={{ gap: 4, alignSelf: 'flex-start', maxWidth: '100%' }}>
      <BoutonMail icone="onde" actif={parle} disabled={charge} label={charge ? 'Un instant…' : parle ? 'Arrêter' : 'Écouter le mail'} onPress={() => (parle ? arreter() : ecouter())} />
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
    </View>
  );
}

/** Le mail d'origine, relu sans le marquer comme lu : pour vérifier une analyse. */
export function ApercuMail({ mail, ecoute }: { mail: Mail; /** Montre aussi « Écouter le mail ». */ ecoute?: boolean }) {
  const { session } = useStore();
  const [contenu, setContenu] = useState<ContenuMail | null>(null);
  const [msg, setMsg] = useState('');
  const [essai, setEssai] = useState(0);
  const ref = refExterne(mail.id);
  const token = session?.token;
  useEffect(() => {
    if (!ref || !token) return;
    let vivant = true;
    api<{ mail: ContenuMail }>(`/integrations/${ref.compte}/mails/${encodeURIComponent(ref.element)}?lu=0`, { token })
      .then((r) => vivant && setContenu(r.mail))
      .catch((e: Error) => vivant && setMsg(e.message));
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mail.id, token, essai]);

  if (!ref) return <T small style={{ color: C.agressif }}>Ce message ne vient pas d'un compte connecté : impossible de le lire depuis Me.</T>;
  if (msg)
    return (
      <View style={{ gap: 8, alignItems: 'flex-start' }}>
        <T small style={{ color: C.agressif }}>{msg}</T>
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => {
            setMsg('');
            setEssai((x) => x + 1);
          }}>
          <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Réessayer ›</Text>
        </Pressable>
      </View>
    );
  if (!contenu)
    return (
      <ZoneSquelette label="Chargement du mail">
        <Bloc h={14} r={6} />
        <Bloc h={14} r={6} />
        <Bloc h={14} r={6} l="85%" />
        <Bloc h={14} r={6} l="60%" />
      </ZoneSquelette>
    );
  return (
    <View style={{ gap: 14 }}>
      {dateLongue(contenu) ? <T small muted>{dateLongue(contenu)}</T> : null}
      {ecoute ? <EcouterMail mail={mail} contenu={contenu} /> : null}
      <CorpsDuMail contenu={contenu} service={nomService(mail)} />
      <PiecesJointes contenu={contenu} mail={mail} />
      {contenu.fil?.length ? <FilConversation messages={contenu.fil} /> : null}
    </View>
  );
}

/** L'expéditeur et les destinataires, puis le texte et les pièces jointes. */
function DetailMail({ o, mail, onDeplace, etroit }: { o: MailOuvert; mail: Mail; /** Le mail a été rangé dans un autre dossier : la liste le retire. */ onDeplace?: (nom: string) => void; etroit?: boolean }) {
  const { ref, contenu, msg, compte, service, ouvrir, deplacer, setDeplacer, range, setRange, etiqueter, setEtiqueter } = o;
  const boite = contenu?.boite ?? mail.boite;
  const de = contenu?.de || mail.contact || 'Sans expéditeur';
  const adresse = contenu?.adresse && contenu.adresse !== contenu.de ? contenu.adresse.replace(/^.*<([^>]+)>.*$/, '$1') : '';

  return (
    <>
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
      {contenu ? <CorpsDuMail contenu={contenu} service={service} /> : null}

      {contenu ? <PiecesJointes contenu={contenu} mail={mail} /> : null}

      {contenu?.fil?.length ? <FilConversation messages={contenu.fil} /> : null}
    </>
  );
}

/**
 * Un mail lu en entier, comme le volet de lecture d'Outlook : l'objet, la barre d'outils, l'expéditeur et
 * les destinataires, puis le texte et les pièces jointes. Sur ordinateur, dans le volet de droite.
 */
export function VueMail({ mail, aVoix, onRepondre, onRelancer, onDeplace, onAnalyser }: Actions & { mail: Mail; aVoix?: boolean; onDeplace?: (nom: string) => void }) {
  const o = useMailOuvert(mail, aVoix);
  return (
    <View style={{ gap: 16 }}>
      <ObjetMail o={o} mail={mail} />
      <OutilsMail o={o} mail={mail} onRepondre={onRepondre} onRelancer={onRelancer} onAnalyser={onAnalyser} />
      <DetailMail o={o} mail={mail} onDeplace={onDeplace} />
    </View>
  );
}

/** Le mail en plein écran, sur téléphone : le texte d'abord, les actions au pouce en bas. */
export function LireMail({ mail, aVoix, onRepondre, onRelancer, onDeplace, onAnalyser, onFermer }: Actions & { mail: Mail; aVoix?: boolean; onDeplace?: (nom: string) => void; onFermer: () => void }) {
  const o = useMailOuvert(mail, aVoix);
  return (
    <Dialogue plein large onFermer={onFermer} pied={<OutilsMail etroit o={o} mail={mail} onRepondre={onRepondre} onRelancer={onRelancer} onAnalyser={onAnalyser} />}>
      <ObjetMail etroit o={o} mail={mail} />
      <DetailMail etroit o={o} mail={mail} onDeplace={onDeplace} />
    </Dialogue>
  );
}
