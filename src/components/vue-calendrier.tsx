import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { bornesMois, evenementsEntre, evtsDuMembre, GENRES, GENRES_CONFIES, joursDeSemaine, parJour, resumeJour, TOUS_GENRES, type Evt, type GenreEvt } from '@/lib/calendrier-global';
import { addDays, decalerMois, fmtLong, grilleMois, parse, today, uid } from '@/lib/dates';
import { fmtDevise } from '@/lib/devises';
import { elementsDePlan, responsableDe, type FiltreMembre } from '@/lib/equipe-taches';
import { financesDe } from '@/lib/finances';
import { useActions } from '@/lib/actions';
import { useStore } from '@/lib/store';
import { evenementDeAgenda } from '@/lib/externe';
import { avecAgendaPerso, estAgendaPerso } from '@/lib/agenda-perso';
import { estRdvLocal } from '@/lib/rdv-equipe';
import { teinteDe, vive, type Vive } from '@/lib/teinte';
import { alpha, C, F } from '@/lib/theme';

import { Btn, Check, Empty, Input, Panel, tap } from './ui';
import { SousOnglets } from './onglets';
import { Limitee, Pliable } from './pliable';
import { DetailTache } from './detail-tache';
import { PlanningEquipe } from './planning-equipe';
import { comptesAgenda, FormRendezvous } from './rendezvous';
import { FormRdvEquipe } from './rdv-equipe';
import { FiltreMembres } from './responsable';

/**
 * Le calendrier de Me : tout ce qui a une date, en mois, en semaine ou en jour.
 * Les événements viennent de `calendrier-global.ts` ; ici, seulement l'affichage et quelques gestes
 * (cocher une tâche, une relance ou l'habitude du jour, ajouter une tâche à un jour).
 */

const COULEUR_GENRE: Record<GenreEvt, Vive> = {
  agenda: 'lagon',
  tache: 'ambre',
  projet: 'rose',
  relance: 'corail',
  habitude: 'menthe',
  depense: 'indigo',
  revenu: 'citron',
  recurrent: 'indigo',
  budget: 'lilas',
  objectif: 'lilas',
};
const couleurGenre = (g: GenreEvt) => vive(COULEUR_GENRE[g]);
const emojiGenre = (g: GenreEvt) => GENRES.find((x) => x.key === g)!.emoji;
const labelGenre = (g: GenreEvt) => GENRES.find((x) => x.key === g)!.label;

