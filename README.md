# Contrôle des conciergeries

Application web en français pour remplir sur place le « Modèle de contrôle des conciergeries », sur smartphone, tablette ou ordinateur. Les 30 lignes du formulaire sont regroupées dans leur ordre d'origine. Chaque ligne permet de choisir une note, d'écrire une remarque et de joindre plusieurs photos.

L'application utilise uniquement HTML, CSS et JavaScript vanilla, sans dépendance externe, compte utilisateur ni serveur applicatif. Les contrôles et leurs photos sont enregistrés localement dans IndexedDB.

## Lancer l'application

Conserver les fichiers suivants ensemble, à la racine du même dossier :

- `index.html` : page de l'application ;
- `style.css` : interface mobile et feuille de style d'impression ;
- `app.js` : formulaire, sauvegarde, photos, import et export ;
- `config.js` : adresse initiale, pied de page, notes et liste des lignes ;
- `sw.js` : cache de l'application pour son utilisation hors connexion.

**Ouverture directe :** ouvrir `index.html` dans un navigateur récent. Le dossier complet reste disponible sans connexion et ne nécessite aucune installation. La prise en charge d'IndexedDB depuis une adresse `file://` varie selon le navigateur ; Safari sur iOS peut notamment la limiter. Vérifier qu'un contrôle est toujours présent après fermeture et réouverture avant d'utiliser ce mode sur le terrain.

**Sur téléphone ou tablette, mode recommandé :** publier ce même dossier sur un hébergement statique HTTPS, par exemple GitHub Pages, puis ouvrir l'adresse de l'application. Aucun backend n'est requis. À la première visite avec connexion, le service worker met en cache les quatre fichiers de l'application. Attendre que l'application indique la disponibilité hors connexion, puis vérifier qu'elle se recharge en mode avion. Elle pourra ensuite être rouverte à la même adresse sans réseau. La première visite ne peut pas être faite hors connexion.

Pour un essai sur ordinateur, un serveur statique local suffit, par exemple `python3 -m http.server 8000` lancé depuis ce dossier, puis l'ouverture de `http://localhost:8000`. Le service worker fonctionne sur HTTPS ou sur `localhost`, pas sur une adresse HTTP ordinaire ni sur `file://`. Le serveur statique sert seulement les fichiers : les données restent dans le navigateur.

## Remplir un contrôle

1. Appuyer sur **Nouveau contrôle**. L'adresse « rue de la Prulay 60-62 – 1217 Meyrin » et la date du jour sont proposées ; elles restent modifiables. Renseigner le concierge.
2. Pour chaque élément, choisir **1 — Très bon**, **2 — Bon**, **3 — Moyen** ou **4 — Mauvais**. Une seule note est possible ; appuyer à nouveau sur la note sélectionnée pour la retirer. Les sous-sections ne reçoivent pas de note.
3. Écrire une **Remarque** et ajouter les photos utiles. L'appareil photo du téléphone ou la galerie permettent d'ajouter plusieurs images. Appuyer sur une vignette pour l'agrandir ; utiliser son bouton de suppression pour retirer une photo. Les images sont réduites dans le navigateur, avec une largeur maximale de 1 280 pixels et un encodage JPEG de qualité 0,7.
4. Une note **4 — Mauvais** sans photo affiche un rappel non bloquant. Le modèle demande également une photo pour tous les dégâts et actes de vandalisme, quelle que soit la note.
5. Ajouter, si nécessaire, le texte et les photos de **COMMENTAIRES - REMARQUES**. Les sections peuvent être repliées ; leurs compteurs montrent le nombre de lignes notées. Le résumé final reprend les lignes notées 3 ou 4, leurs remarques et leur nombre de photos.

Chaque modification est sauvegardée automatiquement. L'indicateur de sauvegarde permet de vérifier que l'écriture a terminé ; le bouton **Enregistrer** reste disponible. En cas d'erreur de stockage, conserver la page ouverte et exporter une copie avant de la quitter.

La liste des contrôles est triée par date décroissante. Elle permet de rouvrir un contrôle pour le modifier, de le dupliquer ou de le supprimer. Une copie reprend les notes, remarques et photos, avec la date du jour, et peut être modifiée indépendamment de l'original. Un contrôle supprimé doit être restauré depuis une sauvegarde JSON s'il faut le récupérer.

## Sauvegarder et restaurer

**Exporter** télécharge une sauvegarde JSON comprenant tous les contrôles et leurs photos. Conserver régulièrement ces fichiers hors du navigateur, par exemple dans les fichiers de l'appareil ou sur un support de sauvegarde. **Importer** permet de sélectionner un export pour restaurer les données ; attendre la fin de l'import avant de fermer la page et vérifier les contrôles restaurés. Si un contrôle possède déjà le même identifiant, l'import crée une copie et préserve l'existant. Un fichier invalide est rejeté entièrement, sans modifier les données.

