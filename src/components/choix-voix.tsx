import type { Voice } from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, Pressable, Switch, View } from 'react-native';

import { parler, voixDisponibles } from '@/lib/assistant';
import { VOIX_TELEPHONE } from '@/lib/eve';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { AudioPrefs } from '@/lib/types';
import { autoriserVoixPerso, etatVoixPerso, idsVoixPerso, type EtatVoixPerso } from '@/lib/voix-perso';

import { Btn, Empty, Input, Seg, T } from './ui';

const fmt = (n: number) => String(n).replace('.', ',');

/** Les étapes pour enregistrer sa voix sur iPhone, telles qu'iOS les présente. */
const ETAPES_IPHONE = [
  'Ouvre Réglages › Accessibilité › Voix personnelle, puis « Créer une voix personnelle ».',
  'Dans un endroit calme, lis à voix haute les phrases proposées (environ 15 minutes).',
  'Laisse l’iPhone verrouillé et en charge : iOS prépare ta voix sur l’appareil, souvent pendant la nuit.',
  'Dans le même écran, active « Autoriser les apps à demander à l’utiliser », puis reviens ici.',
];

function MaPropreVoix({ etat, onAutoriser }: { etat: EtatVoixPerso | null; onAutoriser: () => void }) {
  const boite = { gap: 8, padding: 12, borderRadius: 12, backgroundColor: alpha(C.accent, 0.08) };
  const titre = <T>Ta propre voix</T>;
  if (Platform.OS === 'web')
    return (
      <View style={boite}>
        {titre}
        <T small muted>
          Ta propre voix : app iPhone, iOS 17 ou plus.
        </T>
      </View>
    );
  if (Platform.OS === 'android')
    return (
      <View style={boite}>
        {titre}
        <T small muted>
          Voix plus naturelle : Paramètres › Accessibilité › Synthèse vocale › moteur Google › Installer les données vocales.
        </T>
      </View>
    );
  if (etat === null)
    return (
      <View style={boite}>
        {titre}
        <T small muted>
          Bientôt sur iPhone. À enregistrer dans Réglages › Accessibilité › Voix personnelle.
        </T>
      </View>
    );
  if (etat === 'indisponible')
    return (
      <View style={boite}>
        {titre}
        <T small muted>
          La voix personnelle demande iOS 17 ou plus récent, et un iPhone compatible.
        </T>
      </View>
    );
  if (etat === 'autorise')
    return (
      <View style={boite}>
        {titre}
        <T small muted>
          Choisis « Ta voix » dans la liste. Absente ? Réglages › Accessibilité › Voix personnelle.
        </T>
      </View>
    );
  return (
    <View style={boite}>
      {titre}
      <T small muted>
        Ta voix, gardée sur ton iPhone : rien n’est envoyé.
      </T>
      {ETAPES_IPHONE.map((x, i) => (
        <T key={i} small>
          {i + 1}. {x}
        </T>
      ))}
      {etat === 'refuse' ? (
        <>
          <T small muted>
            Accès refusé. Active Me dans Réglages › Accessibilité › Voix personnelle.
          </T>
          <Btn kind="sec" small label="Ouvrir les Réglages" onPress={() => Linking.openSettings().catch(() => {})} />
        </>
      ) : (
        <Btn small label="Utiliser ma voix personnelle" onPress={onAutoriser} />
      )}
    </View>
  );
}

/**
 * La voix de l'app : quelle voix lit les réponses, le briefing et les mails, à quelle vitesse et quelle hauteur.
 * Partagé entre Mon compte (Réglages) et l'Assistant audio.
 */
