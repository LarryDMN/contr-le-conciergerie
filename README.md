# Contrôles de conciergerie et d'entretien de bureaux

Application web en français pour remplir un contrôle sur smartphone, tablette ou ordinateur. L'accueil présente deux activités : **Contrôle conciergerie** et **Contrôle entretien de bureaux**. Les données, photos et PDF sont conservés localement dans IndexedDB ; aucun compte ni serveur applicatif n'est requis.

Chaque nouvelle visite de conciergerie utilise la checklist de l'immeuble choisi, définie dans `checklists-conciergeries.js` à la racine : titres de zones en gras, puis lignes dans l'ordre fourni. Un immeuble sans checklist affiche **Checklist à compléter**, sans modèle de remplacement. Les anciens contrôles conservent leur modèle d'origine de 30 lignes. Chaque bureau utilise sa propre checklist définie dans `data/bureaux.js`. Le bureau **Bona Créations SA – Rolle (A-One)** dispose des 21 lignes et des trois zones fournies, avec leur fréquence d'entretien. Chaque ligne permet de choisir une note, d'écrire une remarque et de joindre plusieurs photos. Un bureau sans checklist affiche **Modèle à venir** ; aucune ligne supplémentaire n'est inventée.

L'interface utilise HTML, CSS et JavaScript vanilla. La génération des PDF utilise des copies locales de jsPDF 4.2.1 et de son extension AutoTable 5.0.8, fournies avec leurs licences MIT dans `vendor/` : aucun téléchargement de bibliothèque n'est nécessaire pendant l'utilisation. Leur provenance et leurs intégrités sont décrites dans [vendor/README.md](vendor/README.md).

## Lancer l'application

Conserver l'ensemble du dossier, avec les fichiers suivants à la racine et les sous-dossiers `data` et `vendor` :

- `index.html` : page de l'application ;
- `style.css` : interface mobile et feuille de style d'impression ;
- `app.js` : navigation, formulaire, sauvegarde, photos, dossiers, import et export ;
- `lists.js` : filtres, sélections et pagination des contrôles et des archives ;
- `anomalies.js` : conservation indépendante des anomalies et de leur statut ;
- `people.js` : libellés, noms historiques et pré-remplissage des personnes par site ;
- `insights.js` : comparaison des visites et statistiques locales du tableau de bord ;
- `transfer.js` : périodes d'export et catalogues des sites concernés ;
- `office-model.js` : adaptation et conservation des checklists propres à chaque bureau ;
- `conciergerie-model.js` : adaptation et validation des checklists propres aux conciergeries ;
- `checklists-conciergeries.js` : zones et lignes de chaque immeuble, avec son identifiant comme clé ;
- `pdf.js` : génération des PDF avec le logo et les tableaux du formulaire ;
- `config.js` : pied de page, notes communes et modèle historique des anciens contrôles de conciergerie ;
- `data/conciergeries.js` : informations fixes des conciergeries et nom initial du concierge, utilisé seulement en l’absence d’historique ;
- `data/bureaux.js` : catalogue des bureaux et checklist propre à chacun ;
- `vendor/` : bibliothèques PDF locales et licences ;
- `logo-horizontal.png` : logo utilisé à l'écran et dans le document imprimé ;
- `apple-touch-icon.png`, `icon-192.png` et `icon-512.png` : icônes E.B pour l'écran d'accueil ;
- `manifest.json` : nom et présentation de l'application installée ;
- `sw.js` : cache de l'application pour son utilisation hors connexion.

**Ouverture directe :** ouvrir `index.html` dans un navigateur récent. Le dossier complet reste disponible sans connexion et ne nécessite aucune installation. La prise en charge d'IndexedDB depuis une adresse `file://` varie selon le navigateur ; Safari sur iOS peut notamment la limiter. Vérifier qu'un contrôle est toujours présent après fermeture et réouverture avant d'utiliser ce mode sur le terrain.

**Sur téléphone ou tablette, mode recommandé :** publier ce même dossier sur un hébergement statique HTTPS, par exemple GitHub Pages, puis ouvrir l'adresse de l'application. Aucun backend n'est requis. À la première visite avec connexion, le service worker met en cache les fichiers de l'application, les fichiers de données, le logo et les bibliothèques PDF. Attendre que l'application indique la disponibilité hors connexion, puis vérifier qu'elle se recharge en mode avion. Elle pourra ensuite être rouverte à la même adresse sans réseau, y compris pour enregistrer un PDF. La première visite ne peut pas être faite hors connexion.

Pour un essai sur ordinateur, un serveur statique local suffit, par exemple `python3 -m http.server 8000` lancé depuis ce dossier, puis l'ouverture de `http://localhost:8000`. Le service worker fonctionne sur HTTPS ou sur `localhost`, pas sur une adresse HTTP ordinaire ni sur `file://`. Le serveur statique sert seulement les fichiers : les données restent dans le navigateur.

## Installer sur l'écran d'accueil de l'iPhone

Le nom complet de l'application et le titre de l'onglet sont **Contrôle E. Blanco**. Le nom court **Contrôle E.B**, utilisé sous l'icône de l'iPhone, accompagne le logo E.B. Le manifeste prévoit une ouverture en mode application, sans les barres du navigateur.

1. Si une ancienne icône existe, exporter d'abord une sauvegarde JSON, puis **supprimer cette ancienne icône de l'écran d'accueil**. Ne pas effacer les données du site dans les réglages de Safari.
2. Ouvrir l'adresse **HTTPS** de l'application dans **Safari**, avec connexion, et attendre **Disponible hors connexion**. Les icônes et le manifeste sont aussi mis en cache.
3. Utiliser **Partager > Sur l'écran d'accueil** (ou **Ajouter à l'écran d'accueil**, selon iOS). Conserver le nom proposé **Contrôle E.B** et, si l'option apparaît, **Ouvrir comme app web**, puis toucher **Ajouter**.
4. Ouvrir la nouvelle icône E.B et vérifier les contrôles enregistrés. Tester ensuite une réouverture sans réseau avant une utilisation sur place. Si les données ne sont pas disponibles dans ce mode, restaurer la sauvegarde avec **Importer**.

Supprimer puis réinstaller l'ancienne icône permet à iOS de reprendre le nouveau logo et le nouveau nom. L'installation réelle reste à vérifier sur l'iPhone utilisé ; l'ouverture directe d'un fichier `index.html` ne remplace pas une installation depuis Safari sur HTTPS.

Vérifications techniques réalisées sur Chromium à 320 px, depuis un sous-dossier comme sur GitHub Pages : manifeste reconnu sans erreur, dimensions des icônes conformes et titre stable. Après passage du cache v10 au v11, puis vidage du cache HTTP et ouverture d'un nouvel onglet sans réseau, le manifeste et les trois icônes restent accessibles. Le contrôle et le PDF du profil de test sont conservés à l'identique.

## Structure des pages

L'accueil contient deux cartes simples, une par activité. Les commandes **Dossiers**, **Exporter** et **Importer** sont regroupées à part. Chaque section ouvre un menu de trois choix, identifiés par une icône et un libellé :

- **Nouveau contrôle** : ouvrir directement le formulaire pour commencer une visite ;
- **Suivi des anomalies** : consulter les lignes notées 3 ou 4 et suivre leur réglage ;
- **Mes contrôles** : retrouver les contrôles enregistrés, leurs PDF et les actions de gestion de masse.

Le titre commun indique l'emplacement, par exemple **Contrôle conciergerie > Mes contrôles**. Le bouton **Retour**, toujours au même endroit, permet de revenir à la page précédente ; depuis le menu d'une section ou **Dossiers**, il ramène à l'accueil. Le logo permet aussi de retrouver l'accueil. Le bouton secondaire **Tableau de bord** de l'en-tête ouvre les statistiques de l'activité choisie et laisse les trois choix du menu inchangés.

La liste des contrôles apparaît uniquement dans **Mes contrôles**, avec les filtres, les sélections, la pagination et le retrait des photos anciennes. Le formulaire conserve le choix du site, les notes, remarques, photos et la duplication. Sa progression et la légende des notes restent visibles dans l'en-tête fixe ; **Enregistrer** et **Générer le PDF** restent regroupés en bas de l'écran.

Les pages partagent les couleurs du logo, les tailles de texte et les espacements. Les boutons principaux, secondaires et de suppression ont chacun un style commun. Une suppression est placée en dernier, signalée en rouge et soumise à confirmation. Les commandes tactiles mesurent au moins 44 pixels de haut.

## Remplir un nouveau contrôle

1. Depuis l'accueil, ouvrir **Contrôle conciergerie**, puis appuyer sur **Nouveau contrôle** et choisir une conciergerie dans la liste. Ce choix est obligatoire pour charger la checklist de l'immeuble, noter les lignes, utiliser **Enregistrer** ou générer le PDF. Si aucune checklist n'est définie pour ce site, **Checklist à compléter** est affiché et aucune ligne par défaut n'est ajoutée. L'adresse se remplit automatiquement et reste en lecture seule. Le champ texte **Concierge** est pré-rempli puis reste modifiable pour cette visite. La date du jour est proposée et reste modifiable.
2. Pour chaque élément, choisir **1 — Très bon**, **2 — Bon**, **3 — Moyen** ou **4 — Mauvais**. Une seule note est possible ; appuyer à nouveau sur la note sélectionnée pour la retirer. Les sous-sections ne reçoivent pas de note.
3. Écrire une **Remarque** et ajouter les photos utiles. L'appareil photo du téléphone ou la galerie permettent d'ajouter plusieurs images. Appuyer sur une vignette pour l'agrandir ; utiliser son bouton de suppression pour retirer une photo. Les images sont réduites dans le navigateur, avec une largeur maximale de 1 280 pixels et un encodage JPEG de qualité 0,7.
4. Une note **4 — Mauvais** sans photo affiche un rappel non bloquant. Le modèle demande également une photo pour tous les dégâts et actes de vandalisme, quelle que soit la note.
5. Ajouter, si nécessaire, le texte et les photos de **COMMENTAIRES - REMARQUES**. Les sections peuvent être repliées ; leurs compteurs montrent le nombre de lignes notées. Le résumé final reprend les lignes notées 3 ou 4, leurs remarques et leur nombre de photos.

Chaque modification est sauvegardée automatiquement, y compris le brouillon créé avant de choisir une conciergerie. L'indicateur de sauvegarde permet de vérifier que l'écriture a terminé. **Enregistrer** sauvegarde aussi un PDF dans **Dossiers** ; **Terminer le contrôle** effectue la même sauvegarde et marque la fin du contrôle. **Générer le PDF** actualise aussi l'archive et télécharge le document. La sauvegarde automatique des champs ne régénère pas le PDF à chaque frappe : après une modification, appuyer sur **Enregistrer** pour actualiser le document archivé. En cas d'erreur de stockage, conserver la page ouverte et exporter une copie avant de la quitter.

Dans **Mes contrôles**, la liste est triée par date décroissante et n'affiche que les contrôles de la section choisie, par pages de 50. Le champ `type` vaut `conciergerie` ou `bureaux`. Les contrôles créés avant cette version reçoivent automatiquement le type `conciergerie`, sans perdre leur adresse, notes ou photos.

