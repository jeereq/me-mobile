import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { useActions, useAjoutPhrase } from '@/lib/actions';
import { briefing, demanderIA, iaDisponible, parler, preparerPlan, resumeDonnees, taire } from '@/lib/assistant';
import { comprendre, confirmerAjout } from '@/lib/commande';
import { fmtCourt, today } from '@/lib/dates';
import { ecouteDisponible, ecouter, signalerVoixOuverte, surVoix, type Ecoute } from '@/lib/ecoute';
import { financesDe } from '@/lib/finances';
import { LARGEUR_DIALOGUE } from '@/lib/mise-en-page';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { Icone } from './icones';
import { Input } from './ui';

const EXEMPLES = ['Planifie ma journée', 'Ajoute une dépense de 12 € de courses', 'Combien il me reste ce mois-ci ?', "Rappelle-moi d'appeler Paul demain", 'Ouvre les finances', "J'ai fini le devis"];

type Etat = 'pret' | 'ecoute' | 'reflechit';

/**
 * Commande vocale, façon Siri : on touche le micro (ou on ouvre me://voix), on parle, l'app agit et répond à voix haute.
 * Ajouter, consulter un budget, ouvrir un écran, cocher une tâche, noter au journal ; « Annule » défait le dernier ajout.
 * Sans micro utilisable, la même commande se tape.
 */
