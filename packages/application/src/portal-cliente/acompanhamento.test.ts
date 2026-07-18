// ─────────────────────────────────────────────────────────────────────────────
// VISÃO DE ACOMPANHAMENTO (PC-R1) — testes: as 5 perguntas em linguagem humana
// (Princípios 4/5/7), filtro do dizível (o MESMO da AHRI), prazo por política
// única (D1), transparência sem exposição (Princípio 6 — teste de NEGAÇÃO de
// vazamento) e respostas neutras para não-clientes.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { ClientesList, ClienteResumo } from '../clientes/clientes-list.js';
import type { MemoryStore } from '../living-memory/ports.js';
import { emptyMemory, type ClientMemory } from '../living-memory/client-memory.js';
import type { AssignmentStore, CaseAssignment, JuridicalEntry, JuridicalWorkStore } from '../advogado-portal/juridical-work.js';
import type { StaffMember, StaffRole, StaffStore } from '../admin-portal/staff-directory.js';
import { AcompanhamentoView, type LiberacaoPortal } from './acompanhamento.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');

function resumo(over: Partial<ClienteResumo>): ClienteResumo {
  return {
    clienteId: 'cli-1', chatId: 'c1', missionId: 'm1', quem: 'Maria', status: 'EM_PROCESSO',
    modalidade: 'SOCIEDADE', pronto: true, faltando: [], saude: 'GREEN', ultimoContatoAt: NOW,
    pedidosConfirmadosEm: null,
    ...over,
  };
}

const ENTRIES: JuridicalEntry[] = [
  { id: 'j1', advogadoId: 'adv-1', missionId: 'm1', kind: 'numero_processo', text: '0001234-55.2026.4.04.7000', dueAt: null, attachmentRef: null, done: true, createdAt: NOW },
  // GO-LIVE-02: o cliente vê SÓ a versão humanizada (textoCliente) — nunca o original.
  { id: 'j2', advogadoId: 'adv-1', missionId: 'm1', kind: 'movimentacao', text: 'Expedido mandado de citação da autarquia (INSS).', textoCliente: 'O juiz pediu que o INSS seja oficialmente informado do seu processo — um passo normal do caminho, e eu sigo acompanhando.', dueAt: null, attachmentRef: null, done: true, createdAt: new Date('2026-07-17T10:00:00.000Z') },
  // INTERNA — jamais pode aparecer para o cliente (Princípio 6):
  { id: 'j3', advogadoId: 'adv-1', missionId: 'm1', kind: 'observacao', text: 'ESTRATEGIA-INTERNA: aguardar jurisprudência do TRF4.', dueAt: null, attachmentRef: null, done: false, createdAt: NOW },
  // PENDENTE de tradução (fail-closed): dizível, mas AINDA sem versão humana ⇒ não aparece.
  { id: 'j4', advogadoId: 'adv-1', missionId: 'm1', kind: 'despacho', text: 'JURIDIQUES-CRU: intimem-se as partes na forma do art. 269.', dueAt: null, attachmentRef: null, done: true, createdAt: NOW },
];

function view(clientes: readonly ClienteResumo[], liberacao: LiberacaoPortal | null = null, estimativaDias = 12) {
  const fakeClientes = { list: () => Promise.resolve(clientes) } as unknown as ClientesList;
  const memory: MemoryStore = {
    load: (chatId: string): Promise<ClientMemory | null> =>
      Promise.resolve({
        ...emptyMemory(chatId),
        documentsSent: [{ ref: 'd1', label: 'Documento de identidade', source: { kind: 'domain_event', ref: 'e', at: NOW } }],
      }),
    save: () => Promise.resolve(),
    all: () => Promise.resolve([]),
  };
  const juridical: JuridicalWorkStore = {
    save: () => Promise.resolve(),
    byId: () => Promise.resolve(null),
    byAdvogado: () => Promise.resolve([]),
    byMission: (missionId: string) => Promise.resolve(ENTRIES.filter((e) => e.missionId === missionId)),
  };
  const assignments: AssignmentStore = {
    save: () => Promise.resolve(),
    byMission: (missionId: string): Promise<CaseAssignment | null> =>
      Promise.resolve(missionId === 'm1' ? { missionId, advogadoId: 'adv-1', assignedBy: 'admin', assignedAt: NOW } : null),
    byAdvogado: () => Promise.resolve([]),
  };
  const staff: StaffStore = {
    save: () => Promise.resolve(),
    byId: (id: string): Promise<StaffMember | null> =>
      Promise.resolve(id === 'adv-1' ? { id, role: 'advogado' as StaffRole, name: 'Dra. Ana Lima', email: null, active: true, createdAt: NOW, updatedAt: NOW } : null),
    byRole: () => Promise.resolve([]),
    all: () => Promise.resolve([]),
  };
  return new AcompanhamentoView({
    clientes: fakeClientes,
    memory,
    juridical,
    assignments,
    staff,
    liberacao: () => Promise.resolve(liberacao),
    config: { estimativaDias, whatsapp: '554137989737' },
  });
}

