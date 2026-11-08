import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { createElement, useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Chargeur } from '@/components/squelettes';
import { Icone } from '@/components/icones';
import { Text } from '@/components/texte';
import { fmtCourt, today } from '@/lib/dates';
import { financesDe } from '@/lib/finances';
import { type FichierChoisi, tailleLisible } from '@/lib/justificatifs';
import { refExterne } from '@/lib/externe';
import { ajouterPieces, type AnalysePiece, depenseDeLaPiece, genreApercu, lignesMontrees, MAX_TEXTE_APERCU, NATURES_PIECE, type GenreApercu, type PieceMail, type Tableau, tableauTsv } from '@/lib/pieces-mail';
import { analyserPiece, donneesPiece, lienPiece } from '@/lib/pieces-mail-api';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { Outil } from './mail-ui';
import { Btn, Dialogue, T } from './ui';

const typeFichier = (type?: string | null) => type || 'application/octet-stream';
// Une fonction, pas un objet : la bordure suit le thème choisi après le chargement.
const styleCarte = () => ({ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 280, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.line }) as const;

/** Joindre des fichiers à un mail : choisir, voir ce qui part, retirer. */
export function ChampPieces({ pieces, onChange }: { pieces: FichierChoisi[]; onChange: (p: FichierChoisi[]) => void }) {
  const [refus, setRefus] = useState<string | null>(null);
  const ajouter = (nouvelles: FichierChoisi[]) => {
    const r = ajouterPieces(pieces, nouvelles);
    setRefus(r.refus);
    onChange(r.liste);
  };
  const fichier = async () => {
    const r = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
    if (!r.canceled) ajouter(r.assets.map((a) => ({ uri: a.uri, nom: a.name, type: typeFichier(a.mimeType), taille: a.size, file: a.file })));
  };
  const photo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true });
    if (!r.canceled) ajouter(r.assets.map((a, n) => ({ uri: a.uri, nom: a.fileName || `photo-${Date.now()}-${n + 1}.jpg`, type: typeFichier(a.mimeType ?? 'image/jpeg'), taille: a.fileSize, file: a.file })));
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Outil icone="trombone" label="Joindre un fichier" onPress={fichier} />
        {Platform.OS !== 'web' ? <Outil glyphe="🖼️" label="Photo" onPress={photo} /> : null}
      </View>
      {pieces.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {pieces.map((p) => (
            <View key={`${p.nom}-${p.taille}`} style={{ ...styleCarte(), paddingRight: 6, backgroundColor: C.sunk }}>
              <View style={{ flexShrink: 0 }}>
                <Icone nom="trombone" color={C.muted} size={16} />
              </View>
              <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>
                {p.nom}
              </Text>
              {p.taille ? <Text numberOfLines={1} style={{ flexShrink: 0, color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{tailleLisible(p.taille)}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${p.nom}`}
                hitSlop={8}
                onPress={() => {
                  setRefus(null);
                  onChange(pieces.filter((x) => x !== p));
                }}
                style={({ pressed }) => ({ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? alpha(C.ink, 0.08) : 'transparent' })}>
                <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 15, lineHeight: 18 }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {refus ? <T small style={{ color: C.agressif }}>{refus}</T> : null}
    </View>
  );
}

type OuPiece = { mailId: string; message?: string };

/** Enregistre le fichier sur l'appareil. Le lien est redemandé à chaque fois : il ne dure que quelques minutes. */
async function telecharger(p: PieceMail, ou: OuPiece, token: string, blob?: string) {
  const ref = refExterne(ou.mailId);
  if (Platform.OS === 'web' && blob) {
    const a = document.createElement('a');
    a.href = blob;
    a.download = p.nom;
    a.click();
    return;
  }
  const url = await lienPiece(ref!.compte, ref!.element, p.id, ou.message, token);
  if (Platform.OS === 'web') window.location.assign(url);
  else await WebBrowser.openBrowserAsync(url);
}

/** Le navigateur sait-il montrer un PDF dans la page ? Pas sur l'app téléphone, ni sur Chrome Android : il s'ouvre alors à part. */
const pdfDansLaPage = () => Platform.OS === 'web' && (navigator as Navigator & { pdfViewerEnabled?: boolean }).pdfViewerEnabled !== false;

type Vue = { etat: 'charge' } | { etat: 'erreur'; msg: string } | { etat: 'aucun' } | { etat: 'navigateur' } | { etat: 'pret'; genre: GenreApercu; url?: string; texte?: string; tableau?: Tableau | null };

/** Largeur d'une colonne d'après ses textes : ni trop étroite, ni trop large. */
const largeurColonne = (t: Tableau, j: number) => Math.min(240, Math.max(72, 16 + 7.2 * Math.max(t.colonnes[j]?.length ?? 0, ...t.lignes.slice(0, 50).map((l) => (l[j] ?? '').length))));

/** Un tableau qui défile de côté sur téléphone ; les chiffres s'alignent à droite. */
function ApercuTableau({ t }: { t: Tableau }) {
  const largeurs = t.colonnes.map((_, j) => largeurColonne(t, j));
  const chiffre = (v: string) => /^-?[\d\s.,]+%?$/.test(v.trim()) && /\d/.test(v);
  const cellule = (v: string, j: number, entete?: boolean) => (
    <Text
      key={j}
      numberOfLines={entete ? 1 : 2}
      selectable
      style={{ width: largeurs[j], paddingVertical: 7, paddingHorizontal: 8, color: entete ? C.muted : C.ink, fontFamily: entete ? F.texteF : F.texte, fontSize: entete ? 12 : 13, textAlign: !entete && chiffre(v) ? 'right' : 'left', fontVariant: ['tabular-nums'] }}>
      {v}
    </Text>
  );
  return (
    <View style={{ gap: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator style={{ borderRadius: 10, borderWidth: 1, borderColor: C.line }}>
        <View>
          <View accessibilityRole="header" style={{ flexDirection: 'row', backgroundColor: C.sunk, borderBottomWidth: 1, borderColor: C.line }}>
            {t.colonnes.map((c, j) => cellule(c, j, true))}
          </View>
          {t.lignes.map((l, i) => (
            <View key={i} style={{ flexDirection: 'row', borderTopWidth: i ? 1 : 0, borderColor: alpha(C.line, 0.6) }}>
              {t.colonnes.map((_, j) => cellule(l[j] ?? '', j))}
            </View>
          ))}
        </View>
      </ScrollView>
      <T small muted>{[t.feuille, lignesMontrees(t)].filter(Boolean).join(' · ')}</T>
    </View>
  );
}

/** Ce que l'IA a lu : à relire, rien n'est enregistré tant qu'on n'ajoute pas soi-même la dépense. */
function CarteAnalyse({ a, avecTableau, onFermer }: { a: AnalysePiece; avecTableau: boolean; onFermer: () => void }) {
  const [copie, setCopie] = useState(false);
  const depense = depenseDeLaPiece(a, 0);
  const tableau = avecTableau ? a.tableau : null;
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: alpha(C.accent, 0.35), backgroundColor: alpha(C.accent, 0.06) }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 12.5 }}>{NATURES_PIECE[a.nature] ?? 'Document'}</Text>
          {a.titre ? <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>{a.titre}</Text> : null}
          {a.resume ? <T small>{a.resume}</T> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Masquer l’analyse" hitSlop={10} onPress={onFermer} style={({ pressed }) => ({ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? alpha(C.ink, 0.08) : 'transparent' })}>
          <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 14 }}>✕</Text>
        </Pressable>
      </View>
      {a.champs.length || a.echeance ? (
        <View style={{ gap: 6 }}>
          {a.echeance ? <Ligne libelle="À régler avant" valeur={fmtCourt(a.echeance)} fort /> : null}
          {a.champs.map((c, i) => (
            <Ligne key={i} libelle={c.libelle} valeur={c.valeur} />
          ))}
        </View>
      ) : null}
      {tableau?.lignes.length ? <ApercuTableau t={tableau} /> : null}
      {depense || a.tableau?.lignes.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {depense ? <Btn small label="Ajouter en dépense" onPress={() => router.push({ pathname: '/finances', params: { ...depense, ajout: String(Date.now()) } } as never)} /> : null}
          {a.tableau?.lignes.length ? (
            <Btn
              small
              kind="sec"
              label={copie ? 'Tableau copié' : 'Copier le tableau'}
              onPress={() =>
                Clipboard.setStringAsync(tableauTsv(a.tableau!))
                  .then(() => setCopie(true))
                  .catch(() => {})
              }
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Ligne({ libelle, valeur, fort }: { libelle: string; valeur: string; fort?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Text style={{ width: 120, flexShrink: 0, color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{libelle}</Text>
      <Text selectable style={{ flex: 1, color: fort ? C.agressif : C.ink, fontFamily: fort ? F.texteF : F.texteM, fontSize: 13 }}>
        {valeur}
      </Text>
    </View>
  );
}

/** Le fichier, lu une fois à l'ouverture. Sur le web, il reste dans la page : rien n'est gardé après la fermeture. */
function ContenuPiece({ p, ou, onBlob, lien, service }: { p: PieceMail; ou: OuPiece; onBlob: (u?: string) => void; lien?: string; service: string }) {
  const { session } = useStore();
  const { height } = useWindowDimensions();
  const genre = genreApercu(p);
  const pdfAilleurs = genre === 'pdf' && !pdfDansLaPage();
  const [vue, setVue] = useState<Vue>(() => (!genre ? { etat: 'aucun' } : pdfAilleurs ? { etat: 'navigateur' } : { etat: 'charge' }));
  const token = session?.token;
  useEffect(() => {
    if (!genre || pdfAilleurs || !token) return;
    const ref = refExterne(ou.mailId);
    if (!ref) return;
    let vivant = true;
    let cree: string | undefined;
    (async () => {
      if (genre === 'tableur') {
        const tableau = await donneesPiece(ref.compte, ref.element, p.id, ou.message, token);
        return vivant && setVue({ etat: 'pret', genre, tableau });
      }
      const url = await lienPiece(ref.compte, ref.element, p.id, ou.message, token);
      if (Platform.OS !== 'web' && genre === 'image') return vivant && setVue({ etat: 'pret', genre, url });
      const r = await fetch(url);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error || 'Cette pièce jointe n’a pas pu être lue.');
      }
      if (genre === 'texte') {
        const texte = await r.text();
        return vivant && setVue({ etat: 'pret', genre, texte: texte.slice(0, MAX_TEXTE_APERCU) });
      }
      const b = await r.blob();
      // Le serveur a le dernier mot : un fichier qu'il ne sert pas tel quel ne se montre pas.
      if (genreApercu({ nom: '', type: b.type }) !== genre) return vivant && setVue({ etat: 'aucun' });
      if (!vivant) return;
      cree = URL.createObjectURL(b);
      onBlob(cree);
      setVue({ etat: 'pret', genre, url: cree });
    })().catch((e: Error) => vivant && setVue({ etat: 'erreur', msg: e.message }));
    return () => {
      vivant = false;
      if (cree) URL.revokeObjectURL(cree);
    };
    // Lu une fois par pièce ; une autre pièce est un autre composant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hauteur = Math.max(320, height - 220);

  if (vue.etat === 'charge')
    return (
      <View style={{ height: 240, alignItems: 'center', justifyContent: 'center' }}>
        <Chargeur label="Chargement de la pièce jointe" />
      </View>
    );
  if (vue.etat === 'erreur')
    return (
      <View style={{ gap: 10, paddingVertical: 24, alignItems: 'center' }} accessibilityLiveRegion="polite">
        <T small style={{ color: C.agressif, textAlign: 'center' }}>{vue.msg}</T>
        {lien ? <Outil icone="ouvrir" label={`Ouvrir dans ${service}`} onPress={() => Linking.openURL(lien).catch(() => {})} /> : null}
      </View>
    );
  if (vue.etat === 'aucun')
    return (
      <View style={{ gap: 6, paddingVertical: 40, alignItems: 'center' }}>
        <Icone nom="trombone" color={C.muted} size={28} />
        <T small muted>Aperçu indisponible pour ce format.</T>
      </View>
    );
  if (vue.etat === 'navigateur')
    return (
      <View style={{ gap: 10, paddingVertical: 40, alignItems: 'center' }}>
        <Icone nom="trombone" color={C.muted} size={28} />
        <Btn label="Ouvrir le PDF" onPress={() => token && telecharger(p, ou, token).catch((e: Error) => setVue({ etat: 'erreur', msg: e.message }))} />
      </View>
    );
  if (vue.genre === 'image') return <Image accessibilityLabel={p.nom} source={{ uri: vue.url }} resizeMode="contain" style={{ width: '100%', height: hauteur, borderRadius: 10 }} />;
  if (vue.genre === 'tableur') return vue.tableau?.lignes.length ? <ApercuTableau t={vue.tableau} /> : <T small muted style={{ textAlign: 'center', paddingVertical: 40 }}>Ce tableur est vide.</T>;
  if (vue.genre === 'texte')
    return (
      <View style={{ padding: 12, borderRadius: 10, backgroundColor: C.sunk }}>
        <Text selectable style={{ color: C.ink, fontFamily: F.texte, fontSize: 13.5, lineHeight: 20 }}>{vue.texte || '(fichier vide)'}</Text>
      </View>
    );
  return createElement('iframe', { src: vue.url, title: p.nom, style: { width: '100%', height: hauteur, border: 0, borderRadius: 10, background: '#fff' } });
}

/** Voir une pièce jointe sans quitter Me, et passer aux autres pièces du mail. */
export function ApercuPiece({ pieces, depart, ou, lien, service, onFermer }: { pieces: PieceMail[]; depart: number; ou: OuPiece; lien?: string; service: string; onFermer: () => void }) {
  const { session, pro, espace } = useStore();
  const [i, setI] = useState(depart);
  const [blob, setBlob] = useState<string>();
  const [msg, setMsg] = useState('');
  const [analyse, setAnalyse] = useState<{ etat: 'charge' } | { etat: 'pret'; a: AnalysePiece } | null>(null);
  const p = pieces[i];
  const genre = genreApercu(p);
  // La réponse d'une analyse lente ne s'affiche pas sur la pièce suivante.
  const courante = useRef(p.id);
  useEffect(() => {
    courante.current = p.id;
  }, [p.id]);
  const aller = (n: number) => {
    setBlob(undefined);
    setMsg('');
    setAnalyse(null);
    setI(n);
  };
  const analyser = () => {
    const ref = refExterne(ou.mailId);
    if (!ref || !session?.token) return;
    const pour = p.id;
    setMsg('');
    setAnalyse({ etat: 'charge' });
    analyserPiece(ref.compte, ref.element, p.id, { message: ou.message, aujourdhui: today(), devise: financesDe(espace).devise }, session.token)
      .then((a) => courante.current === pour && setAnalyse({ etat: 'pret', a }))
      .catch((e: Error) => {
        if (courante.current !== pour) return;
        setAnalyse(null);
        setMsg(e.message);
      });
  };
  return (
    <Dialogue
      plein
      large
      titre={p.nom}
      onFermer={onFermer}
      pied={
        <>
          {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {pieces.length > 1 ? (
              <>
                <Outil grand glyphe="‹" masquerLabel label="Pièce précédente" disabled={i === 0} onPress={() => aller(i - 1)} />
                <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>{`${i + 1}/${pieces.length}`}</Text>
                <Outil grand glyphe="›" masquerLabel label="Pièce suivante" disabled={i === pieces.length - 1} onPress={() => aller(i + 1)} />
              </>
            ) : null}
            <View style={{ flex: 1 }} />
            {pro && genre ? <Outil grand icone="copilote" label={analyse?.etat === 'charge' ? 'Analyse…' : 'Analyser'} disabled={!!analyse} onPress={analyser} /> : null}
            <Outil grand label="Télécharger" onPress={() => session?.token && telecharger(p, ou, session.token, blob).catch((e: Error) => setMsg(e.message))} />
          </View>
        </>
      }>
      <View style={{ gap: 14 }}>
        {analyse?.etat === 'charge' ? (
          <View style={{ height: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: C.sunk }}>
            <Chargeur label="Analyse de la pièce jointe" />
          </View>
        ) : analyse?.etat === 'pret' ? (
          <CarteAnalyse a={analyse.a} avecTableau={genre !== 'tableur'} onFermer={() => setAnalyse(null)} />
        ) : null}
        <ContenuPiece key={p.id} p={p} ou={ou} onBlob={setBlob} lien={lien} service={service} />
      </View>
    </Dialogue>
  );
}

/**
 * Les pièces jointes d'un mail : un toucher les montre dans Me. Sans repère (ancienne version du serveur, mail hors compte connecté),
 * les noms renvoient au mail chez le service.
 * `message` : un ancien message du fil de `mailId`.
 */
export function PiecesDuMail({ mailId, message, pieces, noms, lien, service, sansTitre }: { mailId: string; message?: string; pieces?: PieceMail[]; noms: string[]; lien?: string; service: string; sansTitre?: boolean }) {
  const { session } = useStore();
  const [vue, setVue] = useState<number | null>(null);
  const ref = refExterne(mailId);
  const ouvrables = !!(ref && session?.token && pieces?.length);
  const liste: PieceMail[] = ouvrables ? pieces! : noms.map((nom, i) => ({ id: `${i}`, nom }));
  if (!liste.length) return null;

  return (
    <View style={{ gap: 8 }}>
      {!sansTitre ? (
        <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>
          {liste.length} pièce{liste.length > 1 ? 's' : ''} jointe{liste.length > 1 ? 's' : ''}{ouvrables ? '' : ` · à ouvrir dans ${service}`}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {liste.map((p, i) => (
          <Pressable
            key={`${p.id}-${i}`}
            accessibilityRole="button"
            accessibilityLabel={ouvrables ? `Aperçu de ${p.nom}` : `${p.nom}, ouvrir dans ${service}`}
            disabled={!ouvrables && !lien}
            onPress={() => (ouvrables ? setVue(i) : lien && Linking.openURL(lien).catch(() => {}))}
            style={({ pressed }) => ({ ...styleCarte(), backgroundColor: pressed ? alpha(C.ink, 0.06) : C.surface })}>
            <View style={{ flexShrink: 0 }}>
              <Icone nom="trombone" color={C.muted} size={16} />
            </View>
            <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>
              {p.nom}
            </Text>
            {p.taille ? <Text numberOfLines={1} style={{ flexShrink: 0, color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{tailleLisible(p.taille)}</Text> : null}
          </Pressable>
        ))}
      </View>
      {vue !== null && ouvrables ? <ApercuPiece pieces={pieces!} depart={vue} ou={{ mailId, message }} lien={lien} service={service} onFermer={() => setVue(null)} /> : null}
    </View>
  );
}
