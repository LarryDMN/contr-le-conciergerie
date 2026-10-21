/* Contrats locaux : fonctions de domaine sans stockage ni modification de source.
 * Les fiches courantes peuvent évoluer ; les visites gardent leurs instantanés.
 */
(() => {
  'use strict';

  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,99}$/;
  const fail = message => { throw new Error(message); };
  const typeOf = site => Object.hasOwn(site || {}, 'cleanerName') ? 'bureaux' : 'conciergerie';

  // Dates calendaires ISO strictes : Date.parse seul accepte certains débordements.
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
  }

  function text(value, label, required = false) {
    if (typeof value !== 'string' || (required && !value.trim())) fail(`${label} invalide dans la fiche immeuble.`);
    return value;
  }

  function identifier(value) {
    if (typeof value !== 'string' || !ID_PATTERN.test(value)) fail('Identifiant d’immeuble invalide.');
    return value;
  }

  function startDate(value) {
    if (value == null || value === '') return '';
    if (!validDate(value)) fail('Date de début de contrat invalide.');
    return value;
  }

  function endDate(value) {
    if (!validDate(value)) fail('Date de fin de contrat invalide.');
    return value;
  }

  function period(value) {
    if (!object(value)) fail('Historique de contrat invalide.');
    const start = startDate(value.startDate);
    const end = endDate(value.endDate);
    if (start && end < start) fail('La fin du contrat doit suivre sa date de début.');
    return { startDate: start, endDate: end };
  }

  // Les fréquences restent propres aux bureaux ; aucune ligne n’est inventée.
  function checklist(value, type) {
    if (value === undefined) return [];
    if (!Array.isArray(value)) fail('Checklist d’immeuble invalide.');
    return value.map(zone => {
      if (!object(zone) || !Array.isArray(zone.lignes)) fail('Zone de checklist invalide.');
      return { titre: text(zone.titre, 'Titre de zone', true), lignes: zone.lignes.map(line => {
        if (type === 'conciergerie') return text(line, 'Libellé de ligne', true);
        if (!object(line)) fail('Ligne de bureau invalide.');
        return { libelle: text(line.libelle, 'Libellé de ligne', true),
          frequence: text(line.frequence ?? '', 'Fréquence') };
      }) };
    });
  }

  function person(site, type = typeOf(site)) {
    const value = type === 'bureaux' && Object.hasOwn(site || {}, 'cleanerName')
      ? site.cleanerName : site?.concierge;
    return typeof value === 'string' ? value.trim() : '';
  }

  // Une copie ne contient que les champs utilisés : aucun téléphone ni photo.
  function validateSite(value, type = typeOf(value)) {
    if (!object(value) || !['conciergerie', 'bureaux'].includes(type)) fail('Fiche immeuble invalide.');
    const status = value.status ?? 'active';
    if (!['active', 'archived'].includes(status)) fail('Statut de contrat invalide.');
    const start = startDate(value.startDate);
    const end = value.endDate == null || value.endDate === '' ? null : endDate(value.endDate);
    if (status === 'archived' && !end) fail('Un contrat archivé doit avoir une date de fin.');
    if (status === 'active' && end) fail('Un contrat actif ne peut pas avoir de date de fin courante.');
    if (start && end && end < start) fail('La fin du contrat doit suivre sa date de début.');
    if (value.contractHistory !== undefined && !Array.isArray(value.contractHistory)) fail('Historique de contrat invalide.');
    if (value.mergedIds !== undefined && !Array.isArray(value.mergedIds)) fail('Identifiants fusionnés invalides.');
    const id = identifier(value.id);
    const mergedIds = (value.mergedIds || []).map(identifier);
    if (mergedIds.includes(id) || new Set(mergedIds).size !== mergedIds.length) fail('Identifiant fusionné répété.');
    const nameField = type === 'bureaux' ? 'cleanerName' : 'concierge';
    const name = type === 'bureaux' && !Object.hasOwn(value, 'cleanerName') ? value.concierge : value[nameField];
    return { id, nom: text(value.nom, 'Nom', true), adresse: text(value.adresse ?? '', 'Adresse'),
      [nameField]: text(name ?? '', type === 'bureaux' ? 'Nettoyeur/Nettoyeuse' : 'Concierge'),
      client: text(value.client ?? '', 'Client'), status, startDate: start, endDate: end,
      contractHistory: (value.contractHistory || []).map(period),
      checklist: checklist(value.checklist, type), mergedIds };
  }

  // La validation termine tout le lot avant que l’appelant l’écrive dans la base.
  function validateCatalogs(value) {
    if (value === undefined) return { conciergeries: [], bureaux: [] };
    if (!object(value)) fail('Catalogues de contrats invalides.');
    const result = {};
    for (const [key, type] of [['conciergeries', 'conciergerie'], ['bureaux', 'bureaux']]) {
      const source = value[key] ?? [];
      if (!Array.isArray(source)) fail('Liste des immeubles invalide.');
      const known = new Set();
      result[key] = source.map(site => {
        const copy = validateSite(site, type);
        for (const id of [copy.id, ...copy.mergedIds]) {
          if (known.has(id)) fail('Un identifiant d’immeuble est répété dans cette section.');
          known.add(id);
        }
        return copy;
      });
    }
    return result;
  }

  function seeds({ conciergeries = [], bureaux = [], checklists = {} } = {}) {
    return validateCatalogs({
      conciergeries: conciergeries.map(site => ({ ...site,
        checklist: checklists[site.id]?.checklist ?? site.checklist ?? [] })),
      bureaux
    });
  }

  function normalizeText(value) {
    return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^\p{L}\p{N}]/gu, '');
  }

  function sameSite(left, right) {
    const leftAddress = normalizeText(left?.adresse);
    const rightAddress = normalizeText(right?.adresse);
    // Un même client peut avoir plusieurs adresses portant le même nom.
    if (leftAddress && rightAddress) return leftAddress === rightAddress;
    const leftName = normalizeText(left?.nom);
    return Boolean(leftName && leftName === normalizeText(right?.nom));
  }

  function duplicates(draft, sites, excludeId = draft?.id) {
    return (sites || []).filter(site => site.id !== excludeId && sameSite(draft, site));
  }

  // Les groupes relient les fiches correspondantes sans les modifier. Les
  // index évitent une comparaison de toutes les paires pour les grands catalogues.
  function duplicateGroups(sites) {
    const values = sites || [];
    const parents = values.map((_, index) => index);
    const find = index => {
      while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; }
      return index;
    };
    const unite = (left, right) => { parents[find(right)] = find(left); };
    const addresses = new Map();
    const names = new Map();
    values.forEach((site, index) => {
      const address = normalizeText(site.adresse);
      const name = normalizeText(site.nom);
      if (address) {
        if (addresses.has(address)) unite(index, addresses.get(address));
        else addresses.set(address, index);
      }
      if (!name) return;
      if (!names.has(name)) names.set(name, { indices: [], missingAddress: null });
      const group = names.get(name);
      if (!address && group.missingAddress === null) {
        group.indices.forEach(previous => unite(index, previous));
        group.missingAddress = index;
      } else if (group.missingAddress !== null) unite(index, group.missingAddress);
      group.indices.push(index);
    });
    const groups = new Map();
    values.forEach((site, index) => {
      const key = find(index);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(site);
    });
    return [...groups.values()].filter(group => group.length > 1);
  }

  function archive(site, date) {
    const copy = validateSite(site);
    if (copy.status !== 'active') fail('Ce contrat est déjà archivé.');
    const closed = period({ startDate: copy.startDate, endDate: date });
    copy.status = 'archived';
    copy.endDate = closed.endDate;
    copy.contractHistory.push(closed);
    return copy;
  }

  function reactivate(site, date) {
    const copy = validateSite(site);
    if (copy.status !== 'archived') fail('Cet immeuble existe déjà et est actif');
    if (!validDate(date)) fail('Date de début de contrat invalide.');
    if (copy.endDate && date < copy.endDate) fail('La reprise doit suivre la fin du contrat précédent.');
    const previous = { startDate: copy.startDate, endDate: copy.endDate };
    // Les vieux imports peuvent porter une date de fin sans période historique.
    const last = copy.contractHistory[copy.contractHistory.length - 1];
    if (!last || last.startDate !== previous.startDate || last.endDate !== previous.endDate) {
      copy.contractHistory.push(previous);
    }
    copy.status = 'active';
    copy.startDate = date;
    copy.endDate = null;
    return copy;
  }

  const sections = [['conciergeries', 'conciergerie'], ['bureaux', 'bureaux']];
  const unique = values => [...new Set(values)];
  const same = (left, right) => Boolean(left && right && JSON.stringify(left) === JSON.stringify(right));
  const keyFor = type => type === 'conciergerie' ? 'conciergeries' : type === 'bureaux' ? 'bureaux'
    : fail('Section de contrats inconnue.');

  // Les alias d'une fusion locale priment sur une sauvegarde plus ancienne.
  // Le résultat complet est validé avant que l'appelant commence sa transaction.
  function importCatalogs(current, incoming, initial, { replace = false } = {}) {
    const catalogs = validateCatalogs(current);
    const imported = validateCatalogs(incoming);
    const defaults = validateCatalogs(initial);
    let added = 0;
    let updated = 0;
    let kept = 0;
    for (const [key, type] of sections) {
      const baseline = new Map(defaults[key].map(site => [site.id, site]));
      for (const site of imported[key]) {
        const values = catalogs[key];
        const aliasOwner = values.find(local => local.mergedIds.includes(site.id));
        if (aliasOwner) { kept += 1; continue; }
        const local = values.find(value => value.id === site.id);
        if (local && !replace && !same(local, baseline.get(local.id))) { kept += 1; continue; }
        const candidate = validateSite({ ...site, mergedIds: unique([
          ...(local?.mergedIds || []), ...site.mergedIds
        ]) }, type);
        // Une sauvegarde fusionnée peut remplacer les fiches de départ encore
        // intactes ; une fiche locale modifiée nécessite le choix Remplacer.
        const sources = values.filter(value => value.id !== candidate.id && candidate.mergedIds.includes(value.id));
        for (const source of sources) {
          if (!replace && !same(source, baseline.get(source.id))) {
            fail(`La fusion importée concerne « ${source.nom} », modifié sur cet appareil. Choisissez Remplacer pour importer cette fusion.`);
          }
          candidate.mergedIds = unique([...candidate.mergedIds, source.id, ...source.mergedIds]);
        }
        const removed = new Set(sources.map(source => source.id));
        for (const alias of candidate.mergedIds) {
          const owner = values.find(value => value.mergedIds.includes(alias));
          if (owner && owner.id !== candidate.id && !removed.has(owner.id)) {
            fail(`L’identifiant « ${alias} » appartient déjà à une fusion locale. Importez la fiche existante sans défaire cette fusion.`);
          }
        }
        catalogs[key] = values.filter(value => value.id !== candidate.id && !removed.has(value.id)).concat(candidate);
        if (local) updated += 1;
        else added += 1;
      }
    }
    return { catalogs: validateCatalogs(catalogs), added, updated, kept };
  }

  function closedPeriods(site) {
    const values = [...site.contractHistory];
    if (site.status === 'archived') values.push({ startDate: site.startDate, endDate: site.endDate });
    return values;
  }

  function unionPeriods(...groups) {
    const known = new Set();
    return groups.flat().filter(value => {
      const key = `${value.startDate}|${value.endDate}`;
      if (known.has(key)) return false;
      known.add(key);
      return true;
    }).map(period);
  }

  // La fusion n'édite aucune visite : l'appelant ne réaffecte que leurs liens
  // techniques, dans la même transaction que ce catalogue.
  function mergeCatalogs(current, type, targetId, sourceId, date) {
    const catalogs = validateCatalogs(current);
    const key = keyFor(type);
    if (!validDate(date)) fail('Date de fusion invalide.');
    const lookup = id => catalogs[key].find(site => site.id === id || site.mergedIds.includes(id));
    let target = lookup(targetId);
    const source = lookup(sourceId);
    if (!target || !source) fail('Immeuble à fusionner introuvable.');
    if (target.id === source.id) fail('Ces fiches désignent déjà le même immeuble.');
    const previousTarget = target;
    if (source.status === 'active' && target.status === 'archived') {
      // Une date de contrat future reste valide : la reprise ne doit précéder
      // ni la fin connue de la cible, ni le début du contrat actif conservé.
      const restartDate = [date, target.endDate || date, source.startDate || date]
        .reduce((latest, known) => known > latest ? known : latest, date);
      target = reactivate(target, restartDate);
    }
    target.mergedIds = unique([...target.mergedIds, source.id, ...source.mergedIds]).filter(id => id !== target.id);
    target.contractHistory = unionPeriods(closedPeriods(previousTarget), closedPeriods(source));
    if (!target.checklist.length) target.checklist = source.checklist;
    const field = type === 'bureaux' ? 'cleanerName' : 'concierge';
    if (!person(target, type)) target[field] = person(source, type);
    catalogs[key] = catalogs[key].filter(site => site.id !== source.id && site.id !== target.id).concat(target);
    return validateCatalogs(catalogs);
  }

  function hasUsage(value) {
    if (object(value)) return ['controls', 'archives', 'anomalies'].some(key => Number(value[key] || 0) > 0);
    return typeof value === 'number' ? value > 0 : Boolean(value);
  }

  // Réinitialiser restaure la liste de départ sans supprimer les contrats
  // personnalisés encore utilisés par des contrôles, PDF ou anomalies.
  function resetCatalogs(current, initial, usageFn, date, onlyType = null) {
    const catalogs = validateCatalogs(current);
    const defaults = validateCatalogs(initial);
    if (typeof usageFn !== 'function') fail('Vérification des contrôles indisponible.');
    if (!validDate(date)) fail('Date de réinitialisation invalide.');
    if (onlyType !== null) keyFor(onlyType);
    for (const [key, type] of sections) {
      if (onlyType !== null && onlyType !== type) continue;
      const originalIds = new Set(defaults[key].map(site => site.id));
      const local = new Map(catalogs[key].map(site => [site.id, site]));
      const restored = defaults[key].map(site => ({ ...site, mergedIds: unique([
        ...site.mergedIds, ...(local.get(site.id)?.mergedIds || [])
      ]).filter(id => !originalIds.has(id)) }));
      const custom = catalogs[key].filter(site => !originalIds.has(site.id) && hasUsage(usageFn(type, site.id)))
        .map(site => {
          // La clôture d'un contrat prévu dans le futur a lieu au plus tôt à
          // son début connu ; aucune période inversée n'est créée par le reset.
          const closeDate = site.startDate && site.startDate > date ? site.startDate : date;
          const copy = site.status === 'active' ? archive(site, closeDate) : site;
          copy.mergedIds = copy.mergedIds.filter(id => !originalIds.has(id));
          return copy;
        });
      catalogs[key] = restored.concat(custom);
    }
    return validateCatalogs(catalogs);
  }

  window.CONTRACTS = Object.freeze({ seeds, validateSite, validateCatalogs, validDate,
    normalizeText, duplicates, duplicateGroups, archive, reactivate, person,
    importCatalogs, mergeCatalogs, resetCatalogs });
})();