Chaque ligne de **Mes contrôles** permet d'ouvrir le contrôle, de télécharger son PDF et de le supprimer. **Télécharger le PDF** conserve l'archive existante telle quelle ; si aucune archive n'existe, l'application génère, archive puis télécharge le PDF du contrôle, sans ouvrir son formulaire. Un brouillon sans bâtiment choisi ou sans modèle ne permet pas encore cette génération. Le formulaire conserve la commande de duplication : une copie reprend les notes, remarques et photos, avec la date du jour, et peut être modifiée indépendamment de l'original. Le PDF de la copie sera créé lors de son enregistrement. Supprimer un contrôle, seul ou en sélection, retire aussi son PDF archivé après confirmation ; ses anomalies restent conservées dans le suivi. Supprimer uniquement le PDF dans **Dossiers** conserve le contrôle éditable. Pour récupérer un contrôle supprimé, importer une sauvegarde JSON.

Les anciens contrôles et les anciens exports conservent leur adresse et leur nom d'origine, même s'ils ne sont pas rattachés à la nouvelle liste. Ils restent consultables et leurs notes, remarques, photos et nom restent modifiables sans sélection obligatoire ni migration manuelle. L'adresse reste en lecture seule. Sans nom enregistré, les listes, le suivi des anomalies, le tableau de bord et le PDF affichent **Non renseigné** ; le champ de saisie reste vide.

Dans **Contrôle entretien de bureaux**, créer un contrôle puis choisir le bureau dans la liste déroulante obligatoire. Son adresse vient de `data/bureaux.js` et reste en lecture seule ; la date du jour reste modifiable. Le seul champ de personne s'intitule exactement **Nettoyeur/Nettoyeuse** : c'est un nom libre, sans choix de genre. Ce champ est **obligatoire** pour enregistrer explicitement le contrôle, le terminer ou générer son PDF. La sauvegarde automatique conserve néanmoins un brouillon dont le nom n'est pas encore rempli. Une archive PDF existante reste téléchargeable même si l'ancien contrôle n'a pas de nom. L'adresse de **Bona Créations SA – Rolle (A-One)** est volontairement vide ; il n'est pas nécessaire de la renseigner pour contrôler ce bureau.

Les trois zones **A. Salles – Cuisine (garde-manger) – Terrasse**, **B. Sanitaires – Vestiaires** et **Généralités** contiennent respectivement 9, 9 et 3 lignes. Les notes, remarques, photos, rappels non bloquants pour la note 4, commentaires et sauvegardes fonctionnent comme en conciergerie. La fréquence, par exemple **5x/sem**, est affichée à côté du libellé ; elle sert uniquement d'information et ne conditionne aucune action. Le PDF reprend les titres des zones, les lignes et leurs fréquences, puis est classé dans **Dossiers > Contrôle entretien de bureaux > nom du bureau > année**.

Un bureau dont la propriété `checklist` est vide conserve **Modèle à venir**, sans lignes à noter ni PDF de contrôle à générer. Les listes et sélections de contrôles restent séparées entre les deux activités. Aucun champ de téléphone n'est proposé ni enregistré pour les bureaux ; leur PDF n'affiche pas de numéro de téléphone.

Le contrôle conserve la checklist et les informations du bureau choisies lors de sa création. Modifier ou retirer une entrée du catalogue ne change pas les contrôles historiques. Pour choisir un autre bureau après avoir commencé un contrôle, l'application propose de créer un nouveau contrôle et conserve l'ancien avec ses notes, photos et archive PDF.

## Nom saisi à chaque contrôle

Le site et son adresse viennent du catalogue, tandis que la personne responsable de la visite est enregistrée **sur chaque contrôle** : **Concierge** pour la conciergerie, **Nettoyeur/Nettoyeuse** pour les bureaux. Une modification ne change ni le catalogue ni les noms des autres visites. La date reste modifiable, et l'adresse reste en lecture seule.

Au choix du site sur un nouveau contrôle, l'application propose le dernier **nom non vide** enregistré pour le même immeuble ou bureau, dans la même activité. Les visites sont ordonnées par date de contrôle, puis par date de modification et de création ; cette proposition n'est pas limitée aux visites antérieures à la date que l'on est en train de saisir. Sans historique, une conciergerie reprend le nom initial du catalogue ; un bureau laisse le champ vide. Le nom proposé peut être remplacé librement. Rouvrir un contrôle conserve son propre nom, sans lui appliquer celui d'une visite plus récente.

Les PDF nouvellement générés utilisent **Concierge : [nom]** ou **Nettoyeur/Nettoyeuse : [nom]**. Les PDF déjà archivés restent inchangés jusqu'à une nouvelle génération. **Mes contrôles**, le suivi des anomalies et le tableau de bord utilisent le nom de la visite concernée, avec **Non renseigné** si cette information manque. Le tableau de bord utilise la personne du dernier contrôle du site.

Les exports JSON v4 conservent `concierge` pour la conciergerie et `cleanerName` pour les bureaux ; les relevés d'anomalies conservent aussi ce nom. Les imports v1 à v4 restent acceptés, ces champs étant facultatifs dans les anciens fichiers. Le nom `concierge` des anciens contrôles de bureaux est lu comme nom historique en l'absence de champ `cleanerName`. Une ouverture ou une mise à jour ne réécrit pas tous les contrôles historiques. L'absence de nom reste une absence : aucun nom issu d'un catalogue ne remplace automatiquement celui d'une ancienne fiche.

## Comparer avec la visite précédente

Pendant la saisie, la comparaison recherche un autre contrôle enregistré du **même type** et du **même immeuble ou bureau**. L'identifiant du catalogue permet de reconnaître un bâtiment même si son nom a changé. Les anciens contrôles sans identifiant sont rapprochés par leur nom, ou à défaut leur adresse, à l'identique ; ils ne sont pas fusionnés automatiquement avec un bâtiment du catalogue.

Pour un contrôle rouvert, la visite précédente est celle dont la **date du contrôle est la plus récente, strictement avant la date du contrôle affiché**. Pour un nouveau contrôle, tant que sa date initiale du jour n'est pas modifiée, la dernière visite enregistrée peut aussi dater du même jour. Une date changée manuellement rétablit la recherche strictement antérieure. Le contrôle affiché et les visites datées après lui sont toujours exclus. À date identique, la création la plus récente départage les visites, puis leur dernière modification et leur identifiant. La comparaison affichée pendant une nouvelle visite du même jour peut donc différer après fermeture et réouverture de celle-ci.

Les lignes sont rapprochées par leur **libellé exact**, sans ignorer les accents, la casse ou la ponctuation. Une ligne affiche **Précédent : 2**, par exemple, avec la date de cette visite. Si la note actuelle est plus élevée, **↓** en rouge signale une dégradation ; une note plus faible affiche **↑** en bleu pour une amélioration. À note identique, aucun repère n'est ajouté. Les repères restent informatifs et ne conditionnent ni la notation, ni l'enregistrement, ni la génération du PDF.

Une ligne absente de la visite précédente affiche **Nouvelle ligne**. Une ligne présente mais non notée est signalée comme non notée ; sans visite précédente, aucune note n'est inventée. Si un libellé apparaît plusieurs fois, sa zone départage les lignes lorsque cela donne une correspondance unique. Une ambiguïté restante est signalée sans comparer arbitrairement les notes.

Les nouveaux contrôles des deux activités conservent leurs libellés et leur checklist historique pour la comparaison. Seules les lignes présentes dans les deux visites, avec leur libellé exact, sont comparées ; une modification du catalogue n'ajoute pas de lignes à un contrôle déjà créé. Pour les anciens contrôles de conciergerie sans libellés enregistrés, ceux-ci sont déduits du modèle historique de `config.js` à chaque lecture, jusqu'à une nouvelle sauvegarde de la fiche après modification ou avec **Enregistrer**, ou jusqu'à l'export puis l'import de cette copie. La simple ouverture ne réécrit pas tous les anciens contrôles. L'application ne peut pas retrouver un libellé renommé avant sa conservation. Renommer ensuite une ligne est traité comme une nouvelle ligne si le libellé exact n'existe plus dans la visite précédente.

Le PDF nouvellement généré reprend **Précédent : X**, la date et le repère de dégradation. Une archive PDF existante reste figée jusqu'à son prochain enregistrement explicite. Supprimer ou importer des contrôles peut changer la visite retenue lors d'une comparaison ultérieure ; aucun historique externe ni appel réseau n'est utilisé.

## Consulter le tableau de bord

Dans une section, utiliser **Tableau de bord** dans l'en-tête. Une carte est affichée pour chaque immeuble ou bureau du catalogue, ainsi que pour les bâtiments historiques encore présents dans les contrôles ou le suivi des anomalies. Les cartes de l'autre activité ne sont pas mélangées avec celles de la section ouverte.

Chaque carte indique :

- la **moyenne du dernier contrôle**, calculée uniquement sur ses lignes notées de 1 à 4, arrondie à une décimale avec une virgule, par exemple **1,8** ; une moyenne plus faible correspond à de meilleures notes ;
- le **nombre d'anomalies ouvertes**, issu du même suivi que l'onglet **En cours**, la **date du dernier contrôle** et le **nom enregistré sur ce dernier contrôle**, ou **Non renseigné** ;
- **Aucun contrôle** lorsqu'aucune visite enregistrée n'existe pour ce bâtiment. Ces cartes n'ajoutent aucune visite ni note aux statistiques ; un contrôle présent mais entièrement non noté n'a pas de moyenne.

Par défaut, les cartes sont triées par nombre d'anomalies ouvertes décroissant. Le sélecteur permet aussi un tri par nom ou par date du dernier contrôle, de la plus récente à la plus ancienne. Un clic sur une carte ouvre **Mes contrôles**, filtré sur ce seul bâtiment ; les autres filtres, la page et la sélection précédente sont réinitialisés.

La synthèse **Toutes activités confondues** affiche le nombre total de contrôles enregistrés, le total des anomalies ouvertes et la date du dernier contrôle, conciergerie et bureaux réunis. La date utilisée est celle de la visite, et non l'heure du dernier enregistrement. Les brouillons déjà sauvegardés automatiquement sont des contrôles enregistrés, même s'ils ne contiennent pas encore de note ; les modifications dont l'écriture en base n'a pas réussi n'entrent pas dans ces calculs.

Les anomalies sont comptées d'après leur statut persistant, pas uniquement d'après les notes du dernier contrôle : plusieurs visites peuvent avoir chacune leur anomalie ouverte sur une même ligne. Une anomalie restée ouverte après amélioration de la note ou suppression du contrôle continue de compter jusqu'à son réglage. Le compteur diminue après **Marquer réglée**, et augmente après remise **En cours** ; rouvrir le tableau de bord actualise les chiffres. Un bâtiment sans contrôle restant peut donc conserver des anomalies ouvertes.

Tous les calculs utilisent les données locales enregistrées dans le navigateur. Il n'y a ni synchronisation avec d'autres appareils, ni moyenne globale des bâtiments sans contrôle, ni pondération selon les fréquences d'entretien. Les informations sont disponibles hors connexion une fois l'application mise en cache.

## Suivre les anomalies

