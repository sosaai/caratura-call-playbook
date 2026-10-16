import {operators, loadCalls, saveCall, updateCall, stats, localDay, toCSV, exportJSON, importJSON, STORAGE_KEY} from './store.js';

const $ = id => document.getElementById(id);
const PROFILE_KEY = 'caratura.operator.v1';
const CASE_STUDY_URL = 'https://caraturadigitale.com/caso-studio/';
const sections = ['script', 'obiezioni', 'followup', 'registro'];
let calls = [], operator = '', editingId = null, toastTimer, draftDirty = false, saving = false;
try { const saved = localStorage.getItem(PROFILE_KEY); if (operators.includes(saved)) operator = saved; } catch {}
$('operator').value = operator;

function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800);
}
function storageError(error) {
  $('storageError').textContent = error.message;
  $('storageError').hidden = false;
}
function refreshCalls() {
  try { calls = loadCalls(); $('storageError').hidden = true; return true; }
  catch (error) { storageError(error); return false; }
}
function selectPage({focus = false} = {}) {
  const name = location.hash.slice(1);
  const active = sections.includes(name) ? name : 'script';
  document.querySelectorAll('.page').forEach(page => { page.hidden = page.id !== active; });
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  if (focus) { window.scrollTo(0, 0); $('main').focus({preventScroll:true}); }
}
window.addEventListener('hashchange', () => selectPage({focus:true}));
selectPage();

function renderProfile() {
  document.querySelectorAll('[data-operator]').forEach(el => { el.textContent = operator || '[IL TUO NOME]'; });
  $('formOperator').textContent = operator ? `Operatore: ${operator}` : 'Scegli il tuo nome in alto';
  $('todayLabel').textContent = `${operator ? operator + ' · ' : ''}${new Date().toLocaleDateString('it-IT', {day:'numeric', month:'long'})}`;
  updateMessages(); renderStats(); renderHistory();
}
$('operator').addEventListener('change', () => {
  if ((draftDirty && operator) || saving) {
    $('operator').value = operator;
    toast('Salva o scarta la bozza prima di cambiare nome.');
    return;
  }
  operator = $('operator').value;
  try { localStorage.setItem(PROFILE_KEY, operator); } catch { toast('Il nome non verrà ricordato alla riapertura.'); }
  if (editingId) resetForm();
  renderProfile();
});

