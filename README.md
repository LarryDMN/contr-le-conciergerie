# Contrôles de conciergerie et d'entretien de bureaux

Application web en français pour remplir un contrôle sur smartphone, tablette ou ordinateur. L'accueil propose **Contrôle conciergerie**, **Contrôle entretien de bureaux** et l'accès aux **Dossiers** de PDF archivés. Les données, photos et PDF sont conservés localement dans IndexedDB ; aucun compte ni serveur applicatif n'est requis.

Le formulaire de conciergerie reprend les 30 lignes du « Modèle de contrôle des conciergeries », dans leur ordre d'origine. Chaque bureau utilise sa propre checklist définie dans `data/bureaux.js`. Le bureau **Bona Créations SA – Rolle (A-One)** dispose des 21 lignes et des trois zones fournies, avec leur fréquence d'entretien. Chaque ligne permet de choisir une note, d'écrire une remarque et de joindre plusieurs photos. Un bureau sans checklist affiche **Modèle à venir** ; aucune ligne supplémentaire n'est inventée.

L'interface utilise HTML, CSS et JavaScript vanilla. La génération des PDF utilise des copies locales de jsPDF 4.2.1 et de son extension AutoTable 5.0.8, fournies avec leurs licences MIT dans `vendor/` : aucun téléchargement de bibliothèque n'est nécessaire pendant l'utilisation. Leur provenance et leurs intégrités sont décrites dans [vendor/README.md](vendor/README.md).

## Lancer l'application

Conserver l'ensemble du dossier, avec les fichiers suivants à la racine et les sous-dossiers `data` et `vendor` :

- `index.html` : page de l'application ;
- `style.css` : interface mobile et feuille de style d'impression ;
- `app.js` : navigation, formulaire, sauvegarde, photos, dossiers, import et export ;
- `lists.js` : filtres, sélections et pagination des contrôles et des archives ;
- `anomalies.js` : conservation indépendante des anomalies et de leur statut ;
- `insights.js` : comparaison des visites et statistiques locales du tableau de bord ;
- `office-model.js` : adaptation et conservation des checklists propres à chaque bureau ;
- `pdf.js` : génération des PDF avec le logo et les tableaux du formulaire ;
- `config.js` : pied de page, notes et liste des lignes ;
- `data/conciergeries.js` : liste locale des conciergeries, avec leurs adresses et leurs concierges ;
- `data/bureaux.js` : catalogue des bureaux et checklist propre à chacun ;
- `vendor/` : bibliothèques PDF locales et licences ;
- `logo-horizontal.png` : logo utilisé à l'écran et dans le document imprimé ;
- `sw.js` : cache de l'application pour son utilisation hors connexion.

**Ouverture directe :** ouvrir `index.html` dans un navigateur récent. Le dossier complet reste disponible sans connexion et ne nécessite aucune installation. La prise en charge d'IndexedDB depuis une adresse `file://` varie selon le navigateur ; Safari sur iOS peut notamment la limiter. Vérifier qu'un contrôle est toujours présent après fermeture et réouverture avant d'utiliser ce mode sur le terrain.

**Sur téléphone ou tablette, mode recommandé :** publier ce même dossier sur un hébergement statique HTTPS, par exemple GitHub Pages, puis ouvrir l'adresse de l'application. Aucun backend n'est requis. À la première visite avec connexion, le service worker met en cache les fichiers de l'application, les fichiers de données, le logo et les bibliothèques PDF. Attendre que l'application indique la disponibilité hors connexion, puis vérifier qu'elle se recharge en mode avion. Elle pourra ensuite être rouverte à la même adresse sans réseau, y compris pour enregistrer un PDF. La première visite ne peut pas être faite hors connexion.

Pour un essai sur ordinateur, un serveur statique local suffit, par exemple `python3 -m http.server 8000` lancé depuis ce dossier, puis l'ouverture de `http://localhost:8000`. Le service worker fonctionne sur HTTPS ou sur `localhost`, pas sur une adresse HTTP ordinaire ni sur `file://`. Le serveur statique sert seulement les fichiers : les données restent dans le navigateur.

## Naviguer dans une section

Depuis l'accueil, ouvrir **Contrôle conciergerie** ou **Contrôle entretien de bureaux**. Le menu de la section contient exactement trois choix :

- **Nouveau contrôle** : ouvrir directement le formulaire pour commencer une visite ;
- **Suivi des anomalies** : consulter les lignes notées 3 ou 4 et suivre leur réglage ;
- **Mes contrôles** : retrouver les contrôles enregistrés, leurs PDF et les actions de gestion de masse.

La liste des contrôles apparaît uniquement dans **Mes contrôles**. Elle n'occupe plus de place dans le formulaire ni dans le menu. Les commandes de navigation permettent de revenir au menu de la section ou à l'accueil. Le bouton **Tableau de bord** de l'en-tête ouvre les statistiques de l'activité choisie ; il laisse les trois choix du menu inchangés. **Dossiers**, l'export et l'import JSON restent accessibles depuis l'accueil.

## Remplir un nouveau contrôle

1. Depuis l'accueil, ouvrir **Contrôle conciergerie**, puis appuyer sur **Nouveau contrôle** et choisir une conciergerie dans la liste. Ce choix est obligatoire pour noter les lignes, utiliser **Enregistrer** ou générer le PDF. L'adresse et le concierge se remplissent automatiquement et ne sont pas modifiables à la main. La date du jour est proposée et reste modifiable.
2. Pour chaque élément, choisir **1 — Très bon**, **2 — Bon**, **3 — Moyen** ou **4 — Mauvais**. Une seule note est possible ; appuyer à nouveau sur la note sélectionnée pour la retirer. Les sous-sections ne reçoivent pas de note.
3. Écrire une **Remarque** et ajouter les photos utiles. L'appareil photo du téléphone ou la galerie permettent d'ajouter plusieurs images. Appuyer sur une vignette pour l'agrandir ; utiliser son bouton de suppression pour retirer une photo. Les images sont réduites dans le navigateur, avec une largeur maximale de 1 280 pixels et un encodage JPEG de qualité 0,7.
4. Une note **4 — Mauvais** sans photo affiche un rappel non bloquant. Le modèle demande également une photo pour tous les dégâts et actes de vandalisme, quelle que soit la note.
5. Ajouter, si nécessaire, le texte et les photos de **COMMENTAIRES - REMARQUES**. Les sections peuvent être repliées ; leurs compteurs montrent le nombre de lignes notées. Le résumé final reprend les lignes notées 3 ou 4, leurs remarques et leur nombre de photos.

Chaque modification est sauvegardée automatiquement, y compris le brouillon créé avant de choisir une conciergerie. L'indicateur de sauvegarde permet de vérifier que l'écriture a terminé. **Enregistrer** sauvegarde aussi un PDF dans **Dossiers** ; **Terminer le contrôle** effectue la même sauvegarde et marque la fin du contrôle. **Générer le PDF** actualise aussi l'archive et télécharge le document. La sauvegarde automatique des champs ne régénère pas le PDF à chaque frappe : après une modification, appuyer sur **Enregistrer** pour actualiser le document archivé. En cas d'erreur de stockage, conserver la page ouverte et exporter une copie avant de la quitter.

