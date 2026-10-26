import { Redirect } from 'expo-router';

/** Adresse d'une invitation reçue par email : le jeton est lu au chargement de l'app, cette page ramène à l'accueil. */
export default function RetourInvitation() {
  return <Redirect href="/" />;
}
