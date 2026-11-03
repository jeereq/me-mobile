import { router } from 'expo-router';

import { PageContact } from '@/components/page-contact';

/** Un visiteur non connecté arrive sur la même page par `Gate`, dans `_layout.tsx`. */
export default function Contact() {
  return <PageContact retour={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}
