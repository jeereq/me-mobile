import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { today, uid } from '@/lib/dates';
import { fmtDevise, saisie } from '@/lib/devises';
import { fmtMontant } from '@/lib/finances';
import { lireReleve, type LigneReleve, type Sens } from '@/lib/releve';
import { dateFr } from '@/lib/stats-finances';
import { alpha, C, F } from '@/lib/theme';
import type { Finances } from '@/lib/types';

import { Puce, useChoixDevise, type SetF } from './finances-plus';
import { Btn, Input, Panel, Sep, Seg, T } from './ui';

const VISIBLES = 40;

/** Lit un fichier choisi sur le web ; les banques françaises exportent souvent en Windows-1252 plutôt qu'en UTF-8. */
function choisirFichier(): Promise<string | null> {
  return new Promise((ok) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,text/csv,text/plain';
    input.onchange = async () => {
      const fichier = input.files?.[0];
      if (!fichier) return ok(null);
      const octets = await fichier.arrayBuffer();
      const utf8 = new TextDecoder('utf-8').decode(octets);
      ok(utf8.includes('�') ? new TextDecoder('windows-1252').decode(octets) : utf8);
    };
    input.click();
  });
}

/** Import d'un relevé bancaire (CSV) : aperçu, budget suggéré par opération, doublons décochés, puis ajout en un geste. */
export function ImportReleve({ f, setF, onDone }: { f: Finances; setF: SetF; onDone: (message: string) => void }) {
  const d = today();
  const [texte, setTexte] = useState('');
  const [lignes, setLignes] = useState<LigneReleve[] | null>(null);
  const [exclues, setExclues] = useState<Set<string>>(new Set());
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [tout, setTout] = useState(false);
  const [erreur, setErreur] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [sens, setSens] = useState<Sens>('auto');
  const [toutPositif, setToutPositif] = useState(false);
  // Devise du relevé quand le fichier ne l'indique pas (colonne « Devise » ou symbole dans le montant).
  const dev = useChoixDevise(f);
  const categories = f.budgets.filter((b) => !b.global);

  const analyser = (t: string, s: Sens = sens) => {
    const r = lireReleve(t, f, d, { sens: s, devise: dev.devise });
    setErreur(r.erreur || '');
    setSource(r.lignes.length ? t : null);
    setToutPositif(!!r.toutPositif);
    setLignes(r.lignes.length ? r.lignes : null);
    setExclues(new Set(r.lignes.filter((x) => x.doublon).map((x) => x.cle)));
  };
  // Changer la devise ou le sens relit le même fichier (les budgets rangés à la main sont à refaire).
  useEffect(() => {
    if (source) analyser(source);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sens, dev.devise]);
  const conv = (x: LigneReleve) => saisie(x.montant, x.devise, f.devise, dev.tauxCourants) ?? { montant: x.montant };
  const fichier = async () => {
    const t = await choisirFichier();
    if (t) analyser(t);
  };
  const basculer = (cle: string) =>
    setExclues((s) => {
      const n = new Set(s);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });
  const ranger = (cle: string, budget: string | null) => {
    setLignes((l) => l && l.map((x) => (x.cle === cle ? { ...x, budget } : x)));
    setOuverte(null);
  };

  const choisies = (lignes || []).filter((x) => !exclues.has(x.cle));
  const depenses = choisies.filter((x) => x.genre === 'depense');
  const revenus = choisies.filter((x) => x.genre === 'revenu');
  const total = (l: LigneReleve[]) => Math.round(l.reduce((s, x) => s + conv(x).montant, 0) * 100) / 100;
  const importer = () => {
    const creeLe = new Date().toISOString();
    setF((g) => ({
      ...dev.avecTaux(g),
      depenses: [...depenses.map((x) => ({ id: uid(), ...conv(x), ...(x.reference ? { reference: x.reference } : {}), budget: x.budget, note: x.libelle, date: x.date, creeLe })), ...g.depenses],
      revenus: [...revenus.map((x) => ({ id: uid(), ...conv(x), ...(x.reference ? { reference: x.reference } : {}), note: x.libelle, date: x.date, creeLe })), ...(g.revenus || [])],
    }));
    const dates = choisies.map((x) => x.date).sort();
    const periode = dates.length ? ` du ${dateFr(dates[0])} au ${dateFr(dates[dates.length - 1])}` : '';
    onDone(`${choisies.length} opération${choisies.length > 1 ? 's' : ''} importée${choisies.length > 1 ? 's' : ''}${periode}. Elles apparaissent dans les graphiques et les statistiques de leur période (change de période avec ‹ › ou « Mois », « Année »).`);
  };

  const options = (
    <>
      {dev.element}
      <Seg
        label="Sens des montants"
        options={[
          { key: 'auto' as Sens, label: 'Automatique' },
          { key: 'sorties' as Sens, label: 'Tout en sorties' },
          { key: 'entrees' as Sens, label: 'Tout en entrées' },
        ]}
        value={sens}
        onChange={setSens}
      />
    </>
  );

  if (!lignes)
    return (
      <Panel title="Importer un relevé bancaire" accent>
        <T small muted>
          Dans ton espace bancaire, exporte tes opérations au format CSV, puis {Platform.OS === 'web' ? 'choisis le fichier ou colle son contenu ici' : 'colle son contenu ici'}. Rien n'est ajouté avant ta validation.
        </T>
        {options}
        {Platform.OS === 'web' ? <Btn kind="sec" label="Choisir un fichier CSV" onPress={fichier} /> : null}
        <Input label="Contenu du relevé" value={texte} onChangeText={setTexte} multiline placeholder={'Date;Libellé;Montant\n14/10/2026;CB CARREFOUR;-42,30'} style={{ minHeight: 110, textAlignVertical: 'top', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: 13 }} />
        {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn label="Analyser" onPress={() => analyser(texte)} disabled={!texte.trim()} />
          <Btn kind="sec" label="Annuler" onPress={() => onDone('')} />
        </View>
      </Panel>
    );

  const doublons = lignes.filter((x) => x.doublon).length;
  const visibles = tout ? lignes : lignes.slice(0, VISIBLES);
  return (
    <Panel title="Importer un relevé bancaire" count={`${choisies.length}/${lignes.length}`} accent>
      <T small muted>
        {lignes.length} opération{lignes.length > 1 ? 's' : ''} trouvée{lignes.length > 1 ? 's' : ''}
        {doublons ? `, dont ${doublons} déjà notée${doublons > 1 ? 's' : ''} (décochée${doublons > 1 ? 's' : ''})` : ''}. Touche une ligne pour la cocher ou la décocher, et le budget pour le changer.
      </T>
      {toutPositif ? (
        <View style={{ gap: 6 }}>
          <T small>Tous les montants du fichier sont positifs : ce sont des sorties de ta banque ?</T>
          <Btn small label="Oui, ce sont des sorties" onPress={() => setSens('sorties')} />
        </View>
      ) : null}
      {options}
      {visibles.map((x, i) => {
        const on = !exclues.has(x.cle);
        const bu = categories.find((b) => b.id === x.budget);
        return (
          <View key={x.cle}>
            {i ? <Sep /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, opacity: on ? 1 : 0.5 }}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${x.libelle || 'Opération'} ${fmtDevise(x.montant, x.devise)}`} onPress={() => basculer(x.cle)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: on ? C.accent : C.line, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <Text style={{ color: C.accentInk, fontSize: 12, fontFamily: F.texteF }}>✓</Text> : null}
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text numberOfLines={1} style={{ color: C.ink, fontFamily: F.texte, fontSize: 14 }}>
                    {x.libelle || (x.genre === 'revenu' ? 'Revenu' : 'Dépense')}
                  </Text>
                  <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 12 }}>
                    {dateFr(x.date)}
                    {x.doublon ? ' · déjà notée ?' : ''}
                  </Text>
                </View>
              </Pressable>
              {x.genre === 'depense' && categories.length ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Changer le budget" onPress={() => setOuverte(ouverte === x.cle ? null : x.cle)} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: bu ? alpha(C.accent, 0.12) : C.sunk }}>
                  <Text numberOfLines={1} style={{ color: bu ? C.accent : C.muted, fontFamily: F.texteM, fontSize: 12, maxWidth: 120 }}>
                    {bu ? `${bu.emoji} ${bu.nom}` : 'Hors budget'}
                  </Text>
                </Pressable>
              ) : null}
              <Text style={{ color: x.genre === 'revenu' ? C.coach : C.ink, fontFamily: F.texteF, fontSize: 14 }}>
                {x.genre === 'revenu' ? '+' : '−'}
                {fmtDevise(x.montant, x.devise)}
              </Text>
              {x.devise !== f.devise ? <Text style={{ color: C.muted, fontFamily: F.texte, fontSize: 11 }}>≈ {fmtMontant(conv(x).montant, f.devise)}</Text> : null}
            </View>
            {ouverte === x.cle ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 6 }}>
                {categories.map((b) => (
                  <Puce key={b.id} label={`${b.emoji} ${b.nom}`} on={x.budget === b.id} onPress={() => ranger(x.cle, b.id)} />
                ))}
                <Puce label="Hors budget" on={!x.budget} onPress={() => ranger(x.cle, null)} />
              </View>
            ) : null}
          </View>
        );
      })}
      {!tout && lignes.length > VISIBLES ? <Btn small kind="sec" label={`Voir les ${lignes.length - VISIBLES} autres`} onPress={() => setTout(true)} /> : null}
      <T small muted>
        {depenses.length} dépense{depenses.length > 1 ? 's' : ''} ({fmtMontant(total(depenses), f.devise)}) et {revenus.length} revenu{revenus.length > 1 ? 's' : ''} ({fmtMontant(total(revenus), f.devise)}) seront ajoutés.
      </T>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={`Importer ${choisies.length} opération${choisies.length > 1 ? 's' : ''}`} onPress={importer} disabled={!choisies.length} />
        <Btn kind="sec" label="Recommencer" onPress={() => setLignes(null)} />
        <Btn kind="sec" label="Annuler" onPress={() => onDone('')} />
      </View>
    </Panel>
  );
}
