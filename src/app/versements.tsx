import { Empty, Header, Screen } from '@/components/ui';
import { PageVersementsAdmin } from '@/components/versements-admin';
import { useStore } from '@/lib/store';

/** Les versements des cotisations, pour l'équipe Me (admin, commerciaux du module « versements »). */
export default function Versements() {
  const { aModule, mode, isAdmin } = useStore();
  const permis = mode === 'cloud' && aModule('versements');
  return (
    <Screen>
      <Header retour eyebrow={isAdmin ? 'Admin' : 'Équipe Me'} title="Versements" />
      {permis ? <PageVersementsAdmin /> : <Empty>Réservé à l’équipe des versements.</Empty>}
    </Screen>
  );
}
