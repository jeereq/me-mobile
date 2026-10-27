import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useSignalerSuppression } from '@/components/annuler';
import { ChampDate } from '@/components/calendrier';
import { ChoixCategories, EtiquettesCategories } from '@/components/categories';
import { Puce } from '@/components/finances-plus';
import { Btn, Dialogue, Empty, Input, Panel, Seg, T } from '@/components/ui';
import { addDays, fmtCourt, today, uid } from '@/lib/dates';
import { fmtMontant, lireMontant } from '@/lib/finances';
import {
  ajouterVersement,
  CADENCES,
  creerObjectif,
  dejaVerse,
  echeanceTenable,
  EMOJIS_OBJECTIF,
  erreurObjectif,
  etapesObjectif,
  ETATS_OBJECTIF,
  type EtatObjectif,
  faisabilite,
  fondsUrgenceConseille,
  OBJECTIFS_SUGGERES,
  objectifsActifs,
  planReduction,
  resumeObjectifs,
  retirerVersement,
  suiviObjectif,
} from '@/lib/objectifs';
import { alpha, C, F } from '@/lib/theme';
import type { Finances, Objectif } from '@/lib/types';

type SetF = (fn: (f: Finances) => Finances) => void;

/** Les couleurs du thème changent : on les relit à chaque affichage. */
export const couleurEtat = (e: EtatObjectif) => ({ atteint: C.coach, en_avance: C.coach, dans_les_temps: C.accent, a_venir: C.muted, en_retard: C.hebdo, depasse: C.agressif })[e];

const dateLongue = (d: string) => fmtCourt(d);
/** Termine une phrase par un point, sauf si la date abrégée (« janv. ») en porte déjà un. */
const point = (t: string) => (t.endsWith('.') ? t : `${t}.`);
const joursEnClair = (n: number) => (n <= 0 ? "aujourd'hui" : n === 1 ? 'demain' : n < 60 ? `dans ${n} jours` : `dans ${Math.round(n / 30)} mois`);

/** Barre de progression d'un objectif ; les repères à 25, 50 et 75 % marquent les étapes. */
export function BarreObjectif({ pct, couleur, hauteur = 10 }: { pct: number; couleur: string; hauteur?: number }) {
  const p = Math.max(0, Math.min(1, pct));
  return (
    <View accessibilityLabel={`${Math.round(p * 100)} % atteint`} style={{ height: hauteur, borderRadius: hauteur / 2, backgroundColor: C.sunk, overflow: 'hidden' }}>
      <View style={{ width: `${p * 100}%`, height: '100%', borderRadius: hauteur / 2, backgroundColor: couleur }} />
      {[25, 50, 75].map((x) => (
        <View key={x} style={{ position: 'absolute', left: `${x}%`, top: 0, bottom: 0, width: 1, backgroundColor: alpha(C.bg, 0.55) }} />
      ))}
    </View>
  );
}

function Badge({ etat }: { etat: EtatObjectif }) {
  const c = couleurEtat(etat);
  return (
    <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: alpha(c, 0.16) }}>
      <Text style={{ color: c, fontFamily: F.texteF, fontSize: 12 }}>{ETATS_OBJECTIF[etat]}</Text>
    </View>
  );
}

/* ---------- Créer ou modifier ---------- */