export function ChoixVoix() {
  const { espace, update, profil } = useStore();
  const a = espace.audio;
  const prenom = (profil?.nom || '').split(' ')[0];
  const [toutes, setToutes] = useState(false);
  const [voix, setVoix] = useState<Voice[]>([]);
  const [perso, setPerso] = useState<Set<string>>(() => idsVoixPerso());
  const [etat, setEtat] = useState<EtatVoixPerso | null>(() => etatVoixPerso());
  const [essai, setEssai] = useState('');
  const phrase = essai.trim() || `Bonjour${prenom ? ` ${prenom}` : ''}, je suis ${!a.voix ? 'Eve' : 'la voix de Me'}. Tu as trois tâches aujourd’hui.`;
  const setA = (patch: Partial<AudioPrefs>) => update((e) => ({ ...e, audio: { ...e.audio, ...patch } }));

  // Les voix changent quand on revient des Réglages (voix personnelle prête, voix téléchargée).
  const recharger = useCallback(() => {
    voixDisponibles(toutes)
      .catch(() => [] as Voice[])
      .then((l) => {
        const ids = idsVoixPerso();
        setEtat(etatVoixPerso());
        setPerso(ids);
        setVoix([...l.filter((v) => ids.has(v.identifier)), ...l.filter((v) => !ids.has(v.identifier))]);
      });
  }, [toutes]);
  useEffect(() => {
    recharger();
    const s = AppState.addEventListener('change', (x) => {
      if (x === 'active') recharger();
    });
    return () => s.remove();
  }, [recharger]);

  const autoriser = async () => {
    const r = await autoriserVoixPerso();
    setEtat(r);
    recharger();
  };
  const telephone = a.voix === VOIX_TELEPHONE;
  const choisir = (id: string) => {
    setA({ voix: id });
    parler(phrase, { ...a, voix: id });
  };

  return (
    <View style={{ gap: 14 }}>
      <MaPropreVoix etat={etat} onAutoriser={autoriser} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T small muted>
          Voir les voix de toutes les langues
        </T>
        <Switch value={toutes} onValueChange={setToutes} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} accessibilityLabel="Voir les voix de toutes les langues" />
      </View>
      <View style={{ gap: 6 }}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: !a.voix }}
          onPress={() => choisir('')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: !a.voix ? C.accent : C.line, borderRadius: 10, padding: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: !a.voix ? C.accent : 'transparent', borderWidth: 1, borderColor: C.accent }} />
          <View style={{ flex: 1 }}>
            <T>Eve</T>
            <T small muted>
              La voix de Me
            </T>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: telephone }}
          onPress={() => choisir(VOIX_TELEPHONE)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: telephone ? C.accent : C.line, borderRadius: 10, padding: 10 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: telephone ? C.accent : 'transparent', borderWidth: 1, borderColor: C.accent }} />
          <View style={{ flex: 1 }}>
            <T>Voix du téléphone</T>
            <T small muted>
              Celle réglée par défaut sur l’appareil
            </T>
          </View>
        </Pressable>
        {voix.slice(0, 40).map((v) => {
          const on = a.voix === v.identifier;
          const sienne = perso.has(v.identifier);
          return (
            <Pressable
              key={v.identifier}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => choisir(v.identifier)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: on ? C.accent : C.line, borderRadius: 10, padding: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: on ? C.accent : 'transparent', borderWidth: 1, borderColor: C.accent }} />
              <View style={{ flex: 1 }}>
                <T>{sienne ? `Ta voix · ${v.name}` : v.name}</T>
                <T small muted>
                  {v.language}
                  {sienne ? ' · voix personnelle' : v.quality === 'Enhanced' ? ' · haute qualité' : ''}
                </T>
              </View>
            </Pressable>
          );
        })}
        {!voix.length ? <Empty>Aucune voix : active « toutes les langues ».</Empty> : null}
      </View>

      <Input label="Phrase d’essai" value={essai} onChangeText={setEssai} placeholder={phrase} returnKeyType="done" onSubmitEditing={() => parler(phrase, a)} />
      <Btn kind="sec" label="Écouter" onPress={() => parler(phrase, a)} />

      <Seg label={`Vitesse · ${fmt(a.vitesse)}`} options={[0.7, 0.85, 1, 1.15, 1.3, 1.5].map((x) => ({ key: String(x), label: fmt(x) }))} value={String(a.vitesse)} onChange={(k) => setA({ vitesse: Number(k) })} />
      <Seg label={`Hauteur · ${fmt(a.hauteur)}`} options={[0.7, 0.85, 1, 1.15, 1.3].map((x) => ({ key: String(x), label: fmt(x) }))} value={String(a.hauteur)} onChange={(k) => setA({ hauteur: Number(k) })} />
      <T small muted style={{ fontFamily: F.texte }}>
        Pour le briefing, la commande vocale et les mails.
      </T>
    </View>
  );
}
