/* Gestion des contrats et édition des checklists sur l'appareil.
 * Les callbacks enregistrent les fiches ; cet écran ne modifie jamais les visites.
 * Les zones et lignes restent un brouillon jusqu'à « Enregistrer la fiche ».
 */
(() => {
  'use strict';

  const PAGE_SIZE = 50;
  const clone = value => structuredClone(value);
  const uid = () => `site-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const $ = selector => document.querySelector(selector);

  function create(options) {
    const { getSites, getType, getUsage, onSave, onArchive, onReactivate, onDelete,
      onMerge, onReset, today, displayDate, escapeHTML, notify } = options;
    const states = Object.fromEntries(['conciergerie', 'bureaux'].map(type => [type,
      { status: 'active', client: '', query: '', page: 0 }]));
    let type = 'conciergerie';
    let draft;
    let isNew = true;
    let pendingDuplicate;
    let dateAction;
    let mergeSource;
    let busy = false;
    let bound = false;

    const sites = () => [...(getSites(type) || [])].filter(site => !site.mergedInto);
    const find = id => sites().find(site => site.id === id);
    const personLabel = () => type === 'bureaux' ? 'Nettoyeur/Nettoyeuse' : 'Concierge';
    const usage = id => getUsage(type, id) || { controls: 0, archives: 0, anomalies: 0 };
    const date = value => value ? displayDate(value) : 'Non renseignée';
    const normalized = value => window.CONTRACTS.normalizeText(value);

    function error(id, message = '') {
      const element = $(`#${id}`);
      element.textContent = message;
      element.hidden = !message;
      if (message) element.scrollIntoView({ block: 'nearest' });
    }

    // Un seul enregistrement à la fois ; fermer un dialogue ne doit pas annuler
    // seulement son affichage alors qu'une écriture est encore en cours.
    async function operation(action, errorId, form) {
      if (busy) return;
      busy = true;
      if (errorId) error(errorId);
      if (form) { form.inert = true; form.setAttribute('aria-busy', 'true'); }
      try { await action(); }
      catch (reason) {
        const message = reason?.message || 'Cette opération a échoué.';
        if (errorId) error(errorId, message);
        else notify(message, true);
      } finally {
        if (form) { form.inert = false; form.removeAttribute('aria-busy'); }
        busy = false;
      }
    }

    function render(nextType = getType()) {
      type = nextType;
      if (!states[type] || !$('#contractsView')) return;
      const state = states[type];
      const catalog = sites();
      const clients = [...new Set(catalog.map(site => site.client).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, 'fr'));
      $('#contractClientFilter').innerHTML = '<option value="">Tous les clients</option>' + clients
        .map(client => `<option value="${escapeHTML(client)}">${escapeHTML(client)}</option>`).join('');
      if (state.client && !clients.includes(state.client)) state.client = '';
      $('#contractClientFilter').value = state.client;
      $('#contractStatusFilter').value = state.status;
      $('#contractSearch').value = state.query;
      const query = normalized(state.query);
      const filtered = catalog.filter(site => (state.status === 'all' || site.status === state.status) &&
        (!state.client || site.client === state.client) && (!query || normalized([
          site.nom, site.adresse, site.client, window.CONTRACTS.person(site, type)
        ].join(' ')).includes(query)))
        .sort((left, right) => left.nom.localeCompare(right.nom, 'fr', { sensitivity: 'base' }));
      const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      state.page = Math.min(state.page, pages - 1);
      $('#contractsCount').textContent = `${filtered.length} immeuble(s) affiché(s) sur ${catalog.length}.`;
      $('#contractsPageInfo').textContent = `Page ${state.page + 1} sur ${pages}`;
      $('#contractsPrevious').disabled = state.page === 0;
      $('#contractsNext').disabled = state.page + 1 >= pages;
      $('#contractsList').innerHTML = filtered.length ? filtered.slice(state.page * PAGE_SIZE,
        (state.page + 1) * PAGE_SIZE).map(site => {
        const archived = site.status === 'archived';
        const matches = window.CONTRACTS.duplicates(site, catalog, site.id);
        const linked = Number(usage(site.id).controls) || 0;
        const lineCount = (site.checklist || []).reduce((count, zone) => count + zone.lignes.length, 0);
        return `<article class="contract-card panel" data-contract-id="${escapeHTML(site.id)}">
          <div class="contract-card-heading"><h3>${escapeHTML(site.nom)}</h3><span class="contract-status ${archived ? 'is-archived' : ''}">${archived ? 'Archivé' : 'Actif'}</span></div>
          <p>${escapeHTML(site.adresse || 'Adresse non renseignée')}</p>
          <p>${escapeHTML(personLabel())} : ${escapeHTML(window.CONTRACTS.person(site, type) || 'Non renseigné')}</p>
          ${site.client ? `<p>Client : ${escapeHTML(site.client)}</p>` : ''}
          <dl class="contract-dates"><div><dt>Début du contrat :</dt><dd>${escapeHTML(date(site.startDate))}</dd></div></dl>
          ${archived ? `<p class="contract-ended">Contrat terminé le ${escapeHTML(date(site.endDate))}</p>` : ''}
          <p class="field-help">${linked} contrôle(s) · ${lineCount} ligne(s) dans la checklist</p>
          ${site.contractHistory?.length ? `<details class="contract-history"><summary>Historique des contrats</summary><ol>${site.contractHistory.map(period => `<li>Du ${escapeHTML(date(period.startDate))} au ${escapeHTML(date(period.endDate))}</li>`).join('')}</ol></details>` : ''}
          ${matches.length ? `<p class="contract-duplicate-note">Doublon possible avec : ${escapeHTML(matches.map(candidate => candidate.nom).join(', '))}.</p>` : ''}
          <div class="contract-actions"><button type="button" class="button button-secondary" data-contract-action="edit" data-id="${escapeHTML(site.id)}">Modifier</button>
            <button type="button" class="button button-secondary" data-contract-action="${archived ? 'reactivate' : 'archive'}" data-id="${escapeHTML(site.id)}">${archived ? 'Réactiver' : 'Archiver le contrat'}</button>
            ${matches.length ? `<button type="button" class="button button-secondary" data-contract-action="merge" data-id="${escapeHTML(site.id)}">Fusionner le doublon</button>` : ''}
            <button type="button" class="button button-danger" data-contract-action="delete" data-id="${escapeHTML(site.id)}">Supprimer</button></div>
          ${linked ? '<p class="field-help">Cette fiche possède des contrôles : seule l’archive du contrat est possible.</p>' : ''}
        </article>`;
      }).join('') : '<p class="list-empty">Aucun immeuble ne correspond à ces filtres.</p>';
    }

    function clearDuplicate() {
      pendingDuplicate = null;
      $('#contractDuplicateWarning').hidden = true;
    }

    function fillDuplicateMessage() {
      const match = pendingDuplicate?.matches.find(site => site.id === $('#contractDuplicateChoice').value);
      if (!match) return;
      $('#contractDuplicateMessage').textContent = `Cette adresse correspond à ${match.nom}, archivé le ${date(match.endDate)}. Voulez-vous le réactiver ?`;
    }

    function showArchivedDuplicates(matches, value) {
      pendingDuplicate = { matches, value: clone(value) };
      $('#contractDuplicateChoice').innerHTML = matches.map(site => `<option value="${escapeHTML(site.id)}">${escapeHTML(site.nom)} — ${escapeHTML(date(site.endDate))}</option>`).join('');
      $('#contractDuplicateChoiceField').hidden = matches.length === 1;
      $('#contractDuplicateWarning').hidden = false;
      fillDuplicateMessage();
      $('#contractDuplicateWarning').scrollIntoView({ block: 'nearest' });
      $('#contractReactivateMatch').focus({ preventScroll: true });
    }

    function openEditor(id = null) {
      const original = id ? find(id) : null;
      if (id && !original) return;
      isNew = !original;
      draft = original ? clone(original) : {
        id: uid(), nom: '', adresse: '', client: '', status: 'active', startDate: today(),
        endDate: null, contractHistory: [], checklist: [],
        ...(type === 'bureaux' ? { cleanerName: '' } : { concierge: '' })
      };
      $('#contractEditorTitle').textContent = isNew ? 'Ajouter un immeuble' : 'Modifier l’immeuble';
      $('#contractName').value = draft.nom;
      $('#contractAddress').value = draft.adresse;
      $('#contractClient').value = draft.client || '';
      $('#contractPerson').value = window.CONTRACTS.person(draft, type);
      $('#contractPersonLabel').textContent = `${personLabel()} (facultatif)`;
      $('#contractStartDate').value = draft.startDate || '';
      $('#contractStartDate').required = isNew;
      $('#contractClients').innerHTML = [...new Set(sites().map(site => site.client).filter(Boolean))]
        .map(client => `<option value="${escapeHTML(client)}"></option>`).join('');
      $('#contractCopyChecklist').innerHTML = '<option value="">Choisir un modèle à copier</option>' + sites()
        .filter(site => site.id !== draft.id && site.checklist?.length)
        .sort((left, right) => left.nom.localeCompare(right.nom, 'fr'))
        .map(site => `<option value="${escapeHTML(site.id)}">${escapeHTML(site.nom)}${site.status === 'archived' ? ' (archivé)' : ''}</option>`).join('');
      clearDuplicate();
      error('contractEditorError');
      renderChecklist();
      const dialog = $('#contractEditorDialog');
      dialog.showModal();
      dialog.scrollTop = 0;
      $('#contractName').focus({ preventScroll: true });
    }

    function lineLabel(line) { return type === 'bureaux' ? line.libelle : line; }

    function renderChecklist() {
      const zones = draft.checklist || [];
      const lineCount = zones.reduce((count, zone) => count + zone.lignes.length, 0);
      $('#contractChecklistCount').textContent = `${zones.length} zone(s), ${lineCount} ligne(s).`;
      $('#contractChecklistZones').innerHTML = zones.length ? zones.map((zone, zoneIndex) => `
        <section class="contract-zone" data-zone="${zoneIndex}" aria-label="Zone ${zoneIndex + 1}">
          <label class="form-field" for="contractZone${zoneIndex}"><span>Zone ${zoneIndex + 1} — titre</span><input id="contractZone${zoneIndex}" type="text" value="${escapeHTML(zone.titre)}" data-zone-title="${zoneIndex}" required></label>
          <div class="contract-zone-tools"><button type="button" class="button button-secondary" data-checklist-action="zone-up" data-zone="${zoneIndex}" ${zoneIndex ? '' : 'disabled'} aria-label="Monter la zone ${zoneIndex + 1}">Monter</button><button type="button" class="button button-secondary" data-checklist-action="zone-down" data-zone="${zoneIndex}" ${zoneIndex + 1 < zones.length ? '' : 'disabled'} aria-label="Descendre la zone ${zoneIndex + 1}">Descendre</button><button type="button" class="button button-danger" data-checklist-action="zone-delete" data-zone="${zoneIndex}">Supprimer la zone</button></div>
          ${zone.lignes.map((line, lineIndex) => `<div class="contract-line">
            <label class="form-field" for="contractLine${zoneIndex}-${lineIndex}"><span>Ligne ${lineIndex + 1}</span><textarea id="contractLine${zoneIndex}-${lineIndex}" rows="2" data-line-label="${lineIndex}" data-zone="${zoneIndex}" required>${escapeHTML(lineLabel(line))}</textarea></label>
            ${type === 'bureaux' ? `<label class="form-field" for="contractFrequency${zoneIndex}-${lineIndex}"><span>Fréquence (facultative)</span><input id="contractFrequency${zoneIndex}-${lineIndex}" type="text" value="${escapeHTML(line.frequence || '')}" data-line-frequency="${lineIndex}" data-zone="${zoneIndex}" placeholder="Ex. : 5x/sem"></label>` : ''}
            <div class="contract-line-tools"><button type="button" class="button button-secondary" data-checklist-action="line-up" data-zone="${zoneIndex}" data-line="${lineIndex}" ${lineIndex ? '' : 'disabled'} aria-label="Monter la ligne ${lineIndex + 1}">Monter</button><button type="button" class="button button-secondary" data-checklist-action="line-down" data-zone="${zoneIndex}" data-line="${lineIndex}" ${lineIndex + 1 < zone.lignes.length ? '' : 'disabled'} aria-label="Descendre la ligne ${lineIndex + 1}">Descendre</button><button type="button" class="button button-danger" data-checklist-action="line-delete" data-zone="${zoneIndex}" data-line="${lineIndex}">Supprimer la ligne</button></div>
          </div>`).join('')}
          <button type="button" class="button button-secondary" data-checklist-action="line-add" data-zone="${zoneIndex}">Ajouter une ligne</button>
        </section>`).join('') : '<p class="field-help">Aucune zone. Ajoutez une zone ou copiez une checklist.</p>';
    }

    function checklistInput(event) {
      const field = event.target;
      if (field.dataset.zoneTitle !== undefined) {
        draft.checklist[Number(field.dataset.zoneTitle)].titre = field.value;
      } else if (field.dataset.lineLabel !== undefined) {
        const zone = draft.checklist[Number(field.dataset.zone)];
        const index = Number(field.dataset.lineLabel);
        if (type === 'bureaux') zone.lignes[index].libelle = field.value;
        else zone.lignes[index] = field.value;
      } else if (field.dataset.lineFrequency !== undefined) {
        draft.checklist[Number(field.dataset.zone)].lignes[Number(field.dataset.lineFrequency)].frequence = field.value;
      }
    }

    function checklistAction(event) {
      const button = event.target.closest('[data-checklist-action]');
      if (!button || busy) return;
      const action = button.dataset.checklistAction;
      const zoneIndex = Number(button.dataset.zone);
      const lineIndex = Number(button.dataset.line);
      const zone = draft.checklist[zoneIndex];
      if (!zone) return;
      if (action === 'zone-delete') {
        if (!window.confirm(`Supprimer la zone « ${zone.titre || 'Sans titre'} » et ses ${zone.lignes.length} ligne(s) de cette checklist ? Les anciens contrôles restent inchangés.`)) return;
        draft.checklist.splice(zoneIndex, 1);
      } else if (action === 'line-delete') {
        if (!window.confirm(`Supprimer la ligne « ${lineLabel(zone.lignes[lineIndex]) || 'Sans libellé'} » de cette checklist ? Les anciens contrôles restent inchangés.`)) return;
        zone.lignes.splice(lineIndex, 1);
      } else if (action === 'line-add') {
        zone.lignes.push(type === 'bureaux' ? { libelle: '', frequence: '' } : '');
      } else {
        const target = action.endsWith('-up') ? -1 : 1;
        const collection = action.startsWith('zone-') ? draft.checklist : zone.lignes;
        const index = action.startsWith('zone-') ? zoneIndex : lineIndex;
        if (index + target < 0 || index + target >= collection.length) return;
        [collection[index], collection[index + target]] = [collection[index + target], collection[index]];
      }
      clearDuplicate();
      renderChecklist();
      if (action === 'line-add') $(`#contractLine${zoneIndex}-${zone.lignes.length - 1}`)?.focus();
    }

    function readDraft() {
      const value = clone(draft);
      value.nom = $('#contractName').value.trim();
      value.adresse = $('#contractAddress').value.trim();
      value.client = $('#contractClient').value.trim();
      value.startDate = $('#contractStartDate').value;
      value[type === 'bureaux' ? 'cleanerName' : 'concierge'] = $('#contractPerson').value.trim();
      if (type === 'bureaux') delete value.concierge;
      return value;
    }

    async function save(value, adding = isNew) {
      await operation(async () => {
        const saved = await onSave(value, adding);
        if (saved === false) return;
        $('#contractEditorDialog').close();
        render(type);
      }, 'contractEditorError', $('#contractEditorForm'));
    }

    async function submitEditor(event) {
      event.preventDefault();
      if (busy || !$('#contractEditorForm').reportValidity()) return;
      error('contractEditorError');
      const value = readDraft();
      if (!value.nom || value.checklist.some(zone => !zone.titre.trim() ||
        zone.lignes.some(line => !lineLabel(line).trim()))) {
        error('contractEditorError', 'Renseignez le nom, les titres des zones et les libellés des lignes.');
        return;
      }
      const matches = window.CONTRACTS.duplicates(value, sites(), isNew ? null : value.id);
      if (matches.some(site => site.status === 'active')) {
        clearDuplicate();
        error('contractEditorError', 'Cet immeuble existe déjà et est actif');
        return;
      }
      const archived = matches.filter(site => site.status === 'archived');
      if (archived.length) { showArchivedDuplicates(archived, value); return; }
      clearDuplicate();
      await save(value);
    }

    async function reactivateMatch() {
      if (!pendingDuplicate || busy) return;
      const id = $('#contractDuplicateChoice').value;
      const value = pendingDuplicate.value;
      await operation(async () => {
        const saved = await onReactivate(id, value.startDate || today());
        if (saved === false) return;
        $('#contractEditorDialog').close();
        clearDuplicate();
        render(type);
      }, 'contractEditorError', $('#contractEditorForm'));
    }

    async function createAnyway() {
      if (!pendingDuplicate || busy) return;
      const value = clone(pendingDuplicate.value);
      // Le libellé du bouton annonce une nouvelle fiche, même depuis Modifier.
      if (!isNew) {
        value.id = uid(); value.status = 'active'; value.endDate = null;
        value.contractHistory = []; value.mergedIds = []; value.startDate ||= today();
      }
      await save(value, true);
    }

    function openDate(id, mode) {
      const site = find(id);
      if (!site) return;
      dateAction = { id, mode };
      const archive = mode === 'archive';
      $('#contractDateTitle').textContent = archive ? 'Archiver le contrat' : 'Réactiver le contrat';
      $('#contractDateLabel').textContent = archive ? 'Date de fin du contrat' : 'Nouvelle date de début du contrat';
      $('#contractDateConfirm').textContent = archive ? 'Archiver le contrat' : 'Réactiver';
      $('#contractDateDescription').textContent = archive
        ? `${site.nom} ne sera plus proposé dans un nouveau contrôle. Ses contrôles, sa checklist, ses PDF et son suivi restent conservés.`
        : `${site.nom} sera à nouveau proposé dans un nouveau contrôle. La date de fin précédente reste dans l’historique.`;
      $('#contractDate').value = today();
      $('#contractDate').min = archive ? site.startDate || '' : site.endDate || '';
      error('contractDateError');
      $('#contractDateDialog').showModal();
      $('#contractDate').focus();
    }

    async function submitDate(event) {
      event.preventDefault();
      if (!dateAction || busy || !$('#contractDateForm').reportValidity()) return;
      const { id, mode } = dateAction;
      const value = $('#contractDate').value;
      await operation(async () => {
        const result = await (mode === 'archive' ? onArchive(id, value) : onReactivate(id, value));
        if (result === false) return;
        $('#contractDateDialog').close();
        render(type);
      }, 'contractDateError', $('#contractDateForm'));
    }

    async function remove(id) {
      const site = find(id);
      if (!site) return;
      const count = Number(usage(id).controls) || 0;
      if (count) {
        notify(`Cet immeuble possède ${count} contrôle(s) enregistré(s). Il ne peut pas être supprimé ; seul l’archivage du contrat est possible.`, true);
        if (site.status === 'active') openDate(id, 'archive');
        return;
      }
      if (!window.confirm(`Supprimer la fiche « ${site.nom} » ? Aucun contrôle enregistré n’est lié à cette fiche. Confirmez sa suppression.`)) return;
      await operation(async () => { await onDelete(id); render(type); });
    }

    function openMerge(id) {
      const source = find(id);
      if (!source) return;
      const matches = window.CONTRACTS.duplicates(source, sites(), id);
      if (!matches.length) { render(type); return; }
      mergeSource = id;
      $('#contractMergeDescription').textContent = `La fiche « ${source.nom} » sera fusionnée avec la fiche choisie ci-dessous.`;
      $('#contractMergeTarget').innerHTML = matches.map(site => `<option value="${escapeHTML(site.id)}">${escapeHTML(site.nom)} — ${escapeHTML(site.adresse || 'Adresse non renseignée')} (${site.status === 'archived' ? 'archivé' : 'actif'})</option>`).join('');
      updateMergeCount();
      error('contractMergeError');
      $('#contractMergeDialog').showModal();
      $('#contractMergeTarget').focus();
    }

    function updateMergeCount() {
      const target = $('#contractMergeTarget').value;
      const count = (Number(usage(mergeSource).controls) || 0) + (Number(usage(target).controls) || 0);
      $('#contractMergeCount').textContent = `${count} contrôle(s) seront conservés. La fusion retire une fiche de la liste des immeubles.`;
    }

    async function submitMerge(event) {
      event.preventDefault();
      if (!mergeSource || busy || !$('#contractMergeForm').reportValidity()) return;
      await operation(async () => {
        const result = await onMerge($('#contractMergeTarget').value, mergeSource);
        if (result === false) return;
        $('#contractMergeDialog').close();
        render(type);
      }, 'contractMergeError', $('#contractMergeForm'));
    }

    async function reset() {
      if (busy || !window.confirm('Réinitialiser cette section à la liste de départ ? Les fiches, dates de contrat et checklists locales seront remplacées par les données des fichiers. Les contrôles, photos, PDF et anomalies resteront conservés. Exportez une sauvegarde avant de continuer si vous souhaitez conserver les fiches personnalisées.')) return;
      await operation(async () => { await onReset(); states[type].page = 0; render(type); });
    }

    function bind() {
      if (bound) return;
      bound = true;
      $('#contractAdd').addEventListener('click', () => { if (!busy) openEditor(); });
      $('#contractsReset').addEventListener('click', reset);
      for (const [id, key] of [['contractStatusFilter', 'status'], ['contractClientFilter', 'client'], ['contractSearch', 'query']]) {
        $(`#${id}`).addEventListener(key === 'query' ? 'input' : 'change', event => {
          states[type][key] = event.target.value; states[type].page = 0; render(type);
        });
      }
      $('#contractsPrevious').addEventListener('click', () => { states[type].page -= 1; render(type); });
      $('#contractsNext').addEventListener('click', () => { states[type].page += 1; render(type); });
      $('#contractsList').addEventListener('click', event => {
        const button = event.target.closest('[data-contract-action]');
        if (!button || busy) return;
        const { contractAction: action, id } = button.dataset;
        if (action === 'edit') openEditor(id);
        else if (action === 'archive' || action === 'reactivate') openDate(id, action);
        else if (action === 'delete') remove(id);
        else if (action === 'merge') openMerge(id);
      });
      $('#contractEditorForm').addEventListener('submit', submitEditor);
      $('#contractEditorForm').addEventListener('input', event => {
        if (event.target.closest('#contractDuplicateWarning')) return;
        checklistInput(event); clearDuplicate(); error('contractEditorError');
      });
      $('#contractChecklistZones').addEventListener('click', checklistAction);
      $('#contractAddZone').addEventListener('click', () => {
        if (busy) return;
        draft.checklist.push({ titre: '', lignes: [] }); clearDuplicate(); renderChecklist();
        $(`#contractZone${draft.checklist.length - 1}`).focus();
      });
      $('#contractCopyChecklist').addEventListener('change', event => {
        const source = find(event.target.value);
        if (!source) return;
        if (draft.checklist.length && !window.confirm(`Remplacer les zones et lignes du brouillon par la checklist de « ${source.nom} » ? Les contrôles enregistrés restent inchangés.`)) { event.target.value = ''; return; }
        draft.checklist = clone(source.checklist || []); clearDuplicate(); renderChecklist();
        event.target.value = '';
      });
      $('#contractDuplicateChoice').addEventListener('change', fillDuplicateMessage);
      $('#contractReactivateMatch').addEventListener('click', reactivateMatch);
      $('#contractCreateAnyway').addEventListener('click', createAnyway);
      $('#contractDateForm').addEventListener('submit', submitDate);
      $('#contractMergeForm').addEventListener('submit', submitMerge);
      $('#contractMergeTarget').addEventListener('change', updateMergeCount);
      for (const [dialogId, cancelId] of [['contractEditorDialog', 'contractEditorCancel'], ['contractDateDialog', 'contractDateCancel'], ['contractMergeDialog', 'contractMergeCancel']]) {
        $(`#${cancelId}`).addEventListener('click', () => { if (!busy) $(`#${dialogId}`).close(); });
        $(`#${dialogId}`).addEventListener('cancel', event => { if (busy) event.preventDefault(); });
      }
    }

    return Object.freeze({ render, bind });
  }

  window.CONTRACTS_UI = Object.freeze({ create });
})();
