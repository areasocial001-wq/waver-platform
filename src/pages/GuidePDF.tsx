import { useEffect } from "react";

const guideSections = [
  { title: "Primi Passi", steps: ["Crea un account con email o Google.", "Conferma il tuo indirizzo email.", "Accedi alla dashboard principale.", "Configura le API key in Impostazioni."], tips: ["Tutte le funzionalità sono disponibili gratuitamente in fase di test."] },
  { title: "Generazione Video da Testo", steps: ["Seleziona 'Text to Video' dalla dashboard.", "Scrivi un prompt descrittivo.", "Scegli il provider (AIML, Vidu, LTX, Luma, Freepik).", "Imposta durata, risoluzione e stile.", "Clicca 'Genera' e attendi.", "Scarica o salva nella cronologia."], tips: ["Usa l'Assistente AI Prompt per prompt migliori.", "Confronta risultati con il Multi-Provider."] },
  { title: "Generazione Video da Immagine", steps: ["Seleziona 'Image to Video'.", "Carica un'immagine (JPG, PNG, WebP).", "Aggiungi prompt per guidare l'animazione.", "Configura il Motion Control.", "Genera e confronta."], tips: ["Immagini ad alta risoluzione = risultati migliori."] },
  { title: "Generazione Immagini", steps: ["Accedi al generatore immagini.", "Scrivi un prompt dettagliato.", "Scegli modello e stile.", "Imposta risoluzione e formato.", "Usa Inpainting per modifiche mirate."], tips: ["La Galleria salva automaticamente tutto."] },
  { title: "Storyboard Editor", steps: ["Vai a 'I miei Storyboard'.", "Crea nuovo storyboard.", "Aggiungi pannelli con descrizioni scene.", "Usa 'Script to Storyboard' per conversione automatica.", "Associa personaggi con Character Lock Panel.", "Genera video direttamente dallo storyboard.", "Condividi con link pubblico/protetto."], tips: ["Template storia per strutture narrative predefinite."] },
  { title: "Talking Avatar", steps: ["Accedi alla sezione Talking Avatar.", "Carica immagine del volto.", "Scrivi il testo o registra audio.", "Scegli voce o usa Voice Cloning.", "Configura lingua, velocità, emozione.", "Genera e scarica."], tips: ["Batch per produzioni multiple.", "Timeline dedicata per montaggio clip."] },
  { title: "Voice Cloning & TTS", steps: ["Apri Voice Clone dalla navigazione.", "Carica campione audio (min. 30 sec).", "Assegna nome alla voce clonata.", "Usa in Talking Avatar o TTS."] },
  { title: "Timeline Editor", steps: ["Accedi al Timeline Editor.", "Trascina clip sulla timeline.", "Aggiungi transizioni (dissolve, wipe, zoom).", "Inserisci tracce audio.", "Regola livelli con mixer/equalizzatore.", "Esporta il video finale."] },
  { title: "JSON2Video Editor", steps: ["Accedi al Video Editor.", "Crea progetto o carica template.", "Definisci clip con media e testo.", "Configura transizioni e sottotitoli.", "Usa NL-to-JSON per generare da linguaggio naturale.", "Renderizza e scarica."] },
  { title: "Workflow AI", steps: ["Accedi al Workflow Freepik.", "Trascina nodi: immagini, video, audio, upscaler.", "Collega i nodi per creare il flusso.", "Configura ogni nodo.", "Esegui il workflow.", "Salva come template."] },
  { title: "Faceless Video", steps: ["Accedi a Faceless Video.", "Scegli tipo contenuto.", "Inserisci argomento o script.", "L'AI genera immagini, voiceover e montaggio.", "Personalizza e scarica."] },
  { title: "Trailer Generator", steps: ["Accedi al Trailer Generator.", "Seleziona template trailer.", "Carica o genera scene.", "L'AI suggerisce musica e transizioni.", "Personalizza montaggio.", "Esporta in alta qualità."] },
  { title: "Generatore Contenuti AI", steps: ["Accedi al Content Generator.", "Scegli tipo contenuto.", "Inserisci tema.", "L'AI genera il contenuto.", "Modifica e raffina.", "Usa negli altri strumenti."] },
  { title: "Monitoraggio API", steps: ["Accedi all'API Monitoring.", "Visualizza stato real-time provider.", "Configura soglie allarme.", "Consulta grafici uptime.", "Abilita notifiche push.", "Analizza log."] },
  { title: "Impostazioni & API Key", steps: ["Vai a Impostazioni.", "Inserisci API key provider.", "Configura provider predefinito.", "Imposta preferenze notifica.", "Gestisci profilo e sicurezza."] },
];

const GuidePDF = () => {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @media print {
        body { background: white !important; color: black !important; }
        .no-print { display: none !important; }
        .print-section { break-inside: avoid; margin-bottom: 18px; }
      }
    `;
    document.head.appendChild(style);

    // Auto trigger print
    const timer = setTimeout(() => window.print(), 600);
    return () => { clearTimeout(timer); document.head.removeChild(style); };
  }, []);

  return (
    <div className="min-h-screen bg-white text-black p-8 max-w-[800px] mx-auto" style={{ fontFamily: "Georgia, serif" }}>
      <div className="no-print mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200 text-blue-800 text-sm flex items-center justify-between">
        <span>La finestra di stampa si aprirà automaticamente. Scegli "Salva come PDF" per scaricare.</span>
        <button onClick={() => window.print()} className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
          Stampa / PDF
        </button>
      </div>

      <header className="text-center mb-10 border-b-2 border-gray-800 pb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Guida Completa alla Piattaforma</h1>
        <p className="text-gray-600 text-sm">Produzione Video AI — Documentazione Utente</p>
        <p className="text-gray-400 text-xs mt-1">Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT", { year: "numeric", month: "long", day: "numeric" })}</p>
      </header>

      {/* TOC */}
      <section className="print-section mb-8">
        <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-3">Indice</h2>
        <ol className="columns-2 text-sm space-y-1 list-decimal list-inside text-gray-700">
          {guideSections.map((s, i) => (
            <li key={i}>{s.title}</li>
          ))}
        </ol>
      </section>

      {guideSections.map((section, i) => (
        <section key={i} className="print-section mb-6">
          <h2 className="text-lg font-bold border-b border-gray-300 pb-1 mb-2">
            {i + 1}. {section.title}
          </h2>
          <ol className="text-sm space-y-1 ml-4 text-gray-800">
            {section.steps.map((step, si) => (
              <li key={si} className="flex gap-2">
                <span className="text-gray-500 font-mono text-xs mt-0.5">{si + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {section.tips && (
            <div className="mt-2 ml-4 p-2 bg-gray-50 border-l-2 border-gray-400 text-sm text-gray-600">
              <span className="font-semibold text-xs uppercase tracking-wider text-gray-500">Suggerimenti</span>
              <ul className="mt-1 space-y-0.5">
                {section.tips.map((tip, ti) => (
                  <li key={ti}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}

      <footer className="mt-10 pt-4 border-t border-gray-300 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} AI Production Hub — Tutti i diritti riservati
      </footer>
    </div>
  );
};

export default GuidePDF;
