import { Redirect } from 'expo-router';

/** Adresse d'un lien reçu par email : le lien est traité au chargement de l'app, cette page ramène à l'accueil. */
export default function RetourLien() {
  return <Redirect href="/" />;
}
