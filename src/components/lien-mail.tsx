import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { today } from '@/lib/dates';
import { SOURCE_DEFS } from '@/lib/defaults';
import { api } from '@/lib/api';
import { cleFil, delier, ecarter, liesAuMail, lier, mailDuLien, mailSuggere, refLien, relanceDepuisMail, suggestionsPourMail, tacheDepuisMail, type GenreLie } from '@/lib/liens-mail';
import { filtrerMails, type Mail } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { LienMail, Relance, SourceKey, Tache } from '@/lib/types';

import { Icone } from './icones';
import { LigneMail, Outil } from './mail-ui';
import { couleur, Dialogue, Empty, Input, tap } from './ui';

/**
 * Le lien entre une relance ou une tâche et son mail, des deux côtés :
 * sous l'élément, la puce du mail (l'ouvrir, délier) ou la proposition de rattachement ;
 * dans le mail, ce qui s'y rattache, ce qui semble s'y rattacher, et de quoi créer une relance ou une tâche.
 */

/**
 * Ouvre le mail dans Me : depuis la boîte s'il y est encore, sinon relu par son fil chez Gmail ou Outlook
 * (un mail envoyé qui attend sa réponse, un mail rangé dans un dossier). Le site du service ne sert qu'en dernier recours.
 */
export function ouvrirLien(l: LienMail, mails: Mail[], comptes: string[]) {
  const m = mailDuLien(l, mails);
  const r = refLien(l);
  if (m) router.push({ pathname: '/messages', params: { lire: m.id } } as never);
  else if (r && comptes.includes(r.compte)) router.push({ pathname: '/messages', params: { fil: l.fil } } as never);
  else if (l.lien) Linking.openURL(l.lien).catch(() => {});
}

/** Le mail d'un fil qui n'est plus dans la boîte de Me, relu chez le service (`compte:fil`) ; rien tant qu'il n'est pas demandé. */
export function useMailDuFil(cle: string | undefined, mails: Mail[]) {
  const { session } = useStore();
  const token = session?.token;
  const present = cle ? mails.some((m) => cleFil(m) === cle) : true;
  const [etat, setEtat] = useState<{ cle: string; mail?: Mail; msg?: string } | null>(null);
  useEffect(() => {
    const r = refLien(cle ? { fil: cle } : undefined);
    if (!r || present || !token || etat?.cle === cle) return;
    let fini = false;
    api<{ mail: Mail }>(`/integrations/${r.compte}/fils/${encodeURIComponent(r.fil)}`, { token })
      .then((x) => !fini && setEtat({ cle: cle!, mail: x.mail }))
      .catch((e) => !fini && setEtat({ cle: cle!, msg: (e as Error).message }));
    return () => {
      fini = true;
    };
  }, [cle, present, token, etat?.cle]);
  const courant = etat?.cle === cle ? etat : null;
  return { mail: courant?.mail ?? null, msg: courant?.msg ?? '', charge: !!cle && !present && !courant };
}

/** Un petit bouton texte (Lier, Non, Délier). */
function Lien({ label, onPress, fort, a11y }: { label: string; onPress: () => void; fort?: boolean; a11y?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      hitSlop={8}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: fort ? alpha(C.accent, pressed ? 0.28 : 0.18) : pressed ? alpha(C.ink, 0.08) : 'transparent' })}>
      <Text style={{ color: fort ? C.accent : C.muted, fontFamily: F.texteF, fontSize: 12.5 }}>{label}</Text>
    </Pressable>
  );
}