/** Genres repliés d'emblée dans le détail d'un jour quand ils sont nombreux. */
const REPLIES = new Set<GenreEvt>(['depense', 'recurrent', 'budget']);
const JOURS_COURTS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const nomMois = (mois: string) => cap(parse(`${mois}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
const jourCourt = (d: string) => parse(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const plageSemaine = (d: string) => {
  const j = joursDeSemaine(d);
  const a = parse(j[0]);
  const z = parse(j[6]);
  const m = (x: Date) => x.toLocaleDateString('fr-FR', { month: 'short' });
  return a.getMonth() === z.getMonth() ? `${a.getDate()} – ${z.getDate()} ${m(z)} ${z.getFullYear()}` : `${a.getDate()} ${m(a)} – ${z.getDate()} ${m(z)} ${z.getFullYear()}`;
};

type Vue = 'mois' | 'semaine' | 'jour' | 'equipe';

export function VueCalendrier({ dateInitiale }: { dateInitiale?: string }) {
  const { espace, equipeActive, session, agendaPerso } = useStore();
  const largeur = useWindowDimensions().width;
  const deux = largeur >= 1150;
  const large = largeur >= 700;
  const aujourdhui = today();
  const [vue, setVue] = useState<Vue>('mois');
  const [ancre, setAncre] = useState(dateInitiale && /^\d{4}-\d{2}-\d{2}$/.test(dateInitiale) ? dateInitiale : aujourdhui);
  const [genres, setGenres] = useState<Set<GenreEvt>>(() => new Set(TOUS_GENRES));
  const devise = financesDe(espace).devise;
  // Dans une équipe : le calendrier d'un membre, ou de personne (les tâches sans responsable).
  const [membre, setMembre] = useState<FiltreMembre>('tous');
  const membres = equipeActive?.membres ?? [];
  const moi = session?.user.id;
  const filtreMembre: FiltreMembre = equipeActive ? membre : 'tous';
  const elements = useMemo(() => (equipeActive ? elementsDePlan(espace, aujourdhui) : []), [equipeActive, espace, aujourdhui]);

  const mois = ancre.slice(0, 7);

  // Tous les genres d'abord, pour que les compteurs des filtres ne dépendent pas de ce qui est coché.
  const tout = useMemo(() => {
    const plage = vue === 'mois' || vue === 'equipe' ? bornesMois(ancre.slice(0, 7)) : vue === 'semaine' ? { debut: joursDeSemaine(ancre)[0], fin: joursDeSemaine(ancre)[6] } : { debut: ancre, fin: ancre };
    // Dans une équipe, mon agenda personnel s'ajoute pour moi seul, sans entrer dans l'espace partagé.
    const vu = equipeActive ? { ...espace, agenda: avecAgendaPerso(espace.agenda, agendaPerso) } : espace;
    return evenementsEntre(vu, plage.debut, plage.fin, aujourdhui);
  }, [espace, equipeActive, agendaPerso, vue, ancre, aujourdhui]);
  const compte = useMemo(() => {
    const m = new Map<GenreEvt, number>();
    for (const x of tout) m.set(x.genre, (m.get(x.genre) || 0) + 1);
    return m;
  }, [tout]);
  const evts = useMemo(() => {
    const deGenres = genres.size === TOUS_GENRES.length ? tout : tout.filter((x) => genres.has(x.genre));
    return evtsDuMembre(deGenres, filtreMembre, membres, moi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tout, genres, filtreMembre, equipeActive, moi]);
  const jours = useMemo(() => parJour(evts), [evts]);

  const aller = (n: number) => {
    tap();
    if (vue === 'mois') {
      const m = decalerMois(mois, n);
      setAncre(m === aujourdhui.slice(0, 7) ? aujourdhui : `${m}-01`);
    } else setAncre(addDays(ancre, vue === 'semaine' ? 7 * n : n));
  };
  const titre = vue === 'mois' ? nomMois(mois) : vue === 'semaine' ? plageSemaine(ancre) : cap(fmtLong(parse(ancre)));
  const surAujourdhui = vue === 'mois' ? mois === aujourdhui.slice(0, 7) && ancre === aujourdhui : vue === 'semaine' ? joursDeSemaine(ancre).includes(aujourdhui) : ancre === aujourdhui;

  const basculer = (g: GenreEvt) => {
    tap();
    const s = new Set(genres);
    if (s.has(g)) s.delete(g);
    else s.add(g);
    // Tout décocher ne montrerait rien : on revient à tout.
    setGenres(s.size ? s : new Set(TOUS_GENRES));
  };
  const seulement = (g: GenreEvt) => setGenres(genres.size === 1 && genres.has(g) ? new Set(TOUS_GENRES) : new Set([g]));

  const choisirJour = (d: string) => {
    tap();
    setAncre(d);
  };
  const detail = (
    <JourDetail date={ancre} evts={jours.get(ancre) ?? []} devise={devise} aujourdhui={aujourdhui} titreCourt={vue === 'jour'} />
  );

  const onglets = (
    <SousOnglets<Vue>
      label="Affichage du calendrier"
      options={[
        { key: 'mois', label: 'Mois' },
        { key: 'semaine', label: 'Semaine' },
        { key: 'jour', label: 'Jour' },
        ...(equipeActive ? [{ key: 'equipe' as const, label: 'Équipe' }] : []),
      ]}
      value={vue}
      onChange={setVue}
    />
  );
  // Le planning de l'équipe : les tâches et échéances de chaque membre, sans la grille des jours.
  if (vue === 'equipe' && equipeActive)
    return (
      <View style={{ gap: 12 }}>
        {onglets}
        <PlanningEquipe />
      </View>
    );

  return (
    <View style={{ gap: 12 }}>
      {onglets}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Fleche label="Précédent" glyph="‹" onPress={() => aller(-1)} />
        <Pressable accessibilityRole="button" accessibilityLabel={`${titre}. Revenir à aujourd'hui`} disabled={surAujourdhui} onPress={() => setAncre(aujourdhui)} style={{ flex: 1, alignItems: 'center' }}>
          <Text accessibilityRole="header" numberOfLines={1} style={{ color: C.ink, fontFamily: F.titreM, fontSize: 17 }}>
            {titre}
          </Text>
          {!surAujourdhui ? <Text style={{ color: teinteDe('/calendrier'), fontFamily: F.texteM, fontSize: 12 }}>Revenir à aujourd'hui</Text> : null}
        </Pressable>
        <Fleche label="Suivant" glyph="›" onPress={() => aller(1)} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Ce que montre le calendrier" contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
        {GENRES.map((g) => {
          const on = genres.has(g.key);
          const couleur = couleurGenre(g.key);
          const n = compte.get(g.key) || 0;
          return (
            <Pressable
              key={g.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${g.label}, ${n} sur cette période`}
              onPress={() => basculer(g.key)}
              onLongPress={() => seulement(g.key)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? alpha(couleur, 0.55) : C.line, backgroundColor: on ? alpha(couleur, C.sombre ? 0.16 : 0.1) : 'transparent', opacity: pressed ? 0.7 : on ? 1 : 0.55 })}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: couleur }} />
              <Text style={{ color: on ? C.ink : C.muted, fontFamily: F.texteM, fontSize: 13 }}>
                {g.emoji} {g.label}
              </Text>
              {n ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{n}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <FiltreMembres elements={elements} value={membre} onChange={setMembre} />

      {vue === 'mois' ? (
        deux ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
            <View style={{ flex: 2 }}>
              <GrilleMois mois={mois} jours={jours} choisi={ancre} aujourdhui={aujourdhui} large={large} onChoisir={choisirJour} />
            </View>
            <View style={{ flex: 1 }}>{detail}</View>
          </View>
        ) : (
          <>
            <GrilleMois mois={mois} jours={jours} choisi={ancre} aujourdhui={aujourdhui} large={large} onChoisir={choisirJour} />
            {detail}
          </>
        )
      ) : null}

      {vue === 'semaine' ? <Semaine jours={jours} depart={ancre} aujourdhui={aujourdhui} devise={devise} colonnes={largeur >= 900} onChoisir={(d) => (setAncre(d), setVue('jour'))} /> : null}

      {vue === 'jour' ? detail : null}

      {!evts.length && vue !== 'jour' ? <Empty icone="vide">{genres.size < TOUS_GENRES.length ? 'Rien de ce que tu as choisi de montrer sur cette période.' : 'Rien de prévu sur cette période.'}</Empty> : null}
      <Legende />
    </View>
  );
}

function Fleche({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: C.ink, fontSize: 22, lineHeight: 24 }}>{glyph}</Text>
    </Pressable>
  );
}

function Legende() {
  return <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12, lineHeight: 17 }}>Touche un jour pour le détail. Appui long sur un filtre : ne montrer que celui-là.</Text>;
}

/* ---------- Mois ---------- */

function GrilleMois({ mois, jours, choisi, aujourdhui, large, onChoisir }: { mois: string; jours: Map<string, Evt[]>; choisi: string; aujourdhui: string; large: boolean; onChoisir: (d: string) => void }) {
  const cases = grilleMois(mois);
  const lignes: (string | null)[][] = [];
  for (let i = 0; i < cases.length; i += 7) lignes.push(cases.slice(i, i + 7));
  return (
    <View accessibilityRole="grid" style={{ borderWidth: 1, borderColor: C.line, borderRadius: 14, overflow: 'hidden', backgroundColor: C.surface }}>
      <View style={{ flexDirection: 'row', backgroundColor: C.sunk, borderBottomWidth: 1, borderBottomColor: C.line }}>
        {JOURS_COURTS.map((j) => (
          <Text key={j} style={{ flex: 1, textAlign: 'center', paddingVertical: 7, color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>
            {large ? j : j.charAt(0).toUpperCase()}
          </Text>
        ))}
      </View>
      {lignes.map((ligne, i) => (
        <View key={i} style={{ flexDirection: 'row', borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
          {ligne.map((d, k) => (
            <CaseJour key={d ?? `v${i}${k}`} date={d} evts={d ? (jours.get(d) ?? []).filter((x) => !x.quotidien) : []} choisi={d === choisi} aujourdhui={d === aujourdhui} large={large} fin={k === 6} onPress={d ? () => onChoisir(d) : undefined} />
          ))}
        </View>
      ))}
    </View>
  );
}

function CaseJour({ date, evts, choisi, aujourdhui, large, fin, onPress }: { date: string | null; evts: Evt[]; choisi: boolean; aujourdhui: boolean; large: boolean; fin: boolean; onPress?: () => void }) {
  const accent = teinteDe('/calendrier');
  const base = { flex: 1, minHeight: large ? 104 : 58, borderRightWidth: fin ? 0 : 1, borderRightColor: C.line, padding: large ? 6 : 4, gap: 4 } as const;
  if (!date) return <View style={[base, { backgroundColor: C.sunk, opacity: 0.5 }]} />;
  const n = parse(date).getDate();
  const genres = TOUS_GENRES.filter((g) => evts.some((x) => x.genre === g));
  const attention = evts.some((x) => x.retard && !x.fait);
  const reste = evts.filter((x) => !x.fait && x.ref).length;
  const resume = `${evts.length ? `${evts.length} événement${evts.length > 1 ? 's' : ''}` : 'rien de prévu'}${attention ? ', du retard' : ''}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: choisi }}
      accessibilityLabel={`${jourCourt(date)}${aujourdhui ? ", aujourd'hui" : ''} : ${resume}`}
      onPress={onPress}
      style={({ pressed }) => [base, { backgroundColor: choisi ? alpha(accent, C.sombre ? 0.16 : 0.1) : 'transparent', opacity: pressed ? 0.75 : 1 }]}>
      {choisi ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: 2, borderColor: accent }} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: aujourdhui ? accent : 'transparent' }}>
          <Text style={{ color: aujourdhui ? '#FFFFFF' : C.ink, fontFamily: aujourdhui ? F.texteF : F.texte, fontSize: 13 }}>{n}</Text>
        </View>
        {attention ? <View accessibilityElementsHidden style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.agressif }} /> : null}
      </View>
      {large ? (
        <View style={{ gap: 2 }}>
          {evts.slice(0, 3).map((x) => (
            <View key={x.cle} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: alpha(couleurGenre(x.genre), C.sombre ? 0.18 : 0.12) }}>
              <Text numberOfLines={1} style={{ flex: 1, color: x.fait ? C.muted : C.ink, fontFamily: F.texte, fontSize: 11, textDecorationLine: x.fait && x.ref ? 'line-through' : 'none' }}>
                {x.heure ? `${x.heure} ` : ''}
                {x.titre}
              </Text>
            </View>
          ))}
          {evts.length > 3 ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 11, paddingLeft: 4 }}>+{evts.length - 3} autres</Text> : null}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, paddingHorizontal: 1 }}>
          {genres.slice(0, 5).map((g) => (
            <View key={g} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: couleurGenre(g) }} />
          ))}
          {reste > 0 && genres.length === 0 ? <Text style={{ color: C.muted, fontSize: 10 }}>{reste}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

/* ---------- Semaine ---------- */

function Semaine({ jours, depart, aujourdhui, devise, colonnes, onChoisir }: { jours: Map<string, Evt[]>; depart: string; aujourdhui: string; devise: string; colonnes: boolean; onChoisir: (d: string) => void }) {
  const sept = joursDeSemaine(depart);
  // Une habitude de chaque jour reviendrait dans les sept cartes : elle reste dans la vue du jour.
  const du = (d: string) => (jours.get(d) ?? []).filter((x) => !x.quotidien);
  const quotidiennes = new Set(sept.flatMap((d) => (jours.get(d) ?? []).filter((x) => x.quotidien).map((x) => x.titre))).size;
  const note = quotidiennes ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>🔁 {quotidiennes} habitude{quotidiennes > 1 ? 's' : ''} de chaque jour : à retrouver dans la vue Jour.</Text> : null;
  if (colonnes)
    return (
      <View style={{ gap: 8 }}>
      {note}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'stretch' }}>
        {sept.map((d) => {
          const l = du(d);
          const auj = d === aujourdhui;
          const accent = teinteDe('/calendrier');
          return (
            <View key={d} style={{ flex: 1, minWidth: 0, borderWidth: 1, borderColor: auj ? accent : C.line, borderRadius: 14, backgroundColor: C.surface, overflow: 'hidden' }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Voir ${jourCourt(d)} en détail`} onPress={() => onChoisir(d)} style={{ padding: 8, backgroundColor: auj ? alpha(accent, 0.14) : C.sunk }}>
                <Text style={{ color: auj ? accent : C.ink, fontFamily: F.texteF, fontSize: 13 }}>{cap(jourCourt(d))}</Text>
              </Pressable>
              <View style={{ padding: 6, gap: 6, minHeight: 120 }}>
                {l.length ? l.map((x) => <LigneEvt key={x.cle} x={x} devise={devise} aujourdhui={aujourdhui} compact />) : <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>Rien de prévu</Text>}
              </View>
            </View>
          );
        })}
      </View>
      </View>
    );
  // Sur téléphone : un jour chargé garde sa carte (quatre lignes, puis « Voir plus »), un jour libre tient sur une ligne.
  return (
    <View style={{ gap: 8 }}>
      {note}
      {sept.map((d) => {
        const l = du(d);
        if (!l.length)
          return (
            <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${jourCourt(d)} : rien de prévu. Voir en détail`} onPress={() => onChoisir(d)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: d === aujourdhui ? teinteDe('/calendrier') : C.line, backgroundColor: C.sunk, opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ color: d === aujourdhui ? teinteDe('/calendrier') : C.muted, fontFamily: F.texteM, fontSize: 14 }}>{cap(jourCourt(d))}</Text>
              <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>Rien de prévu</Text>
            </Pressable>
          );
        return (
          <Panel key={d} title={cap(jourCourt(d))} count={l.length} accent={d === aujourdhui} right={<Btn small kind="sec" label="Détail" onPress={() => onChoisir(d)} />}>
            <Limitee items={l} n={4} nom="événements" rendu={(x) => <LigneEvt key={x.cle} x={x} devise={devise} aujourdhui={aujourdhui} />} />
          </Panel>
        );
      })}
    </View>
  );
}

