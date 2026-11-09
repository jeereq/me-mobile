import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { Etat } from '@/components/cotisations-ui';
import { Onglets } from '@/components/onglets';
import { Bloc, Onglets as Onglets4, Texte, ZoneSquelette } from '@/components/squelettes';
import { Text } from '@/components/texte';
import { type AValider, Validation } from '@/components/tontines-admin';
import { Btn, Empty, IconBtn, Input, T } from '@/components/ui';
import { montantCotisation } from '@/lib/commun/cotisations';
import { useParamUrl } from '@/lib/param-url';
import { useStore } from '@/lib/store';
import { alpha, C, F } from '@/lib/theme';
import { nombreAVerser, type PageVersements, type ResumeAdmin, type Sortie, Tontines } from '@/lib/tontines';

type Vue = 'a_verser' | 'tranches' | 'cautions' | 'historique';
const VUES: Vue[] = ['a_verser', 'tranches', 'cautions', 'historique'];
type Ligne = ResumeAdmin['versements'][number];

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const heure = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
/** Les montants par devise, en une ligne : « 38 USD et 15 000 CDF ». */
function parDevise(l: { montant: number; devise: string }[]) {
  const m = new Map<string, number>();
  for (const x of l) m.set(x.devise, (m.get(x.devise) ?? 0) + x.montant);
  // Une devise par ligne : jamais coupée.
  const l2 = [...m].map(([d, n]) => montantCotisation(n, d));
  return l2.length ? l2 : ['0'];
}
const STATUT: Record<Sortie['statut'], { texte: string; couleur: () => string }> = {
  paye: { texte: 'Versé', couleur: () => C.coach },
  en_attente: { texte: 'En cours', couleur: () => C.hebdo },
  echoue: { texte: 'Échoué', couleur: () => C.agressif },
  expire: { texte: 'Expiré', couleur: () => C.agressif },
  abandonne: { texte: 'Abandonné', couleur: () => C.muted },
};

/** Un chiffre clé en tête de page. */
function Chiffre({ titre, valeur, detail, couleur, onPress }: { titre: string; valeur: string | string[]; detail?: string; couleur?: string; onPress?: () => void }) {
  const corps = (
    <>
      <Text style={{ color: C.muted, fontFamily: F.texteM, fontSize: 12.5 }}>{titre}</Text>
      {(Array.isArray(valeur) ? valeur : [valeur]).map((x) => (
        <Text key={x} style={{ color: couleur ?? C.ink, fontFamily: F.chiffre, fontSize: 20, lineHeight: 26 }}>
          {x}
        </Text>
      ))}
      {detail ? (
        <T small muted>
          {detail}
        </T>
      ) : null}
    </>
  );
  const style = { flexGrow: 1, flexBasis: 160, minWidth: 150, gap: 3, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface };
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.8 : 1 }]}>
      {corps}
    </Pressable>
  ) : (
    <View style={style}>{corps}</View>
  );
}

/** Une carte à traiter : qui reçoit, combien, d'où ça vient, et le geste. */
function Carte({ titre, montant, lignes, alerte, echec, action }: { titre: string; montant: string; lignes: (string | null | false | undefined)[]; alerte?: string | null; echec?: string | null; action?: ReactNode }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 320, minWidth: 260, gap: 10, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: echec ? alpha(C.agressif, 0.5) : alerte ? alpha(C.hebdo, 0.5) : C.line, backgroundColor: C.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: C.ink, fontFamily: F.titreM, fontSize: 16 }}>{titre}</Text>
          {lignes.filter(Boolean).map((l, i) => (
            <T key={i} small muted>
              {l}
            </T>
          ))}
        </View>
        <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 20 }}>{montant}</Text>
      </View>
      {alerte ? (
        <T small style={{ color: C.hebdo }}>
          {alerte}
        </T>
      ) : null}
      {echec ? (
        <T small style={{ color: C.agressif }}>
          {echec}
        </T>
      ) : null}
      {action ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{action}</View> : null}
    </View>
  );
}

/**
 * La page des versements de l'équipe Me : ce qui attend (cagnottes complètes, tranches, cautions à rendre), le solde du
 * compte FlexPaie de versement, et l'historique de tout ce qui est sorti.
 */