Le nom de l'immeuble ou du bureau et la progression restent visibles dans l'en-tête fixe. La barre inférieure garde **Enregistrer** et **Générer le PDF** accessibles pendant le défilement, sur téléphone comme sur tablette.

Dans **Mes contrôles**, la liste est triée par date décroissante et n'affiche que les contrôles de la section choisie, par pages de 50. Le champ `type` vaut `conciergerie` ou `bureaux`. Les contrôles créés avant cette version reçoivent automatiquement le type `conciergerie`, sans perdre leur adresse, notes ou photos.

Chaque ligne de **Mes contrôles** permet d'ouvrir le contrôle, de télécharger son PDF et de le supprimer. **Télécharger le PDF** conserve l'archive existante telle quelle ; si aucune archive n'existe, l'application génère, archive puis télécharge le PDF du contrôle, sans ouvrir son formulaire. Un brouillon sans bâtiment choisi ou sans modèle ne permet pas encore cette génération. Le formulaire conserve la commande de duplication : une copie reprend les notes, remarques et photos, avec la date du jour, et peut être modifiée indépendamment de l'original. Le PDF de la copie sera créé lors de son enregistrement. Supprimer un contrôle, seul ou en sélection, retire aussi son PDF archivé après confirmation ; ses anomalies restent conservées dans le suivi. Supprimer uniquement le PDF dans **Dossiers** conserve le contrôle éditable. Pour récupérer un contrôle supprimé, importer une sauvegarde JSON.

Les anciens contrôles et les anciens exports conservent leur adresse et leur concierge d'origine, même s'ils ne sont pas rattachés à la nouvelle liste. Ils restent consultables et leurs notes, remarques et photos restent modifiables sans sélection obligatoire ni migration manuelle. Leurs champs d'adresse et de concierge sont désormais en lecture seule, comme ceux des nouveaux contrôles.

Dans **Contrôle entretien de bureaux**, créer un contrôle puis choisir le bureau dans la liste déroulante obligatoire. Son adresse et son concierge sont remplis depuis `data/bureaux.js`, en lecture seule ; la date du jour reste modifiable. Dans l'entrée fournie pour **Bona Créations SA – Rolle (A-One)**, l'adresse et le concierge sont volontairement vides : l'application les conserve ainsi, sans empêcher le contrôle.

Les trois zones **A. Salles – Cuisine (garde-manger) – Terrasse**, **B. Sanitaires – Vestiaires** et **Généralités** contiennent respectivement 9, 9 et 3 lignes. Les notes, remarques, photos, rappels non bloquants pour la note 4, commentaires et sauvegardes fonctionnent comme en conciergerie. La fréquence, par exemple **5x/sem**, est affichée à côté du libellé ; elle sert uniquement d'information et ne conditionne aucune action. Le PDF reprend les titres des zones, les lignes et leurs fréquences, puis est classé dans **Dossiers > Contrôle entretien de bureaux > nom du bureau > année**.

Un bureau dont la propriété `checklist` est vide conserve **Modèle à venir**, sans lignes à noter ni PDF de contrôle à générer. Les listes et sélections de contrôles restent séparées entre les deux activités. Aucun champ de téléphone n'est proposé ni enregistré pour les bureaux ; leur PDF n'affiche pas de numéro de téléphone.

Le contrôle conserve la checklist et les informations du bureau choisies lors de sa création. Modifier ou retirer une entrée du catalogue ne change pas les contrôles historiques. Pour choisir un autre bureau après avoir commencé un contrôle, l'application propose de créer un nouveau contrôle et conserve l'ancien avec ses notes, photos et archive PDF.

## Comparer avec la visite précédente

Pendant la saisie, la comparaison recherche un autre contrôle enregistré du **même type** et du **même immeuble ou bureau**. L'identifiant du catalogue permet de reconnaître un bâtiment même si son nom a changé. Les anciens contrôles sans identifiant sont rapprochés par leur nom, ou à défaut leur adresse, à l'identique ; ils ne sont pas fusionnés automatiquement avec un bâtiment du catalogue.

Pour un contrôle rouvert, la visite précédente est celle dont la **date du contrôle est la plus récente, strictement avant la date du contrôle affiché**. Pour un nouveau contrôle, tant que sa date initiale du jour n'est pas modifiée, la dernière visite enregistrée peut aussi dater du même jour. Une date changée manuellement rétablit la recherche strictement antérieure. Le contrôle affiché et les visites datées après lui sont toujours exclus. À date identique, la création la plus récente départage les visites, puis leur dernière modification et leur identifiant. La comparaison affichée pendant une nouvelle visite du même jour peut donc différer après fermeture et réouverture de celle-ci.

Les lignes sont rapprochées par leur **libellé exact**, sans ignorer les accents, la casse ou la ponctuation. Une ligne affiche **Précédent : 2**, par exemple, avec la date de cette visite. Si la note actuelle est plus élevée, **↓** en rouge signale une dégradation ; une note plus faible affiche **↑** en bleu pour une amélioration. À note identique, aucun repère n'est ajouté. Les repères restent informatifs et ne conditionnent ni la notation, ni l'enregistrement, ni la génération du PDF.

Une ligne absente de la visite précédente affiche **Nouvelle ligne**. Une ligne présente mais non notée est signalée comme non notée ; sans visite précédente, aucune note n'est inventée. Si un libellé apparaît plusieurs fois, sa zone départage les lignes lorsque cela donne une correspondance unique. Une ambiguïté restante est signalée sans comparer arbitrairement les notes.

Les nouveaux contrôles conservent leurs libellés pour la comparaison ; les bureaux conservent également leur checklist historique. Pour les anciens contrôles de conciergerie sans libellés enregistrés, ceux-ci sont déduits du modèle courant à chaque lecture, jusqu'à une nouvelle sauvegarde de la fiche après modification ou avec **Enregistrer**, ou jusqu'à l'export puis l'import de cette copie. La simple ouverture ne réécrit pas tous les anciens contrôles. L'application ne peut pas retrouver un libellé renommé avant sa conservation. Renommer ensuite une ligne est traité comme une nouvelle ligne si le libellé exact n'existe plus dans la visite précédente.

Le PDF nouvellement généré reprend **Précédent : X**, la date et le repère de dégradation. Une archive PDF existante reste figée jusqu'à son prochain enregistrement explicite. Supprimer ou importer des contrôles peut changer la visite retenue lors d'une comparaison ultérieure ; aucun historique externe ni appel réseau n'est utilisé.

## Consulter le tableau de bord

Dans une section, utiliser **Tableau de bord** dans l'en-tête. Une carte est affichée pour chaque immeuble ou bureau du catalogue, ainsi que pour les bâtiments historiques encore présents dans les contrôles ou le suivi des anomalies. Les cartes de l'autre activité ne sont pas mélangées avec celles de la section ouverte.

