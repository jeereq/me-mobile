# Journal des changements

Ce fichier décrit ce qui change dans la plateforme **Me** : l'app (ce dépôt, `me-mobile`) et le serveur (`me-api`).
Les plus récents sont en haut. Chaque ligne dit ce que ça change pour l'utilisateur ; le détail technique est dans les commits.

## 28 octobre 2026

### Équipe : confier une tâche dès sa création
- **« Affecter à » dans « Nouvelle tâche »** (écran Tâches) : jusqu'ici, on ne pouvait confier une tâche à un membre qu'après coup, en la modifiant. Le choix est maintenant dans le formulaire de création, avec « Personne » ou chaque membre de l'équipe.
- **Par défaut, une tâche est à son créateur** dans l'espace d'une équipe, comme les relances et les rendez-vous : y compris quand elle est ajoutée depuis le calendrier (« + Tâche ce jour »), l'ajout rapide ou la voix. Elle porte donc tout de suite son responsable au lieu de « Non affectée ».

### Mes comptes dans toutes mes équipes, et plusieurs comptes Microsoft (app et serveur)
- **Mes mails et mon agenda dans chaque équipe** : jusqu'ici, les comptes connectés n'alimentaient que l'espace personnel. Dans l'espace d'une équipe, ils sont maintenant là aussi : la boîte Mails fonctionne, et mon agenda (Google, Microsoft) s'affiche par-dessus celui de l'équipe, dans le calendrier et sur Aujourd'hui, marqué « Mon agenda, visible par moi seul ». Rien de tout cela n'est écrit dans l'espace partagé : les autres membres ne voient ni mes mails ni mes rendez-vous, et mes tâches et relances importées restent dans mon espace personnel.
- **Dans une équipe, l'écran Agendas & outils** garde la liste des comptes (connexion, déconnexion, agendas, boîtes partagées) ; les réglages par service (ce qui s'importe, filtre) se font dans l'espace personnel, ce que l'écran explique.
- **Plusieurs comptes Microsoft, de domaines différents** : le bouton devient « Connecter un autre compte Microsoft » (ou Google) une fois un compte relié, et une phrase l'explique. Si Microsoft refuse un compte d'un autre domaine (application non multi-annuaires, consentement d'un administrateur, accès conditionnel…), le serveur affiche maintenant la cause et quoi faire, en français. Côté serveur, l'application Azure doit accepter les comptes de n'importe quel annuaire (voir le README de me-api).

### Relances et rendez-vous qui appartiennent à quelqu'un (app et serveur)
- **Chaque relance a un propriétaire** : dans une équipe, une nouvelle relance est à son créateur par défaut ; « Affecter à » (comme pour une tâche) permet de la confier à un autre membre, ou à personne. Son propriétaire apparaît sur la relance, dans le calendrier et dans les filtres par membre.
- **Rendez-vous d'équipe créés dans Me** : les agendas Google et Microsoft n'alimentent que l'espace personnel, une équipe n'avait donc aucun rendez-vous. Dans le calendrier d'une équipe, « + Rendez-vous » crée un rendez-vous (titre, jour, heure ou journée entière, lieu) confié à un membre ; ✎ le modifie ou le supprime (sauf en lecture seule).
- **Le membre est prévenu** (dans Me, en push et par email) quand une relance ou un rendez-vous lui est confié, comme pour une tâche.
- **Le planning de l'équipe** montre pour chaque membre ses tâches, ses relances et ses rendez-vous à venir, avec leurs dates ; chaque ligne s'ouvre (détail, fiche de relance, formulaire de rendez-vous). Le filtre par membre du calendrier et de Relances couvre aussi ces éléments.

### Équipe : qui fait quoi, et le détail d'une tâche (app)
- **Le responsable se voit** : dans l'espace d'une équipe, chaque tâche porte les initiales du membre dans sa couleur (« Moi » pour toi), ou « Non affectée » tant qu'elle n'a personne. Un responsable qui a quitté l'équipe ou qui n'en fait pas partie est signalé.
- **Filtrer par membre** : sur Tâches et dans le calendrier, une barre « Toute l'équipe · Moi · chaque membre · Non affectées » avec le nombre de tâches à faire de chacun.
- **Planning de l'équipe** : sur Tâches (« Qui fait quoi ») et dans le calendrier (onglet **Équipe**), chaque membre avec ses tâches à faire et leurs échéances, le retard en rouge, sur 7 jours, 30 jours ou tout. Un membre sans tâche reste visible ; les tâches des projets y sont aussi.
- **Le calendrier dit à qui est la tâche** (« 👤 Alice ») et ouvre son détail au toucher.
- **Le détail d'une tâche** : toucher son titre (liste, projet via ⓘ, calendrier, planning d'équipe) ouvre une fiche en lecture : statut, responsable, échéance, priorité, projet, sous-tâches, note, compte rendu, et **le mail à l'origine de la tâche** avec « Ouvrir le mail ». Depuis la fiche : Terminer, Modifier, Écrire un mail. Si le mail est dans la boîte d'un autre membre, son objet et son expéditeur restent visibles.

