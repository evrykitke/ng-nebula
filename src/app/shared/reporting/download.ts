/**
 * Trigger a browser download of a rendered blob.
 *
 * The anchor is put in the document and the object URL is revoked on a later
 * tick: revoking in the same tick as the click races the download, which
 * Chrome then silently drops — a bigger file loses that race more often, so
 * it fails exactly where it matters.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 10_000);
}

/**
 * A filename-safe slug of a title, e.g. "Purchase Orders" → "purchase-orders".
 * Mirrors the server's slug for the same title, so a download's name is the
 * same whichever side names it.
 */
export function slugify(title: string): string {
  const slug = title
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || 'export';
}
