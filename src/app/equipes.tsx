import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Btn, Colonnes, Dialogue, Empty, Header, IconBtn, Input, Panel, Screen, Sep, T } from '@/components/ui';
import { ReservePro } from '@/components/reserve-pro';
import { fmtCourt } from '@/lib/dates';
import { AIDE_ROLE, lienAbsolu, NOM_ROLE, peutGererEquipe, type Equipe, type MembreEquipe, type RoleEquipe } from '@/lib/equipes';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';

const EMOJIS = ['👥', '🏠', '🚀', '💼', '🎓', '⚽', '🎸', '🍽️', '🧡', '🛠️'];

/** Les rôles proposés à l'invitation et au changement : on ne nomme un propriétaire qu'une fois la personne arrivée. */
const ROLES_INVITATION: RoleEquipe[] = ['MEMBRE', 'LECTEUR'];

function ChoixRole({ value, onChange, options }: { value: RoleEquipe; onChange: (r: RoleEquipe) => void; options: RoleEquipe[] }) {
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
      {options.map((r) => {
        const on = r === value;
        return (
          <Pressable
            key={r}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(r)}
            style={{ gap: 2, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: on ? C.accent : C.line, backgroundColor: on ? alpha(C.accent, 0.12) : 'transparent' }}>
            <Text style={{ color: on ? C.accent : C.ink, fontFamily: F.texteF, fontSize: 14 }}>{NOM_ROLE[r]}</Text>
            <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12.5, lineHeight: 18 }}>{AIDE_ROLE[r]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Création ou renommage d'une équipe. */
function FormEquipe({ init, onDone }: { init?: Equipe; onDone: () => void }) {
  const { creerEquipe, renommerEquipe, choisirPortee } = useStore();
  const [nom, setNom] = useState(init?.nom ?? '');
  const [emoji, setEmoji] = useState(init?.emoji ?? EMOJIS[0]);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const enregistrer = async () => {
    if (!nom.trim() || enCours) return;
    setEnCours(true);
    setErreur('');
    try {
      if (init) await renommerEquipe(init.id, { nom: nom.trim(), emoji });
      else choisirPortee({ type: 'equipe', id: await creerEquipe(nom.trim(), emoji) });
      onDone();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible pour le moment.');
      setEnCours(false);
    }
  };

  return (
    <Dialogue titre={init ? "Modifier l'équipe" : 'Nouvelle équipe'} onFermer={onDone}>
      <Input label="Nom" value={nom} onChangeText={setNom} placeholder="Ex. Maison, Studio Nova, Colocation" autoFocus={!init} returnKeyType="done" onSubmitEditing={enregistrer} erreur={erreur} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {EMOJIS.map((x) => (
          <Pressable
            key={x}
            accessibilityRole="radio"
            aria-checked={x === emoji}
            accessibilityLabel={`Icône ${x}`}
            onPress={() => setEmoji(x)}
            style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: x === emoji ? C.accent : C.line, backgroundColor: x === emoji ? alpha(C.accent, 0.14) : 'transparent' }}>
            <Text style={{ fontSize: 18 }}>{x}</Text>
          </Pressable>
        ))}
      </View>
      {init ? null : <T small muted>Tu seras propriétaire de l’équipe, et tu pourras y inviter qui tu veux.</T>}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={init ? 'Enregistrer' : "Créer l'équipe"} onPress={enregistrer} disabled={!nom.trim() || enCours} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
      </View>
    </Dialogue>
  );
}

/** Invitation par email : le serveur envoie le lien, ou le rend ici quand les emails ne sont pas configurés. */
function FormInvitation({ equipe, onDone }: { equipe: Equipe; onDone: () => void }) {
  const { inviterEquipe } = useStore();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleEquipe>('MEMBRE');
  const [erreur, setErreur] = useState('');
  const [lien, setLien] = useState('');
  const [copie, setCopie] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const inviter = async () => {
    if (!email.trim() || enCours) return;
    setEnCours(true);
    setErreur('');
    try {
      const r = await inviterEquipe(equipe.id, email.trim(), role);
      if (r.lien) setLien(lienAbsolu(r.lien));
      else onDone();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible pour le moment.');
    }
    setEnCours(false);
  };

  if (lien)
    return (
      <Dialogue titre="À transmettre toi-même" onFermer={onDone}>
        <T small muted>Ce serveur n’envoie pas d’emails. Donne ce lien à {email.trim()} : il est valable 7 jours et ne sert qu’une fois.</T>
        <View style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg }}>
          <Text selectable style={{ color: C.ink, fontFamily: F.texte, fontSize: 12.5, lineHeight: 19 }}>{lien}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn
            label={copie ? 'Copié' : 'Copier le lien'}
            onPress={async () => {
              await Clipboard.setStringAsync(lien);
              setCopie(true);
            }}
          />
          <Btn kind="sec" label="Fermer" onPress={onDone} />
        </View>
      </Dialogue>
    );

  return (
    <Dialogue titre={`Inviter dans ${equipe.nom}`} onFermer={onDone}>
      <Input label="Adresse email" value={email} onChangeText={setEmail} placeholder="paul@exemple.fr" autoCapitalize="none" keyboardType="email-address" autoFocus returnKeyType="send" onSubmitEditing={inviter} erreur={erreur} aide="La personne devra ouvrir le lien avec un compte Me qui porte cette adresse." />
      <T small muted>Son rôle</T>
      <ChoixRole value={role} onChange={setRole} options={ROLES_INVITATION} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Envoyer l'invitation" onPress={inviter} disabled={!email.trim() || enCours} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
      </View>
    </Dialogue>
  );
}

