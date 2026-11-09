import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Image, Linking, Platform, Pressable, useWindowDimensions, View } from 'react-native';

import { Chargeur, SqueletteAnnuaire } from '@/components/squelettes';
import { AlertesAnnuaire, BarreAnnuaire, BlocConfiance, CarteGroupeVue, GrilleCartes, ListeAnnuaire, PartagerGroupe, SignalerGroupe, useAnnuaire } from '@/components/annuaire';
import { ActionDiscrete, Cadre, EnteteDetail, Erreur, Etat, GrandTitre, Ligne, Liste, Pastilles, Rang, Recap } from '@/components/cotisations-ui';
import { BadgeGroupe, Illustration } from '@/components/illustrations';
import { ChampDate } from '@/components/calendrier';
import { ReserveFinances } from '@/components/reserve-pro';
import { Jauge } from '@/components/jauge';
import { urlLegale } from '@/components/liens-legaux';
import { AvatarMembre, VisagesGroupe } from '@/components/photo-profil';
import { ChampTelephone, useTelephone } from '@/components/telephone';
import { Text } from '@/components/texte';
import { Btn, Dialogue, Empty, Input, Seg, T } from '@/components/ui';
import { echeancesObjectif, JOURS_APRES, JOURS_AVANT, montantCotisation, montantTontine, RAPPELS_DEFAUT, LIMITES_DEFAUT, reglesDansLeCadre, reglesDe, REGLES_DEFAUT, REGLES_PLATEFORME_DEFAUT, repartitionCagnotte, tauxCommission, texteRegles, type ReglesPlateforme, type LimitesCotisation, type RappelsGroupe, type ReglesGroupe, type RythmeObjectif } from '@/lib/commun/cotisations';
import { FILTRES_VIDES, type FiltresAnnuaire } from '@/lib/annuaire';
import { versJpegWeb } from '@/lib/image-web';
import { VersementsAFaire } from '@/components/tontines-admin';
import { FicheGroupe } from '@/components/fiche-groupe';
import { ChoixRegles, FormOrdre, FormRegles, InvitationsEnvoyees, libelleEspeces, ListeRegles, texteRetards } from '@/components/regles-groupe';
import type { BrouillonGroupe } from '@/lib/commande-cotisations';
import { accueille, dureeGroupe, echeanceDepassee, estMajeur, jourMois, lireDateNaissance, pretADemarrer, resumeGroupes, situationGroupe, type TonSituation } from '@/lib/cotisations';
import { addDays, today } from '@/lib/dates';
import { lireMontant } from '@/lib/finances';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';
import { Tontines, type CarteGroupe, type DossierEligibilite, type Eligibilite, type Groupe, type MembreGroupe, type NouveauGroupe, type TourGroupe } from '@/lib/tontines';

const SUIVI_MS = 5000;
const LISTE_MS = 30000;
const RYTHMES: { key: RythmeObjectif; label: string }[] = [
  { key: 'quotidien', label: 'Jour' },
  { key: 'hebdomadaire', label: 'Semaine' },
  { key: 'mensuel', label: 'Mois' },
];
const RYTHMES_OBJECTIF: { key: RythmeObjectif; label: string }[] = [{ key: 'unique', label: 'Une fois' }, ...RYTHMES];
const DEVISES: { key: 'USD' | 'CDF'; label: string }[] = [
  { key: 'USD', label: 'USD' },
  { key: 'CDF', label: 'CDF' },
];
const dateCourte = (jour: string) => jourMois(jour, today());

export function Conditions({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  const url = urlLegale('conditions-tontines');
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel="J’accepte les conditions des tontines" onPress={() => onChange(!on)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 44 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? C.accent : C.line, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Text style={{ color: C.bg, fontFamily: F.texteM, fontSize: 14, lineHeight: 16 }}>✓</Text> : null}
      </View>
      <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
        J’accepte les{' '}
        <Text accessibilityRole="link" onPress={() => url && Linking.openURL(url)} style={{ color: C.accent, textDecorationLine: 'underline', fontFamily: F.texte, fontSize: 14 }}>
          conditions
        </Text>
      </Text>
    </Pressable>
  );
}

const JOUR_AVANT = (j: number) => (j === 0 ? 'Le jour même' : `${j} j avant`);
const texteRappels = (r: RappelsGroupe) =>
  [...[...r.avant].sort((a, b) => b - a).map(JOUR_AVANT), ...[...r.apres].sort((a, b) => a - b).map((j) => `${j} j après`)].join(', ');

/** Les rappels obligatoires du groupe : l'initiateur règle les jours et les canaux. Il en reste toujours un. */
function ChoixRappels({ r, onChange }: { r: RappelsGroupe; onChange: (r: RappelsGroupe) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <T small muted>
        Avant l’échéance
      </T>
      <Pastilles options={JOURS_AVANT.map((j) => ({ key: j, label: JOUR_AVANT(j) }))} valeurs={r.avant} onChange={(avant) => avant.length && onChange({ ...r, avant })} />
      <T small muted>
        En cas de retard
      </T>
      <Pastilles options={JOURS_APRES.map((j) => ({ key: j, label: `${j} j après` }))} valeurs={r.apres} onChange={(apres) => onChange({ ...r, apres })} />
      <T small muted>
        Dans l’app, et aussi par
      </T>
      <Pastilles
        options={[
          { key: 'mail', label: 'Mail' },
          { key: 'sms', label: 'SMS' },
        ]}
        valeurs={[...(r.mail ? ['mail' as const] : []), ...(r.sms ? ['sms' as const] : [])]}
        onChange={(v) => onChange({ ...r, mail: v.includes('mail'), sms: v.includes('sms') })}
      />
    </View>
  );
}

function FormRappels({ g, onEnregistrer, onFermer }: { g: Groupe; onEnregistrer: (r: RappelsGroupe) => void; onFermer: () => void }) {
  const [r, setR] = useState(g.rappels);
  return (
    <Dialogue titre="Rappels du groupe" onFermer={onFermer}>
      <ChoixRappels r={r} onChange={setR} />
      <Btn label="Enregistrer" onPress={() => onEnregistrer(r)} />
    </Dialogue>
  );
}

/** Où l'on en est d'un formulaire en plusieurs étapes. */
function Avancement({ etape, total, titre }: { etape: number; total: number; titre: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T small muted>
        Étape {etape} sur {total} : {titre}
      </T>
      <Jauge ratio={etape / total} hauteur={4} couleur={C.accent} />
    </View>
  );
}

/** Un choix expliqué d'une ligne : assez grand pour le pouce. */
function ChoixCartes<K extends string>({ label, options, value, onChange }: { label: string; options: { key: K; titre: string; sous: string }[]; value: K; onChange: (v: K) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 8 }}>
      <T small muted>
        {label}
      </T>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={({ pressed }) => ({ minHeight: 60, justifyContent: 'center', gap: 2, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? C.accent : C.line, backgroundColor: C.surface, opacity: pressed ? 0.75 : 1 })}>
            <Text style={{ color: on ? C.accent : C.ink, fontFamily: F.texteF, fontSize: 15 }}>{o.titre}</Text>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{o.sous}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const PIECES: { key: DossierEligibilite['typePiece']; label: string }[] = [
  { key: 'carte_electeur', label: 'Carte d’électeur' },
  { key: 'passeport', label: 'Passeport' },
  { key: 'permis', label: 'Permis' },
  { key: 'autre', label: 'Autre' },
];

