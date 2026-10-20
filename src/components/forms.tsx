import { View } from 'react-native';

import { addDays, fmtCourt, today } from '@/lib/dates';
import { MODE_COLORS } from '@/lib/theme';
import { MODE_LABELS, MODES, type Config, type Mode } from '@/lib/types';

import { Seg } from './ui';

/** Choix de date rapide, sans clavier : aujourd'hui, demain, +3 j, +1 sem., +1 mois. */
export function DatePick({ value, onChange, label, allowNone }: { value: string | null; onChange: (d: string | null) => void; label: string; allowNone?: boolean }) {
  const d = today();
  const opts = [
    ...(allowNone ? [{ key: '', label: 'Sans date' }] : []),
    { key: d, label: "Aujourd'hui" },
    { key: addDays(d, 1), label: 'Demain' },
    { key: addDays(d, 3), label: `${fmtCourt(addDays(d, 3))}` },
    { key: addDays(d, 7), label: '+1 sem.' },
    { key: addDays(d, 30), label: '+1 mois' },
  ];
  return <Seg label={label} options={opts} value={value || ''} onChange={(k) => onChange(k || null)} />;
}

export function ModePick({ value, onChange, config, label = 'Mode de rappel' }: { value: Mode; onChange: (m: Mode) => void; config: Config; label?: string }) {
  const actifs = MODES.filter((m) => config.modes[m]?.actif !== false);
  return (
    <View>
      <Seg label={label} options={actifs.map((m) => ({ key: m, label: MODE_LABELS[m] }))} value={value} onChange={onChange} colors={MODE_COLORS} />
    </View>
  );
}
