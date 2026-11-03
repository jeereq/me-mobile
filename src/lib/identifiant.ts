/** Ce qui se contrôle sur l'écran de connexion. Le serveur tranche ; ici, c'est pour prévenir tout de suite. */

export const emailDouteux = (x: string) => !!x.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x.trim());

/** Un email ou un numéro : au moins 9 chiffres, sans lettres. */
export const identifiantDouteux = (x: string) => {
  const t = x.trim();
  if (!t) return false;
  if (t.includes('@')) return emailDouteux(t);
  return !/^[\d\s+().-]+$/.test(t) || t.replace(/\D/g, '').length < 9;
};