Chaque carte indique :

- la **moyenne du dernier contrôle**, calculée uniquement sur ses lignes notées de 1 à 4, arrondie à une décimale avec une virgule, par exemple **1,8** ; une moyenne plus faible correspond à de meilleures notes ;
- le **nombre d'anomalies ouvertes**, issu du même suivi que l'onglet **En cours**, et la **date du dernier contrôle** ;
- **Aucun contrôle** lorsqu'aucune visite enregistrée n'existe pour ce bâtiment. Ces cartes n'ajoutent aucune visite ni note aux statistiques ; un contrôle présent mais entièrement non noté n'a pas de moyenne.

Par défaut, les cartes sont triées par nombre d'anomalies ouvertes décroissant. Le sélecteur permet aussi un tri par nom ou par date du dernier contrôle, de la plus récente à la plus ancienne. Un clic sur une carte ouvre **Mes contrôles**, filtré sur ce seul bâtiment ; les autres filtres, la page et la sélection précédente sont réinitialisés.

La synthèse **Toutes activités confondues** affiche le nombre total de contrôles enregistrés, le total des anomalies ouvertes et la date du dernier contrôle, conciergerie et bureaux réunis. La date utilisée est celle de la visite, et non l'heure du dernier enregistrement. Les brouillons déjà sauvegardés automatiquement sont des contrôles enregistrés, même s'ils ne contiennent pas encore de note ; les modifications dont l'écriture en base n'a pas réussi n'entrent pas dans ces calculs.

Les anomalies sont comptées d'après leur statut persistant, pas uniquement d'après les notes du dernier contrôle : plusieurs visites peuvent avoir chacune leur anomalie ouverte sur une même ligne. Une anomalie restée ouverte après amélioration de la note ou suppression du contrôle continue de compter jusqu'à son réglage. Le compteur diminue après **Marquer réglée**, et augmente après remise **En cours** ; rouvrir le tableau de bord actualise les chiffres. Un bâtiment sans contrôle restant peut donc conserver des anomalies ouvertes.

Tous les calculs utilisent les données locales enregistrées dans le navigateur. Il n'y a ni synchronisation avec d'autres appareils, ni moyenne globale des bâtiments sans contrôle, ni pondération selon les fréquences d'entretien. Les informations sont disponibles hors connexion une fois l'application mise en cache.

## Suivre les anomalies

Ouvrir **Suivi des anomalies** depuis le menu de la section. Chaque ligne notée **3 — Moyen** ou **4 — Mauvais** produit une anomalie, y compris dans les contrôles enregistrés avant cette version. Les anciennes anomalies commencent en statut **En cours**, sans modification des notes ni des PDF existants. Les anomalies de conciergerie et de bureaux restent séparées.

L'onglet **En cours** est affiché par défaut ; **Réglées** retrouve les anomalies dont le traitement est terminé. Une carte présente l'immeuble ou le bureau, la ligne, sa zone, sa note, sa remarque, ses photos et la date du contrôle d'origine. Utiliser le filtre de bâtiment ou la recherche par texte pour retrouver une anomalie. La liste est paginée à 50 anomalies par page.

Pour terminer le traitement, utiliser **Marquer réglée**, renseigner la date de réglage et joindre, si utile, une photo de la correction. La photo est facultative et réduite comme les photos de contrôle. Valider déplace l'anomalie dans **Réglées** ; annuler ne change pas son statut. Une anomalie peut ensuite être remise **En cours** : la date et la photo du dernier réglage restent conservées pour son historique.

Le suivi ne se ferme pas automatiquement lorsque la note du contrôle passe à 1 ou 2 ou est retirée : l'anomalie garde son dernier relevé en 3 ou 4 et son statut, jusqu'à une action dans le suivi. Une nouvelle remarque ou photo sur une ligne toujours notée 3 ou 4 actualise son relevé sans effacer un réglage déjà enregistré.

Ouvrir une anomalie permet de consulter le contrôle d'origine. Son statut est enregistré séparément dans le store IndexedDB `anomalies` : supprimer le contrôle ne supprime ni l'anomalie ni ses pièces jointes. Elle reste accessible avec la mention **contrôle supprimé** ; le formulaire d'origine ne peut alors plus être ouvert. Une anomalie réglée n'est jamais supprimée automatiquement.

## Mes contrôles : filtrer et gérer plusieurs contrôles

Dans **Mes contrôles**, utiliser les filtres **Immeuble**, **Année**, **Mois** et la recherche par texte pour retrouver les contrôles utiles. Les résultats sont paginés : au maximum **50 contrôles par page** sont affichés, y compris lorsque plusieurs milliers sont enregistrés. Les contrôles de conciergerie et de bureaux gardent leurs filtres et leur sélection séparés.

Cocher les contrôles souhaités, ou utiliser **Tout sélectionner sur cette page**. Cette case porte sur les lignes de la page affichée ; elle ne sélectionne pas les autres pages. La sélection est conservée en changeant de page ou de filtre : son compteur peut donc inclure des contrôles qui ne sont plus visibles. Avant une action, vérifier ce compteur ; **Tout désélectionner** permet de vider toute la sélection. Les cases reviennent à vide au rechargement de l'application.

Une sélection fait apparaître trois actions :

- **Exporter la sélection (JSON)** : télécharge uniquement les contrôles sélectionnés, avec leurs notes, remarques, photos, PDF archivés et anomalies correspondantes. Ce fichier peut être restauré avec **Importer**, comme une sauvegarde complète.
- **Supprimer la sélection** : ouvre une confirmation avec le nombre exact de contrôles concernés. Elle permet de les exporter d'abord, d'annuler ou de confirmer la suppression. Confirmer retire les contrôles, leurs photos et leurs PDF de **Dossiers** en une même transaction IndexedDB. Le suivi conserve les anomalies et indique **contrôle supprimé**. Les copies déjà téléchargées ou écrites dans le dossier de l'ordinateur sont conservées.
- **Supprimer les photos de la sélection** : ouvre une confirmation avant de retirer les photos des lignes et des commentaires. Les contrôles, notes, remarques et PDF archivés restent conservés.

**Exporter d'abord (JSON)** depuis la confirmation télécharge une sauvegarde ; cela ne confirme pas la suppression. Vérifier le téléchargement, puis choisir explicitement **Confirmer la suppression** ou **Annuler**. Une annulation laisse les données en place. Une suppression confirmée se restaure uniquement à partir d'une sauvegarde JSON contenant les données retirées.

## Libérer de la place

Pour retirer uniquement les photos d'anciens contrôles, saisir **Contrôles datés avant le** dans l'accueil puis utiliser **Supprimer les photos avant cette date**. Cette action concerne les contrôles **des deux types** dont la **date du contrôle est strictement antérieure** à cette date, et qui contiennent encore des photos. Un contrôle daté du jour limite est conservé avec ses photos. La confirmation indique le nombre exact de contrôles concernés et propose aussi un export préalable.

