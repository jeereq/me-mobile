import type { AnalyseMail } from './copilote';
import type { Mail } from './mails';
import { trierAnalyses } from './tri-analyses';

/** Le mode mains libres : ce qui se décide sans micro ni écran. Module pur. */
export type ElementFile = { mail: Mail; analyse?: AnalyseMail };
export type CommandeMail = { type: 'suivant' | 'archiver' | 'lu' | 'tache' | 'repeter' | 'tout' | 'stop' | 'inconnu' } | { type: 'repondre'; texte?: string };
export type CommandeConfirme = 'envoyer' | 'annuler' | 'modifier' | 'court' | 'formel' | 'decliner' | 'refaire' | 'seul' | 'tous' | 'stop' | 'inconnu';

const net = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'").replace(/[.,;:!?«»"]/g, ' ').replace(/\s+/g, ' ').trim();

/** Ce que l'utilisateur dit après l'annonce d'un mail. */
export function commandeMail(texte: string): CommandeMail {
  const q = net(texte);
  if (/\b(stop|arrete|termine|quitte|ferme|c'est fini|ca suffit)\b/.test(q)) return { type: 'stop' };
  // « Réponds que c'est bon » : la réponse est déjà dite. Lue sur le texte d'origine pour garder les accents.
  const dit = /^\s*r[ée]ponds?(?:[\s-]+lui)?\s+(?:que\s+|qu['’]\s*|:\s*)(.+)$/i.exec(texte);
  if (dit?.[1].trim()) return { type: 'repondre', texte: `${dit[1].trim()[0].toUpperCase()}${dit[1].trim().slice(1)}` };
  if (/\b(lis tout|lis le|lis-le|lis moi|lire le|lire tout|en entier|tout le mail|le mail entier|le detail)\b/.test(q)) return { type: 'tout' };
  if (/\b(repete|repeter|redis|redire|encore|recommence|j'ai pas compris)\b/.test(q)) return { type: 'repeter' };
  if (/\b(reponds?|repondre|reponse)\b/.test(q)) return { type: 'repondre' };
  if (/\b(archive|archiver|archives)\b/.test(q)) return { type: 'archiver' };
  if (/\b(tache|taches|a faire)\b/.test(q)) return { type: 'tache' };
  if (/\b(marque|marquer|lu)\b/.test(q)) return { type: 'lu' };
  if (/\b(suivant|suivante|passe|passer|apres|prochain|prochaine|ensuite|continue|ignore)\b/.test(q)) return { type: 'suivant' };
  return { type: 'inconnu' };
}

/** La réponse à « Je l'envoie ? ». Un envoi ne se rattrape pas : le moindre refus, ou un doute, ne l'envoie pas. */
export function commandeConfirme(texte: string): CommandeConfirme {
  const q = net(texte);
  if (/\b(stop|arrete|quitte|ferme)\b/.test(q)) return 'stop';
  if (/\b(seulement|juste|uniquement) (a|au|lui)\b|\ba (lui|elle) (seul|seule|seulement)\b|\ba l'expediteur\b/.test(q)) return 'seul';
  if (/\ba tous\b|\ba tout le monde\b/.test(q)) return 'tous';
  if (/\b(plus court|plus courte|raccourci|raccourcis)\b/.test(q)) return 'court';
  if (/\b(plus formel|plus formelle|formel|formelle)\b/.test(q)) return 'formel';
  if (/\b(decline|decliner|refuse|refuser)\b/.test(q)) return 'decliner';
  if (/\b(refais|refaire|autre version|une autre)\b/.test(q)) return 'refaire';
  if (/\b(modifie|modifier|change|changer|corrige|corriger|autre chose)\b/.test(q)) return 'modifier';
  if (/\b(non|pas|annule|annuler|n'envoie|attends|attend|surtout pas)\b/.test(q)) return 'annuler';
  if (/\b(oui|envoie|envoyer|envoyez|vas-y|vas y|ok|d'accord|parfait)\b/.test(q)) return 'envoyer';
  return 'inconnu';
}

/** Les mails à traiter : l'urgent d'abord, et rien de ce qui ne demande aucune action. */
export function fileAnalysee(analyses: AnalyseMail[], mailDe: (id: string) => Mail | undefined): ElementFile[] {
  return trierAnalyses(analyses.filter((a) => a.action !== 'rien')).flatMap((analyse) => {
    const mail = mailDe(analyse.id);
    return mail ? [{ mail, analyse }] : [];
  });
}

/** Ce que la voix dit d'un mail : où on en est, de qui, de quoi. La consigne n'est dite qu'au premier, pour ne pas lasser. */
export function annonceMail(e: ElementFile, rang: number, total: number): string {
  const qui = e.mail.contact || 'quelqu’un';
  const quoi = e.analyse?.resume || `Objet : ${e.mail.sujet}.`;
  const urgent = e.analyse?.urgence === 'haute' ? 'Urgent. ' : '';
  const pret = e.analyse?.action === 'repondre' && e.analyse.reponse.trim() ? ' Une réponse est prête.' : e.analyse?.action === 'tache' ? ' Il y a quelque chose à faire.' : '';
  const consigne = rang === 0 ? ' Dis réponds, suivant, archive ou stop.' : '';
  return `${total > 1 ? `Mail ${rang + 1} sur ${total}. ` : ''}${urgent}De ${qui}. ${quoi}${pret}${consigne}`;
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Le bilan dit à la fin. */
export function bilanMainsLibres(b: { envoyes: number; archives: number; lus: number; taches: number }): string {
  const faits = [b.envoyes ? pluriel(b.envoyes, 'réponse envoyée', 'réponses envoyées') : '', b.taches ? pluriel(b.taches, 'tâche ajoutée', 'tâches ajoutées') : '', b.archives ? pluriel(b.archives, 'mail archivé', 'mails archivés') : '', b.lus ? pluriel(b.lus, 'mail marqué comme lu', 'mails marqués comme lus') : ''].filter(Boolean);
  return faits.length ? `C'est terminé : ${faits.join(', ')}.` : "C'est terminé.";
}
