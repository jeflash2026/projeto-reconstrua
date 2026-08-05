// CENTRAL DO PERITO v2 (decretos 2026-07-24 → 2026-08-05) — o fluxo em ETAPAS:
//  1) AGUARDANDO PERÍCIA: clientes com a documentação COMPLETA (procuração
//     assinada no humanizado). Baixar o PACOTE (Excel + documentos) INICIA a
//     perícia e o relógio de 10 dias — só no download real.
//  2) EM PERÍCIA (10 dias): credenciais do pedido administrativo + resposta do
//     banco; prazo em CORES (folga → atenção → crítico).
//  3) CONCLUÍDAS: prazo vencido ⇒ luz verde para o advogado (Prontos no admin).
// v2 (pedido do dono): tema claro, tela cheia, resumo do dia, busca e a coluna
// de PROCESSOS do guia (o que o perito efetivamente protocola).
import type { ReactElement } from 'react';
import { getJson, type ClienteComHiscon, type PericiaEmFluxo } from '../lib/api';
import { SairButton } from '../components/sair-button';
import {
  BaixarEIniciar,
  BaixarTodosEIniciar,
  CredenciaisForm,
  RespostaBancoForm,
} from '../components/fluxo-pericia';

export const dynamic = 'force-dynamic';

function dataBr(iso: string | null): string {
  if (iso === null) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Prazo dos 10 dias em selo COLORIDO: folga (>5d), atenção (2–5d), crítico. */
function SeloPrazo({ p }: { p: PericiaEmFluxo }): ReactElement {
  if (p.expirado) return <span className="pc-prazo folga">🟢 prazo vencido — luz verde</span>;
  const dias = Math.floor(p.horasRestantes / 24);
  const horas = p.horasRestantes % 24;
  const classe = dias > 5 ? 'folga' : dias >= 2 ? 'atencao' : 'critico';
  return (
    <span className={`pc-prazo ${classe}`}>
      ⏳ {String(dias)}d {String(horas)}h restantes
    </span>
  );
}

function CredenciaisView({ p }: { p: PericiaEmFluxo }): ReactElement {
  return (
    <div style={{ margin: '8px 0' }}>
      <strong style={{ fontSize: 13 }}>Credenciais do pedido:</strong>{' '}
      {p.credenciais ? (
        <span className="mono" style={{ fontSize: 12 }}>
          {p.credenciais.provedor} · {p.credenciais.email} · {p.credenciais.senha}
        </span>
      ) : (
        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>ainda não informadas</span>
      )}
      <div style={{ marginTop: 4 }}>
        <CredenciaisForm chatId={p.chatId} atual={p.credenciais} />
      </div>
    </div>
  );
}

function RespostaView({ p }: { p: PericiaEmFluxo }): ReactElement {
  return (
    <div style={{ margin: '8px 0' }}>
      <strong style={{ fontSize: 13 }}>Resposta do banco:</strong>{' '}
      {p.respostaBanco ? (
        <span style={{ fontSize: 13 }}>
          {p.respostaBanco.texto}{' '}
          <span style={{ color: 'var(--text-dim)' }}>({dataBr(p.respostaBanco.registradaEm)})</span>
        </span>
      ) : (
        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>sem resposta ainda</span>
      )}
      <div style={{ marginTop: 4 }}>
        <RespostaBancoForm chatId={p.chatId} atual={p.respostaBanco} />
      </div>
    </div>
  );
}

/** CPF com máscara (000.000.000-00) — mesmo formato da planilha. */
function cpfBr(cpf: string | null): string {
  if (cpf === null) return '—';
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

const CentralPerito = async ({
  searchParams,
}: {
  searchParams: { q?: string };
}): Promise<ReactElement> => {
  // As duas leituras são INDEPENDENTES: vão JUNTAS. Timeout de 45s (a api
  // aquece os caches no boot; a folga cobre o pior caso pós-restart).
  const [lista, fluxo] = await Promise.all([
    getJson<{ clientes: ClienteComHiscon[] }>('/admin/jornada/pericia/todos-com-hiscon', 45000),
    getJson<{ emAndamento: PericiaEmFluxo[]; concluidas: PericiaEmFluxo[] }>(
      '/admin/jornada/pericia/em-fluxo',
      45000,
    ),
  ]);
  const comHiscon = lista?.clientes ?? [];
  const emAndamento = fluxo?.emAndamento ?? [];
  const concluidas = fluxo?.concluidas ?? [];
  const emFluxo = new Set([...emAndamento, ...concluidas].map((p) => p.chatId));
  let aguardando = comHiscon.filter((c) => !emFluxo.has(c.chatId));
  // BUSCA (v2): nome, CPF ou telefone — formulário GET simples (sem action:
  // o envio fica na URL atual, que já carrega o basePath /perito).
  const q = (searchParams.q ?? '').trim();
  const qMin = q.toLowerCase();
  const qDig = q.replace(/\D/g, '');
  if (q !== '') {
    aguardando = aguardando.filter(
      (c) =>
        c.quem.toLowerCase().includes(qMin) ||
        (qDig !== '' && ((c.cpf ?? '').includes(qDig) || c.chatId.includes(qDig))),
    );
  }
  // Decreto 2026-07-27: o CPF acompanha o estudo (o pedido nos bancos exige).
  const cpfDe = new Map(comHiscon.map((c) => [c.chatId, c.cpf ?? null]));
  const processosAguardando = aguardando.reduce((s, c) => s + (c.processos ?? 0), 0);

  return (
    <main style={{ maxWidth: 1500, margin: '0 auto', padding: '16px 20px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Central do Perito</h1>
        <SairButton />
      </div>
      <p className="page-sub">
        Baixe o PACOTE do cliente (planilha Excel + procuração, RG, comprovante e HISCON) para
        iniciar a perícia — os 10 dias contam a partir do download. Guarde as credenciais e a
        resposta do banco; vencido o prazo, o caso ganha luz verde para o advogado.
      </p>

      {/* ── RESUMO DO DIA ──────────────────────────────────────────────────── */}
      <div className="pc-resumo">
        <div className="pc-stat baixar">
          <div className="valor">{aguardando.length}</div>
          <div className="rotulo">Aguardando perícia</div>
          <div className="dica">
            Documentação completa — prontos para baixar
            {processosAguardando > 0 ? ` · ${String(processosAguardando)} processo(s)` : ''}
          </div>
        </div>
        <div className="pc-stat andamento">
          <div className="valor">{emAndamento.length}</div>
          <div className="rotulo">Em perícia (10 dias)</div>
          <div className="dica">Pedido administrativo em andamento</div>
        </div>
        <div className="pc-stat pronta">
          <div className="valor">{concluidas.length}</div>
          <div className="rotulo">Concluídas</div>
          <div className="dica">Prazo vencido — luz verde para o advogado</div>
        </div>
      </div>

      {/* ── 1) AGUARDANDO PERÍCIA ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Aguardando perícia ({aguardando.length})</h3>
        <p className="page-sub" style={{ marginTop: 0 }}>
          Clientes com procuração assinada e documentação completa. Baixar o pacote inicia a perícia
          (10 dias).
        </p>
        <form method="GET" className="pc-busca">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, CPF ou telefone…"
            aria-label="Buscar cliente"
          />
          <button type="submit" className="btn">
            Buscar
          </button>
          {q !== '' ? (
            <a className="btn" href="/perito">
              Limpar
            </a>
          ) : null}
        </form>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <BaixarTodosEIniciar aguardando={aguardando} />
        </div>
        {aguardando.length === 0 ? (
          <div className="empty">
            {q !== ''
              ? 'Nenhum cliente na busca.'
              : 'Nenhum cliente aguardando — todos já estão em perícia.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>CPF</th>
                  <th>WhatsApp</th>
                  <th>Contratos</th>
                  <th>Processos (guia)</th>
                  <th>Último contato</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {aguardando.map((c) => (
                  <tr key={c.chatId}>
                    <td style={{ fontWeight: 600 }}>{c.quem}</td>
                    <td className="mono">{cpfBr(c.cpf ?? null)}</td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {c.chatId.split('@')[0]}
                    </td>
                    <td>{c.totalContratos}</td>
                    <td>
                      <strong>{c.processos ?? '—'}</strong>
                    </td>
                    <td className="mono">{dataBr(c.ultimoContatoAt)}</td>
                    <td>
                      <BaixarEIniciar c={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 2) EM PERÍCIA (10 dias) ───────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Em perícia — 10 dias ({emAndamento.length})</h3>
        <p className="page-sub" style={{ marginTop: 0 }}>
          Pedido administrativo em andamento. Guarde as credenciais e a resposta do banco.
        </p>
        {emAndamento.length === 0 ? (
          <div className="empty">Nenhum cliente em perícia agora.</div>
        ) : (
          <div className="pc-grade">
            {emAndamento.map((p) => (
              <div key={p.chatId} className="pc-card-pericia">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <strong>{p.quem}</strong>{' '}
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      {p.chatId.split('@')[0]}
                    </span>
                  </div>
                  <SeloPrazo p={p} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                  Iniciada em {dataBr(p.iniciadaEm)} · prazo até {dataBr(p.prazoEm)} · CPF:{' '}
                  <span className="mono">{cpfBr(cpfDe.get(p.chatId) ?? null)}</span>
                </div>
                <CredenciaisView p={p} />
                <RespostaView p={p} />
                <a className="btn" href={`/perito/api/pacote/${encodeURIComponent(p.clienteId)}`}>
                  Rebaixar pacote (planilha + documentos)
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 3) CONCLUÍDAS (prazo vencido) ─────────────────────────────────── */}
      <div className="card">
        <h3>Concluídas — prontas p/ advogado ({concluidas.length})</h3>
        <p className="page-sub" style={{ marginTop: 0 }}>
          10 dias vencidos. Já aparecem em &quot;Prontos p/ Advogado&quot; no admin, com as
          credenciais e a resposta do banco como prova do pedido.
        </p>
        {concluidas.length === 0 ? (
          <div className="empty">Nenhuma perícia concluída ainda.</div>
        ) : (
          <div className="pc-grade">
            {concluidas.map((p) => (
              <div key={p.chatId} className="pc-card-pericia vencida">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <strong>{p.quem}</strong>
                  <SeloPrazo p={p} />
                </div>
                <CredenciaisView p={p} />
                <RespostaView p={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default CentralPerito;
