import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { ChoixAffectation } from '@/components/affectation';
import { AjoutLigne } from '@/components/ajout-ligne';
import { ChoixCategories } from '@/components/categories';
import { DatePick, ModePick, PlusOptions } from '@/components/forms';
import { RelanceItem } from '@/components/items';
import { Limitee, Pliable } from '@/components/pliable';
import { FiltreMembres } from '@/components/responsable';
import { BarreSelection, BoutonSelection, Selectionnable, useSelection } from '@/components/selection';
import { Btn, Dialogue, Empty, Header, Input, Panel, Screen, Sep, Seg, T } from '@/components/ui';
import { tRelance, useActions } from '@/lib/actions';
import { addDays, fmtCourt, today, uid } from '@/lib/dates';
import { elementsDePlan, estDeMembre, libelleFiltre, proprietaireParDefaut, type FiltreMembre } from '@/lib/equipe-taches';
import { useBarreOnglets } from '@/lib/mise-en-page';
import { lireRelance } from '@/lib/phrase';
import { useStore } from '@/lib/store';
import { grouperRelances, quandCourt } from '@/lib/suivi';
import { C } from '@/lib/theme';
import type { Boite, Mode, Relance } from '@/lib/types';

type Brouillon = { contact: string; sujet: string; date: string | null };

/**
 * Les relances : une ligne pour en ajouter une (« Marie, devis du site, dans 3 jours »), puis trois groupes :
 * à relancer maintenant (avec le bouton « Relancer »), en attente de réponse, et celles qui ont répondu (repliées).
 * Sur téléphone, elles vivent dans l'onglet « À faire », à côté des tâches : `bascule` remplace alors le titre.
 */
export function VueRelances({ bascule }: { bascule?: ReactNode }) {
  const { bureau } = useBarreOnglets();
  const { espace, update, config, equipeActive, session } = useStore();
  const [ouvert, setOuvert] = useState<Brouillon | null>(null);
  const membres = equipeActive?.membres ?? [];
  const moi = session?.user.id;
  const [membre, setMembre] = useState<FiltreMembre>('tous');
  const filtreMembre: FiltreMembre = equipeActive ? membre : 'tous';
  const sel = useSelection();
  const { enLot, ajouter } = useActions();
  const d = today();

  const miennes = espace.relances.filter((r) => estDeMembre(r, filtreMembre, membres, moi));
  const g = grouperRelances(miennes, d);
  const ouvertes = g.maintenant.length + g.attente.length;

  const ajoutRapide = (texte: string) => {
    const lu = lireRelance(texte, d);
    if (!lu) return;
    ajouter('relance', { id: uid(), contact: lu.contact, sujet: lu.sujet, boite: 'pro', date: lu.date ?? addDays(d, config.delaiRelanceJours), statut: 'a_faire', mode: config.defauts.relance, creeLe: new Date().toISOString() });
  };
  const comprendre = (texte: string) => {
    const lu = lireRelance(texte, d);
    if (!lu) return null;
    return [lu.contact, lu.sujet !== 'Suivi' ? lu.sujet : '', lu.date ? quandCourt(lu.date, d) : `dans ${config.delaiRelanceJours} jours`].filter(Boolean).join(' · ');
  };
  const details = (texte: string) => {
    const lu = texte ? lireRelance(texte, d) : null;
    setOuvert({ contact: lu?.contact ?? '', sujet: lu && lu.sujet !== 'Suivi' ? lu.sujet : '', date: lu?.date ?? addDays(d, config.delaiRelanceJours) });
  };

  const reporter = (ids: string[], jours: number) => update((e) => ({ ...e, relances: e.relances.map((r) => (ids.includes(r.id) ? { ...r, date: addDays(today(), jours) } : r)) }));
  const statut = (ids: string[], s: 'repondu' | 'relance') => enLot((e, jour, h) => ids.filter((id) => e.relances.find((r) => r.id === id)?.statut !== s).reduce((acc, id) => tRelance(acc, id, s, jour, h, config.delaiRelanceJours), e));
  const actions = [
    { label: 'Ont répondu', onPress: (ids: string[]) => statut(ids, 'repondu') },
    { label: 'Relancées', onPress: (ids: string[]) => statut(ids, 'relance') },
    { label: 'Pour demain', onPress: (ids: string[]) => reporter(ids, 1) },
    { label: 'Dans 1 semaine', onPress: (ids: string[]) => reporter(ids, 7) },
    { label: 'Supprimer', danger: true, onPress: (ids: string[]) => update((e) => ({ ...e, relances: e.relances.filter((r) => !ids.includes(r.id)) })) },
  ];
  const tous = [...g.maintenant, ...g.attente, ...g.repondues];

  const liste = (rs: Relance[]) => (
    <Limitee
      items={rs}
      n={10}
      nom="relances"
      rendu={(r, i) => (
        <View key={r.id}>
          {i ? <Sep /> : null}
          <Selectionnable sel={sel} id={r.id} label={`${r.contact}, ${r.sujet}`}>
            <RelanceItem r={r} />
          </Selectionnable>
        </View>
      )}
    />
  );

  return (
    <Screen pied={sel.actif ? <BarreSelection sel={sel} tous={tous.map((r) => r.id)} actions={actions} /> : null}>
      {bascule ? (
        <>
          <Header title="À faire" />
          {bascule}
        </>
      ) : (
        <Header retour={!bureau} onRetour={() => router.navigate('/plus')} eyebrow="Suivi" title="Relances" right={<Btn small label="+ Ajouter" onPress={() => details('')} />} />
      )}
      <AjoutLigne rubrique="/relances" placeholder="Qui dois-tu relancer ? Ex. « Marie, devis du site, jeudi »" comprendre={comprendre} onAjouter={ajoutRapide} onDetails={details} />
      {ouvert ? <NouvelleRelance initial={ouvert} onFermer={() => setOuvert(null)} /> : null}
      <FiltreMembres elements={elementsDePlan(espace, d).filter((x) => x.genre === 'relance')} value={membre} onChange={setMembre} />
      <Panel title={equipeActive ? libelleFiltre(filtreMembre, membres, 'relance') : 'Mes relances'} count={ouvertes ? `${ouvertes} ouvertes` : undefined} right={tous.length ? <BoutonSelection sel={sel} /> : null}>
        {tous.length ? (
          <>
            {g.maintenant.length ? (
              <Pliable titre="À relancer maintenant" count={g.maintenant.length} ouvert alerte>
                {liste(g.maintenant)}
              </Pliable>
            ) : (
              <T small muted>Personne à relancer aujourd’hui.</T>
            )}
            {g.attente.length ? (
              <Pliable titre="En attente de réponse" count={g.attente.length} ouvert={g.attente.length <= 8}>
                {liste(g.attente)}
              </Pliable>
            ) : null}
            {g.repondues.length ? (
              <Pliable titre="Ont répondu" count={g.repondues.length} couleur={C.muted}>
                {liste(g.repondues)}
              </Pliable>
            ) : null}
          </>
        ) : (
          <Empty icone="relances">{espace.relances.length ? 'Aucune relance pour cette personne.' : 'Aucune relance. Écris-en une ci-dessus, ou laisse la synchro de tes mails les trouver.'}</Empty>
        )}
      </Panel>
    </Screen>
  );
}