function ObjectifDialogue({ init, f, onEnregistrer, onSupprimer, onFermer }: { init?: Objectif; f: Finances; onEnregistrer: (o: Objectif) => void; onSupprimer?: () => void; onFermer: () => void }) {
  const d = today();
  const [nom, setNom] = useState(init?.nom ?? '');
  const [emoji, setEmoji] = useState(init?.emoji ?? EMOJIS_OBJECTIF[0]);
  const [genre, setGenre] = useState<Objectif['genre']>(init?.genre ?? 'epargne');
  const [cible, setCible] = useState(init ? String(init.cible).replace('.', ',') : '');
  const [depart, setDepart] = useState(init?.depart ? String(init.depart).replace('.', ',') : '');
  const [echeance, setEcheance] = useState<string | undefined>(init?.echeance);
  const [cadence, setCadence] = useState<'mois' | 'semaine'>(init?.plan?.cadence ?? 'mois');
  const [versement, setVersement] = useState(init?.plan?.versement ? String(init.plan.versement).replace('.', ',') : '');
  const [categories, setCategories] = useState(init?.categories);
  const [note, setNote] = useState(init?.note ?? '');
  const [montrerErreur, setMontrerErreur] = useState(false);

  const c = lireMontant(cible) ?? 0;
  const dep = lireMontant(depart) ?? 0;
  const v = lireMontant(versement) ?? 0;
  const brouillon = { nom, emoji, genre, cible: c, depart: dep || undefined, echeance: echeance ?? '', debut: init?.debut, plan: { cadence, ...(v > 0 ? { versement: v } : {}) }, categories, note };
  const erreur = erreurObjectif(brouillon, d);
  const apercu = erreur ? null : suiviObjectif(creerObjectif(brouillon, 'apercu', d), d);
  const cadenceInfo = CADENCES.find((x) => x.key === cadence)!;
  const conseil = fondsUrgenceConseille(f, d);

  const enregistrer = () => {
    if (erreur) return setMontrerErreur(true);
    const neuf = creerObjectif(brouillon, init?.id ?? uid(), d);
    onEnregistrer(init ? { ...neuf, debut: init.debut, versements: init.versements, creeLe: init.creeLe, ...(init.archive ? { archive: true } : {}) } : neuf);
    onFermer();
  };
  const partir = (s: (typeof OBJECTIFS_SUGGERES)[number]) => {
    setNom(s.nom);
    setEmoji(s.emoji);
    setGenre(s.genre);
    if (s.nom === "Fonds d'urgence" && conseil && !cible) setCible(String(conseil));
  };

  return (
    <Dialogue titre={init ? "Modifier l'objectif" : 'Nouvel objectif'} onFermer={onFermer}>
      {init ? null : (
        <View style={{ gap: 6 }}>
          <T small muted>
            Pars d’une idée, tu peux tout changer ensuite.
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {OBJECTIFS_SUGGERES.map((s) => (
              <Puce key={s.nom} label={`${s.emoji} ${s.nom}`} on={nom === s.nom} onPress={() => partir(s)} />
            ))}
          </View>
          {conseil && nom === "Fonds d'urgence" ? <T small muted>Trois mois de tes dépenses habituelles : {fmtMontant(conseil, f.devise)}.</T> : null}
        </View>
      )}
      <Seg
        label="Type"
        options={[
          { key: 'epargne', label: 'Mettre de côté' },
          { key: 'dette', label: 'Rembourser' },
        ]}
        value={genre}
        onChange={setGenre}
      />
      <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Ex. Voyage au Cap" autoFocus={!init} returnKeyType="next" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {EMOJIS_OBJECTIF.map((x) => (
          <Pressable key={x} accessibilityRole="radio" aria-checked={x === emoji} accessibilityLabel={`Icône ${x}`} onPress={() => setEmoji(x)} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: x === emoji ? C.accent : C.line, backgroundColor: x === emoji ? alpha(C.accent, 0.14) : 'transparent' }}>
            <Text style={{ fontSize: 18 }}>{x}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <View style={{ flexGrow: 1, flexBasis: 150 }}>
          <Input label={genre === 'dette' ? `Somme à rembourser (${f.devise})` : `Somme à atteindre (${f.devise})`} value={cible} onChangeText={setCible} keyboardType="decimal-pad" placeholder="0" erreur={cible.trim() && !lireMontant(cible) ? 'Montant non reconnu : écris par exemple 1500 ou 49,90.' : undefined} />
        </View>
        <View style={{ flexGrow: 1, flexBasis: 150 }}>
          <Input label={genre === 'dette' ? 'Déjà remboursé' : 'Déjà de côté'} value={depart} onChangeText={setDepart} keyboardType="decimal-pad" placeholder="0" />
        </View>
      </View>
      <ChampDate label="Date à laquelle tu veux y arriver" value={echeance} onChange={setEcheance} min={addDays(init?.debut ?? d, 1)} placeholder="Choisir l'échéance" />
      <Seg label="Rythme des versements" options={CADENCES.map((x) => ({ key: x.key, label: x.label }))} value={cadence} onChange={setCadence} />
      <Input
        label={`Montant versé ${cadenceInfo.par} (facultatif)`}
        value={versement}
        onChangeText={setVersement}
        keyboardType="decimal-pad"
        placeholder={apercu ? String(apercu.requis).replace('.', ',') : '0'}
        aide={apercu ? (v > 0 ? (apercu.ecartEcheance && apercu.ecartEcheance > 0 ? `À ce rythme, tu y arrives ${apercu.ecartEcheance} jours après la date voulue.` : 'À ce rythme, tu y arrives à la date voulue.') : `Laissé vide, le plan demande ${fmtMontant(apercu.requis, f.devise)} ${cadenceInfo.par}.`) : undefined}
      />
      <ChoixCategories value={categories} onChange={setCategories} label="Catégories (facultatif)" />
      <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Pourquoi cet objectif ?" />
      {montrerErreur && erreur ? (
        <Text accessibilityLiveRegion="polite" style={{ color: C.agressif, fontFamily: F.texte, fontSize: 13 }}>
          {erreur}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={init ? 'Enregistrer' : "Créer l'objectif"} onPress={enregistrer} />
        <Btn kind="sec" label="Annuler" onPress={onFermer} />
        {onSupprimer ? (
          <Btn
            kind="danger"
            label="Supprimer"
            onPress={() => {
              onSupprimer();
              onFermer();
            }}
          />
        ) : null}
      </View>
    </Dialogue>
  );
}