La suppression des photos conserve les notes, remarques, informations du contrôle et le PDF déjà archivé, qui peut toujours contenir les photos du dernier enregistrement. Une indication historique sur la fiche signale le retrait des photos ; elle ne bloque pas l'ajout de nouvelles photos. **Enregistrer** ou **Générer le PDF** actualise normalement l'archive : après un retrait, cette nouvelle version ne contiendra plus les photos supprimées.

Les photos conservées dans le suivi des anomalies restent indépendantes : retirer celles d'un contrôle ne les retire pas du suivi. Ce maintien permet de comprendre et de traiter une anomalie après nettoyage ou suppression du contrôle d'origine.

L'accueil et **Mes contrôles** affichent **Espace utilisé sur cet appareil**, avec le total **Photos et PDF** et le détail de chaque catégorie, en Mo. Cette mesure porte sur **les deux activités**, y compris les archives et anomalies sans contrôle d'origine. Le calcul additionne la taille des photos des contrôles, des copies conservées pour les anomalies, des photos de correction et des blobs PDF stockés. Il n'inclut pas le texte, les métadonnées, le surcoût d'IndexedDB ni les fichiers téléchargés sur l'ordinateur. Il s'agit donc d'une mesure des pièces jointes conservées par l'application, pas du quota total utilisé par le navigateur. Supprimer les photos d'un contrôle conserve l'espace occupé par ses PDF et par les photos du suivi ; supprimer le contrôle et son archive conserve aussi les pièces jointes de ses anomalies.

## Dossiers et PDF enregistrés

Depuis l'accueil, ouvrir **Dossiers**. Les PDF sont rangés selon **Type > Immeuble > Année**. La recherche permet de retrouver un nom ou une date. Chaque document affiche son nom de fichier et sa date, avec **Télécharger** pour conserver une copie et **Supprimer** pour retirer uniquement cette archive PDF.

Les archives sont également affichées par pages de 50. Cocher plusieurs PDF ou utiliser **Tout sélectionner sur cette page**, puis demander la suppression de la sélection. Comme pour les contrôles, la sélection reste conservée entre pages et recherches ; vérifier son compteur ou vider la sélection avant de changer de tâche. La confirmation indique le nombre exact de PDF, propose une sauvegarde JSON préalable et permet d'annuler. La suppression d'archives dans **Dossiers** garde les contrôles et leurs photos ; les copies du dossier de l'ordinateur et les téléchargements restent conservés.

Chaque clic sur **Enregistrer**, **Terminer le contrôle** ou **Générer le PDF** génère le PDF du contrôle et le stocke dans le store IndexedDB `archives`. Un contrôle possède au maximum un PDF archivé : un nouvel enregistrement remplace le précédent, même si sa date ou son immeuble a changé. Les données et photos éditables du contrôle restent sauvegardées séparément.

Le nom de téléchargement suit `AAAA-MM-JJ_TYPE_IMMEUBLE.pdf`, par exemple `2026-10-13_conciergerie_Prulay-60-62.pdf`. L'année de classement correspond à la date du contrôle. Les caractères incompatibles avec un nom de fichier sont remplacés. Le PDF archivé reflète le dernier enregistrement explicite, qui peut être plus ancien que les dernières modifications sauvegardées automatiquement.

Le document reprend le logo horizontal, le type de contrôle, l'immeuble ou le bureau, l'adresse, le concierge, la date, les tableaux des sections, les colonnes **1 2 3 4 Remarques**, une croix dans la note choisie et les photos sous leur ligne. Le PDF bureaux conserve les titres des zones et affiche la fréquence de chaque ligne. Les sections repliées à l'écran restent présentes dans le PDF. Le pied de page de conciergerie conserve la valeur `footer` de `config.js` :

> E. Blanco SA – Route des Jeunes 55 – 1212 Grand-Lancy – Suisse – Tél 022.343.66.07 – info@eblanco.ch – www.eblanco.ch

Le pied de page bureaux utilise la valeur `officeFooter` de `config.js`, avec ces coordonnées sans la partie téléphone.

Les bibliothèques PDF sont copiées dans le dépôt : la génération et le téléchargement fonctionnent sans réseau une fois l'application disponible hors connexion. Un PDF est un document figé ; il ne remplace pas un export JSON pour restaurer un contrôle éditable et ses photos.

## Dossier de sauvegarde sur ordinateur (facultatif)

Sur Chrome ou Edge pour ordinateur, le bouton **Choisir le dossier de sauvegarde** peut être affiché si le navigateur fournit l'API File System Access dans le contexte utilisé. Choisir un dossier et autoriser l'écriture : les prochains PDF enregistrés sont aussi écrits dans ce dossier, avec le même nom que leur téléchargement. Chaque contrôle possède son propre sous-dossier, nommé avec son identifiant technique, pour éviter qu'un autre contrôle de même date, type et immeuble écrase son PDF. L'arborescence lisible **Type > Immeuble > Année** reste celle de **Dossiers** dans l'application.

Le dossier choisi est mémorisé dans IndexedDB pour ce navigateur. Si l'autorisation d'écriture est retirée, l'application demande de l'accorder à nouveau lors d'une action explicite. Une erreur d'autorisation ou d'écriture sur disque n'empêche pas le stockage du PDF dans **Dossiers**, où il reste téléchargeable. Un nouvel enregistrement remplace le fichier du contrôle ; si sa date ou son nom d'immeuble a changé, son ancienne copie dans ce sous-dossier est retirée après l'écriture de la nouvelle. Les fichiers d'autres contrôles sont conservés.

Ce bouton est masqué sur téléphone et tablette ainsi que sur Safari, Firefox et les navigateurs sans API compatible. Dans ces cas, utiliser **Télécharger** dans **Dossiers**. HTTPS ou `localhost` est recommandé pour les fonctions nécessitant un contexte sécurisé. Le dossier choisi et son autorisation ne sont pas inclus dans les exports JSON : après import ou changement d'appareil, choisir le dossier à nouveau.

## Sauvegarder et restaurer

**Exporter** télécharge une sauvegarde JSON comprenant les contrôles des deux types, leurs photos, les PDF archivés et le suivi des anomalies, y compris les anomalies dont le contrôle a été supprimé. Leurs statuts, dates de réglage et photos de correction sont sauvegardés. Les PDF sont encodés en base64 dans le fichier JSON, ce qui augmente sa taille. Conserver régulièrement ces fichiers hors du navigateur, par exemple dans les fichiers de l'appareil ou sur un support de sauvegarde.

**Importer** permet de sélectionner un export pour restaurer les données, les PDF et les anomalies ; attendre la fin de l'import avant de fermer la page, puis vérifier **Mes contrôles**, **Dossiers** et les deux onglets du suivi. Si un contrôle possède déjà le même identifiant, l'import crée une copie et préserve l'existant ; son archive et ses anomalies sont rattachées à la copie. Un fichier invalide est rejeté entièrement, sans modifier les données. Les anciens exports v1 et v2 restent acceptés ; leurs lignes notées 3 ou 4 sont ajoutées au suivi en statut **En cours**. Un contrôle sans `type` devient un contrôle de conciergerie. Les nouveaux exports utilisent la version 3.

