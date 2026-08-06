// ─────────────────────────────────────────────────────────────────────────────
// CHAT DO CANAL HUMANIZADO (decreto 2026-08-05) — o número da EQUIPE
// ((41) 99802-8530) migrou para a Meta Cloud API como SEGUNDO número do mesmo
// app. Este serviço é a conversa 100% HUMANA desse número:
//
//  • a AHRI NUNCA responde aqui — mensagem recebida vira registro na conversa
//    (ns 'humanizado-chat') e espera a secretária no portal;
//  • a secretária envia texto/documento/template pelo portal do humanizado;
//  • anexo recebido (procuração assinada, RG, comprovante) é CONFIRMADO pela
//    secretária com um clique — o mesmo blob vai ao docs-equipe do cliente,
//    exatamente como o upload manual do painel (mesma validação, mesma régua).
//
// REGRA META (janela 24h): iniciar conversa fora da janela exige TEMPLATE
// aprovado — o portal expõe o 'contato_equipe' para isso; falha do Graph volta
// legível para a secretária (nunca silêncio).
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';
import type { MediaStorePort } from '../media/media-store-port.js';
import type { DocsEquipeService, TipoDocEquipe } from '../docs-equipe/docs-equipe-service.js';

const NS = 'humanizado-chat';
/** Teto de mensagens retidas por conversa — as mais antigas caem (o que importa
 *  do cliente já vira documento confirmado no perfil; o chat é operacional). */
const MAX_MENSAGENS = 800;

export type TipoMensagemHumanizada = 'texto' | 'documento' | 'imagem' | 'audio' | 'template';

export interface MensagemHumanizada {
  readonly id: string;
  readonly direcao: 'entrada' | 'saida';
  readonly tipo: TipoMensagemHumanizada;
  readonly texto: string | null;
  readonly nomeArquivo: string | null;
  readonly mime: string | null;
  /** Blob content-addressed no media store (anexos, nas duas direções). */
  readonly sha256: string | null;
  /** Nome de quem atendeu (saída) — a conversa é sempre assinada por gente. */
  readonly autor: string | null;
  /** Tipo docs-equipe quando a secretária confirmou este anexo no perfil. */
  readonly confirmadoComo: TipoDocEquipe | null;
  /** ID da Meta (wamid) da SAÍDA — correlaciona o status de entrega. */
  readonly wamid?: string | null;
  /** FALHA DE ENTREGA (2026-08-06): a Meta aceitou e falhou depois (ex.:
   *  janela de 24h) — o chat mostra o aviso em vermelho na mensagem. */
  readonly falha?: string | null;
  readonly em: string;
}

interface Conversa {
  readonly chatId: string;
  readonly mensagens: readonly MensagemHumanizada[];
  readonly lidoEm: string | null;
}

export interface ResumoConversaHumanizada {
  readonly chatId: string;
  readonly total: number;
  readonly ultimaEm: string | null;
  readonly previa: string;
  /** Mensagens de ENTRADA depois do último "marcar lido" da secretária. */
  readonly naoLidas: number;
  /** Quem falou por ÚLTIMO — 'entrada' = o cliente espera a equipe (painel
   *  "aguardando sua resposta" do dono, 2026-08-05). */
  readonly ultimaDirecao: 'entrada' | 'saida' | null;
  /** Última mensagem DO CLIENTE (ISO) — mede o silêncio dele (painel
   *  "procuração enviada sem retorno"). */
  readonly ultimaEntradaEm: string | null;
}

/** Entrada vinda do webhook (já mapeada pelo MetaCanalRuntime). */
export interface EntradaHumanizada {
  readonly messageId: string;
  readonly chatId: string;
  readonly texto: string | null;
  readonly tipo: TipoMensagemHumanizada;
  readonly nomeArquivo: string | null;
  readonly midia: { readonly sha256: string; readonly mime: string } | null;
  readonly em: Date;
}

/** O transporte do canal (o gateway Meta do número da equipe). */
export interface EnvioHumanizado {
  sendText(chatId: string, text: string): Promise<{ readonly providerMessageId: string }>;
  sendDocument(
    chatId: string,
    anexo: { readonly fileName: string; readonly mimeType: string; readonly base64: string },
    caption: string,
  ): Promise<void>;
  sendTemplate(
    chatId: string,
    nome: string,
    idioma?: string,
    variaveis?: readonly string[],
  ): Promise<boolean>;
  /** ÁUDIO (decreto 2026-08-06): mensagem de voz da secretária ao cliente. */
  sendAudio(
    chatId: string,
    anexo: { readonly mimeType: string; readonly base64: string },
  ): Promise<boolean>;
}

