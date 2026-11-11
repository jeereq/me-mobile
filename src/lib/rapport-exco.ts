import { estIncertain, nomEtat } from './etats-tache';
import { parPilier, type LignePilier, nomPilier } from './piliers';
import { nomTrimestre, trimestreDe, trimestreSuivant } from './feuille-de-route';
import type { Plan } from './planning';
import { nomStatutDecision } from './decisions-exco';
import { niveauRisque, scoreRisque } from './risques';
import type { DecisionExco, EtatTache, Projet, Risque, Tache } from './types';

/**
 * Le rapport trimestriel pour le comité exécutif : ce qui devait finir dans le trimestre, ce qui est fait, ce qui est en retard,
 * ce qu'il faut décider, ce que coûte le trimestre et ce qui vient ensuite. Tout vient des tâches des projets.
 */
export type LigneRapport = { id: string; titre: string; projet: string; projetNom: string; fin: string; fait: boolean; retard: boolean; etat?: EtatTache; responsable?: string; budget?: number; engage?: number; pilier?: number[] };
export type ProjetRapport = { projet: Projet; total: number; faites: number; enRetard: number; bloquees: number; aValider: number; prevu: number; engage: number; taches: LigneRapport[] };
export type LigneRisque = { id: string; titre: string; projetNom?: string; score: number; mitigation?: string; responsable?: string };
export type LigneDecision = { id: string; titre: string; date: string; statut: DecisionExco['statut']; decision?: string; projetNom?: string };
export type Rapport = {
  cle: string;
  nom: string;
  debut: string;
  fin: string;
  genereLe: string;
  projets: ProjetRapport[];
  total: number;
  faites: number;
  enRetard: number;
  prevu: number;
  engage: number;
  /** Taux de réalisation, de 0 à 100 ; null si rien n'était prévu. */
  realisation: number | null;
  /** Où en est chaque pilier du groupe (vide si aucune action n'en cite). */
  piliers: LignePilier[];
  /** Les risques ouverts de niveau élevé, les plus graves d'abord (dix au plus). */
  risques: LigneRisque[];
  /** Les décisions du journal datées de ce trimestre et déjà traitées (prises, refusées ou reportées). */
  decisionsJournal: LigneDecision[];
  /** Actions à faire en attente de validation : les décisions que l'Exco doit prendre. */
  decisions: LigneRapport[];
  /** Phrases prêtes à lire : retards, blocages, trimestre chargé, actions sans responsable. */
  vigilance: string[];
  suivant: { nom: string; total: number; prevu: number; parProjet: { projet: Projet; total: number }[] };
};

const finDuTrimestre = (cle: string) => {
  const m = Number(cle.slice(6)) * 3;
  const dernier = new Date(Date.UTC(Number(cle.slice(0, 4)), m, 0)).getUTCDate();
  return `${cle.slice(0, 4)}-${String(m).padStart(2, '0')}-${String(dernier).padStart(2, '0')}`;
};
const debutDuTrimestre = (cle: string) => `${cle.slice(0, 4)}-${String((Number(cle.slice(6)) - 1) * 3 + 1).padStart(2, '0')}-01`;
const arrondi = (n: number) => Math.round(n * 100) / 100;
const pluriel = (n: number, un: string, plusieurs = `${un}s`) => `${n} ${n > 1 ? plusieurs : un}`;

type Entree = { projet: Projet; plan: Plan; taches: Tache[] };

/** Les trimestres où une action finit, du premier au dernier, sans trou : de quoi choisir le rapport à produire. */
export function trimestresDisponibles(entrees: Entree[], aujourdhui: string): string[] {
  const cles = new Set<string>([trimestreDe(aujourdhui)]);
  for (const { plan, taches } of entrees)
    for (const t of taches) {
      const l = plan.lignes.get(t.id);
      if (l && !l.resume) cles.add(trimestreDe(l.fin));
    }
  const tri = [...cles].sort();
  const sortie: string[] = [];
  for (let c = tri[0]; c <= tri[tri.length - 1] && sortie.length < 24; c = trimestreSuivant(c)) sortie.push(c);
  return sortie;
}

