import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfPath = path.resolve(
  'src/lib/id-doc-references/passeport-exemple.pdf'
);

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
console.log('pages', doc.numPages);

for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
  const page = await doc.getPage(i);
  const tc = await page.getTextContent();
  const text = tc.items.map((it) => ('str' in it ? it.str : '')).join(' ');
  console.log('--- page', i, 'textLen=', text.length);
  console.log(text.slice(0, 2000) || '(no extractable text — likely scanned image)');
  const ops = await page.getOperatorList();
  const imageOps = ops.fnArray.filter((fn) => fn === 85 || fn === 82 || fn === 83).length;
  console.log('operatorCount=', ops.fnArray.length, 'approxImageOps=', imageOps);
}