/* ---------- Un jour ---------- */

function JourDetail({ date, evts, devise, aujourdhui, titreCourt }: { date: string; evts: Evt[]; devise: string; aujourdhui: string; titreCourt: boolean }) {
  const r = resumeJour(evts);
  const titre = titreCourt ? 'Programme du jour' : cap(fmtLong(parse(date)));
  // Groupés par genre, dans l'ordre des filtres : on retrouve vite les tâches, puis l'argent.
  const groupes = r.genres.map((g) => ({ ...g, liste: evts.filter((x) => x.genre === g.genre) }));
  return (
    <Panel title={titre} count={r.total || undefined} accent={date === aujourdhui}>
      {r.total ? (
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, lineHeight: 19 }}>
          {[r.aFaire ? `${r.aFaire} à faire` : 'Rien à cocher', r.depenses ? `dépensé ${fmtDevise(r.depenses, devise)}` : '', r.revenus ? `reçu ${fmtDevise(r.revenus, devise)}` : ''].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      {groupes.map((g) => (
        // L'argent (dépenses, récurrents, budgets) reste replié quand il est abondant : un appui l'ouvre.
        <Pliable key={g.genre} titre={`${emojiGenre(g.genre)} ${labelGenre(g.genre)}`} count={g.liste.length} couleur={couleurGenre(g.genre)} ouvert={!REPLIES.has(g.genre) || g.liste.length <= 2}>
          <Limitee items={g.liste} n={6} nom="éléments" rendu={(x) => <LigneEvt key={x.cle} x={x} devise={devise} aujourdhui={aujourdhui} groupe />} />
        </Pliable>
      ))}
      {!r.total ? <Empty icone="vide">Rien de prévu ce jour-là.</Empty> : null}
      <AjoutTache date={date} />
    </Panel>
  );
}

/** Une tâche à faire ce jour-là, en une ligne. */
function AjoutTache({ date }: { date: string }) {
  const { config } = useStore();
  const { ajouter } = useActions();
  const [titre, setTitre] = useState('');
  const [ouvert, setOuvert] = useState(false);
  const enregistrer = () => {
    if (!titre.trim()) return;
    ajouter('tache', { id: uid(), titre: titre.trim(), source: 'manuel', priorite: 'moyenne', echeance: date, statut: 'en_attente', faitLe: null, mode: config.defauts.tache, creeLe: new Date().toISOString() });
    setTitre('');
    setOuvert(false);
  };
  if (!ouvert)
    return (
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <Btn small kind="sec" label="+ Tâche ce jour" onPress={() => setOuvert(true)} />
        <AjoutRendezvous date={date} />
      </View>
    );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
      <View style={{ flex: 1, minWidth: 180 }}>
        <Input label="Ajouter une tâche pour ce jour" value={titre} onChangeText={(v: string) => setTitre(v)} placeholder="Ex. Appeler le comptable" returnKeyType="done" onSubmitEditing={enregistrer} autoFocus />
      </View>
      <Btn small label="Ajouter" onPress={enregistrer} disabled={!titre.trim()} />
      <Btn small kind="sec" label="Annuler" onPress={() => setOuvert(false)} />
    </View>
  );
}