export function construireRapport(entrees: Entree[], cle: string, aujourdhui: string, maintenant = new Date().toISOString(), extras: { risques?: Risque[]; decisions?: DecisionExco[] } = {}): Rapport {
  const nomProjet = (id?: string) => (id ? entrees.find((e) => e.projet.id === id)?.projet.nom : undefined);
  const suivantCle = trimestreSuivant(cle);
  const projets: ProjetRapport[] = [];
  const decisions: LigneRapport[] = [];
  const suivant = { nom: nomTrimestre(suivantCle), total: 0, prevu: 0, parProjet: [] as { projet: Projet; total: number }[] };
  let sansResponsable = 0;
  const bloqueesNoms: string[] = [];

  for (const { projet, plan, taches } of entrees) {
    const p: ProjetRapport = { projet, total: 0, faites: 0, enRetard: 0, bloquees: 0, aValider: 0, prevu: 0, engage: 0, taches: [] };
    let prochains = 0;
    for (const t of taches) {
      const l = plan.lignes.get(t.id);
      if (!l || l.resume) continue;
      const q = trimestreDe(l.fin);
      const ligne: LigneRapport = { id: t.id, titre: t.titre, projet: projet.id, projetNom: projet.nom, fin: l.fin, fait: l.fait, retard: !l.fait && l.fin < aujourdhui, ...(t.etat && !l.fait ? { etat: t.etat } : {}), ...(t.responsable ? { responsable: t.responsable } : {}), ...(t.budget !== undefined ? { budget: t.budget } : {}), ...(t.engage !== undefined ? { engage: t.engage } : {}), ...(t.pilier?.length ? { pilier: t.pilier } : {}) };
      if (q === suivantCle) {
        prochains++;
        suivant.total++;
        suivant.prevu += t.budget ?? 0;
      }
      // Une décision attendue reste à l'ordre du jour tant qu'elle n'est pas prise, même d'un trimestre passé.
      if (!l.fait && t.etat === 'a_valider' && q <= cle) decisions.push(ligne);
      if (q !== cle) continue;
      p.total++;
      if (l.fait) p.faites++;
      else {
        if (ligne.retard) p.enRetard++;
        if (t.etat === 'bloque') p.bloquees++;
        if (t.etat === 'a_valider') p.aValider++;
        if (!t.responsable?.trim() && !t.affecteA) sansResponsable++;
      }
      p.prevu += t.budget ?? 0;
      p.engage += t.engage ?? 0;
      p.taches.push(ligne);
    }
    if (prochains) suivant.parProjet.push({ projet, total: prochains });
    if (p.bloquees) bloqueesNoms.push(`${projet.nom} (${p.bloquees})`);
    if (p.total || p.aValider) projets.push({ ...p, prevu: arrondi(p.prevu), engage: arrondi(p.engage) });
  }
  // Dans chaque projet : les retards d'abord, puis le reste par date.
  for (const p of projets) p.taches.sort((a, b) => Number(b.retard) - Number(a.retard) || Number(a.fait) - Number(b.fait) || a.fin.localeCompare(b.fin));
  decisions.sort((a, b) => a.fin.localeCompare(b.fin));
  suivant.prevu = arrondi(suivant.prevu);

  const somme = (f: (p: ProjetRapport) => number) => projets.reduce((n, p) => n + f(p), 0);
  const total = somme((p) => p.total);
  const faites = somme((p) => p.faites);
  const enRetard = somme((p) => p.enRetard);
  const prevu = arrondi(somme((p) => p.prevu));
  const engage = arrondi(somme((p) => p.engage));
  const restantes = total - faites;
  const incertaines = projets.reduce((n, p) => n + p.taches.filter((t) => !t.fait && estIncertain(t.etat)).length, 0);

  const vigilance: string[] = [];
  if (enRetard) vigilance.push(`${pluriel(enRetard, 'action en retard', 'actions en retard')} : ${projets.filter((p) => p.enRetard).map((p) => `${p.projet.nom} (${p.enRetard})`).join(', ')}.`);
  if (bloqueesNoms.length) vigilance.push(`Actions bloquées : ${bloqueesNoms.join(', ')}.`);
  if (prevu > 0 && engage > prevu) vigilance.push(`Le budget engagé (${engage}) dépasse le budget prévu (${prevu}).`);
  if (restantes >= 8 && cle >= trimestreDe(aujourdhui)) vigilance.push(`Trimestre chargé : ${pluriel(restantes, 'action reste', 'actions restent')} à faire${incertaines ? `, dont ${incertaines} pas encore confirmée${incertaines > 1 ? 's' : ''}` : ''}.`);
  if (sansResponsable) vigilance.push(`${pluriel(sansResponsable, 'action à faire n\'a', 'actions à faire n\'ont')} pas de responsable.`);

  return { cle, nom: nomTrimestre(cle), debut: debutDuTrimestre(cle), fin: finDuTrimestre(cle), genereLe: maintenant, projets,
    risques: (extras.risques ?? [])
      .filter((x) => x.statut === 'ouvert' && niveauRisque(x) === 'eleve')
      .sort((a, b) => scoreRisque(b) - scoreRisque(a) || a.titre.localeCompare(b.titre, 'fr'))
      .slice(0, 10)
      .map((x) => ({ id: x.id, titre: x.titre, score: scoreRisque(x), ...(nomProjet(x.projet) ? { projetNom: nomProjet(x.projet) } : {}), ...(x.mitigation ? { mitigation: x.mitigation } : {}), ...(x.responsable ? { responsable: x.responsable } : {}) })),
    decisionsJournal: (extras.decisions ?? [])
      .filter((d) => d.statut !== 'a_prendre' && d.date >= debutDuTrimestre(cle) && d.date <= finDuTrimestre(cle))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ id: d.id, titre: d.titre, date: d.date, statut: d.statut, ...(d.decision ? { decision: d.decision } : {}), ...(nomProjet(d.projet) ? { projetNom: nomProjet(d.projet) } : {}) })),
    piliers: parPilier(projets.flatMap((p) => p.taches)), total, faites, enRetard, prevu, engage, realisation: total ? Math.round((faites / total) * 100) : null, decisions, vigilance, suivant };
}

