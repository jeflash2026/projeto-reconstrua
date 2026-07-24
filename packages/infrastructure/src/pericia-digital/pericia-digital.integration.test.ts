// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · integração (Decreto 2026-07-24, item 14).
// Dados FICTÍCIOS. Prova: custódia inviolável, original preservado, ciclo com
// revisão humana obrigatória e trava de emissão. In-memory (JsonStore mock).
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest';
import type { HisconExtraido } from '@reconstrua/application';
import type { Clock, Uuid, UuidGenerator } from '@reconstrua/domain';
import type { JsonStore } from '../production/json-store.js';
import { CustodiaService } from './custodia.js';
import { JsonCasoStore } from './caso-store.js';
import { PericiaDigitalService } from './pericia-digital-service.js';

class MemJson implements JsonStore {
  private readonly m = new Map<string, Map<string, unknown>>();
  private ns(n: string): Map<string, unknown> {
    let x = this.m.get(n);
    if (!x) {
      x = new Map();
      this.m.set(n, x);
    }
    return x;
  }
  get(n: string, k: string): Promise<unknown> {
    return Promise.resolve(this.ns(n).get(k) ?? null);
  }
  put(n: string, k: string, v: unknown): Promise<void> {
    this.ns(n).set(k, v);
    return Promise.resolve();
  }
  del(n: string, k: string): Promise<void> {
    this.ns(n).delete(k);
    return Promise.resolve();
  }
  list(n: string): Promise<readonly unknown[]> {
    return Promise.resolve([...this.ns(n).values()]);
  }
  keys(n: string): Promise<readonly string[]> {
    return Promise.resolve([...this.ns(n).keys()]);
  }
}

let seq = 0;
const uuid: UuidGenerator = { next: () => `id-${String(++seq)}` as Uuid };
const clock: Clock = { now: () => new Date('2026-07-24T12:00:00.000Z') };

const HISCON: HisconExtraido = {
  beneficiario: 'MARIA FICTICIA',
  numeroBeneficio: '1234567890',
  situacaoBeneficio: null,
  bancoPagamento: null,
  contratos: [
    {
      contrato: '111222333',
      bancoCodigo: '001',
      bancoNome: 'BANCO EXEMPLO',
      situacao: 'Ativo',
      origemAverbacao: 'Nova',
      dataInclusao: null,
      competenciaInicio: '03/2024',
      competenciaFim: '02/2028',
      qtdeParcelas: 48,
      valorParcela: 200,
      valorEmprestado: 8000,
    },
  ],
  // campos não usados pelo serviço:
} as unknown as HisconExtraido;

function montar(hiscon: HisconExtraido | null = HISCON) {
  seq = 0;
  const json = new MemJson();
  const custodia = new CustodiaService({ json, clock, uuid });
  const casos = new JsonCasoStore(json);
  const svc = new PericiaDigitalService({
    casos,
    custodia,
    clock,
    uuid,
    extrairHiscon: () => Promise.resolve(hiscon),
  });
  return { svc, custodia, casos };
}

const PERITO = {
  nomeCompleto: 'Perito Fulano',
  cpf: '11144477735',
  qualificacao: 'Perito em documentoscopia',
  especialidades: 'Documentos eletrônicos',
  registroProfissional: 'CREA 123',
  curriculoResumido: 'Dez anos de experiência.',
  declaracaoResponsabilidade: true,
  confirmouExameDosArquivos: true,
};

