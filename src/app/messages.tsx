import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { Filtre } from '@/components/onglets';
import { Limitee } from '@/components/pliable';
import { Repondre } from '@/components/repondre';
import { Btn, Empty, Grille, Header, Input, Panel, Screen, T, Tag, couleur, tap } from '@/components/ui';
import { today } from '@/lib/dates';
import { SOURCE_DEFS } from '@/lib/defaults';
import { comptesDeMails, filtrerMails, grouperMails, type Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Boite, SourceKey } from '@/lib/types';

/**
 * La boîte mail de Me : les fils récents de Gmail et d'Outlook, pour voir ce qui attend et ouvrir
 * la discussion d'origine. Me ne lit jamais le contenu d'un message — seulement l'objet, le contact et la date.
 */
export default function Messages() {
  const { espace, mails, externes, synchroniser } = useStore();
  const d = today();
  const [boite, setBoite] = useState<Boite | 'toutes'>('toutes');
  const [compte, setCompte] = useState<string>('tous');
  const [nonLusSeuls, setNonLusSeuls] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [repondre, setRepondre] = useState<Mail | null>(null);

  const comptes = useMemo(() => comptesDeMails(mails), [mails]);
  const liste = useMemo(
    () => filtrerMails(mails, { boite, compte: compte === 'tous' ? undefined : compte, nonLus: nonLusSeuls, q }),
    [mails, boite, compte, nonLusSeuls, q],
  );
  const groupes = useMemo(() => grouperMails(liste, d), [liste, d]);
  const parBoite = (b: Boite) => mails.filter((m) => m.ctx === b).length;
  const nbNonLus = mails.filter((m) => m.nonLu).length;

  const ouvrir = (m: Mail) => {
    if (!m.lien) return;
    tap();
    Linking.openURL(m.lien).catch(() => {});
  };
  const relancer = (m: Mail) => {
    const r = espace.relances.find((x) => x.sujet === m.sujet || (m.lien && x.lien === m.lien));
    router.push(r ? ({ pathname: '/brouillon', params: { id: r.id } } as never) : '/relances');
  };

  return (
    <Screen>
      {repondre ? <Repondre key={repondre.id} mail={repondre} onFermer={() => setRepondre(null)} /> : null}
      <Header
        retour
        eyebrow="Boîtes connectées"
        title="Mails"
        right={<Btn small kind="sec" label={busy ? 'Relecture…' : 'Actualiser'} disabled={busy} onPress={async () => { setBusy(true); try { await synchroniser(true); } finally { setBusy(false); } }} />}
      />

      {!externes.length ? (
        <Panel>
          <Empty icone="agenda">Connecte Gmail ou Outlook dans Agendas & outils pour voir tes fils récents ici.</Empty>
          <Btn kind="sec" label="Agendas & outils" onPress={() => router.push('/sources')} />
        </Panel>
      ) : null}

      {mails.length ? (
        <>
          <Panel>
            <Input value={q} onChangeText={setQ} placeholder="Rechercher un objet, un contact, un compte" accessibilityLabel="Rechercher un mail" />
            <Filtre
              label="Filtrer les mails par boîte"
              options={[
                { key: 'toutes', label: 'Toutes', compte: mails.length },
                { key: 'perso', label: 'Perso', compte: parBoite('perso') },
                { key: 'pro', label: 'Pro', compte: parBoite('pro') },
              ]}
              value={boite}
              onChange={setBoite}
            />
            {comptes.length > 1 ? (
              <Filtre
                label="Filtrer les mails par compte"
                options={[{ key: 'tous', label: 'Tous les comptes', compte: mails.length }, ...comptes.map((c) => ({ key: c.compte, label: c.compte, compte: c.nombre }))]}
                value={compte}
                onChange={setCompte}
              />
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Btn small kind="sec" label={nonLusSeuls ? `✓ Non lus (${nbNonLus})` : `Non lus (${nbNonLus})`} onPress={() => setNonLusSeuls((v) => !v)} />
              <T small muted>
                {liste.length} fil{liste.length > 1 ? 's' : ''} affiché{liste.length > 1 ? 's' : ''}
              </T>
            </View>
          </Panel>

          <Grille min={380}>
            {groupes.map((g) => (
              <Panel key={g.cle} title={g.titre} count={g.mails.length} accent={g.cle === d}>
                <Limitee
                  items={g.mails}
                  n={8}
                  nom="mails"
                  rendu={(m) => <LigneMail key={m.id} m={m} sourceCouleur={couleur(espace.sources[m.source as SourceKey]?.couleur || SOURCE_DEFS[m.source as SourceKey]?.couleur)} onOuvrir={() => ouvrir(m)} onRepondre={() => setRepondre(m)} onRelancer={() => relancer(m)} />}
                />
              </Panel>
            ))}
          </Grille>

          {!liste.length ? (
            <Panel>
              <Empty>Aucun mail ne correspond à ces filtres.</Empty>
            </Panel>
          ) : null}
        </>
      ) : externes.length ? (
        <Panel>
          <Empty icone="agenda">
            Rien à afficher pour l'instant. Vérifie que « Mails » est coché pour Gmail ou Outlook dans Agendas & outils, puis touche « Actualiser ».
          </Empty>
          <Btn kind="sec" label="Agendas & outils" onPress={() => router.push('/sources')} />
        </Panel>
      ) : null}

      <T small muted>
        Me affiche l'objet, le contact et la date d'un fil, jamais le contenu des messages. « Répondre » envoie ta réponse dans le fil depuis Me ; la flèche ↗ ouvre la discussion dans Gmail ou Outlook.
      </T>
    </Screen>
  );
}

function LigneMail({ m, sourceCouleur, onOuvrir, onRepondre, onRelancer }: { m: Mail; sourceCouleur: string; onOuvrir: () => void; onRepondre: () => void; onRelancer: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: m.nonLu ? sourceCouleur : 'transparent', borderWidth: m.nonLu ? 0 : 1, borderColor: C.line }} />
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${m.sujet}, de ${m.contact}${m.heure ? `, à ${m.heure}` : ''}${m.nonLu ? ', non lu' : ''}. ${m.lien ? 'Ouvrir le fil' : 'Pas de lien'}`}
        disabled={!m.lien}
        onPress={onOuvrir}
        style={({ pressed }) => ({ flex: 1, minWidth: 0, gap: 3, opacity: pressed ? 0.7 : 1 })}>
        <Text numberOfLines={2} style={{ color: C.ink, fontFamily: m.nonLu ? F.texteF : F.texteM, fontSize: 15 }}>
          {m.sujet}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <T small muted>
            {m.contact || 'Sans expéditeur'}
            {m.heure ? ` · ${m.heure}` : ''}
          </T>
          <Tag label={SOURCE_DEFS[m.source as SourceKey]?.nom || m.source} color={sourceCouleur} />
          {m.ctx === 'pro' ? <Tag label="Pro" color={C.muted} /> : null}
          {m.nonLu ? (
            <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: alpha(sourceCouleur, 0.16) }}>
              <Text style={{ color: sourceCouleur, fontFamily: F.texteF, fontSize: 11 }}>Non lu</Text>
            </View>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`Répondre à « ${m.sujet} »`} hitSlop={6} onPress={onRepondre} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 12 }}>Répondre</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Préparer une relance pour « ${m.sujet} »`} hitSlop={6} onPress={onRelancer} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>Relancer</Text>
          </Pressable>
        </View>
      </Pressable>
      {m.lien ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`Ouvrir « ${m.sujet} » dans ${SOURCE_DEFS[m.source as SourceKey]?.nom || 'le service'}`} hitSlop={6} onPress={onOuvrir} style={({ pressed }) => ({ paddingHorizontal: 6, paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: C.muted, fontSize: 17 }}>↗</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
