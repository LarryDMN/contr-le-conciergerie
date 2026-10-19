/* Noms historiques et filtres : node --test tests/people.test.cjs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sandbox = { window: {}, Map };
const load = (file, context = sandbox) => vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
load('people.js');
load('insights.js');
const people = sandbox.window.CONTROL_PEOPLE;
const visit = (id, extra = {}) => ({ id, type: 'conciergerie', buildingId: 'prulay',
  buildingName: 'Prulay', address: 'Rue 1', date: '2026-10-01', updatedAt: '2026-10-01T10:00:00Z', ...extra });

test('libellés exacts et noms libres, sans changer les données historiques', () => {
  const record = visit('a', { concierge: '  Alex Martin  ' });
  assert.equal(people.name(record), 'Alex Martin');
  assert.equal(record.concierge, '  Alex Martin  ');
  assert.equal(people.label(record), 'Concierge');
  assert.equal(people.label('bureaux'), 'Nettoyeur/Nettoyeuse');
  assert.equal(people.label({ type: 'bureaux' }), 'Nettoyeur/Nettoyeuse');
  assert.equal(people.display({}), 'Non renseigné');
  assert.equal(people.display({ concierge: '   ' }), 'Non renseigné');
  assert.equal(people.display({ concierge: 42 }), 'Non renseigné');
});

test('ancien concierge de bureaux compatible, nouveau champ vide faisant foi', () => {
  assert.equal(people.name({ type: 'bureaux', concierge: 'Ancien nom' }), 'Ancien nom');
  assert.equal(people.name({ type: 'bureaux', cleanerName: 'Sam', concierge: 'Ancien nom' }), 'Sam');
  assert.equal(people.display({ type: 'bureaux', cleanerName: '', concierge: 'Ancien nom' }), 'Non renseigné');
  assert.equal(people.display({ type: 'bureaux', cleanerName: null, concierge: 'Ancien nom' }), 'Non renseigné');
  assert.equal(people.name({ concierge: 'Concierge actuel', cleanerName: 'Autre rôle' }), 'Concierge actuel');
});

test('dernier nom du site par visite, jamais par date de modification seule', () => {
  const current = visit('current', { concierge: 'Nom du contrôle ouvert' });
  const records = [current,
    visit('old-edited', { date: '2026-08-01', updatedAt: '2026-12-01', concierge: 'Ancien' }),
    visit('latest', { date: '2026-10-18', concierge: 'Dernier' }),
    visit('newer-empty', { date: '2026-10-19', concierge: '   ' })];
  const before = JSON.stringify(records);
  assert.equal(people.previousName(current, records), 'Dernier');
  assert.equal(people.previousName(current, new Map(records.map(record => [record.id, record]))), 'Dernier');
  assert.equal(JSON.stringify(records), before);
  assert.equal(people.previousName(current, [current]), '');
  assert.equal(people.previousName(current, []), '');
});

test('départage stable des visites de même date et données datées dans le futur', () => {
  const current = visit('current');
  const records = [
    visit('a', { date: '2027-01-01', updatedAt: '2027-01-01T12:00:00Z', createdAt: '2027-01-01T08:00:00Z', concierge: 'A' }),
    visit('b', { date: '2027-01-01', updatedAt: '2027-01-01T13:00:00Z', createdAt: '2027-01-01T09:00:00Z', concierge: 'B' }),
    visit('c', { date: '2027-01-01', updatedAt: '2027-01-01T13:00:00Z', createdAt: '2027-01-01T10:00:00Z', concierge: 'C' })];
  assert.equal(people.previousName(current, records), 'C');
  records.push({ ...records[2], id: 'd', concierge: 'D' });
  assert.equal(people.previousName(current, [...records].reverse()), 'C');
});

test('sections et identifiants de sites distincts ne partagent jamais leur nom', () => {
  const current = visit('current');
  const unrelated = [
    visit('office', { type: 'bureaux', cleanerName: 'Bureau', date: '2026-12-01' }),
    visit('other-id', { buildingId: 'another', concierge: 'Autre site', date: '2026-12-01' })];
  assert.equal(people.previousName(current, unrelated), '');
  assert.equal(people.previousName(current, [...unrelated, visit('correct', { concierge: 'Bon site' })]), 'Bon site');
});

test('anciens contrôles rapprochés seulement par texte exact non vide du site', () => {
  const current = visit('current');
  assert.equal(people.previousName(current, [visit('legacy', { buildingId: undefined, concierge: 'Même adresse' })]), 'Même adresse');
  assert.equal(people.previousName(current, [visit('legacy', { buildingId: undefined, address: 'Rue 2', concierge: 'Homonyme' })]), '');
  assert.equal(people.previousName(current, [visit('legacy', { buildingId: undefined, address: '', concierge: 'Même nom' })]), 'Même nom');
  assert.equal(people.previousName(visit('new', { buildingId: null, address: '' }), [visit('legacy', { address: '', concierge: 'Même nom' })]), 'Même nom');
  assert.equal(people.previousName(visit('new', { buildingId: null, address: '', buildingName: '' }),
    [visit('legacy', { buildingId: null, address: '', buildingName: '', concierge: 'Site inconnu' })]), '');
  assert.equal(people.previousName(current, [visit('legacy', { buildingId: undefined, address: ' Rue 1 ', concierge: 'Adresse différente' })]), '');
});

test('derniers noms bureaux et anciennes visites sans type compatibles', () => {
  const current = visit('office-new', { type: 'bureaux' });
  assert.equal(people.previousName(current, [visit('office-old', { type: 'bureaux', cleanerName: 'Camille' })]), 'Camille');
  assert.equal(people.previousName(current, [visit('office-old', { type: 'bureaux', concierge: 'Nom historique' })]), 'Nom historique');
  assert.equal(people.previousName(current, [visit('office-old', { type: 'bureaux', cleanerName: '', concierge: 'Ne pas reprendre' })]), '');
  assert.equal(people.previousName(visit('new'), [visit('legacy', { type: undefined, concierge: 'Concierge historique' })]), 'Concierge historique');
});

test('tableau de bord : personne du dernier contrôle, notes et anomalies préservées', () => {
  const controls = [visit('old', { concierge: 'Ancienne personne', rows: { a: { rating: 4 } } }),
    visit('latest', { date: '2026-10-19', concierge: 'Personne du dernier contrôle', rows: { a: { rating: 1 }, b: { rating: 2 }, c: { rating: null } } }),
    visit('office', { type: 'bureaux', cleanerName: 'Nettoyeuse actuelle', rows: { a: { rating: 3 } } })];
  const options = { controls, anomalies: [visit('anomaly', { controlId: 'old', status: 'open' })],
    catalogs: { conciergerie: [{ id: 'prulay', nom: 'Prulay', concierge: 'Nom du catalogue' }, { id: 'empty', nom: 'Sans visite' }] } };
  const before = JSON.stringify(options);
  const stats = sandbox.window.CONTROL_INSIGHTS.stats(options);
  const current = stats.cards.find(card => card.key === 'id:prulay');
  assert.equal(current.latestPersonName, 'Personne du dernier contrôle');
  assert.equal(current.latestDate, '2026-10-19');
  assert.equal(current.average, 1.5);
  assert.equal(current.ratedCount, 2);
  assert.equal(current.openAnomalies, 1);
  assert.equal(stats.cards.find(card => card.key === 'id:empty').hasControl, false);
  assert.equal(sandbox.window.CONTROL_INSIGHTS.stats({ ...options, type: 'bureaux' }).cards[0].latestPersonName, 'Nettoyeuse actuelle');
  assert.equal(JSON.stringify(options), before);
  assert.equal(sandbox.window.CONTROL_INSIGHTS.stats({ controls: [visit('unnamed')] }).cards[0].latestPersonName, 'Non renseigné');
});

test('Mes contrôles : filtre nominatif, recherche accentuée, actualisation et pagination', () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', dataset: {}, innerHTML: '', textContent: '', handlers: {},
      addEventListener(event, callback) { this.handlers[event] = callback; } });
    return elements.get(id);
  };
  const context = { window: sandbox.window, Map, document: { getElementById: element, querySelectorAll: () => [] } };
  load('lists.js', context);
  const controls = new Map(Array.from({ length: 53 }, (_, index) => [String(index), visit(String(index), {
    concierge: index < 2 ? 'Élodie' : index === 2 ? '' : 'Alex', rows: {}, comments: { text: '' }
  })]));
  const office = visit('office', { type: 'bureaux', cleanerName: 'Camille', rows: {} });
  controls.set(office.id, office);
  const lists = context.window.CONTROL_LISTS.create({ controls, archives: new Map(),
    typeLabels: { conciergerie: 'Conciergerie', bureaux: 'Bureaux' }, buildingName: record => record.buildingName,
    displayDate: value => value, ratedCount: () => 0, escapeHTML: value => String(value) });
  lists.renderControls();
  lists.bind();
  const change = (id, value, event = 'change') => { element(id).value = value; element(id).handlers[event]({ target: { value } }); };
  assert.equal((element('controlList').innerHTML.match(/data-open-control=/g) || []).length, 50);
  assert.match(element('controlPageInfo').textContent, /Page 1 sur 2/);
  assert.match(element('controlPersonFilter').innerHTML, /Non renseigné/);
  assert.equal(element('controlPersonFilterLabel').textContent, 'Concierge');
  change('controlPersonFilter', 'Élodie');
  assert.match(element('controlListCount').textContent, /^2 contrôles/);
  change('controlPersonFilter', '');
  change('controlSearch', 'elodie', 'input');
  assert.match(element('controlListCount').textContent, /^2 contrôles/);
  change('controlSearch', '', 'input');
  controls.get('0').concierge = 'Nouveau nom';
  lists.renderControls();
  assert.match(element('controlList').innerHTML, /Nouveau nom/);
  assert.match(element('controlPersonFilter').innerHTML, /Nouveau nom/);
  change('controlPersonFilter', 'Non renseigné');
  assert.match(element('controlListCount').textContent, /^1 contrôle /);
  lists.filterSite('conciergerie', 'id:prulay');
  assert.equal(element('controlPersonFilter').value, '');
  assert.match(element('controlListCount').textContent, /^53 contrôles/);
  lists.renderControls('bureaux');
  assert.equal(element('controlPersonFilterLabel').textContent, 'Nettoyeur/Nettoyeuse');
  assert.match(element('controlList').innerHTML, /Camille/);
  assert.doesNotMatch(element('controlPersonFilter').innerHTML, /Élodie/);
});
