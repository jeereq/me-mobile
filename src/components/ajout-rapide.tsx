import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { useActions } from '@/lib/actions';
import { addDays, fmtCourt, JOURS, today, uid } from '@/lib/dates';
import { financesDe, fmtMontant } from '@/lib/finances';
import { lirePhrase, type Phrase } from '@/lib/phrase';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Boite, Budget, Frequence, Priorite } from '@/lib/types';

import { Btn, Input, Seg } from './ui';

type Genre = 'tache' | 'relance' | 'habitude';
type Quand = 'auj' | 'demain' | 'semaine' | 'aucune';

const EXEMPLES = ['Relancer Paul jeudi pour le devis', 'Envoyer la facture demain urgent', 'Sport tous les jours', '12,50 € courses'];
const NOM_GENRE: Record<Phrase['genre'], string> = { tache: 'Tâche', relance: 'Relance', habitude: 'Habitude', depense: 'Dépense' };
const LE_GENRE: Record<Phrase['genre'], string> = { tache: 'la tâche', relance: 'la relance', habitude: "l'habitude", depense: 'la dépense' };

/** Ce que l'app a compris de la phrase, en petites étiquettes. */
function etiquettes(p: Phrase, delai: number, budgets: Budget[], devise: string, d: string): string[] {
  if (p.genre === 'depense') {
    const b = budgets.find((x) => x.id === p.budget);
    return [fmtMontant(p.montant, devise), b ? `${b.emoji} ${b.nom}` : 'hors budget', ...(p.note ? [p.note] : []), ...(p.date !== d ? [fmtCourt(p.date)] : [])];
  }
  if (p.genre === 'relance') return [p.contact, p.date ? fmtCourt(p.date) : `dans ${delai} j`, p.sujet];
  if (p.genre === 'habitude') return [p.titre, p.frequence === 'quotidien' ? 'chaque jour' : p.frequence === 'hebdo' ? `chaque ${JOURS[p.jour ?? 1]}` : `le ${p.jour} du mois`];
  return [p.titre, p.echeance ? fmtCourt(p.echeance) : 'sans date', ...(p.priorite === 'haute' ? ['importante'] : [])];
}