Ouvrir **Suivi des anomalies** depuis le menu de la section. Chaque ligne notée **3 — Moyen** ou **4 — Mauvais** produit une anomalie, y compris dans les contrôles enregistrés avant cette version. Les anciennes anomalies commencent en statut **En cours**, sans modification des notes ni des PDF existants. Les anomalies de conciergerie et de bureaux restent séparées.

L'onglet **En cours** est affiché par défaut ; **Réglées** retrouve les anomalies dont le traitement est terminé. Une carte présente l'immeuble ou le bureau, la ligne, sa zone, sa note, sa remarque, ses photos, la date et le **nom enregistré sur le contrôle d'origine**, ou **Non renseigné**. Le nom est conservé avec le relevé, y compris si le contrôle d'origine est ensuite supprimé. Utiliser le filtre de bâtiment ou la recherche par texte pour retrouver une anomalie. La liste est paginée à 50 anomalies par page.

Pour terminer le traitement, utiliser **Marquer réglée**, renseigner la date de réglage et joindre, si utile, une photo de la correction. La photo est facultative et réduite comme les photos de contrôle. Valider déplace l'anomalie dans **Réglées** ; annuler ne change pas son statut. Une anomalie peut ensuite être remise **En cours** : la date et la photo du dernier réglage restent conservées pour son historique.

Le suivi ne se ferme pas automatiquement lorsque la note du contrôle passe à 1 ou 2 ou est retirée : l'anomalie garde son dernier relevé en 3 ou 4 et son statut, jusqu'à une action dans le suivi. Une nouvelle remarque ou photo sur une ligne toujours notée 3 ou 4 actualise son relevé sans effacer un réglage déjà enregistré.

Ouvrir une anomalie permet de consulter le contrôle d'origine. Son statut est enregistré séparément dans le store IndexedDB `anomalies` : supprimer le contrôle ne supprime ni l'anomalie ni ses pièces jointes. Elle reste accessible avec la mention **contrôle supprimé** ; le formulaire d'origine ne peut alors plus être ouvert. Une anomalie réglée n'est jamais supprimée automatiquement.

## Mes contrôles : filtrer et gérer plusieurs contrôles

Dans **Mes contrôles**, chaque fiche affiche le nom enregistré sur sa visite, ou **Non renseigné**. Utiliser les filtres **Immeuble** ou **Bureau**, **Concierge** ou **Nettoyeur/Nettoyeuse**, **Année**, **Mois** et la recherche par texte pour retrouver les contrôles utiles. Le filtre de personne utilise les noms des contrôles enregistrés, sans modifier les catalogues. Les résultats sont paginés : au maximum **50 contrôles par page** sont affichés, y compris lorsque plusieurs milliers sont enregistrés. Les contrôles de conciergerie et de bureaux gardent leurs filtres et leur sélection séparés.

Cocher les contrôles souhaités, ou utiliser **Tout sélectionner sur cette page**. Cette case porte sur les lignes de la page affichée ; elle ne sélectionne pas les autres pages. La sélection est conservée en changeant de page ou de filtre : son compteur peut donc inclure des contrôles qui ne sont plus visibles. Avant une action, vérifier ce compteur ; **Tout désélectionner** permet de vider toute la sélection. Les cases reviennent à vide au rechargement de l'application.

Une sélection fait apparaître trois actions :

- **Exporter la sélection (JSON)** : ouvre la fenêtre de période et de section décrite ci-dessous. Le fichier contient uniquement les contrôles à la fois sélectionnés et compris dans ces critères, avec leurs notes, remarques, photos et anomalies correspondantes. Cocher **Inclure les PDF** pour joindre leurs archives. Ce fichier partiel se restaure avec **Importer**, comme une sauvegarde complète.
- **Supprimer la sélection** : ouvre une confirmation avec le nombre exact de contrôles concernés. Elle permet de les exporter d'abord, d'annuler ou de confirmer la suppression. Confirmer retire les contrôles, leurs photos et leurs PDF de **Dossiers** en une même transaction IndexedDB. Le suivi conserve les anomalies et indique **contrôle supprimé**. Les copies déjà téléchargées ou écrites dans le dossier de l'ordinateur sont conservées.
- **Supprimer les photos de la sélection** : ouvre une confirmation avant de retirer les photos des lignes et des commentaires. Les contrôles, notes, remarques et PDF archivés restent conservés.

**Exporter d'abord (JSON)** depuis la confirmation télécharge directement une sauvegarde des données concernées, **avec leurs PDF, sans filtre de période ni de section**. Cette sauvegarde de sécurité reste distincte de la fenêtre d'export habituelle ; elle ne confirme pas la suppression. Vérifier le téléchargement, puis choisir explicitement **Confirmer la suppression** ou **Annuler**. Une annulation laisse les données en place. Une suppression confirmée se restaure uniquement à partir d'une sauvegarde JSON contenant les données retirées.

## Retirer les photos anciennes

Dans **Mes contrôles**, déplier les options de retrait des photos anciennes, saisir **Contrôles datés avant le**, puis utiliser **Supprimer les photos avant cette date**. Cette action concerne les contrôles **des deux types** dont la **date du contrôle est strictement antérieure** à cette date, et qui contiennent encore des photos. Un contrôle daté du jour limite est conservé avec ses photos. La confirmation indique le nombre exact de contrôles concernés et propose aussi un export préalable.

La suppression des photos conserve les notes, remarques, informations du contrôle et le PDF déjà archivé, qui peut toujours contenir les photos du dernier enregistrement. Une indication historique sur la fiche signale le retrait des photos ; elle ne bloque pas l'ajout de nouvelles photos. **Enregistrer** ou **Générer le PDF** actualise normalement l'archive : après un retrait, cette nouvelle version ne contiendra plus les photos supprimées.

Les photos conservées dans le suivi des anomalies restent indépendantes : retirer celles d'un contrôle ne les retire pas du suivi. Ce maintien permet de comprendre et de traiter une anomalie après nettoyage ou suppression du contrôle d'origine.

## Dossiers et PDF enregistrés

Depuis l'accueil, ouvrir **Dossiers**. Les PDF sont rangés selon **Type > Immeuble > Année**. La recherche permet de retrouver un nom ou une date. Chaque document affiche son nom de fichier et sa date, avec **Télécharger** pour conserver une copie et **Supprimer** pour retirer uniquement cette archive PDF.

Les archives sont également affichées par pages de 50. Cocher plusieurs PDF ou utiliser **Tout sélectionner sur cette page**, puis demander la suppression de la sélection. Comme pour les contrôles, la sélection reste conservée entre pages et recherches ; vérifier son compteur ou vider la sélection avant de changer de tâche. La confirmation indique le nombre exact de PDF, propose une sauvegarde JSON préalable et permet d'annuler. La suppression d'archives dans **Dossiers** garde les contrôles et leurs photos ; les copies du dossier de l'ordinateur et les téléchargements restent conservés.

Chaque clic sur **Enregistrer**, **Terminer le contrôle** ou **Générer le PDF** génère le PDF du contrôle et le stocke dans le store IndexedDB `archives`. Un contrôle possède au maximum un PDF archivé : un nouvel enregistrement remplace le précédent, même si sa date ou son immeuble a changé. Les données et photos éditables du contrôle restent sauvegardées séparément.

Le nom de téléchargement suit `AAAA-MM-JJ_TYPE_IMMEUBLE.pdf`, par exemple `2026-10-13_conciergerie_Prulay-60-62.pdf`. L'année de classement correspond à la date du contrôle. Les caractères incompatibles avec un nom de fichier sont remplacés. Le PDF archivé reflète le dernier enregistrement explicite, qui peut être plus ancien que les dernières modifications sauvegardées automatiquement.

Le document reprend le logo horizontal, le type de contrôle, l'immeuble ou le bureau, l'adresse, le nom sous le libellé **Concierge** ou **Nettoyeur/Nettoyeuse**, la date, les tableaux des sections, les colonnes **1 2 3 4 Remarques**, une croix dans la note choisie et les photos sous leur ligne. Le PDF conciergerie reprend les zones et lignes du modèle enregistré avec cette visite ; celui des bureaux conserve aussi les titres des zones et affiche la fréquence de chaque ligne. Les sections repliées à l'écran restent présentes dans le PDF. Le pied de page de conciergerie conserve la valeur `footer` de `config.js` :

> E. Blanco SA – Route des Jeunes 55 – 1212 Grand-Lancy – Suisse – Tél 022.343.66.07 – info@eblanco.ch – www.eblanco.ch

Le pied de page bureaux est dérivé automatiquement de cette même valeur, sans son segment téléphone. Modifier les coordonnées une seule fois dans `footer` suffit pour les deux activités.

Les bibliothèques PDF sont copiées dans le dépôt : la génération et le téléchargement fonctionnent sans réseau une fois l'application disponible hors connexion. Un PDF est un document figé ; il ne remplace pas un export JSON pour restaurer un contrôle éditable et ses photos.

## Dossier de sauvegarde sur ordinateur (facultatif)

Sur Chrome ou Edge pour ordinateur, le bouton **Choisir le dossier de sauvegarde** peut être affiché si le navigateur fournit l'API File System Access dans le contexte utilisé. Choisir un dossier et autoriser l'écriture : les prochains PDF enregistrés sont aussi écrits dans ce dossier, avec le même nom que leur téléchargement. Chaque contrôle possède son propre sous-dossier, nommé avec son identifiant technique, pour éviter qu'un autre contrôle de même date, type et immeuble écrase son PDF. L'arborescence lisible **Type > Immeuble > Année** reste celle de **Dossiers** dans l'application.

Le dossier choisi est mémorisé dans IndexedDB pour ce navigateur. Si l'autorisation d'écriture est retirée, l'application demande de l'accorder à nouveau lors d'une action explicite. Une erreur d'autorisation ou d'écriture sur disque n'empêche pas le stockage du PDF dans **Dossiers**, où il reste téléchargeable. Un nouvel enregistrement remplace le fichier du contrôle ; si sa date ou son nom d'immeuble a changé, son ancienne copie dans ce sous-dossier est retirée après l'écriture de la nouvelle. Les fichiers d'autres contrôles sont conservés.

Ce bouton est masqué sur téléphone et tablette ainsi que sur Safari, Firefox et les navigateurs sans API compatible. Dans ces cas, utiliser **Télécharger** dans **Dossiers**. HTTPS ou `localhost` est recommandé pour les fonctions nécessitant un contexte sécurisé. Le dossier choisi et son autorisation ne sont pas inclus dans les exports JSON : après import ou changement d'appareil, choisir le dossier à nouveau.

## Sauvegarder et restaurer

### Choisir une période d'export

Depuis l'accueil, utiliser **Exporter**, ou **Exporter la sélection (JSON)** dans **Mes contrôles**. Une fenêtre propose :

- **Du** et **Au**, au format **jour/mois/année** (`19/10/2026`, par exemple). Une date vide ne fixe aucune limite de ce côté. Les deux bornes sont incluses : une fin au `31/10/2026` garde les contrôles datés du 31 octobre. La sélection utilise la **date du contrôle**, pas sa date de création ou de dernière sauvegarde ;
- **Tout**, **Ce mois-ci**, **Les 3 derniers mois**, **Cette année** et **Année précédente**. Les raccourcis utilisent la date locale de l'appareil. Les trois derniers mois correspondent au mois courant et aux deux mois précédents, jusqu'au dernier jour du mois courant : en octobre 2026, du `01/08/2026` au `31/10/2026` ;
- la section **Conciergerie**, **Bureaux** ou **Les deux** ;
- **Inclure les PDF**, décoché au départ pour limiter la taille du fichier. Les photos éditables restent incluses, même sans PDF.

