import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import type { Filtres } from '@/lib/analyse-operations';
import { operationsDe } from '@/lib/analyse-operations';
import { idBudgetDe } from '@/lib/categories';
import { ajouterCompte, comptesDe, EMOJIS_COMPTE, ignorerLien, lier, modifierCompte, nbSansCompte, nomCompte, proposerLiens, rattacher, resumerComptes, supprimerCompte, verifierNom, virements } from '@/lib/comptes';
import { uid } from '@/lib/dates';
import { fmtDevise } from '@/lib/devises';
import { fmtMontant } from '@/lib/finances';
import { dateFr } from '@/lib/stats-finances';
import { alpha, C, F } from '@/lib/theme';
import type { Compte, Finances } from '@/lib/types';

import { Puce, type SetF } from './finances-plus';
import { Btn, Empty, Input, Panel, T } from './ui';

/**
 * Onglet « Comptes » de Finances : l'import de relevés CSV en premier, puis chaque compte bancaire nommé clairement,
 * et les virements de l'un à l'autre à lier pour qu'ils ne comptent ni comme dépense ni comme revenu.
 */

type Voir = (filtre: Partial<Filtres>) => void;

export function PanneauComptes({ f, setF, onImporter, onVoir }: { f: Finances; setF: SetF; onImporter: (compte?: string | null) => void; onVoir: Voir }) {
  const comptes = comptesDe(f);
  const [form, setForm] = useState<'nouveau' | string | null>(null);
  const ops = useMemo(() => operationsDe(f, (x) => idBudgetDe(f.budgets, x)), [f]);
  const resumes = useMemo(() => resumerComptes(ops, comptes), [ops, comptes]);
  const sans = nbSansCompte(f);

  return (
    <>
      <Panel accent>
        <View style={{ gap: 4 }}>
          <Text style={{ color: C.ink, fontFamily: F.titre, fontSize: 20, letterSpacing: -0.3 }}>Importe tes relevés bancaires</Text>
          <T small muted>
            Exporte tes opérations en CSV depuis ta banque. Me lit les colonnes tout seul, range chaque opération dans ton budget et repère les doublons grâce aux références de ta banque.
          </T>
        </View>
        <View style={{ gap: 8 }}>
          <Etape n={1} texte={comptes.length ? 'Choisis le compte du relevé, ou crée-en un nouveau' : 'Donne un nom clair à ton compte (« Equity – dollars »)'} />
          <Etape n={2} texte="Choisis le fichier CSV ou colle son contenu" />
          <Etape n={3} texte="Vérifie l’aperçu : rien n’est ajouté avant ta validation" />
        </View>
        <View style={{ alignSelf: 'flex-start' }}>
          <Btn label="Importer un relevé CSV" onPress={() => onImporter(comptes.length === 1 ? comptes[0].id : null)} />
        </View>
      </Panel>

      <Panel title="Mes comptes" count={comptes.length || undefined} right={form !== 'nouveau' ? <Btn small kind="sec" label="+ Compte" onPress={() => setForm('nouveau')} /> : null}>
        {form === 'nouveau' ? (
          <FormCompte
            f={f}
            onAnnuler={() => setForm(null)}
            onEnregistrer={(c) => {
              setF((g) => ajouterCompte(g, c));
              setForm(null);
            }}
          />
        ) : null}
        {comptes.length ? (
          comptes.map((c) => {
            const r = resumes.find((x) => x.id === c.id)!;
            return form === c.id ? (
              <FormCompte
                key={c.id}
                f={f}
                init={c}
                onAnnuler={() => setForm(null)}
                onEnregistrer={(x) => {
                  setF((g) => modifierCompte(g, c.id, { nom: x.nom, emoji: x.emoji, banque: x.banque, devise: x.devise }));
                  setForm(null);
                }}
                onSupprimer={() => {
                  setF((g) => supprimerCompte(g, c.id));
                  setForm(null);
                }}
              />
            ) : (
              <CarteCompte key={c.id} f={f} c={c} r={r} onImporter={() => onImporter(c.id)} onVoir={() => onVoir({ compte: c.id })} onModifier={() => setForm(c.id)} />
            );
          })
        ) : form !== 'nouveau' ? (
          <Empty icone="portefeuille">Aucun compte pour le moment. Crée-en un, ou importe un premier relevé : tu nommeras le compte à ce moment-là.</Empty>
        ) : null}
        {comptes.length === 1 ? <T small muted>Un autre compte (M-Pesa, cash, épargne…) te permettra de suivre les virements de l’un à l’autre.</T> : null}
      </Panel>

      {sans && comptes.length ? (
        <Panel title="Opérations sans compte" count={sans}>
          <T small muted>
            {sans > 1 ? `${sans} opérations ne sont rattachées à aucun compte` : 'Une opération n’est rattachée à aucun compte'} (saisies à la main ou importées avant les comptes). Rattache-les au compte qui convient :
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {comptes.map((c) => (
              <Puce key={c.id} label={`${c.emoji} ${c.nom}`} on={false} onPress={() => setF((g) => rattacher(g, c.id))} />
            ))}
          </View>
          <View style={{ alignSelf: 'flex-start' }}>
            <Btn small kind="sec" label="Les voir" onPress={() => onVoir({ compte: 'aucun' })} />
          </View>
        </Panel>
      ) : null}

      <PanneauVirements f={f} setF={setF} onVoir={onVoir} />
    </>
  );
}

