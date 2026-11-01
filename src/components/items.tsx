import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { SOURCE_DEFS } from '@/lib/defaults';
import { addDays, doneIn, fmtCourt, habitWhen, streak, today } from '@/lib/dates';
import { useActions } from '@/lib/actions';
import { etatRelance } from '@/lib/suivi';
import { teinteDe } from '@/lib/teinte';
import { useStore } from '@/lib/store';
import { C, F, MODE_COLORS, MONO } from '@/lib/theme';
import type { Habitude, Relance, SourceKey, Tache } from '@/lib/types';

import { EtiquettesCategories } from './categories';
import { EtiquetteCR } from './comptes-rendus';
import { DetailTache } from './detail-tache';
import { FicheRelance, FicheTache } from './fiches';
import { ChoisirMail, MailDeLElement } from './lien-mail';
import { PuceResponsable } from './responsable';
import { Btn, Check, couleur, IconBtn, Meta, ModeChip, Row, T, Tag } from './ui';

/** Source d'un élément importé (Gmail, Outlook…), à la couleur choisie dans Agendas & outils. */
function SourceTag({ k }: { k?: SourceKey }) {
  const { espace } = useStore();
  if (!k) return null;
  return <Tag label={SOURCE_DEFS[k]?.nom || k} color={couleur(espace.sources[k]?.couleur || SOURCE_DEFS[k]?.couleur)} />;
}

function Ouvrir({ lien }: { lien?: string }) {
  if (!lien) return null;
  return <IconBtn label="Ouvrir l'original" glyph="↗" onPress={() => Linking.openURL(lien).catch(() => {})} />;
}

function Echeance({ date, prefix }: { date?: string | null; prefix: string }) {
  if (!date) return null;
  const d = today();
  const late = date < d;
  return (
    <Text style={{ fontFamily: MONO, fontSize: 12, color: late ? C.agressif : C.muted }}>
      {prefix}
      {date === d ? "aujourd'hui" : fmtCourt(date)}
      {late ? ' · en retard' : ''}
    </Text>
  );
}

/** La note d'une relance ou d'une tâche, en deux lignes sous ses étiquettes. */
function Note({ texte }: { texte: string }) {
  return (
    <Text numberOfLines={2} style={{ marginTop: 4, color: C.muted, fontFamily: F.texte, fontSize: 13, lineHeight: 18 }}>
      {texte}
    </Text>
  );
}

/** « Lier à un mail » : une enveloppe, quand l'élément n'a pas encore de mail et que la boîte de Me en a. */
function BoutonLierMail({ onPress }: { onPress: () => void }) {
  const { mails } = useStore();
  if (!mails.length) return null;
  return <IconBtn label="Lier à un mail" glyph="✉" onPress={onPress} />;
}

/** Les relances déjà faites, en petits points (trois au plus, le dernier creux pour celle qui vient). */
function PointsRelances({ n }: { n: number }) {
  if (!n) return null;
  const vus = Math.min(n, 3);
  return (
    <View accessible accessibilityLabel={`Relancé ${n} fois`} style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: vus }, (_, i) => (
        <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.agressif }} />
      ))}
      {n > 3 ? <Text style={{ color: C.agressif, fontFamily: F.texteF, fontSize: 11 }}>+{n - 3}</Text> : null}
    </View>
  );
}

/**
 * Une relance : cocher = la personne a répondu. Quand son jour est venu, un seul bouton, « Relancer »,
 * qui ouvre le message rédigé par Me. Toucher la ligne ouvre la fiche (reporter, modifier, historique).
 */
