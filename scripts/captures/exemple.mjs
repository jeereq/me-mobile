/**
 * Les données d'exemple des captures de la page d'accueil, au 18 novembre 2026.
 * Tout est inventé : aucun nom ni montant ne vient d'un vrai compte.
 */
export const AUJOURDHUI = '2026-11-18';

const jour = (n) => {
  const d = new Date(`${AUJOURDHUI}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const cree = `${jour(-30)}T09:00:00.000Z`;
let n = 0;
const id = (p) => `ex-${p}-${++n}`;

const relance = (contact, sujet, date, o = {}) => ({ id: id('r'), contact, sujet, boite: 'pro', date, statut: 'a_faire', mode: 'normal', creeLe: cree, ...o });
const tache = (titre, echeance, o = {}) => ({ id: id('t'), titre, source: 'manuel', priorite: 'moyenne', echeance, statut: 'en_attente', mode: 'normal', creeLe: cree, ...o });
const habitude = (nom, categorie, ordre, coches) => ({ id: id('h'), nom, categorie, frequence: 'quotidien', jour: null, mode: 'normal', coches, ordre });

/** Une série de jours actifs, pour la mission du jour et le niveau. */
function jeu() {
  const gains = {};
  for (let i = 1; i <= 22; i++) {
    gains[`ex|${jour(-i)}|a`] = { d: jour(-i), p: 25, t: 'tache' };
    gains[`ex|${jour(-i)}|b`] = { d: jour(-i), p: 20, t: 'habitude' };
    gains[`ex|${jour(-i)}|c`] = { d: jour(-i), p: 15, t: 'relance' };
  }
  gains[`ex|${AUJOURDHUI}|a`] = { d: AUJOURDHUI, p: 15, t: 'habitude' };
  gains[`ex|${AUJOURDHUI}|b`] = { d: AUJOURDHUI, p: 10, t: 'tache' };
  return { gains, badges: {}, jokers: 1, joursSauves: [], jokersGagnes: [], intro: true };
}

const budget = (nom, emoji, montant, o = {}) => ({ id: id('b'), nom, emoji, montant, periode: 'mois', ...o });

function finances() {
  const total = budget('Budget total', '💰', 1800, { global: true });
  const courses = budget('Courses', '🛒', 320);
  const fetes = budget('Fêtes de fin d’année', '🎁', 400, {
    enveloppe: true,
    debut: '2026-11-15',
    fin: '2026-12-31',
    plan: [
      { id: 'ex-cadeaux', nom: 'Cadeaux', emoji: '🎁', montant: 220, debut: '2026-11-15', fin: '2026-12-20' },
      { id: 'ex-noel', nom: 'Repas de Noël', emoji: '🍗', montant: 180, debut: '2026-12-20', fin: '2026-12-26' },
    ],
  });
  const sorties = budget('Sorties et restos', '🍽️', 160);
  const transport = budget('Transport', '🚗', 140);
  const cafes = budget('Cafés et en-cas', '☕', 60);
  const dep = (montant, b, note, date, o = {}) => ({ id: id('d'), montant, budget: b ? b.id : null, note, date, creeLe: `${date}T10:00:00.000Z`, ...o });
  const depenses = [
    dep(450, null, 'Loyer novembre', '2026-11-03', { categories: ['ex-maison'] }),
    dep(15, null, 'Électricité', '2026-11-05', { categories: ['ex-maison'] }),
    dep(112.3, courses, 'Marché de la semaine', '2026-11-02', { categories: ['ex-alimentation'] }),
    dep(78.5, courses, 'Supermarché', '2026-11-09', { categories: ['ex-alimentation'] }),
    dep(55, courses, 'Marché de la semaine', '2026-11-16', { categories: ['ex-alimentation'] }),
    dep(85, fetes, 'Cadeaux des enfants', '2026-11-16', { poste: 'ex-cadeaux', categories: ['ex-sorties'] }),
    dep(22, sorties, 'Cinéma', '2026-11-07', { categories: ['ex-sorties'] }),
    dep(76.5, sorties, 'Dîner d’anniversaire', '2026-11-14', { categories: ['ex-restaurants'] }),
    dep(49, transport, 'Carburant', '2026-11-04', { categories: ['ex-transport'] }),
    dep(35, transport, 'Taxi', '2026-11-13', { categories: ['ex-transport'] }),
    dep(13.5, cafes, 'Cafés de la semaine', '2026-11-11', {}),
    dep(2.5, cafes, 'Café', AUJOURDHUI, {}),
  ];
  // Le mois d'avant, pour les comparaisons du bilan.
  depenses.push(dep(450, null, 'Loyer octobre', '2026-10-03', { categories: ['ex-maison'] }));
  depenses.push(dep(828, null, 'Dépenses d’octobre', '2026-10-15', { categories: ['ex-alimentation'] }));
  const revenus = [
    { id: id('v'), montant: 1800, note: 'Salaire', date: '2026-11-01', creeLe: cree },
    { id: id('v'), montant: 130, note: 'Mission photo', date: '2026-11-12', creeLe: cree },
  ];
  return {
    devise: '$',
    budgets: [total, courses, fetes, sorties, transport, cafes],
    depenses,
    revenus,
    recurrences: [{ id: id('c'), genre: 'depense', montant: 25, note: 'Salle de sport', budget: null, frequence: 'mois', debut: '2026-10-19', derniere: '2026-10-19' }],
    objectifs: [
      { id: id('o'), nom: 'Voyage à Zanzibar', emoji: '🏝️', genre: 'epargne', cible: 1500, debut: '2026-06-01', echeance: '2027-07-01', versements: [{ id: 'ex-v1', date: '2026-07-01', montant: 820 }], plan: { cadence: 'mois' }, creeLe: cree },
      { id: id('o'), nom: 'Fonds d’urgence', emoji: '🛟', genre: 'epargne', cible: 3000, debut: '2026-03-01', echeance: '2027-03-01', versements: [{ id: 'ex-v2', date: '2026-06-01', montant: 1700 }], plan: { cadence: 'mois' }, creeLe: cree },
    ],
    prets: [{ id: id('p'), personne: 'Patrick', sens: 'prete', montant: 80, date: '2026-10-20', echeance: jour(4), remboursements: [], creeLe: cree }],
  };
}

function projet() {
  const p = { id: 'ex-site', nom: 'Lancement du site', emoji: '🚀', debut: '2026-11-04', joursOuvres: true, creeLe: cree };
  const t = (ref, titre, o) => tache(titre, null, { id: `ex-${ref}`, projet: p.id, ...o });
  const taches = [
    t('cadrage', 'Cadrage et maquettes', { ordre: 1, debut: '2026-11-04', duree: 5, statut: 'fait', faitLe: '2026-11-10', avancement: 100, responsable: 'Amani' }),
    t('textes', 'Rédaction des textes', { ordre: 2, duree: 4, statut: 'fait', faitLe: '2026-11-16', avancement: 100, apres: ['ex-cadrage'], responsable: 'Grace' }),
    t('dev', 'Développement', { ordre: 3, apres: ['ex-textes'], responsable: 'Paul' }),
    t('pages', 'Pages produits', { ordre: 4, parent: 'ex-dev', duree: 6, avancement: 60, apres: ['ex-textes'], responsable: 'Paul' }),
    t('paiement', 'Paiement mobile money', { ordre: 5, parent: 'ex-dev', duree: 4, avancement: 30, apres: ['ex-pages'], priorite: 'haute', responsable: 'Paul' }),
    t('essais', 'Tests et corrections', { ordre: 6, duree: 4, apres: ['ex-dev'], responsable: 'Amani' }),
    t('ligne', 'Mise en ligne', { ordre: 7, duree: 0, jalon: true, apres: ['ex-essais'] }),
  ];
  return { p, taches };
}

export function espaceExemple() {
  const { p, taches } = projet();
  return {
    relances: [
      relance('Sarah Ilunga', 'Contrat de location', '2026-11-16'),
      relance('Paul Mbala', 'Devis du site web', AUJOURDHUI),
      relance('Maman Thérèse', 'Rendez-vous du notaire', jour(2), { boite: 'perso' }),
    ],
    taches: [
      tache('Envoyer la facture à Orange RDC', AUJOURDHUI, { priorite: 'haute' }),
      tache('Préparer la présentation du jeudi', jour(1)),
      tache('Renouveler l’assurance de la voiture', jour(3), { statut: 'fait', faitLe: AUJOURDHUI }),
      ...taches,
    ],
    habitudes: [
      habitude('Sport', 'perso', 1, [jour(-1), jour(-2), jour(-3)]),
      habitude('Au lit avant 23 h', 'perso', 2, [jour(-1), jour(-2)]),
      habitude('Noter mes dépenses', 'finance', 3, [AUJOURDHUI, jour(-1), jour(-2)]),
    ],
    contacts: [],
    journal: {},
    agenda: {
      [AUJOURDHUI]: [
        { id: 'ex-e1', debut: '15:00', fin: '15:45', titre: 'Point projet avec Paul', lieu: 'Bureau', calendrier: 'pro' },
        { id: 'ex-e2', debut: '18:00', fin: '19:00', titre: 'Sport', calendrier: 'perso' },
      ],
    },
    sources: {},
    sourcesAutres: [],
    audio: { voix: '', vitesse: 1, hauteur: 1, ton: 'neutre', sections: ['agenda', 'relances', 'taches', 'habitudes'], lireReponses: false },
    jeu: jeu(),
    finances: finances(),
    categories: [
      { id: 'ex-maison', nom: 'Maison', emoji: '🏠', couleur: '#8B9DFF' },
      { id: 'ex-alimentation', nom: 'Alimentation', emoji: '🛒', couleur: '#4FD6A5' },
      { id: 'ex-sorties', nom: 'Sorties', emoji: '🎉', couleur: '#FFB74D' },
      { id: 'ex-transport', nom: 'Transport', emoji: '🚗', couleur: '#5CC8F2' },
      { id: 'ex-restaurants', nom: 'Restaurants', emoji: '🍽️', couleur: '#FF7A70' },
    ],
    projets: [p],
    premiersPas: { masque: true },
    // Accès directs repliés : sur les captures du téléphone, la colonne au-dessus du + ne cache pas les montants.
    barre: { choisi: true, raccourcisReplies: true },
    majLe: `${AUJOURDHUI}T08:00:00.000Z`,
  };
}
