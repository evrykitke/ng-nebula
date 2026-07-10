// Post-generation fix-up for NSwag output. With interface-style DTOs, NSwag
// references `FileParameter` in file-upload methods but omits its declaration;
// append it whenever it's used but missing. Runs as part of generate-proxies.
import { appendFileSync, readFileSync } from 'node:fs';

const path = 'src/app/shared/service-proxies/service-proxies.ts';
const src = readFileSync(path, 'utf8');

if (src.includes('FileParameter') && !src.includes('interface FileParameter')) {
  appendFileSync(
    path,
    '\n/** Multipart file parameter (declaration omitted by NSwag for interface-style DTOs). */\n' +
      'export interface FileParameter {\n    data: any;\n    fileName: string;\n}\n',
  );
  console.log('fix-proxies: appended FileParameter declaration');
}
