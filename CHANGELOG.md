# Journal des changements

Ce fichier décrit ce qui change dans la plateforme **Me** : l'app (ce dépôt, `me-mobile`) et le serveur (`me-api`).
Les plus récents sont en haut. Chaque ligne dit ce que ça change pour l'utilisateur ; le détail technique est dans les commits.

## 26 octobre 2026

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
