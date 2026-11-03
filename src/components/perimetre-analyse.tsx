import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/texte';

import { api } from '@/lib/api';
import { enregistrerReglagesAnalyse, oublierReprise, useReglagesAnalyse, useReprise } from '@/lib/analyse-pref';
import { boitesNonLues, bornesDates, bornesPeriode, decrirePerimetre, filtrerPerimetre, frequents, mailsAAnalyser, PERIODES, requeteLot, reunirLot, type ClePeriode, type Perimetre } from '@/lib/copilote';
import { today } from '@/lib/dates';
import { boitesDeMails, nomBoite, type Mail } from '@/lib/mails';
import { depuisQuand, resteATraiter, type RepriseAnalyse } from '@/lib/reprise-analyse';
import { useStore } from '@/lib/store';
import { estAutomatique, filtrerLot, LOT_SANS_FILTRE, type FiltresLot } from '@/lib/tri-analyses';
import { C, F } from '@/lib/theme';

import { ChampDate } from './calendrier';
import { teinteCopilote } from './copilote';
import { useDossiers } from './dossiers-mail';
import { Filtre } from './onglets';
import { ChampConsignes, ChoixNombre, Puce, Rubrique } from './reglages-analyse';
import { Bloc, ZoneSquelette } from './squelettes';
import { Btn, Dialogue, Input, T } from './ui';

type Onglet = 'nonlus' | 'personne' | 'dossier' | 'autre';
const ONGLETS: { key: Onglet; label: string }[] = [
  { key: 'nonlus', label: 'Non lus' },
  { key: 'personne', label: 'Une personne' },
  { key: 'dossier', label: 'Un dossier' },
  { key: 'autre', label: 'Autre' },
];
const AUTRES: { key: Perimetre['genre']; label: string }[] = [
  { key: 'tous', label: 'Tous mes mails' },
  { key: 'domaine', label: 'Un domaine' },
  { key: 'boite', label: 'Une boîte' },
];
const ongletDe = (g?: Perimetre['genre']): Onglet => (g === 'personne' || g === 'dossier' ? g : g ? 'autre' : 'nonlus');

/**
 * Choisir les mails que le copilote analyse, en un seul endroit : les non lus d'abord, une personne ou un dossier en un toucher,
 * tout le reste sous « Affiner ». Les non lus sont déjà là ; les autres sont cherchés chez Gmail ou Outlook au moment d'analyser.
 * `initial` : prérempli depuis le mail ouvert (sa personne) ou le dossier affiché.
 */
