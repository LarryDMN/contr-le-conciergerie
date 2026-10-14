# Contrôles de conciergerie et d'entretien de bureaux

Application web en français pour remplir un contrôle sur smartphone, tablette ou ordinateur. L'accueil propose **Contrôle conciergerie**, **Contrôle entretien de bureaux** et l'accès aux **Dossiers** de PDF archivés. Les données, photos et PDF sont conservés localement dans IndexedDB ; aucun compte ni serveur applicatif n'est requis.

Le formulaire de conciergerie reprend les 30 lignes du « Modèle de contrôle des conciergeries », dans leur ordre d'origine. Chaque ligne permet de choisir une note, d'écrire une remarque et de joindre plusieurs photos. La section bureaux est prête à accueillir son modèle : elle affiche **Modèle à venir** tant que `data/bureaux.js` reste vide. Aucune ligne de bureaux n'est ajoutée par défaut.

L'interface utilise HTML, CSS et JavaScript vanilla. La génération des PDF utilise des copies locales de jsPDF 4.2.1 et de son extension AutoTable 5.0.8, fournies avec leurs licences MIT dans `vendor/` : aucun téléchargement de bibliothèque n'est nécessaire pendant l'utilisation. Leur provenance et leurs intégrités sont décrites dans [vendor/README.md](vendor/README.md).

## Lancer l'application

Conserver l'ensemble du dossier, avec les fichiers suivants à la racine et les sous-dossiers `data` et `vendor` :

- `index.html` : page de l'application ;
- `style.css` : interface mobile et feuille de style d'impression ;
- `app.js` : navigation, formulaire, sauvegarde, photos, dossiers, import et export ;
- `lists.js` : filtres, sélections et pagination des contrôles et des archives ;
- `pdf.js` : génération des PDF avec le logo et les tableaux du formulaire ;
- `config.js` : pied de page, notes et liste des lignes ;
- `data/conciergeries.js` : liste locale des conciergeries, avec leurs adresses et leurs concierges ;
- `data/bureaux.js` : modèle de bureaux à compléter avec le formulaire fourni ;
- `vendor/` : bibliothèques PDF locales et licences ;
- `logo-horizontal.png` : logo utilisé à l'écran et dans le document imprimé ;
- `sw.js` : cache de l'application pour son utilisation hors connexion.

**Ouverture directe :** ouvrir `index.html` dans un navigateur récent. Le dossier complet reste disponible sans connexion et ne nécessite aucune installation. La prise en charge d'IndexedDB depuis une adresse `file://` varie selon le navigateur ; Safari sur iOS peut notamment la limiter. Vérifier qu'un contrôle est toujours présent après fermeture et réouverture avant d'utiliser ce mode sur le terrain.

**Sur téléphone ou tablette, mode recommandé :** publier ce même dossier sur un hébergement statique HTTPS, par exemple GitHub Pages, puis ouvrir l'adresse de l'application. Aucun backend n'est requis. À la première visite avec connexion, le service worker met en cache les fichiers de l'application, les fichiers de données, le logo et les bibliothèques PDF. Attendre que l'application indique la disponibilité hors connexion, puis vérifier qu'elle se recharge en mode avion. Elle pourra ensuite être rouverte à la même adresse sans réseau, y compris pour enregistrer un PDF. La première visite ne peut pas être faite hors connexion.

Pour un essai sur ordinateur, un serveur statique local suffit, par exemple `python3 -m http.server 8000` lancé depuis ce dossier, puis l'ouverture de `http://localhost:8000`. Le service worker fonctionne sur HTTPS ou sur `localhost`, pas sur une adresse HTTP ordinaire ni sur `file://`. Le serveur statique sert seulement les fichiers : les données restent dans le navigateur.

## Choisir une section et remplir un contrôle

