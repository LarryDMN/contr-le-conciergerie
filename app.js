/* Application autonome : aucune donnée ni photo n'est envoyée à un serveur. */
(() => {
  'use strict';

  const config = window.CONCIERGERIE_CONFIG;
  const items = config.sections.flatMap(section => section.groups.flatMap(group => group.items));
  const itemIds = new Set(items.map(item => item.id));
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
  const dirty = new Set();
  const versions = new Map();
  let currentId;
  let saveTimer;
  let saveQueue = Promise.resolve();
  let pendingWrites = 0;
  let saveError = false;
  let actionBusy = false;
  let noticeTimer;
  const photoJobs = new Set();
  const current = () => controls.get(currentId);
  const ratedCount = record => items.filter(item => record.rows[item.id]?.rating).length;
  const sortedControls = () => [...controls.values()].sort((a, b) =>
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
    status.dataset.state = saveError ? 'error' : dirty.size || pendingWrites || photoJobs.size ? 'saving' : 'saved';
    status.textContent = saveError ? 'Échec de sauvegarde — réessayez ou exportez' : photoJobs.size
      ? 'Préparation des photos…' : dirty.size || pendingWrites ? 'Sauvegarde en cours…' : 'Enregistré sur cet appareil';
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('conciergerie-controles', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('controls', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => notify('Fermez les autres onglets de l’application pour ouvrir le stockage.', true, true);
    });
  }

  // Attendre la transaction entière : une requête réussie seule ne garantit pas la sauvegarde.
  function transaction(mode, callback) {
    return new Promise((resolve, reject) => {
      const tx = database.transaction('controls', mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('Le stockage est indisponible.'));
      tx.onabort = () => reject(tx.error || new Error('Sauvegarde interrompue.'));
      try { result = callback(tx.objectStore('controls')); }
      catch (error) { tx.abort(); reject(error); }
    });
  }

  async function readControls() {
    let request;
    await transaction('readonly', store => { request = store.getAll(); });
    request.result.forEach(record => controls.set(record.id, normalizeRecord(record)));
  }

  const blankRow = () => ({ rating: null, remark: '', photos: [] });
  function normalizeRecord(record) {
    record.rows ||= {};
    items.forEach(item => { record.rows[item.id] ||= blankRow(); });
    record.comments ||= { text: '', photos: [] };
    return record;
  }

  function makeControl() {
    const timestamp = new Date().toISOString();
    return normalizeRecord({ id: uid(), createdAt: timestamp, updatedAt: timestamp,
      address: config.defaultAddress, concierge: '', date: today(), rows: {},
      comments: { text: '', photos: [] } });
  }

  function markChanged(record = current()) {
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
    $('#controlList').innerHTML = sortedControls().map(record => `
      <div class="saved-control ${record.id === currentId ? 'active' : ''}">
        <button type="button" class="open-control" data-open-control="${escapeHTML(record.id)}"
          ${record.id === currentId ? 'aria-current="true"' : ''}>
          <span class="control-date">${escapeHTML(displayDate(record.date))}</span>
          <span class="control-address">${escapeHTML(record.address || 'Adresse non renseignée')}</span>
          <span class="control-meta">${escapeHTML(record.concierge || 'Concierge non renseigné')}
            <span>${ratedCount(record)} / ${items.length}</span></span>
        </button>
      </div>`).join('') || '<p class="list-empty">Aucun contrôle enregistré.</p>';
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
        <summary><span class="section-heading"><span class="section-number">04</span>
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
    $('#address').value = record.address;
    $('#concierge').value = record.concierge;
    $('#controlDate').value = record.date;
    renderSections();
    refreshDerived();
    setStorageStatus();
  }

  async function newControl() {
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
    if (!window.confirm(`Supprimer définitivement le contrôle du ${displayDate(record.date)} ? Exportez-le d’abord si vous souhaitez le conserver.`)) return;
    await flushChanges();
    await transaction('readwrite', store => store.delete(record.id));
    controls.delete(record.id);
    dirty.delete(record.id);
    versions.delete(record.id);
    currentId = sortedControls()[0]?.id;
    if (currentId) renderEditor();
    else await newControl();
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

  function downloadJSON(records) {
    const payload = { format: 'conciergerie-controles', version: 1, exportedAt: new Date().toISOString(), controls: records };
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
    downloadJSON(sortedControls().map(record => structuredClone(record)));
    notify(`${controls.size} contrôle${controls.size > 1 ? 's' : ''} exporté${controls.size > 1 ? 's' : ''}, photos incluses.`);
  }

  function validDate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }

  // Import strict et atomique : un fichier invalide ne modifie aucun contrôle existant.
  function validateImport(payload) {
    const invalid = () => { throw new Error('Fichier de sauvegarde invalide. Aucun contrôle n’a été importé.'); };
    if (!payload || payload.format !== 'conciergerie-controles' || payload.version !== 1 ||
      !Array.isArray(payload.controls) || !payload.controls.length) invalid();
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
    return payload.controls.map(record => {
      if (!record || typeof record.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(record.id) ||
        ids.has(record.id) || !validDate(record.date) || !record.rows || typeof record.rows !== 'object' ||
        Array.isArray(record.rows) || !record.comments) invalid();
      ids.add(record.id);
      const rows = {};
      Object.entries(record.rows).forEach(([key, row]) => {
        if (!/^[a-z][a-z0-9-]*$/.test(key) || !row ||
          !(row.rating === null || [1, 2, 3, 4].includes(row.rating))) invalid();
        rows[key] = { rating: row.rating, remark: string(row.remark), photos: photos(row.photos) };
      });
      return normalizeRecord({ id: record.id, date: record.date, address: string(record.address),
        concierge: string(record.concierge), createdAt: string(record.createdAt), updatedAt: string(record.updatedAt),
        rows, comments: { text: string(record.comments.text), photos: photos(record.comments.photos) } });
    });
  }

  async function importControls(file) {
    let payload;
    try { payload = JSON.parse(await file.text()); }
    catch { throw new Error('Ce fichier ne contient pas une sauvegarde JSON valide.'); }
    const records = validateImport(payload);
    await flushChanges();
    let copied = 0;
    records.forEach(record => {
      if (controls.has(record.id)) { record.id = uid(); copied += 1; }
    });
    await transaction('readwrite', store => records.forEach(record => store.put(record)));
    records.forEach(record => controls.set(record.id, record));
    currentId = records[0].id;
    renderEditor();
    notify(`${records.length} contrôle${records.length > 1 ? 's' : ''} importé${records.length > 1 ? 's' : ''}.` +
      (copied ? ' Les contrôles déjà présents ont été conservés ; les doublons sont des copies.' : ''));
  }

  function printPhotos(photos) {
    return `<div class="print-photos">${photos.map((photo, index) => `<figure><img src="${escapeHTML(photo.dataUrl)}"
      alt="Photo ${index + 1}"><figcaption>Photo ${index + 1}</figcaption></figure>`).join('')}</div>`;
  }

  function renderPrintReport() {
    const record = current();
    if (!record) return;
    $('#printReport').innerHTML = `<header class="print-header"><h1>Modèle de contrôle des conciergeries</h1>
      <dl class="print-metadata"><div><dt>Adresse de l’immeuble</dt><dd>${escapeHTML(record.address)}</dd></div>
        <div><dt>Concierge</dt><dd>${escapeHTML(record.concierge || '—')}</dd></div>
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
      <section class="print-comments"><h2 class="print-section-title">4. COMMENTAIRES - REMARQUES</h2>
        <p>${escapeHTML(record.comments.text || '—')}</p>${printPhotos(record.comments.photos)}</section>
      <footer class="print-footer">${escapeHTML(config.footer)}</footer>`;
  }

  async function printControl() {
    await flushChanges();
    renderPrintReport();
    await Promise.all([...$('#printReport').querySelectorAll('img')].map(image => image.decode().catch(() => {})));
    window.print();
  }

  function bindEvents() {
    $('#newControl').addEventListener('click', () => perform(newControl));
    $('#saveControl').addEventListener('click', () => perform(async () => { await flushChanges(); notify('Contrôle enregistré sur cet appareil.'); }));
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
    ['address', 'concierge', 'controlDate'].forEach(id => {
      $(`#${id}`).addEventListener('input', event => {
        if (id === 'controlDate' && !validDate(event.target.value)) return;
        current()[id === 'controlDate' ? 'date' : id] = event.target.value;
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
      if (dirty.size || pendingWrites || photoJobs.size) { event.preventDefault(); event.returnValue = ''; }
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
        await navigator.serviceWorker.register('./sw.js');
        await navigator.serviceWorker.ready;
        cached = true;
        update();
      } catch (error) {
        notify('Le cache hors connexion n’a pas pu être installé. Réessayez sur un hébergement HTTPS ou ouvrez le dossier local.', true);
      }
    }
  }

  async function initialize() {
    try {
      database = await openDatabase();
      database.onversionchange = () => {
        database.close();
        notify('Le stockage a été mis à jour dans un autre onglet. Rechargez cette page.', true, true);
      };
      await readControls();
      bindEvents();
      currentId = sortedControls()[0]?.id;
      if (currentId) renderEditor();
      else await newControl();
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
