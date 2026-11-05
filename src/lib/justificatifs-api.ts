import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { API_URL, api, apiFormulaire, tokenStore } from './api';
import { infoDevise } from './devises';
import { type FichierChoisi, type LectureFacture, type LiensJustificatif, typeDe } from './justificatifs';
import type { Justificatif } from './types';

/** Dépose le fichier sur me-api ; `equipe` quand la dépense est dans l'espace d'une équipe. */
export async function envoyerJustificatif(f: FichierChoisi, equipe?: string): Promise<Justificatif> {
  const form = new FormData();
  const type = typeDe(f.nom, f.type);
  if (Platform.OS === 'web') form.append('fichier', f.file ?? (await (await fetch(f.uri)).blob()), f.nom);
  // React Native lit lui-même le fichier local désigné par `uri`.
  else form.append('fichier', { uri: f.uri, name: f.nom, type } as unknown as Blob);
  if (equipe) form.append('equipe', equipe);
  const { justificatif } = await apiFormulaire<{ justificatif: Justificatif }>('/justificatifs', form, await tokenStore.get());
  return justificatif;
}

/** Fait lire par l'IA un justificatif déjà déposé : montant, date, commerçant, catégorie (parmi `categories`). */
export async function analyserJustificatif(id: string, ctx: { aujourdhui: string; devise: string; categories: { id: string; nom: string }[] }): Promise<LectureFacture> {
  const { lecture } = await api<{ lecture: LectureFacture }>('/justificatifs/analyse', {
    method: 'POST',
    body: { id, aujourdhui: ctx.aujourdhui, devise: infoDevise(ctx.devise).code, categories: ctx.categories.slice(0, 80).map((c) => ({ id: c.id, nom: c.nom.slice(0, 80) })) },
    token: await tokenStore.get(),
  });
  return lecture;
}

let dispo: Promise<boolean> | null = null;

/** Le serveur sait-il garder des justificatifs (Cloudinary configuré) ? Demandé une fois par lancement de l'app ; `null` : pas encore de réponse. */
export function useJustificatifsDisponibles() {
  const [ok, setOk] = useState<boolean | null>(API_URL ? null : false);
  useEffect(() => {
    if (!API_URL) return;
    dispo ??= tokenStore
      .get()
      .then((token) => api<{ disponible: boolean }>('/justificatifs', { token, discret: true }))
      .then((r) => !!r.disponible)
      .catch(() => {
        dispo = null;
        return false;
      });
    let actif = true;
    dispo.then((v) => actif && setOk(v));
    return () => {
      actif = false;
    };
  }, []);
  return ok;
}

/** Un lien vit 30 minutes sur le serveur : on le renouvelle un peu avant. */
const DUREE_LIENS = 25 * 60 * 1000;
const PAR_LOT = 100;
const gardes = new Map<string, { liens: LiensJustificatif; jusqua: number }>();
const attente = new Map<string, ((l: LiensJustificatif | null) => void)[]>();
let minuteur: ReturnType<typeof setTimeout> | null = null;

const lienGarde = (id: string) => {
  const g = gardes.get(id);
  return g && g.jusqua > Date.now() ? g.liens : null;
};

/** Une liste de dépenses demande ses vignettes d'un coup : on les regroupe en une seule requête. */
async function demanderLiens() {
  minuteur = null;
  const lot = new Map(attente);
  attente.clear();
  const ids = [...lot.keys()];
  const token = await tokenStore.get();
  for (let i = 0; i < ids.length; i += PAR_LOT) {
    const part = ids.slice(i, i + PAR_LOT);
    let recus: Record<string, LiensJustificatif> = {};
    try {
      recus = (await api<{ liens: Record<string, LiensJustificatif> }>('/justificatifs/liens', { method: 'POST', body: { ids: part }, token, discret: true })).liens;
    } catch {
      // Serveur injoignable : la dépense retombe sur l'adresse qu'elle garde.
    }
    for (const id of part) {
      const brut = recus[id];
      const liens = brut ? { apercu: `${API_URL}${brut.apercu}`, grand: `${API_URL}${brut.grand}`, fichier: `${API_URL}${brut.fichier}` } : null;
      if (liens) gardes.set(id, { liens, jusqua: Date.now() + DUREE_LIENS });
      lot.get(id)?.forEach((f) => f(liens));
    }
  }
}

function liensDe(id: string) {
  return new Promise<LiensJustificatif | null>((resolve) => {
    attente.set(id, [...(attente.get(id) ?? []), resolve]);
    minuteur ??= setTimeout(demanderLiens, 30);
  });
}

/** Les liens temporaires d'un justificatif ; `pret` : la réponse est arrivée, liens ou pas. */
export function useLiensJustificatif(id?: string) {
  const [lu, setLu] = useState<{ id: string; liens: LiensJustificatif | null } | null>(null);
  const garde = id ? lienGarde(id) : null;
  useEffect(() => {
    if (!id || !API_URL || lienGarde(id)) return;
    let actif = true;
    liensDe(id).then((liens) => actif && setLu({ id, liens }));
    return () => {
      actif = false;
    };
  }, [id]);
  const repondu = !!lu && lu.id === id;
  return { liens: garde ?? (repondu ? lu.liens : null), pret: !API_URL || !!garde || repondu };
}
