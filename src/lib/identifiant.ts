/** L'email a-t-il la tête d'une adresse ? Le serveur tranche ; ici, c'est pour prévenir tout de suite. */
export const emailDouteux = (x: string) => !!x.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x.trim());
