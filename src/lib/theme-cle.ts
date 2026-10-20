import { createContext, useContext } from 'react';

/** Clé du thème courant : change quand les couleurs changent, pour redessiner ce qui en dépend. */
export const ThemeCle = createContext('jarvis:');
export const useThemeCle = () => useContext(ThemeCle);