1. Depuis l'accueil, ouvrir **Contrôle conciergerie**, puis appuyer sur **Nouveau contrôle** et choisir une conciergerie dans la liste. Ce choix est obligatoire pour noter les lignes, utiliser **Enregistrer** ou générer le PDF. L'adresse et le concierge se remplissent automatiquement et ne sont pas modifiables à la main. La date du jour est proposée et reste modifiable.
2. Pour chaque élément, choisir **1 — Très bon**, **2 — Bon**, **3 — Moyen** ou **4 — Mauvais**. Une seule note est possible ; appuyer à nouveau sur la note sélectionnée pour la retirer. Les sous-sections ne reçoivent pas de note.
3. Écrire une **Remarque** et ajouter les photos utiles. L'appareil photo du téléphone ou la galerie permettent d'ajouter plusieurs images. Appuyer sur une vignette pour l'agrandir ; utiliser son bouton de suppression pour retirer une photo. Les images sont réduites dans le navigateur, avec une largeur maximale de 1 280 pixels et un encodage JPEG de qualité 0,7.
4. Une note **4 — Mauvais** sans photo affiche un rappel non bloquant. Le modèle demande également une photo pour tous les dégâts et actes de vandalisme, quelle que soit la note.
5. Ajouter, si nécessaire, le texte et les photos de **COMMENTAIRES - REMARQUES**. Les sections peuvent être repliées ; leurs compteurs montrent le nombre de lignes notées. Le résumé final reprend les lignes notées 3 ou 4, leurs remarques et leur nombre de photos.

Chaque modification est sauvegardée automatiquement, y compris le brouillon créé avant de choisir une conciergerie. L'indicateur de sauvegarde permet de vérifier que l'écriture a terminé. **Enregistrer** sauvegarde aussi un PDF dans **Dossiers** ; **Terminer le contrôle** effectue la même sauvegarde et marque la fin du contrôle. **Générer le PDF** actualise aussi l'archive et télécharge le document. La sauvegarde automatique des champs ne régénère pas le PDF à chaque frappe : après une modification, appuyer sur **Enregistrer** pour actualiser le document archivé. En cas d'erreur de stockage, conserver la page ouverte et exporter une copie avant de la quitter.

Le nom de la conciergerie et la progression restent visibles dans l'en-tête fixe. La barre inférieure garde **Enregistrer** et **Générer le PDF** accessibles pendant le défilement, sur téléphone comme sur tablette.

La liste de chaque section est triée par date décroissante et n'affiche que ses propres contrôles, par pages de 50. Le champ `type` vaut `conciergerie` ou `bureaux`. Les contrôles créés avant cette version reçoivent automatiquement le type `conciergerie`, sans perdre leur adresse, notes ou photos.

La liste permet de rouvrir un contrôle pour le modifier, de le dupliquer ou de le supprimer. Une copie reprend les notes, remarques et photos, avec la date du jour, et peut être modifiée indépendamment de l'original. Le PDF de la copie sera créé lors de son enregistrement. Supprimer un contrôle, seul ou en sélection, retire aussi son PDF archivé après confirmation ; supprimer uniquement ce PDF dans **Dossiers** conserve le contrôle éditable. Pour récupérer un contrôle supprimé, importer une sauvegarde JSON.

Les anciens contrôles et les anciens exports conservent leur adresse et leur concierge d'origine, même s'ils ne sont pas rattachés à la nouvelle liste. Ils restent consultables et leurs notes, remarques et photos restent modifiables sans sélection obligatoire ni migration manuelle. Leurs champs d'adresse et de concierge sont désormais en lecture seule, comme ceux des nouveaux contrôles.

Dans **Contrôle entretien de bureaux**, la liste est indépendante de la conciergerie. Avec le fichier vide fourni, **Modèle à venir** est affiché et la création d'un nouveau contrôle de bureaux reste indisponible. Après ajout du modèle officiel, la section utilisera les mêmes notes, remarques, photos et sauvegardes ; les informations du site de bureaux pourront être renseignées dans son formulaire.

## Filtrer et gérer plusieurs contrôles

Dans chaque section, utiliser les filtres **Immeuble**, **Année**, **Mois** et la recherche par texte pour retrouver les contrôles utiles. Les résultats sont paginés : au maximum **50 contrôles par page** sont affichés, y compris lorsque plusieurs milliers sont enregistrés. Les contrôles de conciergerie et de bureaux gardent leurs filtres et leur sélection séparés.

Cocher les contrôles souhaités, ou utiliser **Tout sélectionner sur cette page**. Cette case porte sur les lignes de la page affichée ; elle ne sélectionne pas les autres pages. La sélection est conservée en changeant de page ou de filtre : son compteur peut donc inclure des contrôles qui ne sont plus visibles. Avant une action, vérifier ce compteur ; **Tout désélectionner** permet de vider toute la sélection. Les cases reviennent à vide au rechargement de l'application.

Une sélection fait apparaître trois actions :

