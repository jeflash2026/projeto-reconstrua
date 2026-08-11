// ─────────────────────────────────────────────────────────────────────────────
// TRANSFERÊNCIA DE ATENDIMENTO ENTRE NÚMEROS (2026-08-11) — o cliente troca de
// chip/aparelho e quer continuar do outro número (caso REAL Maria da Piedade
// Roza). Sem isto, o atendimento novo nasce do zero: a AHRI não reconhece a
// pessoa, pede CPF e HISCON de novo, e a mesa do Humanizado passa a mostrar
// dois cadastros da mesma cliente.
//
// A identidade do cliente é o chatId (o JID do WhatsApp) e ela atravessa
// DEZENAS de namespaces — conversa, memória, sessão, jornada, onboarding
// documental, status do humanizado, disparos, parecer, liberação do portal.
// Listar esses namespaces à mão envelhece e esquece algum; por isso a
// transferência VARRE o armazenamento inteiro atrás do JID antigo e reescreve
// tudo o que o cita — no namespace, na chave e dentro do documento.
//
// Regras:
//   • nada é enviado ao cliente (decreto anti-automático: isto é dado);
//   • o estado ANTERIOR (origem e destino) vai inteiro para um backup antes da
//     primeira escrita — a operação é revisável;
//   • a conversa antiga MIGRA junto (as chaves são por instante, então os
//     históricos se fundem em ordem cronológica);
//   • se o destino já tiver cadastro próprio, o da ORIGEM prevalece — é ele que
//     carrega o histórico, o HISCON e a confirmação.
// ─────────────────────────────────────────────────────────────────────────────
import type { Clock } from '@reconstrua/domain';
import type { JsonStore, JsonStoreVarredura, LinhaDocumento } from '../production/json-store.js';

const NS_BACKUP = 'transferencia-numero-backup';
const SUFIXO_JID = '@s.whatsapp.net';

/** Aceita "553182232880", "+55 31 8223-2880" ou o JID completo. */
export function comoJid(entrada: string): string {
  const bruto = entrada.trim();
  const digitos = (bruto.includes('@') ? (bruto.split('@')[0] ?? '') : bruto).replace(/\D/g, '');
  return `${digitos}${SUFIXO_JID}`;
}

export interface GrupoAfetado {
  readonly namespace: string;
  readonly linhas: number;
}

export interface PreviaTransferencia {
  readonly origem: string;
  readonly destino: string;
  /** Quantas linhas do armazenamento citam o número de origem. */
  readonly linhasOrigem: number;
  /** O que o destino já tem hoje (preservado no backup, sobrescrito na troca). */
  readonly linhasDestino: number;
  readonly grupos: readonly GrupoAfetado[];
  /** Mensagens de conversa que vão junto (namespace conv:…). */
  readonly mensagens: number;
  readonly podeTransferir: boolean;
  readonly motivo: string | null;
}

export interface ResultadoTransferencia {
  readonly ok: true;
  readonly origem: string;
  readonly destino: string;
  readonly linhasMovidas: number;
  readonly backupEm: string;
}

export interface TransferenciaNumeroDeps {
  readonly json: JsonStore & JsonStoreVarredura;
  readonly clock: Clock;
  /** Invalida caches de leitura (mesa do humanizado, listas) após a troca. */
  readonly invalidar?: () => void;
}

export class TransferenciaDeNumero {
  constructor(private readonly deps: TransferenciaNumeroDeps) {}

  /** PRÉVIA (só leitura): o que exatamente vai se mover. */
  async previa(origemBruta: string, destinoBruto: string): Promise<PreviaTransferencia> {
    const origem = comoJid(origemBruta);
    const destino = comoJid(destinoBruto);
    if (origem === destino)
      return {
        origem,
        destino,
        linhasOrigem: 0,
        linhasDestino: 0,
        grupos: [],
        mensagens: 0,
        podeTransferir: false,
        motivo: 'os dois números são o mesmo',
      };

    const [linhasOrigem, linhasDestino] = await Promise.all([
      this.deps.json.varrer(origem),
      this.deps.json.varrer(destino),
    ]);

    const contagem = new Map<string, number>();
    for (const l of linhasOrigem) {
      const rotulo = l.namespace.startsWith('conv:')
        ? 'conversa (mensagens)'
        : l.namespace.startsWith('conv-idx:')
          ? 'conversa (índice)'
          : l.namespace;
      contagem.set(rotulo, (contagem.get(rotulo) ?? 0) + 1);
    }
    const grupos = [...contagem.entries()]
      .map(([namespace, linhas]) => ({ namespace, linhas }))
      .sort((a, b) => b.linhas - a.linhas);

    return {
      origem,
      destino,
      linhasOrigem: linhasOrigem.length,
      linhasDestino: linhasDestino.length,
      grupos,
      mensagens: linhasOrigem.filter((l) => l.namespace.startsWith('conv:')).length,
      podeTransferir: linhasOrigem.length > 0,
      motivo: linhasOrigem.length > 0 ? null : 'não há nenhum registro no número de origem',
    };
  }

  /** TRANSFERE: tudo o que era do número antigo passa a ser do novo. */
  async transferir(origemBruta: string, destinoBruto: string): Promise<ResultadoTransferencia> {
    const origem = comoJid(origemBruta);
    const destino = comoJid(destinoBruto);
    if (origem === destino) throw new Error('os dois números são o mesmo');

    const [linhasOrigem, linhasDestino] = await Promise.all([
      this.deps.json.varrer(origem),
      this.deps.json.varrer(destino),
    ]);
    if (linhasOrigem.length === 0) throw new Error('não há nenhum registro no número de origem');

    // BACKUP ANTES DA PRIMEIRA ESCRITA — origem e destino, como estavam.
    const backupEm = this.deps.clock.now().toISOString();
    await this.deps.json.put(NS_BACKUP, `${destino}|${backupEm}`, {
      origem,
      destino,
      em: backupEm,
      linhas: [...linhasOrigem, ...linhasDestino],
    });

    for (const linha of linhasOrigem) {
      const novo = this.reescrever(linha, origem, destino);
      await this.deps.json.put(novo.namespace, novo.key, novo.value);
      const mudouDeLugar = novo.namespace !== linha.namespace || novo.key !== linha.key;
      if (mudouDeLugar) await this.deps.json.del(linha.namespace, linha.key);
    }

    this.deps.invalidar?.();
    return { ok: true, origem, destino, linhasMovidas: linhasOrigem.length, backupEm };
  }

  /** Troca o número antigo pelo novo no namespace, na chave e no documento — o
   *  JID é uma cadeia específica o bastante para a substituição ser segura. */
  private reescrever(linha: LinhaDocumento, origem: string, destino: string): LinhaDocumento {
    const conteudo = JSON.stringify(linha.value ?? null);
    return {
      namespace: linha.namespace.split(origem).join(destino),
      key: linha.key.split(origem).join(destino),
      value: JSON.parse(conteudo.split(origem).join(destino)) as unknown,
    };
  }
}