/** Le mail d'un élément, sous son titre : l'objet et le contact ; toucher l'ouvre. */
export function PuceMail({ l, onDelier }: { l: LienMail; onDelier?: () => void }) {
  const { mails, espace, externes } = useStore();
  const comptes = externes.map((x) => x.id);
  const ref = refLien(l);
  const peutOuvrir = !!mailDuLien(l, mails) || (!!ref && comptes.includes(ref.compte)) || !!l.lien;
  const src = l.source ? couleur(espace.sources[l.source as SourceKey]?.couleur || SOURCE_DEFS[l.source as SourceKey]?.couleur) : C.accent;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Ouvrir le mail ${l.sujet}${l.contact ? ` de ${l.contact}` : ''}`}
        disabled={!peutOuvrir}
        onPress={() => ouvrirLien(l, mails, comptes)}
        style={({ pressed }) => ({ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 7, paddingRight: 9, borderRadius: 8, borderWidth: 1, borderColor: alpha(src, 0.45), backgroundColor: alpha(src, pressed ? 0.2 : 0.1) })}>
        <Icone nom="mail" color={src} size={13} />
        <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteM, fontSize: 12.5 }}>
          {l.sujet}
          {l.contact ? <Text style={{ color: C.muted, fontFamily: F.texte }}> · {l.contact}</Text> : null}
        </Text>
        {peutOuvrir ? <Icone nom="ouvrir" color={C.muted} size={12} /> : null}
      </Pressable>
      {onDelier ? <Lien label="Délier" a11y="Détacher ce mail" onPress={onDelier} /> : null}
    </View>
  );
}

/** Sous une relance ou une tâche : son mail, ou celui qui semble lié (Lier / Non). */
export function MailDeLElement({ genre, x, compact }: { genre: GenreLie; x: Relance | Tache; compact?: boolean }) {
  const { mails, update } = useStore();
  const el = genre === 'relance' ? { genre, r: x as Relance } : { genre, t: x as Tache };
  const suggere = useMemo(() => (compact ? null : mailSuggere(el as never, mails)), [compact, x, mails]); // eslint-disable-line react-hooks/exhaustive-deps
  if (x.mail) return <PuceMail l={x.mail} onDelier={compact ? undefined : () => update((e) => delier(e, genre, x.id))} />;
  if (!suggere) return null;
  const { mail: m, raison } = suggere;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: alpha(C.accent, 0.5) }}>
      <View style={{ paddingTop: 2 }}>
        <Icone nom="mail" color={C.accent} size={14} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text numberOfLines={3} style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5, lineHeight: 17 }}>
          Lier au mail <Text style={{ color: C.ink, fontFamily: F.texteM }}>« {m.sujet} »</Text> de {m.contact || 'ce contact'} ?
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8 }}>
          <Lien fort label="Lier" a11y={`Lier au mail ${m.sujet}`} onPress={() => update((e) => lier(e, genre, x.id, m))} />
          <Lien label="Non" a11y="Ce n'est pas lié" onPress={() => update((e) => ecarter(e, genre, x.id, m))} />
          <Text numberOfLines={1} style={{ flexShrink: 1, color: C.muted, fontFamily: F.texte, fontSize: 11.5 }}>
            {raison}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Choisir à la main le mail d'une relance ou d'une tâche, parmi les fils récents. */
export function ChoisirMail({ genre, x, onFermer }: { genre: GenreLie; x: Relance | Tache; onFermer: () => void }) {
  const { mails, update, espace } = useStore();
  const [q, setQ] = useState('');
  const liste = filtrerMails(mails, { q });
  const d = today();
  return (
    <Dialogue titre="Lier à un mail" onFermer={onFermer} large>
      <Input value={q} onChangeText={setQ} placeholder="Rechercher un contact ou un objet" accessibilityLabel="Rechercher un mail" autoFocus />
      <View>
        {liste.map((m) => (
          <LigneMail
            key={m.id}
            m={m}
            aujourdhui={d}
            choisi={x.mail?.fil === cleFil(m)}
            couleurSource={couleur(espace.sources[m.source as SourceKey]?.couleur || SOURCE_DEFS[m.source as SourceKey]?.couleur)}
            onPress={() => {
              update((e) => lier(e, genre, x.id, m));
              onFermer();
            }}
          />
        ))}
        {!mails.length ? <Empty icone="mail">Aucun mail récent. Connecte Gmail ou Outlook et coche « Mails » dans Agendas & outils.</Empty> : !liste.length ? <Empty icone="mail">Aucun mail ne correspond.</Empty> : null}
      </View>
    </Dialogue>
  );
}

/** Dans un mail : les relances et tâches qui s'y rattachent, celles qui semblent s'y rattacher, et de quoi en créer. */
export function SuiviMail({ mail }: { mail: Mail }) {
  const { espace, update, config } = useStore();
  const lies = liesAuMail(mail, espace);
  const suggestions = suggestionsPourMail(mail, espace);
  const aRelance = lies.some((x) => x.genre === 'relance' && !x.fait);

  const ouvrir = (g: GenreLie) => router.push(g === 'relance' ? '/relances' : '/taches');
  return (
    <View accessibilityLabel="Relances et tâches liées à ce mail" style={{ gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, color: C.muted, fontFamily: F.texteF, fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>Suivi</Text>
        {!aRelance ? <Outil icone="relances" label="Relance" onPress={() => update((e) => ({ ...e, relances: [...e.relances, relanceDepuisMail(mail, config)] }))} /> : null}
        <Outil icone="taches" label="Tâche" onPress={() => update((e) => ({ ...e, taches: [...e.taches, tacheDepuisMail(mail, config)] }))} />
      </View>

      {lies.map((x) => (
        <View key={`${x.genre}-${x.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icone nom={x.genre === 'relance' ? 'relances' : 'taches'} color={x.fait ? C.muted : C.accent} size={16} />
          <Pressable accessibilityRole="link" accessibilityLabel={`Voir ${x.genre === 'relance' ? 'la relance' : 'la tâche'} ${x.titre}`} onPress={() => ouvrir(x.genre)} style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: x.fait ? C.muted : C.ink, fontFamily: F.texteM, fontSize: 14, textDecorationLine: x.fait ? 'line-through' : 'none' }}>
              {x.titre}
            </Text>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>{x.genre === 'relance' ? (x.fait ? 'Relance · répondu' : 'Relance') : x.fait ? 'Tâche · faite' : 'Tâche'}</Text>
          </Pressable>
          <Lien label="Délier" a11y={`Détacher ${x.titre} de ce mail`} onPress={() => update((e) => delier(e, x.genre, x.id))} />
        </View>
      ))}

      {suggestions.map((s) => (
        <View key={`s-${s.genre}-${s.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, paddingLeft: 8, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: alpha(C.accent, 0.5) }}>
          <Icone nom={s.genre === 'relance' ? 'relances' : 'taches'} color={C.muted} size={16} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>
              {s.titre}
            </Text>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
              {s.genre === 'relance' ? 'Relance' : 'Tâche'} à lier ? {s.raison.toLowerCase()}
            </Text>
          </View>
          <Lien fort label="Lier" a11y={`Lier ${s.titre} à ce mail`} onPress={() => update((e) => lier(e, s.genre, s.id, mail))} />
          <Lien label="Non" a11y={`${s.titre} n'est pas lié`} onPress={() => update((e) => ecarter(e, s.genre, s.id, mail))} />
        </View>
      ))}

      {!lies.length && !suggestions.length ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>Rien n'est rattaché à ce mail. Crée une relance ou une tâche liée, elle t'y ramènera.</Text> : null}
    </View>
  );
}
