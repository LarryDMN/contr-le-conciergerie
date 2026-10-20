/* Application autonome : aucune donnée ni photo n'est envoyée à un serveur. */
(() => {
  'use strict';

  const baseConfig = window.CONCIERGERIE_CONFIG;
  const buildings = window.CONCIERGERIES;
  const offices = window.BUREAUX;
  // Chaque visite de bureaux conserve son propre modèle, indépendant du catalogue.
  const templateFor = subject => (typeof subject === 'string' ? subject : subject?.type) === 'bureaux'
    ? { ...baseConfig, footer: baseConfig.officeFooter, sections: subject?.officeSections || [] }
    : baseConfig;
  const typeLabels = { conciergerie: 'Contrôle conciergerie', bureaux: 'Contrôle entretien de bureaux' };
  const itemsFor = subject => templateFor(subject).sections.flatMap(section => section.groups.flatMap(group => group.items));
  let activeType = 'conciergerie';
  let view = 'home';
  let route = { view: 'home', type: 'conciergerie', controlId: null };
  const routeHistory = [];
  let config = templateFor(activeType);
  let items = itemsFor(activeType);
  let itemIds = new Set(items.map(item => item.id));
  const $ = selector => document.querySelector(selector);
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const uid = () => window.crypto?.randomUUID?.() || `controle-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const displayDate = date => date ? new Intl.DateTimeFormat('fr-CH', {
    day: '2-digit', month: 'long', year: 'numeric'
  }).format(new Date(`${date}T12:00:00`)) : 'Date non renseignée';
  const cameraIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h4l2-3h4l2 3h4v14H4z"/><circle cx="12" cy="13" r="4"/></svg>';
  const galleryIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg>';

  let database;
  const controls = new Map();
  // Les statistiques et références lisent des clichés ayant réellement été écrits.
  const registeredControls = new Map();
  const newControlDates = new Map();
  const archives = new Map();
  const anomalies = new Map();
  let importedCatalogs = { conciergeries: [], bureaux: [] };
  const anomalyDirty = new Set();
  const dirty = new Set();
  const versions = new Map();
  let currentId;
  let saveTimer;
  let saveQueue = Promise.resolve();
  let pendingWrites = 0;
  let saveError = false;
  let actionBusy = false;
  let pdfBusy = false;
  let mutationBusy = false;
  let directoryHandle;
  let previewURL;
  let noticeTimer;
  const photoJobs = new Set();
  const current = () => controls.get(currentId);
  const buildingName = record => record.buildingName || record.address ||
    (record.type === 'bureaux' ? 'Bureau à choisir' : record.buildingId === undefined ? 'Contrôle sans adresse' : 'Immeuble à choisir');
  // null désigne un nouveau brouillon ; l'absence de champ désigne un ancien contrôle.
  const needsBuilding = record => record.type === 'bureaux' ? !record.buildingId : record.buildingId === null;
  const ratedCount = record => itemsFor(record).filter(item => record.rows[item.id]?.rating).length;
  const sortedControls = (type = null) => [...controls.values()].filter(record => !type || record.type === type).sort((a, b) =>
    b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));

  const lists = window.CONTROL_LISTS.create({ controls, archives, typeLabels, buildingName, displayDate,
    catalogs: { conciergerie: buildings, bureaux: offices },
    ratedCount, escapeHTML, itemCount: record => itemsFor(record).length,
    versionOf: record => versions.get(record.id) || record.updatedAt });
  const anomalyUI = window.ANOMALIES.createUI({ anomalies, controls, escapeHTML, displayDate, buildingName,
    onOpen: id => perform(() => switchControl(id)),
    onResolve: id => perform(() => resolveAnomaly(id)),
    onReopen: id => perform(() => reopenAnomaly(id)), onPhoto: viewAnomalyPhoto });

  function notify(message, error = false, persistent = false) {
    clearTimeout(noticeTimer);
    const notice = $('#notice');
    notice.textContent = message;
    notice.hidden = false;
    notice.classList.toggle('is-error', error);
    if (!persistent) noticeTimer = setTimeout(() => { notice.hidden = true; }, 6500);
  }

  function setStorageStatus() {
    const status = $('#storageStatus');
    status.dataset.state = saveError ? 'error' : dirty.size || anomalyDirty.size || pendingWrites || photoJobs.size || pdfBusy ? 'saving' : 'saved';
    status.textContent = saveError ? 'Échec de sauvegarde — réessayez ou exportez' : pdfBusy ? 'Création du PDF…' : photoJobs.size
      ? 'Préparation des photos…' : dirty.size || anomalyDirty.size || pendingWrites ? 'Sauvegarde en cours…' : 'Enregistré sur cet appareil';
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('conciergerie-controles', 3);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains('controls')
          ? request.transaction.objectStore('controls') : db.createObjectStore('controls', { keyPath: 'id' });
        if (!store.indexNames.contains('type')) store.createIndex('type', 'type');
        // La migration conserve tous les champs et attribue réellement le type aux anciennes données.
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const entry = cursor.result;
          if (!entry) return;
          if (!entry.value.type) entry.update({ ...entry.value, type: 'conciergerie' });
          entry.continue();
        };
        if (!db.objectStoreNames.contains('archives')) {
          const archiveStore = db.createObjectStore('archives', { keyPath: 'controlId' });
          archiveStore.createIndex('type', 'type');
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'name' });
        if (!db.objectStoreNames.contains('anomalies')) {
          const anomalyStore = db.createObjectStore('anomalies', { keyPath: 'id' });
          anomalyStore.createIndex('type', 'type');
          anomalyStore.createIndex('controlId', 'controlId');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => notify('Fermez les autres onglets de l’application pour ouvrir le stockage.', true, true);
    });
  }

  // Attendre la transaction entière : une requête réussie seule ne garantit pas la sauvegarde.
  function transaction(mode, callback, storeNames = 'controls') {
    return new Promise((resolve, reject) => {
      const tx = database.transaction(storeNames, mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('Le stockage est indisponible.'));
      tx.onabort = () => reject(tx.error || new Error('Sauvegarde interrompue.'));
      try {
        const stores = Array.isArray(storeNames)
          ? Object.fromEntries(storeNames.map(name => [name, tx.objectStore(name)])) : tx.objectStore(storeNames);
        result = callback(stores);
      }
      catch (error) { tx.abort(); reject(error); }
    });
  }

  async function readControls() {
    let request;
    await transaction('readonly', store => { request = store.getAll(); });
    request.result.forEach(record => {
      const normalized = normalizeRecord(record);
      controls.set(record.id, normalized);
      registeredControls.set(record.id, structuredClone(normalized));
    });
  }

  async function readArchives() {
    let request;
    await transaction('readonly', store => { request = store.getAll(); }, 'archives');
    request.result.forEach(archive => archives.set(archive.controlId, archive));
  }

  // Les sites reçus par JSON complètent les fichiers locaux, sans les remplacer.
  function mergeCatalogs(catalogs) {
    for (const [key, target] of [['conciergeries', buildings], ['bureaux', offices]]) {
      const known = new Set(target.map(site => site.id));
      catalogs[key].forEach(site => {
        if (!known.has(site.id)) { target.push(structuredClone(site)); known.add(site.id); }
      });
    }
  }

  async function readCatalogs() {
    let request;
    await transaction('readonly', store => { request = store.get('importedCatalogs'); }, 'settings');
    importedCatalogs = window.CONTROL_TRANSFER.validateCatalogs(request.result?.value);
    mergeCatalogs(importedCatalogs);
  }

  function deriveAnomalies(records, existing = anomalies) {
    // Un seul index évite de reparcourir tout le suivi pour chaque contrôle.
    const byControl = new Map();
    existing.forEach(anomaly => {
      if (!byControl.has(anomaly.controlId)) byControl.set(anomaly.controlId, new Map());
      byControl.get(anomaly.controlId).set(anomaly.id, anomaly);
    });
    return records.flatMap(record => window.ANOMALIES.derive(record, templateFor(record), byControl.get(record.id) || new Map()));
  }

  async function readAnomalies() {
    let request;
    await transaction('readonly', store => { request = store.getAll(); }, 'anomalies');
    request.result.forEach(anomaly => anomalies.set(anomaly.id, anomaly));
    // Migration idempotente : les anciens relevés apparaissent sans modifier leurs notes ni PDF.
    const updates = deriveAnomalies([...controls.values()]);
    const updatedIds = new Set(updates.map(anomaly => anomaly.id));
    anomalies.forEach(anomaly => {
      if (!updatedIds.has(anomaly.id) && anomaly.controlDeleted !== !controls.has(anomaly.controlId)) {
        updates.push({ ...anomaly, controlDeleted: !controls.has(anomaly.controlId) });
      }
    });
    if (updates.length) {
      updates.forEach(anomaly => anomalies.set(anomaly.id, anomaly));
      try {
        await transaction('readwrite', store => updates.forEach(anomaly => store.put(anomaly)), 'anomalies');
      } catch {
        // Une base pleine doit rester consultable, exportable et nettoyable.
        updates.forEach(anomaly => anomalyDirty.add(anomaly.id));
        saveError = true;
        notify('Le suivi des anomalies reste en mémoire : son enregistrement a échoué. Exportez toutes les données, puis libérez de la place ou réessayez.', true, true);
      }
    }
  }

  const blankRow = () => ({ rating: null, remark: '', photos: [] });
  function normalizeRecord(record) {
    record.type ??= 'conciergerie';
    // Aucun rapprochement automatique : les anciennes adresses restent intactes.
    record.buildingName ??= '';
    record.rows ||= {};
    if (!Object.hasOwn(record, 'lineLabels')) {
      const known = new Map(itemsFor(record).map(item => [item.id, item.label]));
      // Capturer les seules lignes réellement présentes avant de compléter le formulaire.
      record.lineLabels = Object.fromEntries(Object.keys(record.rows).filter(id => known.has(id))
        .map(id => [id, known.get(id)]));
    }
    itemsFor(record).forEach(item => {
      if (!Object.hasOwn(record.rows, item.id)) record.rows[item.id] = blankRow();
    });
    record.comments ||= { text: '', photos: [] };
    return record;
  }

  function makeControl() {
    const timestamp = new Date().toISOString();
    return normalizeRecord({ id: uid(), type: activeType, createdAt: timestamp, updatedAt: timestamp,
      buildingId: null,
      ...(activeType === 'bureaux' ? { officeSections: [] } : {}),
      buildingName: '', address: '', ...(activeType === 'bureaux' ? { cleanerName: '' } : { concierge: '' }), date: today(), rows: {},
      comments: { text: '', photos: [] } });
  }

  function markChanged(record = current()) {
    record.lineLabels = { ...record.lineLabels, ...Object.fromEntries(itemsFor(record).map(item => [item.id, item.label])) };
    delete record.completedAt;
    record.updatedAt = new Date().toISOString();
    versions.set(record.id, (versions.get(record.id) || 0) + 1);
    dirty.add(record.id);
    saveError = false;
    setStorageStatus();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { persistChanges().catch(() => {}); }, 250);
  }

  // Sérialiser les écritures et associer une version au cliché évite de perdre une frappe récente.
  function persistChanges() {
    clearTimeout(saveTimer);
    if ((!dirty.size && !anomalyDirty.size) || mutationBusy) return saveQueue;
    const snapshots = [...dirty].filter(id => controls.has(id)).map(id => ({
      record: structuredClone(controls.get(id)), version: versions.get(id)
    }));
    pendingWrites += 1;
    setStorageStatus();
    let anomalyUpdates;
    const job = saveQueue.catch(() => {}).then(() => {
      const pending = [...anomalyDirty].map(id => [id, anomalies.get(id)]);
      anomalyUpdates = [...new Map([...pending,
        ...deriveAnomalies(snapshots.map(snapshot => snapshot.record)).map(anomaly => [anomaly.id, anomaly])]).values()];
      return transaction('readwrite', stores => {
        snapshots.forEach(snapshot => stores.controls.put(snapshot.record));
        anomalyUpdates.forEach(anomaly => stores.anomalies.put(anomaly));
      }, ['controls', 'anomalies']);
    }).then(() => {
      anomalyUpdates.forEach(anomaly => { anomalies.set(anomaly.id, anomaly); anomalyDirty.delete(anomaly.id); });
      snapshots.forEach(({ record, version }) => {
        registeredControls.set(record.id, record);
        if (versions.get(record.id) === version) dirty.delete(record.id);
      });
      saveError = false;
    }).catch(error => {
      saveError = true;
      notify(error.name === 'QuotaExceededError'
        ? 'Stockage plein. Exportez vos contrôles, puis libérez de la place ou supprimez des photos.'
        : 'La sauvegarde locale a échoué. Vos modifications restent affichées : réessayez ou exportez-les.', true, true);
      throw error;
    }).finally(() => { pendingWrites -= 1; setStorageStatus(); });
    saveQueue = job;
    return job;
  }

  async function flushChanges() {
    await Promise.all([...photoJobs]);
    await saveQueue.catch(() => {});
    while (dirty.size || anomalyDirty.size) await persistChanges();
  }

  // Les actions asynchrones ne peuvent pas se chevaucher (dupliquer, supprimer, importer…).
  async function perform(action) {
    if (actionBusy) return;
    actionBusy = true;
    const editor = $('#controlForm');
    const wasInert = editor.inert;
    // Attendre les photos et les écritures avant d'autoriser un autre choix de site.
    editor.inert = true;
    try { await action(); }
    catch (error) {
      console.error('Opération impossible :', error.name);
      if (!saveError) notify(error.message || 'Cette opération a échoué.', true);
    } finally { editor.inert = wasInert; actionBusy = false; }
  }

  function renderList() {
    if (view === 'controls') lists.renderControls(activeType, currentId);
  }

  function photoButtons(rowId) {
    return `<div class="photo-actions">
      <button type="button" class="button button-secondary photo-button" data-add-photo="${rowId}" data-camera="true">${cameraIcon} Ajouter une photo</button>
      <button type="button" class="button button-secondary gallery-button" data-add-photo="${rowId}" aria-label="Choisir des photos dans la galerie">${galleryIcon} Galerie</button>
    </div><div class="photo-list" data-photo-list="${rowId}"></div>`;
  }

  function renderSections() {
    const record = current();
    let ordinal = 0;
    $('#sections').innerHTML = config.sections.map((section, index) => `
      <details class="inspection-section" data-section-id="${section.id}" open>
        <summary><span class="section-heading"><span class="section-number">${String(index + 1).padStart(2, '0')}</span>
          <span class="section-title">${escapeHTML(section.title)}</span></span>
          <span class="section-progress" data-section-progress="${section.id}"></span></summary>
        <div class="section-body">${section.groups.map(group => `
          ${group.title ? `<h3 class="group-title">${escapeHTML(group.title)}</h3>` : ''}
          ${group.items.map(item => {
            const row = record.rows[item.id];
            ordinal += 1;
            return `<article class="inspection-row" data-row-id="${item.id}">
              <div class="row-main"><div class="row-title"><span class="item-number">${String(ordinal).padStart(2, '0')}</span>
                <h4 class="item-label" id="label-${item.id}">${escapeHTML(item.label)}</h4>
                ${item.frequency ? `<span class="item-frequency" title="Fréquence attendue, à titre indicatif">${escapeHTML(item.frequency)}</span>` : ''}</div>
                <div class="rating-options" role="group" aria-labelledby="label-${item.id}">
                  ${config.ratings.map(rating => `<button type="button" class="rating-button" data-row="${item.id}" data-rating="${rating.value}"
                    aria-pressed="${row.rating === rating.value}" aria-label="${rating.value} : ${escapeHTML(rating.label)}">
                    <span class="rating-number">${rating.value}</span><span class="rating-label">${escapeHTML(rating.label)}</span></button>`).join('')}
                </div></div>
              <p class="previous-comparison" data-comparison="${item.id}" hidden></p>
              <div class="row-details"><label class="remark-field" for="remark-${item.id}"><span>Remarque</span>
                <textarea id="remark-${item.id}" data-remark="${item.id}" rows="2" placeholder="Une observation à noter…">${escapeHTML(row.remark)}</textarea></label>
                <div class="photo-area">${photoButtons(item.id)}</div></div>
              <p class="photo-warning" data-warning="${item.id}" ${row.rating === 4 && !row.photos.length ? '' : 'hidden'}>
                Note 4 : une photo est recommandée. Pensez aussi à photographier tous les dégâts et actes de vandalisme.</p>
            </article>`;
          }).join('')}`).join('')}</div>
      </details>`).join('') + `
      <details class="inspection-section comments-section" open>
        <summary><span class="section-heading"><span class="section-number">${String(config.sections.length + 1).padStart(2, '0')}</span>
          <span class="section-title">COMMENTAIRES - REMARQUES</span></span></summary>
        <div class="section-body"><label class="remark-field" for="generalComments"><span>Remarques générales</span>
          <textarea id="generalComments" rows="4" placeholder="Observations complémentaires, travaux à prévoir…">${escapeHTML(record.comments.text)}</textarea></label>
          <div class="photo-area" id="generalPhotos">${photoButtons('comments')}</div></div>
      </details>`;
    items.forEach(item => renderPhotos(item.id));
    renderPhotos('comments');
  }

  function photoTarget(record, rowId) {
    return rowId === 'comments' ? record.comments : record.rows[rowId];
  }

  function renderPhotos(rowId) {
    const target = photoTarget(current(), rowId);
    const list = document.querySelector(`[data-photo-list="${rowId}"]`);
    if (!list) return;
    list.innerHTML = target.photos.map((photo, index) => `
      <figure class="photo-thumb"><button type="button" data-view-photo="${escapeHTML(photo.id)}" data-photo-row="${rowId}"
        aria-label="Agrandir la photo ${index + 1}"><img src="${escapeHTML(photo.dataUrl)}" alt="Photo ${index + 1} du contrôle" loading="lazy"></button>
        <button type="button" class="button button-danger remove-photo" data-remove-photo="${escapeHTML(photo.id)}" data-photo-row="${rowId}"
          aria-label="Supprimer la photo ${index + 1}" title="Supprimer la photo">×</button></figure>`).join('');
    if (rowId !== 'comments') {
      document.querySelector(`[data-warning="${rowId}"]`).hidden = target.rating !== 4 || target.photos.length > 0;
    }
  }

  function refreshDerived() {
    const record = current();
    $('#selectedBuildingName').textContent = buildingName(record);
    const count = ratedCount(record);
    $('#progressText').textContent = `${count} / ${items.length} lignes notées`;
    $('#progressBar').max = items.length;
    $('#progressBar').value = count;
    config.sections.forEach(section => {
      const sectionItems = section.groups.flatMap(group => group.items);
      const completed = sectionItems.filter(item => record.rows[item.id].rating).length;
      const element = document.querySelector(`[data-section-progress="${section.id}"]`);
      if (element) element.textContent = `${completed} / ${sectionItems.length}`;
    });
    const attention = items.filter(item => record.rows[item.id].rating >= 3);
    $('#summaryCount').textContent = attention.length ? `${attention.length} point${attention.length > 1 ? 's' : ''}` : 'Aucun point';
    $('#summaryContent').innerHTML = attention.length ? attention.map(item => {
      const row = record.rows[item.id];
      const section = config.sections.find(section => section.groups.some(group => group.items.some(candidate => candidate.id === item.id)));
      const group = section.groups.find(group => group.items.some(candidate => candidate.id === item.id));
      return `<article class="summary-item"><span class="summary-rating ${row.rating === 4 ? 'bad' : 'medium'}">${row.rating}</span>
        <div><h3 class="summary-label">${escapeHTML(item.label)}</h3>
          <p class="summary-meta">${escapeHTML(group.title || section.title)} · ${row.photos.length} photo${row.photos.length > 1 ? 's' : ''}</p>
          <p class="summary-remark">${escapeHTML(row.remark || 'Aucune remarque')}</p></div></article>`;
    }).join('') : '<p class="summary-empty">Les éléments notés 3 ou 4 apparaîtront ici, avec leurs remarques et leurs photos.</p>';
    renderComparisons();
    renderList();
  }

  function comparisonFor(record) {
    const visible = { ...record, lineLabels: Object.fromEntries(itemsFor(record).map(item => [item.id, item.label])) };
    return window.CONTROL_INSIGHTS.compare(visible, registeredControls,
      { isNew: newControlDates.has(record.id), defaultDate: newControlDates.get(record.id) || '' }, templateFor);
  }

  function comparisonMarkup(state) {
    if (!state || state.kind === 'none') return '<span>Aucun contrôle précédent</span>';
    const note = state.kind === 'new' ? 'Nouvelle ligne' : state.kind === 'unrated' ? 'Précédent : non noté'
      : state.kind === 'ambiguous' ? 'Libellé répété : comparaison non univoque' : `Précédent : ${state.rating}`;
    const marker = state.direction === 'worse' ? '<b class="comparison-worse" aria-label="Dégradation">↓ Dégradation</b>'
      : state.direction === 'better' ? '<b class="comparison-better" aria-label="Amélioration">↑ Amélioration</b>' : '';
    return `<span>${escapeHTML(note)}</span>${marker}${state.date ? `<small>${escapeHTML(displayDate(state.date))}</small>` : ''}`;
  }

  function renderComparisons() {
    const record = current();
    if (!record || view !== 'control') return;
    const comparison = comparisonFor(record);
    items.forEach(item => {
      const element = document.querySelector(`[data-comparison="${item.id}"]`);
      if (!element) return;
      element.hidden = !record.rows[item.id]?.rating;
      if (!element.hidden) element.innerHTML = comparisonMarkup(comparison.byRow[item.id]);
    });
  }

  const reportConfig = record => ({ ...templateFor(record), comparison: comparisonFor(record) });

  function renderEditor() {
    const record = current();
    if (!record) { renderPendingModel(); return; }
    setType(record.type);
    const pendingOffice = activeType === 'bureaux' && !items.length;
    $('#officePlaceholder').hidden = !pendingOffice || needsBuilding(record);
    $('#controlForm').hidden = false;
    $('#headerControl').hidden = view !== 'control' || pendingOffice;
    $('#controlActions').hidden = view !== 'control' || pendingOffice;
    $('#newControl').disabled = false;
    updatePageContext();
    $('#buildingSelectField').hidden = false;
    $('#buildingSelectLabel').textContent = activeType === 'bureaux' ? 'Bureau' : 'Immeuble';
    $('#addressLabel').textContent = activeType === 'bureaux' ? 'Adresse du bureau' : 'Adresse de l’immeuble';
    $('#address').placeholder = activeType === 'bureaux' ? 'Non renseignée' : 'Adresse de l’immeuble';
    $('#address').readOnly = true;
    $('#concierge').readOnly = false;
    $('#concierge').required = activeType === 'bureaux';
    $('#concierge').placeholder = activeType === 'bureaux' ? 'Nom' : 'Nom du concierge';
    $('#responsibleLabel').textContent = window.CONTROL_PEOPLE.label(record);
    $('#responsibleHelp').textContent = activeType === 'bureaux'
      ? 'Nom obligatoire, modifiable pour cette visite et enregistré avec ce contrôle.'
      : 'Nom proposé d’après la dernière visite, modifiable pour ce contrôle.';
    renderBuildingSelection();
    $('#address').value = record.address;
    $('#concierge').value = window.CONTROL_PEOPLE.name(record);
    updatePersonValidity();
    $('#controlDate').value = record.date;
    renderPhotosRemovedNotice(record);
    if (pendingOffice) {
      $('#inspectionFields').hidden = true;
      $('#sections').replaceChildren();
      renderList();
    } else {
      $('#inspectionFields').hidden = false;
      renderSections();
      refreshDerived();
    }
    setStorageStatus();
  }

  function renderBuildingSelection() {
    const record = current();
    const office = activeType === 'bureaux';
    const catalog = office ? offices : buildings;
    const legacy = !office && record.buildingId === undefined;
    const missing = !!record.buildingId && !catalog.some(building => building.id === record.buildingId);
    const select = $('#buildingSelect');
    select.innerHTML = `<option value="" disabled>${legacy ? 'Adresse historique conservée' : office ? 'Choisir un bureau' : 'Choisir un immeuble'}</option>` +
      (missing ? `<option value="${escapeHTML(record.buildingId)}">${escapeHTML(buildingName(record))} (retiré de la liste)</option>` : '') +
      catalog.map(building => `<option value="${escapeHTML(building.id)}">${escapeHTML(building.nom)}</option>`).join('');
    select.value = record.buildingId || '';
    select.required = !legacy;
    $('#buildingHelp').textContent = legacy
      ? 'Contrôle antérieur : l’adresse et le nom enregistrés sont conservés.'
      : missing ? 'Ce site a été retiré de la liste. Les informations et le modèle de ce contrôle sont conservés.'
        : needsBuilding(record) ? `Choisissez ${office ? 'le bureau' : 'l’immeuble'} pour commencer le contrôle.`
          : 'Adresse reprise de la liste ; le nom est enregistré uniquement avec cette visite.';
    const disabled = needsBuilding(record) || !items.length;
    $('#inspectionFields').disabled = disabled;
    $('#saveControl').disabled = disabled;
    $('#printControl').disabled = disabled;
    $('#finishControl').disabled = disabled;
  }

  function requireBuilding() {
    if (!needsBuilding(current())) return true;
    const field = $('#buildingSelect');
    field.reportValidity();
    field.focus();
    notify(`Choisissez ${activeType === 'bureaux' ? 'le bureau' : 'l’immeuble'} avant de remplir ou d’imprimer ce contrôle.`, true);
    return false;
  }

  function updatePersonValidity() {
    const field = $('#concierge');
    field.setCustomValidity(current()?.type === 'bureaux' && !window.CONTROL_PEOPLE.name(current())
      ? 'Renseignez le nom du nettoyeur ou de la nettoyeuse.' : '');
  }

  function requirePerson(record) {
    if (record.type !== 'bureaux' || window.CONTROL_PEOPLE.name(record)) return true;
    notify('Renseignez le champ « Nettoyeur/Nettoyeuse » avant d’enregistrer ou de générer le PDF.', true);
    if (record.id === currentId && view === 'control') {
      // perform() réactive le formulaire après cette action ; attendre avant le focus.
      requestAnimationFrame(() => {
        if (record.id !== currentId || view !== 'control') return;
        updatePersonValidity();
        $('#concierge').focus();
        $('#concierge').reportValidity();
      });
    }
    return false;
  }

  async function chooseBuilding() {
    const office = activeType === 'bureaux';
    const building = (office ? offices : buildings).find(building => building.id === $('#buildingSelect').value);
    if (!building) return;
    let officeSections;
    if (office) {
      try {
        officeSections = window.OFFICE_MODEL.sections(building);
        // Une capture en cours fait aussi partie du contrôle que l'on conserve.
        await flushChanges();
      }
      catch (error) { renderBuildingSelection(); throw error; }
    }
    let record = current();
    const typedBeforeSite = needsBuilding(record) ? window.CONTROL_PEOPLE.name(record) : '';
    const sameLegacySite = !office && record.buildingId === undefined && record.address === building.adresse;
    if (office && record.buildingId === building.id && record.officeSections?.length) {
      renderBuildingSelection();
      return;
    }
    if (!office && record.buildingId === building.id) { renderBuildingSelection(); return; }
    if (office && (archives.has(record.id) || record.comments.text || countPhotos(record) ||
        (record.buildingId && window.CONTROL_PEOPLE.name(record)) || Object.values(record.rows).some(row => row.rating || row.remark))) {
      if (!window.confirm('Choisir ce bureau crée un nouveau contrôle. Le contrôle actuel, ses notes, remarques, photos et PDF seront conservés. Continuer ?')) {
        renderBuildingSelection(); return;
      }
      await newControl();
      record = current();
    }
    if (!office && ((record.buildingId && record.buildingId !== building.id) || (record.address && record.address !== building.adresse)) &&
      !window.confirm('Changer l’immeuble de ce contrôle ? Son adresse sera remplie depuis la liste et un nom sera proposé d’après les visites de cet immeuble. Les notes, remarques et photos seront conservées.')) {
      renderBuildingSelection();
      return;
    }
    // Stocker un instantané, et non une référence recalculée à chaque réouverture.
    record.buildingId = building.id;
    record.buildingName = building.nom;
    record.address = building.adresse;
    const proposedName = typedBeforeSite || window.CONTROL_PEOPLE.previousName(record, registeredControls) ||
      (office ? '' : building.concierge || '');
    if (office) record.cleanerName = proposedName;
    else if (!sameLegacySite) record.concierge = proposedName;
    if (office) record.officeSections = officeSections;
    normalizeRecord(record);
    markChanged(record);
    renderEditor();
  }

  async function newControl() {
    if (activeType === 'bureaux' && !offices.length) { notify('Aucun bureau disponible dans la liste.'); return; }
    if (currentId) await flushChanges();
    const record = makeControl();
    newControlDates.set(record.id, record.date);
    controls.set(record.id, record);
    currentId = record.id;
    markChanged(record);
    showView('control');
    renderEditor();
    await persistChanges();
    notify('Nouveau contrôle créé.');
  }

  async function switchControl(id) {
    if (!controls.has(id)) { notify('Le contrôle d’origine a été supprimé. Le suivi reste conservé.'); return; }
    await prepareManagement();
    setType(controls.get(id).type);
    currentId = id;
    newControlDates.delete(id);
    showView('control');
    renderEditor();
  }

  async function duplicateControl() {
    await flushChanges();
    const record = structuredClone(current());
    record.id = uid();
    record.date = today();
    record.createdAt = new Date().toISOString();
    newControlDates.set(record.id, record.date);
    controls.set(record.id, record);
    currentId = record.id;
    markChanged(record);
    renderEditor();
    await persistChanges();
    notify('Contrôle dupliqué avec ses notes, remarques et photos.');
  }

  // Une opération de gestion reste possible lorsque le quota empêche l'autosauvegarde.
  async function prepareManagement() {
    await Promise.all([...photoJobs]);
    await saveQueue.catch(() => {});
    try { await flushChanges(); } catch { /* Les données en mémoire restent exportables. */ }
  }

  function countPhotos(record) {
    return Object.values(record.rows || {}).reduce((total, row) => total + (row.photos?.length || 0),
      record.comments?.photos?.length || 0);
  }

  function renderPhotosRemovedNotice(record = current()) {
    const notice = $('#photosRemovedNotice');
    notice.hidden = !record?.photosRemovedAt;
    if (record?.photosRemovedAt) {
      const removed = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(record.photosRemovedAt));
      notice.textContent = `Photos retirées le ${removed}. Les notes, remarques et le PDF ont été conservés.`;
    }
  }

  // Le dialogue est partagé : exporter ne confirme jamais la suppression.
  function confirmManagement({ title, description, exportFirst, deleteLabel = 'Confirmer la suppression' }) {
    const dialog = $('#massConfirmDialog');
    const exportButton = $('#massConfirmExport');
    const deleteButton = $('#massConfirmDelete');
    const cancelButton = $('#massConfirmCancel');
    const exportStatus = $('#massConfirmExportStatus');
    $('#massConfirmTitle').textContent = title;
    $('#massConfirmDescription').textContent = description;
    deleteButton.textContent = deleteLabel;
    exportStatus.hidden = true;
    exportStatus.textContent = '';
    dialog.returnValue = '';
    let exporting = false;
    const toggleButtons = disabled => {
      exportButton.disabled = disabled;
      deleteButton.disabled = disabled;
      cancelButton.disabled = disabled;
    };
    toggleButtons(false);
    return new Promise(resolve => {
      const cancel = () => dialog.close('cancel');
      const remove = () => dialog.close('delete');
      const escaped = event => { event.preventDefault(); if (!exporting) cancel(); };
      const exported = async () => {
        if (exporting) return;
        exporting = true;
        toggleButtons(true);
        exportStatus.hidden = false;
        exportStatus.textContent = 'Préparation de la sauvegarde JSON…';
        try {
          await exportFirst();
          exportStatus.textContent = 'Sauvegarde JSON téléchargée. Vérifiez le fichier avant de confirmer la suppression.';
        } catch (error) {
          exportStatus.textContent = `Export impossible : ${error.message || 'réessayez'}. Aucune donnée n’a été supprimée.`;
        } finally {
          exporting = false;
          toggleButtons(false);
        }
      };
      const closed = () => {
        exportButton.removeEventListener('click', exported);
        deleteButton.removeEventListener('click', remove);
        cancelButton.removeEventListener('click', cancel);
        dialog.removeEventListener('cancel', escaped);
        dialog.removeEventListener('close', closed);
        resolve(dialog.returnValue === 'delete');
      };
      exportButton.addEventListener('click', exported);
      deleteButton.addEventListener('click', remove);
      cancelButton.addEventListener('click', cancel);
      dialog.addEventListener('cancel', escaped);
      dialog.addEventListener('close', closed);
      dialog.showModal();
      cancelButton.focus();
    });
  }

  // Bloquer les écritures différées pendant la transaction évite de ressusciter une fiche supprimée.
  async function managedMutation(action) {
    clearTimeout(saveTimer);
    const editor = $('#controlForm');
    const wasInert = editor.inert;
    // Une frappe pendant la transaction ne doit pas modifier un ancien cliché.
    editor.inert = true;
    mutationBusy = true;
    pendingWrites += 1;
    setStorageStatus();
    try {
      // Vider aussi les clichés déjà en file avant de retirer les données.
      await saveQueue.catch(() => {});
      await action();
      if (!dirty.size && !anomalyDirty.size) saveError = false;
    }
    finally {
      editor.inert = wasInert;
      mutationBusy = false;
      pendingWrites -= 1;
      setStorageStatus();
      if (dirty.size || anomalyDirty.size) saveTimer = setTimeout(() => { persistChanges().catch(() => {}); }, 250);
    }
  }

  function refreshManagementViews() {
    lists.prune();
    renderList();
    if (view === 'folders') renderFolders();
    if (view === 'control') {
      if (current()) renderEditor();
      else showView('controls');
    }
  }

  async function deleteControls(ids) {
    await prepareManagement();
    const selected = [...new Set(ids)].filter(id => controls.has(id));
    if (!selected.length) return;
    const count = selected.length;
    const pdfCount = selected.filter(id => archives.has(id)).length;
    const photoCount = selected.reduce((total, id) => total + countPhotos(controls.get(id)), 0);
    if (!await confirmManagement({ title: `Supprimer ${count} contrôle${count > 1 ? 's' : ''} ?`,
      description: `Cette action supprime définitivement ${count} contrôle${count > 1 ? 's' : ''}, leurs ${photoCount} photo${photoCount > 1 ? 's' : ''} et leurs ${pdfCount} PDF correspondants dans Dossiers. Le suivi des anomalies et ses photos restent conservés, ainsi que les copies déjà téléchargées ou copiées sur ordinateur.`,
      exportFirst: () => exportBackup(selected, selected) })) return;
    await managedMutation(async () => {
      const owners = new Set(selected);
      const followUp = new Map(anomalies);
      // Conserver aussi les dernières observations en mémoire si l'autosauvegarde a échoué.
      deriveAnomalies(selected.map(id => controls.get(id))).forEach(anomaly => followUp.set(anomaly.id, anomaly));
      const retained = [...followUp.values()].filter(anomaly => owners.has(anomaly.controlId))
        .map(anomaly => ({ ...anomaly, controlDeleted: true, updatedAt: new Date().toISOString() }));
      await transaction('readwrite', stores => {
        selected.forEach(id => { stores.controls.delete(id); stores.archives.delete(id); });
        retained.forEach(anomaly => stores.anomalies.put(anomaly));
      }, ['controls', 'archives', 'anomalies']);
      retained.forEach(anomaly => { anomalies.set(anomaly.id, anomaly); anomalyDirty.delete(anomaly.id); });
      selected.forEach(id => {
        controls.delete(id); registeredControls.delete(id); newControlDates.delete(id);
        archives.delete(id); dirty.delete(id); versions.delete(id);
      });
      if (selected.includes(currentId)) currentId = sortedControls(activeType)[0]?.id;
    });
    refreshManagementViews();
    notify(`${count} contrôle${count > 1 ? 's' : ''} supprimé${count > 1 ? 's' : ''}, avec leurs photos et PDF.`);
  }

  async function removeControlsPhotos(ids, reason = '') {
    await prepareManagement();
    const selected = [...new Set(ids)].filter(id => controls.has(id) && countPhotos(controls.get(id)) > 0);
    if (!selected.length) { notify('Aucun contrôle concerné ne contient de photo.'); return; }
    const count = selected.length;
    const photoCount = selected.reduce((total, id) => total + countPhotos(controls.get(id)), 0);
    if (!await confirmManagement({ title: `Supprimer les photos de ${count} contrôle${count > 1 ? 's' : ''} ?`,
      description: `Retirer définitivement ${photoCount} photo${photoCount > 1 ? 's' : ''} de ${count} contrôle${count > 1 ? 's' : ''}${reason}. Les contrôles, notes, remarques et PDF restent intacts. Les photos du suivi des anomalies et des PDF archivés restent conservées.`,
      exportFirst: () => exportBackup(selected, selected), deleteLabel: 'Supprimer les photos' })) return;
    const timestamp = new Date().toISOString();
    const selectedOwners = new Set(selected);
    const pendingAnomalies = [...anomalyDirty].map(id => anomalies.get(id))
      .filter(anomaly => selectedOwners.has(anomaly.controlId));
    const anomalyUpdates = [...new Map([...pendingAnomalies,
      ...deriveAnomalies(selected.map(id => controls.get(id)))].map(anomaly => [anomaly.id, anomaly])).values()];
    const snapshots = selected.map(id => {
      // Construire le cliché sans recopier les grandes chaînes base64 qui vont être retirées.
      const original = controls.get(id);
      const record = { ...original,
        rows: Object.fromEntries(Object.entries(original.rows).map(([key, row]) => [key, { ...row, photos: [] }])),
        comments: { ...original.comments, photos: [] } };
      record.photosRemovedAt = timestamp;
      record.updatedAt = timestamp;
      return record;
    });
    await managedMutation(async () => {
      await transaction('readwrite', stores => {
        snapshots.forEach(record => stores.controls.put(record));
        anomalyUpdates.forEach(anomaly => stores.anomalies.put(anomaly));
      }, ['controls', 'anomalies']);
      anomalyUpdates.forEach(anomaly => { anomalies.set(anomaly.id, anomaly); anomalyDirty.delete(anomaly.id); });
      snapshots.forEach(record => {
        controls.set(record.id, record);
        registeredControls.set(record.id, structuredClone(record));
        versions.set(record.id, (versions.get(record.id) || 0) + 1);
        dirty.delete(record.id);
      });
    });
    refreshManagementViews();
    notify(`${photoCount} photo${photoCount > 1 ? 's' : ''} retirée${photoCount > 1 ? 's' : ''} de ${count} contrôle${count > 1 ? 's' : ''}. Les PDF sont conservés.`);
  }

  async function removeOlderPhotos() {
    const date = $('#photosBeforeDate').value;
    if (!validDate(date)) { $('#photosBeforeDate').reportValidity(); return; }
    const ids = [...controls.values()].filter(record => record.date < date).map(record => record.id);
    await removeControlsPhotos(ids, ` datés avant le ${displayDate(date)}, dans les deux activités`);
  }

  // La galerie accepte plusieurs images ; la capture privilégie l'appareil arrière.
  function selectPhotos(rowId, camera) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = !camera;
    if (camera) input.setAttribute('capture', 'environment');
    input.hidden = true;
    document.body.append(input);
    const recordId = currentId;
    input.addEventListener('change', () => {
      const files = [...input.files];
      input.remove();
      if (!files.length) return;
      const job = addPhotos(files, rowId, recordId).finally(() => {
        photoJobs.delete(job);
        setStorageStatus();
      });
      photoJobs.add(job);
      setStorageStatus();
    }, { once: true });
    input.addEventListener('cancel', () => input.remove(), { once: true });
    input.click();
  }

  async function compressPhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return { id: uid(), name: file.name, dataUrl: canvas.toDataURL('image/jpeg', 0.7),
        width: canvas.width, height: canvas.height, createdAt: new Date().toISOString() };
    } finally { URL.revokeObjectURL(url); }
  }

  async function addPhotos(files, rowId, recordId) {
    let added = 0;
    for (const file of files) {
      try {
        const photo = await compressPhoto(file);
        const record = controls.get(recordId);
        if (!record) return;
        photoTarget(record, rowId).photos.push(photo);
        markChanged(record);
        added += 1;
        if (recordId === currentId) { renderPhotos(rowId); refreshDerived(); }
      } catch (error) {
        notify(`Impossible de lire « ${file.name} ». Choisissez une image JPEG, PNG ou un autre format pris en charge par votre navigateur.`, true);
      }
    }
    if (added) await persistChanges().catch(() => {});
  }

  function viewPhoto(rowId, id) {
    const photo = photoTarget(current(), rowId).photos.find(photo => photo.id === id);
    if (!photo) return;
    const label = rowId === 'comments' ? 'Commentaires - Remarques' : items.find(item => item.id === rowId).label;
    openPhoto(photo, label);
  }

  function openPhoto(photo, caption) {
    $('#fullPhoto').src = photo.dataUrl;
    $('#fullPhoto').alt = caption;
    $('#photoCaption').textContent = caption;
    $('#photoDialog').showModal();
  }

  async function removePhoto(rowId, id) {
    const recordId = currentId;
    await prepareManagement();
    const record = controls.get(recordId);
    if (!record || !photoTarget(record, rowId).photos.some(photo => photo.id === id)) return;
    if (!await confirmManagement({ title: 'Supprimer cette photo ?',
      description: 'Cette action retire 1 photo de 1 contrôle. Les autres photos, notes, remarques et le PDF archivé sont conservés.',
      exportFirst: () => exportBackup([recordId], [recordId]), deleteLabel: 'Supprimer la photo' })) return;
    const target = photoTarget(record, rowId);
    target.photos = target.photos.filter(photo => photo.id !== id);
    markChanged(record);
    renderPhotos(rowId);
    refreshDerived();
  }

  // Téléchargement commun aux sauvegardes JSON et aux archives PDF.
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Les bornes portent sur la visite, jamais sur createdAt ou updatedAt.
  function collectExport(options, controlIds = null, archiveIds = null) {
    const source = controlIds === null ? sortedControls()
      : [...new Set(controlIds)].map(id => controls.get(id)).filter(Boolean);
    const records = window.CONTROL_TRANSFER.filter(source, options);
    const owners = new Set(records.map(record => record.id));
    const matches = record => window.CONTROL_TRANSFER.filter([record], options).length > 0;
    const archiveSource = archiveIds === null ? [...archives.values()]
      : [...new Set(archiveIds)].map(id => archives.get(id)).filter(Boolean);
    const selectedArchives = options.includePDFs ? archiveSource.filter(archive => owners.has(archive.controlId) ||
      (!controls.has(archive.controlId) && (controlIds === null || archiveIds !== null) && matches(archive))) : [];
    const extraOwners = new Set(selectedArchives.map(archive => archive.controlId));
    // Le suivi orphelin demeure sauvegardable, même après suppression du contrôle.
    const savedAnomalies = [...anomalies.values()].filter(anomaly => owners.has(anomaly.controlId) ||
      (!controls.has(anomaly.controlId) && (controlIds === null || extraOwners.has(anomaly.controlId)) && matches(anomaly)));
    return { records, selectedArchives, savedAnomalies };
  }

  async function writeExport(options, controlIds = null, archiveIds = null) {
    await prepareManagement();
    const { records, selectedArchives, savedAnomalies } = collectExport(options, controlIds, archiveIds);
    const pdfArchives = await Promise.all(selectedArchives.map(async ({ blob, ...metadata }) => ({
      ...metadata, pdfDataUrl: await blobToDataURL(blob)
    })));
    const timestamp = new Date().toISOString();
    const exportInfo = { createdAt: timestamp, period: { from: options.from, to: options.to },
      section: options.type, controlCount: records.length, anomalyCount: savedAnomalies.length,
      archiveCount: pdfArchives.length, includesPDFs: options.includePDFs,
      scope: controlIds === null ? 'all' : 'selection' };
    const payload = { format: 'conciergerie-controles', version: 4, exportedAt: timestamp, exportInfo,
      controls: records, archives: pdfArchives, anomalies: savedAnomalies,
      catalogs: window.CONTROL_TRANSFER.catalogs(records, [...savedAnomalies, ...selectedArchives],
        { conciergerie: buildings, bureaux: offices }) };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), window.CONTROL_TRANSFER.filename(options));
    notify(`${records.length} contrôle(s), ${pdfArchives.length} PDF et ${savedAnomalies.length} anomalie(s) exportés, photos incluses.`);
  }

  // La sauvegarde précédant une suppression reste complète pour les éléments concernés.
  function exportBackup(controlIds, archiveIds) {
    return writeExport({ from: null, to: null, type: 'both', includePDFs: true }, controlIds, archiveIds);
  }

  async function exportControls(controlIds = null) {
    await prepareManagement();
    const dialog = $('#exportDialog');
    const form = $('#exportForm');
    form.reset();
    form.noValidate = true;
    $('#exportError').hidden = true;
    $('#exportScope').textContent = controlIds === null ? 'Tous les contrôles des deux activités sont disponibles.'
      : `${controlIds.length} contrôle(s) sélectionné(s). La période et la section restreignent cette sélection.`;
    let busy = false;
    const options = () => {
      const from = window.CONTROL_TRANSFER.parseDate($('#exportFrom').value);
      const to = window.CONTROL_TRANSFER.parseDate($('#exportTo').value);
      if (from && to && from > to) throw new Error('La date de début doit précéder ou égaler la date de fin.');
      return { from, to, type: $('#exportType').value, includePDFs: $('#exportIncludePDFs').checked };
    };
    const update = () => {
      try {
        const data = collectExport(options(), controlIds);
        $('#exportPreview').textContent = `${data.records.length} contrôle(s), ${data.savedAnomalies.length} anomalie(s), ${data.selectedArchives.length} PDF. Photos incluses.`;
      } catch { $('#exportPreview').textContent = 'Saisissez des dates valides au format jj/mm/aaaa.'; }
    };
    const preset = event => {
      const button = event.target.closest('[data-export-preset]');
      if (!button) return;
      const period = window.CONTROL_TRANSFER.period(button.dataset.exportPreset, today());
      $('#exportFrom').value = window.CONTROL_TRANSFER.formatDate(period.from);
      $('#exportTo').value = window.CONTROL_TRANSFER.formatDate(period.to);
      dialog.querySelectorAll('[data-export-preset]').forEach(item => item.setAttribute('aria-pressed', item === button));
      $('#exportError').hidden = true;
      update();
    };
    const changed = event => {
      if (['exportFrom', 'exportTo'].includes(event.target.id)) {
        const field = event.target;
        if (/^\d{8}$/.test(field.value)) field.value = field.value.replace(/^(\d{2})(\d{2})(\d{4})$/, '$1/$2/$3');
        dialog.querySelectorAll('[data-export-preset]').forEach(item => item.setAttribute('aria-pressed', 'false'));
      }
      $('#exportError').hidden = true;
      update();
    };
    dialog.querySelectorAll('[data-export-preset]').forEach(item => item.setAttribute('aria-pressed', item.dataset.exportPreset === 'all'));
    update();
    return new Promise(resolve => {
      const cancel = () => { if (!busy) dialog.close('cancel'); };
      const escaped = event => { event.preventDefault(); cancel(); };
      const submit = async event => {
        event.preventDefault();
        if (busy) return;
        try {
          const settings = options();
          busy = true;
          form.querySelectorAll('button,input,select').forEach(field => { field.disabled = true; });
          await writeExport(settings, controlIds);
          dialog.close('exported');
        } catch (error) {
          $('#exportError').textContent = error.message || 'L’export a échoué. Réessayez.';
          $('#exportError').hidden = false;
        } finally {
          busy = false;
          form.querySelectorAll('button,input,select').forEach(field => { field.disabled = false; });
        }
      };
      const closed = () => {
        form.removeEventListener('submit', submit);
        form.removeEventListener('input', changed);
        dialog.removeEventListener('click', preset);
        dialog.removeEventListener('cancel', escaped);
        dialog.removeEventListener('close', closed);
        $('#exportCancel').removeEventListener('click', cancel);
        resolve(dialog.returnValue === 'exported');
      };
      form.addEventListener('submit', submit);
      form.addEventListener('input', changed);
      dialog.addEventListener('click', preset);
      dialog.addEventListener('cancel', escaped);
      dialog.addEventListener('close', closed);
      $('#exportCancel').addEventListener('click', cancel);
      dialog.showModal();
      $('#exportFrom').focus();
    });
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function validDate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }

  // Le séparateur historique « -- » ne doit jamais rattacher une preuve à une autre ligne.
  function checkAnomalyIdentities(records, snapshots, invalid) {
    const identities = new Map();
    const bind = (controlId, rowId) => {
      const id = window.ANOMALIES.id(controlId, rowId);
      const previous = identities.get(id);
      if (previous && (previous.controlId !== controlId || previous.rowId !== rowId)) invalid();
      identities.set(id, { controlId, rowId });
    };
    snapshots.forEach(anomaly => bind(anomaly.controlId, anomaly.rowId));
    records.forEach(record => Object.keys(record.rows).forEach(rowId => bind(record.id, rowId)));
  }

  // Import strict et atomique : un fichier invalide ne modifie aucun contrôle existant.
  function validateImport(payload) {
    const invalid = () => { throw new Error('Fichier de sauvegarde invalide. Aucun contrôle n’a été importé.'); };
    if (!payload || payload.format !== 'conciergerie-controles' || ![1, 2, 3, 4].includes(payload.version) ||
      !Array.isArray(payload.controls) || (payload.version >= 2 && !Array.isArray(payload.archives)) ||
      (payload.version >= 3 && !Array.isArray(payload.anomalies))) invalid();
    const catalogs = window.CONTROL_TRANSFER.validateCatalogs(payload.catalogs);
    if (payload.version === 4) {
      const info = payload.exportInfo;
      const period = info?.period;
      if (!info || typeof info.createdAt !== 'string' || Number.isNaN(Date.parse(info.createdAt)) ||
        !period || typeof period !== 'object' || Array.isArray(period) ||
        !Object.hasOwn(period, 'from') || !Object.hasOwn(period, 'to') ||
        (period.from != null && !validDate(period.from)) ||
        (period.to != null && !validDate(period.to))) invalid();
      if ((period.from && period.to && period.from > period.to) ||
        !['both', 'conciergerie', 'bureaux'].includes(info.section) ||
        info.controlCount !== payload.controls.length || info.anomalyCount !== payload.anomalies.length ||
        info.archiveCount !== payload.archives.length || typeof info.includesPDFs !== 'boolean' ||
        (!info.includesPDFs && payload.archives.length)) invalid();
    }
    const string = value => { if (typeof value !== 'string') invalid(); return value; };
    const photoIds = new Map();
    const photos = values => {
      if (!Array.isArray(values)) invalid();
      return values.map(photo => {
        if (!photo || typeof photo.dataUrl !== 'string' ||
          !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo.dataUrl) ||
          !Number.isInteger(photo.width) || photo.width < 1 || !Number.isInteger(photo.height) || photo.height < 1) invalid();
        // Les copies d'une même photo gardent une identité commune dans les relevés.
        const sourceId = typeof photo.id === 'string' ? photo.id : '';
        if (!photoIds.has(sourceId)) photoIds.set(sourceId, new Map());
        const byImage = photoIds.get(sourceId);
        if (!byImage.has(photo.dataUrl)) byImage.set(photo.dataUrl,
          !byImage.size && /^[a-zA-Z0-9-]{1,100}$/.test(sourceId) ? sourceId : uid());
        return { id: byImage.get(photo.dataUrl), name: string(photo.name), dataUrl: photo.dataUrl,
          width: photo.width, height: photo.height, createdAt: string(photo.createdAt) };
      });
    };
    const ids = new Set();
    const records = payload.controls.map(record => {
      if (!record || typeof record.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(record.id) ||
        ids.has(record.id) || !validDate(record.date) || !record.rows || typeof record.rows !== 'object' ||
        Array.isArray(record.rows) || !record.comments) invalid();
      if (!['conciergerie', 'bureaux'].includes(record.type ?? 'conciergerie')) invalid();
      if (record.concierge !== undefined && typeof record.concierge !== 'string') invalid();
      if (Object.hasOwn(record, 'cleanerName') && typeof record.cleanerName !== 'string') invalid();
      if (record.completedAt != null && (typeof record.completedAt !== 'string' || Number.isNaN(Date.parse(record.completedAt)))) invalid();
      if (record.photosRemovedAt != null && (typeof record.photosRemovedAt !== 'string' || Number.isNaN(Date.parse(record.photosRemovedAt)))) invalid();
      let officeSections;
      if (record.officeSections != null) {
        if (record.type !== 'bureaux') invalid();
        try { officeSections = window.OFFICE_MODEL.validateSnapshot(record.officeSections); }
        catch { invalid(); }
      }
      // Les exports v1 sans immeuble restent compatibles ; les champs ajoutés sont facultatifs.
      if (record.buildingId != null && (typeof record.buildingId !== 'string' || !record.buildingId)) invalid();
      if (record.buildingName != null && typeof record.buildingName !== 'string') invalid();
      let lineLabels;
      if (Object.hasOwn(record, 'lineLabels')) {
        if (!record.lineLabels || typeof record.lineLabels !== 'object' || Array.isArray(record.lineLabels)) invalid();
        lineLabels = Object.fromEntries(Object.entries(record.lineLabels).map(([id, label]) => {
          if (!/^[a-z][a-z0-9-]*$/.test(id) || typeof label !== 'string' || !label) invalid();
          return [id, label];
        }));
      }
      ids.add(record.id);
      const rows = {};
      Object.entries(record.rows).forEach(([key, row]) => {
        if (!/^[a-z][a-z0-9-]*$/.test(key) || !row ||
          !(row.rating === null || [1, 2, 3, 4].includes(row.rating))) invalid();
        rows[key] = { rating: row.rating, remark: string(row.remark), photos: photos(row.photos) };
      });
      return normalizeRecord({ id: record.id, type: record.type ?? 'conciergerie', date: record.date, address: string(record.address),
        ...(Object.hasOwn(record, 'buildingId') ? { buildingId: record.buildingId } : {}),
        buildingName: record.buildingName ?? '',
        ...(Object.hasOwn(record, 'concierge') ? { concierge: record.concierge } : {}),
        ...(Object.hasOwn(record, 'cleanerName') ? { cleanerName: record.cleanerName } : {}),
        createdAt: string(record.createdAt), updatedAt: string(record.updatedAt),
        ...(record.completedAt ? { completedAt: record.completedAt } : {}),
        ...(record.photosRemovedAt ? { photosRemovedAt: record.photosRemovedAt } : {}),
        ...(officeSections ? { officeSections } : {}),
        ...(lineLabels ? { lineLabels } : {}),
        rows, comments: { text: string(record.comments.text), photos: photos(record.comments.photos) } });
    });
    const ownerTypes = new Map();
    const registerOwnerType = (id, type) => {
      if (ownerTypes.has(id) && ownerTypes.get(id) !== type) invalid();
      ownerTypes.set(id, type);
    };
    records.forEach(record => registerOwnerType(record.id, record.type));
    const archiveIds = new Set();
    const pdfArchives = (payload.version >= 2 ? payload.archives : []).map(archive => {
      if (!archive || typeof archive.controlId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(archive.controlId) ||
        archiveIds.has(archive.controlId) || !['conciergerie', 'bureaux'].includes(archive.type) || !validDate(archive.date) ||
        typeof archive.filename !== 'string' || !archive.filename.endsWith('.pdf') || /[\\/\x00-\x1f]/.test(archive.filename) ||
        typeof archive.generatedAt !== 'string' || Number.isNaN(Date.parse(archive.generatedAt)) ||
        (archive.buildingId != null && typeof archive.buildingId !== 'string') ||
        typeof archive.pdfDataUrl !== 'string' || !/^data:application\/pdf;base64,[A-Za-z0-9+/]+={0,2}$/.test(archive.pdfDataUrl)) invalid();
      registerOwnerType(archive.controlId, archive.type);
      archiveIds.add(archive.controlId);
      let binary;
      try { binary = atob(archive.pdfDataUrl.split(',')[1]); } catch { invalid(); }
      if (!binary.startsWith('%PDF-') || !binary.slice(-2048).includes('%%EOF')) invalid();
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return { controlId: archive.controlId, type: archive.type, date: archive.date,
        buildingId: archive.buildingId ?? null, buildingName: string(archive.buildingName), address: string(archive.address),
        filename: archive.filename, generatedAt: archive.generatedAt, blob: new Blob([bytes], { type: 'application/pdf' }) };
    });
    const savedAnomalies = payload.version >= 3
      ? window.ANOMALIES.validate(payload.anomalies, { validDate, photos }) : [];
    savedAnomalies.forEach(anomaly => registerOwnerType(anomaly.controlId, anomaly.type));
    checkAnomalyIdentities(records, savedAnomalies, invalid);
    return { records, pdfArchives, savedAnomalies, catalogs };
  }

  function confirmImport(data) {
    const dialog = $('#importDialog');
    const form = $('#importForm');
    const conflicts = data.records.filter(record => controls.has(record.id));
    const choices = new Map(conflicts.map(record => [record.id, 'keep']));
    let page = 0;
    const render = () => {
      const replaced = [...choices.values()].filter(choice => choice === 'replace').length;
      $('#importSummary').textContent = `${data.records.length - conflicts.length} contrôle(s) à ajouter, ${conflicts.length - replaced} ignoré(s), ${conflicts.length} en doublon, dont ${replaced} à remplacer. Le fichier contient ${data.savedAnomalies.length} anomalie(s) et ${data.pdfArchives.length} PDF.`;
      $('#importConflictTools').hidden = !conflicts.length;
      $('#importConflicts').innerHTML = conflicts.slice(page * 50, (page + 1) * 50).map(record => `
        <div class="import-conflict"><p class="import-conflict-title">${escapeHTML(buildingName(record))}</p>
          <p class="import-conflict-meta">${escapeHTML(typeLabels[record.type])} · ${escapeHTML(displayDate(record.date))}</p>
          <label class="form-field"><span>Contrôle ${escapeHTML(record.id)}</span>
            <select data-import-conflict="${escapeHTML(record.id)}"><option value="keep" ${choices.get(record.id) === 'keep' ? 'selected' : ''}>Garder l’existant</option><option value="replace" ${choices.get(record.id) === 'replace' ? 'selected' : ''}>Remplacer</option></select></label></div>`).join('');
      const pages = Math.max(1, Math.ceil(conflicts.length / 50));
      $('#importConflictPagination').hidden = pages === 1;
      $('#importConflictPageInfo').textContent = `Page ${page + 1} sur ${pages}`;
      $('#importConflictPrevious').disabled = page === 0;
      $('#importConflictNext').disabled = page + 1 >= pages;
    };
    $('#importError').hidden = true;
    render();
    return new Promise(resolve => {
      const click = event => {
        if (event.target.closest('#importKeepAll')) choices.forEach((_, id) => choices.set(id, 'keep'));
        else if (event.target.closest('#importReplaceAll')) choices.forEach((_, id) => choices.set(id, 'replace'));
        else if (event.target.closest('#importConflictPrevious')) page -= 1;
        else if (event.target.closest('#importConflictNext')) page += 1;
        else return;
        render();
      };
      const changed = event => {
        const id = event.target.dataset.importConflict;
        if (choices.has(id)) { choices.set(id, event.target.value); render(); }
      };
      const submit = event => { event.preventDefault(); dialog.close('import'); };
      const cancel = () => dialog.close('cancel');
      const escaped = event => { event.preventDefault(); cancel(); };
      const closed = () => {
        form.removeEventListener('submit', submit);
        dialog.removeEventListener('click', click);
        dialog.removeEventListener('change', changed);
        dialog.removeEventListener('cancel', escaped);
        dialog.removeEventListener('close', closed);
        $('#importCancel').removeEventListener('click', cancel);
        resolve(dialog.returnValue === 'import' ? choices : null);
      };
      form.addEventListener('submit', submit);
      dialog.addEventListener('click', click);
      dialog.addEventListener('change', changed);
      dialog.addEventListener('cancel', escaped);
      dialog.addEventListener('close', closed);
      $('#importCancel').addEventListener('click', cancel);
      $('#importTitle').tabIndex = -1;
      dialog.showModal();
      $('#importTitle').focus({ preventScroll: true });
      dialog.scrollTop = 0;
    });
  }

  async function importControls(file) {
    let payload;
    try { payload = JSON.parse(await file.text()); }
    catch { throw new Error('Ce fichier ne contient pas une sauvegarde JSON valide.'); }
    const data = validateImport(payload);
    await flushChanges();
    const choices = await confirmImport(data);
    if (!choices) return;
    const replaced = new Set([...choices].filter(([, choice]) => choice === 'replace').map(([id]) => id));
    const records = data.records.filter(record => !choices.has(record.id) || replaced.has(record.id));
    const accepted = new Set(records.map(record => record.id));
    const incoming = new Set(data.records.map(record => record.id));
    // Un identifiant est commun aux trois stores : changer son type mêlerait deux suivis.
    const existingTypes = new Map();
    [...controls.values(), ...archives.values(), ...anomalies.values()].forEach(value => {
      const id = value.controlId || value.id;
      if (!existingTypes.has(id)) existingTypes.set(id, new Set());
      existingTypes.get(id).add(value.type);
    });
    [...data.records, ...data.pdfArchives, ...data.savedAnomalies].forEach(value => {
      const id = value.controlId || value.id;
      if (choices.get(id) === 'keep') return;
      if ([...(existingTypes.get(id) || [])].some(type => type !== value.type)) {
        throw new Error('Un identifiant existe déjà dans une autre section. Import annulé : gardez l’existant pour cet identifiant.');
      }
    });
    // Garder un contrôle garde aussi son suivi et son archive ; aucun ID n'est recopié.
    const pdfArchives = data.pdfArchives.filter(archive => accepted.has(archive.controlId) ||
      (!incoming.has(archive.controlId) && !controls.has(archive.controlId) && !archives.has(archive.controlId)));
    const imported = new Map();
    data.savedAnomalies.forEach(anomaly => {
      const owner = anomaly.controlId;
      const existing = anomalies.get(anomaly.id);
      if ((accepted.has(owner) || (!incoming.has(owner) && !controls.has(owner))) && (!existing || replaced.has(owner))) {
        imported.set(anomaly.id, { ...anomaly, controlDeleted: !accepted.has(owner) && !controls.has(owner) });
      }
    });
    checkAnomalyIdentities([...controls.values()].filter(record => !accepted.has(record.id)).concat(records),
      [...anomalies.values(), ...imported.values()], () => {
        throw new Error('Deux lignes partagent un identifiant de suivi ambigu. Aucune donnée n’a été importée.');
      });
    // Les anomalies plus anciennes absentes du fichier ne sont jamais effacées.
    const merged = new Map([...anomalies, ...imported]);
    deriveAnomalies(records, merged).forEach(anomaly => imported.set(anomaly.id, anomaly));
    anomalies.forEach(anomaly => {
      if (accepted.has(anomaly.controlId) && anomaly.controlDeleted && !imported.has(anomaly.id)) {
        imported.set(anomaly.id, { ...anomaly, controlDeleted: false });
      }
    });
    const catalogs = structuredClone(importedCatalogs);
    for (const [key, target] of [['conciergeries', buildings], ['bureaux', offices]]) {
      const known = new Set(target.map(site => site.id));
      data.catalogs[key].forEach(site => { if (!known.has(site.id)) { catalogs[key].push(site); known.add(site.id); } });
    }
    const added = records.length - replaced.size;
    await managedMutation(async () => {
      await transaction('readwrite', stores => {
        records.forEach(record => stores.controls.put(record));
        pdfArchives.forEach(archive => stores.archives.put(archive));
        imported.forEach(anomaly => stores.anomalies.put(anomaly));
        stores.settings.put({ name: 'importedCatalogs', value: catalogs });
      }, ['controls', 'archives', 'anomalies', 'settings']);
      records.forEach(record => {
        controls.set(record.id, record);
        registeredControls.set(record.id, structuredClone(record));
        versions.set(record.id, (versions.get(record.id) || 0) + 1);
        dirty.delete(record.id);
        newControlDates.delete(record.id);
      });
      pdfArchives.forEach(archive => archives.set(archive.controlId, archive));
      imported.forEach(anomaly => { anomalies.set(anomaly.id, anomaly); anomalyDirty.delete(anomaly.id); });
      importedCatalogs = catalogs;
      mergeCatalogs(catalogs);
    });
    lists.prune();
    if (records.length) {
      currentId = records[0].id;
      setType(records[0].type);
      showView('control');
      renderEditor();
    } else if (imported.size && !pdfArchives.length) {
      setType([...imported.values()][0].type);
      showView('anomalies');
    } else if (pdfArchives.length) {
      showView('folders');
      renderFolders();
    }
    notify(`${added} contrôle(s) ajouté(s), ${data.records.length - records.length} ignoré(s), ${replaced.size} remplacé(s) ; ${pdfArchives.length} PDF importé(s).`);
  }

  function printPhotos(photos) {
    return `<div class="print-photos">${photos.map((photo, index) => `<figure><img src="${escapeHTML(photo.dataUrl)}"
      alt="Photo ${index + 1}"><figcaption>Photo ${index + 1}</figcaption></figure>`).join('')}</div>`;
  }

  function renderPrintReport() {
    const record = current();
    if (!record || view !== 'control' || !items.length) { $('#printReport').innerHTML = ''; return; }
    const comparison = comparisonFor(record);
    $('#printReport').innerHTML = `<header class="print-header"><img class="print-logo" src="logo-horizontal.png" alt="E. Blanco SA">
      <h1>${record.type === 'bureaux' ? 'Modèle de contrôle de l’entretien de bureaux' : 'Modèle de contrôle des conciergeries'}</h1>
      <dl class="print-metadata">${record.buildingName ? `<div><dt>${record.type === 'bureaux' ? 'Bureau' : 'Immeuble'}</dt><dd>${escapeHTML(record.buildingName)}</dd></div>` : ''}
        <div><dt>${record.type === 'bureaux' ? 'Adresse du bureau' : 'Adresse de l’immeuble'}</dt><dd>${escapeHTML(record.address)}</dd></div>
        <div><dt>${escapeHTML(window.CONTROL_PEOPLE.label(record))} :</dt><dd>${escapeHTML(window.CONTROL_PEOPLE.display(record))}</dd></div>
        <div><dt>Date</dt><dd>${escapeHTML(displayDate(record.date))}</dd></div></dl>
      <p class="print-legend">1 = Très bon · 2 = Bon · 3 = Moyen · 4 = Mauvais</p>
      <p>Joindre une photo pour la note 4, ainsi que pour tous les dégâts et actes de vandalisme.</p></header>
      ${config.sections.map((section, index) => `<section><h2 class="print-section-title">${index + 1}. ${escapeHTML(section.title)}</h2>
        ${section.groups.map(group => `${group.title ? `<h3 class="print-group-title">${escapeHTML(group.title)}</h3>` : ''}
          <table class="print-table"><colgroup><col style="width:35%"><col span="4" style="width:6%"><col style="width:41%"></colgroup>
            <thead><tr><th scope="col">Élément contrôlé</th>${[1, 2, 3, 4].map(value => `<th scope="col">${value}</th>`).join('')}<th scope="col">Remarques</th></tr></thead>
            <tbody>${group.items.map(item => {
              const row = record.rows[item.id];
              return `<tr><th scope="row">${escapeHTML(item.label)}${item.frequency ? `<br><small>Fréquence attendue : ${escapeHTML(item.frequency)}</small>` : ''}${row.rating ? `<div class="previous-comparison">${comparisonMarkup(comparison.byRow[item.id])}</div>` : ''}</th>${[1, 2, 3, 4].map(value => `<td class="print-rating">${row.rating === value ? '×' : ''}</td>`).join('')}
                <td class="print-remark">${escapeHTML(row.remark)}</td></tr>${row.photos.length
                  ? `<tr class="print-photos-row"><td colspan="6"><strong>${escapeHTML(item.label)}</strong>${printPhotos(row.photos)}</td></tr>` : ''}`;
            }).join('')}</tbody></table>`).join('')}</section>`).join('')}
      <section class="print-comments"><h2 class="print-section-title">${config.sections.length + 1}. COMMENTAIRES - REMARQUES</h2>
        <p>${escapeHTML(record.comments.text || '—')}</p>${printPhotos(record.comments.photos)}</section>
      <footer class="print-footer">${escapeHTML(config.footer)}</footer>`;
  }

  function setType(type) {
    activeType = type;
    const subject = current()?.type === type ? current() : type;
    config = templateFor(subject);
    items = itemsFor(subject);
    itemIds = new Set(items.map(item => item.id));
  }

  // Le titre visible situe la page ; l'onglet conserve le nom fixe de l'application.
  function updatePageContext() {
    if (view === 'control') route = { view, type: activeType, controlId: currentId };
    const labels = { menu: 'Menu', controls: 'Mes contrôles', anomalies: 'Suivi des anomalies',
      dashboard: 'Tableau de bord', control: newControlDates.has(currentId) ? 'Nouveau contrôle' : 'Contrôle' };
    const title = view === 'home' ? 'Accueil' : view === 'folders' ? 'Accueil > Dossiers'
      : `${typeLabels[activeType]} > ${labels[view]}`;
    $('#pageTitle').textContent = title;
    $('#sectionBackButton').hidden = view === 'home';
    $('#homeButton').hidden = view === 'home';
    $('#dashboardButton').hidden = !['menu', 'controls', 'anomalies', 'control'].includes(view);
  }

  function showView(nextView, { remember = true } = {}) {
    if (nextView === 'home') routeHistory.length = 0;
    else if (remember && (route.view !== nextView || route.type !== activeType)) routeHistory.push(route);
    view = nextView;
    route = { view, type: activeType, controlId: view === 'control' ? currentId : null };
    const views = { home: 'homeView', menu: 'sectionMenuView', controls: 'controlsView', anomalies: 'anomaliesView', control: 'controlView', folders: 'foldersView', dashboard: 'dashboardView' };
    Object.entries(views).forEach(([name, id]) => { $(`#${id}`).hidden = view !== name; });
    $('.skip-link').href = view === 'control' ? '#main' : `#${views[view]}`;
    updatePageContext();
    $('#headerControl').hidden = view !== 'control' || !current() || !items.length;
    $('#controlActions').hidden = view !== 'control' || !current() || !items.length;
    document.body.dataset.view = view;
    if (view === 'controls') renderList();
    if (view === 'anomalies') anomalyUI.render(activeType);
    if (view === 'dashboard') renderDashboard();
    window.scrollTo(0, 0);
  }

  async function goBack() {
    await prepareManagement();
    let target;
    do { target = routeHistory.pop(); }
    while (target?.view === 'control' && !controls.has(target.controlId));
    if (!target) { showView('home'); return; }
    if (target.view === 'control') currentId = target.controlId;
    setType(target.type);
    showView(target.view, { remember: false });
    if (target.view === 'control') renderEditor();
  }

  async function openType(type) {
    await prepareManagement();
    setType(type);
    showView('menu');
  }

  async function openControls() {
    await prepareManagement();
    showView('controls');
    $('#newControl').disabled = activeType === 'bureaux' && !offices.length;
  }

  async function openDashboard() {
    await prepareManagement();
    $('#dashboardSort').value = 'anomalies';
    showView('dashboard');
  }

  function renderDashboard() {
    const result = window.CONTROL_INSIGHTS.stats({ controls: registeredControls, anomalies,
      catalogs: { conciergerie: buildings, bureaux: offices },
      sort: $('#dashboardSort').value, type: activeType });
    $('#dashboardSummaryControls').textContent = result.summary.totalControls;
    $('#dashboardSummaryAnomalies').textContent = result.summary.openAnomalies;
    $('#dashboardSummaryDate').textContent = result.summary.lastDate ? displayDate(result.summary.lastDate) : 'Aucun contrôle';
    $('#dashboardEmpty').hidden = result.cards.length > 0;
    const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    $('#dashboardCards').innerHTML = result.cards.map(card => `<button type="button" class="dashboard-card" data-dashboard-site="${escapeHTML(card.key)}">
      <span class="dashboard-card-name">${escapeHTML(card.name)}</span>
      ${card.hasControl ? `<span class="dashboard-card-stats"><span><small>Moyenne du dernier contrôle</small><strong>${card.average === null ? 'Non noté' : decimal.format(card.average)}</strong></span>
        <span><small>Anomalies ouvertes</small><strong>${card.openAnomalies}</strong></span></span>
        <span class="dashboard-card-date">Dernier contrôle : ${escapeHTML(displayDate(card.latestDate))}</span>`
        : `<span class="dashboard-no-control">Aucun contrôle</span><span class="dashboard-card-date">${card.openAnomalies} anomalie${card.openAnomalies > 1 ? 's' : ''} ouverte${card.openAnomalies > 1 ? 's' : ''}</span>`}
      ${card.hasControl ? `<span class="dashboard-card-date">${escapeHTML(window.CONTROL_PEOPLE.label(activeType))} : ${escapeHTML(card.latestPersonName)}</span>` : ''}
      </button>`).join('');
  }

  async function openAnomalies() {
    await prepareManagement();
    anomalyUI.reset(activeType);
    showView('anomalies');
  }

  function viewAnomalyPhoto(id, photoId, correction) {
    const anomaly = anomalies.get(id);
    const photo = (correction ? anomaly?.correctionPhotos : anomaly?.photos)?.find(photo => photo.id === photoId);
    if (!photo) return;
    openPhoto(photo, `${correction ? 'Correction' : 'Anomalie'} : ${anomaly.label}`);
  }

  async function reopenAnomaly(id) {
    await flushChanges();
    const original = anomalies.get(id);
    if (!original) return;
    const updated = { ...original, status: 'open', updatedAt: new Date().toISOString() };
    await managedMutation(async () => {
      await transaction('readwrite', store => store.put(updated), 'anomalies');
      anomalies.set(id, updated);
    });
    anomalyUI.render(activeType);
    notify('Anomalie remise en cours. Le dernier réglage reste conservé.');
  }

  async function resolveAnomaly(id) {
    await flushChanges();
    const anomaly = anomalies.get(id);
    if (!anomaly) return;
    const dialog = $('#resolveAnomalyDialog');
    const date = $('#resolveAnomalyDate');
    const input = $('#resolveAnomalyPhoto');
    const save = $('#resolveAnomalySave');
    const cancel = $('#resolveAnomalyCancel');
    date.value = today();
    input.value = '';
    $('#resolveAnomalyPreview').textContent = '';
    $('#resolveAnomalyTitle').textContent = `Régler : ${anomaly.label}`;
    let working = false;
    const lock = disabled => { working = disabled; [save, cancel, date, input].forEach(element => { element.disabled = disabled; }); };
    lock(false);
    await new Promise(resolve => {
      const cancelled = () => dialog.close();
      const escaped = event => { event.preventDefault(); if (!working) cancelled(); };
      const changed = () => { $('#resolveAnomalyPreview').textContent = input.files[0]?.name || ''; };
      const saved = async () => {
        if (working || !validDate(date.value)) { if (!working) date.reportValidity(); return; }
        lock(true);
        pendingWrites += 1;
        setStorageStatus();
        try {
          const photo = input.files[0] ? await compressPhoto(input.files[0]) : null;
          const updated = { ...anomalies.get(id), status: 'resolved', resolvedDate: date.value,
            correctionPhotos: [...anomalies.get(id).correctionPhotos, ...(photo ? [photo] : [])], updatedAt: new Date().toISOString() };
          await transaction('readwrite', store => store.put(updated), 'anomalies');
          anomalies.set(id, updated);
          anomalyUI.render(activeType);
          dialog.close('saved');
          notify('Anomalie marquée comme réglée.');
        } catch (error) {
          notify(error.name === 'QuotaExceededError' ? 'Stockage insuffisant. Le réglage n’a pas été enregistré : exportez et libérez de la place.'
            : 'Le réglage n’a pas pu être enregistré. Vérifiez la photo ou réessayez.', true);
        } finally { lock(false); pendingWrites -= 1; setStorageStatus(); }
      };
      const closed = () => {
        save.removeEventListener('click', saved);
        cancel.removeEventListener('click', cancelled);
        input.removeEventListener('change', changed);
        dialog.removeEventListener('cancel', escaped);
        dialog.removeEventListener('close', closed);
        input.value = '';
        resolve();
      };
      save.addEventListener('click', saved);
      cancel.addEventListener('click', cancelled);
      input.addEventListener('change', changed);
      dialog.addEventListener('cancel', escaped);
      dialog.addEventListener('close', closed);
      dialog.showModal();
      cancel.focus();
    });
  }

  function renderPendingModel() {
    $('#sections').replaceChildren();
    updatePageContext();
    $('#officePlaceholder').hidden = false;
    $('#controlForm').hidden = true;
    $('#headerControl').hidden = true;
    $('#controlActions').hidden = true;
    $('#newControl').disabled = activeType === 'bureaux' && !offices.length;
    renderList();
  }

  async function goHome() {
    await prepareManagement();
    showView('home');
  }

  async function openFolders() {
    await prepareManagement();
    showView('folders');
    renderFolders();
    await updateDirectoryStatus();
  }

  function renderFolders() {
    lists.renderArchives();
  }

  function downloadPDF(archive) {
    downloadBlob(archive.blob, archive.filename);
  }

  function buildArchive(record, blob, generatedAt = new Date().toISOString()) {
    return { controlId: record.id, type: record.type, buildingId: record.buildingId ?? null,
      buildingName: record.buildingName, address: record.address, date: record.date,
      filename: window.CONTROL_PDF.filename(record), generatedAt, blob };
  }

  async function downloadControlPDF(id) {
    const canWrite = !archives.has(id) && await directoryPermission(true);
    await prepareManagement();
    if (archives.has(id)) { downloadPDF(archives.get(id)); return; }
    const record = controls.get(id);
    if (!record) return;
    if (needsBuilding(record) || !itemsFor(record).length) {
      notify('Choisissez le site et son modèle avant de générer ce PDF.', true); return;
    }
    if (!requirePerson(record)) {
      await switchControl(id);
      requirePerson(record);
      return;
    }
    pdfBusy = true;
    setStorageStatus();
    try {
      const blob = await window.CONTROL_PDF.generate(structuredClone(record), reportConfig(record));
      const archive = buildArchive(record, blob);
      await transaction('readwrite', store => store.put(archive), 'archives');
      archives.set(id, archive);
      downloadPDF(archive);
      if (canWrite) {
        try { await writeDirectoryPDF(archive); }
        catch { notify('PDF archivé et téléchargé. La copie ordinateur a échoué ; vérifiez son autorisation.', true); }
      }
    } finally { pdfBusy = false; setStorageStatus(); }
  }

  function previewArchive(id) {
    const archive = archives.get(id);
    if (!archive) return;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(archive.blob);
    $('#archiveDialog').dataset.controlId = id;
    $('#archiveCaption').textContent = `${archive.filename} — ${displayDate(archive.date)}`;
    $('#archivePreview').src = previewURL;
    $('#archivePreviewDownload').href = previewURL;
    $('#archivePreviewDownload').download = archive.filename;
    $('#archiveDialog').showModal();
  }

  async function deleteArchives(ids) {
    await prepareManagement();
    const selected = [...new Set(ids)].filter(id => archives.has(id));
    if (!selected.length) return;
    const count = selected.length;
    const ownerCount = selected.filter(id => controls.has(id)).length;
    if (!await confirmManagement({ title: `Supprimer ${count} PDF de Dossiers ?`,
      description: `Cette action supprime définitivement ${count} PDF dans Dossiers. Les ${ownerCount} contrôle${ownerCount > 1 ? 's' : ''} correspondant${ownerCount > 1 ? 's' : ''}, leurs photos et les copies déjà téléchargées ou copiées sur ordinateur restent conservés.`,
      exportFirst: () => exportBackup(selected.filter(id => controls.has(id)), selected) })) return;
    await managedMutation(async () => {
      await transaction('readwrite', store => selected.forEach(id => store.delete(id)), 'archives');
      selected.forEach(id => archives.delete(id));
    });
    if (selected.includes($('#archiveDialog').dataset.controlId) && $('#archiveDialog').open) $('#archiveDialog').close();
    refreshManagementViews();
    notify(`${count} PDF supprimé${count > 1 ? 's' : ''} de Dossiers. Les contrôles sont conservés.`);
  }

  function supportsDirectory() {
    return typeof window.showDirectoryPicker === 'function' &&
      !navigator.userAgentData?.mobile && !/Android|iPhone|iPad/i.test(navigator.userAgent);
  }

  async function updateDirectoryStatus() {
    $('#chooseDirectory').hidden = !supportsDirectory();
    $('#authorizeDirectory').hidden = true;
    if (!supportsDirectory()) {
      $('#directoryStatus').textContent = 'Les PDF restent disponibles dans Dossiers et peuvent être téléchargés sur cet appareil.';
      return;
    }
    if (!directoryHandle) {
      $('#directoryStatus').textContent = 'Dossier ordinateur facultatif. Les PDF sont toujours archivés dans ce navigateur.';
      return;
    }
    let granted = false;
    try { granted = await directoryHandle.queryPermission({ mode: 'readwrite' }) === 'granted'; } catch { /* Le téléchargement reste disponible. */ }
    $('#authorizeDirectory').hidden = granted;
    $('#directoryStatus').textContent = granted ? `Copie automatique activée : ${directoryHandle.name || 'dossier choisi'}.`
      : 'Dossier mémorisé : autorisez à nouveau son accès pour reprendre la copie automatique.';
  }

  async function readDirectory() {
    let request;
    await transaction('readonly', store => { request = store.get('pdf-directory'); }, 'settings');
    directoryHandle = request.result?.handle;
    await updateDirectoryStatus();
  }

  async function chooseDirectory() {
    if (!supportsDirectory()) return;
    try {
      // Appelé directement depuis le clic pour conserver l'activation utilisateur requise.
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await transaction('readwrite', store => store.put({ name: 'pdf-directory', handle }), 'settings');
      directoryHandle = handle;
      await updateDirectoryStatus();
      notify('Dossier mémorisé. Les prochains PDF enregistrés y seront aussi copiés.');
    } catch (error) {
      if (error.name !== 'AbortError') notify('Le dossier n’a pas pu être choisi ou mémorisé. Les PDF restent disponibles dans Dossiers.', true);
    }
  }

  async function directoryPermission(interactive) {
    if (!directoryHandle || !supportsDirectory()) return false;
    try {
      let permission = await directoryHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted' && interactive) permission = await directoryHandle.requestPermission({ mode: 'readwrite' });
      await updateDirectoryStatus();
      return permission === 'granted';
    } catch { await updateDirectoryStatus(); return false; }
  }

  async function writeDirectoryPDF(archive, previous) {
    // Un sous-dossier par contrôle évite qu'un contrôle dupliqué écrase le PDF de l'original.
    const directory = await directoryHandle.getDirectoryHandle(archive.controlId, { create: true });
    const file = await directory.getFileHandle(archive.filename, { create: true });
    const writable = await file.createWritable();
    try { await writable.write(archive.blob); await writable.close(); }
    catch (error) { await writable.abort().catch(() => {}); throw error; }
    if (previous && previous.filename !== archive.filename) {
      try { await directory.removeEntry(previous.filename); }
      catch (error) { if (error.name !== 'NotFoundError') throw error; }
    }
  }

  async function saveControl({ finish = false, download = false } = {}) {
    if (!current() || !items.length || !requireBuilding() || !requirePerson(current())) return;
    // Redemander l'autorisation avant la génération longue, pendant le geste utilisateur.
    const canWrite = await directoryPermission(true);
    const editor = $('#controlForm');
    editor.inert = true;
    pdfBusy = true;
    setStorageStatus();
    try {
      await flushChanges();
      const record = structuredClone(current());
      const timestamp = new Date().toISOString();
      record.updatedAt = timestamp;
      if (finish) record.completedAt = timestamp;
      const blob = await window.CONTROL_PDF.generate(record, reportConfig(record));
      const previous = archives.get(record.id);
      const archive = buildArchive(record, blob, timestamp);
      // Le cliché du contrôle et son PDF sont enregistrés ensemble, ou pas du tout.
      const anomalyUpdates = deriveAnomalies([record]);
      await transaction('readwrite', stores => {
        stores.controls.put(record); stores.archives.put(archive);
        anomalyUpdates.forEach(anomaly => stores.anomalies.put(anomaly));
      }, ['controls', 'archives', 'anomalies']);
      anomalyUpdates.forEach(anomaly => anomalies.set(anomaly.id, anomaly));
      controls.set(record.id, record);
      registeredControls.set(record.id, structuredClone(record));
      archives.set(record.id, archive);
      versions.set(record.id, (versions.get(record.id) || 0) + 1);
      dirty.delete(record.id);
      saveError = false;
      renderList();
      if (download) downloadPDF(archive);
      let copied = false;
      if (canWrite) {
        try { await writeDirectoryPDF(archive, previous); copied = true; }
        catch { await updateDirectoryStatus(); notify('PDF archivé dans Dossiers, mais la copie ordinateur a échoué. Vérifiez le dossier et son autorisation.', true); return; }
      }
      notify(`${finish ? 'Contrôle terminé' : 'Contrôle enregistré'} : PDF actualisé dans Dossiers${copied ? ' et copié sur ordinateur' : ''}.`);
    } catch (error) {
      throw new Error(error.name === 'QuotaExceededError'
        ? 'Stockage insuffisant pour le PDF. Les données du contrôle sont conservées ; exportez-les et libérez de la place dans Dossiers.'
        : 'Le PDF n’a pas pu être archivé. Les données du contrôle restent conservées. Réessayez.');
    } finally {
      editor.inert = false;
      pdfBusy = false;
      setStorageStatus();
    }
  }

  function bindEvents() {
    document.querySelectorAll('[data-open-type]').forEach(button => button.addEventListener('click', () => perform(() => openType(button.dataset.openType))));
    $('#homeButton').addEventListener('click', () => perform(goHome));
    $('#dashboardButton').addEventListener('click', () => perform(openDashboard));
    $('#dashboardSort').addEventListener('change', renderDashboard);
    $('#dashboardCards').addEventListener('click', event => {
      const card = event.target.closest('[data-dashboard-site]');
      if (card) perform(async () => {
        await openControls();
        lists.filterSite(activeType, card.dataset.dashboardSite, currentId);
      });
    });
    $('#sectionBackButton').addEventListener('click', () => perform(goBack));
    $('#menuNewControl').addEventListener('click', () => perform(newControl));
    $('#menuControls').addEventListener('click', () => perform(openControls));
    $('#menuAnomalies').addEventListener('click', () => perform(openAnomalies));
    $('.brand').addEventListener('click', event => { event.preventDefault(); perform(goHome); });
    $('#openFolders').addEventListener('click', () => perform(openFolders));
    $('#homeExport').addEventListener('click', () => perform(exportControls));
    $('#homeImport').addEventListener('click', () => $('#importFile').click());
    lists.bind();
    anomalyUI.bind();
    $('#exportSelectedControls').addEventListener('click', () => perform(() => {
      const ids = lists.selectedControls(activeType);
      return exportControls(ids);
    }));
    $('#deleteSelectedControls').addEventListener('click', () => perform(() => deleteControls(lists.selectedControls(activeType))));
    $('#removeSelectedPhotos').addEventListener('click', () => perform(() => removeControlsPhotos(lists.selectedControls(activeType))));
    $('#deleteSelectedArchives').addEventListener('click', () => perform(() => deleteArchives(lists.selectedArchives())));
    $('#removeOlderPhotos').addEventListener('click', () => perform(removeOlderPhotos));
    $('#chooseDirectory').addEventListener('click', () => perform(chooseDirectory));
    $('#authorizeDirectory').addEventListener('click', () => perform(async () => {
      if (await directoryPermission(true)) notify('Accès au dossier autorisé.');
      else notify('Accès non autorisé. Les PDF restent téléchargeables dans Dossiers.', true);
    }));
    $('#archiveTree').addEventListener('click', event => {
      const download = event.target.closest('[data-download-archive]');
      if (download) { downloadPDF(archives.get(download.dataset.downloadArchive)); return; }
      const preview = event.target.closest('[data-preview-archive]');
      if (preview) { previewArchive(preview.dataset.previewArchive); return; }
      const remove = event.target.closest('[data-delete-archive]');
      if (remove) perform(() => deleteArchives([remove.dataset.deleteArchive]));
    });
    $('#closeArchive').addEventListener('click', () => $('#archiveDialog').close());
    $('#archiveDialog').addEventListener('close', () => {
      $('#archivePreview').removeAttribute('src');
      $('#archivePreviewDownload').removeAttribute('href');
      if (previewURL) URL.revokeObjectURL(previewURL);
      previewURL = undefined;
    });
    $('#newControl').addEventListener('click', () => perform(newControl));
    $('#saveControl').addEventListener('click', () => perform(() => saveControl()));
    $('#finishControl').addEventListener('click', () => perform(() => saveControl({ finish: true })));
    $('#duplicateControl').addEventListener('click', () => perform(duplicateControl));
    $('#deleteControl').addEventListener('click', () => { if (current()) perform(() => deleteControls([currentId])); });
    $('#printControl').addEventListener('click', () => perform(() => saveControl({ download: true })));
    $('#importFile').addEventListener('change', event => {
      const file = event.target.files[0];
      event.target.value = '';
      if (file) perform(() => importControls(file));
    });
    $('#controlList').addEventListener('click', event => {
      const download = event.target.closest('[data-download-control]');
      if (download) { perform(() => downloadControlPDF(download.dataset.downloadControl)); return; }
      const remove = event.target.closest('[data-delete-control]');
      if (remove) { perform(() => deleteControls([remove.dataset.deleteControl])); return; }
      const button = event.target.closest('[data-open-control]');
      if (button) perform(() => switchControl(button.dataset.openControl));
    });
    $('#buildingSelect').addEventListener('change', () => perform(chooseBuilding));
    $('#concierge').addEventListener('input', event => {
      const record = current();
      if (!record) return;
      record[record.type === 'bureaux' ? 'cleanerName' : 'concierge'] = event.target.value;
      updatePersonValidity();
      markChanged(record);
      renderList();
    });
    $('#controlDate').addEventListener('input', event => {
      if (!validDate(event.target.value)) return;
      current().date = event.target.value;
      markChanged();
      renderComparisons();
      renderList();
    });
    $('#controlDate').addEventListener('blur', event => {
      // Une date effacée temporairement ne corrompt jamais le contrôle sauvegardé.
      if (!validDate(event.target.value)) event.target.value = current().date;
    });
    $('#sections').addEventListener('input', event => {
      const rowId = event.target.dataset.remark;
      if (rowId && itemIds.has(rowId)) current().rows[rowId].remark = event.target.value;
      else if (event.target.id === 'generalComments') current().comments.text = event.target.value;
      else return;
      markChanged();
      refreshDerived();
    });
    $('#sections').addEventListener('click', event => {
      const rating = event.target.closest('[data-rating]');
      if (rating) {
        const row = current().rows[rating.dataset.row];
        const value = Number(rating.dataset.rating);
        row.rating = row.rating === value ? null : value;
        const article = rating.closest('.inspection-row');
        article.querySelectorAll('[data-rating]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.rating) === row.rating));
        article.querySelector('.photo-warning').hidden = row.rating !== 4 || row.photos.length > 0;
        markChanged();
        refreshDerived();
        return;
      }
      const add = event.target.closest('[data-add-photo]');
      if (add) { selectPhotos(add.dataset.addPhoto, add.dataset.camera === 'true'); return; }
      const view = event.target.closest('[data-view-photo]');
      if (view) { viewPhoto(view.dataset.photoRow, view.dataset.viewPhoto); return; }
      const remove = event.target.closest('[data-remove-photo]');
      if (remove) perform(() => removePhoto(remove.dataset.photoRow, remove.dataset.removePhoto));
    });
    $('#closePhoto').addEventListener('click', () => $('#photoDialog').close());
    $('#photoDialog').addEventListener('click', event => { if (event.target === $('#photoDialog')) $('#photoDialog').close(); });
    window.addEventListener('beforeprint', renderPrintReport);
    window.addEventListener('beforeunload', event => {
      if (dirty.size || anomalyDirty.size || pendingWrites || photoJobs.size || pdfBusy) { event.preventDefault(); event.returnValue = ''; }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistChanges().catch(() => {});
    });
  }

  async function setupOffline() {
    const connection = $('#connectionStatus');
    let cached = false;
    function update() {
      connection.textContent = location.protocol === 'file:' ? 'Mode local · sans réseau'
        : !navigator.onLine ? 'Hors connexion' : cached ? 'Disponible hors connexion' : 'En ligne';
      connection.dataset.offline = String(!navigator.onLine);
    }
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if ('serviceWorker' in navigator && ['https:', 'http:'].includes(location.protocol)) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        const worker = registration.installing || registration.waiting || registration.active;
        // Un ancien worker actif ne prouve pas que le nouveau logo et la liste sont en cache.
        if (worker && worker.state !== 'activated') {
          await new Promise((resolve, reject) => {
            const changed = () => {
              if (worker.state === 'activated' || worker.state === 'redundant') {
                worker.removeEventListener('statechange', changed);
                if (worker.state === 'activated') resolve();
                else reject(new Error('Installation du cache interrompue.'));
              }
            };
            worker.addEventListener('statechange', changed);
            changed();
          });
        }
        await navigator.serviceWorker.ready;
        cached = true;
        update();
      } catch (error) {
        notify('Le cache hors connexion n’a pas pu être installé. Réessayez sur un hébergement HTTPS ou ouvrez le dossier local.', true);
      }
    }
  }

  // Mesurer les barres fixes garde le formulaire accessible à 320 px et au zoom.
  function setupFixedLayout() {
    const header = $('.app-header');
    const bottom = $('.bottom-actions');
    const measure = () => {
      document.documentElement.style.setProperty('--header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
      document.documentElement.style.setProperty('--bottom-height', `${Math.ceil(bottom.getBoundingClientRect().height)}px`);
    };
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(measure);
      observer.observe(header);
      observer.observe(bottom);
    }
    window.addEventListener('resize', measure);
    measure();
  }

  async function initialize() {
    try {
      setupFixedLayout();
      database = await openDatabase();
      database.onversionchange = () => {
        database.close();
        notify('Le stockage a été mis à jour dans un autre onglet. Rechargez cette page.', true, true);
      };
      await readCatalogs();
      await readControls();
      await readArchives();
      await readAnomalies();
      await readDirectory();
      bindEvents();
      showView('home');
      setStorageStatus();
      setupOffline();
    } catch (error) {
      console.error('Initialisation impossible :', error.name);
      $('#storageStatus').dataset.state = 'error';
      $('#storageStatus').textContent = 'Stockage local indisponible';
      document.querySelectorAll('button, input, textarea').forEach(element => { element.disabled = true; });
      notify('Impossible d’ouvrir IndexedDB. Autorisez le stockage dans le navigateur, quittez la navigation privée ou utilisez un hébergement statique HTTPS. Aucune donnée n’a été enregistrée.', true, true);
    }
  }

  initialize();
})();
