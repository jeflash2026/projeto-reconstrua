// ─────────────────────────────────────────────────────────────────────────────
// CORVO CLIENT (integração 2026-08-25) — o lado HTTP da conversa com o Corvo
// (https://corvo.clsolucoes.com): envio do ZIP do lead (multipart), reenvio de
// credencial, listagem de eventos (reconciliação) e download de anexo.
//
// Regras do contrato de integração:
//   • toda chamada leva `X-Api-Key`;
//   • o envio do ZIP leva `X-Idempotency-Key` ESTÁVEL por cliente+versão dos
//     documentos — retry reusa a MESMA key; 409 = key reutilizada com conteúdo
//     diferente (o serviço gera outra);
//   • 400/401/413 são erros PERMANENTES (não adianta repetir o mesmo envio);
//     5xx/timeout são transitórios (o serviço agenda retry com backoff).
// O fetch é injetável (testes); timeouts via AbortSignal.
// ─────────────────────────────────────────────────────────────────────────────

export interface CorvoConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
}

export interface BancoDoLead {
  readonly codigo: string;
  readonly nome: string;
  readonly email: string;
  readonly contratos: number;
}

export interface RespostaImportacao {
  readonly importacaoId: string;
  readonly modo: string;
  readonly clientes: readonly {
    readonly nome: string;
    readonly cpf: string;
    readonly bancos: readonly BancoDoLead[];
    readonly documentos: readonly string[];
    readonly caixa: { readonly status: string };
  }[];
  readonly contratos_novos: number;
  readonly ignorados: readonly unknown[];
  readonly leitura_hiscon: { readonly status: string };
}

export type ResultadoEnvio =
  | { readonly ok: true; readonly corpo: RespostaImportacao }
  | {
      readonly ok: false;
      readonly status: number | null; // null = rede/timeout
      readonly erro: string;
      /** true ⇒ repetir o MESMO conteúdo não resolve (400/401/413). */
      readonly permanente: boolean;
      /** true ⇒ 409: gerar NOVA idempotency key antes do próximo envio. */
      readonly conflitoDeChave: boolean;
    };

export interface EventoCorvo {
  readonly id: string;
  readonly tipo: string;
  readonly ocorridoEm: string;
  readonly tentativa?: number;
  readonly dados: unknown;
}

type FetchFn = typeof fetch;