function renderStats() {
  const values = stats(operator ? calls : [], operator);
  $('callCount').textContent = values.attempts;
  $('callProgress').value = Math.min(values.attempts, 10);
  $('statDecision').textContent = values.decisionMakers;
  $('statMaterials').textContent = values.materials;
  $('statFollowups').textContent = values.followups;
  $('statAppointments').textContent = values.appointments;
}
function dateText(value) {
  return new Date(value).toLocaleString('it-IT', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
}
function updateMessages() {
  const contact = $('messageContact').value.trim();
  const company = $('messageCompany').value.trim() || '[GIOIELLERIA]';
  const name = operator || '[IL TUO NOME]';
  const material = $('messageMaterial').value;
  const personalized = material === 'personalizzato';
  const url = $('messageLink').value.trim() || '[INSERISCI IL LINK]';
  const date = $('messageDate').value;
  const greeting = `Buongiorno${contact ? ' ' + contact : ''}`;
  const appointment = date ? `il ${new Date(date).toLocaleDateString('it-IT', {day:'numeric', month:'long', year:'numeric'})} alle ${new Date(date).toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'})}` : '';
  const waBody = personalized
    ? 'Come promesso, le mando la dimostrazione che abbiamo preparato su un vostro gioiello.'
    : 'Come promesso, le mando un esempio del nostro lavoro con le gioiellerie.';
  const emailBody = personalized
    ? 'Come promesso, le mando la dimostrazione che abbiamo preparato su un vostro gioiello.'
    : 'Come concordato, le invio una piccola dimostrazione del nostro lavoro con le gioiellerie.';
  const exampleLink = material === 'case' ? `\n\n${url === CASE_STUDY_URL ? 'Caso studio Vergottini' : 'Esempio concordato'}:\n${url}` : '';
  $('messageLink').disabled = material !== 'case';
  $('personalizedLabel').hidden = !personalized;
  if (!personalized) $('personalizedConfirmed').checked = false;
  $('waMessage').textContent = `${greeting}, sono ${name}, ci siamo sentiti poco fa.\n\n${waBody}${exampleLink}${appointment ? `\n\nCi sentiamo ${appointment}, come concordato, così mi dice cosa ne pensa.` : ''}\n\n${name} — Caratura Digitale`;
  $('emailSubject').textContent = `Come promesso al telefono — esempio per ${company}`;
  $('emailMessage').textContent = `${greeting},\n\nsono ${name}, ci siamo sentiti poco fa. ${emailBody}${exampleLink}${appointment ? `\n\nCi sentiamo ${appointment} per sapere cosa ne pensa.` : ''}\n\nA presto,\n${name}\nCaratura Digitale`;
  $('openWhatsApp').href = 'https://wa.me/?text=' + encodeURIComponent($('waMessage').textContent);
  $('attachmentHelp').textContent = material === 'case'
    ? 'Il messaggio contiene il caso studio concordato. Scegli tu il destinatario; non inviare un catalogo di servizi.'
    : personalized
      ? 'Allega la dimostrazione effettivamente realizzata sul loro gioiello. Questa opzione non crea né allega immagini. Non definirla personalizzata se è un esempio generico.'
      : `Allega la foto o la dimostrazione promessa. Per la coppia ${material}, prima il prodotto (01), poi il visual (02). Apri in WhatsApp prepara solo il testo: gli allegati vanno aggiunti manualmente.`;
  $('messageError').textContent = '';
}
['messageContact','messageCompany','messageLink','messageDate'].forEach(id => $(id).addEventListener('input', updateMessages));
$('personalizedConfirmed').addEventListener('change', updateMessages);
$('messageMaterial').addEventListener('change', () => {
  document.querySelectorAll('[data-kit]').forEach(kit => { kit.open = kit.dataset.kit === $('messageMaterial').value; });
  updateMessages();
});
document.querySelectorAll('[data-choose-material]').forEach(button => button.addEventListener('click', () => {
  const material = button.dataset.chooseMaterial;
  $('messageMaterial').value = material;
  document.querySelectorAll('[data-kit]').forEach(kit => { kit.open = kit.dataset.kit === material; });
  updateMessages();
  const destination = material === 'case' ? $('messageMaterial') : document.querySelector(`[data-kit="${material}"]`);
  destination.scrollIntoView({block:'start'});
  toast('Messaggio preparato per ' + (material === 'case' ? 'Vergottini' : 'la coppia ' + material));
}));
function requireMessageFields({email = false} = {}) {
  if (!operator) { $('messageError').textContent = 'Scegli il tuo nome in alto per preparare il messaggio.'; $('operator').focus(); return false; }
  if (email && !$('messageCompany').value.trim()) { $('messageError').textContent = 'Inserisci il nome della gioielleria per completare l’oggetto email.'; $('messageCompany').focus(); return false; }
  if ($('messageMaterial').value === 'personalizzato' && !$('personalizedConfirmed').checked) { $('messageError').textContent = 'Conferma che la dimostrazione è stata realizzata su un loro gioiello, oppure scegli un esempio generico.'; $('personalizedConfirmed').focus(); return false; }
  if ($('messageMaterial').value !== 'case') return true;
  try { const url = new URL($('messageLink').value.trim()); if (!['http:','https:'].includes(url.protocol)) throw new Error(); }
  catch { $('messageError').textContent = 'Inserisci il link completo all’esempio (https://…) prima di continuare.'; $('messageLink').focus(); return false; }
  return true;
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Testo copiato'); }
  catch {
    $('copyText').value = text;
    $('copyDialog').showModal(); $('copyText').focus(); $('copyText').select();
  }
}
document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.message && !requireMessageFields({email:button.dataset.email === 'true'})) return;
  const text = $(button.dataset.copy).innerText.trim();
  if (!operator && /\[IL TUO NOME\]/.test(text)) { toast('Scegli Chanel o Andrea in alto per personalizzare il testo.'); $('operator').focus(); return; }
  copyText((button.dataset.email ? 'Oggetto: ' + $('emailSubject').textContent + '\n\n' : '') + text);
}));
$('openWhatsApp').addEventListener('click', event => { if (!requireMessageFields()) event.preventDefault(); });
$('copyCaseStudy').addEventListener('click', () => copyText(CASE_STUDY_URL));