export function Voix() {
  const { espace, config, profil } = useStore();
  const { basculerTache, basculerHabitude, statutRelance, noter } = useActions();
  const ajoutPhrase = useAjoutPhrase();
  const [ouverte, setOuverte] = useState(false);
  const [etat, setEtat] = useState<Etat>('pret');
  const [entendu, setEntendu] = useState('');
  const [reponse, setReponse] = useState('');
  const [erreur, setErreur] = useState('');
  const [volume, setVolume] = useState(0);
  const [tape, setTape] = useState('');
  const [annulable, setAnnulable] = useState<(() => void) | null>(null);
  // Le bouton « Annuler » ne suit que la réponse à un ajout ou à une case cochée ; « Annule » à la voix marche toujours.
  const [proposerAnnuler, setProposerAnnuler] = useState(false);
  const ecoute = useRef<Ecoute | null>(null);
  // Dernier texte entendu, et s'il a déjà été traité : sur iOS le résultat final peut arriver avec la fin de l'écoute.
  const dernier = useRef({ texte: '', traite: false });
  const micro = ecouteDisponible();

  // Les fonctions lisent l'espace à jour : la fenêtre reste montée et les rappels du micro arrivent plus tard.
  const executerRef = useRef<(texte: string, vocal: boolean) => void>(() => {});

  const dire = (texte: string, vocal: boolean) => {
    setReponse(texte);
    if (vocal) parler(texte, espace.audio);
  };

  const executer = async (texte: string, vocal: boolean) => {
    const d = today();
    const c = comprendre(texte, espace, d);
    setEntendu(texte);
    setErreur('');
    setProposerAnnuler(c.type === 'ajout' || c.type === 'cocher');
    switch (c.type) {
      case 'ajout': {
        const annuler = ajoutPhrase(c.phrase);
        if (!annuler) return dire('Je ne connais pas le taux de cette devise. Renseigne-le dans Finances.', vocal);
        setAnnulable(() => annuler);
        return dire(confirmerAjout(c.phrase, financesDe(espace).devise, d, fmtCourt), vocal);
      }
      case 'cocher': {
        const x = c.cible;
        if (x.genre === 'tache') basculerTache(x.item);
        else if (x.genre === 'habitude') basculerHabitude(x.item);
        else statutRelance(x.item, 'repondu');
        setAnnulable(() => () => (x.genre === 'tache' ? basculerTache(x.item) : x.genre === 'habitude' ? basculerHabitude(x.item) : statutRelance(x.item, x.item.statut)));
        return dire(x.genre === 'relance' ? `Relance de ${x.item.contact} marquée comme répondue.` : `C'est coché : ${x.genre === 'tache' ? x.item.titre : x.item.nom}.`, vocal);
      }
      case 'journal':
        noter(c.texte);
        return dire('Noté dans ton journal.', vocal);
      case 'aller':
        dire(`J'ouvre ${c.titre}.`, vocal);
        fermer();
        router.push(c.href as Href);
        return;
      case 'reponse':
        return dire(c.texte, vocal);
      case 'briefing':
        return dire(briefing(espace, (profil?.nom || '').split(' ')[0]), vocal);
      case 'plan':
        if (!config.assistant.ia || !iaDisponible()) return dire("Le plan de ta journée demande l'IA : connecte-la d'abord. En attendant, dis « Mon briefing » pour entendre ta journée.", vocal);
        setEtat('reflechit');
        setReponse('');
        try {
          dire(await preparerPlan(espace, d), vocal);
        } catch (e) {
          dire((e as Error).message, false);
        } finally {
          setEtat('pret');
        }
        return;
      case 'annuler':
        if (!annulable) return dire("Il n'y a rien à annuler.", vocal);
        annulable();
        setAnnulable(null);
        return dire("C'est annulé.", vocal);
      case 'question':
        if (!config.assistant.ia || !iaDisponible()) return dire('Je ne sais pas encore répondre à ça. Essaie « Combien il me reste ce mois-ci ? » ou « Ajoute une tâche… ».', vocal);
        setEtat('reflechit');
        setReponse('');
        try {
          dire(await demanderIA('question', { question: c.texte, ton: espace.audio.ton, donnees: resumeDonnees(espace) }), vocal);
        } catch (e) {
          dire((e as Error).message, false);
        } finally {
          setEtat('pret');
        }
        return;
      case 'rien':
        return;
    }
  };

  const demarrer = async () => {
    taire();
    ecoute.current?.annuler();
    dernier.current = { texte: '', traite: false };
    setEntendu('');
    setReponse('');
    setErreur('');
    setEtat('ecoute');
    const f = financesDe(espace);
    ecoute.current = await ecouter(
      {
        texte: (t, final) => {
          dernier.current.texte = t;
          setEntendu(t);
          if (final && t.trim() && !dernier.current.traite) {
            dernier.current.traite = true;
            executerRef.current(t, true);
          }
        },
        volume: setVolume,
        fin: () => {
          ecoute.current = null;
          setVolume(0);
          setEtat((x) => (x === 'ecoute' ? 'pret' : x));
          const { texte, traite } = dernier.current;
          if (texte.trim() && !traite) {
            dernier.current.traite = true;
            executerRef.current(texte, true);
          }
        },
        erreur: (m) => {
          setErreur(m);
          setEtat('pret');
        },
      },
      // Les noms de l'espace aident la reconnaissance : budgets, contacts, habitudes.
      [...f.budgets.map((b) => b.nom), ...espace.contacts.map((c) => c.nom), ...espace.habitudes.map((h) => h.nom)],
    );
    if (!ecoute.current) setEtat('pret');
  };

  const arreter = () => ecoute.current?.arreter();

  function fermer() {
    ecoute.current?.annuler();
    ecoute.current = null;
    setOuverte(false);
    setEtat('pret');
    setVolume(0);
  }

  const demarrerRef = useRef(demarrer);
  useEffect(() => {
    executerRef.current = executer;
    demarrerRef.current = demarrer;
  });
  // Le mot-clé se tait tant que la fenêtre est ouverte : il entendrait la voix de l'app.
  useEffect(() => {
    signalerVoixOuverte(ouverte);
    return () => signalerVoixOuverte(false);
  }, [ouverte]);
  useEffect(
    () =>
      surVoix((phrase) => {
        setOuverte(true);
        setEntendu('');
        setReponse('');
        setErreur('');
        setTape('');
        // Une phrase déjà prononcée après le mot-clé (« Hey Me, ouvre les finances ») s'exécute sans réécouter.
        if (phrase) {
          dernier.current = { texte: phrase, traite: true };
          ecoute.current?.annuler();
          taire();
          executerRef.current(phrase, true);
        } else if (ecouteDisponible()) demarrerRef.current();
      }),
    [],
  );

  const envoyer = () => {
    const t = tape.trim();
    if (!t) return;
    // Une demande tapée remplace l'écoute en cours (et ce qu'elle avait entendu).
    dernier.current.traite = true;
    ecoute.current?.annuler();
    setTape('');
    executer(t, false);
  };

  // L'anneau autour du micro suit la voix : de -2 (silence) à 10 (fort).
  const anneau = etat === 'ecoute' ? 1 + Math.max(0, Math.min(10, volume)) / 25 : 1;
  const titre = etat === 'ecoute' ? 'Je t’écoute…' : etat === 'reflechit' ? 'Je réfléchis…' : reponse ? '' : 'Que puis-je faire ?';

  return (
    <Modal visible={ouverte} transparent animationType="slide" onRequestClose={fermer}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={fermer} accessibilityLabel="Fermer" />
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: C.line, maxHeight: '88%', width: '100%', maxWidth: LARGEUR_DIALOGUE, alignSelf: 'center' }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line }} />

            <View accessibilityLiveRegion="polite" style={{ gap: 10, minHeight: 64 }}>
              {titre ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 15 }}>{titre}</Text> : null}
              {entendu ? <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 22, lineHeight: 28 }}>« {entendu} »</Text> : null}
              {etat === 'reflechit' ? <ActivityIndicator color={C.accent} style={{ alignSelf: 'flex-start' }} /> : null}
              {reponse ? (
                <View style={{ backgroundColor: alpha(C.accent, 0.1), borderRadius: 14, padding: 14, gap: 10 }}>
                  <Text style={{ color: C.ink, fontFamily: F.texte, fontSize: 16, lineHeight: 22 }}>{reponse}</Text>
                  {annulable && proposerAnnuler ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => executer('annule', false)}
                      style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.7 : 1 })}>
                      <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 14 }}>Annuler</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {erreur ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text> : null}
            </View>

            {micro ? (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
                  {etat === 'ecoute' ? <View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: alpha(C.accent, 0.18), transform: [{ scale: anneau }] }} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={etat === 'ecoute' ? 'Arrêter l’écoute' : 'Parler'}
                    onPress={etat === 'ecoute' ? arreter : demarrer}
                    disabled={etat === 'reflechit'}
                    style={({ pressed }) => ({ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: etat === 'ecoute' ? C.accent : C.sunk, borderWidth: 1, borderColor: etat === 'ecoute' ? C.accent : C.line, opacity: pressed ? 0.85 : 1 })}>
                    {etat === 'ecoute' ? <Text style={{ color: C.accentInk, fontSize: 20 }}>■</Text> : <Icone nom="micro" color={C.ink} size={30} />}
                  </Pressable>
                </View>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{etat === 'ecoute' ? 'Touche pour arrêter' : 'Touche pour parler'}</Text>
              </View>
            ) : null}

            <Input
              value={tape}
              onChangeText={setTape}
              placeholder={micro ? 'Ou écris ta demande' : 'Écris ta demande, ex. Ouvre les finances'}
              returnKeyType="send"
              onSubmitEditing={envoyer}
              accessibilityLabel="Ta demande, par écrit"
            />

            {!entendu && !reponse ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>Par exemple :</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {EXEMPLES.map((x) => (
                    <Pressable key={x} accessibilityRole="button" onPress={() => setTape(x)} style={({ pressed }) => ({ borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
                      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{x}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
