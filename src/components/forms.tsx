import { useState, type ReactNode } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { addDays, fmtCourt, today } from '@/lib/dates';
import { C, F, MODE_COLORS } from '@/lib/theme';
import { MODE_LABELS, MODES, type Config, type Mode } from '@/lib/types';

import { ChampDate } from './calendrier';
import { Pliable } from './pliable';
import { Seg, tap } from './ui';

/**
 * Choix de date rapide, sans clavier : aujourd'hui, demain, +3 j, +1 sem., +1 mois, ou « Autre date… »
 * qui ouvre le calendrier. Une date hors des raccourcis s'affiche à leur suite, choisie.
 */
export function DatePick({ value, onChange, label, allowNone }: { value: string | null; onChange: (d: string | null) => void; label: string; allowNone?: boolean }) {
  const d = today();
  const [calendrier, setCalendrier] = useState(false);
  const opts = [
    ...(allowNone ? [{ key: '', label: 'Sans date' }] : []),
    { key: d, label: "Aujourd'hui" },
    { key: addDays(d, 1), label: 'Demain' },
    { key: addDays(d, 3), label: `${fmtCourt(addDays(d, 3))}` },
    { key: addDays(d, 7), label: '+1 sem.' },
    { key: addDays(d, 30), label: '+1 mois' },
  ];
  const autre = !!value && !opts.some((o) => o.key === value);
  const choix = [...opts, autre ? { key: AUTRE, label: `📅 ${fmtCourt(value)}` } : { key: AUTRE, label: 'Autre date…' }];
  return (
    <View style={{ gap: 8 }}>
      <Seg label={label} options={choix} value={autre || calendrier ? AUTRE : value || ''} onChange={(k) => (k === AUTRE ? setCalendrier(!calendrier) : (setCalendrier(false), onChange(k || null)))} />
      {/* En ligne : la base de 220 du champ est une largeur, pas une hauteur. */}
      {calendrier ? (
        <View style={{ flexDirection: 'row' }}>
          <ChampDate key={value ?? ''} label="Choisis le jour" value={autre ? value : null} onChange={(x) => (x && onChange(x), setCalendrier(false))} ouvert />
        </View>
      ) : null}
    </View>
  );
}

const AUTRE = '__autre';

/** Les trois tons proposés d'emblée ; Coach et Bilan hebdo restent à un geste, sous « Autres rappels ». */
const TONS: Mode[] = ['passif', 'normal', 'agressif'];

/**
 * Le ton des rappels : Doux, Normal ou Ferme. Les autres modes (Coach, Bilan hebdo) s'ouvrent à la demande,
 * et restent affichés si l'élément en utilise déjà un.
 */
export function ModePick({ value, onChange, config, label = 'Ton des rappels' }: { value: Mode; onChange: (m: Mode) => void; config: Config; label?: string }) {
  const actifs = MODES.filter((m) => config.modes[m]?.actif !== false);
  const autres = actifs.filter((m) => !TONS.includes(m));
  const [tout, setTout] = useState(!TONS.includes(value));
  const visibles = tout ? actifs : actifs.filter((m) => TONS.includes(m));
  return (
    <View style={{ gap: 6 }}>
      <Seg label={label} options={visibles.map((m) => ({ key: m, label: MODE_LABELS[m] }))} value={value} onChange={onChange} colors={MODE_COLORS} />
      {autres.length && !tout ? (
        <Pressable accessibilityRole="button" onPress={() => (tap(), setTout(true))} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
          <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>Autres rappels ({autres.map((m) => MODE_LABELS[m]).join(', ')})</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** « Importante » : un seul interrupteur à la place des trois niveaux de priorité. Elle remonte en haut de la liste. */
export function Importante({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>Importante</Text>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>Passe en haut de la liste</Text>
      </View>
      <Switch accessibilityLabel="Importante" value={value} onValueChange={(v) => (tap(), onChange(v))} trackColor={{ true: C.agressif, false: C.line }} thumbColor={C.ink} />
    </View>
  );
}

/** Ce qui sert moins souvent (note, catégories, confier, rappels) : replié sous « Plus d'options ». */
export function PlusOptions({ resume, ouvert, children }: { resume?: string; ouvert?: boolean; children: ReactNode }) {
  return (
    <Pliable titre={resume ? `Plus d'options · ${resume}` : "Plus d'options"} ouvert={ouvert} couleur={C.muted}>
      {children}
    </Pliable>
  );
}
