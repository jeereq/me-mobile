import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text, TextInput } from '@/components/texte';

import { useReglagesAnalyse } from '@/lib/analyse-pref';
import { api } from '@/lib/api';
import { GENRES_POINT, type RelectureReponse } from '@/lib/copilote';
import { langueTexte } from '@/lib/lecture';
import type { Langue } from '@/lib/traduction';
import type { Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { useCopiloteVisible } from './copilote';
import { BoutonMail, useEcoute } from './boutons-mail';
import { BoutonDicter } from './dictee';
import { EcouterMail } from './lire-mail';
import { ChoixLangue, useTraducteur } from './traduire';
import { Btn, T } from './ui';

type Ajustement = 'court' | 'formel' | 'decliner' | 'refaire';
export type ChoixAjustement<A extends string> = [A, string];
const AJUSTEMENTS: ChoixAjustement<Ajustement>[] = [
  ['court', 'Plus court'],
  ['formel', 'Plus formel'],
  ['decliner', 'Décliner'],
  ['refaire', 'Refaire'],
];

/**
 * Dire au copilote ce qu'il faut répondre : il rédige d'après toute la boucle et ce contexte, avec ou sans brouillon.
 * Le texte d'avant reste à portée, le temps de décider.
 */
export function ContexteReponse({ mail, texte, onTexte }: { mail: Mail; texte: string; onTexte: (v: string) => void }) {
  const { session, espace } = useStore();
  const { reglages } = useReglagesAnalyse();
  const rediger = async (contexte: string, net: string) => {
    const x = await api<{ reponse: string }>('/assistant/mails/ajuster', { method: 'POST', token: session?.token, body: { mail: mail.id, action: contexte ? 'contexte' : 'repondre', ...(contexte ? { contexte } : {}), ...(net ? { reponse: net } : {}), ton: espace.audio.ton, ...(reglages.consignes.trim() ? { consignes: reglages.consignes } : {}) } });
    return x.reponse;
  };
  return <ContexteBrouillon rediger={rediger} texte={texte} onTexte={onTexte} label="Ton contexte pour cette réponse" placeholder="Ton contexte : ce qu'il faut dire, ce que tu sais…" sansContexte="Rédiger une réponse" />;
}

/** Le champ de contexte, pour une réponse comme pour un nouveau mail. */
export function ContexteBrouillon({ rediger: demander, texte, onTexte, label, placeholder, sansContexte }: { rediger: (contexte: string, net: string) => Promise<string>; texte: string; onTexte: (v: string) => void; label: string; placeholder: string; /** Rédiger est possible sans contexte : le libellé du bouton. */ sansContexte?: string }) {
  const { session, pro } = useStore();
  const copilote = useCopiloteVisible();
  const [contexte, setContexte] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [msg, setMsg] = useState('');
  const [fait, setFait] = useState<{ avant: string; apres: string } | null>(null);
  if (!copilote || !pro) return null;
  const rediger = async () => {
    if (!session?.token || (!contexte.trim() && !sansContexte)) return;
    setEnCours(true);
    setMsg('');
    try {
      const apres = await demander(contexte.trim(), texte.trim());
      setFait({ avant: texte, apres });
      onTexte(apres);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setEnCours(false);
    }
  };
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk }}>
      <TextInput
        multiline
        value={contexte}
        onChangeText={setContexte}
        maxLength={2000}
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        selectionColor={C.accent}
        textAlignVertical="top"
        style={{ minHeight: 56, padding: 0, color: C.ink, fontFamily: F.texte, fontSize: 14.5, lineHeight: 20, outlineStyle: 'none' } as object}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <BoutonMail icone="copilote" disabled={enCours || (!contexte.trim() && !sansContexte)} label={enCours ? 'Rédaction…' : contexte.trim() || !sansContexte ? 'Rédiger avec ce contexte' : sansContexte} onPress={rediger} />
        <BoutonDicter label="Dicter le contexte" valeur={contexte} onTexte={setContexte} />
        {fait && fait.apres === texte ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => {
              onTexte(fait.avant);
              setFait(null);
            }}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Annuler</Text>
          </Pressable>
        ) : null}
      </View>
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
    </View>
  );
}

/**
 * Autour d'une réponse à un mail : écouter le mail, écouter la réponse, la faire vérifier par le copilote.
 * La relecture vaut pour le texte relu : dès qu'il change, elle disparaît, pour ne pas juger un autre brouillon.
 */
export function OutilsReponse({ mail, texte, onTexte }: { mail: Mail; texte: string; onTexte: (v: string) => void }) {
  const { session, espace } = useStore();
  const { reglages } = useReglagesAnalyse();
  const commun = { ton: espace.audio.ton, ...(reglages.consignes.trim() ? { consignes: reglages.consignes } : {}) };
  return (
    <OutilsBrouillon
      texte={texte}
      onTexte={onTexte}
      ajustements={AJUSTEMENTS}
      ajuster={async (action, net) => (await api<{ reponse: string }>('/assistant/mails/ajuster', { method: 'POST', token: session?.token, body: { mail: mail.id, reponse: net, action, ...commun } })).reponse}
      relire={(net) => api<RelectureReponse>('/assistant/mails/relire', { method: 'POST', token: session?.token, body: { mail: mail.id, reponse: net, ...commun } })}
      avant={<EcouterMail mail={mail} />}
      ecouter="Écouter la réponse"
      titreEcoute={`Ta réponse à ${mail.contact || 'ce mail'}`}
      verifier="Vérifier la réponse"
      traduire="Traduire la réponse"
    />
  );
}

