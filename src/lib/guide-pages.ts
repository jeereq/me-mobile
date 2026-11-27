import type { ClePage } from './navigation';

/**
 * Le guide de chaque page : ce qu'on y voit (pour la visite) et chaque chose qu'on peut y faire, pas à pas (pour l'assistant).
 * Les libellés des boutons sont ceux de l'app, tels qu'ils s'écrivent. Un test vérifie que chaque page a son guide et que
 * chaque action a des étapes. Les étapes ne portent pas de numéro : l'assistant les numérote.
 */

export type GuideCle = ClePage | 'annuaire';

export type ActionGuide = {
  cle: string;
  titre: string;
  /** Pour ranger la liste : « Ajouter », « Organiser », « Aller plus loin »… */
  groupe: string;
  pas: string[];
  astuce?: string;
  /** Mots que l'on peut taper pour la retrouver, en plus de son titre. */
  mots?: string;
};

export type PageGuide = {
  /** Une phrase : à quoi sert la page. */
  resume: string;
  /** Ce que la visite dit de la page, en deux à quatre points. */
  visite: string[];
  actions: ActionGuide[];
};

const a = (cle: string, titre: string, groupe: string, pas: string[], extra: { astuce?: string; mots?: string } = {}): ActionGuide => ({ cle, titre, groupe, pas, ...extra });

