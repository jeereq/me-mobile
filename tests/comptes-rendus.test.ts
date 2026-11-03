import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  annulerOuverture,
  appliquerSuggestion,
  candidatsCloture,
  comptesRendusLies,
  donneesCompteRendu,
  etatCompteRendu,
  fusionnerActions,
  lireAnalyseCompteRendu,
  lireNotes,
  noterClotures,
  nouveauCompteRendu,
  ouvrirActions,
  rapprocherFaits,
  suggestionsCompteRendu,
  supprimerCompteRendu,
  texteCompteRendu,
} from '../src/lib/comptes-rendus.ts';
import { decouperLecture, regrouperLecture } from '../src/lib/lecture.ts';
import type { CompteRendu, Espace, Relance, Tache } from '../src/lib/types.ts';

const d = '2026-10-28'; // un mercredi
let n = 0;
const id = () => `x${n++}`;

const tache = (x: Partial<Tache> & Pick<Tache, 'id' | 'titre'>): Tache => ({ source: 'manuel', priorite: 'moyenne', echeance: null, statut: 'en_attente', mode: 'normal', creeLe: d, ...x });
const relance = (x: Partial<Relance> & Pick<Relance, 'id' | 'contact' | 'sujet'>): Relance => ({ boite: 'pro', date: d, statut: 'a_faire', mode: 'normal', creeLe: d, ...x });
const espace = (x: Partial<Espace> = {}): Espace => ({ relances: [], taches: [], habitudes: [], contacts: [], journal: {}, agenda: {}, sources: {}, sourcesAutres: [], audio: { voix: '', vitesse: 1, hauteur: 1, ton: 'neutre', sections: [], lireReponses: false }, majLe: d, ...x }) as Espace;

describe('comptes rendus : lire les notes sans IA', () => {
  it('range décisions, actions et faits, par section ou par marque', () => {
    const r = lireNotes(
      `Contexte :
Point sur le lancement avec Paul et Sophie.
Décisions
- On garde la date du 15 novembre
- Budget validé à 3 000 €
Actions
- @Paul envoyer le devis vendredi
- Préparer la maquette demain urgent
- Relancer Marie lundi pour la facture
Fait :
- [x] Devis envoyé
Décision : pas de version mobile pour l'instant
TODO : réserver la salle le 12/11
✓ Maquette validée`,
      d,
    );
    assert.deepEqual(r.decisions, ['On garde la date du 15 novembre', 'Budget validé à 3 000 €', "Pas de version mobile pour l'instant"]);
    assert.deepEqual(r.faits, ['Devis envoyé', 'Maquette validée']);
    assert.equal(r.actions.length, 4);
    assert.deepEqual(r.actions[0], { genre: 'tache', titre: 'Envoyer le devis', echeance: '2026-10-30', priorite: 'moyenne', responsable: 'Paul' });
    assert.deepEqual(r.actions[1], { genre: 'tache', titre: 'Préparer la maquette', echeance: '2026-10-29', priorite: 'haute' });
    assert.deepEqual(r.actions[2], { genre: 'relance', titre: 'Facture', contact: 'Marie', echeance: '2026-11-02', priorite: 'moyenne' });
    assert.equal(r.actions[3].titre, 'Réserver la salle');
    assert.equal(r.actions[3].echeance, '2026-11-12');
  });

  it('garde les notes libres hors des actions, sauf une relance', () => {
    const r = lireNotes('Paul trouve le prix élevé.\nRappeler Paul jeudi au sujet du prix\nRappeler Paul jeudi au sujet du prix', d);
    assert.deepEqual(r.decisions, []);
    assert.equal(r.actions.length, 1);
    assert.equal(r.actions[0].genre, 'relance');
    assert.equal(r.actions[0].contact, 'Paul');
  });
});

