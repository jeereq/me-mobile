import { useState } from 'react';
import { View } from 'react-native';

import { Barres, Part, Tuile } from '@/components/graphiques';
import { Collant, Empty, Header, Panel, Screen, Sep, T } from '@/components/ui';
import { Filtre } from '@/components/onglets';
import { today } from '@/lib/dates';
import { fmtMontant } from '@/lib/finances';
import { statistiques } from '@/lib/stats';
import { useStore } from '@/lib/store';

const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)} %`);
const jrs = (x: number | null) => (x === null ? '–' : x < 1 ? "moins d'un jour" : `${Math.round(x)} jour${Math.round(x) > 1 ? 's' : ''}`);

/** « +3 », « −12 % »… par rapport à la période d'avant, ou rien si on n'a pas de point de comparaison. */
function evolution(v: number | null, avant: number | null, jours: number, mode: 'nombre' | 'taux' = 'nombre', format: (n: number) => string = (n) => n.toLocaleString('fr-FR')) {
  if (v === null || avant === null) return undefined;
  const suffixe = ` vs les ${jours} j d'avant`;
  if (mode === 'taux') {
    const e = Math.round((v - avant) * 100);
    return e ? `${e > 0 ? '+' : '−'}${Math.abs(e)} %${suffixe}` : `stable${suffixe}`;
  }
  const e = Math.round((v - avant) * 100) / 100;
  return e ? `${e > 0 ? '+' : '−'}${format(Math.abs(e))}${suffixe}` : `stable${suffixe}`;
}

export default function Statistiques() {
  const { espace } = useStore();
  const [jours, setJours] = useState(30);
  const s = statistiques(espace, today(), jours);
  const t = s.tuiles;
  const maxRep = Math.max(1, ...s.repartition.map((x) => x.v));
  const totalRep = s.repartition.reduce((a, x) => a + x.v, 0);

  return (
    <Screen>
      <Header retour eyebrow={`Les ${jours} derniers jours`} title="Statistiques" />
      <Collant>
        <Filtre
          label="Période des statistiques"
          options={[
            { key: '7', label: '7 jours' },
            { key: '30', label: '30 jours' },
            { key: '90', label: '90 jours' },
          ]}
          value={String(jours)}
          onChange={(k) => setJours(Number(k))}
        />
      </Collant>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Tuile emoji="✅" titre="tâches terminées" valeur={String(t.taches.v)} evolution={evolution(t.taches.v, t.taches.avant, jours)} />
        <Tuile emoji="📨" titre="relances abouties" valeur={String(t.relances.v)} evolution={evolution(t.relances.v, t.relances.avant, jours)} />
        <Tuile emoji="🌱" titre="habitudes tenues" valeur={pct(t.habitudes.v)} evolution={evolution(t.habitudes.v, t.habitudes.avant, jours, 'taux')} />
        <Tuile emoji="📅" titre={`jours actifs sur ${jours}`} valeur={String(t.actifs.v)} evolution={evolution(t.actifs.v, t.actifs.avant, jours)} />
        <Tuile emoji="✨" titre="points gagnés" valeur={String(t.points.v)} evolution={evolution(t.points.v, t.points.avant, jours)} />
        <Tuile emoji="💸" titre="dépensés" valeur={fmtMontant(t.depenses.v, s.devise)} evolution={evolution(t.depenses.v, t.depenses.avant, jours, 'nombre', (n) => fmtMontant(n, s.devise))} />
      </View>

      <Panel title="Points par semaine">
        <Barres points={s.pointsSemaines} />
        <T small muted>
          Série en cours : {s.serie} jour{s.serie > 1 ? 's' : ''} · record : {s.record} jour{s.record > 1 ? 's' : ''}
          {s.meilleurJour ? ` · ton jour le plus actif : le ${s.meilleurJour}` : ''}
          {s.moment ? `, plutôt ${s.moment.nom === 'après-midi' ? "l'après-midi" : `le ${s.moment.nom}`} (${pct(s.moment.part)} de tes actions)` : ''}.
        </T>
      </Panel>

      <Panel title="Tâches terminées par semaine">
        <Barres points={s.tachesSemaines} />
        <T small muted>
          {s.tachesOuvertes} tâche{s.tachesOuvertes > 1 ? 's' : ''} en cours, dont {s.tachesEnRetard} en retard · délai moyen entre l'ajout et la fin : {jrs(s.delaiTache)}.
        </T>
      </Panel>

      <Panel title={`Habitudes sur ${jours} jours`}>
        {s.habitudes.length ? (
          s.habitudes.map((h, i) => (
            <View key={h.id} style={{ gap: 6 }}>
              {i ? <Sep /> : null}
              <Part libelle={h.nom} valeur={`${pct(h.taux)} · ${h.tenus}/${h.prevus}`} ratio={h.taux ?? 0} />
            </View>
          ))
        ) : (
          <Empty>Aucune habitude prévue sur la période.</Empty>
        )}
      </Panel>

      <Panel title="Relances (90 derniers jours)">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Tuile emoji="🎯" titre="taux de réponse" valeur={pct(s.relances.taux)} evolution={`${s.relances.repondues} sur ${s.relances.recentes}`} />
          <Tuile emoji="⏱️" titre="délai moyen de réponse" valeur={jrs(s.relances.delai)} />
          <Tuile emoji="⏳" titre="en attente" valeur={String(s.relances.enAttente)} evolution={s.relances.enRetard ? `dont ${s.relances.enRetard} en retard` : undefined} />
        </View>
      </Panel>

      <Panel title="Dépenses par mois">
        <Barres points={s.depensesMois.map((m) => ({ cle: m.cle, axe: m.axe, v: m.v, detail: `${m.mois} : ${fmtMontant(m.v, s.devise)}` }))} />
        {s.repartition.length ? (
          <View style={{ gap: 10, marginTop: 6 }}>
            <T small muted>
              Ce mois-ci, par budget
            </T>
            {s.repartition.map((x) => (
              <Part key={x.nom} libelle={x.nom} valeur={`${fmtMontant(x.v, s.devise)} · ${Math.round((x.v / totalRep) * 100)} %`} ratio={x.v / maxRep} />
            ))}
          </View>
        ) : (
          <T small muted>
            Aucune dépense ce mois-ci. Elles se notent dans Plus › Finances.
          </T>
        )}
      </Panel>
    </Screen>
  );
}
