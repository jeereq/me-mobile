import { Redirect } from 'expo-router';

/** Ancienne adresse des statistiques : elles sont l'onglet Tendances du bilan. */
export default function Statistiques() {
  return <Redirect href={'/bilan?onglet=tendances' as never} />;
}
