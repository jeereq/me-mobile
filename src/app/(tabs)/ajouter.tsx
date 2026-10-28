import { Redirect } from 'expo-router';

/** Place du bouton « Dépense » dans la barre du bas : ouvert par son adresse, il mène à la saisie d'une dépense. */
export default function Ajouter() {
  return <Redirect href="/finances?ajout=1" />;
}
