import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ActionDiscrete, Cadre, EnteteDetail, Erreur, Etat, GrandTitre, Ligne, Liste } from '@/components/cotisations-ui';
import { Jauge } from '@/components/jauge';
import { Filtre, SousOnglets } from '@/components/onglets';
import { Pliable } from '@/components/pliable';
import { PanneauTontines } from '@/components/tontines';
import { Btn, Dialogue, T } from '@/components/ui';
import { libellePeriode, montantCotisation, montantEtRythme } from '@/lib/commun/cotisations';
import { etatMembre, suiviPeriode, type Cotisation, type EtatMembre, type MembreCotisation } from '@/lib/cotisations';
import { Collectes } from '@/lib/cotisations-api';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

const ETATS: Record<EtatMembre, string> = { paye: 'Payé', en_attente: 'En cours', demande: 'Demandé', a_payer: 'À payer', hors: '' };
const couleurEtat = (e: EtatMembre) => (e === 'paye' ? C.coach : e === 'en_attente' || e === 'demande' ? C.hebdo : C.muted);

/** Une ancienne collecte : en lecture. L'organisateur peut seulement effacer ses données. */
function DetailCollecte({ c, onRetirer, onSupprimer, onRetour }: { c: Cotisation; onRetirer: (m: MembreCotisation) => void; onSupprimer: () => void; onRetour: () => void }) {
  const [periode, setPeriode] = useState(c.periode);
  const [choisi, setChoisi] = useState<string | null>(null);
  const s = suiviPeriode(c, periode);
  const dernieres = [...c.periodes].reverse().slice(0, 6);
  const concernes = c.membres.filter((m) => etatMembre(m, periode) !== 'hors');
  const membre = choisi ? c.membres.find((m) => m.id === choisi) : undefined;
  return (
    <View style={{ gap: 14 }}>
      <EnteteDetail titre={c.titre} sousTitre={montantEtRythme(c.montant, c.devise, c.rythme)} onRetour={onRetour} />
      {dernieres.length > 1 ? <Filtre label="Période" options={dernieres.map((p) => ({ key: p, label: libellePeriode(p) }))} value={periode} onChange={setPeriode} /> : null}
      <Cadre>
        <GrandTitre>
          {montantCotisation(s.recu, c.devise)} sur {montantCotisation(s.recu + s.reste, c.devise)}
        </GrandTitre>
        <View style={{ gap: 6 }}>
          <Jauge ratio={s.total ? s.payes / s.total : 0} hauteur={6} />
          <T small muted>
            {s.payes} sur {s.total} ont payé{c.encaisse ? `, ${montantCotisation(c.encaisse, c.devise)} encaissés en ligne` : ''}
          </T>
        </View>
      </Cadre>
      {concernes.length ? (
        <Liste titre="Membres">
          {concernes.map((m, i) => {
            const e = etatMembre(m, periode);
            return <Ligne key={m.id} premiere={i === 0} titre={m.nom} droite={<Etat texte={ETATS[e]} couleur={couleurEtat(e)} />} onPress={() => setChoisi(m.id)} />;
          })}
        </Liste>
      ) : null}
      <ActionDiscrete danger label="Supprimer la collecte" onPress={onSupprimer} />
      {membre ? (
        <Dialogue titre={membre.nom} onFermer={() => setChoisi(null)}>
          <Btn
            kind="danger"
            label="Effacer ce membre"
            onPress={() => {
              setChoisi(null);
              onRetirer(membre);
            }}
          />
        </Dialogue>
      ) : null}
    </View>
  );
}

/** Les collectes d'avant les groupes. Rien ne s'affiche pour qui n'en a pas. */
function AnciennesCollectes({ ouverte, setOuverte }: { ouverte: string | null; setOuverte: (id: string | null) => void }) {
  const { session } = useStore();
  const [liste, setListe] = useState<Cotisation[]>([]);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!session) return;
    Collectes.liste()
      .then((r) => setListe(r.cotisations))
      .catch(() => {});
  }, [session]);

  const retirer = (m: MembreCotisation) => {
    setErreur('');
    Collectes.retirerMembre(m.id)
      .then((c) => setListe((l) => l.map((x) => (x.id === c.id ? c : x))))
      .catch((e: Error) => setErreur(e.message));
  };
  const supprimer = (id: string) => {
    setErreur('');
    Collectes.supprimer(id)
      .then(() => {
        setListe((l) => l.filter((x) => x.id !== id));
        setOuverte(null);
      })
      .catch((e: Error) => setErreur(e.message));
  };

  const detail = ouverte ? liste.find((c) => c.id === ouverte) : undefined;
  if (detail)
    return (
      <View style={{ gap: 12 }}>
        {erreur ? <Erreur texte={erreur} /> : null}
        <DetailCollecte key={detail.id} c={detail} onRetirer={retirer} onSupprimer={() => supprimer(detail.id)} onRetour={() => setOuverte(null)} />
      </View>
    );
  if (!liste.length) return null;
  return (
    <Pliable titre="Anciennes collectes" count={liste.length}>
      <Liste>
        {liste.map((c, i) => (
          <Ligne key={c.id} premiere={i === 0} titre={c.titre} sous={montantEtRythme(c.montant, c.devise, c.rythme)} onPress={() => setOuverte(c.id)} label={`Ouvrir ${c.titre}`} />
        ))}
      </Liste>
    </Pliable>
  );
}

/** L'onglet Cotisations des Finances : mes groupes et l'annuaire. */
export function PanneauCotisations({ devise }: { devise: string }) {
  const [vue, setVue] = useState<'groupes' | 'annuaire'>('groupes');
  const [groupe, setGroupe] = useState<string | null>(null);
  const [collecte, setCollecte] = useState<string | null>(null);
  // Dans un groupe, les onglets s'effacent : l'écran ne montre que ce qui compte.
  const dansDetail = vue === 'groupes' && (!!groupe || !!collecte);
  return (
    <View style={{ gap: 12 }}>
      {dansDetail ? null : (
        <SousOnglets
          label="Cotisations"
          options={[
            { key: 'groupes', label: 'Mes groupes' },
            { key: 'annuaire', label: 'Annuaire' },
          ]}
          value={vue}
          onChange={setVue}
        />
      )}
      {collecte && vue === 'groupes' ? null : <PanneauTontines vue={vue} devise={devise === 'CDF' ? 'CDF' : 'USD'} ouvert={groupe} setOuvert={setGroupe} onAnnuaire={() => setVue('annuaire')} />}
      {vue === 'groupes' && !groupe ? <AnciennesCollectes ouverte={collecte} setOuverte={setCollecte} /> : null}
    </View>
  );
}
