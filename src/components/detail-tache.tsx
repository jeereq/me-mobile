import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Linking, Text, View } from 'react-native';

import { useActions } from '@/lib/actions';
import { fmtCourt, today } from '@/lib/dates';
import { SOURCE_DEFS } from '@/lib/defaults';
import { mailDuLien, refLien } from '@/lib/liens-mail';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import type { Tache } from '@/lib/types';

import { MailDeTache } from './affectation';
import { EtiquettesCategories } from './categories';
import { ComptesRendusElement } from './comptes-rendus';
import { FicheTache } from './fiches';
import { ouvrirLien, PuceMail } from './lien-mail';
import { PuceResponsable } from './responsable';
import { Btn, Dialogue, T } from './ui';

const PRIORITE = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' } as const;
const ORIGINE = { pro: 'Mail pro', perso: 'Mail perso', manuel: 'Ajoutée à la main' } as const;

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: alpha(C.line, 0.6) }}>
      <Text style={{ width: 96, color: C.muted, fontFamily: F.texteM, fontSize: 13, paddingTop: 1 }}>{label}</Text>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>{children}</View>
    </View>
  );
}

const Valeur = ({ children, alerte }: { children: ReactNode; alerte?: boolean }) => <Text style={{ color: alerte ? C.agressif : C.ink, fontFamily: F.texte, fontSize: 14.5, lineHeight: 20 }}>{children}</Text>;

/**
 * Le détail d'une tâche, en lecture : qui s'en occupe, pour quand, dans quel projet, la note, et le mail d'où elle vient —
 * qu'on peut ouvrir d'un geste. « Modifier » ouvre la fiche (ou le projet, pour une tâche de projet).
 * `tache` est relue dans l'espace à chaque affichage : cocher la tâche ici se voit tout de suite.
 */