export const GUIDE: Record<GuideCle, PageGuide> = {
  jour: {
    resume: 'Ta journée en un coup d’œil : mission, rendez-vous, relances, tâches et habitudes.',
    visite: [
      'En haut, ta mission du jour : les actions qui comptent aujourd’hui, avec les points à gagner et ta série.',
      'Dessous, ton agenda, les relances dues, les tâches urgentes et les habitudes à cocher, au même endroit.',
      'Le bouton + ajoute une tâche, une relance, une dépense ou un rendez-vous en un geste ; la cloche ouvre tes notifications.',
    ],
    actions: [
      a('ajout', 'Ajouter une tâche, une relance, une dépense ou un rendez-vous', 'Ajouter', ['Touche le bouton + (en bas à droite, ou en haut sur ordinateur).', 'Choisis ce que tu ajoutes.', 'Écris-le comme tu le dirais, par exemple « Rappeler le plombier demain », puis valide.'], { mots: 'créer nouveau rapide' }),
      a('cocher', 'Cocher une action de ta mission', 'Au quotidien', ['Repère la ligne dans « Ta mission du jour ».', 'Touche la case à gauche : l’action est faite et tu gagnes des points.'], { astuce: 'Cocher au moins une action chaque jour garde ta série.', mots: 'mission points série fait' }),
      a('premiers-pas', 'Suivre les Premiers pas', 'Au quotidien', ['Dans la carte « Premiers pas », touche une étape (ajouter une tâche, cocher une habitude, fixer un budget, connecter ton agenda, activer les notifications).', 'Elle se coche toute seule dès que c’est fait.', 'Touche « Masquer » quand tu n’en as plus besoin.'], { mots: 'démarrer débuter' }),
      a('notifications', 'Lire tes notifications', 'Au quotidien', ['Touche la cloche en haut de l’écran.', 'Les rappels du jour s’affichent, les non lus en gras.', 'Touche « Tout marquer comme lu » pour les vider.'], { mots: 'cloche rappels' }),
      a('journal', 'Noter ta journée', 'Aller plus loin', ['Dans « Mon journal », touche « Noter ».', 'Écris quelques lignes et valide : une note par jour rapporte des points.'], { mots: 'journal note' }),
      a('visite', 'Revoir la visite guidée', 'Aller plus loin', ['Ouvre Mon compte, puis Apparence.', 'Touche « Revoir la visite ».'], { mots: 'tour aide' }),
    ],
  },

  copilote: {
    resume: 'L’IA qui planifie ta journée, résume tes mails et répond à tes questions.',
    visite: [
      'Ma journée : le copilote propose tes priorités et un déroulé par créneaux, autour de tes rendez-vous.',
      'Mes mails : il analyse un mail ou plusieurs d’un coup et prépare les réponses.',
      'Tu peux lui poser une question à l’écrit ou à la voix, par exemple « Qui dois-je relancer cette semaine ? ».',
    ],
    actions: [
      a('journee', 'Planifier ta journée', 'Planifier', ['Dans « Ma journée », touche le bouton de planification.', 'Le copilote affiche tes 3 priorités, puis un déroulé par créneaux à partir de maintenant.', 'Coche les actions proposées que tu gardes et ajoute-les à tes tâches d’un geste.'], { mots: 'plan priorités créneaux' }),
      a('contexte', 'Dire au copilote comment est ta journée', 'Planifier', ['Dans « Ma journée », écris ce que tu sais de ta journée : temps disponible, absence, priorité.', 'Relance la planification : il suit ce que tu dis en priorité.'], { mots: 'contexte absence temps' }),
      a('analyser', 'Analyser tes mails non lus', 'Mails', ['Dans « Mes mails », touche « Analyser mes mails non lus ».', 'Choisis la boîte si on te le demande.', 'Lis chaque analyse : de quoi il s’agit, l’urgence, la tâche à faire, la réponse conseillée.'], { mots: 'résumer boîte' }),
      a('choisir', 'Choisir quels mails analyser', 'Mails', ['Touche « Choisir les mails ».', 'Coche les mails, ou règle un périmètre (un expéditeur, une période).', 'Lance l’analyse.'], { mots: 'lot sélection périmètre' }),
      a('activer', 'Activer le copilote', 'Réglages', ['Touche « Activer l’IA » si le bouton apparaît.', 'Connecte ta boîte mail depuis « Agendas & outils » pour qu’il lise tes mails.'], { mots: 'ia connecter' }),
      a('question', 'Poser une question à l’assistant', 'Aller plus loin', ['Ouvre « Assistant audio » dans le menu.', 'Écris ta question (ou dicte-la) et touche le bouton de demande.', 'La réponse s’affiche, et peut être lue à voix haute.'], { mots: 'demander voix' }),
    ],
  },

  relances: {
    resume: 'Les personnes à relancer, avec le bon jour pour le faire.',
    visite: [
      'Trois groupes : « À relancer maintenant », « En attente de réponse » et « Ont répondu ».',
      'Pour en ajouter une, écris-la dans la ligne du haut : « Marie, devis du site, jeudi ».',
      'Le bouton « Relancer » prépare le message avec l’IA, que tu peux retoucher avant de l’envoyer.',
    ],
    actions: [
      a('ajout-rapide', 'Ajouter une relance en une ligne', 'Ajouter', ['Dans la ligne du haut, écris qui, le sujet et quand : « Marie, devis du site, jeudi ».', 'Me montre ce qu’il a compris sous la ligne.', 'Valide : la relance est créée.'], { astuce: 'Sans date, la relance est placée selon ton délai habituel.', mots: 'créer nouvelle rapide' }),
      a('ajout', 'Ajouter une relance avec tous les détails', 'Ajouter', ['Touche « + Ajouter ».', 'Remplis Qui, le sujet, la date et l’heure, Pro ou Perso.', 'Ouvre « Plus d’options » pour une note, un responsable ou des catégories.', 'Touche « Ajouter la relance ».'], { mots: 'note catégorie responsable mode' }),
      a('relancer', 'Écrire le message de relance', 'Relancer', ['Sur une relance due, touche « Relancer ».', 'Me rédige un premier jet : retouche l’objet et le message.', 'Ajoute ton contexte, un mélange de mails, ou demande plus court, plus formel, une traduction.', 'Touche « Répondre dans le fil » ou « Écrire le mail » pour l’envoyer (pièces jointes possibles).', 'Touche « C’est fait, noter la relance » quand c’est parti.'], { astuce: 'La relance suivante se décale toute seule selon ton délai.', mots: 'brouillon mail traduire joindre fichier' }),
      a('repondu', 'Noter que la personne a répondu', 'Relancer', ['Touche la case à gauche de la relance.', 'Elle passe dans « Ont répondu » et ne te sera plus rappelée.'], { mots: 'fini terminé' }),
      a('lier-mail', 'Lier une relance à un mail', 'Organiser', ['Sous la relance, touche « Lier » si Me propose un mail.', 'Sinon, touche le bouton de lien et choisis le mail.', 'Le mail s’ouvre ensuite depuis la relance.'], { mots: 'rattacher fil' }),
      a('lot', 'Traiter plusieurs relances d’un coup', 'Organiser', ['Touche « Sélectionner » en haut du panneau.', 'Coche les relances.', 'Choisis « Ont répondu », « Relancées », « Pour demain », « Dans 1 semaine » ou « Supprimer ».'], { mots: 'sélection reporter supprimer' }),
      a('equipe', 'Voir les relances d’un membre de l’équipe', 'Organiser', ['Dans une équipe, utilise le filtre des membres au-dessus de la liste.', 'Choisis une personne, ou « Tous ».'], { mots: 'filtre membre' }),
    ],
  },

  messages: {
    resume: 'Tes boîtes Gmail et Outlook au même endroit, triées pour répondre vite.',
    visite: [
      'Toutes tes boîtes dans une seule liste ; « Toutes les boîtes » sert à n’en regarder qu’une, partagée ou non.',
      'Ouvre un mail pour le lire, y répondre, l’étiqueter, ou le transformer en tâche ou en relance.',
      'Coche plusieurs mails : étiqueter, analyser avec le copilote, archiver d’un coup.',
    ],
    actions: [
      a('lire', 'Lire un mail', 'Lire', ['Touche un mail dans la liste.', 'Sur ordinateur, il s’ouvre à droite ; sur téléphone, en plein écran.'], { mots: 'ouvrir' }),
      a('chercher', 'Chercher un mail', 'Lire', ['Écris dans « Rechercher un mail » (ou « Rechercher dans ce dossier »).', 'Utilise « Toutes les boîtes » et les filtres (Non lus, boîtes partagées) pour réduire la liste.'], { mots: 'recherche filtre non lus' }),
      a('ecrire', 'Écrire un nouveau mail', 'Écrire', ['Touche « Nouveau mail » (ou le bouton +).', 'Choisis la boîte d’envoi, le destinataire et l’objet.', 'Écris le message, ou donne ton contexte pour que Me le rédige.', 'Ajoute des pièces jointes si besoin, puis envoie.'], { mots: 'composer envoyer pièce jointe cc signature' }),
      a('repondre', 'Répondre à un mail', 'Écrire', ['Ouvre le mail, puis touche « Répondre ».', 'Écris ta réponse, ou touche le bouton de réponse proposée par l’IA.', 'Ajuste : plus court, plus formel, fautes de français, traduction.', 'Envoie.'], { mots: 'réponse ia traduire' }),
      a('melanger', 'Mélanger plusieurs mails pour écrire', 'Écrire', ['Dans un brouillon, ouvre « Mélanger des mails » (5 au plus).', 'Filtre par boîte, cherche et coche les mails qui donnent le contexte.', 'Touche « Rédiger d’après ces mails ».'], { astuce: 'Les boîtes partagées se filtrent aussi.', mots: 'contexte sources' }),
      a('etiqueter', 'Étiqueter un mail', 'Organiser', ['Ouvre le mail et touche le champ « Chercher ou créer une étiquette ».', 'Touche une étiquette proposée, ou « Créer » pour une nouvelle.', 'Retire-la en touchant la croix.'], { mots: 'libellé tag classer' }),
      a('etiqueter-lot', 'Étiqueter plusieurs mails d’un coup', 'Organiser', ['Coche des mails dans la liste.', 'Touche « Étiqueter ».', 'Pose ou retire une étiquette pour toute la sélection ; « Clients 2/3 » dit sur combien de mails elle est posée.'], { mots: 'lot sélection' }),
      a('relancer', 'Créer une relance ou une tâche depuis un mail', 'Organiser', ['Ouvre le mail.', 'Touche « Relancer » pour une relance, ou crée une tâche depuis le mail.', 'Le lien avec le mail est gardé.'], { mots: 'transformer' }),
      a('analyser', 'Analyser des mails avec le copilote', 'Aller plus loin', ['Coche les mails, ou touche « Analyser ».', 'Choisis la boîte ou le périmètre.', 'Lis le résumé, les actions proposées et les réponses prêtes.'], { mots: 'ia résumé' }),
      a('mains-libres', 'Traiter ses mails à la voix', 'Aller plus loin', ['Touche « Mains libres ».', 'Me lit chaque mail ; dis ce que tu veux : répondre, archiver, passer.'], { mots: 'voix dicter écouter' }),
      a('connecter', 'Connecter une boîte mail', 'Réglages', ['Touche « Agendas & outils ».', 'Dans « Services », connecte Gmail ou Outlook.', 'Les mails arrivent après la première synchronisation.'], { mots: 'gmail outlook compte' }),
    ],
  },

  taches: {
    resume: 'Tout ce qu’il y a à faire, rangé par échéance et par priorité.',
    visite: [
      'Les tâches sont groupées par moment : en retard, aujourd’hui, cette semaine, plus tard.',
      'Ajoute une tâche en une ligne, ex. « Rappeler le plombier demain » : Me comprend la date.',
      'Touche une tâche pour la modifier, ajouter une note, un projet, une échéance ou un responsable.',
    ],
    actions: [
      a('ajout-rapide', 'Ajouter une tâche en une ligne', 'Ajouter', ['Écris dans la ligne du haut : « Rappeler le plombier demain ».', 'Me montre la date comprise.', 'Valide.'], { mots: 'créer nouvelle' }),
      a('ajout', 'Ajouter une tâche avec tous les détails', 'Ajouter', ['Touche « + Ajouter ».', 'Écris « Que faut-il faire ? », choisis « Pour quand ? » et Pro ou Perso.', 'Ajoute une note, un projet, un responsable si tu veux.', 'Touche « Ajouter la tâche ».'], { mots: 'échéance priorité note projet' }),
      a('terminer', 'Cocher une tâche faite', 'Au quotidien', ['Touche la case à gauche de la tâche.', 'Pour la rouvrir, touche-la de nouveau.'], { mots: 'fait terminé' }),
      a('filtrer', 'Filtrer les tâches', 'Au quotidien', ['Touche « Filtrer les tâches ».', 'Choisis Pro ou Perso, la période (en retard, aujourd’hui, cette semaine) ou un projet.'], { mots: 'trier chercher' }),
      a('lot', 'Traiter plusieurs tâches d’un coup', 'Organiser', ['Touche « Sélectionner » en haut de la liste.', 'Coche les tâches.', 'Choisis « Terminer », « Priorité haute », « Pour demain », « Dans 1 semaine », « Envoyer vers » ou « Supprimer ».'], { mots: 'sélection reporter' }),
      a('projet', 'Rattacher une tâche à un projet', 'Organiser', ['Ouvre la tâche.', 'Choisis le projet dans la liste.', 'Elle apparaît alors dans le planning du projet.'], { mots: 'projets' }),
      a('equipe', 'Confier une tâche à quelqu’un', 'Organiser', ['Dans une équipe, ouvre « Qui fait quoi » sur la tâche.', 'Choisis le responsable et les personnes qui suivent.', 'Chacun est prévenu.'], { mots: 'affecter responsable membre' }),
    ],
  },

  habitudes: {
    resume: 'Tes routines : coche-les chaque jour et garde ta série.',
    visite: [
      'Les habitudes du jour d’abord : touche une ligne pour la cocher.',
      'Une série compte les jours d’affilée ; la meilleure série est gardée.',
      'Chaque habitude a son rythme (chaque jour, semaine ou mois) et son mode de rappel.',
    ],
    actions: [
      a('cocher', 'Cocher une habitude', 'Au quotidien', ['Dans « Aujourd’hui », touche la case de l’habitude.', 'Pour la décocher, touche-la de nouveau.'], { mots: 'série fait' }),
      a('ajout', 'Ajouter une habitude', 'Ajouter', ['Touche « + Ajouter ».', 'Écris le nom, choisis la fréquence : chaque jour, chaque semaine ou chaque mois.', 'Pour chaque semaine ou mois, choisis le jour.', 'Active « À heure fixe ? » pour un rappel à une heure précise.', 'Touche « Enregistrer ».'], { mots: 'créer routine fréquence' }),
      a('mode', 'Choisir comment Me te rappelle', 'Organiser', ['Ouvre l’habitude, puis son mode : « Mode passif » ou « Mode coach ».', 'Le mode coach insiste davantage et te prévient quand ta série est en danger.'], { mots: 'rappel passif coach' }),
      a('filtrer', 'Filtrer les habitudes', 'Organiser', ['Touche « Filtrer les habitudes ».', 'Choisis Personnel, Finances ou Toutes.'], { mots: 'catégorie' }),
      a('supprimer', 'Supprimer une habitude', 'Organiser', ['Ouvre l’habitude.', 'Touche « Supprimer » et confirme.'], { mots: 'retirer' }),
    ],
  },

  finances: {
    resume: 'Budgets, dépenses, objectifs, prêts et cotisations, avec un rapport chaque soir.',
    visite: [
      'Aperçu et Résumé : où tu en es sur la période, avec la barre de période pour changer de semaine, de mois ou d’année.',
      'Budgets : fixe ce que tu veux dépenser par catégorie ; la jauge se remplit au fil des dépenses.',
      'Mouvements : Dépenses, Revenus, Comptes et Analyses ; Objectifs, Prêts et Cotisations ont leur onglet.',
      'Le rapport des dépenses arrive chaque soir ; l’engrenage ouvre les réglages (alertes, paiements récurrents, devises).',
    ],
    actions: [
      a('depense', 'Ajouter une dépense', 'Ajouter', ['Touche « + Dépense » (ou le bouton Dépense de la barre du bas sur téléphone).', 'Écris le montant et une note.', 'Choisis la date, le budget ou la catégorie, et un justificatif si tu en as un.', 'Enregistre.'], { mots: 'achat payer note justificatif photo' }),
      a('revenu', 'Ajouter un revenu', 'Ajouter', ['Ouvre Mouvements, puis Revenus.', 'Touche le bouton d’ajout, écris le montant et la source.', 'Enregistre.'], { mots: 'salaire entrée argent' }),
      a('budget', 'Fixer un budget', 'Budgets', ['Ouvre l’onglet Budgets.', 'Touche le bouton de création.', 'Choisis une catégorie ou « Toutes mes dépenses », le montant maximum et la période (jour, semaine, mois…).', 'Enregistre : la jauge suit tes dépenses.'], { astuce: 'Un budget peut s’arrêter à une date, ou revenir chaque période.', mots: 'plafond catégorie jauge' }),
      a('periode', 'Changer la période affichée', 'Budgets', ['Touche les flèches ‹ › pour passer à la période précédente ou suivante.', 'Touche le nom de la période pour choisir la durée (jour, semaine, mois, trimestre, année) et la période exacte.', 'Touche « Aujourd’hui » pour revenir.'], { mots: 'semaine mois année' }),
      a('modifier-depense', 'Modifier ou supprimer une dépense', 'Mouvements', ['Ouvre Mouvements, puis Dépenses.', 'Touche la dépense pour la modifier.', 'Pour en supprimer plusieurs, touche « Sélectionner », coche-les et choisis « Supprimer ».'], { mots: 'corriger lot' }),
      a('filtrer-depenses', 'Chercher et filtrer les dépenses', 'Mouvements', ['Dans Dépenses, écris dans la recherche.', 'Touche « Filtres » : budget, catégorie, avec ou sans justificatif.'], { mots: 'rechercher catégorie' }),
      a('objectif', 'Se fixer un objectif d’épargne', 'Objectifs et prêts', ['Ouvre l’onglet Objectifs.', 'Crée un objectif avec son montant et sa date.', 'Verse dessus quand tu mets de l’argent de côté : Me propose un plan de versements.'], { mots: 'épargne économiser dette' }),
      a('pret', 'Suivre un prêt', 'Objectifs et prêts', ['Ouvre l’onglet Prêts.', 'Ajoute le prêt : à qui, le montant, la date de remboursement.', 'Me te rappelle quand il faut rendre ou être remboursé.'], { mots: 'prêter emprunter rembourser' }),
      a('cotisation', 'Gérer une cotisation ou une tontine', 'Objectifs et prêts', ['Ouvre l’onglet Cotisations.', 'Crée un groupe ou rejoins-en un depuis l’annuaire.', 'Suis les versements, le tour de chacun et les rappels.'], { mots: 'tontine likelemba groupe cagnotte' }),
      a('rapport', 'Régler le rapport du soir et les alertes', 'Réglages', ['Touche l’engrenage ⚙ en haut.', 'Règle les alertes de budget, le rapport du soir, les paiements récurrents et les devises.'], { mots: 'alertes rappel récurrent devise' }),
      a('analyses', 'Comprendre où va ton argent', 'Aller plus loin', ['Ouvre Mouvements, puis Analyses.', 'Lis les graphiques par catégorie et par période.'], { mots: 'statistiques graphiques' }),
    ],
  },

  calendrier: {
    resume: 'Tes rendez-vous et échéances, au jour, à la semaine ou au mois.',
    visite: [
      'Passe entre Jour, Semaine et Mois ; « Aujourd’hui » te ramène à la date du jour.',
      'Tu vois tes rendez-vous, mais aussi les tâches et relances qui tombent un jour donné ; les pastilles choisissent ce qui s’affiche.',
      '+ Rendez-vous crée un rendez-vous ; + Tâche ce jour ajoute une tâche à la date choisie.',
    ],
    actions: [
      a('vue', 'Changer d’affichage', 'Voir', ['Touche Jour, Semaine ou Mois.', 'Utilise les flèches pour avancer ou reculer ; touche « Aujourd’hui » pour revenir.'], { mots: 'semaine mois' }),
      a('filtre', 'Choisir ce que montre le calendrier', 'Voir', ['Sous le titre, la ligne de pastilles dit ce qui s’affiche (« Tout », rendez-vous, tâches, relances…).', 'Touche une pastille pour la cacher ou l’afficher ; un appui long n’affiche que celle-là ; « Tout » remet tout.'], { mots: 'filtrer afficher' }),
      a('rdv', 'Ajouter un rendez-vous', 'Ajouter', ['Touche « + Rendez-vous ».', 'Écris le titre (ex. « Appeler le comptable »), la date et l’heure.', 'Touche « Ajouter ».'], { mots: 'événement créer agenda' }),
      a('tache-jour', 'Ajouter une tâche à une date', 'Ajouter', ['Ouvre le jour voulu.', 'Touche « + Tâche ce jour », écris la tâche et valide.'], { mots: 'échéance' }),
      a('modifier', 'Modifier un rendez-vous', 'Organiser', ['Touche le rendez-vous.', 'Change le titre, la date ou l’heure, puis enregistre.'], { mots: 'déplacer supprimer' }),
      a('connecter', 'Voir tes agendas Google ou Outlook', 'Aller plus loin', ['Ouvre « Agendas & outils » et connecte ton compte.', 'Choisis les agendas à synchroniser : leurs rendez-vous s’affichent ici.'], { mots: 'google outlook synchroniser' }),
    ],
  },

  projets: {
    resume: 'Chaque projet découpé en tâches, avec son planning, ses risques et son suivi.',
    visite: [
      'Cinq vues : Projets (cartes), Ensemble, Feuille de route, Timeline et À compléter.',
      'Touche un projet ou une tâche : le détail s’ouvre en fenêtre, sans quitter la liste.',
      'Importer crée un projet depuis un tableau Excel ; Rapport trimestriel, Risques, Décisions Exco et Piliers servent au suivi.',
    ],
    actions: [
      a('nouveau', 'Créer un projet', 'Créer', ['Touche « + Projet ».', 'Donne un nom, une icône et une date de début.', 'Ajoute ses tâches une à une, ou demande un plan à l’IA.'], { mots: 'nouveau planning' }),
      a('importer', 'Importer un plan depuis Excel', 'Créer', ['Touche « Importer ».', 'Choisis un fichier Excel ou CSV, ou colle les cellules.', 'Vérifie l’aperçu, puis valide : Me crée le projet et son planning.'], { mots: 'excel csv fichier' }),
      a('vues', 'Changer de vue', 'Voir', ['Touche Projets, Ensemble, Feuille de route, Timeline ou À compléter.', 'Dans la Timeline, regroupe par pilier, trimestre ou mois.'], { mots: 'cartes frise gantt' }),
      a('timeline', 'Voir les tâches sur la timeline', 'Voir', ['Ouvre la vue Timeline.', 'Touche la flèche à droite du nom d’un projet pour déplier ses tâches, ou « Voir les tâches » pour tout déplier.', 'Touche une tâche pour l’ouvrir.'], { mots: 'frise barres jalon' }),
      a('filtrer', 'Filtrer par pilier ou par critère', 'Voir', ['Touche « Filtres » (ou le bouton des piliers).', 'Choisis un pilier, un responsable ou un état.'], { mots: 'pilier responsable retard' }),
      a('detail', 'Ouvrir le détail d’un projet', 'Suivre', ['Touche la carte du projet (ou sa ligne dans une vue).', 'La fenêtre montre ses tâches, son avancement, son budget et ses risques.'], { mots: 'tâches avancement' }),
      a('completer', 'Compléter les tâches incomplètes', 'Suivre', ['Ouvre la vue « À compléter ».', 'Filtre par ce qui manque (responsable, date, durée…).', 'Touche une tâche pour la compléter.'], { mots: 'manque' }),
      a('rapport', 'Préparer le rapport trimestriel', 'Suivre', ['Touche « Rapport trimestriel ».', 'Lis l’avancement par pilier, les risques et les décisions.'], { mots: 'exco rapport' }),
      a('risques', 'Tenir le registre des risques', 'Suivre', ['Touche « Risques ».', 'Ajoute un risque, sa gravité et ce que tu fais pour le réduire.'], { mots: 'registre' }),
      a('decisions', 'Noter les décisions de l’Exco', 'Suivre', ['Touche « Décisions Exco ».', 'Ajoute la décision, sa date et le projet concerné.'], { mots: 'comité' }),
      a('piliers', 'Régler les piliers', 'Réglages', ['Touche « Piliers ».', 'Nomme les piliers : tu pourras ensuite classer les actions et filtrer.'], { mots: 'classer' }),
    ],
  },

  'comptes-rendus': {
    resume: 'Garde une trace de chaque réunion : décisions, actions et responsables.',
    visite: [
      'Chaque compte rendu garde les décisions et les actions à suivre.',
      'Les filtres Tous, À suivre et Projets retrouvent vite ce qui compte.',
      '+ Nouveau écrit un compte rendu ; tu peux aussi enregistrer la réunion, Me la transcrit.',
    ],
    actions: [
      a('nouveau', 'Écrire un compte rendu', 'Créer', ['Touche « + Nouveau » (ou « Écrire un compte rendu »).', 'Renseigne la date et les participants.', 'Écris ou colle les notes de la réunion.', 'Me en tire les décisions et les actions ; relis et enregistre.'], { mots: 'réunion créer notes' }),
      a('enregistrer', 'Enregistrer une réunion', 'Créer', ['Dans un nouveau compte rendu, touche « Enregistrer la réunion » (Pro).', 'Touche « Pause » et « Reprendre » si besoin.', 'Touche « Terminer et transcrire » : le texte rejoint le compte rendu.', 'Si une partie échoue, touche « Réessayer la transcription ».'], { astuce: 'L’audio n’est jamais gardé par le serveur.', mots: 'audio micro transcription' }),
      a('rattacher', 'Rattacher à un projet, une tâche ou une relance', 'Organiser', ['Dans le compte rendu, touche « Rattacher à ».', 'Choisis le projet, la tâche ou la relance concernée (« + Projet, tâche ou relance »).'], { mots: 'lier' }),
      a('filtrer', 'Retrouver un compte rendu', 'Organiser', ['Touche « Filtrer les comptes rendus ».', 'Choisis Tous, À suivre ou Projets.'], { mots: 'chercher' }),
      a('actions', 'Transformer les actions en tâches', 'Organiser', ['Ouvre le compte rendu.', 'Sur une action, touche le bouton pour l’ajouter à tes tâches ou relances.'], { mots: 'tâche relance suivre' }),
      a('supprimer', 'Supprimer un compte rendu', 'Organiser', ['Ouvre le compte rendu.', 'Touche « Supprimer le compte rendu » et confirme.'], { mots: 'retirer' }),
    ],
  },

  categories: {
    resume: 'Tes étiquettes, pour ranger tâches, dépenses et habitudes.',
    visite: [
      'Une catégorie a un nom, une icône, une couleur et des mots-clés.',
      '« Classer automatiquement » range les dépenses selon les mots-clés.',
      '« Fusionner ou supprimer » fait le ménage sans rien perdre.',
    ],
    actions: [
      a('ajout', 'Créer une catégorie', 'Créer', ['Touche « + Ajouter ».', 'Écris le nom (ex. Famille, Voyage, Client Dupont), choisis l’icône et la couleur.', 'Ajoute des mots-clés si tu veux le classement automatique.', 'Touche « Enregistrer ».'], { mots: 'étiquette nouvelle' }),
      a('budgets', 'Créer mes catégories à partir de mes budgets', 'Créer', ['Touche « Créer mes catégories à partir de mes budgets ».', 'Les catégories apparaissent avec les icônes de tes budgets.'], { mots: 'importer' }),
      a('auto', 'Classer automatiquement', 'Organiser', ['Ajoute des mots-clés à tes catégories (ex. « carrefour, marché »).', 'Touche « Classer automatiquement » : les dépenses qui les contiennent sont rangées.'], { mots: 'mots-clés ranger' }),
      a('ordre', 'Changer l’ordre', 'Organiser', ['Touche « Monter » ou « Descendre » sur une catégorie.'], { mots: 'trier' }),
      a('fusion', 'Fusionner ou supprimer', 'Organiser', ['Touche « Fusionner ou supprimer ».', 'Choisis la catégorie à garder, puis celle à retirer.', 'Touche « Garder » : ses éléments passent dans la catégorie gardée.'], { mots: 'supprimer doublon' }),
    ],
  },

  bilan: {
    resume: 'Tendances, graphiques et conseils pour voir où tu en es.',
    visite: [
      'Tendances : tes graphiques sur plusieurs semaines.',
      'Conseils : un état des lieux et des recommandations.',
    ],
    actions: [
      a('tendances', 'Voir tes tendances', 'Voir', ['Ouvre l’onglet Tendances.', 'Lis les graphiques : tâches faites, habitudes, dépenses.'], { mots: 'graphiques statistiques' }),
      a('conseils', 'Lire l’état des lieux', 'Voir', ['Ouvre l’onglet Conseils.', 'Lis le rapport et les recommandations, et agis dessus.'], { mots: 'rapport recommandations' }),
    ],
  },

  recompenses: {
    resume: 'Points, niveaux, séries et badges pour tenir dans la durée.',
    visite: [
      'Ma semaine : les points gagnés jour après jour.',
      'Comment gagner des points : chaque action a sa valeur.',
      'Badges : ce que tu as débloqué et ce qui reste à gagner.',
    ],
    actions: [
      a('points', 'Gagner des points', 'Voir', ['Ouvre « Comment gagner des points ».', 'Coche des tâches, des habitudes, des relances ou note ta journée : chacune rapporte des points.'], { mots: 'niveau' }),
      a('serie', 'Garder ta série', 'Voir', ['Fais au moins une action chaque jour.', 'Un joker protège ta série un jour d’oubli.'], { mots: 'joker jours' }),
      a('badges', 'Voir tes badges', 'Voir', ['Ouvre « Badges ».', 'Touche un badge pour voir comment le gagner.'], { mots: 'trophées' }),
      a('couper', 'Couper les rappels de série', 'Réglages', ['Ouvre Mon compte, puis Notifications.', 'Désactive « Mission et série ».'], { mots: 'désactiver jeu' }),
    ],
  },

  journal: {
    resume: 'Ton historique d’échanges et tes contacts.',
    visite: [
      'Les 14 derniers jours d’échanges d’un coup d’œil.',
      'Chaque contact garde la date du dernier échange.',
    ],
    actions: [
      a('contact', 'Ajouter un contact', 'Ajouter', ['Dans « Contacts », écris le nom.', 'Ajoute une organisation ou un lien si tu veux.', 'Touche « Ajouter le contact ».'], { mots: 'personne créer' }),
      a('echange', 'Noter un échange', 'Au quotidien', ['Ouvre le contact.', 'Touche « Échange aujourd’hui » (ou règle « Dernier échange »).', 'La date est mise à jour.'], { mots: 'dernier appel' }),
      a('supprimer', 'Supprimer un contact', 'Organiser', ['Ouvre le contact.', 'Touche « Supprimer » et confirme.'], { mots: 'retirer' }),
    ],
  },

  sources: {
    resume: 'Connecte tes agendas, boîtes mail et outils pour les voir dans Me.',
    visite: [
      'Services : Google, Microsoft et les autres outils que tu peux connecter.',
      'Comptes connectés : l’état de chaque compte, ses agendas, ses boîtes partagées et ses signatures.',
      'Confidentialité : ce que Me garde et ce que l’analyse des mails fait.',
    ],
    actions: [
      a('connecter', 'Connecter Gmail, Outlook ou un agenda', 'Connecter', ['Ouvre « Services ».', 'Touche le service voulu et autorise l’accès dans la fenêtre du fournisseur.', 'Choisis Pro ou Perso pour ce compte.'], { mots: 'google microsoft gmail outlook' }),
      a('agendas', 'Choisir les agendas à synchroniser', 'Régler', ['Ouvre « Comptes connectés », puis les réglages du compte.', 'Dans « Agendas à synchroniser », coche ceux que tu veux voir.'], { mots: 'calendriers' }),
      a('synchro', 'Synchroniser tout de suite', 'Régler', ['Touche le bouton de synchronisation du compte.', 'Les nouveaux rendez-vous et mails arrivent.'], { mots: 'actualiser' }),
      a('partagees', 'Ajouter une boîte partagée', 'Régler', ['Ouvre les réglages du compte, puis « Boîtes partagées ».', 'Ajoute l’adresse : ses mails apparaissent avec les autres et se filtrent par boîte.'], { mots: 'ventes support' }),
      a('signatures', 'Régler tes signatures', 'Régler', ['Ouvre « Signatures ».', 'Écris la signature de chaque boîte : elle s’ajoute à tes mails.'], { mots: 'mail' }),
      a('autres', 'Ajouter un autre agenda ou outil', 'Connecter', ['Ouvre « Autres outils ».', 'Touche « Ajouter », donne le nom (ex. Agenda iCloud), le lien et le contexte.'], { mots: 'ics lien' }),
      a('reconnecter', 'Reconnecter ou retirer un compte', 'Régler', ['Si un compte a expiré, touche « Reconnecter ».', 'Pour le retirer, touche « Déconnecter » ou « Retirer ».'], { mots: 'expiré autorisation déconnecter' }),
      a('analyse', 'Régler l’analyse des mails à l’avance', 'Confidentialité', ['Ouvre « Confidentialité » (ou « Analyse à l’avance des mails »).', 'Active ou coupe l’analyse automatique de tes mails.'], { mots: 'ia vie privée' }),
    ],
  },

  equipes: {
    resume: 'Un espace partagé : une équipe voit les mêmes tâches, relances et projets.',
    visite: [
      'Chaque équipe a son espace ; « Espace affiché » dit lequel tu regardes.',
      'Trois rôles règlent qui peut modifier quoi.',
      'Invite par email, ou transmets le lien toi-même.',
    ],
    actions: [
      a('creer', 'Créer une équipe', 'Créer', ['Touche « Nouvelle équipe ».', 'Donne un nom (ex. Maison, Studio Nova) et une icône.', 'Enregistre.'], { mots: 'nouvelle espace' }),
      a('inviter', 'Inviter quelqu’un', 'Membres', ['Ouvre l’équipe et touche « Inviter ».', 'Écris l’adresse email et choisis le rôle.', 'Touche « Envoyer l’invitation », ou copie le lien pour l’envoyer toi-même.'], { mots: 'membre ajouter lien' }),
      a('role', 'Changer le rôle d’un membre', 'Membres', ['Touche le membre.', 'Choisis son rôle, puis « Enregistrer le rôle ».'], { mots: 'droits admin' }),
      a('espace', 'Passer d’un espace à l’autre', 'Voir', ['Dans « Espace affiché », choisis ton espace perso ou une équipe.', 'Toutes les pages montrent alors cet espace.'], { mots: 'changer' }),
      a('quitter', 'Quitter ou supprimer une équipe', 'Membres', ['Ouvre l’équipe.', 'Touche « Retirer » pour toi ou « Supprimer l’équipe » si tu en es le propriétaire.'], { mots: 'sortir' }),
    ],
  },

  assistant: {
    resume: 'Ton briefing à écouter, et des questions à poser à la voix.',
    visite: [
      'Le briefing lit ta journée : agenda, relances, tâches et habitudes.',
      'Choisis ce qu’il lit, sa voix et son ton.',
      'Pose une question à l’écrit ou à la voix : la réponse peut être lue.',
    ],
    actions: [
      a('briefing', 'Écouter ton briefing', 'Écouter', ['Touche le bouton d’écoute du briefing.', 'Me lit ta journée ; touche de nouveau pour l’arrêter.'], { mots: 'voix lire' }),
      a('sections', 'Choisir ce que le briefing lit', 'Régler', ['Coche ou décoche Agenda, Relances, Tâches, Habitudes.'], { mots: 'sections' }),
      a('voix', 'Changer la voix et le ton', 'Régler', ['Choisis la voix dans la liste.', 'Choisis le ton (neutre, amical, formel…).'], { mots: 'eve' }),
      a('question', 'Poser une question', 'Demander', ['Écris ta question, par exemple « Qui dois-je relancer cette semaine ? ».', 'Touche le bouton de demande.', 'Active « Lire les réponses » pour l’entendre.'], { mots: 'ia dicter' }),
    ],
  },

  notifications: {
    resume: 'Tes rappels et alertes, du plus récent au plus ancien.',
    visite: [
      'Les rappels du jour arrivent ici, les non lus en gras avec un point.',
      'Touche « Tout marquer comme lu » pour les vider d’un geste.',
    ],
    actions: [
      a('lire', 'Lire et vider tes notifications', 'Au quotidien', ['Ouvre la page : tout ce qui est affiché passe en lu en la quittant.', 'Ou touche « Tout marquer comme lu ».'], { mots: 'cloche rappels' }),
      a('regler', 'Choisir ce qui te prévient', 'Réglages', ['Ouvre Mon compte, puis Notifications.', 'Active ou coupe l’app, l’email, les nouveaux mails, la mission et la série, ou « Si je n’ouvre plus Me ».'], { mots: 'push email désactiver' }),
      a('push', 'Recevoir les rappels app fermée', 'Réglages', ['Ouvre Mon compte, puis Notifications.', 'Active « Sur cet appareil (push) » et autorise les notifications.', 'Touche « Envoyer un essai » pour vérifier.'], { mots: 'essai appareil iphone' }),
    ],
  },

  config: {
    resume: 'Les réglages de l’app pour l’administrateur : canaux, modes de rappel, IA.',
    visite: [
      'Les canaux de notification, les modes de rappel et l’assistant se règlent ici.',
      'Ces réglages valent pour toute l’app ; chacun garde la main sur ses notifications dans Mon compte.',
    ],
    actions: [
      a('canaux', 'Activer ou couper un canal', 'Réglages', ['Ouvre la page Configuration.', 'Active ou coupe le canal (email, SMS, notification) avec son interrupteur.'], { mots: 'admin' }),
      a('modes', 'Régler les modes de rappel', 'Réglages', ['Choisis un mode (passif, coach…).', 'Règle ses heures et ses rappels, puis enregistre.'], { mots: 'passif coach' }),
      a('assistant', 'Régler l’assistant IA', 'Réglages', ['Active ou coupe l’assistant.', 'Choisis ses options, puis enregistre.'], { mots: 'ia' }),
    ],
  },

  utilisateurs: {
    resume: 'Les comptes et abonnés, pour l’administration.',
    visite: [
      'La liste des comptes, avec leur formule et leurs paiements.',
      'Une fiche par membre : activité, paiements, actions.',
    ],
    actions: [
      a('chercher', 'Chercher un compte', 'Voir', ['Écris un nom ou un email dans la recherche.', 'Filtre par formule : abonnés, en essai, sans abonnement.'], { mots: 'membre' }),
      a('fiche', 'Ouvrir la fiche d’un membre', 'Voir', ['Touche le membre.', 'Lis son activité, ses paiements et les actions passées.'], { mots: 'paiements' }),
      a('offrir', 'Offrir ou prolonger une formule', 'Agir', ['Ouvre la fiche du membre.', 'Choisis l’action : offrir, prolonger un essai ou retirer un abonnement.', 'Ajoute une note : elle est gardée, et le membre est prévenu.'], { mots: 'essai abonnement' }),
    ],
  },

  versements: {
    resume: 'Les cagnottes de cotisations à verser à leurs bénéficiaires.',
    visite: [
      'Chaque versement dit à qui, combien et où il en est.',
      'Tu confirmes un versement une fois qu’il est parti.',
    ],
    actions: [
      a('voir', 'Voir les versements à faire', 'Voir', ['Ouvre la liste : les versements dus sont en tête.', 'Touche-en un pour voir le bénéficiaire et le montant.'], { mots: 'cagnotte bénéficiaire' }),
      a('verser', 'Marquer un versement fait', 'Agir', ['Ouvre le versement.', 'Suis les étapes affichées, puis confirme.'], { mots: 'payer confirmer' }),
    ],
  },

  abonnement: {
    resume: 'Ta formule, ce qu’elle comprend et comment la changer.',
    visite: [
      'Les quatre formules : Gratuit, Finances, Projets et Pro.',
      'Mensuel ou annuel : l’annuel offre un mois.',
      'Tu paies par mobile money, sans renouvellement automatique.',
    ],
    actions: [
      a('voir', 'Voir ta formule et sa fin', 'Voir', ['Ouvre la page : ta formule et sa date de fin sont en haut.'], { mots: 'essai pro' }),
      a('payer', 'Passer à une formule payante', 'Payer', ['Choisis la formule et la période, Mensuel ou Annuel.', 'Accepte les conditions de vente.', 'Paie par mobile money : la formule s’active dès la confirmation.'], { mots: 'mobile money flexpaie prix' }),
      a('historique', 'Retrouver tes paiements', 'Voir', ['Dans la liste des paiements, repère l’état : Payé, En attente, Échoué.'], { mots: 'facture reçu' }),
    ],
  },

  compte: {
    resume: 'Ton profil, tes notifications, l’apparence, ta sécurité et tes données.',
    visite: [
      'Profil : ton nom, ton email et ton numéro.',
      'Notifications : choisis ce qui te prévient, et teste l’envoi.',
      'Apparence : thème, taille de l’affichage, pages affichées, visite guidée.',
      'Sécurité et Mes données : mot de passe, appareils connectés, export et suppression.',
    ],
    actions: [
      a('profil', 'Changer ton nom, ton email ou ton numéro', 'Profil', ['Ouvre « Profil ».', 'Modifie le champ, puis touche « Enregistrer ».', 'Pour un nouvel email, confirme-le avec le lien reçu.'], { mots: 'nom téléphone' }),
      a('notifs', 'Régler tes notifications', 'Notifications', ['Ouvre « Notifications ».', 'Active ou coupe l’app, l’email, les nouveaux mails, la mission et la série, ou « Si je n’ouvre plus Me ».', 'Touche « Envoyer un essai » pour vérifier.'], { mots: 'push rappel' }),
      a('apparence', 'Changer le thème et la taille du texte', 'Apparence', ['Ouvre « Apparence ».', 'Choisis le thème, la taille de l’affichage, les sons et la voix de l’app.'], { mots: 'clair sombre couleur' }),
      a('pages', 'Choisir les pages affichées', 'Apparence', ['Ouvre « Apparence », puis les pages.', 'Coche celles que tu veux voir dans la barre, ou choisis un profil (L’essentiel, Mon argent…).'], { mots: 'masquer barre menu' }),
      a('visite', 'Relancer la visite guidée', 'Apparence', ['Ouvre « Apparence », vers le bas de la page.', 'Touche « Revoir la visite ».'], { mots: 'tour aide' }),
      a('mdp', 'Changer ton mot de passe', 'Sécurité', ['Ouvre « Sécurité ».', 'Écris le mot de passe actuel puis le nouveau, et enregistre.', 'Si tu l’as oublié, touche « Mot de passe oublié ? ».'], { mots: 'sécurité' }),
      a('appareils', 'Déconnecter tes autres appareils', 'Sécurité', ['Ouvre « Sécurité », puis « Appareils connectés ».', 'Touche « Déconnecter mes autres appareils ».'], { mots: 'session' }),
      a('export', 'Exporter tes données', 'Mes données', ['Ouvre « Mes données ».', 'Touche « Tout exporter (JSON) » : le fichier contient tout ce que Me garde de toi.'], { mots: 'télécharger rgpd' }),
      a('supprimer', 'Supprimer ton compte', 'Mes données', ['Ouvre « Mes données ».', 'Touche « Supprimer mon compte… », puis « Supprimer définitivement ».', 'Cette action ne se défait pas : exporte tes données avant.'], { mots: 'effacer' }),
    ],
  },

  annuaire: {
    resume: 'Les groupes de cotisations ouverts, à rejoindre ou à comparer.',
    visite: [
      'Cherche un groupe par type, rythme ou montant avec « Filtres ».',
      'Le filtre « Organisateur expérimenté » garde les groupes menés par quelqu’un qui a déjà terminé un groupe.',
    ],
    actions: [
      a('chercher', 'Chercher un groupe', 'Trouver', ['Écris dans la recherche.', 'Touche « Filtres » : type, rythme, montant, tri.'], { mots: 'tontine cotisation' }),
      a('experimente', 'Ne garder que les organisateurs expérimentés', 'Trouver', ['Touche « Filtres ».', 'Active « Organisateur expérimenté » (et « Pas encore démarrés » si tu veux).'], { mots: 'confiance' }),
      a('rejoindre', 'Rejoindre un groupe', 'Rejoindre', ['Touche le groupe pour voir sa fiche : montant, rythme, organisateur.', 'Touche « Rejoindre » (ou « Reprendre la place » si tu en avais une).', 'Indique ton numéro mobile money, puis confirme.'], { mots: 'adhérer place' }),
      a('alerte', 'Être prévenu quand un groupe t’intéresse', 'Suivre', ['Sur la fiche, touche « Me prévenir ».', 'Le bouton devient « Alerte active ».'], { mots: 'notification' }),
      a('partager', 'Partager un groupe', 'Suivre', ['Sur la fiche, touche « Partager », « WhatsApp » ou « Copier le lien ».'], { mots: 'lien whatsapp' }),
      a('signaler', 'Signaler un groupe', 'Suivre', ['Sur la fiche, touche « Signaler ce groupe ».', 'Ajoute des détails si tu veux, puis « Envoyer le signalement ».'], { mots: 'abus' }),
    ],
  },
};