function Etape({ n, texte }: { n: number; texte: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: alpha(C.accent, 0.16), alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.accent, fontFamily: F.texteF, fontSize: 12 }}>{n}</Text>
      </View>
      <Text style={{ flex: 1, color: C.ink, fontFamily: F.texte, fontSize: 14 }}>{texte}</Text>
    </View>
  );
}

function CarteCompte({ f, c, r, onImporter, onVoir, onModifier }: { f: Finances; c: Compte; r: ReturnType<typeof resumerComptes>[number]; onImporter: () => void; onVoir: () => void; onModifier: () => void }) {
  const fmt = (n: number) => fmtMontant(n, f.devise);
  return (
    <View style={{ gap: 10, padding: 12, borderRadius: 14, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texteF, fontSize: 16 }}>
            {c.nom}
          </Text>
          <T small muted>
            {[c.banque, c.devise].filter(Boolean).join(' · ') || 'Banque et devise non précisées'}
          </T>
        </View>
        {c.solde ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 18 }}>{fmtDevise(c.solde.montant, c.solde.devise)}</Text>
            <T small muted>{`au ${dateFr(c.solde.date)}`}</T>
          </View>
        ) : null}
      </View>
      {r.nb ? (
        <View style={{ gap: 3 }}>
          <T small>
            {r.entrees || !r.sorties ? <Text style={{ color: C.coach, fontFamily: F.texteF }}>+{fmt(r.entrees)}</Text> : null}
            {r.entrees || !r.sorties ? ' entrées' : ''}
            {r.entrees && r.sorties ? ' · ' : ''}
            {r.sorties ? <Text style={{ fontFamily: F.texteF }}>−{fmt(r.sorties)}</Text> : null}
            {r.sorties ? ' sorties' : ''}
          </T>
          {r.virementsRecus || r.virementsEnvoyes ? (
            <T small muted>
              {[r.virementsRecus ? `${fmt(r.virementsRecus)} reçus d’un autre compte` : '', r.virementsEnvoyes ? `${fmt(r.virementsEnvoyes)} envoyés à un autre compte` : ''].filter(Boolean).join(' · ')}
            </T>
          ) : null}
          <T small muted>{`${r.nb} opération${r.nb > 1 ? 's' : ''}, du ${dateFr(r.premiere!)} au ${dateFr(r.derniere!)}`}</T>
        </View>
      ) : (
        <T small muted>Aucune opération : importe un relevé pour le remplir.</T>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn small label="Importer un relevé" onPress={onImporter} />
        {r.nb ? <Btn small kind="sec" label="Voir les opérations" onPress={onVoir} /> : null}
        <Btn small kind="sec" label="Modifier" onPress={onModifier} />
      </View>
    </View>
  );
}