export function PageVersementsAdmin() {
  const [p, setP] = useState<PageVersements | null>(null);
  const [erreur, setErreur] = useState('');
  const [v, setV] = useState<AValider | null>(null);
  const [q, setQ] = useState('');
  const [vue, setVue] = useParamUrl<Vue>('vue', VUES, 'a_verser');
  const large = useWindowDimensions().width >= 900;
  const { isAdmin } = useStore();

  const lire = useCallback((discret = true) => {
    Tontines.versements(discret)
      .then((x) => {
        setP(x);
        setErreur('');
      })
      .catch((e: Error) => setErreur(e.message));
  }, []);
  useEffect(() => {
    lire(true);
    // Les versements automatiques se concluent chez FlexPaie : on relit régulièrement.
    const t = setInterval(() => lire(true), 30000);
    return () => clearInterval(t);
  }, [lire]);

  const filtre = useCallback((texte: string) => !q.trim() || texte.toLowerCase().includes(q.trim().toLowerCase()), [q]);
  const listes = useMemo(() => {
    const versements = p?.versements ?? [];
    const dus = versements.filter((x) => x.complet !== false || !!x.demandeLe);
    const tranches = versements.filter((x) => x.complet === false && !x.demandeLe);
    return {
      dus: dus.filter((x) => filtre(`${x.beneficiaire} ${x.groupe}`)),
      tranches: tranches.filter((x) => filtre(`${x.beneficiaire} ${x.groupe}`)),
      cautions: (p?.cautions ?? []).filter((x) => filtre(`${x.nom} ${x.groupe}`)),
      historique: (p?.historique ?? []).filter((x) => filtre(`${x.pour} ${x.groupe} ${x.reference} ${x.validePar ?? ''}`)),
      totalDus: dus.map((x) => ({ montant: x.disponible ?? x.net, devise: x.devise })),
      totalTranches: tranches.map((x) => ({ montant: x.disponible ?? 0, devise: x.devise })),
      totalCautions: (p?.cautions ?? []).map((x) => ({ montant: x.montant, devise: x.devise })),
    };
  }, [p, filtre]);

  if (erreur && !p) return <Empty>{erreur}</Empty>;
  if (!p)
    return (
      <ZoneSquelette label="Chargement des versements">
        <Bloc l="100%" h={44} r={14} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexGrow: 1, flexBasis: 160, minWidth: 150, gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
              <Bloc l="55%" h={10} />
              <Bloc l="70%" h={20} r={6} />
            </View>
          ))}
        </View>
        <Onglets4 />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ flexGrow: 1, flexBasis: 320, minWidth: 260, gap: 10, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
              <Bloc l="45%" h={16} />
              <Texte lignes={3} />
              <Bloc l="30%" h={34} r={999} />
            </View>
          ))}
        </View>
      </ZoneSquelette>
    );

  const api = p.mode.automatique;
  const enCours = p.historique.filter((x) => x.statut === 'en_attente');
  // Le solde suffit-il pour tout ce qui est dû ? Par devise.
  const manqueSolde = p.solde
    ? [...new Set(listes.totalDus.map((x) => x.devise))].filter((d) => (p.solde!.find((s) => s.devise === d)?.montant ?? 0) < listes.totalDus.filter((x) => x.devise === d).reduce((n, x) => n + x.montant, 0))
    : [];

  // Le solde FlexPaie d'une devise, s'il est connu (0 si la devise n'y figure pas).
  const soldeEn = (devise: string) => (api && p.solde ? { montant: p.solde.find((s) => s.devise === devise)?.montant ?? 0, devise } : null);
  // Le dernier essai pour ce bénéficiaire, s'il a échoué (rien de versé ni en cours depuis).
  const dernierEchec = (x: { beneficiaire: string; groupe: string }) => {
    const dernier = p.historique.find((h) => h.genre === 'versement' && h.pour === x.beneficiaire && h.groupe === x.groupe);
    return dernier?.statut === 'echoue' ? { le: dernier.le, message: dernier.message?.trim() || 'Refusé par FlexPaie.' } : null;
  };
  // Le solde, avec sa devise même à zéro, pour chaque devise à verser.
  const soldeAffiche = p.solde ? [...new Set([...p.solde.map((s) => s.devise), ...listes.totalDus.map((x) => x.devise)])].map((d) => montantCotisation(p.solde!.find((s) => s.devise === d)?.montant ?? 0, d)) : [];
  const ouvrir = (x: Ligne) => {
    const echec = dernierEchec(x)?.message ?? null;
    const detail = `${x.beneficiaire}, ${x.groupe}${x.numero ? `, tour ${x.numero}` : ''}.`;
    setV(
      x.cle && x.disponible !== undefined
        ? { titre: x.complet === false ? 'Verser une tranche' : 'Verser la cagnotte', detail, telephone: x.telephone, montant: montantCotisation(x.disponible, x.devise), tranche: { max: x.disponible, devise: x.devise, dejaVerse: x.dejaVerse ?? 0, complet: x.complet !== false, objectif: !x.numero }, solde: soldeEn(x.devise), echec, action: (pr, m) => Tontines.verserTranche(x.cle!, pr, m) }
        : { titre: 'Verser la cagnotte', detail, telephone: x.telephone, montant: montantCotisation(x.net, x.devise), solde: soldeEn(x.devise), echec, action: (pr) => Tontines.verser(x.tourId!, pr) },
    );
  };
  const carteVersement = (x: Ligne) => (
    <Carte
      key={x.cle ?? x.tourId}
      titre={x.beneficiaire || 'Bénéficiaire'}
      montant={montantCotisation(x.disponible ?? x.net, x.devise)}
      lignes={[
        `${x.groupe}${x.numero ? `, tour ${x.numero} sur ${x.places}` : x.raison ? `, ${x.raison}` : ''}`,
        x.dejaVerse ? `${montantCotisation(x.dejaVerse, x.devise)} déjà versés sur ${montantCotisation(x.net, x.devise)}` : x.complet === false ? `Cagnotte pas complète : ${montantCotisation(x.net, x.devise)} arrivés, commission déduite` : `Commission ${montantCotisation(x.commission, x.devise)}`,
        x.especes ? `${montantCotisation(x.especes, x.devise)} remis en espèces par l’initiateur` : null,
        `+${x.telephone}`,
      ]}
      alerte={x.demandeLe ? `Demandé le ${date(x.demandeLe)}${x.demandes && x.demandes > 1 ? `, relancé ${x.demandes - 1} fois` : ''}` : null}
      echec={(() => {
        const e = dernierEchec(x);
        return e ? `Échec le ${date(e.le)} à ${heure(e.le)} : ${e.message}` : null;
      })()}
      action={<Btn small kind={x.complet === false && !x.demandeLe ? 'sec' : 'primary'} label={x.enCours ? 'Versement en cours' : x.complet === false ? 'Verser une tranche' : 'Verser'} disabled={x.enCours} onPress={() => ouvrir(x)} />}
    />
  );

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: alpha(api ? C.coach : C.hebdo, 0.1) }}>
        <Etat texte={api ? 'Automatique' : 'Manuel'} couleur={api ? C.coach : C.hebdo} />
        <T small style={{ flex: 1, minWidth: 220 }}>
          {api ? 'Chaque versement part par FlexPaie vers le numéro du bénéficiaire.' : 'Tu envoies l’argent hors de Me, puis tu notes la référence de la transaction.'}
          {!api && p.mode.manque.length && isAdmin ? ` Pour l’automatique, à définir sur le serveur : ${p.mode.manque.join(', ')}.` : ''}
        </T>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Chiffre titre={`À verser (${listes.dus.length})`} valeur={parDevise(listes.totalDus)} couleur={listes.dus.length ? C.hebdo : C.ink} onPress={() => setVue('a_verser')} />
        <Chiffre titre={`Tranches possibles (${listes.tranches.length})`} valeur={parDevise(listes.totalTranches)} onPress={() => setVue('tranches')} />
        <Chiffre titre={`Cautions à rendre (${listes.cautions.length})`} valeur={parDevise(listes.totalCautions)} onPress={() => setVue('cautions')} />
        <Chiffre
          titre="Solde FlexPaie"
          valeur={p.solde ? (soldeAffiche.length ? soldeAffiche : '0') : '—'}
          detail={p.erreurSolde ?? (manqueSolde.length ? `Insuffisant en ${manqueSolde.join(' et ')} : approvisionne le compte Payout` : p.solde ? 'Compte de versement' : 'Disponible avec FlexPaie Payout')}
          couleur={manqueSolde.length ? C.agressif : undefined}
        />
        {p.totaux.length ? <Chiffre titre="Détenu par Me" valeur={parDevise(p.totaux.map((t) => ({ montant: t.detenu, devise: t.devise })))} detail={`Commission gagnée : ${p.totaux.map((t) => montantCotisation(t.commission, t.devise)).join(', ')}`} /> : null}
      </View>

      <Onglets<Vue>
        options={[
          { key: 'a_verser', label: 'À verser', compte: nombreAVerser(p) || undefined },
          { key: 'tranches', label: 'Tranches', compte: listes.tranches.length || undefined },
          { key: 'cautions', label: 'Cautions', compte: p.cautions.length || undefined },
          { key: 'historique', label: 'Historique', compte: enCours.length || undefined },
        ]}
        value={vue}
        onChange={setVue}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Input value={q} onChangeText={setQ} placeholder={large ? 'Chercher un bénéficiaire, un groupe, une référence' : 'Chercher'} accessibilityLabel="Chercher un versement" />
        </View>
        <IconBtn label="Actualiser" glyph="↻" onPress={() => lire(false)} />
      </View>
      {erreur ? <T small style={{ color: C.agressif }}>{erreur}</T> : null}

      {vue === 'a_verser' ? listes.dus.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{listes.dus.map(carteVersement)}</View> : <Empty>Rien à verser. Une cagnotte complète ou une tranche demandée par l’initiateur apparaît ici.</Empty> : null}

      {vue === 'tranches' ? (
        listes.tranches.length ? (
          <>
            <T small muted>
              Cagnottes pas encore complètes : ce qui est déjà arrivé peut partir au bénéficiaire.
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{listes.tranches.map(carteVersement)}</View>
          </>
        ) : (
          <Empty>Aucune tranche possible pour l’instant.</Empty>
        )
      ) : null}

      {vue === 'cautions' ? (
        listes.cautions.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {listes.cautions.map((x) => (
              <Carte
                key={x.membreId}
                titre={x.nom}
                montant={montantCotisation(x.montant, x.devise)}
                lignes={[`Caution, ${x.groupe}`, `+${x.telephone}`]}
                action={<Btn small label="Rendre" onPress={() => setV({ titre: 'Rendre la caution', detail: `${x.nom}, ${x.groupe}.`, telephone: x.telephone, montant: montantCotisation(x.montant, x.devise), action: (pr) => Tontines.rendre(x.membreId, pr) })} />}
              />
            ))}
          </View>
        ) : (
          <Empty>Aucune caution à rendre.</Empty>
        )
      ) : null}

      {vue === 'historique' ? (
        listes.historique.length ? (
          <View style={{ borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, overflow: 'hidden' }}>
            {listes.historique.map((x, i) => {
              const s = STATUT[x.statut] ?? STATUT.en_attente;
              return (
                <View key={x.reference} style={{ flexDirection: large ? 'row' : 'column', alignItems: large ? 'center' : 'stretch', gap: large ? 14 : 6, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line }}>
                  <View style={{ flex: large ? 2 : undefined, gap: 2 }}>
                    <Text style={{ color: C.ink, fontFamily: F.texteM, fontSize: 14.5 }}>
                      {x.genre === 'caution_rendue' ? 'Caution rendue' : 'Versement'} à {x.pour || 'un ancien membre'}
                    </Text>
                    <T small muted>
                      {x.groupe}
                      {x.numero ? `, tour ${x.numero}` : ''} · +{x.telephone}
                    </T>
                  </View>
                  <View style={{ flex: large ? 2 : undefined, gap: 2 }}>
                    <T small muted>
                      {date(x.le)} à {heure(x.le)} · {x.mode === 'mobile' ? 'FlexPaie' : 'Manuel'}
                      {x.validePar ? `, par ${x.validePar}` : ''}
                    </T>
                    <T small muted>
                      {x.message ? `${x.mode === 'main' ? 'Réf. ' : ''}${x.message}` : x.reference}
                    </T>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: large ? 'flex-end' : 'space-between', gap: 10, flex: large ? 1 : undefined }}>
                    <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 16 }}>{montantCotisation(x.montant, x.devise)}</Text>
                    <Etat texte={s.texte} couleur={s.couleur()} />
                    {x.statut === 'en_attente' && x.mode === 'mobile' ? (
                      <Btn
                        small
                        kind="sec"
                        label="Revérifier"
                        onPress={() =>
                          Tontines.reverifier(x.reference)
                            .then(setP)
                            .catch((e: Error) => setErreur(e.message))
                        }
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Empty>Aucun versement pour l’instant.</Empty>
        )
      ) : null}

      {v ? (
        <Validation
          v={v}
          api={api}
          onFermer={() => setV(null)}
          onFait={() => {
            setV(null);
            lire(true);
          }}
        />
      ) : null}
    </View>
  );
}
