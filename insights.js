/* Calculs locaux de comparaison et de tableau de bord.
 * Ce module ne modifie jamais les contrôles, n'accède pas au réseau et ne
 * confond pas les contrôles de bureaux avec ceux de conciergerie. */
(() => {
  'use strict';

  const TYPES = ['conciergerie', 'bureaux'];
  const values = collection => collection instanceof Map ? [...collection.values()] : [...(collection || [])];
  const typeOf = record => record.type || 'conciergerie';
  const validRating = rating => Number.isInteger(rating) && rating >= 1 && rating <= 4;
  const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
  const compareText = (left, right) => String(left || '').localeCompare(String(right || ''));

  // Un identifiant de catalogue reste stable même lorsque son nom change.
  // Les anciens contrôles sans identifiant sont rapprochés par leur texte exact.
  function siteKey(record) {
    if (typeof record?.buildingId === 'string' && record.buildingId.trim()) return `id:${record.buildingId}`;
    const text = record?.buildingName || record?.address;
    return typeof text === 'string' && text.trim() ? `texte:${text}` : '';
  }

  function newestFirst(left, right) {
    return compareText(right.date, left.date) || compareText(right.createdAt, left.createdAt) ||
      compareText(right.updatedAt, left.updatedAt) || compareText(left.id, right.id);
  }

  function previous(record, records, { isNew = false, defaultDate = '' } = {}) {
    const key = siteKey(record);
    if (!key || !isDate(record?.date)) return null;
    // Deux visites créées aujourd'hui peuvent être comparées pendant la saisie.
    // Une date modifiée, ou un contrôle rouvert, exige une date antérieure.
    const sameDay = isNew && (!defaultDate || record.date === defaultDate);
    return values(records).filter(candidate => candidate.id !== record.id &&
      typeOf(candidate) === typeOf(record) && siteKey(candidate) === key && isDate(candidate.date) &&
      (candidate.date < record.date || (sameDay && candidate.date === record.date)))
      .sort(newestFirst)[0] || null;
  }

  // Le libellé enregistré fait foi. Un ID inchangé ne suffit pas si le texte
  // a été renommé depuis la visite précédente. Une absence dans un cliché
  // explicite n'est jamais remplacée par un libellé du catalogue actuel.
  function descriptors(record, templateFor) {
    const templateItems = new Map();
    const template = templateFor?.(record);
    (template?.sections || []).forEach(section => (section.groups || []).forEach(group =>
      (group.items || []).forEach(item => templateItems.set(item.id, {
        id: item.id, label: item.label, zone: group.title || section.title || ''
      }))));
    const result = [];
    const explicit = Object.hasOwn(record, 'lineLabels');
    Object.keys(record.rows || {}).forEach(id => {
      const source = templateItems.get(id);
      const label = explicit ? record.lineLabels?.[id] : source?.label;
      if (typeof label === 'string' && label) result.push({ id, label, zone: source?.zone || '' });
    });
    return result;
  }

  function compare(record, records, options = {}, templateFor) {
    const prior = previous(record, records, options);
    const byLabel = new Map();
    if (prior) descriptors(prior, templateFor).forEach(item => {
      const matches = byLabel.get(item.label) || [];
      matches.push(item);
      byLabel.set(item.label, matches);
    });
    const byRow = Object.create(null);
    descriptors(record, templateFor).forEach(item => {
      const state = { kind: 'none', rating: null, date: prior?.date || null, direction: null };
      if (!prior) { byRow[item.id] = state; return; }
      let matches = byLabel.get(item.label) || [];
      if (!matches.length) { state.kind = 'new'; byRow[item.id] = state; return; }
      // « État du sol » ou « Aspiration des sols » peut revenir dans plusieurs
      // zones. La zone exacte départage ces homonymes, jamais leur position.
      if (matches.length > 1) matches = matches.filter(candidate => candidate.zone === item.zone);
      if (matches.length !== 1) { state.kind = 'ambiguous'; byRow[item.id] = state; return; }
      const rating = prior.rows[matches[0].id]?.rating;
      state.kind = validRating(rating) ? 'previous' : 'unrated';
      state.rating = validRating(rating) ? rating : null;
      const currentRating = record.rows[item.id]?.rating;
      if (validRating(currentRating) && validRating(rating)) {
        if (currentRating > rating) state.direction = 'worse';
        if (currentRating < rating) state.direction = 'better';
      }
      byRow[item.id] = state;
    });
    return { previousId: prior?.id || null, previousDate: prior?.date || null, byRow };
  }

  function stats({ controls = [], anomalies = [], catalogs = {},
    sort = 'anomalies', type = 'conciergerie' } = {}) {
    const records = values(controls);
    const anomaliesList = values(anomalies);
    const cards = new Map();
    const labelOf = record => record.buildingName || record.address || 'Sans immeuble';
    const cardId = (recordType, key) => `${recordType}\u0000${key}`;
    const ensure = (recordType, key, name) => {
      const id = cardId(recordType, key);
      if (!cards.has(id)) cards.set(id, { key, name, type: recordType, latestDate: null,
        average: null, ratedCount: 0, openAnomalies: 0, hasControl: false, latestPersonName: 'Non renseigné' });
      return cards.get(id);
    };
    TYPES.forEach(recordType => values(catalogs[recordType]).forEach(site => {
      const key = siteKey({ buildingId: site.id, buildingName: site.nom, address: site.adresse });
      if (key) ensure(recordType, key, site.nom || site.adresse || 'Sans immeuble');
    }));
    // Visiter les contrôles les plus récents d'abord choisit le nom historique
    // pertinent pour les sites qui ne figurent plus dans le catalogue.
    const latest = new Map();
    records.slice().sort(newestFirst).forEach(record => {
      const key = siteKey(record);
      const recordType = typeOf(record);
      if (!key || !TYPES.includes(recordType)) return;
      const card = ensure(recordType, key, labelOf(record));
      const id = cardId(recordType, key);
      if (latest.has(id)) return;
      latest.set(id, record);
      card.hasControl = true;
      card.latestDate = isDate(record.date) ? record.date : null;
      card.latestPersonName = window.CONTROL_PEOPLE.display(record);
      // Toutes les notes conservées comptent, même si une ancienne ligne a
      // depuis disparu du catalogue et que son libellé n'est plus disponible.
      const ratings = Object.values(record.rows || {}).map(row => row?.rating).filter(validRating);
      card.ratedCount = ratings.length;
      card.average = ratings.length ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length * 10) / 10 : null;
    });
    anomaliesList.forEach(anomaly => {
      const key = siteKey(anomaly);
      const recordType = typeOf(anomaly);
      if (!key || !TYPES.includes(recordType)) return;
      const card = ensure(recordType, key, labelOf(anomaly));
      if (anomaly.status === 'open') card.openAnomalies += 1;
    });
    const byName = (left, right) => left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' }) ||
      left.key.localeCompare(right.key, 'fr');
    const result = [...cards.values()].filter(card => card.type === type);
    result.sort(sort === 'name' ? byName : sort === 'date'
      ? (left, right) => compareText(right.latestDate, left.latestDate) || byName(left, right)
      : (left, right) => right.openAnomalies - left.openAnomalies || byName(left, right));
    return {
      summary: {
        totalControls: records.length,
        openAnomalies: anomaliesList.filter(anomaly => anomaly.status === 'open').length,
        lastDate: records.filter(record => isDate(record.date)).map(record => record.date).sort().at(-1) || null
      },
      cards: result
    };
  }

  window.CONTROL_INSIGHTS = Object.freeze({ siteKey, previous, compare, stats });
})();
