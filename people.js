/* Le nom de la personne est un cliché propre à chaque visite, jamais un
 * changement du catalogue. Ces fonctions restent sans effet sur les données. */
(() => {
  'use strict';

  const text = value => typeof value === 'string' ? value.trim() : '';
  const typeOf = record => record?.type || 'conciergerie';

  function name(record) {
    if (typeOf(record) === 'bureaux' && Object.hasOwn(record || {}, 'cleanerName')) {
      // Une valeur vide explicite ne doit pas faire réapparaître un ancien nom.
      return text(record.cleanerName);
    }
    return text(record?.concierge);
  }

  const display = record => name(record) || 'Non renseigné';
  const label = recordOrType => (typeof recordOrType === 'string' ? recordOrType : typeOf(recordOrType)) === 'bureaux'
    ? 'Nettoyeur/Nettoyeuse' : 'Concierge';

  function sameSite(left, right) {
    const leftId = text(left.buildingId);
    const rightId = text(right.buildingId);
    if (leftId && rightId) return left.buildingId === right.buildingId;
    if (text(left.address) && text(right.address)) return left.address === right.address;
    return Boolean(text(left.buildingName) && text(right.buildingName) && left.buildingName === right.buildingName);
  }

  function previousName(record, records) {
    const values = records instanceof Map ? [...records.values()] : [...(records || [])];
    // La date de visite prime sur la date de modification ; éditer une ancienne
    // visite ne remplace donc pas le nom du dernier contrôle de ce site.
    const compare = (left, right) => String(left || '').localeCompare(String(right || ''));
    const previous = values.filter(candidate => candidate && candidate.id !== record.id &&
      typeOf(candidate) === typeOf(record) && sameSite(record, candidate) && name(candidate))
      .sort((left, right) => compare(right.date, left.date) || compare(right.updatedAt, left.updatedAt) ||
        compare(right.createdAt, left.createdAt) || compare(left.id, right.id))[0];
    return previous ? name(previous) : '';
  }

  window.CONTROL_PEOPLE = Object.freeze({ name, display, label, previousName });
})();
