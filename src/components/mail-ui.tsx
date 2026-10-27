import type { ReactNode } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { initiales, nomBoite, quandCourt, teinteContact, type Mail } from '@/lib/mails';
import { alpha, C, COULEURS, F } from '@/lib/theme';

import { Icone, type IconeNom } from './icones';

/**
 * Les briques des écrans de mail, dans l'esprit d'Outlook : avatar du contact, ligne de la liste,
 * boutons de la barre d'outils et champs « À », « Objet » posés en lignes.
 */

const palette = () => [COULEURS.accent, COULEURS.normal, COULEURS.coach, COULEURS.hebdo, COULEURS.agressif, COULEURS.passif];
export const couleurContact = (nom: string) => {
  const p = palette();
  return p[teinteContact(nom || '?', p.length)];
};

export const nomService = (m: Pick<Mail, 'source'>) => (m.source === 'outlook' ? 'Outlook' : 'Gmail');

/** Couleurs des étiquettes, par nom en minuscules : celles du service (Gmail, Outlook) quand il en donne. */
export type CouleursLibelles = Record<string, string>;
/** La couleur d'une étiquette : celle du service, sinon toujours la même teinte de la palette pour un même nom. */
export const couleurLibelle = (nom: string, couleurs?: CouleursLibelles) => couleurs?.[nom.toLowerCase()] ?? couleurContact(`#${nom}`);

/** Une étiquette posée sur un mail : pastille de sa couleur et nom ; `onRetirer` ajoute la croix pour l'ôter. */
export function PuceLibelle({ nom, couleurs, petit, onRetirer }: { nom: string; couleurs?: CouleursLibelles; petit?: boolean; onRetirer?: () => void }) {
  const c = couleurLibelle(nom, couleurs);
  const contenu = (
    <>
      <View style={{ width: petit ? 6 : 8, height: petit ? 6 : 8, borderRadius: 4, backgroundColor: c }} />
      <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteM, fontSize: petit ? 11 : 12.5 }}>
        {nom}
      </Text>
      {onRetirer ? <Text style={{ color: C.muted, fontFamily: F.texteF, fontSize: 13, marginLeft: 2 }}>×</Text> : null}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, maxWidth: 180, paddingHorizontal: petit ? 6 : 9, paddingVertical: petit ? 1 : 4, borderRadius: 999, backgroundColor: alpha(c, 0.16), borderWidth: 1, borderColor: alpha(c, 0.35) };
  if (!onRetirer) return <View style={style}>{contenu}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Retirer l'étiquette ${nom}`} onPress={onRetirer} style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}>
      {contenu}
    </Pressable>
  );
}

/** Le badge d'une boîte partagée (« Ventes · partagée ») : un mail qui n'arrive pas dans ta boîte à toi se voit. */
export function BadgeBoite({ adresse }: { adresse: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: alpha(COULEURS.coach, 0.16) }}>
      <Icone nom="equipe" color={COULEURS.coach} size={11} />
      <Text numberOfLines={1} style={{ color: COULEURS.coach, fontFamily: F.texteM, fontSize: 10.5 }}>
        {nomBoite(adresse)}
      </Text>
    </View>
  );
}

/** Rond aux initiales du contact, d'une couleur qui ne change pas d'un écran à l'autre. */
export function Avatar({ nom, taille = 36 }: { nom: string; taille?: number }) {
  const c = couleurContact(nom);
  return (
    <View style={{ width: taille, height: taille, borderRadius: taille / 2, backgroundColor: alpha(c, 0.2), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c, fontFamily: F.texteF, fontSize: taille * 0.38 }}>{initiales(nom)}</Text>
    </View>
  );
}

/**
 * Une ligne de la liste : avatar, expéditeur et heure, objet, extrait, puis compte ou boîte partagée et étiquettes.
 * Un fil non lu porte la barre et le gras ; un trombone dit qu'il y a des pièces jointes.
 */
