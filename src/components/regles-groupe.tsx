import { useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';

import { ActionDiscrete, Etat, Ligne, Liste } from '@/components/cotisations-ui';
import { Text } from '@/components/texte';
import { Btn, Dialogue, Input, Seg, T } from '@/components/ui';
import { GRACES, montantCotisation, type OrdreTours, RETARDS_MAX, reglesDe, REGLES_DEFAUT, type ReglesGroupe, type ReglesPlateformeType, SEUILS_EXCLUSION } from '@/lib/commun/cotisations';
import { lireMontant } from '@/lib/finances';
import type { Groupe, InvitationEnvoyee, MembreGroupe } from '@/lib/tontines';
import { C, F } from '@/lib/theme';

const enTexte = (centimes: number) => (centimes ? String(centimes / 100).replace('.', ',') : '');
const dateCourte = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function Interrupteur({ titre, desc, value, onChange, disabled }: { titre: string; desc: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14 }}>{titre}</Text>
        <T small muted>
          {desc}
        </T>
      </View>
      <Switch value={value} disabled={disabled} onValueChange={onChange} accessibilityLabel={titre} trackColor={{ true: C.accent, false: C.line }} thumbColor={Platform.OS === 'android' ? C.ink : undefined} />
    </View>
  );
}

/**
 * Les règles du groupe : ordre des tours, pénalité de retard, exclusion, espèces et conditions d'entrée.
 * Ce qui n'a pas de sens pour ce groupe n'est pas proposé (les espèces dans l'annuaire, l'ordre pour une raison précise).
 */
export function ChoixRegles({ r, onChange, g, cadre }: { r: ReglesGroupe; onChange: (r: ReglesGroupe) => void; g: { mode: 'rotation' | 'objectif'; visibilite: 'public' | 'prive'; devise: string; montant: number | null }; /** Les règles de la plateforme pour cette sorte de groupe. */ cadre?: ReglesPlateformeType }) {
  const prive = g.visibilite === 'prive';
  const rotation = g.mode === 'rotation';
  const [penalite, setPenalite] = useState(enTexte(r.penalite.montant));
  const maj = (patch: Partial<ReglesGroupe>) => onChange({ ...r, ...patch });
  const lirePenalite = (v: string) => {
    setPenalite(v);
    const m = lireMontant(v);
    maj({ penalite: { ...r.penalite, montant: m && m > 0 ? Math.round(m * 100) : 0 } });
  };
  const maxPenalite = g.montant === null ? null : Math.floor((g.montant * (cadre?.penaliteMaxPct ?? 100)) / 100);
  const tropForte = maxPenalite !== null && r.penalite.montant > maxPenalite;
  return (
    <View style={{ gap: 16 }}>
      {rotation ? (
        <Seg<OrdreTours>
          label="Ordre des tours"
          options={[
            { key: 'tirage', label: 'Tirage au sort' },
            { key: 'arrivee', label: 'Ordre d’arrivée' },
            { key: 'organisateur', label: 'Je choisis' },
          ]}
          value={r.ordre}
          onChange={(ordre) => maj({ ordre })}
        />
      ) : null}

      <View style={{ gap: 8 }}>
        <Input label={`Pénalité par retard (${g.devise}), versée au bénéficiaire`} placeholder="0" value={penalite} onChangeText={lirePenalite} keyboardType="decimal-pad" erreur={tropForte ? (maxPenalite ? `${montantCotisation(maxPenalite, g.devise)} au plus.` : 'Pas de pénalité pour ce type de groupe.') : undefined} />
        {r.penalite.montant ? (
          <Seg<string>
            label="Après"
            options={GRACES.map((j) => ({ key: String(j), label: j ? `${j} j de grâce` : 'L’échéance' }))}
            value={String(r.penalite.grace)}
            onChange={(k) => maj({ penalite: { ...r.penalite, grace: Number(k) } })}
          />
        ) : null}
      </View>

      <View style={{ gap: 4 }}>
        <Seg<string> label="Exclusion" options={SEUILS_EXCLUSION.map((n) => ({ key: String(n), label: n ? `Après ${n} retards` : 'Jamais' }))} value={String(r.exclusion.retards)} onChange={(k) => maj({ exclusion: { retards: Number(k) } })} />
        {r.exclusion.retards ? (
          <T small muted>
            {rotation ? 'Tu es prévenu au seuil. Dans une rotation, le membre reste jusqu’au bout : sa caution couvre ses retards.' : 'Tu es prévenu au seuil, et tu peux exclure le membre : il ne doit plus les périodes suivantes.'}
          </T>
        ) : null}
      </View>

      {prive && cadre?.especes !== false ? <Interrupteur titre="Paiements en espèces" desc="Tu notes les cotisations reçues en main propre. Me ne verse que la part payée par mobile." value={r.especes} onChange={(especes) => maj({ especes })} /> : null}

      <View style={{ gap: 10 }}>
        <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 13 }}>Pour entrer</Text>
        {prive ? <Interrupteur titre="Compte approuvé par Me" desc={cadre?.compteApprouve ? 'Exigé par Me pour tous les groupes.' : 'Pièce d’identité vérifiée, même sur invitation.'} value={r.entree.compteApprouve || !!cadre?.compteApprouve} disabled={!!cadre?.compteApprouve} onChange={(compteApprouve) => maj({ entree: { ...r.entree, compteApprouve } })} /> : null}
        {!prive ? <Interrupteur titre="Accepter d’office" desc="Les demandes entrent sans attendre ta réponse." value={r.entree.automatique} onChange={(automatique) => maj({ entree: { ...r.entree, automatique } })} /> : null}
        <Seg<string>
          label="Retards permis dans d’autres groupes"
          options={RETARDS_MAX.filter((n) => !cadre || cadre.retardsMax < 0 || (n >= 0 && n <= cadre.retardsMax)).map((n) => ({ key: String(n), label: n < 0 ? 'Sans limite' : n ? `${n} au plus` : 'Aucun' }))}
          value={String(r.entree.retardsMax)}
          onChange={(k) => maj({ entree: { ...r.entree, retardsMax: Number(k) } })}
        />
      </View>
    </View>
  );
}

