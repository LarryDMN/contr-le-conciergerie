/* Catalogue des bureaux : copier un bloc pour ajouter un bureau.
 * Les zones et lignes sont reprises telles quelles dans le contrôle et le PDF.
 * Laisser checklist: [] lorsqu’un modèle n’est pas encore disponible.
 */
const bureaux = [
  {
    id: "bona-creations-rolle-a-one",
    nom: "Bona Créations SA – Rolle (A-One)",
    adresse: "",
    concierge: "",
    checklist: [
      {
        titre: "A. Salles – Cuisine (garde-manger) – Terrasse",
        lignes: [
          { libelle: "Aspiration des sols", frequence: "5x/sem" },
          { libelle: "Lavage des sols avec détergent / dégraissant", frequence: "5x/sem" },
          { libelle: "Balayage humide des sols", frequence: "5x/sem" },
          { libelle: "Nettoyage du sol dans le garde-manger et la pâtisserie", frequence: "5x/sem" },
          { libelle: "Nettoyage du bas des îlots (traces de machine)", frequence: "1x/sem" },
          { libelle: "Marques de doigts sur portes, cadres, vitres, interrupteurs, prises", frequence: "1x/sem" },
          { libelle: "Dépoussiérage des cadres et dessus des portes", frequence: "1x/sem" },
          { libelle: "Contrôle de la fermeture des portes et fenêtres", frequence: "5x/sem" },
          { libelle: "Nettoyage et enlèvement des toiles d'araignées", frequence: "1x/sem" }
        ]
      },
      {
        titre: "B. Sanitaires – Vestiaires",
        lignes: [
          { libelle: "Vider, nettoyer, changer les sacs des corbeilles papier", frequence: "5x/sem" },
          { libelle: "Nettoyage urinoirs, cloisons, tablettes, cuvettes, sièges, brosses et supports", frequence: "5x/sem" },
          { libelle: "Nettoyage lavabos, robinetterie, miroirs et douches", frequence: "5x/sem" },
          { libelle: "Nettoyage des grilles d'aération", frequence: "1x/sem" },
          { libelle: "Aspiration des sols", frequence: "5x/sem" },
          { libelle: "Balayage humide des sols avec détergent", frequence: "5x/sem" },
          { libelle: "Marques de doigts sur portes, cadres, vitres-miroirs, interrupteurs, prises", frequence: "1x/sem" },
          { libelle: "Nettoyage et enlèvement des toiles d'araignées", frequence: "1x/sem" },
          { libelle: "Nettoyage du dessus des armoires dans les vestiaires", frequence: "1x/sem" }
        ]
      },
      {
        titre: "Généralités",
        lignes: [
          { libelle: "Contrôle de la fermeture des portes et fenêtres, extinction des lumières", frequence: "5x/sem" },
          { libelle: "Aération des locaux (si possible)", frequence: "5x/sem" },
          { libelle: "Nettoyage et rangement du matériel", frequence: "5x/sem" }
        ]
      }
    ]
  }
];

// Exposition pour les scripts classiques, y compris à l’ouverture de index.html.
window.BUREAUX = bureaux;
