/* Préparation des exports partiels et validation des catalogues importés.
 * Fonctions sans stockage, sans réseau et sans modification des données source. */
(() => {
  'use strict';

  const TYPES = ['conciergerie', 'bureaux'];
  const values = source => source instanceof Map ? [...source.values()] : [...(source || [])];
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const typeOf = record => record.type || 'conciergerie';
  const pad = number => String(number).padStart(2, '0');
  const iso = (year, month, day) => `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
  const daysInMonth = (year, month) => [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

  // La comparaison ISO est fiable seulement après cette validation calendaire.
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
  }

  function parseDate(value) {
    if (typeof value !== 'string') throw new Error('Saisissez une date au format jour/mois/année.');
    const text = value.trim();
    if (!text) return null;
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
      throw new Error('Saisissez une date au format jour/mois/année (JJ/MM/AAAA).');
    }
    const [day, month, year] = text.split('/');
    const result = `${year}-${month}-${day}`;
    if (!validDate(result)) throw new Error('Cette date n’existe pas. Vérifiez le jour, le mois et l’année.');
    return result;
  }

  function formatDate(value) {
    if (value == null || value === '') return '';
    if (!validDate(value)) throw new Error('Date invalide.');
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  function period(preset, today) {
    if (!validDate(today)) throw new Error('Date de référence invalide.');
    const [year, month] = today.split('-').map(Number);
    switch (preset) {
      case 'all': return { from: null, to: null };
      case 'month': return { from: iso(year, month, 1), to: iso(year, month, daysInMonth(year, month)) };
      case 'last3': {
        const firstMonth = year * 12 + month - 3;
        const firstYear = Math.floor(firstMonth / 12);
        if (firstYear < 1) throw new Error('La période choisie dépasse les dates prises en charge.');
        return { from: iso(firstYear, firstMonth % 12 + 1, 1), to: iso(year, month, daysInMonth(year, month)) };
      }
      case 'year': return { from: iso(year, 1, 1), to: iso(year, 12, 31) };
      case 'previous-year':
        if (year <= 1) throw new Error('La période choisie dépasse les dates prises en charge.');
        return { from: iso(year - 1, 1, 1), to: iso(year - 1, 12, 31) };
      default: throw new Error('Raccourci de période inconnu.');
    }
  }

  function options({ from = null, to = null, type = 'both' } = {}) {
    if ((from !== null && !validDate(from)) || (to !== null && !validDate(to))) {
      throw new Error('Période invalide. Vérifiez les dates de début et de fin.');
    }
    if (from && to && from > to) throw new Error('La date « Du » doit précéder la date « Au ».');
    if (type !== 'both' && !TYPES.includes(type)) throw new Error('Section d’export inconnue.');
    return { from, to, type };
  }

  function filter(records, requested = {}) {
    const { from, to, type } = options(requested);
    return values(records).filter(record => (type === 'both' || typeOf(record) === type) &&
      (!from || (validDate(record.date) && record.date >= from)) &&
      (!to || (validDate(record.date) && record.date <= to)));
  }

  function filename(requested = {}) {
    const { from, to, type } = options(requested);
    const range = from && to ? `${from}_au_${to}` : from ? `depuis_${from}` : to ? `jusqu-au_${to}` : 'tout';
    return `export_${range}_${type === 'both' ? 'les-deux' : type}.json`;
  }

  function text(value, name, required = false) {
    if (typeof value !== 'string' || (required && !value.trim())) throw new Error(`${name} invalide dans le catalogue.`);
    return value;
  }

  function noPhone(value) {
    if (!object(value)) return;
    if (Object.keys(value).some(key => /^(tel|telephone|phonenumber|phone|mobile|numerotelephone|numerodetelephone|telephonenumber|numerophone)$/.test(
      key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/gi, '').toLowerCase()))) {
      throw new Error('Le catalogue ne doit pas contenir de numéro de téléphone.');
    }
  }

  function checklist(value) {
    if (!Array.isArray(value)) throw new Error('Checklist de bureau invalide.');
    return value.map(zone => {
      if (!object(zone) || !Array.isArray(zone.lignes)) throw new Error('Zone de bureau invalide.');
      noPhone(zone);
      return { titre: text(zone.titre, 'Titre de zone', true), lignes: zone.lignes.map(line => {
        if (!object(line)) throw new Error('Ligne de bureau invalide.');
        noPhone(line);
        return { libelle: text(line.libelle, 'Libellé de ligne', true), frequence: text(line.frequence, 'Fréquence') };
      }) };
    });
  }

  // Une erreur rejette le lot entier ; seuls les champs métiers autorisés sortent.
  function validateCatalogs(value) {
    if (value === undefined) return { conciergeries: [], bureaux: [] };
    if (!object(value)) throw new Error('Catalogues importés invalides.');
    if (Object.hasOwn(value, 'conciergerie') && Object.hasOwn(value, 'conciergeries')) {
      throw new Error('Le catalogue de conciergeries est défini deux fois.');
    }
    noPhone(value);
    const result = {};
    for (const key of ['conciergeries', 'bureaux']) {
      const source = Object.hasOwn(value, key) ? value[key] : key === 'conciergeries' && Object.hasOwn(value, 'conciergerie')
        ? value.conciergerie : [];
      if (!Array.isArray(source)) throw new Error('Liste de sites invalide dans le catalogue.');
      const identifiers = new Set();
      result[key] = source.map(site => {
        if (!object(site)) throw new Error('Site invalide dans le catalogue.');
        noPhone(site);
        const id = text(site.id, 'Identifiant', true);
        if (identifiers.has(id)) throw new Error('Identifiant répété dans le catalogue.');
        identifiers.add(id);
        // Les anciennes sauvegardes de bureaux peuvent encore porter ce champ.
        // Il est accepté mais n'entre plus dans les informations fixes du site.
        if (site.concierge !== undefined) text(site.concierge, 'Concierge');
        return { id, nom: text(site.nom, 'Nom', true), adresse: text(site.adresse, 'Adresse'),
          ...(key === 'bureaux' ? { checklist: checklist(site.checklist) } : { concierge: site.concierge ?? '' }) };
      });
    }
    return result;
  }

  // Deux empreintes stables évitent de divulguer l’adresse dans un ID historique.
  function fingerprint(value) {
    let first = 2166136261;
    let second = 5381;
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second, 33) ^ code;
    }
    return (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0');
  }

  function historicChecklist(sections) {
    if (!Array.isArray(sections)) return [];
    return sections.map(section => ({ titre: section.title,
      lignes: (section.groups || []).flatMap(group => (group.items || []).map(item => ({
        libelle: item.label, frequence: item.frequency ?? ''
      }))) }));
  }

  function catalogs(records, owners = [], source = {}) {
    const result = { conciergeries: [], bureaux: [] };
    const recordsList = values(records);
    const ownersList = values(owners);
    for (const type of TYPES) {
      const outputKey = type === 'conciergerie' ? 'conciergeries' : 'bureaux';
      const catalog = values(source[type] || (type === 'conciergerie' ? source.conciergeries : []));
      const byId = new Map(catalog.map(site => [site.id, site]));
      const allRecords = recordsList.concat(ownersList).filter(record => typeOf(record) === type);
      const usedIdentifiers = new Set([...byId.keys(), ...allRecords.map(record => record.buildingId).filter(Boolean)]);
      const sites = new Map();
      // Les contrôles priment sur leurs archives/anomalies, moins détaillées.
      // Pour deux clichés d’un site retiré, retenir la visite la plus récente.
      for (const collection of [recordsList, ownersList]) {
        const sorted = collection.filter(record => typeOf(record) === type).slice().sort((left, right) =>
          String(right.date || '').localeCompare(String(left.date || '')) ||
          String(right.createdAt || '').localeCompare(String(left.createdAt || '')) ||
          String(left.id || left.controlId || '').localeCompare(String(right.id || right.controlId || '')));
        for (const record of sorted) {
          const name = typeof record.buildingName === 'string' ? record.buildingName : '';
          const address = typeof record.address === 'string' ? record.address : '';
          const historicKey = JSON.stringify([name, address]);
          const hasId = typeof record.buildingId === 'string' && !!record.buildingId.trim();
          // Un brouillon sans site peut être sauvegardé, sans inventer d’immeuble.
          if (!hasId && !name.trim() && !address.trim()) continue;
          const key = hasId ? `id:${record.buildingId}` : `texte:${historicKey}`;
          if (sites.has(key)) continue;
          const current = hasId ? byId.get(record.buildingId) : null;
          if (current) { sites.set(key, current); continue; }
          let id = hasId ? record.buildingId : `historique-${type}-${fingerprint(historicKey)}`;
          const historicName = name || address || (type === 'bureaux' ? 'Bureau sans nom' : 'Immeuble sans nom');
          let knownHistoricSite;
          if (!hasId) {
            const baseId = id;
            let occurrence = 2;
            while (usedIdentifiers.has(id)) {
              const candidate = byId.get(id);
              // Un catalogue restauré contient déjà ce site historique : son
              // identité reste stable lors des prochains exports/imports.
              if (candidate?.nom === historicName && candidate.adresse === address) {
                knownHistoricSite = candidate;
                break;
              }
              id = `${baseId}-${occurrence++}`;
            }
            usedIdentifiers.add(id);
          }
          sites.set(key, knownHistoricSite || { id, nom: historicName,
            adresse: address,
            ...(type === 'bureaux' ? { checklist: historicChecklist(record.officeSections) }
              : { concierge: '' }) });
        }
      }
      result[outputKey] = [...sites.values()];
    }
    return validateCatalogs(result);
  }

  window.CONTROL_TRANSFER = Object.freeze({ validDate, parseDate, formatDate, period, filter, filename, catalogs, validateCatalogs });
})();