/* ---------- Verser ---------- */

function VersementDialogue({ o, devise, propose, onVerser, onFermer }: { o: Objectif; devise: string; propose: number; onVerser: (montant: number, date: string, note?: string) => void; onFermer: () => void }) {
  const [montant, setMontant] = useState(propose > 0 ? String(propose).replace('.', ',') : '');
  const [date, setDate] = useState<string | undefined>(today());
  const [note, setNote] = useState('');
  const m = lireMontant(montant);
  const valide = !!m && m > 0 && !!date;
  return (
    <Dialogue titre={o.genre === 'dette' ? 'Noter un remboursement' : 'Noter un versement'} onFermer={onFermer}>
      <T small muted>
        {o.emoji} {o.nom}. Ce montant compte pour l’objectif, pas comme une dépense : tes budgets ne bougent pas.
      </T>
      <Input label={`Montant (${devise})`} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" placeholder="0" autoFocus erreur={montant.trim() && !m ? 'Montant non reconnu : écris par exemple 100 ou 49,90.' : undefined} />
      <ChampDate label="Date" value={date} onChange={setDate} max={today()} min={o.debut} />
      <Input label="Note (facultatif)" value={note} onChangeText={setNote} placeholder="Ex. prime de fin d'année" />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn
          label="Ajouter"
          disabled={!valide}
          onPress={() => {
            if (!valide) return;
            onVerser(m!, date!, note.trim() || undefined);
            onFermer();
          }}
        />
        <Btn kind="sec" label="Annuler" onPress={onFermer} />
      </View>
    </Dialogue>
  );
}

/* ---------- Une carte ---------- */

function Ligne({ k, v, couleur }: { k: string; v: string; couleur?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{k}</Text>
      <Text style={{ flexShrink: 1, textAlign: 'right', color: couleur ?? C.ink, fontFamily: F.texteM, fontSize: 13 }}>{v}</Text>
    </View>
  );
}