À chaque ouverture, les valeurs proposées sont **Tout**, **Les deux**, et les PDF non inclus. Sans changement, tous les contrôles des deux activités sont exportés avec leurs photos et leur suivi ; **cocher les PDF pour une sauvegarde comprenant aussi les documents archivés**. Un compteur permet de vérifier le contenu avant **Télécharger le JSON**. Une période vide produit un fichier valide avec zéro contrôle ; une date impossible ou une date de début après la fin doit être corrigée avant de télécharger. **Annuler** ou Échap ferme la fenêtre sans modification.

Pour un export de sélection, les critères de période et de section s'ajoutent à la sélection, sans l'élargir : sélectionner trois contrôles puis choisir un mois ne garde que ceux de ces trois contrôles datés dans le mois. La sélection peut contenir des fiches d'autres pages ou masquées par un filtre ; vérifier le compteur du fichier avant de télécharger.

### Contenu du fichier JSON

Les exports utilisent la **version 4**, avec le même identifiant de format que les anciennes sauvegardes. Ils contiennent :

- `controls` : uniquement les contrôles retenus, avec leurs notes, remarques, photos et informations historiques, dont les checklists historiques des conciergeries (`conciergerieSections`) et des bureaux (`officeSections`) ;
- `anomalies` : les anomalies liées aux contrôles retenus, **en cours et réglées**, avec leur date de réglage et leurs photos de correction. L'export général conserve aussi les anomalies dont le contrôle a été supprimé, filtrées selon leur date de contrôle d'origine et leur section ;
- `archives` : les PDF des contrôles retenus seulement si **Inclure les PDF** a été coché, encodés en base64. L'export général conserve aussi les éventuelles archives sans contrôle encore présent, filtrées selon leur date et leur section archivées ;
- `catalogs.conciergeries` et `catalogs.bureaux` : les seuls sites nécessaires aux données exportées, avec leurs coordonnées et, pour les bureaux, leur checklist. Le catalogue complet n'est pas ajouté s'il n'est pas utilisé ;
- `exportedAt` et `exportInfo` : date de création, période (`period.from` / `period.to`, dates ISO ou `null` sans limite), section (`conciergerie`, `bureaux` ou `both`), nombres de contrôles, d'anomalies et de PDF, présence des PDF et portée de l'export. Les champs de comptage sont `controlCount`, `anomalyCount` et `archiveCount` ; `includesPDFs` indique le choix des PDF, et `scope` distingue un export général d'une sélection.

Le nom reprend la période et la section : `export_2026-01-01_au_2026-10-19_conciergerie.json`, par exemple. Sans limite, il devient `export_tout_les-deux.json` ; avec une seule borne, le nom utilise `depuis_...` ou `jusqu-au_...`. Un export partiel n'efface ni ne change aucune donnée du navigateur. Conserver régulièrement ces fichiers hors du navigateur, par exemple dans les fichiers de l'appareil ou sur un support de sauvegarde.

### Importer et choisir le traitement des doublons

**Importer** accepte les fichiers complets et partiels des **versions 1 à 4**. Après le choix du fichier, un résumé indique les contrôles nouveaux, les doublons d'identifiant et ceux qui seront ignorés. Aucune écriture n'est faite avant la confirmation. Pour chaque contrôle déjà présent avec le même identifiant, choisir :

- **Garder l'existant**, proposé par défaut : conserver le contrôle, ses photos, son PDF et ses anomalies ; ignorer les données correspondantes du fichier ;
- **Remplacer** : écrire le contrôle reçu avec le **même identifiant**, ses notes, remarques et photos, ainsi que les anomalies reçues. Un PDF fourni remplace l'archive de ce contrôle ; si le fichier n'en contient pas, **le PDF déjà enregistré est conservé**. Les anciennes anomalies absentes du fichier ne sont pas supprimées automatiquement.

Les commandes **Garder tous les existants** et **Tout remplacer** appliquent le même choix à tous les doublons ; la liste des décisions reste paginée à 50. Vérifier le résumé actualisé puis utiliser **Importer**, ou **Annuler** pour ne rien changer. Réimporter deux fois le même fichier ne crée plus de copies : les contrôles gardent leur identifiant, quel que soit le choix. Pour créer volontairement une nouvelle visite, utiliser **Dupliquer** depuis le formulaire.

Les sites absents des catalogues locaux peuvent être ajoutés depuis les catalogues du fichier ; ils sont mémorisés dans le store IndexedDB `settings`, sans changement de version de la base. Un identifiant de site déjà présent conserve son entrée locale. Les fichiers `data/conciergeries.js` et `data/bureaux.js` ne sont pas réécrits par l'import ; les contrôles gardent leurs informations historiques, et les noms similaires ne sont pas fusionnés automatiquement. Les anciens fichiers sans catalogues restent acceptés. Les anciens exports v1 et v2 reconstituent leurs anomalies en cours à partir des lignes notées 3 ou 4 ; un contrôle sans `type` devient un contrôle de conciergerie.

Un identifiant déjà utilisé dans une autre section ne peut pas être remplacé : choisir **Garder l'existant** pour ce contrôle. Les collisions entre identifiants de suivi et les incohérences entre contrôles, anomalies et archives sont refusées sans écriture. Un brouillon sans site reste exportable, sans créer d'entrée fictive dans le catalogue.

Un fichier invalide est rejeté avant toute écriture, et une erreur d'enregistrement n'applique pas un import partiel. Attendre la fin de l'import avant de fermer la page, puis vérifier **Mes contrôles**, **Dossiers** et les deux onglets du suivi. Importer une période ne supprime jamais les contrôles des autres périodes ou sections. Les exports JSON et leur import fonctionnent hors connexion après la mise en cache de l'application.

Le stockage est propre au navigateur, au profil, à l'appareil et à l'origine de l'application. Changer d'adresse ou de navigateur ne transfère pas les contrôles. Effacer les données du site, utiliser une session privée, perdre l'appareil ou subir une éviction du stockage du navigateur peut faire perdre les données et archives ; une sauvegarde JSON indépendante reste nécessaire. Il n'y a pas de synchronisation automatique entre appareils. Les photos et remarques ne sont envoyées à aucun serveur par l'application ; les exports et PDF peuvent contenir des informations personnelles et doivent être conservés avec soin. Les copies PDF du dossier de l'ordinateur ne restaurent pas les contrôles ni leurs photos éditables.

## Imprimer ou générer un PDF

Ouvrir le contrôle souhaité et utiliser **Générer le PDF** pour actualiser son archive et télécharger directement le document. La mise en page d'impression reste disponible pour imprimer le formulaire au format **A4 portrait** depuis le navigateur, notamment avec `Ctrl+P` sur ordinateur. Les commandes de l'application sont masquées, toutes les sections sont dépliées et les photos restent sous leurs lignes. Selon le navigateur du téléphone, l'impression peut se trouver dans son menu de partage.

Pour imprimer une archive figée, utiliser **Télécharger** dans **Dossiers**, ouvrir le PDF puis l'imprimer. La pagination de l'impression HTML dépend du navigateur et du nombre de photos ; désactiver, si besoin, les en-têtes et pieds de page ajoutés par le navigateur dans ses options d'impression.

## Adapter le formulaire

Modifier `config.js` pour changer le pied de page commun `footer` ou les notes communes. La propriété calculée `officeFooter` retire uniquement le segment téléphone pour les documents de bureaux. Conserver les `sections`, `groups`, `items`, identifiants et libellés du modèle historique de ce fichier : ils servent encore aux anciens contrôles de conciergerie qui ne possèdent pas de checklist enregistrée. Ce modèle n'est plus appliqué aux nouveaux contrôles de conciergerie. Pour leurs zones et lignes, modifier `checklists-conciergeries.js` selon la procédure suivante ; les checklists des bureaux restent dans `data/bureaux.js`.

## Ajouter ou modifier la checklist d'une conciergerie

Ouvrir **`checklists-conciergeries.js` à la racine du dépôt**. Ce fichier contient `const checklistsConciergeries = { ... }` : chaque clé doit être **exactement** l'`id` du site dans `data/conciergeries.js`. Le nom affiché ne suffit pas à établir la correspondance ; ne pas ajouter d'alias ni modifier un identifiant d'immeuble déjà utilisé pour contourner une différence.

1. Repérer l'identifiant exact dans `data/conciergeries.js`, par exemple `lyon-12`.
2. Copier un bloc existant dans l'objet `checklistsConciergeries`, en séparant les blocs par une virgule. Donner à la clé cet identifiant exact et renseigner `nom` avec le nom du modèle fourni.
3. Dans `checklist`, conserver uniquement les zones du modèle de cet immeuble. Chaque zone contient un `titre` et un tableau `lignes` de textes, sans propriété de note ni identifiant à ajouter. Garder l'orthographe, les accents et la ponctuation des libellés ; leur texte exact sert à la comparaison entre visites.
4. Pour modifier une checklist, modifier ses titres ou ses lignes sans changer la clé de l'immeuble. Une clé absente, `checklist: []` ou une checklist sans ligne affiche **Checklist à compléter** : ne pas copier la checklist d'un autre site pour combler ce vide.
5. Publier le fichier avec la mise à jour du cache décrite ci-dessous, recharger avec connexion, puis créer une **nouvelle visite** pour vérifier les zones, le nombre de lignes et le PDF. Un contrôle déjà créé garde sa propre checklist et ne reçoit pas ces modifications.

Extrait du bloc de Lyon 12 : les autres lignes et zones de ce bloc restent à conserver dans le fichier.

```js
"lyon-12": {
  nom: "Lyon 12",
  checklist: [
    {
      titre: "Entretien intérieur – Entrée générale",
      lignes: [
        "Éclairage",
        "Paillasson(s), Tapis",
        "Boîtes aux lettres",
        "Porte-avis",
        "Portes immeuble",
        "Local poubelles",
        "État du sol"
      ]
    }
  ]
}
```

Les titres de zones et les lignes sont conservés sur chaque nouvelle visite dans `conciergerieSections`. Les notes, remarques et photos restent liées aux lignes de ce modèle ; le PDF, l'impression et l'export/import JSON le réutilisent, même si la checklist source change ensuite. Les anciens contrôles sans ce champ gardent les lignes du modèle historique de `config.js`. Ne pas modifier ce modèle historique pour mettre à jour une nouvelle checklist. Les PDF déjà archivés ne sont pas remplacés lors d'une modification de fichier.

Choisir un autre immeuble depuis une visite déjà renseignée propose de créer une nouvelle visite et de conserver l'originale avec ses lignes, notes, photos et PDF. Annuler cette confirmation rétablit l'immeuble sélectionné. Un brouillon vierge peut recevoir la checklist du site choisi.