/* ---------- Mises en forme ---------- */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const date = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const somme = (n: number, devise: string) => `${Math.round(n).toLocaleString('fr-FR').replace(/ /g, ' ')} ${devise}`;

/** Une page HTML autonome, prête à imprimer ou à enregistrer en PDF. */
export function rapportHtml(r: Rapport, devise = '$', titre = 'Rapport trimestriel'): string {
  const ligneProjet = (p: ProjetRapport) =>
    `<tr><td>${esc(`${p.projet.emoji} ${p.projet.nom}`)}</td><td class="n">${p.faites} / ${p.total}</td><td class="n${p.enRetard ? ' alerte' : ''}">${p.enRetard}</td><td class="n">${p.bloquees}</td><td class="n">${p.prevu ? esc(somme(p.prevu, devise)) : '—'}</td><td class="n">${p.engage ? esc(somme(p.engage, devise)) : '—'}</td></tr>`;
  const decision = (t: LigneRapport) => `<li>${esc(t.titre)} <span class="s">— ${esc(t.projetNom)}${t.budget ? `, ${esc(somme(t.budget, devise))}` : ''}, avant le ${date(t.fin)}</span></li>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(`${titre} ${r.nom}`)}</title><style>
body{font:14px/1.45 system-ui,Segoe UI,Arial,sans-serif;color:#171c24;max-width:860px;margin:32px auto;padding:0 20px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px;border-bottom:1px solid #d8dbe3;padding-bottom:4px}
.s{color:#626b77;font-size:13px}.k{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.k div{flex:1;min-width:130px;border:1px solid #d8dbe3;border-radius:10px;padding:10px 12px}
.k b{display:block;font-size:22px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e6e8ee}th{font-size:12px;color:#626b77}
.n{text-align:right;white-space:nowrap}.alerte{color:#c0303c;font-weight:600}li{margin:4px 0}
@media print{body{margin:0;max-width:none}h2{break-after:avoid}tr{break-inside:avoid}}
</style></head><body>
<h1>${esc(titre)} · ${esc(r.nom)}</h1>
<div class="s">Du ${date(r.debut)} au ${date(r.fin)} · préparé le ${date(r.genereLe.slice(0, 10))}</div>
<div class="k"><div><b>${r.realisation === null ? '—' : `${r.realisation} %`}</b>réalisé (${r.faites} sur ${r.total})</div><div><b${r.enRetard ? ' class="alerte"' : ''}>${r.enRetard}</b>en retard</div><div><b>${r.decisions.length}</b>à décider</div><div><b>${r.prevu ? esc(somme(r.prevu, devise)) : '—'}</b>budget prévu${r.engage ? `, ${esc(somme(r.engage, devise))} engagé` : ''}</div></div>
<h2>Points de vigilance</h2>${r.vigilance.length ? `<ul>${r.vigilance.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>` : '<p class="s">Rien à signaler.</p>'}
<h2>Avancement par projet</h2>${r.projets.length ? `<table><tr><th>Projet</th><th class="n">Faites</th><th class="n">En retard</th><th class="n">Bloquées</th><th class="n">Prévu</th><th class="n">Engagé</th></tr>${r.projets.map(ligneProjet).join('')}</table>` : '<p class="s">Aucune action ne finit dans ce trimestre.</p>'}
${r.piliers.length ? `<h2>Par pilier du groupe</h2><table><tr><th>Pilier</th><th class="n">Faites</th><th class="n">En retard</th></tr>${r.piliers.map((x) => `<tr><td>${esc(nomPilier(x.pilier))}</td><td class="n">${x.faites} / ${x.total}</td><td class="n${x.enRetard ? ' alerte' : ''}">${x.enRetard}</td></tr>`).join('')}</table>` : ''}
${r.risques.length ? `<h2>Risques élevés</h2><ul>${r.risques.map((x) => `<li>${esc(x.titre)} <span class="s">— ${[x.projetNom, x.responsable, x.mitigation ? `réponse : ${x.mitigation}` : ''].filter(Boolean).map(esc).join(', ') || 'score ' + x.score}</span></li>`).join('')}</ul>` : ''}
<h2>Décisions attendues de l'Exco</h2>${r.decisions.length ? `<ul>${r.decisions.map(decision).join('')}</ul>` : '<p class="s">Aucune décision en attente.</p>'}
${r.decisionsJournal.length ? `<h2>Décisions du trimestre</h2><ul>${r.decisionsJournal.map((d) => `<li>${esc(d.titre)} <span class="s">— ${esc(nomStatutDecision(d.statut))} le ${date(d.date)}${d.decision ? ` : ${esc(d.decision)}` : ''}</span></li>`).join('')}</ul>` : ''}
<h2>Détail des actions</h2>${r.projets.map((p) => `<h3>${esc(`${p.projet.emoji} ${p.projet.nom}`)}</h3><table>${p.taches.map((t) => `<tr><td>${t.fait ? '✓' : t.retard ? '!' : '·'}</td><td>${esc(t.titre)}${t.etat ? ` <span class="s">(${esc(nomEtat(t.etat))})</span>` : ''}</td><td class="s">${esc(t.responsable ?? '')}</td><td class="n${t.retard ? ' alerte' : ''}">${date(t.fin)}</td><td class="n">${t.budget ? esc(somme(t.budget, devise)) : ''}</td></tr>`).join('')}</table>`).join('')}
<h2>Trimestre suivant : ${esc(r.suivant.nom)}</h2>${r.suivant.total ? `<p>${pluriel(r.suivant.total, 'action prévue', 'actions prévues')}${r.suivant.prevu ? `, ${esc(somme(r.suivant.prevu, devise))} de budget` : ''}.</p><ul>${r.suivant.parProjet.map((x) => `<li>${esc(`${x.projet.emoji} ${x.projet.nom}`)} : ${x.total}</li>`).join('')}</ul>` : '<p class="s">Rien de prévu.</p>'}
</body></html>`;
}

/** Les mêmes chiffres en CSV pour Excel : séparateur « ; », virgule décimale, BOM pour les accents. */
export function rapportCsv(r: Rapport, devise = '$'): string {
  const champ = (s: string | number) => {
    const t = typeof s === 'number' ? String(s).replace('.', ',') : s;
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const ligne = (...c: (string | number)[]) => c.map(champ).join(';');
  const l: string[] = [
    ligne(`Rapport trimestriel ${r.nom}`, `du ${date(r.debut)} au ${date(r.fin)}`),
    '',
    ligne('Synthèse'),
    ligne('Actions prévues', r.total),
    ligne('Actions faites', r.faites),
    ligne('Réalisation (%)', r.realisation ?? ''),
    ligne('En retard', r.enRetard),
    ligne(`Budget prévu (${devise})`, r.prevu),
    ligne(`Budget engagé (${devise})`, r.engage),
    '',
    ligne('Projet', 'Prévues', 'Faites', 'En retard', 'Bloquées', `Prévu (${devise})`, `Engagé (${devise})`),
    ...r.projets.map((p) => ligne(p.projet.nom, p.total, p.faites, p.enRetard, p.bloquees, p.prevu, p.engage)),
    ...(r.piliers.length ? ['', ligne('Pilier', 'Prévues', 'Faites', 'En retard'), ...r.piliers.map((x) => ligne(nomPilier(x.pilier), x.total, x.faites, x.enRetard))] : []),
    '',
    ligne('Décisions attendues'),
    ligne('Action', 'Projet', 'Avant le', `Budget (${devise})`),
    ...r.decisions.map((t) => ligne(t.titre, t.projetNom, date(t.fin), t.budget ?? '')),
    '',
    ...(r.risques.length ? [ligne('Risques élevés'), ...r.risques.map((x) => ligne(x.titre, x.projetNom ?? '', x.score, x.mitigation ?? '')), ''] : []),
    ...(r.decisionsJournal.length ? [ligne('Décisions du trimestre'), ...r.decisionsJournal.map((d) => ligne(d.titre, date(d.date), nomStatutDecision(d.statut), d.decision ?? '')), ''] : []),
    ligne('Détail des actions'),
    ligne('Projet', 'Action', 'Fin', 'Statut', 'État', 'Responsable', `Budget (${devise})`, `Engagé (${devise})`),
    ...r.projets.flatMap((p) => p.taches.map((t) => ligne(p.projet.nom, t.titre, date(t.fin), t.fait ? 'Fait' : t.retard ? 'En retard' : 'À faire', t.etat ? nomEtat(t.etat) : '', t.responsable ?? '', t.budget ?? '', t.engage ?? ''))),
    '',
    ligne(`Trimestre suivant : ${r.suivant.nom}`, r.suivant.total, r.suivant.prevu),
  ];
  return `﻿${l.join('\r\n')}\r\n`;
}

/** Un résumé en texte, pour la feuille de partage d'un téléphone. */
export function rapportTexte(r: Rapport, devise = '$'): string {
  return [
    `Rapport trimestriel ${r.nom}`,
    `${pluriel(r.faites, 'action faite', 'actions faites')} sur ${r.total}${r.realisation === null ? '' : ` (${r.realisation} %)`}, ${r.enRetard} en retard.`,
    r.prevu ? `Budget : ${somme(r.engage, devise)} engagé sur ${somme(r.prevu, devise)}.` : '',
    '',
    ...(r.vigilance.length ? ['À surveiller :', ...r.vigilance.map((v) => `- ${v}`), ''] : []),
    'Par projet :',
    ...r.projets.map((p) => `- ${p.projet.nom} : ${p.faites}/${p.total}${p.enRetard ? `, ${p.enRetard} en retard` : ''}`),
    ...(r.decisions.length ? ['', 'Décisions attendues :', ...r.decisions.map((t) => `- ${t.titre} (${t.projetNom}, avant le ${date(t.fin)})`)] : []),
    '',
    `${r.suivant.nom} : ${pluriel(r.suivant.total, 'action prévue', 'actions prévues')}.`,
  ]
    .filter((x, i, a) => x !== '' || a[i - 1] !== '')
    .join('\n');
}