export interface ChatHumanizadoDeps {
  readonly json: JsonStore;
  readonly media: MediaStorePort;
  readonly clock: Clock;
  /** null = canal não configurado (env ausente): receber nunca quebra; enviar
   *  devolve erro legível para a secretária. */
  readonly envio: EnvioHumanizado | null;
  readonly docsEquipe: DocsEquipeService;
  readonly aoFalhar?: (mensagem: string) => void;
}

type Resultado = { ok: true } | { ok: false; error: string };

const SEM_CANAL = 'canal da equipe não configurado — avise o administrador';

export class ChatHumanizadoService {
  constructor(private readonly deps: ChatHumanizadoDeps) {}

  private async conversa(chatId: string): Promise<Conversa> {
    const raw = (await this.deps.json.get(NS, chatId)) as Conversa | null;
    return raw ?? { chatId, mensagens: [], lidoEm: null };
  }

  private async gravar(chatId: string, conversa: Conversa): Promise<void> {
    const mensagens =
      conversa.mensagens.length > MAX_MENSAGENS
        ? conversa.mensagens.slice(conversa.mensagens.length - MAX_MENSAGENS)
        : conversa.mensagens;
    await this.deps.json.put(NS, chatId, { ...conversa, mensagens } satisfies Conversa);
  }

  /** Registra mensagem RECEBIDA do cliente (webhook). Idempotente por id —
   *  a Meta reentrega webhooks; a conversa nunca duplica. */
  async registrarEntrada(entrada: EntradaHumanizada): Promise<void> {
    const atual = await this.conversa(entrada.chatId);
    if (atual.mensagens.some((m) => m.id === entrada.messageId)) return;
    const mensagem: MensagemHumanizada = {
      id: entrada.messageId,
      direcao: 'entrada',
      tipo: entrada.tipo,
      texto: entrada.texto,
      nomeArquivo: entrada.nomeArquivo,
      mime: entrada.midia?.mime ?? null,
      sha256: entrada.midia?.sha256 ?? null,
      autor: null,
      confirmadoComo: null,
      em: entrada.em.toISOString(),
    };
    await this.gravar(entrada.chatId, {
      ...atual,
      mensagens: [...atual.mensagens, mensagem],
    });
  }

  /** A conversa inteira de um cliente (portal). */
  async listar(chatId: string): Promise<Conversa> {
    return this.conversa(chatId);
  }

  /** Resumo de TODAS as conversas — a caixa de entrada da secretária. */
  async resumo(): Promise<readonly ResumoConversaHumanizada[]> {
    const conversas = (await this.deps.json.list(NS)) as readonly Conversa[];
    return conversas
      .map((c) => {
        const ultima = c.mensagens[c.mensagens.length - 1] ?? null;
        const lidoEm = c.lidoEm ?? '';
        const naoLidas = c.mensagens.filter((m) => m.direcao === 'entrada' && m.em > lidoEm).length;
        const ultimaEntrada = [...c.mensagens].reverse().find((m) => m.direcao === 'entrada');
        return {
          chatId: c.chatId,
          total: c.mensagens.length,
          ultimaEm: ultima?.em ?? null,
          previa:
            ultima === null
              ? ''
              : (ultima.texto ?? ultima.nomeArquivo ?? `[${ultima.tipo}]`).slice(0, 80),
          naoLidas,
          ultimaDirecao: ultima?.direcao ?? null,
          ultimaEntradaEm: ultimaEntrada?.em ?? null,
        };
      })
      .sort((a, b) => (b.ultimaEm ?? '').localeCompare(a.ultimaEm ?? ''));
  }

  /** EXCLUIR a conversa (ato do painel, 2026-08-06 — ex.: o aviso automático
   *  da própria Meta na configuração do número). Remove só o REGISTRO da
   *  conversa; blobs content-addressed permanecem (nunca apagamos bytes) e
   *  documentos já confirmados seguem no perfil do cliente. Se o número
   *  escrever de novo, uma conversa nova nasce do zero. */
  async excluirConversa(chatId: string): Promise<void> {
    await this.deps.json.del(NS, chatId);
  }

  /** A secretária abriu a conversa — zera o contador de não lidas. */
  async marcarLido(chatId: string): Promise<void> {
    const atual = await this.conversa(chatId);
    await this.gravar(chatId, { ...atual, lidoEm: this.deps.clock.now().toISOString() });
  }

