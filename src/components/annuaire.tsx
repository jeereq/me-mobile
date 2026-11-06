import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { SqueletteAnnuaire } from '@/components/squelettes';
import { Erreur } from '@/components/cotisations-ui';
import { BadgeGroupe, Illustration } from '@/components/illustrations';
import { Jauge } from '@/components/jauge';
import { Text } from '@/components/texte';
import { Btn, Dialogue, Input, T } from '@/components/ui';
import { FILTRES_VIDES, nombreFiltres, requeteAnnuaire, RYTHMES_GROUPE, TRANCHES_MONTANT, TYPES_GROUPE, type FiltresAnnuaire } from '@/lib/annuaire';
import { montantTontine } from '@/lib/commun/cotisations';
import { C, F } from '@/lib/theme';
import type { CarteGroupe } from '@/lib/tontines';

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
function PastilleFiltre({ titre, options, valeur, onChange }: { titre: string; options: Option[]; valeur: string | null; onChange: (v: string | null) => void }) {
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
        accessibilityLabel={`${titre} : ${choisie?.label ?? 'tous'}`}
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
            {ligne(null, 'Tous', true)}
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

/** La recherche et les trois filtres. */
export function BarreAnnuaire({ q, setQ, filtres, setFiltres, enLigne }: { q: string; setQ: (v: string) => void; filtres: FiltresAnnuaire; setFiltres: (f: FiltresAnnuaire) => void; /** Tout sur une ligne, sur grand écran. */ enLigne?: boolean }) {
  return (
    <View style={{ flexDirection: enLigne ? 'row' : 'column', alignItems: enLigne ? 'center' : 'stretch', gap: 10 }}>
      <View style={enLigne ? { flex: 1 } : undefined}>
        <Input placeholder="Chercher un groupe" value={q} onChangeText={setQ} accessibilityLabel="Chercher un groupe" />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <PastilleFiltre titre="Type" options={TYPES_GROUPE} valeur={filtres.mode} onChange={(v) => setFiltres({ ...filtres, mode: v as FiltresAnnuaire['mode'] })} />
        <PastilleFiltre titre="Rythme" options={RYTHMES_GROUPE} valeur={filtres.rythme} onChange={(v) => setFiltres({ ...filtres, rythme: v as FiltresAnnuaire['rythme'] })} />
        <PastilleFiltre titre="Montant" options={TRANCHES_MONTANT.map((t) => ({ key: t.key, label: t.label, groupe: t.devise }))} valeur={filtres.montant} onChange={(v) => setFiltres({ ...filtres, montant: v })} />
        {nombreFiltres(filtres) ? (
          <Pressable accessibilityRole="button" onPress={() => setFiltres(FILTRES_VIDES)} hitSlop={6} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }}>
            <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 14 }}>Effacer</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** La carte d'un groupe, la même dans l'annuaire et dans mes groupes. */
export function CarteGroupeVue({ mode, nom, sous, droite, fort, couleurFort, coin, ratio, bas, onPress, label }: {
  mode: 'rotation' | 'objectif';
  nom: string;
  sous: string;
  droite?: ReactNode;
  fort: string;
  couleurFort?: string;
  /** À droite de la ligne forte : le nom du groupe garde toute la largeur. */
  coin?: ReactNode;
  ratio: number;
  bas: string;
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
        <BadgeGroupe mode={mode} />
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, color: couleurFort ?? C.ink, fontFamily: F.chiffre, fontSize: 19 }}>
          {fort}
        </Text>
        {coin}
      </View>
      <View style={{ gap: 5 }}>
        <Jauge ratio={ratio} hauteur={4} />
        <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>
          {bas}
        </Text>
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
  return <CarteGroupeVue mode={g.mode} nom={g.nom} sous={g.organisateur ? `${type}, par ${g.organisateur}` : type} droite={etat} fort={fort} ratio={g.places ? g.inscrits / g.places : 0} bas={`${places} sur ${g.places}`} onPress={onPress} label={`${g.nom}, ${fort}, ${places}`} />;
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
