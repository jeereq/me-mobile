import { commeNumero, numeroPlausible, PAYS_DEFAUT } from './indicatifs';

/** Ce qui se contrôle sur l'écran de connexion. Le serveur tranche ; ici, c'est pour prévenir tout de suite. */

export const emailDouteux = (x: string) => !!x.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x.trim());

/** Un email, un numéro avec son indicatif, ou un numéro sans : il prend alors l'indicatif choisi. */
export const identifiantDouteux = (x: string, pays = PAYS_DEFAUT) => {
  const t = x.trim();
  if (!t) return false;
  if (t.includes('@')) return emailDouteux(t);
  if (commeNumero(t)) return !numeroPlausible(pays, t);
  return !/^\+[\d\s().-]+$/.test(t) || t.replace(/\D/g, '').length < 8;
};