/** Une action et la page où elle se trouve, pour la recherche d’aide. */
export type ActionTrouvee = ActionGuide & { page: GuideCle };

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Les actions d'une page qui correspondent à ce qui est tapé (titre, mots, étapes ; accents et majuscules ignorés). */
export function chercherActions(cle: GuideCle, recherche: string): ActionGuide[] {
  const q = sansAccents(recherche.trim());
  const g = GUIDE[cle];
  if (!q) return g.actions;
  const mots = q.split(/\s+/).filter((m) => m.length > 1);
  return g.actions.filter((x) => {
    const texte = sansAccents(`${x.titre} ${x.mots ?? ''} ${x.groupe} ${x.pas.join(' ')}`);
    return mots.every((m) => texte.includes(m));
  });
}

/** Le guide d'une page écrit en texte, pour l'envoyer à l'IA qui répond aux questions. */
export function guideEnTexte(cle: GuideCle): string {
  const g = GUIDE[cle];
  return [g.resume, ...g.actions.map((x) => `${x.titre} : ${x.pas.map((p, i) => `${i + 1}. ${p}`).join(' ')}${x.astuce ? ` Astuce : ${x.astuce}` : ''}`)].join('\n');
}

/** La clé de guide d'une adresse de l'app (« /relances », « /annuaire/xyz »), ou null si la page n'a pas de guide. */
export function guideDeChemin(chemin: string): GuideCle | null {
  const c = chemin.replace(/\/+$/, '') || '/';
  if (c === '/') return 'jour';
  if (c === '/annuaire' || c.startsWith('/annuaire/')) return 'annuaire';
  const entrees: [string, GuideCle][] = [
    ['/copilote', 'copilote'], ['/relances', 'relances'], ['/messages', 'messages'], ['/taches', 'taches'], ['/habitudes', 'habitudes'], ['/finances', 'finances'], ['/calendrier', 'calendrier'], ['/projets', 'projets'],
    ['/comptes-rendus', 'comptes-rendus'], ['/categories', 'categories'], ['/bilan', 'bilan'], ['/recompenses', 'recompenses'], ['/journal', 'journal'], ['/sources', 'sources'], ['/equipes', 'equipes'],
    ['/assistant', 'assistant'], ['/notifications', 'notifications'], ['/config', 'config'], ['/utilisateurs', 'utilisateurs'], ['/versements', 'versements'], ['/abonnement', 'abonnement'], ['/compte', 'compte'],
  ];
  return entrees.find(([p]) => c === p || c.startsWith(`${p}/`))?.[1] ?? null;
}

export const ORDRE_VISITE: readonly ClePage[] = ['jour', 'copilote', 'relances', 'messages', 'taches', 'habitudes', 'finances', 'calendrier', 'projets', 'compte'];

export type EtapeVisite = { cle: ClePage; /** Rang du point dans la page, à partir de 0, et nombre de points de la page. */ i: number; n: number; texte: string };

/** Les étapes de la visite : plusieurs points par page, page après page. */
export function etapesVisite(masquees: ReadonlySet<ClePage> = new Set()): EtapeVisite[] {
  return ORDRE_VISITE.filter((c) => !masquees.has(c)).flatMap((cle) => GUIDE[cle].visite.map((texte, i, tous) => ({ cle, i, n: tous.length, texte })));
}

