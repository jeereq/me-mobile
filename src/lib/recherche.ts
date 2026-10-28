import type { Href } from 'expo-router';

import { categoriesDe, categoriesDeItem, idBudgetDe } from './categories';
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
  { titre: 'Calendrier', href: '/calendrier', mots: 'agenda planning semaine mois jour échéances dates' },
  { titre: 'Projets', href: '/projets', mots: 'plan planning gantt excel import sous-tâches' },
  { titre: 'Comptes rendus', href: '/comptes-rendus' as Href, mots: 'réunion appel point notes décisions actions cr minutes' },
  { titre: 'Catégories', href: '/categories', mots: 'étiquettes classer tags' },
  { titre: 'Finances', href: '/finances', mots: 'budget dépenses argent revenus' },
  { titre: 'Objectifs financiers', href: '/finances?onglet=objectifs' as Href, mots: 'épargne economiser dette plan versement' },
  { titre: 'Statistiques', href: '/statistiques', mots: 'tendances graphiques' },
  { titre: 'État des lieux', href: '/rapport', mots: 'rapport recommandations conseils bilan résumé tableau de bord' },
  { titre: 'Récompenses', href: '/recompenses', mots: 'points badges niveau série' },
  { titre: 'Journal & contacts', href: '/journal' },
  { titre: 'Mails', href: '/messages', mots: 'gmail outlook boîte fils discussions messages courriels non lus' },
  { titre: 'Agendas & outils', href: '/sources', mots: 'google outlook gmail trello slack notion connecter agendas calendriers synchroniser' },
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
  const cats = categoriesDe(e);
  const bud = (x: { budget: string | null; categories?: string[] }) => idBudgetDe(f.budgets, x);
  const groupes: Resultat[][] = [
    PAGES.filter((p) => ok(p.titre, p.mots)).map((p) => ({ cle: `p:${p.href}`, groupe: 'Pages', titre: p.titre, href: p.href })),
    (e.projets ?? []).filter((p) => ok(p.nom, categoriesDeItem(p, cats).map((c) => c.nom).join(' '))).map((p) => ({ cle: `pr:${p.id}`, groupe: 'Projets', titre: `${p.emoji} ${p.nom}`, detail: p.archive ? 'Archivé' : undefined, href: { pathname: '/projets', params: { id: p.id } } as Href })),
    [...e.taches]
      .sort((a, z) => Number(a.statut === 'fait') - Number(z.statut === 'fait'))
      .filter((t) => ok(t.titre, t.responsable, categoriesDeItem(t, cats).map((c) => c.nom).join(' '), e.projets?.find((p) => p.id === t.projet)?.nom))
      .map((t) => {
        const projet = e.projets?.find((p) => p.id === t.projet);
        const quand = t.statut === 'fait' ? 'Faite' : t.echeance ? `Pour le ${dateFr(t.echeance)}` : undefined;
        return { cle: `t:${t.id}`, groupe: 'Tâches', titre: t.titre, detail: projet ? `${projet.nom}${quand ? ` · ${quand}` : ''}` : quand, href: (projet ? { pathname: '/projets', params: { id: projet.id } } : '/taches') as Href };
      }),
    [...(e.comptesRendus ?? [])]
      .sort((a, z) => z.date.localeCompare(a.date))
      .filter((x) => ok(x.titre, x.notes, x.resume, ...(x.participants ?? []), ...(x.decisions ?? []), ...x.actions.map((a) => a.titre)))
      .map((x) => ({ cle: `cr:${x.id}`, groupe: 'Comptes rendus', titre: x.titre || 'Compte rendu', detail: dateFr(x.date), href: { pathname: '/comptes-rendus', params: { id: x.id } } as Href })),
    cats.filter((c) => ok(c.nom, ...(c.mots ?? []))).map((c) => ({ cle: `cat:${c.id}`, groupe: 'Catégories', titre: `${c.emoji} ${c.nom}`, href: '/categories' as Href })),
    [...e.relances]
      .sort((a, z) => Number(a.statut === 'repondu') - Number(z.statut === 'repondu'))
      .filter((r) => ok(r.contact, r.sujet))
      .map((r) => ({ cle: `r:${r.id}`, groupe: 'Relances', titre: `${r.contact} · ${r.sujet}`, detail: r.statut === 'repondu' ? 'Répondu' : `Le ${dateFr(r.date)}`, href: '/relances' })),
    e.habitudes.filter((h) => ok(h.nom)).map((h) => ({ cle: `h:${h.id}`, groupe: 'Habitudes', titre: h.nom, href: '/habitudes' })),
    [...f.depenses]
      .sort((a, z) => z.date.localeCompare(a.date))
      .filter((x) => ok(x.note, bud(x) ? budget.get(bud(x)!) : 'hors budget', categoriesDeItem(x, cats).map((c) => c.nom).join(' '), String(x.montant).replace('.', ',')))
      .map((x) => ({ cle: `d:${x.id}`, groupe: 'Dépenses', titre: x.note || (bud(x) && budget.get(bud(x)!)) || 'Dépense', detail: `${fmtMontant(x.montant, f.devise)} · ${dateFr(x.date)}`, href: '/finances' })),
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