/** La fenêtre d'ajout : qui, à quel sujet, quand, perso ou pro et le ton. Le reste est replié. */
function NouvelleRelance({ initial, onFermer }: { initial: Brouillon; onFermer: () => void }) {
  const { config, equipeActive, session } = useStore();
  const { ajouter } = useActions();
  const [contact, setContact] = useState(initial.contact);
  const [sujet, setSujet] = useState(initial.sujet);
  const [boite, setBoite] = useState<Boite>('pro');
  const [date, setDate] = useState<string | null>(initial.date);
  const [mode, setMode] = useState<Mode>(config.defauts.relance);
  const [cats, setCats] = useState<string[] | undefined>(undefined);
  const [note, setNote] = useState('');
  const membres = equipeActive?.membres ?? [];
  const [choisi, setChoisi] = useState<{ affecteA?: string; responsable?: string } | null>(null);
  const affectation = choisi ?? proprietaireParDefaut(membres, session?.user.id);
  const valider = () => {
    ajouter('relance', {
      id: uid(),
      contact: contact.trim(),
      sujet: sujet.trim() || 'Suivi',
      boite,
      date: date || today(),
      statut: 'a_faire',
      mode,
      ...(equipeActive && affectation.affecteA ? { affecteA: affectation.affecteA, ...(affectation.responsable ? { responsable: affectation.responsable } : {}) } : {}),
      ...(cats?.length ? { categories: cats } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      creeLe: new Date().toISOString(),
    });
    onFermer();
  };
  const resume = [note.trim() ? 'note' : '', cats?.length ? 'catégorie' : ''].filter(Boolean).join(', ');
  return (
    <Dialogue titre="Nouvelle relance" onFermer={onFermer}>
      <Input label="Qui ?" value={contact} onChangeText={setContact} placeholder="Ex. Marie, cabinet Dupont" autoFocus={!contact} />
      <Input label="À quel sujet ?" value={sujet} onChangeText={setSujet} placeholder="Ex. Devis du site web" />
      <DatePick label={date ? `Relancer ${quandCourt(date, today())} (${fmtCourt(date)})` : 'Relancer le'} value={date} onChange={setDate} />
      <Seg label="Pour" options={[{ key: 'pro', label: 'Pro' }, { key: 'perso', label: 'Perso' }]} value={boite} onChange={setBoite} />
      <ModePick value={mode} onChange={setMode} config={config} />
      <PlusOptions resume={resume}>
        <Input label="Note" value={note} onChangeText={setNote} placeholder="Ce qu'il faut savoir avant de relancer" multiline style={{ minHeight: 60, textAlignVertical: 'top' }} aide="Reprise par Me quand il rédige la relance." />
        <ChoixAffectation t={affectation} genre="relance" onChoisir={(p) => setChoisi((a) => ({ ...(a ?? affectation), ...p }))} />
        <ChoixCategories value={cats} onChange={setCats} />
      </PlusOptions>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label="Ajouter la relance" onPress={valider} disabled={!contact.trim()} />
        <Btn kind="sec" label="Annuler" onPress={onFermer} />
      </View>
    </Dialogue>
  );
}