- **Exporter la sélection (JSON)** : télécharge uniquement les contrôles sélectionnés, avec leurs notes, remarques, photos et PDF archivés correspondants. Ce fichier peut être restauré avec **Importer**, comme une sauvegarde complète.
- **Supprimer la sélection** : ouvre une confirmation avec le nombre exact de contrôles concernés. Elle permet de les exporter d'abord, d'annuler ou de confirmer la suppression. Confirmer retire les contrôles, leurs photos et leurs PDF de **Dossiers** en une même transaction IndexedDB. Les copies déjà téléchargées ou écrites dans le dossier de l'ordinateur sont conservées.
- **Supprimer les photos de la sélection** : ouvre une confirmation avant de retirer les photos des lignes et des commentaires. Les contrôles, notes, remarques et PDF archivés restent conservés.

**Exporter d'abord (JSON)** depuis la confirmation télécharge une sauvegarde ; cela ne confirme pas la suppression. Vérifier le téléchargement, puis choisir explicitement **Confirmer la suppression** ou **Annuler**. Une annulation laisse les données en place. Une suppression confirmée se restaure uniquement à partir d'une sauvegarde JSON contenant les données retirées.

## Libérer de la place

Pour retirer uniquement les photos d'anciens contrôles, saisir **Contrôles datés avant le** dans l'accueil puis utiliser **Supprimer les photos avant cette date**. Cette action concerne les contrôles **des deux types** dont la **date du contrôle est strictement antérieure** à cette date, et qui contiennent encore des photos. Un contrôle daté du jour limite est conservé avec ses photos. La confirmation indique le nombre exact de contrôles concernés et propose aussi un export préalable.

La suppression des photos conserve les notes, remarques, informations du contrôle et le PDF déjà archivé, qui peut toujours contenir les photos du dernier enregistrement. Une indication historique sur la fiche signale le retrait des photos ; elle ne bloque pas l'ajout de nouvelles photos. **Enregistrer** ou **Générer le PDF** actualise normalement l'archive : après un retrait, cette nouvelle version ne contiendra plus les photos supprimées.

L'accueil affiche **Espace utilisé sur cet appareil**, avec le total **Photos et PDF** et le détail de chaque catégorie, en Mo. Le calcul additionne la taille des images décodées depuis leur base64 et celle des blobs PDF stockés ; il n'inclut pas le texte, les métadonnées, le surcoût d'IndexedDB ni les fichiers téléchargés sur l'ordinateur. Il s'agit donc d'une mesure des pièces jointes conservées par l'application, pas du quota total utilisé par le navigateur. Supprimer seulement les photos conserve l'espace occupé par les PDF ; supprimer les contrôles et leurs archives libère aussi celui des PDF.

## Dossiers et PDF enregistrés

Depuis l'accueil, ouvrir **Dossiers**. Les PDF sont rangés selon **Type > Immeuble > Année**. La recherche permet de retrouver un nom ou une date. Chaque document affiche son nom de fichier et sa date, avec **Télécharger** pour conserver une copie et **Supprimer** pour retirer uniquement cette archive PDF.

Les archives sont également affichées par pages de 50. Cocher plusieurs PDF ou utiliser **Tout sélectionner sur cette page**, puis demander la suppression de la sélection. Comme pour les contrôles, la sélection reste conservée entre pages et recherches ; vérifier son compteur ou vider la sélection avant de changer de tâche. La confirmation indique le nombre exact de PDF, propose une sauvegarde JSON préalable et permet d'annuler. La suppression d'archives dans **Dossiers** garde les contrôles et leurs photos ; les copies du dossier de l'ordinateur et les téléchargements restent conservés.

Chaque clic sur **Enregistrer**, **Terminer le contrôle** ou **Générer le PDF** génère le PDF du contrôle et le stocke dans le store IndexedDB `archives`. Un contrôle possède au maximum un PDF archivé : un nouvel enregistrement remplace le précédent, même si sa date ou son immeuble a changé. Les données et photos éditables du contrôle restent sauvegardées séparément.

Le nom de téléchargement suit `AAAA-MM-JJ_TYPE_IMMEUBLE.pdf`, par exemple `2026-10-13_conciergerie_Prulay-60-62.pdf`. L'année de classement correspond à la date du contrôle. Les caractères incompatibles avec un nom de fichier sont remplacés. Le PDF archivé reflète le dernier enregistrement explicite, qui peut être plus ancien que les dernières modifications sauvegardées automatiquement.

