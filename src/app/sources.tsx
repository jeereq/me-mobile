import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { AgendasDuCompte } from '@/components/agendas-compte';
import { LiensLegaux } from '@/components/liens-legaux';
import { Limitee, Pliable } from '@/components/pliable';
import { Btn, Empty, Grille, Header, IconBtn, Input, Panel, Screen, Seg, Sep, T, Tag, couleur } from '@/components/ui';
import { Bloc, ZoneSquelette } from '@/components/squelettes';
import { api } from '@/lib/api';
import { IMPORT_LABELS, SOURCE_DEFS } from '@/lib/defaults';
import { uid } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { FOURNISSEURS, type Disponible, type Fournisseur } from '@/lib/sync';
import { C, COULEURS } from '@/lib/theme';
import type { Boite, ImportKind, SourceKey, SourcePrefs } from '@/lib/types';

const ilYa = (iso: string | null) => {
  if (!iso) return 'jamais synchronisé';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? "synchronisé à l'instant" : min < 60 ? `synchronisé il y a ${min} min` : `synchronisé à ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Services dont on peut choisir les agendas un par un. */
const AVEC_AGENDAS: Fournisseur[] = ['google', 'microsoft'];

/** Connexion des comptes externes : ouvre la page d'autorisation du service, puis revient dans l'app. */
function Comptes() {
  const { mode, session, externes, synchroniser } = useStore();
  const [dispo, setDispo] = useState<Disponible[]>([]);
  const [dispoChargee, setDispoChargee] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const token = session?.token;

  useEffect(() => {
    if (!token) return;
    api<{ disponibles: Disponible[] }>('/integrations', { token })
      .then((r) => setDispo(r.disponibles))
      .catch((e: Error) => setMsg(e.message))
      .finally(() => setDispoChargee(true));
  }, [token]);

  if (mode !== 'cloud') return <Panel title="Comptes connectés"><Empty>La connexion de tes comptes passe par ton serveur me-api : configure-le d'abord (voir le README).</Empty></Panel>;

  const connecter = async (f: Fournisseur) => {
    setBusy(f);
    setMsg('');
    try {
      const retour = Linking.createURL('sources');
      const { url } = await api<{ url: string }>(`/integrations/${f}/connecter?retour=${encodeURIComponent(retour)}`, { token });
      const res = await WebBrowser.openAuthSessionAsync(url, retour);
      if (res.type === 'success') {
        const q = Linking.parse(res.url).queryParams || {};
        setMsg(q.erreur ? String(q.erreur) : `${FOURNISSEURS[f]} est connecté. Tes éléments arrivent.`);
        await synchroniser();
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const action = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setMsg('');
    try {
      await fn();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title="Comptes connectés" count={externes.length || undefined} accent>
      {externes.map((x) => (
        <View key={x.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700' }}>{x.compte}</T>
              <T small muted>
                {FOURNISSEURS[x.fournisseur]} · {ilYa(x.derniereSync)}
              </T>
              {x.erreur ? <T small style={{ color: C.agressif }}>{x.erreur}</T> : null}
            </View>
            <IconBtn label={`Déconnecter ${x.compte}`} glyph="×" danger onPress={() => action('suppr', async () => { await api(`/integrations/${x.id}`, { method: 'DELETE', token }); await synchroniser(); })} />
          </View>
          <Seg
            options={[{ key: 'perso', label: 'Perso' }, { key: 'pro', label: 'Pro' }]}
            value={x.ctx}
            onChange={(ctx: Boite) => action('ctx', async () => { await api(`/integrations/${x.id}`, { method: 'PATCH', body: { ctx }, token }); await synchroniser(true); })}
          />
          {AVEC_AGENDAS.includes(x.fournisseur) ? (
            <Pliable titre="Agendas à synchroniser" count={x.agendas?.length || 'tous'}>
              <AgendasDuCompte compte={x} />
            </Pliable>
          ) : null}
          <Sep />
        </View>
      ))}
      {!dispoChargee && token ? (
        <ZoneSquelette label="Chargement des services">
          <Bloc h={46} r={14} />
          <Bloc h={46} r={14} />
        </ZoneSquelette>
      ) : null}
      {dispo.filter((d) => d.configure).map((d) => (
        <Btn key={d.nom} kind="sec" label={busy === d.nom ? 'Connexion…' : `Connecter ${FOURNISSEURS[d.nom]}`} disabled={!!busy} onPress={() => connecter(d.nom)} />
      ))}
      {dispo.length && !dispo.some((d) => d.configure) ? <Empty>Aucun service n'est encore configuré sur le serveur (clés OAuth, voir le README de me-api).</Empty> : null}
      {externes.length ? <Btn label={busy === 'sync' ? 'Synchronisation…' : 'Synchroniser maintenant'} disabled={!!busy} onPress={() => action('sync', () => synchroniser(true))} /> : null}
      {msg ? <T small muted>{msg}</T> : null}
      <T small muted>
        Accès en lecture seule : Me ne modifie rien dans tes comptes et ne lit jamais le contenu de tes emails, seulement leur objet, leur expéditeur et leur date.
      </T>
      <LiensLegaux />
    </Panel>
  );
}

function SourceCard({ k }: { k: SourceKey }) {
  const { espace, update, externes } = useStore();
  const connecte = externes.some((x) => (x.fournisseur === 'google' && (k === 'google_agenda' || k === 'gmail')) || (x.fournisseur === 'microsoft' && k === 'outlook') || x.fournisseur === k);
  const def = SOURCE_DEFS[k];
  const cur: SourcePrefs = espace.sources[k] || { actif: false, imports: def.imports, ctx: def.ctx, couleur: def.couleur, filtre: '' };
  const [filtre, setFiltre] = useState(cur.filtre);
  const save = (patch: Partial<SourcePrefs>) => update((e) => ({ ...e, sources: { ...e.sources, [k]: { ...cur, ...patch } } }));
  const col = couleur(cur.couleur);

  return (
    <Panel style={!cur.actif ? { opacity: 0.75 } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.accentInk, fontWeight: '800', fontSize: 17 }}>{def.lettre}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T style={{ fontWeight: '700' }}>{def.nom}</T>
          <Tag label={!cur.actif ? 'Désactivé' : connecte ? 'Connecté' : 'À connecter'} color={!cur.actif ? C.muted : connecte ? C.accent : C.hebdo} />
        </View>
        <Switch value={cur.actif} onValueChange={(actif) => save({ actif })} trackColor={{ true: C.accent, false: C.line }} thumbColor={C.ink} accessibilityLabel={`Synchroniser ${def.nom}`} />
      </View>
      {cur.actif ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {def.imports.map((i: ImportKind) => {
              const on = cur.imports.includes(i);
              return (
                <Pressable
                  key={i}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => save({ imports: on ? cur.imports.filter((x) => x !== i) : [...cur.imports, i] })}
                  style={{ borderWidth: 1, borderColor: on ? C.accent : C.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 }}>
                  <Text style={{ color: on ? C.accent : C.muted, fontWeight: '600', fontSize: 13 }}>
                    {on ? '✓ ' : ''}
                    {IMPORT_LABELS[i]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Seg label="Contexte" options={[{ key: 'perso', label: 'Perso' }, { key: 'pro', label: 'Pro' }]} value={cur.ctx} onChange={(ctx: Boite) => save({ ctx })} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {Object.entries(COULEURS).map(([name, hex]) => (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityLabel={`Couleur ${name}`}
                accessibilityState={{ selected: cur.couleur === name }}
                onPress={() => save({ couleur: name })}
                style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: hex, borderWidth: 2, borderColor: cur.couleur === name ? C.ink : 'transparent' }}
              />
            ))}
          </View>
          <Input label={def.filtre} value={filtre} onChangeText={setFiltre} onEndEditing={() => save({ filtre: filtre.trim() })} placeholder="Tout inclure (sépare par des virgules)" />
        </>
      ) : null}
    </Panel>
  );
}

export default function Sources() {
  const { espace, update, config } = useStore();
  const [nom, setNom] = useState('');
  const [note, setNote] = useState('');
  const [ctx, setCtx] = useState<Boite>('perso');
  const keys = (Object.keys(SOURCE_DEFS) as SourceKey[]).filter((k) => config.sourcesAutorisees[k] !== false);
  return (
    <Screen>
      <Header retour eyebrow="Synchronisation" title="Agendas & outils" />
      <T muted small>
        Choisis ce que Me rassemble : tous tes agendas s'affichent ensemble dans Aujourd'hui, et les tâches et relances trouvées arrivent dans leurs onglets. Connecte chaque compte une fois ; le serveur le relit ensuite toutes les 15 minutes.
      </T>
      <Comptes />
      <Grille>
        {keys.map((k) => (
          <SourceCard key={k} k={k} />
        ))}
      </Grille>
      <Pliable panneau titre="Autres agendas et outils" count={espace.sourcesAutres.length || undefined}>
        {espace.sourcesAutres.length ? (
          <Limitee items={espace.sourcesAutres} n={5} nom="autres" rendu={(a, i) => (
            <View key={a.id}>
              {i ? <Sep /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
                <View style={{ flex: 1 }}>
                  <T>{a.nom}</T>
                  <T small muted>
                    {a.ctx === 'pro' ? 'Pro' : 'Perso'}
                    {a.note ? ` · ${a.note}` : ''} · à brancher
                  </T>
                </View>
                <IconBtn label="Retirer" glyph="×" danger onPress={() => update((e) => ({ ...e, sourcesAutres: e.sourcesAutres.filter((x) => x.id !== a.id) }))} />
              </View>
            </View>
          )} />
        ) : (
          <Empty>Ajoute un agenda ou un outil absent de la liste (iCloud, ClickUp…).</Empty>
        )}
        <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Ex. Agenda iCloud" />
        <Input label="Lien ou précision" value={note} onChangeText={setNote} />
        <Seg options={[{ key: 'perso', label: 'Perso' }, { key: 'pro', label: 'Pro' }]} value={ctx} onChange={setCtx} />
        <Btn
          kind="sec"
          label="Ajouter"
          disabled={!nom.trim()}
          onPress={() => {
            update((e) => ({ ...e, sourcesAutres: [...e.sourcesAutres, { id: uid(), nom: nom.trim(), note: note.trim(), ctx }] }));
            setNom('');
            setNote('');
          }}
        />
      </Pliable>
    </Screen>
  );
}
