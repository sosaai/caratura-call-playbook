// Registro locale: nessun dato viene inviato a un server.
export const operators = Object.freeze(['Chanel', 'Andrea']);
export const outcomes = Object.freeze([
  'Non risponde', 'Decisore assente', 'Richiamo concordato',
  'Invio autorizzato', 'Materiale inviato', 'Appuntamento', 'Non interessato'
]);

export const STORAGE_KEY = 'caratura.callLog.v1';
const SCHEMA = 'caratura-call-playbook';
const VERSION = 1;
const channels = ['', 'WhatsApp', 'Email'];
const editableFields = ['operator', 'company', 'contact', 'phone', 'outcome', 'channel', 'followup', 'followupDone', 'decisionMaker', 'notes'];

function fail(message, code = 'VALIDATION') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getStorage(storage) {
  try {
    const resolved = storage === undefined ? globalThis.localStorage : storage;
    if (!resolved || typeof resolved.getItem !== 'function' || typeof resolved.setItem !== 'function') throw new Error();
    return resolved;
  } catch {
    throw fail('Il salvataggio locale non è disponibile in questo browser. Nessun dato è stato modificato.', 'STORAGE_UNAVAILABLE');
  }
}

function readText(storage) {
  try { return storage.getItem(STORAGE_KEY); }
  catch { throw fail('Non riesco a leggere il registro locale. Verifica le impostazioni del browser; nessun dato è stato modificato.', 'STORAGE_READ'); }
}

function writeCalls(storage, calls) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(calls)); }
  catch { throw fail('Salvataggio non riuscito: memoria piena o accesso bloccato. La modifica non è stata salvata; conserva i dati inseriti e riprova.', 'STORAGE_WRITE'); }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function field(record, name, label, required = false) {
  const value = record[name];
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') throw fail(`${label}: inserisci un testo valido.`);
  const result = value.trim();
  if (required && !result) throw fail(`${label}: campo obbligatorio.`);
  return result;
}

function validFollowup(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
  const second = Number(match[6] ?? 0);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return false;
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, second, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date.getHours() === hour && date.getMinutes() === minute;
}

function validateFields(record) {
  if (!isObject(record)) throw fail('La chiamata deve contenere dati validi.');
  const result = {
    operator: field(record, 'operator', 'Operatore', true),
    company: field(record, 'company', 'Gioielleria', true),
    contact: field(record, 'contact', 'Referente'),
    phone: field(record, 'phone', 'Telefono'),
    outcome: field(record, 'outcome', 'Esito', true),
    channel: field(record, 'channel', 'Canale'),
    followup: field(record, 'followup', 'Richiamo'),
    followupDone: record.followupDone === undefined ? false : record.followupDone,
    decisionMaker: record.decisionMaker === undefined ? false : record.decisionMaker,
    notes: field(record, 'notes', 'Note')
  };
  if (!operators.includes(result.operator)) throw fail('Scegli Chanel oppure Andrea come operatore.');
  if (!outcomes.includes(result.outcome)) throw fail('Scegli uno degli esiti disponibili.');
  if (!channels.includes(result.channel)) throw fail('Il canale deve essere WhatsApp, Email oppure non indicato.');
  if (typeof result.followupDone !== 'boolean') throw fail('Indica correttamente se il richiamo è stato completato.');
  if (typeof result.decisionMaker !== 'boolean') throw fail('Indica correttamente se hai parlato con il decisore.');
  if (result.outcome === 'Non interessato' && result.followup) throw fail('Per una chiamata con esito “Non interessato” non è previsto un richiamo: rimuovi la data prima di salvare.');
  if (['Richiamo concordato', 'Appuntamento'].includes(result.outcome) && !result.followup) throw fail('Per questo esito devi indicare giorno e ora concordati.');
  if (result.followup && !validFollowup(result.followup)) throw fail('Inserisci una data e un’ora valide per il richiamo.');
  return result;
}

function validateStoredCall(record) {
  const fields = validateFields(record);
  const id = field(record, 'id', 'Identificativo chiamata', true);
  if (id.length > 200 || /[\u0000-\u001f\u007f]/.test(id)) throw fail('Identificativo chiamata non valido.');
  const createdAt = field(record, 'createdAt', 'Data di registrazione', true);
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(createdAt);
  if (!parts || !Number.isFinite(Date.parse(createdAt))) throw fail('Data di registrazione non valida.');
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > lastDay || hour > 23 || minute > 59 || second > 59) throw fail('Data di registrazione non valida.');
  return { id, createdAt: new Date(createdAt).toISOString(), ...fields };
}