Le document reprend le logo horizontal, le type de contrôle, l'immeuble, l'adresse, le concierge ou responsable, la date, les tableaux des sections, les colonnes **1 2 3 4 Remarques**, une croix dans la note choisie et les photos sous leur ligne. Les sections repliées à l'écran restent présentes dans le PDF. Le pied de page conserve la valeur `footer` de `config.js` :

> E. Blanco SA – Route des Jeunes 55 – 1212 Grand-Lancy – Suisse – Tél 022.343.66.07 – info@eblanco.ch – www.eblanco.ch

Les bibliothèques PDF sont copiées dans le dépôt : la génération et le téléchargement fonctionnent sans réseau une fois l'application disponible hors connexion. Un PDF est un document figé ; il ne remplace pas un export JSON pour restaurer un contrôle éditable et ses photos.

## Dossier de sauvegarde sur ordinateur (facultatif)

Sur Chrome ou Edge pour ordinateur, le bouton **Choisir le dossier de sauvegarde** peut être affiché si le navigateur fournit l'API File System Access dans le contexte utilisé. Choisir un dossier et autoriser l'écriture : les prochains PDF enregistrés sont aussi écrits dans ce dossier, avec le même nom que leur téléchargement. Chaque contrôle possède son propre sous-dossier, nommé avec son identifiant technique, pour éviter qu'un autre contrôle de même date, type et immeuble écrase son PDF. L'arborescence lisible **Type > Immeuble > Année** reste celle de **Dossiers** dans l'application.

Le dossier choisi est mémorisé dans IndexedDB pour ce navigateur. Si l'autorisation d'écriture est retirée, l'application demande de l'accorder à nouveau lors d'une action explicite. Une erreur d'autorisation ou d'écriture sur disque n'empêche pas le stockage du PDF dans **Dossiers**, où il reste téléchargeable. Un nouvel enregistrement remplace le fichier du contrôle ; si sa date ou son nom d'immeuble a changé, son ancienne copie dans ce sous-dossier est retirée après l'écriture de la nouvelle. Les fichiers d'autres contrôles sont conservés.

Ce bouton est masqué sur téléphone et tablette ainsi que sur Safari, Firefox et les navigateurs sans API compatible. Dans ces cas, utiliser **Télécharger** dans **Dossiers**. HTTPS ou `localhost` est recommandé pour les fonctions nécessitant un contexte sécurisé. Le dossier choisi et son autorisation ne sont pas inclus dans les exports JSON : après import ou changement d'appareil, choisir le dossier à nouveau.

## Sauvegarder et restaurer

**Exporter** télécharge une sauvegarde JSON comprenant les contrôles des deux types, leurs photos et les PDF archivés. Les PDF sont encodés en base64 dans le fichier JSON, ce qui augmente sa taille. Conserver régulièrement ces fichiers hors du navigateur, par exemple dans les fichiers de l'appareil ou sur un support de sauvegarde.

**Importer** permet de sélectionner un export pour restaurer les données et les PDF ; attendre la fin de l'import avant de fermer la page, puis vérifier les contrôles et **Dossiers**. Si un contrôle possède déjà le même identifiant, l'import crée une copie et préserve l'existant ; son archive est rattachée à la copie. Un fichier invalide est rejeté entièrement, sans modifier les données. Les anciens exports v1 sans PDF ni `type` restent acceptés et leurs contrôles deviennent des contrôles de conciergerie. Les nouveaux exports utilisent la version 2.

Le stockage est propre au navigateur, au profil, à l'appareil et à l'origine de l'application. Changer d'adresse ou de navigateur ne transfère pas les contrôles. Effacer les données du site, utiliser une session privée, perdre l'appareil ou subir une éviction du stockage du navigateur peut faire perdre les données et archives ; une sauvegarde JSON indépendante reste nécessaire. Il n'y a pas de synchronisation automatique entre appareils. Les photos et remarques ne sont envoyées à aucun serveur par l'application ; les exports et PDF peuvent contenir des informations personnelles et doivent être conservés avec soin. Les copies PDF du dossier de l'ordinateur ne restaurent pas les contrôles ni leurs photos éditables.

## Imprimer ou générer un PDF