Le stockage est propre au navigateur, au profil, à l'appareil et à l'origine de l'application. Changer d'adresse ou de navigateur ne transfère pas les contrôles. Effacer les données du site, utiliser une session privée ou perdre l'appareil peut faire perdre les données ; une sauvegarde JSON indépendante reste nécessaire. Il n'y a pas de synchronisation automatique entre appareils. Les photos et remarques ne sont envoyées à aucun serveur par l'application ; les exports et PDF peuvent contenir des informations personnelles et doivent être conservés avec soin.

## Imprimer ou générer un PDF

Ouvrir le contrôle souhaité et appuyer sur **Générer le PDF**. La boîte de dialogue d'impression du navigateur s'ouvre : choisir une imprimante ou **Enregistrer au format PDF**, au format **A4 portrait**. Selon le navigateur du téléphone, cette action peut se trouver dans son menu de partage ou d'impression.

Le document reprend l'adresse, le concierge, la date, les tableaux des sections, les colonnes **1 2 3 4 Remarques**, une croix dans la note choisie et les photos sous leur ligne. Les sections repliées à l'écran restent présentes dans le document. Le pied de page se règle dans `config.js` avec la propriété `footer` :

> E. Blanco SA – Route des Jeunes 55 – 1212 Grand-Lancy – Suisse – Tél 022.343.66.07 – info@eblanco.ch – www.eblanco.ch

La pagination dépend du navigateur et du nombre de photos. Désactiver, si besoin, les en-têtes et pieds de page ajoutés par le navigateur dans les options d'impression.

## Adapter le formulaire

Modifier `config.js` pour changer l'adresse proposée, le pied de page, les libellés ou la liste des lignes. Les propriétés `sections`, `groups` et `items` définissent l'ordre du formulaire. Ajouter une ligne avec un **nouvel identifiant `id` unique**. Ne pas renommer les identifiants de lignes déjà utilisées : les contrôles sauvegardés s'appuient sur eux pour retrouver leurs notes, remarques et photos. Renommer seulement `label` ou `title` pour changer un texte.

Lors d'une publication de nouveaux fichiers, augmenter le suffixe de version `v1` de `CACHE_NAME` dans `sw.js`, afin que le cache hors connexion soit remplacé. Cette opération ne supprime pas les contrôles dans IndexedDB. Ouvrir une fois la nouvelle version avec connexion et vérifier le fonctionnement hors ligne avant une visite sur place.

## Contrôles manuels de validation

Ces scénarios sont reproductibles avec un navigateur récent et servent à vérifier l'installation sur l'appareil choisi.

1. **Création et notation :** créer un contrôle avec un concierge de test. Noter « Eclairage » de l'entrée en 1, « État du sol » des paliers en 3 avec la remarque « À nettoyer », et « Salissures, graffitis » en 4 avec « Graffiti à retirer ». Vérifier le compteur à 3/30 et la présence des deux lignes dans le résumé. Retirer puis remettre une note pour tester la désélection.
2. **Photo et rappel :** vérifier le rappel sur la note 4 sans photo. Ajouter une photo à « Salissures, graffitis », une seconde photo à la même ligne, puis une photo dans les commentaires. Vérifier les vignettes, leur agrandissement et la suppression d'une seule photo, sans perdre la remarque ni les autres photos. Le rappel doit disparaître dès qu'une photo reste sur la ligne.
3. **Persistance :** attendre l'état sauvegardé, recharger la page, rouvrir le contrôle et vérifier l'adresse, le concierge, les trois notes, les remarques et les photos. Modifier une ligne puis recharger encore pour vérifier la nouvelle valeur.
4. **Gestion et sauvegarde :** dupliquer le contrôle, modifier la copie et vérifier que l'original garde ses valeurs. Exporter le JSON ; importer ce fichier dans un autre navigateur ou profil de test et vérifier les notes et photos. Supprimer une copie de test et vérifier sa disparition de la liste.
5. **Hors connexion :** depuis l'hébergement HTTPS ou `localhost`, ouvrir l'application avec réseau et attendre l'état hors connexion prêt. Passer en mode avion ou bloquer le réseau, recharger, rouvrir le contrôle puis modifier une remarque. Recharger à nouveau : la modification doit être conservée. Revenir en ligne à la fin du test.
6. **PDF :** replier une section puis générer le PDF. Vérifier que toutes les sections apparaissent, que les trois croix se trouvent dans les bonnes colonnes, que les remarques et photos sont présentes et que le pied de page est lisible. Enregistrer le PDF et le rouvrir.

Pour le scénario photo, utiliser une image de test sans information sensible. Il n'est pas nécessaire de créer des données d'exemple dans l'application utilisée en production.