describe('comptes rendus : clôturer', () => {
  const e = espace({
    projets: [{ id: 'p', nom: 'Site', emoji: '🚀', debut: d, joursOuvres: true, creeLe: d }],
    taches: [
      tache({ id: 't1', titre: 'Envoyer le devis à Paul', projet: 'p' }),
      tache({ id: 't2', titre: 'Écrire les textes', projet: 'p', statut: 'fait' }),
      tache({ id: 'res', titre: 'Résumé', projet: 'p' }),
      tache({ id: 't3', titre: 'Sous-tâche', projet: 'p', parent: 'res' }),
      tache({ id: 't9', titre: 'Autre chose' }),
    ],
    relances: [relance({ id: 'r1', contact: 'Marie', sujet: 'Facture' }), relance({ id: 'r2', contact: 'Jean', sujet: 'Contrat' })],
  });
  const cr: CompteRendu = { ...nouveauCompteRendu({ id: 'cr', date: d, maintenant: d, projets: ['p'], relances: ['r1'] }), notes: '' };

  it('propose les tâches du projet (sans résumé ni tâche déjà faite) et les relances rattachées', () => {
    const c = candidatsCloture(e, cr);
    assert.deepEqual(c.map((x) => x.ref), ['t:t1', 't:t3', 'r:r1']);
  });

  it('rapproche « Devis envoyé » de « Envoyer le devis à Paul »', () => {
    const c = candidatsCloture(e, cr);
    assert.deepEqual(rapprocherFaits(['Devis envoyé à Paul'], c), ['t:t1']);
    assert.deepEqual(rapprocherFaits(['Rien à voir'], c), []);
  });

  it('note les clôtures, et les retire quand on rouvre', () => {
    const e2 = noterClotures({ ...e, comptesRendus: [cr] }, 'cr', ['t:t1', 'r:r1'], d);
    assert.deepEqual(e2.comptesRendus![0].clotures, [{ genre: 'tache', id: 't1', le: d }, { genre: 'relance', id: 'r1', le: d }]);
    const e3 = noterClotures(e2, 'cr', ['t:t1'], d, true);
    assert.deepEqual(e3.comptesRendus![0].clotures, [{ genre: 'relance', id: 'r1', le: d }]);
    assert.deepEqual(comptesRendusLies(e2, 'tache', 't1').map((x) => x.id), ['cr']);
  });
});

describe('comptes rendus : ouvrir des tâches et relances', () => {
  it('crée les points choisis avec le lien vers le compte rendu, sans doublon', () => {
    const base = espace({ taches: [tache({ id: 'deja', titre: 'Préparer la maquette' })] });
    const cr = nouveauCompteRendu({ id: 'cr', date: d, maintenant: d });
    cr.actions = fusionnerActions(cr, lireNotes('Actions\n- Préparer la maquette\n- Envoyer le devis vendredi\n- Relancer Marie lundi pour la facture', d).actions, id);
    const e = { ...base, comptesRendus: [cr] };
    const r = ouvrirActions(e, 'cr', cr.actions.map((a) => a.id), { id, maintenant: d, d, modeTache: 'normal', modeRelance: 'normal', boite: 'pro' });
    assert.equal(r.crees.length, 2);
    assert.equal(r.espace.taches.length, 2);
    const t = r.espace.taches.find((x) => x.titre === 'Envoyer le devis')!;
    assert.equal(t.compteRendu, 'cr');
    assert.equal(t.echeance, '2026-10-30');
    assert.equal(r.espace.relances[0].contact, 'Marie');
    assert.equal(r.espace.relances[0].compteRendu, 'cr');
    // La maquette existait : le point y est relié.
    assert.equal(r.espace.comptesRendus![0].actions[0].cree, 'deja');
    assert.deepEqual(etatCompteRendu(r.espace.comptesRendus![0], r.espace), { aConvertir: 0, enCours: 3, terminees: 0, clos: 0 });
    // Reconvertir ne recrée rien.
    assert.equal(ouvrirActions(r.espace, 'cr', cr.actions.map((a) => a.id), { id, maintenant: d, d, modeTache: 'normal', modeRelance: 'normal', boite: 'pro' }).crees.length, 0);
    const annule = annulerOuverture(r.espace, 'cr', r.crees);
    assert.equal(annule.taches.length, 1);
    assert.equal(annule.relances.length, 0);
    assert.equal(annule.comptesRendus![0].actions.filter((a) => a.cree).length, 1);
  });

  it('met les tâches dans le projet rattaché, avec la date dite en réunion', () => {
    const projet = { id: 'p', nom: 'Site', emoji: '🚀', debut: d, joursOuvres: true, creeLe: d };
    const cr = nouveauCompteRendu({ id: 'cr', date: d, maintenant: d, projets: ['p'] });
    cr.actions = [{ id: 'a', genre: 'tache', titre: 'Tester le formulaire', echeance: '2026-11-03' }];
    const r = ouvrirActions(espace({ projets: [projet], comptesRendus: [cr] }), 'cr', ['a'], { id, maintenant: d, d, modeTache: 'normal', modeRelance: 'normal', boite: 'pro', projet: 'p' });
    const t = r.espace.taches[0];
    assert.equal(t.projet, 'p');
    assert.equal(t.debut, '2026-11-03');
    assert.equal(t.fixe, true);
  });

  it('supprimer le compte rendu garde les tâches, sans le lien', () => {
    const cr = nouveauCompteRendu({ id: 'cr', date: d, maintenant: d });
    const e = supprimerCompteRendu(espace({ comptesRendus: [cr], taches: [tache({ id: 't', titre: 'x', compteRendu: 'cr' })] }), 'cr');
    assert.equal(e.comptesRendus!.length, 0);
    assert.equal(e.taches[0].compteRendu, undefined);
  });
});

