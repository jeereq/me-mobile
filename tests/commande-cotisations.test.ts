import assert from 'node:assert/strict';
import { test } from 'node:test';

import { commandeCotisation, filtresDuLien, lireBrouillon, repondreCotisation } from '../src/lib/commande-cotisations.ts';
import type { Groupe } from '../src/lib/tontines.ts';
import { nettoyerDemande, nombresEnChiffres, sansAccents } from '../src/lib/voix-texte.ts';

const lire = (p: string) => {
  const brut = nombresEnChiffres(nettoyerDemande(p));
  return commandeCotisation(brut, sansAccents(brut));
};
const quoi = (p: string) => {
  const c = lire(p);
  return c?.type === 'cotisation' ? c.demande.quoi : c?.type;
};
const lien = (p: string) => {
  const c = lire(p);
  return c?.type === 'aller' ? decodeURIComponent(c.href) : null;
};

test('ouvre les pages au lieu de créer une tâche', () => {
  assert.equal(lien('Ouvre les cotisations'), '/finances?onglet=cotisations');
  assert.equal(lien('Ouvre mes groupes'), '/finances?onglet=cotisations');
  assert.equal(lien("Ouvre l'annuaire"), '/annuaire');
  assert.equal(lien("Va dans l'annuaire des tontines"), '/annuaire');
});

test('comprend les questions sans passer par l’IA', () => {
  assert.equal(quoi('Qui reçoit ce mois ?'), 'recoit');
  assert.equal(quoi("C'est à qui le tour ?"), 'recoit');
  assert.equal(quoi('Combien je dois cotiser ce mois ?'), 'du');
  assert.equal(quoi("Qui n'a pas encore cotisé ?"), 'retard');
  assert.equal(quoi('Quand est ma prochaine cotisation ?'), 'echeance');
  assert.equal(quoi('Quand est-ce que je reçois ?'), 'moi');
  assert.equal(quoi('Lis mes rappels de cotisation'), 'liste');
  assert.equal(quoi('Combien de comptes à vérifier ?'), 'aValider');
});

test('un paiement s’ouvre à l’écran, et un paiement déclaré n’est pas noté', () => {
  assert.equal(quoi('Paye ma cotisation'), 'payer');
  const c = lire('Paye ma cotisation de la tontine des amis');
  assert.deepEqual(c?.type === 'cotisation' && c.demande, { quoi: 'payer', groupe: 'Tontine des amis' });
  assert.equal(quoi("J'ai payé ma cotisation"), 'reponse');
  assert.equal(lire("J'ai payé 10 dollars de cotisation"), null);
  assert.equal(lien('Valide le versement'), '/utilisateurs');
});

test('prépare un groupe avec ce qui a été dit', () => {
  const brouillon = (p: string) => JSON.parse((lien(p) ?? '').split('brouillon=')[1]);
  assert.deepEqual(brouillon('Crée un groupe de cotisation de 10 dollars par mois pour la famille, 5 membres'), { montant: '10', devise: 'USD', rythme: 'mensuel', places: '5', nom: 'Famille' });
  assert.deepEqual(brouillon('Crée une tontine pour un mariage de 50 000 francs par semaine'), { montant: '50000', devise: 'CDF', rythme: 'hebdomadaire', mode: 'objectif', raison: 'Mariage', nom: 'Mariage' });
});

test('cherche dans l’annuaire avec les filtres', () => {
  assert.equal(lien('Cherche un groupe à 10 dollars par mois'), '/annuaire?rythme=mensuel&montant=USD-10');
  assert.equal(lien('Rejoins la tontine de Gombe'), '/annuaire?q=Gombe');
  assert.deepEqual(filtresDuLien({ rythme: 'mensuel', montant: 'USD-10', mode: 'pirate' }), { mode: null, rythme: 'mensuel', montant: 'USD-10', tri: 'recent', ouverts: false });
});

test('laisse le reste aux autres commandes', () => {
  for (const p of ['Ajoute une tâche payer la cotisation demain', "Rappelle-moi de payer ma cotisation demain", 'Ajoute une dépense de 10 dollars de cotisation', 'Lis mes mails concernant la tontine', 'Combien il me reste ce mois-ci ?', 'Ajoute une cotisation de 10 dollars']) assert.equal(lire(p), null, p);
});

const groupe = (o: Partial<Groupe>): Groupe =>
  ({ id: 'g', nom: 'Amis', devise: 'USD', mode: 'rotation', monEtat: 'accepte', etat: 'en_cours', tourCourant: 2, aPayer: null, enAttente: false, suisOrganisateur: false, beneficiaireNom: null, dateFin: null, membres: [], tours: [{ numero: 2, beneficiaire: 'Paul', pourMoi: false, echeance: '2026-12-09', etat: 'collecte', net: 3800 }, { numero: 3, beneficiaire: 'Toi', pourMoi: true, echeance: '2027-01-06', etat: 'a_venir', net: 3800 }], ...o }) as unknown as Groupe;

test('répond avec les vrais groupes', () => {
  assert.match(repondreCotisation({ quoi: 'recoit' }, [groupe({})]).texte, /Amis : Paul reçoit 38 USD le 9 décembre/);
  assert.match(repondreCotisation({ quoi: 'moi' }, [groupe({})]).texte, /tu reçois 38 USD le 6 janvier/);
  assert.match(repondreCotisation({ quoi: 'du' }, [groupe({})]).texte, /à jour/);
  assert.match(repondreCotisation({ quoi: 'recoit' }, []).texte, /aucun groupe/);
  assert.match(repondreCotisation({ quoi: 'retard' }, [groupe({ membres: [{ nom: 'Marie', aCotise: false }, { nom: 'Paul', aCotise: true }] as Groupe['membres'] })]).texte, /il manque Marie/);
});

test('payer ouvre le groupe seulement s’il n’y a qu’un paiement, et n’appelle rien', () => {
  const du = groupe({ aPayer: { genre: 'cotisation', montant: 1000 } });
  const r = repondreCotisation({ quoi: 'payer' }, [du]);
  assert.equal(r.groupe, 'g');
  assert.match(r.texte, /10 USD à payer/);
  const deux = repondreCotisation({ quoi: 'payer' }, [du, { ...du, id: 'h', nom: 'Famille' }]);
  assert.equal(deux.groupe, undefined);
  assert.equal(repondreCotisation({ quoi: 'payer', groupe: 'Famille' }, [du, { ...du, id: 'h', nom: 'Famille' }]).groupe, 'h');
  assert.equal(repondreCotisation({ quoi: 'payer' }, [{ ...du, enAttente: true }]).texte.includes('attend ta validation'), true);
});

test('ignore un brouillon mal formé', () => {
  assert.equal(lireBrouillon('{'), null);
  assert.deepEqual(lireBrouillon('{"montant":"10","devise":"EUR","rythme":"x"}'), { mode: undefined, nom: undefined, montant: '10', devise: undefined, rythme: undefined, places: undefined, raison: undefined });
});