export function DetailTache({ id, onFermer }: { id: string; onFermer: () => void }) {
  const { espace, mails, externes, equipeActive } = useStore();
  const { basculerTache } = useActions();
  const [modifier, setModifier] = useState(false);
  const [ecrire, setEcrire] = useState(false);
  const t: Tache | undefined = espace.taches.find((x) => x.id === id);
  if (!t) return null;
  if (modifier) return <FicheTache t={t} onFermer={() => (setModifier(false), onFermer())} />;
  if (ecrire) return <MailDeTache t={t} onFermer={() => setEcrire(false)} />;

  const projet = t.projet ? espace.projets?.find((p) => p.id === t.projet) : undefined;
  const fait = t.statut === 'fait';
  const retard = !fait && !!t.echeance && t.echeance < today();
  const comptes = externes.map((x) => x.id);
  const l = t.mail;
  const ref = refLien(l);
  const mailLu = mailDuLien(l, mails);
  const accessible = !!l && (!!mailLu || (!!ref && comptes.includes(ref.compte)) || !!l.lien);
  const parent = t.parent ? espace.taches.find((x) => x.id === t.parent) : undefined;
  const sousTaches = espace.taches.filter((x) => x.parent === t.id);

  const ouvrirMail = () => {
    if (!l) return;
    onFermer();
    ouvrirLien(l, mails, comptes);
  };
  const ouvrirProjet = () => {
    if (!projet) return;
    onFermer();
    router.push({ pathname: '/projets', params: { id: projet.id } } as never);
  };

  return (
    <Dialogue titre="Détail de la tâche" onFermer={onFermer}>
      <Text accessibilityRole="header" style={{ color: fait ? C.muted : C.ink, fontFamily: F.titreM, fontSize: 20, lineHeight: 26, textDecorationLine: fait ? 'line-through' : 'none' }}>
        {t.titre}
      </Text>

      <View>
        <Ligne label="Statut">
          <Valeur alerte={retard}>{fait ? `Terminée${t.faitLe ? ` le ${fmtCourt(t.faitLe)}` : ''}` : retard ? 'À faire · en retard' : 'À faire'}</Valeur>
        </Ligne>
        <Ligne label="Responsable">
          <PuceResponsable t={t} fait={fait} />
          {!equipeActive && !t.responsable ? <Valeur>Personne</Valeur> : null}
        </Ligne>
        <Ligne label="Échéance">
          <Valeur alerte={retard}>{t.echeance ? `${t.echeance === today() ? "Aujourd'hui" : fmtCourt(t.echeance)}${retard ? ' · en retard' : ''}` : 'Sans échéance'}</Valeur>
        </Ligne>
        <Ligne label="Priorité">
          <Valeur>{PRIORITE[t.priorite]}</Valeur>
        </Ligne>
        <Ligne label="Origine">
          <Valeur>{t.ext ? (SOURCE_DEFS[t.ext]?.nom ?? t.ext) : ORIGINE[t.source]}</Valeur>
        </Ligne>
        {projet ? (
          <Ligne label="Projet">
            <Valeur>{`${projet.emoji} ${projet.nom}`}</Valeur>
            <Btn small kind="sec" label="Ouvrir le projet" onPress={ouvrirProjet} />
          </Ligne>
        ) : null}
        {parent ? (
          <Ligne label="Fait partie de">
            <Valeur>{parent.titre}</Valeur>
          </Ligne>
        ) : null}
        {sousTaches.length ? (
          <Ligne label="Sous-tâches">
            <Valeur>{`${sousTaches.filter((x) => x.statut === 'fait').length} sur ${sousTaches.length} terminées`}</Valeur>
          </Ligne>
        ) : null}
        {t.categories?.length ? (
          <Ligne label="Catégories">
            <EtiquettesCategories ids={t.categories} />
          </Ligne>
        ) : null}
        {t.creeLe ? (
          <Ligne label="Créée le">
            <Valeur>{fmtCourt(t.creeLe.slice(0, 10))}</Valeur>
          </Ligne>
        ) : null}
      </View>

      {t.note?.trim() ? (
        <View style={{ gap: 4 }}>
          <T small muted>Note</T>
          <Text selectable style={{ color: C.ink, fontFamily: F.texte, fontSize: 14.5, lineHeight: 21 }}>
            {t.note.trim()}
          </Text>
        </View>
      ) : null}

      {l ? (
        <View style={{ gap: 6, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: alpha(C.accent, 0.4), backgroundColor: alpha(C.accent, 0.06) }}>
          <T small muted>Le mail à l’origine de cette tâche</T>
          <PuceMail l={l} />
          {l.adresse ? <T small muted>{`De ${l.contact ? `${l.contact} · ` : ''}${l.adresse}`}</T> : null}
          {mailLu ? (
            <T small muted>{`${fmtCourt(mailLu.date)}${mailLu.extrait ? ` · ${mailLu.extrait.slice(0, 160)}${mailLu.extrait.length > 160 ? '…' : ''}` : ''}`}</T>
          ) : null}
          {accessible ? (
            <View style={{ flexDirection: 'row' }}>
              <Btn small label="Ouvrir le mail" onPress={ouvrirMail} />
            </View>
          ) : (
            <T small muted>
              {equipeActive ? 'Ce mail est dans la boîte de la personne qui a créé la tâche : tu vois son objet et son expéditeur, pas son contenu.' : 'Ce mail n’est plus accessible depuis tes comptes connectés.'}
            </T>
          )}
        </View>
      ) : null}

      <ComptesRendusElement genre="tache" id={t.id} origine={t.compteRendu} onOuvrir={onFermer} />

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={fait ? 'Rouvrir' : 'Terminer'} onPress={() => basculerTache(t)} />
        <Btn kind="sec" label={t.projet && projet ? "Modifier dans le projet" : "Modifier"} onPress={() => (t.projet && projet ? ouvrirProjet() : setModifier(true))} />
        <Btn kind="sec" label="✉️ Écrire un mail" onPress={() => setEcrire(true)} />
        {t.lien ? <Btn kind="sec" label="Ouvrir l’original" onPress={() => Linking.openURL(t.lien!).catch(() => {})} /> : null}
      </View>
    </Dialogue>
  );
}