/**
 * Un rendez-vous pour ce jour-là. Dans une équipe : créé dans Me, confié à un membre. Sinon : écrit dans l'un des agendas
 * connectés.
 */
function AjoutRendezvous({ date }: { date: string }) {
  const { externes, equipeActive, lectureSeule } = useStore();
  const [ouvert, setOuvert] = useState(false);
  if (equipeActive ? lectureSeule : !comptesAgenda(externes).length) return null;
  return (
    <>
      <Btn small kind="sec" label="+ Rendez-vous" onPress={() => setOuvert(true)} />
      {ouvert ? equipeActive ? <FormRdvEquipe date={date} onFermer={() => setOuvert(false)} /> : <FormRendezvous date={date} onFermer={() => setOuvert(false)} /> : null}
    </>
  );
}

/* ---------- Une ligne ---------- */

function LigneEvt({ x, devise, aujourdhui, compact, groupe }: { x: Evt; devise: string; aujourdhui: string; compact?: boolean; /** La ligne est déjà sous le titre de son genre : pas besoin de répéter l'icône. */ groupe?: boolean }) {
  const { espace, equipeActive, lectureSeule, session } = useStore();
  const [modifier, setModifier] = useState(false);
  const [detail, setDetail] = useState(false);
  // Un rendez-vous venu d'un compte connecté se modifie dans son agenda, depuis Me.
  const modifiable = x.genre === 'agenda' && !!x.evenement?.id && !!evenementDeAgenda(x.evenement.id);
  // Un rendez-vous créé dans Me, dans l'agenda d'une équipe : on le modifie ici (sauf en lecture seule).
  const modifiableEquipe = x.genre === 'agenda' && !!equipeActive && !lectureSeule && estRdvLocal(x.evenement?.id);
  const { basculerTache, basculerRelance, basculerHabitude } = useActions();
  const couleur = couleurGenre(x.genre);
  // Une habitude se coche pour aujourd'hui seulement (comme dans l'écran Habitudes).
  const cochable = !!x.ref && (x.ref.type !== 'habitude' || x.date === aujourdhui);
  const cocher = () => {
    if (!x.ref) return;
    if (x.ref.type === 'tache') {
      const t = espace.taches.find((y) => y.id === x.ref!.id);
      if (t) basculerTache(t);
    } else if (x.ref.type === 'relance') {
      const r = espace.relances.find((y) => y.id === x.ref!.id);
      if (r) basculerRelance(r);
    } else {
      const h = espace.habitudes.find((y) => y.id === x.ref!.id);
      if (h) basculerHabitude(h);
    }
  };
  const ouvrir = () => {
    tap();
    // Une tâche s'ouvre en détail (responsable, note, mail d'origine) ; le reste va à son écran.
    if (x.ref?.type === 'tache') return setDetail(true);
    if (modifiableEquipe) return setModifier(true);
    router.push({ pathname: x.lien.chemin, params: x.lien.params } as never);
  };
  const signe = x.genre === 'depense' || x.genre === 'revenu' || x.genre === 'recurrent' ? (x.sens === 'entree' ? '+' : '−') : '';
  const montant = x.montant != null ? `${signe}${fmtDevise(x.montant, devise)}` : '';
  // Dans une équipe, la ligne d'une tâche, d'une relance ou d'un rendez-vous dit à qui elle est.
  const confie = !!equipeActive && GENRES_CONFIES.includes(x.genre) && !(x.genre === 'agenda' && !estRdvLocal(x.evenement?.id));
  const resp = confie ? responsableDe(x, equipeActive!.membres, session?.user.id) : null;
  const perso = !!equipeActive && x.genre === 'agenda' && estAgendaPerso(x.evenement?.id);
  const qui = confie ? (resp ? (resp.moi ? 'Moi' : resp.nom) : x.genre === 'agenda' ? 'Non affecté' : 'Non affectée') : perso ? 'Mon agenda, visible par moi seul' : '';
  const sousTitre = [x.heure, x.bloque ? 'Attend une tâche' : x.retard ? 'En retard' : '', qui && `👤 ${qui}`, x.detail].filter(Boolean).join(' · ');
  const barre = x.retard && !x.fait ? C.agressif : couleur;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 6 : 10 }}>
      <View style={{ width: 4, alignSelf: 'stretch', minHeight: compact ? 26 : 34, borderRadius: 2, backgroundColor: barre }} />
      {cochable && !compact ? <Check checked={!!x.fait} onToggle={cocher} label={`${x.fait ? 'Rouvrir' : 'Terminer'} ${x.titre}`} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`${x.titre}${sousTitre ? `, ${sousTitre}` : ''}${montant ? `, ${montant}` : ''}. Ouvrir`} onPress={ouvrir} style={({ pressed }) => ({ flex: 1, minWidth: 0, paddingVertical: compact ? 2 : 4, opacity: pressed ? 0.7 : 1 })}>
        <Text numberOfLines={compact ? 2 : 3} style={{ color: x.fait && x.ref ? C.muted : C.ink, fontFamily: F.texteM, fontSize: compact ? 12 : 15, textDecorationLine: x.fait && x.ref ? 'line-through' : 'none' }}>
          {compact || groupe ? '' : `${emojiGenre(x.genre)} `}
          {x.titre}
        </Text>
        {sousTitre ? (
          <Text numberOfLines={compact ? 1 : 2} style={{ color: x.retard && !x.fait ? C.agressif : C.muted, fontFamily: F.texte, fontSize: compact ? 11 : 12 }}>
            {sousTitre}
          </Text>
        ) : null}
        {compact && montant ? <Text style={{ color: x.sens === 'entree' ? C.coach : C.muted, fontFamily: F.texteM, fontSize: 11 }}>{montant}</Text> : null}
      </Pressable>
      {!compact && montant ? <Text style={{ color: x.sens === 'entree' ? C.coach : C.ink, fontFamily: F.texteF, fontSize: 14 }}>{montant}</Text> : null}
      {modifiable && !compact ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Modifier le rendez-vous ${x.titre}`} hitSlop={6} onPress={() => (tap(), setModifier(true))} style={({ pressed }) => ({ paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: C.muted, fontSize: 16 }}>✎</Text>
        </Pressable>
      ) : null}
      {detail && x.ref ? <DetailTache id={x.ref.id} onFermer={() => setDetail(false)} /> : null}
      {modifiableEquipe && !compact ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Modifier le rendez-vous ${x.titre}`} hitSlop={6} onPress={() => (tap(), setModifier(true))} style={({ pressed }) => ({ paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: C.muted, fontSize: 16 }}>✎</Text>
        </Pressable>
      ) : null}
      {modifier && x.evenement && modifiableEquipe ? <FormRdvEquipe date={x.date} jourActuel={x.date} evenement={x.evenement} onFermer={() => setModifier(false)} /> : null}
      {modifier && x.evenement && !modifiableEquipe ? <FormRendezvous date={x.date} evenement={x.evenement} onFermer={() => setModifier(false)} /> : null}
    </View>
  );
}