Ouvrir le contrôle souhaité et utiliser **Générer le PDF** pour actualiser son archive et télécharger directement le document. La mise en page d'impression reste disponible pour imprimer le formulaire au format **A4 portrait** depuis le navigateur, notamment avec `Ctrl+P` sur ordinateur. Les commandes de l'application sont masquées, toutes les sections sont dépliées et les photos restent sous leurs lignes. Selon le navigateur du téléphone, l'impression peut se trouver dans son menu de partage.

Pour imprimer une archive figée, utiliser **Télécharger** dans **Dossiers**, ouvrir le PDF puis l'imprimer. La pagination de l'impression HTML dépend du navigateur et du nombre de photos ; désactiver, si besoin, les en-têtes et pieds de page ajoutés par le navigateur dans ses options d'impression.

## Adapter le formulaire

Modifier `config.js` pour changer le pied de page, les libellés ou la liste des lignes. Les propriétés `sections`, `groups` et `items` définissent l'ordre du formulaire. Ajouter une ligne avec un **nouvel identifiant `id` unique**. Ne pas renommer les identifiants de lignes déjà utilisées : les contrôles sauvegardés s'appuient sur eux pour retrouver leurs notes, remarques et photos. Renommer seulement `label` ou `title` pour changer un texte.

## Compléter le modèle de bureaux

Le fichier `data/bureaux.js` contient volontairement `window.BUREAUX = [];` et un commentaire « à compléter ». Attendre le modèle réel de contrôle d'entretien de bureaux avant de le remplir : reprendre uniquement ses intitulés et son ordre, sans inventer de lignes.

Remplacer le tableau vide par un tableau de sections. Chaque section possède `id`, `title` et `groups`. Chaque groupe possède `id`, `title` et `items`. Chaque ligne possède `id` et `label`. La forme attendue est :

```text
section { id, title, groups: [
  groupe { id, title, items: [
    ligne { id, label }
  ] }
] }
```

Cette notation explique la structure et n'est pas du JavaScript à copier tel quel. Utiliser la même syntaxe JavaScript que les sections de `config.js`, avec les textes du modèle officiel de bureaux. Choisir des identifiants uniques et stables ; modifier ensuite les libellés sans changer les identifiants utilisés par des contrôles existants. Un titre de groupe peut être vide lorsqu'aucune sous-section n'existe sur le modèle.

Pour les identifiants des lignes, utiliser les lettres minuscules `a-z`, les chiffres et les traits d'union, en commençant par une lettre. Ce format est accepté par l'import des sauvegardes ; les libellés visibles peuvent contenir des accents et des espaces.

Les notes, les photos, la zone de commentaires et le pied de page sont gérés par l'application ; seule la liste des sections, groupes et lignes doit être renseignée ici. Conserver le fichier chargé par une balise `script` classique pour l'ouverture directe et le fonctionnement hors connexion. Après une modification, publier aussi une nouvelle version du cache et vérifier la section bureaux avant utilisation sur place.

## Adapter la liste des conciergeries

La liste se trouve dans `data/conciergeries.js`. Elle contient initialement une seule entrée :

```js
window.CONCIERGERIES = [
  {
    id: "prulay-60-62",
    nom: "Prulay 60-62",
    adresse: "rue de la Prulay 60-62 – 1217 Meyrin",
    concierge: ""
  }
];
```

Le nom du concierge est volontairement vide dans cette entrée initiale. Pour le renseigner, modifier `concierge` dans ce fichier avant de créer un contrôle ; il ne se saisit pas directement dans le formulaire. Pour ajouter une conciergerie, ajouter un objet contenant les mêmes quatre propriétés et choisir un `id` unique. Pour modifier son nom, son adresse ou son concierge, changer la valeur correspondante. Pour retirer une conciergerie de la liste des nouveaux contrôles, supprimer son objet. Conserver les identifiants des entrées déjà utilisées et ne pas réutiliser l'identifiant d'une entrée supprimée pour un autre immeuble.

Lors de la sélection, le contrôle conserve son propre exemplaire de l'identifiant, du nom, de l'adresse et du concierge. Modifier ou supprimer une entrée du fichier ne remplace pas les informations des contrôles déjà enregistrés ou importés. Créer un nouveau contrôle pour utiliser les données actualisées de la liste ; les anciens contrôles gardent leurs informations historiques. Si d'autres conciergeries ont été ajoutées, réaffecter volontairement un contrôle à une autre conciergerie met à jour ce seul contrôle, après confirmation lorsque son adresse ou son concierge diffère.

