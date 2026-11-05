import { useReglagesAnalyse } from '@/lib/analyse-pref';
import { api } from '@/lib/api';
import type { RelectureReponse } from '@/lib/copilote';
import { useStore } from '@/lib/store';
import type { Boite } from '@/lib/types';

import { ContexteBrouillon, OutilsBrouillon, type ChoixAjustement } from './outils-reponse';

type Action = 'court' | 'formel' | 'refaire';
const AJUSTEMENTS: ChoixAjustement<Action>[] = [
  ['court', 'Plus court'],
  ['formel', 'Plus formel'],
  ['refaire', 'Refaire'],
];

type Nouveau = { a: string; sujet: string; boite?: Boite; texte: string; onTexte: (v: string) => void; onObjet: (v: string) => void };

function useDemandes({ a, sujet, boite, onObjet }: Pick<Nouveau, 'a' | 'sujet' | 'boite' | 'onObjet'>) {
  const { session, espace } = useStore();
  const { reglages } = useReglagesAnalyse();
  const commun = { a, sujet, ...(boite ? { boite } : {}), ton: espace.audio.ton, ...(reglages.consignes.trim() ? { consignes: reglages.consignes } : {}) };
  const rediger = async (corps: object) => {
    const x = await api<{ objet: string; message: string }>('/assistant/mails/rediger', { method: 'POST', token: session?.token, body: { ...commun, ...corps } });
    // L'objet écrit par l'utilisateur reste le sien.
    if (x.objet && !sujet.trim()) onObjet(x.objet);
    return x.message;
  };
  const relire = (texte: string) => api<RelectureReponse>('/assistant/mails/relire-nouveau', { method: 'POST', token: session?.token, body: { ...commun, texte } });
  return { rediger, relire };
}

/** Dire au copilote ce qu'il faut écrire : il rédige le mail et, s'il manque, son objet. */
export function ContexteNouveauMail({ texte, onTexte, ...n }: Nouveau) {
  const { rediger } = useDemandes(n);
  return (
    <ContexteBrouillon
      rediger={(contexte, net) => rediger({ action: 'contexte', contexte, ...(net ? { texte: net } : {}) })}
      texte={texte}
      onTexte={onTexte}
      label="Ton contexte pour ce mail"
      placeholder="Ton contexte : pourquoi tu écris, ce qu'il faut dire…"
    />
  );
}

/** Ajuster, écouter, dicter, vérifier et traduire le mail avant de l'envoyer. */
export function OutilsNouveauMail({ texte, onTexte, ...n }: Nouveau) {
  const { rediger, relire } = useDemandes(n);
  return (
    <OutilsBrouillon
      texte={texte}
      onTexte={onTexte}
      ajustements={AJUSTEMENTS}
      ajuster={(action, net) => rediger({ action, texte: net })}
      relire={relire}
      ecouter="Écouter le mail"
      titreEcoute="Ton mail"
      verifier="Vérifier le mail"
      traduire="Traduire le mail"
    />
  );
}
