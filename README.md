# Contrôle des conciergeries

Application web en français pour remplir sur place le « Modèle de contrôle des conciergeries », sur smartphone, tablette ou ordinateur. Les 30 lignes du formulaire sont regroupées dans leur ordre d'origine. Chaque ligne permet de choisir une note, d'écrire une remarque et de joindre plusieurs photos.

L'application utilise uniquement HTML, CSS et JavaScript vanilla, sans dépendance externe, compte utilisateur ni serveur applicatif. Les contrôles et leurs photos sont enregistrés localement dans IndexedDB.

## Lancer l'application

Conserver l'ensemble du dossier, avec les fichiers suivants à la racine et le sous-dossier `data` :

- `index.html` : page de l'application ;
- `style.css` : interface mobile et feuille de style d'impression ;
- `app.js` : formulaire, sauvegarde, photos, import et export ;
- `config.js` : pied de page, notes et liste des lignes ;
- `data/conciergeries.js` : liste locale des conciergeries, avec leurs adresses et leurs concierges ;
- `logo-horizontal.png` : logo utilisé à l'écran et dans le document imprimé ;
- `sw.js` : cache de l'application pour son utilisation hors connexion.

**Ouverture directe :** ouvrir `index.html` dans un navigateur récent. Le dossier complet reste disponible sans connexion et ne nécessite aucune installation. La prise en charge d'IndexedDB depuis une adresse `file://` varie selon le navigateur ; Safari sur iOS peut notamment la limiter. Vérifier qu'un contrôle est toujours présent après fermeture et réouverture avant d'utiliser ce mode sur le terrain.

**Sur téléphone ou tablette, mode recommandé :** publier ce même dossier sur un hébergement statique HTTPS, par exemple GitHub Pages, puis ouvrir l'adresse de l'application. Aucun backend n'est requis. À la première visite avec connexion, le service worker met en cache les fichiers de l'application, la liste des conciergeries et le logo. Attendre que l'application indique la disponibilité hors connexion, puis vérifier qu'elle se recharge en mode avion. Elle pourra ensuite être rouverte à la même adresse sans réseau. La première visite ne peut pas être faite hors connexion.

Pour un essai sur ordinateur, un serveur statique local suffit, par exemple `python3 -m http.server 8000` lancé depuis ce dossier, puis l'ouverture de `http://localhost:8000`. Le service worker fonctionne sur HTTPS ou sur `localhost`, pas sur une adresse HTTP ordinaire ni sur `file://`. Le serveur statique sert seulement les fichiers : les données restent dans le navigateur.

## Remplir un contrôle

1. Appuyer sur **Nouveau contrôle**, puis choisir une conciergerie dans la liste. Ce choix est obligatoire pour noter les lignes, utiliser **Enregistrer** ou générer le PDF. L'adresse et le concierge se remplissent automatiquement et ne sont pas modifiables à la main. La date du jour est proposée et reste modifiable.
2. Pour chaque élément, choisir **1 — Très bon**, **2 — Bon**, **3 — Moyen** ou **4 — Mauvais**. Une seule note est possible ; appuyer à nouveau sur la note sélectionnée pour la retirer. Les sous-sections ne reçoivent pas de note.
3. Écrire une **Remarque** et ajouter les photos utiles. L'appareil photo du téléphone ou la galerie permettent d'ajouter plusieurs images. Appuyer sur une vignette pour l'agrandir ; utiliser son bouton de suppression pour retirer une photo. Les images sont réduites dans le navigateur, avec une largeur maximale de 1 280 pixels et un encodage JPEG de qualité 0,7.
4. Une note **4 — Mauvais** sans photo affiche un rappel non bloquant. Le modèle demande également une photo pour tous les dégâts et actes de vandalisme, quelle que soit la note.
5. Ajouter, si nécessaire, le texte et les photos de **COMMENTAIRES - REMARQUES**. Les sections peuvent être repliées ; leurs compteurs montrent le nombre de lignes notées. Le résumé final reprend les lignes notées 3 ou 4, leurs remarques et leur nombre de photos.

Chaque modification est sauvegardée automatiquement, y compris le brouillon créé avant de choisir une conciergerie. L'indicateur de sauvegarde permet de vérifier que l'écriture a terminé ; le bouton **Enregistrer** reste disponible une fois la conciergerie sélectionnée. En cas d'erreur de stockage, conserver la page ouverte et exporter une copie avant de la quitter.

Le nom de la conciergerie et la progression restent visibles dans l'en-tête fixe. La barre inférieure garde **Enregistrer** et **Générer le PDF** accessibles pendant le défilement, sur téléphone comme sur tablette.