/** L'approbation du compte pour l'annuaire, en trois étapes : numéro, informations, pièce d'identité. */
function FormApprobation({ etat, onChange, onFermer }: { etat: Eligibilite; onChange: (e: Eligibilite) => void; onFermer: () => void }) {
  const { profil } = useStore();
  const tel = useTelephone();
  const telContact = useTelephone();
  const [codeEnvoye, setCodeEnvoye] = useState(false);
  const [code, setCode] = useState('');
  const [nomComplet, setNomComplet] = useState(profil?.nom ?? '');
  const [naissance, setNaissance] = useState('');
  const [ville, setVille] = useState('Kinshasa');
  const [commune, setCommune] = useState('');
  const [activite, setActivite] = useState('');
  const [capacite, setCapacite] = useState('');
  const [contactNom, setContactNom] = useState('');
  const [typePiece, setTypePiece] = useState<DossierEligibilite['typePiece']>('carte_electeur');
  const [infosFinies, setInfosFinies] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; file?: Blob } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const dateIso = lireDateNaissance(naissance, today());
  const dateErreur = naissance.trim().length >= 8 && !dateIso ? 'Écris la date ainsi : 12/05/1990.' : dateIso && !estMajeur(dateIso, today()) ? 'Il faut avoir au moins 18 ans.' : undefined;
  const capaciteLue = lireMontant(capacite);
  const infosOk = nomComplet.trim().length >= 3 && !!dateIso && estMajeur(dateIso, today()) && ville.trim().length >= 2 && commune.trim().length >= 2 && activite.trim().length >= 2 && !!capaciteLue && contactNom.trim().length >= 2 && telContact.valide;
  const etape = !etat.telephone ? 1 : !infosFinies ? 2 : 3;
  const agir = async (action: () => Promise<void>) => {
    setEnvoi(true);
    setErreur('');
    try {
      await action();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };
  const choisir = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled && r.assets[0]) setPhoto({ uri: r.assets[0].uri, file: r.assets[0].file });
  };
  const envoyer = () =>
    agir(async () => {
      if (!photo || !dateIso || !capaciteLue) return;
      const dossier: DossierEligibilite = { nomComplet: nomComplet.trim(), dateNaissance: dateIso, ville: ville.trim(), commune: commune.trim(), activite: activite.trim(), typePiece, capaciteMensuelle: capaciteLue, contactNom: contactNom.trim(), contactTelephone: telContact.complet };
      const form = new FormData();
      form.append('dossier', JSON.stringify(dossier));
      if (Platform.OS === 'web') form.append('fichier', await versJpegWeb(photo.file ?? photo.uri, 2000), 'piece.jpg');
      else form.append('fichier', { uri: photo.uri, name: 'piece.jpg', type: 'image/jpeg' } as unknown as Blob);
      onChange(await Tontines.soumettrePiece(form));
    });

  if (etat.statut === 'soumise')
    return (
      <Dialogue titre="Approbation du compte" onFermer={onFermer}>
        <View style={{ alignItems: 'center' }}>
          <Illustration nom="verification" largeur={150} />
        </View>
        <T>Ta demande est en cours de vérification.</T>
      </Dialogue>
    );
  return (
    <Dialogue titre="Approbation du compte" onFermer={onFermer}>
      <Avancement etape={etape} total={3} titre={etape === 1 ? 'ton numéro' : etape === 2 ? 'tes informations' : 'ta pièce d’identité'} />
      {etat.statut === 'refusee' && etat.motif ? <Erreur texte={etat.motif} /> : null}
      {erreur ? <Erreur texte={erreur} /> : null}
      {etape === 1 ? (
        <>
          <ChampTelephone tel={tel} label="Ton numéro mobile money" editable={!codeEnvoye} />
          {codeEnvoye ? (
            <>
              <Input label="Code reçu par SMS" value={code} onChangeText={setCode} keyboardType="number-pad" autoFocus />
              <Btn label="Confirmer" disabled={envoi || code.trim().length < 4} onPress={() => agir(async () => onChange(await Tontines.confirmerCode(code.trim())))} />
            </>
          ) : (
            <Btn
              label="Recevoir le code"
              disabled={envoi || !tel.valide}
              onPress={() =>
                agir(async () => {
                  await Tontines.demanderCode(tel.complet);
                  setCodeEnvoye(true);
                })
              }
            />
          )}
        </>
      ) : null}
      {etape === 2 ? (
        <>
          <Input label="Nom complet, comme sur ta pièce" value={nomComplet} onChangeText={setNomComplet} autoComplete="name" />
          <Input label="Date de naissance" placeholder="12/05/1990" value={naissance} onChangeText={setNaissance} keyboardType="numbers-and-punctuation" erreur={dateErreur} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input label="Ville" value={ville} onChangeText={setVille} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Commune" placeholder="Gombe" value={commune} onChangeText={setCommune} />
            </View>
          </View>
          <Input label="Activité ou métier" placeholder="Commerçante" value={activite} onChangeText={setActivite} />
          <Input label="Ce que tu peux cotiser par mois (USD)" placeholder="50" value={capacite} onChangeText={setCapacite} keyboardType="decimal-pad" />
          <Input label="Personne à contacter" placeholder="Nom d’un proche" value={contactNom} onChangeText={setContactNom} />
          <ChampTelephone tel={telContact} label="Son numéro" />
          <Btn label="Continuer" disabled={!infosOk} onPress={() => setInfosFinies(true)} />
        </>
      ) : null}
      {etape === 3 ? (
        <>
          <Seg label="Type de pièce" options={PIECES} value={typePiece} onChange={setTypePiece} />
          {photo ? <Image source={{ uri: photo.uri }} accessibilityLabel="Photo de ta pièce d’identité" style={{ width: '100%', height: 180, borderRadius: 14 }} resizeMode="cover" /> : <Illustration nom="verification" largeur={150} />}
          <Btn kind={photo ? 'sec' : 'primary'} label={photo ? 'Changer la photo' : 'Photo de ma pièce'} onPress={choisir} />
          {photo ? <Btn label="Envoyer ma demande" disabled={envoi} onPress={envoyer} /> : null}
          <ActionDiscrete label="Revenir à mes informations" onPress={() => setInfosFinies(false)} />
          <T small muted>
            Photo chiffrée, effacée après la décision. Informations chiffrées, gardées si le compte est approuvé.
          </T>
        </>
      ) : null}
    </Dialogue>
  );
}

