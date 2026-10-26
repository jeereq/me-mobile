import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { ChoixApparence } from '@/components/apparence';
import { ModePick } from '@/components/forms';
import { EditeurModes } from '@/components/modes-config';
import { Btn, Empty, Header, IconBtn, Input, Panel, Screen, Seg, Sep, T, Tag } from '@/components/ui';
import { api } from '@/lib/api';
import { SOURCE_DEFS } from '@/lib/defaults';
import { habitWhen, uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { C, MODE_COLORS } from '@/lib/theme';
import { MODE_LABELS, MODES, type Config, type Frequence, type SourceKey, type Ton } from '@/lib/types';

function Toggle({ titre, desc, value, onChange, disabled }: { titre: string; desc?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
      <View style={{ flex: 1 }}>
        <T>{titre}</T>
        {desc ? (
          <T small muted>
            {desc}
          </T>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} />
    </View>
  );
}

export default function ConfigScreen() {
  const { config, saveConfig, isAdmin, membres, mode, session, changerRole, profil } = useStore();
  const [modeles, setModeles] = useState<{ liste: string[]; actuel: string; erreur: string }>({ liste: [], actuel: '', erreur: '' });
  const token = session?.token;

  // Modèles OpenAI accessibles avec la clé du serveur, proposés à l'admin.
  useEffect(() => {
    if (mode !== 'cloud' || !isAdmin || !token) return;
    api<{ modeles: string[]; actuel: string }>('/assistant/modeles', { token })
      .then((r) => setModeles({ liste: r.modeles, actuel: r.actuel, erreur: '' }))
      .catch((e: Error) => setModeles({ liste: [], actuel: '', erreur: e.message }));
  }, [mode, isAdmin, token]);
  const [c, setC] = useState<Config>(config);
  const [msg, setMsg] = useState('');
  const [nom, setNom] = useState('');
  const [freq, setFreq] = useState<Frequence>('mensuel');
  const dirty = JSON.stringify(c) !== JSON.stringify(config);
  const ro = !isAdmin;
  const set = (patch: Partial<Config>) => setC((x) => ({ ...x, ...patch }));

  const enregistrer = async () => {
    if (!MODES.some((m) => c.modes[m].actif)) return setMsg('Garde au moins un mode de rappel actif.');
    try {
      await saveConfig(c);
      setMsg('Configuration enregistrée.');
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <Screen>
      <Header retour eyebrow={isAdmin ? 'Admin' : 'Lecture seule'} title="Configuration" />
      {ro ? <T muted small>Seul un compte admin peut modifier la configuration.</T> : null}

      <Panel title="Général">
        <Input label="Heure du briefing du matin (HH:MM)" value={c.routineHeure} editable={!ro} onChangeText={(routineHeure) => set({ routineHeure })} keyboardType="numbers-and-punctuation" />
        <Input label="Heure du rappel du soir (HH:MM)" value={c.rappelSoir} editable={!ro} onChangeText={(rappelSoir) => set({ rappelSoir })} keyboardType="numbers-and-punctuation" />
        <Seg label="Relancer un mail sans réponse après" options={[2, 3, 5, 7].map((n) => ({ key: String(n), label: `${n} j` }))} value={String(c.delaiRelanceJours)} onChange={(k) => !ro && set({ delaiRelanceJours: Number(k) })} />
        <Seg label="Mode agressif : commencer à J- (si « Jours avant » n'est pas réglé)" options={[2, 3, 5, 7].map((n) => ({ key: String(n), label: String(n) }))} value={String(c.agressifJMoins)} onChange={(k) => !ro && set({ agressifJMoins: Number(k) })} />
      </Panel>

      <Panel title="Modes de rappel disponibles">
        <T small muted>
          Chaque mode décrit ce que l'app fait pour un élément (relance, tâche, habitude) : quand rappeler, jusqu'à quand insister. Active-le, décris-le et règle-le ci-dessous ; la phrase en couleur montre l'effet de tes réglages.
        </T>
        <EditeurModes c={c} set={set} ro={ro} />
      </Panel>

      <Panel title="Modes par défaut">
        {(
          [
            ['relance', 'Relances'],
            ['tache', 'Tâches'],
            ['facture', 'Factures'],
            ['finance', 'Épargne et budget'],
            ['perso', 'Habitudes perso'],
          ] as const
        ).map(([k, label]) => (
          <ModePick key={k} label={label} config={c} value={c.defauts[k]} onChange={(m) => !ro && set({ defauts: { ...c.defauts, [k]: m } })} />
        ))}
      </Panel>

      <Panel title="Canaux de rappel">
        <Toggle titre="Notifications sur le téléphone" value={c.canaux.notification} disabled={ro} onChange={(notification) => set({ canaux: { ...c.canaux, notification } })} />
        <Toggle titre="Email" desc="Rappels envoyés par le serveur avec SendGrid ; chacun peut les couper dans Mon compte." value={c.canaux.mail} disabled={ro} onChange={(mail) => set({ canaux: { ...c.canaux, mail } })} />
        <Toggle titre="Alerte dans l'agenda" desc="Disponible avec la synchronisation serveur." value={c.canaux.agenda} disabled={ro} onChange={(agenda) => set({ canaux: { ...c.canaux, agenda } })} />
      </Panel>

      <Panel title="Couleurs de base">
        <T small muted>
          Thème par défaut de tous les comptes. Chacun peut choisir le sien dans Mon compte.
        </T>
        <ChoixApparence disabled={ro} value={{ nom: c.theme.nom, accent: c.theme.accent }} onChange={(v) => v.nom && set({ theme: { nom: v.nom, accent: v.accent } })} />
      </Panel>

      <Panel title="Assistant et IA">
        <Toggle titre="Assistant audio" value={c.assistant.actif} disabled={ro} onChange={(actif) => set({ assistant: { ...c.assistant, actif } })} />
        <Toggle titre="IA (OpenAI) dans l'app" desc="Copilote, brouillons de relance et questions." value={c.assistant.ia} disabled={ro} onChange={(ia) => set({ assistant: { ...c.assistant, ia } })} />
        <Seg<Ton>
          label="Ton par défaut"
          options={[
            { key: 'neutre', label: 'Neutre' },
            { key: 'motivant', label: 'Motivant' },
            { key: 'direct', label: 'Direct' },
            { key: 'coach', label: 'Coach' },
          ]}
          value={c.assistant.ton}
          onChange={(ton) => !ro && set({ assistant: { ...c.assistant, ton } })}
        />
        {mode === 'cloud' ? (
          <View style={{ gap: 8 }}>
            <Input
              label="Modèle OpenAI"
              value={c.assistant.modele}
              editable={!ro}
              onChangeText={(modele) => set({ assistant: { ...c.assistant, modele: modele.trim() } })}
              placeholder={modeles.actuel && !config.assistant.modele ? `Par défaut du serveur : ${modeles.actuel}` : 'Par défaut du serveur'}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!ro && modeles.liste.length ? (
              <Seg<string>
                options={modeles.liste.slice(0, 12).map((m) => ({ key: m, label: m }))}
                value={c.assistant.modele}
                onChange={(modele) => set({ assistant: { ...c.assistant, modele } })}
              />
            ) : null}
            <T small muted>
              {ro
                ? 'Choisi par l’admin.'
                : modeles.erreur
                  ? `${modeles.erreur} Tu peux quand même écrire le nom d’un modèle.`
                  : 'Laisse vide pour garder le modèle par défaut du serveur.'}
            </T>
          </View>
        ) : null}
      </Panel>

      <Panel title="Sources autorisées">
        {(Object.keys(SOURCE_DEFS) as SourceKey[]).map((k) => (
          <Toggle key={k} titre={SOURCE_DEFS[k].nom} value={c.sourcesAutorisees[k] !== false} disabled={ro} onChange={(v) => set({ sourcesAutorisees: { ...c.sourcesAutorisees, [k]: v } })} />
        ))}
      </Panel>

      <Panel title="Habitudes des nouveaux comptes" count={c.habitudesModeles.length || undefined}>
        {c.habitudesModeles.map((h, i) => (
          <View key={h.id}>
            {i ? <Sep /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <T>{h.nom}</T>
                <T small muted>
                  {h.categorie === 'finance' ? 'Finances' : 'Personnel'} · {habitWhen({ ...h, coches: [] })} · <T small style={{ color: MODE_COLORS[h.mode] }}>{MODE_LABELS[h.mode]}</T>
                </T>
              </View>
              {!ro ? <IconBtn label="Retirer" glyph="×" danger onPress={() => set({ habitudesModeles: c.habitudesModeles.filter((x) => x.id !== h.id) })} /> : null}
            </View>
          </View>
        ))}
        {!ro ? (
          <>
            <Input label="Nouvelle habitude modèle" value={nom} onChangeText={setNom} />
            <Seg options={[{ key: 'quotidien', label: 'Chaque jour' }, { key: 'hebdo', label: 'Chaque semaine' }, { key: 'mensuel', label: 'Chaque mois' }]} value={freq} onChange={setFreq} />
            <Btn
              kind="sec"
              label="Ajouter le modèle"
              disabled={!nom.trim()}
              onPress={() => {
                set({ habitudesModeles: [...c.habitudesModeles, { id: uid(), nom: nom.trim(), categorie: 'perso', frequence: freq, jour: freq === 'quotidien' ? null : 1, mode: c.defauts.perso, ordre: 99 }] });
                setNom('');
              }}
            />
          </>
        ) : null}
      </Panel>

      <Panel title="Comptes" count={membres.length || undefined}>
        {mode === 'local' ? (
          <Empty>Mode local : un seul compte, sur ce téléphone. Les comptes multiples arrivent avec la connexion au serveur (voir le README).</Empty>
        ) : membres.length ? (
          membres.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
              <View style={{ flex: 1 }}>
                <T>{m.nom || 'Compte sans nom'}{m.id === profil?.id ? ' (toi)' : ''}</T>
                {m.email ? <T small muted>{m.email}</T> : null}
              </View>
              <Tag label={m.role === 'admin' ? 'Admin' : 'Utilisateur'} color={m.role === 'admin' ? C.accent : C.muted} />
              {isAdmin ? (
                <Btn
                  small
                  kind="sec"
                  label={m.role === 'admin' ? 'Retirer admin' : 'Rendre admin'}
                  onPress={() => changerRole(m.id, m.role === 'admin' ? 'utilisateur' : 'admin').catch((e: Error) => setMsg(e.message))}
                />
              ) : null}
            </View>
          ))
        ) : (
          <Empty>{isAdmin ? 'Aucun autre compte pour l’instant.' : 'La liste des comptes est réservée à l’admin.'}</Empty>
        )}
      </Panel>

      {!ro ? (
        <View style={{ gap: 8 }}>
          {msg ? <T small muted>{msg}</T> : null}
          <Btn label="Enregistrer la configuration" onPress={enregistrer} disabled={!dirty} />
        </View>
      ) : null}
    </Screen>
  );
}