La liste des contrôles est triée par date décroissante. Elle permet de rouvrir un contrôle pour le modifier, de le dupliquer ou de le supprimer. Une copie reprend les notes, remarques et photos, avec la date du jour, et peut être modifiée indépendamment de l'original. Un contrôle supprimé doit être restauré depuis une sauvegarde JSON s'il faut le récupérer.

Les anciens contrôles et les anciens exports conservent leur adresse et leur concierge d'origine, même s'ils ne sont pas rattachés à la nouvelle liste. Ils restent consultables et leurs notes, remarques et photos restent modifiables sans sélection obligatoire ni migration manuelle. Leurs champs d'adresse et de concierge sont désormais en lecture seule, comme ceux des nouveaux contrôles.

## Sauvegarder et restaurer

**Exporter** télécharge une sauvegarde JSON comprenant tous les contrôles et leurs photos. Conserver régulièrement ces fichiers hors du navigateur, par exemple dans les fichiers de l'appareil ou sur un support de sauvegarde. **Importer** permet de sélectionner un export pour restaurer les données ; attendre la fin de l'import avant de fermer la page et vérifier les contrôles restaurés. Si un contrôle possède déjà le même identifiant, l'import crée une copie et préserve l'existant. Un fichier invalide est rejeté entièrement, sans modifier les données.

Le stockage est propre au navigateur, au profil, à l'appareil et à l'origine de l'application. Changer d'adresse ou de navigateur ne transfère pas les contrôles. Effacer les données du site, utiliser une session privée ou perdre l'appareil peut faire perdre les données ; une sauvegarde JSON indépendante reste nécessaire. Il n'y a pas de synchronisation automatique entre appareils. Les photos et remarques ne sont envoyées à aucun serveur par l'application ; les exports et PDF peuvent contenir des informations personnelles et doivent être conservés avec soin.

## Imprimer ou générer un PDF

Ouvrir le contrôle souhaité et appuyer sur **Générer le PDF**. La boîte de dialogue d'impression du navigateur s'ouvre : choisir une imprimante ou **Enregistrer au format PDF**, au format **A4 portrait**. Selon le navigateur du téléphone, cette action peut se trouver dans son menu de partage ou d'impression.

Le document reprend le logo horizontal, la conciergerie, l'adresse, le concierge, la date, les tableaux des sections, les colonnes **1 2 3 4 Remarques**, une croix dans la note choisie et les photos sous leur ligne. Les sections repliées à l'écran restent présentes dans le document. Le pied de page se règle dans `config.js` avec la propriété `footer` :

> E. Blanco SA – Route des Jeunes 55 – 1212 Grand-Lancy – Suisse – Tél 022.343.66.07 – info@eblanco.ch – www.eblanco.ch

La pagination dépend du navigateur et du nombre de photos. Désactiver, si besoin, les en-têtes et pieds de page ajoutés par le navigateur dans les options d'impression.

## Adapter le formulaire

Modifier `config.js` pour changer le pied de page, les libellés ou la liste des lignes. Les propriétés `sections`, `groups` et `items` définissent l'ordre du formulaire. Ajouter une ligne avec un **nouvel identifiant `id` unique**. Ne pas renommer les identifiants de lignes déjà utilisées : les contrôles sauvegardés s'appuient sur eux pour retrouver leurs notes, remarques et photos. Renommer seulement `label` ou `title` pour changer un texte.

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

Lors d'une publication de nouveaux fichiers, augmenter le suffixe de version de `CACHE_NAME` dans `sw.js` (actuellement `v2`), afin que le cache hors connexion soit remplacé. Si `app.js` ou `style.css` change, augmenter également leur paramètre de version dans `index.html` et dans la liste `ASSET_URLS` de `sw.js`, par exemple de `?v=2` à `?v=3`, avec le cache `v3`. Garder ces versions synchronisées évite de charger les anciens fichiers depuis le cache précédent.

Si seule la liste `data/conciergeries.js` change, augmenter au minimum la version du cache dans `sw.js`. Ces mises à jour ne suppriment pas les contrôles dans IndexedDB. Ouvrir la nouvelle version avec connexion, attendre la disponibilité hors connexion, puis recharger la page avec connexion. Vérifier que la liste affiche les nouvelles données et que l'application fonctionne ensuite hors ligne avant une visite sur place.

## Scénarios de validation

Ces scénarios sont à exécuter avec un navigateur récent sur l'appareil choisi ; cette liste décrit les vérifications attendues et ne constitue pas un compte rendu de tests.