Le stockage est propre au navigateur, au profil, à l'appareil et à l'origine de l'application. Changer d'adresse ou de navigateur ne transfère pas les contrôles. Effacer les données du site, utiliser une session privée, perdre l'appareil ou subir une éviction du stockage du navigateur peut faire perdre les données et archives ; une sauvegarde JSON indépendante reste nécessaire. Il n'y a pas de synchronisation automatique entre appareils. Les photos et remarques ne sont envoyées à aucun serveur par l'application ; les exports et PDF peuvent contenir des informations personnelles et doivent être conservés avec soin. Les copies PDF du dossier de l'ordinateur ne restaurent pas les contrôles ni leurs photos éditables.

## Imprimer ou générer un PDF

Ouvrir le contrôle souhaité et utiliser **Générer le PDF** pour actualiser son archive et télécharger directement le document. La mise en page d'impression reste disponible pour imprimer le formulaire au format **A4 portrait** depuis le navigateur, notamment avec `Ctrl+P` sur ordinateur. Les commandes de l'application sont masquées, toutes les sections sont dépliées et les photos restent sous leurs lignes. Selon le navigateur du téléphone, l'impression peut se trouver dans son menu de partage.

Pour imprimer une archive figée, utiliser **Télécharger** dans **Dossiers**, ouvrir le PDF puis l'imprimer. La pagination de l'impression HTML dépend du navigateur et du nombre de photos ; désactiver, si besoin, les en-têtes et pieds de page ajoutés par le navigateur dans ses options d'impression.

## Adapter le formulaire

Modifier `config.js` pour changer les pieds de page (`footer` pour la conciergerie, `officeFooter` pour les bureaux), les notes communes ou le modèle de conciergerie. Pour ce modèle, les propriétés `sections`, `groups` et `items` définissent l'ordre du formulaire. Ajouter une ligne avec un **nouvel identifiant `id` unique**. Ne pas renommer les identifiants de lignes déjà utilisées : les contrôles sauvegardés s'appuient sur eux pour retrouver leurs notes, remarques et photos. Renommer seulement `label` ou `title` pour changer un texte. Les checklists propres aux bureaux se modifient dans `data/bureaux.js`, selon la procédure ci-dessous.

## Ajouter ou modifier un bureau

Ouvrir `data/bureaux.js`, puis **copier le bloc complet** de Bona Créations dans le tableau `const bureaux = [...]`, en séparant les blocs par une virgule. Pour le nouveau bloc :

1. Donner un `id` unique et stable, composé de lettres minuscules, de chiffres et de traits d'union. Ne pas réutiliser l'identifiant d'un bureau retiré.
2. Renseigner `nom`, `adresse` et `concierge` avec les informations réelles du bureau. Une adresse ou un concierge vide reste vide dans le formulaire. Ne pas ajouter de propriété téléphone.
3. Remplacer `checklist` par les seules zones et lignes du modèle fourni pour ce bureau, dans leur ordre. Chaque zone possède `titre` et `lignes` ; chaque ligne possède `libelle` et `frequence`. Par exemple, le bloc fourni utilise la ligne `{ libelle: "Aspiration des sols", frequence: "5x/sem" }`. Les fréquences sont du texte indicatif : aucune règle de planning n'en dépend.
4. Si le modèle n'est pas encore disponible, renseigner `checklist: []`. Le bureau reste sélectionnable et affiche **Modèle à venir** ; ne pas copier les lignes d'un autre bureau pour remplir ce vide.
5. Sauvegarder le fichier, publier la mise à jour du cache comme décrit ci-dessous, puis créer un nouveau contrôle pour vérifier le nom, les champs automatiques, l'ordre des zones et les fréquences.

La structure du catalogue est la suivante ; les points de suspension représentent les données réelles à conserver ou à compléter, pas du JavaScript à copier :

```text
const bureaux = [
  { id, nom, adresse, concierge, checklist: [
    { titre, lignes: [ { libelle, frequence }, ... ] }, ...
  ] }, ...
];
```

Pour modifier un bureau, changer les valeurs de son bloc en conservant son `id`. Pour le retirer de la liste des nouveaux contrôles, supprimer ce bloc. Les contrôles enregistrés gardent leur propre exemplaire du nom, de l'adresse, du concierge, des zones, des libellés et des fréquences : une modification du catalogue ne remplace pas leur historique. Ces informations sont également incluses dans les exports JSON.

Les identifiants techniques des zones et lignes sont construits par l'application ; il n'est pas nécessaire d'en ajouter au fichier. Les notes, photos, commentaires et PDF sont gérés par la même logique que la conciergerie. Conserver le fichier chargé par une balise `script` classique pour l'ouverture directe et le fonctionnement hors connexion.

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

Lors d'une publication de nouveaux fichiers, augmenter le suffixe de version de `CACHE_NAME` dans `sw.js` (actuellement `v7`), afin que le cache hors connexion soit remplacé. Si `app.js`, `lists.js`, `office-model.js`, `anomalies.js`, `insights.js`, `style.css`, `config.js` ou `pdf.js` change, augmenter également leur paramètre de version dans `index.html` et dans la liste `ASSET_URLS` de `sw.js`, par exemple de `?v=7` à `?v=8`, avec le cache `v8`. Garder ces versions synchronisées évite de charger les anciens fichiers depuis le cache précédent.

Si seule la liste `data/conciergeries.js` ou le modèle `data/bureaux.js` change, augmenter au minimum la version du cache dans `sw.js`. Ces mises à jour ne suppriment pas les contrôles dans IndexedDB. Ouvrir la nouvelle version avec connexion, attendre la disponibilité hors connexion, puis recharger la page avec connexion. Vérifier les nouvelles données et le fonctionnement hors ligne avant une visite sur place.

## Scénarios de validation

Ces scénarios sont à exécuter avec un navigateur récent sur l'appareil choisi ; cette liste décrit les vérifications attendues et ne constitue pas un compte rendu de tests.

