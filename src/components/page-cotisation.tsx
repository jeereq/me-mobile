import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Text } from '@/components/texte';
import { Btn, T } from '@/components/ui';
import { montantCotisation } from '@/lib/commun/cotisations';
import { CotisationPublique, type PageCotisationPublique } from '@/lib/cotisations-api';
import { C, F } from '@/lib/theme';

const SUIVI_MS = 5000;

/** La page reçue par WhatsApp ou SMS (/c/<jeton>) : une personne sans compte voit ce qu'elle doit et paie. */
export function PageCotisation({ jeton }: { jeton: string }) {
  const [page, setPage] = useState<PageCotisationPublique | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const lire = useCallback(
    (discret?: boolean) =>
      CotisationPublique.lire(jeton, discret)
        .then((p) => {
          setPage(p);
          setErreur('');
        })
        .catch((e: Error) => setErreur(e.message)),
    [jeton],
  );
  useEffect(() => {
    lire();
  }, [lire]);

  // Pendant la validation sur le téléphone, la page se met à jour seule.
  const attente = page?.etat === 'en_attente';
  useEffect(() => {
    if (!attente) return;
    const t = setInterval(() => lire(true), SUIVI_MS);
    return () => clearInterval(t);
  }, [attente, lire]);

  const agir = async (action: () => Promise<PageCotisationPublique>) => {
    setEnvoi(true);
    setErreur('');
    try {
      setPage(await action());
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
      <View style={{ width: '100%', maxWidth: 420, gap: 16, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
        {!page ? (
          erreur ? <T>{erreur}</T> : <ActivityIndicator color={C.accent} />
        ) : (
          <>
            <View style={{ gap: 2 }}>
              <T small muted>
                {page.organisateur ? `${page.organisateur} te demande` : 'Cotisation'}
              </T>
              <Text accessibilityRole="header" style={{ color: C.ink, fontFamily: F.titreM, fontSize: 22 }}>
                {page.titre}
              </Text>
            </View>

            {page.etat === 'a_jour' ? (
              <View style={{ gap: 4 }}>
                <Text style={{ color: C.coach, fontFamily: F.titreM, fontSize: 26 }}>C’est payé</Text>
                <T muted>Merci {page.nom}.</T>
              </View>
            ) : page.etat === 'terminee' ? (
              <T muted>Cette cotisation est terminée.</T>
            ) : (
              <View style={{ gap: 2 }}>
                <Text style={{ color: C.ink, fontFamily: F.chiffre, fontSize: 40 }}>{montantCotisation(page.montant, page.devise)}</Text>
                {page.periode ? <T muted>{page.periode}</T> : null}
                {page.restantes > 1 ? (
                  <T small muted>
                    {page.restantes} périodes à payer, une à la fois
                  </T>
                ) : null}
              </View>
            )}

            {page.etat === 'en_attente' ? (
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={C.accent} />
                  <T style={{ flex: 1 }}>Valide la demande sur le {page.telephone}.</T>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <Btn kind="sec" small label="Je n’ai rien reçu" disabled={envoi} onPress={() => agir(() => CotisationPublique.abandonner(jeton))} />
                </View>
              </View>
            ) : null}

            {page.etat === 'a_payer' && page.enLigne ? (
              <View style={{ gap: 10 }}>
                {page.refus ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>Le paiement n’a pas abouti. Réessaie.</Text> : null}
                <Btn label={envoi ? 'Envoi…' : `Payer ${montantCotisation(page.montant, page.devise)}`} disabled={envoi} onPress={() => agir(() => CotisationPublique.payer(jeton))} />
                <T small muted>
                  La demande arrivera sur le {page.telephone}.
                </T>
              </View>
            ) : null}
            {page.etat === 'a_payer' && !page.enLigne ? <T muted>À régler directement{page.organisateur ? ` auprès de ${page.organisateur}` : ''}.</T> : null}

            {erreur ? <Text style={{ color: C.agressif, fontFamily: F.texte, fontSize: 14 }}>{erreur}</Text> : null}
            {page.enLigne ? (
              <T small muted>
                Mobile money via FlexPaie. Encaissé par Me pour {page.organisateur || 'l’organisateur'}.
              </T>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}
