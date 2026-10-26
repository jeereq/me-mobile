import { type Href, router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { etatDesLieux, type Niveau, resumeFinances } from '@/lib/etat-des-lieux';
import { fmtCourt } from '@/lib/dates';
import type { Espace } from '@/lib/types';
import { alpha, C, F } from '@/lib/theme';

import { couleurRatio, Jauge } from './jauge';
import { Btn, Panel, Sep, T } from './ui';

/** Couleur d'un niveau, lue au rendu (elle suit le thème choisi). */
export const couleurNiveau = (n: Niveau) => ({ alerte: C.agressif, conseil: C.hebdo, info: C.normal, bien: C.coach })[n];

function Lien({ label, href }: { label: string; href: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => router.push(href as Href)} hitSlop={6} style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>{label} ›</Text>
    </Pressable>
  );
}

function Mini({ titre, valeur, couleur }: { titre: string; valeur: string; couleur?: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 90, gap: 2, padding: 10, borderRadius: 12, backgroundColor: C.sunk }}>
      <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>
        {titre}
      </Text>
      <Text style={{ color: couleur ?? C.ink, fontFamily: F.texteF, fontSize: 14 }}>
        {valeur}
      </Text>
    </View>
  );
}

/** Le mois en cours en un coup d'œil, pour l'accueil et le rapport. */
export function ResumeFinances({ espace, d }: { espace: Espace; d: string }) {
  const r = resumeFinances(espace, d);
  const { fmt } = r;
  if (r.vide)
    return (
      <Panel title="Mes finances">
        <T small muted>
          Note une dépense ou fixe un budget : le résumé de ton mois s’affichera ici.
        </T>
        <Btn small kind="sec" label="Ouvrir Finances" onPress={() => router.push('/finances')} />
      </Panel>
    );
  const depasse = r.reste !== null && r.reste < 0;
  return (
    <Panel title="Mes finances" right={<Lien label="Finances" href="/finances" />}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <View>
          <T small muted>
            Dépensé ce mois
          </T>
          <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 28 }}>{fmt(r.depense)}</Text>
        </View>
        {r.reste !== null ? (
          <View style={{ alignItems: 'flex-end' }}>
            <T small muted>
              {depasse ? 'Dépassé de' : 'Reste'}
            </T>
            <Text style={{ color: couleurRatio(r.ratio), fontFamily: F.chiffre, fontSize: 20 }}>{fmt(Math.abs(r.reste))}</Text>
          </View>
        ) : null}
      </View>
      {r.plafond ? (
        <>
          <Jauge ratio={r.ratio} />
          <T small muted>
            {Math.round(r.ratio * 100)} % de {fmt(r.plafond)}
            {r.parJour !== null ? ` · environ ${fmt(r.parJour)} par jour jusqu'au ${fmtCourt(r.fin).replace(/\.$/, '')}` : ''}
          </T>
        </>
      ) : (
        <T small muted>
          Aucun budget pour ce mois.
        </T>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Mini titre="Aujourd'hui" valeur={r.jour.plafond !== null ? `${fmt(r.jour.depense)} / ${fmt(r.jour.plafond)}` : fmt(r.jour.depense)} couleur={r.jour.etat === 'depasse' ? C.agressif : undefined} />
        <Mini titre="Revenus" valeur={fmt(r.revenus)} />
        <Mini titre="Solde" valeur={`${r.solde > 0 ? '+' : r.solde < 0 ? '−' : ''}${fmt(Math.abs(r.solde))}`} couleur={r.solde < 0 ? C.agressif : r.solde > 0 ? C.coach : undefined} />
      </View>
      {r.comptes.total !== null ? (
        <T small muted>
          Solde de {r.comptes.n > 1 ? `tes ${r.comptes.n} comptes` : 'ton compte'} (dernier relevé) : {fmt(r.comptes.total)}
        </T>
      ) : null}
      {r.aSurveiller.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {r.aSurveiller.map((x) => (
            <Text key={x.nom} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', fontFamily: F.texteM, fontSize: 12, color: x.etat === 'depasse' ? C.agressif : C.hebdo, backgroundColor: alpha(x.etat === 'depasse' ? C.agressif : C.hebdo, 0.12) }}>
              {x.emoji} {x.nom} · {x.etat === 'depasse' ? 'dépassé' : 'à surveiller'}
            </Text>
          ))}
        </View>
      ) : null}
    </Panel>
  );
}

/**
 * Où en sont les finances, les tâches, les relances, les habitudes et la régularité, puis ce qu'il vaut mieux faire.
 * `limite` : nombre de recommandations montrées (l'accueil) ; sans elle, toutes (la page Rapport).
 */
export function EtatDesLieux({ espace, d, limite }: { espace: Espace; d: string; limite?: number }) {
  const { constats, recommandations } = etatDesLieux(espace, d);
  const vues = limite ? recommandations.slice(0, limite) : recommandations;
  const reste = recommandations.length - vues.length;
  return (
    <Panel title="État des lieux" right={limite ? <Lien label="Rapport" href="/rapport" /> : null}>
      <View style={{ gap: 2 }}>
        {constats.map((c) => (
          <Pressable key={c.id} accessibilityRole="link" accessibilityLabel={`${c.titre} : ${c.detail}`} onPress={() => router.push(c.href as Href)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: couleurNiveau(c.niveau) }} />
            <Text style={{ width: 92, color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>{c.titre}</Text>
            <Text style={{ flex: 1, color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{c.detail}</Text>
          </Pressable>
        ))}
      </View>
      <Sep />
      <Text accessibilityRole="header" style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        Recommandations
      </Text>
      {vues.length ? (
        vues.map((x) => (
          <View key={x.id} style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, backgroundColor: alpha(couleurNiveau(x.niveau), 0.08), borderLeftWidth: 3, borderLeftColor: couleurNiveau(x.niveau) }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>{x.titre}</Text>
              <T small muted>
                {x.texte}
              </T>
              <Lien label={x.action} href={x.href} />
            </View>
          </View>
        ))
      ) : (
        <T small muted>
          Rien à signaler : tout est en ordre.
        </T>
      )}
      {limite && reste > 0 ? <Lien label={`Voir ${reste > 1 ? `les ${reste} autres recommandations` : 'l’autre recommandation'}`} href="/rapport" /> : null}
    </Panel>
  );
}
