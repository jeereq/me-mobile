import * as Clipboard from 'expo-clipboard';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, useWindowDimensions, View } from 'react-native';

import { SqueletteAnnuaire } from '@/components/squelettes';
import { ActionDiscrete, Cadre, Erreur } from '@/components/cotisations-ui';
import { BadgeGroupe, Illustration } from '@/components/illustrations';
import { AvatarMembre } from '@/components/photo-profil';
import { Jauge } from '@/components/jauge';
import { Text } from '@/components/texte';
import { Btn, Dialogue, Input, T } from '@/components/ui';
import { filtresAlerte, FILTRES_VIDES, lignesConfiance, nombreFiltres, requeteAnnuaire, RYTHMES_GROUPE, texteAlerte, TRANCHES_MONTANT, TRIS, TYPES_GROUPE, type Alerte, type FiltresAnnuaire, type TriAnnuaire } from '@/lib/annuaire';
import { montantCotisation, montantTontine } from '@/lib/commun/cotisations';
import { dureeGroupe, jourMois } from '@/lib/cotisations';
import { today } from '@/lib/dates';
import { C, F } from '@/lib/theme';
import { MOTIFS, Tontines, type CarteGroupe, type MotifSignalement } from '@/lib/tontines';

/** Charge l'annuaire selon la recherche et les filtres. La liste reste visible pendant la mise à jour. */
export function useAnnuaire(charger: (requete: string) => Promise<{ groupes: CarteGroupe[] }>, actif = true, initial?: { q?: string; filtres?: FiltresAnnuaire }) {
  const [q, setQ] = useState(initial?.q ?? '');
  const [filtres, setFiltres] = useState<FiltresAnnuaire>(initial?.filtres ?? FILTRES_VIDES);
  const [groupes, setGroupes] = useState<CarteGroupe[] | null>(null);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    if (!actif) return;
    let fini = false;
    const t = setTimeout(() => {
      charger(requeteAnnuaire(q, filtres))
        .then((r) => {
          if (fini) return;
          setGroupes(r.groupes);
          setErreur('');
        })
        .catch((e: Error) => {
          if (!fini) setErreur(e.message);
        });
    }, 250);
    return () => {
      fini = true;
      clearTimeout(t);
    };
  }, [q, filtres, charger, actif]);
  return { q, setQ, filtres, setFiltres, groupes, setGroupes, erreur };
}

type Option = { key: string; label: string; groupe?: string };

