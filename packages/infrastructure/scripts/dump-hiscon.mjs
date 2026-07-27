// Ferramenta TEMPORÁRIA de calibração (não versionada): despeja os itens de
// texto do PDF com coordenadas normalizadas pelo viewport (origem topo-esq).
import { getDocumentProxy } from 'unpdf';
import { readFileSync, writeFileSync } from 'node:fs';

const bytes = new Uint8Array(readFileSync(process.argv[2]));
const doc = await getDocumentProxy(bytes.slice());
const mul = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const out = [];
for (let p = 1; p <= doc.numPages; p += 1) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const itens = tc.items
    .filter((i) => i.str.trim() !== '')
    .map((i) => {
      const m = mul(vp.transform, i.transform);
      return {
        x: +m[4].toFixed(1),
        y: +m[5].toFixed(1),
        w: +(i.width ?? 0).toFixed(1),
        s: i.str,
      };
    });
  out.push({
    page: p,
    rotate: page.rotate,
    width: +vp.width.toFixed(0),
    height: +vp.height.toFixed(0),
    n: itens.length,
    itens,
  });
}
writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
console.log(
  'paginas:',
  doc.numPages,
  '|',
  out.map((o) => `p${o.page}(rot${o.rotate},${o.width}x${o.height},${o.n}i)`).join(' '),
);
