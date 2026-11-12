import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { fmtCourt, today } from '@/lib/dates';
import { comparerExecution } from '@/lib/frise-projets';
import { CRITERES_VIDES, nbCriteres, type Criteres } from '@/lib/filtres-taches';
import { adresseDe, brouillonMailResponsable, CRITERES_ENSEMBLE, enRetard, responsablesEnsemble, vueEnsemble, type Entree, type LigneEnsemble, type ResponsableEnsemble } from '@/lib/vue-ensemble';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { EcrireMail, type Brouillon } from './ecrire-mail';
import { Puce } from './finances-plus';
import { FiltresFenetre, type EtiquetteExtra } from './filtres-projet';
import { BarreAvancement, Pastille, Tuile } from './projet-detail';
import { Btn, Empty, Panel, T } from './ui';

/** Au-delà, « Voir les autres » ouvre le projet. */
const MAX_PAR_PROJET = 6;

function Ligne({ l, aujourdhui, ouvrir }: { l: LigneEnsemble; aujourdhui: string; ouvrir: () => void }) {
  const retard = enRetard(l, aujourdhui);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${l.tache.titre}`} onPress={ouvrir} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: l.ligne.fait ? C.coach : retard ? C.agressif : l.ligne.critique ? C.hebdo : C.accent }} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: l.ligne.fait ? C.muted : C.ink, fontFamily: F.texte, fontSize: 14, textDecorationLine: l.ligne.fait ? 'line-through' : 'none' }}>
          {l.tache.titre}
        </Text>
        {l.tache.responsable ? (
          <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
            {l.tache.responsable}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: retard ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 13 }}>{fmtCourt(l.ligne.fin)}</Text>
    </Pressable>
  );
}

function Responsables({ liste, sans, aujourdhui, onEcrire, peutEcrire }: { liste: ResponsableEnsemble[]; sans: number; aujourdhui: string; onEcrire: (r: ResponsableEnsemble) => void; peutEcrire: boolean }) {
  return (
    <Panel title="Responsables" count={liste.length || undefined}>
      {liste.length ? (
        liste.map((r) => (
          <View key={r.cle} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, gap: 1 }}>
              <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14.5 }}>
                {r.moi ? `${r.nom} (moi)` : r.nom}
              </Text>
              <Text style={{ color: r.enRetard ? C.agressif : C.muted, fontFamily: F.texte, fontSize: 13 }}>
                {`${r.lignes.length} tâche${r.lignes.length > 1 ? 's' : ''}${r.enRetard ? ` · ${r.enRetard} en retard` : ''}`}
              </Text>
            </View>
            {!r.moi ? <Btn small kind="sec" label="Écrire" onPress={() => onEcrire(r)} disabled={!peutEcrire} /> : null}
          </View>
        ))
      ) : (
        <T small muted>Personne n’a de tâche avec ces filtres.</T>
      )}
      {sans ? <T small muted>{`${sans} tâche${sans > 1 ? 's' : ''} sans responsable.`}</T> : null}
      {!peutEcrire && liste.length ? <T small muted>Connecte Gmail ou Outlook dans Agendas & outils pour écrire depuis Me.</T> : null}
    </Panel>
  );
}

/**
 * Tous les projets d'un coup : les filtres des tâches valent pour tous les projets, puis les tâches par projet et les responsables,
 * à qui l'on écrit en un geste depuis un compte connecté (Gmail ou Outlook).
 */
export function VueEnsemble({ entrees: entreesBrutes, ouvrir }: { entrees: Entree[]; ouvrir: (projet: string, tache?: string) => void }) {
  const { equipeActive, session, mails, externes, espace } = useStore();
  const aujourdhui = today();
  // Dans l'ordre d'exécution, comme la timeline.
  const entrees = useMemo(() => [...entreesBrutes].sort((a, b) => comparerExecution({ nom: a.projet.nom, debut: a.plan.debut, fin: a.plan.fin }, { nom: b.projet.nom, debut: b.plan.debut, fin: b.plan.fin })), [entreesBrutes]);
  const membres = equipeActive?.membres ?? [];
  const [criteres, setCriteres] = useState<Criteres>(CRITERES_ENSEMBLE);
  const [projetId, setProjetId] = useState<string | null>(null);
  const [mail, setMail] = useState<Brouillon | null>(null);
  const [tout, setTout] = useState<Set<string>>(new Set());
  const choisi = projetId && entrees.some((e) => e.projet.id === projetId) ? projetId : null;
  const e = useMemo(() => vueEnsemble(entrees, criteres, { aujourdhui, membres, moiId: session?.user.id, projetId: choisi }), [entrees, criteres, aujourdhui, membres, session?.user.id, choisi]);
  const { responsables, sansResponsable } = useMemo(() => responsablesEnsemble(e.groupes, membres, aujourdhui, session?.user.id), [e.groupes, membres, aujourdhui, session?.user.id]);
  const peutEcrire = externes.some((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft');
  const toutes = entrees.flatMap((x) => x.taches);
  const ecrire = (r: ResponsableEnsemble) => setMail(brouillonMailResponsable(r, { aujourdhui, adresse: adresseDe(r, mails, espace.contacts) }));

  const projetChoisi = choisi ? entrees.find((x) => x.projet.id === choisi)?.projet : undefined;
  const extras: EtiquetteExtra[] = projetChoisi ? [{ cle: 'projet', label: `${projetChoisi.emoji} ${projetChoisi.nom}`, retirer: () => setProjetId(null) }] : [];

  if (mail) return <EcrireMail brouillon={mail} onFermer={() => setMail(null)} />;
  return (
    <View style={{ gap: 14 }}>
      <FiltresFenetre
        criteres={criteres}
        onChange={setCriteres}
        taches={toutes}
        comptes={e.comptes}
        extras={extras}
        onEffacer={() => (setCriteres(CRITERES_VIDES), setProjetId(null))}
        extra={
          entrees.length > 1 ? (
            <View style={{ gap: 6 }}>
              <T small muted>Projet</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <Puce label="Tous" on={!choisi} onPress={() => setProjetId(null)} />
                {entrees.map((x) => (
                  <Puce key={x.projet.id} label={`${x.projet.emoji} ${x.projet.nom}`} on={choisi === x.projet.id} onPress={() => setProjetId(choisi === x.projet.id ? null : x.projet.id)} />
                ))}
              </View>
            </View>
          ) : null
        }
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Tuile titre="Projets" valeur={String(e.groupes.length)} />
        <Tuile titre="Tâches" valeur={String(e.nbTaches)} />
        <Tuile titre="En retard" valeur={e.nbEnRetard ? String(e.nbEnRetard) : 'Aucune'} couleur={e.nbEnRetard ? C.agressif : C.coach} />
      </View>

      <Responsables liste={responsables} sans={sansResponsable} aujourdhui={aujourdhui} onEcrire={ecrire} peutEcrire={peutEcrire} />

      {e.groupes.length ? (
        e.groupes.map((g) => {
          const pct = g.plan.avancement;
          const ouvert = tout.has(g.projet.id);
          const lignes = ouvert ? g.lignes : g.lignes.slice(0, MAX_PAR_PROJET);
          return (
            <Panel key={g.projet.id}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir le projet ${g.projet.nom}`} onPress={() => ouvrir(g.projet.id)} style={({ pressed }) => ({ gap: 8, opacity: pressed ? 0.8 : 1 })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 22 }}>{g.projet.emoji}</Text>
                  <Text numberOfLines={2} style={{ flex: 1, color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>
                    {g.projet.nom}
                  </Text>
                  {g.enRetard ? <Pastille label={`${g.enRetard} en retard`} couleur={C.agressif} /> : null}
                  <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 20 }}>{pct} %</Text>
                </View>
                <BarreAvancement pct={pct} hauteur={6} />
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{`${g.nbFaites}/${g.nbTaches} tâches faites`}</Text>
              </Pressable>
              {lignes.map((l) => (
                <Ligne key={l.tache.id} l={l} aujourdhui={aujourdhui} ouvrir={() => ouvrir(g.projet.id, l.tache.id)} />
              ))}
              {g.lignes.length > MAX_PAR_PROJET ? (
                <Btn small kind="sec" label={ouvert ? 'Réduire' : `Voir les ${g.lignes.length - MAX_PAR_PROJET} autres`} onPress={() => setTout((s) => new Set(ouvert ? [...s].filter((x) => x !== g.projet.id) : [...s, g.projet.id]))} />
              ) : null}
              {!g.lignes.length ? <T small muted>Aucune tâche.</T> : null}
            </Panel>
          );
        })
      ) : (
        <Empty icone="vide">{nbCriteres(criteres) ? 'Aucune tâche ne correspond aux filtres.' : 'Aucun projet.'}</Empty>
      )}
      {nbCriteres(criteres) && JSON.stringify(criteres) !== JSON.stringify(CRITERES_ENSEMBLE) ? <View style={{ flexDirection: 'row' }}><Btn small kind="sec" label="Revenir à ce qui reste à faire" onPress={() => setCriteres(CRITERES_ENSEMBLE)} /></View> : null}
    </View>
  );
}
