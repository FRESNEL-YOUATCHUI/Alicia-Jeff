# Alicia & Jeff — Invitation sur une seule page (version locale)

Cette version est entièrement locale. Elle n’a pas été publiée et n’utilise pas le site hébergé de la version précédente.

## Démarrer

Node.js 22 ou une version supérieure est nécessaire.

```powershell
npm ci
npm run dev
```

Ouvrir l’adresse locale affichée : `http://127.0.0.1:5173/`.
Le lancement démarre à la fois la page et le petit serveur des souvenirs sur le port 8787. Il ne publie rien sur Internet. Pour arrêter : `Ctrl+C`.

## Le parcours

- Une seule page, sans pages de connexion invité, liste d’invités préalable ni recherche par téléphone.
- Enveloppe ivoire à fleurs gaufrées, avec un sceau bordeaux gravé A & J, inspirée de la capture fournie. Le clic ouvre les deux pans, lance une envolée de fleurs, roses et cœurs et démarre `music.mp4`.
- Musique en boucle, indépendante du défilement. Les boutons de lecture/pause et de son restent disponibles. Certains navigateurs exigent un nouveau clic sur la note si leur politique bloque la première lecture.
- Lecture automatique lente : environ 20 pixels/seconde sur téléphone et 26 sur ordinateur. Une action (toucher, glisser, molette, clavier ou navigation) la suspend. Elle reprend après **7 secondes sans action**. Pendant la saisie d’un formulaire, ou l’ouverture d’une photo en plein écran, la page reste immobile. Le bouton pause permet aussi de garder une lecture entièrement manuelle.
- Les flèches vont au début ou à la fin sans couper la musique. Revoir l’enveloppe conserve également la musique.
- Compte à rebours visible dès l’accueil, et grande version après le message d’invitation. Date : 18 décembre 2026 à 15 h, heure de Dakar (GMT).
- Portrait de Jeff agrandi, cadré de la tête au haut des cuisses sur un décor floral ivoire, blanc et saumon, sans fond noir. Sa tête reste entièrement visible. Le décor a été adapté à partir de sa photo avec l’outil de génération d’images.
- Aucun aperçu de la carte d’invitation ni bouton de téléchargement avant confirmation. Après confirmation, le visiteur peut télécharger sa carte complète en PNG ou PDF A4 paysage. Le faire-part est conservé dans son intégralité ; nom, nombre de personnes et référence figurent dans un bandeau séparé.
- La confirmation apparaît uniquement dans la section « Et si vous faisiez partie de ce beau chapitre ? ». Aucun bouton de confirmation ne figure dans le menu ou l’accueil.
- Les couleurs du mariage affichées sont le saumon et le blanc.
- Confirmation ouverte à chaque visiteur, sans compte : nom, prénom, nombre de personnes, chanson et petit mot facultatifs. Un identifiant aléatoire conservé sur l’appareil permet de modifier la confirmation sans créer un nouveau dossier. Un autre appareil possède son propre identifiant.
- Le QR code contient uniquement une référence d’invitation. Cette version n’inclut pas de contrôle d’entrée ni de liste d’autorisations.

## Souvenirs

Le bouton **Ouvrir nos souvenirs**, en fin de page, affiche deux volets dans la même page :

1. **Souvenirs · Messages** : livre d’or partagé entre les visiteurs. Un petit mot laissé pendant la confirmation y apparaît, tout comme les messages déposés directement dans le livre d’or. Le prénom et le message sont publics ; le formulaire l’indique.
2. **Souvenirs · Images** : albums importés par le photographe. Ils s’ouvrent au public après la cérémonie, dès autorisation de la galerie et publication des albums par le photographe. Le serveur empêche leur ouverture publique avant le **18 décembre 2026 à 15 h GMT**. Le photographe peut préparer et prévisualiser ses albums avant cette date.

Les photographies se consultent dans une grille avec chargement progressif, puis en grand format sur la même page. Les flèches du clavier naviguent entre les images, Échap ferme l’aperçu. Un téléchargement individuel est disponible.

## Accès photographe

Au premier lancement, un mot de passe aléatoire est créé dans **`.env.wedding.local`**, ligne `WEDDING_ADMIN_PASSWORD`. Ce fichier est privé, ignoré par Git et exclu de l’archive livrée. Il est créé à nouveau lors du premier lancement du projet décompressé.

En bas du site : **Souvenirs → Images → Espace photographe**. Saisir le mot de passe indiqué dans le fichier local. Tout reste dans la même page.

Le photographe peut créer et renommer les albums, importer plusieurs JPEG/PNG/WebP (20 Mo maximum par image), publier/dépublier/archiver les albums, masquer/restaurer les images et modérer les messages du livre d’or. La connexion est protégée côté serveur par un cookie signé, HttpOnly et SameSite.

## Données et sauvegardes

Aucune base Supabase n’est nécessaire pour cette version. Les anciennes migrations du prototype ne font pas partie de son activation.

Le serveur enregistre les réponses et messages dans **`.wedding-data/souvenirs.json`** et les originaux photographiques dans **`.wedding-data/photos/`**. Il n’existe aucune liste d’invités à préparer ou importer. Les données sont partagées par les navigateurs connectés au même serveur et restent présentes après son redémarrage.

Sauvegarder régulièrement le dossier `.wedding-data` et le fichier `.env.wedding.local`. Les écritures sont séquentielles et atomiques. Ne pas lancer plusieurs instances du serveur sur le même dossier. Les données, mots de passe, fichiers de test et caches navigateur ne sont jamais inclus dans l’archive du projet.

## Préparer votre future mise en ligne

Aucune mise en ligne n’est effectuée par ces commandes :

```powershell
npm run build
npm start
```

`npm start` sert la page compilée **et** les API à `http://127.0.0.1:8787/`. Il faut utiliser un hébergement Node.js avec un **disque persistant**, une seule instance et HTTPS. Un hébergement de fichiers statiques seul ne peut pas enregistrer les confirmations ni les souvenirs. Sur un service avec stockage éphémère, les fichiers seraient perdus au redémarrage.

Variables à définir sur votre futur hébergement :

- `HOST=0.0.0.0` et `PORT` selon l’hébergeur.
- `WEDDING_SITE_ORIGIN=https://votre-domaine` pour l’origine publique et le cookie sécurisé.
- `WEDDING_ADMIN_PASSWORD` : votre mot de passe photographe (16 caractères minimum).
- `WEDDING_SESSION_SECRET` : une clé aléatoire privée d’au moins 32 caractères.
- `WEDDING_DATA_DIR` : chemin vers le dossier persistant, hors de `dist` et de `public`.

Si un reverse proxy est utilisé, lui confier HTTPS et une limite de corps de requête supérieure à 20 Mo pour l’import photo. Les variables VITE Supabase ne sont plus nécessaires.

## Vérifications réalisées

```powershell
npm run typecheck
npm run test:server
node scripts/test-experience.mjs
npm run build
```

Sept tests serveur couvrent les confirmations sans liste, les renvois sans doublon, les messages partagés, la validation, l’authentification, les publications photo après la cérémonie, la modération et la persistance après redémarrage. Sept assertions vérifient les états de pause et le délai de reprise.

Le navigateur a servi à vérifier l’ouverture de l’enveloppe, la lecture de la musique, le retour au début sans interruption sonore, la reprise du défilement, le compte à rebours, la confirmation ouverte et les deux volets Souvenirs. Les téléchargements PNG et PDF ont été testés ; le PDF a été rendu pour vérifier que la carte complète est contenue dans une seule page A4. Les essais utilisent des données temporaires isolées, exclues de la livraison.
