# Journal des changements

Ce fichier décrit ce qui change dans la plateforme **Me** : l'app (ce dépôt, `me-mobile`) et le serveur (`me-api`).
Les plus récents sont en haut. Chaque ligne dit ce que ça change pour l'utilisateur ; le détail technique est dans les commits.

## 27 octobre 2026

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
- **Catégories à toi** (Plus › Catégories) : crée, renomme, recolore, ajoute des mots-clés et supprime. Huit catégories courantes (alimentation, restaurants, transport, logement, santé…) sont proposées en un geste. Un élément peut porter **une ou plusieurs catégories** : dépenses, revenus, paiements récurrents, budgets, tâches, relances, habitudes et projets. Les filtres, la recherche et les graphiques de Finances (« Sorties par catégorie ») s'appuient dessus. À l'import d'un relevé, les catégories sont proposées d'après le libellé et tes mots-clés.
- **Budgets et catégories** : un budget garde son plafond et peut **suivre des catégories**. Une dépense va dans le budget choisi à la main ; à défaut, dans le premier budget qui suit l'une de ses catégories ; sinon « hors budget ». Les prévisions et alertes du serveur appliquent la même règle.
- **Projets** (Plus › Projets) : un projet a un nom, un emoji, une couleur, une date de début, des jours ouvrés ou non, des catégories. Il rassemble des **tâches, des sous-tâches et des liens « à faire après »** (avec un délai d'attente possible), des jalons, des durées, un responsable, un avancement.
- **Planning calculé** : les dates se calculent depuis le début du projet, les durées et les liens ; une tâche faite ou dont tu as imposé la date ne bouge pas, les autres suivent. Une tâche qui a des sous-tâches devient un **résumé** (ses dates et son avancement viennent d'elles). L'écran Planning montre un **diagramme de Gantt** (jours, semaines ou mois) avec le chemin critique en rouge, les jalons, les flèches de liens et la ligne d'aujourd'hui ; il signale les liens non tenus et les boucles. Toucher une tâche l'édite.
- **Sous-tâches générables** : « ✨ Générer des sous-tâches » découpe une tâche en étapes à partir d'un modèle (préparer / réaliser / vérifier, cadrer / concevoir / tester, organiser un événement…) ou de tes propres lignes ; les étapes s'enchaînent ou se font en parallèle, et se partagent la durée de la tâche.
- **Importer un plan Excel** : un fichier **.xlsx** (ou .csv) avec une ligne par tâche. Me reconnaît les colonnes tout seul (tâche, durée, début, fin, prédécesseurs, responsable, priorité, état, avancement, catégories, note…) et te laisse les corriger ; les sous-tâches se lisent dans les retraits, la numérotation (1, 1.1, 1.2.3), une colonne « Niveau » ou « Parent » ; les prédécesseurs par numéro ou par nom (« 3FS+2j » compris) . Tu choisis la feuille du classeur à lire. Tu vois le résultat (tâches, liens, durée, avertissements) **avant d'ajouter quoi que ce soit**. Réimporter une version mise à jour d'un projet **met à jour** ses tâches sans les dupliquer.
- **Le reste de l'app reste lisible** : les tâches d'un projet n'apparaissent dans « Mes tâches », les rappels, la mission du jour et les compteurs que si elles ne sont pas bloquées par une tâche précédente et proches de leur échéance ; les résumés n'y sont jamais. Le serveur applique la même règle à ses rappels et à son briefing.
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
