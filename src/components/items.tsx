import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { doneIn, fmtCourt, habitWhen, periodKey, streak, today } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C, MONO } from '@/lib/theme';
import type { Habitude, Relance, Tache } from '@/lib/types';

import { Check, IconBtn, Meta, ModeChip, Row, Seg, T, Tag } from './ui';

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
  const set = (patch: Partial<Relance>) => update((e) => ({ ...e, relances: e.relances.map((x) => (x.id === r.id ? { ...x, ...patch } : x)) }));
  const done = r.statut === 'repondu';
  return (
    <View>
      <Row>
        <Check checked={done} label="Répondu" onToggle={() => set({ statut: done ? 'a_faire' : 'repondu' })} />
        <View style={{ flex: 1 }}>
          <T strike={done}>
            {r.contact} · {r.sujet}
          </T>
          <Meta>
            <Tag label={r.boite === 'pro' ? 'Pro' : 'Perso'} />
            {!done ? <Echeance date={r.date} prefix="Relancer " /> : null}
            <ModeChip mode={r.mode} />
            {r.statut === 'relance' ? <T small muted>Relancé</T> : null}
          </Meta>
        </View>
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
            onChange={(statut) => set({ statut })}
          />
        </View>
      ) : null}
    </View>
  );
}

export function TacheItem({ t, compact }: { t: Tache; compact?: boolean }) {
  const { update } = useStore();
  const done = t.statut === 'fait';
  return (
    <Row>
      <Check
        checked={done}
        label="Fait"
        onToggle={() =>
          update((e) => ({ ...e, taches: e.taches.map((x) => (x.id === t.id ? { ...x, statut: done ? 'en_attente' : 'fait', faitLe: done ? null : today() } : x)) }))
        }
      />
      <View style={{ flex: 1 }}>
        <T strike={done}>{t.titre}</T>
        <Meta>
          {t.source !== 'manuel' ? <Tag label={t.source === 'pro' ? 'Pro' : 'Perso'} /> : null}
          <T small muted>
            Priorité {t.priorite}
          </T>
          {!done ? <Echeance date={t.echeance} prefix="Pour " /> : null}
          <ModeChip mode={t.mode} />
        </Meta>
      </View>
      {!compact ? <IconBtn label="Supprimer" glyph="×" danger onPress={() => update((e) => ({ ...e, taches: e.taches.filter((x) => x.id !== t.id) }))} /> : null}
    </Row>
  );
}

export function HabitudeItem({ h, onEdit }: { h: Habitude; onEdit?: () => void }) {
  const { update } = useStore();
  const d = today();
  const done = doneIn(h, d);
  const st = streak(h, d);
  const unit = h.frequence === 'mensuel' ? 'mois' : h.frequence === 'hebdo' ? 'sem.' : 'j';
  const toggle = () =>
    update((e) => ({
      ...e,
      habitudes: e.habitudes.map((x) => {
        if (x.id !== h.id) return x;
        const coches = x.coches.filter((c) => periodKey(x.frequence, c) !== periodKey(x.frequence, d));
        if (!done) coches.push(d);
        return { ...x, coches: coches.sort().slice(-180) };
      }),
    }));
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
          {st ? <Text style={{ fontFamily: MONO, fontSize: 12, color: C.coach }}>série {st} {unit}</Text> : null}
        </Meta>
      </View>
      {onEdit ? <IconBtn label="Modifier" glyph="⋯" onPress={onEdit} /> : null}
    </Row>
  );
}
