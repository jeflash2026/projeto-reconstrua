// CENTRAL DO PERITO (Decreto 2026-07-24) — o fluxo em ETAPAS:
//  1) AGUARDANDO PERÍCIA: clientes com HISCON legível ainda não trabalhados.
//     Baixar (unitário ou todos) INICIA a perícia e o relógio de 10 dias.
//  2) EM PERÍCIA (10 dias): o perito guarda as CREDENCIAIS (e-mail/senha/provedor
//     do pedido administrativo) e a RESPOSTA DO BANCO; a contagem corre.
//  3) CONCLUÍDAS: vencidos os 10 dias, o cliente já está em "Prontos p/ Advogado"
//     no admin — com as credenciais e a resposta como prova do pedido.
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

function contagem(p: PericiaEmFluxo): string {
  if (p.expirado) return 'prazo vencido';
  const dias = Math.floor(p.horasRestantes / 24);
  const horas = p.horasRestantes % 24;
  return `${String(dias)}d ${String(horas)}h restantes`;
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

const CentralPerito = async (): Promise<ReactElement> => {
  const comHiscon =
    (
      await getJson<{ clientes: ClienteComHiscon[] }>(
        '/admin/jornada/pericia/todos-com-hiscon',
        20000,
      )
    )?.clientes ?? [];
  const fluxo = await getJson<{ emAndamento: PericiaEmFluxo[]; concluidas: PericiaEmFluxo[] }>(
    '/admin/jornada/pericia/em-fluxo',
  );
  const emAndamento = fluxo?.emAndamento ?? [];
  const concluidas = fluxo?.concluidas ?? [];
  const emFluxo = new Set([...emAndamento, ...concluidas].map((p) => p.chatId));
  const aguardando = comHiscon.filter((c) => !emFluxo.has(c.chatId));
  // Decreto 2026-07-27: o CPF acompanha o estudo (o pedido nos bancos exige).
  const cpfDe = new Map(comHiscon.map((c) => [c.chatId, c.cpf ?? null]));

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Central do Perito</h1>
        <SairButton />
      </div>
      <p className="page-sub">
        Baixe o estudo do cliente para iniciar a perícia — a partir do download começam os 10 dias.
        Guarde as credenciais e a resposta do banco; vencido o prazo, o caso vai ao advogado.
      </p>

      {/* ── 1) AGUARDANDO PERÍCIA ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Aguardando perícia ({aguardando.length})</h3>
        <p className="page-sub" style={{ marginTop: 0 }}>
          Clientes com HISCON legível ainda não trabalhados. Baixar inicia a perícia (10 dias).
        </p>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <BaixarTodosEIniciar aguardando={aguardando} />
        </div>
        {aguardando.length === 0 ? (
          <div className="empty">Nenhum cliente aguardando — todos já estão em perícia.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>CPF</th>
                  <th>WhatsApp</th>
                  <th>Contratos</th>
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
                      {c.chatId}
                    </td>
                    <td>{c.totalContratos}</td>
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
          emAndamento.map((p) => (
            <div
              key={p.chatId}
              className="card"
              style={{ marginBottom: 12, background: 'var(--bg-elev)' }}
            >
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <strong>{p.quem}</strong>{' '}
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    {p.chatId}
                  </span>
                </div>
                <span className="badge accent">{contagem(p)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                Iniciada em {dataBr(p.iniciadaEm)} · prazo até {dataBr(p.prazoEm)} · CPF:{' '}
                <span className="mono">{cpfBr(cpfDe.get(p.chatId) ?? null)}</span>
              </div>
              <CredenciaisView p={p} />
              <RespostaView p={p} />
              <a className="btn" href={`/perito/api/planilha/${encodeURIComponent(p.clienteId)}`}>
                Rebaixar planilha
              </a>
            </div>
          ))
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
          concluidas.map((p) => (
            <div
              key={p.chatId}
              className="card"
              style={{ marginBottom: 12, background: 'var(--bg-elev)' }}
            >
              <div>
                <strong>{p.quem}</strong> — <span className="badge bad">prazo vencido</span>
              </div>
              <CredenciaisView p={p} />
              <RespostaView p={p} />
            </div>
          ))
        )}
      </div>
    </main>
  );
};

export default CentralPerito;