describe('comptes rendus : analyse par l’IA', () => {
  it('envoie les éléments ouverts avec leur référence', () => {
    const e = espace({ relances: [relance({ id: 'r1', contact: 'Marie', sujet: 'Facture' })] });
    const cr = { ...nouveauCompteRendu({ id: 'cr', date: d, maintenant: d, relances: ['r1'] }), notes: 'Marie a payé.' };
    const j = JSON.parse(donneesCompteRendu(cr, e, d));
    assert.deepEqual(j.ouverts, [{ ref: 'r:r1', genre: 'relance', titre: 'Marie · Facture' }]);
    assert.equal(j.notes, 'Marie a payé.');
  });

  it('lit la réponse avec des valeurs sûres', () => {
    const r = lireAnalyseCompteRendu(
      '```json\n' +
        JSON.stringify({
          resume: '**Point** rapide.',
          decisions: ['Garder la date', ''],
          actions: [
            { genre: 'tache', titre: 'Envoyer le devis', priorite: 'urgente', echeance: '2026-10-30', responsable: 'Paul' },
            { genre: 'relance', titre: 'Contrat', contact: 'Jean' },
            { genre: 'relance', titre: 'Sans contact' },
            { genre: 'tache', titre: 'envoyer le devis !' },
          ],
          clotures: ['r:r1', 'r:inconnue'],
        }) +
        '\n```',
      ['r:r1'],
      d,
    );
    assert.equal(r.resume, 'Point rapide.');
    assert.deepEqual(r.decisions, ['Garder la date']);
    assert.deepEqual(r.actions, [
      { genre: 'tache', titre: 'Envoyer le devis', responsable: 'Paul', priorite: 'moyenne', echeance: '2026-10-30' },
      { genre: 'relance', titre: 'Contrat', contact: 'Jean', priorite: 'moyenne', echeance: d },
      { genre: 'tache', titre: 'Sans contact', priorite: 'moyenne', echeance: null },
    ]);
    assert.deepEqual(r.clotures, ['r:r1']);
  });
});

