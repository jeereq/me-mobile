import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { couleursDe } from '@/components/corps-mail';
import { memeVue, oublierDossiers, useMailsDossier, VoletDossiers, type VueMails } from '@/components/dossiers-mail';
import { EcrireMail, type Brouillon } from '@/components/ecrire-mail';
import { Icone } from '@/components/icones';
import { useMailDuFil } from '@/components/lien-mail';
import { LireMail, VueMail } from '@/components/lire-mail';
import { couleurLibelle, LigneMail, Outil, type CouleursLibelles } from '@/components/mail-ui';
import { Filtre } from '@/components/onglets';
import { Repondre } from '@/components/repondre';
import { BarreSelection, Selectionnable, useSelection } from '@/components/selection';
import { AnalyseMails } from '@/components/analyse-mails';
import { useCopiloteVisible } from '@/components/copilote';
import { Btn, Dialogue, Empty, Header, Input, Screen, T, couleur, tap } from '@/components/ui';
import { ReservePro } from '@/components/reserve-pro';
import { Bloc, ZoneSquelette } from '@/components/squelettes';
import { today } from '@/lib/dates';
import { SOURCE_DEFS } from '@/lib/defaults';
import { mailsAAnalyser, type Perimetre } from '@/lib/copilote';
import { PerimetreAnalyse } from '@/components/perimetre-analyse';
import { liesAuMail, mailDuLien, relanceDepuisMail } from '@/lib/liens-mail';
import { adresseEmail, boitesDeMails, filtrerMails, grouperMails, libellesDeMails, nomBoite, type BoiteMail, type Mail } from '@/lib/mails';
import { SEUIL_COLONNES, useBarreOnglets } from '@/lib/mise-en-page';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Boite, SourceKey } from '@/lib/types';

/**
 * Ce que la commande vocale passe à l'écran : lire un mail (et le dire), y répondre, ou en écrire un nouveau.
 * `fil` ouvre le mail d'origine d'une relance ou d'une tâche (`compte:fil`), relu chez le service s'il n'est plus dans la boîte.
 */
/** `analyser` : « 1 » lance l'analyse des non lus par le copilote, « choisir » ouvre le choix des mails à analyser (personne, domaine, dossier…). */
type Params = { lire?: string; fil?: string; voix?: string; repondre?: string; texte?: string; ecrire?: string; a?: string; sujet?: string; nom?: string; analyser?: string };

/** Largeur de la liste quand le volet de lecture s'ouvre à côté (ordinateur). */
const LARGEUR_LISTE = 400;
/** Au-delà, les boîtes et les étiquettes ont leur colonne à gauche, comme le volet des dossiers d'Outlook. */
const SEUIL_DOSSIERS = 1400;
const LARGEUR_DOSSIERS = 230;

/**
 * La boîte mail de Me, dans l'esprit d'Outlook : une liste de fils (avatar, expéditeur, objet, heure) et,
 * sur ordinateur, le volet de lecture à droite ; sur téléphone, le mail s'ouvre en fenêtre et un bouton
 * flottant écrit un nouveau mail. Le texte d'un mail est demandé au serveur à l'ouverture, jamais gardé.
 */
