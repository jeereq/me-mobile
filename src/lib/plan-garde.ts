import AsyncStorage from '@react-native-async-storage/async-storage';

import { lirePlanGarde, memoriserPlan, planGarde, planMemorise, poserTitulaire, surPlan, titulairePlan } from './plan-du-jour';
import { today } from './dates';

/** Le plan du jour reste sur cet appareil jusqu'au soir ; il est effacé à la déconnexion, car il parle de tes mails et de tes tâches. */
const CLE = 'me.plan';

// Chaque plan préparé est gardé, qu'il vienne de l'accueil, de l'écran du copilote ou de la voix.
surPlan((_jour, texte) => {
  const p = planGarde();
  if (texte && p?.pour) AsyncStorage.setItem(CLE, JSON.stringify(p)).catch(() => {});
});

/** Reprend le plan de ce compte et de cet espace, s'il date d'aujourd'hui. */
export async function chargerPlan(pour: string, jour: string) {
  if (!poserTitulaire(pour, jour)) return;
  try {
    const brut = await AsyncStorage.getItem(CLE);
    const p = lirePlanGarde(brut ? JSON.parse(brut) : null, pour, jour);
    // Un plan a pu être préparé pendant la lecture, ou l'espace a pu changer : le plus récent gagne.
    if (p && titulairePlan() === pour && !planMemorise(jour)) memoriserPlan(jour, p.texte, p.propositions, p.heure);
  } catch {
    // Illisible : pas de plan repris, il suffit d'en refaire un.
  }
}

export function oublierPlan() {
  poserTitulaire('', today());
  AsyncStorage.removeItem(CLE).catch(() => {});
}
