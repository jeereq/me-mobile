/** Petits événements de récompense, émis par les actions et affichés par <Celebrations /> (app/_layout.tsx). */
export type Celebration =
  | { type: 'points'; points: number }
  | { type: 'parfait'; points: number }
  | { type: 'niveau'; niveau: number; titre: string }
  | { type: 'badge'; nom: string; emoji: string; desc: string };

const abonnes = new Set<(c: Celebration) => void>();
export const surCelebration = (fn: (c: Celebration) => void) => {
  abonnes.add(fn);
  return () => {
    abonnes.delete(fn);
  };
};
export const celebrer = (c: Celebration) => abonnes.forEach((fn) => fn(c));