### Analyse des mails par le copilote (app et serveur)
- **Tes consignes** : avant l'analyse (et après, pour la refaire), écris comment le copilote doit lire tes mails (« je suis en litige avec ce prestataire, repère les montants contestés »). Quatre idées toutes prêtes s'ajoutent d'un toucher. Elles servent aussi aux analyses d'un mail ou de mails cochés, et sont gardées sur l'appareil.
- **Le nombre de mails** : 10, 25, 50 ou 100, les plus récents d'abord (50 par défaut). Plus le lot est grand, plus chaque texte est raccourci pour que l'IA reçoive tout.
- **La période** : « Ce mois » et « Mois dernier » s'ajoutent aux durées, et « Début et fin… » ouvre un calendrier pour chaque jour (l'un des deux peut rester vide). Une date impossible ou un début après la fin est signalé et bloque la recherche, au lieu d'élargir la période sans le dire.
### Affecter une tâche à un membre de l'équipe, et lui écrire (app et serveur)
- **Affecter à** : dans l'espace d'une équipe, la fiche d'une tâche (et l'éditeur d'une tâche de projet) propose les membres de l'équipe. Un toucher confie la tâche ; « Personne » la retire. Le nom de la personne s'affiche sur la tâche (👤).
- **La personne est prévenue** : quand une tâche lui est confiée ou reconfiée, elle reçoit un message dans la cloche de Me, une notification push et un email. On ne prévient pas celui qui se l'affecte lui-même, ni pour une tâche déjà faite. Chacun peut couper les emails et les notifications dans Mon compte › Notifications.
- **Écrire un mail à propos d'une tâche** : le bouton « ✉️ Écrire un mail à ce sujet » ouvre un mail depuis ton compte Gmail ou Outlook, adressé à la personne à qui la tâche est confiée (sinon l'adresse est à écrire), avec l'objet et un début de message déjà prêts. Rien ne part sans « Oui, envoyer ».
- **À faire une fois** : redéployer me-api (rien d'autre à configurer ; les emails demandent SendGrid, comme les rappels).

### Comptes rendus (app et serveur)
- **Plus › Comptes rendus** (et la barre latérale) : note une réunion, un appel ou un point d'avancement, avec sa date, ses participants et tes notes telles qu'elles viennent.
- **Rattaché à des projets, tâches et relances** : « + Projet, tâche ou relance » dans le compte rendu, ou « + Compte rendu » dans le panneau Comptes rendus d'un projet.
- **Saisie rapide** : « Lire mes notes » repère les sections Décisions, Actions et Fait, les marques « Décision : », « [ ] », « → », « ✓ », les lignes « Relancer Marie lundi… », les dates (« vendredi », « le 12/11 ») et « @Paul ». Avec Pro, « Analyser avec le copilote » fait la même chose par l'IA et écrit un résumé.
- **Ce qui s'ouvre** : les points d'action deviennent des tâches ou des relances d'un geste (« Tout ouvrir », « Ouvrir la sélection », « Annuler »), dans le projet rattaché s'il y en a un. Un point qui reprend une tâche déjà ouverte y est relié au lieu d'être dupliqué.
- **Ce qui se clôture** : les tâches et relances rattachées (et celles des projets rattachés) se cochent ; ce que les notes disent réglé (« ✓ Devis envoyé ») est coché d'avance. Clôturer passe la tâche à « fait » et la relance à « répondu », avec les points habituels ; « Rouvrir » défait.
- **Le lien des deux côtés** : une tâche ou une relance née d'un compte rendu, ou clôturée par lui, porte une étiquette 📝 qui l'ouvre. La recherche globale trouve aussi les comptes rendus.
### Relances, tâches et habitudes plus faciles à suivre (app et serveur)
- **Modifier une relance ou une tâche** : le bouton « ⋯ » ouvre sa fiche (texte, date, priorité, catégories, mode de rappel). On peut y ajouter une **note**, affichée sous l'élément et reprise par l'IA quand elle rédige la relance.
- **Ranger une tâche dans un projet** depuis sa fiche : elle passe dans le planning du projet, à la date de son échéance. « Aucun » l'en sort.
- **« Relancé » ne fait plus disparaître la relance** : Me compte les relances (« 2e relance faite le 25 oct. »), reprogramme la suivante selon le délai de relance, et la remet dans la mission du jour et les rappels à cette date (« Relancer à nouveau Marie »). « Relancé à nouveau » compte une relance de plus ; l'IA écrit alors une relance un peu plus directe. Les anciennes relances déjà « Relancé » ne reviennent pas d'un coup en retard.
- **Autre date…** : partout où l'on choisit une date avec les raccourcis (demain, +1 sem.…), le calendrier permet maintenant n'importe quel jour.
- **Historique d'une habitude** : sa fiche montre les cinq dernières semaines jour par jour et le taux de réussite (sur 30 jours, 12 semaines ou 6 mois, sans compter avant le premier jour coché).

### Justificatifs sur les dépenses (app et serveur)
- **Joindre un reçu ou une facture** : dans la fenêtre d'une dépense, « 📷 Photo » photographie le reçu, « 🖼️ Galerie » prend une ou plusieurs photos, « 📄 Fichier ou PDF » ajoute une facture. Jusqu'à 10 justificatifs par dépense, 10 Mo chacun.
- Les vignettes s'affichent dans la fenêtre (première page pour un PDF) ; en toucher une l'ouvre en grand, avec « Ouvrir le PDF » et « Retirer de la dépense ». La croix sur la vignette la retire aussi ; rien ne change avant « Enregistrer ».
- Dans la liste des dépenses, « 📎 2 » signale celles qui ont des justificatifs. Ça marche aussi dans l'espace d'une équipe (sauf pour un lecteur).
- Les fichiers sont gardés chez **Cloudinary** par le serveur, la clé n'est jamais dans l'app. Un justificatif retiré, ou dont la dépense est supprimée, est effacé une semaine plus tard. Le bouton n'apparaît que si le serveur a Cloudinary configuré (`CLOUDINARY_URL`, voir le README de me-api).
- Demande une nouvelle version de l'app (`eas build`) pour l'appareil photo et les fichiers : une mise à jour à distance ne suffit pas.

### Reporter le budget non dépensé (app et serveur)
- **Reporter le reste** : quand un jour (ou une semaine, un mois terminé) n'a pas épuisé son budget, Finances › Aperçu propose de disposer du reste. Le bouton apparaît sous la jauge, et dans « Jour par jour » pour le jour choisi.
- **Sur un autre budget** : le jour, la semaine ou le mois suivant, ou une période choisie, dans le même budget ou un autre. Le reste quitte la période de départ et s'ajoute à celle d'arrivée : il n'est compté qu'une fois.
- **Sur un objectif** : le reste devient un versement de l'objectif choisi et sort des budgets. Supprimer ce versement rend le reste au budget.
- **Restes reportés** : la liste des reports partis de la période affichée ou arrivés dessus, chacun annulable. Le budget du jour, les prévisions et les alertes du serveur en tiennent compte.

## 27 octobre 2026

### Tarifs sur la page d'avant connexion (app)
- **Section « Des tarifs simples. »** : Gratuit, Pro mensuel (4,99 $) et Pro annuel (49,99 $, soit 4,17 $ par mois, « 2 mois offerts »), avec ce que chaque offre comprend et un bouton d'inscription.
- Sous les boutons du haut, une ligne résume : gratuit pour l'essentiel, Pro dès 4,99 $ par mois, 14 jours de Pro offerts.
- Rappel des règles : prix TTC en dollars, paiement mobile money, sans renouvellement automatique, lien vers les conditions de vente.

### Personnaliser la voix de l'app (app)
- **Voix de l'app** dans Mon compte › Préférences (et dans l'Assistant audio) : tu choisis la voix qui lit le briefing, les réponses de la commande vocale et les mails, tu l'essaies avec ta propre phrase, et tu règles la vitesse et la hauteur.
- **Ta propre voix sur iPhone** (iOS 17 et plus) : enregistre-la une fois dans Réglages › Accessibilité › Voix personnelle, autorise les apps à l'utiliser, puis touche « Utiliser ma voix personnelle » dans Me. Elle apparaît en tête de liste sous « Ta voix ». Elle reste sur le téléphone. Demande une nouvelle version de l'app (`eas build`) : une mise à jour à distance ne suffit pas.
- **Android et web** : pas de voix personnelle, mais le panneau explique comment installer une voix plus naturelle.
### Le mail d'une relance s'ouvre dans Me (app et serveur)
- **Correction** : toucher le mail d'une relance (ou d'une tâche) ouvrait le site de Gmail ou d'Outlook dès que ce mail n'était plus dans la réception relue, ce qui est le cas d'un mail envoyé qui attend sa réponse ; on se retrouvait sur la page du service au lieu du mail. Il s'ouvre maintenant dans Mails : Me le relit par son fil chez Gmail ou Outlook, et on peut le lire, y répondre ou relancer. Le site du service ne sert plus que si le compte n'est plus connecté.
- Toucher le titre d'une relance née d'un mail ouvre aussi ce mail.

### Mails : ton environnement Outlook dans Me (app et serveur)
- **Dossiers** : sur grand écran, la colonne de gauche montre les dossiers de chaque compte comme Outlook (Boîte de réception et ses sous-dossiers, Brouillons, Éléments envoyés, Archive, Courrier indésirable, Éléments supprimés, tes dossiers), avec leurs non lus, repliables ; les boîtes partagées ont aussi les leurs. Les libellés Gmail s'y rangent de la même façon. Sur téléphone, le bouton « Dossiers » ouvre le même volet.
- **Lire un dossier** : un toucher l'ouvre ; ses mails arrivent page par page (« Charger plus »), avec une recherche dans le dossier et « N chargés sur le total ».
- **Déplacer** : dans le volet de lecture, « Déplacer » range le mail dans un autre dossier de la boîte ; c'est fait chez Outlook ou Gmail.
- **Règles Outlook** : un écran « Règles » (depuis le volet des dossiers ou Agendas & outils) liste les règles de la boîte dans leur ordre, en clair (« Si … Alors … »), et un interrupteur coupe ou réactive chacune. Les règles se créent toujours dans Outlook.
- **Chargement des mails** : dans Agendas & outils, sous chaque compte Google ou Microsoft, tu choisis la période lue (3 jours à 3 mois) et le nombre de conversations (25, 50 ou 100). La réception se relit toutes les 15 minutes ou avec « Actualiser ».
- **À faire une fois** : redéployer me-api, remplacer dans l'application Azure l'autorisation `MailboxSettings.Read` par `MailboxSettings.ReadWrite` (pour couper ou réactiver une règle), puis reconnecter le compte Microsoft.

