import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

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

/**
 * Autour d'une réponse à un mail : écouter le mail, écouter la réponse, la faire vérifier par le copilote.
 * La relecture vaut pour le texte relu : dès qu'il change, elle disparaît, pour ne pas juger un autre brouillon.
 */
export function OutilsReponse({ mail, texte, onTexte }: { mail: Mail; texte: string; onTexte: (v: string) => void }) {
  const { session, espace, pro } = useStore();
  const copilote = useCopiloteVisible();
  const { reglages } = useReglagesAnalyse();
  const { parle, lire, arreter } = useEcoute();
  const [relue, setRelue] = useState<{ pour: string; r: RelectureReponse } | null>(null);
  const [cherche, setCherche] = useState(false);
  const [msg, setMsg] = useState('');
  const net = texte.trim();
  const r = relue && relue.pour === net ? relue.r : null;
  const traducteur = useTraducteur();
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
      const x = await api<RelectureReponse>('/assistant/mails/relire', { method: 'POST', token: session.token, body: { mail: mail.id, reponse: net, ton: espace.audio.ton, ...(reglages.consignes.trim() ? { consignes: reglages.consignes } : {}) } });
      setRelue({ pour: net, r: x });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setCherche(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <EcouterMail mail={mail} />
        <BoutonMail icone="onde" actif={parle} disabled={!net} label={parle ? 'Arrêter' : 'Écouter la réponse'} onPress={() => (parle ? arreter() : lire(net, `Ta réponse à ${mail.contact || 'ce mail'}`, langueTexte(net)))} />
        <BoutonDicter valeur={texte} onTexte={onTexte} />
        {copilote && pro ? <BoutonMail icone="copilote" disabled={!net || cherche} label={cherche ? 'Vérification…' : 'Vérifier la réponse'} onPress={verifier} /> : null}
      </View>
      {traducteur.disponible ? <ChoixLangue titre="Traduire la réponse" valeur={langueVue} charge={traduction} onChange={choisirLangue} /> : null}
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
