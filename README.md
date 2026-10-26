# me

L'application mobile de « me », ton assistant personnel : agenda du jour, relances, tâches en attente de tes boîtes perso et pro, habitudes financières et personnelles, rappels selon le mode choisi, assistant audio avec la voix de ton choix et copilote IA.

Construite avec Expo (SDK 58), Expo Router et TypeScript.

## Lancer l'app sur ton téléphone

1. Installe **Expo Go** sur ton téléphone (App Store ou Play Store).
2. Sur ton ordinateur :

   ```bash
   git clone https://github.com/jeereq/me-mobile.git
   cd me-mobile
   npm install
   npx expo start
   ```

3. Scanne le QR code affiché avec l'appareil photo (iPhone) ou avec Expo Go (Android).

Sans autre réglage, l'app tourne en **mode local** : tout reste sur le téléphone, avec un seul compte (admin). Les habitudes proposées sont créées au premier lancement.

> Les notifications locales marchent dans Expo Go. Si ton téléphone les bloque, une version de développement (`npx expo run:android` ou `npx eas-cli build --profile development`) règle le problème.

## Installer me sur iPhone sans App Store (app web)

1. Sur [vercel.com](https://vercel.com) : **Add New > Project**, importe ce dépôt. `vercel.json` règle le build (`npx expo export -p web`, dossier `dist`).
2. Avant de déployer, dans **Environment Variables**, ajoute `EXPO_PUBLIC_API_URL` = l'adresse de ton serveur me-api (ex. `https://me-api-ua1p.onrender.com`).
3. Dans me-api, ajoute l'adresse du site Vercel à `CORS_ORIGINS` (ex. `https://me-mobile.vercel.app`), puis redéploie.
4. Sur l'iPhone, ouvre l'adresse du site dans **Safari** > Partager > **Sur l'écran d'accueil**. me s'ouvre ensuite en plein écran, avec son icône.

(`render.yaml` permet aussi de déployer sur Render : New > Blueprint.)

Limites de la version web : pas de notifications système sur le téléphone ; les rappels arrivent dans le centre de notifications de l'app et par email (voir plus bas). La voix dépend de celles de Safari.

## Version ordinateur

Le même site sert de version desktop : sur un écran large (900 px et plus), une barre latérale remplace les onglets et le contenu reste centré.

- La barre reste visible sur tous les écrans. Elle donne accès direct aux onglets (avec leurs compteurs) et à tous les outils de Plus (Finances, Statistiques, Notifications…), et le compte se trouve en bas.
- Elle se replie en une colonne d'icônes avec son bouton en haut, ou **Ctrl+B** (⌘+B sur Mac). Au survol, chaque icône affiche son nom. Le choix est gardé sur l'appareil.
- **Recherche globale** : **Ctrl+K** (⌘+K), le champ « Rechercher » de la barre, ou la loupe de l'accueil sur téléphone. Elle trouve une page, une tâche, une relance, une habitude, une dépense, un contact ou une note du journal (sans tenir compte des accents), se pilote aux flèches et à Entrée, et « Ajouter « … » » crée directement ce qui est tapé (« 12 € courses », « Relancer Paul jeudi »).

- **Chrome ou Edge (Windows, Mac, Linux)** : ouvre l'adresse du site, puis l'icône **Installer** dans la barre d'adresse (ou menu ⋮ > *Caster, enregistrer et partager* > *Installer la page en tant qu'application*). me s'ouvre ensuite dans sa propre fenêtre, avec une icône dans le Dock ou le menu Démarrer.
- **Safari sur Mac** : Fichier > **Ajouter au Dock**.

## Notifications dans l'app et par email

Avec un compte (serveur me-api), le serveur calcule tes rappels toutes les 5 minutes selon le mode de chaque élément et ton fuseau horaire :

- dans l'app : la cloche sur **Aujourd'hui** (ou Plus > Notifications) montre les rappels, avec un badge pour les non lus ;
- par email : un récapitulatif envoyé avec SendGrid à l'adresse du compte, quand la clé SendGrid est configurée sur le serveur et que l'admin laisse le canal Email actif dans Configuration.

