import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { EcrireMail, type Brouillon } from '@/components/ecrire-mail';
import { Icone } from '@/components/icones';
import { LireMail, VueMail } from '@/components/lire-mail';
import { LigneMail, Outil } from '@/components/mail-ui';
import { Filtre } from '@/components/onglets';
import { Repondre } from '@/components/repondre';
import { Btn, Empty, Header, Input, Screen, T, couleur, tap } from '@/components/ui';
import { today } from '@/lib/dates';
import { SOURCE_DEFS } from '@/lib/defaults';
import { comptesDeMails, filtrerMails, grouperMails, type Mail } from '@/lib/mails';
import { SEUIL_COLONNES, useBarreOnglets } from '@/lib/mise-en-page';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Boite, SourceKey } from '@/lib/types';

/** Ce que la commande vocale passe à l'écran : lire un mail (et le dire), y répondre, ou en écrire un nouveau. */
type Params = { lire?: string; voix?: string; repondre?: string; texte?: string; ecrire?: string; a?: string; sujet?: string; nom?: string };

/** Largeur de la liste quand le volet de lecture s'ouvre à côté (ordinateur). */
const LARGEUR_LISTE = 400;

/**
 * La boîte mail de Me, dans l'esprit d'Outlook : une liste de fils (avatar, expéditeur, objet, heure) et,
 * sur ordinateur, le volet de lecture à droite ; sur téléphone, le mail s'ouvre en fenêtre et un bouton
 * flottant écrit un nouveau mail. Le texte d'un mail est demandé au serveur à l'ouverture, jamais gardé.
 */
