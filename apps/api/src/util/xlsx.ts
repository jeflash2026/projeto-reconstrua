// ─────────────────────────────────────────────────────────────────────────────
// XLSX mínimo (SpreadsheetML + zip STORE, sem dependência externa) — o Excel
// REAL do pacote do perito (pedido do dono, 2026-08-05): o CSV abria com as
// colunas espremidas ("1,5E+09" no contrato, "########" nas datas). Aqui:
//  • LARGURA de cada coluna calculada pelo maior conteúdo (clamp 10–45);
//  • número de CONTRATO sempre TEXTO (nunca notação científica);
//  • cabeçalho em NEGRITO e CONGELADO (rola a lista, o título fica);
//  • linhas em branco entre bancos preservadas (respiro visual).
// ─────────────────────────────────────────────────────────────────────────────
import { zipStore } from './zip.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Referência de coluna A, B, …, Z, AA, AB… */
function colRef(j: number): string {
  let n = j + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Gera um .xlsx (Buffer) de UMA aba a partir de colunas + linhas. Células
 *  string viram texto (inlineStr — contrato sai INTEIRO); números viram
 *  número (o Excel formata no locale); null vira célula vazia. */
export function xlsxDePlanilha(
  nomeAba: string,
  colunas: readonly string[],
  linhas: ReadonlyArray<ReadonlyArray<string | number | null>>,
): Buffer {
  // Larguras: o maior conteúdo da coluna (cabeçalho incluso), com folga.
  const larguras = colunas.map((c, j) => {
    let m = String(c).length;
    for (const l of linhas) {
      const v = l[j];
      if (v === null || v === undefined) continue;
      const s = typeof v === 'number' ? v.toFixed(2) : String(v);
      if (s.length > m) m = s.length;
    }
    return Math.min(45, Math.max(10, m + 2));
  });

  const cell = (v: string | number | null | undefined, r: number, j: number): string => {
    if (v === null || v === undefined || v === '') return '';
    const ref = `${colRef(j)}${String(r)}`;
    const estilo = r === 1 ? ' s="1"' : '';
    if (typeof v === 'number') return `<c r="${ref}"${estilo}><v>${String(v)}</v></c>`;
    return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  };
  const todas: ReadonlyArray<ReadonlyArray<string | number | null>> = [colunas, ...linhas];
  const rows = todas
    .map((l, i) => `<row r="${String(i + 1)}">${l.map((v, j) => cell(v, i + 1, j)).join('')}</row>`)
    .join('');
  const cols = larguras
    .map(
      (w, j) =>
        `<col min="${String(j + 1)}" max="${String(j + 1)}" width="${String(w)}" customWidth="1"/>`,
    )
    .join('');

  const sheet =
    `${XML}<worksheet xmlns="${NS_MAIN}">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`;
  const workbook =
    `${XML}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<sheets><sheet name="${esc(nomeAba.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const styles =
    `${XML}<styleSheet xmlns="${NS_MAIN}">` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
    `<borders count="1"><border/></borders>` +
    `<cellStyleXfs count="1"><xf/></cellStyleXfs>` +
    `<cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`;
  const contentTypes =
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const relsRaiz =
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const relsWorkbook =
    `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`;

  return zipStore([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: relsRaiz },
    { name: 'xl/workbook.xml', content: workbook },
    { name: 'xl/_rels/workbook.xml.rels', content: relsWorkbook },
    { name: 'xl/styles.xml', content: styles },
    { name: 'xl/worksheets/sheet1.xml', content: sheet },
  ]);
}
