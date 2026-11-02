import { Redirect } from 'expo-router';

/** Ouvert par son adresse, il mène à la saisie d'une dépense. */
export default function Ajouter() {
  return <Redirect href="/finances?ajout=1" />;
}