export default function Messages() {
  const { espace, mails, externes, synchroniser } = useStore();
  const deuxVolets = useWindowDimensions().width >= SEUIL_COLONNES;
  const { haut: hautBarre } = useBarreOnglets();
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
  const peutEcrire = externes.some((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft');

  const relancer = (m: Mail) => {
    const r = espace.relances.find((x) => x.sujet === m.sujet || (m.lien && x.lien === m.lien));
    router.push(r ? ({ pathname: '/brouillon', params: { id: r.id } } as never) : '/relances');
  };
  const actualiser = async () => {
    setBusy(true);
    try {
      await synchroniser(true);
    } finally {
      setBusy(false);
    }
  };
  const ouvrirMail = (m: Mail) => {
    tap();
    setLire({ mail: m });
  };
  // Le mail lu suit la liste : après une relecture, on garde la version à jour (état « lu »).
  const lu = lireAff ? { ...lireAff, mail: mails.find((x) => x.id === lireAff.mail.id) ?? lireAff.mail } : null;

  const fenetres = (
    <>
      {lu && !deuxVolets ? (
        <LireMail
          key={lu.mail.id}
          mail={lu.mail}
          aVoix={lu.aVoix}
          onFermer={fermer(() => setLire(null))}
          onRelancer={() => relancer(lu.mail)}
          onRepondre={fermer(() => {
            setRepondre({ mail: lu.mail });
            setLire(null);
          })}
        />
      ) : null}
      {repondreAff ? <Repondre key={repondreAff.mail.id} mail={repondreAff.mail} texteInitial={repondreAff.texte} onFermer={fermer(() => setRepondre(null))} /> : null}
      {ecrireAff ? <EcrireMail brouillon={ecrireAff} onFermer={fermer(() => setEcrire(null))} /> : null}
    </>
  );

  const entete = (
    <Header
      retour
      eyebrow={nbNonLus ? `${nbNonLus} non lu${nbNonLus > 1 ? 's' : ''}` : 'Boîtes connectées'}
      title="Mails"
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {peutEcrire && deuxVolets ? <Outil principal icone="crayon" label="Nouveau mail" onPress={() => setEcrire({})} /> : null}
          {externes.length ? <Outil icone="actualiser" label={busy ? 'Relecture…' : 'Actualiser'} disabled={busy} onPress={actualiser} masquerLabel={!deuxVolets} /> : null}
        </View>
      }
    />
  );

  const filtres = (
    <View style={{ gap: 10 }}>
      <Input value={q} onChangeText={setQ} placeholder="Rechercher" accessibilityLabel="Rechercher un mail" />
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Puce on={nonLusSeuls} onPress={() => setNonLusSeuls((v) => !v)}>
          Non lus · {nbNonLus}
        </Puce>
        {comptes.length > 1
          ? comptes.map((c) => (
              <Puce key={c.compte} on={compte === c.compte} onPress={() => setCompte((x) => (x === c.compte ? 'tous' : c.compte))}>
                {c.compte}
              </Puce>
            ))
          : null}
      </View>
    </View>
  );

  const lignes = (
    <View>
      {groupes.map((g) => (
        <View key={g.cle} style={{ gap: 2, marginBottom: 6 }}>
          <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 12, letterSpacing: 0.3, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 4 }}>{g.titre}</Text>
          {g.mails.map((m) => (
            <LigneMail key={m.id} m={m} aujourdhui={d} choisi={deuxVolets && lu?.mail.id === m.id} couleurSource={couleur(espace.sources[m.source as SourceKey]?.couleur || SOURCE_DEFS[m.source as SourceKey]?.couleur)} onPress={() => ouvrirMail(m)} />
          ))}
        </View>
      ))}
      {mails.length && !liste.length ? <Empty>Aucun mail ne correspond à ces filtres.</Empty> : null}
    </View>
  );

  const vide = !externes.length ? (
    <View style={{ gap: 12 }}>
      <Empty icone="mail">Connecte Gmail ou Outlook dans Agendas & outils pour lire et écrire tes mails ici.</Empty>
      <Btn kind="sec" label="Agendas & outils" onPress={() => router.push('/sources')} />
    </View>
  ) : !mails.length ? (
    <View style={{ gap: 12 }}>
      <Empty icone="mail">Rien à afficher pour l'instant. Vérifie que « Mails » est coché pour Gmail ou Outlook dans Agendas & outils, puis actualise.</Empty>
      <Btn kind="sec" label="Agendas & outils" onPress={() => router.push('/sources')} />
    </View>
  ) : null;

  // Ordinateur : la liste à gauche, le mail ouvert à droite, chacun avec son propre défilement.
  if (deuxVolets)
    return (
      <Screen scroll={false}>
        {fenetres}
        {entete}
        <View style={{ flex: 1, flexDirection: 'row', gap: 16, minHeight: 0 }}>
          <Volet style={{ width: LARGEUR_LISTE }}>
            <View style={{ padding: 12, paddingBottom: 6 }}>{filtres}</View>
            <ScrollView contentContainerStyle={{ padding: 6, paddingTop: 0 }}>{vide ?? lignes}</ScrollView>
          </Volet>
          <Volet style={{ flex: 1 }}>
            {lu ? (
              <ScrollView contentContainerStyle={{ padding: 24 }}>
                <VueMail
                  key={lu.mail.id}
                  mail={lu.mail}
                  aVoix={lu.aVoix}
                  onRelancer={() => relancer(lu.mail)}
                  onRepondre={() => setRepondre({ mail: lu.mail })}
                />
              </ScrollView>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(C.accent, 0.12) }}>
                  <Icone nom="mail" color={C.accent} size={28} />
                </View>
                <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>Choisis un mail pour le lire</Text>
                <T small muted>
                  Ou dis « Lis le mail de Paul ».
                </T>
              </View>
            )}
          </Volet>
        </View>
      </Screen>
    );

  // Téléphone : une seule colonne, le mail s'ouvre en fenêtre, « Nouveau mail » flotte en bas à droite.
  return (
    <Screen
      pied={
        peutEcrire ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nouveau mail"
            onPress={() => setEcrire({})}
            style={({ pressed }) => ({ position: 'absolute', right: 18, bottom: hautBarre + 18, flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: 18, borderRadius: 18, backgroundColor: C.accent, opacity: pressed ? 0.85 : 1, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 })}>
            <Icone nom="crayon" color={C.accentInk} size={19} />
            <Text style={{ color: C.accentInk, fontFamily: F.texteF, fontSize: 15 }}>Nouveau mail</Text>
          </Pressable>
        ) : undefined
      }>
      {fenetres}
      {entete}
      {mails.length ? filtres : null}
      <Volet style={{ paddingVertical: 4, paddingHorizontal: 2 }}>{vide ?? lignes}</Volet>
    </Screen>
  );
}

/** Une puce de filtre (Non lus, un compte) : allumée quand le filtre s'applique. */
function Puce({ on, onPress, children }: { on: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.16) : pressed ? alpha(C.ink, 0.06) : 'transparent' })}>
      <Text numberOfLines={1} style={{ color: on ? C.ink : C.muted, fontFamily: on ? F.texteM : F.texte, fontSize: 12.5 }}>
        {children}
      </Text>
    </Pressable>
  );
}

/** Le cadre d'un volet (liste, lecture) : surface arrondie, comme les panneaux du reste de l'app. */
function Volet({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, overflow: 'hidden', minHeight: 0 }, style]}>{children}</View>;
}