  private async anotarSaida(
    chatId: string,
    parcial: Omit<MensagemHumanizada, 'id' | 'direcao' | 'confirmadoComo' | 'em' | 'falha'>,
  ): Promise<void> {
    const atual = await this.conversa(chatId);
    const mensagem: MensagemHumanizada = {
      ...parcial,
      id: `hs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      direcao: 'saida',
      confirmadoComo: null,
      falha: null,
      em: this.deps.clock.now().toISOString(),
    };
    await this.gravar(chatId, { ...atual, mensagens: [...atual.mensagens, mensagem] });
  }

  /** FALHA DE ENTREGA vinda do status do webhook (ex.: 131047, janela de 24h):
   *  encontra a saída pelo wamid e grava o motivo — o chat mostra o aviso. */
  async marcarFalhaEnvio(chatId: string, wamid: string, motivo: string): Promise<void> {
    const atual = await this.conversa(chatId);
    if (!atual.mensagens.some((m) => m.wamid === wamid)) {
      this.deps.aoFalhar?.(`falha de entrega sem mensagem correspondente wamid=${wamid}`);
      return;
    }
    await this.gravar(chatId, {
      ...atual,
      mensagens: atual.mensagens.map((m) => (m.wamid === wamid ? { ...m, falha: motivo } : m)),
    });
  }

  /** Texto da secretária → cliente. Falha do Graph (ex.: janela de 24h vencida,
   *  erro 131047) volta LEGÍVEL — a secretária sabe que precisa do template. */
  async enviarTexto(chatId: string, texto: string, autor: string): Promise<Resultado> {
    if (this.deps.envio === null) return { ok: false, error: SEM_CANAL };
    const limpo = texto.trim();
    if (limpo === '') return { ok: false, error: 'mensagem vazia' };
    const receipt = await this.deps.envio.sendText(chatId, limpo);
    if (receipt.providerMessageId === '')
      return {
        ok: false,
        error:
          'a Meta recusou o envio — se o cliente está há mais de 24h sem escrever, inicie pelo template',
      };
    await this.anotarSaida(chatId, {
      tipo: 'texto',
      texto: limpo,
      nomeArquivo: null,
      mime: null,
      sha256: null,
      autor,
      // O wamid correlaciona o STATUS de entrega — falha assíncrona da Meta
      // (ex.: janela de 24h) volta e marca ESTA mensagem no chat.
      wamid: receipt.providerMessageId,
    });
    return { ok: true };
  }

  /** Documento (ex.: procuração em PDF) da secretária → cliente. O blob fica
   *  no media store — a própria conversa consegue reabrir o que foi enviado. */
  async enviarDocumento(
    chatId: string,
    anexo: { readonly nome: string; readonly base64: string },
    autor: string,
  ): Promise<Resultado> {
    if (this.deps.envio === null) return { ok: false, error: SEM_CANAL };
    // A MESMA régua do docs-equipe (magic bytes + 20 MB) — validada ao guardar.
    const guardado = await guardarBase64(this.deps.media, anexo.base64);
    if (!guardado.ok) return guardado;
    const nome = anexo.nome.replace(/[^\w.\- ()]/g, '').slice(0, 120) || 'documento.pdf';
    await this.deps.envio.sendDocument(
      chatId,
      { fileName: nome, mimeType: guardado.mime, base64: anexo.base64 },
      '',
    );
    await this.anotarSaida(chatId, {
      tipo: 'documento',
      texto: null,
      nomeArquivo: nome,
      mime: guardado.mime,
      sha256: guardado.sha256,
      autor,
    });
    return { ok: true };
  }

  /** ÁUDIO da secretária → cliente (decreto 2026-08-06). O blob fica no media
   *  store — a própria conversa toca o que foi enviado. A Meta só aceita
   *  OGG/Opus, AAC, MP4, MPEG ou AMR — o gravador do portal produz OGG/Opus. */
  async enviarAudio(
    chatId: string,
    anexo: { readonly mime: string; readonly base64: string },
    autor: string,
  ): Promise<Resultado> {
    if (this.deps.envio === null) return { ok: false, error: SEM_CANAL };
    const mime = anexo.mime.split(';')[0]?.trim() ?? '';
    if (!mime.startsWith('audio/'))
      return { ok: false, error: 'formato de áudio não reconhecido — grave novamente' };
    let bytes: Buffer;
    try {
      const clean = anexo.base64.includes(',')
        ? anexo.base64.slice(anexo.base64.indexOf(',') + 1)
        : anexo.base64;
      bytes = Buffer.from(clean, 'base64');
    } catch {
      return { ok: false, error: 'áudio inválido — grave novamente' };
    }
    if (bytes.length === 0) return { ok: false, error: 'áudio vazio — grave novamente' };
    if (bytes.length > 16 * 1024 * 1024)
      return { ok: false, error: 'áudio acima de 16 MB — grave um trecho menor' };
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (!(await this.deps.media.has(sha256))) {
      await this.deps.media.put({
        sha256,
        mime,
        size: bytes.length,
        bytes: new Uint8Array(bytes),
      });
    }
    const ok = await this.deps.envio.sendAudio(chatId, { mimeType: mime, base64: anexo.base64 });
    if (!ok)
      return {
        ok: false,
        error:
          'a Meta recusou o áudio — se o cliente está há mais de 24h sem escrever, inicie pelo template',
      };
    await this.anotarSaida(chatId, {
      tipo: 'audio',
      texto: null,
      nomeArquivo: 'audio.ogg',
      mime,
      sha256,
      autor,
    });
    return { ok: true };
  }

  /** Template aprovado (1º contato/retomada fora da janela de 24h).
   *  `variaveis` preenche os {{1}}, {{2}}… do corpo — ex.: o primeiro nome do
   *  cliente, que a plataforma já conhece. */
  async enviarTemplate(
    chatId: string,
    nome: string,
    autor: string,
    variaveis: readonly string[] = [],
  ): Promise<Resultado> {
    if (this.deps.envio === null) return { ok: false, error: SEM_CANAL };
    const ok = await this.deps.envio.sendTemplate(chatId, nome, 'pt_BR', variaveis);
    if (!ok)
      return {
        ok: false,
        error: `a Meta recusou o template "${nome}" — confira se ele está APROVADO no Gerenciador (e se o corpo tem a variável {{1}})`,
      };
    await this.anotarSaida(chatId, {
      tipo: 'template',
      texto: `[template ${nome} enviado${variaveis.length > 0 ? ` para ${variaveis[0] ?? ''}` : ''}]`,
      nomeArquivo: null,
      mime: null,
      sha256: null,
      autor,
    });
    return { ok: true };
  }

  /** A secretária CONFIRMA um anexo recebido como documento do cliente — o
   *  blob vai ao docs-equipe (procuração/RG/comprovante), a MESMA porta do
   *  upload manual; a mensagem fica marcada para a conversa mostrar o selo. */
  async confirmarDocumento(
    chatId: string,
    mensagemId: string,
    tipo: TipoDocEquipe,
  ): Promise<Resultado> {
    const atual = await this.conversa(chatId);
    const mensagem = atual.mensagens.find((m) => m.id === mensagemId);
    if (mensagem === undefined) return { ok: false, error: 'mensagem não encontrada' };
    if (mensagem.direcao !== 'entrada' || mensagem.sha256 === null)
      return { ok: false, error: 'esta mensagem não tem anexo do cliente' };
    const blob = await this.deps.media.read(mensagem.sha256);
    if (blob === null) return { ok: false, error: 'anexo indisponível no armazenamento' };
    const nome = mensagem.nomeArquivo ?? `${tipo}-${chatId.split('@')[0] ?? chatId}`;
    const anexado = await this.deps.docsEquipe.anexar(
      chatId,
      tipo,
      nome,
      Buffer.from(blob.bytes).toString('base64'),
    );
    if (!anexado.ok) return anexado;
    await this.gravar(chatId, {
      ...atual,
      mensagens: atual.mensagens.map((m) =>
        m.id === mensagemId ? { ...m, confirmadoComo: tipo } : m,
      ),
    });
    return { ok: true };
  }

  /** Bytes de um anexo da conversa (pré-visualização no portal). */
  async baixarAnexo(
    chatId: string,
    mensagemId: string,
  ): Promise<{ nome: string; mime: string; bytes: Uint8Array } | null> {
    const mensagem = (await this.conversa(chatId)).mensagens.find((m) => m.id === mensagemId);
    if (mensagem === undefined || mensagem.sha256 === null) return null;
    const blob = await this.deps.media.read(mensagem.sha256);
    if (blob === null) return null;
    return {
      nome: mensagem.nomeArquivo ?? 'anexo',
      mime: mensagem.mime ?? blob.mime,
      bytes: blob.bytes,
    };
  }
}

const MAGIC: ReadonlyArray<{ mime: string; bytes: readonly number[] }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
];

/** Valida (magic + 20 MB) e guarda o base64 no media store content-addressed. */
async function guardarBase64(
  media: MediaStorePort,
  base64: string,
): Promise<{ ok: true; sha256: string; mime: string } | { ok: false; error: string }> {
  let bytes: Buffer;
  try {
    const clean = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
    bytes = Buffer.from(clean, 'base64');
  } catch {
    return { ok: false, error: 'arquivo inválido' };
  }
  if (bytes.length === 0) return { ok: false, error: 'arquivo vazio' };
  if (bytes.length > 20 * 1024 * 1024) return { ok: false, error: 'arquivo acima de 20 MB' };
  const assinatura = MAGIC.find((m) => m.bytes.every((b, i) => bytes[i] === b));
  if (assinatura === undefined)
    return { ok: false, error: 'formato não aceito — envie PDF, JPG ou PNG' };
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (!(await media.has(sha256))) {
    await media.put({
      sha256,
      mime: assinatura.mime,
      size: bytes.length,
      bytes: new Uint8Array(bytes),
    });
  }
  return { ok: true, sha256, mime: assinatura.mime };
}