export function RelanceItem({ r, compact }: { r: Relance; compact?: boolean }) {
  const { basculerRelance } = useActions();
  const [choisir, setChoisir] = useState(false);
  const [fiche, setFiche] = useState(false);
  const done = r.statut === 'repondu';
  const etat = etatRelance(r, today());
  const aRelancer = etat.niveau === 'retard' || etat.niveau === 'jour';
  const couleurEtat = etat.niveau === 'retard' ? C.agressif : etat.niveau === 'jour' ? teinteDe('/relances') : C.muted;
  return (
    <View>
      <Row>
        <Check checked={done} label={done ? `${r.contact} a répondu` : `${r.contact} a répondu ?`} onToggle={() => basculerRelance(r)} />
        <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir la relance ${r.contact}, ${r.sujet}. ${etat.texte}`} onPress={() => setFiche(true)} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}>
          <T strike={done}>
            <Text style={{ fontFamily: F.texteF }}>{r.contact}</Text> · {r.sujet}
          </T>
          <Meta>
            <Text style={{ color: couleurEtat, fontFamily: F.texteM, fontSize: 12.5 }}>{etat.texte}</Text>
            <Tag label={r.boite === 'pro' ? 'Pro' : 'Perso'} />
            <SourceTag k={r.ext} />
            <EtiquettesCategories ids={r.categories} />
            <PuceResponsable t={r} fait={done} genre="relance" />
            {r.mode !== 'normal' ? <ModeChip mode={r.mode} /> : null}
            {!done ? <PointsRelances n={r.nbRelances ?? 0} /> : null}
            <EtiquetteCR genre="relance" id={r.id} origine={r.compteRendu} />
          </Meta>
          {r.note && !compact ? <Note texte={r.note} /> : null}
        </Pressable>
        {choisir ? <ChoisirMail genre="relance" x={r} onFermer={() => setChoisir(false)} /> : null}
        {fiche ? <FicheRelance r={r} onFermer={() => setFiche(false)} /> : null}
        {r.mail ? null : <Ouvrir lien={r.lien} />}
        {aRelancer && !done ? <Btn small label="Relancer" couleur={teinteDe('/relances')} onPress={() => router.push({ pathname: '/brouillon', params: { id: r.id } })} /> : null}
        {!compact && !r.mail && !aRelancer ? <BoutonLierMail onPress={() => setChoisir(true)} /> : null}
      </Row>
      <View style={{ paddingLeft: 38 }}>
        <MailDeLElement genre="relance" x={r} compact={compact} />
      </View>
    </View>
  );
}

export function TacheItem({ t, compact }: { t: Tache; compact?: boolean }) {
  const { update } = useStore();
  const { basculerTache } = useActions();
  const [choisir, setChoisir] = useState(false);
  const [fiche, setFiche] = useState(false);
  const [detail, setDetail] = useState(false);
  const done = t.statut === 'fait';
  return (
    <Row>
      <Check
        checked={done}
        label="Fait"
        onToggle={() => basculerTache(t)}
      />
      <View style={{ flex: 1 }}>
        {/* Toucher le titre ouvre le détail : responsable, échéance, note et mail d'origine. */}
        <Pressable accessibilityRole="button" accessibilityLabel={`Voir le détail de ${t.titre}`} onPress={() => setDetail(true)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <T strike={done}>{t.titre}</T>
        </Pressable>
        <Meta>
          {t.source !== 'manuel' ? <Tag label={t.source === 'pro' ? 'Pro' : 'Perso'} /> : null}
          <SourceTag k={t.ext} />
          <EtiquettesCategories ids={t.categories} />
          {t.priorite === 'haute' && !done ? <Text style={{ color: C.agressif, fontFamily: F.texteF, fontSize: 12.5 }}>Importante</Text> : null}
          {!done ? <Echeance date={t.echeance} prefix="Pour " /> : null}
          <PuceResponsable t={t} fait={done} />
          <ModeChip mode={t.mode} />
          <EtiquetteCR genre="tache" id={t.id} origine={t.compteRendu} />
        </Meta>
        {t.note ? <Note texte={t.note} /> : null}
        {t.projet ? null : <MailDeLElement genre="tache" x={t} compact={compact} />}
      </View>
      {choisir ? <ChoisirMail genre="tache" x={t} onFermer={() => setChoisir(false)} /> : null}
      {fiche ? <FicheTache t={t} onFermer={() => setFiche(false)} /> : null}
      {detail ? <DetailTache id={t.id} onFermer={() => setDetail(false)} /> : null}
      {t.mail ? null : <Ouvrir lien={t.lien} />}
      {!compact && !t.mail && !t.projet ? <BoutonLierMail onPress={() => setChoisir(true)} /> : null}
      {/* Une tâche de projet se modifie dans son projet, avec le planning. */}
      {!compact ? <IconBtn label="Modifier la tâche" glyph="⋯" onPress={() => (t.projet ? router.push({ pathname: '/projets', params: { id: t.projet } }) : setFiche(true))} /> : null}
      {!compact ? <IconBtn label="Supprimer" glyph="×" danger onPress={() => update((e) => ({ ...e, taches: e.taches.filter((x) => x.id !== t.id) }))} /> : null}
    </Row>
  );
}

/** Les 7 derniers jours d'une habitude quotidienne, du plus ancien à aujourd'hui. */
function Semaine({ h, d }: { h: Habitude; d: string }) {
  const jours = Array.from({ length: 7 }, (_, i) => addDays(d, i - 6));
  const col = MODE_COLORS[h.mode];
  return (
    <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }} accessibilityLabel={`${jours.filter((j) => h.coches.includes(j)).length} jours sur les 7 derniers`}>
      {jours.map((j) => {
        const fait = h.coches.includes(j);
        return <View key={j} style={{ width: j === d ? 10 : 7, height: 7, borderRadius: 4, backgroundColor: fait ? col : 'transparent', borderWidth: 1, borderColor: fait ? col : C.line }} />;
      })}
    </View>
  );
}

export function HabitudeItem({ h, onEdit }: { h: Habitude; onEdit?: () => void }) {
  const { basculerHabitude } = useActions();
  const d = today();
  const done = doneIn(h, d);
  const st = streak(h, d);
  const unit = h.frequence === 'mensuel' ? 'mois' : h.frequence === 'hebdo' ? 'sem.' : 'j';
  const toggle = () => basculerHabitude(h);
  return (
    <Row>
      <Check checked={done} label="Fait pour cette période" onToggle={toggle} />
      <View style={{ flex: 1 }}>
        <T strike={done}>{h.nom}</T>
        <Meta>
          <T small muted>
            {habitWhen(h)}
          </T>
          <EtiquettesCategories ids={h.categories} />
          <ModeChip mode={h.mode} />
          {st ? <Text style={{ fontFamily: F.texteF, fontSize: 12, color: C.coach }}>🔥 {st} {unit}</Text> : null}
        </Meta>
        {h.frequence === 'quotidien' ? <View style={{ marginTop: 6 }}><Semaine h={h} d={d} /></View> : null}
      </View>
      {onEdit ? <IconBtn label="Modifier" glyph="⋯" onPress={onEdit} /> : null}
    </Row>
  );
}
