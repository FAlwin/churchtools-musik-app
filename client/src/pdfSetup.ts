import * as pdfjsLib from 'pdfjs-dist';
// Worker INLINE ins Bundle bündeln (kein separater Datei-Abruf zur Laufzeit). Der frühere
// ?url-Ansatz lud eine externe .mjs, die im iPad-PWA offline nicht verfügbar war → pdf.js fiel auf
// den „fake worker" zurück und scheiterte („Importing a module script failed"). Inline liegt der
// Worker im ohnehin offline verfügbaren Haupt-Bundle → Charts rendern auch ohne Netz (#32).
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