/** Un filtre : la pastille montre le choix, le dialogue le change en un geste. */
function PastilleFiltre({ titre, options, valeur, onChange, tous = 'Tous' }: { titre: string; options: Option[]; valeur: string | null; onChange: (v: string | null) => void; /** Le choix par défaut, en tête de liste. */ tous?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const choisie = options.find((o) => o.key === valeur);
  const choisir = (v: string | null) => {
    onChange(v);
    setOuvert(false);
  };
  const ligne = (key: string | null, label: string, premiere?: boolean) => {
    const on = key === valeur;
    return (
      <Pressable
        key={key ?? 'tous'}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        onPress={() => choisir(key)}
        style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: premiere ? 0 : 1, borderTopColor: C.line, opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ color: on ? C.accent : C.ink, fontFamily: on ? F.texteF : F.texte, fontSize: 15 }}>{label}</Text>
        {on ? <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 15 }}>✓</Text> : null}
      </Pressable>
    );
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${titre} : ${choisie?.label ?? tous.toLowerCase()}`}
        onPress={() => setOuvert(true)}
        style={({ pressed }) => ({ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: choisie ? C.accent : C.line, backgroundColor: C.surface, opacity: pressed ? 0.7 : 1 })}>
        <Text numberOfLines={1} style={{ color: choisie ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 14 }}>
          {choisie?.label ?? titre}
        </Text>
        <Text style={{ color: choisie ? C.accent : C.muted, fontSize: 11 }}>▾</Text>
      </Pressable>
      {ouvert ? (
        <Dialogue titre={titre} onFermer={() => setOuvert(false)}>
          <View accessibilityRole="radiogroup">
            {ligne(null, tous, true)}
            {options.map((o, i) => {
              const nouveauGroupe = o.groupe && o.groupe !== options[i - 1]?.groupe;
              return nouveauGroupe && i > 0 ? (
                <View key={o.key} style={{ marginTop: 14 }}>
                  {ligne(o.key, o.label, true)}
                </View>
              ) : (
                ligne(o.key, o.label)
              );
            })}
          </View>
        </Dialogue>
      ) : null}
    </>
  );
}

/** Une pastille qui s'allume ou s'éteint. */
function PastilleBascule({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => onChange(!on)}
      style={({ pressed }) => ({ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: C.surface, opacity: pressed ? 0.7 : 1 })}>
      {on ? <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 13 }}>✓</Text> : null}
      <Text numberOfLines={1} style={{ color: on ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** La recherche, les filtres et le tri. `extra` : ce qui s'ajoute à la fin de la ligne, comme les alertes. */
export function BarreAnnuaire({ q, setQ, filtres, setFiltres, enLigne, extra }: { q: string; setQ: (v: string) => void; filtres: FiltresAnnuaire; setFiltres: (f: FiltresAnnuaire) => void; /** Sur grand écran, les pastilles passent à la ligne ; sur téléphone, elles défilent. */ enLigne?: boolean; extra?: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Input placeholder="Chercher un groupe" value={q} onChangeText={setQ} accessibilityLabel="Chercher un groupe" />
      <ScrollView
        horizontal={!enLigne}
        showsHorizontalScrollIndicator={false}
        style={enLigne ? undefined : { marginHorizontal: -16, flexGrow: 0 }}
        contentContainerStyle={{ flexDirection: 'row', flexWrap: enLigne ? 'wrap' : 'nowrap', alignItems: 'center', gap: 8, paddingHorizontal: enLigne ? 0 : 16 }}>
        <PastilleFiltre titre="Type" options={TYPES_GROUPE} valeur={filtres.mode} onChange={(v) => setFiltres({ ...filtres, mode: v as FiltresAnnuaire['mode'] })} />
        <PastilleFiltre titre="Rythme" options={RYTHMES_GROUPE} valeur={filtres.rythme} onChange={(v) => setFiltres({ ...filtres, rythme: v as FiltresAnnuaire['rythme'] })} />
        <PastilleFiltre titre="Montant" options={TRANCHES_MONTANT.map((t) => ({ key: t.key, label: t.label, groupe: t.devise }))} valeur={filtres.montant} onChange={(v) => setFiltres({ ...filtres, montant: v })} />
        <PastilleBascule label="Pas encore démarrés" on={filtres.ouverts} onChange={(v) => setFiltres({ ...filtres, ouverts: v })} />
        <PastilleFiltre titre="Trier" tous="Plus récents" options={TRIS.filter((t) => t.key !== 'recent')} valeur={filtres.tri === 'recent' ? null : filtres.tri} onChange={(v) => setFiltres({ ...filtres, tri: (v as TriAnnuaire | null) ?? 'recent' })} />
        {nombreFiltres(filtres) ? (
          <Pressable accessibilityRole="button" onPress={() => setFiltres({ ...FILTRES_VIDES, tri: filtres.tri })} hitSlop={6} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>Effacer</Text>
          </Pressable>
        ) : null}
        {extra}
      </ScrollView>
    </View>
  );
}

/** La carte d'un groupe, la même dans l'annuaire et dans mes groupes. */
export function CarteGroupeVue({ mode, gauche, nom, sous, droite, fort, couleurFort, coin, note, confiance, ratio, bas, appel, onPress, label }: {
  /** Sous l'en-tête, dans l'annuaire : ce que l'organisateur a déjà mené sur Me. */
  confiance?: string;
  mode: 'rotation' | 'objectif';
  /** À la place de l'image du groupe : le visage de l'organisateur, dans l'annuaire. */
  gauche?: ReactNode;
  nom: string;
  sous: string;
  droite?: ReactNode;
  fort: string;
  couleurFort?: string;
  /** À droite de la ligne forte : le nom du groupe garde toute la largeur. */
  coin?: ReactNode;
  /** Sous la ligne forte : ce que ça m'apporte. */
  note?: string;
  ratio: number;
  bas: string;
  /** Ce que fait la carte quand on la touche. */
  appel?: string;
  onPress?: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={(e) => ({ flex: 1, gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: onPress && (e as { hovered?: boolean }).hovered ? C.accent : C.line, backgroundColor: C.surface, opacity: e.pressed ? 0.75 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {gauche ?? <BadgeGroupe mode={mode} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 16 }}>
            {nom}
          </Text>
          <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
            {sous}
          </Text>
        </View>
        {droite}
      </View>
      {confiance ? (
        <Text numberOfLines={1} style={{ color: C.coach, fontFamily: F.texteM, fontSize: 13 }}>
          ✓ {confiance}
        </Text>
      ) : null}
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, color: couleurFort ?? C.ink, fontFamily: F.chiffre, fontSize: 19 }}>
            {fort}
          </Text>
          {coin}
        </View>
        {note ? (
          <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
            {note}
          </Text>
        ) : null}
      </View>
      <View style={{ gap: 5 }}>
        <Jauge ratio={ratio} hauteur={4} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>
            {bas}
          </Text>
          {appel ? <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 14 }}>{appel} ›</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Un groupe de l'annuaire : son nom, combien il coûte et ce qu'il reste de places. */
function CarteAnnuaire({ g, etat, onPress }: { g: CarteGroupe; etat?: ReactNode; onPress?: () => void }) {
  const libres = Math.max(0, g.places - g.inscrits);
  const type = g.mode === 'objectif' ? g.raison || 'Raison précise' : 'Chacun son tour';
  const places = `${libres} place${libres > 1 ? 's' : ''} libre${libres > 1 ? 's' : ''}`;
  const fort = montantTontine(g.montant, g.devise, g.rythme);
  const duree = dureeGroupe(g);
  const note = g.mode === 'objectif' ? [g.beneficiaireNom ? `Pour ${g.beneficiaireNom}` : '', g.dateFin ? `jusqu’au ${jourMois(g.dateFin, today())}` : ''].filter(Boolean).join(', ') : `Tu reçois ${montantCotisation(g.net, g.devise)}${duree ? `, sur ${duree}` : ''}`;
  return <CarteGroupeVue confiance={lignesConfiance(g.confiance)[0]} mode={g.mode} gauche={g.organisateur ? <AvatarMembre nom={g.organisateur} photo={g.organisateurPhoto} taille={44} /> : undefined} nom={g.nom} sous={g.organisateur ? `Par ${g.organisateur}, ${type.toLowerCase()}` : type} droite={etat} fort={fort} note={note} ratio={g.places ? g.inscrits / g.places : 0} bas={`${places} sur ${g.places}`} appel={onPress ? 'Rejoindre' : undefined} onPress={onPress} label={`${g.nom}, ${fort}, ${note}, ${places}`} />;
}

/** Une carte par ligne sur téléphone, deux ou trois sur grand écran. */
export function GrilleCartes({ colonnes, children }: { colonnes?: number; children: ReactNode[] }) {
  const largeur = useWindowDimensions().width;
  const n = colonnes ?? (largeur >= 720 ? 2 : 1);
  const base = n === 3 ? '31%' : n === 2 ? '48%' : '100%';
  const vides = n > 1 ? (n - (children.length % n)) % n : 0;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {children.map((c, i) => (
        <View key={i} style={{ flexBasis: base, flexGrow: 1, minWidth: 0 }}>
          {c}
        </View>
      ))}
      {Array.from({ length: vides }, (_, i) => (
        <View key={`v${i}`} style={{ flexBasis: base, flexGrow: 1 }} />
      ))}
    </View>
  );
}

/** Le résultat : le nombre de groupes, les cartes (deux colonnes sur grand écran) ou ce qu'il reste à faire. */
export function ListeAnnuaire({ colonnes, groupes, erreur, filtres, onEffacer, etat, onChoisir }: {
  /** Par défaut : deux colonnes sur grand écran. */
  colonnes?: number;
  groupes: CarteGroupe[] | null;
  erreur?: string;
  filtres: FiltresAnnuaire;
  onEffacer: () => void;
  etat?: (g: CarteGroupe) => ReactNode;
  onChoisir?: (g: CarteGroupe) => (() => void) | undefined;
}) {
  const largeur = useWindowDimensions().width;
  const n = colonnes ?? (largeur >= 720 ? 2 : 1);
  if (erreur && !groupes) return <Erreur texte={erreur} />;
  if (!groupes) return <SqueletteAnnuaire colonnes={n} />;
  if (!groupes.length)
    return (
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
        <Illustration nom="annuaire" largeur={150} />
        {nombreFiltres(filtres) ? (
          <>
            <T muted>Aucun groupe avec ces filtres.</T>
            <Btn kind="sec" label="Effacer les filtres" onPress={onEffacer} />
          </>
        ) : (
          <T muted>Aucun groupe ouvert.</T>
        )}
      </View>
    );
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>
        {groupes.length} groupe{groupes.length > 1 ? 's' : ''}
      </Text>
      {erreur ? <Erreur texte={erreur} /> : null}
      <GrilleCartes colonnes={n}>
        {groupes.map((g) => (
          <CarteAnnuaire key={g.id} g={g} etat={etat?.(g)} onPress={onChoisir?.(g)} />
        ))}
      </GrilleCartes>
    </View>
  );
}

/** Ce que Me sait de l'organisateur, en clair. */
export function BlocConfiance({ g }: { g: CarteGroupe }) {
  const lignes = lignesConfiance(g.confiance);
  if (!lignes.length) return null;
  return (
    <Cadre>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {g.organisateur ? <AvatarMembre nom={g.organisateur} photo={g.organisateurPhoto} taille={40} /> : null}
        <Text style={{ flex: 1, color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>Organisé par {g.organisateur || 'un membre de Me'}</Text>
      </View>
      <View style={{ gap: 4 }}>
        {lignes.map((l) => (
          <Text key={l} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
            ✓ {l}
          </Text>
        ))}
      </View>
    </Cadre>
  );
}

/** Partager le lien du groupe : le menu du téléphone, WhatsApp, ou le lien copié. */
export function PartagerGroupe({ g }: { g: CarteGroupe }) {
  const [info, setInfo] = useState('');
  if (!g.lien) return null;
  const lien = g.lien;
  const texte = `${g.nom} : ${montantTontine(g.montant, g.devise, g.rythme)}. Rejoins le groupe sur Me : ${lien}`;
  const copier = () =>
    Clipboard.setStringAsync(lien)
      .then(() => setInfo('Lien copié.'))
      .catch(() => setInfo(lien));
  const partager = () => {
    const nav = Platform.OS === 'web' && typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> }) : null;
    if (nav && !nav.share) return copier();
    const envoi = nav?.share ? nav.share({ title: g.nom, text: `${g.nom} : ${montantTontine(g.montant, g.devise, g.rythme)}`, url: lien }) : Share.share({ message: texte, url: lien, title: g.nom });
    Promise.resolve(envoi).catch(() => {});
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn small kind="sec" label="Partager" onPress={partager} />
        <Btn small kind="sec" label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(texte)}`).catch(() => {})} />
        <Btn small kind="sec" label="Copier le lien" onPress={copier} />
      </View>
      {info ? (
        <T small muted>
          {info}
        </T>
      ) : null}
    </View>
  );
}