describe('AcompanhamentoView · as 5 perguntas em linguagem humana', () => {
  it('EM_PROCESSO: advogado pelo nome, processo, atualizações dizíveis, voz da AHRI', async () => {
    const a = await view([resumo({})]).acompanhamento('cli-1', NOW);
    expect(a?.ondeEsta).toBe('Processo em andamento');
    expect(a?.agora).toContain('Dra. Ana Lima');
    expect(a?.precisaFazerAlgo).toContain('estou cuidando de tudo');
    expect(a?.advogado).toEqual({ nome: 'Dra. Ana Lima' });
    expect(a?.processo?.numero).toBe('0001234-55.2026.4.04.7000');
    expect(a?.atualizacoes).toHaveLength(1); // só o dizível JÁ humanizado
    expect(a?.atualizacoes[0]?.texto).toContain('um passo normal do caminho'); // textoCliente, nunca o original
    expect(a?.documentosRecebidos).toEqual(['Documento de identidade']);
    expect(a?.whatsapp).toBe('554137989737');
    expect(a?.etapas.map((e) => e.situacao)).toEqual(['concluida', 'concluida', 'atual', 'futura']);
  });

  it('análise: prazo vem da POLÍTICA única (D1) e do FATO da liberação', async () => {
    const liberacao: LiberacaoPortal = { clienteId: 'cli-1', chatId: 'c1', comunicadoEm: NOW, estimativaDiasInformada: 12 };
    const a = await view([resumo({ status: 'AGUARDANDO_10_DIAS' })], liberacao, 15).acompanhamento('cli-1', NOW);
    expect(a?.ondeEsta).toBe('Análise técnica');
    expect(a?.estimativaDias).toBe(15); // política vigente (mudou de 12 → 15: reflete)
    expect(a?.quantoTempo).toContain('15 dias');
    expect(a?.estimativaAte?.toISOString().slice(0, 10)).toBe('2026-08-02'); // fato + política
    // fila interna NUNCA exposta como contagem para o cliente:
    expect(JSON.stringify(a)).not.toContain('10 dias restantes');
  });

  it('PC-R5: a frase da previsão nasce NA VISÃO (P3) — e o atraso vira honestidade', async () => {
    const liberacao: LiberacaoPortal = { clienteId: 'cli-1', chatId: 'c1', comunicadoEm: NOW, estimativaDiasInformada: 12 };
    // Em curso: previsão embutida na frase completa.
    const emCurso = await view([resumo({ status: 'AGUARDANDO_10_DIAS' })], liberacao, 12).acompanhamento('cli-1', NOW);
    expect(emCurso?.quantoTempo).toContain('A previsão é até 30 de julho');
    // VENCIDA (16 dias depois): nunca repetir "12 dias" em loop — honestidade.
    const DEPOIS = new Date(NOW.getTime() + 16 * 24 * 60 * 60 * 1000);
    const vencida = await view([resumo({ status: 'AGUARDANDO_10_DIAS' })], liberacao, 12).acompanhamento('cli-1', DEPOIS);
    expect(vencida?.quantoTempo).toContain('um pouco mais do que o previsto');
    expect(vencida?.quantoTempo).not.toContain('previsão é até');
    expect(vencida?.quantoTempo).not.toContain('12 dias');
  });

  it('sem liberação registrada → estimativaAte null (nunca inventada — Lei 9)', async () => {
    const a = await view([resumo({ status: 'PRONTO_AGUARDANDO_PERICIA' })]).acompanhamento('cli-1', NOW);
    expect(a?.estimativaAte).toBeNull();
    expect(a?.quantoTempo).toContain('12 dias');
  });
});

