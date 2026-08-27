// ─────────────────────────────────────────────────────────────────────────────
// ZIP mínimo (método STORE, sem compressão) — gera um .zip VÁLIDO (abre no
// Explorer do Windows, macOS, 7-Zip) sem dependência externa. Suficiente para
// empacotar N arquivos CSV de texto (um por cliente). CRC32 tabelado; nomes em
// UTF-8 (bit 11 do flag). Não faz ZIP64 — ok para dezenas de CSVs pequenos.
// 2026-08-26: ganhou também a LEITURA (lerArquivoDoZip) para abrir o dossiê
// de integridade do Corvo — STORE e DEFLATE (zlib), sem dependência externa.
// ─────────────────────────────────────────────────────────────────────────────
import { inflateRawSync } from 'node:zlib';

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
  /** Texto (CSV) ou BINÁRIO (PDF/fotos — pacote do perito, 2026-08-04). */
  readonly content: string | Buffer;
}

/** Empacota arquivos (texto ou binário) num Buffer .zip (STORE). Ordem preservada. */
export function zipStore(arquivos: readonly ArquivoZip[]): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let offset = 0;

  for (const a of arquivos) {
    const nome = Buffer.from(a.name, 'utf8');
    const dados = typeof a.content === 'string' ? Buffer.from(a.content, 'utf8') : a.content;
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

/** LÊ um arquivo de dentro de um ZIP alheio (dossiê do Corvo, 2026-08-26) —
 *  varre o diretório central a partir do EOCD e devolve os bytes do arquivo
 *  pedido. Suporta STORE (0) e DEFLATE (8, via zlib). null = não achou ou zip
 *  malformado — quem chama decide o que fazer (nunca explode). */
export function lerArquivoDoZip(zip: Buffer, nome: string): Buffer | null {
  try {
    // EOCD: assinatura 0x06054b50, varrendo do fim (comentário pode existir).
    let eocd = -1;
    for (let i = zip.length - 22; i >= 0 && i >= zip.length - 22 - 65_536; i--) {
      if (zip.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return null;
    const totalEntradas = zip.readUInt16LE(eocd + 10);
    let pos = zip.readUInt32LE(eocd + 16); // offset do diretório central
    for (let n = 0; n < totalEntradas; n++) {
      if (zip.readUInt32LE(pos) !== 0x02014b50) return null;
      const metodo = zip.readUInt16LE(pos + 10);
      const comprimido = zip.readUInt32LE(pos + 20);
      const tamanhoNome = zip.readUInt16LE(pos + 28);
      const tamanhoExtra = zip.readUInt16LE(pos + 30);
      const tamanhoComentario = zip.readUInt16LE(pos + 32);
      const offsetLocal = zip.readUInt32LE(pos + 42);
      const nomeEntrada = zip.subarray(pos + 46, pos + 46 + tamanhoNome).toString('utf8');
      if (nomeEntrada === nome) {
        // O cabeçalho LOCAL tem nome/extra próprios (podem diferir do central).
        if (zip.readUInt32LE(offsetLocal) !== 0x04034b50) return null;
        const nomeLocal = zip.readUInt16LE(offsetLocal + 26);
        const extraLocal = zip.readUInt16LE(offsetLocal + 28);
        const inicio = offsetLocal + 30 + nomeLocal + extraLocal;
        const dados = zip.subarray(inicio, inicio + comprimido);
        if (metodo === 0) return Buffer.from(dados);
        if (metodo === 8) return inflateRawSync(dados);
        return null; // método desconhecido
      }
      pos += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
    }
    return null;
  } catch {
    return null;
  }
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
