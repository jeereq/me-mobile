import { Redirect } from 'expo-router';

/** Ancienne adresse de l'état des lieux : il est l'onglet Conseils du bilan. */
export default function Rapport() {
  return <Redirect href={'/bilan?onglet=conseils' as never} />;
}
