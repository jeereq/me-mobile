import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/texte';
import { EviteClavier, useClavier } from '@/components/clavier';

import { useActions, useAjoutPhrase } from '@/lib/actions';
import { briefing, chercherMailsVoix, demanderIA, iaDisponible, parler, preparerPlan, resumeDonnees, resumerMailsVoix, taire } from '@/lib/assistant';
import { direMailsDe } from '@/lib/mails-voix';
import { comprendre, confirmerAjout } from '@/lib/commande';
import { choisirAlternative } from '@/lib/dictee';
import { fmtCourt, today } from '@/lib/dates';
import { ecouteDisponible, ecouter, signalerVoixOuverte, surVoix, type Ecoute } from '@/lib/ecoute';
import { financesDe } from '@/lib/finances';
import { LARGEUR_DIALOGUE, useZonesSures } from '@/lib/mise-en-page';
import { sigle, useNomApp } from '@/lib/nom';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { teinteCopilote } from './copilote';
import { Icone } from './icones';
import { Ondes } from './ondes';
import { Btn, IconBtn, Input, tap } from './ui';

const EXEMPLES = [
  'Planifie ma journée',
  'Ajoute une dépense de 12 € de courses',
  'Combien il me reste ce mois-ci ?',
  "Rappelle-moi d'appeler Paul demain",
  'Reporte le devis à lundi',
  "Qu'est-ce que j'ai demain ?",
  "J'ai reçu 1 500 € de salaire",
  'Vire 200 € du compte courant vers le livret',
  'Mets 100 € de côté pour le voyage',
  'Lis mes mails',
  'Résume mes mails avec Paul',
  'Crée une relance pour le mail de Paul',
  'Relance Paul par mail',
  "J'ai fini le devis",
  'Aide',
];

type Etat = 'pret' | 'ecoute' | 'reflechit';

/**
 * Commande vocale, façon Siri : on touche le micro (ou on ouvre me://voix), on parle, l'app agit et répond à voix haute.
 * Ajouter, reporter, supprimer, consulter un budget, un compte ou un objectif, noter un revenu ou un virement, ouvrir un écran,
 * cocher une tâche, noter au journal, lire et écrire ses mails, créer une relance depuis un mail ;
 * « Annule » défait le dernier ajout. Un mail dicté s'ouvre en brouillon : il ne part qu'après confirmation à l'écran.
 * Sans micro utilisable, la même commande se tape.
 */
