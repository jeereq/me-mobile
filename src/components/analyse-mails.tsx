import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useActions } from '@/lib/actions';
import { enregistrerReglagesAnalyse, useReglagesAnalyse } from '@/lib/analyse-pref';
import { api } from '@/lib/api';
import { analyserMails, demanderIA } from '@/lib/assistant';
import { celebrer } from '@/lib/celebration';
import { contexteCrm, refsDu } from '@/lib/contexte-mails';
import { CATEGORIES_MAIL, demandeAnalyse, donneesSynthese, echeanceMail, lireAnalyses, lireLot, MAX_LOT, MAX_MAILS_ANALYSE, nettoyerConsignes, paquets, prioriteMail, type AnalyseLot, type AnalyseMail } from '@/lib/copilote';
import { fmtCourt, today, uid } from '@/lib/dates';
import { refExterne } from '@/lib/externe';
import { lienDepuisMail } from '@/lib/liens-mail';
import type { Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Tache } from '@/lib/types';

import { Case, PropositionsTaches, teinteCopilote } from './copilote';
import { CorpsMail } from './mail-ui';
import { ChampConsignes } from './reglages-analyse';
import { ReservePro } from './reserve-pro';
import { Bloc, ZoneSquelette } from './squelettes';
import { Btn, Dialogue, T } from './ui';

const URGENCE = { haute: { label: 'Urgent', c: () => C.agressif }, normale: { label: 'Normal', c: () => C.hebdo }, basse: { label: 'Peut attendre', c: () => C.muted } } as const;
const ACTION = { repondre: 'Attend une réponse', tache: 'Demande un travail', rien: 'Rien à faire' } as const;

type Etat = { envoi?: 'en_cours' | 'envoye' | 'erreur'; msg?: string };

/**
 * Le copilote analyse un mail ou plusieurs : pour chacun, ce que veut l'expéditeur, l'urgence et une réponse prête,
 * modifiable. Des non lus nombreux partent par paquets de 10, l'un après l'autre : les résultats s'affichent au fil de l'eau,
 * on peut arrêter, et après une erreur (la limite de l'IA par exemple) on reprend au paquet suivant sans refaire les premiers. Tout est coché au départ : « Envoyer les réponses » part pour tous les mails cochés (après confirmation),
 * « Créer les tâches » ajoute le travail demandé ; on décoche ce qu'on ne veut pas. « Modifier » ouvre la réponse complète.
 */
