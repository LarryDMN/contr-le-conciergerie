/* Une checklist de conciergerie appartient à l'immeuble choisi.
 * Le contrôle conserve sa propre copie : modifier le fichier de checklists
 * ne remplace jamais les zones et les lignes d'une visite déjà enregistrée.
 */
(() => {
  "use strict";

  function sections(definition) {
    return window.CHECKLIST_MODEL.sections(definition, {
      prefix: "conciergerie",
      readLine: line => ({ label: line, frequency: "" })
    });
  }

  // Un identifiant inconnu est signalé, jamais rapproché par son nom ou corrigé.
  function unknownKeys(definitions, catalog) {
    const known = new Set((catalog || []).map(site => site.id));
    return Object.keys(definitions || {}).filter(id => !known.has(id));
  }

  window.CONCIERGERIE_MODEL = Object.freeze({
    sections, validateSnapshot: window.CHECKLIST_MODEL.validateSnapshot, unknownKeys
  });
})();
