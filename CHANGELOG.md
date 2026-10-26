# Journal des changements

Ce fichier décrit ce qui change dans la plateforme **Me** : l'app (ce dépôt, `me-mobile`) et le serveur (`me-api`).
Les plus récents sont en haut. Chaque ligne dit ce que ça change pour l'utilisateur ; le détail technique est dans les commits.

## 26 octobre 2026

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