describe('comptes rendus : réunion enregistrée', () => {
  it('envoie la transcription à l\'IA, avec le jour de la semaine', () => {
    const cr = { ...nouveauCompteRendu({ id: 'c', date: d, maintenant: d }), transcription: 'on se voit chaque lundi' };
    const j = JSON.parse(donneesCompteRendu(cr, espace(), d));
    assert.equal(j.transcription, 'on se voit chaque lundi');
    assert.equal(j.jourSemaine, 'mercredi');
  });
  it('relit tâches, relances, mails et habitudes de la réponse, avec des valeurs sûres', () => {
    const r = lireAnalyseCompteRendu(
      JSON.stringify({
        actions: [
          { genre: 'tache', titre: 'Préparer le plan', echeance: '2026-10-30' },
          { genre: 'relance', titre: 'Facture signée', contact: 'Marie' },
          { genre: 'mail', titre: 'Compte rendu pour Paul', contact: 'Paul', corps: 'Bonjour Paul,\nvoici…' },
          { genre: 'mail', titre: 'Sans destinataire', contact: '' },
          { genre: 'habitude', titre: 'Point d’équipe', frequence: 'hebdo', jour: 1, heure: '09:30' },
          { genre: 'habitude', titre: 'Mauvais rythme', frequence: 'souvent' },
          { genre: 'habitude', titre: 'Sauvegarde', frequence: 'quotidien', jour: 3, heure: '25:00' },
          { genre: 'habitude', titre: 'Jour absurde', frequence: 'hebdo', jour: 12 },
        ],
      }),
      [],
      d,
    );
    const par = (t: string) => r.actions.find((a) => a.titre === t)!;
    assert.equal(par('Préparer le plan').genre, 'tache');
    assert.equal(par('Facture signée').genre, 'relance');
    assert.equal(par('Compte rendu pour Paul').genre, 'mail');
    assert.match(par('Compte rendu pour Paul').corps!, /voici/);
    assert.equal(par('Sans destinataire').genre, 'tache');
    assert.deepEqual([par('Point d’équipe').frequence, par('Point d’équipe').jour, par('Point d’équipe').heure], ['hebdo', 1, '09:30']);
    assert.equal(par('Mauvais rythme').genre, 'tache');
    assert.deepEqual([par('Sauvegarde').jour, par('Sauvegarde').heure], [null, undefined]);
    assert.equal(par('Jour absurde').jour, 1);
  });
  it('ouvre une habitude, sans doublon, et l\'annule', () => {
    let cr: CompteRendu = nouveauCompteRendu({ id: 'c', date: d, maintenant: d });
    cr = { ...cr, actions: fusionnerActions(cr, [{ genre: 'habitude', titre: 'Point d’équipe', frequence: 'hebdo', jour: 1 }, { genre: 'mail', titre: 'Envoyer le CR', contact: 'Paul', corps: 'Bonjour' }], id) };
    const e = espace({ comptesRendus: [cr] });
    const o = { id, maintenant: d, d, modeTache: 'normal' as const, modeRelance: 'normal' as const, boite: 'pro' as const };
    const { espace: e2, crees } = ouvrirActions(e, 'c', cr.actions.map((a) => a.id), o);
    assert.equal(crees.length, 1);
    assert.equal(e2.habitudes.length, 1);
    assert.deepEqual([e2.habitudes[0].nom, e2.habitudes[0].frequence, e2.habitudes[0].jour, e2.habitudes[0].compteRendu], ['Point d’équipe', 'hebdo', 1, 'c']);
    // Le mail n'est jamais « ouvert » : il reste à écrire.
    assert.equal(e2.comptesRendus![0].actions.find((a) => a.genre === 'mail')!.cree, undefined);
    assert.equal(etatCompteRendu(e2.comptesRendus![0], e2).enCours, 1);
    // Rouvrir ne recrée rien.
    assert.equal(ouvrirActions(e2, 'c', cr.actions.map((a) => a.id), o).crees.length, 0);
    const annule = annulerOuverture(e2, 'c', crees);
    assert.equal(annule.habitudes.length, 0);
    // Supprimer le compte rendu garde l'habitude, sans le lien.
    assert.equal(supprimerCompteRendu(e2, 'c').habitudes[0].compteRendu, undefined);
  });
});

