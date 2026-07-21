// ─────────────────────────────────────────────────────────────────────────────
// PericiaService — o fio completo: ns 'onboarding-documental' (CNIS→documentId)
// → leitor (texto transcrito) → parseHiscon → visões do perito e da aba de
// Contratos Migrados. Reader fake devolve um HISCON mínimo REAL de formato.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { InMemoryJsonStore } from '../production/json-store.js';
import { PericiaService } from './pericia-service.js';
import type { DocumentReaderService } from '../reading/document-reader-service.js';

const NOW = new Date('2026-07-21T12:00:00Z');
const CHAT = '5517996332346@s.whatsapp.net';

const HISCON = `HISTÓRICO DE
EMPRÉSTIMO CONSIGNADO

ISABEL MARQUES CALDEIRA RODRIGUES

Nº Benefício: 186.472.726-5
Pago em: BANCO BRADESCO S A

BASE DE CÁLCULO | R$1.621,00
MÁXIMO DE COMPROMETIMENTO PERMITIDO | R$648,40
TOTAL COMPROMETIDO | R$648,40

EMPRÉSTIMOS BANCÁRIOS

CONTRATO: MIGRA1
BANCO: 753 - NOVO BANCO CONTINENTAL S A
SITUAÇÃO: Ativo
ORIGEM DA AVERBAÇÃO: Migrado do contrato MIGRA1 CBC: 329
DATA INCLUSÃO: 27/02/26
VALOR PARCELA: R$36,05

CONTRATO: NORMAL1
BANCO: 237 - BANCO BRADESCO S A
SITUAÇÃO: Ativo
ORIGEM DA AVERBAÇÃO: Averbação nova
DATA INCLUSÃO: 15/04/25
VALOR PARCELA: R$89,57
`;

function servico(texto: string | null): { svc: PericiaService; json: InMemoryJsonStore } {
  const json = new InMemoryJsonStore();
  const reader = { readById: () => Promise.resolve(texto) } as unknown as DocumentReaderService;
  return { svc: new PericiaService({ json, reader, clock: { now: () => NOW } }), json };
}

describe('PericiaService · dossiê do perito', () => {
  it('cliente com CNIS ⇒ dossiê com bancos, migrados e fila do perito', async () => {
    const { svc, json } = servico(HISCON);
    await json.put('onboarding-documental', CHAT, {
      chatId: CHAT,
      recebidos: [
        { codigo: 'IDENTIDADE', documentId: 'd-rg' },
        { codigo: 'CNIS', documentId: 'd-hiscon' },
      ],
    });
    await json.put('jornada', CHAT, { chatId: CHAT, nome: 'Isabel' });

    const dossie = await svc.dossie(CHAT);
    expect(dossie).not.toBeNull();
    expect(dossie?.nomeCliente).toBe('Isabel');
    expect(dossie?.beneficio.numeroBeneficio).toBe('186.472.726-5');
    expect(dossie?.totalContratos).toBe(2);
    expect(dossie?.migrados.map((c) => c.contrato)).toEqual(['MIGRA1']);
    expect(dossie?.filaPedidoAdministrativo.map((c) => c.contrato)).toEqual(['NORMAL1']);
    expect(dossie?.porBanco.map((b) => b.bancoNome)).toEqual(['BANCO BRADESCO S A', 'NOVO BANCO CONTINENTAL S A']);
  });

  it('sem CNIS na contabilidade ⇒ null (sem inventar)', async () => {
    const { svc, json } = servico(HISCON);
    await json.put('onboarding-documental', CHAT, { chatId: CHAT, recebidos: [{ codigo: 'IDENTIDADE', documentId: 'd-rg' }] });
    expect(await svc.dossie(CHAT)).toBeNull();
  });

  it('transcrição indisponível ⇒ null', async () => {
    const { svc, json } = servico(null);
    await json.put('onboarding-documental', CHAT, { chatId: CHAT, recebidos: [{ codigo: 'CNIS', documentId: 'd-h' }] });
    expect(await svc.dossie(CHAT)).toBeNull();
  });
});

describe('PericiaService · aba Contratos Migrados (todos os clientes)', () => {
  it('lista só clientes COM migrados, por banco, com nome da jornada', async () => {
    const { svc, json } = servico(HISCON);
    await json.put('onboarding-documental', CHAT, { chatId: CHAT, recebidos: [{ codigo: 'CNIS', documentId: 'd-h' }] });
    await json.put('jornada', CHAT, { chatId: CHAT, nome: 'Isabel' });

    const lista = await svc.migradosDeTodos();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ chatId: CHAT, nomeCliente: 'Isabel', totalMigrados: 1 });
    expect(lista[0]?.porBanco[0]?.bancoNome).toBe('NOVO BANCO CONTINENTAL S A');
  });
});
