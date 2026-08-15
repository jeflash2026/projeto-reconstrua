// POR QUE ESTE CLIENTE NÃO ESTÁ NA MESA (2026-08-13) — a pergunta que se repetia
// caso a caso ("fulano mandou o HISCON e não apareceu"). Mostra a corrente
// inteira e nomeia o PRIMEIRO elo quebrado, que é sempre o que importa.
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';

interface Elo {
  id: string;
  rotulo: string;
  ok: boolean;
  detalhe: string;
}
interface Diagnostico {
  chatId: string;
  nome: string;
  telefone: string;
  naMesa: boolean;
  elos: Elo[];
  bloqueio: string | null;
  oQueFazer: string;
}

function telefoneBonito(t: string): string {
  const d = t.replace(/\D/g, '');
  const local = d.startsWith('55') ? d.slice(2) : d;
  if (local.length < 10) return t;
  return `(${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}`;
}

export const dynamic = 'force-dynamic';

const DiagnosticoPage = async ({
  searchParams,
}: {
  searchParams: { q?: string };
}): Promise<ReactElement> => {
  const q = (searchParams.q ?? '').trim();
  const dados =
    q.length < 3
      ? null
      : await getJson<{ clientes: Diagnostico[] }>(
          `/admin/clientes/diagnostico?q=${encodeURIComponent(q)}`,
        );

  return (
    <>
      <h1 className="page-title">Por que este cliente não está na mesa?</h1>
      <p className="page-sub">
        A corrente que leva um cliente do primeiro contato até a mesa do Humanizado, elo a elo. O
        que importa é o <strong>primeiro</strong> que quebrou — os seguintes são consequência dele.
        Só leitura: nada é alterado nem enviado por aqui.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <form method="GET" className="form-row" style={{ gap: 8 }}>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Nome ou telefone do cliente"
            autoComplete="off"
          />
          <button className="primary" type="submit">
            Diagnosticar
          </button>
        </form>
      </div>

      {q.length < 3 ? (
        <div className="card empty">Digite ao menos 3 letras do nome, ou o telefone.</div>
      ) : dados === null ? (
        <div className="error-box">API indisponível (ou ainda sem o deploy desta versão).</div>
      ) : dados.clientes.length === 0 ? (
        <div className="card empty">
          Ninguém encontrado com &quot;{q}&quot;. Se o cliente escreveu de outro número, procure
          pelo nome.
        </div>
      ) : (
        dados.clientes.map((c) => (
          <div className="card" key={c.chatId} style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>
              {c.nome}{' '}
              <span className="mono" style={{ fontSize: 13, fontWeight: 400 }}>
                {telefoneBonito(c.telefone)}
              </span>{' '}
              {c.naMesa ? (
                <span className="badge ok">na mesa</span>
              ) : (
                <span className="badge warn">fora da mesa</span>
              )}
            </h3>

            {c.bloqueio !== null ? (
              <p style={{ margin: '4px 0 12px' }}>
                <strong style={{ color: '#b45309' }}>Travou em: {c.bloqueio}</strong>
                <br />
                <span className="page-sub">{c.oQueFazer}</span>
              </p>
            ) : (
              <p className="page-sub" style={{ marginTop: 0 }}>
                {c.oQueFazer}
              </p>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th>Etapa</th>
                    <th>O que o sistema tem</th>
                  </tr>
                </thead>
                <tbody>
                  {c.elos.map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontSize: 16 }}>{e.ok ? '✅' : '❌'}</td>
                      <td style={{ fontWeight: e.rotulo === c.bloqueio ? 700 : 400 }}>
                        {e.rotulo}
                      </td>
                      <td className="dossie-explica">{e.detalhe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </>
  );
};

export default DiagnosticoPage;
