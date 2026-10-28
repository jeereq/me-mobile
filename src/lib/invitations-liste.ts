import { fmtCourt } from './dates';
import type { InvitationEquipe } from './equipes';

/**
 * Ce que le propriétaire lit sous une invitation en attente : où elle en est, et quoi faire si elle bloque.
 * Une invitation « en attente » veut dire que personne n'a encore cliqué sur « Rejoindre l'équipe » avec le compte de l'adresse invitée.
 */
export type StatutInvitation = { texte: string; alerte: boolean; /** Autre adresse avec laquelle le lien a été ouvert : on peut l'inviter à la place. */ autreAdresse?: string };

const jour = (iso: string) => fmtCourt(iso.slice(0, 10));

export function statutInvitation(i: Pick<InvitationEquipe, 'etat' | 'ouverteLe' | 'ouvertePar' | 'email'>): StatutInvitation {
  if (i.etat === 'autre_compte' && i.ouvertePar)
    return { alerte: true, autreAdresse: i.ouvertePar, texte: `Lien ouvert${i.ouverteLe ? ` le ${jour(i.ouverteLe)}` : ''} avec ${i.ouvertePar}, qui n’est pas ${i.email} : il ne peut pas être accepté ainsi.` };
  if (i.etat === 'ouverte') return { alerte: false, texte: `Lien ouvert${i.ouverteLe ? ` le ${jour(i.ouverteLe)}` : ''} : la personne n’a pas encore cliqué sur « Rejoindre l’équipe ».` };
  return { alerte: false, texte: 'Lien pas encore ouvert.' };
}
