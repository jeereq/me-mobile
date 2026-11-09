import { router, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { type ReactNode, useEffect, useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';

import { ActionDiscrete } from '@/components/cotisations-ui';
import { Icone, type IconeNom } from '@/components/icones';
import { Illustration } from '@/components/illustrations';
import { Bloc as Gris, LignesSquelette, ZoneSquelette } from '@/components/squelettes';
import { ChampTelephone, useTelephone } from '@/components/telephone';
import { Text } from '@/components/texte';
import { Btn, Dialogue, Input, Seg, T } from '@/components/ui';
import { api } from '@/lib/api';
import { estMajeur, lireDateNaissance } from '@/lib/cotisations';
import { today } from '@/lib/dates';
import { lireMontant } from '@/lib/finances';
import { versJpegWeb } from '@/lib/image-web';
import { useStore } from '@/lib/store';
import { alpha, C, encre, F } from '@/lib/theme';
import { type DossierEligibilite, type Eligibilite, Tontines } from '@/lib/tontines';

const PIECES: { key: DossierEligibilite['typePiece']; label: string }[] = [
  { key: 'carte_electeur', label: 'Carte d’électeur' },
  { key: 'passeport', label: 'Passeport' },
  { key: 'permis', label: 'Permis' },
  { key: 'autre', label: 'Autre' },
];

/** L'état d'une approbation, en clair et en couleur. */
export function etatApprobation(statut: Eligibilite['statut']) {
  return {
    aucune: { titre: 'Compte non vérifié', couleur: C.muted, icone: 'bouclier' as IconeNom },
    soumise: { titre: 'En vérification', couleur: C.hebdo, icone: 'loupe' as IconeNom },
    approuvee: { titre: 'Compte approuvé', couleur: C.coach, icone: 'bouclier' as IconeNom },
    refusee: { titre: 'Demande refusée', couleur: C.agressif, icone: 'bouclier' as IconeNom },
  }[statut];
}

/** Les trois étapes, nommées : faites (coche), en cours (pleine), à venir. */
function Etapes({ etape }: { etape: number }) {
  const noms = ['Numéro', 'Informations', 'Pièce'];
  return (
    <View accessibilityLabel={`Étape ${etape} sur 3 : ${noms[etape - 1]}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {noms.map((n, i) => {
        const fait = i + 1 < etape;
        const ici = i + 1 === etape;
        return (
          <View key={n} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: fait || ici ? C.accent : 'transparent', borderWidth: fait || ici ? 0 : 1.5, borderColor: C.line }}>
              <Text style={{ color: fait || ici ? encre(C.accent) : C.muted, fontFamily: F.texteF, fontSize: 12 }}>{fait ? '✓' : String(i + 1)}</Text>
            </View>
            {/* Sur un écran étroit, seul le nom de l'étape en cours tient : les autres gardent leur numéro. */}
            {ici ? (
              <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteF, fontSize: 13 }}>
                {n}
              </Text>
            ) : null}
            {i < noms.length - 1 ? <View style={{ flex: 1, height: 1.5, minWidth: 8, backgroundColor: fait ? C.accent : C.line }} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Un groupe de champs avec son titre. */
function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>{titre}</Text>
      {children}
    </View>
  );
}

/**
 * Faire approuver son compte (annuaire, montants plus élevés) en trois étapes nommées : le numéro mobile money confirmé
 * par SMS, les informations (soi, puis un proche à joindre), la photo de la pièce. Une demande envoyée ou refusée a son
 * propre écran.
 */
export function FormApprobation({ etat, onChange, onFermer }: { etat: Eligibilite; onChange: (e: Eligibilite) => void; onFermer: () => void }) {
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
  const [refaire, setRefaire] = useState(false);
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

  if (etat.statut === 'soumise' || etat.statut === 'approuvee')
    return (
      <Dialogue titre="Approbation du compte" onFermer={onFermer} pied={<Btn label="Compris" onPress={onFermer} />}>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <Illustration nom="verification" largeur={140} />
          <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 19, textAlign: 'center' }}>{etat.statut === 'approuvee' ? 'Ton compte est approuvé' : 'Demande envoyée'}</Text>
          <T muted style={{ textAlign: 'center' }}>
            {etat.statut === 'approuvee' ? 'L’annuaire des groupes t’est ouvert.' : 'L’équipe de Me vérifie ta pièce. Tu es prévenu dès la décision.'}
          </T>
        </View>
      </Dialogue>
    );

  if (etat.statut === 'refusee' && !refaire)
    return (
      <Dialogue titre="Approbation du compte" onFermer={onFermer} pied={<Btn label="Refaire ma demande" onPress={() => setRefaire(true)} />}>
        <View style={{ gap: 6, padding: 14, borderRadius: 14, backgroundColor: alpha(C.agressif, 0.1), borderWidth: 1, borderColor: alpha(C.agressif, 0.35) }}>
          <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>Demande refusée</Text>
          <T small>{etat.motif || 'Sans motif précisé.'}</T>
        </View>
        <T small muted>
          Corrige ce qui est dit, puis envoie une nouvelle photo de ta pièce.
        </T>
      </Dialogue>
    );

  const pied =
    etape === 1 ? (
      codeEnvoye ? (
        <Btn label="Confirmer le numéro" disabled={envoi || code.trim().length < 4} onPress={() => agir(async () => onChange(await Tontines.confirmerCode(code.trim())))} />
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
      )
    ) : etape === 2 ? (
      <Btn label="Continuer" disabled={!infosOk} onPress={() => setInfosFinies(true)} />
    ) : (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Btn kind="sec" label="Retour" onPress={() => setInfosFinies(false)} />
        <View style={{ flex: 1 }} />
        <Btn label={envoi ? 'Envoi…' : 'Envoyer ma demande'} disabled={envoi || !photo} onPress={envoyer} />
      </View>
    );

  return (
    <Dialogue titre="Faire approuver mon compte" onFermer={onFermer} pied={pied}>
      <Etapes etape={etape} />
      {erreur ? (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: alpha(C.agressif, 0.1) }}>
          <T small style={{ color: C.agressif }}>
            {erreur}
          </T>
        </View>
      ) : null}
      {etape === 1 ? (
        <>
          <T muted>Le numéro qui recevra tes versements. Un code arrive par SMS.</T>
          <ChampTelephone tel={tel} label="Numéro mobile money" editable={!codeEnvoye} />
          {codeEnvoye ? (
            <>
              <Input label="Code reçu par SMS" value={code} onChangeText={setCode} keyboardType="number-pad" autoFocus />
              <ActionDiscrete
                label="Changer de numéro"
                onPress={() => {
                  setCodeEnvoye(false);
                  setCode('');
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
      {etape === 2 ? (
        <>
          <Bloc titre="Toi">
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
          </Bloc>
          <Bloc titre="Un proche à joindre">
            <Input label="Son nom" placeholder="Nom d’un proche" value={contactNom} onChangeText={setContactNom} />
            <ChampTelephone tel={telContact} label="Son numéro" />
          </Bloc>
        </>
      ) : null}
      {etape === 3 ? (
        <>
          <Seg label="Type de pièce" options={PIECES} value={typePiece} onChange={setTypePiece} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={photo ? 'Changer la photo de ta pièce' : 'Ajouter la photo de ta pièce'}
            onPress={choisir}
            style={({ pressed }) => ({ height: 190, borderRadius: 16, borderWidth: photo ? 0 : 1.5, borderStyle: 'dashed', borderColor: alpha(C.accent, 0.6), backgroundColor: alpha(C.accent, 0.06), alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden', opacity: pressed ? 0.8 : 1 })}>
            {photo ? (
              <>
                <Image source={{ uri: photo.uri }} accessibilityLabel="Photo de ta pièce d’identité" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} resizeMode="cover" />
                <View style={{ position: 'absolute', right: 10, bottom: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                  <Text style={{ color: '#fff', fontFamily: F.texteM, fontSize: 13 }}>Changer</Text>
                </View>
              </>
            ) : (
              <>
                <Icone nom="dossier" color={C.accent} size={26} />
                <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>Photo de ta pièce</Text>
                <T small muted>
                  Bien nette, les quatre coins visibles.
                </T>
              </>
            )}
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icone nom="bouclier" color={C.muted} size={16} />
            <T small muted style={{ flex: 1 }}>
              Photo chiffrée, effacée après la décision.
            </T>
          </View>
        </>
      ) : null}
    </Dialogue>
  );
}

/** Une étape de l'activation du compte : cochée quand elle est faite. */
function Point({ fait, titre, detail, action }: { fait: boolean; titre: string; detail?: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: fait ? C.coach : 'transparent', borderWidth: fait ? 0 : 1.5, borderColor: alpha(C.muted, 0.6) }}>
        {fait ? <Text style={{ color: encre(C.coach), fontSize: 13, fontFamily: F.texteF }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ color: fait ? C.muted : C.ink, fontFamily: F.texteM, fontSize: 14.5 }}>{titre}</Text>
        {detail ? (
          <T small muted>
            {detail}
          </T>
        ) : null}
      </View>
      {action}
    </View>
  );
}

/**
 * Mon compte : où en est l'activation du compte. Email confirmé, photo, numéro vérifié, pièce d'identité approuvée ;
 * chaque étape se coche d'elle-même, et la suivante a son bouton. Approuvé, le compte ouvre l'annuaire des groupes.
 */
export function CarteActivation() {
  const { profil, session, finances, isAdmin } = useStore();
  const [etat, setEtat] = useState<Eligibilite | null>(null);
  const [form, setForm] = useState(false);
  const [info, setInfo] = useState('');
  useEffect(() => {
    let fini = false;
    Tontines.eligibilite(true)
      .then((e) => !fini && setEtat(e))
      .catch(() => !fini && setEtat({ statut: 'aucune', motif: null, telephone: null }));
    return () => {
      fini = true;
    };
  }, []);
  const statut = etat?.statut ?? 'aucune';
  const e = etatApprobation(statut);
  const emailOk = !profil?.email || profil.emailVerifie !== false;
  const photoOk = !!session?.user.photo || isAdmin;
  const points = [emailOk, photoOk, !!etat?.telephone, statut === 'approuvee'];
  const faits = points.filter(Boolean).length;
  const ouvrir = () => (finances ? setForm(true) : router.push('/abonnement' as Href));
  // Tant que l'état n'est pas lu, la carte ne dit rien qui pourrait être faux (« non vérifié » pour un compte approuvé).
  if (!etat)
    return (
      <ZoneSquelette label="Chargement de l’activation du compte" style={{ gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Gris l={44} h={44} r={14} />
          <View style={{ flex: 1, gap: 6 }}>
            <Gris l="50%" h={16} />
            <Gris l="80%" h={10} />
          </View>
        </View>
        <Gris l="100%" h={6} r={3} />
        <LignesSquelette n={4} pastille="rond" droite={false} />
      </ZoneSquelette>
    );

  return (
    <View style={{ gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: alpha(e.couleur, statut === 'aucune' ? 0.3 : 0.5), backgroundColor: C.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(statut === 'aucune' ? C.accent : e.couleur, 0.16) }}>
          <Icone nom={e.icone} color={statut === 'aucune' ? C.accent : e.couleur} size={22} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>{e.titre}</Text>
          <T small muted>
            {statut === 'approuvee' ? 'L’annuaire des groupes t’est ouvert.' : 'Un compte approuvé rejoint les groupes de l’annuaire.'}
          </T>
        </View>
        <Text style={{ color: C.muted, fontFamily: F.chiffre, fontSize: 14 }}>{`${faits}/4`}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.sunk, overflow: 'hidden' }}>
        <View style={{ width: `${(faits / 4) * 100}%`, height: '100%', backgroundColor: statut === 'approuvee' ? C.coach : C.accent }} />
      </View>
      <View>
        <Point
          fait={emailOk}
          titre="Email confirmé"
          detail={emailOk ? undefined : profil?.email ?? undefined}
          action={
            emailOk ? null : (
              <Btn
                small
                kind="sec"
                label="Recevoir le lien"
                onPress={() =>
                  api('/auth/verifier/renvoyer', { method: 'POST', body: { email: profil?.email } })
                    .then(() => setInfo(`Lien envoyé à ${profil?.email}.`))
                    .catch((x: Error) => setInfo(x.message))
                }
              />
            )
          }
        />
        <Point fait={photoOk} titre="Photo de profil" detail={photoOk ? undefined : 'Ajoute-la en haut de cette page.'} />
        <Point fait={!!etat?.telephone} titre="Numéro mobile money vérifié" detail={etat?.telephone ? `+${etat.telephone}` : 'Par un code SMS.'} />
        <Point
          fait={statut === 'approuvee'}
          titre="Pièce d’identité"
          detail={statut === 'soumise' ? 'En vérification par l’équipe de Me.' : statut === 'refusee' ? `Refusée : ${etat?.motif || 'sans motif'}` : statut === 'approuvee' ? 'Vérifiée.' : 'Une photo, effacée après la décision.'}
        />
      </View>
      {statut !== 'approuvee' && statut !== 'soumise' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <Btn label={statut === 'refusee' ? 'Refaire ma demande' : finances ? 'Faire approuver mon compte' : 'Voir la formule Finances'} onPress={ouvrir} />
          {finances ? null : (
            <T small muted style={{ flex: 1, minWidth: 180 }}>
              L’approbation demande au moins Finances.
            </T>
          )}
        </View>
      ) : null}
      {info ? <T small muted>{info}</T> : null}
      {form && etat ? <FormApprobation etat={etat} onChange={setEtat} onFermer={() => setForm(false)} /> : null}
    </View>
  );
}