- en push : la notification s'affiche sur l'appareil même quand me est fermée. À activer par appareil dans **Compte > Notifications > Sur cet appareil**. Il faut les clés VAPID sur le serveur ; sur iPhone, l'app web doit être ajoutée à l'écran d'accueil (iOS 16.4 ou plus) et ouverte depuis son icône.

Pendant que l'app est ouverte, un rappel qui arrive s'affiche en bandeau avec un son.

Chacun choisit ses canaux dans **Compte > Notifications**, où « Envoyer un essai » vérifie que tout fonctionne. Les sons (case cochée, toutes les habitudes faites, rappel reçu) se coupent dans **Compte > Sons**.

## Ce que fait l'app

| Écran | Contenu |
| --- | --- |
| Aujourd'hui | Anneau de progression, chiffres clés, briefing audio, copilote IA, agenda, habitudes, relances dues, tâches urgentes, journal du jour |
| Relances | Qui relancer, à quel sujet, depuis quelle boîte, quand, avec quel mode ; brouillon de mail rédigé par l'IA (✎) |
| Tâches | Tâches perso et pro, priorité, échéance, filtre perso/pro |
| Habitudes | Finances et vie perso, fréquence, jour, mode de rappel, série tenue |
| Plus | Journal et contacts, agendas et outils, assistant audio, configuration, compte |

### Modes de rappel (notifications sur le téléphone)

- **Passif** : aucune notification, visible seulement dans l'app et le briefing.
- **Normal** : une notification le jour J à 9 h.
- **Agressif** : à J-3 et J-1, le matin et le soir du jour J, puis chaque jour tant que ce n'est pas coché.
- **Coach** : un message le soir avec les habitudes du jour.
- **Bilan hebdo** : un récap le dimanche soir.

Les rappels des trois prochaines semaines sont reprogrammés à chaque ouverture de l'app et à chaque modification. Le briefing du matin arrive chaque jour à l'heure choisie en configuration.

## Comptes, admin et IA (serveur me-api)

Les comptes, l'admin, la synchro entre appareils et l'IA passent par ton propre serveur, [me-api](https://github.com/jeereq/me-api).

1. Installe et lance me-api (son README explique comment, en local ou hébergé).
2. Crée un fichier `.env` à la racine de me-mobile (copie de `.env.example`) avec l'adresse du serveur :

   ```bash
   EXPO_PUBLIC_API_URL=https://ton-serveur.exemple.com
   ```

   Sur un téléphone, `localhost` désigne le téléphone lui-même : en local, mets l'adresse IP de ton ordinateur (par exemple `http://192.168.1.20:4000`).
3. Relance `npx expo start`. L'app affiche alors l'écran de connexion. Le compte admin principal est celui de `ADMIN_EMAIL` et `ADMIN_PASSWORD` dans me-api ; sans ces variables, le **premier compte créé devient admin**.

Règles d'accès, appliquées par le serveur :

- chaque compte a son **espace privé** (relances, tâches, habitudes…), que personne d'autre ne lit, l'admin compris ;
- la **configuration système** est lisible par tous les comptes et modifiable par les admins seulement ;
- l'admin voit la liste des comptes ; pour nommer un autre admin : `npm run promote:admin -- email@exemple.com` dans me-api ;
- la clé OpenAI reste sur le serveur, l'app ne la voit jamais.

La session est gardée dans le trousseau sécurisé du téléphone. Sans réseau, l'app affiche les données en cache, une pastille « Hors ligne » le signale, et les changements repartent seuls au retour du réseau (nouvel essai toutes les 30 s, ou « Réessayer »). Si un autre appareil a écrit entre-temps, les deux versions sont **fusionnées** élément par élément (rien n'est écrasé) : chaque appareil garde les ajouts de l'autre, une suppression n'est appliquée que si l'autre n'a pas modifié l'élément, et sur un même champ modifié des deux côtés, l'appareil qui synchronise l'emporte. La logique est dans `src/lib/fusion.ts`.

