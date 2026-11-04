# Indovina la Parola

Gioco single-player a round continui, predisposto per estensioni multiplayer. Frontend statico e API su Cloudflare Workers con Durable Objects; le risposte restano sul server.

## File
- `index.html`, `style.css`, `app.js`: interfaccia e logica client.
- `worker.js`: API, sessione e generazione domande con Gemini.
- `wrangler.toml`: configurazione Cloudflare.
  
## Deploy
1. Installa Wrangler: `npm install -g wrangler`
2. Accedi: `wrangler login`
3. Imposta la chiave Gemini come secret (non inserirla nei file): `wrangler secret put GEMINI_API_KEY`
4. Imposta l'origine frontend consentita: `wrangler secret put ALLOWED_ORIGIN` (es. URL Pages del sito; in locale puoi usare `http://localhost:8788`).
5. Pubblica Worker e Durable Object: `wrangler deploy`
6. Pubblica i file statici con Cloudflare Pages, impostando `API_BASE` in `app.js` all'URL del Worker.

Il modello Gemini è configurabile con la variabile `GEMINI_MODEL`; il valore predefinito è `gemini-2.5-flash`. Verifica nel tuo progetto Google AI Studio che il modello sia disponibile.

## Regole implementate
- 10 gettoni consonante e 3 vocali iniziali; ricarica lazy di 3 consonanti e 1 vocale ogni 2 ore.
- Acquisto lettera con gettone; risposta esatta +5 consonanti e +1 vocale; risposta errata -2 consonanti e -1 vocale.
- Ruota categorie e ruota premi/penalità; le decisioni e la risposta sono lato server.
- Difficoltà crescente: 1–3 facile, 4–6 media, 7–10 difficile, 11–15 molto difficile, 16+ esperto.
- Lingue: italiano, inglese, francese, spagnolo, tedesco e portoghese.

## Sicurezza
Non committare mai chiavi API. La risposta corretta non viene inviata al browser. In produzione configura `ALLOWED_ORIGIN` con l'origine esatta del sito.
