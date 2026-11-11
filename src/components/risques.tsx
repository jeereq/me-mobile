import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { uid } from '@/lib/dates';
import { NIVEAU_3, nomNiveau, NOMS_NIVEAU_3, niveauRisque, nouveauRisque, resumeRisques, scoreRisque, STATUTS_RISQUE, trierRisques } from '@/lib/risques';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Projet, Risque } from '@/lib/types';

import { Puce } from './finances-plus';
import { Pastille, Tuile } from './projet-detail';
import { Btn, Dialogue, Empty, Input, Panel, Seg, T } from './ui';

const couleurNiveau = (r: Risque) => (r.statut === 'clos' ? C.muted : r.statut === 'mitige' ? C.hebdo : niveauRisque(r) === 'eleve' ? C.agressif : niveauRisque(r) === 'moyen' ? C.hebdo : C.coach);

function EditeurRisque({ risque, projets, onFermer }: { risque: Risque; projets: Projet[]; onFermer: () => void }) {
  const { update, espace } = useStore();
  const existe = !!espace.risques?.some((x) => x.id === risque.id);
  const [r, setR] = useState(risque);
  const [suppr, setSuppr] = useState(false);
  const maj = (p: Partial<Risque>) => setR((x) => ({ ...x, ...p }));
  const enregistrer = () => {
    const propre: Risque = { ...r, titre: r.titre.trim(), description: r.description?.trim() || undefined, mitigation: r.mitigation?.trim() || undefined, responsable: r.responsable?.trim() || undefined };
    update((e) => ({ ...e, risques: existe ? (e.risques ?? []).map((x) => (x.id === r.id ? propre : x)) : [...(e.risques ?? []), propre] }));
    onFermer();
  };
  const supprimer = () => {
    update((e) => ({ ...e, risques: (e.risques ?? []).filter((x) => x.id !== r.id) }));
    onFermer();
  };
  return (
    <Dialogue titre={existe ? 'Modifier le risque' : 'Nouveau risque'} onFermer={onFermer}>
      <Input label="Risque" value={r.titre} onChangeText={(v: string) => maj({ titre: v })} placeholder="Que peut-il arriver ?" />
      <Input label="Détail" value={r.description ?? ''} onChangeText={(v: string) => maj({ description: v })} multiline placeholder="Cause, conséquence" />
      <Seg label="Probabilité" options={NIVEAU_3.map((n) => ({ key: String(n), label: NOMS_NIVEAU_3[n] }))} value={String(r.probabilite)} onChange={(k) => maj({ probabilite: Number(k) as 1 | 2 | 3 })} />
      <Seg label="Impact" options={NIVEAU_3.map((n) => ({ key: String(n), label: NOMS_NIVEAU_3[n] }))} value={String(r.impact)} onChange={(k) => maj({ impact: Number(k) as 1 | 2 | 3 })} />
      <T small muted>{`Niveau : ${nomNiveau(niveauRisque(r))} (score ${scoreRisque(r)} sur 9)`}</T>
      <Input label="Réponse prévue" value={r.mitigation ?? ''} onChangeText={(v: string) => maj({ mitigation: v })} multiline placeholder="Que fait-on pour l'éviter ou le réduire ?" />
      <Input label="Responsable" value={r.responsable ?? ''} onChangeText={(v: string) => maj({ responsable: v })} placeholder="Qui le suit ?" />
      <Seg label="État" options={STATUTS_RISQUE.map((s) => ({ key: s.cle, label: s.nom }))} value={r.statut} onChange={(k) => maj({ statut: k })} />
      {projets.length ? (
        <View style={{ gap: 6 }}>
          <T small muted>Projet</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Puce label="Aucun" on={!r.projet} onPress={() => maj({ projet: undefined })} />
            {projets.map((p) => (
              <Puce key={p.id} label={`${p.emoji} ${p.nom}`} on={r.projet === p.id} onPress={() => maj({ projet: r.projet === p.id ? undefined : p.id })} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn label="Enregistrer" onPress={enregistrer} disabled={!r.titre.trim()} />
        {existe ? suppr ? <Btn kind="danger" label="Confirmer la suppression" onPress={supprimer} /> : <Btn kind="sec" label="Supprimer" onPress={() => setSuppr(true)} /> : null}
      </View>
    </Dialogue>
  );
}

/** Le registre des risques : les plus graves d'abord, avec la réponse prévue et la personne qui les suit. */
export function RegistreRisques({ projets }: { projets: Projet[] }) {
  const { espace } = useStore();
  const liste = trierRisques(espace.risques ?? []);
  const resume = resumeRisques(liste);
  const [edition, setEdition] = useState<Risque | null>(null);
  const [clos, setClos] = useState(false);
  const noms = new Map(projets.map((p) => [p.id, p]));
  const visibles = liste.filter((r) => clos || r.statut !== 'clos');

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Tuile titre="Élevés" valeur={String(resume.eleve)} couleur={resume.eleve ? C.agressif : undefined} />
        <Tuile titre="Moyens" valeur={String(resume.moyen)} />
        <Tuile titre="Faibles" valeur={String(resume.faible)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn label="+ Risque" onPress={() => setEdition(nouveauRisque({ id: uid(), maintenant: new Date().toISOString() }))} />
        {resume.clos ? <Btn kind="sec" label={clos ? 'Masquer les clos' : `Voir les clos (${resume.clos})`} onPress={() => setClos(!clos)} /> : null}
      </View>
      {visibles.length ? (
        <Panel title="Risques" count={visibles.length}>
          {visibles.map((r) => (
            <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`Modifier ${r.titre}`} onPress={() => setEdition(r)} style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
              <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(couleurNiveau(r), 0.18) }}>
                <Text style={{ color: couleurNiveau(r), fontFamily: F.titre, fontSize: 15 }}>{scoreRisque(r)}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={2} style={{ color: r.statut === 'clos' ? C.muted : C.ink, fontFamily: F.texteM, fontSize: 14 }}>{r.titre}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <Pastille label={r.statut === 'clos' ? 'Clos' : r.statut === 'mitige' ? 'Réduit' : nomNiveau(niveauRisque(r))} couleur={couleurNiveau(r)} />
                  {r.projet && noms.get(r.projet) ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{`${noms.get(r.projet)!.emoji} ${noms.get(r.projet)!.nom}`}</Text> : null}
                  {r.responsable ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{r.responsable}</Text> : null}
                </View>
                {r.mitigation ? <Text numberOfLines={2} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{`Réponse : ${r.mitigation}`}</Text> : null}
              </View>
            </Pressable>
          ))}
        </Panel>
      ) : (
        <Empty icone="vide">Aucun risque suivi. Ajoute ceux qui pourraient retarder ou bloquer tes projets.</Empty>
      )}
      <T small muted>Niveau = probabilité × impact : élevé à partir de 6 sur 9.</T>
      {edition ? <EditeurRisque key={edition.id} risque={edition} projets={projets} onFermer={() => setEdition(null)} /> : null}
    </View>
  );
}
