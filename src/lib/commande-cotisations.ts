import { FILTRES_VIDES, RYTHMES_GROUPE, TRANCHES_MONTANT, TYPES_GROUPE, type FiltresAnnuaire } from './annuaire';
import { montantCotisation, type RythmeObjectif } from './commun/cotisations';
import type { Groupe } from './tontines';
import { majuscule, ressemblance } from './voix-texte';

/**
 * Les cotisations à la voix. Rien ne part sur une simple phrase : un paiement ou un nouveau groupe s'ouvre à l'écran, à confirmer.
 * Les questions répondent avec les vrais groupes et ne partent jamais à l'IA, qui ne les connaît pas.
 */

export type DemandeCotisation =
  | { quoi: 'recoit' | 'du' | 'echeance' | 'retard' | 'moi' | 'liste' | 'payer' | 'ouvrir'; groupe?: string }
  | { quoi: 'rappel'; nom: string }
  | { quoi: 'aValider' };

export type BrouillonGroupe = { mode?: 'rotation' | 'objectif'; nom?: string; montant?: string; devise?: 'USD' | 'CDF'; rythme?: RythmeObjectif; places?: string; raison?: string };

export type CommandeCotisation =
  | { type: 'aller'; href: string; titre: string; dire?: string }
  | { type: 'reponse'; texte: string }
  | { type: 'cotisation'; demande: DemandeCotisation };