Ce fichier est chargé par une balise `script` classique, sans module JavaScript ni requête à un serveur. Conserver le sous-dossier `data` lors d'une copie ou d'une publication pour que la liste reste disponible en ouverture directe et hors connexion.

## Publier une mise à jour

Lors d'une publication de nouveaux fichiers, augmenter le suffixe de version de `CACHE_NAME` dans `sw.js` (actuellement `v4`), afin que le cache hors connexion soit remplacé. Si `app.js`, `lists.js`, `style.css` ou `pdf.js` change, augmenter également leur paramètre de version dans `index.html` et dans la liste `ASSET_URLS` de `sw.js`, par exemple de `?v=4` à `?v=5`, avec le cache `v5`. Garder ces versions synchronisées évite de charger les anciens fichiers depuis le cache précédent.

Si seule la liste `data/conciergeries.js` ou le modèle `data/bureaux.js` change, augmenter au minimum la version du cache dans `sw.js`. Ces mises à jour ne suppriment pas les contrôles dans IndexedDB. Ouvrir la nouvelle version avec connexion, attendre la disponibilité hors connexion, puis recharger la page avec connexion. Vérifier les nouvelles données et le fonctionnement hors ligne avant une visite sur place.

## Scénarios de validation

Ces scénarios sont à exécuter avec un navigateur récent sur l'appareil choisi ; cette liste décrit les vérifications attendues et ne constitue pas un compte rendu de tests.