/** Changer le rôle de quelqu'un, ou le retirer de l'équipe. */
function FormMembre({ equipe, membre, onDone }: { equipe: Equipe; membre: MembreEquipe; onDone: () => void }) {
  const { changerRoleEquipe, retirerDeLEquipe, profil } = useStore();
  const [role, setRole] = useState<RoleEquipe>(membre.role);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const moi = membre.id === profil?.id;

  const lancer = async (faire: () => Promise<void>) => {
    if (enCours) return;
    setEnCours(true);
    setErreur('');
    try {
      await faire();
      onDone();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Impossible pour le moment.');
      setEnCours(false);
    }
  };

  return (
    <Dialogue titre={moi ? 'Mon rôle' : membre.nom || membre.email} onFermer={onDone}>
      <T small muted>{membre.email}</T>
      <ChoixRole value={role} onChange={setRole} options={['PROPRIETAIRE', 'MEMBRE', 'LECTEUR']} />
      {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Enregistrer le rôle" onPress={() => lancer(() => changerRoleEquipe(equipe.id, membre.id, role))} disabled={role === membre.role || enCours} />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
      </View>
      <Sep />
      <Btn kind="danger" label={moi ? "Quitter l'équipe" : `Retirer ${membre.nom || membre.email}`} onPress={() => lancer(() => retirerDeLEquipe(equipe.id, membre.id))} disabled={enCours} />
      <T small muted>{moi ? 'Tu ne verras plus ce que l’équipe partage. On pourra t’inviter à nouveau.' : 'Cette personne ne verra plus ce que l’équipe partage.'}</T>
    </Dialogue>
  );
}

function Confirmation({ equipe, onDone }: { equipe: Equipe; onDone: () => void }) {
  const { supprimerEquipe } = useStore();
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  return (
    <Dialogue titre={`Supprimer ${equipe.nom} ?`} onFermer={onDone}>
      <T small muted>Tout ce que l’équipe partage (budgets, projets, tâches, habitudes) sera supprimé pour tous ses membres. Ton espace à toi n’est pas touché.</T>
      {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn
          kind="danger"
          label="Supprimer l'équipe"
          disabled={enCours}
          onPress={async () => {
            setEnCours(true);
            try {
              await supprimerEquipe(equipe.id);
              onDone();
            } catch (e) {
              setErreur(e instanceof Error ? e.message : 'Impossible pour le moment.');
              setEnCours(false);
            }
          }}
        />
        <Btn kind="sec" label="Annuler" onPress={onDone} />
      </View>
    </Dialogue>
  );
}

function Ligne({ titre, detail, droite, onPress }: { titre: string; detail: string; droite?: string; onPress?: () => void }) {
  const contenu = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <T style={{ fontWeight: '600' }}>{titre}</T>
        <T small muted>{detail}</T>
      </View>
      {droite ? <T small style={{ color: C.accent }}>{droite}</T> : null}
      {onPress ? <Text style={{ color: C.accent, fontSize: 20 }}>›</Text> : null}
    </>
  );
  if (!onPress) return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>{contenu}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }, pressed && { opacity: 0.7 }]}>
      {contenu}
    </Pressable>
  );
}