1. **Accueil, menus et séparation des types :** vérifier les deux grandes cartes de contrôle et l'accès à **Dossiers**. Ouvrir chacune des deux sections : son menu doit contenir exactement **Nouveau contrôle**, **Suivi des anomalies** et **Mes contrôles**, sans liste de contrôles. Dans la section bureaux, utiliser **Nouveau contrôle** et vérifier le choix obligatoire de Bona Créations, les 21 lignes exactes réparties dans les trois zones et les fréquences. Dans une copie de test du catalogue, ajouter un bureau avec `checklist: []` : le choisir doit afficher **Modèle à venir**, sans lignes inventées. Depuis un ancien export v1, importer un contrôle sans `type` : il doit apparaître uniquement dans **Mes contrôles** de conciergerie. Vérifier qu'un contrôle bureaux n'apparaît pas dans la liste conciergerie.
2. **Création, note 4, photo et rechargement :** ouvrir la section conciergerie et créer un contrôle. Avant la sélection, vérifier que la notation, **Enregistrer** et **Générer le PDF** sont indisponibles. Choisir « Prulay 60-62 » ; vérifier l'adresse automatiquement remplie, le concierge vide conformément au fichier initial, les deux champs en lecture seule et la date modifiable. Noter « Eclairage » de l'entrée en 1, « État du sol » des paliers en 3 avec « À nettoyer », et « Salissures, graffitis » en 4 avec « Graffiti à retirer ». Vérifier le compteur à 3/30 et le rappel de photo, puis ajouter une photo à la ligne en 4 : le rappel doit disparaître et la vignette doit s'ouvrir. Appuyer sur **Enregistrer**, attendre la confirmation, recharger et rouvrir le contrôle. Vérifier l'immeuble, la date, les notes, les remarques et la photo.
3. **Archive, remplacement et téléchargement :** dans **Dossiers**, retrouver le PDF sous **Conciergerie > Prulay 60-62 > année du contrôle**. Télécharger le document et vérifier son nom, le logo, les cinq tableaux, les croix, les remarques, la photo et le pied de page. Modifier une remarque puis enregistrer de nouveau : une seule archive doit rester pour ce contrôle et son PDF téléchargé doit contenir la modification. Supprimer cette archive et vérifier que le contrôle reste disponible ; le réenregistrer recrée son archive. Vérifier aussi **Terminer le contrôle** sur une copie de test.
4. **Export et import avec PDF :** exporter les contrôles et archives, puis importer le JSON dans un profil vide. Vérifier les types séparés, les notes, les photos et le PDF téléchargeable au bon emplacement. Réimporter le même JSON dans ce profil et vérifier que les données présentes sont conservées et que les PDF importés restent associés à leurs contrôles copiés. Vérifier qu'un ancien export sans PDF est toujours accepté.
5. **Téléphone de 320 pixels de large :** ouvrir l'accueil, les deux sections, un contrôle et **Dossiers** avec une largeur d'écran de 320 px. Vérifier l'absence de défilement horizontal, la lisibilité des noms longs et l'accès aux notes, remarques, photos, recherche et boutons de téléchargement/suppression. Pendant le défilement du formulaire, l'en-tête et les actions restent accessibles sans masquer les derniers éléments. Retirer puis remettre une note et replier puis déplier une section pour vérifier que les autres données restent présentes.
6. **Hors connexion :** depuis HTTPS ou `localhost`, attendre l'état hors connexion prêt. Couper le réseau, recharger, modifier une remarque puis enregistrer. Vérifier que l'application, le logo et la liste sont disponibles, que le PDF est généré, qu'il apparaît dans **Dossiers** et qu'il se télécharge sans réseau. Recharger de nouveau et vérifier les données.
7. **Dossier sur ordinateur :** sur Chrome ou Edge compatible, choisir un dossier de test, enregistrer un contrôle et vérifier le fichier écrit. Enregistrer à nouveau avec le même nom : le fichier doit être remplacé. Recharger et vérifier la mémorisation du dossier. Retirer l'autorisation dans le navigateur puis vérifier que l'application propose de la redonner lors d'une action explicite et garde son archive IndexedDB même si l'écriture disque échoue. Sur téléphone, Safari ou Firefox, vérifier que le bouton est masqué et que le téléchargement depuis **Dossiers** reste possible.
8. **Gestion de trois contrôles :** dans un profil de test, créer trois contrôles avec des notes, remarques, photos et PDF. Ouvrir **Mes contrôles**, les sélectionner et utiliser **Exporter la sélection (JSON)** ; vérifier que le JSON contient exactement ces trois contrôles, leurs archives et leurs anomalies. Demander leur suppression, annuler et vérifier qu'ils sont tous conservés. Recommencer, vérifier le nombre annoncé, exporter depuis la confirmation et confirmer ensuite la suppression. Les trois contrôles et leurs PDF doivent disparaître ensemble ; leurs anomalies doivent rester dans le suivi avec **contrôle supprimé**. Importer la sauvegarde et vérifier la restauration, sans écraser les données déjà présentes.
9. **Photos seulement et date limite :** sélectionner un contrôle avec des photos de ligne et de commentaires, puis annuler la confirmation de retrait. Vérifier que les photos restent présentes. Confirmer ensuite : les notes, remarques et PDF doivent rester inchangés, les photos doivent disparaître et la fiche doit signaler leur retrait après rechargement. Depuis l'accueil, choisir une date limite avec des contrôles de chaque type avant, le jour même et après cette date ; seuls ceux strictement antérieurs avec des photos doivent être concernés. Vérifier la baisse de l'espace affiché et la conservation des PDF.
10. **Dossiers en masse :** sélectionner plusieurs PDF, vérifier le nombre dans la confirmation, annuler puis confirmer la suppression. Les contrôles et leurs photos doivent rester présents. Vérifier aussi la sauvegarde proposée avant suppression et sa restauration, ainsi que la conservation des copies déjà téléchargées.
11. **1 000 contrôles et affichage mobile :** importer un JSON de test avec 1 000 contrôles fictifs dans un profil jetable. À 320 px de largeur, vérifier que seulement 50 lignes sont affichées, que changer de page, filtrer par immeuble/année/mois et rechercher restent réactifs, et qu'aucune commande ne déborde horizontalement. Sélectionner des contrôles sur deux pages, changer un filtre et vérifier que le compteur garde la sélection ; vider la sélection puis vérifier qu'aucune suppression ne peut être déclenchée sans choix.
12. **Contrôle bureaux complet avec photo :** à 320 px, créer un contrôle puis choisir Bona Créations. Vérifier les champs d'adresse et de concierge vides et en lecture seule, la date modifiable et l'absence de téléphone. Noter les 21 lignes, dont une en 4 ; vérifier le rappel de photo, ajouter une photo et une remarque puis terminer le contrôle. Recharger et vérifier les 21 notes, la photo, la remarque et les fréquences. Télécharger le PDF dans **Dossiers > Contrôle entretien de bureaux > Bona Créations SA – Rolle (A-One) > année** : vérifier les trois titres de zones, les 21 lignes, les fréquences, la photo, le logo et l'absence de numéro de téléphone. Modifier une remarque puis enregistrer : l'unique PDF de ce contrôle doit être remplacé.
13. **Historique bureaux et restauration :** exporter ce contrôle avec son PDF, puis l'importer dans un profil vide et vérifier la checklist, les notes et la photo. Dans une copie de test du catalogue, modifier puis retirer Bona Créations : le contrôle enregistré doit conserver les données et zones initiales. Changer de bureau sur un contrôle commencé doit proposer un nouveau contrôle, préserver les notes et photos de l'ancien et conserver son PDF. Vérifier aussi le rechargement et la génération de PDF bureaux hors connexion.
14. **Création et migration des anomalies :** créer un contrôle avec une ligne notée 4, une remarque et une photo. Revenir au menu puis ouvrir **Suivi des anomalies** : retrouver cette ligne dans **En cours**, avec son bâtiment, sa zone, sa note, sa remarque, sa photo et sa date d'origine. L'ouvrir doit retrouver le bon contrôle. Dans un profil contenant d'anciens contrôles en 3 ou 4, vérifier leur apparition automatique en cours, sans modification des contrôles ni des PDF. Vérifier aussi les filtres de bâtiment et de texte et la séparation entre activités.
15. **Réglage et réouverture :** marquer une anomalie réglée avec une date et une photo de correction. Annuler d'abord et vérifier qu'elle reste en cours. Valider ensuite et la retrouver dans **Réglées**, puis recharger et vérifier la persistance de la date et de la photo. Remettre l'anomalie en cours : elle doit changer d'onglet tout en conservant son dernier réglage. Passer la note du contrôle à 1 ou 2 doit laisser son historique disponible dans le suivi.
16. **Suivi après suppression et sauvegarde :** supprimer le contrôle d'une anomalie réglée ; vérifier que l'anomalie, son relevé et sa photo de correction restent disponibles avec **contrôle supprimé**, après rechargement également. Exporter puis importer dans un profil vide et vérifier leur restauration. Importer un ancien JSON v1 ou v2 doit créer les anomalies en cours. Réimporter une sauvegarde récente doit conserver l'existant et les liens des copies.
17. **Mes contrôles, PDF et espace :** vérifier que la liste apparaît seulement dans **Mes contrôles**, jamais dans le menu ni dans le formulaire. Télécharger un PDF existant depuis sa ligne et vérifier son contenu inchangé ; supprimer seulement l'archive puis télécharger depuis la liste pour vérifier sa régénération. Vérifier les filtres, les 50 lignes par page, les actions individuelles et de masse, ainsi que l'espace occupé par les photos, les PDF et les pièces jointes des anomalies. Ouvrir une fiche puis revenir au menu sans afficher de liste dans le formulaire.
18. **Navigation et anomalies à 320 px hors connexion :** à 320 px, vérifier les deux menus, **Mes contrôles**, les deux onglets d'anomalies et la fenêtre de réglage, sans défilement horizontal et avec des commandes accessibles. Après mise en cache, couper le réseau et ouvrir un nouvel onglet : créer une anomalie avec photo, la régler avec photo de correction, recharger, l'exporter et vérifier la persistance des statuts, la navigation et les téléchargements PDF sans réseau.
19. **Comparaison et PDF :** créer deux contrôles à des dates successives pour le même bâtiment. Noter deux lignes **2** et **3** lors de la première visite, puis **3** et **2** lors de la seconde. Vérifier **Précédent : 2** avec la date et **↓** rouge sur la première ligne, **Précédent : 3** avec **↑** bleu sur la seconde, et aucun repère à note identique. Générer le PDF et vérifier les notes précédentes et la dégradation. Refaire le parcours en bureaux ; aucun contrôle de conciergerie ne doit servir de visite précédente.
20. **Limites de la comparaison :** dans un profil de test, importer une visite antérieure dont un libellé exact est absent, puis vérifier **Nouvelle ligne**. Vérifier une ligne antérieure non notée, un libellé répété dans deux zones, un contrôle sans visite précédente, une visite future exclue et un contrôle rouvert comparé uniquement aux dates antérieures. Créer une seconde visite du jour pour vérifier la comparaison pendant sa création, puis vérifier la règle strictement antérieure après réouverture. Exporter, importer et vérifier la conservation des libellés historiques.
21. **Statistiques et filtres :** prévoir des visites avec des notes **1** et **2** sur leur dernier contrôle : vérifier **1,5** et sa date. Comparer les compteurs avec **Suivi des anomalies**, régler une anomalie puis revenir au tableau de bord : le compteur doit baisser. Vérifier le total de contrôles et la dernière date toutes activités confondues, les trois tris et le clic vers **Mes contrôles** filtré sur le bon site, avec les autres filtres et sélections vidés.
22. **Carte sans contrôle et hors connexion :** dans une copie de test du catalogue, ajouter un site sans visite : sa carte doit afficher **Aucun contrôle**, sans augmenter le nombre de visites ni créer une moyenne. Supprimer le contrôle d'une anomalie ouverte : elle doit rester comptée. À 320 px, vérifier les cartes, les tris et les repères de comparaison sans débordement ; après mise en cache, ouvrir un nouvel onglet hors connexion et vérifier la comparaison, les statistiques et le PDF.

