// ─────────────────────────────────────────────────────────────────────────────
// PERICIA SERVICE (Decreto Dossiê Pericial 2026-07-21) — monta a visão do
// PERITO a partir do HISCON JÁ TRANSCRITO: contabilidade documental (ns
// 'onboarding-documental') → documentId do CNIS → DocumentReaderService (cache
// por sha) → parseHisconDetalhado. Nada aqui decide nem escreve: só organiza fatos.
// A destinação a advogado é SEMPRE manual do admin (contratos MIGRADOS ficam
// listados prontos para essa decisão — sem pedido administrativo).
// ─────────────────────────────────────────────────────────────────────────────
import {
  agruparPorBanco,
  contratosDaJanela,
  contratosMigrados,
  contratosParaPedidoAdministrativo,
  indiciosDeEstrategias,
  parseHisconDetalhado,
  type BancoComContratos,
  type ContratoHiscon,
  type HisconExtraido,
  type IndicioDeEstrategia,
} from '@reconstrua/application';
import type { Clock } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';
import type { DocumentReaderService } from '../reading/document-reader-service.js';

const NS_ONBOARDING = 'onboarding-documental';
const NS_JORNADA = 'jornada';
const JANELA_ANOS = 5;

interface OnboardingPersisted {
  readonly chatId: string;
  readonly recebidos?: readonly { codigo: string; documentId: string; subtipo?: 'rg' | 'cnh' }[];
}

export interface DossiePericial {
  readonly chatId: string;
  readonly nomeCliente: string | null;
  readonly beneficio: {
    readonly beneficiario: string | null;
    readonly numeroBeneficio: string | null;
    readonly bancoPagamento: string | null;
  };
  readonly margens: HisconExtraido['margens'];
  readonly janelaAnos: number;
  readonly porBanco: readonly BancoComContratos[];
  readonly migrados: readonly ContratoHiscon[];
  readonly filaPedidoAdministrativo: readonly ContratoHiscon[];
  readonly indicios: readonly IndicioDeEstrategia[];
  readonly totalContratos: number;
}

export interface MigradosDoCliente {
  readonly chatId: string;
  readonly nomeCliente: string | null;
  readonly porBanco: readonly BancoComContratos[];
  readonly totalMigrados: number;
}

export interface PericiaServiceDeps {
  readonly json: JsonStore;
  readonly reader: DocumentReaderService;
  readonly clock: Clock;
  /** Teto de juros mensal para o indício EST-CONSIG-JUROS (ausente ⇒ sem indício). */
  readonly tetoJurosMensal?: number | null;
}

export class PericiaService {
  constructor(private readonly deps: PericiaServiceDeps) {}

  /** documentId → rótulo HUMANO ("RG (frente)", "Comprovante de endereço",
   *  "HISCON") a partir da contabilidade documental — para o Dossiê Jurídico e
   *  as timelines pararem de exibir "documento 094d7a2b". */
  async rotulosDosDocumentos(chatId: string): Promise<Record<string, string>> {
    const onboarding = (await this.deps.json.get(
      NS_ONBOARDING,
      chatId,
    )) as OnboardingPersisted | null;
    const out: Record<string, string> = {};
    let faceRg = 0;
    for (const r of onboarding?.recebidos ?? []) {
      if (r.codigo === 'IDENTIDADE') {
        if (r.subtipo === 'cnh') out[r.documentId] = 'CNH';
        else {
          faceRg += 1;
          out[r.documentId] = faceRg === 1 ? 'RG (frente)' : 'RG (verso)';
        }
      } else if (r.codigo === 'COMPROVANTE_RESIDENCIA')
        out[r.documentId] = 'Comprovante de endereço';
      else if (r.codigo === 'CNIS') out[r.documentId] = 'HISCON (extrato do INSS)';
      else out[r.documentId] = r.codigo;
    }
    return out;
  }

  private async nomeDoCliente(chatId: string): Promise<string | null> {
    const jornada = (await this.deps.json.get(NS_JORNADA, chatId)) as {
      nome?: string | null;
    } | null;
    return jornada?.nome ?? null;
  }

  private async extrairHiscon(chatId: string): Promise<HisconExtraido | null> {
    const onboarding = (await this.deps.json.get(
      NS_ONBOARDING,
      chatId,
    )) as OnboardingPersisted | null;
    const cnis = onboarding?.recebidos?.find((r) => r.codigo === 'CNIS') ?? null;
    if (cnis === null) return null;
    const texto = await this.deps.reader.readById(cnis.documentId);
    if (texto === null) return null;
    return parseHisconDetalhado(texto);
  }

  /** O dossiê do PERITO para um cliente — null quando ainda não há HISCON legível. */
  async dossie(chatId: string): Promise<DossiePericial | null> {
    const extraido = await this.extrairHiscon(chatId);
    if (extraido === null) return null;
    const janela = contratosDaJanela(extraido.contratos, this.deps.clock.now(), JANELA_ANOS);
    return {
      chatId,
      nomeCliente: await this.nomeDoCliente(chatId),
      beneficio: {
        beneficiario: extraido.beneficiario,
        numeroBeneficio: extraido.numeroBeneficio,
        bancoPagamento: extraido.bancoPagamento,
      },
      margens: extraido.margens,
      janelaAnos: JANELA_ANOS,
      porBanco: agruparPorBanco(janela),
      migrados: contratosMigrados(janela),
      filaPedidoAdministrativo: contratosParaPedidoAdministrativo(janela),
      indicios: indiciosDeEstrategias(extraido, {
        tetoJurosMensal: this.deps.tetoJurosMensal ?? null,
      }),
      totalContratos: janela.length,
    };
  }

  /** ABA "Contratos Migrados": todos os clientes com HISCON, só os migrados,
   *  agrupados por banco — prontos para a destinação MANUAL a advogados. */
  async migradosDeTodos(): Promise<readonly MigradosDoCliente[]> {
    const chats = await this.deps.json.keys(NS_ONBOARDING);
    const out: MigradosDoCliente[] = [];
    for (const chatId of chats) {
      const extraido = await this.extrairHiscon(chatId).catch(() => null);
      if (extraido === null) continue;
      const janela = contratosDaJanela(extraido.contratos, this.deps.clock.now(), JANELA_ANOS);
      const migrados = contratosMigrados(janela);
      if (migrados.length === 0) continue;
      out.push({
        chatId,
        nomeCliente: await this.nomeDoCliente(chatId),
        porBanco: agruparPorBanco(migrados),
        totalMigrados: migrados.length,
      });
    }
    return out;
  }
}