// Each kit is prepared independently before a tap, keeping native sharing in the user gesture.
const photoKits = {
  inverno: ['01-inverno-gioielli.jpg', '02-inverno-indossato.jpg'],
  smeraldo: ['01-smeraldo-gioiello.jpg', '02-smeraldo-pitone.jpg']
};
const photoFiles = {};
const nativeFileSharing = typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
if (!nativeFileSharing) {
  $('shareHelp').textContent = 'Questo browser non supporta la condivisione diretta dei file. Scarica i JPG o lo ZIP della coppia scelta e allega le immagini al messaggio. Da un telefono compatibile puoi usare “Condividi”.';
}
Object.entries(photoKits).forEach(([key, names]) => {
  const buttons = [...document.querySelectorAll(`[data-share-kit="${key}"]`)];
  const status = $('status-' + key);
  if (nativeFileSharing) {
    buttons.forEach(button => { button.disabled = true; });
    Promise.all(names.map(async name => {
      const response = await fetch(new URL('./assets/' + name, import.meta.url), {signal: AbortSignal.timeout(20000)});
      if (!response.ok) throw new Error('Foto non disponibile');
      return new File([await response.blob()], name, {type:'image/jpeg'});
    })).then(files => { photoFiles[key] = files; })
      .catch(() => { status.textContent = 'Condivisione non pronta. Usa Scarica JPG o lo ZIP della coppia, oppure ricarica la pagina.'; })
      .finally(() => { buttons.forEach(button => { button.disabled = false; }); });
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    const kit = photoFiles[key] || [];
    const files = button.dataset.shareFiles === 'all' ? kit : [kit[Number(button.dataset.shareFiles)]].filter(Boolean);
    try {
      if (!nativeFileSharing || !files.length || !navigator.canShare({files})) {
        status.textContent = 'Condivisione diretta non disponibile qui. Scarica i JPG o lo ZIP di questa coppia e allegali al messaggio.';
        $('download-' + key).focus(); return;
      }
      // The user chooses an app and a recipient; no automatic send.
      navigator.share({files}).then(() => { status.textContent = 'Foto passate al menu di condivisione del dispositivo.'; })
        .catch(error => { status.textContent = error.name === 'AbortError' ? 'Condivisione annullata.' : 'Non è stato possibile aprire la condivisione. Scarica le foto e allegale al messaggio.'; });
    } catch { status.textContent = 'Condivisione non disponibile. Usa Scarica JPG o lo ZIP di questa coppia.'; }
  }));
});

$('objectionSearch').addEventListener('input', () => {
  const query = $('objectionSearch').value.trim().toLocaleLowerCase('it'); let count = 0;
  document.querySelectorAll('.objection').forEach(item => {
    item.hidden = !item.textContent.toLocaleLowerCase('it').includes(query);
    if (!item.hidden) count++;
  });
  $('noObjections').hidden = count > 0;
});

