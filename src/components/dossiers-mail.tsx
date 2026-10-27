import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { api } from '@/lib/api';
import { arbreDossiers, destinations, ICONE_DOSSIER } from '@/lib/dossiers';
import { nomBoite, type Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import type { CompteConnecte, DossierMail } from '@/lib/sync';
import { alpha, C, F } from '@/lib/theme';
import type { SourceKey } from '@/lib/types';

import { Icone, type IconeNom } from './icones';
import { couleurLibelle, type CouleursLibelles } from './mail-ui';
import { Bloc, ZoneSquelette } from './squelettes';
import { T, tap } from './ui';

/**
 * L'environnement de la boîte, comme Outlook : pour chaque compte (et chaque boîte partagée), l'arbre de ses dossiers
 * avec les non lus, les règles, puis les étiquettes. Un dossier ouvert se lit page par page, à la demande ;
 * « Toutes les boîtes » reste la réception rassemblée de tous les comptes.
 */

/** Ce que montre la liste : la réception rassemblée, ou un dossier d'une boîte. */
export type VueMails = { type: 'tout' } | { type: 'dossier'; compte: string; adresse: string; boite?: string; source: SourceKey; dossier: DossierMail };

export const memeVue = (a: VueMails, b: VueMails) => (a.type === 'tout' ? b.type === 'tout' : b.type === 'dossier' && a.compte === b.compte && a.boite === b.boite && a.dossier.id === b.dossier.id);

// Les dossiers changent peu : gardés le temps de la session, relus à la demande (Actualiser, après un rangement).
const CACHE = new Map<string, DossierMail[]>();
const cleCache = (compte: string, boite?: string) => `${compte}|${boite ?? ''}`;

/** Les dossiers d'une boîte, demandés au serveur à la première ouverture. */
export function useDossiers(compte: string | undefined, boite?: string, actif = true) {
  const { session } = useStore();
  const cle = compte ? cleCache(compte, boite) : '';
  const [dossiers, setDossiers] = useState<DossierMail[] | null>(() => CACHE.get(cle) ?? null);
  const [msg, setMsg] = useState('');
  const [tour, setTour] = useState(0);
  const token = session?.token;

  useEffect(() => {
    if (!compte || !token || !actif) return;
    // Déjà lus pendant la session : affichés tout de suite, sans appel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (CACHE.has(cle) && !tour) return setDossiers(CACHE.get(cle)!);
    let vivant = true;
    api<{ dossiers: DossierMail[] }>(`/integrations/${compte}/dossiers${boite ? `?boite=${encodeURIComponent(boite)}` : ''}`, { token })
      .then((r) => {
        CACHE.set(cle, r.dossiers);
        if (vivant) {
          setDossiers(r.dossiers);
          setMsg('');
        }
      })
      .catch((e: Error) => vivant && (setMsg(e.message), setDossiers((d) => d ?? [])));
    return () => {
      vivant = false;
    };
  }, [compte, boite, token, actif, cle, tour]);

  const recharger = useCallback(() => setTour((t) => t + 1), []);
  return { dossiers, msg, recharger };
}

/** Oublie les dossiers gardés (après Actualiser) : les non lus se relisent. */
export const oublierDossiers = () => CACHE.clear();

/** Les mails d'un dossier, une page à la fois ; « Charger plus » demande la suivante. */
export function useMailsDossier(vue: VueMails, version: number) {
  const { session } = useStore();
  const token = session?.token;
  const [mails, setMails] = useState<Mail[]>([]);
  const [suivant, setSuivant] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);
  const [msg, setMsg] = useState('');
  const dossier = vue.type === 'dossier' ? vue : null;
  const chemin = dossier ? `/integrations/${dossier.compte}/dossiers/${encodeURIComponent(dossier.dossier.id)}/mails` : '';

  const page = useCallback(
    async (apres: string | null) => {
      if (!dossier || !token) return;
      setCharge(true);
      setMsg('');
      if (!apres) {
        setMails([]);
        setSuivant(null);
      }
      try {
        const q = new URLSearchParams({ ...(dossier.boite ? { boite: dossier.boite } : {}), ...(apres ? { suivant: apres } : {}) }).toString();
        const r = await api<{ mails: Mail[]; suivant: string | null }>(`${chemin}${q ? `?${q}` : ''}`, { token });
        setMails((l) => (apres ? [...l, ...r.mails.filter((m) => !l.some((x) => x.id === m.id))] : r.mails));
        setSuivant(r.suivant);
      } catch (e) {
        setMsg((e as Error).message);
      } finally {
        setCharge(false);
      }
    },
    // Une nouvelle vue ou une nouvelle version (rangement, actualisation) relit la première page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chemin, dossier?.boite, token],
  );

  useEffect(() => {
    // Lecture de la première page quand la vue change : l'état « chargement » se pose avant l'appel.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    page(null);
  }, [page, version]);

  return { mails, suivant, charge, msg, chargerPlus: () => suivant && page(suivant), retirer: (id: string) => setMails((l) => l.filter((m) => m.id !== id)) };
}

