import { useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { categoriesDe, PALETTE_CATEGORIES } from '@/lib/categories';
import { addDays, fmtCourt, parse, today, uid } from '@/lib/dates';
import { construire, detecterColonnes, fusionnerImport, lirePlan, normaliser, ROLES, type Colonne, type PlanLu, type Role } from '@/lib/plan-import';
import { replanifier } from '@/lib/planning';
import { useStore } from '@/lib/store';
import { lireFichier, lireTexte, type Feuille } from '@/lib/tableur';
import { alpha, C, F } from '@/lib/theme';
import type { Mode, Projet } from '@/lib/types';

import { ModePick } from './forms';
import { Puce } from './finances-plus';
import { SqueletteImport } from './squelettes';
import { Btn, Input, Panel, Sep, Seg, T } from './ui';

/** Un petit plan à copier, pour voir quelles colonnes sont reconnues. */
export const MODELE_PLAN = `N°;Tâche;Durée;Prédécesseurs;Responsable;Priorité;Catégories
1;Conception;;;;;
1.1;Cadrage;2 j;;Alice;Haute;Travail
1.2;Maquettes;5 j;1.1;Bob;Moyenne;Travail
2;Développement;;1;;;
2.1;Base de données;4 j;;Alice;Haute;Travail
2.2;Interface;6 j;2.1;Bob;;Travail
3;Mise en ligne;1 j;2;Alice;Haute;
4;Lancement;0;3;;;`;

/** Lit un fichier choisi sur le web (Excel ou texte) et renvoie son contenu. */
function choisirFichier(): Promise<{ octets: Uint8Array; nom: string } | null> {
  return new Promise((ok) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xlsm,.csv,.tsv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.onchange = async () => {
      const fichier = input.files?.[0];
      if (!fichier) return ok(null);
      ok({ octets: new Uint8Array(await fichier.arrayBuffer()), nom: fichier.name });
    };
    input.click();
  });
}

const lundiProchain = (d: string) => addDays(d, (8 - parse(d).getDay()) % 7);
const ROLES_COURANTS: Role[] = ['titre', 'projet', 'id', 'parent', 'niveau', 'debut', 'fin', 'duree', 'apres', 'priorite', 'responsable', 'statut', 'avancement', 'categories', 'sousTaches', 'jalon', 'note', 'ignorer'];
const nomRole = (r: Role) => ROLES.find((x) => x.cle === r)?.nom ?? r;

/**
 * Import d'un plan de projet : on choisit un fichier Excel ou CSV (ou on colle des cellules), Me reconnaît les colonnes,
 * on vérifie le résultat — projets, tâches, sous-tâches, liens, dates — puis on l'ajoute. Rien n'est enregistré avant la validation.
 */
