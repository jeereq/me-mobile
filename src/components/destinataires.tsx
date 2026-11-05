import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/texte';

import { api } from '@/lib/api';
import { refExterne } from '@/lib/externe';
import { avecPieces } from '@/lib/pieces-mail';
import { adresseSaisie, choixDest, etatDepuisChoix, personnesChoisies, resumePersonnes, type Ajoute, type ChoixDest, type Destinataires, type EtatDest, type Mail, type Personne } from '@/lib/mails';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

import { SaisieLigne } from './mail-ui';
import { ListePersonnes, usePersonnes } from './saisie-personnes';
import { Btn, Seg, T } from './ui';

// Qui est sur un mail change peu : lu une fois par mail, le temps de la session.
const lus = new Map<string, Promise<Destinataires>>();

export function lireDestinataires(mail: Mail, token: string): Promise<Destinataires> {
  const ref = refExterne(mail.id);
  if (!ref) return Promise.reject(new Error('Ce mail ne vient pas d’un compte connecté.'));
  const enCours = lus.get(mail.id);
  if (enCours) return enCours;
  const p = api<Destinataires>(`/integrations/${ref.compte}/mails/${encodeURIComponent(ref.element)}/destinataires`, { token });
  lus.set(mail.id, p);
  p.catch(() => lus.delete(mail.id));
  return p;
}