export function PerimetreAnalyse({ initial, onFermer, onAnalyser, onCocher, onReprendre }: { onReprendre?: (r: RepriseAnalyse) => void; initial?: Partial<Perimetre>; onFermer: () => void; onAnalyser: (mails: Mail[], perimetre: string, consignes: string) => void; /** « Les mails que je coche » : la sélection dans la liste. */ onCocher: () => void }) {
  const { mails, externes, session } = useStore();
  const t = teinteCopilote();
  const d = today();
  const comptes = externes.filter((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft');
  const [onglet, setOnglet] = useState<Onglet>(ongletDe(initial?.genre));
  const [affiner, setAffiner] = useState(false);
  const [genre, setGenre] = useState<Perimetre['genre']>(initial?.genre ?? 'tous');
  const [qui, setQui] = useState(initial?.qui ?? '');
  const [domaine, setDomaine] = useState(initial?.domaine ?? '');
  const [compte, setCompte] = useState(initial?.compte ?? (comptes.length === 1 ? comptes[0].id : ''));
  const [boite, setBoite] = useState(initial?.boite ?? '');
  const [dossier, setDossier] = useState(initial?.dossier);
  const [periode, setPeriode] = useState<ClePeriode>(initial?.depuis || initial?.jusqua ? 'dates' : 'tout');
  const [du, setDu] = useState(initial?.depuis ?? '');
  const [au, setAu] = useState(initial?.jusqua ?? '');
  const [filtresLot, setFiltresLot] = useState<FiltresLot>({ ...LOT_SANS_FILTRE });
  const [cherche, setCherche] = useState(false);
  const [msg, setMsg] = useState('');
  // Les consignes et le nombre de mails partent de ce qui a servi la dernière fois, sur cet appareil.
  const { reglages } = useReglagesAnalyse();
  const [consignesSaisies, setConsignes] = useState<string | null>(null);
  const [nombreChoisi, setNombre] = useState<number | null>(null);
  const consignes = consignesSaisies ?? reglages.consignes;
  const nombre = nombreChoisi ?? reglages.nombre;

  const sugg = useMemo(() => frequents(mails), [mails]);
  const boites = useMemo(() => {
    const vues = boitesDeMails(mails).map((b) => ({ adresse: b.adresse, partagee: b.partagee, compte: comptes.find((c) => c.compte === b.compte)?.id }));
    const partagees = comptes.flatMap((c) => (c.boites ?? []).filter((b) => !b.erreur).map((b) => ({ adresse: b.adresse, partagee: true, compte: c.id })));
    const propres = comptes.map((c) => ({ adresse: c.compte, partagee: false, compte: c.id }));
    const m = new Map<string, { adresse: string; partagee: boolean; compte?: string }>();
    for (const b of [...propres, ...vues, ...partagees]) if (!m.has(b.adresse)) m.set(b.adresse, b);
    return [...m.values()];
  }, [mails, comptes]);
  // Les dossiers se lisent dans un compte (et une boîte partagée) : le premier compte qui en a, à défaut d'un choix.
  const compteDossiers = compte || comptes.find((c) => c.dossiers)?.id;
  const boitePartagee = boites.find((b) => b.adresse === boite)?.partagee ? boite : undefined;
  const { dossiers, msg: msgDossiers } = useDossiers(compteDossiers, boitePartagee, genre === 'dossier');

  const saisies = periode === 'dates' ? bornesDates(du, au) : null;
  const erreurPeriode = saisies?.erreur;
  const bornes = saisies ? { ...(saisies.depuis ? { depuis: saisies.depuis } : {}), ...(saisies.jusqua ? { jusqua: saisies.jusqua } : {}) } : bornesPeriode(periode, d);
  const p: Perimetre = { genre, ...(genre === 'personne' ? { qui: qui.trim() } : {}), ...(genre === 'domaine' ? { domaine: domaine.trim().replace(/^@/, '') } : {}), ...(genre === 'dossier' && dossier ? { dossier } : {}), ...(compte ? { compte } : {}), ...(boitePartagee ? { boite: boitePartagee } : {}), ...bornes };
  const objetCherche = filtresLot.objet.trim();
  // Non lus, pièce jointe et objet se cherchent chez le service : on trouve ainsi les bons mails, pas seulement les plus récents.
  const pFiltres: Perimetre = { ...p, nonLus: filtresLot.nonLus, pj: filtresLot.pj, ...(objetCherche ? { objet: objetCherche } : {}), sansPartagees: filtresLot.sansPartagees };
  const complet = !erreurPeriode && (genre === 'tous' ? true : genre === 'personne' ? !!p.qui : genre === 'domaine' ? !!p.domaine : genre === 'dossier' ? !!p.dossier : !!boite);
  const description = decrirePerimetre(genre === 'boite' ? { ...pFiltres, boite } : pFiltres, nomBoite);

  const chercher = async () => {
    if (!session?.token || !complet) return;
    enregistrerReglagesAnalyse({ consignes, nombre });
    setCherche(true);
    setMsg('');
    // Une boîte : le compte qui la lit. Un dossier : son compte. Sinon tous les comptes connectés (ou celui choisi).
    const cible = genre === 'boite' ? boites.find((b) => b.adresse === boite)?.compte : genre === 'dossier' ? compteDossiers : compte;
    const liste = cible ? comptes.filter((c) => c.id === cible) : comptes;
    // Une boîte entière ou tous les mails, sans aucun critère : on les borne à un an, la recherche en demande au moins un.
    const sansCritere = (genre === 'boite' || genre === 'tous') && !p.boite && !p.depuis && !p.jusqua && !filtresLot.nonLus && !filtresLot.pj && !objetCherche;
    const r = requeteLot(sansCritere ? { ...pFiltres, depuis: bornesPeriode('1an', d).depuis } : pFiltres, nombre);
    const erreurs: string[] = [];
    const lus = await Promise.all(
      liste.map((c) =>
        api<{ mails: Mail[] }>(`/integrations/${c.id}/mails/recherche?${new URLSearchParams(r)}`, { token: session.token })
          .then((x) => x.mails)
          .catch((e: Error) => (erreurs.push(`${c.compte} : ${e.message}`), [] as Mail[])),
      ),
    );
    // Les mails déjà relus dans Me complètent la recherche (un ancien serveur ne sait pas chercher).
    const locaux = genre === 'boite' ? filtrerPerimetre(mails, { ...p, genre: 'boite', boite }) : filtrerPerimetre(mails, p);
    const tous = reunirLot(...lus, locaux);
    setCherche(false);
    // Chaque compte rend jusqu'à `nombre` mails : on garde les plus récents de l'ensemble, une fois filtrés.
    const gardes = filtrerLot(tous, filtresLot).slice(0, nombre);
    if (gardes.length) return onAnalyser(gardes, description, consignes);
    setMsg(erreurs.length && !tous.length ? erreurs.join(' · ') : tous.length ? `Les ${tous.length} mails trouvés sont écartés par les filtres.` : 'Aucun mail ne correspond. Élargis la période, ou vérifie l’orthographe.');
  };

  const changer = (f: () => void) => {
    f();
    setMsg('');
  };
  const choisirOnglet = (o: Onglet) =>
    changer(() => {
      setOnglet(o);
      setGenre(o === 'personne' ? 'personne' : o === 'dossier' ? 'dossier' : 'tous');
    });

  // Les non lus : déjà relus dans Me, ils partent sans recherche.
  const boitesNL = useMemo(() => boitesNonLues(mails), [mails]);
  const [boiteNL, setBoiteNL] = useState(boitesNL.length === 1 ? boitesNL[0].adresse : '');
  const [sansAutoNL, setSansAutoNL] = useState(true);
  const [sansPartageesNL, setSansPartageesNL] = useState(false);
  const tousNL = useMemo(() => mailsAAnalyser(mails, boiteNL || undefined), [mails, boiteNL]);
  const listeNL = useMemo(() => filtrerLot(tousNL, { ...LOT_SANS_FILTRE, sansAuto: sansAutoNL, sansPartagees: sansPartageesNL && !boiteNL }), [tousNL, sansAutoNL, sansPartageesNL, boiteNL]);
  const automatiquesNL = useMemo(() => tousNL.filter(estAutomatique).length, [tousNL]);
  const nomNL = (b: { adresse: string; partagee: boolean }) => (b.partagee ? `${nomBoite(b.adresse)} · partagée` : b.adresse);
  const enNonLus = onglet === 'nonlus';

  const basculerLot = (cle: 'nonLus' | 'pj' | 'sansAuto') => {
    setFiltresLot((x) => ({ ...x, [cle]: !x[cle] }));
    // Les mails automatiques se retirent de ce qui est trouvé ; le reste se cherche chez le service.
    setMsg('');
  };
  const choisirPartagees = (a: { boite: string; sans: boolean }) =>
    changer(() => {
      setBoite(a.boite);
      setFiltresLot((x) => ({ ...x, sansPartagees: a.sans }));
    });

  return (
    <Dialogue
      titre="Analyser"
      onFermer={onFermer}
      large
      pied={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          {enNonLus ? (
            <Btn
              couleur={t.c}
              label={listeNL.length > 1 ? `Analyser ces ${listeNL.length} mails` : listeNL.length ? 'Analyser ce mail' : 'Rien à analyser'}
              disabled={!listeNL.length}
              onPress={() => {
                enregistrerReglagesAnalyse({ consignes });
                onAnalyser(listeNL, '', consignes);
              }}
            />
          ) : (
            <Btn couleur={t.c} label={cherche ? 'Recherche…' : 'Analyser'} disabled={!complet || cherche} onPress={chercher} />
          )}
          <Pressable accessibilityRole="button" onPress={onCocher} hitSlop={6}>
            <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>Cocher dans la liste</Text>
          </Pressable>
        </View>
      }>
      <BandeauReprise onReprendre={onReprendre} />
      <Filtre label="Quels mails analyser" options={ONGLETS} value={onglet} onChange={choisirOnglet} />

      {enNonLus && boitesNL.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {boitesNL.length > 1 ? (
            <Puce on={!boiteNL} onPress={() => setBoiteNL('')}>
              Toutes · {boitesNL.reduce((n, b) => n + b.nonLus, 0)}
            </Puce>
          ) : null}
          {boitesNL.map((b) => (
            <Puce key={b.adresse} on={boiteNL === b.adresse} onPress={() => setBoiteNL(b.adresse)}>
              {nomNL(b)} · {b.nonLus}
            </Puce>
          ))}
        </View>
      ) : null}
      {enNonLus && !listeNL.length ? <T small muted>{tousNL.length ? 'Ces filtres écartent tous les mails.' : 'Aucun mail reçu à analyser.'}</T> : null}
      {enNonLus && listeNL.length && !listeNL.some((m) => m.nonLu) ? <T small muted>{`Aucun non lu : les ${listeNL.length} derniers mails reçus seront analysés.`}</T> : null}

      {onglet === 'autre' ? <Filtre label="Dans quoi chercher" options={AUTRES} value={genre} onChange={(g) => changer(() => setGenre(g))} /> : null}

      {genre === 'personne' ? (
        <Rubrique titre="Personne">
          <Input value={qui} onChangeText={(v) => changer(() => setQui(v))} placeholder="Nom ou adresse : Paul Dubois, paul@exemple.fr" accessibilityLabel="Nom ou adresse de la personne" autoCapitalize="none" />
          {sugg.personnes.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {sugg.personnes.map((x) => (
                <Puce key={x} on={qui === x} onPress={() => changer(() => setQui(x))}>
                  {x}
                </Puce>
              ))}
            </View>
          ) : null}
        </Rubrique>
      ) : null}

      {genre === 'domaine' ? (
        <Rubrique titre="Nom de domaine">
          <Input value={domaine} onChangeText={(v) => changer(() => setDomaine(v))} placeholder="ovh.com, edf.fr…" accessibilityLabel="Nom de domaine de l'expéditeur" autoCapitalize="none" autoCorrect={false} />
          {sugg.domaines.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {sugg.domaines.map((x) => (
                <Puce key={x} on={domaine.replace(/^@/, '') === x} onPress={() => changer(() => setDomaine(x))}>
                  @{x}
                </Puce>
              ))}
            </View>
          ) : null}
        </Rubrique>
      ) : null}

      {genre === 'dossier' ? (
        <Rubrique titre="Dossier">
          {!compteDossiers ? <T small muted>Aucun compte connecté ne sait ouvrir ses dossiers.</T> : null}
          {compteDossiers && !dossiers && !msgDossiers ? (
            <ZoneSquelette label="Chargement des dossiers">
              <Bloc h={34} r={999} l="70%" />
            </ZoneSquelette>
          ) : null}
          {msgDossiers ? <T small style={{ color: C.agressif }}>{msgDossiers}</T> : null}
          <ScrollView style={{ maxHeight: 150 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(dossiers ?? []).map((x) => (
              <Puce key={x.id} on={dossier?.id === x.id} onPress={() => changer(() => setDossier({ id: x.id, nom: x.nom }))}>
                {x.nom}
                {x.total ? ` · ${x.total}` : ''}
              </Puce>
            ))}
          </ScrollView>
        </Rubrique>
      ) : null}

      {!enNonLus && (genre === 'boite' || (affiner && boites.some((b) => b.partagee))) ? (
        <Rubrique titre={genre === 'boite' ? 'Boîte' : 'Dans quelle boîte'}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {genre !== 'boite' ? (
              <Puce on={!boite && !filtresLot.sansPartagees} onPress={() => choisirPartagees({ boite: '', sans: false })}>
                Toutes
              </Puce>
            ) : null}
            {genre !== 'boite' && boites.some((b) => b.partagee) ? (
              <Puce on={filtresLot.sansPartagees} onPress={() => choisirPartagees({ boite: '', sans: true })}>
                Sans les partagées
              </Puce>
            ) : null}
            {boites
              .filter((b) => genre === 'boite' || b.partagee)
              .map((b) => (
                <Puce key={b.adresse} on={boite === b.adresse} onPress={() => choisirPartagees({ boite: b.adresse, sans: false })}>
                  {b.partagee ? `${nomBoite(b.adresse)} · partagée` : b.adresse}
                </Puce>
              ))}
          </View>
        </Rubrique>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: affiner }} hitSlop={6} onPress={() => setAffiner((v) => !v)} style={{ alignSelf: 'flex-start' }}>
        <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13.5 }}>{affiner ? 'Affiner ▾' : 'Affiner ›'}</Text>
      </Pressable>

      {affiner && enNonLus ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {automatiquesNL ? (
              <Puce on={sansAutoNL} onPress={() => setSansAutoNL((v) => !v)}>
                {`Sans les mails automatiques · ${automatiquesNL}`}
              </Puce>
            ) : null}
            {!boiteNL && boitesNL.some((b) => b.partagee) ? (
              <Puce on={sansPartageesNL} onPress={() => setSansPartageesNL((v) => !v)}>
                Sans les partagées
              </Puce>
            ) : null}
          </View>
          <ChampConsignes valeur={consignes} onChange={setConsignes} />
        </View>
      ) : null}

      {affiner && !enNonLus && comptes.length > 1 && genre !== 'boite' ? (
        <Rubrique titre="Compte">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Puce on={!compte} onPress={() => changer(() => setCompte(''))}>
              Tous les comptes
            </Puce>
            {comptes.map((c) => (
              <Puce key={c.id} on={compte === c.id} onPress={() => changer(() => setCompte(c.id))}>
                {c.compte}
              </Puce>
            ))}
          </View>
        </Rubrique>
      ) : null}

      {affiner && !enNonLus ? (
        <View style={{ gap: 12 }}>
      <Rubrique titre="Période">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {PERIODES.map((x) => (
            <Puce key={x.cle} on={periode === x.cle} onPress={() => changer(() => setPeriode(x.cle))}>
              {x.label}
            </Puce>
          ))}
        </View>
        {periode === 'dates' ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <ChampDate label="Du (début)" value={du || null} onChange={(x) => changer(() => setDu(x ?? ''))} max={au || d} effacable placeholder="Dès le début" />
              <ChampDate label="Au (fin)" value={au || null} onChange={(x) => changer(() => setAu(x ?? ''))} min={du || undefined} max={d} effacable placeholder="Jusqu'à aujourd'hui" />
            </View>
            {erreurPeriode ? <T small style={{ color: C.agressif }}>{erreurPeriode}</T> : <T small muted>Les deux jours sont inclus.</T>}
          </View>
        ) : null}
      </Rubrique>

      <Rubrique titre="Chercher seulement">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Puce on={filtresLot.nonLus} onPress={() => basculerLot('nonLus')}>
            Non lus
          </Puce>
          <Puce on={filtresLot.pj} onPress={() => basculerLot('pj')}>
            Avec pièce jointe
          </Puce>
          <Puce on={filtresLot.sansAuto} onPress={() => basculerLot('sansAuto')}>
            Sans les mails automatiques
          </Puce>
        </View>
        <Input value={filtresLot.objet} onChangeText={(objet) => changer(() => setFiltresLot((x) => ({ ...x, objet })))} placeholder="Mot dans l’objet : facture, contrat…" accessibilityLabel="Mot dans l’objet du mail" />
      </Rubrique>

      <ChoixNombre valeur={nombre} onChange={(n) => changer(() => setNombre(n))} />
      <ChampConsignes valeur={consignes} onChange={setConsignes} />
        </View>
      ) : null}

      {!enNonLus && complet ? <T small muted>{`${description.charAt(0).toUpperCase()}${description.slice(1)}, au plus ${nombre} mails.`}</T> : null}
      {!enNonLus && erreurPeriode ? <T small style={{ color: C.agressif }}>{erreurPeriode}</T> : null}
      {cherche ? (
        <ZoneSquelette label="Recherche des mails">
          {[0, 1, 2].map((i) => (
            <Bloc key={i} h={44} r={10} />
          ))}
        </ZoneSquelette>
      ) : null}
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
    </Dialogue>
  );
}

/** La dernière analyse, s'il reste quelque chose à traiter : elle se reprend là où elle s'est arrêtée. */
function BandeauReprise({ onReprendre }: { onReprendre?: (r: RepriseAnalyse) => void }) {
  const { profil } = useStore();
  const t = teinteCopilote();
  const r = useReprise(profil?.id);
  const [maintenant] = useState(() => Date.now());
  if (!r || !onReprendre) return null;
  const reste = resteATraiter(r);
  return (
    <View style={{ gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: t.ligne, backgroundColor: t.douce }}>
      <View style={{ gap: 2 }}>
        <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 14 }}>Dernière analyse · {reste} à traiter</Text>
        <T small muted>{`${r.mails.length} mail${r.mails.length > 1 ? 's' : ''} · ${depuisQuand(r.quand, maintenant)}`}</T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <Btn couleur={t.c} label="Reprendre" onPress={() => onReprendre(r)} />
        <Pressable accessibilityRole="button" hitSlop={6} onPress={oublierReprise}>
          <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Oublier</Text>
        </Pressable>
      </View>
    </View>
  );
}
