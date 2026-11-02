import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { PlansDepenses } from '@/components/finances-plus';
import { Barres, Part, Tuile } from '@/components/graphiques';
import { Filtre, Onglets } from '@/components/onglets';
import { PanneauPrevisions } from '@/components/previsions';
import { PanneauBudget, PanneauConseils, PanneauObjectifsStats } from '@/components/stats-conseils';
import { EtatDesLieux, ResumeFinances } from '@/components/tableau-de-bord';
import { Btn, Collant, Colonnes, Empty, Header, Panel, Screen, Sep, T } from '@/components/ui';
import { conseilsBudgetsObjectifs } from '@/lib/conseils';
import { today } from '@/lib/dates';
import { etatDesLieux, rapportTexte } from '@/lib/etat-des-lieux';
import { bilan, financesDe, fmtMontant } from '@/lib/finances';
import { statistiques } from '@/lib/stats';
import { joursDeLaPeriode, PERIODES_STATS, type PeriodeStats, titrePeriode } from '@/lib/stats-budget';
import { useStore } from '@/lib/store';

/**
 * Le bilan : un seul écran pour savoir où l'on en est.
 * - Tendances (ex-Statistiques) : ce qui a été fait sur une période, domaine par domaine.
 * - Conseils (ex-État des lieux) : l'état du jour, le mois des finances, et tout ce qu'il vaut mieux faire, du plus urgent
 *   au plus encourageant, à copier en texte.
 * Les anciennes adresses /statistiques et /rapport mènent ici (`?onglet=tendances` ou `?onglet=conseils`).
 */
export type OngletBilan = 'tendances' | 'conseils';
const ONGLETS: { key: OngletBilan; label: string }[] = [
  { key: 'tendances', label: 'Tendances' },
  { key: 'conseils', label: 'Conseils' },
];

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

type Domaine = 'tout' | 'taches' | 'habitudes' | 'relances' | 'finances' | 'objectifs';
const DOMAINES: { key: Domaine; label: string }[] = [
  { key: 'tout', label: 'Tout' },
  { key: 'taches', label: 'Tâches' },
  { key: 'habitudes', label: 'Habitudes' },
  { key: 'relances', label: 'Relances' },
  { key: 'finances', label: 'Budget' },
  { key: 'objectifs', label: 'Objectifs' },
];

/** Onglet Tendances : ce qui a été fait sur la période (tâches, relances, habitudes, dépenses, objectifs). */
function Tendances() {
  const { espace } = useStore();
  const d = today();
  const [periode, setPeriode] = useState<PeriodeStats>('30');
  const [domaine, setDomaine] = useState<Domaine>('tout');
  const jours = joursDeLaPeriode(periode, d);
  const voir = (x: Exclude<Domaine, 'tout'>) => domaine === 'tout' || domaine === x;
  const s = statistiques(espace, d, jours);
  const t = s.tuiles;
  const maxRep = Math.max(1, ...s.repartition.map((x) => x.v));
  const totalRep = s.repartition.reduce((a, x) => a + x.v, 0);

  return (
    <>
      <Collant>
        <T small muted>
          {titrePeriode(periode, jours)}
        </T>
        <Filtre label="Période des statistiques" options={PERIODES_STATS} value={periode} onChange={setPeriode} />
        <Filtre label="Ce que les statistiques montrent" options={DOMAINES} value={domaine} onChange={setDomaine} />
      </Collant>


      {domaine !== 'objectifs' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {voir('taches') ? <Tuile emoji="✅" titre="tâches terminées" valeur={String(t.taches.v)} evolution={evolution(t.taches.v, t.taches.avant, jours)} /> : null}
          {voir('relances') ? <Tuile emoji="📨" titre="relances abouties" valeur={String(t.relances.v)} evolution={evolution(t.relances.v, t.relances.avant, jours)} /> : null}
          {voir('habitudes') ? <Tuile emoji="🌱" titre="habitudes tenues" valeur={pct(t.habitudes.v)} evolution={evolution(t.habitudes.v, t.habitudes.avant, jours, 'taux')} /> : null}
          {domaine === 'tout' ? <Tuile emoji="📅" titre={`jours actifs sur ${jours}`} valeur={String(t.actifs.v)} evolution={evolution(t.actifs.v, t.actifs.avant, jours)} /> : null}
          {domaine === 'tout' ? <Tuile emoji="✨" titre="points gagnés" valeur={String(t.points.v)} evolution={evolution(t.points.v, t.points.avant, jours)} /> : null}
          {voir('finances') ? <Tuile emoji="💸" titre="dépensés" valeur={fmtMontant(t.depenses.v, s.devise)} evolution={evolution(t.depenses.v, t.depenses.avant, jours, 'nombre', (n) => fmtMontant(n, s.devise))} /> : null}
        </View>
      ) : null}

      {domaine === 'tout' ? (
        <Panel title="Points par semaine">
          <Barres points={s.pointsSemaines} />
          <T small muted>
            Série en cours : {s.serie} jour{s.serie > 1 ? 's' : ''} · record : {s.record} jour{s.record > 1 ? 's' : ''}
            {s.meilleurJour ? ` · ton jour le plus actif : le ${s.meilleurJour}` : ''}
            {s.moment ? `, plutôt ${s.moment.nom === 'après-midi' ? "l'après-midi" : `le ${s.moment.nom}`} (${pct(s.moment.part)} de tes actions)` : ''}.
          </T>
        </Panel>
      ) : null}

      {voir('taches') ? (
        <Panel title="Tâches terminées par semaine">
          <Barres points={s.tachesSemaines} />
          <T small muted>
            {s.tachesOuvertes} tâche{s.tachesOuvertes > 1 ? 's' : ''} en cours, dont {s.tachesEnRetard} en retard · délai moyen entre l'ajout et la fin : {jrs(s.delaiTache)}.
          </T>
        </Panel>
      ) : null}

      {voir('habitudes') ? (
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
      ) : null}

      {voir('relances') ? (
        <Panel title="Relances (90 derniers jours)">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Tuile emoji="🎯" titre="taux de réponse" valeur={pct(s.relances.taux)} evolution={`${s.relances.repondues} sur ${s.relances.recentes}`} />
            <Tuile emoji="⏱️" titre="délai moyen de réponse" valeur={jrs(s.relances.delai)} />
            <Tuile emoji="⏳" titre="en attente" valeur={String(s.relances.enAttente)} evolution={s.relances.enRetard ? `dont ${s.relances.enRetard} en retard` : undefined} />
          </View>
        </Panel>
      ) : null}

      {voir('finances') ? (
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
      ) : null}

      {voir('finances') ? <PanneauBudget espace={espace} d={d} /> : null}
      {voir('objectifs') ? <PanneauObjectifsStats espace={espace} d={d} /> : null}
    </>
  );
}

