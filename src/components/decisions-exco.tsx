import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { aInscrire, appliquerDecision, estOuverte, nomStatutDecision, nouvelleDecision, STATUTS_DECISION, trierDecisions } from '@/lib/decisions-exco';
import { fmtCourt, today, uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';
import type { DecisionExco, Projet } from '@/lib/types';

import { DatePick } from './forms';
import { Puce } from './finances-plus';
import { Pastille, Tuile } from './projet-detail';
import { Btn, Dialogue, Empty, Input, Panel, Seg, T } from './ui';

const couleurStatut = (s: DecisionExco['statut']) => (s === 'prise' ? C.coach : s === 'refusee' ? C.agressif : s === 'reportee' ? C.hebdo : C.accent);

function EditeurDecision({ decision, projets, onFermer }: { decision: DecisionExco; projets: Projet[]; onFermer: () => void }) {
  const { update, espace } = useStore();
  const existe = !!espace.decisionsExco?.some((x) => x.id === decision.id);
  const [d, setD] = useState(decision);
  const [suppr, setSuppr] = useState(false);
  const maj = (p: Partial<DecisionExco>) => setD((x) => ({ ...x, ...p }));
  const tache = d.tache ? espace.taches.find((t) => t.id === d.tache) : undefined;
  const enregistrer = () => {
    const propre: DecisionExco = { ...d, titre: d.titre.trim(), decision: d.decision?.trim() || undefined };
    update((e) => ({ ...e, decisionsExco: existe ? (e.decisionsExco ?? []).map((x) => (x.id === d.id ? propre : x)) : [...(e.decisionsExco ?? []), propre], taches: appliquerDecision(e.taches, propre) }));
    onFermer();
  };
  const supprimer = () => {
    update((e) => ({ ...e, decisionsExco: (e.decisionsExco ?? []).filter((x) => x.id !== d.id) }));
    onFermer();
  };
  return (
    <Dialogue titre={existe ? 'Modifier la décision' : 'Nouvelle décision'} onFermer={onFermer}>
      <Input label="Décision" value={d.titre} onChangeText={(v: string) => maj({ titre: v })} placeholder="Que faut-il décider ?" />
      <Seg label="État" options={STATUTS_DECISION.map((s) => ({ key: s.cle, label: s.nom }))} value={d.statut} onChange={(k) => maj({ statut: k })} />
      <DatePick label={d.statut === 'a_prendre' ? 'Séance prévue' : 'Date de la décision'} value={d.date} onChange={(v) => v && maj({ date: v })} />
      {d.statut !== 'a_prendre' ? <Input label="Ce qui a été décidé" value={d.decision ?? ''} onChangeText={(v: string) => maj({ decision: v })} multiline placeholder="En une phrase" /> : null}
      {tache ? <T small muted>{`Action liée : ${tache.titre}. Une décision prise ou refusée la retire des actions « À valider ».`}</T> : null}
      {projets.length ? (
        <View style={{ gap: 6 }}>
          <T small muted>Projet</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Puce label="Aucun" on={!d.projet} onPress={() => maj({ projet: undefined })} />
            {projets.map((p) => (
              <Puce key={p.id} label={`${p.emoji} ${p.nom}`} on={d.projet === p.id} onPress={() => maj({ projet: d.projet === p.id ? undefined : p.id })} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn label="Enregistrer" onPress={enregistrer} disabled={!d.titre.trim()} />
        {existe ? suppr ? <Btn kind="danger" label="Confirmer la suppression" onPress={supprimer} /> : <Btn kind="sec" label="Supprimer" onPress={() => setSuppr(true)} /> : null}
      </View>
    </Dialogue>
  );
}

/** Le journal des décisions de l'Exco : ce qui reste à décider, puis ce qui a été décidé, avec la date et la phrase retenue. */
export function JournalExco({ projets }: { projets: Projet[] }) {
  const { espace, update } = useStore();
  const liste = trierDecisions(espace.decisionsExco ?? []);
  const propositions = aInscrire(espace.taches, liste);
  const [edition, setEdition] = useState<DecisionExco | null>(null);
  const noms = new Map(projets.map((p) => [p.id, p]));
  const ouvertes = liste.filter(estOuverte).length;
  const maintenant = () => new Date().toISOString();

  const inscrire = (ids: string[]) =>
    update((e) => ({ ...e, decisionsExco: [...(e.decisionsExco ?? []), ...e.taches.filter((t) => ids.includes(t.id)).map((t) => nouvelleDecision({ id: uid(), date: today(), maintenant: maintenant(), titre: t.titre, tache: t.id, ...(t.projet ? { projet: t.projet } : {}) }))] }));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Tuile titre="À prendre" valeur={String(ouvertes)} couleur={ouvertes ? C.hebdo : undefined} />
        <Tuile titre="Prises" valeur={String(liste.filter((d) => d.statut === 'prise').length)} />
      </View>
      <Btn label="+ Décision" onPress={() => setEdition(nouvelleDecision({ id: uid(), date: today(), maintenant: maintenant() }))} />

      {propositions.length ? (
        <Panel title="Actions à valider" count={propositions.length} right={<Btn small kind="sec" label="Tout inscrire" onPress={() => inscrire(propositions.map((t) => t.id))} />}>
          <T small muted>Ces actions attendent une validation et ne sont pas encore au journal.</T>
          {propositions.slice(0, 20).map((t) => (
            <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 }}>
              <Text numberOfLines={2} style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>{t.titre}</Text>
              <Btn small kind="sec" label="Inscrire" onPress={() => inscrire([t.id])} />
            </View>
          ))}
          {propositions.length > 20 ? <T small muted>{`+ ${propositions.length - 20} autres`}</T> : null}
        </Panel>
      ) : null}

      {liste.length ? (
        <Panel title="Journal" count={liste.length}>
          {liste.map((d) => (
            <Pressable key={d.id} accessibilityRole="button" accessibilityLabel={`Modifier ${d.titre}`} onPress={() => setEdition(d)} style={({ pressed }) => ({ gap: 3, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
              <Text numberOfLines={2} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>{d.titre}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <Pastille label={nomStatutDecision(d.statut)} couleur={couleurStatut(d.statut)} />
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{fmtCourt(d.date)}</Text>
                {d.projet && noms.get(d.projet) ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{`${noms.get(d.projet)!.emoji} ${noms.get(d.projet)!.nom}`}</Text> : null}
              </View>
              {d.decision ? <Text numberOfLines={3} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{d.decision}</Text> : null}
            </Pressable>
          ))}
        </Panel>
      ) : !propositions.length ? (
        <Empty icone="vide">Aucune décision au journal. Note ici ce que l'Exco décide, avec la date.</Empty>
      ) : null}
      {edition ? <EditeurDecision key={edition.id} decision={edition} projets={projets} onFermer={() => setEdition(null)} /> : null}
    </View>
  );
}
