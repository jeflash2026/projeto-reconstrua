// ─────────────────────────────────────────────────────────────────────────────
// ZIP mínimo (método STORE, sem compressão) — gera um .zip VÁLIDO (abre no
// Explorer do Windows, macOS, 7-Zip) sem dependência externa. Suficiente para
// empacotar N arquivos CSV de texto (um por cliente). CRC32 tabelado; nomes em
// UTF-8 (bit 11 do flag). Não faz ZIP64 — ok para dezenas de CSVs pequenos.
// ─────────────────────────────────────────────────────────────────────────────

const CRC_TABLE: readonly number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ArquivoZip {
  readonly name: string;
  readonly content: string;
}

/** Empacota arquivos de texto num Buffer .zip (STORE). Ordem preservada. */
export function zipStore(arquivos: readonly ArquivoZip[]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let offset = 0;

  for (const a of arquivos) {
    const nome = Buffer.from(a.name, 'utf8');
    const dados = Buffer.from(a.content, 'utf8');
    const crc = crc32(dados);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // assinatura local
    local.writeUInt16LE(20, 4); // versão necessária
    local.writeUInt16LE(0x0800, 6); // flags: nome em UTF-8
    local.writeUInt16LE(0, 8); // método: STORE
    local.writeUInt16LE(0, 10); // hora
    local.writeUInt16LE(0x21, 12); // data (1980-01-01 mínima válida)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18); // comprimido
    local.writeUInt32LE(dados.length, 22); // descomprimido
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28); // extra
    locais.push(local, nome, dados);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // assinatura central
    central.writeUInt16LE(20, 4); // versão criadora
    central.writeUInt16LE(20, 6); // versão necessária
    central.writeUInt16LE(0x0800, 8); // flags: UTF-8
    central.writeUInt16LE(0, 10); // método
    central.writeUInt16LE(0, 12); // hora
    central.writeUInt16LE(0x21, 14); // data
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(dados.length, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comentário
    central.writeUInt16LE(0, 34); // disco
    central.writeUInt16LE(0, 36); // atributos internos
    central.writeUInt32LE(0, 38); // atributos externos
    central.writeUInt32LE(offset, 42); // offset do cabeçalho local
    centrais.push(central, nome);

    offset += local.length + nome.length + dados.length;
  }

  const locaisBuf = Buffer.concat(locais);
  const centraisBuf = Buffer.concat(centrais);

  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); // assinatura EOCD
  fim.writeUInt16LE(0, 4); // disco
  fim.writeUInt16LE(0, 6); // disco do início
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(centraisBuf.length, 12);
  fim.writeUInt32LE(locaisBuf.length, 16); // offset da central
  fim.writeUInt16LE(0, 20); // comentário

  return Buffer.concat([locaisBuf, centraisBuf, fim]);
}

/** Nome de arquivo seguro para dentro do ZIP (sem separadores/《reservados》). */
export function nomeArquivoSeguro(bruto: string, fallback: string): string {
  const limpo = bruto
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return limpo === '' ? fallback : limpo;
}