**Correspondances confirmées :** la checklist d’Edmond-Vaucher 13B & 13C utilise la clé `edmond-vaucher-13b-13c` (36 lignes, six zones), et celle de Route des Jeunes 105B utilise `jeunes-105` (28 lignes, cinq zones). Les 11 clés du fichier correspondent au catalogue. Les identifiants existants restent stables ; le nom et l’adresse du catalogue indiquent désormais « Route des Jeunes 105B ». Les anciennes visites gardent leur nom, leur adresse et leur modèle enregistrés. Un brouillon créé sans checklist reste vide : créer une nouvelle visite pour charger le modèle disponible.

## Ajouter ou modifier un bureau

Ouvrir `data/bureaux.js`, puis **copier le bloc complet** de Bona Créations dans le tableau `const bureaux = [...]`, en séparant les blocs par une virgule. Pour le nouveau bloc :

1. Donner un `id` unique et stable, composé de lettres minuscules, de chiffres et de traits d'union. Ne pas réutiliser l'identifiant d'un bureau retiré.
2. Renseigner `nom` et `adresse` avec les informations fixes réelles du bureau. Une adresse vide reste vide dans le formulaire. Ne pas ajouter de propriété `concierge`, `cleanerName` ou téléphone : le nom de la personne qui nettoie est saisi dans chaque contrôle.
3. Remplacer `checklist` par les seules zones et lignes du modèle fourni pour ce bureau, dans leur ordre. Chaque zone possède `titre` et `lignes` ; chaque ligne possède `libelle` et `frequence`. Par exemple, le bloc fourni utilise la ligne `{ libelle: "Aspiration des sols", frequence: "5x/sem" }`. Les fréquences sont du texte indicatif : aucune règle de planning n'en dépend.
4. Si le modèle n'est pas encore disponible, renseigner `checklist: []`. Le bureau reste sélectionnable et affiche **Modèle à venir** ; ne pas copier les lignes d'un autre bureau pour remplir ce vide.
5. Sauvegarder le fichier, publier la mise à jour du cache comme décrit ci-dessous, puis créer un nouveau contrôle pour vérifier le nom, les champs automatiques, l'ordre des zones et les fréquences.

La structure du catalogue est la suivante ; les points de suspension représentent les données réelles à conserver ou à compléter, pas du JavaScript à copier :

```text
const bureaux = [
  { id, nom, adresse, checklist: [
    { titre, lignes: [ { libelle, frequence }, ... ] }, ...
  ] }, ...
];
```

Pour modifier un bureau, changer les valeurs de son bloc en conservant son `id`. Pour le retirer de la liste des nouveaux contrôles, supprimer ce bloc. Les contrôles enregistrés gardent leur propre exemplaire du nom du bureau, de l'adresse, des zones, des libellés et des fréquences, ainsi que le nom saisi lors de la visite : une modification du catalogue ne remplace pas leur historique. Ces informations sont également incluses dans les exports JSON.

Les identifiants techniques des zones et lignes sont construits par l'application ; il n'est pas nécessaire d'en ajouter au fichier. Les notes, photos, commentaires et PDF sont gérés par la même logique que la conciergerie. Conserver le fichier chargé par une balise `script` classique pour l'ouverture directe et le fonctionnement hors connexion.

## Adapter la liste des conciergeries

La liste se trouve dans `data/conciergeries.js`. Elle contient les **21 sites de conciergerie fournis**, dans leur ordre d'origine : **11 avec Manuel** et **10 avec Joao** comme concierge initial. Cette liste concerne uniquement **Contrôle conciergerie** ; le catalogue et les checklists des bureaux restent dans `data/bureaux.js`.

Exemple d'entrée (conserver les autres blocs lors d'une modification) :

```js
  {
    id: "prulay-60-62",
    nom: "Prulay 60-62",
    adresse: "rue de la Prulay 60-62 – 1217 Meyrin",
    concierge: "Manuel"
  }
```

La propriété `concierge` fournit seulement un nom initial lorsqu'aucune visite précédente du même immeuble ne contient de nom. Le nom reste toujours modifiable dans le formulaire et est enregistré sur le contrôle, sans réécrire ce fichier. Pour ajouter une conciergerie, ajouter un objet contenant les mêmes quatre propriétés et choisir un `id` unique. Pour modifier son nom, son adresse ou son concierge initial, changer la valeur correspondante. Pour retirer une conciergerie de la liste des nouveaux contrôles, supprimer son objet. Conserver les identifiants des entrées déjà utilisées et ne pas réutiliser l'identifiant d'une entrée supprimée pour un autre immeuble.

Prulay conserve son identifiant `prulay-60-62`, son nom et son adresse complète déjà connus. Les nouveaux sites reprennent les libellés fournis, sans ajouter d'adresse ou de code postal non communiqué. La mention « 1x /mois » du parking FTI est conservée dans son libellé ; elle ne déclenche aucune règle de calendrier.

Lors de la sélection, le contrôle conserve son propre exemplaire de l'identifiant, du nom et de l'adresse du site, ainsi que du nom du concierge proposé puis éventuellement modifié. Modifier ou supprimer une entrée du fichier ne remplace pas les informations des contrôles déjà enregistrés ou importés. Créer un nouveau contrôle pour utiliser les données fixes actualisées de la liste ; les anciens contrôles gardent leurs informations historiques. Réaffecter volontairement un contrôle à un autre immeuble n'actualise que ce contrôle, après la confirmation proposée par l'application.

Ce fichier est chargé par une balise `script` classique, sans module JavaScript ni requête à un serveur. Conserver le sous-dossier `data` lors d'une copie ou d'une publication pour que la liste reste disponible en ouverture directe et hors connexion.

Vérifications du catalogue réalisées sous Chromium à 320 px : 21 sites sans doublon, sélection de Prulay avec Manuel et d'Eaux-Vives 4 avec Joao, priorité d'un nom modifié lors de la visite suivante, et bureaux inchangés. Après passage du cache v11 au v12, un contrôle et son PDF historiques du profil de test restent identiques. Un nouvel onglet ouvert sans réseau après vidage du cache HTTP retrouve les 21 sites ; aucun débordement horizontal ni erreur JavaScript n'a été constaté.

## Revue de structure et éléments retirés

La revue a été faite sur `main` avant modification : parcours des sept vues, commandes de navigation, fonctions JavaScript, styles, catalogues, fichiers chargés et cache hors connexion. Aucun fichier applicatif entier ni fonction métier sans appel n'a été identifié. Les deux catalogues contiennent chacun une entrée, sans doublon d'identifiant, de nom ou d'adresse renseignée.

Lors de la revue d'interface précédente, la vérification de reprise sur `main` (`abeef7d`) confirmait les PR n°1 à 7 fusionnées. Les fonctions ci-dessous étaient déjà présentes et ont été conservées, sans nouvelle implémentation :

| Domaine | État dans `main` | Introduction |
| --- | --- | --- |
| Navigation et suivi des anomalies | Trois choix, formulaire existant, statuts persistants, liste uniquement dans **Mes contrôles** | PR n°6 |
| Gestion de masse | Sélection, filtres, export, suppressions confirmées et pagination de 50 | PR n°4 |
| Comparaison précédente | Même site et activité, notes et flèches, nouvelle ligne, PDF | PR n°7 |
| Tableau de bord | Moyenne du dernier contrôle, anomalies ouvertes, dates, tris et accès à la liste filtrée | PR n°7 |

Les éléments suivants ont été retirés ou regroupés :

- **Décoration et textes répétés des pages** : les cartes d'accueil et le menu présentent les destinations directement ; un titre commun indique la section et la page.
- **Navigation répétée** : les commandes de retour disparates sont remplacées par un bouton **Retour** contextuel, placé au même endroit.
- **Ancienne présentation en barre latérale et styles sans élément associé** : retrait de `.sidebar`, `.sidebar-heading`, des anciennes contraintes superposées des listes et des sélecteurs de photos, anomalies ou impression sans élément correspondant. Les contrôles sont exclusivement affichés dans **Mes contrôles** ; la variante `button-quiet` est regroupée dans `button-secondary`.
- **Commandes Importer/Exporter répétées dans le formulaire** : l'import et la sauvegarde complète restent dans l'accueil ; l'export d'une ou plusieurs fiches se fait depuis la sélection de **Mes contrôles**.
- **Bouton d'ouverture répété sur les anomalies** : le titre et le clic sur la carte ouvrent toujours le contrôle d'origine ; le deuxième bouton en bas de carte est retiré.
- **Indicateur d'espace utilisé, ses textes, ses calculs et leurs mises à jour** : suppression complète pour alléger l'interface et les traitements pendant la saisie.
- **Adresse par défaut et numéro de version de `config.js` inutilisés** : l'adresse de Prulay n'est désormais définie que dans `data/conciergeries.js`.
- **Coordonnées répétées du pied de page bureaux** : elles sont calculées depuis le pied de page commun, sans son segment téléphone.
- **Adaptateurs de fonctions sans logique propre et paramètres inactifs** : retrait des fonctions intermédiaires `deleteControl`, `deleteArchive` et `printControl` au profit des appels communs, en conservant leurs boutons ; retrait du rappel `onChange` inutilisé dans les listes et du paramètre inutilisé des statistiques.
- **Traitements répétés** : création des métadonnées d'archive, téléchargement d'un fichier et ouverture d'une photo regroupés ; gestion directe de la date à la place d'une boucle portant sur ce seul champ.

Les listes de bâtiments et leurs coordonnées restent définies une seule fois dans leurs catalogues respectifs. Les informations et modèles copiés dans les contrôles, PDF et anomalies sont des **instantanés historiques nécessaires** : ils restent inchangés si une entrée de catalogue est modifiée ou supprimée. Les libellés répétés dans des zones différentes des checklists restent également présents. Cette précédente réorganisation de l'interface n'a changé ni le schéma IndexedDB ni le format des sauvegardes, et n'a supprimé aucune donnée enregistrée. L'ajout ultérieur des exports par période utilise désormais le format JSON v4 décrit ci-dessus ; la base reste en version 3.

## Publier une mise à jour

Lors d'une publication de nouveaux fichiers, augmenter le suffixe de version de `CACHE_NAME` dans `sw.js` (actuellement `v14`), afin que le cache hors connexion soit remplacé. Si une ressource versionnée change, augmenter également son paramètre de version dans `index.html` et dans la liste `ASSET_URLS` de `sw.js`, par exemple de `?v=14` à `?v=15`, avec le cache `v15`. Garder les paramètres de version synchronisés entre ces deux fichiers évite de charger les anciens fichiers depuis le cache précédent. Le cache `v14` inclut `checklists-conciergeries.js` et `conciergerie-model.js`, avec les autres ressources versionnées en `v14`. Le manifeste et les trois icônes d'installation font aussi partie des fichiers mis en cache.

Si seule la liste `data/conciergeries.js`, le modèle `data/bureaux.js` ou le fichier `checklists-conciergeries.js` change, augmenter au minimum la version du cache dans `sw.js`. Ces mises à jour ne suppriment pas les contrôles dans IndexedDB. Ouvrir la nouvelle version avec connexion, attendre la disponibilité hors connexion, puis recharger la page avec connexion. Vérifier les nouvelles données et le fonctionnement hors ligne avant une visite sur place.

## Scénarios de validation

Ces scénarios sont à exécuter avec un navigateur récent sur l'appareil choisi ; cette liste décrit les vérifications attendues et ne constitue pas un compte rendu de tests.