function CarteEquipe({ equipe }: { equipe: Equipe }) {
  const { portee, choisirPortee, profil, annulerInvitation } = useStore();
  const [invitation, setInvitation] = useState(false);
  const [edition, setEdition] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [membre, setMembre] = useState<MembreEquipe | null>(null);
  const gere = peutGererEquipe(equipe.monRole);
  const active = portee.type === 'equipe' && portee.id === equipe.id;

  return (
    <Panel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: alpha(C.accent, 0.35), backgroundColor: alpha(C.accent, 0.1), alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>{equipe.emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontWeight: '600' }}>{equipe.nom}</T>
          <T small muted>
            {equipe.membres.length} membre{equipe.membres.length > 1 ? 's' : ''} · {NOM_ROLE[equipe.monRole].toLowerCase()}
          </T>
        </View>
        {gere ? <IconBtn label="Modifier l'équipe" glyph="✎" onPress={() => setEdition(true)} /> : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <Btn small kind={active ? 'sec' : 'primary'} label={active ? 'Espace affiché' : 'Afficher cet espace'} onPress={() => choisirPortee({ type: 'equipe', id: equipe.id })} disabled={active} />
        {gere ? <Btn small kind="sec" label="Inviter" onPress={() => setInvitation(true)} /> : null}
      </View>

      <Sep />
      <T small muted>Membres</T>
      {equipe.membres.map((m, i) => (
        <View key={m.id}>
          {i ? <Sep /> : null}
          <Ligne
            titre={`${m.nom || m.email}${m.id === profil?.id ? ' (moi)' : ''}`}
            detail={`${m.email} · depuis le ${fmtCourt(m.depuisLe.slice(0, 10))}`}
            droite={NOM_ROLE[m.role]}
            onPress={gere || m.id === profil?.id ? () => setMembre(m) : undefined}
          />
        </View>
      ))}

      {equipe.invitations.length ? (
        <>
          <Sep />
          <T small muted>Invitations en attente</T>
          {equipe.invitations.map((inv) => (
            <View key={inv.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={{ fontWeight: '600' }}>{inv.email}</T>
                <T small muted>
                  {NOM_ROLE[inv.role]} · jusqu’au {fmtCourt(inv.expireLe.slice(0, 10))}
                </T>
              </View>
              <Btn small kind="sec" label="Annuler" onPress={() => void annulerInvitation(equipe.id, inv.id).catch(() => {})} />
            </View>
          ))}
        </>
      ) : null}

      {gere ? (
        <>
          <Sep />
          <Btn small kind="danger" label="Supprimer l'équipe" onPress={() => setSuppression(true)} />
        </>
      ) : null}

      {invitation ? <FormInvitation equipe={equipe} onDone={() => setInvitation(false)} /> : null}
      {edition ? <FormEquipe init={equipe} onDone={() => setEdition(false)} /> : null}
      {suppression ? <Confirmation equipe={equipe} onDone={() => setSuppression(false)} /> : null}
      {membre ? <FormMembre equipe={equipe} membre={membre} onDone={() => setMembre(null)} /> : null}
    </Panel>
  );
}

export default function Equipes() {
  const { equipes, equipesChargees, equipesIndisponibles, portee, choisirPortee, mode, pro } = useStore();
  const [nouvelle, setNouvelle] = useState(false);

  if (mode !== 'cloud')
    return (
      <Screen>
        <Header retour title="Équipes" />
        <Empty icone="equipe">En mode local, tout reste sur cet appareil : il n’y a pas d’autre compte avec qui partager une équipe.</Empty>
      </Screen>
    );

  return (
    <Screen>
      <Header retour eyebrow="Espaces partagés" title="Équipes" right={pro ? <Btn small label="Nouvelle équipe" onPress={() => setNouvelle(true)} /> : undefined} />
      <ReservePro fonction="equipes" />
      <Colonnes
        gauche={
          <View style={{ gap: 16 }}>
            {!equipesChargees ? null : equipesIndisponibles ? (
              <Empty icone="equipe">Ton serveur me-api ne connaît pas encore les équipes. Redéploie-le pour en profiter : tout le reste continue de marcher.</Empty>
            ) : equipes.length ? equipes.map((e) => <CarteEquipe key={e.id} equipe={e} />) : <Empty icone="equipe">Pas encore d’équipe. Une équipe partage ses budgets, ses projets, ses tâches et ses habitudes avec plusieurs comptes ; ton espace à toi reste séparé.</Empty>}
          </View>
        }
        droite={
          <Panel>
            <T style={{ fontWeight: '600' }}>Comment ça marche</T>
            <Sep />
            <Ligne titre="Un espace par équipe" detail="Budgets, projets, tâches et habitudes de l’équipe, à côté des tiens. Tu choisis lequel tu regardes." />
            <Sep />
            <Ligne titre="Trois rôles" detail="Propriétaire : tout, y compris inviter. Membre : voit et modifie. Lecteur : voit seulement." />
            <Sep />
            <Ligne titre="Invitations par email" detail="Un lien valable 7 jours, à usage unique, à ouvrir avec le compte qui porte l’adresse invitée." />
            <Sep />
            <Ligne titre="Espace affiché" detail={portee.type === 'moi' ? 'Le tien.' : 'Celui d’une équipe.'} droite={portee.type === 'moi' ? undefined : 'Revenir au mien'} onPress={portee.type === 'moi' ? undefined : () => choisirPortee({ type: 'moi' })} />
          </Panel>
        }
      />
      {nouvelle ? <FormEquipe onDone={() => setNouvelle(false)} /> : null}
    </Screen>
  );
}