1. **Accueil et séparation des types :** vérifier les deux grandes cartes de contrôle et l'accès à **Dossiers**. Dans la section bureaux, vérifier **Modèle à venir** et l'absence de lignes inventées ou de création de contrôle tant que le modèle est vide. Depuis un ancien export v1, importer un contrôle sans `type` : il doit apparaître uniquement en conciergerie. Dans un profil de test, importer aussi un contrôle de type `bureaux` et vérifier qu'il n'apparaît pas dans la liste conciergerie.
2. **Création, note 4, photo et rechargement :** ouvrir la section conciergerie et créer un contrôle. Avant la sélection, vérifier que la notation, **Enregistrer** et **Générer le PDF** sont indisponibles. Choisir « Prulay 60-62 » ; vérifier l'adresse automatiquement remplie, le concierge vide conformément au fichier initial, les deux champs en lecture seule et la date modifiable. Noter « Eclairage » de l'entrée en 1, « État du sol » des paliers en 3 avec « À nettoyer », et « Salissures, graffitis » en 4 avec « Graffiti à retirer ». Vérifier le compteur à 3/30 et le rappel de photo, puis ajouter une photo à la ligne en 4 : le rappel doit disparaître et la vignette doit s'ouvrir. Appuyer sur **Enregistrer**, attendre la confirmation, recharger et rouvrir le contrôle. Vérifier l'immeuble, la date, les notes, les remarques et la photo.
3. **Archive, remplacement et téléchargement :** dans **Dossiers**, retrouver le PDF sous **Conciergerie > Prulay 60-62 > année du contrôle**. Télécharger le document et vérifier son nom, le logo, les cinq tableaux, les croix, les remarques, la photo et le pied de page. Modifier une remarque puis enregistrer de nouveau : une seule archive doit rester pour ce contrôle et son PDF téléchargé doit contenir la modification. Supprimer cette archive et vérifier que le contrôle reste disponible ; le réenregistrer recrée son archive. Vérifier aussi **Terminer le contrôle** sur une copie de test.
4. **Export et import avec PDF :** exporter les contrôles et archives, puis importer le JSON dans un profil vide. Vérifier les types séparés, les notes, les photos et le PDF téléchargeable au bon emplacement. Réimporter le même JSON dans ce profil et vérifier que les données présentes sont conservées et que les PDF importés restent associés à leurs contrôles copiés. Vérifier qu'un ancien export sans PDF est toujours accepté.
5. **Téléphone de 320 pixels de large :** ouvrir l'accueil, les deux sections, un contrôle et **Dossiers** avec une largeur d'écran de 320 px. Vérifier l'absence de défilement horizontal, la lisibilité des noms longs et l'accès aux notes, remarques, photos, recherche et boutons de téléchargement/suppression. Pendant le défilement du formulaire, l'en-tête et les actions restent accessibles sans masquer les derniers éléments. Retirer puis remettre une note et replier puis déplier une section pour vérifier que les autres données restent présentes.
6. **Hors connexion :** depuis HTTPS ou `localhost`, attendre l'état hors connexion prêt. Couper le réseau, recharger, modifier une remarque puis enregistrer. Vérifier que l'application, le logo et la liste sont disponibles, que le PDF est généré, qu'il apparaît dans **Dossiers** et qu'il se télécharge sans réseau. Recharger de nouveau et vérifier les données.
7. **Dossier sur ordinateur :** sur Chrome ou Edge compatible, choisir un dossier de test, enregistrer un contrôle et vérifier le fichier écrit. Enregistrer à nouveau avec le même nom : le fichier doit être remplacé. Recharger et vérifier la mémorisation du dossier. Retirer l'autorisation dans le navigateur puis vérifier que l'application propose de la redonner lors d'une action explicite et garde son archive IndexedDB même si l'écriture disque échoue. Sur téléphone, Safari ou Firefox, vérifier que le bouton est masqué et que le téléchargement depuis **Dossiers** reste possible.
8. **Gestion de trois contrôles :** dans un profil de test, créer trois contrôles avec des notes, remarques, photos et PDF. Les sélectionner et utiliser **Exporter la sélection (JSON)** ; vérifier que le JSON contient exactement ces trois contrôles et leurs archives. Demander leur suppression, annuler et vérifier qu'ils sont tous conservés. Recommencer, vérifier le nombre annoncé, exporter depuis la confirmation et confirmer ensuite la suppression. Les trois contrôles et leurs PDF doivent disparaître ensemble. Importer la sauvegarde et vérifier leur restauration.
9. **Photos seulement et date limite :** sélectionner un contrôle avec des photos de ligne et de commentaires, puis annuler la confirmation de retrait. Vérifier que les photos restent présentes. Confirmer ensuite : les notes, remarques et PDF doivent rester inchangés, les photos doivent disparaître et la fiche doit signaler leur retrait après rechargement. Depuis l'accueil, choisir une date limite avec des contrôles de chaque type avant, le jour même et après cette date ; seuls ceux strictement antérieurs avec des photos doivent être concernés. Vérifier la baisse de l'espace affiché et la conservation des PDF.
10. **Dossiers en masse :** sélectionner plusieurs PDF, vérifier le nombre dans la confirmation, annuler puis confirmer la suppression. Les contrôles et leurs photos doivent rester présents. Vérifier aussi la sauvegarde proposée avant suppression et sa restauration, ainsi que la conservation des copies déjà téléchargées.
11. **1 000 contrôles et affichage mobile :** importer un JSON de test avec 1 000 contrôles fictifs dans un profil jetable. À 320 px de largeur, vérifier que seulement 50 lignes sont affichées, que changer de page, filtrer par immeuble/année/mois et rechercher restent réactifs, et qu'aucune commande ne déborde horizontalement. Sélectionner des contrôles sur deux pages, changer un filtre et vérifier que le compteur garde la sélection ; vider la sélection puis vérifier qu'aucune suppression ne peut être déclenchée sans choix.

Pour compléter la validation, dupliquer un contrôle et vérifier l'indépendance de la copie. Dans une copie de test du dossier, modifier puis retirer l'entrée de la liste des conciergeries et vérifier que les contrôles existants conservent leurs informations. Replier une section puis imprimer le formulaire en A4 portrait pour vérifier que la structure papier reste complète.

Utiliser des photos de test sans information sensible. Il n'est pas nécessaire de créer des données d'exemple dans l'application utilisée en production.

## Résultats de validation

### Gestion de masse

Sur la branche `feat/gestion-masse`, **21 vérifications automatisées ont réussi**, sans erreur JavaScript, avec Chromium **154.0.8037.57** sous Linux. Les tests ont utilisé un écran mobile de **320 px**, les événements tactiles et un ralentissement du processeur **×4** :