### Connexion avec Google, confirmation de l'email, mot de passe oublié

L'écran de connexion propose ce que le serveur sait faire (voir le README de me-api) :

- **Continuer avec Google** : sur le web, la page part chez Google et revient connectée ; dans l'app installée, une fenêtre Google s'ouvre puis se referme.
- **Confirmation de l'email** : après l'inscription, l'app demande d'ouvrir le lien reçu (bouton « Renvoyer le lien »). Le lien ouvre l'app web sur `/verifier` et connecte directement.
- **Mot de passe oublié** : le lien reçu ouvre l'app web sur `/reinitialiser` pour choisir un nouveau mot de passe ; les autres appareils sont déconnectés.
- **Mon compte › Connexion et sécurité** : changer (ou choisir, pour un compte Google) son mot de passe, **déconnecter ses autres appareils** (téléphone perdu, ordinateur partagé), et supprimer son compte avec toutes ses données.
- **Mon compte › Mes données** : « Tout exporter (JSON) » télécharge tout ce que le serveur garde pour le compte (espace, comptes connectés sans leurs clés, notifications) ; en mode local, tout ce qui est sur l'appareil. « Dépenses (CSV) » s'ouvre dans Excel ou LibreOffice.

### Pages légales

`public/a-propos.html`, `public/confidentialite.html` et `public/conditions.html` sont publiées avec l'app web, sans connexion : `https://ton-site/a-propos`, `/confidentialite`, `/conditions`. Ce sont les adresses à donner à l'écran de consentement OAuth de Google (page d'accueil, règles de confidentialité, conditions d'utilisation). L'adresse de contact (jeereq.minganda@itmafrica.com) figure dans les trois fichiers.

Dans l'app installée (hors web), les liens « Confidentialité · Conditions » s'affichent si `EXPO_PUBLIC_SITE_URL` donne l'adresse du site web.

## Mission du jour et récompenses

Au premier lancement, une carte **Premiers pas** guide les réglages utiles (ajouter une tâche, cocher une habitude, fixer un budget et, avec un compte, connecter son agenda et activer les notifications). Chaque étape se coche d'elle-même ; la carte disparaît une fois tout fait, ou avec « Masquer ».

L'accueil tient en une liste : la **mission du jour** réunit les habitudes prévues, les relances arrivées à échéance et les tâches urgentes. On touche une ligne pour la cocher ; le bouton **+** ajoute une tâche, une relance ou une habitude **en une phrase** : « Relancer Paul jeudi pour le devis », « Envoyer la facture demain urgent », « Sport tous les jours », « Payer le loyer le 1 de chaque mois ». L'app repère le genre, la date (demain, jeudi, dans 3 jours, le 15 novembre, 25/10, fin du mois…), la fréquence et l'importance, et montre ce qu'elle a compris avant d'ajouter. « Remplir le détail » ouvre le formulaire, prérempli.

Avec un compte, le briefing du matin annonce la mission et les points à gagner, et le soir un coup de pouce arrive si la série est en danger (réglage « Mission et série » dans Mon compte). Une fine barre en haut de l'écran montre les chargements en cours.

