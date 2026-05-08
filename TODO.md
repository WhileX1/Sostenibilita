🟦 1. Anagrafica & Governance (Il "Profile")
Il VSME richiede che il report inizi con le "General Disclosures" (pagg. 12-15).

[ ] Creare l'icona "Profilo Aziendale": Una nuova finestra (stile "Proprietà del Sistema") per inserire:

Ragione Sociale e Anno di riferimento.

Numero di dipendenti (FTE): dato fondamentale per calcolare i ratio.

Settore di attività.

[ ] Aggiungere il modulo Governance (C9): Assicurati che tra le 15 metriche ci sia la "Diversità di genere negli organi di governo" (rapporto uomini/donne nel board), come richiesto a pag. 66 del PDF.

🟩 2. Ambiente (Modulo "Basic" B1 & B2)
Devi raffinare la raccolta dati per l'energia e le emissioni (pagg. 36-37).

[ ] Split Energia (Rinnovabile vs Non): All'interno della finestra "Energy Consumption", aggiungi due campi distinti invece di uno solo.

[ ] Implementare le formule di conversione: Nel tuo Formula DSL, scrivi le costanti per trasformare i consumi (kWh, m3 di gas) in CO2 (Scope 1 e Scope 2).

[ ] Rendere alcuni input "Obbligatori": Contrassegna con un asterisco (o bordo diverso) i campi richiesti dal Basic Module del VSME.

🟨 3. Sociale (S1 - S4)
[ ] Controllare i KPI obbligatori: Verifica che il tuo software calcoli:

Rapporto salariale (differenza tra stipendio più alto e medio).

Ore di formazione per dipendente.

Numero di infortuni sul lavoro.

📝 4. Narrative & Trasparenza (Il "Ponte" per il consulente)
Il reporting non è solo numeri, servono le spiegazioni (PAT).

[ ] Aggiungere il campo "Description": In ogni finestra di metrica, inserisci una textarea libera dove l'utente può spiegare la provenienza del dato o le azioni fatte per migliorare.

[ ] Migliorare il report CSRD: Nella schermata di stampa, includi i testi inseriti nelle "Description" accanto ai numeri e ai grafici.

⚙️ 5. Logica di Calcolo (Materialità)
[ ] Collegare lo slider Materialità: Assicurati che se un utente abbassa a zero il peso di una metrica nella finestra "Strategy", questa venga esclusa o segnalata come "Non Materiale" nel report finale (coerente con la flessibilità del VSME).

🚀 Bonus: Il tocco "Pro"
[ ] Validazione dati: Aggiungi un messaggio di errore se l'utente inserisce dati assurdi (es. energia negativa) o se dimentica il campo obbligatorio per il rating ESG finale.