import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { useActions } from '@/lib/actions';
import { addDays, today, uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';
import type { Boite, Frequence, Priorite } from '@/lib/types';

import { Btn, Input, Seg } from './ui';

type Genre = 'tache' | 'relance' | 'habitude';
type Quand = 'auj' | 'demain' | 'semaine' | 'aucune';

/** Ajout en un geste depuis l'accueil : on choisit quoi, on écrit une ligne, les réglages par défaut font le reste. */
export function AjoutRapide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { config, espace } = useStore();
  const { ajouter } = useActions();
  const [genre, setGenre] = useState<Genre>('tache');
  const [titre, setTitre] = useState('');
  const [contact, setContact] = useState('');
  const [priorite, setPriorite] = useState<Priorite>('moyenne');
  const [quand, setQuand] = useState<Quand>('auj');
  const [relancer, setRelancer] = useState<'auj' | 'delai' | 'semaine'>('delai');
  const [boite, setBoite] = useState<Boite>('pro');
  const [frequence, setFrequence] = useState<Frequence>('quotidien');

  const d = today();
  const valide = genre === 'relance' ? !!contact.trim() && !!titre.trim() : !!titre.trim();
  const fermer = () => {
    setTitre('');
    setContact('');
    onClose();
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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
