import { Text, View } from 'react-native';

import { Header, Panel, Screen, T } from '@/components/ui';
import { fmtCourt, today } from '@/lib/dates';
import { BADGES, JOKERS_MAX, jeuDe, meilleureSerie, niveauDe, POINTS, semaine, serie, xpTotal } from '@/lib/jeu';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

const JOURS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function Chiffre({ valeur, libelle, emoji }: { valeur: string | number; libelle: string; emoji: string }) {
  return (
    <View style={{ flex: 1, minWidth: 96, backgroundColor: C.sunk, borderRadius: 14, padding: 12, gap: 2 }}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 22 }}>{valeur}</Text>
      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{libelle}</Text>
    </View>
  );
}

export default function Recompenses() {
  const { espace } = useStore();
  const d = today();
  const j = jeuDe(espace);
  const xp = xpTotal(j);
  const n = niveauDe(xp);
  const jours = semaine(j, d);
  const max = Math.max(60, ...jours.map((x) => x.xp));
  const obtenus = BADGES.filter((b) => j.badges[b.id]).length;

  return (
    <Screen>
      <Header retour eyebrow={`${xp} points au total`} title="Récompenses" />

      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.accent, fontFamily: F.titre, fontSize: 32 }}>{n.niveau}</Text>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 22 }}>{n.titre}</Text>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: C.sunk, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(n.progression * 100)}%`, height: '100%', backgroundColor: C.accent }} />
            </View>
            <T small muted>
              {n.dansNiveau} / {n.pourNiveau} pts · encore {n.restant} pour le niveau {n.niveau + 1}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chiffre emoji="🔥" valeur={serie(j, d)} libelle="jours de suite" />
          <Chiffre emoji="🏁" valeur={meilleureSerie(j)} libelle="meilleure série" />
          <Chiffre emoji="🛡️" valeur={`${j.jokers}/${JOKERS_MAX}`} libelle="jokers de série" />
        </View>
        <T small muted>
          Un joker se gagne tous les 7 jours de série. Si tu manques un jour, il est utilisé tout seul et ta série continue.
        </T>
      </Panel>

      <Panel title="Ma semaine">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 130 }}>
          {jours.map((x) => {
            const auj = x.jour === d;
            return (
              <View key={x.jour} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Text style={{ color: x.xp ? C.ink : C.muted, fontFamily: F.texteM, fontSize: 11 }}>{x.xp || (x.sauve ? '🛡️' : '')}</Text>
                <View style={{ width: '70%', maxWidth: 34, height: Math.max(4, (x.xp / max) * 90), borderRadius: 6, backgroundColor: x.xp ? (auj ? C.accent : alpha(C.accent, 0.45)) : C.sunk }} />
                <Text style={{ color: auj ? C.ink : C.muted, fontFamily: auj ? F.texteF : F.texte, fontSize: 12 }}>{JOURS[new Date(`${x.jour}T12:00:00`).getDay()]}</Text>
              </View>
            );
          })}
        </View>
      </Panel>

      <Panel title="Badges" count={`${obtenus}/${BADGES.length}`}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {BADGES.map((b) => {
            const le = j.badges[b.id];
            return (
              <View key={b.id} style={{ width: '31%', minWidth: 96, flexGrow: 1, alignItems: 'center', gap: 4, padding: 12, borderRadius: 14, backgroundColor: le ? alpha(C.accent, 0.08) : C.sunk }}>
                <Text style={{ fontSize: 28, opacity: le ? 1 : 0.25 }}>{b.emoji}</Text>
                <Text style={{ color: le ? C.ink : C.muted, fontFamily: F.texteF, fontSize: 13, textAlign: 'center' }}>{b.nom}</Text>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 11, textAlign: 'center' }}>{le ? `Obtenu le ${fmtCourt(le)}` : b.desc}</Text>
              </View>
            );
          })}
        </View>
      </Panel>

      <Panel title="Comment gagner des points">
        {[
          ['Cocher une habitude', POINTS.habitude],
          ['Obtenir une réponse à une relance', POINTS.relance],
          ['Terminer une tâche', POINTS.tache],
          ['Terminer une tâche importante', POINTS.tacheHaute],
          ['Finir une tâche avant son échéance', `+${POINTS.ponctuel}`],
          [`Noter dans le journal (${POINTS.journalMaxParJour} fois par jour)`, POINTS.journal],
          ['Journée parfaite : toute la mission faite', POINTS.parfait],
        ].map(([l, p]) => (
          <View key={String(l)} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <T small style={{ flex: 1 }}>
              {l}
            </T>
            <Text style={{ color: C.coach, fontFamily: F.texteF, fontSize: 13 }}>{typeof p === 'number' ? `+${p}` : p} pts</Text>
          </View>
        ))}
        <T small muted>
          Décocher retire les points gagnés : ils reviennent quand tu recoches.
        </T>
      </Panel>
    </Screen>
  );
}