function resetForm() {
  draftDirty = false;
  editingId = null; $('callForm').reset(); $('formTitle').textContent = 'Registra una chiamata';
  $('saveCall').textContent = 'Salva chiamata ＋'; $('cancelEdit').hidden = true;
  $('formError').textContent = ''; $('savedMessage').textContent = '';
  syncOutcome();
}
function syncOutcome() {
  const outcome = $('outcome').value;
  $('followupDate').required = ['Richiamo concordato','Appuntamento'].includes(outcome);
  $('followupDate').disabled = outcome === 'Non interessato';
  if (outcome === 'Non interessato') $('followupDate').value = '';
}
$('outcome').addEventListener('change', syncOutcome);
$('cancelEdit').addEventListener('click', () => {
  if (draftDirty && !confirm('Scartare i campi non salvati? Le chiamate già nel registro restano conservate.')) return;
  resetForm();
});
function markDraft() {
  draftDirty = true;
  $('cancelEdit').hidden = false;
  $('cancelEdit').textContent = editingId ? 'Annulla modifica' : 'Scarta bozza';
}
$('callForm').addEventListener('input', markDraft);
$('callForm').addEventListener('change', markDraft);
window.addEventListener('beforeunload', event => { if (draftDirty) { event.preventDefault(); event.returnValue = ''; } });
async function writeSafely(action) {
  if (!navigator.locks?.request) throw new Error('Il registro richiede un browser aggiornato. Apri il link in una versione recente di Safari, Chrome o Firefox.');
  return navigator.locks.request('caratura-call-log-write', action);
}
$('callForm').addEventListener('submit', async event => {
  event.preventDefault(); $('formError').textContent = ''; $('savedMessage').textContent = '';
  if (saving) return;
  const record = {
    operator, company: $('company').value.trim(), contact: $('contact').value.trim(), phone: $('phone').value.trim(),
    outcome: $('outcome').value, channel: $('channel').value, followup: $('followupDate').value,
    decisionMaker: $('decisionMaker').checked, notes: $('notes').value.trim()
  };
  try {
    if (!operator) { $('operator').focus(); throw new Error('Scegli Chanel o Andrea in alto prima di salvare.'); }
    if (!record.company) { $('company').focus(); throw new Error('Inserisci il nome della gioielleria.'); }
    if (!record.outcome) { $('outcome').focus(); throw new Error('Scegli l’esito della chiamata.'); }
    if (['Richiamo concordato','Appuntamento'].includes(record.outcome) && !record.followup) {
      $('followupDate').focus(); throw new Error('Indica la data e l’ora concordate per il prossimo contatto.');
    }
    const wasEditing = Boolean(editingId), idToEdit = editingId;
    saving = true; $('saveCall').disabled = true;
    await writeSafely(() => {
      if (idToEdit) {
        const previous = loadCalls().find(call => call.id === idToEdit);
        if (!previous || previous.operator !== record.operator) throw new Error('Il nome selezionato non corrisponde alla chiamata da modificare.');
        if (previous.followup !== record.followup) record.followupDone = false;
        updateCall(idToEdit, record);
      } else saveCall(record);
    });
    refreshCalls(); resetForm(); renderStats(); renderHistory();
    $('savedMessage').textContent = wasEditing ? 'Modifica salvata. Il numero di tentativi non cambia.' : 'Chiamata salvata su questo browser.';
    toast(wasEditing ? 'Chiamata aggiornata' : 'Chiamata salvata');
  } catch (error) { $('formError').textContent = error.message; }
  finally { saving = false; $('saveCall').disabled = false; }
});

function element(tag, className, text) {
  const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el;
}
function editCall(call) {
  if (draftDirty || saving) { toast('Salva o scarta la bozza prima di aprire un’altra chiamata.'); return; }
  editingId = call.id;
  for (const key of ['company','contact','phone','outcome','channel','notes']) $(key).value = call[key];
  $('followupDate').value = call.followup; $('decisionMaker').checked = call.decisionMaker;
  $('formTitle').textContent = 'Modifica la chiamata'; $('saveCall').textContent = 'Salva modifica';
  $('cancelEdit').hidden = false; $('cancelEdit').textContent = 'Annulla modifica'; $('formError').textContent = ''; $('savedMessage').textContent = '';
  syncOutcome(); $('callForm').scrollIntoView({block:'start'}); $('company').focus({preventScroll:true});
}
function renderHistory() {
  const container = $('historyList'); container.replaceChildren();
  const mode = $('historyFilter').value;
  $('historyHelp').textContent = mode === 'due' ? 'Richiami e appuntamenti ancora da completare, anche futuri. Dopo il contatto, segna “Completato” e registra la nuova chiamata.' : mode === 'all' ? 'Tutte le chiamate di questo operatore salvate sul browser.' : 'Le chiamate salvate oggi.';
  if (!operator) { $('historyCount').textContent = 'Scegli il tuo nome'; container.append(element('p','empty-state','Scegli Chanel o Andrea in alto per aprire il tuo registro.')); return; }
  const query = $('historySearch').value.trim().toLocaleLowerCase('it');
  const selected = calls.filter(call => call.operator === operator &&
    (mode === 'all' || (mode === 'today' && localDay(call.createdAt) === localDay()) || (mode === 'due' && call.followup && !call.followupDone && call.outcome !== 'Non interessato')) &&
    `${call.company} ${call.contact} ${call.phone}`.toLocaleLowerCase('it').includes(query));
  selected.sort((a,b) => mode === 'due' ? a.followup.localeCompare(b.followup) : b.createdAt.localeCompare(a.createdAt));
  $('historyCount').textContent = `${selected.length} ${selected.length === 1 ? 'chiamata' : 'chiamate'}`;
  if (!selected.length) {
    const empty = element('div','empty-state', query ? 'Nessuna chiamata corrisponde alla ricerca.' : mode === 'due' ? 'Nessun richiamo da completare.' : 'Il registro è pronto per la prima chiamata.');
    if (!query && mode !== 'due') {
      const action = element('button','edit-entry','Registra una chiamata ↑'); action.type = 'button';
      action.addEventListener('click', () => { $('company').focus(); }); empty.append(action);
    }
    container.append(empty); return;
  }
  for (const call of selected) {
    const entry = element('article','log-entry'); const top = element('div','entry-top');
    top.append(element('h3','',call.company), element('span','',dateText(call.createdAt))); entry.append(top);
    if (call.contact || call.phone) entry.append(element('p','entry-meta',[call.contact,call.phone].filter(Boolean).join(' · ')));
    entry.append(element('span','badge' + (call.outcome === 'Non interessato' ? ' stop' : ''),call.outcome));
    if (call.followup) entry.append(element('p','followup-label',`${call.followupDone ? '✓ Completato' : new Date(call.followup) < new Date() ? 'Da recuperare' : 'Prossimo contatto'} · ${dateText(call.followup)}`));
    if (call.channel || call.decisionMaker) entry.append(element('p','entry-meta',[call.channel ? `Canale: ${call.channel}` : '', call.decisionMaker ? 'Decisore raggiunto' : ''].filter(Boolean).join(' · ')));
    if (call.notes) entry.append(element('p','entry-notes',call.notes));
    const actions = element('div','entry-actions'); const edit = element('button','edit-entry','Modifica'); edit.type = 'button'; edit.setAttribute('aria-label',`Modifica chiamata a ${call.company}`); edit.addEventListener('click', () => editCall(call)); actions.append(edit);
    if (call.followup) {
      const done = element('button','complete-followup',call.followupDone ? 'Riapri richiamo' : 'Segna completato'); done.type = 'button';
      done.addEventListener('click', async () => {
        done.disabled = true;
        try { await writeSafely(() => updateCall(call.id,{followupDone:!call.followupDone})); refreshCalls(); renderHistory(); toast(call.followupDone ? 'Richiamo riaperto' : 'Richiamo completato. Registra il nuovo esito.'); }
        catch (error) { storageError(error); done.disabled = false; }
      }); actions.append(done);
    }
    entry.append(actions); container.append(entry);
  }
}
['historyFilter','historySearch'].forEach(id => $(id).addEventListener(id === 'historyFilter' ? 'change' : 'input', renderHistory));

