import { useState } from 'react';
import { View } from 'react-native';

import { addDays, fmtCourt, today } from '@/lib/dates';
import { MODE_COLORS } from '@/lib/theme';
import { MODE_LABELS, MODES, type Config, type Mode } from '@/lib/types';

import { ChampDate } from './calendrier';
import { Seg } from './ui';

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

export function ModePick({ value, onChange, config, label = 'Mode de rappel' }: { value: Mode; onChange: (m: Mode) => void; config: Config; label?: string }) {
  const actifs = MODES.filter((m) => config.modes[m]?.actif !== false);
  return (
    <View>
      <Seg label={label} options={actifs.map((m) => ({ key: m, label: MODE_LABELS[m] }))} value={value} onChange={onChange} colors={MODE_COLORS} />
    </View>
  );
}