/**
 * Onglet Conseils : l'état des lieux du jour, puis les conseils sur le budget et les objectifs qu'il ne donne pas déjà
 * (dépassements qui reviennent, marge à verser, versements du jour…), le mois des finances et les prévisions.
 */
function Conseils() {
  const { espace } = useStore();
  const d = today();
  const f = financesDe(espace);
  const dejaDits = new Set(etatDesLieux(espace, d).recommandations.map((r) => r.id));
  const autres = conseilsBudgetsObjectifs(espace, d).filter((c) => !dejaDits.has(c.id));
  return (
    <Colonnes
      gauche={<EtatDesLieux espace={espace} d={d} />}
      droite={
        <View style={{ gap: 16 }}>
          <ResumeFinances espace={espace} d={d} />
          {autres.length ? <PanneauConseils titre="Pour tenir ton budget et tes objectifs" conseils={autres} vide="" /> : null}
          <PlansDepenses f={f} bilan={bilan(f, 'mois', d, d)} />
          {f.budgets.length ? <PanneauPrevisions f={f} d={d} seuil={f.alertes?.seuil ?? 1} /> : null}
        </View>
      }
    />
  );
}

export default function Bilan() {
  const { espace } = useStore();
  const { onglet: demande } = useLocalSearchParams<{ onglet?: string }>();
  const [onglet, setOnglet] = useState<OngletBilan>(demande === 'conseils' ? 'conseils' : 'tendances');
  const [copie, setCopie] = useState('');
  const copier = async () => {
    try {
      await Clipboard.setStringAsync(rapportTexte(espace, today()));
      setCopie('Rapport copié : colle-le dans un message ou une note.');
    } catch {
      setCopie('Impossible de copier sur cet appareil.');
    }
  };
  return (
    <Screen>
      <Header
        retour
        eyebrow={onglet === 'conseils' ? 'Rapport du jour' : 'Où tu en es'}
        title="Bilan"
        right={onglet === 'conseils' ? <Btn small kind="sec" label="Copier" onPress={copier} /> : null}
      />
      <Onglets options={ONGLETS} value={onglet} onChange={setOnglet} />
      {onglet === 'conseils' && copie ? <T small muted>{copie}</T> : null}
      {onglet === 'tendances' ? <Tendances /> : <Conseils />}
    </Screen>
  );
}
