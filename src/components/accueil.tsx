import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icone, type IconeNom } from '@/components/icones';
import { today } from '@/lib/dates';
import { jeuDe, niveauDe, POINTS, serie, xpDuJour, xpTotal } from '@/lib/jeu';
import type { ElementMission } from '@/lib/mission';
import { useStore } from '@/lib/store';
import { teinte, vive } from '@/lib/teinte';
import { alpha, C, F } from '@/lib/theme';
import type { Evenement } from '@/lib/types';

/** Anneau de progression : la part de la mission déjà faite, le compte au centre. */
function Anneau({ faits, total, taille = 104 }: { faits: number; total: number; taille?: number }) {
  const epaisseur = 11;
  const r = (taille - epaisseur) / 2;
  const tour = 2 * Math.PI * r;
  const pct = total ? faits / total : 0;
  const couleur = pct === 1 ? C.coach : vive('indigo');
  return (
    <View style={{ width: taille, height: taille, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={taille} height={taille} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={taille / 2} cy={taille / 2} r={r} stroke={alpha(couleur, 0.18)} strokeWidth={epaisseur} fill="none" />
        {pct > 0 ? <Circle cx={taille / 2} cy={taille / 2} r={r} stroke={couleur} strokeWidth={epaisseur} fill="none" strokeLinecap="round" strokeDasharray={`${tour * pct} ${tour}`} /> : null}
      </Svg>
      <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 28, letterSpacing: -0.8 }}>
        {faits}
        <Text style={{ color: C.muted, fontSize: 17 }}>/{total}</Text>
      </Text>
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 11, marginTop: -2 }}>faits</Text>
    </View>
  );
}

/** Petite étiquette colorée du bandeau (points, série, niveau). */
function Pastille({ couleur, texte }: { couleur: string; texte: string }) {
  const t = teinte(couleur);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: t.douce }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: couleur }} />
      <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 12 }}>{texte}</Text>
    </View>
  );
}

/**
 * Le haut de l'accueil, en une seule carte : l'anneau de la mission du jour, les points, la série et le niveau,
 * puis une tuile par rubrique (relances, tâches, habitudes) dans sa couleur. Touche l'anneau pour les récompenses.
 */
export function MaJournee({ mission }: { mission: ElementMission[] }) {
  const { espace } = useStore();
  const d = today();
  const j = jeuDe(espace);
  const n = niveauDe(xpTotal(j));
  const s = serie(j, d);
  const faits = mission.filter((m) => m.fait).length;
  const total = mission.length;
  const message = !total ? 'Rien de prévu : ajoute quelque chose avec +.' : faits === total ? 'Journée parfaite, bravo !' : faits === 0 ? 'Coche ta première action pour lancer la journée.' : `Encore ${total - faits} pour la journée parfaite (+${POINTS.parfait} pts).`;

  const compte = (type: ElementMission['type']) => {
    const l = mission.filter((m) => m.type === type);
    return { faits: l.filter((m) => m.fait).length, total: l.length };
  };
  const tuiles: { chemin: '/relances' | '/taches' | '/habitudes'; libelle: string; icone: IconeNom; c: string; faits: number; total: number }[] = [
    { chemin: '/relances', libelle: 'Relances', icone: 'relances', c: vive('corail'), ...compte('relance') },
    { chemin: '/taches', libelle: 'Tâches', icone: 'taches', c: vive('ambre'), ...compte('tache') },
    { chemin: '/habitudes', libelle: 'Habitudes', icone: 'habitudes', c: vive('menthe'), ...compte('habitude') },
  ];

  return (
    <View style={{ borderRadius: 26, padding: 18, gap: 16, overflow: 'hidden', backgroundColor: C.surface, borderWidth: 1, borderColor: C.line }}>
      {/* Une tache de couleur derrière l'anneau : un peu de chaleur, sans gêner la lecture. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -40, top: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: alpha(vive('indigo'), C.sombre ? 0.1 : 0.07) }} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mission du jour : ${faits} sur ${total}. Voir mes récompenses`}
          onPress={() => router.push('/recompenses')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 16, flexGrow: 1, flexBasis: 280, opacity: pressed ? 0.85 : 1 })}>
          <Anneau faits={faits} total={total} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 19, letterSpacing: -0.3 }}>Mission du jour</Text>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13, lineHeight: 18 }}>{message}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Pastille couleur={vive('menthe')} texte={`+${xpDuJour(j, d)} pts`} />
              <Pastille couleur={vive('ambre')} texte={`${s} j de série`} />
              <Pastille couleur={vive('lilas')} texte={`Niveau ${n.niveau}`} />
            </View>
          </View>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 8, flexGrow: 2, flexBasis: 300 }}>
          {tuiles.map((t) => {
            const fini = t.total > 0 && t.faits === t.total;
            return (
              <Pressable
                key={t.chemin}
                accessibilityRole="button"
                accessibilityLabel={`${t.libelle} : ${t.faits} sur ${t.total} faites aujourd'hui`}
                onPress={() => router.push(t.chemin)}
                style={({ pressed }) => ({ flex: 1, borderRadius: 18, padding: 12, gap: 8, backgroundColor: alpha(t.c, C.sombre ? 0.13 : 0.09), borderWidth: 1, borderColor: alpha(t.c, C.sombre ? 0.28 : 0.22), opacity: pressed ? 0.85 : 1 })}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: t.c, alignItems: 'center', justifyContent: 'center' }}>
                  <Icone nom={t.icone} color={teinte(t.c).encre} size={17} />
                </View>
                <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 20, letterSpacing: -0.4 }}>
                  {t.total - t.faits}
                  <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>{fini ? ' ✓' : ' à faire'}</Text>
                </Text>
                <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12 }}>
                  {t.libelle}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Le prochain rendez-vous de la journée, mis en avant comme un post-it : touche pour ouvrir le calendrier. */
export function ProchainRdv({ ev }: { ev: Evenement[] }) {
  const maintenant = new Date().toTimeString().slice(0, 5);
  const suivants = ev.filter((e) => (e.fin || e.debut) >= maintenant).sort((a, b) => a.debut.localeCompare(b.debut));
  const e = suivants[0];
  if (!e) return null;
  const t = teinte(vive('lagon'));
  const enCours = e.debut <= maintenant;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${enCours ? 'En cours' : 'Prochain rendez-vous'} à ${e.debut} : ${e.titre}. Ouvrir le calendrier`}
      onPress={() => router.push('/calendrier')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: t.c, transform: [{ rotate: '-0.8deg' }, { scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ gap: 0 }}>
        <Text style={{ color: alpha(t.encre, 0.7), fontFamily: F.texteF, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 }}>{enCours ? 'En cours' : 'Ensuite'}</Text>
        <Text style={{ color: t.encre, fontFamily: F.titre, fontSize: 20, fontVariant: ['tabular-nums'] }}>{e.debut}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: t.encre, fontFamily: F.texteF, fontSize: 15 }}>
          {e.titre}
        </Text>
        {e.lieu || suivants.length > 1 ? (
          <Text numberOfLines={1} style={{ color: alpha(t.encre, 0.72), fontFamily: F.texte, fontSize: 13 }}>
            {[e.lieu, suivants.length > 1 ? `puis ${suivants.length - 1} autre${suivants.length > 2 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      <Icone nom="agenda" color={t.encre} size={20} />
    </Pressable>
  );
}
