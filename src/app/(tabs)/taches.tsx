import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { ChoixCategories } from '@/components/categories';
import { api } from '@/lib/api';
import { Limitee, Pastille, Pliable } from '@/components/pliable';
import { DatePick, ModePick } from '@/components/forms';
import { TacheItem } from '@/components/items';
import { etatProjet } from '@/lib/planning';
import { BarreSelection, BoutonSelection, Selectionnable, useSelection } from '@/components/selection';
import { Btn, Collant, Dialogue, Empty, Header, Input, Panel, Screen, Sep, Seg, T } from '@/components/ui';
import { Filtre } from '@/components/onglets';
import { tTache, useActions } from '@/lib/actions';
import { addDays, today, uid } from '@/lib/dates';
import { estExterne } from '@/lib/externe';
import { useStore } from '@/lib/store';
import { vive } from '@/lib/teinte';
import { grouperTaches, resumeTaches } from '@/lib/vue-courte';
import { C, F } from '@/lib/theme';
import type { Mode, Priorite, Tache } from '@/lib/types';

/** Les trois boîtes de tâches, chacune avec sa couleur (barre d'avancement, titres de groupe). */
const BOITES = [
  { key: 'pro', label: 'Pro', teinte: 'indigo' },
  { key: 'perso', label: 'Perso', teinte: 'menthe' },
  { key: 'manuel', label: 'Autres', teinte: 'lilas' },
] as const;

