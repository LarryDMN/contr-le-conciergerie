/* Listes et sélections en mémoire : seules 50 fiches sont présentes dans le DOM. */
(() => {
  'use strict';

  const PAGE_SIZE = 50;
  const searchable = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  function create({ controls, archives, typeLabels, buildingName, displayDate, ratedCount, escapeHTML,
    itemCount = record => Object.keys(record.rows || {}).length,
    versionOf = record => record.updatedAt, onChange = () => {} }) {
    const $ = id => document.getElementById(id);
    const states = new Map(Object.keys(typeLabels).map(type => [type, {
      building: '', year: '', month: '', query: '', page: 0, selected: new Set()
    }]));
    const archiveState = { page: 0, selected: new Set(), query: '' };
    const controlProjections = new Map();
    const archiveProjections = new Map();
    let activeType = Object.keys(typeLabels)[0];
    let currentId;
    let visibleControls = [];
    let visibleArchives = [];
    let controlSignature = '';
    let archiveSignature = '';
    let bound = false;

    const buildingKey = record => record.buildingId
      ? `id:${record.buildingId}` : `texte:${buildingName(record)}`;

    // Les textes de recherche sont recalculés pour les seules fiches modifiées.
    // Les photos et leurs grandes chaînes base64 ne sont jamais parcourues ici.
    function controlProjection(record) {
      const key = JSON.stringify([versionOf(record), record.updatedAt, record.date, record.buildingId, record.buildingName,
        record.address, record.concierge, record.photosRemovedAt]);
      const cached = controlProjections.get(record.id);
      if (cached?.key === key && cached.record === record) return cached;
      const name = buildingName(record);
      const date = displayDate(record.date);
      const projection = { key, record, id: record.id, name, date, building: buildingKey(record),
        year: record.date.slice(0, 4), month: record.date.slice(5, 7), rated: ratedCount(record), total: itemCount(record),
        search: searchable([name, record.address, record.concierge, record.date, date,
          ...Object.values(record.rows || {}).map(row => row.remark), record.comments?.text].join(' ')) };
      controlProjections.set(record.id, projection);
      return projection;
    }

    function archiveProjection(archive) {
      const key = JSON.stringify([archive.generatedAt, archive.date, archive.filename, archive.buildingId,
        archive.buildingName, archive.address, archive.type]);
      const cached = archiveProjections.get(archive.controlId);
      if (cached?.key === key && cached.archive === archive) return cached;
      const date = displayDate(archive.date);
      const projection = { key, archive, search: searchable([archive.filename, archive.buildingName,
        archive.address, archive.date, date, typeLabels[archive.type]].join(' ')) };
      archiveProjections.set(archive.controlId, projection);
      return projection;
    }

    function prune() {
      states.forEach((state, type) => {
        for (const id of state.selected) if (controls.get(id)?.type !== type) state.selected.delete(id);
      });
      for (const id of archiveState.selected) if (!archives.has(id)) archiveState.selected.delete(id);
      for (const id of controlProjections.keys()) if (!controls.has(id)) controlProjections.delete(id);
      for (const id of archiveProjections.keys()) if (!archives.has(id)) archiveProjections.delete(id);
    }

    function fillSelect(id, entries, emptyLabel, state, field) {
      const select = $(id);
      if (!select) return;
      if (state[field] && !entries.some(([value]) => value === state[field])) state[field] = '';
      const signature = JSON.stringify(entries);
      if (select.dataset.options !== signature) {
        select.innerHTML = `<option value="">${escapeHTML(emptyLabel)}</option>` + entries.map(([value, label]) =>
          `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`).join('');
        select.dataset.options = signature;
      }
      select.value = state[field];
    }

    function updatePagination(prefix, state, total) {
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      state.page = Math.min(state.page, pages - 1);
      const start = total ? state.page * PAGE_SIZE + 1 : 0;
      const end = Math.min((state.page + 1) * PAGE_SIZE, total);
      $(`${prefix}PreviousPage`).disabled = state.page === 0;
      $(`${prefix}NextPage`).disabled = state.page >= pages - 1;
      $(`${prefix}PageInfo`).textContent = `Page ${state.page + 1} sur ${pages} · ${start}–${end}`;
    }

    function updateSelection(prefix, state, visible, dataAttribute) {
      const visibleSelected = visible.filter(id => state.selected.has(id)).length;
      const count = state.selected.size;
      const all = $(`${prefix}SelectAll`);
      all.disabled = !visible.length;
      all.checked = visible.length > 0 && visibleSelected === visible.length;
      all.indeterminate = visibleSelected > 0 && visibleSelected < visible.length;
      $(`${prefix}SelectionBar`).hidden = count === 0;
      $(`${prefix}SelectionCount`).textContent = `${count} ${prefix === 'control' ? (count === 1 ? 'contrôle sélectionné' : 'contrôles sélectionnés')
        : (count === 1 ? 'PDF sélectionné' : 'PDF sélectionnés')}${count > visibleSelected ? ` · ${count - visibleSelected} hors de cette page` : ''}`;
      document.querySelectorAll(`[${dataAttribute}]`).forEach(input => {
        input.checked = state.selected.has(input.getAttribute(dataAttribute));
        input.closest('.saved-control, .archive-card')?.classList.toggle('selected', input.checked);
      });
    }

    function renderControls(type = activeType, selectedId = currentId) {
      activeType = type;
      currentId = selectedId;
      prune();
      const state = states.get(type);
      const records = [...controls.values()].filter(record => record.type === type).sort((a, b) =>
        b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)).map(controlProjection);
      const buildings = new Map();
      records.forEach(record => { if (!buildings.has(record.building)) buildings.set(record.building, record.name); });
      fillSelect('controlBuildingFilter', [...buildings].sort((a, b) => a[1].localeCompare(b[1], 'fr')), 'Tous les immeubles', state, 'building');
      fillSelect('controlYearFilter', [...new Set(records.map(record => record.year))].sort().reverse().map(year => [year, year]), 'Toutes les années', state, 'year');
      fillSelect('controlMonthFilter', monthNames.map((name, index) => [String(index + 1).padStart(2, '0'), name]), 'Tous les mois', state, 'month');
      if ($('controlSearch').value !== state.query) $('controlSearch').value = state.query;
      const query = searchable(state.query.trim());
      const filtered = records.filter(record => (!state.building || record.building === state.building) &&
        (!state.year || record.year === state.year) && (!state.month || record.month === state.month) && record.search.includes(query));
      updatePagination('control', state, filtered.length);
      const page = filtered.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
      visibleControls = page.map(record => record.id);
      $('controlListCount').textContent = `${filtered.length} contrôle${filtered.length === 1 ? '' : 's'} affichable${filtered.length === 1 ? '' : 's'} sur ${records.length}`;

      // Une remarque ne change pas le résumé affiché : conserver le DOM évite de
      // perdre le focus des cases et de recréer la liste à chaque frappe.
      const signature = JSON.stringify([type, currentId, filtered.length, page.map(({ record, id, name, date, rated, total }) =>
        [id, name, date, record.concierge, rated, total, record.photosRemovedAt])]);
      if (signature !== controlSignature) {
        $('controlList').innerHTML = page.map(({ record, id, name, date, rated, total }) => `
          <div class="saved-control ${id === currentId ? 'active' : ''}">
            <label class="selection-check"><input type="checkbox" data-select-control="${escapeHTML(id)}" value="${escapeHTML(id)}">
              <span class="visually-hidden">Sélectionner ${escapeHTML(name)}, contrôle du ${escapeHTML(date)}</span></label>
            <button type="button" class="open-control" data-open-control="${escapeHTML(id)}" ${id === currentId ? 'aria-current="true"' : ''}>
              <span class="control-date">${escapeHTML(date)}</span><span class="control-address">${escapeHTML(name)}</span>
              <span class="control-meta">${escapeHTML(record.concierge || (type === 'bureaux' ? 'Responsable non renseigné' : 'Concierge non renseigné'))}
                <span>${rated} / ${total}</span></span>
              ${record.photosRemovedAt ? '<span class="photos-removed-list">Photos retirées</span>' : ''}
            </button>
          </div>`).join('') || `<p class="list-empty">${records.length ? 'Aucun contrôle ne correspond à ces filtres.' : 'Aucun contrôle enregistré dans cette section.'}</p>`;
        $('controlList').scrollTop = 0;
        controlSignature = signature;
      }
      updateSelection('control', state, visibleControls, 'data-select-control');
    }

    function archiveMarkup(archive) {
      const id = escapeHTML(archive.controlId);
      const generated = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(archive.generatedAt));
      return `<article class="archive-card">
        <div class="archive-selection"><label class="selection-check"><input type="checkbox" data-select-archive="${id}" value="${id}">
          <span class="visually-hidden">Sélectionner ${escapeHTML(archive.filename)}</span></label></div>
        <div class="archive-content"><h3 class="archive-filename">${escapeHTML(archive.filename)}</h3>
          <p class="archive-meta">Contrôle du ${escapeHTML(displayDate(archive.date))}</p>
          <p class="archive-meta">PDF actualisé le ${escapeHTML(generated)}</p></div>
        <div class="archive-actions"><button type="button" class="button button-secondary" data-preview-archive="${id}">Aperçu</button>
          <button type="button" class="button button-primary" data-download-archive="${id}">Télécharger</button>
          <button type="button" class="button button-secondary" data-delete-archive="${id}">Supprimer</button></div></article>`;
    }

    function archiveTree(page) {
      return Object.keys(typeLabels).map(type => {
        const entries = page.filter(archive => archive.type === type);
        if (!entries.length) return '';
        const buildings = new Map();
        entries.forEach(archive => {
          const key = archive.buildingId || `${archive.buildingName}\u0000${archive.address}`;
          if (!buildings.has(key)) buildings.set(key, []);
          buildings.get(key).push(archive);
        });
        return `<details class="folder-type" open><summary><span class="folder-label">${escapeHTML(typeLabels[type])}</span><span class="folder-count">${entries.length} PDF sur cette page</span></summary>
          ${[...buildings.values()].map(records => `<details class="folder-building" open><summary><span class="folder-label">${escapeHTML(records[0].buildingName || records[0].address || 'Sans immeuble')}</span><span class="folder-count">${records.length}</span></summary>
            ${[...new Set(records.map(archive => archive.date.slice(0, 4)))].sort().reverse().map(year => `<details class="folder-year" open><summary><span class="folder-label">${escapeHTML(year)}</span></summary>
              ${records.filter(archive => archive.date.startsWith(year)).map(archiveMarkup).join('')}</details>`).join('')}</details>`).join('')}</details>`;
      }).join('');
    }

    function renderArchives() {
      prune();
      const query = searchable($('folderSearch').value.trim());
      if (query !== archiveState.query) { archiveState.query = query; archiveState.page = 0; }
      const filtered = [...archives.values()].filter(archive => archiveProjection(archive).search.includes(query)).sort((a, b) =>
        b.date.localeCompare(a.date) || b.generatedAt.localeCompare(a.generatedAt));
      updatePagination('archive', archiveState, filtered.length);
      const page = filtered.slice(archiveState.page * PAGE_SIZE, (archiveState.page + 1) * PAGE_SIZE);
      visibleArchives = page.map(archive => archive.controlId);
      $('archiveListCount').textContent = `${filtered.length} PDF affichable${filtered.length === 1 ? '' : 's'} sur ${archives.size}`;
      $('foldersEmpty').hidden = filtered.length > 0;
      $('foldersEmpty').textContent = archives.size ? 'Aucun PDF ne correspond à cette recherche.' : 'Aucun PDF archivé. Enregistrez ou terminez un contrôle pour créer son PDF.';
      const signature = JSON.stringify(page.map(archive => [archive.controlId, archiveProjection(archive).key]));
      if (signature !== archiveSignature) {
        $('archiveTree').innerHTML = archiveTree(page);
        archiveSignature = signature;
      }
      updateSelection('archive', archiveState, visibleArchives, 'data-select-archive');
    }

    function clearControls(type = activeType) {
      states.get(type).selected.clear();
      if (type === activeType) updateSelection('control', states.get(type), visibleControls, 'data-select-control');
      onChange();
    }

    function clearArchives() {
      archiveState.selected.clear();
      updateSelection('archive', archiveState, visibleArchives, 'data-select-archive');
      onChange();
    }

    function bind() {
      if (bound) return;
      bound = true;
      [['controlBuildingFilter', 'building'], ['controlYearFilter', 'year'], ['controlMonthFilter', 'month'], ['controlSearch', 'query']].forEach(([id, field]) => {
        $(id).addEventListener(id === 'controlSearch' ? 'input' : 'change', event => {
          const state = states.get(activeType);
          state[field] = event.target.value;
          state.page = 0;
          renderControls();
        });
      });
      $('folderSearch').addEventListener('input', renderArchives);
      [['control', () => states.get(activeType), () => visibleControls, renderControls],
        ['archive', () => archiveState, () => visibleArchives, renderArchives]].forEach(([prefix, getState, getVisible, render]) => {
        $(`${prefix}SelectAll`).addEventListener('change', event => {
          const state = getState();
          getVisible().forEach(id => { if (event.target.checked) state.selected.add(id); else state.selected.delete(id); });
          updateSelection(prefix, state, getVisible(), `data-select-${prefix}`);
          onChange();
        });
        $(`${prefix}PreviousPage`).addEventListener('click', () => { getState().page = Math.max(0, getState().page - 1); render(); });
        $(`${prefix}NextPage`).addEventListener('click', () => { getState().page += 1; render(); });
        $(prefix === 'control' ? 'controlList' : 'archiveTree').addEventListener('change', event => {
          const input = event.target.closest(`[data-select-${prefix}]`);
          if (!input) return;
          const state = getState();
          const id = input.getAttribute(`data-select-${prefix}`);
          if (input.checked) state.selected.add(id); else state.selected.delete(id);
          updateSelection(prefix, state, getVisible(), `data-select-${prefix}`);
          onChange();
        });
      });
      $('clearControlSelection').addEventListener('click', () => clearControls());
      $('clearArchiveSelection').addEventListener('click', clearArchives);
    }

    return Object.freeze({ renderControls, renderArchives, bind, prune, clearControls, clearArchives,
      selectedControls(type = activeType) { prune(); return [...states.get(type).selected]; },
      selectedArchives() { prune(); return [...archiveState.selected]; } });
  }

  window.CONTROL_LISTS = Object.freeze({ create });
})();