export function Voix() {
  const { espace, config, profil, mails, update, pro, session, externes } = useStore();
  const nomApp = useNomApp();
  const { basculerTache, basculerHabitude, statutRelance, noter } = useActions();
  const ajoutPhrase = useAjoutPhrase();
  const [ouverte, setOuverte] = useState(false);
  const [etat, setEtat] = useState<Etat>('pret');
  const [entendu, setEntendu] = useState('');
  const [reponse, setReponse] = useState('');
  const [erreur, setErreur] = useState('');
  const [volume, setVolume] = useState(0);
  // L'app parle (synthèse vocale) : les ondes passent à sa voix ; `mot` compte les mots prononcés pour les animer.
  const [parle, setParle] = useState(false);
  const [mot, setMot] = useState(0);
  const [tape, setTape] = useState('');
  const [annulable, setAnnulable] = useState<(() => void) | null>(null);
  // Le bouton « Annuler » ne suit que la réponse à un ajout ou à une case cochée ; « Annule » à la voix marche toujours.
  const [proposerAnnuler, setProposerAnnuler] = useState(false);
  const ecoute = useRef<Ecoute | null>(null);
  // Dernier texte entendu, et s'il a déjà été traité : sur iOS le résultat final peut arriver avec la fin de l'écoute.
  const dernier = useRef<{ texte: string; traite: boolean; variantes: string[] }>({ texte: '', traite: false, variantes: [] });
  const micro = ecouteDisponible();

  // Les fonctions lisent l'espace à jour : la fenêtre reste montée et les rappels du micro arrivent plus tard.
  const executerRef = useRef<(texte: string, vocal: boolean) => void>(() => {});
  const espaceRef = useRef(espace);
  const mailsRef = useRef(mails);
  const configRef = useRef(config);

  const dire = (texte: string, vocal: boolean) => {
    setReponse(texte);
    if (vocal) parler(texte, espace.audio, { discret: true, onStart: () => setParle(true), onDone: () => setParle(false), onMot: () => setMot((x) => x + 1) });
  };

  const executer = async (texte: string, vocal: boolean) => {
    const d = today();
    const c = comprendre(texte, espace, d, mails, config);
    setEntendu(texte);
    setErreur('');
    setProposerAnnuler(c.type === 'ajout' || c.type === 'cocher' || c.type === 'changer' || c.type === 'statutRelance');
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
      case 'changer': {
        const { faire, defaire } = c;
        update(faire);
        setAnnulable(() => () => update(defaire));
        return dire(c.texte, vocal);
      }
      case 'statutRelance': {
        const r = c.relance;
        statutRelance(r, c.statut);
        // Annuler rend la relance telle qu'elle était (« Relancé » a aussi compté la relance et changé sa date).
        setAnnulable(() => () => (c.statut === 'relance' ? update((e) => ({ ...e, relances: e.relances.map((x) => (x.id === r.id ? r : x)) })) : statutRelance(r, r.statut)));
        return dire(c.statut === 'repondu' ? `Relance de ${r.contact} close : il a répondu.` : `C'est noté : ${r.contact} relancé, on attend sa réponse.`, vocal);
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
      // Le mail s'ouvre dans l'écran Mails : c'est lui qui lit le texte à voix haute, ou qui montre le brouillon à envoyer.
      case 'lireMail':
        setReponse(`J'ouvre le mail de ${c.mail.contact || 'ce contact'}.`);
        fermer();
        router.push({ pathname: '/messages', params: { lire: c.mail.id, ...(vocal ? { voix: '1' } : {}) } } as never);
        return;
      case 'repondreMail':
        dire(c.texte ? 'Voici ta réponse. Relis-la, puis envoie.' : `Que veux-tu répondre à ${c.mail.contact} ?`, vocal);
        fermer();
        router.push({ pathname: '/messages', params: { repondre: c.mail.id, ...(c.texte ? { texte: c.texte } : {}) } } as never);
        return;
      case 'ecrireMail':
        dire(c.a ? `Voici ton mail pour ${c.nom}. Relis-le, puis envoie.` : `Je n'ai pas l'adresse de ${c.nom} : complète-la, puis envoie.`, vocal);
        fermer();
        router.push({ pathname: '/messages', params: { ecrire: '1', nom: c.nom, ...(c.a ? { a: c.a } : {}), ...(c.sujet ? { sujet: c.sujet } : {}), ...(c.texte ? { texte: c.texte } : {}) } } as never);
        return;
      // « Lis mes mails concernant Joseph et fais-moi un résumé » : on cherche ses mails partout, puis on les dit ou on les résume.
      case 'mailsDe': {
        setEtat('reflechit');
        setReponse('');
        const comptes = externes.filter((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft');
        let trouves = c.mails;
        try {
          trouves = await chercherMailsVoix(c.mails, c.recherche, comptes, session?.token);
          if (!trouves.length) return dire(comptes.length ? `Je ne trouve aucun mail concernant ${c.nom}.` : `Je ne trouve aucun mail concernant ${c.nom}. Connecte Gmail ou Outlook dans Agendas & outils pour que je cherche dans toute ta boîte.`, vocal);
          if (!c.resume) return dire(direMailsDe(c.nom, trouves, d), vocal);
          // Le résumé est l'œuvre du copilote (Pro, IA connectée) ; sans lui, la liste dite reste un aperçu utile.
          if (!pro || !config.assistant.ia || !iaDisponible()) return dire(`${direMailsDe(c.nom, trouves, d)}${pro ? '' : ' Le résumé par le copilote fait partie de Pro.'}`, vocal);
          dire(await resumerMailsVoix(c.nom, trouves, espace, c.recherche), vocal);
        } catch (e) {
          dire(`${(e as Error).message} ${trouves.length ? direMailsDe(c.nom, trouves, d) : ''}`.trim(), vocal);
        } finally {
          setEtat('pret');
        }
        return;
      }
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
          dire(await demanderIA('question', { question: c.texte, ton: espace.audio.ton, donnees: resumeDonnees(espace, mails) }), vocal);
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
    dernier.current = { texte: '', traite: false, variantes: [] };
    tap();
    setEntendu('');
    setReponse('');
    setErreur('');
    setEtat('ecoute');
    const f = financesDe(espace);
    ecoute.current = await ecouter(
      {
        texte: (t, _final, variantes) => {
          dernier.current.texte = t;
          dernier.current.variantes = variantes;
          setEntendu(t);
        },
        volume: setVolume,
        fin: () => {
          ecoute.current = null;
          setVolume(0);
          setEtat((x) => (x === 'ecoute' ? 'pret' : x));
          const { texte, traite, variantes } = dernier.current;
          if (traite) return;
          if (texte.trim()) {
            dernier.current.traite = true;
            // Le micro hésite parfois sur un nom : on garde la première façon de comprendre qui est une vraie commande.
            executerRef.current(choisirAlternative([texte, ...variantes], (x) => !['question', 'rien'].includes(comprendre(x, espaceRef.current, today(), mailsRef.current, configRef.current).type)), true);
          } else setErreur((x) => x || 'Je n’ai rien entendu. Touche le micro et parle.');
        },
        erreur: (m) => {
          setErreur(m);
          setEtat('pret');
        },
      },
      // Les noms de l'espace aident la reconnaissance : budgets, contacts, habitudes.
      [...f.budgets.map((b) => b.nom), ...f.budgets.flatMap((b) => (b.plan ?? []).map((p) => p.nom)), ...(f.comptes ?? []).map((c) => c.nom), ...(f.objectifs ?? []).map((o) => o.nom), ...espace.contacts.map((c) => c.nom), ...espace.habitudes.map((h) => h.nom), ...new Set(mails.map((m) => m.contact).filter(Boolean))],
    );
    if (!ecoute.current) setEtat('pret');
  };

  const arreter = () => {
    tap();
    ecoute.current?.arreter();
  };
  // Annuler : rien n'est exécuté de ce qui vient d'être dit.
  const annulerEcoute = () => {
    dernier.current = { texte: '', traite: true, variantes: [] };
    ecoute.current?.annuler();
    setEntendu('');
    setEtat('pret');
    setVolume(0);
  };

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
    espaceRef.current = espace;
    mailsRef.current = mails;
    configRef.current = config;
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
          dernier.current = { texte: phrase, traite: true, variantes: [] };
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

  // Les ondes suivent ta voix pendant l'écoute (couleur d'accent), puis celle du copilote quand il répond (sa teinte).
  const copilote = teinteCopilote().c;
  const modeOndes = etat === 'ecoute' ? 'ecoute' : etat === 'reflechit' ? 'reflechit' : parle ? 'parle' : 'repos';
  const clavier = useClavier();
  const { width: largeurFenetre } = useWindowDimensions();
  const { haut, bas } = useZonesSures();
  // Grande au repos ; elle laisse la place au champ quand le clavier est ouvert.
  const tailleOndes = clavier ? 150 : Math.min(320, largeurFenetre * 0.82);
  const tailleCentre = Math.round(tailleOndes * 0.34);
  const titre = etat === 'ecoute' ? 'Je t’écoute… Prends ton temps.' : etat === 'reflechit' ? 'Je réfléchis…' : parle ? 'Je te réponds…' : reponse ? '' : 'Que puis-je faire ?';

  return (
    <Modal visible={ouverte} transparent animationType="slide" onRequestClose={fermer}>
      <EviteClavier style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: haut }}>
          <View style={{ alignItems: 'flex-end', padding: 12 }}>
            <IconBtn label="Fermer" glyph="✕" onPress={fermer} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 20 + bas, gap: 16, width: '100%', maxWidth: LARGEUR_DIALOGUE, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
            {/* La couronne d'abord, en grand, à la Jarvis : elle suit ta voix, puis celle de l'app. */}
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: clavier ? 0 : 12 }}>
              <Ondes mode={modeOndes} volume={volume} mot={mot} taille={tailleOndes} couleur={modeOndes === 'ecoute' ? C.accent : copilote} couleur2={modeOndes === 'ecoute' ? C.coach : C.accent}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={etat === 'ecoute' ? 'Arrêter l’écoute' : 'Parler'}
                  onPress={etat === 'ecoute' ? arreter : demarrer}
                  disabled={etat === 'reflechit' || !micro}
                  style={({ pressed }) => ({ width: tailleCentre, height: tailleCentre, borderRadius: tailleCentre / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: etat === 'ecoute' ? C.accent : C.sunk, borderWidth: 1, borderColor: etat === 'ecoute' ? C.accent : C.line, opacity: pressed ? 0.85 : 1 })}>
                  {etat === 'ecoute' ? (
                    <Text style={{ color: C.accentInk, fontSize: 24 }}>■</Text>
                  ) : (
                    // La marque de l'app (Me, ou le nom choisi) au centre de la couronne : c'est elle qui écoute et répond.
                    <View style={{ alignItems: 'center' }}>
                      <Text fixe style={{ color: parle || etat === 'reflechit' ? copilote : C.ink, fontFamily: F.titre, fontSize: nomApp.length <= 3 ? 28 : 22, letterSpacing: -0.5, lineHeight: 32 }}>{nomApp.length <= 3 ? nomApp : sigle(nomApp)}</Text>
                      {micro ? <Icone nom="micro" color={C.muted} size={15} /> : null}
                    </View>
                  )}
                </Pressable>
              </Ondes>
            </View>

            <View accessibilityLiveRegion="polite" style={{ gap: 10, minHeight: 64 }}>
              {titre ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 15, textAlign: 'center' }}>{titre}</Text> : null}
              {entendu ? <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 22, lineHeight: 28, textAlign: 'center' }}>« {entendu} »</Text> : null}
              {etat === 'ecoute' ? (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  <Btn small label={entendu ? 'J’ai fini' : 'Arrêter'} onPress={arreter} />
                  <Btn small kind="sec" label="Annuler" onPress={annulerEcoute} />
                </View>
              ) : null}
              {entendu && etat !== 'ecoute' ? (
                // Le micro a mal compris : on reprend la phrase au clavier, ou on la redit.
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setTape(entendu)}>
                    <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 14 }}>Corriger</Text>
                  </Pressable>
                  {micro ? (
                    <Pressable accessibilityRole="button" hitSlop={8} onPress={demarrer}>
                      <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 14 }}>Redire</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
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
              {erreur ? (
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14, textAlign: 'center' }}>{erreur}</Text>
                  {micro ? <Btn small kind="sec" label="Réessayer" onPress={demarrer} /> : null}
                </View>
              ) : null}
            </View>

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
      </EviteClavier>
    </Modal>
  );
}
