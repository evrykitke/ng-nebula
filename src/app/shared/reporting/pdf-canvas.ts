/**
 * pdf.js, wrapped just enough to draw a document into an element.
 *
 * The library is loaded on demand — it is about a megabyte, and most of the app
 * never opens a document. Kept apart from the panel component so the panel
 * stays about layout and actions rather than about rendering internals.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';

/** Loaded once, on the first document opened. */
let pdfjs: typeof import('pdfjs-dist') | null = null;

async function library(): Promise<typeof import('pdfjs-dist')> {
  if (pdfjs) return pdfjs;
  const lib = await import('pdfjs-dist');
  // The worker keeps parsing off the main thread; without it pdf.js falls back
  // to doing the work inline and the panel janks while a page draws.
  //
  // Served as a build asset (see angular.json) rather than resolved through the
  // bundler: `new URL('pdfjs-dist/…', import.meta.url)` compiles happily but
  // emits no file, so the worker 404s at runtime and the fallback hides it.
  // Resolved against <base href> so it survives a non-root deployment.
  lib.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).toString();
  pdfjs = lib;
  return lib;
}

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const lib = await library();
  // pdf.js takes ownership of the buffer it is given, so hand it a copy: the
  // same bytes are still needed for the download.
  return lib.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
}

/**
 * Draw one page onto a canvas at `zoom`, accounting for the display's pixel
 * density so the text is sharp rather than merely large.
 */
export async function drawPage(
  doc: PDFDocumentProxy,
  pageNo: number,
  canvas: HTMLCanvasElement,
  zoom: number,
): Promise<void> {
  const page = await doc.getPage(pageNo);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: zoom * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  // The element keeps CSS pixels; the bitmap behind it carries the extra dots.
  canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
  const context = canvas.getContext('2d');
  if (!context) return;
  await page.render({ canvasContext: context, viewport }).promise;
}
