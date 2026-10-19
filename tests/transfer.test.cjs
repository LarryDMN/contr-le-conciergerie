/* Scénarios métiers exécutables sans navigateur : node --test tests/transfer.test.cjs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sandbox = { window: {}, Map };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'transfer.js'), 'utf8'), sandbox);
const transfer = sandbox.window.CONTROL_TRANSFER;
// Les résultats traversent la frontière du contexte VM ; comparer leurs valeurs JSON.
const plain = value => JSON.parse(JSON.stringify(value));
const site = (id, nom = id) => ({ id, nom, adresse: 'Rue de test', concierge: '' });
const visit = (id, date, type = 'conciergerie', extra = {}) => ({ id, date, type, ...extra });

test('dates françaises strictes, calendrier et années bissextiles', () => {
  assert.equal(transfer.parseDate(' 29/02/2024 '), '2024-02-29');
  assert.equal(transfer.parseDate(''), null);
  assert.equal(transfer.parseDate('   '), null);
  assert.equal(transfer.formatDate('2026-10-19'), '19/10/2026');
  assert.equal(transfer.formatDate(null), '');
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '2026-1-01', null]) {
    assert.equal(transfer.validDate(value), false);
  }
  assert.equal(transfer.validDate('2000-02-29'), true);
  assert.equal(transfer.validDate('1900-02-29'), false);
  for (const value of ['31/04/2026', '29/02/2026', '2026-10-19', '1/10/2026', '19/10/26', '01/01/0000', null]) {
    assert.throws(() => transfer.parseDate(value), /date|format/);
  }
  assert.throws(() => transfer.formatDate('2026-04-31'), /Date invalide/);
});

test('raccourcis calendaires, fin incluse et trois mois traversant une année', () => {
  assert.deepEqual(plain(transfer.period('all', '2026-10-19')), { from: null, to: null });
  assert.deepEqual(plain(transfer.period('month', '2024-02-19')), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(plain(transfer.period('last3', '2026-01-19')), { from: '2025-11-01', to: '2026-01-31' });
  assert.deepEqual(plain(transfer.period('last3', '2026-10-19')), { from: '2026-08-01', to: '2026-10-31' });
  assert.deepEqual(plain(transfer.period('year', '2026-10-19')), { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(plain(transfer.period('previous-year', '2026-10-19')), { from: '2025-01-01', to: '2025-12-31' });
  assert.throws(() => transfer.period('month', '2026-02-30'), /référence/);
  assert.throws(() => transfer.period('unknown', '2026-10-19'), /inconnu/);
});

test('filtrage sur la visite, frontières incluses, deux sections séparées et sélection conservée', () => {
  const records = [visit('before', '2026-09-30'), visit('first', '2026-10-01'),
    visit('last', '2026-10-31', 'conciergerie', { updatedAt: '2026-11-01' }),
    visit('office', '2026-10-31', 'bureaux'), visit('after', '2026-11-01')];
  const period = { ...transfer.period('month', '2026-10-19'), type: 'conciergerie' };
  assert.deepEqual(plain(transfer.filter(records, period)).map(record => record.id), ['first', 'last']);
  assert.equal(transfer.filter(records, { ...period, type: 'both' }).length, 3);
  assert.equal(transfer.filter(records, { ...period, type: 'bureaux' })[0].id, 'office');
  assert.deepEqual(plain(transfer.filter(new Map([['last', records[2]]]), period)).map(record => record.id), ['last']);
  assert.equal(records.length, 5);
  assert.equal(transfer.filter(records).length, 5);
});

test('périodes vides et ouvertes, anciens contrôles sans type', () => {
  const legacy = { id: 'legacy', date: '2026-10-19' };
  assert.equal(transfer.filter([legacy], { type: 'conciergerie' }).length, 1);
  assert.equal(transfer.filter([legacy], { type: 'bureaux' }).length, 0);
  assert.equal(transfer.filter([legacy], { from: '2027-01-01' }).length, 0);
  assert.equal(transfer.filter([legacy], { to: '2026-10-19' }).length, 1);
  assert.equal(transfer.filter([legacy], { from: '2026-10-19' }).length, 1);
  assert.equal(transfer.filter([]).length, 0);
  assert.throws(() => transfer.filter([legacy], { from: '2026-11-01', to: '2026-10-01' }), /précéder/);
  assert.throws(() => transfer.filter([legacy], { from: '19/10/2026' }), /Période/);
  assert.throws(() => transfer.filter([legacy], { type: 'unknown' }), /Section/);
});

test('noms de fichier lisibles pour toutes les périodes et sections', () => {
  assert.equal(transfer.filename({ from: '2026-01-01', to: '2026-10-19', type: 'conciergerie' }),
    'export_2026-01-01_au_2026-10-19_conciergerie.json');
  assert.equal(transfer.filename(), 'export_tout_les-deux.json');
  assert.equal(transfer.filename({ from: '2026-01-01', type: 'bureaux' }), 'export_depuis_2026-01-01_bureaux.json');
  assert.equal(transfer.filename({ to: '2026-10-19' }), 'export_jusqu-au_2026-10-19_les-deux.json');
});

test('catalogues limités aux sites utilisés, avec anomalies et archives orphelines', () => {
  const sources = { conciergerie: [site('used'), site('unused'), site('orphan')], bureaux: [] };
  const records = [visit('control', '2026-10-19', 'conciergerie', { buildingId: 'used' })];
  const owners = [{ controlId: 'deleted', type: 'conciergerie', buildingId: 'orphan' }];
  const exported = transfer.catalogs(records, owners, sources);
  assert.deepEqual(plain(exported.conciergeries).map(entry => entry.id), ['used', 'orphan']);
  assert.equal(exported.bureaux.length, 0);
  assert.deepEqual(plain(transfer.catalogs([], [], sources)), { conciergeries: [], bureaux: [] });
  assert.equal(sources.conciergerie.length, 3);
});

test('clichés historiques dédupliqués sans modifier les contrôles, IDs stables', () => {
  const records = [visit('new', '2026-10-19', 'conciergerie', { buildingName: 'Ancien immeuble', address: 'Rue 1', concierge: 'Alice' }),
    visit('old', '2026-01-01', 'conciergerie', { buildingName: 'Ancien immeuble', address: 'Rue 1', concierge: 'Bob' }),
    visit('other', '2026-10-19', 'conciergerie', { buildingName: 'Ancien immeuble', address: 'Rue 2' })];
  const before = JSON.stringify(records);
  const first = plain(transfer.catalogs(records));
  const second = plain(transfer.catalogs([...records].reverse()));
  assert.deepEqual(first, second);
  assert.equal(first.conciergeries.length, 2);
  assert.equal(first.conciergeries.find(entry => entry.adresse === 'Rue 1').concierge, 'Alice');
  assert.match(first.conciergeries[0].id, /^historique-conciergerie-[a-f0-9]+$/);
  assert.equal(JSON.stringify(records), before);
});

test('un ID historique synthétique ne heurte pas un ID de catalogue', () => {
  const record = visit('old', '2026-10-19', 'conciergerie', { buildingName: 'Ancien', address: 'Rue' });
  const initial = transfer.catalogs([record]).conciergeries[0];
  const result = transfer.catalogs([record], [], { conciergerie: [site(initial.id)] });
  assert.equal(result.conciergeries[0].id, `${initial.id}-2`);
});

test('export et import répétés conservent le catalogue historique sans doublon', () => {
  const record = visit('legacy', '2026-10-19', 'conciergerie', {
    buildingName: 'Ancien immeuble', address: 'Rue historique', concierge: 'Alice'
  });
  const before = JSON.stringify(record);
  const initial = transfer.catalogs([record]);
  // Même avec une collision préalable, le suffixe restauré reste stable.
  for (const source of [{}, { conciergerie: [site(initial.conciergeries[0].id)] }]) {
    const first = transfer.catalogs([record], [], source);
    const restored = transfer.validateCatalogs(first);
    const persistedSource = { conciergerie: [...(source.conciergerie || []), ...restored.conciergeries], bureaux: restored.bureaux };
    const second = transfer.catalogs([record], [], persistedSource);
    const third = transfer.catalogs([record], [], persistedSource);
    assert.deepEqual(plain(second), plain(first));
    assert.deepEqual(plain(third), plain(first));
    assert.equal(second.conciergeries.length, 1);
  }
  assert.equal(JSON.stringify(record), before);
  assert.equal(Object.hasOwn(record, 'buildingId'), false);
});

test('un brouillon sans site reste exportable sans inventer de catalogue', () => {
  const records = [visit('draft', '2026-10-19', 'conciergerie', { buildingId: null, buildingName: '', address: '' }),
    visit('office-draft', '2026-10-19', 'bureaux', { buildingId: null, buildingName: ' ', address: '' })];
  assert.equal(transfer.filter(records).length, 2);
  assert.deepEqual(plain(transfer.catalogs(records)), { conciergeries: [], bureaux: [] });
});

test('bureaux : checklist du catalogue ou des zones historiques sans téléphone', () => {
  const office = { ...site('office'), checklist: [{ titre: 'Zone A', lignes: [{ libelle: 'Sol', frequence: '5x/sem' }] }] };
  const record = visit('current', '2026-10-19', 'bureaux', { buildingId: 'office' });
  assert.deepEqual(plain(transfer.catalogs([record], [], { bureaux: [office] }).bureaux), [office]);
  const legacy = visit('removed', '2026-10-19', 'bureaux', { buildingId: 'removed', buildingName: 'Bureau retiré', address: '',
    officeSections: [{ id: 'zone', title: 'Zone historique', groups: [{ id: 'group', title: '',
      items: [{ id: 'line', label: 'Sol historique', frequency: '1x/sem' }] }] }] });
  assert.deepEqual(plain(transfer.catalogs([legacy]).bureaux[0].checklist),
    [{ titre: 'Zone historique', lignes: [{ libelle: 'Sol historique', frequence: '1x/sem' }] }]);
  assert.equal(Object.hasOwn(transfer.catalogs([legacy]).bureaux[0], 'telephone'), false);
  assert.deepEqual(plain(transfer.catalogs([visit('pending', '2026-10-19', 'bureaux', { buildingId: 'pending' })]).bureaux[0].checklist), []);
});

test('validation atomique des catalogues partiels et anciens exports sans catalogue', () => {
  assert.deepEqual(plain(transfer.validateCatalogs(undefined)), { conciergeries: [], bureaux: [] });
  assert.deepEqual(plain(transfer.validateCatalogs({ conciergeries: [site('one')] })), { conciergeries: [site('one')], bureaux: [] });
  assert.deepEqual(plain(transfer.validateCatalogs({ conciergerie: [site('one')] })), { conciergeries: [site('one')], bureaux: [] });
  const validOffice = { ...site('one'), checklist: [] };
  assert.equal(transfer.validateCatalogs({ conciergeries: [site('one')], bureaux: [validOffice] }).bureaux.length, 1);
  const source = { conciergeries: [site('one'), site('one')] };
  const before = JSON.stringify(source);
  assert.throws(() => transfer.validateCatalogs(source), /répété/);
  assert.equal(JSON.stringify(source), before);
  for (const payload of [null, [], { conciergeries: null }, { bureaux: null }, { conciergeries: 'invalid' },
    { conciergeries: [site('one'), { ...site('two'), concierge: null }] },
    { bureaux: [{ ...site('one'), checklist: [{ titre: '', lignes: [] }] }] },
    { bureaux: [{ ...site('one'), checklist: [{ titre: 'Zone', lignes: [{ libelle: 'Sol', frequence: 5 }] }] }] },
    { conciergeries: [{ ...site('one'), telephone: '123' }] },
    { conciergeries: [{ ...site('one'), telephoneNumber: '123' }] },
    { bureaux: [{ ...site('one'), phone: '123', checklist: [] }] },
    { conciergerie: [], conciergeries: [] }]) {
    assert.throws(() => transfer.validateCatalogs(payload));
  }
});