function CarteObjectif({ o, f, setF, ouvert, onBasculer, onModifier, onVerser }: { o: Objectif; f: Finances; setF: SetF; ouvert: boolean; onBasculer: () => void; onModifier: () => void; onVerser: (propose: number) => void }) {
  const signaler = useSignalerSuppression();
  const d = today();
  const dev = f.devise;
  const s = suiviObjectif(o, d);
  const couleur = couleurEtat(s.etat);
  const dette = o.genre === 'dette';
  const propose = Math.min(s.versement, s.reste) || 0;
  const faitAujourdhui = propose > 0 && dejaVerse(o, d, propose);
  const cadenceInfo = CADENCES.find((x) => x.key === s.cadence)!;

  const retirer = (id: string) => {
    const v = o.versements.find((x) => x.id === id);
    if (!v) return;
    setF((g) => ({ ...g, objectifs: (g.objectifs ?? []).map((x) => (x.id === o.id ? retirerVersement(x, id) : x)) }));
    signaler({
      texte: `Versement de ${fmtMontant(v.montant, dev)} retiré de « ${o.nom} ».`,
      restaurer: (g) => ({ ...g, objectifs: (g.objectifs ?? []).map((x) => (x.id === o.id && !x.versements.some((y) => y.id === id) ? { ...x, versements: [v, ...x.versements].sort((a, b) => b.date.localeCompare(a.date)) } : x)) }),
    });
  };
  const archiver = (archive: boolean) => setF((g) => ({ ...g, objectifs: (g.objectifs ?? []).map((x) => (x.id === o.id ? { ...x, archive: archive || undefined } : x)) }));

  return (
    <View style={{ gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: ouvert }} accessibilityLabel={`${o.nom}. ${ouvert ? 'Masquer' : 'Voir'} le plan`} onPress={onBasculer} style={({ pressed }) => ({ gap: 8, opacity: pressed ? 0.8 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: alpha(couleur, 0.14), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>{o.emoji}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>
              {o.nom}
            </Text>
            <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
              {s.atteint ? 'Objectif atteint' : `Pour le ${dateLongue(o.echeance)}${s.joursRestants > 0 ? ` · ${joursEnClair(s.joursRestants)}` : ''}`}
            </Text>
          </View>
          <Badge etat={s.etat} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 22 }}>{fmtMontant(Math.min(s.acquis, o.cible), dev)}</Text>
          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
            sur {fmtMontant(o.cible, dev)} · {Math.round(s.pct * 100)} %
          </Text>
        </View>
        <BarreObjectif pct={s.pct} couleur={couleur} />
      </Pressable>

      {s.atteint ? (
        <T small muted>
          {dette ? 'Tout est remboursé.' : 'La somme est de côté.'} Tu peux archiver cet objectif pour le ranger.
        </T>
      ) : (
        <View style={{ gap: 4 }}>
          <Ligne k={s.choisi ? 'Ton plan' : 'Pour tenir la date'} v={`${fmtMontant(s.versement, dev)} ${cadenceInfo.par}`} />
          {s.prochain ? <Ligne k="Prochain versement" v={dateLongue(s.prochain)} /> : null}
          {s.dateAtteinte ? (
            <Ligne
              k="À ce rythme, atteint le"
              v={`${dateLongue(s.dateAtteinte)}${s.ecartEcheance && s.ecartEcheance > 0 ? ` (${s.ecartEcheance} j de retard)` : ''}`}
              couleur={s.ecartEcheance && s.ecartEcheance > 0 ? C.hebdo : undefined}
            />
          ) : null}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {s.atteint ? (
          <Btn small kind="sec" label="Archiver" onPress={() => archiver(true)} />
        ) : (
          <>
            <Btn small label={faitAujourdhui ? "Versé aujourd'hui ✓" : `${dette ? 'Rembourser' : 'Verser'} ${fmtMontant(propose, dev)}`} disabled={faitAujourdhui || propose <= 0} onPress={() => setF((g) => ({ ...g, objectifs: (g.objectifs ?? []).map((x) => (x.id === o.id ? ajouterVersement(x, { id: uid(), date: d, montant: propose }) : x)) }))} />
            <Btn small kind="sec" label="Autre montant" onPress={() => onVerser(propose)} />
          </>
        )}
        <Btn small kind="sec" label="Modifier" onPress={onModifier} />
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: ouvert }} onPress={onBasculer} hitSlop={6} style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>{ouvert ? 'Masquer le plan ▴' : 'Voir le plan en détail ▾'}</Text>
      </Pressable>
      {ouvert ? <DetailsObjectif o={o} f={f} setF={setF} onRetirer={retirer} onArchiver={archiver} /> : null}
      {o.categories?.length ? <EtiquettesCategories ids={o.categories} /> : null}
    </View>
  );
}

/** Le plan en détail : les étapes, ce que le budget permet, et l'historique des versements. */
function DetailsObjectif({ o, f, setF, onRetirer, onArchiver }: { o: Objectif; f: Finances; setF: SetF; onRetirer: (id: string) => void; onArchiver: (b: boolean) => void }) {
  const d = today();
  const dev = f.devise;
  const s = suiviObjectif(o, d);
  const etapes = etapesObjectif(o, d);
  const fa = s.atteint ? null : faisabilite(f, o, d);
  const reduction = fa && fa.tient === false ? planReduction(f, d, fa.manque) : null;
  const repousse = fa && fa.tient === false ? echeanceTenable(o, d, fa.libre) : null;

  return (
    <View style={{ gap: 12, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.line }}>
      {o.note ? <T small muted>{o.note}</T> : null}

      <View style={{ gap: 6 }}>
        <T small muted>Étapes</T>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {etapes.map((e) => {
            const c = e.etat === 'fait' ? C.coach : e.etat === 'en_retard' ? C.hebdo : C.muted;
            return (
              <View key={e.pct} style={{ flex: 1, gap: 2, padding: 8, borderRadius: 10, backgroundColor: alpha(c, 0.1), borderWidth: 1, borderColor: alpha(c, 0.3) }}>
                <Text style={{ color: c, fontFamily: F.texteF, fontSize: 13 }}>
                  {e.etat === 'fait' ? '✓ ' : ''}
                  {Math.round(e.pct * 100)} %
                </Text>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 11 }}>{e.etat === 'fait' && e.faitLe ? `le ${fmtCourt(e.faitLe)}` : `avant le ${fmtCourt(e.date)}`}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {fa ? (
        <View style={{ gap: 6, padding: 12, borderRadius: 12, backgroundColor: C.sunk }}>
          <T small muted>Est-ce que ça tient ?</T>
          {fa.tient === null ? (
            <T small>Note tes revenus dans l’onglet Mouvements : on pourra dire si ce plan tient dans ton budget.</T>
          ) : fa.tient ? (
            <T small>
              Oui. Tu mets en moyenne {fmtMontant(fa.capacite!.parMois, dev)} de côté par mois{fa.autres > 0 ? `, dont ${fmtMontant(fa.autres, dev)} pour tes autres objectifs` : ''}. Ce plan demande {fmtMontant(fa.besoin, dev)} par mois.
            </T>
          ) : (
            <>
              <T small>
                Il manque {fmtMontant(fa.manque, dev)} par mois : le plan demande {fmtMontant(fa.besoin, dev)}, il te reste {fmtMontant(Math.max(0, fa.libre ?? 0), dev)}
                {fa.autres > 0 ? ` après tes autres objectifs` : ''}.
              </T>
              {reduction ? (
                <View style={{ gap: 2 }}>
                  <T small muted>
                    {reduction.couvre ? `Réduire de ${reduction.pct} % tes plus gros budgets suffit :` : `Même avec ${reduction.pct} % de moins sur tes plus gros budgets (${fmtMontant(reduction.total, dev)}), il manquerait encore de quoi :`}
                  </T>
                  {reduction.leviers.map((l) => (
                    <Ligne key={l.budget} k={`${l.emoji} ${l.nom} (${fmtMontant(l.moyenne, dev)} par mois)`} v={`− ${fmtMontant(l.economie, dev)}`} />
                  ))}
                </View>
              ) : null}
              {repousse ? (
                <View style={{ gap: 6, alignItems: 'flex-start' }}>
                  <T small muted>Ou repousse la date : avec ce que tu peux mettre de côté, tu y arrives le {point(dateLongue(repousse))}</T>
                  <Btn small kind="sec" label={`Repousser au ${dateLongue(repousse)}`} onPress={() => setF((g) => ({ ...g, objectifs: (g.objectifs ?? []).map((x) => (x.id === o.id ? { ...x, echeance: repousse } : x)) }))} />
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {s.rythmeReel > 0 && !s.atteint ? <T small muted>Ces 90 derniers jours, tu as versé {fmtMontant(s.rythmeReel, dev)} par mois{s.dateAtteinteReelle ? point(` : à ce rythme, atteint le ${dateLongue(s.dateAtteinteReelle)}`) : '.'}</T> : null}

      <View style={{ gap: 6 }}>
        <T small muted>Historique{o.versements.length ? ` (${o.versements.length})` : ''}</T>
        {o.depart ? <Ligne k="Au départ" v={fmtMontant(o.depart, dev)} /> : null}
        {o.versements.length ? (
          o.versements.map((v) => (
            <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.ink, fontFamily: F.texte, fontSize: 13 }}>
                  {fmtCourt(v.date)}
                  {v.note ? ` · ${v.note}` : ''}
                </Text>
              </View>
              <Text style={{ color: C.coach, fontFamily: F.chiffre, fontSize: 14 }}>+ {fmtMontant(v.montant, dev)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Retirer le versement du ${fmtCourt(v.date)}`} hitSlop={8} onPress={() => onRetirer(v.id)}>
                <Text style={{ color: C.muted, fontSize: 15 }}>✕</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <T small muted>Rien de versé pour l’instant.</T>
        )}
      </View>
      {!s.atteint ? <Btn small kind="sec" label="Archiver sans l'atteindre" onPress={() => onArchiver(true)} /> : null}
    </View>
  );
}

/* ---------- L'onglet ---------- */

export function PanneauObjectifs({ f, setF }: { f: Finances; setF: SetF }) {
  const signaler = useSignalerSuppression();
  const d = today();
  const [form, setForm] = useState<'nouveau' | Objectif | null>(null);
  const [verser, setVerser] = useState<{ o: Objectif; propose: number } | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [archives, setArchives] = useState(false);
  const dev = f.devise;
  const tous = f.objectifs ?? [];
  const actifs = objectifsActifs(f).sort((a, b) => Number(suiviObjectif(a, d).atteint) - Number(suiviObjectif(b, d).atteint) || a.echeance.localeCompare(b.echeance));
  const rangés = tous.filter((o) => o.archive);
  const r = resumeObjectifs(f, d);

  const enregistrer = (o: Objectif) => setF((g) => ({ ...g, objectifs: (g.objectifs ?? []).some((x) => x.id === o.id) ? (g.objectifs ?? []).map((x) => (x.id === o.id ? o : x)) : [...(g.objectifs ?? []), o] }));
  const supprimer = (o: Objectif) => {
    const rang = tous.findIndex((x) => x.id === o.id);
    setF((g) => ({ ...g, objectifs: (g.objectifs ?? []).filter((x) => x.id !== o.id) }));
    signaler({
      texte: `Objectif « ${o.nom} » supprimé.`,
      restaurer: (g) => ((g.objectifs ?? []).some((x) => x.id === o.id) ? g : { ...g, objectifs: [...(g.objectifs ?? []).slice(0, rang), o, ...(g.objectifs ?? []).slice(rang)] }),
    });
  };

  return (
    <>
      {form ? <ObjectifDialogue key={form === 'nouveau' ? 'nouveau' : form.id} init={form === 'nouveau' ? undefined : form} f={f} onEnregistrer={enregistrer} onSupprimer={form === 'nouveau' ? undefined : () => supprimer(form)} onFermer={() => setForm(null)} /> : null}
      {verser ? (
        <VersementDialogue
          o={verser.o}
          devise={dev}
          propose={verser.propose}
          onVerser={(montant, date, note) => setF((g) => ({ ...g, objectifs: (g.objectifs ?? []).map((x) => (x.id === verser.o.id ? ajouterVersement(x, { id: uid(), date, montant, ...(note ? { note } : {}) }) : x)) }))}
          onFermer={() => setVerser(null)}
        />
      ) : null}

      {!tous.length ? (
        <Panel title="Objectifs">
          <Empty>Fixe-toi une somme à atteindre et une date : on calcule combien mettre de côté, te dit si tu es dans les temps, et vérifie que ton budget le permet.</Empty>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {OBJECTIFS_SUGGERES.map((s) => (
              <Puce key={s.nom} label={`${s.emoji} ${s.nom}`} on={false} onPress={() => setForm('nouveau')} />
            ))}
          </View>
          <Btn label="Créer un objectif" onPress={() => setForm('nouveau')} />
        </Panel>
      ) : (
        <>
          <Panel
            title="Mes objectifs"
            count={r.nb || undefined}
            right={<Btn small label="+ Objectif" onPress={() => setForm('nouveau')} />}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <View>
                <T small muted>Déjà réuni</T>
                <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 28 }}>{fmtMontant(r.acquis, dev)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T small muted>Sur un total visé de</T>
                <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 18 }}>{fmtMontant(r.cible, dev)}</Text>
              </View>
            </View>
            <BarreObjectif pct={r.pct} couleur={C.accent} />
            <T small muted>
              {r.atteints ? `${r.atteints} atteint${r.atteints > 1 ? 's' : ''}. ` : ''}
              {r.enRetard ? `${r.enRetard} en retard. ` : ''}
              {r.parMois > 0 ? `Tes plans demandent ${fmtMontant(r.parMois, dev)} par mois en tout.` : ''}
            </T>
          </Panel>
          {actifs.map((o) => (
            <CarteObjectif key={o.id} o={o} f={f} setF={setF} ouvert={ouvert === o.id} onBasculer={() => setOuvert(ouvert === o.id ? null : o.id)} onModifier={() => setForm(o)} onVerser={(propose) => setVerser({ o, propose })} />
          ))}
          {rangés.length ? (
            <Panel title="Archivés" count={rangés.length} right={<Btn small kind="sec" label={archives ? 'Masquer' : 'Voir'} onPress={() => setArchives(!archives)} />}>
              {archives
                ? rangés.map((o) => (
                    <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 18 }}>{o.emoji}</Text>
                      <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
                        {o.nom} · {fmtMontant(Math.min(suiviObjectif(o, d).acquis, o.cible), dev)} / {fmtMontant(o.cible, dev)}
                      </Text>
                      <Btn small kind="sec" label="Remettre" onPress={() => setF((g) => ({ ...g, objectifs: (g.objectifs ?? []).map((x) => (x.id === o.id ? { ...x, archive: undefined } : x)) }))} />
                      <Btn small kind="danger" label="Supprimer" onPress={() => supprimer(o)} />
                    </View>
                  ))
                : null}
            </Panel>
          ) : null}
        </>
      )}
    </>
  );
}

/** Sur l'aperçu : les objectifs en cours d'un coup d'œil, avec un renvoi vers leur onglet. */
export function ApercuObjectifs({ f, onVoir }: { f: Finances; onVoir: () => void }) {
  const d = today();
  const dev = f.devise;
  const l = objectifsActifs(f)
    .map((o) => ({ o, s: suiviObjectif(o, d) }))
    .filter((x) => !x.s.atteint)
    .sort((a, b) => a.o.echeance.localeCompare(b.o.echeance))
    .slice(0, 3);
  if (!f.objectifs?.length)
    return (
      <Panel title="Objectifs">
        <T small muted>
          Une somme à atteindre, une date : on te dit combien mettre de côté chaque mois.
        </T>
        <Btn small kind="sec" label="Fixer un objectif" onPress={onVoir} />
      </Panel>
    );
  if (!l.length) return null;
  return (
    <Panel
      title="Objectifs"
      right={
        <Pressable accessibilityRole="button" onPress={onVoir} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Tout voir ›</Text>
        </Pressable>
      }>
      {l.map(({ o, s }) => (
        <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={`${o.nom}, ${Math.round(s.pct * 100)} %`} onPress={onVoir} style={({ pressed }) => ({ gap: 6, opacity: pressed ? 0.75 : 1 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
              {o.emoji} {o.nom}
            </Text>
            <Text style={{ color: couleurEtat(s.etat), fontFamily: F.texteM, fontSize: 12 }}>{ETATS_OBJECTIF[s.etat]}</Text>
          </View>
          <BarreObjectif pct={s.pct} couleur={couleurEtat(s.etat)} hauteur={6} />
          <T small muted>
            {fmtMontant(Math.min(s.acquis, o.cible), dev)} sur {fmtMontant(o.cible, dev)}
            {s.prochain ? ` · prochain versement le ${fmtCourt(s.prochain)}` : ''}
          </T>
        </Pressable>
      ))}
    </Panel>
  );
}