function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text],{type}));
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),30000);
}
function exportRecords(format) {
  try {
    if (!operator) throw new Error('Scegli il tuo nome in alto prima di esportare.');
    if (!refreshCalls()) throw new Error('Esportazione sospesa: il registro locale non è leggibile.');
    const selected = calls.filter(call => call.operator === operator);
    if (!selected.length) throw new Error('Il tuo registro è vuoto. Salva una chiamata prima di esportare.');
    download(format === 'csv' ? toCSV(selected) : exportJSON(selected), `caratura-${operator.toLowerCase()}-${localDay()}.${format}`, format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json');
    $('exportStatus').textContent = `Download avviato: ${selected.length} chiamate di ${operator}. Conserva il file in un posto sicuro.`;
  } catch (error) { $('exportStatus').textContent = error.message; }
}
$('exportCsv').addEventListener('click', () => exportRecords('csv'));
$('exportJson').addEventListener('click', () => exportRecords('json'));
$('importJson').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async () => {
  const file = $('importFile').files[0]; if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('Il file supera 5 MB. Importa una copia più piccola.');
    const text = await file.text();
    const result = await writeSafely(() => importJSON(text)); refreshCalls(); renderStats(); renderHistory();
    $('exportStatus').textContent = `Importazione completata: ${result.imported} aggiunte, ${result.skipped} già presenti. I dati esistenti sono stati conservati. Scegli il nome corrispondente per visualizzarli.`;
    toast('Copia importata');
  } catch (error) { $('exportStatus').textContent = error.message; }
  finally { $('importFile').value = ''; }
});

window.addEventListener('storage', event => { if (event.key === STORAGE_KEY || event.key === null) { refreshCalls(); renderStats(); renderHistory(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshCalls(); renderProfile(); } });
setInterval(() => { renderStats(); renderHistory(); $('todayLabel').textContent = `${operator ? operator + ' · ' : ''}${new Date().toLocaleDateString('it-IT',{day:'numeric',month:'long'})}`; }, 60000);
refreshCalls(); renderProfile(); syncOutcome();
