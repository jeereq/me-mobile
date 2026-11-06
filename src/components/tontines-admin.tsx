import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { Text } from '@/components/texte';
import { Btn, Dialogue, Input, Panel, Sep, T } from '@/components/ui';
import { montantCotisation } from '@/lib/commun/cotisations';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';
import { Tontines, type Approbation, type ResumeAdmin } from '@/lib/tontines';

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

/** La demande d'approbation d'un compte. La photo ne s'ouvre qu'ici, et disparaît à la décision. */
function DecisionCompte({ a, onFait, onFermer }: { a: Approbation; onFait: (l: Approbation[]) => void; onFermer: () => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState('');
  const soumise = a.statut === 'soumise';
  useEffect(() => {
    if (!soumise) return;
    let fini = false;
    Tontines.piece(a.userId)
      .then((p) => {
        if (!fini) setPhoto(`data:${p.type};base64,${p.base64}`);
      })
      .catch((e: Error) => {
        if (!fini) setErreur(e.message);
      });
    return () => {
      fini = true;
    };
  }, [a.userId, soumise]);
  const decider = async (approuve: boolean) => {
    setErreur('');
    try {
      onFait((await Tontines.deciderApprobation(a.userId, approuve, approuve ? undefined : motif.trim())).approbations);
    } catch (e) {
      setErreur((e as Error).message);
    }
  };
  return (
    <Dialogue titre={a.nom} onFermer={onFermer}>
      <T>{[a.telephone ? `+${a.telephone}` : '', a.email ?? ''].filter(Boolean).join(', ')}</T>
      {photo ? <Image source={{ uri: photo }} accessibilityLabel={`Pièce d’identité de ${a.nom}`} style={{ width: '100%', height: 260, borderRadius: 14 }} resizeMode="contain" /> : null}
      {erreur ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text> : null}
      {soumise ? <Btn label="Approuver" disabled={!photo} onPress={() => decider(true)} /> : null}
      <Input label={soumise ? 'Motif du refus' : 'Motif du retrait'} value={motif} onChangeText={setMotif} />
      <Btn kind="danger" label={soumise ? 'Refuser' : 'Retirer l’approbation'} disabled={motif.trim().length < 3} onPress={() => decider(false)} />
    </Dialogue>
  );
}

/** Pour l'admin : les versements et cautions à valider, l'argent détenu et la commission gagnée. */
export function AdminTontines() {
  const [r, setR] = useState<ResumeAdmin | null>(null);
  const [v, setV] = useState<AValider | null>(null);
  const [erreur, setErreur] = useState('');
  const [comptes, setComptes] = useState<Approbation[]>([]);
  const [compte, setCompte] = useState<string | null>(null);

  const { aModule } = useStore();
  const versements = aModule('versements');
  const verifications = aModule('verifications');

  useEffect(() => {
    if (versements)
      Tontines.resumeAdmin(true)
        .then(setR)
        .catch((e: Error) => setErreur(e.message));
    if (verifications)
      Tontines.approbations(true)
        .then((x) => setComptes(x.approbations))
        .catch((e: Error) => setErreur(e.message));
  }, [versements, verifications]);

  if (erreur) return <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text>;
  const resume: ResumeAdmin = r ?? { versementApi: false, totaux: [], versements: [], cautions: [] };
  if (!resume.totaux.length && !resume.versements.length && !resume.cautions.length && !comptes.length) return null;
  const aTraiter = comptes.filter((c) => c.statut === 'soumise');
  const approuves = comptes.filter((c) => c.statut === 'approuvee');
  const choisi = compte ? comptes.find((c) => c.userId === compte) : undefined;
  return (
    <Panel title="Cotisations" count={resume.versements.length + resume.cautions.length + aTraiter.length || undefined}>
      {[...aTraiter, ...approuves].map((c) => (
        <View key={c.userId} style={{ gap: 8 }}>
          <Sep />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 180 }}>
              <T>{c.nom}</T>
              <T small muted>
                {c.statut === 'soumise' ? 'Compte à vérifier' : 'Compte approuvé'}
              </T>
            </View>
            <Btn small kind={c.statut === 'soumise' ? 'primary' : 'sec'} label={c.statut === 'soumise' ? 'Vérifier' : 'Gérer'} onPress={() => setCompte(c.userId)} />
          </View>
        </View>
      ))}
      {resume.totaux.map((t) => (
        <T key={t.devise} small>
          {t.devise} : détenu {montantCotisation(t.detenu, t.devise)}, commission gagnée {montantCotisation(t.commission, t.devise)}
        </T>
      ))}
      {resume.versements.map((x) => (
        <View key={x.tourId} style={{ gap: 8 }}>
          <Sep />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 180 }}>
              <T>
                {x.beneficiaire} : {montantCotisation(x.net, x.devise)}
              </T>
              <T small muted>
                {x.groupe}, {x.numero ? `tour ${x.numero} sur ${x.places}` : (x.raison ?? 'date de fin atteinte')}. Commission {montantCotisation(x.commission, x.devise)}
              </T>
            </View>
            <Btn small label="Valider" onPress={() => setV({ titre: 'Valider le versement', detail: `${x.beneficiaire}, ${x.groupe}${x.numero ? `, tour ${x.numero}` : ''}.`, telephone: x.telephone, montant: montantCotisation(x.net, x.devise), action: (p) => Tontines.verser(x.tourId, p) })} />
          </View>
        </View>
      ))}
      {resume.cautions.map((x) => (
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
      {choisi ? (
        <DecisionCompte
          a={choisi}
          onFermer={() => setCompte(null)}
          onFait={(l) => {
            setComptes(l);
            setCompte(null);
          }}
        />
      ) : null}
      {v ? (
        <Validation
          v={v}
          api={resume.versementApi}
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