describe('Central de Perícia Digital — integração', () => {
  let amb: ReturnType<typeof montar>;
  beforeEach(() => {
    amb = montar();
  });

  it('cria o caso do HISCON com uma ficha por contrato e registra na custódia', async () => {
    const r = await amb.svc.criarCasoDoHiscon('chat-1', 'C-2026-001', 'admin');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.fichas).toHaveLength(1);
    expect(r.valor.status).toBe('CONTRATOS_IDENTIFICADOS');
    const trilha = await amb.custodia.trilha(r.valor.id);
    expect(trilha[0]?.acao).toBe('CASO_CRIADO');
    expect((await amb.custodia.verificar(r.valor.id)).integro).toBe(true);
  });

  it('sem HISCON legível ⇒ não cria caso', async () => {
    const vazio = montar(null);
    expect((await vazio.svc.criarCasoDoHiscon('x', 'C', 'admin')).ok).toBe(false);
  });

  it('registra documento com hash SHA-256 e preserva o original (derivado à parte)', async () => {
    const r = await amb.svc.criarCasoDoHiscon('chat-1', 'C-1', 'admin');
    if (!r.ok) return;
    const doc = await amb.svc.registrarDocumento(
      r.valor.id,
      {
        nomeOriginal: 'contrato.pdf',
        base64: Buffer.from('conteudo ficticio').toString('base64'),
        categoria: 'CONTRATO_ELETRONICO',
        origem: 'BANCO',
        responsavelEnvio: 'banco',
      },
      'perito',
    );
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    expect(doc.valor.hashSha256).toHaveLength(64);
    expect(doc.valor.formato).toBe('pdf');
    // derivado aponta o original e NÃO o substitui
    const deriv = await amb.svc.registrarDocumento(
      r.valor.id,
      {
        nomeOriginal: 'contrato-ocr.txt',
        base64: Buffer.from('texto ocr').toString('base64'),
        categoria: 'CONTRATO_ELETRONICO',
        origem: 'AHRI',
        responsavelEnvio: 'sistema',
        derivadoDe: doc.valor.id,
      },
      'sistema',
    );
    if (!deriv.ok) return;
    const caso = await amb.casos.porId(r.valor.id);
    expect(caso?.documentos).toHaveLength(2);
    expect(deriv.valor.derivadoDe).toBe(doc.valor.id);
  });

  it('fluxo completo: minuta → revisão → aprovação do perito → assinatura → liberação', async () => {
    const r = await amb.svc.criarCasoDoHiscon('chat-1', 'C-1', 'admin');
    if (!r.ok) return;
    const id = r.valor.id;
    expect((await amb.svc.iniciarAnalise(id, 'perito')).ok).toBe(true);
    expect((await amb.svc.gerarMinuta(id, 'E', 'sistema')).ok).toBe(true);
    expect((await amb.svc.submeterRevisao(id, 'admin')).ok).toBe(true);
    expect((await amb.svc.aprovar(id, PERITO, 'perito')).ok).toBe(true);
    expect((await amb.svc.assinar(id, 'perito')).ok).toBe(true);
    const lib = await amb.svc.liberarParaAdvogado(id, 'admin');
    expect(lib.ok).toBe(true);
    if (lib.ok) expect(lib.valor.status).toBe('LIBERADO_PARA_O_ADVOGADO');
    // A custódia continua íntegra ao fim do fluxo.
    expect((await amb.custodia.verificar(id)).integro).toBe(true);
  });

  it('NÃO libera sem passar pelo perito (revisão humana obrigatória)', async () => {
    const r = await amb.svc.criarCasoDoHiscon('chat-1', 'C-1', 'admin');
    if (!r.ok) return;
    await amb.svc.iniciarAnalise(r.valor.id, 'perito');
    await amb.svc.gerarMinuta(r.valor.id, 'E', 'sistema');
    // Tentar liberar direto, sem aprovação/assinatura ⇒ bloqueado.
    const lib = await amb.svc.liberarParaAdvogado(r.valor.id, 'admin');
    expect(lib.ok).toBe(false);
  });

  it('aprovação com dados incompletos do perito é recusada', async () => {
    const r = await amb.svc.criarCasoDoHiscon('chat-1', 'C-1', 'admin');
    if (!r.ok) return;
    await amb.svc.iniciarAnalise(r.valor.id, 'perito');
    await amb.svc.gerarMinuta(r.valor.id, 'E', 'sistema');
    await amb.svc.submeterRevisao(r.valor.id, 'admin');
    const bad = await amb.svc.aprovar(
      r.valor.id,
      { ...PERITO, declaracaoResponsabilidade: false },
      'perito',
    );
    expect(bad.ok).toBe(false);
  });

  it('custódia DETECTA adulteração (hash encadeado quebrado)', async () => {
    const r = await amb.svc.criarCasoDoHiscon('chat-1', 'C-1', 'admin');
    if (!r.ok) return;
    await amb.svc.iniciarAnalise(r.valor.id, 'perito');
    await amb.svc.gerarMinuta(r.valor.id, 'E', 'sistema');
    // Adultera diretamente um evento no store (simula manipulação).
    const json = (amb.custodia as unknown as { deps: { json: MemJson } }).deps.json;
    const eventos = (await json.get('pericia-custodia', r.valor.id)) as { detalhe: string }[];
    eventos[0] = { ...eventos[0], detalhe: 'ALTERADO INDEVIDAMENTE' };
    await json.put('pericia-custodia', r.valor.id, eventos);
    const v = await amb.custodia.verificar(r.valor.id);
    expect(v.integro).toBe(false);
    expect(v.quebrouEmSeq).toBe(0);
  });
});