export function ImportPlan({ onDone }: { onDone: (message: string, projetId?: string) => void }) {
  const { espace, update, config } = useStore();
  const aujourdhui = today();
  const [texte, setTexte] = useState('');
  const [lecture, setLecture] = useState(false);
  const [erreur, setErreur] = useState('');
  const [fichier, setFichier] = useState<{ nom: string; type: 'excel' | 'csv' | 'colle' } | null>(null);
  const [feuilles, setFeuilles] = useState<Feuille[] | null>(null);
  const [numero, setNumero] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [ligneEntete, setLigneEntete] = useState(-1);
  const [problemes, setProblemes] = useState<string[]>([]);
  const [colonneOuverte, setColonneOuverte] = useState<number | null>(null);
  const [etape, setEtape] = useState<'colonnes' | 'apercu'>('colonnes');
  // Options
  const [ouvres, setOuvres] = useState(true);
  const [depart, setDepart] = useState<'fichier' | 'aujourdhui' | 'lundi'>('fichier');
  const [mode, setMode] = useState<Mode>('passif');
  const [enchainer, setEnchainer] = useState<boolean | null>(null);
  const [creerCategories, setCreerCategories] = useState(true);
  const [noms, setNoms] = useState<Record<number, string>>({});
  const [misAJour, setMisAJour] = useState<'maj' | 'nouveau'>('maj');
  const [toutVoir, setToutVoir] = useState(false);
  const [avert, setAvert] = useState(false);

  const feuille = feuilles?.[numero] ?? null;
  const nomFichierSansExt = fichier?.nom.replace(/\.[^.]+$/, '');

  const ouvrirFeuille = (liste: Feuille[], n: number) => {
    const f = liste[n];
    const d = detecterColonnes(f);
    setNumero(n);
    setRoles(d.colonnes.map((c) => c.role));
    setLigneEntete(d.ligneEntete);
    setProblemes(d.problemes);
    setNoms({});
    setColonneOuverte(null);
    setEtape('colonnes');
  };
  const charger = (octets: Uint8Array, nom: string, type: 'excel' | 'csv' | 'colle') => {
    setLecture(true);
    setErreur('');
    // Un gros classeur prend un instant : on laisse d'abord le squelette s'afficher.
    setTimeout(() => {
      try {
        const liste = lireFichier(octets, nom).filter((f) => f.lignes.length > 0);
        if (!liste.length) throw new Error('Ce fichier ne contient aucune ligne.');
        setFichier({ nom, type });
        setFeuilles(liste);
        // La feuille la plus fournie d'abord (un classeur a souvent une page de garde ou de notes).
        const meilleure = liste.reduce((m, f, i) => (f.lignes.length > liste[m].lignes.length ? i : m), 0);
        ouvrirFeuille(liste, meilleure);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Fichier illisible.');
      }
      setLecture(false);
    }, 30);
  };
  const choisir = async () => {
    const f = await choisirFichier();
    if (f) charger(f.octets, f.nom, /\.(xlsx|xlsm)$/i.test(f.nom) ? 'excel' : 'csv');
  };
  const analyserTexte = () => {
    const f = lireTexte(texte, 'Feuille 1');
    if (!f.lignes.length) return setErreur('Colle d’abord les cellules de ton tableau.');
    setErreur('');
    setFichier({ nom: '', type: 'colle' });
    setFeuilles([f]);
    ouvrirFeuille([f], 0);
  };

  const colonnes: Colonne[] = useMemo(() => {
    if (!feuille) return [];
    const d = detecterColonnes(feuille);
    return roles.map((role, index) => ({ index, entete: d.colonnes[index]?.entete ?? '', role, exemples: d.colonnes[index]?.exemples ?? [] }));
  }, [feuille, roles]);

  const plan: PlanLu | null = useMemo(() => {
    if (!feuille || !roles.length) return null;
    const p = lirePlan(feuille, { ligneEntete, roles, nomFichier: nomFichierSansExt, joursOuvres: ouvres, aujourdhui });
    return { ...p, projets: p.projets.map((x, i) => (noms[i]?.trim() ? { ...x, nom: noms[i].trim() } : x)) };
  }, [feuille, roles, ligneEntete, nomFichierSansExt, ouvres, aujourdhui, noms]);

  const suivre = enchainer ?? (!!plan && !plan.aDesDates && !plan.aDesLiens);
  const catalogue = categoriesDe(espace);
  const construit = useMemo(() => {
    if (!plan || !plan.projets.length) return null;
    return construire(plan, {
      debut: depart === 'aujourdhui' ? aujourdhui : depart === 'lundi' ? lundiProchain(aujourdhui) : null,
      joursOuvres: ouvres,
      mode,
      source: 'manuel',
      categories: catalogue,
      creerCategories,
      enchainer: suivre,
      enchainerSousTaches: true,
      nouvelId: uid,
      aujourdhui,
      couleurs: PALETTE_CATEGORIES,
      type: fichier?.type ?? 'colle',
      ...(fichier && fichier.type !== 'colle' ? { fichier: fichier.nom } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, depart, ouvres, mode, catalogue.length, creerCategories, suivre, aujourdhui, fichier]);

  // Un projet déjà importé sous le même nom : on propose de le mettre à jour plutôt que de le doubler.
  const existants = (espace.projets ?? []).filter((p) => !p.archive);
  const jumeaux = construit ? construit.projets.map((p) => existants.find((x) => normaliser(x.nom) === normaliser(p.nom))) : [];
  const aDesJumeaux = jumeaux.some(Boolean);

  const ajouter = () => {
    if (!construit) return;
    const c = construit;
    const premier = aDesJumeaux && misAJour === 'maj' && jumeaux[0] ? jumeaux[0].id : c.projets[0]?.id;
    update((e) => {
      let projets: Projet[] = e.projets ?? [];
      let taches = e.taches;
      c.projets.forEach((p, i) => {
        const j = aDesJumeaux && misAJour === 'maj' ? jumeaux[i] : undefined;
        if (j) {
          const f = fusionnerImport(taches, c.taches, j.id, p.id);
          taches = f.taches;
          projets = projets.map((x) => (x.id === j.id ? { ...x, source: p.source } : x));
          taches = replanifier(taches, projets.find((x) => x.id === j.id)!, aujourdhui);
        } else {
          projets = [...projets, p];
          taches = [...taches, ...c.taches.filter((t) => t.projet === p.id)];
        }
      });
      const connues = new Set(categoriesDe(e).map((x) => x.id));
      const nouvelles = c.categoriesCreees.filter((x) => !connues.has(x.id));
      return { ...e, projets, taches, ...(nouvelles.length ? { categories: [...categoriesDe(e), ...nouvelles] } : {}) };
    });
    const nbTaches = c.taches.length;
    onDone(`${c.projets.length} projet${c.projets.length > 1 ? 's' : ''} : ${nbTaches} tâche${nbTaches > 1 ? 's' : ''} ${aDesJumeaux && misAJour === 'maj' ? 'lue' + (nbTaches > 1 ? 's' : '') + ' (projets existants mis à jour)' : 'ajoutée' + (nbTaches > 1 ? 's' : '')}.`, premier);
  };

  const changerRole = (index: number, role: Role) => {
    setRoles((l) => l.map((r, i) => (i === index ? role : role !== 'ignorer' && role !== 'categories' && role !== 'note' && r === role ? 'ignorer' : r)));
    setColonneOuverte(null);
  };

  if (lecture)
    return (
      <Panel title="Importer un plan" accent>
        <SqueletteImport />
      </Panel>
    );

  // 1. Choisir le fichier
  if (!feuille || !plan)
    return (
      <Panel title="Importer un plan Excel" accent>
        <T small muted>
          Un tableau avec une ligne par tâche : le nom, et si tu les as la durée, les dates, les tâches à finir avant (prédécesseurs), le responsable, la priorité, les catégories. Les retraits ou les numéros « 1.2.3 » donnent les sous-tâches. Me reconnaît les colonnes tout seul et te montre le résultat avant d’ajouter quoi que ce soit.
        </T>
        {Platform.OS === 'web' ? <Btn kind="sec" label="Choisir un fichier Excel ou CSV" onPress={choisir} /> : <T small muted>Sur téléphone, ouvre ton fichier dans Excel, copie les cellules et colle-les ci-dessous. L’import de fichier .xlsx est disponible dans la version web de Me.</T>}
        <Input label="Ou colle les cellules de ton tableau" value={texte} onChangeText={setTexte} multiline placeholder={MODELE_PLAN} style={{ minHeight: 140, textAlignVertical: 'top', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: 13 }} />
        {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn label="Analyser" onPress={analyserTexte} disabled={!texte.trim()} />
          <Btn kind="sec" label="Essayer avec un exemple" onPress={() => setTexte(MODELE_PLAN)} />
          <Btn kind="sec" label="Annuler" onPress={() => onDone('')} />
        </View>
      </Panel>
    );

  const feuillesChoix = feuilles && feuilles.length > 1 ? (
    <Seg label="Feuille du classeur" options={feuilles.map((f, i) => ({ key: String(i), label: `${f.nom} (${f.lignes.length})` }))} value={String(numero)} onChange={(k) => ouvrirFeuille(feuilles, Number(k))} />
  ) : null;

  // 2. Vérifier les colonnes
  if (etape === 'colonnes') {
    const aTitre = roles.includes('titre');
    return (
      <Panel title="Colonnes reconnues" count={`${plan.nbLignes} lignes`} accent>
        <T small muted>
          Vérifie ce que Me a compris de chaque colonne, et corrige-le si besoin en touchant une colonne.
        </T>
        {feuillesChoix}
        {problemes.map((p) => (
          <T key={p} small style={{ color: C.hebdo }}>
            {p}
          </T>
        ))}
        {colonnes.map((c) => (
          <View key={c.index}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Colonne ${c.entete || c.index + 1} : ${nomRole(c.role)}. Changer`} onPress={() => setColonneOuverte(colonneOuverte === c.index ? null : c.index)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
              <View style={{ flex: 1, gap: 1 }}>
                <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>
                  {c.entete || `Colonne ${c.index + 1}`}
                </Text>
                <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
                  {c.exemples.length ? c.exemples.join(' · ') : 'vide'}
                </Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: c.role === 'ignorer' ? C.sunk : alpha(C.accent, 0.14) }}>
                <Text style={{ color: c.role === 'ignorer' ? C.muted : C.accent, fontFamily: F.texteM, fontSize: 12 }}>{nomRole(c.role)}</Text>
              </View>
            </Pressable>
            {colonneOuverte === c.index ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 8 }}>
                {ROLES_COURANTS.map((r) => (
                  <Puce key={r} label={nomRole(r)} on={c.role === r} onPress={() => changerRole(c.index, r)} />
                ))}
              </View>
            ) : null}
          </View>
        ))}
        {!aTitre ? <T small style={{ color: C.agressif }}>Choisis la colonne qui contient le nom des tâches.</T> : null}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn label="Voir le résultat" onPress={() => setEtape('apercu')} disabled={!aTitre || !plan.projets.length} />
          <Btn kind="sec" label="Autre fichier" onPress={() => (setFeuilles(null), setFichier(null))} />
          <Btn kind="sec" label="Annuler" onPress={() => onDone('')} />
        </View>
      </Panel>
    );
  }

  // 3. Aperçu et options
  const total = construit?.taches.length ?? 0;
  return (
    <Panel title="Résultat de l’import" count={`${total} tâches`} accent>
      {feuillesChoix}
      <T small muted>
        {plan.projets.length} projet{plan.projets.length > 1 ? 's' : ''}. Rien n’est ajouté avant ta validation.
      </T>
      <View style={{ gap: 10 }}>
        <Seg label="Jours de travail" options={[{ key: 'ouvres', label: 'Lundi au vendredi' }, { key: 'tous', label: 'Tous les jours' }]} value={ouvres ? 'ouvres' : 'tous'} onChange={(k) => setOuvres(k === 'ouvres')} />
        <Seg label="Début du planning" options={[{ key: 'fichier', label: 'Dates du fichier' }, { key: 'aujourdhui', label: 'Aujourd’hui' }, { key: 'lundi', label: 'Lundi prochain' }]} value={depart} onChange={setDepart} />
        {!plan.aDesLiens || !plan.aDesDates ? (
          <Seg label="Tâches sans date ni lien" options={[{ key: 'oui', label: 'Les enchaîner' }, { key: 'non', label: 'Toutes au début' }]} value={suivre ? 'oui' : 'non'} onChange={(k) => setEnchainer(k === 'oui')} />
        ) : null}
        <Seg label="Catégories du fichier inconnues" options={[{ key: 'oui', label: 'Les créer' }, { key: 'non', label: 'Les ignorer' }]} value={creerCategories ? 'oui' : 'non'} onChange={(k) => setCreerCategories(k === 'oui')} />
        <ModePick value={mode} onChange={setMode} config={config} label="Mode de rappel des tâches" />
        <T small muted>Les rappels ne concernent que les tâches à faire bientôt et pas bloquées par une autre.</T>
      </View>

      {aDesJumeaux ? (
        <Seg label="Un projet du même nom existe déjà" options={[{ key: 'maj', label: 'Le mettre à jour' }, { key: 'nouveau', label: 'En créer un autre' }]} value={misAJour} onChange={setMisAJour} />
      ) : null}
      {aDesJumeaux && misAJour === 'maj' ? <T small muted>Les tâches sont reconnues à leur ligne : ce qui est déjà fait reste fait, les nouvelles lignes sont ajoutées, et celles qui ont disparu du fichier sont gardées.</T> : null}

      {construit
        ? construit.projets.map((p, i) => {
            const lignes = construit.taches.filter((t) => t.projet === p.id);
            const brouillons = plan.projets[i].taches;
            const profondeur = (cle: string): number => {
              let n = 0;
              for (let b = brouillons.find((x) => x.cle === cle); b?.parentCle && n < 20; b = brouillons.find((x) => x.cle === b!.parentCle)) n++;
              return n;
            };
            const parRef = new Map(lignes.map((t) => [t.ref, t]));
            const visibles = toutVoir ? brouillons : brouillons.slice(0, 24);
            const debut = lignes.map((t) => t.debut).filter((x): x is string => !!x).sort()[0];
            const fin = lignes.map((t) => t.echeance).filter((x): x is string => !!x).sort().reverse()[0];
            return (
              <View key={p.id} style={{ gap: 6 }}>
                <Sep />
                <Input label={`Projet ${construit.projets.length > 1 ? i + 1 : ''}`.trim()} value={noms[i] ?? p.nom} onChangeText={(v: string) => setNoms((n) => ({ ...n, [i]: v }))} />
                <T small muted>
                  {`${lignes.length} tâche${lignes.length > 1 ? 's' : ''}${debut && fin ? ` · du ${fmtCourt(debut)} au ${fmtCourt(fin)}` : ''}${lignes.some((t) => t.apres?.length) ? ` · ${lignes.reduce((s, t) => s + (t.apres?.length ?? 0), 0)} lien${lignes.reduce((s, t) => s + (t.apres?.length ?? 0), 0) > 1 ? 's' : ''}` : ''}`}
                </T>
                {visibles.map((b) => {
                  const t = parRef.get(b.cle);
                  const resume = lignes.some((x) => x.parent === t?.id);
                  return (
                    <View key={b.cle} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: profondeur(b.cle) * 14 }}>
                      <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: resume ? F.texteF : F.texte, fontSize: 13 }}>
                        {t?.jalon ? '◆ ' : ''}
                        {b.titre}
                      </Text>
                      <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{t?.debut && t.echeance ? (t.debut === t.echeance ? fmtCourt(t.echeance) : `${fmtCourt(t.debut)} → ${fmtCourt(t.echeance)}`) : ''}</Text>
                    </View>
                  );
                })}
                {!toutVoir && brouillons.length > 24 ? <Btn small kind="sec" label={`Voir les ${brouillons.length - 24} autres`} onPress={() => setToutVoir(true)} /> : null}
              </View>
            );
          })
        : null}

      {plan.avertissements.length ? (
        <View style={{ gap: 4 }}>
          <Pressable accessibilityRole="button" onPress={() => setAvert(!avert)}>
            <T small style={{ color: C.hebdo }}>{`${plan.avertissements.length} point${plan.avertissements.length > 1 ? 's' : ''} à vérifier ${avert ? '▾' : '▸'}`}</T>
          </Pressable>
          {avert ? plan.avertissements.map((a, i) => <T key={i} small muted>{a}</T>) : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={aDesJumeaux && misAJour === 'maj' ? 'Mettre à jour' : `Ajouter ${plan.projets.length > 1 ? 'les projets' : 'le projet'}`} onPress={ajouter} disabled={!construit || !total} />
        <Btn kind="sec" label="Retour aux colonnes" onPress={() => setEtape('colonnes')} />
        <Btn kind="sec" label="Annuler" onPress={() => onDone('')} />
      </View>
    </Panel>
  );
}
