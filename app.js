/* Application autonome : aucune donnée ni photo n'est envoyée à un serveur. */
(() => {
  'use strict';

  const baseConfig = window.CONCIERGERIE_CONFIG;
  const buildings = window.CONCIERGERIES;
  const templates = {
    conciergerie: baseConfig,
    bureaux: { ...baseConfig, sections: window.BUREAUX || [] }
  };
  const typeLabels = { conciergerie: 'Contrôle conciergerie', bureaux: 'Contrôle entretien de bureaux' };
  const itemsFor = type => templates[type].sections.flatMap(section => section.groups.flatMap(group => group.items));
  let activeType = 'conciergerie';
  let view = 'home';
  let config = templates[activeType];
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
  const archives = new Map();
  const dirty = new Set();
  const versions = new Map();
  let currentId;
  let saveTimer;
  let saveQueue = Promise.resolve();
  let pendingWrites = 0;
  let saveError = false;
  let actionBusy = false;
  let pdfBusy = false;
  let directoryHandle;
  let previewURL;
  let noticeTimer;
  const photoJobs = new Set();
  const current = () => controls.get(currentId);
  const buildingName = record => record.buildingName || record.address ||
    (record.buildingId === undefined ? 'Contrôle sans adresse' : 'Immeuble à choisir');
  // null désigne un nouveau brouillon ; l'absence de champ désigne un ancien contrôle.
  const needsBuilding = record => record.type === 'bureaux' ? !record.buildingName.trim() : record.buildingId === null;
  const ratedCount = record => itemsFor(record.type).filter(item => record.rows[item.id]?.rating).length;
  const sortedControls = (type = null) => [...controls.values()].filter(record => !type || record.type === type).sort((a, b) =>
    b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));

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
    status.dataset.state = saveError ? 'error' : dirty.size || pendingWrites || photoJobs.size || pdfBusy ? 'saving' : 'saved';
    status.textContent = saveError ? 'Échec de sauvegarde — réessayez ou exportez' : pdfBusy ? 'Création du PDF…' : photoJobs.size
      ? 'Préparation des photos…' : dirty.size || pendingWrites ? 'Sauvegarde en cours…' : 'Enregistré sur cet appareil';
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('conciergerie-controles', 2);
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
    request.result.forEach(record => controls.set(record.id, normalizeRecord(record)));
  }

  async function readArchives() {
    let request;
    await transaction('readonly', store => { request = store.getAll(); }, 'archives');
    request.result.forEach(archive => archives.set(archive.controlId, archive));
  }

  const blankRow = () => ({ rating: null, remark: '', photos: [] });
  function normalizeRecord(record) {
    record.type ??= 'conciergerie';
    // Aucun rapprochement automatique : les anciennes adresses restent intactes.
    record.buildingName ??= '';
    record.rows ||= {};
    itemsFor(record.type).forEach(item => { record.rows[item.id] ||= blankRow(); });
    record.comments ||= { text: '', photos: [] };
    return record;
  }

  function makeControl() {
    const timestamp = new Date().toISOString();
    return normalizeRecord({ id: uid(), type: activeType, createdAt: timestamp, updatedAt: timestamp,
      ...(activeType === 'conciergerie' ? { buildingId: null } : {}),
      buildingName: '', address: '', concierge: '', date: today(), rows: {},
      comments: { text: '', photos: [] } });
  }

  function markChanged(record = current()) {
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
    if (!dirty.size) return saveQueue;
    const snapshots = [...dirty].filter(id => controls.has(id)).map(id => ({
      record: structuredClone(controls.get(id)), version: versions.get(id)
    }));
    pendingWrites += 1;
    setStorageStatus();
    const job = saveQueue.catch(() => {}).then(() => transaction('readwrite', store => {
      snapshots.forEach(snapshot => store.put(snapshot.record));
    })).then(() => {
      snapshots.forEach(({ record, version }) => {
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
    while (dirty.size) await persistChanges();
  }

  // Les actions asynchrones ne peuvent pas se chevaucher (dupliquer, supprimer, importer…).
  async function perform(action) {
    if (actionBusy) return;
    actionBusy = true;
    try { await action(); }
    catch (error) {
      console.error('Opération impossible :', error.name);
      if (!saveError) notify(error.message || 'Cette opération a échoué.', true);
    } finally { actionBusy = false; }
  }

  function renderList() {
    $('#controlList').innerHTML = sortedControls(activeType).map(record => `
      <div class="saved-control ${record.id === currentId ? 'active' : ''}">
        <button type="button" class="open-control" data-open-control="${escapeHTML(record.id)}"
          ${record.id === currentId ? 'aria-current="true"' : ''}>
          <span class="control-date">${escapeHTML(displayDate(record.date))}</span>
          <span class="control-address">${escapeHTML(buildingName(record))}</span>
          <span class="control-meta">${escapeHTML(record.concierge || 'Concierge non renseigné')}
            <span>${ratedCount(record)} / ${itemsFor(record.type).length}</span></span>
        </button>
      </div>`).join('') || '<p class="list-empty">Aucun contrôle enregistré dans cette section.</p>';
    renderHome();
  }

  function photoButtons(rowId) {
    return `<div class="photo-actions">
      <button type="button" class="photo-button" data-add-photo="${rowId}" data-camera="true">${cameraIcon} Ajouter une photo</button>
      <button type="button" class="gallery-button" data-add-photo="${rowId}" aria-label="Choisir des photos dans la galerie">${galleryIcon} Galerie</button>
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
                <h4 class="item-label" id="label-${item.id}">${escapeHTML(item.label)}</h4></div>
                <div class="rating-options" role="group" aria-labelledby="label-${item.id}">
                  ${config.ratings.map(rating => `<button type="button" class="rating-button" data-row="${item.id}" data-rating="${rating.value}"
                    aria-pressed="${row.rating === rating.value}" aria-label="${rating.value} : ${escapeHTML(rating.label)}">
                    <span class="rating-number">${rating.value}</span><span class="rating-label">${escapeHTML(rating.label)}</span></button>`).join('')}
                </div></div>
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
        <button type="button" class="remove-photo" data-remove-photo="${escapeHTML(photo.id)}" data-photo-row="${rowId}"
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
    renderList();
  }

  function renderEditor() {
    const record = current();
    if (!record || !items.length) { renderPendingModel(); return; }
    $('#officePlaceholder').hidden = true;
    $('#controlForm').hidden = false;
    $('#headerControl').hidden = view !== 'control';
    $('#controlActions').hidden = view !== 'control';
    $('#newControl').disabled = false;
    $('#workflowTitle').textContent = typeLabels[activeType];
    $('#workflowEyebrow').textContent = activeType === 'conciergerie' ? 'Modèle de contrôle des conciergeries' : 'Modèle de contrôle de l’entretien de bureaux';
    $('#workflowDescription').textContent = 'Notez chaque élément, ajoutez vos remarques et documentez avec des photos.';
    $('#buildingSelectField').hidden = activeType !== 'conciergerie';
    $('#buildingNameField').hidden = activeType !== 'bureaux';
    $('#buildingNameInput').value = record.buildingName;
    $('#buildingNameInput').required = activeType === 'bureaux';
    $('#address').readOnly = activeType === 'conciergerie';
    $('#concierge').readOnly = activeType === 'conciergerie';
    $('#responsibleLabel').textContent = activeType === 'conciergerie' ? 'Concierge' : 'Responsable';
    renderBuildingSelection();
    $('#address').value = record.address;
    $('#concierge').value = record.concierge;
    $('#controlDate').value = record.date;
    renderSections();
    refreshDerived();
    setStorageStatus();
  }

  function renderBuildingSelection() {
    const record = current();
    const legacy = record.buildingId === undefined;
    const missing = !!record.buildingId && !buildings.some(building => building.id === record.buildingId);
    const select = $('#buildingSelect');
    select.innerHTML = `<option value="" disabled>${legacy ? 'Adresse historique conservée' : 'Choisir un immeuble'}</option>` +
      (missing ? `<option value="${escapeHTML(record.buildingId)}">${escapeHTML(buildingName(record))} (retiré de la liste)</option>` : '') +
      buildings.map(building => `<option value="${escapeHTML(building.id)}">${escapeHTML(building.nom)}</option>`).join('');
    select.value = record.buildingId || '';
    select.required = activeType === 'conciergerie' && !legacy;
    $('#buildingHelp').textContent = legacy
      ? 'Contrôle antérieur : l’adresse et le concierge enregistrés sont conservés.'
      : missing ? 'Cet immeuble a été retiré de la liste. Les informations de ce contrôle sont conservées.'
        : needsBuilding(record) ? 'Choisissez l’immeuble pour commencer le contrôle.'
          : 'Adresse et concierge repris de la liste lors du choix de l’immeuble.';
    $('#inspectionFields').disabled = needsBuilding(record);
    $('#saveControl').disabled = needsBuilding(record);
    $('#printControl').disabled = needsBuilding(record);
    $('#finishControl').disabled = needsBuilding(record);
  }

  function requireBuilding() {
    if (!needsBuilding(current())) return true;
    const field = activeType === 'conciergerie' ? $('#buildingSelect') : $('#buildingNameInput');
    field.reportValidity();
    field.focus();
    notify('Renseignez l’immeuble avant de remplir ou d’imprimer ce contrôle.', true);
    return false;
  }

  function chooseBuilding() {
    const building = buildings.find(building => building.id === $('#buildingSelect').value);
    if (!building) return;
    const record = current();
    if (record.address && (record.address !== building.adresse || record.concierge !== building.concierge) &&
      !window.confirm('Changer l’immeuble de ce contrôle ? Son adresse et son concierge seront remplacés par ceux de la liste. Les notes, remarques et photos seront conservées.')) {
      renderBuildingSelection();
      return;
    }
    // Stocker un instantané, et non une référence recalculée à chaque réouverture.
    record.buildingId = building.id;
    record.buildingName = building.nom;
    record.address = building.adresse;
    record.concierge = building.concierge;
    markChanged(record);
    renderEditor();
  }

  async function newControl() {
    if (!items.length) { notify('Modèle à venir. Aucun contrôle ne peut être créé pour le moment.'); return; }
    if (currentId) await flushChanges();
    const record = makeControl();
    controls.set(record.id, record);
    currentId = record.id;
    markChanged(record);
    renderEditor();
    await persistChanges();
    notify('Nouveau contrôle créé.');
  }

  async function switchControl(id) {
    if (!controls.has(id) || id === currentId) return;
    await flushChanges();
    setType(controls.get(id).type);
    currentId = id;
    renderEditor();
  }

  async function duplicateControl() {
    await flushChanges();
    const record = structuredClone(current());
    record.id = uid();
    record.date = today();
    record.createdAt = new Date().toISOString();
    controls.set(record.id, record);
    currentId = record.id;
    markChanged(record);
    renderEditor();
    await persistChanges();
    notify('Contrôle dupliqué avec ses notes, remarques et photos.');
  }

  async function deleteControl() {
    const record = current();
    if (!window.confirm(`Supprimer définitivement le contrôle du ${displayDate(record.date)} ? Son PDF reste dans Dossiers. Exportez le JSON pour conserver ses données modifiables.`)) return;
    await flushChanges();
    await transaction('readwrite', store => store.delete(record.id));
    controls.delete(record.id);
    dirty.delete(record.id);
    versions.delete(record.id);
    currentId = sortedControls(activeType)[0]?.id;
    if (currentId) renderEditor();
    else if (items.length) await newControl();
    else renderPendingModel();
    notify('Contrôle supprimé.');
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
    $('#fullPhoto').src = photo.dataUrl;
    const label = rowId === 'comments' ? 'Commentaires - Remarques' : items.find(item => item.id === rowId).label;
    $('#fullPhoto').alt = `Photo : ${label}`;
    $('#photoCaption').textContent = label;
    $('#photoDialog').showModal();
  }

  function removePhoto(rowId, id) {
    if (!window.confirm('Supprimer cette photo du contrôle ?')) return;
    const target = photoTarget(current(), rowId);
    target.photos = target.photos.filter(photo => photo.id !== id);
    markChanged();
    renderPhotos(rowId);
    refreshDerived();
  }

  function downloadJSON(records, pdfArchives) {
    const payload = { format: 'conciergerie-controles', version: 2, exportedAt: new Date().toISOString(), controls: records, archives: pdfArchives };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `controles-conciergerie-${today()}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function exportControls() {
    await Promise.all([...photoJobs]);
    // L'export reste utilisable en cas de quota dépassé afin de sauver les données en mémoire.
    try { await flushChanges(); } catch { /* L'indicateur continue de signaler l'échec local. */ }
    const pdfArchives = await Promise.all([...archives.values()].map(async ({ blob, ...metadata }) => ({
      ...metadata, pdfDataUrl: await blobToDataURL(blob)
    })));
    downloadJSON(sortedControls().map(record => structuredClone(record)), pdfArchives);
    notify(`${controls.size} contrôle(s) et ${archives.size} PDF exportés, photos incluses.`);
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

  // Import strict et atomique : un fichier invalide ne modifie aucun contrôle existant.
  function validateImport(payload) {
    const invalid = () => { throw new Error('Fichier de sauvegarde invalide. Aucun contrôle n’a été importé.'); };
    if (!payload || payload.format !== 'conciergerie-controles' || ![1, 2].includes(payload.version) ||
      !Array.isArray(payload.controls) || (payload.version === 2 && !Array.isArray(payload.archives))) invalid();
    const string = value => { if (typeof value !== 'string') invalid(); return value; };
    const photos = values => {
      if (!Array.isArray(values)) invalid();
      return values.map(photo => {
        if (!photo || typeof photo.dataUrl !== 'string' ||
          !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo.dataUrl) ||
          !Number.isInteger(photo.width) || photo.width < 1 || !Number.isInteger(photo.height) || photo.height < 1) invalid();
        return { id: uid(), name: string(photo.name), dataUrl: photo.dataUrl,
          width: photo.width, height: photo.height, createdAt: string(photo.createdAt) };
      });
    };
    const ids = new Set();
    const records = payload.controls.map(record => {
      if (!record || typeof record.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(record.id) ||
        ids.has(record.id) || !validDate(record.date) || !record.rows || typeof record.rows !== 'object' ||
        Array.isArray(record.rows) || !record.comments) invalid();
      if (!['conciergerie', 'bureaux'].includes(record.type ?? 'conciergerie')) invalid();
      if (record.completedAt != null && (typeof record.completedAt !== 'string' || Number.isNaN(Date.parse(record.completedAt)))) invalid();
      // Les exports v1 sans immeuble restent compatibles ; les champs ajoutés sont facultatifs.
      if (record.buildingId != null && (typeof record.buildingId !== 'string' || !record.buildingId)) invalid();
      if (record.buildingName != null && typeof record.buildingName !== 'string') invalid();
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
        concierge: string(record.concierge), createdAt: string(record.createdAt), updatedAt: string(record.updatedAt),
        ...(record.completedAt ? { completedAt: record.completedAt } : {}),
        rows, comments: { text: string(record.comments.text), photos: photos(record.comments.photos) } });
    });
    const archiveIds = new Set();
    const pdfArchives = (payload.version === 2 ? payload.archives : []).map(archive => {
      if (!archive || typeof archive.controlId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(archive.controlId) ||
        archiveIds.has(archive.controlId) || !['conciergerie', 'bureaux'].includes(archive.type) || !validDate(archive.date) ||
        typeof archive.filename !== 'string' || !archive.filename.endsWith('.pdf') || /[\\/\x00-\x1f]/.test(archive.filename) ||
        typeof archive.generatedAt !== 'string' || Number.isNaN(Date.parse(archive.generatedAt)) ||
        (archive.buildingId != null && typeof archive.buildingId !== 'string') ||
        typeof archive.pdfDataUrl !== 'string' || !/^data:application\/pdf;base64,[A-Za-z0-9+/]+={0,2}$/.test(archive.pdfDataUrl)) invalid();
      const owner = records.find(record => record.id === archive.controlId);
      if (owner && owner.type !== archive.type) invalid();
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
    return { records, pdfArchives };
  }

  async function importControls(file) {
    let payload;
    try { payload = JSON.parse(await file.text()); }
    catch { throw new Error('Ce fichier ne contient pas une sauvegarde JSON valide.'); }
    const { records, pdfArchives } = validateImport(payload);
    await flushChanges();
    let copied = 0;
    const remapped = new Map();
    records.forEach(record => {
      const originalId = record.id;
      if (controls.has(record.id) || archives.has(record.id)) { record.id = uid(); copied += 1; }
      remapped.set(originalId, record.id);
    });
    pdfArchives.forEach(archive => {
      if (remapped.has(archive.controlId)) archive.controlId = remapped.get(archive.controlId);
      else if (archives.has(archive.controlId) || controls.has(archive.controlId)) archive.controlId = uid();
    });
    await transaction('readwrite', stores => {
      records.forEach(record => stores.controls.put(record));
      pdfArchives.forEach(archive => stores.archives.put(archive));
    }, ['controls', 'archives']);
    records.forEach(record => controls.set(record.id, record));
    pdfArchives.forEach(archive => archives.set(archive.controlId, archive));
    if (records.length) {
      currentId = records[0].id;
      setType(records[0].type);
      showView('control');
      renderEditor();
    } else {
      showView('folders');
      renderFolders();
    }
    notify(`${records.length} contrôle(s) et ${pdfArchives.length} PDF importés.` +
      (copied ? ' Les contrôles déjà présents ont été conservés ; les doublons sont des copies.' : ''));
  }

  function printPhotos(photos) {
    return `<div class="print-photos">${photos.map((photo, index) => `<figure><img src="${escapeHTML(photo.dataUrl)}"
      alt="Photo ${index + 1}"><figcaption>Photo ${index + 1}</figcaption></figure>`).join('')}</div>`;
  }

  function renderPrintReport() {
    const record = current();
    if (!record || view !== 'control' || !items.length) { $('#printReport').innerHTML = ''; return; }
    $('#printReport').innerHTML = `<header class="print-header"><img class="print-logo" src="logo-horizontal.png" alt="E. Blanco SA">
      <h1>${record.type === 'bureaux' ? 'Modèle de contrôle de l’entretien de bureaux' : 'Modèle de contrôle des conciergeries'}</h1>
      <dl class="print-metadata">${record.buildingName ? `<div><dt>Immeuble</dt><dd>${escapeHTML(record.buildingName)}</dd></div>` : ''}
        <div><dt>Adresse de l’immeuble</dt><dd>${escapeHTML(record.address)}</dd></div>
        <div><dt>${record.type === 'bureaux' ? 'Responsable' : 'Concierge'}</dt><dd>${escapeHTML(record.concierge || '—')}</dd></div>
        <div><dt>Date</dt><dd>${escapeHTML(displayDate(record.date))}</dd></div></dl>
      <p class="print-legend">1 = Très bon · 2 = Bon · 3 = Moyen · 4 = Mauvais</p>
      <p>Joindre une photo pour la note 4, ainsi que pour tous les dégâts et actes de vandalisme.</p></header>
      ${config.sections.map((section, index) => `<section><h2 class="print-section-title">${index + 1}. ${escapeHTML(section.title)}</h2>
        ${section.groups.map(group => `${group.title ? `<h3 class="print-group-title">${escapeHTML(group.title)}</h3>` : ''}
          <table class="print-table"><colgroup><col style="width:35%"><col span="4" style="width:6%"><col style="width:41%"></colgroup>
            <thead><tr><th scope="col">Élément contrôlé</th>${[1, 2, 3, 4].map(value => `<th scope="col">${value}</th>`).join('')}<th scope="col">Remarques</th></tr></thead>
            <tbody>${group.items.map(item => {
              const row = record.rows[item.id];
              return `<tr><th scope="row">${escapeHTML(item.label)}</th>${[1, 2, 3, 4].map(value => `<td class="print-rating">${row.rating === value ? '×' : ''}</td>`).join('')}
                <td class="print-remark">${escapeHTML(row.remark)}</td></tr>${row.photos.length
                  ? `<tr class="print-photos-row"><td colspan="6"><strong>${escapeHTML(item.label)}</strong>${printPhotos(row.photos)}</td></tr>` : ''}`;
            }).join('')}</tbody></table>`).join('')}</section>`).join('')}
      <section class="print-comments"><h2 class="print-section-title">${config.sections.length + 1}. COMMENTAIRES - REMARQUES</h2>
        <p>${escapeHTML(record.comments.text || '—')}</p>${printPhotos(record.comments.photos)}</section>
      <footer class="print-footer">${escapeHTML(config.footer)}</footer>`;
  }

  async function printControl() {
    await saveControl({ download: true });
  }

  function setType(type) {
    activeType = type;
    config = templates[type];
    items = itemsFor(type);
    itemIds = new Set(items.map(item => item.id));
  }

  function renderHome() {
    const countLabel = count => `${count} contrôle${count > 1 ? 's' : ''}`;
    $('#homeConciergeCount').textContent = countLabel(sortedControls('conciergerie').length);
    $('#homeOfficeCount').textContent = countLabel(sortedControls('bureaux').length);
    $('#homeArchiveCount').textContent = `${archives.size} PDF`;
  }

  function showView(nextView) {
    view = nextView;
    $('#homeView').hidden = view !== 'home';
    $('#controlView').hidden = view !== 'control';
    $('#foldersView').hidden = view !== 'folders';
    $('.skip-link').href = view === 'home' ? '#homeView' : view === 'folders' ? '#foldersView' : '#main';
    $('#headerControl').hidden = view !== 'control' || !current() || !items.length;
    $('#controlActions').hidden = view !== 'control' || !current() || !items.length;
    document.body.dataset.view = view;
    renderHome();
    window.scrollTo(0, 0);
  }

  async function openType(type) {
    if (currentId) await flushChanges();
    setType(type);
    currentId = sortedControls(type)[0]?.id;
    showView('control');
    if (currentId) renderEditor();
    else if (items.length) await newControl();
    else renderPendingModel();
  }

  function renderPendingModel() {
    $('#sections').replaceChildren();
    $('#workflowTitle').textContent = typeLabels[activeType];
    $('#workflowEyebrow').textContent = 'Contrôles enregistrés';
    $('#workflowDescription').textContent = 'Le modèle de contrôle de cette section n’est pas encore disponible.';
    $('#officePlaceholder').hidden = false;
    $('#controlForm').hidden = true;
    $('#headerControl').hidden = true;
    $('#controlActions').hidden = true;
    $('#newControl').disabled = true;
    renderList();
  }

  async function goHome() {
    if (currentId) await flushChanges();
    showView('home');
  }

  async function openFolders() {
    if (currentId) await flushChanges();
    showView('folders');
    renderFolders();
    await updateDirectoryStatus();
  }

  const searchable = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function renderFolders() {
    const query = searchable($('#folderSearch').value.trim());
    const filtered = [...archives.values()].filter(archive => searchable([
      archive.filename, archive.buildingName, archive.address, archive.date,
      displayDate(archive.date), typeLabels[archive.type]
    ].join(' ')).includes(query)).sort((a, b) => b.date.localeCompare(a.date) || b.generatedAt.localeCompare(a.generatedAt));
    $('#foldersEmpty').hidden = filtered.length > 0;
    $('#foldersEmpty').textContent = archives.size ? 'Aucun PDF ne correspond à cette recherche.' : 'Aucun PDF archivé. Enregistrez ou terminez un contrôle pour créer son PDF.';
    $('#archiveTree').innerHTML = Object.keys(typeLabels).map(type => {
      const entries = filtered.filter(archive => archive.type === type);
      if (!entries.length) return '';
      const byBuilding = new Map();
      entries.forEach(archive => {
        const key = archive.buildingId || `${archive.buildingName}\u0000${archive.address}`;
        if (!byBuilding.has(key)) byBuilding.set(key, []);
        byBuilding.get(key).push(archive);
      });
      return `<details class="folder-type" open><summary><span class="folder-label">${escapeHTML(typeLabels[type])}</span><span class="folder-count">${entries.length} PDF</span></summary>
        ${[...byBuilding.values()].map(buildingArchives => `<details class="folder-building" open><summary><span class="folder-label">${escapeHTML(buildingArchives[0].buildingName || buildingArchives[0].address || 'Sans immeuble')}</span><span class="folder-count">${buildingArchives.length}</span></summary>
          ${[...new Set(buildingArchives.map(archive => archive.date.slice(0, 4)))].sort().reverse().map(year => `<details class="folder-year" open><summary><span class="folder-label">${year}</span></summary>
            ${buildingArchives.filter(archive => archive.date.startsWith(year)).map(archive => `<article class="archive-card"><div>
              <h3 class="archive-filename">${escapeHTML(archive.filename)}</h3><p class="archive-meta">Contrôle du ${escapeHTML(displayDate(archive.date))}</p>
              <p class="archive-meta">PDF actualisé le ${escapeHTML(new Intl.DateTimeFormat('fr-CH', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(archive.generatedAt)))}</p></div>
              <div class="archive-actions"><button type="button" class="button button-secondary" data-preview-archive="${escapeHTML(archive.controlId)}">Aperçu</button>
                <button type="button" class="button button-primary" data-download-archive="${escapeHTML(archive.controlId)}">Télécharger</button>
                <button type="button" class="button button-secondary" data-delete-archive="${escapeHTML(archive.controlId)}">Supprimer</button></div></article>`).join('')}</details>`).join('')}
        </details>`).join('')}</details>`;
    }).join('');
    renderHome();
  }

  function downloadPDF(archive) {
    const url = URL.createObjectURL(archive.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = archive.filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function previewArchive(id) {
    const archive = archives.get(id);
    if (!archive) return;
    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(archive.blob);
    $('#archiveCaption').textContent = `${archive.filename} — ${displayDate(archive.date)}`;
    $('#archivePreview').src = previewURL;
    $('#archivePreviewDownload').href = previewURL;
    $('#archivePreviewDownload').download = archive.filename;
    $('#archiveDialog').showModal();
  }

  async function deleteArchive(id) {
    if (!archives.has(id) || !window.confirm('Supprimer ce PDF de Dossiers ? Le contrôle, ses photos et les copies déjà téléchargées restent conservés.')) return;
    await transaction('readwrite', store => store.delete(id), 'archives');
    archives.delete(id);
    renderFolders();
    notify('PDF supprimé de Dossiers.');
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
    if (!current() || !items.length || !requireBuilding()) return;
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
      const blob = await window.CONTROL_PDF.generate(record, templates[record.type]);
      const previous = archives.get(record.id);
      const archive = { controlId: record.id, type: record.type, buildingId: record.buildingId ?? null,
        buildingName: record.buildingName, address: record.address, date: record.date,
        filename: window.CONTROL_PDF.filename(record), generatedAt: timestamp, blob };
      // Le cliché du contrôle et son PDF sont enregistrés ensemble, ou pas du tout.
      await transaction('readwrite', stores => { stores.controls.put(record); stores.archives.put(archive); }, ['controls', 'archives']);
      controls.set(record.id, record);
      archives.set(record.id, archive);
      versions.set(record.id, (versions.get(record.id) || 0) + 1);
      dirty.delete(record.id);
      saveError = false;
      renderHome();
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
    $('.brand').addEventListener('click', event => { event.preventDefault(); perform(goHome); });
    $('#openFolders').addEventListener('click', () => perform(openFolders));
    $('#homeExport').addEventListener('click', () => perform(exportControls));
    $('#homeImport').addEventListener('click', () => $('#importFile').click());
    $('#folderSearch').addEventListener('input', renderFolders);
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
      if (remove) perform(() => deleteArchive(remove.dataset.deleteArchive));
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
    $('#deleteControl').addEventListener('click', () => perform(deleteControl));
    $('#printControl').addEventListener('click', () => perform(printControl));
    $('#exportControl').addEventListener('click', () => perform(exportControls));
    $('#importControl').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', event => {
      const file = event.target.files[0];
      event.target.value = '';
      if (file) perform(() => importControls(file));
    });
    $('#controlList').addEventListener('click', event => {
      const button = event.target.closest('[data-open-control]');
      if (button) perform(() => switchControl(button.dataset.openControl));
    });
    $('#buildingSelect').addEventListener('change', chooseBuilding);
    ['buildingNameInput', 'address', 'concierge'].forEach(id => $(`#${id}`).addEventListener('input', event => {
      if (activeType !== 'bureaux' || !current()) return;
      current()[id === 'buildingNameInput' ? 'buildingName' : id] = event.target.value;
      markChanged();
      renderBuildingSelection();
      refreshDerived();
    }));
    ['controlDate'].forEach(id => {
      $(`#${id}`).addEventListener('input', event => {
        if (id === 'controlDate' && !validDate(event.target.value)) return;
        current().date = event.target.value;
        markChanged();
        renderList();
      });
      if (id === 'controlDate') $(`#${id}`).addEventListener('blur', event => {
        // Une date effacée temporairement ne corrompt jamais le contrôle sauvegardé.
        if (!validDate(event.target.value)) event.target.value = current().date;
      });
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
      if (remove) removePhoto(remove.dataset.photoRow, remove.dataset.removePhoto);
    });
    $('#closePhoto').addEventListener('click', () => $('#photoDialog').close());
    $('#photoDialog').addEventListener('click', event => { if (event.target === $('#photoDialog')) $('#photoDialog').close(); });
    window.addEventListener('beforeprint', renderPrintReport);
    window.addEventListener('beforeunload', event => {
      if (dirty.size || pendingWrites || photoJobs.size || pdfBusy) { event.preventDefault(); event.returnValue = ''; }
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
      await readControls();
      await readArchives();
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
