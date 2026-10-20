import { router } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { SOURCE_DEFS } from '@/lib/defaults';
import { addDays, doneIn, fmtCourt, habitWhen, streak, today } from '@/lib/dates';
import { useActions } from '@/lib/actions';
import { useStore } from '@/lib/store';
import { C, F, MODE_COLORS, MONO } from '@/lib/theme';
import type { Habitude, Relance, SourceKey, Tache } from '@/lib/types';

import { Check, couleur, IconBtn, Meta, ModeChip, Row, Seg, T, Tag } from './ui';

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

export function RelanceItem({ r, compact }: { r: Relance; compact?: boolean }) {
  const { update } = useStore();
  const { basculerRelance, statutRelance } = useActions();
  const done = r.statut === 'repondu';
  return (
    <View>
      <Row>
        <Check
          checked={done}
          label="Répondu"
          onToggle={() => basculerRelance(r)}
        />
        <View style={{ flex: 1 }}>
          <T strike={done}>
            {r.contact} · {r.sujet}
          </T>
          <Meta>
            <Tag label={r.boite === 'pro' ? 'Pro' : 'Perso'} />
            <SourceTag k={r.ext} />
            {!done ? <Echeance date={r.date} prefix="Relancer " /> : null}
            <ModeChip mode={r.mode} />
            {r.statut === 'relance' ? <T small muted>Relancé</T> : null}
          </Meta>
        </View>
        <Ouvrir lien={r.lien} />
        <IconBtn label="Rédiger la relance avec l'IA" glyph="✎" onPress={() => router.push({ pathname: '/brouillon', params: { id: r.id } })} />
        {!compact ? <IconBtn label="Supprimer" glyph="×" danger onPress={() => update((e) => ({ ...e, relances: e.relances.filter((x) => x.id !== r.id) }))} /> : null}
      </Row>
      {!compact && !done ? (
        <View style={{ paddingLeft: 38, paddingBottom: 6 }}>
          <Seg
            options={[
              { key: 'a_faire', label: 'À faire' },
              { key: 'relance', label: 'Relancé' },
              { key: 'repondu', label: 'Répondu' },
            ]}
            value={r.statut}
            onChange={(statut) => statutRelance(r, statut)}
          />
        </View>
      ) : null}
    </View>
  );
}

export function TacheItem({ t, compact }: { t: Tache; compact?: boolean }) {
  const { update } = useStore();
  const { basculerTache } = useActions();
  const done = t.statut === 'fait';
  return (
    <Row>
      <Check
        checked={done}
        label="Fait"
        onToggle={() => basculerTache(t)}
      />
      <View style={{ flex: 1 }}>
        <T strike={done}>{t.titre}</T>
        <Meta>
          {t.source !== 'manuel' ? <Tag label={t.source === 'pro' ? 'Pro' : 'Perso'} /> : null}
          <SourceTag k={t.ext} />
          <T small muted>
            Priorité {t.priorite}
          </T>
          {!done ? <Echeance date={t.echeance} prefix="Pour " /> : null}
          <ModeChip mode={t.mode} />
        </Meta>
      </View>
      <Ouvrir lien={t.lien} />
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
          <ModeChip mode={h.mode} />
          {st ? <Text style={{ fontFamily: F.texteF, fontSize: 12, color: C.coach }}>🔥 {st} {unit}</Text> : null}
        </Meta>
        {h.frequence === 'quotidien' ? <View style={{ marginTop: 6 }}><Semaine h={h} d={d} /></View> : null}
      </View>
      {onEdit ? <IconBtn label="Modifier" glyph="⋯" onPress={onEdit} /> : null}
    </Row>
  );
}