1. **Création, note 4, photo et rechargement :** créer un contrôle. Avant la sélection, vérifier que la notation, **Enregistrer** et **Générer le PDF** sont indisponibles. Choisir « Prulay 60-62 » ; vérifier l'adresse automatiquement remplie, le concierge vide conformément au fichier initial, les deux champs en lecture seule et la date modifiable. Noter « Eclairage » de l'entrée en 1, « État du sol » des paliers en 3 avec « À nettoyer », et « Salissures, graffitis » en 4 avec « Graffiti à retirer ». Vérifier le compteur à 3/30 et le rappel de photo, puis ajouter une photo à la ligne en 4 : le rappel doit disparaître et la vignette doit s'ouvrir. Attendre l'état sauvegardé, recharger la page et rouvrir le contrôle. Vérifier la conciergerie, l'adresse, la date, les trois notes, les remarques et la photo. Pour tester un concierge renseigné, changer d'abord sa valeur dans `data/conciergeries.js` dans une copie de test, puis créer un nouveau contrôle.
2. **Téléphone de 320 pixels de large :** ouvrir le contrôle avec une largeur d'écran de 320 px. Parcourir toutes les sections et vérifier l'absence de défilement horizontal, la lisibilité du formulaire et l'accès aux notes, remarques et photos. Pendant le défilement, le logo, le nom de la conciergerie et la progression doivent rester visibles en haut ; **Enregistrer** et **Générer le PDF** doivent rester accessibles en bas sans masquer les derniers éléments. Retirer puis remettre une note, replier puis déplier une section et modifier une remarque pour vérifier que les autres données restent présentes.
3. **PDF avec logo et pied de page :** replier une section puis générer le PDF en A4 portrait. Vérifier le logo horizontal, la conciergerie, l'adresse, le concierge, la date, toutes les sections et les trois croix dans les bonnes colonnes. Vérifier la présence des remarques, des photos, des couleurs et du pied de page configuré, sans barre de navigation ni commandes de l'application. Si le navigateur propose une option de couleurs ou graphiques d'arrière-plan, l'activer pour vérifier le rendu coloré. Enregistrer le PDF et le rouvrir.

Pour compléter la validation, dupliquer un contrôle et vérifier l'indépendance de la copie ; exporter puis importer le JSON dans un profil de test et vérifier notes et photos ; supprimer une copie de test. Depuis l'hébergement HTTPS ou `localhost`, attendre l'état hors connexion prêt, passer en mode avion, recharger et modifier une remarque : elle doit rester présente après un nouveau rechargement. Enfin, dans une copie de test du dossier, modifier puis retirer l'entrée de la liste et vérifier que les contrôles existants conservent leurs informations.

Utiliser des photos de test sans information sensible. Il n'est pas nécessaire de créer des données d'exemple dans l'application utilisée en production.

## Résultats de validation

Avec Chromium 154, **12 contrôles automatisés ont réussi**, sans erreur JavaScript :

- sélection obligatoire, champs automatiques, date modifiable, photo réduite à 1 280 pixels et sauvegarde après rechargement ;
- duplication, export/import JSON, conservation des anciennes adresses, concierges et photos depuis les exports v1 et IndexedDB, et préservation des contrôles après modification ou retrait d'une entrée de la liste ;
- rechargement hors connexion avec la liste et le logo, affichage sans débordement de 320 à 1 440 pixels, boutons de notation d'au moins 44 pixels et barres fixes sans recouvrement ;
- PDF de trois pages avec logo, photo, cinq tableaux, couleurs et pied de page.

La mise à jour depuis le service worker v1 actif vers v2 a aussi passé **six vérifications**, sans erreur JavaScript : nouveaux fichiers JS/CSS et logo dès le premier rechargement, anciens contrôles conservés, cache v1 supprimé et cache v2 avec liste et logo, puis note 4 avec photo et rechargement hors connexion à 320 px.

Des vérifications ciblées confirment que les anciens contrôles sans adresse restent modifiables et imprimables après export/import et rechargement, avec leurs concierges, notes et photos. Les nouveaux brouillons restent bloqués jusqu'au choix d'un immeuble. Une liste de quatre contrôles conserve des cartes complètes et permet de rouvrir chacune par clic à 320, 480 et 700 pixels.

Safari et Firefox n'ont pas été testés. L'ouverture directe `file://` n'a pas été validée dans l'environnement cloud. Reproduire les scénarios sur le navigateur et l'appareil utilisés sur place reste nécessaire.
