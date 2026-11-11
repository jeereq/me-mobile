import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/texte';

import { fmtSomme } from '@/lib/budget-projets';
import { nomEtat } from '@/lib/etats-tache';
import { imprimerPage, telecharger } from '@/lib/export';
import { nomTrimestre, trimestreDe } from '@/lib/feuille-de-route';
import type { Plan } from '@/lib/planning';
import { nomPilier, type Pilier } from '@/lib/piliers';
import { construireRapport, rapportCsv, rapportHtml, rapportTexte, trimestresDisponibles } from '@/lib/rapport-exco';
import { C, F } from '@/lib/theme';
import { nomStatutDecision } from '@/lib/decisions-exco';
import type { DecisionExco, Projet, Risque, Tache } from '@/lib/types';

import { Puce } from './finances-plus';
import { Tuile } from './projet-detail';
import { Btn, Panel, T } from './ui';

/** Le rapport du trimestre pour l'Exco : aperçu à l'écran, puis impression (PDF) ou fichier Excel. */
export function RapportExco({ entrees, aujourdhui, devise, risques, decisions, piliers }: { entrees: { projet: Projet; plan: Plan; taches: Tache[] }[]; aujourdhui: string; devise: string; risques?: Risque[]; decisions?: DecisionExco[]; piliers?: Pilier[] }) {
  const cles = useMemo(() => trimestresDisponibles(entrees, aujourdhui), [entrees, aujourdhui]);
  const [cle, setCle] = useState(trimestreDe(aujourdhui));
  const [message, setMessage] = useState('');
  const r = useMemo(() => construireRapport(entrees, cle, aujourdhui, undefined, { risques, decisions, piliers }), [entrees, cle, aujourdhui, risques, decisions, piliers]);

  const imprimer = async () => {
    const ok = await imprimerPage(`rapport-${r.cle}`, rapportHtml(r, devise), rapportTexte(r, devise));
    setMessage(ok ? '' : 'Le navigateur a bloqué la fenêtre : autorise les fenêtres pour ce site, puis réessaie.');
  };
  const excel = () => telecharger(`rapport-exco-${r.cle}.csv`, rapportCsv(r, devise), 'text/csv;charset=utf-8');

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {cles.map((c) => (
          <Puce key={c} label={nomTrimestre(c)} on={c === cle} onPress={() => setCle(c)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Tuile titre="Réalisé" valeur={r.realisation === null ? '—' : `${r.realisation} % (${r.faites} / ${r.total})`} />
        <Tuile titre="En retard" valeur={r.enRetard ? String(r.enRetard) : 'Aucune'} couleur={r.enRetard ? C.agressif : C.coach} />
        <Tuile titre="À décider" valeur={String(r.decisions.length)} couleur={r.decisions.length ? C.hebdo : undefined} />
        <Tuile titre="Budget" valeur={r.prevu ? `${fmtSomme(r.engage, devise)} sur ${fmtSomme(r.prevu, devise)}` : '—'} couleur={r.engage > r.prevu && r.engage > 0 ? C.agressif : undefined} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn label="Imprimer / PDF" onPress={imprimer} />
        <Btn kind="sec" label="Excel (CSV)" onPress={excel} />
      </View>
      {message ? <T small style={{ color: C.agressif }}>{message}</T> : null}

      <Panel title="Points de vigilance" count={r.vigilance.length || undefined}>
        {r.vigilance.length ? r.vigilance.map((v) => <T key={v} small>{v}</T>) : <T small muted>Rien à signaler.</T>}
      </Panel>
      <Panel title="Par projet" count={r.projets.length || undefined}>
        {r.projets.length ? (
          r.projets.map((p) => (
            <View key={p.projet.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
              <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>{`${p.projet.emoji} ${p.projet.nom}`}</Text>
              {p.enRetard ? <Text style={{ color: C.agressif, fontFamily: F.texteM, fontSize: 12 }}>{`${p.enRetard} en retard`}</Text> : null}
              <Text style={{ color: C.muted, fontFamily: F.chiffre, fontSize: 14 }}>{`${p.faites} / ${p.total}`}</Text>
            </View>
          ))
        ) : (
          <T small muted>Aucune action ne finit dans ce trimestre.</T>
        )}
      </Panel>
      {r.piliers.length ? (
        <Panel title="Par pilier du groupe" count={r.piliers.length}>
          {r.piliers.map((x) => (
            <View key={x.pilier} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
              <Text style={{ flex: 1, color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>{x.nom ?? nomPilier(x.pilier)}</Text>
              {x.enRetard ? <Text style={{ color: C.agressif, fontFamily: F.texteM, fontSize: 12 }}>{`${x.enRetard} en retard`}</Text> : null}
              <Text style={{ color: C.muted, fontFamily: F.chiffre, fontSize: 14 }}>{`${x.faites} / ${x.total}`}</Text>
            </View>
          ))}
        </Panel>
      ) : null}
      {r.risques.length ? (
        <Panel title="Risques élevés" count={r.risques.length}>
          {r.risques.map((x) => (
            <View key={x.id} style={{ paddingVertical: 3 }}>
              <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14 }}>{x.titre}</Text>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{[x.projetNom, x.responsable, x.mitigation].filter(Boolean).join(' · ')}</Text>
            </View>
          ))}
        </Panel>
      ) : null}
      {r.decisionsJournal.length ? (
        <Panel title="Décisions du trimestre" count={r.decisionsJournal.length}>
          {r.decisionsJournal.map((d) => (
            <View key={d.id} style={{ paddingVertical: 3 }}>
              <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14 }}>{d.titre}</Text>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{[nomStatutDecision(d.statut), d.decision].filter(Boolean).join(' · ')}</Text>
            </View>
          ))}
        </Panel>
      ) : null}
      <Panel title="Décisions attendues" count={r.decisions.length || undefined}>
        {r.decisions.length ? (
          r.decisions.map((t) => (
            <View key={t.id} style={{ paddingVertical: 3 }}>
              <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14 }}>{t.titre}</Text>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{[t.projetNom, t.etat ? nomEtat(t.etat) : '', t.budget ? fmtSomme(t.budget, devise) : ''].filter(Boolean).join(' · ')}</Text>
            </View>
          ))
        ) : (
          <T small muted>Aucune décision en attente.</T>
        )}
      </Panel>
      <T small muted>{`${r.suivant.nom} : ${r.suivant.total} action${r.suivant.total > 1 ? 's' : ''} prévue${r.suivant.total > 1 ? 's' : ''}${r.suivant.prevu ? `, ${fmtSomme(r.suivant.prevu, devise)} de budget` : ''}.`}</T>
    </View>
  );
}
