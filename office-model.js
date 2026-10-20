/* Adaptation des checklists au formulaire commun.
 * Les identifiants dépendent des titres/libellés, jamais de la fréquence ou de
 * la position : déplacer une ligne ou changer sa fréquence conserve son identité.
 * Le contrôle garde une copie de ce modèle pour rester fidèle après une mise à
 * jour du catalogue. Aucun autre champ du catalogue n’entre dans cette copie.
 */
(() => {
  "use strict";

  const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

  // Deux empreintes déterministes évitent les longs identifiants accentués.
  function fingerprint(text) {
    let first = 2166136261;
    let second = 5381;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second, 33) ^ code;
    }
    return (first >>> 0).toString(16).padStart(8, "0") +
      (second >>> 0).toString(16).padStart(8, "0");
  }

  // Les répétitions exactes reçoivent un suffixe, sans déplacer les autres IDs.
  function occurrenceId(prefix, text, occurrences) {
    const count = (occurrences.get(text) || 0) + 1;
    occurrences.set(text, count);
    return `${prefix}-${fingerprint(text)}${count > 1 ? `-${count}` : ""}`;
  }

  // Le format des lignes change selon l'activité ; leur identité et la copie
  // des zones suivent les mêmes règles, sans ajouter de ligne par défaut.
  function adaptSections(definition, { prefix, readLine }) {
    if (!definition || definition.checklist == null) return [];
    if (!Array.isArray(definition.checklist)) throw new Error("Checklist invalide.");
    const zones = new Map();
    const adapted = definition.checklist.map(zone => {
      if (!zone || typeof zone.titre !== "string" || !zone.titre.trim() ||
          !Array.isArray(zone.lignes)) throw new Error("Zone de checklist invalide.");
      const id = occurrenceId(`${prefix}-zone`, zone.titre, zones);
      const lines = new Map();
      const items = zone.lignes.map(line => {
        const { label, frequency } = readLine(line);
        if (typeof label !== "string" || !label.trim() ||
            typeof frequency !== "string") throw new Error("Ligne de checklist invalide.");
        return {
          id: occurrenceId(`${id}-ligne`, label, lines),
          label,
          frequency
        };
      });
      return { id, title: zone.titre, groups: [{ id: `${id}-lignes`, title: "", items }] };
    });
    return validateSnapshot(adapted);
  }

  function sections(office) {
    return adaptSections(office, { prefix: "bureau", readLine: line => ({
      label: line?.libelle, frequency: line?.frequence
    }) });
  }

  // Validation des modèles importés et copie des seuls champs utilisés.
  function validateSnapshot(value) {
    const identifiers = new Set();
    function identifier(id) {
      if (typeof id !== "string" || !ID_PATTERN.test(id) || identifiers.has(id)) {
        throw new Error("Identifiant de modèle invalide ou répété.");
      }
      identifiers.add(id);
      return id;
    }
    function text(value, required = false) {
      if (typeof value !== "string" || (required && !value.trim())) {
        throw new Error("Texte de modèle invalide.");
      }
      return value;
    }
    if (!Array.isArray(value)) throw new Error("Modèle invalide.");
    return value.map(section => {
      if (!section || !Array.isArray(section.groups)) throw new Error("Zone de modèle invalide.");
      const id = identifier(section.id);
      const title = text(section.title, true);
      const groups = section.groups.map(group => {
        if (!group || !Array.isArray(group.items)) throw new Error("Groupe de modèle invalide.");
        const groupId = identifier(group.id);
        const groupTitle = text(group.title);
        const items = group.items.map(item => {
          if (!item) throw new Error("Ligne de modèle invalide.");
          return {
            id: identifier(item.id),
            label: text(item.label, true),
            frequency: text(item.frequency)
          };
        });
        return { id: groupId, title: groupTitle, items };
      });
      return { id, title, groups };
    });
  }

  window.CHECKLIST_MODEL = Object.freeze({ sections: adaptSections, validateSnapshot });
  window.OFFICE_MODEL = Object.freeze({ sections, validateSnapshot });
})();
