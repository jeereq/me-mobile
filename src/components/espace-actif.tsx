import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Dialogue, Sep, T } from '@/components/ui';
import { NOM_ROLE, peutEcrireEquipe, type Portee } from '@/lib/equipes';
import { LARGEUR_BANDEAU, useZonesSures } from '@/lib/mise-en-page';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

/** La fenêtre de choix : mon espace, puis une ligne par équipe. */
export function ChoixEspace({ onFermer }: { onFermer: () => void }) {
  const { equipes, portee, choisirPortee, profil } = useStore();

  const choisir = (p: Portee) => {
    choisirPortee(p);
    onFermer();
  };

  const ligne = (cle: string, emoji: string, titre: string, detail: string, actif: boolean, onPress: () => void) => (
    <Pressable
      key={cle}
      accessibilityRole="radio"
      accessibilityState={{ selected: actif }}
      onPress={onPress}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: actif ? C.accent : C.line, backgroundColor: actif ? alpha(C.accent, 0.12) : 'transparent' }, pressed && { opacity: 0.7 }]}>
      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(C.accent, 0.1), borderWidth: 1, borderColor: alpha(C.accent, 0.3) }}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: actif ? C.accent : C.ink, fontFamily: F.texteF, fontSize: 14.5 }}>{titre}</Text>
        <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5 }}>{detail}</Text>
      </View>
      {actif ? <Text style={{ color: C.accent, fontSize: 15 }}>✓</Text> : null}
    </Pressable>
  );

  return (
    <Dialogue titre="Espace affiché" onFermer={onFermer}>
      <T small muted>Chaque espace a ses propres budgets, projets, tâches et habitudes.</T>
      <View style={{ gap: 8 }}>
        {ligne('moi', '🙂', 'Mon espace', profil?.email || 'Rien n’est partagé', portee.type === 'moi', () => choisir({ type: 'moi' }))}
        {equipes.map((e) =>
          ligne(
            e.id,
            e.emoji,
            e.nom,
            `${e.membres.length} membre${e.membres.length > 1 ? 's' : ''} · ${NOM_ROLE[e.monRole].toLowerCase()}`,
            portee.type === 'equipe' && portee.id === e.id,
            () => choisir({ type: 'equipe', id: e.id }),
          ),
        )}
      </View>
      <Sep />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onFermer();
          router.push('/equipes');
        }}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }, pressed && { opacity: 0.7 }]}>
        <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 14 }}>{equipes.length ? 'Gérer mes équipes' : 'Créer une équipe'}</Text>
        <Text style={{ color: C.accent, fontSize: 18 }}>›</Text>
      </Pressable>
    </Dialogue>
  );
}

/** Le bouton qui ouvre le choix : le nom de l'espace affiché, suivi d'un chevron. */
export function BoutonEspace({ compact }: { compact?: boolean }) {
  const { equipes, equipeActive, mode } = useStore();
  const [ouvert, setOuvert] = useState(false);
  // Sans serveur, ou sans aucune équipe, il n'y a rien à choisir.
  if (mode !== 'cloud' || !equipes.length) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Espace affiché : ${equipeActive ? equipeActive.nom : 'le mien'}. Changer d'espace`}
        onPress={() => setOuvert(true)}
        style={({ pressed }) => [
          { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: equipeActive ? alpha(C.accent, 0.5) : C.line, backgroundColor: equipeActive ? alpha(C.accent, 0.12) : 'transparent' },
          pressed && { opacity: 0.7 },
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
        ]}>
        <Text style={{ fontSize: 14 }}>{equipeActive ? equipeActive.emoji : '🙂'}</Text>
        {compact ? null : (
          <Text numberOfLines={1} style={{ color: equipeActive ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 13, maxWidth: 150 }}>
            {equipeActive ? equipeActive.nom : 'Mon espace'}
          </Text>
        )}
        <Text style={{ color: C.muted, fontSize: 11 }}>▾</Text>
      </Pressable>
      {ouvert ? <ChoixEspace onFermer={() => setOuvert(false)} /> : null}
    </>
  );
}

/**
 * Rappel permanent, en haut de l'écran, quand ce qui est affiché appartient à une équipe : sans lui, on croirait
 * ses propres budgets et tâches remplacés.
 */
export function BandeauEspace() {
  const { equipeActive, choisirPortee } = useStore();
  const { haut } = useZonesSures();
  const [ouvert, setOuvert] = useState(false);
  if (!equipeActive) return null;
  const lecture = !peutEcrireEquipe(equipeActive.monRole);
  return (
    <>
      <View pointerEvents="box-none" style={{ position: 'absolute', top: haut + 6, left: 0, right: 0, alignItems: 'center', zIndex: 20 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Espace de l'équipe ${equipeActive.nom}. Changer d'espace`}
          onPress={() => setOuvert(true)}
          onLongPress={() => choisirPortee({ type: 'moi' })}
          style={({ pressed }) => [
            { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1, borderColor: alpha(C.accent, 0.5), shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
            pressed && { opacity: 0.8 },
            Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
          ]}>
          <Text style={{ fontSize: 13 }}>{equipeActive.emoji}</Text>
          <Text numberOfLines={1} style={{ color: C.accent, fontFamily: F.texteM, fontSize: 12.5, maxWidth: 220 }}>
            {equipeActive.nom}
            {lecture ? ' · lecture seule' : ''}
          </Text>
          <Text style={{ color: C.muted, fontSize: 11 }}>▾</Text>
        </Pressable>
      </View>
      {ouvert ? <ChoixEspace onFermer={() => setOuvert(false)} /> : null}
    </>
  );
}

/** Un lecteur qui tente une modification ne voit rien se passer : ce message lui dit pourquoi. */
export function AlerteLectureSeule() {
  const { refusEcriture, equipeActive } = useStore();
  const { haut } = useZonesSures();
  const [vu, setVu] = useState(0);

  useEffect(() => {
    if (!refusEcriture) return;
    const t = setTimeout(() => setVu(refusEcriture), 4000);
    return () => clearTimeout(t);
  }, [refusEcriture]);

  if (!refusEcriture || refusEcriture === vu || !equipeActive) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: haut + 44, left: 12, right: 12, alignItems: 'center', zIndex: 25 }}>
      <View
        accessibilityRole="alert"
        style={{ maxWidth: LARGEUR_BANDEAU, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: alpha(C.hebdo, 0.55), shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10 }}>
        <Text style={{ color: C.ink, fontFamily: F.texte, fontSize: 13, lineHeight: 19 }}>
          Tu es lecteur dans « {equipeActive.nom} » : tu peux tout voir, mais rien modifier. Passe sur ton espace pour écrire.
        </Text>
      </View>
    </View>
  );
}