function Titre({ children, droite }: { children: ReactNode; droite?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 14, paddingBottom: 4 }}>
      <Text style={{ flex: 1, color: C.muted, fontFamily: F.texteF, fontSize: 11.5, letterSpacing: 0.4, textTransform: 'uppercase' }}>{children}</Text>
      {droite}
    </View>
  );
}

/** Une ligne du volet : icône ou pastille, nom, retrait des sous-dossiers, flèche pour replier, nombre de non lus. */
export function LigneDossier({ label, sous, nombre, on, icone, pastille, retrait = 0, replie, onReplier, onPress, gras }: { label: string; sous?: string; nombre?: number; on: boolean; icone?: IconeNom; pastille?: string; retrait?: number; replie?: boolean; onReplier?: () => void; onPress: () => void; gras?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`${label}${nombre ? `, ${nombre} non lus` : ''}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={(e) => {
        const survol = (e as { hovered?: boolean }).hovered;
        return { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6 + retrait * 16, paddingRight: 10, paddingVertical: 7, borderRadius: 9, backgroundColor: on ? alpha(C.accent, 0.16) : e.pressed || survol ? alpha(C.ink, 0.05) : 'transparent' };
      }}>
      <Pressable accessibilityRole="button" accessibilityLabel={replie ? `Déplier ${label}` : `Replier ${label}`} disabled={!onReplier} onPress={onReplier} hitSlop={6} style={{ width: 12, alignItems: 'center' }}>
        {onReplier ? <Text style={{ color: C.muted, fontSize: 10 }}>{replie ? '▸' : '▾'}</Text> : null}
      </Pressable>
      {pastille ? <View style={{ width: 10, height: 10, borderRadius: 5, marginHorizontal: 3, backgroundColor: pastille }} /> : icone ? <Icone nom={icone} color={on ? C.accent : C.muted} size={16} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: C.ink, fontFamily: on || gras || (nombre ?? 0) > 0 ? F.texteF : F.texteM, fontSize: 13.5 }}>
          {label}
        </Text>
        {sous ? (
          <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 11.5 }}>
            {sous}
          </Text>
        ) : null}
      </View>
      {nombre ? <Text style={{ color: on ? C.accent : C.accent, fontFamily: F.texteF, fontSize: 12 }}>{nombre}</Text> : null}
    </Pressable>
  );
}

/** L'arbre des dossiers d'une boîte (d'un compte, ou d'une boîte partagée lue avec lui). */
function ArbreBoite({ compte, boite, titre, sous, vue, onChoisir, couleurSource }: { compte: CompteConnecte; boite?: string; titre: string; sous: string; vue: VueMails; onChoisir: (v: VueMails) => void; couleurSource: string }) {
  const [ouvert, setOuvert] = useState(true);
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const { dossiers, msg } = useDossiers(compte.id, boite, ouvert);
  const source: SourceKey = compte.fournisseur === 'microsoft' ? 'outlook' : 'gmail';
  const basculer = (id: string) => setReplies((r) => (r.has(id) ? new Set([...r].filter((x) => x !== id)) : new Set([...r, id])));

  return (
    <View style={{ gap: 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: ouvert }}
        accessibilityLabel={`${titre}, ${ouvert ? 'replier' : 'déplier'} les dossiers`}
        onPress={() => setOuvert((o) => !o)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingTop: 12, paddingBottom: 6, opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ width: 12, color: C.muted, fontSize: 10, textAlign: 'center' }}>{ouvert ? '▾' : '▸'}</Text>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: couleurSource }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 13.5 }}>
            {titre}
          </Text>
          <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 11.5 }}>
            {sous}
          </Text>
        </View>
      </Pressable>
      {ouvert && !dossiers ? (
        <ZoneSquelette label="Chargement des dossiers">
          <Bloc h={26} r={8} />
          <Bloc h={26} r={8} />
          <Bloc h={26} r={8} l="70%" />
        </ZoneSquelette>
      ) : null}
      {ouvert && msg ? (
        <T small style={{ color: C.agressif, paddingHorizontal: 10 }}>
          {msg}
        </T>
      ) : null}
      {ouvert && dossiers
        ? arbreDossiers(dossiers, replies).map((d) => (
            <LigneDossier
              key={d.id}
              label={d.nom}
              nombre={d.genre === 'envoyes' || d.genre === 'brouillons' ? undefined : d.nonLus}
              icone={ICONE_DOSSIER[d.genre]}
              retrait={d.profondeur}
              replie={replies.has(d.id)}
              onReplier={d.aEnfants ? () => basculer(d.id) : undefined}
              on={vue.type === 'dossier' && vue.compte === compte.id && vue.boite === boite && vue.dossier.id === d.id}
              onPress={() => onChoisir({ type: 'dossier', compte: compte.id, adresse: boite ?? compte.compte, boite, source, dossier: d })}
            />
          ))
        : null}
      {ouvert && compte.regles && !boite ? <LigneDossier label="Règles" icone="regles" on={false} onPress={() => router.push({ pathname: '/regles', params: { compte: compte.id } } as never)} /> : null}
    </View>
  );
}

/**
 * Le volet des dossiers : Toutes les boîtes, puis chaque compte et ses boîtes partagées avec leurs dossiers,
 * puis les étiquettes. Sur grand écran il a sa colonne ; ailleurs il s'ouvre en fenêtre depuis « Dossiers ».
 */
export function VoletDossiers({ vue, onChoisir, nbNonLus, libelles, libelle, onLibelle, couleurs, couleurSource }: { vue: VueMails; onChoisir: (v: VueMails) => void; nbNonLus: number; libelles: { nom: string; nombre: number }[]; libelle: string; onLibelle: (n: string) => void; couleurs: CouleursLibelles; couleurSource: (s: SourceKey) => string }) {
  const { externes } = useStore();
  const comptes = externes.filter((x) => x.dossiers && (x.fournisseur === 'google' || x.fournisseur === 'microsoft'));
  const enErreur = externes.flatMap((x) => (x.boites ?? []).filter((b) => b.erreur));
  return (
    <ScrollView contentContainerStyle={{ padding: 8, paddingBottom: 16 }}>
      <Titre>Favoris</Titre>
      <LigneDossier label="Toutes les boîtes" nombre={nbNonLus} icone="mail" on={vue.type === 'tout' && !libelle} gras onPress={() => (onChoisir({ type: 'tout' }), libelle && onLibelle(libelle))} />
      {comptes.map((c) => {
        const source: SourceKey = c.fournisseur === 'microsoft' ? 'outlook' : 'gmail';
        return (
          <View key={c.id}>
            <ArbreBoite compte={c} titre={c.compte} sous={c.fournisseur === 'microsoft' ? 'Outlook' : 'Gmail'} vue={vue} onChoisir={onChoisir} couleurSource={couleurSource(source)} />
            {(c.boites ?? [])
              .filter((b) => !b.erreur)
              .map((b) => (
                <ArbreBoite key={b.adresse} compte={c} boite={b.adresse} titre={nomBoite(b.adresse)} sous={`Partagée · ${b.adresse}`} vue={vue} onChoisir={onChoisir} couleurSource={couleurSource(source)} />
              ))}
          </View>
        );
      })}
      {enErreur.length ? (
        <View style={{ gap: 4, margin: 6, padding: 10, borderRadius: 10, backgroundColor: alpha(C.agressif, 0.1) }}>
          {enErreur.map((b) => (
            <Text key={b.adresse} style={{ color: C.agressif, fontFamily: F.texte, fontSize: 12.5 }}>
              {b.adresse} : {b.erreur}
            </Text>
          ))}
        </View>
      ) : null}
      {libelles.length ? <Titre>Étiquettes</Titre> : null}
      {libelles.map((l) => (
        <LigneDossier key={l.nom} label={l.nom} nombre={l.nombre} pastille={couleurLibelle(l.nom, couleurs)} on={vue.type === 'tout' && libelle === l.nom} onPress={() => (onChoisir({ type: 'tout' }), onLibelle(l.nom))} />
      ))}
      <Pressable accessibilityRole="link" onPress={() => router.push('/sources')} style={{ paddingHorizontal: 12, paddingTop: 16 }}>
        <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 12.5 }}>Boîtes partagées et chargement des mails</Text>
      </Pressable>
    </ScrollView>
  );
}

/** Ranger un mail : la liste des dossiers de sa boîte, un toucher le déplace. */
export function DeplacerMail({ compte, boite, depuis, mailId, onFini, onAnnuler }: { compte: string; boite?: string; depuis?: string; mailId: string; onFini: (nom: string) => void; onAnnuler: () => void }) {
  const { session, synchroniser } = useStore();
  const { dossiers, msg } = useDossiers(compte, boite);
  const [busy, setBusy] = useState('');
  const [erreur, setErreur] = useState('');
  const depuisId = depuis ?? dossiers?.find((d) => d.genre === 'reception')?.id;

  const ranger = async (d: DossierMail) => {
    setBusy(d.id);
    setErreur('');
    try {
      await api(`/integrations/${compte}/mails/${encodeURIComponent(mailId)}/deplacer`, { method: 'POST', body: { dossier: d.id, ...(depuisId ? { depuis: depuisId } : {}) }, token: session?.token });
      oublierDossiers();
      synchroniser(false, true).catch(() => {});
      onFini(d.nom);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <View style={{ gap: 6, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, color: C.muted, fontFamily: F.texteF, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>Déplacer vers</Text>
        <Pressable accessibilityRole="button" onPress={onAnnuler} hitSlop={8}>
          <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 13.5 }}>Annuler</Text>
        </Pressable>
      </View>
      {!dossiers ? (
        <ZoneSquelette label="Chargement des dossiers">
          <Bloc h={26} r={8} />
          <Bloc h={26} r={8} />
        </ZoneSquelette>
      ) : null}
      {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
      <View style={{ maxHeight: 280 }}>
        <ScrollView>
          {dossiers
            ? destinations(arbreDossiers(dossiers), depuisId).map((d) => (
                <LigneDossier key={d.id} label={busy === d.id ? `${d.nom}…` : d.nom} icone={ICONE_DOSSIER[d.genre]} retrait={d.profondeur} on={false} onPress={() => !busy && ranger(d)} />
              ))
            : null}
        </ScrollView>
      </View>
      {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
    </View>
  );
}
