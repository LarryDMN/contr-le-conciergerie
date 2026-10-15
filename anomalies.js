/* Suivi indépendant des contrôles : une anomalie est un cliché durable d'une ligne.
 * Changer une note ou supprimer son contrôle ne supprime jamais ce suivi. */
(() => {
  'use strict';

  const PAGE_SIZE = 50;
  const id = (controlId, rowId) => `${controlId}--${rowId}`;
  const searchable = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const clonePhotos = photos => structuredClone(Array.isArray(photos) ? photos : []);
  const mergePhotos = (previous, current) => {
    const pictures = new Map((previous || []).map(photo => [photo.id, photo]));
    current.forEach(photo => pictures.set(photo.id, photo));
    return [...pictures.values()];
  };
  const samePhotos = (left, right) => left.length === right.length && left.every((photo, index) => {
    const other = right[index];
    return ['id', 'name', 'dataUrl', 'width', 'height', 'createdAt'].every(key => photo[key] === other[key]);
  });

  // Ne renvoyer que les créations et les modifications permet de conserver les
  // dates et d'éviter une réécriture de toutes les photos à chaque sauvegarde.
  function derive(record, template, existingMap = new Map()) {
    const labels = new Map();
    (template?.sections || []).forEach(section => (section.groups || []).forEach(group =>
      (group.items || []).forEach(item => labels.set(item.id, {
        label: item.label, zone: group.title || section.title
      }))));
    const timestamp = new Date().toISOString();
    return Object.entries(record.rows || {}).flatMap(([rowId, row]) => {
      if (![3, 4].includes(row.rating)) return [];
      const anomalyId = id(record.id, rowId);
      const previous = existingMap.get(anomalyId);
      const source = labels.get(rowId) || { label: rowId, zone: 'Modèle antérieur' };
      const values = {
        id: anomalyId, controlId: record.id, rowId, type: record.type || 'conciergerie',
        buildingId: record.buildingId ?? null, buildingName: record.buildingName || record.address || 'Sans immeuble',
        address: record.address || '', date: record.date, zone: source.zone, label: source.label,
        rating: row.rating, remark: row.remark || '', controlDeleted: false
      };
      // Les photos du suivi sont indépendantes de celles du contrôle : un
      // nettoyage du contrôle ne doit pas effacer la preuve de l'anomalie.
      const photos = mergePhotos(previous?.photos, Array.isArray(row.photos) ? row.photos : []);
      const unchanged = previous && Object.entries(values).every(([key, value]) => previous[key] === value) &&
        samePhotos(previous.photos || [], photos);
      if (unchanged) return [];
      return [{ ...values, photos: clonePhotos(photos), status: previous?.status || 'open',
        resolvedDate: previous?.resolvedDate || null, correctionPhotos: clonePhotos(previous?.correctionPhotos),
        createdAt: previous?.createdAt || timestamp, updatedAt: timestamp }];
    });
  }

  // L'import n'accepte aucun champ supplémentaire ni identifiant interprétable
  // comme HTML. Les clichés orphelins restent valides et peuvent être restaurés.
  function validate(values, { validDate, photos }) {
    const invalid = () => { throw new Error('Suivi des anomalies invalide. Aucune donnée n’a été importée.'); };
    const text = value => { if (typeof value !== 'string') invalid(); return value; };
    const timestamp = value => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) invalid();
      return value;
    };
    if (!Array.isArray(values)) invalid();
    const ids = new Set();
    return values.map(value => {
      if (!value || typeof value !== 'object' || Array.isArray(value) ||
        typeof value.controlId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(value.controlId) ||
        typeof value.rowId !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value.rowId) ||
        value.id !== id(value.controlId, value.rowId) || ids.has(value.id) ||
        !['conciergerie', 'bureaux'].includes(value.type) || ![3, 4].includes(value.rating) ||
        !['open', 'resolved'].includes(value.status) || !validDate(value.date) ||
        (value.buildingId != null && (typeof value.buildingId !== 'string' || !value.buildingId)) ||
        typeof value.controlDeleted !== 'boolean' ||
        (value.resolvedDate != null && !validDate(value.resolvedDate)) ||
        (value.status === 'resolved' && !value.resolvedDate)) invalid();
      ids.add(value.id);
      return { id: value.id, controlId: value.controlId, rowId: value.rowId, type: value.type,
        buildingId: value.buildingId ?? null, buildingName: text(value.buildingName), address: text(value.address),
        date: value.date, zone: text(value.zone), label: text(value.label), rating: value.rating,
        remark: text(value.remark), photos: photos(value.photos), status: value.status,
        resolvedDate: value.resolvedDate ?? null, correctionPhotos: photos(value.correctionPhotos),
        createdAt: timestamp(value.createdAt), updatedAt: timestamp(value.updatedAt), controlDeleted: value.controlDeleted };
    });
  }

  function createUI({ anomalies, controls, escapeHTML, displayDate, buildingName,
    onOpen, onResolve, onReopen, onPhoto }) {
    const $ = name => document.getElementById(name);
    const states = new Map(['conciergerie', 'bureaux'].map(type => [type, {
      status: 'open', building: '', query: '', page: 0
    }]));
    let activeType = 'conciergerie';
    let bound = false;
    const nameOf = anomaly => buildingName?.(anomaly) || anomaly.buildingName || anomaly.address || 'Sans immeuble';
    const buildingKey = anomaly => anomaly.buildingId ? `id:${anomaly.buildingId}` : `texte:${nameOf(anomaly)}`;

    function thumbnails(anomaly, correction = false) {
      const photos = correction ? anomaly.correctionPhotos : anomaly.photos;
      if (!photos.length) return '';
      return `<div class="anomaly-photo-group"><p class="anomaly-meta">${correction ? 'Photo(s) de la correction' : 'Photo(s) du contrôle'}</p>
        <div class="anomaly-thumbnails">${photos.map((photo, index) => `<button type="button" class="anomaly-photo" data-anomaly-photo="${escapeHTML(anomaly.id)}" data-photo-id="${escapeHTML(photo.id)}" data-correction="${correction}"
          aria-label="Agrandir la photo ${index + 1} ${correction ? 'de la correction' : 'du contrôle'}"><img src="${escapeHTML(photo.dataUrl)}" alt="${escapeHTML(photo.name || `Photo ${index + 1}`)}" loading="lazy"></button>`).join('')}</div></div>`;
    }

    function card(anomaly) {
      const deleted = anomaly.controlDeleted || !controls.has(anomaly.controlId);
      const anomalyId = escapeHTML(anomaly.id);
      return `<article class="anomaly-card" data-anomaly-card="${anomalyId}">
        <p class="anomaly-building">${escapeHTML(nameOf(anomaly))}</p>
        <h3>${deleted ? escapeHTML(anomaly.label) : `<button type="button" class="anomaly-open" data-anomaly-open="${anomalyId}">${escapeHTML(anomaly.label)}</button>`}</h3>
        <p class="anomaly-meta">Zone : ${escapeHTML(anomaly.zone)}</p>
        <p><span class="anomaly-rating ${anomaly.rating === 4 ? 'anomaly-rating-bad' : ''}">Note ${anomaly.rating} · ${anomaly.rating === 4 ? 'Mauvais' : 'Moyen'}</span></p>
        <p class="anomaly-remark">${escapeHTML(anomaly.remark || 'Aucune remarque.')}</p>
        <p class="anomaly-meta">Contrôle du ${escapeHTML(displayDate(anomaly.date))}${deleted ? ' · <strong>contrôle supprimé</strong>' : ''}</p>
        <p class="anomaly-status">${anomaly.status === 'resolved' ? `Réglée le ${escapeHTML(displayDate(anomaly.resolvedDate))}` :
          `En cours${anomaly.resolvedDate ? ` · Dernier réglage le ${escapeHTML(displayDate(anomaly.resolvedDate))}` : ''}`}</p>
        ${thumbnails(anomaly)}${thumbnails(anomaly, true)}
        <div class="anomaly-actions">${anomaly.status === 'resolved'
          ? `<button type="button" class="button button-secondary" data-anomaly-reopen="${anomalyId}">Remettre en cours</button>`
          : `<button type="button" class="button button-primary" data-anomaly-resolve="${anomalyId}">Marquer réglée</button>`}
          ${deleted ? '' : `<button type="button" class="button button-secondary" data-anomaly-open="${anomalyId}">Ouvrir le contrôle</button>`}</div></article>`;
    }

    function render(type = activeType) {
      activeType = type;
      const state = states.get(type);
      const all = [...anomalies.values()].filter(anomaly => anomaly.type === type);
      const buildings = new Map();
      all.forEach(anomaly => { if (!buildings.has(buildingKey(anomaly))) buildings.set(buildingKey(anomaly), nameOf(anomaly)); });
      const select = $('anomalyBuildingFilter');
      if (state.building && !buildings.has(state.building)) state.building = '';
      const options = [...buildings].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
      const signature = JSON.stringify([type, options]);
      if (select.dataset.options !== signature) {
        select.innerHTML = `<option value="">${type === 'bureaux' ? 'Tous les bureaux' : 'Tous les immeubles'}</option>` +
          options.map(([key, name]) => `<option value="${escapeHTML(key)}">${escapeHTML(name)}</option>`).join('');
        select.dataset.options = signature;
      }
      select.value = state.building;
      if ($('anomalySearch').value !== state.query) $('anomalySearch').value = state.query;
      [['anomaliesOpenTab', 'open', 'En cours'], ['anomaliesResolvedTab', 'resolved', 'Réglées']].forEach(([elementId, status, label]) => {
        const button = $(elementId);
        button.setAttribute('aria-selected', String(state.status === status));
        button.tabIndex = state.status === status ? 0 : -1;
        button.classList.toggle('active', state.status === status);
        button.textContent = `${label} (${all.filter(anomaly => anomaly.status === status).length})`;
      });
      if ($('anomalyResults')) $('anomalyResults').setAttribute('aria-labelledby',
        state.status === 'open' ? 'anomaliesOpenTab' : 'anomaliesResolvedTab');
      const query = searchable(state.query.trim());
      const filtered = all.filter(anomaly => anomaly.status === state.status && (!state.building || buildingKey(anomaly) === state.building) &&
        searchable([nameOf(anomaly), anomaly.address, anomaly.label, anomaly.zone, anomaly.remark, anomaly.date,
          displayDate(anomaly.date), anomaly.resolvedDate || ''].join(' ')).includes(query)).sort((a, b) =>
        (b.resolvedDate || b.date).localeCompare(a.resolvedDate || a.date) || b.updatedAt.localeCompare(a.updatedAt));
      const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      state.page = Math.min(state.page, pages - 1);
      const page = filtered.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
      $('anomalyList').innerHTML = page.map(card).join('');
      $('anomaliesEmpty').hidden = filtered.length > 0;
      $('anomaliesEmpty').textContent = state.query || state.building ? 'Aucune anomalie ne correspond à ces filtres.' :
        state.status === 'resolved' ? 'Aucune anomalie réglée dans cette section.' : 'Aucune anomalie en cours dans cette section.';
      const start = filtered.length ? state.page * PAGE_SIZE + 1 : 0;
      const end = Math.min((state.page + 1) * PAGE_SIZE, filtered.length);
      $('anomalyPagination').innerHTML = `<button type="button" id="anomalyPrevPage" class="button button-secondary" ${state.page === 0 ? 'disabled' : ''}>Précédente</button>
        <p id="anomalyPageInfo" role="status">Page ${state.page + 1} sur ${pages} · ${start}–${end} sur ${filtered.length}</p>
        <button type="button" id="anomalyNextPage" class="button button-secondary" ${state.page >= pages - 1 ? 'disabled' : ''}>Suivante</button>`;
    }

    function bind() {
      if (bound) return;
      bound = true;
      [['anomaliesOpenTab', 'open'], ['anomaliesResolvedTab', 'resolved']].forEach(([elementId, status]) => {
        $(elementId).addEventListener('click', () => {
          const state = states.get(activeType);
          state.status = status;
          state.page = 0;
          render();
        });
        $(elementId).addEventListener('keydown', event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 'open' : event.key === 'End' ? 'resolved' :
            states.get(activeType).status === 'open' ? 'resolved' : 'open';
          const state = states.get(activeType);
          state.status = next;
          state.page = 0;
          render();
          $(next === 'open' ? 'anomaliesOpenTab' : 'anomaliesResolvedTab').focus();
        });
      });
      [['anomalyBuildingFilter', 'building', 'change'], ['anomalySearch', 'query', 'input']].forEach(([elementId, field, eventName]) => {
        $(elementId).addEventListener(eventName, event => {
          const state = states.get(activeType);
          state[field] = event.target.value;
          state.page = 0;
          render();
        });
      });
      $('anomalyPagination').addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        const state = states.get(activeType);
        if (button.id === 'anomalyPrevPage') state.page = Math.max(0, state.page - 1);
        else if (button.id === 'anomalyNextPage') state.page += 1;
        else return;
        render();
        $('anomalyList').scrollIntoView({ block: 'start' });
      });
      $('anomalyList').addEventListener('click', event => {
        const photo = event.target.closest('[data-anomaly-photo]');
        if (photo) { onPhoto(photo.dataset.anomalyPhoto, photo.dataset.photoId, photo.dataset.correction === 'true'); return; }
        const resolve = event.target.closest('[data-anomaly-resolve]');
        if (resolve) { onResolve(resolve.dataset.anomalyResolve); return; }
        const reopen = event.target.closest('[data-anomaly-reopen]');
        if (reopen) { onReopen(reopen.dataset.anomalyReopen); return; }
        const open = event.target.closest('[data-anomaly-open]');
        const target = open?.dataset.anomalyOpen || event.target.closest('[data-anomaly-card]')?.dataset.anomalyCard;
        const anomaly = anomalies.get(target);
        if (anomaly && !anomaly.controlDeleted && controls.has(anomaly.controlId)) onOpen(anomaly.controlId);
      });
    }

    function reset(type) {
      const state = states.get(type);
      state.status = 'open';
      state.page = 0;
    }

    return Object.freeze({ render, bind, reset });
  }

  window.ANOMALIES = Object.freeze({ id, derive, validate, createUI });
})();
