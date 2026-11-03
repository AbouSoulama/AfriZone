import fs from 'fs';
import path from 'path';

const pdfPath = path.resolve('src/lib/id-doc-references/passeport-exemple.pdf');
const outDir = path.resolve('src/lib/id-doc-references/passport-pages');
fs.mkdirSync(outDir, { recursive: true });

const buf = fs.readFileSync(pdfPath);
const text = buf.toString('latin1');

// Extract DCTDecode (JPEG) streams
const jpegMarker = /\/Filter\s*\/DCTDecode[\s\S]{0,400}?stream\r?\n/g;
let match;
let idx = 0;
const positions = [];
while ((match = jpegMarker.exec(text)) !== null) {
  positions.push(match.index + match[0].length);
}

console.log('JPEG stream candidates:', positions.length);

for (const start of positions) {
  const end = text.indexOf('endstream', start);
  if (end < 0) continue;
  let raw = text.slice(start, end);
  // Trim trailing whitespace/newlines before endstream
  raw = raw.replace(/\r?\n$/, '');
  const bytes = Buffer.from(raw, 'latin1');
  // Validate JPEG SOI
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    console.log('skip non-jpeg at', start);
    continue;
  }
  idx += 1;
  const out = path.join(outDir, `page-${String(idx).padStart(2, '0')}.jpg`);
  fs.writeFileSync(out, bytes);
  console.log('wrote', out, bytes.length);
}

console.log('done, files=', idx);