1. **Accueil, menus et séparation des types :** vérifier les deux grandes cartes de contrôle et l'accès à **Dossiers**. Ouvrir chacune des deux sections : son menu doit contenir exactement **Nouveau contrôle**, **Suivi des anomalies** et **Mes contrôles**, sans liste de contrôles. Dans la section bureaux, utiliser **Nouveau contrôle** et vérifier le choix obligatoire de Bona Créations, les 21 lignes exactes réparties dans les trois zones et les fréquences. Dans une copie de test du catalogue, ajouter un bureau avec `checklist: []` : le choisir doit afficher **Modèle à venir**, sans lignes inventées. Depuis un ancien export v1, importer un contrôle sans `type` : il doit apparaître uniquement dans **Mes contrôles** de conciergerie. Vérifier qu'un contrôle bureaux n'apparaît pas dans la liste conciergerie.
2. **Création, note 4, photo et rechargement :** ouvrir la section conciergerie et créer un contrôle. Avant la sélection, vérifier que la notation, **Enregistrer** et **Générer le PDF** sont indisponibles. Choisir « Prulay 60-62 » ; vérifier l'adresse automatiquement remplie et en lecture seule, le concierge pré-rempli puis modifiable et la date modifiable. Noter « Éclairage » de l'entrée en 1, « État du sol » des paliers en 3 avec « À nettoyer », et « Salissures, graffitis » en 4 avec « Graffiti à retirer ». Vérifier le compteur à 3/30 et le rappel de photo, puis ajouter une photo à la ligne en 4 : le rappel doit disparaître et la vignette doit s'ouvrir. Appuyer sur **Enregistrer**, attendre la confirmation, recharger et rouvrir le contrôle. Vérifier l'immeuble, la date, les notes, les remarques et la photo.
3. **Archive, remplacement et téléchargement :** dans **Dossiers**, retrouver le PDF sous **Conciergerie > Prulay 60-62 > année du contrôle**. Télécharger le document et vérifier son nom, le logo, les cinq tableaux, les croix, les remarques, la photo et le pied de page. Modifier une remarque puis enregistrer de nouveau : une seule archive doit rester pour ce contrôle et son PDF téléchargé doit contenir la modification. Supprimer cette archive et vérifier que le contrôle reste disponible ; le réenregistrer recrée son archive. Vérifier aussi **Terminer le contrôle** sur une copie de test.
4. **Export et import avec PDF :** ouvrir **Exporter**, conserver **Tout / Les deux**, cocher **Inclure les PDF**, puis télécharger et importer le JSON dans un profil vide. Vérifier les types séparés, les notes, les photos et le PDF téléchargeable au bon emplacement. Réimporter le même JSON : le résumé doit annoncer les doublons ; conserver **Garder l'existant**, confirmer et vérifier des nombres et identifiants inchangés, sans copie. Recommencer avec **Remplacer** sur une fiche et vérifier que le même identifiant est actualisé. Vérifier qu'un ancien export sans PDF est toujours accepté.
5. **Téléphone de 320 pixels de large :** ouvrir l'accueil, les deux sections, un contrôle et **Dossiers** avec une largeur d'écran de 320 px. Vérifier l'absence de défilement horizontal, la lisibilité des noms longs et l'accès aux notes, remarques, photos, recherche et boutons de téléchargement/suppression. Pendant le défilement du formulaire, l'en-tête et les actions restent accessibles sans masquer les derniers éléments. Retirer puis remettre une note et replier puis déplier une section pour vérifier que les autres données restent présentes.
6. **Hors connexion :** depuis HTTPS ou `localhost`, attendre l'état hors connexion prêt. Couper le réseau, recharger, modifier une remarque puis enregistrer. Vérifier que l'application, le logo et la liste sont disponibles, que le PDF est généré, qu'il apparaît dans **Dossiers** et qu'il se télécharge sans réseau. Recharger de nouveau et vérifier les données.
7. **Dossier sur ordinateur :** sur Chrome ou Edge compatible, choisir un dossier de test, enregistrer un contrôle et vérifier le fichier écrit. Enregistrer à nouveau avec le même nom : le fichier doit être remplacé. Recharger et vérifier la mémorisation du dossier. Retirer l'autorisation dans le navigateur puis vérifier que l'application propose de la redonner lors d'une action explicite et garde son archive IndexedDB même si l'écriture disque échoue. Sur téléphone, Safari ou Firefox, vérifier que le bouton est masqué et que le téléchargement depuis **Dossiers** reste possible.
8. **Gestion de trois contrôles :** dans un profil de test, créer trois contrôles avec des notes, remarques, photos et PDF. Ouvrir **Mes contrôles**, les sélectionner et utiliser **Exporter la sélection (JSON)** ; conserver **Tout / Les deux**, cocher les PDF et vérifier que le JSON contient exactement ces trois contrôles, leurs archives et leurs anomalies. Demander leur suppression, annuler et vérifier qu'ils sont tous conservés. Recommencer, vérifier le nombre annoncé, exporter depuis la confirmation : la sauvegarde de sécurité doit inclure directement les trois PDF, sans filtre supplémentaire. Confirmer ensuite la suppression. Les trois contrôles et leurs PDF doivent disparaître ensemble ; leurs anomalies doivent rester dans le suivi avec **contrôle supprimé**. Importer la sauvegarde et vérifier la restauration, sans écraser les données déjà présentes.
9. **Photos seulement et date limite :** sélectionner un contrôle avec des photos de ligne et de commentaires, puis annuler la confirmation de retrait. Vérifier que les photos restent présentes. Confirmer ensuite : les notes, remarques et PDF doivent rester inchangés, les photos doivent disparaître et la fiche doit signaler leur retrait après rechargement. Dans **Mes contrôles**, déplier le retrait des photos anciennes et choisir une date limite avec des contrôles de chaque type avant, le jour même et après cette date ; seuls ceux strictement antérieurs avec des photos doivent être concernés. Vérifier la conservation des PDF.
10. **Dossiers en masse :** sélectionner plusieurs PDF, vérifier le nombre dans la confirmation, annuler puis confirmer la suppression. Les contrôles et leurs photos doivent rester présents. Vérifier aussi la sauvegarde proposée avant suppression et sa restauration, ainsi que la conservation des copies déjà téléchargées.
11. **1 000 contrôles et affichage mobile :** importer un JSON de test avec 1 000 contrôles fictifs dans un profil jetable. À 320 px de largeur, vérifier que seulement 50 lignes sont affichées, que changer de page, filtrer par immeuble/année/mois et rechercher restent réactifs, et qu'aucune commande ne déborde horizontalement. Sélectionner des contrôles sur deux pages, changer un filtre et vérifier que le compteur garde la sélection ; vider la sélection puis vérifier qu'aucune suppression ne peut être déclenchée sans choix.
12. **Contrôle bureaux complet avec photo :** à 320 px, créer un contrôle puis choisir Bona Créations. Vérifier l'adresse vide et en lecture seule, le champ libre **Nettoyeur/Nettoyeuse** obligatoire, la date modifiable et l'absence de téléphone. Sans nom, tenter **Enregistrer** : aucun nouveau PDF ne doit être généré. Saisir un nom libre puis poursuivre. Noter les 21 lignes, dont une en 4 ; vérifier le rappel de photo, ajouter une photo et une remarque puis terminer le contrôle. Recharger et vérifier les 21 notes, la photo, la remarque et les fréquences. Télécharger le PDF dans **Dossiers > Contrôle entretien de bureaux > Bona Créations SA – Rolle (A-One) > année** : vérifier les trois titres de zones, les 21 lignes, les fréquences, la photo, le logo et l'absence de numéro de téléphone. Modifier une remarque puis enregistrer : l'unique PDF de ce contrôle doit être remplacé.
13. **Historique bureaux et restauration :** sélectionner ce contrôle, l'exporter en cochant **Inclure les PDF**, puis l'importer dans un profil vide et vérifier la checklist, les notes et la photo. Dans une copie de test du catalogue, modifier puis retirer Bona Créations : le contrôle enregistré doit conserver les données et zones initiales. Changer de bureau sur un contrôle commencé doit proposer un nouveau contrôle, préserver les notes et photos de l'ancien et conserver son PDF. Vérifier aussi le rechargement et la génération de PDF bureaux hors connexion.
14. **Création et migration des anomalies :** créer un contrôle avec une ligne notée 4, une remarque et une photo. Revenir au menu puis ouvrir **Suivi des anomalies** : retrouver cette ligne dans **En cours**, avec son bâtiment, sa zone, sa note, sa remarque, sa photo et sa date d'origine. L'ouvrir doit retrouver le bon contrôle. Dans un profil contenant d'anciens contrôles en 3 ou 4, vérifier leur apparition automatique en cours, sans modification des contrôles ni des PDF. Vérifier aussi les filtres de bâtiment et de texte et la séparation entre activités.
15. **Réglage et réouverture :** marquer une anomalie réglée avec une date et une photo de correction. Annuler d'abord et vérifier qu'elle reste en cours. Valider ensuite et la retrouver dans **Réglées**, puis recharger et vérifier la persistance de la date et de la photo. Remettre l'anomalie en cours : elle doit changer d'onglet tout en conservant son dernier réglage. Passer la note du contrôle à 1 ou 2 doit laisser son historique disponible dans le suivi.
16. **Suivi après suppression et sauvegarde :** supprimer le contrôle d'une anomalie réglée ; vérifier que l'anomalie, son relevé et sa photo de correction restent disponibles avec **contrôle supprimé**, après rechargement également. Exporter **Tout / Les deux**, puis importer dans un profil vide et vérifier leur restauration. Importer un ancien JSON v1 ou v2 doit créer les anomalies en cours. Réimporter une sauvegarde récente avec **Garder l'existant** doit conserver les mêmes contrôles, anomalies et identifiants sans copie.
17. **Mes contrôles et PDF :** vérifier que la liste apparaît seulement dans **Mes contrôles**, jamais dans le menu ni dans le formulaire. Télécharger un PDF existant depuis sa ligne et vérifier son contenu inchangé ; supprimer seulement l'archive puis télécharger depuis la liste pour vérifier sa régénération. Vérifier les filtres, les 50 lignes par page et les actions individuelles et de masse. Ouvrir une fiche puis revenir à la liste sans afficher de liste dans le formulaire.
18. **Navigation et anomalies à 320 px hors connexion :** à 320 px, vérifier les deux menus, **Mes contrôles**, les deux onglets d'anomalies et la fenêtre de réglage, sans défilement horizontal et avec des commandes accessibles. Après mise en cache, couper le réseau et ouvrir un nouvel onglet : créer une anomalie avec photo, la régler avec photo de correction, recharger, l'exporter et vérifier la persistance des statuts, la navigation et les téléchargements PDF sans réseau.
19. **Comparaison et PDF :** créer deux contrôles à des dates successives pour le même bâtiment. Noter deux lignes **2** et **3** lors de la première visite, puis **3** et **2** lors de la seconde. Vérifier **Précédent : 2** avec la date et **↓** rouge sur la première ligne, **Précédent : 3** avec **↑** bleu sur la seconde, et aucun repère à note identique. Générer le PDF et vérifier les notes précédentes et la dégradation. Refaire le parcours en bureaux ; aucun contrôle de conciergerie ne doit servir de visite précédente.
20. **Limites de la comparaison :** dans un profil de test, importer une visite antérieure dont un libellé exact est absent, puis vérifier **Nouvelle ligne**. Vérifier une ligne antérieure non notée, un libellé répété dans deux zones, un contrôle sans visite précédente, une visite future exclue et un contrôle rouvert comparé uniquement aux dates antérieures. Créer une seconde visite du jour pour vérifier la comparaison pendant sa création, puis vérifier la règle strictement antérieure après réouverture. Exporter, importer et vérifier la conservation des libellés historiques.
21. **Statistiques et filtres :** prévoir des visites avec des notes **1** et **2** sur leur dernier contrôle : vérifier **1,5** et sa date. Comparer les compteurs avec **Suivi des anomalies**, régler une anomalie puis revenir au tableau de bord : le compteur doit baisser. Vérifier le total de contrôles et la dernière date toutes activités confondues, les trois tris et le clic vers **Mes contrôles** filtré sur le bon site, avec les autres filtres et sélections vidés.
22. **Carte sans contrôle et hors connexion :** dans une copie de test du catalogue, ajouter un site sans visite : sa carte doit afficher **Aucun contrôle**, sans augmenter le nombre de visites ni créer une moyenne. Supprimer le contrôle d'une anomalie ouverte : elle doit rester comptée. À 320 px, vérifier les cartes, les tris et les repères de comparaison sans débordement ; après mise en cache, ouvrir un nouvel onglet hors connexion et vérifier la comparaison, les statistiques et le PDF.
23. **Repérage et retours :** depuis l'accueil, parcourir le menu puis chaque page des deux activités, le tableau de bord et **Dossiers**. Vérifier les titres **section > page**, les trois choix du menu et les icônes lisibles. Ouvrir une fiche depuis **Mes contrôles**, puis depuis une anomalie : **Retour** doit retrouver la page d'origine. Vérifier l'accès à l'accueil et aux utilitaires JSON. À 320 px, la progression, la légende des notes et les actions de bas d'écran doivent rester accessibles sans défilement horizontal, avec des commandes d'au moins 44 pixels.
24. **Conservation avant/après mise à jour :** dans un profil de test contenant les deux activités, relever le nombre de contrôles, de PDF et d'anomalies, puis exporter les données avant de remplacer les fichiers applicatifs. Après chargement de la nouvelle version et après rechargement, comparer ces nombres et le contenu des contrôles, photos, statuts et PDF. La simple mise à jour de l'interface ne doit ajouter, modifier ni supprimer ces données. Créer ensuite un contrôle complet avec une anomalie et une photo ; le retrouver dans **Mes contrôles** et **Suivi des anomalies**, générer son PDF et répéter le parcours hors connexion.
25. **Période et date de visite :** préparer des contrôles des deux activités le dernier jour du mois précédent, les premier et dernier jours du mois courant, et le premier jour du mois suivant. Donner à l'un d'eux une date d'enregistrement dans un autre mois. Exporter **Ce mois-ci** : seuls les contrôles dont la date de visite appartient au mois doivent être inclus, y compris son dernier jour. Vérifier les choix de section, les bornes manuelles en `jj/mm/aaaa`, les raccourcis d'année et les trois mois calendaires, puis le refus d'une date impossible ou de bornes inversées. Exporter une période sans contrôle : fichier valide, compteur à zéro et aucune erreur.
26. **Tout et contenu ciblé :** exporter **Tout / Les deux** sans PDF et comparer le nombre de contrôles au total des deux listes **Mes contrôles**, filtres vidés. Vérifier les photos, anomalies en cours et réglées, anomalies orphelines, seuls les catalogues utilisés, le bloc `exportInfo` et le nom du fichier. Refaire avec les PDF cochés et vérifier les archives. Dans une sélection de trois contrôles sur plusieurs mois, choisir une période et vérifier l'intersection, sans élargir la sélection.
27. **Import partiel et doublons :** importer un fichier de période dans une application vide, puis le réimporter. Vérifier le résumé avant confirmation, le choix **Garder l'existant** par défaut et l'absence de contrôle supplémentaire. Modifier une note et un statut dans la copie à importer ; **Garder l'existant** doit préserver contrôle, PDF et suivi locaux, tandis que **Remplacer** doit appliquer les données reçues sur le même identifiant. Sans PDF dans le fichier, l'ancien PDF doit rester ; une ancienne anomalie absente du fichier doit aussi rester. Annuler la fenêtre ne doit rien écrire. Vérifier les décisions globales et la pagination avec plus de 50 doublons, les exports anciens v1/v2/v3 et le rejet d'un fichier invalide sans écriture partielle.
28. **Catalogues, mobile et hors connexion :** dans un profil de test, importer un site absent des catalogues livrés : le retrouver dans le choix d'un nouveau contrôle après rechargement. Un identifiant de site déjà présent doit garder son entrée locale et les fiches historiques ne doivent pas changer. À 320 px, vérifier les fenêtres d'export et d'import, les noms longs, les compteurs, les décisions de doublons et les commandes d'au moins 44 pixels sans débordement horizontal. Après mise en cache v14, ouvrir un nouvel onglet hors connexion et répéter un export partiel puis son import.