/** Ajuster, écouter, dicter, vérifier et traduire un brouillon : pour une réponse comme pour un nouveau mail. */
export function OutilsBrouillon<A extends string>({ texte, onTexte, ajustements, ajuster: demanderAjustement, relire, avant, ecouter, titreEcoute, verifier: libelleVerifier, traduire }: { texte: string; onTexte: (v: string) => void; ajustements: ChoixAjustement<A>[]; ajuster: (action: A, net: string) => Promise<string>; relire: (net: string) => Promise<RelectureReponse>; avant?: ReactNode; ecouter: string; titreEcoute: string; verifier: string; traduire: string }) {
  const { session, pro } = useStore();
  const copilote = useCopiloteVisible();
  const { parle, lire, arreter } = useEcoute();
  const [relue, setRelue] = useState<{ pour: string; r: RelectureReponse } | null>(null);
  const [cherche, setCherche] = useState(false);
  const [msg, setMsg] = useState('');
  const net = texte.trim();
  const r = relue && relue.pour === net ? relue.r : null;
  const traducteur = useTraducteur();
  // Ajuster le brouillon : le texte d'avant reste à portée, le temps de décider.
  const [ajuste, setAjuste] = useState<{ avant: string; apres: string } | null>(null);
  const [enCours, setEnCours] = useState<A | null>(null);
  const ajuster = async (action: A) => {
    if (!session?.token || !net) return;
    setEnCours(action);
    setMsg('');
    try {
      const apres = await demanderAjustement(action, net);
      setAjuste({ avant: texte, apres });
      onTexte(apres);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setEnCours(null);
    }
  };
  // La réponse traduite remplace le brouillon ; l'original reste à portée tant qu'on n'a pas retouché le texte.
  const [traduite, setTraduite] = useState<{ langue: Langue; avant: string; apres: string } | null>(null);
  const [traduction, setTraduction] = useState(false);
  const langueVue = traduite && traduite.apres === texte ? traduite.langue : null;
  const choisirLangue = async (l: Langue | null) => {
    const avant = traduite && traduite.apres === texte ? traduite.avant : texte;
    if (!l) {
      setTraduite(null);
      return onTexte(avant);
    }
    if (!avant.trim()) return;
    setTraduction(true);
    setMsg('');
    try {
      const [t] = await traducteur.traduire([avant], l);
      setTraduite({ langue: l, avant, apres: t });
      onTexte(t);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setTraduction(false);
    }
  };

  const verifier = async () => {
    if (!session?.token || !net) return;
    setCherche(true);
    setMsg('');
    try {
      setRelue({ pour: net, r: await relire(net) });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setCherche(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {copilote && pro ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {ajustements.map(([cle, label]) => (
            <Pressable key={cle} accessibilityRole="button" disabled={!!enCours || !net} onPress={() => ajuster(cle)} style={({ pressed }) => ({ paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, backgroundColor: enCours === cle ? alpha(C.accent, 0.2) : pressed ? alpha(C.accent, 0.2) : alpha(C.accent, 0.1), opacity: !net ? 0.5 : 1 })}>
              <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>{enCours === cle ? 'Un instant…' : label}</Text>
            </Pressable>
          ))}
          {ajuste && ajuste.apres === texte ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => {
                onTexte(ajuste.avant);
                setAjuste(null);
              }}>
              <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Annuler</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {avant}
        <BoutonMail icone="onde" actif={parle} disabled={!net} label={parle ? 'Arrêter' : ecouter} onPress={() => (parle ? arreter() : lire(net, titreEcoute, langueTexte(net)))} />
        <BoutonDicter valeur={texte} onTexte={onTexte} />
        {copilote && pro ? <BoutonMail icone="copilote" disabled={!net || cherche} label={cherche ? 'Vérification…' : libelleVerifier} onPress={verifier} /> : null}
      </View>
      {traducteur.disponible ? <ChoixLangue titre={traduire} valeur={langueVue} charge={traduction} onChange={choisirLangue} /> : null}
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
      {r ? <Relecture r={r} onUtiliser={() => onTexte(r.version)} onFermer={() => setRelue(null)} /> : null}
    </View>
  );
}

function Relecture({ r, onUtiliser, onFermer }: { r: RelectureReponse; onUtiliser: () => void; onFermer: () => void }) {
  const bon = r.verdict === 'bon';
  const c = bon ? C.coach : C.agressif;
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: alpha(c, 0.4), backgroundColor: alpha(c, C.sombre ? 0.1 : 0.06) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, color: c, fontFamily: F.texteF, fontSize: 14 }}>{bon ? 'Prête à partir' : 'À revoir'}</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onFermer}>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Masquer</Text>
        </Pressable>
      </View>
      <Text style={{ color: C.ink, fontFamily: F.texte, fontSize: 14, lineHeight: 20 }}>{r.avis}</Text>
      {r.points.map((p, i) => (
        <Text key={i} style={{ color: C.ink, fontFamily: F.texte, fontSize: 13.5, lineHeight: 19 }}>
          <Text style={{ fontFamily: F.texteF }}>{GENRES_POINT[p.genre]} : </Text>
          {p.texte}
        </Text>
      ))}
      {r.version ? (
        <View style={{ gap: 8 }}>
          <View style={{ padding: 10, borderRadius: 10, backgroundColor: C.sunk }}>
            <Text selectable style={{ color: C.ink, fontFamily: F.texte, fontSize: 13.5, lineHeight: 19 }}>{r.version}</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <Btn small label="Utiliser cette version" onPress={onUtiliser} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
