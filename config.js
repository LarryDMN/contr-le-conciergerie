/* Configuration du formulaire : modifier les libellés ici sans changer la logique.
 * Les identifiants relient les lignes aux contrôles déjà enregistrés : conserver
 * les identifiants existants et choisir un nouvel identifiant pour toute nouvelle ligne.
 */
window.CONCIERGERIE_CONFIG = {
  footer: "E. Blanco SA – Route des Jeunes 55 – 1212 Grand-Lancy – Suisse – Tél 022.343.66.07 – info@eblanco.ch – www.eblanco.ch",
  // Une seule source de coordonnées ; les documents de bureaux excluent le téléphone.
  get officeFooter() {
    return this.footer.split(" – ").filter(segment => !/^t[eé]l[ .:]/i.test(segment.trim())).join(" – ");
  },
  ratings: [
    { value: 1, label: "Très bon" },
    { value: 2, label: "Bon" },
    { value: 3, label: "Moyen" },
    { value: 4, label: "Mauvais" }
  ],
  sections: [
    {
      id: "interieur",
      title: "ENTRETIEN INTÉRIEUR",
      groups: [
        {
          id: "entree",
          title: "ENTRÉE GÉNÉRAL",
          items: [
            { id: "entree-eclairage", label: "Eclairage" },
            { id: "entree-paillassons", label: "Paillasson(s), Tapis" },
            { id: "entree-boites-aux-lettres", label: "Boîtes aux lettres" },
            { id: "entree-porte-avis", label: "Porte-avis" },
            { id: "entree-portes-immeuble", label: "Portes immeuble" },
            { id: "entree-miroirs", label: "Miroirs" },
            { id: "entree-ascenseurs", label: "Ascenseur(s)" },
            { id: "entree-sol", label: "État du sol" }
          ]
        },
        {
          id: "paliers",
          title: "PALIERS",
          items: [
            { id: "paliers-escaliers", label: "Escaliers, balustrade" },
            { id: "paliers-paillassons", label: "Paillassons, tapis" },
            { id: "paliers-cage-ascenseur", label: "Cage de l'ascenseur" },
            { id: "paliers-eclairage", label: "Eclairage" },
            { id: "paliers-sol", label: "État du sol" }
          ]
        },
        {
          id: "sous-sol",
          title: "SOUS-SOL",
          items: [
            { id: "sous-sol-buanderies", label: "Buanderie(s)" },
            { id: "sous-sol-local-nourrice", label: "Local nourrice" },
            { id: "sous-sol-local-devaloir", label: "Local dévaloir" },
            { id: "sous-sol-local-concierge", label: "Local concierge" },
            { id: "sous-sol-tuyauterie", label: "Tuyauterie - isolation" },
            { id: "sous-sol-sol", label: "État du sol" }
          ]
        }
      ]
    },
    {
      id: "facades",
      title: "FAÇADES",
      groups: [
        {
          id: "facades-general",
          title: "ÉTAT GÉNÉRAL",
          items: [
            { id: "facades-salissures", label: "Salissures, graffitis" },
            { id: "facades-vitrages", label: "Vitrages" },
            { id: "facades-balcons", label: "Balcons" },
            { id: "facades-bacs-a-fleurs", label: "Bacs à fleurs" },
            { id: "facades-saut-de-loup", label: "Saut de loup, grille caillebotis" }
          ]
        }
      ]
    },
    {
      id: "exterieur",
      title: "ENTRETIEN EXTÉRIEUR",
      groups: [
        {
          id: "exterieur-general",
          title: "",
          items: [
            { id: "exterieur-cheminement", label: "Cheminement – cour" },
            { id: "exterieur-parking", label: "Parking, marquages" },
            { id: "exterieur-gazon", label: "Gazon" },
            { id: "exterieur-haies", label: "Haies (taille)" },
            { id: "exterieur-arbres", label: "Arbres (taille – élagage)" },
            { id: "exterieur-saut-de-loup", label: "Saut de loup, grille caillebotis" }
          ]
        }
      ]
    }
  ]
};