### Changer d'équipe ne mélange plus les espaces (app)
- **Correction** : juste après un changement d'espace (mon espace ↔ une équipe), les mises à jour faites à l'ouverture (série, paiements récurrents, comptes connectés) s'appliquaient encore à l'espace qu'on quittait, puis étaient enregistrées et envoyées sous le nom du nouvel espace. Au retour, mon espace pouvait ainsi être remplacé par celui de l'équipe (ou l'inverse). Désormais, rien n'est modifié ni envoyé tant que le nouvel espace n'est pas chargé, et une synchro terminée après le changement ne touche que son propre espace.

### Abonnements : essai, Gratuit et Pro (app et serveur)
- **Essai Pro de 14 jours** à la création du compte, sans paiement. Les comptes existants commencent le leur le jour de la mise à jour.
- **Gratuit** ensuite : tâches, relances, habitudes, projets, finances, statistiques, récompenses et rappels dans l'app restent inclus.
- **Pro** (4,99 $ par mois ou 49,99 $ par an) : copilote IA, comptes connectés, création d'équipes et invitations, rappels par email et push. Paiement par mobile money avec FlexPaie, sans renouvellement automatique ; Me prévient 7 jours puis la veille de la fin.
- **Écran Abonnement** (Plus, Mon compte) : offre en cours, offres, paiement, historique des paiements avec leur référence.
- Les abonnements ne s'appliquent que sur un serveur où ils sont activés (`ABONNEMENTS=true`) ; les admins ont toujours tout.

### Textes légaux mis à jour (app web)
- **Nouvelles pages** : conditions générales de vente (`/cgv`) et mentions légales (`/mentions-legales`).
- **Conditions d'utilisation** : offres, écriture dans les comptes connectés à ta demande, droit applicable.
- **Confidentialité** : données d'abonnement et de paiement, FlexPaie, accès Google à jour (lecture d'un mail à l'ouverture, envoi, agenda et tâches à ta demande), conservation comptable.
- Les passages `[À compléter]` (identité de l'éditeur, droit applicable…) sont à remplir, et l'ensemble à faire relire par un juriste.
### Mails : boîtes partagées, étiquettes et messages mieux lus (app et serveur)
- **Boîtes partagées** (Microsoft 365) : dans Agendas & outils, sous le compte Microsoft, « Boîtes partagées » ajoute ventes@, support@… Leurs mails arrivent dans Mails avec un badge (« Ventes »), se lisent comme les tiens, et une réponse part de la boîte partagée. Une boîte refusée dit pourquoi (accès à demander à l'administrateur). Une boîte Gmail déléguée se connecte comme un compte Google de plus.
- **Étiquettes** : les libellés Gmail et les catégories Outlook s'affichent sur chaque fil, dans leur couleur. « Étiqueter » dans le volet de lecture en pose ou en ôte, ou en crée une nouvelle ; c'est écrit chez Gmail (tout le fil) ou Outlook.
- **Classer** : sur grand écran, une colonne à gauche liste les boîtes (les tiennes, puis les partagées, avec leurs non lus) et les étiquettes ; sur téléphone, les mêmes puces défilent sous la recherche. La recherche lit aussi l'extrait et les étiquettes.
- **Liste** : sous l'objet, les premiers mots du message ; un trombone signale les pièces jointes.
- **Lecture** : la réponse citée (« Le … a écrit : », « De : … Envoyé : ») est repliée sous « Afficher le message cité » ; les liens, adresses et numéros de téléphone s'ouvrent d'un toucher ; les messages plus anciens du fil sont dessous, repliés, et se déplient un par un.
- **À la voix** : « Mails de la boîte ventes », « Mails étiquetés factures ».
- **À faire une fois** : redéployer me-api, ajouter à l'application Azure les autorisations `Mail.ReadWrite.Shared`, `Mail.Send.Shared` et `MailboxSettings.Read`, puis reconnecter le compte Microsoft.

### Toute l'app se pilote à la voix (app)
- **Tâches et relances** : « Reporte le devis à lundi », « Supprime la tâche garage », « Le garage est urgent », « J'ai relancé Paul », « Paul m'a répondu », « Tâches en retard », « Qu'est-ce que j'ai demain ? ».
- **Mails** : « Crée une relance pour le mail de Paul », « Transforme le mail de Paul en tâche » (rattachées au mail), « Relance Paul par mail » (réponse dans le fil rattaché), « Lis mon dernier mail », « Réponds au dernier mail que c'est d'accord ».
- **Finances** : « J'ai reçu 1 500 € de salaire », « Vire 200 € du compte courant vers le livret », « Mets 100 € de côté pour le voyage », « Crée un budget restaurant de 150 € par mois ». Une dépense qui nomme un poste ou un compte s'y range. Questions sur un poste, un compte, un objectif, le solde du mois, les dernières dépenses.
- **Habitudes** : « J'ai médité » coche Méditer, « Ma série de sport ».
- **Mieux comprise** : nombres dits en lettres, « est-ce que tu peux… », « je voudrais… », « Hey Me, … ». « Aide » liste ce que la voix sait faire. Tout changement s'annule par « Annule ».

### Relances et tâches rattachées à leur mail (app et serveur)
- **Depuis un mail**, un bloc « Suivi » montre les relances et tâches liées à ce fil. Les boutons « Relance » et « Tâche » en créent une déjà liée (objet du mail, contact, boîte perso ou pro). « Relancer » rédige la relance liée, ou en crée une.
- **Depuis une relance ou une tâche**, la puce du mail (objet et contact) l'ouvre dans Me tant qu'il est dans la boîte, sinon dans Gmail ou Outlook. « Délier » le détache.
- **Rattachement automatique** : les relances (fils sans réponse) et les tâches (mails étoilés ou avec drapeau) importées de Gmail et Outlook sont liées à leur fil d'office.
- **Propositions** : quand une relance ou une tâche semble parler d'un mail (même objet, ou même contact et objet proche), Me propose « Lier ? » des deux côtés ; « Non » ne la repropose plus. L'enveloppe ✉ permet de choisir le mail à la main.
- Les habitudes ne sont pas concernées : elles reviennent chaque jour et ne naissent pas d'un mail.

### Page d'avant connexion : plus de couleur (app)
- **Titre** : « une phrase » est surligné en ambre et « Me » passe en indigo ; une tache de couleur discrète se trouve derrière.
- **Autocollants** sous les boutons : Relances, Tâches, Habitudes et Finances, chacun dans la couleur qu'il a dans l'app.
- **La démo** est posée comme un post-it sur une carte de couleur ; sa couleur et la première puce suivent le genre de la phrase (corail pour une relance, ambre pour une tâche, menthe pour une habitude, indigo pour une dépense).
- **Atouts** : chaque pictogramme a sa propre couleur. **Le dernier appel** est un grand bloc indigo avec « Créer mon compte » et « Se connecter ».
- La capture « Ta journée en un coup d'œil » montre le nouvel accueil.

### Accueil : ta journée d'un coup d'œil (app)
- **Une carte « Mission du jour »** remplace les trois compteurs et le panneau de progression : un anneau montre ce qui est fait, avec les points du jour, la série et le niveau en pastilles de couleur (toucher l'anneau ouvre les Récompenses). Dessous, une tuile par rubrique dans sa couleur (relances en corail, tâches en ambre, habitudes en menthe) dit combien il reste à faire et ouvre la rubrique.
- **Le prochain rendez-vous** s'affiche comme un post-it bleu lagon (« Ensuite · 10:30 Appel avec Kalala ») ; il ouvre le calendrier.
- **La liste vient tout de suite** sous le titre « À faire aujourd'hui », et chaque ligne porte la puce de couleur de sa rubrique. « Premiers pas » passe sous la liste.
- Sur ordinateur, la carte occupe toute la largeur : l'anneau à gauche, les trois tuiles à droite.

### Finances : les mêmes chiffres partout (app)
- **Aperçu** : sous « Dépensé », la jauge dit ce qu'elle compte (« Dans tes budgets : 206 $ sur 390 $ ») et le hors budget est nommé à part. « À ce rythme » parle des budgets (« environ 237 $ sur 390 $ »), il ne contredit plus le total dépensé.
- **L'épargne n'est plus une dépense** : un versement vers un objectif noté comme dépense est compté comme mis de côté, partout (Aperçu, budgets, prévisions, analyses, historique, accueil), comme le faisaient déjà les Objectifs.
- **Jour par jour** : les barres montrent ce qui compte dans les budgets, comme la ligne du budget du jour ; un loyer hors budget ne fait plus passer un jour au rouge.
- **Analyses › Évolution** : « Budget tenu » compare au budget ce qui compte dedans, comme l'Aperçu et Statistiques.
- **Budget à la semaine** : son budget du jour se calcule sur sa semaine (ce qui a été dépensé lundi compte dès mardi), plus sur le mois.
- **Analyses › Jours** dit sur quelles dates porte le calcul.
- **Mots** : Comptes et Historique disent « revenus » et « dépenses » au lieu d'« entrées » et « sorties ».
- **Objectifs** : « En retard » dit de combien, et la date prévue précise le versement qu'elle suppose.

### Mails : un design inspiré d'Outlook (app)
- **Liste** : une ligne par fil avec l'avatar aux initiales du contact, l'expéditeur et l'heure (« Hier », le jour de la semaine, puis la date), l'objet et le compte d'origine. Un fil non lu porte une barre de couleur et passe en gras.
- **Volet de lecture** : sur ordinateur, le mail s'ouvre à droite de la liste, avec la barre d'outils Répondre, Relancer, Écouter et Ouvrir dans Gmail/Outlook, puis l'expéditeur, À/Cc, la date, le texte et les pièces jointes. Sur téléphone, le même affichage s'ouvre en fenêtre.
- **Écrire et répondre** : les champs De, À (avec « Cc » à droite) et Objet sont en lignes, et le message s'écrit dessous. Sur téléphone, un bouton flottant « Nouveau mail ».

### Lire et écrire ses mails depuis Me, et à la voix (app et serveur)
- **Lire un mail** : dans Plus › Mails, toucher un fil l'ouvre dans Me avec son texte complet, ses destinataires et le nom des pièces jointes. Le texte est demandé au serveur à ce moment-là et n'est jamais gardé ; le mail passe en « lu » chez Gmail ou Outlook. « Lire à voix haute » le dit.
- **Nouveau mail** : un bouton « Nouveau mail » écrit depuis le compte de ton choix (À, Cc, objet, texte). Comme pour une réponse, rien ne part sans « Oui, envoyer ».
- **À la voix** : « J'ai des mails ? » ou « Lis mes mails » disent les non lus (qui et quoi), « Lis le mail de Paul » l'ouvre et le lit, « Écris un mail à Paul pour lui dire que… » et « Réponds à Marie que c'est d'accord » ouvrent un brouillon prérempli à relire avant l'envoi. Une adresse se dicte aussi (« paul arobase exemple point fr »).
- **Réponses Gmail** : la ligne qui sépare les en-têtes du texte manquait, une réponse pouvait partir vide (serveur).
- **À faire une fois** : redéployer me-api, activer **Google Tasks API** dans Google Cloud, puis déconnecter et reconnecter les comptes Google (nouveau droit pour marquer un mail comme lu) et Microsoft.

### Finances : la fenêtre d'un budget dit pourquoi une dépense y compte (app)
- **« Ce qui compte dans Netflix »** remplace « Dépenses de Netflix », et explique les deux façons d'y compter : d'office par une catégorie que le budget suit, ou à la main avec « Lier ».
- **Trois groupes** : « D'office, par la catégorie » (avec le nom de la catégorie à la place de « par sa catégorie », et comment en sortir une), « Liées à la main » (avec « Retirer »), et « Pas dans ce budget ».
- **« Déplacer ici »** au lieu de « Lier » quand la dépense compte déjà dans un autre budget.
- **Recharges et mobile money hors des abonnements** : la catégorie proposée « Abonnements » ne garde que les vrais abonnements (Netflix, Spotify, Canal…). Orange, Airtel, Vodacom, M-Pesa et Africell vont dans une nouvelle catégorie proposée, « Téléphone et mobile money ». Les catégories déjà créées ne changent pas.

### Alertes du serveur : le même budget du jour qu'à l'écran (serveur) et vérifications automatiques (app)
- **Budget du jour** : les alertes et le briefing du matin calculent maintenant le budget du jour comme l'app (budget par budget, ce qui reste du mois sur les jours restants), et ne comptent plus le hors budget quand il n'y a pas de budget global. Le chiffre de la notification est celui de l'écran (le serveur doit être redéployé).
- **Vérifications automatiques** : chaque PR de l'app passe par les types, le lint et les tests avant d'arriver sur main. Le lint est de nouveau sans erreur.

### Répondre, tenir son agenda et ses tâches depuis Me (app et serveur)
- **Répondre à un mail** : dans Plus › Mails, « Répondre » ouvre une fenêtre, tu écris ton texte et tu confirmes ; la réponse part dans le fil depuis ton compte, et se retrouve dans tes messages envoyés. Le destinataire, l'objet et le rattachement au fil viennent du message relu par le serveur, pas de la saisie.
- **Rendez-vous** : dans le calendrier, « + Rendez-vous » écrit dans l'agenda de ton choix (compte, agenda, titre, jour, heure ou journée entière, lieu). Un rendez-vous importé porte un crayon pour le modifier ou le supprimer. Le compte est relu aussitôt, le calendrier de Me se met à jour.
- **Tâches dans les deux sens** : les tâches ouvertes de **Google Tasks** arrivent dans Me (nouvelle source) à côté de celles de Microsoft To Do ; **cocher une tâche importée la coche aussi à la source**. Dans Tâches, sélectionne des tâches puis « Envoyer vers » pour les créer dans une liste de ton compte.
- **Ce que ça demande** : Me passe en lecture **et écriture** sur tes comptes. Ajoute les nouvelles autorisations côté Google Cloud et Azure, puis **reconnecte chaque compte** — sinon Me répond « Autorisations insuffisantes : reconnecte ce compte ».

### Choisir ses agendas, et lire ses fils de mails dans Me (app et serveur)
- **Agendas & outils › Agendas à synchroniser** : chaque compte Google ou Microsoft affiche la liste de ses agendas (nom et couleur, l'agenda principal signalé). Tu coches ceux que Me doit reprendre, tu enregistres, et le compte est relu tout de suite. Rien de coché = les agendas affichés par défaut dans le service, comme avant. Un agenda partagé qui disparaît est simplement ignoré.
- **Plus › Mails** : les fils récents de Gmail et d'Outlook (7 derniers jours, un message par fil), groupés par jour, avec une pastille sur les **non lus**. Filtres par boîte (perso/pro), par compte et sur les non lus, plus une recherche sur l'objet, le contact ou le compte. Chaque mail s'ouvre dans Gmail ou Outlook (flèche ↗) et un lien « Relancer » prépare la relance. Me n'affiche jamais le contenu d'un message, seulement l'objet, le contact et la date.
- Les rendez-vous importés savent **de quel agenda** ils viennent.
- **Responsive** : les cartes de services d'Agendas & outils et les journées de la boîte mail se mettent sur plusieurs colonnes dès que la place le permet, en se réglant sur la largeur disponible et non sur un seuil d'écran. « Autres agendas et outils » est replié.

### Accueil et Finances : des listes qui ne s'allongent plus (app)
- **Accueil** : la mission du jour montre six éléments puis « Voir les N éléments à faire » ; l'agenda quatre rendez-vous puis « Voir les autres » ; le journal les trois dernières notes, avec « Voir les N notes plus tôt ».
- **Finances › Dépenses** : la liste montre les sept derniers jours, puis « Voir les N jours plus anciens », au lieu de tous les jours de la période d'un coup (utile après l'import d'un relevé). **Budgets** : les budgets terminés sont repliés.

### Tâches, habitudes et calendrier : des pages plus courtes (app)
- **Tâches** : un résumé en tête (« 1 sur 4 terminées », puis en retard, aujourd'hui, cette semaine) ; les tâches sont **rangées par échéance** : le retard, le jour et la semaine sont ouverts, « Plus tard », « Sans date » et « Terminées » restent repliés. Chaque groupe montre dix tâches puis « Voir les N autres » (cinq pour les terminées, les plus récentes d'abord). Les projets : trois, puis « Voir les autres ».
- **Habitudes** : un résumé (« 2 sur 4 faites aujourd'hui », meilleure série, habitudes en série), **Aujourd'hui** en premier, les habitudes des autres jours dans « Les autres jours » (repliées s'il y en a pour aujourd'hui), et l'aide sur les **modes de rappel** repliée.
- **Calendrier** : le détail d'un jour garde les tâches, rendez-vous et habitudes ouverts, mais replie **dépenses, récurrents et budgets** quand ils sont nombreux, coupe chaque groupe après six lignes, et cache le champ d'ajout derrière « + Ajouter une tâche ce jour ». La **semaine sur téléphone** met un jour libre sur une seule ligne, coupe un jour chargé après quatre lignes, et ne répète plus chaque jour les habitudes quotidiennes (une note le dit, elles restent dans la vue Jour).

### Statistiques : des filtres et des conseils pour tenir ton budget et tes objectifs (app)
- **Deux filtres** : la **période** (7 jours, 30 jours, ce mois, 90 jours, cette année) et ce qu'on regarde (tout, tâches, habitudes, relances, budget, objectifs). Les panneaux suivent le domaine et les chiffres clés suivent la période ; la comparaison avec la période d'avant s'adapte à la durée choisie.
- **Respect du budget** : le budget total mois après mois sur six mois (une barre rouge quand il a été dépassé, « tenu 4 mois sur 5 »), et chaque budget du mois avec ce qu'il reste. Les mois d'avant ta première dépense ne comptent pas comme « tenus ».
- **Objectifs** : le total réuni, les objectifs atteints et en retard, ce que demandent tes plans par mois, chaque objectif avec son état et son prochain versement, et ce que tu as versé mois après mois.
- **Des conseils en tête de page**, du plus urgent au plus encourageant, chacun avec un bouton qui mène à l'écran où agir :
  - un budget **dépassé deux mois sur trois** ou plus : le montant réaliste, ou ce qu'il faut couper ;
  - une **marge de fin de mois** sur un budget peu utilisé, à verser sur l'objectif le plus en retard ;
  - un objectif dont le **plan ne tient pas** : où trouver l'argent (−10, −20 ou −30 % sur tes plus gros budgets, avec le montant par budget) ou la date qui tient ;
  - le **versement prévu aujourd'hui** ; un premier objectif quand il te reste de l'argent chaque mois ; et les conseils de l'état des lieux sur les budgets.

### Un mot-clé pour parler à l'app (app)
- **Mon compte › Préférences › Mot-clé vocal** : à activer sur chaque appareil. Quand l'app est ouverte, dire « **Hey Me** » (ou « Salut Me », « Ok Me », ou un mot à toi) ouvre la commande vocale. On peut enchaîner : « Hey Me, ajoute une dépense de 12 euros de courses » s'exécute tout de suite.
- **Ce que ça implique, dit clairement** : le micro reste ouvert tant que l'app est au premier plan (une pastille « Hey Me » s'affiche en haut), l'écoute se coupe en arrière-plan et pendant la commande vocale, rien n'est enregistré par l'app, et c'est le service de dictée de l'appareil (Apple, Google, ou le navigateur) qui entend. Le réglage reste sur l'appareil. Si le micro est refusé, le mot-clé se désactive seul.
- **Limite** : il ne réveille pas l'app fermée ou en arrière-plan ; pour cela, le raccourci Siri `me://voix` reste le moyen.

### Calendrier : tout ce qui a une date, au même endroit (app)
- **Plus › Calendrier** (aussi dans la barre latérale, la recherche et un lien « Calendrier › » sur l'agenda de l'accueil) : un mois, une semaine ou un jour qui réunissent tes **tâches** (échéance ou date posée par un projet), **relances**, **habitudes**, **événements d'agenda**, **dépenses**, **revenus**, **paiements récurrents à venir**, **dates de budgets et de postes**, **objectifs** (échéance et versements prévus) et **début et fin prévue des projets**.
- **Sur téléphone**, chaque jour porte des points de couleur par type (un point rouge si quelque chose est en retard) ; **sur grand écran**, les jours montrent leurs trois premiers éléments et le détail du jour s'affiche à côté de la grille.
- **Des filtres par type** : un appui masque ou montre un type, un appui long ne garde que celui-là, chacun avec son nombre.
- **On agit depuis le calendrier** : cocher une tâche ou une relance, cocher l'habitude d'aujourd'hui, ajouter une tâche à la date choisie, ou toucher un élément pour ouvrir son écran. Chaque jour résume « N à faire · dépensé X · reçu Y ».
- Les habitudes quotidiennes à venir ne noient pas les cellules du mois : elles n'apparaissent que dans le détail du jour.

### Finances : des objectifs avec un plan pour les atteindre (app)
- **Un cinquième onglet « Objectifs »** (et une carte sur l'Aperçu) : une somme à atteindre, une date, et soit de l'épargne (« Fonds d'urgence », « Voyage », « Achat important »), soit une dette à rembourser. Un départ (« déjà de côté ») est possible.
- **Un plan calculé** : montant à verser **par mois ou par semaine** pour tenir la date, ou le montant que tu choisis (Me dit alors quand tu y arriveras, et de combien de jours tu dépasses ou devances la date). Prochain versement, état (à venir, en avance, dans les temps, en retard, échéance passée, atteint) et **étapes à 25, 50, 75 et 100 %**.
- **Un bouton « Verser X »** note le versement prévu en un appui (« Autre montant » pour un montant, une date et une note libres) ; un versement noté par erreur se retire avec « Annuler ». Les versements ne sont **ni des dépenses ni des revenus** : tes budgets et prévisions ne bougent pas.
- **« Est-ce que ça tient ? »** : le plan est comparé à ce que tu mets de côté en moyenne chaque mois (revenus moins dépenses des trois derniers mois complets), après tes autres objectifs. S'il manque de l'argent, Me propose **de réduire de 10, 20 ou 30 % tes trois plus gros budgets** (avec l'économie par budget) ou **de repousser la date** à celle que ton budget permet, en un appui. Le fonds d'urgence est proposé à trois mois de dépenses.
- **Des recommandations** sur l'accueil et dans l'état des lieux quand un objectif est en retard, a dépassé sa date ou ne tient pas dans ton budget.
- **Des dépenses reliées** : en choisissant des catégories de dépenses dans l'objectif, les dépenses de ces catégories apparaissent dans son plan (« Dépenses reliées »). « Compter » (ou « Tout compter ») les note comme versement ou remboursement, sans doubler : une dépense déjà comptée ne reparaît pas, et un versement retiré la rend de nouveau comptable. Elle reste une dépense dans tes budgets.
- **Ce qu'on met de côté n'est pas de la consommation** : une dépense comptée comme versement ne réduit plus ce que l'app croit que tu peux mettre de côté, ne gonfle plus le fonds d'urgence conseillé (trois mois de dépenses) et n'est plus proposée comme budget à réduire.
- **Sur l'accueil**, une carte « Objectifs » (sous « Mes finances ») montre tes trois prochains objectifs avec leur état, leur progression et leur prochain versement ; elle n'apparaît que si tu en as.
- **Un interrupteur « Rappels des objectifs »** dans Finances › Réglages › Alertes de budget.
- Les objectifs se synchronisent entre appareils comme le reste de tes finances. Ils restent dans la devise principale. **Avec un compte, le serveur envoie des rappels** : versement prévu du jour, retard sur le plan (une fois par semaine), échéance passée et objectif atteint, avec l'heure, le push et l'email des alertes de budget.

### Web : plus d'écran blanc après une mise à jour du site (app)
- **Rechargement automatique** : si un onglet resté ouvert cherche un fichier de l'ancienne version (erreur « Unexpected token '<' » ou « Requiring unknown module »), la page se recharge une fois toute seule et prend la nouvelle version.
- **Un fichier manquant n'est plus remplacé par la page d'accueil** : les fichiers du site (`/_expo/`, `/assets/`) absents renvoient une vraie erreur 404, et la page d'accueil n'est plus gardée en cache.

### Finances : une navigation plus simple (app)
- **Des onglets en moins** : Aperçu, Budgets, Mouvements, Comptes (et Objectifs, voir plus haut). Ils tiennent tous sur un petit téléphone, sans défiler.
- **Mouvements regroupe tout ce qui bouge** : Dépenses, Revenus, Historique (l'ancien « Tout l'historique ») et Analyses (Évolution, Répartition, Jours), qui avait son propre onglet.
- **Réglages derrière l'engrenage ⚙** en haut de l'écran : alertes, paiements récurrents, devises. Une flèche de retour ramène à l'Aperçu.
- **Les prévisions sur l'Aperçu** : « va-t-on dépasser ? » se lit en arrivant, au lieu d'être cachée dans Budgets.

### Finances : un chargement visible sur les filtres, et les virements entre comptes mis en avant (app)
- **Un chargement à chaque filtre** : quand tu changes d'onglet, de période, de budget ou de catégorie, la vue montre un instant sa forme grisée avant d'afficher le résultat, au lieu de changer d'un coup sans rien dire.
- **Les virements d'abord, dans Comptes** : le panneau « Virements entre tes comptes » passe en tête de l'onglet, avec chaque virement sur sa carte colorée (« Equity → M-Pesa », la date, les frais éventuels, le montant) et le total envoyé.
- **Noter un virement en un geste** : « + Virement » choisit le compte d'où part l'argent et celui qui le reçoit, le montant, ce qui arrive s'il y a des frais, la date au calendrier et une note. Les deux moitiés sont créées déjà liées : ce n'est ni une dépense ni un revenu, tes budgets ne bougent pas.
- **Bien visibles dans l'historique** : une opération de virement a un fond coloré, le signe ⇄ et « Compte A → Compte B » à la place du budget.
- **Sur l'Aperçu** : les virements de la période s'affichent dans leur propre carte.

### Finances : des chiffres qui disent la même chose partout, et des fenêtres plus sûres (app)
- **Un seul « budget du jour »** : ce qui reste du mois, réparti sur les jours restants (ou le montant fixé pour un budget par jour). Aperçu, Jour par jour, Analyses, Prévisions et accueil affichent maintenant le même chiffre. Dans Jour par jour, chaque jour passé est comparé à son propre budget.
- **Des mots clairs** : « Reste à dépenser » pour le budget, « Mis de côté » pour revenus moins dépenses, « dépassé de 18 € » au lieu de « +18 € ». L'historique parle de revenus et de dépenses au lieu d'entrées et de sorties, et l'accueil compte le mois entier comme l'écran Finances.
- **Le hors budget ne mange plus tes budgets** : sans budget total, la jauge compare les dépenses rangées dans un budget à la somme de tes budgets ; le hors budget est indiqué à part.
- **Postes** : depuis le formulaire du budget, le bouton du poste dit « Valider » et rappelle qu'il sera enregistré avec le budget. Fermer un budget modifié sans l'enregistrer demande de choisir : enregistrer, abandonner ou continuer.
- **Annuler une suppression** : après avoir supprimé une dépense, un revenu, un budget, un poste ou arrêté un paiement récurrent, une barre « Annuler » reste quelques secondes.
- **Toutes les dates au calendrier** : date d'une dépense ou d'un revenu, fin d'un budget, fin d'un paiement récurrent ; les raccourcis (Aujourd'hui, Hier, Fin du mois…) restent.
- **Formulaires plus lisibles** : « Nom du budget » au lieu de « Catégorie », et dans une dépense les catégories se choisissent avant le budget qu'elles proposent. Les conseils parlent de « libellé » au lieu de « poste », réservé aux plans de dépenses.
### Parler à l'app, comme à Siri (app)
- **Un micro sur l'accueil** (et « Parler à Me » dans la barre latérale sur ordinateur) : on parle, Me comprend, agit et répond à voix haute.
- **Ajouter à la voix** : « Ajoute une dépense de 12 € de courses », « Rappelle-moi d'appeler Paul demain », « Relancer Marie jeudi pour le contrat », « Crée une habitude méditer ». Le budget est reconnu dans la phrase. « Annule » (ou le bouton Annuler) défait le dernier ajout.
- **Demander** : « Combien il me reste en courses ? », « Où en est mon budget ce mois-ci ? », « Qu'est-ce que j'ai à faire aujourd'hui ? », « Qui dois-je relancer ? », « Lis-moi mon briefing ». Les autres questions vont à l'IA quand elle est active.
- **Agir** : « Ouvre les finances », « J'ai fini le devis » (coche la tâche qui ressemble), « Note dans mon journal que le client a signé ».
- **Avec Siri** : un raccourci « Ouvrir l'URL » `me://voix` lance l'écoute d'un « Dis Siri, parle à Me ».
- **Dicter dans l'ajout rapide** : un micro dans le champ « Dis-le en une phrase ».
- Demande un nouveau build de l'app (micro et reconnaissance vocale). Sans lui, ou dans un navigateur sans dictée, la même fenêtre permet de taper la demande.

### Postes des budgets : une fenêtre pour chaque poste, et des dates au calendrier (app)
- **Les postes se lisent d'un coup d'œil** : dans le budget, chaque poste tient sur une ligne avec son icône, son nom, ses dates et son montant, au lieu de cinq cases à remplir côte à côte.
- **Modifier dans une fenêtre** : un appui sur un poste (ou sur « + Poste ») ouvre sa fenêtre, avec le nom, une icône, le montant, les dates, et ce qu'il restera à répartir dans le budget. Enregistrer, Annuler ou Retirer, sans toucher au reste du budget.
- **Directement depuis la liste des budgets** : un appui sur un poste sous la jauge l'ouvre aussi, sans passer par tout le budget.
- **Les dates se choisissent au calendrier** : plus de « JJ/MM » à taper. Le champ affiche « mar. 3 nov. 2026 » et s'ouvre sur un calendrier du mois, au pouce ; la fin ne peut pas être avant le début, et « Effacer » remet le poste sur toute la durée du budget.

## 26 octobre 2026

### Équipes : un espace partagé à plusieurs (app + serveur)
- **Créer une équipe** (Plus › Équipes) et y **inviter par email**. L'invitation arrive avec un lien valable 7 jours, qui ne sert qu'une fois et s'ouvre avec le compte Me qui porte l'adresse invitée.
- **Un espace par équipe**, à côté du tien : ses budgets, ses projets, ses tâches et ses habitudes. Ton espace à toi n'est jamais mélangé avec celui d'une équipe.
- **Choisir ce qu'on regarde** : une pastille en haut de l'écran dit quel espace est affiché et permet d'en changer d'un geste. Changer d'espace garde la page où tu es.
- **Trois rôles** : propriétaire (tout, y compris inviter et retirer), membre (voit et modifie), lecteur (voit seulement). Un lecteur qui tente une modification est prévenu à l'écran au lieu de voir son clic ignoré. Une équipe garde toujours au moins un propriétaire.
- **À plusieurs sur la même chose** : deux membres qui écrivent en même temps ne s'écrasent pas, leurs changements sont fusionnés, exactement comme entre deux de tes appareils.
- **Responsable d'une tâche de projet** : dans l'espace d'une équipe, le nom se choisit d'un geste parmi les membres au lieu de se taper.
- **Quitter ou supprimer** : chacun peut quitter une équipe ; un propriétaire peut la supprimer, avec tout ce qu'elle partageait.

### Connexion et inscription redessinées, et le site se partage bien (app)
- **Connexion, inscription, mot de passe oublié** : un formulaire étroit, centré, avec un titre qui change selon l'étape (« Content de te revoir », « Crée ton compte », « Regarde tes emails »). Les boutons Google et email ne se marchent plus dessus et tout tient dans l'écran du téléphone, clavier ouvert.
- **Le mot de passe se voit** : un bouton « Voir / Masquer » dans le champ, et trois barres qui disent si le mot de passe choisi est trop court, moyen ou solide.
- **Les erreurs arrivent avant l'envoi** : une adresse email incomplète est signalée sous le champ, et le bouton reste éteint tant que le formulaire n'est pas remplissable. Les messages du serveur s'affichent dans un bandeau lisible, rouge pour une erreur, vert pour une confirmation.
- **Le lien du site a un aperçu** : partagé sur WhatsApp, LinkedIn, Facebook ou Slack, il montre une image, le titre « Me · ton assistant personnel » et une phrase de présentation, au lieu d'une adresse nue.
- **Me se trouve sur Google** : titre et description de la page, adresse canonique, fiche de l'application, plan du site (`sitemap.xml`) et `robots.txt`, plus une page lisible sans JavaScript qui dit ce que fait Me. Les trois pages publiques (à propos, confidentialité, conditions) ont les mêmes.
- **Installée depuis le navigateur**, l'app s'annonce mieux : description, captures d'écran et raccourcis vers Projets, Finances et Notifications dans le menu de l'icône.

### Postes datés, suivis dans le rapport et les analyses, et UX mobile (app)
- **Des dates sur les postes d'un budget** : chaque poste peut dire quand son argent est prévu (« Billets, du 06/10 au 24/10 »). Me affiche alors « pas encore commencé », « terminé », et signale ce qui n'a pas été dépensé une fois la date passée.
- **Plans de dépenses dans les analyses** (Finances › Analyses › Répartition) et **dans le rapport** (État des lieux) : pour chaque budget qui dit comment il sera dépensé, le prévu, le dépensé et l'état de chaque poste, ce qui n'est dans aucun poste et ce qui a été dépensé sans poste.
- **Conseils et bonnes pratiques** sur l'accueil et dans le rapport : un poste dépassé, un poste terminé dont il reste de l'argent, un poste qui commence dans la semaine, une partie du budget qui n'est destinée à rien, des postes qui dépassent le budget, des dépenses rangées dans aucun poste, et l'invitation à découper un gros budget en postes.
- Le **rapport copié en texte** contient la même chose, poste par poste.
- **Finances sur téléphone** : la durée affichée (jour, semaine, mois, trimestre, année) passe dans le titre de la période (« Octobre 2026 ▾ », qui ouvre une fenêtre) : une barre d'options en moins avant les chiffres. La barre de période reste collée en haut au défilement, comme les onglets.

### Formulaires en fenêtres, pages à la même largeur, mêmes filtres partout (app)
- **Les formulaires s'ouvrent dans une fenêtre** par-dessus la page : nouvelle dépense, budget (avec ses dépenses liées), revenu, compte bancaire, catégorie, tâche, relance, habitude, projet, détail d'une opération et édition d'une tâche de projet. La page ne saute plus quand on ouvre un formulaire, et celui-ci a toute la place : une feuille qui monte du bas sur téléphone, une fenêtre au centre sur ordinateur. Pour fermer : la croix, la zone sombre, Échap ou le retour d'Android.
- **Toutes les pages ont la largeur des Projets** sur grand écran : Finances, Tâches, Relances, Habitudes, Statistiques et les autres s'étendent comme le planning au lieu de s'arrêter au milieu de l'écran.
- **Les filtres sont les mêmes partout** : une barre segmentée jusqu'à quatre choix, des pastilles qui défilent au-delà, avec le nombre d'éléments de chaque choix. Nouvelle dans Tâches (Toutes, Pro, Perso, Autres), Relances (Toutes, À faire, Relancées, Répondues) et Habitudes (Toutes, Finances, Personnel) ; déjà là, mais au même format, dans un projet, dans les dépenses (par budget, par catégorie), dans les opérations (période, sens, budget, catégorie, virements, origine, tri) et dans les statistiques.
- Les barres de filtres restent elles aussi collées en haut de l'écran quand on fait défiler.

### Plan de dépenses d'un budget, options qui restent en haut (app)
- **Dire comment un budget sera dépensé** : dans un budget, ajoute des **postes** (« Billets 260 € », « Hôtel 200 € », « Repas 80 € »). Me affiche ce qui est réparti et ce qui reste libre, et prévient en rouge si la somme des postes dépasse le plafond.
- **Suivi par poste** : sous la jauge d'un budget, chaque poste montre son prévu, son dépensé et une petite jauge, plus « N dépensés sans poste ». Sur une période plus courte ou plus longue que le budget, les postes sont ramenés au prorata comme le plafond.
- **Ranger une dépense dans un poste** : à la saisie (après le choix du budget) et sous une opération de « Tout l'historique ». Changer le budget d'une dépense remet son poste à zéro.
- **Les options restent en haut quand on fait défiler** : les onglets et les filtres de Finances, d'un projet et de Mon compte collent au haut de l'écran au lieu de disparaître.

### Projets et Finances plus grands et plus lisibles, franc congolais (app + serveur)
- **Projets, la liste** : des cartes plus grandes (deux ou trois par ligne sur ordinateur) avec l'avancement, l'état (dans les temps, en retard, à planifier, terminé), la fin prévue (« dans 18 j ») et les trois prochaines tâches avec leurs dates. En haut, quatre chiffres : projets en cours, tâches à faire, tâches en retard, prochaine fin. Les projets en retard arrivent en premier, les terminés en dernier.
- **Un projet** : le nom passe dans le titre de la page, l'en-tête montre l'avancement en grand, l'état, la période et quatre tuiles (tâches faites, fin prévue, en retard, ce qui vient ensuite). Les trois parties (Tâches, Planning, Réglages) sont de vrais onglets, avec le nombre de tâches à faire.
- **Tâches** : lignes plus hautes et plus lisibles, champ « Ajouter une tâche » en haut, filtres Toutes / À faire / En retard / Critiques avec leurs compteurs, repères colorés (« En retard », « Voie critique », « Attend une tâche »). Sur ordinateur, la liste est à gauche et l'édition à droite, sans faire sauter la page ; à défaut, le volet montre « Prochaines étapes » à cocher.
- **L'éditeur d'une tâche** est rangé en sections repliées (Liens et ordre, Sous-tâches, Détails) : l'essentiel (titre, avancement, durée, responsable, date imposée) tient tout de suite à l'écran.
- **Planning (Gantt)** : lignes, barres et textes agrandis, le calendrier remplit toute la largeur et s'ouvre sur aujourd'hui, les noms des tâches gagnent leurs dates et leur responsable sur grand écran, chaque barre porte sa durée ou son avancement, et une légende explique les couleurs et les formes. Toucher une tâche ouvre son édition juste en dessous.
- **Finances, Aperçu** : les revenus de la période et ce qu'il en reste s'affichent sous le dépensé ; sur ordinateur, « Mes budgets » et « Dernières dépenses » se placent à droite au lieu de laisser la moitié de l'écran vide.
- **Finances, Budgets** : les prévisions et les budgets terminés passent à droite des budgets sur ordinateur.
- **Franc congolais** : à choisir comme devise du tableau de bord ou à la saisie, écrit « FC » (« 25 000 FC ») et reconnu dans une phrase ou un relevé sous « FC », « CDF » ou « francs congolais ». Les listes de devises montrent désormais leur nom. Le serveur écrit lui aussi « FC » dans les alertes de budget (il doit être redéployé).

### Résumé des finances et état des lieux sur l'accueil (app)
- **Mes finances**, sur l'accueil : le dépensé du mois, le reste et ce que tu peux encore dépenser par jour, la dépense du jour face au budget du jour, les revenus et le solde du mois, le solde de tes comptes (dernier relevé) et les budgets à surveiller.
- **État des lieux**, sur l'accueil : où en sont tes finances, tes tâches, tes relances, tes habitudes et ta régularité, avec les trois recommandations les plus urgentes (budget dépassé ou en danger, frais bancaires, tâches en retard, relances à faire, habitude qui décroche, budget qui se termine, revenus à noter…) et un lien pour agir.
- **Rapport complet** (« État des lieux » dans Plus, la barre latérale ou la recherche) : toutes les recommandations, le résumé des finances et les prévisions ; « Copier » le met en texte pour l'envoyer ou le garder.

### Dépenses liées au budget de ton choix, revenus liés à l'import, captures sur la page de présentation (app)
- **Lier une dépense au budget de ton choix**, partout : dans le formulaire de la dépense (tous les budgets en cours, ou « Selon la catégorie »), sous une opération de « Tout l'historique » (les opérations importées aussi), en lot (« Sélectionner », puis « Budget › » : tous tes budgets, plus seulement les quatre premiers), et **depuis un budget** : le toucher ouvre « Dépenses de … », avec « Lier » pour y ajouter des dépenses récentes et « Retirer ».
- En mode sélection, toucher n'importe où sur une ligne la coche (avant, seule la case réagissait sur le web).
- **Import d'un relevé : entrées liées aux revenus déjà notés**. Une entrée (le virement du salaire, par exemple) se lie au revenu que tu avais noté ou que le paiement récurrent a ajouté : Me le propose quand le montant et la date correspondent, et tu peux choisir un autre revenu ou « Nouveau revenu ». Le revenu garde son nom, prend le montant, la date et le compte de la banque, et n'est pas compté deux fois.
- **Page de présentation illustrée** : des captures récentes de l'app (avec des données d'exemple) montrent l'accueil, les budgets et un projet sur téléphone, puis Finances et le planning sur ordinateur.

### Budgets jusqu'à une date et pages en onglets (app + serveur)
- **Budgétiser jusqu'à une date** : en créant un budget, choisis « Durée : jusqu'à une date » (fin du mois, du mois prochain, de l'année, ou une date au format JJ/MM/AAAA). Le montant peut **revenir chaque période** jusque-là (« 400 € par mois jusqu'au 15 décembre ») ou **couvrir toute la durée** (« 600 € du 26/10 au 30/11 ») : Me affiche alors ce qui est dépensé, ce qui reste et combien tu peux dépenser par jour jusqu'à la fin.
- Sur la période affichée, un budget daté compte **au prorata des jours** où il est actif. Une fois sa date passée, il ne compte plus, n'est plus proposé pour une nouvelle dépense et passe dans « Budgets terminés », d'où on peut le prolonger ou le supprimer.
- **Paiements qui reviennent jusqu'à une date** : loyer, abonnement ou prêt peuvent s'arrêter à une date (« Jusqu'au (facultatif) »), à la création ou ensuite depuis Réglages › Récurrents (« Fin »).
- **Finances en onglets plus courts** : Aperçu, Budgets, Opérations (Dépenses, Revenus, Tout l'historique), Comptes, Analyses (Évolution, Répartition, Jours) et Réglages (Alertes, Récurrents, Devises). Chaque onglet n'affiche qu'une partie, la barre d'onglets défile sur téléphone.
- **Mon compte** est rangé de la même façon : Profil, Rappels, Préférences.
- Les alertes de prévision du serveur tiennent compte des dates des budgets (le serveur doit être redéployé).

### Catégories personnalisables, projets et plannings importés d'Excel (app + serveur)
- **Catégories à toi** (Plus › Catégories) : crée, renomme, recolore, ajoute des mots-clés et supprime. Huit catégories courantes (alimentation, restaurants, transport, logement, santé…) sont proposées en un geste. Un élément peut porter **une ou plusieurs catégories** : dépenses, revenus, paiements récurrents, budgets, tâches, relances, habitudes et projets. Les filtres, la recherche et le graphique « Dépenses par catégorie » d'Opérations s'appuient dessus. À l'import d'un relevé, les catégories sont proposées d'après le libellé et tes mots-clés.
- **Budgets et catégories** : un budget garde son plafond et peut **suivre des catégories**. Une dépense va dans le budget choisi à la main ; à défaut, dans le premier budget qui suit l'une de ses catégories ; sinon « hors budget ». Un budget daté (« jusqu'au 15 décembre ») ne suit ses catégories que pendant ses dates. Une dépense ne compte jamais dans deux budgets. Les prévisions et alertes du serveur appliquent la même règle.
- **Projets** (Plus › Projets, ou « Projets » dans la barre latérale) : un projet a un nom, un emoji, une couleur, une date de début, des jours ouvrés ou non, des catégories. Il rassemble des **tâches, des sous-tâches et des liens « à faire après »** (avec un délai d'attente possible), des jalons, des durées, un responsable, un avancement.
- **Planning calculé** : les dates se calculent depuis le début du projet, les durées et les liens ; une tâche faite ou dont tu as imposé la date ne bouge pas, les autres suivent. Une tâche qui a des sous-tâches devient un **résumé** (ses dates et son avancement viennent d'elles). L'écran Planning montre un **diagramme de Gantt** (jours, semaines ou mois) avec le chemin critique en rouge, les jalons, les flèches de liens et la ligne d'aujourd'hui ; il signale les liens non tenus et les boucles. Toucher une tâche l'édite.
- **Sous-tâches générables** : « ✨ Générer des sous-tâches » découpe une tâche en étapes à partir d'un modèle (préparer / réaliser / vérifier, cadrer / concevoir / tester, organiser un événement…) ou de tes propres lignes ; les étapes s'enchaînent ou se font en parallèle, et se partagent la durée de la tâche.
- **Importer un plan Excel** : un fichier **.xlsx** (ou .csv) avec une ligne par tâche. Me reconnaît les colonnes tout seul (tâche, durée, début, fin, prédécesseurs, responsable, priorité, état, avancement, catégories, note…) et te laisse les corriger ; les sous-tâches se lisent dans les retraits, la numérotation (1, 1.1, 1.2.3), une colonne « Niveau » ou « Parent » ; les prédécesseurs par numéro ou par nom (« 3FS+2j » compris). Tu choisis la feuille du classeur à lire. Tu vois le résultat (tâches, liens, durée, avertissements) **avant d'ajouter quoi que ce soit**. Réimporter une version mise à jour d'un projet (« Importer une nouvelle version » dans ses Réglages) **met à jour** ses tâches sans les dupliquer.
- **Le reste de l'app reste lisible** : les tâches d'un projet se suivent dans Projets et n'apparaissent plus dans la liste des tâches simples (un panneau « Projets » y mène). Elles n'entrent dans les rappels, la mission du jour, « Planifier ma journée », la commande vocale et l'assistant que si elles ne sont pas bloquées par une tâche précédente et proches de leur échéance (jamais par leur seule priorité) ; les résumés n'y sont jamais, ni dans les statistiques ni dans l'état des lieux. Le serveur applique la même règle à ses rappels et à son briefing.
- **Limites** : sur téléphone, l'app ne peut pas ouvrir de fichier (pas de sélecteur de fichiers) : on **colle les cellules copiées** depuis Excel ; l'ouverture du fichier .xlsx marche dans la version web / ordinateur. L'ancien format **.xls** n'est pas lu (enregistre en .xlsx). Les sous-tâches se génèrent à partir de modèles et de tes lignes, sans IA.

### Comptes bancaires, import CSV mis en avant, virements liés, squelettes de chargement (app + serveur)
- **Nouvel onglet « Comptes » dans Finances**, avec l'import de relevés CSV en tête (trois étapes) et un bouton « Importer un CSV » dans l'Aperçu. Chaque compte a un **nom clair** (« Equity – dollars », « M-Pesa », « Cash »), une banque, une devise et le **solde lu dans le relevé** (colonne « Solde »). Deux comptes ne peuvent pas porter le même nom.
- **Un relevé s'importe dans un compte** : on le choisit, ou on le nomme sur place. Les doublons ne se cherchent que dans ce compte (et parmi les opérations sans compte) : le même relevé importé dans un autre compte n'est pas pris pour un doublon. Les opérations d'avant les comptes se rattachent à un compte en un geste.
- **Lier les transactions** : un virement d'un compte à l'autre est une sortie dans l'un et une entrée dans l'autre. Me propose les paires probables (comptes différents, même montant à 2 % près, 3 jours d'écart) ; on les lie, on les écarte (« Ce n'est pas un virement ») ou on lie à la main en touchant une opération dans Opérations. Une fois liées, les deux moitiés **ne comptent ni comme dépense ni comme revenu** : budgets, prévisions, statistiques, graphiques, conseils, alertes du serveur et assistant les ignorent. On peut défaire le lien à tout moment.
- **Opérations** : filtre par compte, filtre « virements » (tous, sans, seulement), compte affiché sur chaque ligne, graphique « Sorties par compte », export CSV des dépenses avec le compte.
- **Squelettes de chargement** à la place des cercles qui tournent, un par cas : au démarrage selon l'écran qui s'ouvre (accueil, tâches, relances, habitudes, finances, statistiques, notifications), notifications, services connectés, liste des comptes d'administration, réponse de l'assistant, lecture d'un relevé CSV, et les trois vues d'Opérations (liste, graphiques, conseils) quand il y a beaucoup d'opérations. Ils pulsent doucement, et restent fixes si l'appareil demande de réduire les animations.

### Opérations : filtres complets, graphiques et conseils (app)
- **Filtres** : période (tout, 30 jours, 3 mois, 12 mois, une année ou un mois précis), sens, budget (ou « hors budget »), montant minimum et maximum, importées ou saisies à la main, recherche (« frais|tva » cherche l'un ou l'autre) et tri (récentes, anciennes, plus gros, plus petits montants). Les totaux, les graphiques et les conseils suivent les filtres. Le sélecteur de période du haut de l'écran n'apparaît plus dans cet onglet : la période se choisit avec les autres filtres.
- **Graphiques** : entrées et sorties par mois (touche un mois pour lire ses chiffres), évolution du solde depuis le début de la sélection, sorties par budget, libellés qui pèsent le plus et sorties par jour de la semaine. Toucher un budget ou un libellé ouvre la liste filtrée dessus.
- **Conseils calculés sur tes opérations** : déficit ou part des entrées gardée, frais et taxes bancaires, poids des retraits en espèces et leurs frais, sorties sans budget, plus gros poste, grosse sortie isolée, hausse ou baisse du dernier mois terminé, mois le plus cher, paiements qui reviennent chaque mois et qu'il vaut mieux ajouter en récurrents. Aucun conseil ne s'affiche sans assez d'opérations derrière, et chacun mène aux opérations concernées. Ce sont des repères tirés de tes chiffres, pas un avis financier.

### Données importées visibles, doublons évités, l'app s'appelle « Me » (app + serveur)
- **Nouvel onglet « Opérations »** dans Finances : toutes les entrées et sorties au même endroit, par jour, avec le total des entrées, des sorties et le solde. Filtres Toutes / Sorties / Entrées, recherche, et « Tout l'historique » ou « Période choisie ». Les données importées n'apparaissaient pas parce que l'écran affichait le mois en cours : après un import, l'app ouvre maintenant cet onglet sur tout l'historique.
- **Les références de transaction évitent les doublons.** À l'import, une opération est reconnue comme déjà importée grâce à sa référence (avec sa date, son sens, son montant et son libellé, car une même référence peut servir à plusieurs lignes). Réimporter le même relevé, ou un relevé qui chevauche le précédent, n'ajoute que les nouvelles opérations. Les imports faits avant ce changement n'ont pas de référence : ils restent reconnus par date et montant.
- **L'application s'appelle « Me »** (avec une majuscule) dans l'app, la page d'accueil, les notifications, les emails et les textes de l'assistant. Les identifiants techniques ne changent pas (dépôt `me-api`, schéma d'URL `me://`), donc rien à reconfigurer et aucune donnée perdue.

### Page d'accueil redessinée (app)
- **Une démo vivante** : une phrase se tape (« Relancer Paul jeudi pour le devis », « 20 usd resto hier »…) puis se range toute seule en relance, tâche, habitude ou dépense. Figée si l'appareil demande de réduire les animations.
- Titre en deux phrases, liste claire de ce que fait l'app (relances, modes de rappel, finances multi-devises, import bancaire, multi-appareils) au lieu de cartes identiques, appel à l'action en bas de page, lien « Se connecter » toujours visible. Mise en page à deux colonnes sur grand écran, une seule sur téléphone ; couleurs du thème choisi.

### Modes de rappel configurables (app + serveur)
- **Chaque mode de rappel se décrit et se règle** dans Configuration › Modes de rappel : description libre, heures du jour J (`matin`, `soir`, `HH:MM`, plusieurs possibles), jours à l'avance, rappel quotidien en retard, heure de ces rappels, message du soir qui regroupe les habitudes, bilan de la semaine (jour et heure).
- **Une phrase calculée** résume l'effet des réglages (« Envoie des rappels le jour J le matin (7 h) et le soir (19 h)… »), dans la configuration et dans la page Habitudes.
- **Rien ne change tant qu'on ne touche à rien** : les règles d'origine reproduisent exactement les cinq modes existants (vérifié sur 4 000 rappels, app et serveur identiques). Le serveur envoie les mêmes rappels que l'app (push et email).

### Import de l'historique bancaire (app)
- **Devise du relevé** : choisie à l'import, ou lue dans une colonne « Devise » / à côté du montant (« 12,50 $ », « 3 000 FCFA »). Chaque opération est convertie dans la devise du tableau de bord ; le montant d'origine reste visible. Les doublons sont repérés dans la devise du tableau de bord.
- **Sens des montants** : « Automatique » (signe ou colonnes Débit/Crédit), « Tout en sorties » ou « Tout en entrées ». Un fichier sans aucun montant négatif déclenche la question.
- **Libellés de banque nettoyés** (« Retrait ATM/430312561666/122549 » → « Retrait ATM », « APP/NOM/ » → « Nom ») et budgets suggérés pour les frais bancaires, la TVA, les retraits et les transferts mobiles.
- Après l'import : la période couverte est indiquée (« du 28/10/2024 au 11/02/2026 ») ; les opérations apparaissent dans les graphiques et statistiques de leur date. Vérifié sur un vrai relevé de 1 000 opérations : crédits et débits identiques à la ligne « Total » du fichier.

### Tableau de bord en dollars (app)
- **Réglages › Devises › « Tableau de bord en dollars ($) »** : convertit d'un coup les budgets, dépenses, revenus et paiements récurrents ; totaux, prévisions, graphiques et alertes du serveur sont alors en $. Marche aussi pour n'importe quelle autre devise du catalogue.
- **Taux de référence intégrés** pour les 18 devises (via le dollar), donc plus besoin de saisir un taux pour commencer. Ce sont des ordres de grandeur, pas des cours en direct : le taux est affiché, modifiable avant de convertir, et ton taux passe toujours avant.
- **Rien n'est perdu** : le montant d'avant reste affiché sous chaque ligne, et repasser dans la devise de départ redonne exactement les montants saisis à l'origine.

### Devises (app)
- **Toute la partie finances accepte une devise.** Une devise principale par espace (budgets, totaux, prévisions, alertes) et 18 devises au catalogue : €, $, FCFA, £, CHF, CAD, MAD, CDF, TND, DZD, NGN, GHS, ZAR, JPY, CNY, INR, BRL, AED. Les anciens espaces gardent leur devise telle quelle.
- **Dépenses, revenus et paiements récurrents peuvent être saisis dans une autre devise.** L'app demande le taux (« 1 $ = … € »), le retient pour la suite, convertit le montant dans la devise principale et garde le montant d'origine, affiché sous la ligne.
- **Réglages › Devises** : choix de la devise principale (les taux sont recalculés, les montants déjà notés ne sont pas convertis) et liste des taux retenus.
- **Saisie en une phrase** : « 20 usd resto » ou « 30 CAD taxi » reconnaissent la devise ; sans taux connu, l'app n'ajoute pas de montant faux et indique où renseigner le taux.
- **Export CSV** : deux colonnes en plus à la fin, « Montant d'origine » et « Devise d'origine ». Les colonnes existantes ne bougent pas.
- **Assistant** : reçoit la devise principale et les taux pour interpréter les montants.

### Page d'accueil (app)
- Les visiteurs non connectés arrivent sur une page de présentation (ce que fait l'app, comment ça marche), avec « Créer mon compte » et « J'ai déjà un compte ». Un lien reçu par email (confirmation, mot de passe oublié, Google) va directement à l'écran de connexion. Une déconnexion ramène à cette page.

### Largeurs harmonisées (app)
- Toutes les vues ont la même largeur de contenu (960 px) ; l'accueil n'est plus plus large que les autres. Les fenêtres (recherche, ajout rapide, actions groupées) font toutes 640 px, les bandeaux 520 px, la carte de célébration 360 px. Les valeurs sont définies une seule fois dans `src/lib/mise-en-page.ts`.

### Synchro entre appareils (app + serveur)
- **Plus d'écrasement entre appareils.** Le serveur numérote chaque version de l'espace (`revision`) et refuse (409) une écriture faite sur une version périmée ; l'app fusionne alors élément par élément (relances, tâches, dépenses, coches d'habitudes…) puis réessaie. Les anciennes versions de l'app continuent de fonctionner (la dernière écriture gagne pour elles).
- Au démarrage, l'app rapproche l'espace de l'appareil et celui du serveur au lieu de garder le plus récent.

### Serveur (me-api)
- Les tâches planifiées (rappels, synchronisation des sources) prennent un **verrou à bail en base** : plusieurs instances ou un redémarrage en plein passage n'envoient plus les notifications en double. `RUN_CRONS=false` désactive les tâches sur une instance.
- Migrations : colonne `Espace.revision` et table `VerrouCron` (à appliquer avec `prisma migrate deploy`).
- Script de **sauvegarde** de la base (`scripts/sauvegarde.sh`, rotation sur 14 sauvegardes), tests automatiques (`npm test`) et README mis à jour.

### Qualité
- App : 26 tests sur la fusion et 14 sur les devises, dont la conversion complète et l'aller-retour (`npm test`).

## 21 octobre 2026
- **Finances : vue Jour**, graphique jour par jour et budget journalier.

## Avant
- Recherche globale (Ctrl+K), version ordinateur, notifications dans l'app et par email, comptes et connexion Google, mission du jour et récompenses, finances (budgets, revenus, récurrents, prévisions et alertes), actions groupées, statistiques, assistant IA, thèmes. Voir le README pour le détail de chaque fonction.