describe('comptes rendus : attribution aux membres, projets et plannings', () => {
  const projet = { id: 'p1', nom: 'Site', emoji: '🚀', creeLe: d } as unknown as NonNullable<Espace['projets']>[number];
  const membres = [{ id: 'u1', nom: 'Sophie' }];
  it('envoie les membres et les projets à l\'IA, et n\'envoie pas la transcription sans le droit', () => {
    const cr = { ...nouveauCompteRendu({ id: 'c', date: d, maintenant: d }), transcription: 'texte de réunion' };
    const e = espace({ projets: [projet] });
    const j = JSON.parse(donneesCompteRendu(cr, e, d, { membres }));
    assert.deepEqual(j.membres, [{ ref: 'u1', nom: 'Sophie' }]);
    assert.deepEqual(j.projetsConnus, [{ ref: 'p1', nom: 'Site' }]);
    assert.equal(JSON.parse(donneesCompteRendu(cr, e, d, { transcription: false, membres })).transcription, undefined);
  });
  it('ignore un membre ou un projet inventé par l\'IA', () => {
    const r = lireAnalyseCompteRendu(
      JSON.stringify({ actions: [{ genre: 'tache', titre: 'Finaliser les visuels', membre: 'u1', projet: 'p1' }, { genre: 'tache', titre: 'Autre chose', membre: 'zz', projet: 'pz' }] }),
      [],
      d,
      { membres, projets: [{ id: 'p1', nom: 'Site' }] },
    );
    assert.deepEqual([r.actions[0].membre, r.actions[0].responsable, r.actions[0].projet], ['u1', 'Sophie', 'p1']);
    assert.deepEqual([r.actions[1].membre, r.actions[1].projet], [undefined, undefined]);
  });
  it('affecte la tâche au membre et la place dans le planning du projet dit en réunion', () => {
    let cr: CompteRendu = nouveauCompteRendu({ id: 'c', date: d, maintenant: d });
    cr = { ...cr, actions: fusionnerActions(cr, [{ genre: 'tache', titre: 'Finaliser les visuels', membre: 'u1', responsable: 'Sophie', projet: 'p1', echeance: '2026-10-30' }, { genre: 'relance', titre: 'Facture', contact: 'Marie', membre: 'u1', responsable: 'Sophie' }], id) };
    const e = espace({ comptesRendus: [cr], projets: [projet] });
    const o = { id, maintenant: d, d, modeTache: 'normal' as const, modeRelance: 'normal' as const, boite: 'pro' as const, membres };
    const { espace: e2 } = ouvrirActions(e, 'c', cr.actions.map((a) => a.id), o);
    const t = e2.taches.find((x) => x.titre === 'Finaliser les visuels')!;
    assert.deepEqual([t.affecteA, t.responsable, t.projet], ['u1', 'Sophie', 'p1']);
    assert.equal(t.echeance, '2026-10-30');
    assert.deepEqual([e2.relances[0].affecteA, e2.relances[0].responsable], ['u1', 'Sophie']);
    // Un membre qui n'est plus dans l'équipe : le nom reste, sans affectation.
    const e3 = ouvrirActions(e, 'c', cr.actions.map((a) => a.id), { ...o, membres: [] }).espace;
    assert.deepEqual([e3.relances[0].affecteA, e3.relances[0].responsable], [undefined, 'Sophie']);
  });
});

