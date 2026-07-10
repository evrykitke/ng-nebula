// Pulls the OpenAPI document from a running nebula server into openapi.json,
// the input for `npm run generate-proxies`. Every nebula module contributes
// its endpoints to this one document, so when new modules land (accounting,
// sales, ...) regenerating the proxies is just: boot the server, re-run
// generate-proxies. Override the source with NEBULA_API_URL.
import { writeFileSync } from 'node:fs';

const base = process.env.NEBULA_API_URL ?? 'http://localhost:5000';
const url = `${base.replace(/\/$/, '')}/api-docs/openapi.json`;

const response = await fetch(url).catch((cause) => {
  throw new Error(`could not reach ${url} — is nebula-server running?`, { cause });
});
if (!response.ok) {
  throw new Error(`${url} answered ${response.status} ${response.statusText}`);
}

const doc = await response.json();
writeFileSync('openapi.json', JSON.stringify(doc, null, 2) + '\n');
const operations = Object.values(doc.paths ?? {}).reduce((n, p) => n + Object.keys(p).length, 0);
console.log(`fetch-openapi: ${url} → openapi.json (${operations} operations)`);
