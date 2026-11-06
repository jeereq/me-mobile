import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/texte';
import { Btn, Dialogue, Input, Panel, Sep, T } from '@/components/ui';
import { montantCotisation } from '@/lib/commun/cotisations';
import { C, F } from '@/lib/theme';
import { Tontines, type ResumeAdmin } from '@/lib/tontines';

type AValider = { titre: string; detail: string; telephone: string; montant: string; action: (preuve?: string) => Promise<ResumeAdmin> };

/** Confirmer avant de faire sortir de l'argent. Sans API de versement, l'admin verse hors de Me et note la référence. */
function Validation({ v, api, onFait, onFermer }: { v: AValider; api: boolean; onFait: (r: ResumeAdmin) => void; onFermer: () => void }) {
  const [preuve, setPreuve] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const ok = api || preuve.trim().length >= 3;
  const valider = async () => {
    setEnvoi(true);
    setErreur('');
    try {
      onFait(await v.action(api ? undefined : preuve.trim()));
    } catch (e) {
      setErreur((e as Error).message);
      setEnvoi(false);
    }
  };
  return (
    <Dialogue titre={v.titre} onFermer={onFermer}>
      <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 26 }}>{v.montant}</Text>
      <T>{v.detail}</T>
      <T>Numéro : +{v.telephone}</T>
      {api ? null : <Input label="Référence du versement" placeholder="Numéro de transaction" value={preuve} onChangeText={setPreuve} autoCorrect={false} />}
      {erreur ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text> : null}
      <View style={{ flexDirection: 'row' }}>
        <Btn label={api ? `Verser ${v.montant}` : 'Noter comme versé'} disabled={!ok || envoi} onPress={valider} />
      </View>
    </Dialogue>
  );
}

/** Pour l'admin : les versements et cautions à valider, l'argent détenu et la commission gagnée. */
export function AdminTontines() {
  const [r, setR] = useState<ResumeAdmin | null>(null);
  const [v, setV] = useState<AValider | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    Tontines.resumeAdmin(true)
      .then(setR)
      .catch((e: Error) => setErreur(e.message));
  }, []);

  if (erreur) return <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text>;
  if (!r || (!r.totaux.length && !r.versements.length && !r.cautions.length)) return null;
  return (
    <Panel title="Tontines" count={r.versements.length + r.cautions.length || undefined}>
      {r.totaux.map((t) => (
        <T key={t.devise} small>
          {t.devise} : détenu {montantCotisation(t.detenu, t.devise)}, commission gagnée {montantCotisation(t.commission, t.devise)}
        </T>
      ))}
      {r.versements.map((x) => (
        <View key={x.tourId} style={{ gap: 8 }}>
          <Sep />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 180 }}>
              <T>
                {x.beneficiaire} : {montantCotisation(x.net, x.devise)}
              </T>
              <T small muted>
                {x.groupe}, tour {x.numero} sur {x.places}. Commission {montantCotisation(x.commission, x.devise)}
              </T>
            </View>
            <Btn small label="Valider" onPress={() => setV({ titre: 'Valider le versement', detail: `${x.beneficiaire}, ${x.groupe}, tour ${x.numero}.`, telephone: x.telephone, montant: montantCotisation(x.net, x.devise), action: (p) => Tontines.verser(x.tourId, p) })} />
          </View>
        </View>
      ))}
      {r.cautions.map((x) => (
        <View key={x.membreId} style={{ gap: 8 }}>
          <Sep />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 180 }}>
              <T>
                Caution de {x.nom} : {montantCotisation(x.montant, x.devise)}
              </T>
              <T small muted>
                {x.groupe}
              </T>
            </View>
            <Btn small kind="sec" label="Rendre" onPress={() => setV({ titre: 'Rendre la caution', detail: `${x.nom}, ${x.groupe}.`, telephone: x.telephone, montant: montantCotisation(x.montant, x.devise), action: (p) => Tontines.rendre(x.membreId, p) })} />
          </View>
        </View>
      ))}
      {v ? (
        <Validation
          v={v}
          api={r.versementApi}
          onFermer={() => setV(null)}
          onFait={(n) => {
            setR(n);
            setV(null);
          }}
        />
      ) : null}
    </Panel>
  );
}