describe('comptes rendus : suggestions', () => {
  const cr = (x: Partial<CompteRendu> = {}): CompteRendu => ({ ...nouveauCompteRendu({ id: 'c', date: d, maintenant: `${d}T10:00:00Z` }), ...x });
  it('repère les actions et les décisions des notes, une fois', () => {
    const s = suggestionsCompteRendu(cr({ notes: 'Décision : on garde le 15\n→ @Paul envoyer le devis vendredi\nDécision : on garde le 15' }), espace(), d);
    assert.deepEqual(s.map((x) => x.genre), ['action', 'decision', 'participant']);
    assert.equal(s[2].titre, 'Paul');
  });
  it('ne propose pas ce qui est déjà là', () => {
    const notes = '→ Envoyer le devis\nDécision : on garde le 15';
    const premiere = suggestionsCompteRendu(cr({ notes }), espace(), d);
    const apres = premiere.reduce((acc, s) => appliquerSuggestion(acc, s, id), cr({ notes }));
    assert.equal(apres.actions.length, 1);
    assert.equal(apres.decisions?.length, 1);
    assert.deepEqual(suggestionsCompteRendu(apres, espace(), d), []);
  });
  it('ne ramène pas une suggestion écartée', () => {
    const notes = '→ Envoyer le devis';
    const [s] = suggestionsCompteRendu(cr({ notes }), espace(), d);
    assert.deepEqual(suggestionsCompteRendu(cr({ notes, ecartees: [s.cle] }), espace(), d), []);
  });
  it('propose de rattacher le projet et la relance cités, en mots entiers', () => {
    const e = espace({
      projets: [{ id: 'p', nom: 'Site web', emoji: '🚀', debut: null, joursOuvres: true, creeLe: d }],
      relances: [relance({ id: 'r', contact: 'Paul', sujet: 'Devis' }), relance({ id: 'r2', contact: 'Marie', sujet: 'Facture', statut: 'repondu' })],
    });
    const s = suggestionsCompteRendu(cr({ notes: 'Vu avec Paul pour le site web. Marie absente. Paulette aussi.' }), e, d);
    assert.deepEqual(s.map((x) => x.cle), ['p:p', 'r:r']);
    assert.deepEqual(suggestionsCompteRendu(cr({ notes: 'Paulette et le website' }), e, d), []);
    const lie = s.reduce((acc, x) => appliquerSuggestion(acc, x, id), cr());
    assert.deepEqual([lie.projets, lie.relances], [['p'], ['r']]);
  });
  it('propose de clôturer ce qui est noté comme réglé', () => {
    const e = espace({ relances: [relance({ id: 'r', contact: 'Paul', sujet: 'Devis du site' })] });
    const s = suggestionsCompteRendu(cr({ relances: ['r'], notes: '✓ Devis du site' }), e, d);
    assert.deepEqual(s.map((x) => x.genre), ['cloture']);
  });
});

describe('comptes rendus : écouter', () => {
  const cr = (x: Partial<CompteRendu> = {}): CompteRendu => ({ ...nouveauCompteRendu({ id: 'c', date: d, maintenant: `${d}T10:00:00Z` }), titre: 'Point du lundi', ...x });
  it('retire ce qui ne se dit pas', () => {
    const t = texteCompteRendu(cr({ notes: '- On avance\n[ ] @Paul envoyer le devis\n✓ Facture réglée' }), espace());
    assert.equal(t, 'Point du lundi.\nOn avance.\nPaul envoyer le devis.\nFacture réglée.');
  });
  it('préfère le résumé aux notes, et ne répète pas', () => {
    const t = texteCompteRendu(cr({ notes: 'brouillon', resume: 'On garde le 15.', participants: ['Paul', 'Sophie'], decisions: ['On garde le 15', 'Budget validé'], actions: [{ id: 'a', genre: 'tache', titre: 'Envoyer le devis', responsable: 'Paul' }] }), espace());
    assert.equal(t, 'Point du lundi.\nAvec Paul, Sophie.\nOn garde le 15.\nDécision.\nBudget validé.\nÀ faire.\nPaul : Envoyer le devis.');
  });
  it('découpe aux phrases, sans rien perdre', () => {
    const texte = `Une phrase courte. ${'mot '.repeat(120).trim()}. Fin ?\nAutre ligne`;
    const m = decouperLecture(texte, 100);
    assert.ok(m.every((x) => x.length <= 100));
    assert.equal(m.join(' ').replace(/\s+/g, ' '), texte.replace(/\s+/g, ' '));
    assert.deepEqual(decouperLecture('  \n '), []);
  });
  it('regroupe les phrases pour Eve, sans dépasser', () => {
    const m = regrouperLecture('Une phrase. Une autre phrase. Encore une.', 25);
    assert.deepEqual(m, ['Une phrase.', 'Une autre phrase.', 'Encore une.']);
    assert.deepEqual(regrouperLecture('Une. Deux. Trois.', 100), ['Une. Deux. Trois.']);
  });
});
