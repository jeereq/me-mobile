import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { EcrireMail, type Brouillon } from '@/components/ecrire-mail';
import { LireMail } from '@/components/lire-mail';
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

/** Ce que la commande vocale passe à l'écran : lire un mail (et le dire), y répondre, ou en écrire un nouveau. */
type Params = { lire?: string; voix?: string; repondre?: string; texte?: string; ecrire?: string; a?: string; sujet?: string; nom?: string };

/**
 * La boîte mail de Me : les fils récents de Gmail et d'Outlook. Toucher un fil le lit dans Me (le texte est
 * demandé au serveur à ce moment-là, jamais gardé) ; « Nouveau mail » écrit depuis un compte connecté.
 */
export default function Messages() {
  const { espace, mails, externes, synchroniser } = useStore();
  const d = today();
  const [boite, setBoite] = useState<Boite | 'toutes'>('toutes');
  const [compte, setCompte] = useState<string>('tous');
  const [nonLusSeuls, setNonLusSeuls] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [repondre, setRepondre] = useState<{ mail: Mail; texte?: string } | null>(null);
  const [lire, setLire] = useState<{ mail: Mail; aVoix?: boolean } | null>(null);
  const [ecrire, setEcrire] = useState<Brouillon | null>(null);
  const params = useLocalSearchParams<Params>();

  // Une demande venue de la voix s'affiche dès que le mail visé est dans la liste, jusqu'à ce qu'on ferme la fenêtre.
  const cle = JSON.stringify(params);
  const [fermee, setFermee] = useState('');
  const voix = useMemo(() => {
    if (params.ecrire) return { ecrire: { a: params.a, sujet: params.sujet, texte: params.texte, nom: params.nom } as Brouillon };
    const id = params.lire || params.repondre;
    const m = id ? mails.find((x) => x.id === id) : undefined;
    if (!m) return null;
    return params.lire ? { lire: { mail: m, aVoix: params.voix === '1' } } : { repondre: { mail: m, texte: params.texte } };
  }, [params, mails]);
  const demande = fermee !== cle ? voix : null;
  const lireAff = lire ?? demande?.lire ?? null;
  const repondreAff = repondre ?? demande?.repondre ?? null;
  const ecrireAff = ecrire ?? demande?.ecrire ?? null;
  const fermer = (f: () => void) => () => {
    f();
    setFermee(cle);
  };

  const comptes = useMemo(() => comptesDeMails(mails), [mails]);
  const liste = useMemo(
    () => filtrerMails(mails, { boite, compte: compte === 'tous' ? undefined : compte, nonLus: nonLusSeuls, q }),
    [mails, boite, compte, nonLusSeuls, q],
  );
  const groupes = useMemo(() => grouperMails(liste, d), [liste, d]);
  const parBoite = (b: Boite) => mails.filter((m) => m.ctx === b).length;
  const nbNonLus = mails.filter((m) => m.nonLu).length;

  const lienExterne = (m: Mail) => {
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
      {lireAff ? (
        <LireMail
          key={lireAff.mail.id}
          mail={lireAff.mail}
          aVoix={lireAff.aVoix}
          onFermer={fermer(() => setLire(null))}
          onRepondre={fermer(() => {
            setRepondre({ mail: lireAff.mail });
            setLire(null);
          })}
        />
      ) : null}
      {repondreAff ? <Repondre key={repondreAff.mail.id} mail={repondreAff.mail} texteInitial={repondreAff.texte} onFermer={fermer(() => setRepondre(null))} /> : null}
      {ecrireAff ? <EcrireMail brouillon={ecrireAff} onFermer={fermer(() => setEcrire(null))} /> : null}
      <Header
        retour
        eyebrow="Boîtes connectées"
        title="Mails"
        right={
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
            {externes.some((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft') ? <Btn small label="Nouveau mail" onPress={() => setEcrire({})} /> : null}
            <Btn small kind="sec" label={busy ? 'Relecture…' : 'Actualiser'} disabled={busy} onPress={async () => { setBusy(true); try { await synchroniser(true); } finally { setBusy(false); } }} />
          </View>
        }
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
                  rendu={(m) => <LigneMail key={m.id} m={m} sourceCouleur={couleur(espace.sources[m.source as SourceKey]?.couleur || SOURCE_DEFS[m.source as SourceKey]?.couleur)} onLire={() => { tap(); setLire({ mail: m }); }} onOuvrir={() => lienExterne(m)} onRepondre={() => setRepondre({ mail: m })} onRelancer={() => relancer(m)} />}
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
        Touche un fil pour le lire : Me va chercher son texte à ce moment-là, sans le garder, et le marque comme lu. « Répondre » envoie ta réponse dans le fil, « Nouveau mail » écrit depuis ton compte ; la flèche ↗ ouvre la discussion dans Gmail ou Outlook. À la voix : « Lis mes mails », « Lis le mail de Paul », « Réponds à Paul que c'est bon ».
      </T>
    </Screen>
  );
}

function LigneMail({ m, sourceCouleur, onLire, onOuvrir, onRepondre, onRelancer }: { m: Mail; sourceCouleur: string; onLire: () => void; onOuvrir: () => void; onRepondre: () => void; onRelancer: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, backgroundColor: m.nonLu ? sourceCouleur : 'transparent', borderWidth: m.nonLu ? 0 : 1, borderColor: C.line }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${m.sujet}, de ${m.contact}${m.heure ? `, à ${m.heure}` : ''}${m.nonLu ? ', non lu' : ''}. Lire le mail`}
        onPress={onLire}
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
