import { useLocalSearchParams } from 'expo-router';

import { PageInvitation } from '@/components/page-invitation';

export default function InvitationGroupe() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <PageInvitation code={String(code ?? '')} />;
}