export function LigneMail({ m, aujourdhui, choisi, couleurSource, couleurs, onPress }: { m: Mail; aujourdhui: string; choisi?: boolean; couleurSource: string; couleurs?: CouleursLibelles; onPress: () => void }) {
  const nonLu = !!m.nonLu;
  const libelles = m.libelles ?? [];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!choisi }}
      accessibilityLabel={`${nonLu ? 'Non lu, ' : ''}${m.contact || 'Sans expéditeur'}, ${m.sujet}, ${quandCourt(m, aujourdhui)}${m.boite ? `, boîte partagée ${m.boite}` : ''}${libelles.length ? `, étiquettes ${libelles.join(', ')}` : ''}`}
      onPress={onPress}
      style={(e) => {
        const survol = (e as { hovered?: boolean }).hovered;
        return {
          flexDirection: 'row',
          gap: 12,
          paddingVertical: 11,
          paddingLeft: 10,
          paddingRight: 12,
          borderLeftWidth: 3,
          borderLeftColor: nonLu ? C.accent : 'transparent',
          borderRadius: 10,
          backgroundColor: choisi ? alpha(C.accent, 0.16) : e.pressed ? alpha(C.ink, 0.08) : survol ? alpha(C.ink, 0.04) : 'transparent',
        };
      }}>
      <Avatar nom={m.contact || m.adresse || '?'} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontFamily: nonLu ? F.texteF : F.texteM, fontSize: 15 }}>
            {m.contact || 'Sans expéditeur'}
          </Text>
          {m.pj ? <Icone nom="trombone" color={C.muted} size={14} /> : null}
          <Text style={{ color: nonLu ? C.accent : C.muted, fontFamily: nonLu ? F.texteF : F.texte, fontSize: 12 }}>{quandCourt(m, aujourdhui)}</Text>
        </View>
        <Text numberOfLines={1} style={{ color: nonLu ? C.ink : alpha(C.ink, 0.78), fontFamily: nonLu ? F.texteM : F.texte, fontSize: 14 }}>
          {m.sujet}
        </Text>
        {m.extrait ? (
          <Text numberOfLines={1} style={{ color: C.muted, fontFamily: F.texte, fontSize: 13 }}>
            {m.extrait}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: couleurSource }} />
          <Text numberOfLines={1} style={{ flexShrink: 1, maxWidth: 190, color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
            {nomService(m)}
            {m.boite ? '' : m.compte ? ` · ${m.compte}` : ''}
          </Text>
          {m.boite ? <BadgeBoite adresse={m.boite} /> : null}
          {m.ctx === 'pro' && !m.boite ? (
            <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: alpha(C.muted, 0.16) }}>
              <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 10.5 }}>Pro</Text>
            </View>
          ) : null}
          {libelles.slice(0, 3).map((l) => (
            <PuceLibelle key={l} nom={l} couleurs={couleurs} petit />
          ))}
          {libelles.length > 3 ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 11 }}>+{libelles.length - 3}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Un bouton de la barre d'outils : icône et libellé ; `principal` pour l'action attendue (Répondre, Envoyer). */
export function Outil({ icone, label, onPress, principal, disabled, masquerLabel }: { icone?: IconeNom; label: string; onPress: () => void; principal?: boolean; disabled?: boolean; /** Icône seule (barre étroite) : le libellé reste lu par le lecteur d'écran. */ masquerLabel?: boolean }) {
  const fond = principal ? C.accent : 'transparent';
  const texte = principal ? C.accentInk : C.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={(e) => {
        const survol = (e as { hovered?: boolean }).hovered;
        return {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          height: 36,
          paddingHorizontal: masquerLabel ? 9 : 12,
          borderRadius: 10,
          borderWidth: principal ? 0 : 1,
          borderColor: C.line,
          backgroundColor: principal ? fond : e.pressed || survol ? alpha(C.ink, 0.06) : 'transparent',
          opacity: disabled ? 0.45 : e.pressed && principal ? 0.85 : 1,
        };
      }}>
      {icone ? <Icone nom={icone} color={texte} size={17} /> : null}
      {masquerLabel ? null : <Text style={{ color: texte, fontFamily: F.texteM, fontSize: 13.5 }}>{label}</Text>}
    </Pressable>
  );
}

/** Une ligne du formulaire d'un mail : le libellé à gauche (« À », « Objet »), la saisie ou la valeur à droite, un trait dessous. */
export function ChampLigne({ label, children, droite, dernier }: { label: string; children: ReactNode; droite?: ReactNode; dernier?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 14, borderBottomWidth: dernier ? 0 : 1, borderBottomColor: C.line }}>
      <Text style={{ width: 48, color: C.muted, fontFamily: F.texteM, fontSize: 13.5 }}>{label}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {droite}
    </View>
  );
}

/** La saisie d'un champ en ligne : sans cadre, le cadre est celui du formulaire. */
export function SaisieLigne(props: TextInputProps) {
  const { style, ...rest } = props;
  return <TextInput placeholderTextColor={C.muted} selectionColor={C.accent} style={[{ color: C.ink, fontFamily: F.texte, fontSize: 15, paddingVertical: 11, outlineStyle: 'none' } as object, style]} {...rest} />;
}

/** Le cadre du formulaire : champs en lignes, puis le texte du message. */
export function CadreMail({ children }: { children: ReactNode }) {
  return <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 14, backgroundColor: C.sunk, overflow: 'hidden' }}>{children}</View>;
}

/** Le texte du message, grand et sans cadre, sous les champs. */
export function CorpsMail(props: TextInputProps) {
  const { style, ...rest } = props;
  return (
    <TextInput
      multiline
      placeholderTextColor={C.muted}
      selectionColor={C.accent}
      textAlignVertical="top"
      style={[{ minHeight: 200, padding: 14, color: C.ink, fontFamily: F.texte, fontSize: 15, lineHeight: 22, borderTopWidth: 1, borderTopColor: C.line, outlineStyle: 'none' } as object, style]}
      {...rest}
    />
  );
}