function validateList(value, allowDuplicates = false) {
  if (!Array.isArray(value)) throw fail('Il registro deve contenere un elenco di chiamate.');
  const calls = value.map(validateStoredCall);
  if (!allowDuplicates && new Set(calls.map(call => call.id)).size !== calls.length) throw fail('Il registro contiene identificativi duplicati.');
  return calls;
}

export function localDay(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(value.getTime())) throw fail('Data non valida.');
  return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function loadCalls(storage) {
  const raw = readText(getStorage(storage));
  if (raw === null || raw === undefined) return [];
  try { return validateList(JSON.parse(raw)); }
  catch { throw fail('Il registro locale non è leggibile o contiene dati non validi. I dati originali sono ancora conservati: non azzerare il browser e chiedi assistenza.', 'CORRUPT_DATA'); }
}

function newId(existing) {
  let id;
  do {
    id = globalThis.crypto?.randomUUID?.() || `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  } while (existing.some(call => call.id === id));
  return id;
}

export function saveCall(record, storage) {
  const fields = validateFields(record);
  const target = getStorage(storage);
  const calls = loadCalls(target);
  const saved = { id: newId(calls), createdAt: new Date().toISOString(), ...fields };
  writeCalls(target, [...calls, saved]);
  return saved;
}

export function updateCall(id, patch, storage) {
  if (!isObject(patch)) throw fail('La modifica della chiamata non è valida.');
  if (Object.keys(patch).some(key => !editableFields.includes(key))) throw fail('Puoi modificare solo i dettagli della chiamata, non il suo identificativo o la data di registrazione.');
  const target = getStorage(storage);
  const calls = loadCalls(target);
  const index = calls.findIndex(call => call.id === id);
  if (index < 0) throw fail('Chiamata non trovata nel registro. Ricarica l’elenco e riprova.', 'NOT_FOUND');
  const updated = { id: calls[index].id, createdAt: calls[index].createdAt, ...validateFields({ ...calls[index], ...patch }) };
  calls[index] = updated;
  writeCalls(target, calls);
  return updated;
}

export function stats(calls, operator, day = localDay()) {
  const selected = calls.filter(call => (!operator || call.operator === operator) && localDay(call.createdAt) === day);
  return {
    attempts: selected.length,
    decisionMakers: selected.filter(call => call.decisionMaker).length,
    materials: selected.filter(call => call.outcome === 'Materiale inviato').length,
    appointments: selected.filter(call => call.outcome === 'Appuntamento').length,
    followups: selected.filter(call => Boolean(call.followup)).length
  };
}

function csvCell(value) {
  let text = String(value ?? '');
  // Le virgolette CSV da sole non impediscono l'esecuzione di formule nei fogli.
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCSV(calls) {
  const validated = validateList(calls);
  const headers = ['Operatore', 'Gioielleria', 'Referente', 'Telefono', 'Esito', 'Canale autorizzato', 'Richiamo o appuntamento', 'Richiamo completato', 'Decisore raggiunto', 'Note', 'Registrata il', 'ID'];
  const rows = validated.map(call => [call.operator, call.company, call.contact, call.phone, call.outcome, call.channel, call.followup, call.followupDone ? 'Sì' : 'No', call.decisionMaker ? 'Sì' : 'No', call.notes, call.createdAt, call.id]);
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

export function exportJSON(calls) {
  return JSON.stringify({ schema: SCHEMA, version: VERSION, exportedAt: new Date().toISOString(), calls: validateList(calls) }, null, 2);
}

export function importJSON(text, storage) {
  let incoming;
  try {
    if (typeof text !== 'string') throw new Error();
    const parsed = JSON.parse(text);
    if (!isObject(parsed) || parsed.schema !== SCHEMA || parsed.version !== VERSION) throw new Error();
    incoming = validateList(parsed.calls, true);
  } catch { throw fail('Il file non è un backup valido di Caratura Digitale (versione 1). Nessun dato è stato modificato.', 'INVALID_IMPORT'); }
  const target = getStorage(storage);
  const calls = loadCalls(target);
  const ids = new Set(calls.map(call => call.id));
  let imported = 0;
  let skipped = 0;
  for (const call of incoming) {
    if (ids.has(call.id)) { skipped += 1; continue; }
    calls.push(call);
    ids.add(call.id);
    imported += 1;
  }
  if (imported) writeCalls(target, calls);
  return { calls, imported, skipped };
}