Chaque action rapporte des points : habitude +10, relance aboutie +15, tâche +15 (+20 si importante, +5 si finie avant l'échéance), note de journal +5 (3 fois par jour), journée parfaite +50. Les points font monter de niveau, les jours actifs d'affilée forment une **série** (un joker tous les 7 jours la protège d'un jour manqué) et 14 badges marquent les étapes. Décocher retire les points. Tout est visible dans **Plus > Récompenses**.

## Finances, actions groupées et statistiques

- **Plus › Finances** : des budgets par catégorie (ou un budget total) pour une semaine, un mois, un trimestre ou une année. On regarde n'importe quelle période (‹ ›) : un budget d'une autre périodicité y est ramené au prorata (50 € par semaine ≈ 217 € par mois). L'écran montre le dépensé, le reste, ce qu'on peut encore dépenser par jour, la projection en fin de période et l'écart avec la période précédente. Une alerte s'affiche quand une dépense fait passer un budget à 80 % ou au-delà. Une dépense s'ajoute aussi en une phrase depuis le bouton + : « 12 € courses », « Dépensé 30 euros resto hier ».
  - L'écran a quatre onglets : **Aperçu** (bilan, revenus et solde, prévisions, budgets), **Dépenses**, **Stats** et **Réglages** (alertes, paiements récurrents, devise).
  - **Jour par jour** : la vue **Jour** (‹ › passe d'un jour à l'autre) montre les dépenses, le budget et les stats d'une journée. Sur la semaine ou le mois, le graphique « Jour par jour » met chaque journée face au budget du jour (ligne pointillée, barres en rouge au-dessus), compte les jours au-dessus et sans dépense, et « Voir les dépenses de… » ouvre le jour choisi.
  - **Budget journalier** : un budget peut être fixé **par jour**, pour toutes les dépenses (« 💰 Budget total · … par jour », proposé d'après la moyenne des 30 derniers jours) ou pour une catégorie (« Café · 5 € par jour »). Il est ramené au prorata sur la semaine, le mois ou l'année, le budget du jour vaut ce montant chaque jour (sans report) et les alertes du serveur préviennent quand il est atteint ou dépassé. Sans budget par jour, le budget du jour reste ce qui reste du mois réparti sur les jours restants.
  - **Revenus et solde** : « + Revenu » note un salaire ou une autre rentrée ; l'aperçu montre revenus, dépenses et solde de la période, et la part mise de côté.
  - **Paiements récurrents** : en ajoutant une dépense ou un revenu, « Chaque semaine / mois / année » le répète (loyer, abonnements, salaire). Chaque échéance passée est notée à l'ouverture de l'app, sans doublon même avec plusieurs appareils ; un 31 tombe le dernier jour des mois plus courts. Réglages › Paiements récurrents montre la prochaine échéance et permet d'arrêter.
  - **Importer un relevé bancaire (CSV)**, dans Dépenses : choisir le fichier exporté depuis la banque (ou coller son contenu). Le séparateur, l'en-tête (ou son absence), les colonnes Montant ou Débit/Crédit, les formats « 1 234,56 » / « -12.50 » et l'encodage Windows des banques françaises sont reconnus. Les libellés sont nettoyés (« CB CARREFOUR 12/10 » → « Carrefour »), un budget est suggéré d'après les dépenses passées et des mots-clés, et les opérations déjà notées (même date, même montant) sont décochées. Tu choisis la devise du relevé (ou elle est lue dans une colonne « Devise » ou à côté du montant : $, USD, CDF, FCFA…) : chaque opération est convertie dans la devise du tableau de bord, le montant d'origine restant visible. Un fichier qui ne contient que des montants positifs (des sorties) se règle avec « Tout en sorties ». Les références collées aux libellés des banques (« Retrait ATM/4303…/1225 ») sont retirées. Rien n'est ajouté avant « Importer », et les opérations importées entrent dans les graphiques et statistiques de leur date (jusqu'à 5 ans en arrière avec « Année »).
  - **Dépenses** : la liste est groupée par jour avec le total de chaque jour, et se filtre par budget ou par recherche (note, budget, montant). Toucher une dépense permet d'en changer le montant, le budget, la note ou la date (aujourd'hui, hier, avant-hier, ou n'importe quelle date au format JJ/MM), ou de la supprimer.
  - **Stats**, pour la période affichée : total et écart avec la période d'avant, moyenne par jour, nombre de dépenses et panier moyen, plus grosse dépense, jours sans dépense. On y trouve aussi l'évolution sur les 12 dernières périodes (avec la moyenne et le nombre de fois où le budget a été tenu), la part de chaque budget avec son évolution, les dépenses par jour de la semaine et les notes qui reviennent le plus.
- **Devises** : une devise principale par espace (18 au catalogue) ; une dépense, un revenu ou un paiement récurrent peut être saisi dans une autre devise, converti avec un taux que tu donnes (retenu pour la suite). Le montant d'origine reste visible et part dans l'export CSV. Réglages dans Finances › Devises : « Tableau de bord en dollars » (ou toute autre devise) convertit tous les montants avec des taux de référence modifiables, sans rien perdre (le montant d'avant reste visible).
- **Actions groupées** : « Sélectionner » (ou un appui long sur une ligne) dans Tâches, Relances, Habitudes et Dépenses, puis terminer, reporter, changer la priorité ou le mode, ranger dans un budget ou supprimer (avec confirmation) d'un coup.
- **Prévisions et alertes** : dans Finances, chaque horizon (jour, semaine, mois, trimestre, année) montre la dépense prévue au rythme actuel face au budget. Avec un compte, le serveur envoie le budget du jour dans le briefing du matin et une alerte quand une prévision menace un budget puis quand il est dépassé (une fois par période). Horizons, seuil (80 %, 90 % ou au dépassement), heure, push et email se règlent dans « Alertes de budget ».
- **Assistant** : les questions à l'IA et « Planifier ma journée » reçoivent aussi les chiffres des finances (mois en cours, revenus et solde, moyenne des mois passés, budgets tenus, part de chaque budget, postes principaux, paiements récurrents).
- **Plus › Statistiques** : sur 7, 30 ou 90 jours, tâches terminées, relances abouties, habitudes tenues, jours actifs, points et dépenses, chacun comparé à la période d'avant ; points et tâches par semaine, tenue de chaque habitude, taux et délai de réponse des relances, dépenses par mois et par budget, jour et moment où tu es le plus actif.

## Couleurs et thèmes

Cinq thèmes de base : **Jarvis** (cyan, par défaut), **Mark** (or et rouge), **Matrice** (vert), **Nébuleuse** (violet) et **Clair**, chacun avec sa couleur d'accent ou l'une des 7 proposées. L'admin choisit le thème de tous les comptes dans Configuration ; chacun peut prendre le sien dans Mon compte. Le changement s'applique tout de suite.

## Agendas et outils

L'écran **Agendas & outils** connecte tes comptes Google (Agenda et Gmail), Microsoft (Outlook et To Do), Trello et Slack, autant que tu veux, chacun marqué perso ou pro. La connexion ouvre la page du service, puis revient dans l'app. Le serveur relit ensuite les comptes toutes les 15 minutes, et l'app récupère les nouveautés à l'ouverture et toutes les 10 minutes.

- Les rendez-vous arrivent dans **Aujourd'hui**, à la couleur de leur source.
- Les mails suivis, drapeaux, tâches To Do, cartes Trello et mentions Slack arrivent dans **Tâches**.
- Les mails et questions restés sans réponse arrivent dans **Relances**, avec le mode de rappel par défaut.
- ↗ ouvre l'original. Ce que tu supprimes dans me ne revient pas ; ce qui disparaît de la source (réponse reçue, étoile retirée) part tout seul s'il n'était pas traité.

Chaque service doit d'abord être configuré sur le serveur (voir le README de me-api). Notion, Asana et Todoist restent des réglages pour l'instant.

Les changements de la plateforme sont décrits dans [CHANGELOG.md](CHANGELOG.md).

## Développement

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # tests de la fusion entre appareils et des devises (Node, sans l'app)
```

Organisation :

- `src/app/` : écrans (Expo Router), onglets dans `src/app/(tabs)/`
- `src/lib/` : données (`store.tsx`), appels au serveur (`api.ts`), fusion des éléments importés (`sync.ts`), rappels (`reminders.ts`), assistant et IA (`assistant.ts`), dates, thème
- `src/components/` : interface (`ui.tsx`), éléments de liste, formulaires, connexion
