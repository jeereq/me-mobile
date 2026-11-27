import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { usePathname } from 'expo-router';

import { Icone } from '@/components/icones';
import { Text } from '@/components/texte';
import { Btn, Dialogue, Input, T } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { demanderIA, iaDisponible } from '@/lib/assistant';
import { aide, useAide } from '@/lib/guide-aide';
import { type ActionGuide, chercherActions, GUIDE, type GuideCle, guideDeChemin, guideEnTexte } from '@/lib/guide-pages';
import { useBarreOnglets } from '@/lib/mise-en-page';
import { page } from '@/lib/navigation';
import { useStore } from '@/lib/store';
import { teinteDe } from '@/lib/teinte';
import { alpha, C, F, ombre } from '@/lib/theme';
import { ORDRE_VISITE, visite } from '@/lib/visite';

const titreDe = (cle: GuideCle) => (cle === 'annuaire' ? 'Annuaire' : page(cle).titre);
const teinteGuide = (cle: GuideCle) => (cle === 'annuaire' ? C.accent : teinteDe(page(cle).chemin));

/** Le « ? » du titre de chaque page : ouvre l'aide de la page où l'on est. Absent des pages sans guide et hors compte connecté. */
/** Garde l'état d'aide à jour : le « ? » n'existe que pour un compte connecté. */
export function ActiverAide({ actif }: { actif: boolean }) {
  useEffect(() => {
    aide.activer(actif);
  }, [actif]);
  return null;
}

/**
 * L'assistant d'aide : la liste de tout ce qu'on peut faire sur la page (avec une recherche), et une question libre à l'IA
 * qui répond d'après ce même guide. Choisir une action ferme la fenêtre et lance le pas à pas, par-dessus la page.
 */
export function GuideAssistant() {
  const { liste } = useAide();
  if (!liste) return null;
  return (
    <Dialogue titre={`Aide · ${titreDe(liste)}`} onFermer={aide.fermer} large>
      <Contenu cle={liste} />
    </Dialogue>
  );
}

