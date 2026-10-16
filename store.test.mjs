import test from 'node:test';
import assert from 'node:assert/strict';
import { operators, outcomes, STORAGE_KEY, localDay, loadCalls, saveCall, updateCall, stats, toCSV, exportJSON, importJSON } from './store.js';

function memoryStorage(initial = null) {
  const values = new Map(initial === null ? [] : [[STORAGE_KEY, initial]]);
  return {
    writes: 0, failRead: false, failWrite: false,
    getItem(key) { if (this.failRead) throw new Error('blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (this.failWrite) throw new Error('quota'); this.writes += 1; values.set(key, String(value)); }
  };
}

const input = (patch = {}) => ({ operator: 'Chanel', company: 'Gioielleria Test', contact: '', phone: '', outcome: 'Non risponde', channel: '', followup: '', decisionMaker: false, notes: '', ...patch });
const stored = (patch = {}) => ({ id: 'call-1', createdAt: '2026-10-16T10:00:00.000Z', ...input(), ...patch });

test('cataloghi coerenti e registro inizialmente vuoto', () => {
  assert.deepEqual(operators, ['Chanel', 'Andrea']);
  assert.equal(outcomes.length, 7);
  assert.deepEqual(loadCalls(memoryStorage()), []);
});

test('salvataggi leggono lo stato più recente e generano identità distinte', () => {
  const storage = memoryStorage();
  const first = saveCall(input(), storage);
  const second = saveCall(input({ operator: 'Andrea', company: ' Seconda attività ' }), storage);
  assert.notEqual(first.id, second.id);
  assert.equal(second.company, 'Seconda attività');
  assert.ok(Number.isFinite(Date.parse(first.createdAt)));
  assert.deepEqual(loadCalls(storage), [first, second]);
});

test('campi obbligatori e date reali vengono validati senza scritture', () => {
  const storage = memoryStorage();
  for (const patch of [{ company: '  ' }, { operator: 'Altro' }, { outcome: '' }, { outcome: 'Richiamo concordato' }, { outcome: 'Appuntamento' }, { followup: '2026-02-30T10:00' }, { followup: '2026-10-16T25:00' }, { decisionMaker: 'true' }, { channel: 'SMS' }]) {
    assert.throws(() => saveCall(input(patch), storage), { code: 'VALIDATION' });
  }
  assert.equal(storage.writes, 0);
  const saved = saveCall(input({ outcome: 'Appuntamento', followup: '2026-10-17T11:30' }), storage);
  assert.equal(saved.followup, '2026-10-17T11:30');
});

test('giorno locale e statistiche cambiano a mezzanotte, distinti per operatore', () => {
  const before = new Date(2026, 9, 16, 23, 59, 59);
  const after = new Date(2026, 9, 17, 0, 0, 0);
  assert.equal(localDay(before), '2026-10-16');
  assert.equal(localDay(after), '2026-10-17');
  const calls = [
    stored({ id: 'a', createdAt: before.toISOString(), outcome: 'Materiale inviato', decisionMaker: true }),
    stored({ id: 'b', createdAt: before.toISOString(), operator: 'Andrea', outcome: 'Appuntamento', followup: '2026-10-18T10:00', decisionMaker: true }),
    stored({ id: 'c', createdAt: after.toISOString(), outcome: 'Richiamo concordato', followup: '2026-10-18T11:00' })
  ];
  assert.deepEqual(stats(calls, 'Chanel', localDay(before)), { attempts: 1, decisionMakers: 1, materials: 1, appointments: 0, followups: 0 });
  assert.deepEqual(stats(calls, 'Andrea', localDay(before)), { attempts: 1, decisionMakers: 1, materials: 0, appointments: 1, followups: 1 });
  assert.deepEqual(stats(calls, 'Chanel', localDay(after)), { attempts: 1, decisionMakers: 0, materials: 0, appointments: 0, followups: 1 });
  assert.equal(stats(calls, 'Andrea', localDay(after)).attempts, 0);
});

test('errori di scrittura non dichiarano successo né modificano i dati precedenti', () => {
  const storage = memoryStorage();
  const first = saveCall(input(), storage);
  const original = storage.getItem(STORAGE_KEY);
  storage.failWrite = true;
  assert.throws(() => saveCall(input(), storage), { code: 'STORAGE_WRITE' });
  assert.throws(() => updateCall(first.id, { notes: 'nuove' }, storage), { code: 'STORAGE_WRITE' });
  assert.throws(() => importJSON(exportJSON([stored({ id: 'extra' })]), storage), { code: 'STORAGE_WRITE' });
  assert.equal(storage.getItem(STORAGE_KEY), original);
});

test('JSON corrotto e strutture non valide restano intatti anche al salvataggio/importazione', () => {
  for (const raw of ['{broken', '{}', 'null', '[]oops', '[{"id":"a"}]', JSON.stringify([stored(), stored()])]) {
    const storage = memoryStorage(raw);
    assert.throws(() => loadCalls(storage), { code: 'CORRUPT_DATA' });
    assert.throws(() => saveCall(input(), storage), { code: 'CORRUPT_DATA' });
    assert.throws(() => importJSON(exportJSON([stored({ id: 'extra' })]), storage), { code: 'CORRUPT_DATA' });
    assert.equal(storage.getItem(STORAGE_KEY), raw);
    assert.equal(storage.writes, 0);
  }
});

test('errore di lettura presentato come errore del registro locale', () => {
  const storage = memoryStorage();
  storage.failRead = true;
  assert.throws(() => loadCalls(storage), { code: 'STORAGE_READ' });
});

test('modifica conserva identità/data, valida l’esito e non elimina altre chiamate', () => {
  const storage = memoryStorage();
  const first = saveCall(input(), storage);
  const second = saveCall(input({ operator: 'Andrea' }), storage);
  const changed = updateCall(first.id, { outcome: 'Richiamo concordato', followup: '2026-10-18T15:00', notes: ' Appuntamento concordato ' }, storage);
  assert.equal(changed.id, first.id);
  assert.equal(changed.createdAt, first.createdAt);
  assert.equal(changed.notes, 'Appuntamento concordato');
  assert.deepEqual(loadCalls(storage), [changed, second]);
  assert.throws(() => updateCall(first.id, { followup: '' }, storage), { code: 'VALIDATION' });
  assert.throws(() => updateCall(first.id, { id: 'new' }, storage), { code: 'VALIDATION' });
  assert.throws(() => updateCall('missing', { notes: 'x' }, storage), { code: 'NOT_FOUND' });
});

test('CSV italiano con BOM, separatori, escaping e protezione formule', () => {
  const csv = toCSV([stored({ company: '=1+1', contact: '@SUM(A1)', phone: '+390001234', notes: 'Una; nota "citata"\nseconda riga' })]);
  assert.ok(csv.startsWith('\uFEFF"Operatore";"Gioielleria";'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\'@SUM(A1)"'));
  assert.ok(csv.includes('"\'+390001234"'));
  assert.ok(csv.includes('"Una; nota ""citata""\nseconda riga"'));
  for (const unsafe of ['-1+2', '\t=1+1', '  =1+1', '\r@SUM(A1)']) {
    assert.ok(toCSV([stored({ company: unsafe })]).includes('"\''));
  }
});

test('backup JSON round-trip, merge senza sovrascrivere e deduplica', () => {
  const storage = memoryStorage(JSON.stringify([stored({ notes: 'originale' })]));
  const incoming = [stored({ notes: 'non sostituire' }), stored({ id: 'call-2', operator: 'Andrea' })];
  const exported = exportJSON(incoming);
  const envelope = JSON.parse(exported);
  assert.equal(envelope.schema, 'caratura-call-playbook');
  assert.equal(envelope.version, 1);
  const result = importJSON(exported, storage);
  assert.equal(result.imported, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.calls[0].notes, 'originale');
  assert.equal(result.calls[1].operator, 'Andrea');
  const writes = storage.writes;
  assert.deepEqual(importJSON(exported, storage), { calls: result.calls, imported: 0, skipped: 2 });
  assert.equal(storage.writes, writes);
  const blank = memoryStorage();
  assert.deepEqual(importJSON(exportJSON(result.calls), blank).calls, result.calls);
});

test('importazione valida tutte le righe prima di scrivere', () => {
  const storage = memoryStorage(JSON.stringify([stored()]));
  const original = storage.getItem(STORAGE_KEY);
  const good = JSON.parse(exportJSON([stored({ id: 'new' })]));
  const invalid = [
    'not json', JSON.stringify([]), JSON.stringify({ ...good, version: 2 }),
    JSON.stringify({ ...good, schema: 'altro' }),
    JSON.stringify({ ...good, calls: [...good.calls, stored({ id: 'bad', company: '' })] }),
    JSON.stringify({ ...good, calls: [stored({ id: 'bad-date', createdAt: '2026-02-30T10:00:00.000Z' })] }),
    JSON.stringify({ ...good, calls: [stored({ id: 'bad', outcome: 'Appuntamento', followup: '' })] })
  ];
  for (const text of invalid) assert.throws(() => importJSON(text, storage), { code: 'INVALID_IMPORT' });
  assert.equal(storage.getItem(STORAGE_KEY), original);
  assert.equal(storage.writes, 0);
});

test('richiamo completato persiste, si può riaprire e non cambia i contatori', () => {
  const storage = memoryStorage();
  const call = saveCall(input({ outcome: 'Richiamo concordato', followup: '2026-10-18T15:00' }), storage);
  assert.equal(call.followupDone, false);
  const before = stats(loadCalls(storage), 'Chanel');
  const done = updateCall(call.id, { followupDone: true }, storage);
  assert.equal(done.followupDone, true);
  assert.equal(loadCalls(storage)[0].followupDone, true);
  assert.deepEqual(stats(loadCalls(storage), 'Chanel'), before);
  assert.ok(toCSV([done]).includes('"Richiamo completato"'));
  assert.ok(toCSV([done]).includes('"2026-10-18T15:00";"Sì";'));
  assert.equal(JSON.parse(exportJSON([done])).calls[0].followupDone, true);
  assert.equal(updateCall(call.id, { followupDone: false }, storage).followupDone, false);
  assert.throws(() => updateCall(call.id, { followupDone: 'true' }, storage), { code: 'VALIDATION' });
});

test('registri e backup precedenti senza followupDone ricevono il default false', () => {
  const legacy = stored({ outcome: 'Richiamo concordato', followup: '2026-10-18T15:00' });
  assert.equal(Object.hasOwn(legacy, 'followupDone'), false);
  const storage = memoryStorage(JSON.stringify([legacy]));
  assert.equal(loadCalls(storage)[0].followupDone, false);
  assert.equal(storage.writes, 0);
  const legacyBackup = JSON.stringify({ schema: 'caratura-call-playbook', version: 1, calls: [legacy] });
  const imported = importJSON(legacyBackup, memoryStorage());
  assert.equal(imported.calls[0].followupDone, false);
  assert.equal(imported.imported, 1);
});

test('Non interessato non può mantenere una data di richiamo', () => {
  const storage = memoryStorage();
  assert.throws(() => saveCall(input({ outcome: 'Non interessato', followup: '2026-10-18T15:00' }), storage), /Non interessato/);
  assert.equal(storage.writes, 0);
  const call = saveCall(input({ outcome: 'Richiamo concordato', followup: '2026-10-18T15:00' }), storage);
  const previous = storage.getItem(STORAGE_KEY);
  assert.throws(() => updateCall(call.id, { outcome: 'Non interessato' }, storage), /rimuovi la data/);
  assert.equal(storage.getItem(STORAGE_KEY), previous);
  assert.equal(updateCall(call.id, { outcome: 'Non interessato', followup: '' }, storage).followup, '');
});
