import type { Href } from 'expo-router';

import { financesDe, fmtMontant } from './finances';
import { dateFr } from './stats-finances';
import type { Espace } from './types';

/** Recherche globale (Ctrl+K) : pages de l'app et contenu de l'espace, sans accents ni casse. */

export type Resultat = { cle: string; groupe: string; titre: string; detail?: string; href: Href };

export const PAGES: { titre: string; href: Href; mots?: string }[] = [
  { titre: "Aujourd'hui", href: '/', mots: 'accueil mission jour' },
  { titre: 'Relances', href: '/relances' },
  { titre: 'Tâches', href: '/taches' },
  { titre: 'Habitudes', href: '/habitudes' },
  { titre: 'Finances', href: '/finances', mots: 'budget dépenses argent revenus' },
  { titre: 'Statistiques', href: '/statistiques', mots: 'tendances graphiques' },
  { titre: 'Récompenses', href: '/recompenses', mots: 'points badges niveau série' },
  { titre: 'Journal & contacts', href: '/journal' },
  { titre: 'Agendas & outils', href: '/sources', mots: 'google outlook gmail trello slack notion connecter' },
  { titre: 'Assistant audio', href: '/assistant', mots: 'voix briefing ia' },
  { titre: 'Notifications', href: '/notifications', mots: 'rappels' },
  { titre: 'Configuration', href: '/config', mots: 'réglages admin' },
  { titre: 'Mon compte', href: '/compte', mots: 'profil mot de passe export données sécurité déconnexion apparence thème' },
];

export const sansAccents = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const PAR_GROUPE = 5;

export function rechercher(e: Espace, q: string): Resultat[] {
  const mots = sansAccents(q).split(/\s+/).filter(Boolean);
  if (!mots.length) return PAGES.map((p) => ({ cle: `p:${p.href}`, groupe: 'Aller à', titre: p.titre, href: p.href }));
  const ok = (...champs: (string | undefined)[]) => {
    const texte = sansAccents(champs.filter(Boolean).join(' '));
    return mots.every((m) => texte.includes(m));
  };
  const f = financesDe(e);
  const budget = new Map(f.budgets.map((b) => [b.id, `${b.emoji} ${b.nom}`]));
  const groupes: Resultat[][] = [
    PAGES.filter((p) => ok(p.titre, p.mots)).map((p) => ({ cle: `p:${p.href}`, groupe: 'Pages', titre: p.titre, href: p.href })),
    [...e.taches]
      .sort((a, z) => Number(a.statut === 'fait') - Number(z.statut === 'fait'))
      .filter((t) => ok(t.titre))
      .map((t) => ({ cle: `t:${t.id}`, groupe: 'Tâches', titre: t.titre, detail: t.statut === 'fait' ? 'Faite' : t.echeance ? `Pour le ${dateFr(t.echeance)}` : undefined, href: '/taches' })),
    [...e.relances]
      .sort((a, z) => Number(a.statut === 'repondu') - Number(z.statut === 'repondu'))
      .filter((r) => ok(r.contact, r.sujet))
      .map((r) => ({ cle: `r:${r.id}`, groupe: 'Relances', titre: `${r.contact} · ${r.sujet}`, detail: r.statut === 'repondu' ? 'Répondu' : `Le ${dateFr(r.date)}`, href: '/relances' })),
    e.habitudes.filter((h) => ok(h.nom)).map((h) => ({ cle: `h:${h.id}`, groupe: 'Habitudes', titre: h.nom, href: '/habitudes' })),
    [...f.depenses]
      .sort((a, z) => z.date.localeCompare(a.date))
      .filter((x) => ok(x.note, x.budget ? budget.get(x.budget) : 'hors budget', String(x.montant).replace('.', ',')))
      .map((x) => ({ cle: `d:${x.id}`, groupe: 'Dépenses', titre: x.note || (x.budget && budget.get(x.budget)) || 'Dépense', detail: `${fmtMontant(x.montant, f.devise)} · ${dateFr(x.date)}`, href: '/finances' })),
    e.contacts.filter((c) => ok(c.nom, c.organisation)).map((c) => ({ cle: `c:${c.id}`, groupe: 'Contacts', titre: c.nom, detail: c.organisation || undefined, href: '/journal' })),
    Object.values(e.journal)
      .sort((a, z) => z.date.localeCompare(a.date))
      .flatMap((j) => j.entrees.filter((x) => ok(x.texte)).map((x, i) => ({ cle: `j:${j.date}:${i}`, groupe: 'Journal', titre: x.texte, detail: `${dateFr(j.date)} · ${x.h}`, href: '/journal' as Href }))),
  ];
  return groupes.flatMap((g) => g.slice(0, PAR_GROUPE));
}

// Ouverture depuis n'importe où (barre latérale, bouton de l'accueil) sans faire passer d'état par le store.
const abonnes = new Set<() => void>();
export const ouvrirRecherche = () => abonnes.forEach((f) => f());
export function surRecherche(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}
