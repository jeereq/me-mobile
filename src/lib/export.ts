import { Platform, Share } from 'react-native';

import { budgetDe, categoriesDeItem } from './categories';
import type { Categorie, Espace, Finances } from './types';

/** Fichier proposé au téléchargement sur le web, ou à la feuille de partage sur téléphone. */
export async function telecharger(nom: string, contenu: string, type: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([contenu], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: nom, message: contenu });
}

const jour = () => new Date().toISOString().slice(0, 10);

/** Tout ce que l'app garde sur cet appareil, en JSON lisible. */
export function exportLocal(espace: Espace) {
  return { nom: `me-donnees-${jour()}.json`, contenu: JSON.stringify({ exporteLe: new Date().toISOString(), espace }, null, 2) };
}

/** Les dépenses en CSV pour Excel ou LibreOffice : séparateur « ; », virgule décimale, BOM pour les accents. */
export function depensesCsv(f: Finances, categories: Categorie[] = []) {
  const nomCompte = new Map((f.comptes || []).map((c) => [c.id, c.nom]));
  const champ = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lignes = [...f.depenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => [x.date, x.montant.toFixed(2).replace('.', ','), f.devise, champ(budgetDe(f.budgets, x)?.nom || 'Hors budget'), champ(x.note), x.origine ? x.origine.montant.toFixed(2).replace('.', ',') : '', x.origine?.devise ?? '', champ((x.compte && nomCompte.get(x.compte)) || ''), x.lien ? 'oui' : '', champ(categoriesDeItem(x, categories).map((c) => c.nom).join(', '))].join(';'));
  return { nom: `me-depenses-${jour()}.csv`, contenu: `﻿${['Date;Montant;Devise;Budget;Note;Montant d\'origine;Devise d\'origine;Compte;Virement entre comptes;Catégories', ...lignes].join('\r\n')}\r\n` };
}
