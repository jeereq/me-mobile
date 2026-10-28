import { Platform, Switch, Text, View } from 'react-native';

import { Jauge } from '@/components/jauge';
import { Panel, Sep, Seg, T } from '@/components/ui';
import { fmtMontant } from '@/lib/finances';
import { HORIZONS, previsions, type Etat } from '@/lib/previsions';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { AlertesFinances, Finances, Horizon } from '@/lib/types';

const ETAT: Record<Etat, { icone: string; texte: string; couleur: () => string }> = {
  ok: { icone: '✓', texte: 'Dans le budget', couleur: () => C.coach },
  risque: { icone: '⚠', texte: 'À surveiller', couleur: () => C.hebdo },
  depasse: { icone: '⛔', texte: 'Dépassé', couleur: () => C.agressif },
};

/** Pastille d'état : icône et mot en plus de la couleur. */
function Statut({ etat }: { etat: Etat }) {
  const e = ETAT[etat];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: alpha(e.couleur(), 0.14) }}>
      <Text style={{ color: e.couleur(), fontSize: 11 }}>{e.icone}</Text>
      <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 12 }}>{e.texte}</Text>
    </View>
  );
}

/** Pour chaque durée de budget (jour, semaine, mois…) : montant, dépenses notées, reste et état. Rien n'est projeté. */
export function PanneauPrevisions({ f, d, seuil }: { f: Finances; d: string; seuil: number }) {
  const l = previsions(f, d, seuil);
  if (!l.length) return null;
  return (
    <Panel title="Où en sont mes budgets">
      <T small muted>
        Chaque budget sur sa période : son montant moins les dépenses que tu as notées dedans.
      </T>
      {l.map((p, i) => {
        const h = HORIZONS.find((x) => x.key === p.horizon)!;
        const ratio = p.plafond ? p.depense / p.plafond : p.depense ? 1.01 : 0;
        return (
          <View key={p.horizon} style={{ gap: 6 }}>
            {i ? <Sep /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T style={{ flex: 1, fontFamily: F.texteF }}>{h.label}</T>
              <Statut etat={p.etat} />
            </View>
            <Jauge ratio={ratio} />
            <T small muted>
              {`${fmtMontant(p.depense, f.devise)} dépensés sur ${fmtMontant(p.plafond, f.devise)}`}
              {p.reste >= 0 ? ` · reste ${fmtMontant(p.reste, f.devise)}` : ` · dépassé de ${fmtMontant(-p.reste, f.devise)}`}
            </T>
            {p.budgets.length ? (
              <T small muted>
                À surveiller : {p.budgets.slice(0, 3).map((b) => `${b.emoji} ${b.nom}`).join(', ')}
              </T>
            ) : null}
          </View>
        );
      })}
    </Panel>
  );
}

function Ligne({ titre, desc, on, onChange, disabled }: { titre: string; desc?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 2 }}>
      <View style={{ flex: 1 }}>
        <T>{titre}</T>
        {desc ? (
          <T small muted>
            {desc}
          </T>
        ) : null}
      </View>
      <Switch value={on && !disabled} disabled={disabled} onValueChange={onChange} trackColor={{ true: C.accent, false: C.line }} thumbColor={Platform.OS === 'android' ? C.ink : undefined} accessibilityLabel={titre} />
    </View>
  );
}

const HEURES = ['08:00', '12:00', '18:00', '19:00', '20:00', '21:00'];
// « 08:00 » → « 8 h », « 19:30 » → « 19 h 30 ».
const fmtHeure = (h: string) => h.replace(/^0/, '').replace(':00', ' h').replace(':', ' h ');

/** Réglages des alertes de prévision, envoyées par le serveur. */
export function PanneauAlertes({ f, setF }: { f: Finances; setF: (fn: (f: Finances) => Finances) => void }) {
  const { mode, config, notifs } = useStore();
  const a = f.alertes || {};
  const set = (patch: Partial<AlertesFinances>) => setF((g) => ({ ...g, alertes: { ...g.alertes, ...patch } }));
  const setH = (h: Horizon, v: boolean) => setF((g) => ({ ...g, alertes: { ...g.alertes, horizons: { ...g.alertes?.horizons, [h]: v } } }));
  const heure = a.heure || config.rappelSoir;
  const heures = HEURES.includes(heure) ? HEURES : [...HEURES, heure].sort();
  const serveur = mode === 'cloud';

  return (
    <Panel title="Alertes de budget">
      <T small muted>
        {serveur
          ? 'Une alerte part une seule fois par période : quand tes dépenses notées approchent un budget, puis s’il est dépassé. Elle arrive dans la cloche, et en push ou par email selon tes choix.'
          : 'Les alertes partent de ton serveur me-api : connecte un compte pour les recevoir. Les prévisions restent visibles ici.'}
      </T>
      {HORIZONS.map((h) => (
        <Ligne key={h.key} titre={`Budget ${h.titre}`} on={a.horizons?.[h.key] !== false} onChange={(v) => setH(h.key, v)} disabled={!serveur} />
      ))}
      <Seg
        label="Prévenir"
        options={[
          { key: '0.8', label: 'Dès 80 %' },
          { key: '0.9', label: 'Dès 90 %' },
          { key: '1', label: 'Au dépassement' },
        ]}
        value={String(a.seuil ?? 1)}
        onChange={(k) => set({ seuil: Number(k) })}
      />
      <Seg label="Heure de l'alerte" options={heures.map((x) => ({ key: x, label: fmtHeure(x) }))} value={heure} onChange={(k) => set({ heure: k })} />
      <Ligne titre="Reste des budgets le matin" desc={`Dans le briefing de ${fmtHeure(config.routineHeure)}`} on={a.matin !== false} onChange={(v) => set({ matin: v })} disabled={!serveur} />
      <Ligne titre="Rappels des objectifs" desc="Versement prévu, retard sur le plan, échéance passée, objectif atteint" on={a.objectifs !== false} onChange={(v) => set({ objectifs: v })} disabled={!serveur} />
      <Ligne titre="Notification push" desc="Sur les appareils où tu as activé le push (Mon compte)" on={a.push !== false} onChange={(v) => set({ push: v })} disabled={!serveur} />
      <Ligne titre="Email" desc={notifs.email ? 'Si les rappels par email sont activés (Mon compte)' : "L'email n'est pas configuré sur le serveur"} on={a.email !== false} onChange={(v) => set({ email: v })} disabled={!serveur || !notifs.email} />
    </Panel>
  );
}