29. **Noms par visite et reprise historique :** créer deux visites de la même conciergerie à des dates distinctes avec deux noms différents. Créer une troisième visite : le nom non vide du dernier contrôle doit être proposé ; le modifier puis enregistrer, recharger et vérifier son affichage dans **Mes contrôles**, son filtre de nom, le PDF et une anomalie d'origine. Vérifier que les deux premières visites et le catalogue sont inchangés. Sans historique, vérifier le nom initial du catalogue ; une autre conciergerie ne doit pas fournir son nom.
30. **Nettoyeur/Nettoyeuse obligatoire :** à 320 px, créer un contrôle bureaux et vérifier le libellé exact, un seul champ texte et aucun choix de genre. Sans nom, la sauvegarde automatique conserve le brouillon mais **Enregistrer**, **Terminer le contrôle** et la génération d'un nouveau PDF demandent un nom. Saisir un nom libre, noter les lignes, joindre une photo et enregistrer. Vérifier la conservation après rechargement, le PDF avec le bon libellé, le filtre de nom, l'anomalie et le tableau de bord. Une nouvelle visite du même bureau doit proposer ce nom ; le modifier ne change pas la première visite.
31. **Compatibilité, export/import et hors connexion :** importer un ancien contrôle sans nom et vérifier **Non renseigné** dans les listes, le PDF, les anomalies et le tableau de bord ; importer aussi un ancien contrôle bureaux avec son nom dans `concierge`, qui doit rester visible. Télécharger une ancienne archive sans imposer un nouveau nom. Exporter les deux activités puis les importer dans un profil vide : les noms et leurs libellés doivent être conservés. Après mise en cache v14, ouvrir un nouvel onglet hors connexion à 320 px, créer une visite avec un nom modifié et une photo, enregistrer son PDF et vérifier sa persistance, sans débordement horizontal.

32. **Checklists distinctes de conciergerie :** créer un contrôle Lyon 12 et vérifier ses cinq zones et ses 24 lignes, dont « Local poubelles ». Créer un autre contrôle Terroux 4B : vérifier ses six zones et ses 35 lignes, dont « Local poussettes » et le garage. Noter une ligne en 4 avec remarque et photo sur chaque contrôle, enregistrer, recharger, puis vérifier les zones, les photos, le compteur et le PDF propre à chaque immeuble. Aucun modèle ne doit être copié d'un immeuble vers l'autre.
33. **Correspondances et checklist absente :** sélectionner Edmond-Vaucher 13B & 13C et vérifier ses 36 lignes et six zones, puis Route des Jeunes 105B avec 28 lignes et cinq zones. Enregistrer une note et générer leur PDF ; les zones doivent correspondre au site choisi. Sélectionner ensuite un site sans bloc, comme WC Publics Lancy : **Checklist à compléter** doit apparaître sans ligne de remplacement. Les clés inconnues d’un fichier modifié doivent toujours être signalées sans correction automatique.
34. **Comparaison et historique des modèles :** partir d'un ancien contrôle avec le modèle de 30 lignes, une note, une remarque et une photo. Après mise à jour, vérifier ses lignes et son PDF archivés inchangés. Créer deux visites successives de Lyon 12 : vérifier les notes précédentes sur les libellés communs, les flèches d'évolution et **Nouvelle ligne** pour un libellé absent. Dans une copie du fichier, modifier une checklist après enregistrement : les contrôles existants doivent garder leur modèle, et seule une nouvelle visite doit reprendre les changements. Exporter avec PDF puis importer dans un profil vide et vérifier modèles, zones, photos et archives. À 320 px, répéter le parcours dans un nouvel onglet hors connexion, sans débordement horizontal ; vérifier qu'un contrôle de bureaux conserve ses zones et fréquences habituelles.

Pour compléter la validation, dupliquer un contrôle et vérifier l'indépendance de la copie. Dans une copie de test du dossier, modifier puis retirer l'entrée de la liste des conciergeries et vérifier que les contrôles existants conservent leurs informations. Replier une section puis imprimer le formulaire en A4 portrait pour vérifier que la structure papier reste complète.

Utiliser des photos de test sans information sensible. Il n'est pas nécessaire de créer des données d'exemple dans l'application utilisée en production.

Les comptes rendus ci-dessous décrivent les versions testées à leur date, dont l'ancien modèle fixe de conciergerie de 30 lignes. Les scénarios 32 à 34 couvrent les checklists propres à chaque immeuble ; leur présence dans la liste n'annonce pas leur réussite.

## Résultats de validation : checklists des conciergeries

Validation du 20 octobre 2026 sous Chromium en émulation tactile **320 × 780 px** : douze groupes navigateur réussis, sans erreur JavaScript ni débordement horizontal. Lyon affiche ses 24 lignes et cinq zones ; Terroux ses 35 lignes et six zones. Une visite de Lyon avec note 4, remarque et photo conserve ses données après rechargement, et son PDF reprend les zones. Une deuxième visite affiche les améliorations et dégradations dans l'écran et le PDF. Lors de cette validation initiale en v13, les deux clés étaient encore non rattachées et affichaient **Checklist à compléter** ; elles sont désormais alignées sur le catalogue après confirmation des immeubles concernés. Les bureaux conservent leurs 21 lignes et fréquences.

Après passage du cache v12 au v13, le contrôle historique du profil de test et son PDF sont identiques à l'origine (PDF vérifié par SHA-256). Sa réouverture et sa duplication gardent ses 30 lignes, notes et photos. Le changement d'immeuble avec contenu a été annulé puis accepté : l'original reste conservé, et l'acceptation crée une autre visite. L'export puis l'import dans un profil vide conservent modèles, photos, PDF, ancien modèle et modèle explicitement vide. Un nouvel onglet sans réseau après vidage du cache HTTP permet encore de créer une visite Lyon et son PDF.

La comparaison ancien/nouveau Prulay a aussi été vérifiée à l’écran et dans le PDF : « Boîtes aux lettres » conserve la note précédente malgré les nouveaux identifiants ; « Éclairage » est une **Nouvelle ligne** face à l’ancien libellé « Eclairage » ; les homonymes de zones non correspondantes restent sans flèche.