function FormCompte({ f, init, onEnregistrer, onAnnuler, onSupprimer }: { f: Finances; init?: Compte; onEnregistrer: (c: Compte) => void; onAnnuler: () => void; onSupprimer?: () => void }) {
  const [nom, setNom] = useState(init?.nom ?? '');
  const [banque, setBanque] = useState(init?.banque ?? '');
  const [emoji, setEmoji] = useState(init?.emoji ?? EMOJIS_COMPTE[0]);
  const [devise, setDevise] = useState(init?.devise ?? f.devise);
  const [confirme, setConfirme] = useState(false);
  const erreur = nom.trim() ? verifierNom(f, nom, init?.id) : '';
  const devises = [...new Set([f.devise, ...Object.keys(f.taux ?? {}), devise])];
  return (
    <View style={{ gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: C.accentLine }}>
      <Input label="Nom du compte" value={nom} onChangeText={setNom} placeholder="Ex. Equity – dollars, M-Pesa, Cash" />
      {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
      <Input label="Banque (facultatif)" value={banque} onChangeText={setBanque} placeholder="Ex. Equity BCDC" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {EMOJIS_COMPTE.map((e) => (
          <Puce key={e} label={e} on={emoji === e} onPress={() => setEmoji(e)} />
        ))}
      </View>
      <View style={{ gap: 6 }}>
        <T small muted>Devise des relevés de ce compte</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {devises.map((d) => (
            <Puce key={d} label={d} on={devise === d} onPress={() => setDevise(d)} />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn small label={init ? 'Enregistrer' : 'Créer le compte'} disabled={!nom.trim() || !!erreur} onPress={() => onEnregistrer({ ...(init ?? { id: uid() }), nom: nom.trim(), emoji, ...(banque.trim() ? { banque: banque.trim() } : {}), devise })} />
        <Btn small kind="sec" label="Annuler" onPress={onAnnuler} />
        {onSupprimer ? <Btn small kind="danger" label={confirme ? 'Confirmer : les opérations restent, sans compte' : 'Supprimer le compte'} onPress={() => (confirme ? onSupprimer() : setConfirme(true))} /> : null}
      </View>
    </View>
  );
}

const PAR_PAGE = 5;

function PanneauVirements({ f, setF, onVoir }: { f: Finances; setF: SetF; onVoir: Voir }) {
  const [tout, setTout] = useState(false);
  const ops = useMemo(() => operationsDe(f, (x) => idBudgetDe(f.budgets, x)), [f]);
  const propositions = useMemo(() => proposerLiens(ops, { ignores: f.liensIgnores }), [ops, f.liensIgnores]);
  const lies = useMemo(() => virements(ops), [ops]);
  const nbComptes = comptesDe(f).length;
  if (nbComptes < 2 && !propositions.length && !lies.nb) return null;
  const visibles = tout ? propositions : propositions.slice(0, PAR_PAGE);
  const fmt = (n: number) => fmtMontant(n, f.devise);
  return (
    <Panel title="Virements entre tes comptes" count={propositions.length || undefined}>
      <T small muted>
        Un virement d’un compte à l’autre apparaît deux fois : une sortie et une entrée. Une fois liées, les deux ne comptent plus comme une dépense ni comme un revenu, et tes budgets restent justes.
      </T>
      {propositions.length ? (
        <>
          {visibles.map((p) => (
            <View key={`${p.sortie.id}-${p.entree.id}`} style={{ gap: 8, padding: 12, borderRadius: 12, backgroundColor: C.sunk, borderWidth: 1, borderColor: C.line }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ flex: 1, color: C.ink, fontFamily: F.texteF, fontSize: 15 }}>
                  {nomCompte(f, p.sortie.compte)} → {nomCompte(f, p.entree.compte)}
                </Text>
                <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 15 }}>{fmt(p.sortie.montant)}</Text>
              </View>
              <T small muted>
                {`Sortie du ${dateFr(p.sortie.date)}${p.sortie.note ? ` (${p.sortie.note})` : ''}, entrée du ${dateFr(p.entree.date)}${p.entree.note ? ` (${p.entree.note})` : ''}`}
                {p.ecart ? `. Écart de ${fmt(p.ecart)} : des frais ?` : ''}
              </T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn small label="Lier" onPress={() => setF((g) => lier(g, p.sortie.id, p.entree.id) ?? g)} />
                <Btn small kind="sec" label="Ce n’est pas un virement" onPress={() => setF((g) => ignorerLien(g, p.sortie.id, p.entree.id))} />
              </View>
            </View>
          ))}
          {propositions.length > PAR_PAGE && !tout ? <Btn small kind="sec" label={`Voir les ${propositions.length - PAR_PAGE} autres`} onPress={() => setTout(true)} /> : null}
          {propositions.length > 1 ? (
            <View style={{ alignSelf: 'flex-start' }}>
              <Btn small kind="sec" label={`Tout lier (${propositions.length})`} onPress={() => setF((g) => propositions.reduce((h, p) => lier(h, p.sortie.id, p.entree.id) ?? h, g))} />
            </View>
          ) : null}
        </>
      ) : nbComptes >= 2 ? (
        <T small muted>
          {lies.nb ? 'Aucun autre virement probable pour le moment.' : 'Aucun virement probable : il faut une sortie d’un compte et une entrée de même montant dans un autre, à quelques jours d’écart.'}
        </T>
      ) : null}
      {lies.nb ? (
        <View style={{ gap: 8 }}>
          <T small>{`${lies.nb} virement${lies.nb > 1 ? 's' : ''} lié${lies.nb > 1 ? 's' : ''} (${fmt(lies.total)}).`}</T>
          <View style={{ alignSelf: 'flex-start' }}>
            <Btn small kind="sec" label="Voir les virements" onPress={() => onVoir({ virements: 'seuls' })} />
          </View>
        </View>
      ) : null}
    </Panel>
  );
}

