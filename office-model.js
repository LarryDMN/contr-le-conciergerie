/* Adaptation des checklists de bureaux au formulaire commun.
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

  function sections(office) {
    if (!office || office.checklist == null) return [];
    if (!Array.isArray(office.checklist)) throw new Error("Checklist de bureau invalide.");
    const zones = new Map();
    const adapted = office.checklist.map(zone => {
      if (!zone || typeof zone.titre !== "string" || !zone.titre.trim() ||
          !Array.isArray(zone.lignes)) throw new Error("Zone de bureau invalide.");
      const id = occurrenceId("bureau-zone", zone.titre, zones);
      const lines = new Map();
      const items = zone.lignes.map(line => {
        if (!line || typeof line.libelle !== "string" || !line.libelle.trim() ||
            typeof line.frequence !== "string") throw new Error("Ligne de bureau invalide.");
        return {
          id: occurrenceId(`${id}-ligne`, line.libelle, lines),
          label: line.libelle,
          frequency: line.frequence
        };
      });
      return { id, title: zone.titre, groups: [{ id: `${id}-lignes`, title: "", items }] };
    });
    return validateSnapshot(adapted);
  }

  // Validation des modèles importés et copie des seuls champs utilisés.
  function validateSnapshot(value) {
    const identifiers = new Set();
    function identifier(id) {
      if (typeof id !== "string" || !ID_PATTERN.test(id) || identifiers.has(id)) {
        throw new Error("Identifiant de modèle de bureau invalide ou répété.");
      }
      identifiers.add(id);
      return id;
    }
    function text(value, required = false) {
      if (typeof value !== "string" || (required && !value.trim())) {
        throw new Error("Texte de modèle de bureau invalide.");
      }
      return value;
    }
    if (!Array.isArray(value)) throw new Error("Modèle de bureau invalide.");
    return value.map(section => {
      if (!section || !Array.isArray(section.groups)) throw new Error("Zone de bureau invalide.");
      const id = identifier(section.id);
      const title = text(section.title, true);
      const groups = section.groups.map(group => {
        if (!group || !Array.isArray(group.items)) throw new Error("Groupe de bureau invalide.");
        const groupId = identifier(group.id);
        const groupTitle = text(group.title);
        const items = group.items.map(item => {
          if (!item) throw new Error("Ligne de bureau invalide.");
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

  window.OFFICE_MODEL = Object.freeze({ sections, validateSnapshot });
})();
