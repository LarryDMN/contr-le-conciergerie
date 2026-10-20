/* Modèles par immeuble et conservation de l'historique : node --test tests/conciergerie-model.test.cjs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({ window: {}, Map });
const load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
load('office-model.js');
load('conciergerie-model.js');
load('config.js');
load('data/conciergeries.js');
load('checklists-conciergeries.js');
load('insights.js');
const model = context.window.CONCIERGERIE_MODEL;
const definitions = vm.runInContext('checklistsConciergeries', context);
const legacy = context.window.CONCIERGERIE_CONFIG.sections;
const plain = value => JSON.parse(JSON.stringify(value));
const items = sections => sections.flatMap(section => section.groups.flatMap(group => group.items));
const small = lignes => ({ checklist: [{ titre: 'Entrée', lignes }] });

test('Lyon, Terroux, Edmond-Vaucher et Jeunes 105B gardent leurs zones et lignes distinctes', () => {
  const before = JSON.stringify(definitions);
  for (const [id, zoneCount, lineCount] of [['lyon-12', 5, 24], ['terroux-4b', 6, 35],
    ['edmond-vaucher-13b-13c', 6, 36], ['jeunes-105', 5, 28]]) {
    const sections = model.sections(definitions[id]);
    assert.equal(sections.length, zoneCount);
    assert.equal(items(sections).length, lineCount);
    assert.deepEqual(plain(sections.map(section => section.title)), plain(definitions[id].checklist.map(zone => zone.titre)));
    assert.deepEqual(plain(items(sections).map(item => item.label)), plain(definitions[id].checklist.flatMap(zone => zone.lignes)));
    assert(items(sections).every(item => item.frequency === ''));
  }
  assert.equal(JSON.stringify(definitions), before);
});

test('absence de checklist sans modèle par défaut et clés inconnues signalées sans correction', () => {
  assert.deepEqual(plain(model.sections(undefined)), []);
  assert.deepEqual(plain(model.sections({})), []);
  assert.deepEqual(plain(model.sections({ checklist: [] })), []);
  assert.equal(definitions['edmond-vaucher-13b-c'], undefined);
  assert.equal(definitions['route-des-jeunes-105b'], undefined);
  assert.deepEqual(plain(model.unknownKeys(definitions, context.window.CONCIERGERIES)), []);
  const unknown = { ...definitions, 'site-inconnu': small(['Sol']) };
  assert.deepEqual(plain(model.unknownKeys(unknown, context.window.CONCIERGERIES)), ['site-inconnu']);
  assert.equal(Object.hasOwn(unknown, 'site-inconnu'), true);
  const site = context.window.CONCIERGERIES.find(site => site.id === 'jeunes-105');
  assert.equal(site.nom, 'Route des Jeunes 105B');
  assert.equal(site.adresse, 'Route des Jeunes 105B');
});

test('déplacer ou ajouter une ligne garde les autres identifiants ; un renommage change son identité', () => {
  const first = items(model.sections(small(['Sol', 'Porte'])));
  const reordered = items(model.sections(small(['Porte', 'Fenêtre', 'Sol'])));
  for (const item of first) assert.equal(reordered.find(candidate => candidate.label === item.label).id, item.id);
  assert.notEqual(items(model.sections(small(['État du sol'])))[0].id, first[0].id);
  const duplicate = model.sections({ checklist: [{ titre: 'Entrée', lignes: ['Sol', 'Sol'] }, { titre: 'Entrée', lignes: ['Sol'] }] });
  const ids = duplicate.flatMap(section => [section.id, ...section.groups.flatMap(group => [group.id, ...group.items.map(item => item.id)])]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(items(duplicate).length, 3);
});

test('les clichés sont des copies validées, indépendantes des mises à jour du fichier', () => {
  const definition = small(['Sol', 'Porte']);
  const original = model.sections(definition);
  const copy = model.validateSnapshot(original);
  definition.checklist[0].titre = 'Autre zone';
  definition.checklist[0].lignes[0] = 'Autre ligne';
  copy[0].groups[0].items[0].label = 'Copie modifiée';
  assert.equal(original[0].title, 'Entrée');
  assert.equal(items(original)[0].label, 'Sol');
  assert.notEqual(items(model.sections(definition))[0].id, items(original)[0].id);
  assert.throws(() => model.sections(small([''])), /Ligne/);
  assert.throws(() => model.sections(small([{ libelle: 'Objet non fourni' }])), /Ligne/);
  assert.throws(() => model.sections({ checklist: [{ titre: '', lignes: [] }] }), /Zone/);
  const badIds = plain(original);
  badIds[0].groups[0].items[1].id = badIds[0].groups[0].items[0].id;
  assert.throws(() => model.validateSnapshot(badIds), /Identifiant/);
  assert.throws(() => model.validateSnapshot({}), /Modèle/);
});

test('les bureaux conservent les identifiants de leurs contrôles existants', () => {
  const sections = context.window.OFFICE_MODEL.sections({ checklist: [{ titre: 'Accueil', lignes: [{ libelle: 'Sol', frequence: '5x/sem' }] }] });
  assert.equal(sections[0].id, 'bureau-zone-4d343f2d15a2b3d1');
  assert.equal(items(sections)[0].id, 'bureau-zone-4d343f2d15a2b3d1-ligne-44c0d5410b880f95');
  assert.equal(items(sections)[0].frequency, '5x/sem');
  assert.throws(() => context.window.OFFICE_MODEL.sections(small(['Sol'])), /Ligne/);
});

test('comparaison par libellé exact entre ancien modèle et nouveau, sans inventer de correspondance', () => {
  const previous = { id: 'old', type: 'conciergerie', buildingId: 'lyon-12', date: '2026-10-01',
    rows: { 'entree-boites-aux-lettres': { rating: 2 }, 'entree-eclairage': { rating: 2 } },
    lineLabels: { 'entree-boites-aux-lettres': 'Boîtes aux lettres', 'entree-eclairage': 'Eclairage' } };
  const sections = model.sections(definitions['lyon-12']);
  const box = items(sections).find(item => item.label === 'Boîtes aux lettres');
  const newLight = items(sections).find(item => item.label === 'Éclairage');
  const bins = items(sections).find(item => item.label === 'Local poubelles');
  const current = { id: 'new', type: 'conciergerie', buildingId: 'lyon-12', date: '2026-10-02', conciergerieSections: sections,
    rows: { [box.id]: { rating: 4 }, [newLight.id]: { rating: 3 }, [bins.id]: { rating: 1 } },
    lineLabels: Object.fromEntries([box, newLight, bins].map(item => [item.id, item.label])) };
  const before = JSON.stringify(previous);
  const templateFor = record => ({ sections: record.conciergerieSections || legacy });
  const comparison = context.window.CONTROL_INSIGHTS.compare(current, [previous], {}, templateFor);
  assert.equal(comparison.byRow[box.id].rating, 2);
  assert.equal(comparison.byRow[box.id].direction, 'worse');
  assert.equal(comparison.byRow[newLight.id].kind, 'new');
  assert.equal(comparison.byRow[bins.id].kind, 'new');
  assert.equal(JSON.stringify(previous), before);
  assert.equal(items(legacy).length, 30);
  assert.equal(items(legacy)[0].id, 'entree-eclairage');
});
