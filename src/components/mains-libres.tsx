import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/texte';
import { useReglagesAnalyse } from '@/lib/analyse-pref';
import { api } from '@/lib/api';
import { analyserMails, parler, taire } from '@/lib/assistant';
import { contexteCrm, refsDu } from '@/lib/contexte-mails';
import { demandeAnalyse, echeanceMail, lireAnalyses, MAX_MAILS_ANALYSE, prioriteMail } from '@/lib/copilote';
import { today, uid } from '@/lib/dates';
import { ecouteDisponible, ecouter, signalerVoixOuverte, type Ecoute } from '@/lib/ecoute';
import { refExterne } from '@/lib/externe';
import { langueTexte } from '@/lib/lecture';
import { lienDepuisMail } from '@/lib/liens-mail';
import { annonceMail, bilanMainsLibres, commandeConfirme, commandeMail, fileAnalysee, type CommandeConfirme, type CommandeMail, type ElementFile } from '@/lib/mains-libres';
import { lectureMail, resumePersonnes, type ChoixDest, type ContenuMail, type Destinataires, type Mail } from '@/lib/mails';
import { LARGEUR_DIALOGUE, useZonesSures } from '@/lib/mise-en-page';
import type { Rangement } from '@/lib/reprise-analyse';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import { estAutomatique } from '@/lib/tri-analyses';
import type { Tache } from '@/lib/types';
import { langueDictee } from '@/lib/voix-pref';

import { useCopiloteVisible } from './copilote';
import { lireDestinataires } from './destinataires';
import { Icone } from './icones';
import { Ondes } from './ondes';
import { Btn, IconBtn, T, tap } from './ui';

type Phase = 'charge' | 'annonce' | 'ecoute' | 'travail' | 'pause' | 'fin';
type Mode = 'mail' | 'confirmer' | 'dictee';

const MAX_SANS_IA = 20;