function FormGroupe({ devise, brouillon, eligibilite, onDemanderApprobation, onCreer, onFermer }: { devise: 'USD' | 'CDF'; brouillon?: BrouillonGroupe | null; eligibilite: Eligibilite | null; onDemanderApprobation: () => void; onCreer: (c: NouveauGroupe) => void; onFermer: () => void }) {
  const [mode, setMode] = useState<'rotation' | 'objectif'>(brouillon?.mode ?? 'rotation');
  const [visibilite, setVisibilite] = useState<'prive' | 'public'>('prive');
  const [nom, setNom] = useState(brouillon?.nom ?? '');
  const [montant, setMontant] = useState(brouillon?.montant ?? '');
  const [d, setD] = useState<'USD' | 'CDF'>(brouillon?.devise ?? devise);
  const [rythme, setRythme] = useState<RythmeObjectif>(brouillon?.rythme ?? 'mensuel');
  const [places, setPlaces] = useState(brouillon?.places ?? '');
  const [caution, setCaution] = useState<'oui' | 'non'>('oui');
  const [raison, setRaison] = useState(brouillon?.raison ?? '');
  const [beneficiaire, setBeneficiaire] = useState('');
  const [dateFin, setDateFin] = useState<string | undefined>();
  const [accepte, setAccepte] = useState(false);
  const [rappels, setRappels] = useState<RappelsGroupe>(RAPPELS_DEFAUT);
  const [regles, setRegles] = useState<ReglesGroupe>(REGLES_DEFAUT);
  const [voirRegles, setVoirRegles] = useState(false);
  const [limites, setLimites] = useState<LimitesCotisation>(LIMITES_DEFAUT);
  const [plateforme, setPlateforme] = useState<ReglesPlateforme>(REGLES_PLATEFORME_DEFAUT);
  useEffect(() => {
    let fini = false;
    Tontines.limites()
      .then((l) => {
        if (fini) return;
        setLimites(l);
        if (l.plateforme) setPlateforme(l.plateforme);
      })
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, []);
  const [voirRappels, setVoirRappels] = useState(false);
  // Ce qui a été dit à la voix a déjà choisi le type : on commence aux détails.
  const [etape, setEtape] = useState(brouillon ? 2 : 1);
  const tel = useTelephone();
  const telBenef = useTelephone();
  const objectif = mode === 'objectif';
  const prive = visibilite === 'prive';
  const approuve = eligibilite?.statut === 'approuvee';
  const m = lireMontant(montant);
  const centimes = m === null ? null : Math.round(m * 100);
  const n = Number(places);
  const nombreOk = Number.isInteger(n) && n >= 2 && n <= limites.membresMax;
  const montantMax = limites.montantMax[d];
  const montantOk = centimes !== null && centimes >= 100 && centimes <= montantMax;
  const rythmeOk = objectif || rythme !== 'unique';
  const objectifOk = !objectif || (raison.trim().length >= 2 && !!beneficiaire.trim() && telBenef.valide && !!dateFin);
  const periodes = objectif && dateFin ? echeancesObjectif(rythme, today(), dateFin).length : 1;
  const cadre = plateforme[visibilite];
  const part = montantOk && nombreOk ? repartitionCagnotte(centimes * periodes, n, cadre.commissionBps) : null;
  const reglesFinales = reglesDansLeCadre(reglesDe(regles, { visibilite, montant: centimes ?? 0 }), cadre, centimes ?? 0);
  const infosOk = nom.trim().length >= 2 && !!part && rythmeOk && objectifOk;
  const ok = infosOk && accepte && (prive ? tel.valide : approuve);
  const creer = () =>
    onCreer({
      nom: nom.trim(),
      montant: centimes!,
      devise: d,
      rythme,
      places: n,
      mode,
      visibilite,
      rappels,
      regles: reglesFinales,
      accepte: true,
      ...(prive ? { telephone: tel.complet, ...(objectif ? {} : { cautionRequise: cadre.cautionObligatoire || caution === 'oui' }) } : {}),
      ...(objectif ? { raison: raison.trim(), beneficiaire: { nom: beneficiaire.trim(), telephone: telBenef.complet }, dateFin } : {}),
    });
  return (
    <Dialogue titre="Nouveau groupe" onFermer={onFermer}>
      <Avancement etape={etape} total={3} titre={etape === 1 ? 'le type de groupe' : etape === 2 ? 'la cotisation' : 'vérifier'} />
      {etape === 1 ? (
        <>
          <ChoixCartes
            label="Qui reçoit ?"
            options={[
              { key: 'rotation', titre: 'Chacun son tour', sous: 'Tous reçoivent la cagnotte, un par un.' },
              { key: 'objectif', titre: 'Raison précise', sous: 'Une personne reçoit tout à la date de fin.' },
            ]}
            value={mode}
            onChange={(v) => {
              setMode(v);
              if (v === 'rotation' && rythme === 'unique') setRythme('mensuel');
            }}
          />
          <ChoixCartes
            label="Qui peut rejoindre ?"
            options={[
              { key: 'prive', titre: 'Sur invitation', sous: 'Tu invites, et tu réponds de ton groupe.' },
              { key: 'public', titre: 'Annuaire', sous: 'Visible par tout le monde, même sans compte.' },
            ]}
            value={visibilite}
            onChange={setVisibilite}
          />
          {!prive && !approuve ? (
            <Cadre>
              <T small>L’annuaire demande un compte approuvé.</T>
              <Btn kind="sec" label={eligibilite?.statut === 'soumise' ? 'Demande en cours' : 'Faire approuver mon compte'} onPress={onDemanderApprobation} />
            </Cadre>
          ) : null}
          <Btn label="Continuer" disabled={!prive && !approuve} onPress={() => setEtape(2)} />
        </>
      ) : null}
      {etape === 2 ? (
        <>
          <Input label="Nom" placeholder={objectif ? 'Mariage de Jean' : 'Tontine de la famille'} value={nom} onChangeText={setNom} />
          {objectif ? (
            <>
              <Input label="Raison" placeholder="Cadeau et réception" value={raison} onChangeText={setRaison} />
              <Input label="Bénéficiaire" placeholder="Jean Mbuyi" value={beneficiaire} onChangeText={setBeneficiaire} />
              <ChampTelephone tel={telBenef} label="Numéro du bénéficiaire" />
              <View style={{ flexDirection: 'row' }}>
                <ChampDate label="Date de fin" value={dateFin} onChange={setDateFin} min={addDays(today(), 1)} />
              </View>
            </>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Input label="Cotisation" placeholder="10" value={montant} onChangeText={setMontant} keyboardType="decimal-pad" erreur={centimes !== null && centimes > montantMax ? `${montantCotisation(montantMax, d)} au maximum` : undefined} />
            </View>
            <View style={{ width: 128 }}>
              <Seg options={DEVISES} value={d} onChange={setD} />
            </View>
          </View>
          <Seg label={objectif ? 'Paiement' : 'Chaque'} options={objectif ? RYTHMES_OBJECTIF : RYTHMES} value={rythme} onChange={setRythme} />
          <Input label={`Membres, toi compris (${limites.membresMax} au maximum)`} placeholder="10" value={places} onChangeText={setPlaces} keyboardType="number-pad" erreur={places && n > limites.membresMax ? `${limites.membresMax} membres au maximum` : undefined} />
          {!objectif && prive && !cadre.cautionObligatoire ? (
            <Seg
              label="Caution"
              options={[
                { key: 'oui', label: 'Oui' },
                { key: 'non', label: 'Non' },
              ]}
              value={caution}
              onChange={setCaution}
            />
          ) : null}
          <Liste>
            <Ligne premiere titre="Rappels obligatoires" sous={texteRappels(rappels)} onPress={() => setVoirRappels((v) => !v)} />
          </Liste>
          {voirRappels ? <ChoixRappels r={rappels} onChange={setRappels} /> : null}
          <Liste>
            <Ligne premiere titre="Règles du groupe" sous={texteRegles(reglesFinales, d).slice(0, 2).join(' ')} onPress={() => setVoirRegles((v) => !v)} />
          </Liste>
          {voirRegles ? <ChoixRegles r={regles} onChange={setRegles} g={{ mode, visibilite, devise: d, montant: centimes }} cadre={cadre} /> : null}
          <Btn label="Continuer" disabled={!infosOk || (centimes !== null && regles.penalite.montant > centimes)} onPress={() => setEtape(3)} />
          <ActionDiscrete label="Revenir" onPress={() => setEtape(1)} />
        </>
      ) : null}
      {etape === 3 && part ? (
        <>
          <GrandTitre>{nom.trim()}</GrandTitre>
          <Recap
            lignes={[
              ['Cotisation', montantTontine(centimes!, d, rythme)],
              ['Membres', String(n)],
              [objectif ? 'Le bénéficiaire reçoit' : 'Chacun reçoit', `${objectif ? 'jusqu’à ' : ''}${montantCotisation(part.net, d)}`],
              [`Commission (${tauxCommission(cadre.commissionBps)})`, montantCotisation(part.commission, d)],
              ...(!objectif && prive ? ([['Caution', cadre.cautionObligatoire || caution === 'oui' ? montantCotisation(centimes!, d) : 'Non']] as [string, string][]) : []),
              ['Rejoindre', prive ? 'Sur invitation' : 'Annuaire'],
            ]}
          />
          {cadre.demandes === 'initiateur' ? (
            <T small muted>
              C’est toi qui lances les demandes de paiement : chaque membre les valide sur son téléphone.
            </T>
          ) : null}
          {texteRegles(reglesFinales, d).map((l) => (
            <T key={l} small muted>
              {l}
            </T>
          ))}
          {prive ? <ChampTelephone tel={tel} label="Ton numéro mobile money" /> : null}
          <Conditions on={accepte} onChange={setAccepte} />
          <Btn label="Créer le groupe" disabled={!ok} onPress={creer} />
          <ActionDiscrete label="Revenir" onPress={() => setEtape(2)} />
        </>
      ) : null}
    </Dialogue>
  );
}

/** Un groupe de l'annuaire : ce qu'il coûte, qui l'organise, et la demande. `bloque` remplace la demande quand il manque quelque chose. */
function FormAdhesion({ g, onEnvoyer, onFermer, bloque }: { g: CarteGroupe; onEnvoyer: () => void; onFermer: () => void; bloque?: ReactNode }) {
  const [accepte, setAccepte] = useState(false);
  return (
    <Dialogue titre={g.nom} onFermer={onFermer}>
      <RecapGroupe g={g} />
      <BlocConfiance g={g} />
      {g.monEtat === 'demande' ? (
        <Etat texte="Demande envoyée : l’organisateur va répondre." couleur={C.muted} />
      ) : bloque ? (
        bloque
      ) : (
        <>
          <T small muted>
            {g.organisateur || 'L’organisateur'} répond à ta demande. Tu ne paies qu’après.
          </T>
          <Conditions on={accepte} onChange={setAccepte} />
          <Btn label="Demander à rejoindre" disabled={!accepte} onPress={onEnvoyer} />
        </>
      )}
      <PartagerGroupe g={g} />
      <SignalerGroupe g={g} />
    </Dialogue>
  );
}

/** L'essentiel d'un groupe avant de le rejoindre. */
export function RecapGroupe({ g }: { g: CarteGroupe }) {
  const lignes: [string, string][] =
    g.mode === 'objectif'
      ? [
          ['Raison', g.raison ?? ''],
          ['Bénéficiaire', g.beneficiaireNom ?? ''],
          ['Cotisation', montantTontine(g.montant, g.devise, g.rythme)],
          ['Jusqu’au', g.dateFin ? dateCourte(g.dateFin) : ''],
        ]
      : [
          ['Cotisation', montantTontine(g.montant, g.devise, g.rythme)],
          ...(dureeGroupe(g) ? ([['Durée', dureeGroupe(g) as string]] as [string, string][]) : []),
          ...(g.cautionRequise ? ([['Caution', montantCotisation(g.montant, g.devise)]] as [string, string][]) : []),
          ['Tu reçois', montantCotisation(g.net, g.devise)],
          [g.brut ? `Commission (${tauxCommission(Math.round((g.commission / g.brut) * 10000))})` : 'Commission', montantCotisation(g.commission, g.devise)],
        ];
  const libres = Math.max(0, g.places - g.inscrits);
  return <Recap lignes={[...(g.organisateur ? ([['Initiateur', g.organisateur]] as [string, string][]) : []), ...lignes, ['Places libres', `${libres} sur ${g.places}`]]} />;
}

/** Inviter : le lien part depuis son téléphone, ou par Me selon les canaux du système. */
function Invitation({ g, onFermer, onEnvoye }: { g: Groupe; onFermer: () => void; onEnvoye?: (g: Groupe) => void }) {
  const tel = useTelephone();
  const [info, setInfo] = useState('');
  const lien = g.lienInvitation ?? '';
  const texte = `Rejoins la cotisation « ${g.nom} » : ${montantTontine(g.montant, g.devise, g.rythme)}. ${lien}`;
  const parMe = async () => {
    setInfo('');
    try {
      const r = await Tontines.inviter(g.id, tel.complet);
      setInfo(`Invitation envoyée par ${[r.mail ? 'mail' : '', r.sms ? 'SMS' : ''].filter(Boolean).join(' et ')}. Elle apparaît dans « Invitations envoyées ».`);
      tel.vider();
      if (r.groupe) onEnvoye?.(r.groupe);
    } catch (e) {
      setInfo((e as Error).message);
    }
  };
  return (
    <Dialogue titre="Inviter" onFermer={onFermer}>
      <View style={{ alignItems: 'center' }}>
        <Illustration nom="invitation" largeur={140} />
      </View>
      <Btn label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(texte)}`).catch(() => {})} />
      <Btn kind="sec" label="SMS depuis mon téléphone" onPress={() => Linking.openURL(`sms:?body=${encodeURIComponent(texte)}`).catch(() => {})} />
      <Btn
        kind="sec"
        label="Copier le lien"
        onPress={() => {
          Clipboard.setStringAsync(lien)
            .then(() => setInfo('Lien copié.'))
            .catch(() => {});
        }}
      />
      <ChampTelephone tel={tel} label="Ou envoyer par Me à ce numéro" />
      <Btn kind="sec" label="Envoyer par Me" disabled={!tel.valide} onPress={parMe} />
      {info ? (
        <T small muted>
          {info}
        </T>
      ) : null}
    </Dialogue>
  );
}

/**
 * Cagnotte complète : l'initiateur demande à l'équipe de Me de verser au bénéficiaire. Une fois demandé, il voit quand,
 * et peut relancer après un jour.
 */
function DemandeVersement({ g, aVerser, demandeLe, agir }: { g: Groupe; aVerser: boolean; demandeLe?: string | null; agir: (a: () => Promise<Groupe>) => void }) {
  if (!aVerser || demandeLe === undefined) return null;
  const tour = g.mode === 'objectif' ? null : g.tours.find((t) => t.etat === 'a_verser');
  const pour = g.mode === 'objectif' ? g.beneficiaireNom : tour?.pourMoi ? 'toi' : tour?.beneficiaire.split(' ')[0];
  // Relance possible le lendemain (jour du groupe, donné par le serveur).
  const relance = !!demandeLe && demandeLe.slice(0, 10) < g.jour;
  return (
    <View style={{ gap: 6 }}>
      {demandeLe ? (
        <T small muted>
          Versement demandé le {new Date(demandeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. L’équipe de Me le valide.
        </T>
      ) : null}
      {!demandeLe || relance ? <Btn kind={demandeLe ? 'sec' : 'primary'} label={demandeLe ? 'Relancer la demande de versement' : `Demander le versement${pour ? ` à ${pour}` : ''}`} onPress={() => agir(() => Tontines.demanderVersement(g.id))} /> : null}
    </View>
  );
}

/** Ce qui se passe maintenant dans le groupe, et la seule action utile à cet instant. */
function Maintenant({ g, agir }: { g: Groupe; agir: (a: () => Promise<Groupe>) => void }) {
  const encours = g.etat === 'en_cours';
  const actuel = g.tours.find((t) => t.numero === g.tourCourant);
  const cotises = g.membres.filter((m) => m.aCotise).length;
  const cautions = g.membres.filter((m) => m.cautionPayee).length;
  const pret = pretADemarrer(g);
  // Le titre le dit déjà quand c'est mon tour.
  const monTour = encours && !actuel?.pourMoi ? g.tours.find((t) => t.pourMoi && t.etat === 'a_venir') : undefined;

  if (g.etat === 'termine' || g.etat === 'annule') {
    return (
      <Cadre>
        <Illustration nom={g.mode === 'objectif' ? 'raison' : 'cercle'} largeur={150} />
        <GrandTitre>{g.etat === 'annule' ? 'Groupe annulé' : g.mode === 'objectif' ? 'Cotisation terminée' : 'Tontine terminée'}</GrandTitre>
        {g.final ? (
          <T muted>
            {montantCotisation(g.final.net, g.devise)} versés à {g.beneficiaireNom}.
          </T>
        ) : null}
      </Cadre>
    );
  }
  if (g.moi?.etat === 'exclu') {
    return (
      <Cadre>
        <GrandTitre>Tu as été exclu</GrandTitre>
        <T muted>Après trop de retards, {g.organisateur || 'l’organisateur'} t’a retiré de ce groupe. Tu ne dois plus rien.</T>
      </Cadre>
    );
  }
  if (g.moi?.etat === 'demande') {
    return (
      <Cadre>
        <GrandTitre>Demande envoyée</GrandTitre>
        <T muted>Réponse de {g.organisateur || 'l’organisateur'} à venir.</T>
      </Cadre>
    );
  }

  const objectif = g.mode === 'objectif';
  const titre = objectif ? `${montantCotisation(g.collecte, g.devise)} sur ${montantCotisation(g.totalPrevu, g.devise)}` : encours && actuel ? `${actuel.pourMoi ? 'Tu reçois' : `${actuel.beneficiaire.split(' ')[0]} reçoit`} ${montantCotisation(actuel.net, g.devise)}` : `${g.inscrits} membres sur ${g.places}`;
  const ratio = objectif ? (g.totalPrevu ? g.collecte / g.totalPrevu : 0) : encours ? cotises / g.places : g.inscrits / g.places;
  const detail = objectif ? `Pour ${g.beneficiaireNom}${g.dateFin ? `, jusqu’au ${dateCourte(g.dateFin)}` : ''}` : encours && actuel ? `${cotises} sur ${g.places} ont cotisé, avant le ${dateCourte(actuel.echeance)}` : g.inscrits < g.places ? `Il manque ${g.places - g.inscrits} membre${g.places - g.inscrits > 1 ? 's' : ''}` : !g.cautionRequise ? 'Groupe complet' : `${cautions} caution${cautions > 1 ? 's' : ''} sur ${g.places}`;

  return (
    <Cadre>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexShrink: 1 }}>
          <GrandTitre>{titre}</GrandTitre>
        </View>
        {g.membres.length ? <VisagesGroupe membres={g.membres} max={5} /> : null}
      </View>
      <View style={{ gap: 6 }}>
        <Jauge ratio={ratio} hauteur={6} />
        <T small muted>
          {objectif && g.raison ? `${g.raison}. ${detail}` : detail}
        </T>
      </View>
      {monTour ? (
        <T small style={{ color: C.accent }}>
          Tu reçois {montantCotisation(monTour.net, g.devise)} le {dateCourte(monTour.echeance)}
        </T>
      ) : null}
      {encours && !g.aPayer && !g.enAttente && g.moi ? <Etat texte="Tu es à jour" couleur={C.coach} /> : null}
      {actuel?.etat === 'a_verser' && !objectif ? <T>Cagnotte complète. Versement en cours de validation.</T> : null}
      {g.final?.etat === 'a_verser' ? <T>Cotisation clôturée. Versement de {montantCotisation(g.final.net, g.devise)} en cours de validation.</T> : null}
      {g.suisOrganisateur ? <DemandeVersement g={g} demandeLe={objectif ? g.final?.etat === 'a_verser' ? g.final.versementDemandeLe : undefined : g.tours.find((t) => t.etat === 'a_verser')?.versementDemandeLe} aVerser={objectif ? g.final?.etat === 'a_verser' : g.tours.some((t) => t.etat === 'a_verser')} agir={agir} /> : null}
      {g.refus && !g.enAttente ? <Erreur texte="Le paiement n’a pas abouti. Réessaie." /> : null}
      {g.enAttente ? (
        <>
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Chargeur label="Paiement en attente" />
            <T style={{ flex: 1 }}>Valide sur le +{g.moi?.telephone}</T>
          </View>
          <Btn kind="sec" label="Je n’ai rien reçu" onPress={() => agir(() => Tontines.abandonner(g.id))} />
        </>
      ) : g.aPayer && g.paiementOuvert && g.demandesParInitiateur && !g.suisOrganisateur ? (
        <T small muted>
          {g.organisateur || 'L’initiateur'} t’enverra la demande de paiement de {montantCotisation(g.aPayer.montant, g.devise)} : tu la valideras sur ton téléphone, le +{g.moi?.telephone}.
        </T>
      ) : g.aPayer && g.paiementOuvert ? (
        <>
          <Btn label={`Payer ${g.aPayer.genre === 'caution' ? 'la caution' : ''} ${montantCotisation(g.aPayer.montant, g.devise)}`.replace('  ', ' ')} onPress={() => agir(() => Tontines.payer(g.id, g.aPayer!.genre))} />
          <T small muted>
            {g.aPayer.penalite ? `Dont ${montantCotisation(g.aPayer.penalite, g.devise)} de pénalité de retard. ` : ''}Sur le +{g.moi?.telephone}
          </T>
        </>
      ) : g.aPayer ? (
        <T small muted>
          Paiement bientôt ouvert
        </T>
      ) : null}
      {g.suisOrganisateur && g.etat === 'ouvert' && !g.aPayer && !g.enAttente ? <Btn label={g.regles?.ordre === 'organisateur' ? 'Démarrer dans l’ordre choisi' : g.regles?.ordre === 'arrivee' ? 'Démarrer dans l’ordre d’arrivée' : 'Démarrer et tirer au sort'} disabled={!pret} onPress={() => agir(() => Tontines.demarrer(g.id))} /> : null}
    </Cadre>
  );
}

function ActionsMembre({ g, m, onDemander, onRappeler, onCaution, onPayerPour, onEspeces, onExclure, onRetirer, onFermer }: { g: Groupe; m: MembreGroupe; onDemander?: () => void; onRappeler?: () => void; onCaution?: () => void; onPayerPour?: () => void; onEspeces?: () => void; onExclure?: () => void; onRetirer?: () => void; onFermer: () => void }) {
  return (
    <Dialogue titre={m.nom} onFermer={onFermer}>
      {m.retards || m.especes ? (
        <T small muted>
          {[texteRetards(m), m.especes ? `${montantCotisation(m.especes, g.devise)} payés en espèces` : ''].filter(Boolean).join(', ')}
        </T>
      ) : null}
      {onDemander ? (
        <>
          <Btn label={`Demander le paiement (${montantCotisation(m.du ?? g.montant, g.devise)})`} onPress={onDemander} />
          <T small muted>
            La demande arrive sur son téléphone : il la valide avec son code mobile money.
          </T>
        </>
      ) : null}
      {onRappeler ? <Btn kind={onDemander ? 'sec' : 'primary'} label="Rappeler par mail et SMS" onPress={onRappeler} /> : null}
      {onEspeces ? <Btn kind="sec" label={libelleEspeces(m, g.devise)} onPress={onEspeces} /> : null}
      {onCaution ? <Btn kind="sec" label={`Couvrir avec sa caution (${montantCotisation(g.montant, g.devise)})`} onPress={onCaution} /> : null}
      {onPayerPour ? <Btn kind="sec" label={`Payer à sa place (${montantCotisation(m.du ?? g.montant, g.devise)})`} onPress={onPayerPour} /> : null}
      {onExclure ? <ActionDiscrete danger label={`Exclure du groupe (${texteRetards(m)})`} onPress={onExclure} /> : null}
      {onRetirer ? <ActionDiscrete danger label="Retirer du groupe" onPress={onRetirer} /> : null}
    </Dialogue>
  );
}

function sousTour(t: TourGroupe) {
  if (t.etat === 'verse') return 'A reçu';
  if (t.etat === 'a_verser') return 'Versement en cours';
  if (t.etat === 'collecte') return `Ce tour, le ${dateCourte(t.echeance)}`;
  return `Reçoit le ${dateCourte(t.echeance)}`;
}

function DetailGroupe({ g, agir, onRetour }: { g: Groupe; agir: (a: () => Promise<Groupe>) => void; onRetour: () => void }) {
  const large = useWindowDimensions().width >= 1100;
  const [info, setInfo] = useState('');
  const [choisi, setChoisi] = useState<string | null>(null);
  const [inviter, setInviter] = useState(false);
  const [reglages, setReglages] = useState(false);
  const [voirRegles, setVoirRegles] = useState(false);
  const [voirOrdre, setVoirOrdre] = useState(false);
  const orga = g.suisOrganisateur;
  const objectif = g.mode === 'objectif';
  const ouvertAuxMembres = accueille(g);
  const encours = g.etat === 'en_cours';
  const actuel = g.tours.find((t) => t.numero === g.tourCourant);
  const depasse = echeanceDepassee(g);

  const peutRappeler = (m: MembreGroupe) => orga && m.id !== g.moi?.id && !m.enCours && (objectif ? encours && !m.aCotise : encours ? !m.aCotise && actuel?.etat === 'collecte' : g.etat === 'ouvert' && !m.cautionPayee);
  const peutPayerPour = (m: MembreGroupe) => orga && g.visibilite === 'prive' && g.paiementOuvert && m.id !== g.moi?.id && encours && !m.aCotise && !m.enCours && (objectif || actuel?.etat === 'collecte');
  const peutRetirer = (m: MembreGroupe) => orga && m.id !== g.moi?.id && ouvertAuxMembres && !m.enCours;
  const peutCouvrir = (m: MembreGroupe) => orga && !objectif && m.id !== g.moi?.id && encours && depasse && !m.aCotise && m.cautionStatut === 'payee';
  // Ce que le membre doit maintenant : sa cotisation du tour (ou de la période), ou sa caution avant le démarrage.
  const doitPayer = (m: MembreGroupe) => (encours ? !m.aCotise && (objectif || actuel?.etat === 'collecte') : g.etat === 'ouvert' && g.cautionRequise && (m.cautionStatut === 'due' || m.cautionStatut === 'utilisee'));
  const peutDemander = (m: MembreGroupe) => orga && g.paiementOuvert && m.id !== g.moi?.id && !m.enCours && doitPayer(m);
  const aDemander = g.membres.filter(peutDemander);
  const peutEspeces = (m: MembreGroupe) => orga && !!g.regles?.especes && m.id !== g.moi?.id && encours && !m.aCotise && !m.enCours && (objectif || actuel?.etat === 'collecte');
  const seuil = g.regles?.exclusion.retards ?? 0;
  const peutExclure = (m: MembreGroupe) => orga && objectif && !!seuil && m.id !== g.moi?.id && (m.retards ?? 0) >= seuil && !m.enCours;
  const aDesActions = (m: MembreGroupe) => peutDemander(m) || peutRappeler(m) || peutCouvrir(m) || peutPayerPour(m) || peutEspeces(m) || peutExclure(m) || peutRetirer(m);
  const sousMembre = (m: MembreGroupe, base?: string) => [orga ? texteRetards(m) : '', base].filter(Boolean).join(', ') || undefined;
  const cible = choisi ? g.membres.find((m) => m.id === choisi) : undefined;

  const rappeler = async (m: MembreGroupe) => {
    setChoisi(null);
    setInfo('');
    try {
      const r = await Tontines.rappeler(m.id);
      const canaux = [r.mail ? 'mail' : '', r.sms ? 'SMS' : ''].filter(Boolean).join(' et ');
      setInfo(!r.nouveau ? `${m.nom} a déjà été rappelé aujourd’hui.` : canaux ? `Rappel envoyé par ${canaux}.` : 'Rappel envoyé dans l’app.');
    } catch (e) {
      setInfo((e as Error).message);
    }
  };

  // Une fois le tirage fait, une seule liste : l'ordre de réception et qui a cotisé.
  const lignesTours = g.tours.map((t, i) => {
    const m = g.membres.find((x) => x.rang === t.numero);
    const courant = encours && t.numero === g.tourCourant;
    return (
      <Ligne
        key={t.numero}
        premiere={i === 0}
        gauche={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Rang n={t.numero} actif={courant} />
            <AvatarMembre nom={t.beneficiaire} photo={m?.photo} taille={38} />
          </View>
        }
        titre={t.pourMoi ? 'Toi' : t.beneficiaire}
        accent={t.pourMoi}
        sous={m ? sousMembre(m, sousTour(t)) : sousTour(t)}
        droite={encours && m ? <Etat texte={m.enCours ? 'En cours' : m.aCotise ? 'Payé' : 'À payer'} couleur={m.aCotise ? C.coach : C.hebdo} /> : undefined}
        onPress={m && aDesActions(m) ? () => setChoisi(m.id) : undefined}
      />
    );
  });

  // Sur grand écran, ce qui compte à gauche et la liste à droite.
  const basDeFiche = (
    <>
      <ListeRegles g={g} onModifier={g.reglesModifiables ? () => setVoirRegles(true) : undefined} />
      {orga && g.etat !== 'termine' && g.etat !== 'annule' ? (
        <Liste>
          <Ligne premiere titre="Rappels obligatoires" sous={`${texteRappels(g.rappels)}${g.rappels.mail ? ', mail' : ''}${g.rappels.sms ? ', SMS' : ''}`} onPress={() => setReglages(true)} />
        </Liste>
      ) : null}

      {orga && ouvertAuxMembres ? <ActionDiscrete danger label="Annuler le groupe" onPress={() => agir(() => Tontines.annuler(g.id))} /> : null}
      {!orga && ouvertAuxMembres && g.moi ? <ActionDiscrete label="Quitter le groupe" onPress={() => agir(() => Tontines.quitter(g.id))} /> : null}
    </>
  );

  return (
    <View style={{ gap: 14 }}>
      <EnteteDetail titre={g.nom} sousTitre={g.mode === 'objectif' ? (g.raison ?? 'Pour une raison précise') : `Chacun son tour, ${g.places} membres`} onRetour={onRetour} />
      <FicheGroupe g={g} />
      <View style={large ? { flexDirection: 'row', alignItems: 'flex-start', gap: 14 } : { gap: 14 }}>
        <View style={{ flex: large ? 1 : undefined, gap: 14 }}>
      <Maintenant g={g} agir={agir} />
      {aDemander.length > 1 ? (
        <Btn
          kind="sec"
          label={`Demander le paiement aux ${aDemander.length} membres`}
          onPress={() =>
            agir(async () => {
              setInfo('');
              const r = await Tontines.demanderATous(g.id);
              setInfo(`Demande envoyée à ${r.envoyees} membre${r.envoyees > 1 ? 's' : ''}.${r.enCours ? ` ${r.enCours} déjà en cours.` : ''}${r.limite ? ` ${r.limite} au maximum de demandes aujourd’hui.` : ''}`);
              return r.groupe;
            })
          }
        />
      ) : null}
      {info ? (
        <T small muted>
          {info}
        </T>
      ) : null}

      {orga && g.demandes.length ? (
        <Liste titre="Demandes">
          {g.demandes.map((d, i) => (
            <Ligne
              key={d.id}
              premiere={i === 0}
              gauche={<AvatarMembre nom={d.nom} taille={40} />}
              titre={d.nom}
              droite={
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn small kind="sec" label="Refuser" onPress={() => agir(() => Tontines.decider(d.id, false))} />
                  <Btn small label="Accepter" onPress={() => agir(() => Tontines.decider(d.id, true))} />
                </View>
              }
            />
          ))}
        </Liste>
      ) : null}
      {large ? basDeFiche : null}
        </View>
        <View style={{ flex: large ? 1 : undefined, gap: 14 }}>
      {g.tours.length ? <Liste titre="Ordre de réception">{lignesTours}</Liste> : null}
      {!g.tours.length && g.membres.length ? (
        <Liste titre="Membres">
          {g.membres.map((m, i) => (
            <Ligne
              key={m.id}
              premiere={i === 0}
              gauche={<AvatarMembre nom={m.nom} photo={m.photo} taille={40} />}
              titre={m.id === g.moi?.id ? 'Toi' : m.nom}
              sous={sousMembre(m, g.regles?.ordre === 'organisateur' && m.rang && g.etat === 'ouvert' ? `Tour ${m.rang}` : undefined)}
              accent={m.id === g.moi?.id}
              droite={objectif ? <Etat texte={m.enCours ? 'En cours' : m.aCotise ? 'À jour' : 'À payer'} couleur={m.aCotise ? C.coach : C.hebdo} /> : g.cautionRequise ? <Etat texte={m.cautionPayee ? 'Caution payée' : 'Caution due'} couleur={m.cautionPayee ? C.coach : C.hebdo} /> : undefined}
              onPress={aDesActions(m) ? () => setChoisi(m.id) : undefined}
            />
          ))}
          {orga && g.etat === 'ouvert' && g.regles?.ordre === 'organisateur' && g.membres.length > 1 ? <Ligne titre="Choisir l’ordre des tours" accent onPress={() => setVoirOrdre(true)} /> : null}
          {g.lienInvitation && ouvertAuxMembres && !orga ? <Ligne titre="Inviter" accent onPress={() => setInviter(true)} /> : null}
        </Liste>
      ) : null}
      {orga && g.lienInvitation && g.etat !== 'termine' && g.etat !== 'annule' ? <InvitationsEnvoyees invitations={g.invitations ?? []} onInviter={ouvertAuxMembres ? () => setInviter(true) : undefined} /> : null}

        </View>
      </View>
      {large ? null : basDeFiche}

      {cible ? (
        <ActionsMembre
          g={g}
          m={cible}
          onFermer={() => setChoisi(null)}
          onDemander={
            peutDemander(cible)
              ? () => {
                  setChoisi(null);
                  setInfo(`Demande envoyée sur le téléphone de ${cible.nom.split(' ')[0]}.`);
                  agir(() => Tontines.demanderPaiement(cible.id));
                }
              : undefined
          }
          onRappeler={peutRappeler(cible) ? () => rappeler(cible) : undefined}
          onPayerPour={
            peutPayerPour(cible)
              ? () => {
                  setChoisi(null);
                  agir(() => Tontines.payerPour(cible.id));
                }
              : undefined
          }
          onRetirer={
            peutRetirer(cible)
              ? () => {
                  setChoisi(null);
                  agir(() => Tontines.retirer(cible.id));
                }
              : undefined
          }
          onEspeces={
            peutEspeces(cible)
              ? () => {
                  setChoisi(null);
                  agir(() => Tontines.noterEspeces(cible.id));
                }
              : undefined
          }
          onExclure={
            peutExclure(cible)
              ? () => {
                  setChoisi(null);
                  agir(() => Tontines.exclure(cible.id));
                }
              : undefined
          }
          onCaution={
            peutCouvrir(cible)
              ? () => {
                  setChoisi(null);
                  agir(() => Tontines.utiliserCaution(cible.id));
                }
              : undefined
          }
        />
      ) : null}
      {inviter ? <Invitation g={g} onFermer={() => setInviter(false)} onEnvoye={(x) => agir(async () => x)} /> : null}
      {voirRegles ? (
        <FormRegles
          g={g}
          onFermer={() => setVoirRegles(false)}
          onEnregistrer={(r) => {
            setVoirRegles(false);
            agir(() => Tontines.reglerRegles(g.id, r));
          }}
        />
      ) : null}
      {voirOrdre ? (
        <FormOrdre
          membres={g.membres}
          moi={g.moi?.id}
          onFermer={() => setVoirOrdre(false)}
          onEnregistrer={(ids) => {
            setVoirOrdre(false);
            agir(() => Tontines.ordonner(g.id, ids));
          }}
        />
      ) : null}
      {reglages ? (
        <FormRappels
          g={g}
          onFermer={() => setReglages(false)}
          onEnregistrer={(r) => {
            setReglages(false);
            agir(() => Tontines.reglerRappels(g.id, r));
          }}
        />
      ) : null}
    </View>
  );
}

/** Les tontines : mes groupes et l'annuaire. */
const COULEUR_TON: Record<TonSituation, () => string> = { du: () => C.hebdo, attente: () => C.hebdo, ok: () => C.coach, neutre: () => C.ink };

/** Mon groupe : où j'en suis, en grand, puis ce qui se passe. */
function CarteMonGroupe({ g, onPress }: { g: Groupe; onPress: () => void }) {
  const s = situationGroupe(g, today());
  const type = g.mode === 'objectif' ? g.raison || 'Raison précise' : 'Chacun son tour';
  return <CarteGroupeVue mode={g.mode} nom={g.nom} sous={`${type}, ${montantTontine(g.montant, g.devise, g.rythme)}`} coin={g.membres.length ? <VisagesGroupe membres={g.membres} max={3} /> : undefined} fort={s.action} couleurFort={COULEUR_TON[s.ton]()} ratio={s.ratio} bas={s.detail} onPress={onPress} label={`${g.nom}, ${s.action}, ${s.detail}`} />;
}

/** Ce qui compte, tous groupes confondus. */
function ResumeGroupes({ r }: { r: ReturnType<typeof resumeGroupes> }) {
  const bloc = (titre: string, fort: string, sous?: string, couleur?: string) => (
    <View style={{ flexGrow: 1, flexBasis: '45%', minWidth: 130, gap: 2 }}>
      <T small muted>
        {titre}
      </T>
      <Text style={{ color: couleur ?? C.ink, fontFamily: F.chiffre, fontSize: 22 }}>{fort}</Text>
      {sous ? (
        <T small muted>
          {sous}
        </T>
      ) : null}
    </View>
  );
  return (
    <Cadre>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {r.dus.length ? bloc('À payer', r.dus.join(' et '), undefined, C.hebdo) : bloc('À payer', 'Rien', 'Tu es à jour', C.coach)}
        {r.prochain ? bloc('Tu reçois', montantCotisation(r.prochain.net, r.prochain.devise), `Le ${dateCourte(r.prochain.echeance)}, ${r.prochain.nom}`) : null}
      </View>
    </Cadre>
  );
}

export function PanneauTontines({ vue, devise, ouvert, setOuvert, onAnnuaire, rechercheInitiale, filtresInitiaux, brouillon, groupeInitial }: {
  /** Le groupe d'un lien partagé : il s'ouvre tout de suite. */
  groupeInitial?: string;
  vue: 'groupes' | 'annuaire';
  devise: 'USD' | 'CDF';
  ouvert: string | null;
  setOuvert: (id: string | null) => void;
  onAnnuaire: () => void;
  /** Ce qui a été dit à la voix : la recherche de l'annuaire, ou le groupe à créer, à vérifier avant de confirmer. */
  rechercheInitiale?: string;
  filtresInitiaux?: FiltresAnnuaire;
  brouillon?: BrouillonGroupe | null;
}) {
  const { finances, session } = useStore();
  const largeur = useWindowDimensions().width;
  const [groupes, setGroupes] = useState<Groupe[] | null>(null);
  const annu = useAnnuaire(Tontines.annuaire, !!session && vue === 'annuaire', { q: rechercheInitiale, filtres: filtresInitiaux });
  const [nouveau, setNouveau] = useState(!!brouillon);
  const [aRejoindre, setARejoindre] = useState<CarteGroupe | null>(null);
  const [erreur, setErreur] = useState('');
  const [eligibilite, setEligibilite] = useState<Eligibilite | null>(null);
  const [approbation, setApprobation] = useState(false);

  useEffect(() => {
    if (!session) return;
    Tontines.eligibilite(true)
      .then(setEligibilite)
      .catch(() => {});
  }, [session]);

  // Un lien partagé : le groupe s'ouvre. Un membre va directement à son groupe.
  useEffect(() => {
    if (!session || !groupeInitial) return;
    let fini = false;
    Tontines.groupeAnnuaire(groupeInitial)
      .then((g) => {
        if (fini) return;
        if (g.monEtat === 'accepte') router.replace(`/finances?onglet=cotisations&groupe=${g.id}` as Href);
        else setARejoindre(g);
      })
      .catch((e: Error) => {
        if (!fini) setErreur(e.message);
      });
    return () => {
      fini = true;
    };
  }, [session, groupeInitial]);

  useEffect(() => {
    if (!session || vue !== 'groupes') return;
    const lire = (discret?: boolean) =>
      Tontines.mesGroupes(discret)
        .then((r) => setGroupes(r.groupes))
        .catch((e: Error) => {
          if (!discret) setErreur(e.message);
        });
    lire();
    const t = setInterval(() => lire(true), LISTE_MS);
    return () => clearInterval(t);
  }, [session, vue]);

  const maj = useCallback((g: Groupe) => {
    setGroupes((l) => (l?.some((x) => x.id === g.id) ? l.map((x) => (x.id === g.id ? g : x)) : [g, ...(l ?? [])]));
  }, []);
  const agir = useCallback(
    async (action: () => Promise<Groupe>) => {
      setErreur('');
      try {
        maj(await action());
      } catch (e) {
        setErreur((e as Error).message);
      }
    },
    [maj],
  );

  const detail = ouvert ? groupes?.find((g) => g.id === ouvert) : undefined;
  // Pendant la validation sur le téléphone, le groupe se met à jour seul.
  const attente = !!detail?.enAttente || !!detail?.membres.some((m) => m.enCours);
  useEffect(() => {
    if (!attente || !ouvert) return;
    const t = setInterval(() => {
      Tontines.detail(ouvert, true)
        .then(maj)
        .catch(() => {});
    }, SUIVI_MS);
    return () => clearInterval(t);
  }, [attente, ouvert, maj]);

  // Ce qui demande un geste passe en premier.
  const tries = useMemo(() => [...(groupes ?? [])].sort((a, b) => Number(!!b.aPayer) - Number(!!a.aPayer)), [groupes]);
  const resume = useMemo(() => {
    const r = resumeGroupes(groupes ?? []);
    return r.dus.length || r.prochain ? r : null;
  }, [groupes]);

  if (!session) return <Empty>Connecte-toi pour rejoindre un groupe.</Empty>;
  const message = erreur ? <Erreur texte={erreur} /> : null;
  const approuve = eligibilite?.statut === 'approuvee';
  const formApprobation =
    approbation && eligibilite ? <FormApprobation etat={eligibilite} onChange={setEligibilite} onFermer={() => setApprobation(false)} /> : null;

  if (vue === 'annuaire')
    return (
      <View style={{ gap: 12 }}>
        {message}
        {!finances ? <ReserveFinances fonction="cotisations" /> : null}
        {finances && eligibilite && !approuve ? (
          <Cadre>
            <T small>{eligibilite.statut === 'soumise' ? 'Ton compte est en cours de vérification.' : 'Fais approuver ton compte pour rejoindre un groupe.'}</T>
            {eligibilite.statut === 'soumise' ? null : <Btn small label="Faire approuver mon compte" onPress={() => setApprobation(true)} />}
          </Cadre>
        ) : null}
        <BarreAnnuaire enLigne={largeur >= 900} q={annu.q} setQ={annu.setQ} filtres={annu.filtres} setFiltres={annu.setFiltres} extra={<AlertesAnnuaire q={annu.q} filtres={annu.filtres} />} />
        <ListeAnnuaire
          groupes={annu.groupes}
          erreur={annu.erreur}
          filtres={annu.filtres}
          onEffacer={() => annu.setFiltres(FILTRES_VIDES)}
          etat={(g) => (g.monEtat === 'demande' ? <Etat texte="Envoyée" couleur={C.muted} /> : g.monEtat === 'accepte' ? <Etat texte="Membre" couleur={C.coach} /> : null)}
          onChoisir={(g) => {
            if (g.monEtat === 'accepte') return () => router.push(`/finances?onglet=cotisations&groupe=${g.id}` as Href);
            if (g.monEtat === 'refuse') return undefined;
            return () => setARejoindre(g);
          }}
        />
        {aRejoindre ? (
          <FormAdhesion
            g={aRejoindre}
            bloque={
              !finances ? (
                <ReserveFinances fonction="cotisations" />
              ) : approuve ? undefined : eligibilite?.statut === 'soumise' ? (
                <T small muted>
                  Ton compte est en cours de vérification. Tu pourras demander à rejoindre ensuite.
                </T>
              ) : (
                <Btn
                  label="Faire approuver mon compte"
                  onPress={() => {
                    setARejoindre(null);
                    setApprobation(true);
                  }}
                />
              )
            }
            onFermer={() => setARejoindre(null)}
            onEnvoyer={() => {
              const id = aRejoindre.id;
              setARejoindre(null);
              Tontines.adherer(id)
                .then((g) => {
                  annu.setGroupes((l) => l?.map((x) => (x.id === id ? { ...x, monEtat: g.monEtat } : x)) ?? null);
                  maj(g);
                })
                .catch((e: Error) => setErreur(e.message));
            }}
          />
        ) : null}
        {formApprobation}
      </View>
    );

  if (detail)
    return (
      <View style={{ gap: 12 }}>
        {message}
        <DetailGroupe key={detail.id} g={detail} agir={agir} onRetour={() => setOuvert(null)} />
      </View>
    );

  return (
    <View style={{ gap: 12 }}>
      {message}
      {!groupes && !erreur ? <SqueletteAnnuaire colonnes={largeur >= 720 ? 2 : 1} /> : null}
      <VersementsAFaire />
      {resume ? <ResumeGroupes r={resume} /> : null}
      {!finances ? <ReserveFinances fonction="cotisations" /> : null}
      {finances && groupes && !groupes.length ? (
        <Cadre>
          <View style={{ alignItems: 'center' }}>
            <Illustration nom="cercle" largeur={220} />
          </View>
          <GrandTitre>Aucun groupe</GrandTitre>
          <Btn label="Voir l’annuaire" onPress={onAnnuaire} />
        </Cadre>
      ) : null}
      {tries.length ? (
        <GrilleCartes>
          {tries.map((g) => (
            <CarteMonGroupe key={g.id} g={g} onPress={() => setOuvert(g.id)} />
          ))}
        </GrilleCartes>
      ) : null}
      {finances ? (
        <View style={largeur >= 720 ? { flexDirection: 'row' } : undefined}>
          <Btn kind={groupes?.length ? 'sec' : 'primary'} label="Créer un groupe" onPress={() => setNouveau(true)} />
        </View>
      ) : null}
      {nouveau && finances ? (
        <FormGroupe
          devise={devise}
          brouillon={brouillon}
          eligibilite={eligibilite}
          onDemanderApprobation={() => {
            setNouveau(false);
            setApprobation(true);
          }}
          onFermer={() => setNouveau(false)}
          onCreer={(c) => {
            setNouveau(false);
            Tontines.creer(c)
              .then((g) => {
                maj(g);
                setOuvert(g.id);
              })
              .catch((e: Error) => setErreur(e.message));
          }}
        />
      ) : null}
      {formApprobation}
    </View>
  );
}