Cinq groupes complémentaires en v14 passent après confirmation des correspondances : Edmond-Vaucher affiche 36 lignes et six zones ; Route des Jeunes 105B affiche 28 lignes et cinq zones. Les noms et chaque titre de zone sont vérifiés dans leurs PDF, et leurs notes persistent après rechargement. La migration v13 → v14 conserve à l'identique l'ancienne visite « Route des Jeunes 105 », son identifiant, ses 30 lignes et son PDF (SHA-256). Un nouvel onglet hors connexion retrouve les 21 sites, les 11 clés reconnues et les deux checklists, sans erreur JavaScript ni débordement à 320 px.

Les **28 tests Node** passent, dont six tests des modèles de conciergeries : fidélité aux listes, identifiants stables, copies indépendantes, clés inconnues, compatibilité bureaux et comparaison par libellé exact avec l'ancien modèle. Pour les relancer : `node --test tests/*.test.cjs`. Ces essais utilisent un navigateur de bureau en émulation mobile, sans test sur un téléphone physique.

## Résultats de validation : noms propres à chaque contrôle

Les essais utilisent Chromium sous Linux, en émulation tactile **320 × 780 px**, avec la date de référence du **19 octobre 2026**. **12 groupes navigateur ont réussi, sans erreur JavaScript** :

- passage de `main` à cette version avec **six contrôles et six PDF strictement identiques**, champs comparés et PDF vérifiés par SHA-256. Les six anomalies ont reçu le nom de leur visite lorsqu'il est disponible, sans perdre leur statut, leur réglage ni leurs preuves ;
- préremplissage du concierge d'après la dernière visite portant un nom, malgré une visite ultérieure vide et une ancienne visite modifiée plus récemment. Modification du nom, contrôle complet de 30 lignes avec photo, rechargement et PDF vérifiés ; les autres visites restent inchangées ;
- un seul champ **Nettoyeur/Nettoyeuse**, libre et obligatoire. Un nom vide ou composé d'espaces empêche **Enregistrer**, **Terminer** et **Générer le PDF**, tout en conservant le brouillon. Contrôle complet de 21 lignes avec photo, noms libres différents sur des visites successives et PDF au bon libellé vérifiés ;
- noms retrouvés dans les listes, le filtre nominatif, la recherche sans accents, les anomalies en cours/réglées et le tableau de bord. L'anomalie conserve son nom après suppression du contrôle source ; une ancienne fiche sans nom affiche **Non renseigné** ;
- export de neuf contrôles, neuf PDF et huit anomalies avec leurs noms ; import dans une base vide, réimport avec **Garder l'existant**, puis remplacement explicite : aucune copie d'identifiant. Imports v1 à v4, noms absents, ancien `concierge` de bureaux et priorité de `cleanerName` vérifiés ;
- les noms saisis ne modifient pas les catalogues. Un ancien champ personnel de catalogue bureaux est accepté puis ignoré ; le nom initial d'une conciergerie reste utilisé lorsqu'aucun historique n'existe ;
- absence de débordement à 320 px et cibles d'au moins 44 px. Après vidage du cache HTTP et ouverture hors connexion, un nouveau contrôle bureaux reprend le nom précédent, accepte sa modification, génère son PDF et conserve le nom après rechargement.

Les **22 tests de domaine** passent également : préremplissage, identité des sites, anciens noms, filtres, statistiques et exports de catalogues. Pour les relancer depuis la racine : `node --test tests/*.test.cjs` (Node.js 18 ou plus récent, aucune dépendance à installer).

Les essais sont automatisés sur Chromium simulé ; Safari, Firefox, un téléphone physique et le sélecteur de dossier système n'ont pas été exécutés dans cette validation.

## Résultats des validations précédentes

Les comptes rendus ci-dessous décrivent les versions antérieures à la saisie du nom par contrôle ; ils ne valident pas cette évolution. Les scénarios actuels ci-dessus incluent les nouveaux champs et leurs règles.

### Export par période et import

Les essais utilisent Chromium sous Linux en émulation tactile de **320 × 780 px**, avec la date de référence du **19 octobre 2026** :

- **Tout** retrouve les dix contrôles du jeu de test, soit huit de conciergerie et deux de bureaux. Les photos, les anomalies ouvertes/réglées et le suivi orphelin restent inclus ; les PDF sont absents au départ, puis présents après activation de l'option. Les catalogues non utilisés sont exclus ;
- **Ce mois-ci** garde quatre contrôles, dont ceux du 1er et du 31 octobre, sans se baser sur leur date de modification. Les trois mois calendaires, l'année courante et l'année précédente donnent les résultats attendus. Une période de 2024 sans contrôle produit un JSON valide avec compteurs à zéro ;
- une sélection est réduite par la période et la section sans ajouter d'autres contrôles. Le nom du fichier, les compteurs et les dates du bloc d'information correspondent au contenu ;
- après tous ces exports, les **dix contrôles, dix PDF et quatre anomalies sources restent identiques**, PDF vérifiés par SHA-256. La sauvegarde directe avant suppression inclut encore les trois contrôles sélectionnés et leurs trois PDF ; son annulation conserve les données ;
- import partiel dans une base vide, puis import du même fichier avec **Garder l'existant** : huit contrôles restent huit, sans copie ni écrasement des notes, photos ou PDF. **Remplacer** conserve l'identifiant et applique les données reçues. Un choix mixte ajoute un contrôle, en garde un et en remplace un autre ; un statut réglé et sa photo de correction sont restaurés. L'absence de PDF reçu conserve les archives existantes ;
- les anciens fichiers complets v1, v2 et v3 restent acceptés, dont un v1 sans type ni rattachement au catalogue. Les fichiers invalides, collisions d'identité et types incohérents sont refusés sans mutation. **Annuler** et Échap laissent les données en place ;
- un bureau absent du catalogue local est restauré avec ses trois zones et 21 lignes, proposé pour un nouveau contrôle après rechargement, puis réexporté sans les sites inutilisés ;
- les deux fenêtres restent utilisables sans débordement à 320 px, avec des cibles d'au moins 44 px. Le titre et le résumé d'import sont visibles dès l'ouverture ;
- après vidage du cache HTTP et ouverture d'un nouvel onglet hors connexion, export JSON, téléchargement d'un PDF existant et génération d'un nouveau PDF fonctionnent.

Un profil distinct de **1 000 contrôles** conserve 50 fiches par page dans **Mes contrôles** et 50 décisions par page dans l'import, soit 20 pages de doublons. Réimporter le fichier avec **Garder l'existant** conserve exactement 1 000 contrôles. Les mesures de cette exécution sur navigateur simulé ne constituent pas une garantie de temps sur téléphone physique. Safari, Firefox et un téléphone physique n'ont pas été exécutés dans cette validation.

Les **12 tests de domaine** vérifient les dates, les bornes, les raccourcis, les sections, les catalogues utiles et les anciens formats de catalogue, y compris le réexport d'un site historique sans création de doublon. Pour les relancer depuis la racine du dépôt : `node --test tests/transfer.test.cjs` (Node.js 18 ou plus récent ; aucune installation de dépendance nécessaire).

## Résultats de validation antérieurs

Les comptes rendus ci-dessous décrivent les versions et branches précédentes ; ils ne constituent pas une validation des nouveaux exports par période. En particulier, les anciennes versions créaient une copie lors d'un import en doublon et joignaient les PDF systématiquement. Ces comportements ont été remplacés par les choix d'import et l'option PDF décrits plus haut. Les nouveaux scénarios 25 à 28 doivent être exécutés séparément.

### Revue de structure et interface épurée

Les vérifications ont utilisé Chromium sous Linux, avec un écran tactile simulé de **320 × 850 px**, la langue `fr-CH` et le fuseau `Europe/Zurich` :

- mise à jour depuis `main` dans le même profil : **7 contrôles avant et après, 4 PDF et 3 anomalies** ; champs enregistrés, notes, photos et statuts identiques, et empreintes SHA-256 des quatre PDF inchangées avant toute création ou suppression de test ;
- parcours des deux activités depuis l'accueil, menus de trois choix, titres **section > page**, retours contextuels, tableau de bord ouvrant une liste filtrée, liste visible uniquement dans **Mes contrôles** et duplication sans modification de l'original ;
- contrôles complets **30/30** en conciergerie et **21/21** en bureaux, chacun avec remarque, anomalie et photo, sauvegarde après rechargement et PDF téléchargé de **trois pages** ; comparaison précédente et repères conservés, zones et fréquences des bureaux présentes et téléphone absent ;
- anomalie retrouvée dans le suivi, ouverture du contrôle puis retour, annulation du réglage sans effet, réglage avec photo de correction et compteur du tableau de bord actualisé ;
- sélection de trois contrôles, export avec leurs PDF, annulation et touche Échap sans modification, export proposé dans la confirmation puis suppression des trois contrôles et PDF ;
- restauration de cette sélection avec les trois PDF identiques par SHA-256 ; exports complets répétés sur `main` et sur la branche, dans des profils isolés et des copies du profil historique, sans différence de contenu métier ;
- **Dossiers** : huit PDF après les opérations du scénario, aperçu, téléchargement d'un ancien PDF identique par SHA-256 et annulation d'une suppression de huit archives sans modification ;
- nouvel onglet hors connexion après vidage du cache HTTP : navigation, comparaison, contrôle, anomalie réglée et photo de correction accessibles ; PDF généré et téléchargé sans réseau, puis neuf contrôles retrouvés après rechargement ;
- nettoyage des photos depuis **Mes contrôles** : date concernant les deux activités, annulation sans effet, retrait sur une sélection avec marqueur persistant ; contrôles, preuves des anomalies et PDF conservés, vérifiés par SHA-256 ;
- aucun débordement horizontal à 320 px, commandes d'au moins 44 pixels, légende et progression visibles pendant le défilement du formulaire, actions fixes en bas ; vues également vérifiées à 700 et 1 024 px.

Le test de charge utilise un profil distinct contenant **1 000 contrôles, 1 000 PDF et 1 000 anomalies**, avec processeur ralenti **×4** et écran de 320 px. Chaque liste conserve au maximum **50 fiches dans le DOM**. Les temps mesurés sont **523 ms** pour ouvrir **Mes contrôles**, **175 ms** pour changer de page de contrôles, **46 ms** pour rechercher, **386 ms** pour changer de page d'anomalies et **160 ms** pour changer de page dans **Dossiers**. Ces mesures concernent cette exécution en émulation et ne garantissent pas les mêmes temps sur un téléphone physique.

Les **17 groupes de vérifications** ont réussi, sans erreur JavaScript. La validation concerne Chromium en émulation mobile ; Safari, Firefox et un téléphone physique n'ont pas été exécutés dans cette revue.

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
- ouverture d'une nouvelle page hors connexion avec accès aux contrôles et export d'une sélection.

La charge de test, injectée dans IndexedDB dans un profil de test, contenait **1 000 contrôles de conciergerie avec une photo chacun**, **5 contrôles de bureaux** et **1 000 PDF légers valides**. L'import depuis l'interface a été vérifié séparément avec cinq contrôles et quatre PDF ; le chargement des 1 000 contrôles ne constitue pas un test d'import de ce volume.

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
