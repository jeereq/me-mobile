import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { decrireMode, JOURS_SEMAINE, lireHeure, lireHeures, lireJours, reglesDuMode, REGLES_DEFAUT, type ReglesMode } from '@/lib/modes';
import { C, F, MODE_COLORS } from '@/lib/theme';
import { type Config, MODE_LABELS, MODES, type Mode } from '@/lib/types';

import { Puce } from './finances-plus';
import { Btn, Input, Sep, T } from './ui';

function Interrupteur({ titre, desc, value, onChange, disabled }: { titre: string; desc?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
      <View style={{ flex: 1 }}>
        <T>{titre}</T>
        {desc ? (
          <T small muted>
            {desc}
          </T>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} />
    </View>
  );
}

const CLES_REGLES: (keyof ReglesMode)[] = ['jourJ', 'avant', 'retard', 'heure', 'resume', 'bilan'];

/**
 * Un mode de rappel : on l'active, on décrit ce qu'il doit faire (texte libre) et on règle quand il rappelle.
 * Sous les réglages, une phrase calculée dit ce que le mode fera concrètement, avec les heures du matin et du soir en vigueur.
 */
function CarteMode({ m, c, set, ro }: { m: Mode; c: Config; set: (patch: Partial<Config>) => void; ro: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const cfg = c.modes[m];
  const r = reglesDuMode(c, m);
  const [heures, setHeures] = useState(r.jourJ.join(', '));
  const [jours, setJours] = useState(r.avant.join(', '));
  const [heureBilan, setHeureBilan] = useState(r.bilan?.heure ?? 'soir');
  const maj = (patch: Partial<typeof cfg>) => set({ modes: { ...c.modes, [m]: { ...cfg, ...patch } } });
  const defaut = REGLES_DEFAUT[m];
  const modifie = CLES_REGLES.some((k) => cfg[k] !== undefined);
  const remettre = () => {
    const sans = { ...cfg };
    for (const k of CLES_REGLES) delete sans[k];
    set({ modes: { ...c.modes, [m]: sans } });
    setHeures(defaut.jourJ.join(', '));
    setJours((m === 'agressif' ? [c.agressifJMoins || 3, 1] : defaut.avant).join(', '));
    setHeureBilan(defaut.bilan?.heure ?? 'soir');
  };

  return (
    <View style={{ gap: 6 }}>
      <Interrupteur titre={MODE_LABELS[m]} desc={cfg.desc} value={cfg.actif} disabled={ro} onChange={(actif) => maj({ actif })} />
      <Text style={{ color: MODE_COLORS[m], fontFamily: F.texteM, fontSize: 13, lineHeight: 18 }}>{decrireMode(r, c.routineHeure, c.rappelSoir)}</Text>
      <Pressable accessibilityRole="button" aria-expanded={ouvert} onPress={() => setOuvert(!ouvert)} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>
          {ouvert ? '▾ Masquer les réglages' : ro ? '▸ Voir les réglages' : '▸ Régler ce mode'}
          {modifie ? ' · personnalisé' : ''}
        </Text>
      </Pressable>
      {ouvert ? (
        <View style={{ gap: 10, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: C.line }}>
          <Input label="Ce que fait ce mode (description affichée aux utilisateurs)" value={cfg.desc} editable={!ro} multiline onChangeText={(desc) => maj({ desc })} />
          <Input
            label="Heures du rappel le jour J"
            value={heures}
            editable={!ro}
            onChangeText={(t) => {
              setHeures(t);
              maj({ jourJ: lireHeures(t) });
            }}
            placeholder="Ex. matin, 12:30, soir (vide : aucun rappel)"
          />
          <T small muted>
            « matin » = briefing ({c.routineHeure}), « soir » = rappel du soir ({c.rappelSoir}), ou une heure HH:MM. Avec une seule heure, le titre est celui de l'élément ; avec plusieurs, le premier rappel dit « Aujourd'hui » et les suivants « Pas encore fait ».
          </T>
          <Input
            label="Jours avant l'échéance"
            value={jours}
            editable={!ro}
            onChangeText={(t) => {
              setJours(t);
              maj({ avant: lireJours(t) });
            }}
            placeholder="Ex. 3, 1 (vide : pas de rappel à l'avance)"
            keyboardType="numbers-and-punctuation"
          />
          <Interrupteur titre="Insister après l'échéance" desc="Un rappel chaque jour tant que ce n'est pas fait." value={r.retard} disabled={ro} onChange={(retard) => maj({ retard })} />
          <Input
            label="Heure des rappels à l'avance et en retard (HH:MM)"
            value={cfg.heure ?? r.heure}
            editable={!ro}
            onChangeText={(heure) => maj({ heure: lireHeure(heure) && !['matin', 'soir'].includes(heure.toLowerCase()) ? heure : undefined })}
            keyboardType="numbers-and-punctuation"
          />
          <Interrupteur titre="Regrouper les habitudes du jour" desc="Un seul message le soir au lieu d'un rappel par habitude." value={r.resume} disabled={ro} onChange={(resume) => maj({ resume })} />
          <Interrupteur
            titre="Bilan de la semaine"
            desc="Un message qui liste ce qui est suivi dans ce mode pour les 7 jours à venir."
            value={!!r.bilan}
            disabled={ro}
            onChange={(on) => maj({ bilan: on ? (r.bilan ?? { jour: 0, heure: 'soir' }) : null })}
          />
          {r.bilan ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[1, 2, 3, 4, 5, 6, 0].map((j) => (
                  <Puce key={j} label={JOURS_SEMAINE[j].slice(0, 3)} on={r.bilan!.jour === j} onPress={() => !ro && maj({ bilan: { jour: j, heure: r.bilan!.heure } })} />
                ))}
              </View>
              <Input
                label="Heure du bilan (matin, soir ou HH:MM)"
                value={heureBilan}
                editable={!ro}
                onChangeText={(t) => {
                  setHeureBilan(t);
                  const h = lireHeure(t);
                  if (h) maj({ bilan: { jour: r.bilan!.jour, heure: h } });
                }}
              />
            </>
          ) : null}
          {!ro && modifie ? <Btn small kind="sec" label="Remettre les réglages d'origine" onPress={remettre} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Les modes de rappel de la configuration, chacun avec ses réglages et sa description. */
export function EditeurModes({ c, set, ro }: { c: Config; set: (patch: Partial<Config>) => void; ro: boolean }) {
  return (
    <>
      {MODES.map((m, i) => (
        <View key={m}>
          {i ? <Sep /> : null}
          <CarteMode m={m} c={c} set={set} ro={ro} />
        </View>
      ))}
    </>
  );
}