export default function Messages() {
  const { espace, mails, externes, synchroniser, update, config } = useStore();
  const largeur = useWindowDimensions().width;
  const deuxVolets = largeur >= SEUIL_COLONNES;
  const avecDossiers = largeur >= SEUIL_DOSSIERS;
  const { haut: hautBarre } = useBarreOnglets();
  const d = today();
  const [boite, setBoite] = useState<Boite | 'toutes'>('toutes');
  const [compte, setCompte] = useState<string>('tous');
  const [nonLusSeuls, setNonLusSeuls] = useState(false);
  const [libelle, setLibelle] = useState<string>('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [repondre, setRepondre] = useState<{ mail: Mail; texte?: string } | null>(null);
  const [lire, setLire] = useState<{ mail: Mail; aVoix?: boolean } | null>(null);
  const [ecrire, setEcrire] = useState<Brouillon | null>(null);
  // La liste montre la réception de toutes les boîtes, ou un dossier ouvert depuis le volet (lu page par page).
  const [vue, setVue] = useState<VueMails>({ type: 'tout' });
  const [version, setVersion] = useState(0);
  const [voirDossiers, setVoirDossiers] = useState(false);
  const dossier = useMailsDossier(vue, version);
  const params = useLocalSearchParams<Params>();
  const copilote = useCopiloteVisible();
  const sel = useSelection();
  const [analyse, setAnalyse] = useState<{ mails: Mail[]; perimetre?: string } | null>(null);
  // Le choix du lot à analyser, prérempli depuis le mail ouvert ou le dossier affiché.
  const [choixLot, setChoixLot] = useState<Partial<Perimetre> | null>(null);

  // Une demande venue de la voix s'affiche dès que le mail visé est dans la liste, jusqu'à ce qu'on ferme la fenêtre.
  const cle = JSON.stringify(params);
  const [fermee, setFermee] = useState('');
  const duFil = useMailDuFil(params.fil, mails);
  const voix = useMemo(() => {
    if (params.fil) {
      const m = mailDuLien({ fil: params.fil, sujet: '' }, mails) ?? duFil.mail;
      return m ? { lire: { mail: m } } : null;
    }
    if (params.ecrire) return { ecrire: { a: params.a, sujet: params.sujet, texte: params.texte, nom: params.nom } as Brouillon };
    const id = params.lire || params.repondre;
    const m = id ? mails.find((x) => x.id === id) : undefined;
    if (!m) return null;
    return params.lire ? { lire: { mail: m, aVoix: params.voix === '1' } } : { repondre: { mail: m, texte: params.texte } };
  }, [params, mails, duFil.mail]);
  const demande = fermee !== cle ? voix : null;
  // Venu de Mon copilote : l'analyse des non lus s'ouvre, ou la sélection des mails à analyser.
  const [analyseVue, setAnalyseVue] = useState('');
  if (params.analyser && analyseVue !== cle && mails.length) {
    setAnalyseVue(cle);
    if (params.analyser === 'choisir') setChoixLot({});
    else setAnalyse({ mails: mailsAAnalyser(mails) });
  }
  const lireAff = lire ?? demande?.lire ?? null;
  const repondreAff = repondre ?? demande?.repondre ?? null;
  const ecrireAff = ecrire ?? demande?.ecrire ?? null;
  const fermer = (f: () => void) => () => {
    f();
    setFermee(cle);
  };

  const boites = useMemo(() => boitesDeMails(mails), [mails]);
  const libelles = useMemo(() => libellesDeMails(mails), [mails]);
  const couleurs: CouleursLibelles = useMemo(() => couleursDe(externes.flatMap((x) => x.libelles ?? [])), [externes]);
  // Une boîte partagée demandée mais refusée se dit dans la liste des boîtes, avec la raison.
  const boitesEnErreur = useMemo(() => externes.flatMap((x) => (x.boites ?? []).filter((b) => b.erreur).map((b) => ({ ...b, compte: x.compte }))), [externes]);
  const enDossier = vue.type === 'dossier' ? vue : null;
  const liste = useMemo(
    () => (enDossier ? filtrerMails(dossier.mails, { q }) : filtrerMails(mails, { boite, compte: compte === 'tous' ? undefined : compte, nonLus: nonLusSeuls, q, libelle: libelle || undefined })),
    [enDossier, dossier.mails, mails, boite, compte, nonLusSeuls, q, libelle],
  );
  const avecVolet = externes.some((x) => x.dossiers);
  const couleurSource = (s: SourceKey) => couleur(espace.sources[s]?.couleur || SOURCE_DEFS[s]?.couleur);
  const choisirVue = (v: VueMails) => {
    if (!memeVue(v, vue)) {
      setVue(v);
      setLire(null);
    }
    setVoirDossiers(false);
  };
  const groupes = useMemo(() => grouperMails(liste, d), [liste, d]);
  const parBoite = (b: Boite) => mails.filter((m) => m.ctx === b).length;
  const nbNonLus = mails.filter((m) => m.nonLu).length;
  const peutEcrire = externes.some((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft');

  // « Relancer » rédige la relance rattachée à ce fil ; sans relance liée, il en crée une (elle apparaît dans le Suivi du mail).
  const relancer = (m: Mail) => {
    const liee = liesAuMail(m, espace).find((x) => x.genre === 'relance' && !x.fait);
    if (liee) return router.push({ pathname: '/brouillon', params: { id: liee.id } } as never);
    update((e) => ({ ...e, relances: [...e.relances, relanceDepuisMail(m, config)] }));
  };
  const actualiser = async () => {
    setBusy(true);
    try {
      oublierDossiers();
      setVersion((v) => v + 1);
      await synchroniser(true);
    } finally {
      setBusy(false);
    }
  };
  // Un mail rangé quitte le dossier ouvert, et la réception se relit.
  const deplace = (m: Mail) => {
    dossier.retirer(m.id);
    setLire(null);
  };
  // « Analyser » part du contexte : le dossier affiché, sinon la personne du mail ouvert.
  const lotInitial = (): Partial<Perimetre> =>
    enDossier ? { genre: 'dossier', compte: enDossier.compte, ...(enDossier.boite ? { boite: enDossier.boite } : {}), dossier: { id: enDossier.dossier.id, nom: enDossier.dossier.nom } } : lu ? { genre: 'personne', qui: lu.mail.adresse ? adresseEmail(lu.mail.adresse) : lu.mail.contact } : {};
  const ouvrirMail = (m: Mail) => {
    tap();
    // Ouvert = lu, dans la liste du dossier aussi (la réception suit à l'ouverture du mail).
    if (m.nonLu) dossier.marquerLu(m.id);
    setLire({ mail: m });
  };
  // Le mail lu suit la liste : après une relecture, on garde la version à jour (état « lu »).
  const lu = lireAff ? { ...lireAff, mail: mails.find((x) => x.id === lireAff.mail.id) ?? lireAff.mail } : null;
  const titreVue = enDossier ? enDossier.dossier.nom : 'Mails';
  const sousVue = enDossier ? `${enDossier.boite ? `${nomBoite(enDossier.boite)} · partagée` : enDossier.adresse}` : nbNonLus ? `${nbNonLus} non lu${nbNonLus > 1 ? 's' : ''}` : 'Boîtes connectées';

  const choisirBoite = (a: string) => {
    tap();
    setCompte((x) => (x === a ? 'tous' : a));
  };
  const choisirLibelle = (n: string) => {
    tap();
    setLibelle((x) => (x === n ? '' : n));
  };

  // Le volet des dossiers : chaque compte et ses boîtes partagées avec leur arbre, comme Outlook.
  const volet = <VoletDossiers vue={vue} onChoisir={choisirVue} nbNonLus={nbNonLus} libelles={libelles} libelle={libelle} onLibelle={(n) => (choisirLibelle(n), setVoirDossiers(false))} couleurs={couleurs} couleurSource={couleurSource} />;
  const fenetres = (
    <>
      {lu && !deuxVolets ? (
        <LireMail
          key={lu.mail.id}
          mail={lu.mail}
          aVoix={lu.aVoix}
          onFermer={fermer(() => setLire(null))}
          onRelancer={() => relancer(lu.mail)}
          onDeplace={() => deplace(lu.mail)}
          onAnalyser={copilote ? () => (setLire(null), setAnalyse({ mails: [lu.mail] })) : undefined}
          onRepondre={fermer(() => {
            setRepondre({ mail: lu.mail });
            setLire(null);
          })}
        />
      ) : null}
      {choixLot ? (
        <PerimetreAnalyse
          initial={choixLot}
          onFermer={() => setChoixLot(null)}
          onCocher={() => {
            setChoixLot(null);
            sel.demarrer();
          }}
          onAnalyser={(l, perimetre) => {
            setChoixLot(null);
            setAnalyse({ mails: l, perimetre });
          }}
        />
      ) : null}
      {analyse ? (
        <AnalyseMails
          mails={analyse.mails}
          perimetre={analyse.perimetre}
          onFermer={() => setAnalyse(null)}
          onModifier={(m, texte) => {
            setAnalyse(null);
            setRepondre({ mail: m, texte });
          }}
        />
      ) : null}
      {repondreAff ? <Repondre key={repondreAff.mail.id} mail={repondreAff.mail} texteInitial={repondreAff.texte} onFermer={fermer(() => setRepondre(null))} /> : null}
      {ecrireAff ? <EcrireMail brouillon={ecrireAff} onFermer={fermer(() => setEcrire(null))} /> : null}
      {voirDossiers ? (
        <Dialogue titre="Dossiers" onFermer={() => setVoirDossiers(false)}>
          <View style={{ marginHorizontal: -8 }}>{volet}</View>
        </Dialogue>
      ) : null}
    </>
  );

  const entete = (
    <Header
      retour
      eyebrow={sousVue}
      title={titreVue}
      right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {copilote && (mails.length || externes.length) ? <Outil icone="copilote" label="Analyser" onPress={() => (sel.actif ? sel.fermer() : setChoixLot(lotInitial()))} masquerLabel={!deuxVolets} /> : null}
          {avecVolet && !avecDossiers ? <Outil icone="dossier" label="Dossiers" onPress={() => setVoirDossiers(true)} masquerLabel={!deuxVolets} /> : null}
          {peutEcrire && deuxVolets ? <Outil principal icone="crayon" label="Nouveau mail" onPress={() => setEcrire({})} /> : null}
          {externes.length ? <Outil icone="actualiser" label={busy ? 'Relecture…' : 'Actualiser'} disabled={busy} onPress={actualiser} masquerLabel={!deuxVolets} /> : null}
        </View>
      }
    />
  );

  const filtres = enDossier ? (
    <View style={{ gap: 10 }}>
      <Input value={q} onChangeText={setQ} placeholder={`Rechercher dans ${enDossier.dossier.nom}`} accessibilityLabel="Rechercher dans ce dossier" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Puce on={false} onPress={() => choisirVue({ type: 'tout' })}>
          ← Toutes les boîtes
        </Puce>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>
          {dossier.mails.length} chargé{dossier.mails.length > 1 ? 's' : ''}
          {enDossier.dossier.total ? ` sur ${enDossier.dossier.total}` : ''}
        </Text>
      </View>
    </View>
  ) : (
    <View style={{ gap: 10 }}>
      <Input value={q} onChangeText={setQ} placeholder="Rechercher (contact, objet, texte, étiquette)" accessibilityLabel="Rechercher un mail" />
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
      {/* Sur téléphone, une seule rangée qui défile : les boîtes et les étiquettes ne mangent pas la liste. */}
      <ScrollView horizontal={!deuxVolets} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: deuxVolets ? 'wrap' : 'nowrap', gap: 6, paddingRight: deuxVolets ? 0 : 8 }}>
        <Puce on={nonLusSeuls} onPress={() => setNonLusSeuls((v) => !v)}>
          Non lus · {nbNonLus}
        </Puce>
        {/* Avec la colonne des dossiers, boîtes et étiquettes se choisissent à gauche. */}
        {!avecDossiers && boites.length > 1
          ? boites.map((b) => (
              <Puce key={b.adresse} on={compte === b.adresse} onPress={() => choisirBoite(b.adresse)} partagee={b.partagee}>
                {b.partagee ? nomBoite(b.adresse) : b.adresse}
                {b.nonLus ? ` · ${b.nonLus}` : ''}
              </Puce>
            ))
          : null}
        {!avecDossiers
          ? libelles.map((l) => (
              <Puce key={l.nom} on={libelle === l.nom} onPress={() => choisirLibelle(l.nom)} pastille={couleurLibelle(l.nom, couleurs)}>
                {l.nom}
              </Puce>
            ))
          : null}
      </ScrollView>
      {!avecDossiers && boitesEnErreur.length ? <BoitesEnErreur boites={boitesEnErreur} /> : null}
    </View>
  );

  // Sans dossiers côté serveur (ancienne version) : les boîtes et les étiquettes seulement.
  const ancienVolet = (
    <ScrollView contentContainerStyle={{ padding: 10, gap: 2 }}>
      <TitreDossiers>Boîtes</TitreDossiers>
      <Dossier label="Toutes les boîtes" nombre={nbNonLus} on={compte === 'tous'} icone="mail" onPress={() => setCompte('tous')} />
      {boites
        .filter((b) => !b.partagee)
        .map((b) => (
          <Dossier key={b.adresse} label={b.adresse} nombre={b.nonLus} on={compte === b.adresse} icone="mail" onPress={() => choisirBoite(b.adresse)} />
        ))}
      {boites.some((b) => b.partagee) || boitesEnErreur.length ? <TitreDossiers>Boîtes partagées</TitreDossiers> : null}
      {boites
        .filter((b) => b.partagee)
        .map((b: BoiteMail) => (
          <Dossier key={b.adresse} label={nomBoite(b.adresse)} sous={b.adresse} nombre={b.nonLus} on={compte === b.adresse} icone="equipe" onPress={() => choisirBoite(b.adresse)} />
        ))}
      {boitesEnErreur.length ? <BoitesEnErreur boites={boitesEnErreur} /> : null}
      {libelles.length ? <TitreDossiers>Étiquettes</TitreDossiers> : null}
      {libelles.map((l) => (
        <Dossier key={l.nom} label={l.nom} nombre={l.nombre} on={libelle === l.nom} pastille={couleurLibelle(l.nom, couleurs)} onPress={() => choisirLibelle(l.nom)} />
      ))}
      <Pressable accessibilityRole="link" onPress={() => router.push('/sources')} style={{ paddingHorizontal: 10, paddingTop: 14 }}>
        <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 12.5 }}>Ajouter une boîte partagée</Text>
      </Pressable>
    </ScrollView>
  );

  // Analyser des mails choisis : la barre du bas agit sur ceux qui sont cochés dans la liste affichée.
  const barreAnalyse = (
    <BarreSelection
      sel={sel}
      tous={liste.map((m) => m.id)}
      onglets={false}
      actions={[
        {
          label: 'Analyser avec le copilote',
          onPress: (ids) => setAnalyse({ mails: liste.filter((m) => ids.includes(m.id)) }),
        },
      ]}
    />
  );

  const lignes = (
    <View>
      {groupes.map((g) => (
        <View key={g.cle} style={{ gap: 2, marginBottom: 6 }}>
          <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 12, letterSpacing: 0.3, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 4 }}>{g.titre}</Text>
          {g.mails.map((m) => (
            <Selectionnable key={m.id} sel={sel} id={m.id} label={`${m.contact}, ${m.sujet}`}>
              <LigneMail m={m} aujourdhui={d} couleurs={couleurs} choisi={deuxVolets && lu?.mail.id === m.id} couleurSource={couleur(espace.sources[m.source as SourceKey]?.couleur || SOURCE_DEFS[m.source as SourceKey]?.couleur)} onPress={() => ouvrirMail(m)} />
            </Selectionnable>
          ))}
        </View>
      ))}
      {!enDossier && mails.length && !liste.length ? <Empty>Aucun mail ne correspond à ces filtres.</Empty> : null}
      {enDossier && !dossier.charge && !dossier.msg && !liste.length ? <Empty icone="dossier">{q ? 'Rien de tel dans les mails chargés.' : 'Ce dossier est vide.'}</Empty> : null}
      {enDossier && dossier.msg ? <T small style={{ color: C.agressif, padding: 12 }}>{dossier.msg}</T> : null}
      {enDossier && dossier.charge ? (
        <ZoneSquelette label="Chargement du dossier">
          {[0, 1, 2, 3].map((i) => (
            <Bloc key={i} h={64} r={10} />
          ))}
        </ZoneSquelette>
      ) : null}
      {enDossier && dossier.suivant && !dossier.charge ? (
        <View style={{ padding: 10 }}>
          <Btn kind="sec" label="Charger plus" onPress={() => dossier.chargerPlus()} />
        </View>
      ) : null}
    </View>
  );

  const vide = enDossier ? null : !externes.length ? (
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

  // Le mail d'origine d'une relance, relu chez le service : on dit qu'il arrive, ou pourquoi il n'a pas pu s'ouvrir.
  const avisFil = params.fil && fermee !== cle && (duFil.charge || duFil.msg) ? (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: duFil.msg ? alpha(C.agressif, 0.5) : C.line, backgroundColor: C.sunk }}>
      <Icone nom="mail" color={duFil.msg ? C.agressif : C.accent} size={16} />
      <T small style={{ flex: 1, color: duFil.msg ? C.agressif : C.muted }}>
        {duFil.msg ? `Le mail d'origine n'a pas pu s'ouvrir : ${duFil.msg}` : "Ouverture du mail d'origine…"}
      </T>
    </View>
  ) : null;

  // Ordinateur : la liste à gauche, le mail ouvert à droite, chacun avec son propre défilement.
  if (deuxVolets)
    return (
      <Screen scroll={false} pied={barreAnalyse}>
        {fenetres}
        {entete}
        <ReservePro fonction="integrations" />
        {avisFil}
        <View style={{ flex: 1, flexDirection: 'row', gap: 16, minHeight: 0 }}>
          {avecDossiers && (avecVolet || mails.length) ? <Volet style={{ width: LARGEUR_DOSSIERS }}>{avecVolet ? volet : ancienVolet}</Volet> : null}
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
                  onDeplace={() => deplace(lu.mail)}
                  onAnalyser={copilote ? () => setAnalyse({ mails: [lu.mail] }) : undefined}
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
        sel.actif ? (
          barreAnalyse
        ) : peutEcrire ? (
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
      <ReservePro fonction="integrations" />
      {avisFil}
      {mails.length || enDossier ? filtres : null}
      <Volet style={{ paddingVertical: 4, paddingHorizontal: 2 }}>{vide ?? lignes}</Volet>
    </Screen>
  );
}