/** Le haut de page : où en est la journée (barre colorée par boîte) et ce qui presse, en trois chiffres. */
function Resume({ taches }: { taches: Tache[] }) {
  const d = today();
  const r = resumeTaches(taches, d);
  const faites = taches.filter((t) => t.statut === 'fait' && t.faitLe === d);
  if (!r.total && !r.ouvertes) return null;
  return (
    <Panel>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 20, letterSpacing: -0.4 }}>
          {r.faitesAujourdhui} sur {r.total} terminées
        </Text>
        <T small muted>
          {r.pct} %
        </T>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: r.pct }} style={{ height: 8, borderRadius: 4, backgroundColor: C.sunk, flexDirection: 'row', gap: 2, overflow: 'hidden' }}>
        {BOITES.map((b) => {
          const n = faites.filter((t) => t.source === b.key).length;
          return n ? <View key={b.key} style={{ width: `${(n / r.total) * 100}%`, backgroundColor: vive(b.teinte) }} /> : null;
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Pastille valeur={r.retard} label="En retard" alerte={r.retard > 0} />
        <Pastille valeur={r.aujourdhui} label="Aujourd'hui" />
        <Pastille valeur={r.semaine} label="Cette semaine" />
      </View>
    </Panel>
  );
}

/** Les listes de tâches des comptes connectés (Google Tasks, Microsoft To Do), pour y envoyer une tâche de Me. */
function useListesExternes() {
  const { externes, session } = useStore();
  const token = session?.token;
  const [listes, setListes] = useState<{ compte: string; nomCompte: string; id: string; nom: string }[]>([]);
  const cles = externes.filter((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft').map((x) => `${x.id}:${x.compte}`).join('|');
  useEffect(() => {
    if (!token || !cles) return setListes([]);
    let vivant = true;
    Promise.all(
      cles.split('|').map(async (c) => {
        const [id, nomCompte] = c.split(':');
        try {
          const r = await api<{ listes: { id: string; nom: string }[] }>(`/integrations/${id}/listes`, { token, discret: true });
          return r.listes.map((l) => ({ compte: id, nomCompte, id: l.id, nom: l.nom }));
        } catch {
          // Un compte sans liste accessible (autorisation pas encore accordée) n'empêche pas les autres.
          return [];
        }
      }),
    ).then((r) => vivant && setListes(r.flat()));
    return () => {
      vivant = false;
    };
  }, [token, cles]);
  return listes;
}

export default function Taches() {
  const { espace, update, config, session, synchroniser } = useStore();
  const [titre, setTitre] = useState('');
  const [source, setSource] = useState<Tache['source']>('pro');
  const [priorite, setPriorite] = useState<Priorite>('moyenne');
  const [echeance, setEcheance] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(config.defauts.tache);
  const [cats, setCats] = useState<string[] | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [filtre, setFiltre] = useState<'toutes' | 'perso' | 'pro' | 'manuel'>('toutes');
  const sel = useSelection();
  const { enLot } = useActions();
  const listes = useListesExternes();
  const [msgEnvoi, setMsgEnvoi] = useState('');

  // Les tâches d'un projet se suivent dans l'écran Projets ; ici, seulement celles qui n'en font pas partie.
  const projets = (espace.projets ?? []).filter((p) => !p.archive);
  const idsProjets = new Set((espace.projets ?? []).map((p) => p.id));
  const list = espace.taches.filter((t) => !(t.projet && idsProjets.has(t.projet))).filter((t) => filtre === 'toutes' || t.source === filtre);
  const groupes = grouperTaches(list, today());
  const ouvertes = list.filter((t) => t.statut !== 'fait').length;
  // Les nombres de la barre de filtres : ce qu'il reste à faire dans chaque boîte.
  const hors = espace.taches.filter((t) => !(t.projet && idsProjets.has(t.projet)) && t.statut !== 'fait');
  const parSource = (src: Tache['source']) => hors.filter((t) => t.source === src).length;

  const ajouter = () => {
    update((e) => ({ ...e, taches: [...e.taches, { id: uid(), titre: titre.trim(), source, priorite, echeance, statut: 'en_attente', mode, ...(cats?.length ? { categories: cats } : {}), creeLe: new Date().toISOString() }] }));
    setTitre('');
    setCats(undefined);
    setOpen(false);
  };

  const ouvertesIds = (ids: string[]) => ids.filter((id) => espace.taches.find((t) => t.id === id)?.statut !== 'fait');
  const reporter = (ids: string[], jours: number) => update((e) => ({ ...e, taches: e.taches.map((t) => (ids.includes(t.id) ? { ...t, echeance: addDays(today(), jours) } : t)) }));
  const actions = [
    { label: 'Terminer', onPress: (ids: string[]) => enLot((e, d, h) => ouvertesIds(ids).reduce((acc, id) => tTache(acc, id, d, h), e)) },
    { label: 'Pour demain', onPress: (ids: string[]) => reporter(ids, 1) },
    { label: 'Dans 1 semaine', onPress: (ids: string[]) => reporter(ids, 7) },
    { label: 'Priorité haute', onPress: (ids: string[]) => update((e) => ({ ...e, taches: e.taches.map((t) => (ids.includes(t.id) ? { ...t, priorite: 'haute' as const } : t)) })) },
    ...(listes.length
      ? [
          {
            label: 'Envoyer vers',
            onPress: () => {},
            choix: listes.map((l) => ({
              label: `${l.nom} · ${l.nomCompte}`,
              onPress: async (ids: string[]) => {
                const aEnvoyer = ids.map((id) => espace.taches.find((t) => t.id === id)).filter((t): t is Tache => !!t && !estExterne(t.id));
                if (!aEnvoyer.length || !session?.token) return setMsgEnvoi('Ces tâches viennent déjà d’un compte connecté.');
                setMsgEnvoi(`Envoi de ${aEnvoyer.length} tâche${aEnvoyer.length > 1 ? 's' : ''}…`);
                try {
                  for (const t of aEnvoyer) await api(`/integrations/${l.compte}/taches`, { method: 'POST', body: { listeId: l.id, titre: t.titre, echeance: t.echeance }, token: session.token });
                  setMsgEnvoi(`${aEnvoyer.length} tâche${aEnvoyer.length > 1 ? 's' : ''} envoyée${aEnvoyer.length > 1 ? 's' : ''} vers ${l.nom}.`);
                  await synchroniser(true);
                } catch (e) {
                  setMsgEnvoi((e as Error).message);
                }
              },
            })),
          },
        ]
      : []),
    { label: 'Supprimer', danger: true, onPress: (ids: string[]) => update((e) => ({ ...e, taches: e.taches.filter((t) => !ids.includes(t.id)) })) },
  ];

  return (
    <Screen pied={sel.actif ? <BarreSelection sel={sel} tous={list.map((t) => t.id)} actions={actions} /> : null}>
      <Header eyebrow="Boîtes perso et pro" title="Tâches" right={<Btn small label="+ Ajouter" onPress={() => setOpen(true)} />} />
      {open ? (
        <Dialogue titre="Nouvelle tâche" onFermer={() => setOpen(false)}>
          <Input label="Que faut-il faire ?" value={titre} onChangeText={setTitre} placeholder="Ex. Envoyer le contrat signé" />
          <Seg label="Origine" options={[{ key: 'perso', label: 'Mail perso' }, { key: 'pro', label: 'Mail pro' }, { key: 'manuel', label: 'Autre' }]} value={source} onChange={setSource} />
          <Seg label="Priorité" options={[{ key: 'haute', label: 'Haute' }, { key: 'moyenne', label: 'Moyenne' }, { key: 'basse', label: 'Basse' }]} value={priorite} onChange={setPriorite} />
          <DatePick label="Échéance" value={echeance} onChange={setEcheance} allowNone />
          <ChoixCategories value={cats} onChange={setCats} />
          <ModePick value={mode} onChange={setMode} config={config} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Btn label="Ajouter la tâche" onPress={ajouter} disabled={!titre.trim()} />
            <Btn kind="sec" label="Annuler" onPress={() => setOpen(false)} />
          </View>
        </Dialogue>
      ) : null}
      <Collant>
        <Filtre
          label="Filtrer les tâches"
          options={[
            { key: 'toutes', label: 'Toutes', compte: hors.length },
            { key: 'pro', label: 'Pro', compte: parSource('pro') },
            { key: 'perso', label: 'Perso', compte: parSource('perso') },
            { key: 'manuel', label: 'Autres', compte: parSource('manuel') },
          ]}
          value={filtre}
          onChange={setFiltre}
        />
      </Collant>
      {msgEnvoi ? (
        <Panel>
          <T small muted>{msgEnvoi}</T>
        </Panel>
      ) : null}
      <Resume taches={espace.taches.filter((t) => !(t.projet && idsProjets.has(t.projet)))} />
      <Panel title="Projets" count={projets.length || undefined} right={<Btn small kind="sec" label={projets.length ? 'Ouvrir' : 'Importer un plan Excel'} onPress={() => router.push('/projets')} />}>
        {projets.length ? (
          <Limitee items={projets} n={3} nom="projets" rendu={(p, i) => {
            const etat = etatProjet(espace.taches, p, today());
            return (
              <View key={p.id}>
                {i ? <Sep /> : null}
                <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir le projet ${p.nom}`} onPress={() => router.push({ pathname: '/projets', params: { id: p.id } })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>{p.nom}</Text>
                    <T small muted>{`${etat.nbFaites}/${etat.nbTaches} tâches${etat.enRetard ? ` · ${etat.enRetard} en retard` : ''}`}</T>
                  </View>
                  <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 14 }}>{etat.plan.avancement} %</Text>
                </Pressable>
              </View>
            );
          }} />
        ) : (
          <Empty icone="agenda">Un gros chantier ? Importe un plan Excel : Me crée les tâches, les sous-tâches, les liens entre elles et le planning.</Empty>
        )}
      </Panel>
      <Panel title="Mes tâches" count={ouvertes ? `${ouvertes} en attente` : undefined} right={list.length ? <BoutonSelection sel={sel} /> : null}>
        {list.length ? (
          // Rangées par échéance : le retard et le jour d'abord, le reste replié.
          groupes.map((g) => (
            <Pliable key={g.cle} titre={g.label} count={g.taches.length} ouvert={g.ouvert} alerte={g.cle === 'retard'} couleur={g.cle === 'terminees' ? C.muted : undefined}>
              <Limitee
                items={g.taches}
                n={g.cle === 'terminees' ? 5 : 10}
                nom="tâches"
                rendu={(t, i) => (
                  <View key={t.id}>
                    {i ? <Sep /> : null}
                    <Selectionnable sel={sel} id={t.id} label={t.titre}>
                      <TacheItem t={t} />
                    </Selectionnable>
                  </View>
                )}
              />
            </Pliable>
          ))
        ) : (
          <Empty>Aucune tâche en attente. Ajoute-en une avec « + Ajouter ».</Empty>
        )}
      </Panel>
    </Screen>
  );
}
