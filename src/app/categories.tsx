import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PuceCategorie } from '@/components/categories';
import { Btn, Empty, Header, IconBtn, Input, Panel, Screen, Sep, T } from '@/components/ui';
import { ajouterCategorie, categoriesDe, categoriserDepuisBudgets, CATEGORIES_SUGGEREES, classerOperations, deplacer, EMOJIS_CATEGORIE, fusionnerCategories, PALETTE_CATEGORIES, supprimerCategorie, usage, verifierNom } from '@/lib/categories';
import { uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Categorie } from '@/lib/types';

const motsDe = (texte: string) =>
  texte
    .split(/[,;\n]/)
    .map((m) => m.trim())
    .filter(Boolean);

/** Création ou modification d'une catégorie : nom, icône, couleur et mots-clés (ils servent à classer les opérations importées). */
function FormCategorie({ init, onDone }: { init?: Categorie; onDone: () => void }) {
  const { espace, update } = useStore();
  const cats = categoriesDe(espace);
  const [nom, setNom] = useState(init?.nom ?? '');
  const [emoji, setEmoji] = useState(init?.emoji ?? EMOJIS_CATEGORIE[0]);
  const [couleur, setCouleur] = useState(init?.couleur ?? PALETTE_CATEGORIES[cats.length % PALETTE_CATEGORIES.length]);
  const [mots, setMots] = useState((init?.mots ?? []).join(', '));
  const erreur = nom.trim() ? verifierNom(cats, nom, init?.id) : '';

  const enregistrer = () => {
    if (!nom.trim() || erreur) return;
    const patch = { nom: nom.trim(), emoji, couleur, ...(motsDe(mots).length ? { mots: motsDe(mots) } : {}) };
    // Remplace la catégorie en entier : des mots-clés vidés doivent disparaître.
    if (init) update((e) => ({ ...e, categories: categoriesDe(e).map((c) => (c.id === init.id ? { id: c.id, ...patch } : c)) }));
    else update((e) => ajouterCategorie(e, { id: uid(), ...patch }));
    onDone();
  };

  return (
    <Panel title={init ? 'Modifier la catégorie' : 'Nouvelle catégorie'} accent>
      <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Ex. Famille, Voyage, Client Dupont" autoFocus={!init} returnKeyType="done" onSubmitEditing={enregistrer} />
      {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {EMOJIS_CATEGORIE.map((x) => (
          <Pressable key={x} accessibilityRole="radio" aria-checked={x === emoji} accessibilityLabel={`Icône ${x}`} onPress={() => setEmoji(x)} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: x === emoji ? C.accent : C.line, backgroundColor: x === emoji ? alpha(C.accent, 0.14) : 'transparent' }}>
            <Text style={{ fontSize: 18 }}>{x}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {PALETTE_CATEGORIES.map((x) => (
          <Pressable key={x} accessibilityRole="radio" aria-checked={x === couleur} accessibilityLabel={`Couleur ${x}`} onPress={() => setCouleur(x)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: x, borderWidth: 3, borderColor: x === couleur ? C.ink : 'transparent' }} />
        ))}
      </View>
      <Input label="Mots-clés (facultatif)" value={mots} onChangeText={setMots} placeholder="Ex. carrefour, marché, boulangerie" autoCapitalize="none" />
      <T small muted>Une opération importée dont le libellé contient l’un de ces mots reçoit cette catégorie.</T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Enregistrer" onPress={enregistrer} disabled={!nom.trim() || !!erreur} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
      </View>
    </Panel>
  );
}

export default function Categories() {
  const { espace, update } = useStore();
  const cats = categoriesDe(espace);
  const u = usage(espace);
  const [edition, setEdition] = useState<string | 'nouvelle' | null>(null);
  const [fusion, setFusion] = useState<string | null>(null);
  const [suppression, setSuppression] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const budgets = (espace.finances?.budgets ?? []).filter((b) => !b.global);
  const sansCategorie = (espace.finances?.depenses ?? []).filter((d) => !d.categories?.length).length;
  const suggeres = CATEGORIES_SUGGEREES.filter((s) => !cats.some((c) => c.nom.toLowerCase() === s.nom.toLowerCase()));

  const ajouterCourantes = () => {
    update((e) => ({ ...e, categories: [...categoriesDe(e), ...suggeres.map((s) => ({ id: uid(), ...s }))] }));
    setMessage(`${suggeres.length} catégories ajoutées.`);
  };
  const depuisBudgets = () => {
    let n = 0;
    update((e) => {
      const r = categoriserDepuisBudgets(e, uid);
      n = r.creees;
      return r.espace;
    });
    setMessage(n ? `${n} catégorie${n > 1 ? 's' : ''} créée${n > 1 ? 's' : ''} d’après tes budgets.` : 'Tes budgets suivent déjà des catégories.');
  };
  const classer = () => {
    let n = 0;
    update((e) => {
      const r = classerOperations(e);
      n = r.classees;
      return r.espace;
    });
    setMessage(n ? `${n} opération${n > 1 ? 's' : ''} classée${n > 1 ? 's' : ''} d’après leur libellé.` : 'Aucune opération à classer : ajoute des mots-clés à tes catégories.');
  };

  return (
    <Screen>
      <Header retour eyebrow="Budgets, dépenses, tâches, projets" title="Catégories" right={<Btn small label={edition === 'nouvelle' ? 'Fermer' : '+ Ajouter'} kind={edition === 'nouvelle' ? 'sec' : 'primary'} onPress={() => setEdition(edition === 'nouvelle' ? null : 'nouvelle')} />} />
      <T small muted>
        Crée tes propres catégories, puis pose-en une ou plusieurs sur une dépense, un revenu, un budget, une tâche, une relance ou un projet. Un budget peut « suivre » des catégories : les dépenses qui en portent une y comptent.
      </T>
      {message ? <T small style={{ color: C.accent }}>{message}</T> : null}
      {edition === 'nouvelle' ? <FormCategorie onDone={() => setEdition(null)} /> : null}

      <Panel title="Mes catégories" count={cats.length || undefined}>
        {cats.length ? (
          cats.map((c, i) => {
            const n = u.get(c.id);
            if (edition === c.id) return <FormCategorie key={c.id} init={c} onDone={() => setEdition(null)} />;
            return (
              <View key={c.id}>
                {i ? <Sep /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: alpha(c.couleur, 0.2), alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Modifier ${c.nom}`} onPress={() => setEdition(c.id)} style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 15 }}>{c.nom}</Text>
                    <T small muted>
                      {n ? `${n.total} élément${n.total > 1 ? 's' : ''}${n.finances && n.taches ? ` (${n.finances} finances, ${n.taches} tâches)` : ''}` : 'Pas encore utilisée'}
                      {c.mots?.length ? ` · ${c.mots.length} mot${c.mots.length > 1 ? 's' : ''}-clé${c.mots.length > 1 ? 's' : ''}` : ''}
                    </T>
                  </Pressable>
                  <IconBtn label="Monter" glyph="↑" onPress={() => update((e) => ({ ...e, categories: deplacer(categoriesDe(e), c.id, -1) }))} />
                  <IconBtn label="Descendre" glyph="↓" onPress={() => update((e) => ({ ...e, categories: deplacer(categoriesDe(e), c.id, 1) }))} />
                  <IconBtn label="Fusionner ou supprimer" glyph="⋯" onPress={() => (suppression === c.id || fusion === c.id ? (setSuppression(null), setFusion(null)) : setSuppression(c.id))} />
                </View>
                {suppression === c.id || fusion === c.id ? (
                  <View style={{ gap: 8, paddingBottom: 8 }}>
                    {cats.length > 1 ? (
                      <>
                        <T small muted>Fusionner dans une autre catégorie : tout ce qui portait « {c.nom} » prend celle-ci.</T>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {cats
                            .filter((x) => x.id !== c.id)
                            .map((x) => (
                              <PuceCategorie
                                key={x.id}
                                c={x}
                                on={false}
                                onPress={() => {
                                  update((e) => fusionnerCategories(e, c.id, x.id));
                                  setSuppression(null);
                                  setFusion(null);
                                  setMessage(`« ${c.nom} » fusionnée dans « ${x.nom} ».`);
                                }}
                              />
                            ))}
                        </View>
                      </>
                    ) : null}
                    <T small muted>{n ? `La supprimer la retire des ${n.total} éléments qui la portent (rien d’autre n’est effacé).` : 'Cette catégorie n’est utilisée nulle part.'}</T>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Btn small kind="danger" label={`Supprimer « ${c.nom} »`} onPress={() => (update((e) => supprimerCategorie(e, c.id)), setSuppression(null))} />
                      <Btn small kind="sec" label="Garder" onPress={() => setSuppression(null)} />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <Empty icone="vide">Aucune catégorie pour l’instant. Ajoute les plus courantes d’un geste, ou crée les tiennes.</Empty>
        )}
      </Panel>

      {suggeres.length || budgets.length || (cats.length && sansCategorie) ? (
        <Panel title="Gagner du temps">
          {suggeres.length ? (
            <View style={{ gap: 6 }}>
              <T small muted>{`Ajouter ${suggeres.map((s) => `${s.emoji} ${s.nom}`).join(', ')}.`}</T>
              <View style={{ flexDirection: 'row' }}>
                <Btn small kind="sec" label={cats.length ? 'Ajouter les catégories courantes manquantes' : 'Ajouter les catégories courantes'} onPress={ajouterCourantes} />
              </View>
            </View>
          ) : null}
          {budgets.length ? (
            <View style={{ gap: 6 }}>
              <T small muted>Crée une catégorie par budget, fais suivre chaque catégorie par son budget et pose-la sur les dépenses déjà rangées dedans.</T>
              <View style={{ flexDirection: 'row' }}>
                <Btn small kind="sec" label="Créer mes catégories à partir de mes budgets" onPress={depuisBudgets} />
              </View>
            </View>
          ) : null}
          {cats.length && sansCategorie ? (
            <View style={{ gap: 6 }}>
              <T small muted>{`${sansCategorie} dépense${sansCategorie > 1 ? 's' : ''} sans catégorie. Les mots-clés de tes catégories les classent d’après leur libellé.`}</T>
              <View style={{ flexDirection: 'row' }}>
                <Btn small kind="sec" label="Classer automatiquement" onPress={classer} />
              </View>
            </View>
          ) : null}
        </Panel>
      ) : null}
    </Screen>
  );
}
