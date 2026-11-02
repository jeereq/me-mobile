import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChampDate } from '@/components/calendrier';
import { useChoixDate, type SetF } from '@/components/finances-plus';
import { Jauge } from '@/components/jauge';
import { Pliable } from '@/components/pliable';
import { ReserveFinances } from '@/components/reserve-pro';
import { Btn, Dialogue, Empty, Input, Panel, Seg, Sep, T } from '@/components/ui';
import { categoriesDe } from '@/lib/categories';
import { bilanMois, echeancesAVenir, moisDit, moisPrecedent, suiviPret, totauxPrets } from '@/lib/commun/prets';
import { addDays, fmtCourt, today, uid } from '@/lib/dates';
import { fmtMontant, lireMontant } from '@/lib/finances';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';
import type { Finances, Pret } from '@/lib/types';

/*
 * Finances avancées (formule Finances) : prêts entre personnes, paiements à venir et bilan du mois.
 * Les calculs sont dans lib/commun/prets.ts, communs avec le serveur qui envoie les rappels.
 */

const ETATS = { rembourse: 'Rendu', en_retard: 'En retard', bientot: 'Bientôt', en_cours: 'En cours' } as const;
const couleurEtat = (e: keyof typeof ETATS) => (e === 'rembourse' ? C.coach : e === 'en_retard' ? C.agressif : e === 'bientot' ? C.hebdo : C.muted);

function Chiffre({ titre, valeur, couleur }: { titre: string; valeur: string; couleur?: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 130, gap: 2, padding: 12, borderRadius: 14, backgroundColor: C.sunk }}>
      <T small muted>
        {titre}
      </T>
      <Text style={{ color: couleur ?? C.ink, fontFamily: F.chiffre, fontSize: 20 }}>{valeur}</Text>
    </View>
  );
}

/** Nouveau prêt, ou modification d'un prêt existant. */
function FormPret({ init, devise, onEnregistrer, onSupprimer, onFermer }: { init?: Pret; devise: string; onEnregistrer: (p: Pret) => void; onSupprimer?: () => void; onFermer: () => void }) {
  const [sens, setSens] = useState<Pret['sens']>(init?.sens ?? 'prete');
  const [personne, setPersonne] = useState(init?.personne ?? '');
  const [montant, setMontant] = useState(init ? String(init.montant).replace('.', ',') : '');
  const [echeance, setEcheance] = useState<string | undefined>(init?.echeance ?? undefined);
  const [note, setNote] = useState(init?.note ?? '');
  const date = useChoixDate(init?.date);
  const m = lireMontant(montant);
  const ok = !!personne.trim() && m !== null && !!date.date && (!echeance || echeance >= date.date);
  return (
    <Dialogue titre={init ? 'Modifier le prêt' : 'Nouveau prêt'} onFermer={onFermer}>
      <Seg
        label="Sens"
        options={[
          { key: 'prete', label: 'J’ai prêté' },
          { key: 'emprunte', label: 'J’ai emprunté' },
        ]}
        value={sens}
        onChange={setSens}
      />
      <Input label={sens === 'prete' ? 'À qui ?' : 'À qui as-tu emprunté ?'} placeholder="Paul" value={personne} onChangeText={setPersonne} autoFocus={!init} />
      <Input label={`Montant (${devise})`} placeholder="50" value={montant} onChangeText={setMontant} keyboardType="decimal-pad" />
      {date.element}
      <View style={{ flexDirection: 'row' }}>
        <ChampDate label="À rendre le (facultatif)" value={echeance} onChange={setEcheance} min={date.date ?? undefined} effacable placeholder="Pas de date" />
      </View>
      <T small muted>
        Avec une date, Me te prévient la veille et le jour même, puis chaque lundi tant que ce n’est pas rendu.
      </T>
      <Input label="Note" placeholder="Pour le loyer de septembre" value={note} onChangeText={setNote} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn
          label="Enregistrer"
          disabled={!ok}
          onPress={() =>
            onEnregistrer({
              id: init?.id ?? uid(),
              personne: personne.trim(),
              sens,
              montant: m!,
              date: date.date!,
              echeance: echeance || null,
              remboursements: init?.remboursements ?? [],
              ...(note.trim() ? { note: note.trim() } : {}),
              ...(init?.archive ? { archive: true } : {}),
              creeLe: init?.creeLe ?? new Date().toISOString(),
            })
          }
        />
        {onSupprimer ? <Btn kind="danger" label="Supprimer" onPress={onSupprimer} /> : null}
      </View>
    </Dialogue>
  );
}

