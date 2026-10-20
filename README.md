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

## Comptes, admin et IA (Supabase)

Pour avoir plusieurs comptes, un admin, la synchro entre appareils et l'IA :

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécute `supabase/migrations/0001_me.sql`. Il crée les tables, les règles d'accès et le premier compte inscrit devient **admin**.
3. Crée un fichier `.env` à la racine (copie de `.env.example`) avec l'URL et la clé `anon` du projet (Project Settings → API).
4. Déploie la fonction IA :

   ```bash
   npx supabase login
   npx supabase link --project-ref <ton-projet>
   npx supabase secrets set ANTHROPIC_API_KEY=<ta-clé-claude>
   npx supabase functions deploy assistant
   ```

5. Relance `npx expo start`. L'app affiche alors l'écran de connexion.

Règles d'accès :

- chaque compte a son **espace privé** (relances, tâches, habitudes…), que personne d'autre ne lit, l'admin compris ;
- la **configuration système** est lisible par tous les comptes et modifiable par les admins seulement ;
- pour nommer un autre admin : `update profiles set role = 'admin' where id = '<id du compte>';`

## Agendas et outils

L'écran **Agendas & outils** enregistre, pour chaque compte, les sources à rassembler (Google Agenda, Gmail, Outlook, Trello, Slack, Notion, Asana, Todoist ou autre), ce qu'on importe, le contexte perso/pro, une couleur et des filtres. Les événements importés s'affichent ensemble dans Aujourd'hui avec la couleur de leur source.

La récupération des données depuis ces services n'est pas encore branchée : elle demande de connecter chaque compte (OAuth) côté serveur. C'est la prochaine étape.

## Développement

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
```

Organisation :

- `src/app/` : écrans (Expo Router), onglets dans `src/app/(tabs)/`
- `src/lib/` : données (`store.tsx`), rappels (`reminders.ts`), assistant et IA (`assistant.ts`), dates, thème
- `src/components/` : interface (`ui.tsx`), éléments de liste, formulaires, connexion
- `supabase/` : schéma SQL et fonction Edge `assistant`