/** Signaler un groupe à l'équipe de Me. L'organisateur ne sait pas qui l'a signalé. */
export function SignalerGroupe({ g }: { g: CarteGroupe }) {
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState<MotifSignalement | null>(null);
  const [texte, setTexte] = useState('');
  const [etat, setEtat] = useState<'' | 'envoi' | 'fait'>('');
  const [erreur, setErreur] = useState('');
  const envoyer = () => {
    if (!motif) return;
    setEtat('envoi');
    setErreur('');
    Tontines.signaler(g.id, motif, texte.trim() || undefined)
      .then(() => setEtat('fait'))
      .catch((e: Error) => {
        setEtat('');
        setErreur(e.message);
      });
  };
  return (
    <>
      <ActionDiscrete label={etat === 'fait' ? 'Signalement envoyé' : 'Signaler ce groupe'} onPress={() => (etat === 'fait' ? undefined : setOuvert(true))} />
      {ouvert ? (
        <Dialogue titre="Signaler ce groupe" onFermer={() => setOuvert(false)}>
          {etat === 'fait' ? (
            <>
              <T>Merci. L’équipe de Me va vérifier ce groupe. L’organisateur ne saura pas que c’est toi.</T>
              <Btn label="Fermer" onPress={() => setOuvert(false)} />
            </>
          ) : (
            <>
              <View accessibilityRole="radiogroup" accessibilityLabel="Ce qui ne va pas" style={{ gap: 8 }}>
                {MOTIFS.map((m) => {
                  const on = motif === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => setMotif(m.key)}
                      style={({ pressed }) => ({ minHeight: 56, justifyContent: 'center', gap: 2, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: on ? 2 : 1, borderColor: on ? C.accent : C.line, backgroundColor: C.surface, opacity: pressed ? 0.75 : 1 })}>
                      <Text style={{ color: on ? C.accent : C.ink, fontFamily: F.texteF, fontSize: 15 }}>{m.titre}</Text>
                      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>{m.sous}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Input label="Détails (facultatif)" value={texte} onChangeText={setTexte} multiline maxLength={500} />
              {erreur ? <Erreur texte={erreur} /> : null}
              <Btn label="Envoyer le signalement" disabled={!motif || etat === 'envoi'} onPress={envoyer} />
            </>
          )}
        </Dialogue>
      ) : null}
    </>
  );
}

/** Être prévenu des nouveaux groupes qui répondent à ma recherche, et gérer mes alertes. */
export function AlertesAnnuaire({ q, filtres }: { q: string; filtres: FiltresAnnuaire }) {
  const [alertes, setAlertes] = useState<Alerte[] | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState('');
  useEffect(() => {
    let fini = false;
    Tontines.alertes()
      .then((r) => {
        if (!fini) setAlertes(r.alertes);
      })
      .catch(() => {
        if (!fini) setAlertes([]);
      });
    return () => {
      fini = true;
    };
  }, []);
  const actuelle = filtresAlerte(q, filtres);
  const cle = texteAlerte(actuelle);
  const deja = !!alertes?.some((a) => texteAlerte(a.filtres) === cle);
  const agir = (p: Promise<{ alertes: Alerte[] }>) =>
    p
      .then((r) => {
        setAlertes(r.alertes ?? []);
        setErreur('');
      })
      .catch((e: Error) => setErreur(e.message));
  if (!alertes) return null;
  return (
    <>
      <PastilleBascule label={deja ? 'Alerte active' : 'Me prévenir'} on={deja} onChange={() => (deja ? setOuvert(true) : agir(Tontines.creerAlerte(actuelle)).then(() => setOuvert(true)))} />
      {ouvert ? (
        <Dialogue titre="Mes alertes" onFermer={() => setOuvert(false)}>
          <T small muted>
            Me te prévient quand un nouveau groupe y correspond.
          </T>
          {alertes.map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, borderTopWidth: 1, borderTopColor: C.line }}>
              <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 15 }}>{texteAlerte(a.filtres)}</Text>
              <Btn small kind="sec" label="Supprimer" onPress={() => agir(Tontines.supprimerAlerte(a.id))} />
            </View>
          ))}
          {!alertes.length ? <T muted>Aucune alerte.</T> : null}
          {erreur ? <Erreur texte={erreur} /> : null}
          {!deja && alertes.length < 5 ? <Btn label={`Ajouter : ${cle}`} onPress={() => agir(Tontines.creerAlerte(actuelle))} /> : null}
        </Dialogue>
      ) : null}
    </>
  );
}