export class CorvoClient {
  constructor(
    private readonly config: CorvoConfig,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  /** POST /api/integracao/leads/zip?modo=mesclar — multipart, campo `file`. */
  async enviarZip(zip: Buffer, idempotencyKey: string): Promise<ResultadoEnvio> {
    const boundary = `----corvo-${idempotencyKey.replace(/[^a-z0-9]/gi, '').slice(0, 24)}`;
    const cabeca = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="lead.zip"\r\n` +
        `Content-Type: application/zip\r\n\r\n`,
      'utf8',
    );
    const rodape = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const corpo = Buffer.concat([cabeca, zip, rodape]);
    try {
      const res = await this.fetchFn(
        `${this.config.baseUrl}/api/integracao/leads/zip?modo=mesclar`,
        {
          method: 'POST',
          headers: {
            'X-Api-Key': this.config.apiKey,
            'X-Idempotency-Key': idempotencyKey,
            'content-type': `multipart/form-data; boundary=${boundary}`,
          },
          body: corpo,
          signal: AbortSignal.timeout(120_000), // ZIP pode ter dezenas de MB
        },
      );
      // A spec dizia "201" — mas o remerge de cliente JÁ EXISTENTE responde 200
      // com o MESMO corpo de sucesso (visto em produção 2026-08-27: marcávamos
      // ERRO num envio que deu certo). Qualquer 2xx com corpo válido é sucesso.
      if (res.ok) return { ok: true, corpo: (await res.json()) as RespostaImportacao };
      const texto = await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        erro: texto.slice(0, 500),
        permanente: res.status === 400 || res.status === 401 || res.status === 413,
        conflitoDeChave: res.status === 409,
      };
    } catch (e) {
      return {
        ok: false,
        status: null,
        erro: e instanceof Error ? e.message : 'falha de rede',
        permanente: false,
        conflitoDeChave: false,
      };
    }
  }

  /** POST /api/integracao/caixas/{cpf}/reenviar-credencial. */
  async reenviarCredencial(cpf: string): Promise<{ ok: boolean; erro?: string }> {
    try {
      const res = await this.fetchFn(
        `${this.config.baseUrl}/api/integracao/caixas/${encodeURIComponent(cpf)}/reenviar-credencial`,
        {
          method: 'POST',
          headers: { 'X-Api-Key': this.config.apiKey },
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (res.ok) return { ok: true };
      return { ok: false, erro: `HTTP ${String(res.status)}` };
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message : 'falha de rede' };
    }
  }

  /** GET /api/integracao/eventos — página da reconciliação. */
  async listarEventos(
    desdeIso: string,
    cursor: string | null,
  ): Promise<{ eventos: readonly EventoCorvo[]; cursor: string | null } | null> {
    const params = new URLSearchParams({ desde: desdeIso, limit: '100' });
    if (cursor !== null) params.set('cursor', cursor);
    try {
      const res = await this.fetchFn(
        `${this.config.baseUrl}/api/integracao/eventos?${params.toString()}`,
        {
          headers: { 'X-Api-Key': this.config.apiKey },
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!res.ok) return null;
      const corpo = (await res.json()) as {
        eventos?: readonly EventoCorvo[];
        dados?: readonly EventoCorvo[];
        cursor?: string | null;
        proximoCursor?: string | null;
      };
      return {
        eventos: corpo.eventos ?? corpo.dados ?? [],
        cursor: corpo.cursor ?? corpo.proximoCursor ?? null,
      };
    } catch {
      return null;
    }
  }

  /** GET /api/integracao/dossie/{cpf} — o DOSSIÊ DE INTEGRIDADE (ZIP com os
   *  .eml, SHA256SUMS.txt e relatorio.json), gerado na hora pelo Corvo. */
  async baixarDossie(cpf: string): Promise<
    | {
        readonly ok: true;
        readonly bytes: Buffer;
        readonly hashRaiz: string;
        readonly cpf: string;
        readonly geradoEm: string;
        readonly nomeArquivo: string;
      }
    | { readonly ok: false; readonly status: number | null; readonly erro: string }
  > {
    try {
      const res = await this.fetchFn(
        `${this.config.baseUrl}/api/integracao/dossie/${encodeURIComponent(cpf)}`,
        {
          headers: { 'X-Api-Key': this.config.apiKey },
          signal: AbortSignal.timeout(90_000), // 5–20 MB com .eml e anexos
        },
      );
      if (!res.ok) {
        const texto = await res.text().catch(() => '');
        return { ok: false, status: res.status, erro: texto.slice(0, 300) };
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      const disposicao = res.headers.get('content-disposition') ?? '';
      const nome = /filename="([^"]+)"/.exec(disposicao)?.[1] ?? `dossie-${cpf}.zip`;
      return {
        ok: true,
        bytes,
        hashRaiz: (res.headers.get('x-dossie-hash-raiz') ?? '').toLowerCase(),
        cpf: res.headers.get('x-dossie-cpf') ?? cpf,
        geradoEm: res.headers.get('x-dossie-gerado-em') ?? '',
        nomeArquivo: nome,
      };
    } catch (e) {
      return { ok: false, status: null, erro: e instanceof Error ? e.message : 'falha de rede' };
    }
  }

  /** GET <url do anexo> com X-Api-Key — a URL do Corvo não é pública. */
  async baixarAnexo(url: string): Promise<{ bytes: Buffer; mime: string } | null> {
    try {
      const res = await this.fetchFn(url, {
        headers: { 'X-Api-Key': this.config.apiKey },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) return null;
      const bytes = Buffer.from(await res.arrayBuffer());
      return { bytes, mime: res.headers.get('content-type') ?? 'application/octet-stream' };
    } catch {
      return null;
    }
  }
}
