import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/texte';

import { api } from '@/lib/api';
import { etiquetteACreer, etiquettesAProposer, etiquettesDeLaSelection, parCompte, usageEtiquettes } from '@/lib/etiquettes';
import { refExterne } from '@/lib/externe';
import type { Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { couleursDe } from './corps-mail';
import { couleurLibelle, SaisieLigne } from './mail-ui';
import { Btn, Dialogue, T } from './ui';

/**
 * Étiqueter plusieurs mails d'un coup : une étiquette du compte, ou une nouvelle, posée sur toute la sélection ;
 * celles déjà posées se retirent de la même façon. Chaque mail est écrit chez son service (Gmail, Outlook), un par un,
 * et ce qui échoue est dit à la fin plutôt que de tout annuler.
 */
export function EtiqueterEnLot({ mails, onFini }: { mails: Mail[]; onFini: () => void }) {
  const { externes, mails: tous, session, synchroniser } = useStore();
  const [recherche, setRecherche] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [faits, setFaits] = useState(0);
  const [msg, setMsg] = useState('');
  const [posees, setPosees] = useState(() => etiquettesDeLaSelection(mails));

  const comptes = useMemo(() => parCompte(mails), [mails]);
  const dispo = useMemo(() => {
    const vus = new Set<string>();
    return externes
      .filter((x) => comptes.has(x.id))
      .flatMap((x) => x.libelles ?? [])
      .filter((l) => (vus.has(l.nom.toLowerCase()) ? false : vus.add(l.nom.toLowerCase())));
  }, [externes, comptes]);
  const usage = useMemo(() => usageEtiquettes(tous), [tous]);
  const couleurs = couleursDe(dispo);
  const proposees = etiquettesAProposer(dispo, posees.map((p) => p.nom), recherche, usage);
  const aCreer = etiquetteACreer(dispo, posees.map((p) => p.nom), recherche);

  /** Pose (ou retire) l'étiquette sur chaque mail choisi ; la sélection n'est jamais coupée en deux sans le dire. */
  const appliquer = async (nom: string, retirer = false) => {
    if (!session?.token || enCours) return;
    setEnCours(nom);
    setFaits(0);
    setMsg('');
    let erreurs = 0;
    for (const m of mails) {
      const ref = refExterne(m.id);
      if (!ref) continue;
      try {
        await api(`/integrations/${ref.compte}/mails/${encodeURIComponent(ref.element)}/libelles`, { method: 'POST', token: session.token, body: retirer ? { retirer: [nom] } : { ajouter: [nom] } });
      } catch {
        erreurs++;
      }
      setFaits((n) => n + 1);
    }
    setPosees((p) => (retirer ? p.filter((x) => x.nom !== nom) : [...p.filter((x) => x.nom.toLowerCase() !== nom.toLowerCase()), { nom, nombre: mails.length - erreurs }]));
    setRecherche('');
    setEnCours(null);
    setMsg(erreurs ? `${erreurs} mail${erreurs > 1 ? 's' : ''} sur ${mails.length} n’${erreurs > 1 ? 'ont' : 'a'} pas pu être étiqueté${erreurs > 1 ? 's' : ''}.` : '');
    synchroniser(false, true).catch(() => {});
  };

  const puce = (nom: string, sur: number | null, action: () => void) => (
    <Pressable
      key={nom}
      accessibilityRole="button"
      accessibilityLabel={sur === null ? `Poser l’étiquette ${nom} sur ${mails.length} mails` : `Retirer l’étiquette ${nom}`}
      disabled={!!enCours}
      onPress={action}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderStyle: sur === null ? 'dashed' : 'solid', borderColor: alpha(couleurLibelle(nom, couleurs), 0.6), backgroundColor: sur === null ? 'transparent' : alpha(couleurLibelle(nom, couleurs), 0.14), opacity: pressed || enCours ? 0.6 : 1 })}>
      <Text style={{ color: couleurLibelle(nom, couleurs), fontFamily: F.texteF, fontSize: 13 }}>{sur === null ? '+' : '✕'}</Text>
      <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>{nom}</Text>
      {sur !== null && sur < mails.length ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{`${sur}/${mails.length}`}</Text> : null}
    </Pressable>
  );

  return (
    <Dialogue titre={`Étiqueter ${mails.length} mail${mails.length > 1 ? 's' : ''}`} onFermer={onFini} pied={<Btn label="Terminé" onPress={onFini} />}>
      {posees.length ? (
        <View style={{ gap: 6 }}>
          <T small muted>Posées</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{posees.map((p) => puce(p.nom, p.nombre, () => appliquer(p.nom, true)))}</View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 10, backgroundColor: C.surface }}>
        <View style={{ flex: 1 }}>
          <SaisieLigne value={recherche} onChangeText={setRecherche} placeholder="Chercher ou créer une étiquette" accessibilityLabel="Chercher ou créer une étiquette" onSubmitEditing={() => aCreer && appliquer(aCreer)} returnKeyType="done" maxLength={100} />
        </View>
        {aCreer ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Créer l’étiquette ${aCreer}`} disabled={!!enCours} onPress={() => appliquer(aCreer)} hitSlop={6}>
            <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 14 }}>Créer</Text>
          </Pressable>
        ) : null}
      </View>
      {proposees.length ? (
        <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{proposees.map((p) => puce(p.nom, null, () => appliquer(p.nom)))}</View>
        </ScrollView>
      ) : (
        <T small muted>{dispo.length ? 'Aucune étiquette ne correspond.' : 'Aucune étiquette dans ce compte : tape un nom pour en créer une.'}</T>
      )}
      {enCours ? <T small muted>{`« ${enCours} » · ${faits}/${mails.length}`}</T> : null}
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
    </Dialogue>
  );
}