Pour compléter la validation, dupliquer un contrôle et vérifier l'indépendance de la copie. Dans une copie de test du dossier, modifier puis retirer l'entrée de la liste des conciergeries et vérifier que les contrôles existants conservent leurs informations. Replier une section puis imprimer le formulaire en A4 portrait pour vérifier que la structure papier reste complète.

Utiliser des photos de test sans information sensible. Il n'est pas nécessaire de créer des données d'exemple dans l'application utilisée en production.

## Résultats de validation

### Comparaison et tableau de bord

Sur la branche `feat/comparaison-tableau-bord`, **10 groupes de vérifications navigateur ont réussi**, sans échec ni erreur JavaScript, sur Chromium **154.0.8037.57** sous Linux, avec un écran tactile mobile simulé de **320 × 850 px**, la langue `fr-CH` et le fuseau `Europe/Zurich` :

- création de deux visites successives avec photo, affichage de la note précédente et de sa date, dégradation rouge et amélioration bleue ; PDF réel de trois pages avec les notes précédentes, les photos et les repères, puis conservation après rechargement ;
- comparaison pendant la création d'une visite du même jour, recherche strictement antérieure après réouverture ou changement de date, exclusion du contrôle affiché et des visites futures ;
- libellé absent signalé **Nouvelle ligne**, conservation des libellés historiques dans l'export, et moyenne incluant les anciennes lignes notées même si elles ne figurent plus dans le modèle courant ;
- comparaison complète en bureaux, avec zones et fréquences conservées dans le PDF, sans téléphone ; exclusion d'un contrôle de conciergerie même lorsque son identifiant de bâtiment est identique à celui du bureau ;
- moyennes **2,0** en conciergerie et **1,7** en bureaux, synthèse toutes activités confondues, trois tris, anomalies orphelines encore comptées et baisse du compteur après réglage d'une anomalie ;
- carte **Aucun contrôle** sans moyenne ni augmentation des visites ; clic ouvrant **Mes contrôles** avec zéro résultat pour ce bâtiment, plutôt que les contrôles d'un autre site ;
- régression de gestion de masse : trois contrôles sélectionnés puis exportés avec leurs PDF et leur anomalie, annulation sans mutation, sauvegarde préalable sans suppression implicite, puis suppression confirmée des trois contrôles et PDF avec conservation de l'anomalie et de ses photos ; tableau de bord actualisé à zéro contrôle et une anomalie orpheline ouverte ;
- nouvelle page hors connexion après vidage du cache HTTP : comparaison, statistiques et génération du PDF disponibles sans réseau.