function Commande({ label, onPress, principal }: { label: string; onPress: () => void; principal?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => (tap(), onPress())} style={({ pressed }) => ({ flexGrow: 1, flexBasis: '30%', minHeight: 46, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: principal ? (pressed ? alpha(C.accent, 0.8) : C.accent) : pressed ? alpha(C.ink, 0.1) : C.sunk, borderWidth: principal ? 0 : 1, borderColor: C.line })}>
      <Text numberOfLines={1} style={{ color: principal ? C.accentInk : C.ink, fontFamily: F.texteF, fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Traiter ses mails sans regarder l'écran : l'app dit le plus urgent d'abord, puis écoute « réponds », « suivant », « archive », « stop ».
 * Une réponse est relue à voix haute et ne part qu'après un accord clair. Un silence met en pause : le micro ne reste jamais ouvert pour rien.
 * Tout se fait aussi avec les boutons. Les mails restent non lus tant qu'on n'a rien décidé.
 */
export function MainsLibres({ onFermer, onRange }: { onFermer: () => void; onRange?: (ids: string[], action: Rangement) => void }) {
  const { mails, espace, session, config, pro, update, marquerLu, retirerMails, synchroniser } = useStore();
  const copilote = useCopiloteVisible();
  const { reglages, pret } = useReglagesAnalyse();
  const { haut, bas } = useZonesSures();
  const { width } = useWindowDimensions();
  const token = session?.token;
  const avecIA = !!(pro && copilote);

  const [phase, setPhase] = useState<Phase>('charge');
  const [file, setFile] = useState<ElementFile[]>([]);
  const [rang, setRang] = useState(0);
  const [entendu, setEntendu] = useState('');
  const [dit, setDit] = useState('');
  const [msg, setMsg] = useState('');
  const [volume, setVolume] = useState(0);
  const [parle, setParle] = useState(false);
  const [mot, setMot] = useState(0);
  // La réponse en attente de confirmation : tant qu'elle est là, on est dans « Je l'envoie ? ».
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const [aQui, setAQui] = useState('');

  // Les rappels du micro et de la voix arrivent plus tard : ils lisent l'état ici, et `gen` écarte ceux d'une action dépassée.
  const gen = useRef(0);
  const ecoute = useRef<Ecoute | null>(null);
  const fileRef = useRef<ElementFile[]>([]);
  const rangRef = useRef(0);
  const brouillonRef = useRef<string | null>(null);
  // À qui part la réponse : tout le monde, sauf si on a dit « seulement à lui ».
  const seul = useRef(false);
  const personnes = useRef<Destinataires | null>(null);
  const rates = useRef(0);
  const dernierMode = useRef<Mode>('mail');
  const bilan = useRef({ envoyes: 0, archives: 0, lus: 0, taches: 0 });
  const lance = useRef(false);

  const poserBrouillon = (b: string | null) => {
    brouillonRef.current = b;
    setBrouillon(b);
  };
  const courant = () => fileRef.current[rangRef.current];

  /** Coupe la voix et le micro ; leurs rappels en attente ne feront plus rien. */
  const interrompre = () => {
    gen.current++;
    ecoute.current?.annuler();
    ecoute.current = null;
    taire();
    setParle(false);
    setVolume(0);
  };

  const dire = (texte: string, ensuite?: () => void, langue?: string) => {
    const g = gen.current;
    setDit(texte);
    parler(texte, espace.audio, {
      discret: true,
      langue,
      onStart: () => setParle(true),
      onMot: () => setMot((x) => x + 1),
      onDone: () => {
        setParle(false);
        if (g === gen.current) ensuite?.();
      },
    });
  };

  const mettreEnPause = (message = '') => {
    interrompre();
    setMsg(message);
    setPhase('pause');
  };

  const ecouterVoix = async (mode: Mode) => {
    dernierMode.current = mode;
    if (!ecouteDisponible()) return mettreEnPause();
    const g = ++gen.current;
    setPhase('ecoute');
    setEntendu('');
    setMsg('');
    // Un court temps pour que le micro n'entende pas la fin de la voix de l'app.
    await new Promise((r) => setTimeout(r, 250));
    if (g !== gen.current) return;
    let dernier = '';
    let probleme = '';
    const e = await ecouter(
      {
        texte: (t) => {
          dernier = t;
          setEntendu(t);
        },
        volume: setVolume,
        fin: () => {
          ecoute.current = null;
          setVolume(0);
          if (g !== gen.current) return;
          if (dernier.trim()) entendre(mode, dernier);
          else mettreEnPause(/autoris|coupée|micro ne|occupé|internet|langue/.test(probleme) ? probleme : '');
        },
        erreur: (m) => {
          probleme = m;
        },
      },
      fileRef.current.map((x) => x.mail.contact).filter(Boolean),
      mode === 'dictee' ? { langue: langueDictee(), silence: 2500, attente: 8000, ponctuation: true } : { silence: 1300, attente: 7000 },
    );
    if (g !== gen.current) return e?.annuler();
    ecoute.current = e;
    if (!e) mettreEnPause(probleme);
  };

  const entendre = (mode: Mode, t: string) => {
    if (mode === 'dictee') return proposer(t.trim());
    if (mode === 'confirmer') return agirConfirme(commandeConfirme(t));
    agirMail(commandeMail(t));
  };

  const annoncer = (i: number) => {
    interrompre();
    rangRef.current = i;
    setRang(i);
    poserBrouillon(null);
    seul.current = false;
    personnes.current = null;
    rates.current = 0;
    setEntendu('');
    setMsg('');
    if (i >= fileRef.current.length) return terminer();
    setPhase('annonce');
    dire(annonceMail(fileRef.current[i], i, fileRef.current.length), () => ecouterVoix('mail'));
  };

  const terminer = () => {
    interrompre();
    poserBrouillon(null);
    setPhase('fin');
    dire(bilanMainsLibres(bilan.current));
  };

  const nomDesDestinataires = () => {
    const d = personnes.current;
    if (!d) return courant()?.mail.contact || '';
    return resumePersonnes(seul.current ? d.a.slice(0, 1) : [...d.a, ...d.cc]);
  };
  const choixEnvoi = (): ChoixDest => (seul.current && personnes.current?.a[0] ? { a: [personnes.current.a[0].adresse], cc: [] } : null);
  const demanderAccord = () => {
    interrompre();
    const qui = nomDesDestinataires();
    setAQui(qui);
    setPhase('annonce');
    dire(qui ? `Je l’envoie à ${qui} ?` : 'Je l’envoie ?', () => ecouterVoix('confirmer'));
  };

  /** Lit la réponse puis demande l'accord : c'est la seule façon d'arriver à un envoi. */
  const proposer = (texte: string) => {
    interrompre();
    poserBrouillon(texte);
    rates.current = 0;
    setEntendu('');
    setPhase('travail');
    const g = gen.current;
    const m = courant()?.mail;
    (async () => {
      // On annonce qui recevra la réponse : si la liste ne se lit pas, l'expéditeur, sans bloquer.
      personnes.current = m && token ? await lireDestinataires(m, token).catch(() => null) : null;
      if (g !== gen.current) return;
      setAQui(nomDesDestinataires());
      setPhase('annonce');
      dire('Voici la réponse.', () => dire(texte, demanderAccord, langueTexte(texte)));
    })();
  };

  const trier = async (action: Rangement, m: Mail) => {
    const ref = refExterne(m.id);
    if (!ref || !token) return false;
    const r = await api<{ faits: string[]; echecs: { message: string }[] }>(`/integrations/${ref.compte}/mails/trier`, { method: 'POST', token, body: { action, mails: [ref.element] } });
    if (!r.faits.length) throw new Error(r.echecs[0]?.message || 'Ce mail n’a pas pu être traité.');
    marquerLu(m.id);
    if (action === 'archiver') retirerMails([m.id]);
    onRange?.([m.id], action);
    synchroniser(false, true).catch(() => {});
    return true;
  };

  /** Une action qui passe par le serveur : on coupe tout, on dit le résultat, et on passe au suivant si tout va bien. */
  const travailler = async (faire: () => Promise<string>) => {
    interrompre();
    setPhase('travail');
    const g = gen.current;
    try {
      const phrase = await faire();
      if (g !== gen.current) return;
      const suivant = rangRef.current + 1;
      setPhase('annonce');
      dire(phrase, () => annoncer(suivant));
    } catch (e) {
      if (g === gen.current) mettreEnPause((e as Error).message);
    }
  };

  const agirMail = (a: CommandeMail) => {
    const e = courant();
    if (!e) return;
    setEntendu('');
    switch (a.type) {
      case 'suivant':
        return annoncer(rangRef.current + 1);
      case 'repeter':
        return annoncer(rangRef.current);
      case 'stop':
        return terminer();
      case 'archiver':
        return void travailler(async () => {
          await trier('archiver', e.mail);
          bilan.current.archives++;
          return 'Archivé.';
        });
      case 'lu':
        return void travailler(async () => {
          await trier('lu', e.mail);
          bilan.current.lus++;
          return 'Marqué comme lu.';
        });
      case 'tache':
        return void travailler(async () => {
          const d = today();
          const t: Tache = { id: uid(), titre: e.analyse?.tache || `Répondre à ${e.mail.contact || 'ce mail'} : ${e.mail.sujet}`, source: e.mail.ctx, priorite: prioriteMail(e.analyse ?? { urgence: 'normale' }), echeance: e.analyse ? echeanceMail(e.analyse, d) : null, statut: 'en_attente', faitLe: null, mode: config.defauts.tache, creeLe: new Date().toISOString(), mail: lienDepuisMail(e.mail) };
          update((x) => ({ ...x, taches: [t, ...x.taches] }));
          bilan.current.taches++;
          await trier('lu', e.mail).catch(() => {});
          return 'Tâche ajoutée.';
        });
      case 'tout':
        return void lireEntier(e.mail);
      case 'repondre': {
        const texte = a.texte ?? e.analyse?.reponse?.trim();
        if (texte) return proposer(texte);
        interrompre();
        setPhase('annonce');
        return dire('Que veux-tu répondre ?', () => ecouterVoix('dictee'));
      }
      case 'inconnu':
        rates.current++;
        if (rates.current > 1) return mettreEnPause();
        interrompre();
        setPhase('annonce');
        return dire('Je n’ai pas compris. Dis réponds, suivant, archive ou stop.', () => ecouterVoix('mail'));
    }
  };

  const lireEntier = async (m: Mail) => {
    const ref = refExterne(m.id);
    if (!ref || !token) return;
    interrompre();
    setPhase('travail');
    const g = gen.current;
    try {
      const r = await api<{ mail: ContenuMail }>(`/integrations/${ref.compte}/mails/${encodeURIComponent(ref.element)}?lu=0`, { token });
      if (g !== gen.current) return;
      const l = lectureMail(r.mail);
      setPhase('annonce');
      dire(l.texte, () => ecouterVoix('mail'), l.langue);
    } catch (e) {
      if (g === gen.current) mettreEnPause((e as Error).message);
    }
  };

  const agirConfirme = (c: CommandeConfirme) => {
    const e = courant();
    const b = brouillonRef.current;
    if (!e || b === null) return;
    setEntendu('');
    switch (c) {
      case 'envoyer':
        return void travailler(async () => {
          const ref = refExterne(e.mail.id);
          if (!ref || !token) throw new Error('Ce mail ne vient pas d’un compte connecté.');
          await api(`/integrations/${ref.compte}/repondre`, { method: 'POST', token, body: { mail: ref.element, ...(e.mail.fil ? { fil: e.mail.fil } : {}), texte: b, ...(choixEnvoi() ?? {}) } });
          poserBrouillon(null);
          bilan.current.envoyes++;
          await trier('lu', e.mail).catch(() => {});
          return 'Réponse envoyée.';
        });
      case 'annuler':
        interrompre();
        poserBrouillon(null);
        setPhase('annonce');
        return dire('Je ne l’envoie pas. Dis suivant, ou réponds pour recommencer.', () => ecouterVoix('mail'));
      case 'modifier':
        interrompre();
        setPhase('annonce');
        return dire('Dis-moi ta réponse.', () => ecouterVoix('dictee'));
      case 'court':
      case 'formel':
      case 'decliner':
      case 'refaire':
        return void ajuster(c, b, e.mail);
      case 'seul':
        seul.current = true;
        return demanderAccord();
      case 'tous':
        seul.current = false;
        return demanderAccord();
      case 'stop':
        return terminer();
      case 'inconnu':
        // Dans le doute, rien ne part : une seconde incompréhension met en pause.
        rates.current++;
        if (rates.current > 1) return mettreEnPause();
        interrompre();
        setPhase('annonce');
        return dire('Dis oui pour l’envoyer, ou non.', () => ecouterVoix('confirmer'));
    }
  };

  const ajuster = async (action: 'court' | 'formel' | 'decliner' | 'refaire', reponse: string, m: Mail) => {
    if (!token || !avecIA) return mettreEnPause('Ajuster une réponse fait partie de Pro.');
    interrompre();
    setPhase('travail');
    const g = gen.current;
    try {
      const r = await api<{ reponse: string }>('/assistant/mails/ajuster', { method: 'POST', token, body: { mail: m.id, reponse, action, ton: espace.audio.ton } });
      if (g === gen.current) proposer(r.reponse);
    } catch (e) {
      if (g === gen.current) mettreEnPause((e as Error).message);
    }
  };

  /** Prépare la file : avec le copilote, les analyses (gardées 30 jours par le serveur) ; sans lui, les non lus, tels quels. */
  useEffect(() => {
    if (!pret || lance.current) return;
    lance.current = true;
    (async () => {
      const g = gen.current;
      const recent = (a: Mail, b: Mail) => `${b.date}${b.heure ?? ''}`.localeCompare(`${a.date}${a.heure ?? ''}`);
      const nonLus = mails.filter((m) => m.sens === 'recu' && m.nonLu && !estAutomatique(m)).sort(recent);
      let liste: ElementFile[] = nonLus.slice(0, MAX_SANS_IA).map((mail) => ({ mail }));
      if (avecIA && nonLus.length) {
        try {
          const paquet = nonLus.slice(0, MAX_MAILS_ANALYSE);
          const crm = contexteCrm(paquet, espace);
          const lues = await analyserMails(demandeAnalyse(paquet, { ton: espace.audio.ton, consignes: reglages.consignes, crm }));
          const analyses = lireAnalyses(lues.brut, paquet.map((m) => m.id), refsDu(crm));
          if (analyses.length) liste = fileAnalysee(analyses, (id) => paquet.find((m) => m.id === id));
        } catch {
          // L'analyse a échoué : les mails se liront tels quels.
        }
      }
      if (g !== gen.current) return;
      fileRef.current = liste;
      setFile(liste);
      if (!liste.length) {
        setPhase('fin');
        return dire('Rien d’important à traiter. Tu es à jour.');
      }
      annoncer(0);
    })();
    // Une seule préparation à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pret]);

  // Le mot-clé se tait pendant ce temps : il entendrait la voix de l'app.
  useEffect(() => {
    signalerVoixOuverte(true);
    return () => {
      signalerVoixOuverte(false);
      gen.current++;
      ecoute.current?.annuler();
      taire();
    };
  }, []);

  const fermer = () => {
    interrompre();
    onFermer();
  };

  const e = file[rang];
  const ecouteEnCours = phase === 'ecoute';
  const taille = Math.min(240, width * 0.62);
  const centre = Math.round(taille * 0.36);
  const titre = phase === 'charge' ? 'Je prépare tes mails…' : phase === 'travail' ? 'Un instant…' : phase === 'pause' ? 'En pause' : phase === 'fin' ? 'Terminé' : ecouteEnCours ? 'Je t’écoute…' : brouillon !== null ? 'Ta réponse' : '';

  const toucherCentre = () => {
    tap();
    if (ecouteEnCours) return ecoute.current?.arreter();
    if (phase === 'pause') return void ecouterVoix(dernierMode.current);
    if (phase === 'annonce') return mettreEnPause();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={fermer}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: haut }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 }}>
          <Text style={{ flex: 1, color: C.muted, fontFamily: F.texteM, fontSize: 13.5 }}>{file.length > 1 && phase !== 'fin' ? `Mail ${Math.min(rang + 1, file.length)} sur ${file.length}` : ''}</Text>
          <IconBtn label="Fermer" glyph="✕" onPress={fermer} />
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, gap: 14, paddingHorizontal: 20, paddingBottom: 12, width: '100%', maxWidth: LARGEUR_DIALOGUE, alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: taille, height: taille, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute' }}>
                <Ondes mode={ecouteEnCours ? 'ecoute' : phase === 'charge' || phase === 'travail' ? 'reflechit' : parle ? 'parle' : 'repos'} volume={volume} mot={mot} taille={taille} couleur={C.accent} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={ecouteEnCours ? 'J’ai fini de parler' : phase === 'pause' ? 'Reprendre l’écoute' : 'Mettre en pause'}
                disabled={phase === 'charge' || phase === 'travail' || phase === 'fin'}
                onPress={toucherCentre}
                style={({ pressed }) => ({ width: centre, height: centre, borderRadius: centre / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, opacity: pressed ? 0.8 : phase === 'fin' ? 0.5 : 1 })}>
                <Icone nom={ecouteEnCours ? 'stop' : phase === 'pause' ? 'micro' : 'pause'} color={C.accentInk} size={Math.round(centre * 0.38)} />
              </Pressable>
            </View>
            {titre ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 15 }}>{titre}</Text> : null}
            {phase === 'pause' && ecouteDisponible() ? <T small muted>Touche le micro pour reprendre.</T> : null}
          </View>

          {e && phase !== 'fin' ? (
            <View accessibilityLiveRegion="polite" style={{ gap: 4 }}>
              <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.titre, fontSize: 19, lineHeight: 25 }}>
                {e.mail.contact || 'Sans expéditeur'}
              </Text>
              <Text numberOfLines={2} style={{ color: C.muted, fontFamily: F.texte, fontSize: 14 }}>
                {e.mail.sujet}
              </Text>
              {e.analyse?.urgence === 'haute' ? <Text style={{ color: C.agressif, fontFamily: F.texteF, fontSize: 13 }}>Urgent</Text> : null}
              {e.analyse?.resume ? <Text style={{ color: C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 21, marginTop: 4 }}>{e.analyse.resume}</Text> : null}
            </View>
          ) : null}
          {phase === 'fin' && dit ? <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 19, lineHeight: 26, textAlign: 'center' }}>{dit}</Text> : null}
          {brouillon !== null ? (
            <View style={{ padding: 12, borderRadius: 14, backgroundColor: alpha(C.accent, 0.1) }}>
              {aQui ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13, marginBottom: 6 }}>À : {aQui}</Text> : null}
              <Text selectable style={{ color: C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 22 }}>{brouillon}</Text>
            </View>
          ) : null}
          {entendu ? <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 18, lineHeight: 24, textAlign: 'center' }}>« {entendu} »</Text> : null}
          {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, paddingBottom: 12 + bas, width: '100%', maxWidth: LARGEUR_DIALOGUE, alignSelf: 'center' }}>
          {phase === 'fin' ? (
            <View style={{ flex: 1 }}>
              <Btn label="Fermer" onPress={fermer} />
            </View>
          ) : phase === 'charge' || !e ? null : brouillon !== null ? (
            <>
              <Commande principal label="Envoyer" onPress={() => agirConfirme('envoyer')} />
              <Commande label="Modifier" onPress={() => agirConfirme('modifier')} />
              <Commande label="Annuler" onPress={() => agirConfirme('annuler')} />
              <Commande label="À l’expéditeur" onPress={() => agirConfirme('seul')} />
              <Commande label="À tous" onPress={() => agirConfirme('tous')} />
              {avecIA ? <Commande label="Plus court" onPress={() => agirConfirme('court')} /> : null}
              {avecIA ? <Commande label="Plus formel" onPress={() => agirConfirme('formel')} /> : null}
            </>
          ) : (
            <>
              <Commande principal label="Répondre" onPress={() => agirMail({ type: 'repondre' })} />
              <Commande label="Suivant" onPress={() => agirMail({ type: 'suivant' })} />
              <Commande label="Archiver" onPress={() => agirMail({ type: 'archiver' })} />
              <Commande label="Marquer lu" onPress={() => agirMail({ type: 'lu' })} />
              <Commande label="Tâche" onPress={() => agirMail({ type: 'tache' })} />
              <Commande label="Lire tout" onPress={() => agirMail({ type: 'tout' })} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
