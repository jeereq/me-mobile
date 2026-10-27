import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Switch, Text, View } from 'react-native';

import { Puce } from '@/components/finances-plus';
import { Input, Panel, T } from '@/components/ui';
import { ecouteDisponible, ecouterMotCle, microLibre, ouvrirVoix, surEtatMicro, type Ecoute } from '@/lib/ecoute';
import { useZonesSures } from '@/lib/mise-en-page';
import { detecter, erreurMot, MOT_PAR_DEFAUT, MOTS_PROPOSES } from '@/lib/mot-cle';
import { useMotCle } from '@/lib/mot-cle-pref';
import { alpha, C, F } from '@/lib/theme';

/** Délai avant de relancer l'écoute quand le système l'arrête : assez court pour ne rien rater, assez long pour ne pas tourner à vide. */
const RELANCE_MS = 700;
/** Après une série d'arrêts sans rien entendre, on espace les relances pour ne pas user la batterie. */
const RELANCE_LENTE_MS = 5000;
/** Après le mot-clé, on attend un instant la suite de la phrase (« Hey Me, ouvre les finances ») avant d'ouvrir la commande. */
const ATTENTE_SUITE_MS = 900;

/**
 * Écoute le mot-clé quand l'app est ouverte et au premier plan, si on l'a activé dans Mon compte. À l'écoute du mot, la commande
 * vocale s'ouvre (avec la phrase qui suit, s'il y en a une). Une petite pastille dit quand le micro est ouvert.
 * Rien n'est enregistré : le texte entendu ne sert qu'à chercher le mot et n'est pas conservé.
 */
export function EcouteMotCle() {
  const { motCle, pret, changer } = useMotCle();
  const [ecoute, setEcoute] = useState(false);
  const [premierPlan, setPremierPlan] = useState(AppState.currentState !== 'background');
  const [libre, setLibre] = useState(microLibre());
  const { haut } = useZonesSures();
  const actif = pret && motCle.actif && !erreurMot(motCle.mot) && ecouteDisponible() && premierPlan && libre;

  useEffect(() => {
    const a = AppState.addEventListener('change', (e) => setPremierPlan(e === 'active'));
    return () => a.remove();
  }, []);
  useEffect(() => surEtatMicro(() => setLibre(microLibre())), []);

  const mot = useRef(motCle.mot);
  mot.current = motCle.mot;

  useEffect(() => {
    if (!actif) {
      setEcoute(false);
      return;
    }
    let arrete = false;
    let courante: Ecoute | null = null;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    let attente: ReturnType<typeof setTimeout> | undefined;
    let vides = 0;
    let entendu = false;

    const declencher = (suite: string) => {
      if (arrete) return;
      // On rend le micro tout de suite : la commande vocale va l'utiliser.
      arrete = true;
      clearTimeout(attente);
      courante?.annuler();
      setEcoute(false);
      ouvrirVoix(suite || undefined);
    };

    const lancer = async () => {
      if (arrete) return;
      entendu = false;
      const e = await ecouterMotCle({
        texte: (t, final) => {
          if (arrete || !t.trim()) return;
          entendu = true;
          const r = detecter(t, mot.current);
          if (!r.trouve) return;
          clearTimeout(attente);
          if (final) declencher(r.suite);
          else attente = setTimeout(() => declencher(r.suite), ATTENTE_SUITE_MS);
        },
        fin: () => {
          courante = null;
          if (arrete) return;
          vides = entendu ? 0 : vides + 1;
          minuteur = setTimeout(lancer, vides >= 4 ? RELANCE_LENTE_MS : RELANCE_MS);
        },
        erreur: (_m, bloque) => {
          // Micro ou dictée refusés : on coupe le mot-clé plutôt que de réessayer sans fin.
          if (bloque) {
            arrete = true;
            setEcoute(false);
            changer({ actif: false });
          }
        },
      });
      courante = e;
      if (e && !arrete) setEcoute(true);
    };
    lancer();
    return () => {
      arrete = true;
      clearTimeout(minuteur);
      clearTimeout(attente);
      courante?.annuler();
      setEcoute(false);
    };
    // `changer` ne change pas d'identité utile : il lit toujours le réglage courant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif]);

  if (!ecoute) return null;
  return (
    <View pointerEvents="none" accessibilityLabel={`Le micro écoute le mot-clé ${motCle.mot}`} style={{ position: 'absolute', top: haut + 6, right: 10, zIndex: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: alpha(C.surface, 0.92), borderWidth: 1, borderColor: C.line }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.coach }} />
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 11 }}>« {motCle.mot} »</Text>
    </View>
  );
}

/** Le réglage du mot-clé, dans Mon compte › Préférences. */
export function PanneauMotCle() {
  const { motCle, changer } = useMotCle();
  const dispo = ecouteDisponible();
  const [saisie, setSaisie] = useState(motCle.mot);
  useEffect(() => setSaisie(motCle.mot), [motCle.mot]);
  const erreur = erreurMot(saisie);
  const propose = MOTS_PROPOSES.includes(motCle.mot);
  const web = Platform.OS === 'web';
  return (
    <Panel title="Mot-clé vocal">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T>Dire « {motCle.mot} » pour parler à l’app</T>
          <T small muted>
            {dispo ? `Quand l’app est ouverte, elle écoute le mot-clé et ouvre la commande vocale. Tu peux enchaîner : « ${motCle.mot}, ajoute une dépense de 12 euros de courses ».` : 'La dictée n’est pas disponible sur cet appareil ou dans cette version de l’app.'}
          </T>
        </View>
        <Switch
          value={motCle.actif && dispo}
          disabled={!dispo || !!erreurMot(motCle.mot)}
          onValueChange={(v) => changer({ actif: v })}
          trackColor={{ true: C.accent, false: C.line }}
          thumbColor={C.ink}
          accessibilityLabel="Mot-clé vocal sur cet appareil"
        />
      </View>
      <View style={{ gap: 8 }}>
        <T small muted>
          Le mot qui te réveille
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {MOTS_PROPOSES.map((m) => (
            <Puce key={m} label={m} on={motCle.mot === m} onPress={() => changer({ mot: m })} />
          ))}
          {!propose ? <Puce label={motCle.mot} on onPress={() => {}} /> : null}
        </View>
        <Input
          label="Ou ton propre mot"
          value={saisie}
          onChangeText={setSaisie}
          onEndEditing={() => !erreurMot(saisie) && changer({ mot: saisie.trim() })}
          onSubmitEditing={() => !erreurMot(saisie) && changer({ mot: saisie.trim() })}
          placeholder={MOT_PAR_DEFAUT}
          autoCapitalize="none"
          erreur={saisie.trim() && erreur ? erreur : undefined}
          aide="Deux ou trois syllabes se reconnaissent mieux qu’un mot court."
        />
      </View>
      <T small muted>
        Ce que ça implique : le micro reste ouvert tant que l’app est au premier plan (une pastille le montre), ce qui consomme un peu de batterie, et {web ? 'ton navigateur' : 'le service de dictée de ton téléphone (Apple ou Google)'} traite ce qu’il entend. Rien n’est enregistré par l’app : le texte sert seulement à repérer le mot. L’écoute se coupe en arrière-plan, et pendant la commande vocale. Ce réglage reste sur cet appareil.
      </T>
      {Platform.OS === 'android' ? (
        <T small muted>
          Sur certains Android, le système fait un petit bruit chaque fois que l’écoute redémarre. Coupe-le avec le volume des notifications, ou désactive le mot-clé.
        </T>
      ) : null}
    </Panel>
  );
}
