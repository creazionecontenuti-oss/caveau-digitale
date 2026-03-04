---
trigger: always_on
---

# Regola deploy produzione

## Obiettivo
Pubblicare una versione **identificabile** e **verificabile** della PWA su Vercel, con cache aggiornata e badge versione visibile in app.

## Dove fare deploy
- **Produzione:** Vercel (dominio principale `piggyvault.xyz`)
- **Preview:** URL preview generata automaticamente da Vercel (opzionale per test)

## Se aggiungi nuove classi Tailwind
Devi rilanciare: `npx tailwindcss -i tailwind-input.css -o tailwind.min.css --minify` prima del deploy.

## Prima del deploy (obbligatorio)
1. Aggiorna la versione applicativa in `app.js`:
   - `APP_VERSION`
   - `APP_UPDATED_AT`
2. Aggiorna `CACHE_VERSION` in `sw.js` per forzare refresh cache client.
3. Rebuild `app.min.js`: `npx terser app.js --compress passes=2 --mangle --output app.min.js`
4. Verifica localmente che il badge in basso mostri versione/timestamp corretti.

## Comando deploy
```bash
vercel --prod --yes
```

## Verifica post-deploy (obbligatoria)
1. Apri `https://piggyvault.xyz` su desktop e mobile.
2. In basso deve comparire il badge con:
   - `Versione: ...`
   - `Aggiornata: ...`
3. In PWA installata, chiudi e riapri l'app, poi verifica che il badge mostri la nuova versione.
4. Verifica safe-area su iOS/Android:
   - contenuto non sotto la status bar
   - modali con margine corretto sopra/sotto

## Comando da eseguire sempre
`bash export-project.sh` dalla root per esportare il progetto in un unico file.

## Regola anti-cache stantia
Se la versione visibile non cambia:
1. Chiudi completamente la PWA
2. Riapri la PWA
3. Se necessario, disinstalla/reinstalla la PWA
4. Controlla che `CACHE_VERSION` sia stato davvero incrementato

## Note
- IPFS/Pinata non è parte del deploy standard attuale (solo Vercel).
- Ogni release deve avere una versione nuova e timestamp aggiornato.
