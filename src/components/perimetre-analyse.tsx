import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { enregistrerReglagesAnalyse, useReglagesAnalyse } from '@/lib/analyse-pref';
import { bornesDates, bornesPeriode, decrirePerimetre, domaineDe, filtrerPerimetre, frequents, nettoyerConsignes, PERIODES, requeteLot, reunirLot, type ClePeriode, type Perimetre } from '@/lib/copilote';
import { today } from '@/lib/dates';
import { boitesDeMails, nomBoite, quandCourt, type Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

import { ChampDate } from './calendrier';
import { teinteCopilote } from './copilote';
import { useDossiers } from './dossiers-mail';
import { Filtre } from './onglets';
import { ChampConsignes, ChoixNombre, Puce, Rubrique } from './reglages-analyse';
import { Bloc, ZoneSquelette } from './squelettes';
import { Btn, Dialogue, Input, T } from './ui';

const GENRES: { key: Perimetre['genre']; label: string }[] = [
  { key: 'personne', label: 'Une personne' },
  { key: 'domaine', label: 'Un domaine' },
  { key: 'dossier', label: 'Un dossier' },
  { key: 'boite', label: 'Une boîte' },
];

/**
 * Choisir le lot de mails que le copilote analyse d'un coup : tous les mails d'une personne, d'un domaine (un prestataire),
 * d'un dossier ou d'une boîte, sur une période et dans un compte. Les mails sont cherchés chez Gmail ou Outlook (pas
 * seulement dans la réception relue), puis l'analyse en fait la synthèse et prépare les réponses.
 * `initial` : prérempli depuis le mail ouvert (sa personne) ou le dossier affiché.
 */
export function PerimetreAnalyse({ initial, onFermer, onAnalyser, onCocher }: { initial?: Partial<Perimetre>; onFermer: () => void; onAnalyser: (mails: Mail[], perimetre: string, consignes: string) => void; /** « Les mails que je coche » : la sélection dans la liste. */ onCocher: () => void }) {
  const { mails, externes, session } = useStore();
  const t = teinteCopilote();
  const d = today();
  const comptes = externes.filter((x) => x.fournisseur === 'google' || x.fournisseur === 'microsoft');
  const [genre, setGenre] = useState<Perimetre['genre']>(initial?.genre ?? 'personne');
  const [qui, setQui] = useState(initial?.qui ?? '');
  const [domaine, setDomaine] = useState(initial?.domaine ?? '');
  const [compte, setCompte] = useState(initial?.compte ?? (comptes.length === 1 ? comptes[0].id : ''));
  const [boite, setBoite] = useState(initial?.boite ?? '');
  const [dossier, setDossier] = useState(initial?.dossier);
  const [periode, setPeriode] = useState<ClePeriode>(initial?.depuis || initial?.jusqua ? 'dates' : '90j');
  const [du, setDu] = useState(initial?.depuis ?? '');
  const [au, setAu] = useState(initial?.jusqua ?? '');
  const [trouves, setTrouves] = useState<Mail[] | null>(null);
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
  const complet = !erreurPeriode && (genre === 'personne' ? !!p.qui : genre === 'domaine' ? !!p.domaine : genre === 'dossier' ? !!p.dossier : !!boite);
  const description = decrirePerimetre(genre === 'boite' ? { ...p, boite } : p, nomBoite);

  const chercher = async () => {
    if (!session?.token || !complet) return;
    enregistrerReglagesAnalyse({ consignes, nombre });
    setCherche(true);
    setMsg('');
    setTrouves(null);
    // Une boîte : le compte qui la lit. Un dossier : son compte. Sinon tous les comptes connectés (ou celui choisi).
    const cible = genre === 'boite' ? boites.find((b) => b.adresse === boite)?.compte : genre === 'dossier' ? compteDossiers : compte;
    const liste = cible ? comptes.filter((c) => c.id === cible) : comptes;
    // Une boîte entière sans période : on la borne à un an, la recherche demande au moins un critère.
    const r = requeteLot(genre === 'boite' && !p.boite && !p.depuis && !p.jusqua ? { ...p, depuis: bornesPeriode('1an', d).depuis } : p, nombre);
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
    // Chaque compte rend jusqu'à `nombre` mails : on garde les plus récents de l'ensemble.
    const tous = reunirLot(...lus, locaux).slice(0, nombre);
    setTrouves(tous);
    if (!tous.length && erreurs.length) setMsg(erreurs.join(' · '));
    setCherche(false);
  };

  const changer = (f: () => void) => {
    f();
    setTrouves(null);
  };

  return (
    <Dialogue titre="Analyser avec le copilote" onFermer={onFermer} large>
      <T small muted>
        Choisis les mails : ceux d&apos;une personne, d&apos;un prestataire (son nom de domaine), d&apos;un dossier ou d&apos;une boîte, sur la période voulue. Le copilote en fait la synthèse et prépare les réponses.
      </T>
      <Pressable accessibilityRole="button" onPress={onCocher} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
        <Text style={{ color: t.c, fontFamily: F.texteM, fontSize: 13 }}>Ou coche toi-même les mails dans la liste ›</Text>
      </Pressable>

      <Filtre label="Quels mails analyser" options={GENRES} value={genre} onChange={(g) => changer(() => setGenre(g))} />

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

      {genre === 'boite' || boites.some((b) => b.partagee) ? (
        <Rubrique titre={genre === 'boite' ? 'Boîte' : 'Dans quelle boîte'}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {genre !== 'boite' ? (
              <Puce on={!boite} onPress={() => changer(() => setBoite(''))}>
                Toutes
              </Puce>
            ) : null}
            {boites
              .filter((b) => genre === 'boite' || b.partagee)
              .map((b) => (
                <Puce key={b.adresse} on={boite === b.adresse} onPress={() => changer(() => setBoite(b.adresse))}>
                  {b.partagee ? `${nomBoite(b.adresse)} · partagée` : b.adresse}
                </Puce>
              ))}
          </View>
        </Rubrique>
      ) : null}

      {comptes.length > 1 && genre !== 'boite' ? (
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
            {erreurPeriode ? <T small style={{ color: C.agressif }}>{erreurPeriode}</T> : <T small muted>Les deux jours sont inclus. Laisse un côté vide pour ne pas limiter la période de ce côté.</T>}
          </View>
        ) : null}
      </Rubrique>

      <ChoixNombre valeur={nombre} onChange={(n) => changer(() => setNombre(n))} />
      <ChampConsignes valeur={consignes} onChange={setConsignes} />

      <View style={{ padding: 12, borderRadius: 12, backgroundColor: t.douce }}>
        <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>{erreurPeriode ?? (complet ? `Le copilote analysera ${description}, au plus ${nombre} mails.` : 'Choisis qui, quel domaine, quel dossier ou quelle boîte.')}</Text>
      </View>

      {cherche ? (
        <ZoneSquelette label="Recherche des mails">
          {[0, 1, 2].map((i) => (
            <Bloc key={i} h={44} r={10} />
          ))}
        </ZoneSquelette>
      ) : null}
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}

      {trouves ? (
        trouves.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>
              {trouves.length} mail{trouves.length > 1 ? 's' : ''} trouvé{trouves.length > 1 ? 's' : ''}
              {trouves.length >= nombre ? ` (les ${nombre} plus récents)` : ''}
            </Text>
            {trouves.slice(0, 4).map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'baseline' }}>
                <Text numberOfLines={1} style={{ width: 120, color: C.ink, fontFamily: F.texteM, fontSize: 13.5 }}>
                  {m.contact || domaineDe(m.adresse)}
                </Text>
                <Text numberOfLines={1} style={{ flex: 1, color: C.muted, fontFamily: F.texte, fontSize: 13.5 }}>
                  {m.sujet}
                </Text>
                <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{quandCourt(m, d)}</Text>
              </View>
            ))}
            {trouves.length > 4 ? <T small muted>et {trouves.length - 4} autre{trouves.length - 4 > 1 ? 's' : ''}</T> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Btn couleur={t.c} label={`Analyser ${trouves.length > 1 ? `ces ${trouves.length} mails` : 'ce mail'}`} onPress={() => (enregistrerReglagesAnalyse({ consignes: nettoyerConsignes(consignes), nombre }), onAnalyser(trouves, description, nettoyerConsignes(consignes)))} />
            </View>
          </View>
        ) : (
          <T small muted>
            Aucun mail ne correspond. Élargis la période, ou vérifie l&apos;orthographe.
          </T>
        )
      ) : (
        <View style={{ flexDirection: 'row' }}>
          <Btn couleur={t.c} label={cherche ? 'Recherche…' : 'Chercher les mails'} disabled={!complet || cherche} onPress={chercher} />
        </View>
      )}
    </Dialogue>
  );
}