const MOTS = /\b(?:cotisations?|cotiser|cotise|cotisent|cotisons|tontines?|likelemba|annuaire)\b|\b(?:mon|ma|mes|ce|du)\s+groupes?\b|\bgroupes?\s+de\s+cotisation/;
const TOUR = /a qui le tour|c'est a qui|qui recoit|quand (?:est-ce que |est ce que |vais-je |je vais )?(?:je )?recoi|recevoir|mon tour|prochain tour/;
const DEVISE = /(\d[\d\s]*(?:[.,]\d+)?)\s*(dollars?|usd|\$|francs?(?: congolais)?|fc|cdf)(?![a-z])/;
const RAISON = /\bpour (?:un |une |le |la |mon |ma |notre )?(mariage|deuil|funerailles|enterrement|naissance|anniversaire|dot|projet|voyage|maladie|scolarite)\b/;
const AUTRE_CHOSE =
  /^(?:note|noter|ajoute|ajouter|rajoute|mets|planifie|rappelle-moi|rappelle moi|fais-moi|pense a|reporte|deplace|supprime|efface|retire|annule|vire|transfere|reponds|ecris|envoie|dis a|j'ai recu|j'ai fini|j'ai termine)\b|\b(?:(?:e-?)?mails?|courriels?|depens\w*|taches?|relances?|habitudes?)\b/;

const brutDe = (brut: string, q: string, debut: number, fin: number) => (brut.length === q.length ? brut.slice(debut, fin) : q.slice(debut, fin));

/** Le nom dit après « tontine », « appelée » ou « pour » : sans le montant, le rythme ni le nombre de membres. */
function nomDit(brut: string, q: string, avecPour: boolean): string | undefined {
  const motifs = [/(?:appelee?|nommee?|qui s'appelle)\s+([^,.]+)/, /(?:tontine|likelemba|groupe|cotisation)s?\s+(?!de cotisation|pour\s)(?:(?:de la|de l'|de|des|du|d')\s*)?([^,.]+)/, ...(avecPour ? [/\bpour\s+(?:la |le |les |l'|un |une |mon |ma |mes |notre |nos )?([^,.]+)/] : [])];
  for (const motif of motifs) {
    const m = motif.exec(q);
    if (!m) continue;
    const debut = m.index + m[0].length - m[1].length;
    const fin = /\s+(?:de\s+\d|a\s+\d|avec|par\s|chaque|\d|pour\s)/.exec(m[1])?.index ?? m[1].length;
    const nom = brutDe(brut, q, debut, debut + fin)
      .replace(/^(?:à|a|au|aux|la|le|les|l')\s+/i, '')
      .trim();
    if (nom && !/^\d/.test(nom) && !/^(?:à|a|au|aux|de|du|des)$/i.test(nom) && !/^(?:mois|jour|semaine|ce|cette)\b/i.test(nom)) return majuscule(nom);
  }
  return undefined;
}

const rythmeDit = (q: string): RythmeObjectif | undefined =>
  /par jour|chaque jour|quotidien|journalier/.test(q) ? 'quotidien' : /par semaine|chaque semaine|hebdo/.test(q) ? 'hebdomadaire' : /par mois|chaque mois|mensuel/.test(q) ? 'mensuel' : /une (?:seule )?fois/.test(q) ? 'unique' : undefined;

function montantDit(q: string) {
  const m = DEVISE.exec(q);
  if (!m) return null;
  const n = Number(m[1].replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? { n, devise: /doll|usd|\$/.test(m[2]) ? ('USD' as const) : ('CDF' as const) } : null;
}

function lienAnnuaire(brut: string, q: string) {
  const p = new URLSearchParams();
  const nom = nomDit(brut, q, false);
  if (nom && !/^annuaire/i.test(nom)) p.set('q', nom);
  const rythme = rythmeDit(q);
  if (rythme) p.set('rythme', rythme);
  const m = montantDit(q);
  const tranche = m && TRANCHES_MONTANT.find((t) => t.devise === m.devise && t.max >= m.n * 100);
  if (tranche) p.set('montant', tranche.key);
  if (/chacun son tour|a tour de role/.test(q)) p.set('mode', 'rotation');
  if (RAISON.test(q)) p.set('mode', 'objectif');
  const requete = p.toString();
  return `/annuaire${requete ? `?${requete}` : ''}`;
}

function lienCreation(brut: string, q: string) {
  const b: BrouillonGroupe = {};
  const m = montantDit(q);
  if (m) {
    b.montant = String(m.n);
    b.devise = m.devise;
  }
  const rythme = rythmeDit(q);
  if (rythme) b.rythme = rythme;
  const places = /(\d+)\s*(?:membres?|personnes?|participants?)/.exec(q)?.[1];
  if (places) b.places = places;
  const raison = RAISON.exec(q);
  if (raison) {
    b.mode = 'objectif';
    const debut = raison.index + raison[0].length - raison[1].length;
    b.raison = majuscule(brutDe(brut, q, debut, debut + raison[1].length));
  }
  const nom = nomDit(brut, q, true);
  if (nom) b.nom = nom;
  return `/finances?onglet=cotisations&brouillon=${encodeURIComponent(JSON.stringify(b))}`;
}

/** Ce qu'une phrase demande sur les cotisations, ou rien si elle parle d'autre chose. */
export function commandeCotisation(brut: string, q: string): CommandeCotisation | null {
  const equipe = /\b(?:valide|valider|approuve|approuver|refuse|refuser)\b.*\b(?:versements?|cautions?|comptes?|dossiers?|verifications?|approbations?)\b/.test(q);
  if (equipe) return { type: 'aller', href: '/utilisateurs', titre: 'Utilisateurs', dire: 'Cela se valide ici, après vérification.' };
  if (/combien .*(?:comptes? a verifier|versements? a valider|a valider|a verifier)/.test(q)) return { type: 'cotisation', demande: { quoi: 'aValider' } };

  if (!MOTS.test(q) && !TOUR.test(q) && !/\b(?:cherche|chercher|trouve|trouver|rejoins|rejoindre)\b.*\bgroupes?\b/.test(q)) return null;
  const creer = /\b(?:cree|creer|creons|lance|lancer|monte|monter|demarre|demarrer)\b(?:\s+moi)?\s+(?:(?:un|une|le|la|mon|ma|notre)\s+)?(?:(?:nouveau|nouvelle)\s+)?(?:groupe|tontine|likelemba|cotisation)|^ouvre (?:un|une) (?:nouveau |nouvelle )?(?:groupe|tontine|likelemba)/.test(q);
  if (creer) return { type: 'aller', href: lienCreation(brut, q), titre: 'Nouveau groupe', dire: 'Vérifie le groupe, puis crée-le.' };
  if (AUTRE_CHOSE.test(q)) return null;

  if (/\b(?:cherche|chercher|trouve|trouver|rejoins|rejoindre|adhere|adherer|y a-t-il|il y a|existe)\b/.test(q)) return { type: 'aller', href: lienAnnuaire(brut, q), titre: 'l’annuaire' };
  if (/\bannuaire\b/.test(q)) return { type: 'aller', href: lienAnnuaire(brut, q), titre: 'l’annuaire' };

  // « J'ai payé 10 dollars de cotisation » reste une dépense ; sans montant, seul le paiement validé compte.
  if (/^(?:j'ai|on a)\s+(?:deja\s+)?(?:paye|cotise|verse)\b/.test(q)) return montantDit(q) ? null : { type: 'reponse', texte: 'Me le note quand le paiement est validé. Dis « Paye ma cotisation » si tu dois encore payer.' };
  const groupe = nomDit(brut, q, false);
  const nomme = groupe && !/^(?:cotisation|ce mois|mes|de ce)/i.test(groupe) && /tontine|likelemba|groupe/.test(q) ? groupe : undefined;
  const avec = nomme ? { groupe: nomme } : {};
  if (/\b(?:paye|payer|payons|regle|regler|verse|verser)\b.*\b(?:cotisation|tontine|likelemba|caution)|^(?:je veux )?cotiser\b/.test(q)) return { type: 'cotisation', demande: { quoi: 'payer', ...avec } };

  const rappel = /\brappelle (?:a |au )(.+?) de (?:cotiser|payer)/.exec(q);
  if (rappel) {
    const debut = rappel.index + rappel[0].indexOf(rappel[1]);
    return { type: 'cotisation', demande: { quoi: 'rappel', nom: brutDe(brut, q, debut, debut + rappel[1].length) } };
  }
  if (/\b(?:ouvre|ouvrir|va|aller|emmene|montre|affiche|passe|voir)\b/.test(q)) {
    return nomme ? { type: 'cotisation', demande: { quoi: 'ouvrir', groupe: nomme } } : { type: 'aller', href: '/finances?onglet=cotisations', titre: 'Cotisations' };
  }
  if (/quand .*(?:je )?recoi|recevoir|mon tour/.test(q)) return { type: 'cotisation', demande: { quoi: 'moi', ...avec } };
  if (/a qui le tour|c'est a qui|qui recoit|beneficiaire|prochain tour/.test(q)) return { type: 'cotisation', demande: { quoi: 'recoit', ...avec } };
  if (/qui .*(?:pas|manque|retard|paye|cotise)|en retard/.test(q)) return { type: 'cotisation', demande: { quoi: 'retard', ...avec } };
  if (/combien|je dois|a payer|dois-je/.test(q)) return { type: 'cotisation', demande: { quoi: 'du', ...avec } };
  if (/quand|prochaine?|echeance|date/.test(q)) return { type: 'cotisation', demande: { quoi: 'echeance', ...avec } };
  return { type: 'cotisation', demande: { quoi: 'liste', ...avec } };
}

const jourDit = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const phrase = (x: string[]) => (x.length > 1 ? `${x.slice(0, -1).join(', ')} et ${x[x.length - 1]}` : (x[0] ?? ''));
const courant = (g: Groupe) => g.tours.find((t) => t.numero === g.tourCourant) ?? g.tours.find((t) => t.etat === 'collecte');

/** Trois groupes au plus sont lus : au-delà, la réponse dit combien il en reste. */
const lus = (x: string[]) => (x.length > 3 ? `${x.slice(0, 3).join(' ')} Et ${x.length - 3} autre${x.length > 4 ? 's' : ''}.` : x.join(' '));

/** La réponse à dire, et le groupe à ouvrir quand il y a un geste à confirmer. */
export function repondreCotisation(d: Exclude<DemandeCotisation, { quoi: 'aValider' }>, groupes: Groupe[]): { texte: string; groupe?: string } {
  const miens = groupes.filter((g) => g.monEtat === 'accepte' && (g.etat === 'ouvert' || g.etat === 'en_cours'));
  if (!miens.length) return { texte: 'Tu n’as aucun groupe en cours. Dis « Cherche un groupe » pour voir l’annuaire.' };
  if (d.quoi === 'rappel') {
    const m = miens.flatMap((g) => g.membres.filter((x) => !x.aCotise).map((x) => ({ g, x, s: ressemblance(d.nom, x.nom) }))).sort((a, b) => b.s - a.s)[0];
    if (!m || m.s < 0.5) return { texte: `Je ne vois pas ${d.nom} parmi ceux qui doivent cotiser.` };
    if (!m.g.suisOrganisateur) return { texte: 'Seul l’organisateur envoie un rappel. Me en envoie déjà selon les réglages du groupe.' };
    return { texte: `${m.g.nom} : touche ${m.x.nom} pour lui envoyer un rappel.`, groupe: m.g.id };
  }
  const nomme = d.groupe ? miens.map((g) => ({ g, s: ressemblance(d.groupe as string, g.nom) })).sort((a, b) => b.s - a.s)[0] : null;
  if (d.groupe && (!nomme || nomme.s < 0.5)) return { texte: `Je ne trouve pas le groupe « ${d.groupe} ». Tes groupes : ${phrase(miens.map((g) => g.nom))}.` };
  const choix = nomme ? [nomme.g] : miens;
  switch (d.quoi) {
    case 'ouvrir':
      return { texte: `J’ouvre ${choix[0].nom}.`, groupe: choix[0].id };
    case 'liste': {
      const dus = choix.filter((g) => g.aPayer);
      return { texte: `Tu es dans ${choix.length} groupe${choix.length > 1 ? 's' : ''} : ${phrase(choix.map((g) => g.nom))}. ${dus.length ? `${dus.length} à payer.` : 'Tu es à jour.'}` };
    }
    case 'du': {
      const dus = choix.filter((g) => g.aPayer);
      if (!dus.length) return { texte: 'Tu es à jour : rien à payer.' };
      return { texte: `Tu dois ${phrase(dus.map((g) => `${montantCotisation(g.aPayer!.montant, g.devise)}${g.aPayer!.genre === 'caution' ? ' de caution' : ''} pour ${g.nom}`))}.` };
    }
    case 'payer': {
      const attente = choix.find((g) => g.enAttente);
      if (attente) return { texte: `Un paiement attend ta validation sur ton téléphone, pour ${attente.nom}.`, groupe: attente.id };
      const dus = choix.filter((g) => g.aPayer);
      if (!dus.length) return { texte: 'Tu es à jour : rien à payer.' };
      if (dus.length > 1) return { texte: `Tu as ${dus.length} paiements : ${phrase(dus.map((g) => `${g.nom}, ${montantCotisation(g.aPayer!.montant, g.devise)}`))}. Dis lequel, par exemple « Paye la tontine ${dus[0].nom} ».` };
      return { texte: `${dus[0].nom} : ${montantCotisation(dus[0].aPayer!.montant, dus[0].devise)} à payer. Vérifie, puis confirme à l’écran.`, groupe: dus[0].id };
    }
    case 'recoit':
      return {
        texte: lus(
          choix.map((g) => {
            if (g.mode === 'objectif') return `${g.nom} : ${g.beneficiaireNom ?? 'le bénéficiaire'} reçoit la cagnotte${g.dateFin ? ` le ${jourDit(g.dateFin)}` : ''}.`;
            const t = courant(g);
            if (!t) return `${g.nom} n’a pas encore commencé.`;
            return `${g.nom} : ${t.pourMoi ? 'tu reçois' : `${t.beneficiaire} reçoit`} ${montantCotisation(t.net, g.devise)} le ${jourDit(t.echeance)}.`;
          }),
        ),
      };
    case 'moi':
      return {
        texte: lus(
          choix.map((g) => {
            if (g.mode === 'objectif') return `${g.nom} : la cagnotte va à ${g.beneficiaireNom ?? 'son bénéficiaire'}.`;
            const t = g.tours.find((x) => x.pourMoi);
            if (!t) return `${g.nom} : l’ordre n’est pas encore fixé.`;
            if (t.etat === 'verse') return `${g.nom} : tu as déjà reçu ${montantCotisation(t.net, g.devise)}.`;
            return `${g.nom} : tu reçois ${montantCotisation(t.net, g.devise)} le ${jourDit(t.echeance)}.`;
          }),
        ),
      };
    case 'echeance':
      return {
        texte: lus(
          choix.map((g) => {
            const t = courant(g);
            if (g.mode === 'objectif' && g.dateFin) return `${g.nom} : jusqu’au ${jourDit(g.dateFin)}.`;
            return t ? `${g.nom} : le ${jourDit(t.echeance)}.` : `${g.nom} n’a pas encore commencé.`;
          }),
        ),
      };
    case 'retard':
      return {
        texte: lus(
          choix.map((g) => {
            const manquent = g.membres.filter((m) => !m.aCotise).map((m) => m.nom);
            return manquent.length ? `${g.nom} : il manque ${phrase(manquent)}.` : `${g.nom} : tout le monde a cotisé.`;
          }),
        ),
      };
  }
}

/** Le brouillon passé dans l'adresse ; ce qui n'a pas la bonne forme est ignoré. */
export function lireBrouillon(brut?: string): BrouillonGroupe | null {
  if (!brut) return null;
  try {
    const b = JSON.parse(brut) as Record<string, unknown>;
    const texte = (v: unknown) => (typeof v === 'string' && v.length <= 80 ? v : undefined);
    return {
      mode: b.mode === 'objectif' || b.mode === 'rotation' ? b.mode : undefined,
      nom: texte(b.nom),
      montant: texte(b.montant),
      devise: b.devise === 'USD' || b.devise === 'CDF' ? b.devise : undefined,
      rythme: RYTHMES_GROUPE.some((r) => r.key === b.rythme) ? (b.rythme as RythmeObjectif) : undefined,
      places: texte(b.places),
      raison: texte(b.raison),
    };
  } catch {
    return null;
  }
}

/** Les filtres passés dans l'adresse de l'annuaire. */
export function filtresDuLien(p: { mode?: string; rythme?: string; montant?: string }): FiltresAnnuaire {
  return {
    ...FILTRES_VIDES,
    mode: TYPES_GROUPE.find((t) => t.key === p.mode)?.key ?? null,
    rythme: RYTHMES_GROUPE.find((r) => r.key === p.rythme)?.key ?? null,
    montant: TRANCHES_MONTANT.find((t) => t.key === p.montant)?.key ?? null,
  };
}
