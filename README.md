# Caratura Digitale · Manuale chiamate

Manuale operativo per Chanel e Andrea, dedicato al primo contatto con le gioiellerie.

Obiettivo: ottenere il permesso di inviare un esempio e concordare il prossimo contatto. Le quattro sezioni sono chiamata, obiezioni, follow-up e registro.

## Uso

1. Scegli Chanel o Andrea dal menu in alto.
2. Prima della chiamata prepara un esempio pertinente e i recapiti dell’attività.
3. Usa lo script e concorda sia l’invio sia l’eventuale richiamo.
4. Registra l’esito. Per richiami e appuntamenti indica data e ora.
5. A fine sessione scarica CSV e copia JSON dal registro.

Il follow-up include già il caso studio [Vergottini](https://caraturadigitale.com/caso-studio/) e due foto dell’esempio creativo smeraldo, nell’ordine: gioiello su fondo bianco, visual con modella e pitone. Sono i visual già pubblicati sul sito Caratura Digitale, convertiti in JPG senza ritagli o modifiche creative. Sono disponibili download individuali, ZIP e condivisione file nativa sui browser compatibili. Il pulsante WhatsApp apre un messaggio precompilato; destinatario e invio restano manuali, le foto vanno allegate separatamente.

Il campo link è precompilato con il caso studio e può essere cambiato. Non inviare il manuale ai potenziali clienti.

## Dati e accesso

Il sito è pubblico, con richiesta di non indicizzazione. Non è protetto da login: i nomi operatore sono filtri, non account autenticati.

Il registro e il nome scelto vengono conservati esclusivamente nel browser tramite localStorage. Non esiste una sincronizzazione tra dispositivi né un invio automatico di messaggi. Scegliere un altro nome sullo stesso browser permette di consultare il relativo registro locale. La cancellazione dei dati del browser comporta la perdita dei dati, perciò è disponibile l’esportazione JSON e CSV. Non usare la navigazione privata per un registro da conservare.

Il contatore misura i record salvati nel giorno locale. Le altre metriche si basano sull’esito corrente della chiamata; modificarlo può cambiare il relativo indicatore, senza aggiungere un tentativo. I richiami completati restano nello storico. Il filtro “Da richiamare” include scaduti e futuri non completati.

Le modifiche simultanee da più schede sono serializzate tramite Web Locks. È necessario un browser moderno. Il salvataggio delle chiamate è esplicito: le bozze non vengono salvate automaticamente e il cambio operatore è bloccato quando una bozza contiene modifiche.

## Avvio locale e verifica

Non richiede dipendenze o una compilazione.

```sh
python3 -m http.server 8793 --bind 127.0.0.1
npm test
```

Aprire `http://127.0.0.1:8793/`. I file necessari al sito sono `index.html`, `style.css`, `app.js`, `store.js`, `icon.svg`, `robots.txt`, `.nojekyll` e la cartella `assets`.

## Hosting

GitHub Pages, da repository pubblico, con dominio fornito gratuitamente dal servizio. Nessun dominio acquistato, backend, servizio a pagamento, analytics o font remoto.

Documentazione: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