export function useDestinataires(mail: Mail) {
  const { session } = useStore();
  const token = session?.token;
  const [d, setD] = useState<Destinataires | null>(null);
  useEffect(() => {
    if (!token) return;
    let vivant = true;
    lireDestinataires(mail, token)
      .then((x) => vivant && setD(x))
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [mail, token]);
  return { d };
}

/** « Envoyer à Paul, Ana et 2 autres ? » */
export function QuiRecoit({ mail, choix, pieces = 0 }: { mail: Mail; choix: ChoixDest; pieces?: number }) {
  const { d } = useDestinataires(mail);
  const noms = d ? resumePersonnes(personnesChoisies(d, choix)) : '';
  return <T small>{`Envoyer à ${noms || mail.contact || 'ce contact'}${avecPieces(pieces)} ?`}</T>;
}

const nomDe = (p: Personne) => p.nom?.trim() || p.adresse;
const stylePastille = { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1 } as const;

/** Répondre à tous, en retirant quelqu'un si besoin, ou à une seule personne, et ajouter quelqu'un à la boucle. Sans choix, toutes les personnes du mail restent. */
export function ChoixDestinataires({ mail, valeur, onChange }: { mail: Mail; valeur: ChoixDest; onChange: (v: ChoixDest) => void }) {
  const { d } = useDestinataires(mail);
  if (!d) return null;
  return <Choix d={d} valeur={valeur} onChange={onChange} />;
}

function Choix({ d, valeur, onChange }: { d: Destinataires; valeur: ChoixDest; onChange: (v: ChoixDest) => void }) {
  const toutes = [...d.a, ...d.cc];
  const [etat, setEtat] = useState<EtatDest>(() => etatDepuisChoix(d, valeur));
  const [ajout, setAjout] = useState(false);
  const [saisie, setSaisie] = useState('');
  const [msg, setMsg] = useState('');
  const { retires, une, ajoutes } = etat;
  const changer = (e: EtatDest) => {
    setEtat(e);
    onChange(choixDest(d, e));
  };

  const presentes = [...toutes.map((p) => p.adresse), ...ajoutes.map((p) => p.adresse)];
  const fermerAjout = () => {
    setAjout(false);
    setSaisie('');
    setMsg('');
  };
  const ajouter = (adresse: string | null, copie: boolean, nom?: string) => {
    if (!adresse) return setMsg('Adresse invalide.');
    if (presentes.some((y) => y.toLowerCase() === adresse.toLowerCase())) return setMsg('Déjà dans la boucle.');
    changer({ ...etat, ajoutes: [...ajoutes, { adresse, copie, ...(nom ? { nom } : {}) }] });
    fermerAjout();
  };
  const { liste, actif, surTouche } = usePersonnes(saisie, presentes, (p) => ajouter(p.adresse, false, p.nom));
  // Le champ est en bas du formulaire : les propositions qui s'ouvrent dessous doivent rester visibles.
  const cadreAjout = useRef<View>(null);
  const proposees = liste.length;
  useEffect(() => {
    if (Platform.OS === 'web' && proposees) (cadreAjout.current as unknown as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
  }, [proposees]);

  const restants = une ? 1 + ajoutes.length : toutes.length - retires.length + ajoutes.length;
  const pastille = (p: Personne, enCopie: boolean) => {
    const retire = retires.includes(p.adresse);
    return (
      <Pressable
        key={p.adresse}
        accessibilityRole="button"
        accessibilityLabel={retire ? `Remettre ${nomDe(p)}` : `Retirer ${nomDe(p)}`}
        // Une réponse a toujours au moins un destinataire.
        disabled={!retire && restants <= 1}
        onPress={() => changer({ ...etat, retires: retire ? retires.filter((x) => x !== p.adresse) : [...retires, p.adresse] })}
        style={({ pressed }) => ({ ...stylePastille, borderColor: retire ? C.line : alpha(C.accent, 0.4), backgroundColor: pressed ? alpha(C.ink, 0.06) : retire ? 'transparent' : alpha(C.accent, C.sombre ? 0.12 : 0.08), opacity: retire ? 0.7 : 1 })}>
        {enCopie ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 11.5 }}>Cc</Text> : null}
        <Text numberOfLines={1} style={{ flexShrink: 1, color: retire ? C.muted : C.ink, fontFamily: F.texteM, fontSize: 13, textDecorationLine: retire ? 'line-through' : 'none' }}>
          {nomDe(p)}
        </Text>
        {restants > 1 || retire ? <Text style={{ color: C.muted, fontSize: 12 }}>{retire ? '+' : '✕'}</Text> : null}
      </Pressable>
    );
  };
  const pastilleAjoutee = (p: Ajoute) => (
    <Pressable
      key={p.adresse}
      accessibilityRole="button"
      accessibilityLabel={`Retirer ${nomDe(p)}`}
      disabled={restants <= 1}
      onPress={() => changer({ ...etat, ajoutes: ajoutes.filter((x) => x !== p) })}
      style={({ pressed }) => ({ ...stylePastille, borderColor: alpha(C.coach, 0.5), backgroundColor: pressed ? alpha(C.ink, 0.06) : alpha(C.coach, C.sombre ? 0.12 : 0.08) })}>
      {p.copie ? <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 11.5 }}>Cc</Text> : null}
      <Text numberOfLines={1} style={{ flexShrink: 1, color: C.ink, fontFamily: F.texteM, fontSize: 13 }}>
        {nomDe(p)}
      </Text>
      {restants > 1 ? <Text style={{ color: C.muted, fontSize: 12 }}>✕</Text> : null}
    </Pressable>
  );

  return (
    <View style={{ gap: 8 }}>
      {toutes.length > 1 ? (
        <Seg
          label="Répondre à"
          options={[{ key: 'tous', label: `Tous · ${toutes.length + ajoutes.length}` }, { key: 'une', label: 'Une personne' }]}
          value={une ? 'une' : 'tous'}
          onChange={(m: 'tous' | 'une') => changer({ ...etat, une: m === 'une' ? toutes[0].adresse : null })}
        />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {!une ? d.a.map((p) => pastille(p, false)) : null}
        {!une ? d.cc.map((p) => pastille(p, true)) : null}
        {une
          ? toutes.map((p) => {
              const on = une.toLowerCase() === p.adresse.toLowerCase();
              return (
                <Pressable key={p.adresse} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => changer({ ...etat, une: p.adresse })} style={({ pressed }) => ({ maxWidth: '100%', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: pressed ? alpha(C.ink, 0.06) : on ? alpha(C.accent, C.sombre ? 0.16 : 0.1) : 'transparent' })}>
                  <Text numberOfLines={1} style={{ color: on ? C.accent : C.ink, fontFamily: F.texteM, fontSize: 13 }}>
                    {nomDe(p)}
                  </Text>
                </Pressable>
              );
            })
          : null}
        {ajoutes.map(pastilleAjoutee)}
        {!ajout ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Ajouter quelqu'un" onPress={() => setAjout(true)} style={({ pressed }) => ({ ...stylePastille, borderStyle: 'dashed', borderColor: C.line, backgroundColor: pressed ? alpha(C.ink, 0.06) : 'transparent' })}>
            <Text style={{ color: C.accent, fontFamily: F.texteM, fontSize: 13 }}>+ Ajouter</Text>
          </Pressable>
        ) : null}
      </View>
      {ajout ? (
        <View ref={cadreAjout} style={{ gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.sunk }}>
          <SaisieLigne
            autoFocus
            value={saisie}
            onChangeText={(v: string) => {
              setSaisie(v);
              setMsg('');
            }}
            onSubmitEditing={() => (liste[actif] ? ajouter(liste[actif].adresse, false, liste[actif].nom) : ajouter(adresseSaisie(saisie), false))}
            onKeyPress={surTouche}
            accessibilityLabel="Adresse à ajouter"
            placeholder="Nom ou adresse"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={{ paddingVertical: 6 }}
          />
          <View style={{ marginHorizontal: -10 }}>
            <ListePersonnes
              liste={liste}
              actif={actif}
              droite={(p) => (
                <>
                  <Btn small kind="sec" label="À" onPress={() => ajouter(p.adresse, false, p.nom)} />
                  <Btn small kind="sec" label="Cc" onPress={() => ajouter(p.adresse, true, p.nom)} />
                </>
              )}
            />
          </View>
          {msg ? <T small style={{ color: C.agressif }}>{msg}</T> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn small label="Ajouter" disabled={!saisie.trim()} onPress={() => ajouter(adresseSaisie(saisie), false)} />
            <Btn small kind="sec" label="En copie" disabled={!saisie.trim()} onPress={() => ajouter(adresseSaisie(saisie), true)} />
            <Btn small kind="sec" label="Annuler" onPress={fermerAjout} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
