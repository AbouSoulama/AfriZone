import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';

const files = [
  'src/lib/id-doc-references/cnib-bf-recto-exemple-1.jpg',
  'src/lib/id-doc-references/cnib-bf-recto-verso-exemple-2.jpg',
  'src/lib/id-doc-references/passport-pages/page-01.jpg',
  'src/lib/id-doc-references/passport-pages/page-03.jpg',
  'src/lib/id-doc-references/passport-pages/page-04.jpg',
];

const worker = await createWorker('fra+eng');
for (const rel of files) {
  const p = path.resolve(rel);
  if (!fs.existsSync(p)) {
    console.log('MISSING', rel);
    continue;
  }
  console.log('\n========', rel, '========');
  const { data } = await worker.recognize(p);
  console.log('confidence', data.confidence);
  console.log(data.text);
}
await worker.terminate();
