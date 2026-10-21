/* Contrats locaux : node --test tests/contracts.test.cjs (sans dépendance). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({ window: {} });
const load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
load('contracts.js');
load('data/conciergeries.js');
load('data/bureaux.js');
load('checklists-conciergeries.js');
const contracts = context.window.CONTRACTS;
const plain = value => JSON.parse(JSON.stringify(value));
const site = (extra = {}) => ({ id: 'site-1', nom: 'Site principal', adresse: 'Rue des Écoles 1',
  concierge: 'Manuel', startDate: '2026-01-01', ...extra });

test('la liste de départ est copiée avec ses modèles et aucun historique inventé', () => {
  const source = { conciergeries: context.window.CONCIERGERIES, bureaux: context.window.BUREAUX,
    checklists: vm.runInContext('checklistsConciergeries', context) };
  const before = JSON.stringify(source);
  const catalog = contracts.seeds(source);
  assert.equal(catalog.conciergeries.length, 21);
  assert.equal(catalog.bureaux.length, 1);
  const lyon = catalog.conciergeries.find(value => value.id === 'lyon-12');
  assert.equal(lyon.checklist.flatMap(zone => zone.lignes).length, 24);
  assert.equal(lyon.status, 'active');
  assert.equal(lyon.startDate, '');
  assert.deepEqual(plain(lyon.contractHistory), []);
  assert.equal(contracts.person(lyon, 'conciergerie'), 'Manuel');
  assert.equal(contracts.person(catalog.bureaux[0], 'bureaux'), '');
  lyon.checklist[0].lignes[0] = 'Changement local';
  assert.equal(JSON.stringify(source), before);
});

test('les doublons ignorent accents, casse, espaces et ponctuation de l’adresse', () => {
  const values = [site({ id: 'one', adresse: 'Rue de la Prulay 60-62' }),
    site({ id: 'two', adresse: 'Autre rue 2' }), site({ id: 'three', adresse: 'rue de la prulay 60–62' })];
  assert.equal(contracts.normalizeText(' RUE de l’École — 1 ! '), 'ruedelecole1');
  const matches = contracts.duplicates({ nom: 'Nom différent', adresse: ' RUE DE LA PRULAY 60 – 62 ' }, values);
  assert.deepEqual(plain(matches.map(value => value.id)), ['one', 'three']);
  assert.deepEqual(plain(contracts.duplicates(values[0], values).map(value => value.id)), ['three']);
  assert.equal(contracts.duplicates({ nom: 'Site principal', adresse: 'Rue distincte 55' }, values).length, 0);
  assert.equal(contracts.duplicates({ nom: 'Site principal', adresse: '' }, values).length, 3);
  assert.equal(contracts.duplicates({ nom: '', adresse: '' }, values).length, 0);
});

test('les groupes de doublons ne fusionnent pas deux adresses distinctes par leur nom seul', () => {
  const values = [site({ id: 'a', adresse: 'Rue 1' }), site({ id: 'b', adresse: 'RUE–1' }),
    site({ id: 'c', adresse: 'Rue 2' }), site({ id: 'd', nom: 'Sans adresse', adresse: '' }),
    site({ id: 'e', nom: 'sans ADRESSE!', adresse: '' })];
  assert.deepEqual(plain(contracts.duplicateGroups(values).map(group => group.map(value => value.id))),
    [['a', 'b'], ['d', 'e']]);
});

test('archiver puis réactiver garde les périodes, le modèle et la personne sans muter la source', () => {
  const original = site({ checklist: [{ titre: 'Entrée', lignes: ['Sol'] }] });
  const before = JSON.stringify(original);
  const archived = contracts.archive(original, '2026-10-20');
  assert.equal(archived.status, 'archived');
  assert.equal(archived.endDate, '2026-10-20');
  assert.deepEqual(plain(archived.contractHistory), [{ startDate: '2026-01-01', endDate: '2026-10-20' }]);
  const resumed = contracts.reactivate(archived, '2026-10-21');
  assert.equal(resumed.status, 'active');
  assert.equal(resumed.startDate, '2026-10-21');
  assert.equal(resumed.endDate, null);
  assert.equal(resumed.contractHistory.length, 1);
  assert.equal(resumed.id, original.id);
  assert.equal(resumed.checklist[0].lignes[0], 'Sol');
  assert.equal(resumed.concierge, 'Manuel');
  assert.equal(JSON.stringify(original), before);
  const second = contracts.archive(resumed, '2026-12-01');
  assert.equal(second.contractHistory.length, 2);
  assert.throws(() => contracts.archive(archived, '2026-10-22'), /déjà archivé/);
  assert.throws(() => contracts.reactivate(resumed, '2026-10-22'), /actif/);
});

test('dates réelles et ordre des périodes sont vérifiés, y compris une date initiale inconnue', () => {
  assert.equal(contracts.validDate('2024-02-29'), true);
  assert.equal(contracts.validDate('2026-02-29'), false);
  assert.equal(contracts.validDate('0000-01-01'), false);
  assert.equal(contracts.validDate('2026-10-21T00:00:00Z'), false);
  assert.throws(() => contracts.archive(site(), '2025-12-31'), /suivre/);
  assert.throws(() => contracts.archive(site(), '2026-02-30'), /invalide/);
  const archived = contracts.archive(site({ startDate: '' }), '2026-10-20');
  assert.equal(archived.contractHistory[0].startDate, '');
  assert.throws(() => contracts.reactivate(archived, '2026-10-19'), /suivre/);
  const legacy = site({ status: 'archived', endDate: '2026-10-20', contractHistory: [] });
  assert.equal(contracts.reactivate(legacy, '2026-10-21').contractHistory.length, 1);
});

test('les catalogues portables conservent les métadonnées et rejettent les collisions avant écriture', () => {
  const original = { conciergeries: [site({ client: 'Client A', mergedIds: ['ancien-site'],
    checklist: [{ titre: 'Entrée', lignes: ['Sol'] }] })], bureaux: [site({ id: 'bureau-1', cleanerName: 'Nom libre',
    checklist: [{ titre: 'Zone', lignes: [{ libelle: 'Sol', frequence: '5x/sem' }] }] })] };
  const copy = contracts.validateCatalogs(original);
  assert.equal(copy.conciergeries[0].client, 'Client A');
  assert.equal(copy.bureaux[0].cleanerName, 'Nom libre');
  assert.equal(Object.hasOwn(copy.bureaux[0], 'concierge'), false);
  copy.conciergeries[0].checklist[0].lignes[0] = 'Autre';
  assert.equal(original.conciergeries[0].checklist[0].lignes[0], 'Sol');
  assert.throws(() => contracts.validateCatalogs({ conciergeries: [site(), site()] }), /répété/);
  assert.throws(() => contracts.validateCatalogs({ conciergeries: [site({ mergedIds: ['site-2'] }), site({ id: 'site-2' })] }), /répété/);
  assert.throws(() => contracts.validateCatalogs({ conciergeries: [site({ mergedIds: ['site-1'] })] }), /répété/);
  assert.throws(() => contracts.validateCatalogs({ conciergeries: [site({ checklist: [{ titre: 'Zone', lignes: [{ libelle: 'Sol' }] }] })] }), /invalide/);
  assert.throws(() => contracts.validateCatalogs({ bureaux: [site({ checklist: [{ titre: 'Zone', lignes: ['Sol'] }] })] }), /invalide/);
  assert.throws(() => contracts.validateCatalogs({ conciergeries: [site({ status: 'archived' })] }), /date de fin/);
  assert.deepEqual(plain(contracts.validateCatalogs(undefined)), { conciergeries: [], bureaux: [] });
});

test('les fréquences et noms sont facultatifs, les périodes et alias restent propres à chaque section', () => {
  const copy = contracts.validateCatalogs({ conciergeries: [site({ mergedIds: ['ancien'] })],
    bureaux: [site({ cleanerName: '', mergedIds: ['ancien'], checklist: [{ titre: 'Zone', lignes: [{ libelle: 'Sol' }] }] })] });
  assert.equal(copy.bureaux[0].checklist[0].lignes[0].frequence, '');
  assert.equal(contracts.person(copy.bureaux[0], 'bureaux'), '');
  assert.equal(contracts.person({ concierge: 'Ancien nom' }, 'bureaux'), 'Ancien nom');
  assert.equal(contracts.person({ concierge: 'Ancien nom', cleanerName: '' }, 'bureaux'), '');
  assert.equal(Object.hasOwn(contracts.validateSite(site({ phone: '1234' })), 'phone'), false);
});

test('importer complète les contrats de départ mais préserve les fiches déjà modifiées localement', () => {
  const initial = contracts.validateCatalogs({ conciergeries: [site()] });
  const current = contracts.validateCatalogs({ conciergeries: [site(), site({ id: 'custom', nom: 'Nom local' })] });
  const incoming = { conciergeries: [site({ nom: 'Nouveau nom' }), site({ id: 'custom', nom: 'Nom importé' }),
    site({ id: 'added', nom: 'Autre contrat' })] };
  const before = JSON.stringify(current);
  const result = contracts.importCatalogs(current, incoming, initial);
  assert.equal(result.added, 1);
  assert.equal(result.updated, 1);
  assert.equal(result.kept, 1);
  assert.equal(result.catalogs.conciergeries.find(value => value.id === 'site-1').nom, 'Nouveau nom');
  assert.equal(result.catalogs.conciergeries.find(value => value.id === 'custom').nom, 'Nom local');
  assert.equal(JSON.stringify(current), before);
  const replaced = contracts.importCatalogs(current, incoming, initial, { replace: true });
  assert.equal(replaced.updated, 2);
  assert.equal(replaced.kept, 0);
  assert.equal(replaced.catalogs.conciergeries.find(value => value.id === 'custom').nom, 'Nom importé');
});

test('un ancien export ne recrée pas les alias d’une fusion locale, même en remplacement', () => {
  const current = { conciergeries: [site({ id: 'target', mergedIds: ['source'] })] };
  for (const replace of [false, true]) {
    const result = contracts.importCatalogs(current, { conciergeries: [site({ id: 'source' })] }, {}, { replace });
    assert.equal(result.kept, 1);
    assert.equal(result.catalogs.conciergeries.length, 1);
    assert.deepEqual(plain(result.catalogs.conciergeries[0].mergedIds), ['source']);
  }
  const replaced = contracts.importCatalogs(current, { conciergeries: [site({ id: 'target', mergedIds: ['other'] })] }, {}, { replace: true });
  assert.deepEqual(plain(replaced.catalogs.conciergeries[0].mergedIds), ['source', 'other']);
  assert.throws(() => contracts.importCatalogs(current,
    { conciergeries: [site({ id: 'foreign', mergedIds: ['source'] })] }, {}, { replace: true }), /fusion locale/);
});

test('une fusion importée retire seulement les sources intactes, sauf remplacement explicite', () => {
  const initial = { conciergeries: [site({ id: 'source' })] };
  const current = contracts.validateCatalogs(initial);
  const incoming = { conciergeries: [site({ id: 'target', mergedIds: ['source'] })] };
  const result = contracts.importCatalogs(current, incoming, initial);
  assert.equal(result.catalogs.conciergeries.length, 1);
  assert.equal(result.catalogs.conciergeries[0].id, 'target');
  assert.deepEqual(plain(result.catalogs.conciergeries[0].mergedIds), ['source']);
  const custom = { conciergeries: [site({ id: 'source', nom: 'Personnalisé', mergedIds: ['older'] })] };
  assert.throws(() => contracts.importCatalogs(custom, incoming, initial), /modifié sur cet appareil/);
  const explicit = contracts.importCatalogs(custom, incoming, initial, { replace: true });
  assert.equal(explicit.catalogs.conciergeries.length, 1);
  assert.deepEqual(plain(explicit.catalogs.conciergeries[0].mergedIds), ['source', 'older']);
});

test('fusionner préserve les alias, périodes closes, checklist et valeurs prioritaires de la cible', () => {
  const target = contracts.archive(site({ id: 'target', concierge: '', checklist: [], mergedIds: ['older-target'] }), '2026-09-30');
  const source = contracts.validateSite(site({ id: 'source', concierge: 'Joao', startDate: '2026-10-01', mergedIds: ['older-source'],
    checklist: [{ titre: 'Entrée', lignes: ['Sol'] }], contractHistory: [{ startDate: '2025-01-01', endDate: '2025-12-31' }] }));
  const current = { conciergeries: [target, source] };
  const before = JSON.stringify(current);
  const result = contracts.mergeCatalogs(current, 'conciergerie', 'target', 'source', '2026-10-21');
  const merged = result.conciergeries[0];
  assert.equal(result.conciergeries.length, 1);
  assert.equal(merged.id, 'target');
  assert.equal(merged.status, 'active');
  assert.equal(merged.startDate, '2026-10-21');
  assert.equal(merged.endDate, null);
  assert.equal(merged.concierge, 'Joao');
  assert.deepEqual(plain(merged.mergedIds), ['older-target', 'source', 'older-source']);
  assert.equal(merged.contractHistory.length, 2);
  assert.equal(merged.checklist[0].lignes[0], 'Sol');
  assert.equal(JSON.stringify(current), before);
  assert.throws(() => contracts.mergeCatalogs(result, 'conciergerie', 'target', 'older-source', '2026-10-21'), /même immeuble/);
  const own = contracts.mergeCatalogs({ conciergeries: [site({ id: 'a', concierge: 'Manuel', checklist: [{ titre: 'Cible', lignes: ['Porte'] }] }),
    site({ id: 'b', concierge: 'Joao', checklist: [{ titre: 'Source', lignes: ['Sol'] }] })] }, 'conciergerie', 'a', 'b', '2026-10-21');
  assert.equal(own.conciergeries[0].concierge, 'Manuel');
  assert.equal(own.conciergeries[0].checklist[0].titre, 'Cible');
});

test('réinitialiser restaure les départs et garde seulement les contrats personnalisés utilisés', () => {
  const initial = { conciergeries: [site({ id: 'seed-a' }), site({ id: 'seed-b' })],
    bureaux: [site({ id: 'office', cleanerName: 'Nom initial', checklist: [] })] };
  const current = { conciergeries: [site({ id: 'seed-a', nom: 'Renommé', mergedIds: ['seed-b', 'old-custom'] }),
    site({ id: 'used-control' }), site({ id: 'used-pdf' }), site({ id: 'used-anomaly' }), site({ id: 'unused' })],
    bureaux: [site({ id: 'office', cleanerName: 'Nom local', checklist: [] })] };
  const before = JSON.stringify(current);
  const usages = { 'used-control': { controls: 1, archives: 0, anomalies: 0 }, 'used-pdf': { archives: 1 }, 'used-anomaly': { anomalies: 1 } };
  const called = [];
  const result = contracts.resetCatalogs(current, initial, (type, id) => { called.push([type, id]); return usages[id] || {}; }, '2026-10-21', 'conciergerie');
  assert.equal(result.conciergeries.length, 5);
  assert.equal(result.conciergeries.find(value => value.id === 'seed-a').nom, 'Site principal');
  assert.deepEqual(plain(result.conciergeries.find(value => value.id === 'seed-a').mergedIds), ['old-custom']);
  for (const id of ['used-control', 'used-pdf', 'used-anomaly']) {
    const saved = result.conciergeries.find(value => value.id === id);
    assert.equal(saved.status, 'archived');
    assert.equal(saved.endDate, '2026-10-21');
    assert.equal(saved.contractHistory.length, 1);
  }
  assert.equal(result.conciergeries.some(value => value.id === 'unused'), false);
  assert.equal(result.bureaux[0].cleanerName, 'Nom local');
  assert(called.every(([type]) => type === 'conciergerie'));
  assert.equal(JSON.stringify(current), before);
  const both = contracts.resetCatalogs(current, initial, () => 0, '2026-10-21');
  assert.equal(both.conciergeries.length, 2);
  assert.equal(both.bureaux[0].cleanerName, 'Nom initial');
});

test('réinitialiser un contrat personnalisé futur utilisé le clôture à sa date de début connue', () => {
  const current = { conciergeries: [site({ id: 'future', startDate: '2027-01-01',
    checklist: [{ titre: 'Entrée', lignes: ['Sol'] }] })] };
  const before = JSON.stringify(current);
  const result = contracts.resetCatalogs(current, {}, () => ({ controls: 1 }), '2026-10-21');
  const saved = result.conciergeries[0];
  assert.equal(saved.status, 'archived');
  assert.equal(saved.startDate, '2027-01-01');
  assert.equal(saved.endDate, '2027-01-01');
  assert.deepEqual(plain(saved.contractHistory), [{ startDate: '2027-01-01', endDate: '2027-01-01' }]);
  assert.equal(saved.checklist[0].lignes[0], 'Sol');
  assert.equal(JSON.stringify(current), before);
});

test('fusionner avec une fin future reprend à la plus tardive des dates de contrats connues', () => {
  const target = contracts.archive(site({ id: 'target', startDate: '2026-01-01' }), '2027-02-01');
  for (const [sourceStart, expected] of [['2027-01-01', '2027-02-01'], ['2027-03-01', '2027-03-01']]) {
    const current = { conciergeries: [target, site({ id: 'source', startDate: sourceStart,
      checklist: [{ titre: 'Source', lignes: ['Porte'] }] })] };
    const before = JSON.stringify(current);
    const result = contracts.mergeCatalogs(current, 'conciergerie', 'target', 'source', '2026-10-21');
    const merged = result.conciergeries[0];
    assert.equal(merged.status, 'active');
    assert.equal(merged.startDate, expected);
    assert.equal(merged.endDate, null);
    assert.deepEqual(plain(merged.contractHistory), [{ startDate: '2026-01-01', endDate: '2027-02-01' }]);
    assert.equal(merged.checklist[0].lignes[0], 'Porte');
    assert.equal(JSON.stringify(current), before);
  }
});