export function AnalyseMails({ mails: demandes, perimetre, consignes: consignesDonnees, onFermer, onModifier }: { mails: Mail[]; /** Un lot choisi (une personne, un domaine, un dossier…), en clair : le copilote en fait aussi la synthèse. */ perimetre?: string; /** Les consignes choisies avant l'analyse ; sans elles, celles gardées sur l'appareil. */ consignes?: string; onFermer: () => void; /** Ouvre la fenêtre « Répondre » avec le texte proposé. */ onModifier: (m: Mail, texte: string) => void }) {
  const { pro, session, espace, update, config } = useStore();
  const { statutRelance } = useActions();
  const t = teinteCopilote();
  const mails = useMemo(() => (perimetre ? demandes.slice(0, MAX_LOT) : demandes), [demandes, perimetre]);
  // Un paquet de 10 mails par demande à l'IA, chacun lu en entier. Pour un lot choisi, la synthèse d'ensemble vient ensuite,
  // à partir des analyses : les gros lots ne coupent plus le texte des mails.
  const lots = useMemo(() => paquets(mails, MAX_MAILS_ANALYSE), [mails]);
  const [suivant, setSuivant] = useState(0);
  // « Arrêter » laisse finir le paquet en cours (déjà demandé) et ne lance pas le suivant.
  const [arrete, setArreteEtat] = useState(false);
  const arreteRef = useRef(false);
  const setArrete = (v: boolean) => {
    arreteRef.current = v;
    setArreteEtat(v);
  };
  const [lot, setLot] = useState<Omit<AnalyseLot, 'analyses'> | null>(null);
  // La synthèse d'un lot, une fois tous les paquets analysés ; si elle échoue, l'analyse mail par mail reste.
  const [synthese, setSynthese] = useState<'attente' | 'en_cours' | 'faite' | 'erreur'>('attente');
  const [analyses, setAnalyses] = useState<AnalyseMail[] | null>(null);
  const [erreur, setErreur] = useState('');
  // Les mails que le serveur n'a pas pu relire (supprimés ou déplacés depuis) : sans analyse.
  const [introuvables, setIntrouvables] = useState(0);
  const [textes, setTextes] = useState<Record<string, string>>({});
  const [decoches, setDecoches] = useState<Set<string>>(new Set());
  const [etats, setEtats] = useState<Record<string, Etat>>({});
  const [confirmer, setConfirmer] = useState(false);
  const [taches, setTaches] = useState<string[]>([]);
  const [essai, setEssai] = useState(0);
  const token = session?.token;
  // Les consignes : saisies ici, sinon celles du choix des mails, sinon celles gardées sur l'appareil (relues en un instant).
  const { reglages, pret } = useReglagesAnalyse();
  const [saisies, setSaisies] = useState<string | null>(null);
  const [reglageOuvert, setReglageOuvert] = useState(false);
  const consignes = saisies ?? consignesDonnees ?? reglages.consignes;
  const prete = consignesDonnees !== undefined || pret;

  useEffect(() => {
    const paquet = lots[suivant];
    if (!pro || !token || !paquet?.length || !prete || arreteRef.current) return;
    let vivant = true;
    (async () => {
      try {
        // Ce que l'utilisateur suit déjà : l'IA reconnaît une relance obtenue, un projet, et ne repropose pas une tâche ouverte.
        const crm = contexteCrm(paquet, espace);
        // Le serveur lit les mails lui-même et garde les analyses 30 jours : un mail déjà analysé (ou préparé à l'avance) revient sans attente.
        const demande = demandeAnalyse(paquet, { ton: espace.audio.ton, consignes, crm });
        const lues = demande.mails.length ? await analyserMails(demande) : { brut: '', illisibles: [] as string[] };
        if (!vivant) return;
        const a = lireAnalyses(lues.brut, paquet.map((m) => m.id), refsDu(crm));
        // Un mail supprimé ou déplacé depuis n'a pas d'analyse : on le dit et on passe au suivant ; seul un paquet lisible mais resté vide est une erreur.
        const perdus = paquet.length - demande.mails.length + lues.illisibles.length;
        if (!a.length && perdus < paquet.length) throw new Error("Le copilote n'a pas pu lire ces mails. Réessaie dans un instant.");
        if (perdus) setIntrouvables((n) => n + perdus);
        // Les paquets s'ajoutent les uns aux autres : ce qui est déjà relu ou modifié reste tel quel.
        setAnalyses((x) => [...(x ?? []), ...a]);
        setTextes((x) => ({ ...Object.fromEntries(a.map((y) => [y.id, y.reponse])), ...x }));
        // Ce qui ne demande rien reste décoché.
        setDecoches((x) => new Set([...x, ...a.filter((y) => y.action === 'rien').map((y) => y.id)]));
        setSuivant((i) => i + 1);
      } catch (e) {
        if (vivant) setErreur((e as Error).message);
      }
    })();
    return () => {
      vivant = false;
    };
    // Un paquet après l'autre : à l'ouverture, puis après « Réessayer », « Reprendre » ou « Continuer ».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essai, prete, suivant]);

  // Tous les paquets d'un lot sont passés : le copilote fait la vue d'ensemble à partir de leurs analyses.
  useEffect(() => {
    if (!perimetre || !token || !analyses?.length || suivant < lots.length || synthese !== 'attente') return;
    let vivant = true;
    setSynthese('en_cours');
    (async () => {
      try {
        const avec = consignes.trim() ? { consignes: nettoyerConsignes(consignes) } : {};
        const contexte = { aujourdhui: today(), crm: contexteCrm(mails, espace) };
        const brut = await demanderIA('synthese', { ton: espace.audio.ton, perimetre, ...avec, donnees: donneesSynthese(mails, analyses, contexte) });
        if (!vivant) return;
        const r = lireLot(brut, [], today());
        if (!r.synthese && !r.points.length) throw new Error('vide');
        setLot({ synthese: r.synthese, points: r.points, actions: r.actions });
        setSynthese('faite');
      } catch {
        if (vivant) setSynthese('erreur');
      }
    })();
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suivant, analyses?.length, synthese, essai]);

  const titre = perimetre ? `Analyse de ${mails.length} mail${mails.length > 1 ? 's' : ''}` : mails.length > 1 ? `Analyse de ${mails.length} mails` : 'Analyse du mail';
  // Où en est l'analyse par paquets : combien de mails sont passés, et si la suite tourne encore.
  const passes = lots.slice(0, suivant).reduce((n, l) => n + l.length, 0);
  const reste = suivant < lots.length;
  const enMarche = reste && !arrete && !erreur;
  if (!pro)
    return (
      <Dialogue titre={titre} onFermer={onFermer}>
        <ReservePro fonction="assistant" />
      </Dialogue>
    );

  const parId = new Map(mails.map((m) => [m.id, m]));
  const coches = (analyses ?? []).filter((a) => !decoches.has(a.id));
  const aEnvoyer = coches.filter((a) => (textes[a.id] ?? '').trim() && etats[a.id]?.envoi !== 'envoye' && refExterne(a.id));
  const aCreer = coches.filter((a) => a.action !== 'rien' && !taches.includes(a.id));
  const toutCoche = !!analyses?.length && !decoches.size;
  const basculer = (id: string) => {
    setConfirmer(false);
    setDecoches((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const envoyer = async () => {
    if (!token) return;
    setConfirmer(false);
    // Une réponse après l'autre : une erreur sur un mail n'arrête pas les suivants.
    let ok = 0;
    for (const a of aEnvoyer) {
      const ref = refExterne(a.id)!;
      setEtats((e) => ({ ...e, [a.id]: { envoi: 'en_cours' } }));
      try {
        await api(`/integrations/${ref.compte}/repondre`, { method: 'POST', body: { mail: ref.element, texte: textes[a.id] }, token });
        ok++;
        setEtats((e) => ({ ...e, [a.id]: { envoi: 'envoye' } }));
      } catch (err) {
        setEtats((e) => ({ ...e, [a.id]: { envoi: 'erreur', msg: (err as Error).message } }));
      }
    }
    if (ok) celebrer({ type: 'message', emoji: '✉️', texte: ok > 1 ? `${ok} réponses envoyées` : 'Réponse envoyée' });
  };

  const creerTaches = () => {
    const d = today();
    const maintenant = new Date().toISOString();
    const nouvelles: Tache[] = aCreer.map((a) => {
      const m = parId.get(a.id)!;
      return { id: uid(), titre: a.tache || `Répondre à ${m.contact || 'ce mail'} : ${m.sujet}`, source: m.ctx, priorite: prioriteMail(a), echeance: echeanceMail(a, d), statut: 'en_attente', faitLe: null, mode: config.defauts.tache, creeLe: maintenant, mail: lienDepuisMail(m) };
    });
    if (!nouvelles.length) return;
    update((e) => ({ ...e, taches: [...nouvelles, ...e.taches] }));
    setTaches((x) => [...x, ...aCreer.map((a) => a.id)]);
    celebrer({ type: 'message', emoji: '✅', texte: nouvelles.length > 1 ? `${nouvelles.length} tâches ajoutées` : 'Tâche ajoutée' });
  };

  // Refaire l'analyse avec d'autres consignes : on garde les mêmes mails, on repart d'une page vide.
  const refaire = () => {
    enregistrerReglagesAnalyse({ consignes });
    setReglageOuvert(false);
    setConfirmer(false);
    setErreur('');
    setLot(null);
    setSynthese('attente');
    setAnalyses(null);
    setSuivant(0);
    setIntrouvables(0);
    setArrete(false);
    setDecoches(new Set());
    setEtats({});
    setTaches([]);
    setEssai((x) => x + 1);
  };

  const enCours = Object.values(etats).some((e) => e.envoi === 'en_cours');

  return (
    <Dialogue titre={titre} onFermer={onFermer} large>
      {!analyses && !erreur ? (
        <View style={{ gap: 12 }}>
          <T small muted>
            {perimetre ? `Le copilote lit ${perimetre}, en fait la synthèse et prépare les réponses. Les mails restent non lus.` : `Le copilote lit ${mails.length > 1 ? `tes ${mails.length} mails` : 'ce mail'} et prépare les réponses. Les mails restent non lus.`}
            {demandes.length > mails.length ? ` Les ${mails.length} premiers seulement : relance l'analyse pour les suivants.` : ''}
            {lots.length > 1 ? ` Ils partent par paquets de ${MAX_MAILS_ANALYSE} : les réponses s'affichent au fur et à mesure.` : ''}
          </T>
          <ZoneSquelette label="Analyse en cours">
            {mails.slice(0, 3).map((m) => (
              <Bloc key={m.id} h={96} r={14} />
            ))}
          </ZoneSquelette>
        </View>
      ) : null}
      {lots.length > 1 && (analyses || erreur) && reste ? (
        <Progression
          faits={passes}
          total={mails.length}
          enMarche={enMarche}
          onArreter={() => setArrete(true)}
          onContinuer={
            arrete && !erreur
              ? () => {
                  setArrete(false);
                  setEssai((x) => x + 1);
                }
              : undefined
          }
        />
      ) : null}
      {erreur ? (
        <View style={{ gap: 10 }}>
          <T small style={{ color: C.agressif }}>
            {erreur}
            {passes ? ` ${passes} mail${passes > 1 ? 's' : ''} déjà analysé${passes > 1 ? 's' : ''} : la suite reprend au mail ${passes + 1}.` : ''}
          </T>
          <View style={{ flexDirection: 'row' }}>
            <Btn
              kind="sec"
              couleur={t.c}
              label={passes ? 'Reprendre' : 'Réessayer'}
              onPress={() => {
                setErreur('');
                setArrete(false);
                setEssai((x) => x + 1);
              }}
            />
          </View>
        </View>
      ) : null}

      {analyses ? (
        <View style={{ gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: reglageOuvert }} onPress={() => setReglageOuvert((o) => !o)} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
            <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>
              {consignes.trim() ? `Consignes : « ${consignes.trim().slice(0, 60)}${consignes.trim().length > 60 ? '…' : ''} » · modifier ›` : 'Ajouter des consignes et refaire l’analyse ›'}
            </Text>
          </Pressable>
          {reglageOuvert ? (
            <View style={{ gap: 10 }}>
              <ChampConsignes valeur={consignes} onChange={setSaisies} />
              <View style={{ flexDirection: 'row' }}>
                <Btn couleur={t.c} label="Refaire l’analyse" onPress={refaire} />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {introuvables ? (
        <T small muted>
          {introuvables} mail{introuvables > 1 ? 's' : ''} introuvable{introuvables > 1 ? 's' : ''} chez Gmail ou Outlook (supprimé{introuvables > 1 ? 's' : ''} ou déplacé{introuvables > 1 ? 's' : ''} depuis) : sans analyse.
        </T>
      ) : null}

      {perimetre && !lot && synthese === 'en_cours' ? (
        <T small muted>
          Le copilote fait la vue d'ensemble de ces {mails.length} mails…
        </T>
      ) : null}
      {perimetre && !lot && synthese === 'erreur' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <T small muted>
            La vue d'ensemble n'a pas pu être faite ; l'analyse mail par mail est là.
          </T>
          <Pressable accessibilityRole="button" onPress={() => setSynthese('attente')} hitSlop={6}>
            <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>Réessayer ›</Text>
          </Pressable>
        </View>
      ) : null}
      {lot ? (
        <View style={{ gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: t.ligne, backgroundColor: alpha(t.c, C.sombre ? 0.08 : 0.05) }}>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>Vue d'ensemble · {perimetre}</Text>
          {lot.synthese ? <Text style={{ color: C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 22 }}>{lot.synthese}</Text> : null}
          {lot.points.length ? (
            <View style={{ gap: 6 }}>
              {lot.points.map((p) => (
                <View key={p} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: t.c }} />
                  <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14, lineHeight: 20 }}>{p}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <PropositionsTaches propositions={lot.actions} titre="Actions proposées" />
        </View>
      ) : null}

      {analyses?.length ? (
        <>
          {lot ? <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 16, marginTop: 4 }}>Mail par mail</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T small muted style={{ flex: 1 }}>
              {coches.length} sur {analyses.length} coché{coches.length > 1 ? 's' : ''}
              {reste ? ` (${mails.length - passes} encore à analyser)` : ''}. Relis et modifie les réponses avant l'envoi.
            </T>
            {analyses.length > 1 ? (
              <Pressable accessibilityRole="button" onPress={() => (setConfirmer(false), setDecoches(toutCoche ? new Set(analyses.map((a) => a.id)) : new Set()))} hitSlop={8}>
                <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>{toutCoche ? 'Tout décocher' : 'Tout cocher'}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Les actions en tête : visibles dès l'ouverture, même avec dix mails. */}
          {confirmer ? <T small>Envoyer {aEnvoyer.length > 1 ? `ces ${aEnvoyer.length} réponses` : 'cette réponse'} maintenant ? Chacune part dans son fil, depuis la boîte du mail.</T> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {confirmer ? (
              <>
                <Btn couleur={t.c} label={`Oui, envoyer (${aEnvoyer.length})`} onPress={envoyer} />
                <Btn kind="sec" couleur={t.c} label="Annuler" onPress={() => setConfirmer(false)} />
              </>
            ) : (
              <>
                <Btn couleur={t.c} label={enCours ? 'Envoi…' : aEnvoyer.length === analyses.length && analyses.length > 1 ? `Envoyer toutes les réponses (${aEnvoyer.length})` : `Envoyer les réponses cochées (${aEnvoyer.length})`} disabled={!aEnvoyer.length || enCours} onPress={() => setConfirmer(true)} />
                <Btn kind="sec" couleur={t.c} label={`Créer les tâches (${aCreer.length})`} disabled={!aCreer.length} onPress={creerTaches} />
              </>
            )}
          </View>
          <View style={{ gap: 10 }}>
            {analyses.map((a) => {
              const m = parId.get(a.id)!;
              const on = !decoches.has(a.id);
              const etat = etats[a.id];
              const u = URGENCE[a.urgence];
              const relance = a.relance ? espace.relances.find((r) => r.id === a.relance) : undefined;
              const projet = a.projet ? espace.projets?.find((p) => p.id === a.projet) : undefined;
              return (
                <View key={a.id} style={{ gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: on ? t.ligne : C.line, backgroundColor: on ? alpha(t.c, C.sombre ? 0.07 : 0.04) : C.sunk }}>
                  <Pressable accessibilityRole="checkbox" aria-checked={on} accessibilityState={{ checked: on }} accessibilityLabel={`${m.contact}, ${m.sujet}`} onPress={() => basculer(a.id)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <View style={{ paddingTop: 1 }}>
                      <Case on={on} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                        <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>
                          {m.contact || 'Sans expéditeur'}
                        </Text>
                        <Text numberOfLines={1} style={{ flex: 1, color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
                          {m.sujet}
                        </Text>
                      </View>
                      <Text style={{ color: C.ink, fontFamily: F.texte, fontSize: 14, lineHeight: 20 }}>{a.resume}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: u.c() }} />
                          <Text style={{ color: u.c(), fontFamily: F.texteM, fontSize: 12.5 }}>{u.label}</Text>
                        </View>
                        <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{ACTION[a.action]}</Text>
                        {a.categorie ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{CATEGORIES_MAIL[a.categorie]}</Text> : null}
                        {a.echeance ? <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 12.5 }}>Avant le {fmtCourt(a.echeance)}</Text> : null}
                        {a.montant ? <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 12.5 }}>{a.montant}</Text> : null}
                        {a.rdv ? <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 12.5 }}>Rendez-vous {fmtCourt(a.rdv.date)}{a.rdv.heure ? ` à ${a.rdv.heure.replace(':', ' h ')}` : ''}</Text> : null}
                        {projet ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>Projet : {projet.emoji} {projet.nom}</Text> : null}
                        {a.tache && a.action !== 'rien' ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>Tâche : {a.tache}</Text> : null}
                      </View>
                    </View>
                  </Pressable>

                  {relance ? (
                    // Le mail répond à une relance en attente : on propose de la clore d'un geste.
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                      <Text style={{ flexShrink: 1, color: C.ink, fontFamily: F.texte, fontSize: 13 }}>
                        Répond à ta relance : {relance.contact} · {relance.sujet}
                      </Text>
                      {relance.statut === 'repondu' ? (
                        <Text style={{ color: C.coach, fontFamily: F.texteM, fontSize: 13 }}>Relance close ✓</Text>
                      ) : (
                        <Pressable accessibilityRole="button" onPress={() => statutRelance(relance, 'repondu')} hitSlop={6}>
                          <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>Marquer comme répondu ›</Text>
                        </Pressable>
                      )}
                    </View>
                  ) : null}

                  {a.action !== 'rien' || textes[a.id] ? (
                    etat?.envoi === 'envoye' ? (
                      <Text style={{ color: C.coach, fontFamily: F.texteM, fontSize: 13 }}>Réponse envoyée ✓</Text>
                    ) : (
                      <View style={{ gap: 8 }}>
                        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, paddingHorizontal: 4 }}>
                          <CorpsMail
                            value={textes[a.id] ?? ''}
                            onChangeText={(v: string) => {
                              setConfirmer(false);
                              setTextes((x) => ({ ...x, [a.id]: v }));
                            }}
                            placeholder="Écris ta réponse…"
                            accessibilityLabel={`Réponse proposée à ${m.contact}`}
                          />
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                          <Pressable accessibilityRole="button" onPress={() => onModifier(m, textes[a.id] ?? '')} hitSlop={6}>
                            <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>Ouvrir dans Répondre ›</Text>
                          </Pressable>
                          {taches.includes(a.id) ? <Text style={{ color: C.coach, fontFamily: F.texteM, fontSize: 12.5 }}>Tâche ajoutée</Text> : null}
                          {etat?.envoi === 'en_cours' ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>Envoi…</Text> : null}
                          {etat?.envoi === 'erreur' ? <Text style={{ flex: 1, color: C.agressif, fontFamily: F.texte, fontSize: 12.5 }}>Pas envoyé : {etat.msg}</Text> : null}
                        </View>
                      </View>
                    )
                  ) : null}
                </View>
              );
            })}
          </View>

        </>
      ) : null}
    </Dialogue>
  );
}

/** L'avancement d'une analyse par paquets : la barre, le compte, et de quoi arrêter ou continuer. */
function Progression({ faits, total, enMarche, onArreter, onContinuer }: { faits: number; total: number; enMarche: boolean; onArreter: () => void; onContinuer?: () => void }) {
  const t = teinteCopilote();
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: t.ligne, backgroundColor: alpha(t.c, C.sombre ? 0.07 : 0.04) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ flex: 1, color: C.ink, fontFamily: F.texteM, fontSize: 13.5 }}>{enMarche ? `Analyse en cours : ${faits} sur ${total} mails` : `Analyse en pause : ${faits} sur ${total} mails`}</Text>
        {enMarche ? (
          <Pressable accessibilityRole="button" onPress={onArreter} hitSlop={8}>
            <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>Arrêter</Text>
          </Pressable>
        ) : onContinuer ? (
          <Pressable accessibilityRole="button" onPress={onContinuer} hitSlop={8}>
            <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>Continuer ›</Text>
          </Pressable>
        ) : null}
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: faits }} style={{ height: 6, borderRadius: 3, backgroundColor: C.sunk, overflow: 'hidden' }}>
        <View style={{ width: `${total ? Math.round((faits / total) * 100) : 0}%`, height: 6, borderRadius: 3, backgroundColor: t.c }} />
      </View>
    </View>
  );
}