describe('AcompanhamentoView · presença e frase de abertura (PC-R2 — docs congelados)', () => {
  it('pulso com semântica real: atenta (em curso) · serena (espera legítima) · repouso (concluído)', async () => {
    expect((await view([resumo({})]).acompanhamento('cli-1', NOW))?.presenca).toBe('atenta');
    expect((await view([resumo({ status: 'AGUARDANDO_10_DIAS' })]).acompanhamento('cli-1', NOW))?.presenca).toBe('serena');
    expect((await view([resumo({ status: 'ENCERRADO' })]).acompanhamento('cli-1', NOW))?.presenca).toBe('repouso');
  });

  it('GO-LIVE-02: textos FINAIS homologados — nunca burocráticos, sempre a AHRI', async () => {
    const vendido = await view([resumo({ status: 'VENDIDO' })]).acompanhamento('cli-1', NOW);
    expect(vendido?.fraseAbertura).toContain('foi um prazer acompanhar você até aqui');
    expect(vendido?.quantoTempo).toContain('não há mais prazos correndo');
    expect(vendido?.proximoPasso).toContain('eu mesma falo com você pelo WhatsApp');
    const encerrado = await view([resumo({ status: 'ENCERRADO' })]).acompanhamento('cli-1', NOW);
    expect(encerrado?.fraseAbertura).toContain('obrigada por confiar em mim');
    expect(encerrado?.proximoPasso).toContain('eu não vou embora');
    expect(encerrado?.quantoTempo).toContain('você pode ficar em paz');
    // o antigo texto burocrático morreu:
    expect(JSON.stringify(vendido) + JSON.stringify(encerrado)).not.toContain('Etapa concluída.');
  });

  it('fraseAbertura nasce na visão (P3: portal sem lógica) — voz da AHRI', async () => {
    const analise = await view([resumo({ status: 'AGUARDANDO_10_DIAS' })]).acompanhamento('cli-1', NOW);
    expect(analise?.fraseAbertura).toBe('Seu caso está em análise técnica — e eu estou acompanhando cada passo.');
    const processo = await view([resumo({})]).acompanhamento('cli-1', NOW);
    expect(processo?.fraseAbertura).toContain('processo está em andamento');
  });
});

describe('AcompanhamentoView · transparência SEM exposição (Princípio 6)', () => {
  it('NEGAÇÃO de vazamento: nada interno atravessa a projeção', async () => {
    const a = await view([resumo({})]).acompanhamento('cli-1', NOW);
    const json = JSON.stringify(a);
    expect(json).not.toContain('ESTRATEGIA-INTERNA'); // observação interna do advogado
    expect(json).not.toContain('JURIDIQUES-CRU'); // GO-LIVE-02: sem tradução ⇒ NADA (fail-closed)
    expect(json).not.toContain('Expedido mandado'); // o original NUNCA atravessa
    expect(json).not.toContain('observacao'); // kind interno
    expect(json).not.toContain('AGUARDANDO_'); // status internos crus (Princípio 5)
    expect(json).not.toContain('PRONTO_');
    expect(json).not.toContain('EM_PROCESSO');
    expect(json).not.toContain('missionId'); // ids internos além do necessário
    expect(json).not.toContain('adv-1');
  });

  it('resposta NEUTRA: cliente inexistente e contato não reconhecido → null', async () => {
    const v = view([resumo({ clienteId: 'novo@c.us', chatId: 'novo@c.us' })]);
    expect(await v.acompanhamento('nao-existe', NOW)).toBeNull();
    expect(await v.acompanhamento('novo@c.us', NOW)).toBeNull(); // provisório ≠ reconhecido
  });
});
