// Post-generation fix-ups for NSwag output; runs as part of generate-proxies.
//
// 1. Date revival — the interface-style Angular template parses JSON with an
//    undefined `jsonParseReviver`, so DTO fields typed as luxon `DateTime`
//    actually hold raw ISO strings at runtime and `.toFormat(...)` explodes.
//    Point every proxy's reviver at a helper that turns full ISO timestamps
//    into real `DateTime` instances, making the declared types true.
// 2. FileParameter — NSwag references it in file-upload methods but omits the
//    declaration for interface-style DTOs; append it when used but missing.
// 3. Null-tolerant optional query params — NSwag throws when an optional query
//    parameter is passed `null` (only `undefined` omits it). The app uses
//    `null` as the "no filter" sentinel everywhere (`this.filter || null`), so
//    relax the guard to treat `null` exactly like `undefined`: omit it.
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/app/shared/service-proxies/service-proxies.ts';
let src = readFileSync(path, 'utf8');

const undefinedReviver =
  'protected jsonParseReviver: ((key: string, value: any) => any) | undefined = undefined;';
if (src.includes(undefinedReviver)) {
  const count = src.split(undefinedReviver).length - 1;
  src = src.replaceAll(
    undefinedReviver,
    'protected jsonParseReviver: ((key: string, value: any) => any) | undefined = luxonDateReviver;',
  );
  src +=
    '\nconst ISO_DATE_TIME = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})$/;\n' +
    '/** Revive ISO timestamps into luxon DateTime so DTO date fields match their declared types. */\n' +
    'function luxonDateReviver(_key: string, value: any): any {\n' +
    '    return typeof value === "string" && ISO_DATE_TIME.test(value) ? DateTime.fromISO(value) : value;\n' +
    '}\n';
  console.log(`fix-proxies: wired luxon date reviver into ${count} proxy class(es)`);
}

if (src.includes('FileParameter') && !src.includes('interface FileParameter')) {
  src +=
    '\n/** Multipart file parameter (declaration omitted by NSwag for interface-style DTOs). */\n' +
    'export interface FileParameter {\n    data: any;\n    fileName: string;\n}\n';
  console.log('fix-proxies: appended FileParameter declaration');
}

// 4. Discriminated-union $refs NSwag can't name — a `oneOf` property whose
//    schema (e.g. PriceSource) is a tagged union gets referenced under the
//    property name (`source: Source`) but the type is never declared. Append a
//    permissive declaration covering the union's shape (a `kind` discriminator
//    plus any variant fields) when it is used but missing.
if (src.includes(': Source;') && !src.includes('interface Source') && !src.includes('type Source')) {
  src +=
    '\n/** Tagged price-resolution source (declaration NSwag omits for the oneOf $ref). */\n' +
    'export interface Source {\n    kind: string;\n    price_list_id?: string;\n}\n';
  console.log('fix-proxies: appended Source (price-source union) declaration');
}

// Widen optional query-param *types* to accept `null` as well, matching the
// runtime guard above and the app's `this.filter || null` convention. Only
// proxy method signatures are touched (lines like `foo(a?: T | undefined,
// ...): Observable<...> {`), leaving DTO interface properties alone.
let widened = 0;
src = src.replace(/^(\s+\w+\()([^)]*)(\):\s*Observable<)/gm, (m, head, params, tail) => {
  if (!params.includes('| undefined')) return m;
  const nextParams = params.replaceAll('| undefined', '| null | undefined');
  if (nextParams !== params) widened++;
  return head + nextParams + tail;
});
if (widened > 0) console.log(`fix-proxies: widened optional params to accept null in ${widened} method(s)`);

const nullGuard =
  /if \((\w+) === null\)\s*\r?\n\s*throw new globalThis\.Error\("The parameter '[^']*' cannot be null\."\);\s*\r?\n\s*else if \(\1 !== undefined\)/g;
const nullGuardCount = (src.match(nullGuard) || []).length;
if (nullGuardCount > 0) {
  src = src.replace(nullGuard, 'if ($1 !== undefined && $1 !== null)');
  console.log(`fix-proxies: made ${nullGuardCount} optional query param guard(s) null-tolerant`);
}

writeFileSync(path, src);