- création réelle d'un contrôle avec immeuble, note 4, photo réduite et PDF généré puis téléchargé ;
- sélection de trois contrôles, export limité à ces contrôles et leurs trois PDF, export depuis la confirmation puis suppression des données, photos et archives associées ;
- annulation et touche Échap sans modification des contrôles, photos ou PDF, puis réouverture de la confirmation ;
- retrait des photos d'une sélection et avant une date, sur les deux types, avec conservation des notes, remarques et PDF vérifiée par empreinte SHA-256 ;
- rechargement et restauration JSON du marqueur de retrait des photos, avec PDF restaurés octet pour octet ;
- sélection, sauvegarde préalable, annulation et suppression en masse des PDF dans **Dossiers**, sans suppression des contrôles ni de leurs photos ;
- suppression individuelle d'une photo, d'un contrôle avec son PDF et d'une archive PDF, avec confirmation chiffrée, export proposé et annulation ;
- interruption simulée d'une transaction IndexedDB sans suppression partielle, puis nouvelle tentative réussie, sans création automatique d'un brouillon après suppression ;
- quota de stockage simulé : export des modifications en mémoire, retrait des photos et suppression encore disponibles malgré une sauvegarde bloquée ;
- deux écritures différées pendant une suppression, sans réapparition du contrôle supprimé, avec formulaire à nouveau utilisable après la transaction ;
- filtres immeuble, année, mois et texte, pages limitées à 50, sélections conservées entre pages et filtres et séparées entre conciergerie et bureaux ;
- calcul de l'espace des photos et PDF, et ouverture d'une nouvelle page hors connexion avec accès aux contrôles et export d'une sélection.

La charge de test, injectée dans IndexedDB dans un profil de test, contenait **1 000 contrôles de conciergerie avec une photo chacun**, **5 contrôles de bureaux** et **1 000 PDF légers valides**. Les pièces jointes représentaient 32,425 Mo de photos et 0,808 Mo de PDF ; l'accueil affichait correctement **33,23 Mo**. L'import depuis l'interface a été vérifié séparément avec cinq contrôles et quatre PDF ; le chargement des 1 000 contrôles ne constitue pas un test d'import de ce volume.

Avec ce jeu de données et le processeur ralenti, les temps mesurés étaient **538 ms** pour ouvrir la liste, **88 ms** pour changer de page, **59 ms** pour rechercher et **114 ms** pour changer de page dans **Dossiers**. Ces mesures décrivent cette exécution sur navigateur simulé ; elles ne garantissent pas les mêmes temps sur un téléphone physique ou avec des pièces jointes plus volumineuses.

### Fonctions existantes

Avant l'ajout de la gestion de masse, sur Chromium 154, **16 contrôles automatisés avaient réussi**, sans erreur JavaScript dans la page :

- accueil avec les deux types, modèle bureaux vide, 30 lignes de conciergerie et séparation des contrôles ;
- note 4 avec photo réduite à 1 280 pixels, sauvegarde et conservation après rechargement ;
- génération et téléchargement d'un PDF de deux pages, avec logo horizontal, photo, tableaux et pied de page ; **Enregistrer**, **Terminer le contrôle** et **Générer le PDF** remplacent bien l'unique archive du contrôle ;
- classement, recherche, aperçu, téléchargement et suppression dans **Dossiers** ;
- export/import JSON v2 avec PDF restauré octet pour octet, rattachement à la copie lors d'un import en doublon, anciens exports v1 acceptés, migration IndexedDB vers `type: "conciergerie"` et rejet d'un PDF invalide sans import partiel ;
- toutes les vues à **320 px** sans débordement horizontal, avec commandes d'au moins 44 pixels ;
- rechargement dans un nouvel onglet hors connexion et génération de PDF avec les bibliothèques locales mises en cache.

Pour le dossier ordinateur, les tests ont vérifié le bouton masqué sur mobile ou lorsque l'API est absente, la mémorisation d'un handle dans IndexedDB, son rechargement et la nouvelle demande d'autorisation. L'écriture utilise un vrai handle de répertoire du stockage privé du navigateur (OPFS), avec l'interface File System Access ; le sélecteur du dossier de l'ordinateur a été simulé. L'écriture dans un dossier externe réel reste à vérifier manuellement sur Chrome ou Edge.

Les vérifications ciblées de l'impression native complète et du remplacement du nom de fichier dans le dossier choisi après modification de la date ont aussi réussi. Le lien d'évitement mène au contenu de chaque vue.

Des tests ciblés du générateur PDF ont également vérifié l'intégration du logo PNG lorsque le chargement de l'image ou son accès au canvas échoue, notamment avec une erreur de sécurité simulée. Ils ne constituent pas une validation complète de l'ouverture directe `file://`, bloquée par le navigateur cloud.

Safari et Firefox n'ont pas été exécutés. Reproduire les scénarios sur le navigateur et l'appareil utilisés sur place reste nécessaire.
