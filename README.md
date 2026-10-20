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

Le même site sert de version desktop : sur un écran large (900 px et plus), les onglets passent dans une barre latérale et le contenu reste centré.

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

La session est gardée dans le trousseau sécurisé du téléphone. Sans réseau, l'app affiche les données en cache et les renvoie au serveur à la modification suivante.

## Mission du jour et récompenses

L'accueil tient en une liste : la **mission du jour** réunit les habitudes prévues, les relances arrivées à échéance et les tâches urgentes. On touche une ligne pour la cocher ; le bouton **+** ajoute une tâche, une relance ou une habitude **en une phrase** : « Relancer Paul jeudi pour le devis », « Envoyer la facture demain urgent », « Sport tous les jours », « Payer le loyer le 1 de chaque mois ». L'app repère le genre, la date (demain, jeudi, dans 3 jours, le 15 novembre, 25/10, fin du mois…), la fréquence et l'importance, et montre ce qu'elle a compris avant d'ajouter. « Remplir le détail » ouvre le formulaire, prérempli.

Avec un compte, le briefing du matin annonce la mission et les points à gagner, et le soir un coup de pouce arrive si la série est en danger (réglage « Mission et série » dans Mon compte). Une fine barre en haut de l'écran montre les chargements en cours.

Chaque action rapporte des points : habitude +10, relance aboutie +15, tâche +15 (+20 si importante, +5 si finie avant l'échéance), note de journal +5 (3 fois par jour), journée parfaite +50. Les points font monter de niveau, les jours actifs d'affilée forment une **série** (un joker tous les 7 jours la protège d'un jour manqué) et 14 badges marquent les étapes. Décocher retire les points. Tout est visible dans **Plus > Récompenses**.

## Couleurs et thèmes

Cinq thèmes de base : **Jarvis** (cyan, par défaut), **Mark** (or et rouge), **Matrice** (vert), **Nébuleuse** (violet) et **Clair**, chacun avec sa couleur d'accent ou l'une des 7 proposées. L'admin choisit le thème de tous les comptes dans Configuration ; chacun peut prendre le sien dans Mon compte. Le changement s'applique tout de suite.

## Agendas et outils

L'écran **Agendas & outils** connecte tes comptes Google (Agenda et Gmail), Microsoft (Outlook et To Do), Trello et Slack, autant que tu veux, chacun marqué perso ou pro. La connexion ouvre la page du service, puis revient dans l'app. Le serveur relit ensuite les comptes toutes les 15 minutes, et l'app récupère les nouveautés à l'ouverture et toutes les 10 minutes.

- Les rendez-vous arrivent dans **Aujourd'hui**, à la couleur de leur source.
- Les mails suivis, drapeaux, tâches To Do, cartes Trello et mentions Slack arrivent dans **Tâches**.
- Les mails et questions restés sans réponse arrivent dans **Relances**, avec le mode de rappel par défaut.
- ↗ ouvre l'original. Ce que tu supprimes dans me ne revient pas ; ce qui disparaît de la source (réponse reçue, étoile retirée) part tout seul s'il n'était pas traité.

Chaque service doit d'abord être configuré sur le serveur (voir le README de me-api). Notion, Asana et Todoist restent des réglages pour l'instant.

## Développement

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
```

Organisation :

- `src/app/` : écrans (Expo Router), onglets dans `src/app/(tabs)/`
- `src/lib/` : données (`store.tsx`), appels au serveur (`api.ts`), fusion des éléments importés (`sync.ts`), rappels (`reminders.ts`), assistant et IA (`assistant.ts`), dates, thème
- `src/components/` : interface (`ui.tsx`), éléments de liste, formulaires, connexion
