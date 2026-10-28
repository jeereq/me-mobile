import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { demanderIA } from '@/lib/assistant';
import { celebrer } from '@/lib/celebration';
import { donneesMails, echeanceMail, lireAnalyses, MAX_MAILS_ANALYSE, prioriteMail, type AnalyseMail } from '@/lib/copilote';
import { today, uid } from '@/lib/dates';
import { refExterne } from '@/lib/externe';
import { lienDepuisMail } from '@/lib/liens-mail';
import type { ContenuMail, Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Tache } from '@/lib/types';

import { Case, teinteCopilote } from './copilote';
import { CorpsMail } from './mail-ui';
import { ReservePro } from './reserve-pro';
import { Bloc, ZoneSquelette } from './squelettes';
import { Btn, Dialogue, T } from './ui';

const URGENCE = { haute: { label: 'Urgent', c: () => C.agressif }, normale: { label: 'Normal', c: () => C.hebdo }, basse: { label: 'Peut attendre', c: () => C.muted } } as const;
const ACTION = { repondre: 'Attend une réponse', tache: 'Demande un travail', rien: 'Rien à faire' } as const;

type Etat = { envoi?: 'en_cours' | 'envoye' | 'erreur'; msg?: string };

/** Lit le texte des mails sans les marquer comme lus ; un mail illisible garde l'extrait de la liste. */
async function textesDe(mails: Mail[], token: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    mails.map(async (m) => {
      const ref = refExterne(m.id);
      if (!ref) return;
      try {
        const r = await api<{ mail: ContenuMail }>(`/integrations/${ref.compte}/mails/${encodeURIComponent(ref.element)}?lu=0`, { token, discret: true });
        out[m.id] = r.mail.texte;
      } catch {
        // On analyse alors sur l'extrait.
      }
    }),
  );
  return out;
}

/**
 * Le copilote analyse un mail ou plusieurs d'un coup : pour chacun, ce que veut l'expéditeur, l'urgence et une réponse prête,
 * modifiable. Tout est coché au départ : « Envoyer les réponses » part pour tous les mails cochés (après confirmation),
 * « Créer les tâches » ajoute le travail demandé ; on décoche ce qu'on ne veut pas. « Modifier » ouvre la réponse complète.
 */
export function AnalyseMails({ mails: demandes, onFermer, onModifier }: { mails: Mail[]; onFermer: () => void; /** Ouvre la fenêtre « Répondre » avec le texte proposé. */ onModifier: (m: Mail, texte: string) => void }) {
  const { pro, session, espace, update, config } = useStore();
  const t = teinteCopilote();
  const mails = useMemo(() => demandes.slice(0, MAX_MAILS_ANALYSE), [demandes]);
  const [analyses, setAnalyses] = useState<AnalyseMail[] | null>(null);
  const [erreur, setErreur] = useState('');
  const [textes, setTextes] = useState<Record<string, string>>({});
  const [decoches, setDecoches] = useState<Set<string>>(new Set());
  const [etats, setEtats] = useState<Record<string, Etat>>({});
  const [confirmer, setConfirmer] = useState(false);
  const [taches, setTaches] = useState<string[]>([]);
  const [essai, setEssai] = useState(0);
  const token = session?.token;

  useEffect(() => {
    if (!pro || !token || !mails.length) return;
    let vivant = true;
    (async () => {
      try {
        const lus = await textesDe(mails, token);
        const brut = await demanderIA('mails', { ton: espace.audio.ton, donnees: donneesMails(mails, lus) });
        if (!vivant) return;
        const a = lireAnalyses(brut, mails.map((m) => m.id));
        if (!a.length) throw new Error("Le copilote n'a pas pu lire ces mails. Réessaie dans un instant.");
        setAnalyses(a);
        setTextes(Object.fromEntries(a.map((x) => [x.id, x.reponse])));
        // Ce qui ne demande rien reste décoché.
        setDecoches(new Set(a.filter((x) => x.action === 'rien').map((x) => x.id)));
      } catch (e) {
        if (vivant) setErreur((e as Error).message);
      }
    })();
    return () => {
      vivant = false;
    };
    // Une analyse par ouverture (et par « Réessayer »).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essai]);

  const titre = mails.length > 1 ? `Analyse de ${mails.length} mails` : 'Analyse du mail';
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

  const enCours = Object.values(etats).some((e) => e.envoi === 'en_cours');

  return (
    <Dialogue titre={titre} onFermer={onFermer} large>
      {!analyses && !erreur ? (
        <View style={{ gap: 12 }}>
          <T small muted>
            Le copilote lit {mails.length > 1 ? `tes ${mails.length} mails` : 'ce mail'} et prépare les réponses. Les mails restent non lus.
            {demandes.length > mails.length ? ` Les ${mails.length} premiers seulement : relance l'analyse pour les suivants.` : ''}
          </T>
          <ZoneSquelette label="Analyse en cours">
            {mails.slice(0, 3).map((m) => (
              <Bloc key={m.id} h={96} r={14} />
            ))}
          </ZoneSquelette>
        </View>
      ) : null}
      {erreur ? (
        <View style={{ gap: 10 }}>
          <T small style={{ color: C.agressif }}>{erreur}</T>
          <View style={{ flexDirection: 'row' }}>
            <Btn
              kind="sec"
              couleur={t.c}
              label="Réessayer"
              onPress={() => {
                setErreur('');
                setEssai((x) => x + 1);
              }}
            />
          </View>
        </View>
      ) : null}

      {analyses ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T small muted style={{ flex: 1 }}>
              {coches.length} sur {analyses.length} coché{coches.length > 1 ? 's' : ''}. Relis et modifie les réponses avant l'envoi.
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
                        {a.tache && a.action !== 'rien' ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>Tâche : {a.tache}</Text> : null}
                      </View>
                    </View>
                  </Pressable>

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
