// ─────────────────────────────────────────────────────────────────────────────
// A VARREDURA dos cartões em falta (caso REAL Luiz Carlos, 2026-09-28): acha na
// base quem perdeu RMC/RCC porque o HISCON só traz a tabela mensal, e devolve o
// que faltava SEM tocar na leitura de empréstimos — aditivo e reversível.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { InMemoryJsonStore } from '../production/json-store.js';
import { CartoesEmFaltaService } from './cartoes-em-falta.js';
import type { CachedText } from '../reading/document-text-cache.js';

const SHA = 'sha-luiz';
const CHAT = '5511969029834@s.whatsapp.net';
const LEITURA_SEM_CARTAO =
  'HISTÓRICO DE EMPRÉSTIMO CONSIGNADO\nEMPRÉSTIMOS BANCÁRIOS\n\nCONTRATO: 387434757-2\nBANCO: 623 - BANCO PAN\nSITUAÇÃO: EXCLUÍDO\n';
const HISTORICO_LINEAR =
  'DESCONTOS DE CARTÃO CONTRATO BANCO SALDO ' +
  '62339999731203909 26 623 - BANCO PAN S A R$11.919,69Encerrado 09/2026 R$11.919,69R$181,62 Desconto de cartao (RCC) R$29,52 ' +
  '62339999741464509 26 623 - BANCO PAN S A R$1.079,38Encerrado 09/2026 R$759,82R$181,62 Desconto de cartão (RMC) R$1,16 ';

function montar(texto: string, linear: string | null) {
  const json = new InMemoryJsonStore();
  const guardado = new Map<string, CachedText>();
  guardado.set(SHA, { sha256: SHA, text: texto, model: 'v2', chars: texto.length, readAt: 'x' });
  void json.put('onboarding-documental', CHAT, {
    chatId: CHAT,
    recebidos: [{ codigo: 'CNIS', documentId: 'doc-1' }],
  });
  const servico = new CartoesEmFaltaService({
    json,
    links: { byDocumentId: () => Promise.resolve({ sha256: SHA }) },
    media: {
      read: () => Promise.resolve({ mime: 'application/pdf', bytes: new Uint8Array([1]) }),
    } as never,
    cache: {
      get: (sha: string) => Promise.resolve(guardado.get(sha) ?? null),
      put: (e: CachedText) => {
        guardado.set(e.sha256, e);
        return Promise.resolve();
      },
    },
    clock: { now: () => new Date('2026-09-28T12:00:00.000Z') },
    lerLinear: () => Promise.resolve(linear),
  });
  return { servico, json, guardado };
}

describe('CartoesEmFaltaService', () => {
  it('acha o cliente que perdeu os cartões — e sem aplicar não grava nada', async () => {
    const { servico, guardado } = montar(LEITURA_SEM_CARTAO, HISTORICO_LINEAR);
    const r = await servico.varrer();
    expect(r.comCartoesEmFalta).toBe(1);
    expect(r.cartoesEncontrados).toBe(2); // 1 RCC + 1 RMC = 2 processos no guia
    expect(r.aplicados).toBe(0);
    expect(guardado.get(SHA)?.text).toBe(LEITURA_SEM_CARTAO); // intocado
  });

  it('aplicando: o texto antigo vai INTEIRO e os cartões entram no fim', async () => {
    const { servico, guardado, json } = montar(LEITURA_SEM_CARTAO, HISTORICO_LINEAR);
    const r = await servico.varrer({ aplicar: true });
    expect(r.aplicados).toBe(1);
    const novo = guardado.get(SHA)?.text ?? '';
    expect(novo.startsWith(LEITURA_SEM_CARTAO)).toBe(true); // empréstimos intactos
    expect(novo).toContain('CARTÃO RCC');
    expect(novo).toContain('CARTÃO RMC');
    // Reversível: o texto anterior fica guardado.
    const backup = (await json.get('document-text-backup', SHA)) as { texto: string } | null;
    expect(backup?.texto).toBe(LEITURA_SEM_CARTAO);
  });

  it('quem JÁ tem cartão na leitura é pulado (nunca dois cartões para o mesmo)', async () => {
    const comCartao = `${LEITURA_SEM_CARTAO}\nCARTÃO RMC\nCONTRATO: 999\n`;
    const { servico } = montar(comCartao, HISTORICO_LINEAR);
    const r = await servico.varrer({ aplicar: true });
    expect(r.comCartoesEmFalta).toBe(0);
    expect(r.linhas[0]?.resultado).toBe('JA_TEM_CARTOES');
  });

  it('documento sem histórico de cartão não vira cartão nenhum', async () => {
    const { servico } = montar(LEITURA_SEM_CARTAO, 'EMPRÉSTIMOS BANCÁRIOS apenas');
    const r = await servico.varrer({ aplicar: true });
    expect(r.comCartoesEmFalta).toBe(0);
    expect(r.linhas[0]?.resultado).toBe('SEM_CARTOES_NO_DOCUMENTO');
  });

  it('PDF ilegível é relatado, nunca "corrigido" no escuro', async () => {
    const { servico } = montar(LEITURA_SEM_CARTAO, null);
    const r = await servico.varrer({ aplicar: true });
    expect(r.linhas[0]?.resultado).toBe('PDF_ILEGIVEL');
    expect(r.aplicados).toBe(0);
  });
});
