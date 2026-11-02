import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { fmtCourt } from '@/lib/dates';
import { fmtMontant, type Bilan } from '@/lib/finances';
import { syntheseFinances } from '@/lib/synthese-finances';
import { teinte, vive, type Vive } from '@/lib/teinte';
import { C, F } from '@/lib/theme';
import type { Finances } from '@/lib/types';

import { couleurRatio, Jauge } from './jauge';
import { T } from './ui';

export type VueSynthese = 'revenus' | 'depenses' | 'budgets' | 'prets';

function Ligne({ gauche, droite, couleur }: { gauche: string; droite: string; couleur?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text numberOfLines={1} style={{ flex: 1, color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
        {gauche}
      </Text>
      <Text style={{ color: couleur ?? C.ink, fontFamily: F.texteM, fontSize: 13 }}>{droite}</Text>
    </View>
  );
}

/** Une rubrique : son chiffre, l'essentiel, et un appui qui ouvre son onglet. */
function Rubrique({ titre, couleur, valeur, couleurValeur, onPress, children }: { titre: string; couleur: Vive; valeur: string; couleurValeur?: string; onPress: () => void; children: ReactNode }) {
  const t = teinte(vive(couleur));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titre} : ${valeur}. Voir le détail`}
      onPress={onPress}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: '45%', minWidth: 260, gap: 10, padding: 16, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.c }} />
        <Text accessibilityRole="header" style={{ flex: 1, color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>
          {titre}
        </Text>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 16 }}>›</Text>
      </View>
      <Text style={{ color: couleurValeur ?? C.ink, fontFamily: F.chiffre, fontSize: 24 }}>{valeur}</Text>
      <View style={{ gap: 6 }}>{children}</View>
    </Pressable>
  );
}

/** La vue Résumé de Finances : budgets, prêts, dépenses et revenus de la période choisie. */
export function SyntheseFinances({ f, b, d, onVoir }: { f: Finances; b: Bilan; d: string; onVoir: (v: VueSynthese) => void }) {
  const s = syntheseFinances(f, b, d);
  const fmt = (n: number) => fmtMontant(n, f.devise);
  const signe = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;
  const part = s.revenus.total ? s.depenses.total / s.revenus.total : s.depenses.total ? 1.01 : 0;
  const { budgets: bu, prets: p } = s;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 10, padding: 18, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
        <T small muted>
          Revenus moins dépenses
        </T>
        <Text style={{ color: s.solde < 0 ? C.agressif : C.ink, fontFamily: F.chiffre, fontSize: 34 }}>{signe(s.solde)}</Text>
        <Jauge ratio={part} />
        {s.revenus.total ? (
          <T small muted>
            {`${Math.round(part * 100)} % des revenus dépensés`}
          </T>
        ) : null}
      </View>

      {/* Deux par ligne sur grand écran, une par ligne sur téléphone. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Rubrique titre="Revenus" couleur="menthe" valeur={fmt(s.revenus.total)} onPress={() => onVoir('revenus')}>
          {s.revenus.principaux.length ? s.revenus.principaux.map((x) => <Ligne key={x.id} gauche={x.note || 'Revenu'} droite={fmt(x.montant)} />) : <T small muted>Aucun revenu.</T>}
        </Rubrique>

        <Rubrique titre="Dépenses" couleur="ambre" valeur={fmt(s.depenses.total)} onPress={() => onVoir('depenses')}>
          {s.depenses.postes.length ? s.depenses.postes.map((x) => <Ligne key={x.id} gauche={`${x.emoji} ${x.nom}`} droite={fmt(x.montant)} />) : <T small muted>Aucune dépense.</T>}
        </Rubrique>

        <Rubrique titre="Budgets" couleur="indigo" valeur={bu.plafond ? `${fmt(Math.abs(bu.reste))} ${bu.reste < 0 ? 'de trop' : 'restants'}` : '—'} couleurValeur={bu.reste < 0 ? C.agressif : undefined} onPress={() => onVoir('budgets')}>
          {bu.plafond ? <Jauge ratio={bu.ratio} hauteur={6} /> : null}
          {bu.pressants.length ? (
            bu.pressants.map((l) => <Ligne key={l.budget.id} gauche={`${l.budget.emoji} ${l.budget.nom}`} droite={l.reste < 0 ? `−${fmt(-l.reste)}` : fmt(l.reste)} couleur={couleurRatio(l.ratio)} />)
          ) : (
            <T small muted>Aucun budget.</T>
          )}
        </Rubrique>

        <Rubrique titre="Prêts" couleur="lilas" valeur={signe(p.net)} onPress={() => onVoir('prets')}>
          {p.nb ? (
            <>
              <Ligne gauche="On te doit" droite={fmt(p.onMeDoit)} />
              <Ligne gauche="Tu dois" droite={fmt(p.jeDois)} />
              {p.enRetard ? <Ligne gauche="En retard" droite={String(p.enRetard)} couleur={C.agressif} /> : p.prochain?.echeance ? <Ligne gauche={`Prochain : ${p.prochain.personne}`} droite={fmtCourt(p.prochain.echeance)} /> : null}
            </>
          ) : (
            <T small muted>Aucun prêt en cours.</T>
          )}
        </Rubrique>
      </View>
    </View>
  );
}