Le module de calcul a aussi passé **14 tests de domaine**, couvrant les dates, les types, les libellés exacts et leurs homonymes, les moyennes, les anomalies et les tris. Le générateur PDF a été vérifié séparément sur un document de **cinq pages**, avec 30 lignes, une longue remarque et quatre photos : textes de comparaison, flèches vectorielles, couleurs, pagination et pieds de page. Les vues de menu, tableau de bord et contrôle ont été vérifiées à **320, 480, 700 et 1 024 px**, sans débordement horizontal et avec des boutons d'au moins 44 pixels.

Ces résultats concernent une émulation mobile sur Chromium ; ils ne constituent pas un essai sur téléphone physique, Safari ou Firefox. Les limites historiques des libellés et des comparaisons entre visites du même jour sont décrites plus haut.

### Navigation et suivi des anomalies

Sur la branche `feat/navigation-suivi-anomalies`, **19 vérifications groupées ont réussi** : 15 groupes principaux et quatre régressions ciblées, sans erreur JavaScript. Les tests utilisent Chromium sous Linux, avec un écran tactile mobile simulé de **320 × 850 px**, la langue `fr-CH` et le fuseau `Europe/Zurich` :

- accueil et menus des deux activités avec exactement trois choix, sans création automatique d'un contrôle ; liste visible uniquement dans **Mes contrôles** ;
- nouveaux contrôles de conciergerie de 30 lignes et de bureaux de 21 lignes, notes 4 avec photos, PDF enregistrés et anomalies créées **En cours**, avec zones et séparation des activités ;
- ouverture du contrôle d'origine, annulation du réglage sans effet, date et photo de correction réduite puis conservées après rechargement ; passage dans **Réglées** puis retour **En cours** avec conservation du dernier réglage ;
- modification ultérieure de la note en 2 sans effacer l'anomalie réglée ; suppression du contrôle sans perdre l'anomalie, ses photos ni sa date de réglage, avec mention **contrôle supprimé** ;
- export/import JSON v3 des anomalies réglées et orphelines, photos de correction comprises ; import en doublon avec rattachement aux copies, et statut invalide refusé sans écriture partielle ;
- migration réelle d'IndexedDB v2 vers v3 : anciennes lignes en 3 ou 4 ajoutées au suivi en cours, sans doublon après rechargement ni modification du contrôle ou des octets de son PDF ; import d'un ancien JSON v2 bureaux conservant les zones historiques et le PDF ;
- **Mes contrôles** retrouvant les anciens contrôles et PDF ; téléchargement conservant l'archive existante octet pour octet, ou générant l'archive manquante sans ouvrir le formulaire ;
- sélection de trois contrôles, export ciblé avec leurs PDF et anomalies, annulation sans mutation, sauvegarde proposée puis suppression confirmée des contrôles et PDF ensemble, avec anomalies et photos du suivi conservées ;
- quota simulé pendant la migration : contrôles et PDF inchangés, navigation disponible et export de secours incluant le suivi en mémoire ; régression ciblée vérifiant aussi la conservation d'une anomalie orpheline réglée avec sa photo de correction ;
- nettoyage des photos après une migration bloquée par le quota : copie de preuve de l'anomalie et contrôle nettoyé enregistrés dans la même transaction ; échec d'écriture simulé annulant toute la transaction et préservant photo et PDF d'origine ; nouvelle tentative puis rechargement conservant la preuve photo et le PDF octet pour octet, avec empreintes SHA-256 vérifiées ;
- nouvel onglet et rechargement hors connexion après vidage du cache HTTP : menus, listes, anomalies et photos disponibles depuis le cache de l'application ; téléchargement du PDF et réglage avec photo de correction persistés sans réseau.

Avec **1 000 contrôles, 1 000 PDF et 1 000 anomalies** injectés dans un profil de test, les listes restent limitées à **50 fiches par page**. À 320 px, les filtres immeuble/année/mois, la recherche et la sélection fonctionnent sans défilement horizontal. Les temps mesurés sont **132 ms** pour ouvrir **Mes contrôles**, **52 ms** pour changer de page de contrôles et **112 ms** pour changer de page d'anomalies. Ces mesures concernent cette exécution en émulation mobile ; elles ne représentent ni un téléphone physique ni un test d'import de ce volume.

Les nouvelles vues, les deux onglets et la fenêtre de réglage ont été vérifiés sans débordement horizontal à 320 px. Les validations historiques et les limites de navigateur restent indiquées ci-dessous.

### Contrôles d'entretien de bureaux

Sur la branche `feat/checklists-bureaux`, **15 vérifications automatisées ont réussi** (13 scénarios et deux régressions ciblées), sans erreur JavaScript, avec Chromium **154.0.8037.57** sous Linux. Le navigateur simulait un écran tactile mobile de **320 × 850 px**, avec la langue `fr-CH` et le fuseau `Europe/Zurich` :

- choix obligatoire de Bona Créations, conformité des 21 lignes et des trois zones, fréquences affichées, adresse et concierge vides en lecture seule, date du jour et absence de champ téléphone ;
- contrôle complet **21/21**, dont une note 4 avec rappel non bloquant, une photo de ligne réduite à 1 280 pixels maximum et une photo de commentaires ; **Terminer le contrôle**, rechargement et conservation des notes, remarques et images ;
- PDF archivé puis téléchargé de trois pages, avec les trois titres de zones, les fréquences, 21 croix, le logo et les photos, sans numéro de téléphone ; impression native également vérifiée, sans modification de l'archive ;
- nouvel onglet hors connexion, avec restitution de la checklist et des photos puis génération et téléchargement du PDF sans réseau ;
- export/import JSON v2 de la checklist historique, des notes et photos, avec PDF restauré octet pour octet ; import en doublon sans écraser l'existant, archives rattachées aux copies et marqueur de retrait des photos conservé ;
- catalogues de test avec plusieurs bureaux, checklists indépendantes et bureau sans modèle affichant **Modèle à venir** ; modification puis retrait d'une entrée sans changer le contrôle historique ni son PDF régénéré ;
- changement de bureau annulé sans perte, puis confirmé avec création d'un contrôle distinct ; choix effectué pendant la compression d'une photo, avec attente de sa sauvegarde et conservation sur le bon contrôle en cas d'annulation ;
- création d'un nouveau contrôle pendant la compression, avec photo conservée sur l'ancien contrôle ; import d'une checklist ayant une ligne absente des notes enregistrées, puis affichage et notation de cette ligne sans perte des vingt autres ;
- accueil, contrôle complet et **Dossiers** à 320 px sans débordement horizontal, avec commandes d'au moins 44 pixels ; vérification de la séparation avec les 30 lignes de conciergerie et de la présence de la gestion de masse.

Les bureaux supplémentaires utilisés pour les tests ont été simulés dans le navigateur ; le catalogue livré contient uniquement l'entrée Bona Créations fournie. Ces résultats concernent Chromium en émulation mobile, pas un téléphone physique. Les limites de validation des autres navigateurs et du dossier externe sur ordinateur restent indiquées ci-dessous.

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