const pastille = { fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' as const };

/** Ajout en un geste depuis l'accueil : une phrase suffit, le formulaire détaillé reste à portée de main. */
/** `texte` pré-remplit la phrase (depuis la recherche) ; il est lu au montage, d'où une `key` côté appelant. */
export function AjoutRapide({ visible, onClose, texte }: { visible: boolean; onClose: () => void; texte?: string }) {
  const { config, espace } = useStore();
  const { ajouter, ajouterDepense } = useActions();
  const fin = financesDe(espace);
  const [genre, setGenre] = useState<Genre>('tache');
  const [titre, setTitre] = useState('');
  const [contact, setContact] = useState('');
  const [priorite, setPriorite] = useState<Priorite>('moyenne');
  const [quand, setQuand] = useState<Quand>('auj');
  const [relancer, setRelancer] = useState<'auj' | 'delai' | 'semaine'>('delai');
  const [boite, setBoite] = useState<Boite>('pro');
  const [frequence, setFrequence] = useState<Frequence>('quotidien');
  const [detail, setDetail] = useState(false);
  const [phrase, setPhrase] = useState(texte || '');

  const d = today();
  const lu = lirePhrase(phrase, d, fin.budgets);
  const valide = genre === 'relance' ? !!contact.trim() && !!titre.trim() : !!titre.trim();
  const fermer = () => {
    setTitre('');
    setContact('');
    setPhrase('');
    setDetail(false);
    onClose();
  };
  const ajouterPhrase = () => {
    if (!lu) return;
    const creeLe = new Date().toISOString();
    if (lu.genre === 'tache') ajouter('tache', { id: uid(), titre: lu.titre, source: 'manuel', priorite: lu.priorite, echeance: lu.echeance, statut: 'en_attente', faitLe: null, mode: config.defauts.tache, creeLe });
    else if (lu.genre === 'relance') ajouter('relance', { id: uid(), contact: lu.contact, sujet: lu.sujet, boite: 'pro', date: lu.date ?? addDays(d, config.delaiRelanceJours), statut: 'a_faire', mode: config.defauts.relance, creeLe });
    else if (lu.genre === 'depense') ajouterDepense({ id: uid(), montant: lu.montant, budget: lu.budget, note: lu.note, date: lu.date, creeLe });
    else ajouter('habitude', { id: uid(), nom: lu.titre, categorie: 'perso', frequence: lu.frequence, jour: lu.jour, mode: config.defauts.perso, coches: [], ordre: espace.habitudes.length });
    fermer();
  };
  // Passer au formulaire garde ce qui a été compris.
  const versDetail = () => {
    if (lu?.genre === 'depense') {
      fermer();
      router.push('/finances');
      return;
    }
    if (lu) {
      setGenre(lu.genre);
      if (lu.genre === 'relance') {
        setContact(lu.contact);
        setTitre(lu.sujet === 'Suivi' ? '' : lu.sujet);
      } else setTitre(lu.titre);
      if (lu.genre === 'tache') {
        setPriorite(lu.priorite);
        setQuand(!lu.echeance ? 'aucune' : lu.echeance === d ? 'auj' : lu.echeance === addDays(d, 1) ? 'demain' : 'semaine');
      }
      if (lu.genre === 'habitude') setFrequence(lu.frequence);
    }
    setDetail(true);
  };
  const ok = () => {
    if (!valide) return;
    const creeLe = new Date().toISOString();
    if (genre === 'tache') {
      const echeance = quand === 'auj' ? d : quand === 'demain' ? addDays(d, 1) : quand === 'semaine' ? addDays(d, 6) : null;
      ajouter('tache', { id: uid(), titre: titre.trim(), source: 'manuel', priorite, echeance, statut: 'en_attente', faitLe: null, mode: config.defauts.tache, creeLe });
    } else if (genre === 'relance') {
      const date = relancer === 'auj' ? d : relancer === 'delai' ? addDays(d, config.delaiRelanceJours) : addDays(d, 7);
      ajouter('relance', { id: uid(), contact: contact.trim(), sujet: titre.trim(), boite, date, statut: 'a_faire', mode: config.defauts.relance, creeLe });
    } else {
      const now = new Date();
      const jour = frequence === 'hebdo' ? now.getDay() : frequence === 'mensuel' ? now.getDate() : null;
      ajouter('habitude', { id: uid(), nom: titre.trim(), categorie: 'perso', frequence, jour, mode: config.defauts.perso, coches: [], ordre: espace.habitudes.length });
    }
    fermer();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={fermer}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <Pressable style={{ flex: 1 }} onPress={fermer} accessibilityLabel="Fermer" />
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: C.line, maxHeight: '88%', width: '100%', maxWidth: 640, alignSelf: 'center' }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line }} />
            <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 22 }}>Ajouter</Text>
            {!detail ? (
              <>
                <Input
                  label="Dis-le en une phrase"
                  value={phrase}
                  onChangeText={setPhrase}
                  placeholder="Ex. Relancer Paul jeudi pour le devis"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={ajouterPhrase}
                  accessibilityLabel="Ce que tu veux ajouter, en une phrase"
                />
                {lu ? (
                  <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                    <Text style={{ ...pastille, color: C.accentInk, backgroundColor: C.accent, fontFamily: F.texteF }}>{NOM_GENRE[lu.genre]}</Text>
                    {etiquettes(lu, config.delaiRelanceJours, fin.budgets, fin.devise, d).map((x, i) => (
                      <Text key={i} style={{ ...pastille, color: C.ink, backgroundColor: alpha(C.accent, 0.1), fontFamily: F.texteM }}>
                        {x}
                      </Text>
                    ))}
                  </View>
                ) : (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, lineHeight: 18 }}>Mets une date, une fréquence, « urgent » ou un montant dans ta phrase : l'app range tout. Tu peux aussi dicter avec le micro du clavier.</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {EXEMPLES.map((x) => (
                        <Pressable key={x} accessibilityRole="button" onPress={() => setPhrase(x)} style={({ pressed }) => ({ borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
                          <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{x}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
                <Btn label={lu ? `Ajouter ${LE_GENRE[lu.genre]}` : 'Ajouter'} onPress={ajouterPhrase} disabled={!lu} />
                <Pressable accessibilityRole="button" onPress={versDetail} style={{ alignSelf: 'center', padding: 6 }}>
                  <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 14 }}>{lu?.genre === 'depense' ? 'Voir mes budgets' : 'Remplir le détail'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Seg
                  options={[
                    { key: 'tache', label: 'Tâche' },
                    { key: 'relance', label: 'Relance' },
                    { key: 'habitude', label: 'Habitude' },
                  ]}
                  value={genre}
                  onChange={setGenre}
                />
                {genre === 'relance' ? <Input label="Qui relancer ?" value={contact} onChangeText={setContact} placeholder="Ex. Marie, le comptable" autoFocus /> : null}
                <Input
                  label={genre === 'tache' ? 'Quoi faire ?' : genre === 'relance' ? 'À quel sujet ?' : 'Quelle habitude ?'}
                  value={titre}
                  onChangeText={setTitre}
                  placeholder={genre === 'tache' ? 'Ex. Envoyer le devis' : genre === 'relance' ? 'Ex. Facture de septembre' : 'Ex. Marcher 20 minutes'}
                  autoFocus={genre !== 'relance'}
                  returnKeyType="done"
                  onSubmitEditing={ok}
                />
                {genre === 'tache' ? (
                  <>
                    <Seg
                      label="Pour quand ?"
                      options={[
                        { key: 'auj', label: "Aujourd'hui" },
                        { key: 'demain', label: 'Demain' },
                        { key: 'semaine', label: 'Cette semaine' },
                        { key: 'aucune', label: 'Plus tard' },
                      ]}
                      value={quand}
                      onChange={setQuand}
                    />
                    <Seg
                      label="Importance"
                      options={[
                        { key: 'haute', label: 'Haute' },
                        { key: 'moyenne', label: 'Normale' },
                        { key: 'basse', label: 'Basse' },
                      ]}
                      value={priorite}
                      onChange={setPriorite}
                    />
                  </>
                ) : null}
                {genre === 'relance' ? (
                  <>
                    <Seg
                      label="Relancer"
                      options={[
                        { key: 'auj', label: "Aujourd'hui" },
                        { key: 'delai', label: `Dans ${config.delaiRelanceJours} j` },
                        { key: 'semaine', label: 'Dans 1 semaine' },
                      ]}
                      value={relancer}
                      onChange={setRelancer}
                    />
                    <Seg
                      options={[
                        { key: 'pro', label: 'Pro' },
                        { key: 'perso', label: 'Perso' },
                      ]}
                      value={boite}
                      onChange={setBoite}
                    />
                  </>
                ) : null}
                {genre === 'habitude' ? (
                  <Seg
                    label="Fréquence"
                    options={[
                      { key: 'quotidien', label: 'Chaque jour' },
                      { key: 'hebdo', label: 'Chaque semaine' },
                      { key: 'mensuel', label: 'Chaque mois' },
                    ]}
                    value={frequence}
                    onChange={setFrequence}
                  />
                ) : null}
                <Btn label="Ajouter" onPress={ok} disabled={!valide} />
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