/** Une puce de filtre (Non lus, une boîte, une étiquette) : allumée quand le filtre s'applique. */
function Puce({ on, onPress, children, pastille, partagee }: { on: boolean; onPress: () => void; children: ReactNode; /** Couleur de l'étiquette. */ pastille?: string; /** Boîte partagée : l'icône d'équipe la distingue. */ partagee?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.16) : pressed ? alpha(C.ink, 0.06) : 'transparent' })}>
      {pastille ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: pastille }} /> : null}
      {partagee ? <Icone nom="equipe" color={on ? C.ink : C.muted} size={13} /> : null}
      <Text numberOfLines={1} style={{ color: on ? C.ink : C.muted, fontFamily: on ? F.texteM : F.texte, fontSize: 12.5 }}>
        {children}
      </Text>
    </Pressable>
  );
}

function TitreDossiers({ children }: { children: ReactNode }) {
  return <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 11.5, letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 10, paddingTop: 12, paddingBottom: 4 }}>{children}</Text>;
}

/** Une ligne du volet des dossiers : icône ou pastille, nom (et adresse d'une boîte partagée), nombre à droite. */
function Dossier({ label, sous, nombre, on, icone, pastille, onPress }: { label: string; sous?: string; nombre?: number; on: boolean; icone?: 'mail' | 'equipe'; pastille?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label}${nombre ? `, ${nombre}` : ''}`}
      onPress={onPress}
      style={(e) => {
        const survol = (e as { hovered?: boolean }).hovered;
        return { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: on ? alpha(C.accent, 0.16) : e.pressed || survol ? alpha(C.ink, 0.05) : 'transparent' };
      }}>
      {pastille ? <View style={{ width: 10, height: 10, borderRadius: 5, marginHorizontal: 3, backgroundColor: pastille }} /> : icone ? <Icone nom={icone} color={on ? C.accent : C.muted} size={16} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: on ? F.texteF : F.texteM, fontSize: 13.5 }}>
          {label}
        </Text>
        {sous ? (
          <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 11.5 }}>
            {sous}
          </Text>
        ) : null}
      </View>
      {nombre ? <Text style={{ color: on ? C.accent : C.muted, fontFamily: F.texteF, fontSize: 12 }}>{nombre}</Text> : null}
    </Pressable>
  );
}

/** Les boîtes partagées que le serveur n'a pas pu lire, et pourquoi (accès refusé, adresse inconnue). */
function BoitesEnErreur({ boites }: { boites: { adresse: string; erreur?: string }[] }) {
  return (
    <View style={{ gap: 4, padding: 10, borderRadius: 10, backgroundColor: alpha(C.agressif, 0.1) }}>
      {boites.map((b) => (
        <Text key={b.adresse} style={{ color: C.agressif, fontFamily: F.texte, fontSize: 12.5 }}>
          {b.adresse} : {b.erreur}
        </Text>
      ))}
    </View>
  );
}

/** Le cadre d'un volet (liste, lecture) : surface arrondie, comme les panneaux du reste de l'app. */
function Volet({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, overflow: 'hidden', minHeight: 0 }, style]}>{children}</View>;
}
