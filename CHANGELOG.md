# Journal des changements

Ce fichier décrit ce qui change dans la plateforme **me** : l'app (ce dépôt, `me-mobile`) et le serveur (`me-api`).
Les plus récents sont en haut. Chaque ligne dit ce que ça change pour l'utilisateur ; le détail technique est dans les commits.

## 26 octobre 2026

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
- App : 26 tests sur la fusion et 9 sur les devises (`npm test`).

## 21 octobre 2026
- **Finances : vue Jour**, graphique jour par jour et budget journalier.

## Avant
- Recherche globale (Ctrl+K), version ordinateur, notifications dans l'app et par email, comptes et connexion Google, mission du jour et récompenses, finances (budgets, revenus, récurrents, prévisions et alertes), actions groupées, statistiques, assistant IA, thèmes. Voir le README pour le détail de chaque fonction.
