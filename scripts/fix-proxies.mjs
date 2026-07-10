// Post-generation fix-ups for NSwag output; runs as part of generate-proxies.
//
// 1. Date revival — the interface-style Angular template parses JSON with an
//    undefined `jsonParseReviver`, so DTO fields typed as luxon `DateTime`
//    actually hold raw ISO strings at runtime and `.toFormat(...)` explodes.
//    Point every proxy's reviver at a helper that turns full ISO timestamps
//    into real `DateTime` instances, making the declared types true.
// 2. FileParameter — NSwag references it in file-upload methods but omits the
//    declaration for interface-style DTOs; append it when used but missing.
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

writeFileSync(path, src);
