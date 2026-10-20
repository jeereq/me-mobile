import { useState } from 'react';

import { ChoixApparence } from '@/components/apparence';
import { Btn, Panel, Screen, T, Tag } from '@/components/ui';
import { calculerRappels, demanderPermission, planifierRappels } from '@/lib/reminders';
import { useStore } from '@/lib/store';
import { C, THEMES } from '@/lib/theme';

export default function Compte() {
  const { mode, profil, isAdmin, signOut, espace, config, syncState, update } = useStore();
  const [msg, setMsg] = useState('');
  const prochains = calculerRappels(espace, config).slice(0, 5);
  return (
    <Screen>
      <Panel title="Compte">
        <Tag label={isAdmin ? 'Admin' : 'Utilisateur'} color={isAdmin ? C.accent : C.muted} />
        {mode === 'cloud' ? (
          <>
            <T>{profil?.nom || 'Sans nom'}</T>
            <T small muted>
              {profil?.email} · {syncState === 'ok' ? 'synchronisé' : syncState === 'en_cours' ? 'synchronisation…' : 'hors ligne'}
            </T>
            <Btn kind="danger" label="Se déconnecter" onPress={signOut} />
          </>
        ) : (
          <T small muted>
            Mode local : tes données restent sur ce téléphone. Pour avoir un compte, plusieurs utilisateurs et l'IA, connecte l'app à ton serveur me-api (voir le README).
          </T>
        )}
      </Panel>
      <Panel title="Apparence">
        <T small muted>
          Les couleurs de base de ton app. Elles ne changent que pour ton compte.
        </T>
        <ChoixApparence
          heriter={THEMES[config.theme.nom]?.nom || 'Jarvis'}
          value={{ nom: espace.apparence?.theme || '', accent: espace.apparence?.accent || '' }}
          onChange={(v) => update((e) => ({ ...e, apparence: v.nom ? { theme: v.nom, accent: v.accent } : undefined }))}
        />
      </Panel>
      <Panel title="Rappels programmés">
        {prochains.length ? (
          prochains.map((p, i) => (
            <T key={i} small>
              {p.date.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {p.title}
            </T>
          ))
        ) : (
          <T small muted>
            Aucun rappel dans les 3 prochaines semaines.
          </T>
        )}
        <Btn
          kind="sec"
          label="Réactiver les notifications"
          onPress={async () => {
            const ok = await demanderPermission();
            if (ok) await planifierRappels(espace, config);
            setMsg(ok ? 'Rappels reprogrammés.' : 'Les notifications sont refusées : active-les dans les réglages du téléphone.');
          }}
        />
        {msg ? <T small muted>{msg}</T> : null}
      </Panel>
    </Screen>
  );
}