function Contenu({ cle }: { cle: GuideCle }) {
  const { config, espace } = useStore();
  const g = GUIDE[cle];
  const [recherche, setRecherche] = useState('');
  const [question, setQuestion] = useState('');
  const [reponse, setReponse] = useState('');
  const [echec, setEchec] = useState('');
  const [busy, setBusy] = useState(false);
  const t = teinteGuide(cle);
  const actions = useMemo(() => chercherActions(cle, recherche), [cle, recherche]);
  const groupes = useMemo(() => {
    const m = new Map<string, ActionGuide[]>();
    for (const x of actions) m.set(x.groupe, [...(m.get(x.groupe) ?? []), x]);
    return [...m.entries()];
  }, [actions]);
  const ia = config.assistant.ia && iaDisponible();
  const dansLaVisite = (ORDRE_VISITE as readonly string[]).includes(cle);

  const demander = async () => {
    if (!question.trim()) return;
    setBusy(true);
    setReponse('');
    setEchec('');
    try {
      setReponse(await demanderIA('aide', { sujet: titreDe(cle), question: question.trim(), donnees: guideEnTexte(cle), ton: espace.audio.ton }));
    } catch (e) {
      setEchec(e instanceof ApiError && e.status === 400 ? 'Le serveur doit être mis à jour pour répondre aux questions. La liste ci-dessus reste disponible.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <T muted>{g.resume}</T>
      <Input label="Que veux-tu faire ?" value={recherche} onChangeText={setRecherche} placeholder="Ex. ajouter, filtrer, supprimer…" />
      {groupes.map(([groupe, items]) => (
        <View key={groupe} style={{ gap: 2 }}>
          <T small muted>{groupe}</T>
          {items.map((x) => (
            <Pressable
              key={x.cle}
              accessibilityRole="button"
              accessibilityLabel={`${x.titre} : voir les étapes`}
              onPress={() => aide.commencer(cle, x.cle)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, backgroundColor: pressed ? alpha(t, 0.14) : alpha(C.ink, 0.04) })}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>{x.titre}</Text>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{`${x.pas.length} étape${x.pas.length > 1 ? 's' : ''}`}</Text>
              </View>
              <Text style={{ color: t, fontSize: 17 }}>›</Text>
            </Pressable>
          ))}
        </View>
      ))}
      {!actions.length ? <T muted>Rien ne correspond. Essaie un autre mot, ou pose ta question plus bas.</T> : null}

      {ia ? (
        <View style={{ gap: 8, paddingTop: 4 }}>
          <Input label="Une autre question sur cette page ?" value={question} onChangeText={setQuestion} placeholder="Ex. Comment retrouver une relance déjà traitée ?" onSubmitEditing={demander} returnKeyType="send" />
          <View style={{ flexDirection: 'row' }}>
            <Btn small label={busy ? 'Je cherche…' : 'Demander'} onPress={demander} disabled={busy || !question.trim()} couleur={t} />
          </View>
          {reponse ? (
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: alpha(t, 0.1), borderWidth: 1, borderColor: alpha(t, 0.35) }}>
              <T>{reponse}</T>
            </View>
          ) : null}
          {echec ? <T small style={{ color: C.agressif }}>{echec}</T> : null}
        </View>
      ) : null}

      {dansLaVisite && cle !== 'annuaire' ? (
        <View style={{ flexDirection: 'row' }}>
          <Btn
            small
            kind="sec"
            label="Visite de cette page"
            onPress={() => {
              aide.fermer();
              visite.demarrer(cle);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Le pas à pas d'une action : une carte posée par-dessus la page (au-dessus de la barre d'onglets sur téléphone, en bas à droite
 * sur ordinateur), qui laisse la page utilisable pendant qu'on suit les étapes.
 */
export function GuidePasAPas() {
  const { pas } = useAide();
  const { bureau, haut } = useBarreOnglets();
  if (!pas) return null;
  const x = GUIDE[pas.cle].actions.find((y) => y.cle === pas.action);
  if (!x) return null;
  const n = x.pas.length;
  const i = Math.min(pas.i, n - 1);
  const derniere = i >= n - 1;
  const t = teinteGuide(pas.cle);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 39, justifyContent: 'flex-end', alignItems: bureau ? 'flex-end' : 'stretch', padding: bureau ? 24 : 12, paddingBottom: bureau ? 24 : haut + 10 }}>
      <View accessibilityRole="alert" accessibilityLabel={`${x.titre}, étape ${i + 1} sur ${n} : ${x.pas[i]}`} style={{ width: bureau ? 380 : undefined, gap: 10, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: alpha(t, 0.55), backgroundColor: C.surface, ...ombre() }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(t, 0.16) }}>
            <Icone nom="eclair" color={t} size={16} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.titreM, fontSize: 15 }}>{x.titre}</Text>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{`Étape ${i + 1} sur ${n}`}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer l’aide" hitSlop={10} onPress={aide.arreter}>
            <Text style={{ color: C.muted, fontSize: 17 }}>✕</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {x.pas.map((_, k) => (
            <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k <= i ? t : C.line }} />
          ))}
        </View>
        <T>{x.pas[i]}</T>
        {derniere && x.astuce ? <T small muted>{`Astuce : ${x.astuce}`}</T> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable accessibilityRole="button" onPress={() => (aide.arreter(), aide.ouvrir(pas.cle))} hitSlop={8} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Autres actions</Text>
          </Pressable>
          {i > 0 ? <Btn small kind="sec" couleur={t} label="Retour" onPress={() => aide.aller(i - 1)} /> : null}
          <Btn small couleur={t} label={derniere ? 'Terminé' : 'Suivant'} onPress={derniere ? aide.arreter : () => aide.aller(i + 1)} />
        </View>
      </View>
    </View>
  );
}