/** Noter un remboursement reçu (ou fait). */
function FormRemboursement({ p, devise, onEnregistrer, onFermer }: { p: Pret; devise: string; onEnregistrer: (montant: number, date: string) => void; onFermer: () => void }) {
  const reste = suiviPret(p, today()).reste;
  const [montant, setMontant] = useState(String(reste).replace('.', ','));
  const date = useChoixDate();
  const m = lireMontant(montant);
  return (
    <Dialogue titre={p.sens === 'prete' ? `${p.personne} t’a rendu` : `Tu as rendu à ${p.personne}`} onFermer={onFermer}>
      <T small muted>
        Il reste {fmtMontant(reste, devise)} sur {fmtMontant(p.montant, devise)}.
      </T>
      <Input label={`Montant (${devise})`} value={montant} onChangeText={setMontant} keyboardType="decimal-pad" />
      {date.element}
      <Btn label="Noter le remboursement" disabled={m === null || !date.date} onPress={() => onEnregistrer(Math.min(m!, reste), date.date!)} />
    </Dialogue>
  );
}

function LignePret({ p, devise, onRembourser, onModifier }: { p: Pret; devise: string; onRembourser?: () => void; onModifier: () => void }) {
  const s = suiviPret(p, today());
  const prete = p.sens === 'prete';
  return (
    <View style={{ gap: 6, paddingVertical: 6 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Modifier le prêt de ${p.personne}`} onPress={onModifier} style={({ pressed }) => ({ gap: 4, opacity: pressed ? 0.75 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16 }}>{prete ? '🤝' : '🧾'}</Text>
          <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>
            {prete ? `${p.personne} te doit` : `Tu dois à ${p.personne}`}
          </Text>
          <Text style={{ color: prete ? C.coach : C.agressif, fontFamily: F.chiffre, fontSize: 16 }}>{fmtMontant(s.reste, devise)}</Text>
        </View>
        <Jauge ratio={p.montant > 0 ? s.rendu / p.montant : 0} hauteur={6} couleur={couleurEtat(s.etat)} />
        <T small muted>
          <Text style={{ color: couleurEtat(s.etat), fontFamily: F.texteM }}>{ETATS[s.etat]}</Text>
          {` · ${fmtMontant(p.montant, devise)} ${prete ? 'prêtés' : 'empruntés'} le ${fmtCourt(p.date)}`}
          {p.echeance && s.etat !== 'rembourse' ? ` · à rendre le ${fmtCourt(p.echeance)}` : ''}
          {p.note ? ` · ${p.note}` : ''}
        </T>
      </Pressable>
      {onRembourser && s.etat !== 'rembourse' ? (
        <View style={{ flexDirection: 'row' }}>
          <Btn small kind="sec" label={prete ? 'Noter ce qu’il a rendu' : 'Noter ce que j’ai rendu'} onPress={onRembourser} />
        </View>
      ) : null}
    </View>
  );
}

/** L'onglet Prêts : ce qu'on me doit, ce que je dois, et les remboursements. */
export function PanneauPrets({ f, setF }: { f: Finances; setF: SetF }) {
  const { finances, lectureSeule } = useStore();
  const [form, setForm] = useState<'nouveau' | string | null>(null);
  const [aRembourser, setARembourser] = useState<string | null>(null);
  const d = today();
  const prets = useMemo(() => (f.prets ?? []).filter((p) => !p.archive), [f.prets]);
  const t = totauxPrets(prets, d);
  const ouverts = prets.filter((p) => suiviPret(p, d).etat !== 'rembourse').sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999'));
  const rendus = prets.filter((p) => suiviPret(p, d).etat === 'rembourse');
  const modifiable = finances && !lectureSeule;
  const enregistrer = (p: Pret) => {
    setF((g) => ({ ...g, prets: (g.prets ?? []).some((x) => x.id === p.id) ? (g.prets ?? []).map((x) => (x.id === p.id ? p : x)) : [p, ...(g.prets ?? [])] }));
    setForm(null);
  };
  const enEdition = form && form !== 'nouveau' ? (f.prets ?? []).find((p) => p.id === form) : undefined;
  const pretARembourser = aRembourser ? (f.prets ?? []).find((p) => p.id === aRembourser) : undefined;

  if (!finances && !prets.length) return <ReserveFinances fonction="prets" />;
  return (
    <>
      {!finances ? <ReserveFinances fonction="prets" /> : null}
      <Panel title="Prêts entre personnes" right={modifiable ? <Btn small kind="sec" label="+ Prêt" onPress={() => setForm('nouveau')} /> : undefined}>
        <T small muted>
          L’argent prêté ou emprunté à quelqu’un : ni dépense ni revenu, il ne change pas tes budgets. Me te rappelle quand il doit être rendu.
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chiffre titre="On me doit" valeur={fmtMontant(t.onMeDoit, f.devise)} couleur={t.onMeDoit ? C.coach : undefined} />
          <Chiffre titre="Je dois" valeur={fmtMontant(t.jeDois, f.devise)} couleur={t.jeDois ? C.agressif : undefined} />
        </View>
        {t.enRetard ? (
          <T small style={{ color: C.agressif }}>
            {t.enRetard} prêt{t.enRetard > 1 ? 's' : ''} en retard.
          </T>
        ) : null}
        {ouverts.length ? (
          ouverts.map((p, i) => (
            <View key={p.id}>
              {i ? <Sep /> : null}
              <LignePret p={p} devise={f.devise} onModifier={() => modifiable && setForm(p.id)} onRembourser={modifiable ? () => setARembourser(p.id) : undefined} />
            </View>
          ))
        ) : (
          <Empty icone="portefeuille">Aucun prêt en cours. Note l’argent prêté à un proche, ou emprunté : tu sauras toujours qui doit quoi.</Empty>
        )}
      </Panel>
      {rendus.length ? (
        <Pliable titre="Déjà rendus" count={rendus.length} panneau>
          {rendus.map((p, i) => (
            <View key={p.id}>
              {i ? <Sep /> : null}
              <LignePret p={p} devise={f.devise} onModifier={() => modifiable && setForm(p.id)} />
              {modifiable ? (
                <View style={{ flexDirection: 'row' }}>
                  <Btn small kind="sec" label="Ranger" onPress={() => setF((g) => ({ ...g, prets: (g.prets ?? []).map((x) => (x.id === p.id ? { ...x, archive: true } : x)) }))} />
                </View>
              ) : null}
            </View>
          ))}
        </Pliable>
      ) : null}
      {form === 'nouveau' || enEdition ? (
        <FormPret
          key={form}
          init={enEdition}
          devise={f.devise}
          onEnregistrer={enregistrer}
          onSupprimer={
            enEdition
              ? () => {
                  setF((g) => ({ ...g, prets: (g.prets ?? []).filter((x) => x.id !== enEdition.id) }));
                  setForm(null);
                }
              : undefined
          }
          onFermer={() => setForm(null)}
        />
      ) : null}
      {pretARembourser ? (
        <FormRemboursement
          p={pretARembourser}
          devise={f.devise}
          onFermer={() => setARembourser(null)}
          onEnregistrer={(montant, date) => {
            setF((g) => ({ ...g, prets: (g.prets ?? []).map((x) => (x.id === pretARembourser.id ? { ...x, remboursements: [...(x.remboursements ?? []), { id: uid(), date, montant }] } : x)) }));
            setARembourser(null);
          }}
        />
      ) : null}
    </>
  );
}

/** Aperçu : les paiements récurrents et les prêts à rendre des 14 prochains jours. Rien sans la formule Finances. */
export function ApercuAVenir({ f, onVoirPrets }: { f: Finances; onVoirPrets: () => void }) {
  const { finances } = useStore();
  const d = today();
  if (!finances) return null;
  const limite = addDays(d, 14);
  const paiements = echeancesAVenir(f.recurrences, d, 14).map((e) => ({ id: `${e.recurrence}:${e.date}`, date: e.date, titre: e.note || (e.genre === 'revenu' ? 'Revenu' : 'Paiement'), montant: e.genre === 'revenu' ? e.montant : -e.montant, emoji: e.genre === 'revenu' ? '💰' : '🔁', pret: false }));
  const prets = (f.prets ?? [])
    .filter((p) => !p.archive && p.echeance && p.echeance >= d && p.echeance <= limite)
    .map((p) => ({ p, s: suiviPret(p, d) }))
    .filter(({ s }) => s.reste > 0)
    .map(({ p, s }) => ({ id: p.id, date: p.echeance!, titre: p.sens === 'prete' ? `${p.personne} te rend` : `Rendre à ${p.personne}`, montant: p.sens === 'prete' ? s.reste : -s.reste, emoji: p.sens === 'prete' ? '🤝' : '🧾', pret: true }));
  const l = [...paiements, ...prets].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
  if (!l.length) return null;
  const sorties = [...paiements, ...prets].reduce((s, x) => s + (x.montant < 0 ? -x.montant : 0), 0);
  return (
    <Panel title="À venir" count={`14 j`}>
      {l.map((x, i) => (
        <View key={x.id}>
          {i ? <Sep /> : null}
          <Pressable accessibilityRole={x.pret ? 'button' : undefined} disabled={!x.pret} onPress={onVoirPrets} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <Text style={{ fontSize: 16 }}>{x.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
                {x.titre}
              </Text>
              <T small muted>
                {x.date === addDays(d, 1) ? 'Demain' : fmtCourt(x.date)}
              </T>
            </View>
            <Text style={{ color: x.montant < 0 ? C.ink : C.coach, fontFamily: F.chiffre, fontSize: 14 }}>
              {x.montant < 0 ? '−' : '+'}
              {fmtMontant(Math.abs(x.montant), f.devise)}
            </Text>
          </Pressable>
        </View>
      ))}
      <T small muted>
        {fmtMontant(sorties, f.devise)} à prévoir sur 14 jours. Me te prévient la veille de chaque paiement.
      </T>
    </Panel>
  );
}

const moisDe = (s: string) => s.slice(0, 7);
const ecart = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

/** Le bilan d'un mois : dépensé, reçu, mis de côté, les postes et l'écart avec le mois d'avant. */
export function BilanDuMois({ f, mois: impose }: { f: Finances; /** Mois « AAAA-MM » affiché par l'écran (vue Mois) : le bilan le suit, sans ses propres flèches. */ mois?: string }) {
  const { finances, espace } = useStore();
  const d = today();
  // Les premiers jours du mois, le bilan utile est celui du mois qui vient de finir.
  const [choisi, setMois] = useState(() => (Number(d.slice(8, 10)) <= 5 ? moisPrecedent(moisDe(d)) : moisDe(d)));
  const mois = impose ?? choisi;
  const b = useMemo(() => bilanMois(f, mois), [f, mois]);
  const cats = useMemo(() => new Map(categoriesDe(espace).map((c) => [c.id, `${c.emoji} ${c.nom}`])), [espace]);
  if (!finances) return <ReserveFinances fonction="bilan" />;
  // Rien de noté du tout : les statistiques disent déjà comment commencer.
  if (!f.depenses.length && !f.revenus?.length) return null;
  const suivant = (() => {
    const x = new Date(`${mois}-15T00:00:00Z`);
    x.setUTCMonth(x.getUTCMonth() + 1);
    return x.toISOString().slice(0, 7);
  })();
  const evolution = ecart(b.depenses, b.precedent.depenses);
  return (
    <Panel
      title={`Bilan de ${moisDit(mois)}`}
      right={
        impose ? undefined : <View style={{ flexDirection: 'row', gap: 6 }}>
          <Btn small kind="sec" label="‹" onPress={() => setMois(moisPrecedent(mois))} />
          <Btn small kind="sec" label="›" disabled={suivant > moisDe(d)} onPress={() => setMois(suivant)} />
        </View>
      }>
      {!b.operations ? (
        <Empty icone="portefeuille">Aucune opération notée en {moisDit(mois)}.</Empty>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chiffre titre="Dépensé" valeur={fmtMontant(b.depenses, f.devise)} />
            <Chiffre titre="Reçu" valeur={fmtMontant(b.revenus, f.devise)} />
            <Chiffre titre={b.solde >= 0 ? 'Mis de côté' : 'Dépensé en trop'} valeur={fmtMontant(Math.abs(b.solde), f.devise)} couleur={b.solde >= 0 ? C.coach : C.agressif} />
          </View>
          {evolution !== null ? (
            <T small style={{ color: evolution <= 0 ? C.coach : C.hebdo }}>
              {evolution === 0 ? 'Autant de dépenses' : `${Math.abs(evolution)} % de dépenses ${evolution < 0 ? 'en moins' : 'en plus'}`} qu’en {moisDit(moisPrecedent(mois))} ({fmtMontant(b.precedent.depenses, f.devise)}).
            </T>
          ) : null}
          {b.categories.length ? (
            <View style={{ gap: 8 }}>
              <T small muted>
                Où est parti l’argent
              </T>
              {b.categories.slice(0, 5).map((c) => (
                <View key={c.categorie} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
                      {cats.get(c.categorie) ?? c.categorie}
                    </Text>
                    <Text style={{ color: C.muted, fontFamily: F.chiffre, fontSize: 14 }}>
                      {fmtMontant(c.montant, f.devise)} · {c.part} %
                    </Text>
                  </View>
                  <Jauge ratio={c.part / 100} hauteur={6} couleur={C.accent} />
                </View>
              ))}
            </View>
          ) : null}
          {b.plusGrosse ? (
            <T small muted>
              Plus grosse dépense : {b.plusGrosse.note || 'sans note'}, {fmtMontant(b.plusGrosse.montant, f.devise)} le {fmtCourt(b.plusGrosse.date)}.
            </T>
          ) : null}
          <T small muted>
            Le 1er de chaque mois, Me t’envoie ce bilan (réglable dans les alertes des finances).
          </T>
        </>
      )}
    </Panel>
  );
}