/** Les règles d'un groupe existant, avant son démarrage. */
export function FormRegles({ g, onEnregistrer, onFermer }: { g: Groupe; onEnregistrer: (r: ReglesGroupe) => void; onFermer: () => void }) {
  const [r, setR] = useState<ReglesGroupe>(g.regles ?? REGLES_DEFAUT);
  return (
    <Dialogue titre="Règles du groupe" onFermer={onFermer}>
      <ChoixRegles r={r} onChange={setR} g={{ mode: g.mode, visibilite: g.visibilite, devise: g.devise, montant: g.montant }} />
      <T small muted>
        Les membres sont prévenus du changement.
      </T>
      <Btn label="Enregistrer" disabled={r.penalite.montant > g.montant} onPress={() => onEnregistrer(reglesDe(r, { visibilite: g.visibilite, montant: g.montant }))} />
    </Dialogue>
  );
}

/** Les règles en clair, pour tout le monde ; l'organisateur les touche pour les changer tant que c'est permis. */
export function ListeRegles({ g, onModifier }: { g: Groupe; onModifier?: () => void }) {
  const lignes = g.texteRegles ?? [];
  if (!lignes.length) return null;
  // Des phrases entières : elles vont à la ligne au lieu d'être coupées.
  return (
    <Liste titre="Règles">
      <View style={{ gap: 8, paddingVertical: 12, paddingHorizontal: 14 }}>
        {lignes.map((l, i) => (
          <T key={i} small>
            {l}
          </T>
        ))}
      </View>
      {onModifier ? <Ligne premiere titre="Modifier les règles" accent onPress={onModifier} /> : null}
    </Liste>
  );
}

/** Les invitations envoyées par Me pour ce groupe : à qui (numéro masqué), quand, par quel canal, et si la personne a rejoint. */
export function InvitationsEnvoyees({ invitations, onInviter }: { invitations: InvitationEnvoyee[]; onInviter?: () => void }) {
  if (!invitations.length && !onInviter) return null;
  const rejointes = invitations.filter((x) => x.rejointLe).length;
  return (
    <Liste titre={invitations.length ? `Invitations envoyées : ${rejointes} sur ${invitations.length} ont rejoint` : 'Invitations envoyées'}>
      {invitations.length ? (
        invitations.map((x, i) => {
          const canaux = [x.sms ? 'SMS' : '', x.mail ? 'mail' : ''].filter(Boolean).join(' et ') || 'app';
          return (
            <Ligne
              key={x.id}
              premiere={i === 0}
              titre={x.numero}
              sous={`Le ${dateCourte(x.envoyeLe)} par ${canaux}${x.envois > 1 ? `, ${x.envois} fois` : ''}`}
              droite={<Etat texte={x.rejointLe ? 'A rejoint' : 'En attente'} couleur={x.rejointLe ? C.coach : C.hebdo} />}
            />
          );
        })
      ) : (
        <Ligne premiere titre="Aucune invitation envoyée par Me" sous="Celles envoyées par WhatsApp ou par ton téléphone n’apparaissent pas ici." />
      )}
      {onInviter ? <Ligne titre="Inviter quelqu’un" accent onPress={onInviter} /> : null}
    </Liste>
  );
}

/** L'organisateur range les membres dans l'ordre où ils recevront la cagnotte. */
export function FormOrdre({ membres, moi, onEnregistrer, onFermer }: { membres: MembreGroupe[]; moi?: string; onEnregistrer: (ids: string[]) => void; onFermer: () => void }) {
  const [ordre, setOrdre] = useState(() => [...membres].sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999)));
  const bouger = (i: number, d: -1 | 1) =>
    setOrdre((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = [...l];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const fleche = (label: string, glyphe: string, onPress: () => void, off: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={off} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line, opacity: off ? 0.3 : pressed ? 0.6 : 1 })}>
      <Text style={{ color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>{glyphe}</Text>
    </Pressable>
  );
  return (
    <Dialogue titre="Ordre des tours" onFermer={onFermer}>
      <T small muted>
        Le premier reçoit la cagnotte au premier tour.
      </T>
      <Liste>
        {ordre.map((m, i) => (
          <Ligne
            key={m.id}
            premiere={i === 0}
            titre={`${i + 1}. ${m.id === moi ? 'Toi' : m.nom}`}
            droite={
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {fleche(`Monter ${m.nom}`, '↑', () => bouger(i, -1), i === 0)}
                {fleche(`Descendre ${m.nom}`, '↓', () => bouger(i, 1), i === ordre.length - 1)}
              </View>
            }
          />
        ))}
      </Liste>
      <Btn label="Enregistrer l’ordre" onPress={() => onEnregistrer(ordre.map((m) => m.id))} />
      <ActionDiscrete label="Annuler" onPress={onFermer} />
    </Dialogue>
  );
}

/** « 2 retards », pour l'organisateur. */
export const texteRetards = (m: MembreGroupe) => (m.retards ? `${m.retards} retard${m.retards > 1 ? 's' : ''}` : '');
export const libelleEspeces = (m: MembreGroupe, devise: string) => (m.du ? `Payé en espèces (${montantCotisation(m.du, devise)})` : 'Payé en espèces');
