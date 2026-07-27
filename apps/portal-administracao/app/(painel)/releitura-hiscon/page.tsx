// RELEITURA COMPARATIVA DO HISCON (decreto 2026-07-27) — o leitor posicional V2
// rodado sobre os PDFs armazenados, lado a lado com a leitura em produção.
// SÓ LEITURA: esta página nunca altera cache nem estado de cliente algum.
import type { ReactElement } from 'react';
import { fetchReleituraHiscon, type ReleituraLinha } from '../../../lib/actions';

export const dynamic = 'force-dynamic';

const ROTULO: Record<string, { label: string; tom: 'ok' | 'atencao' | 'neutro' }> = {
  CONFERIDO_IGUAL: { label: 'Conferido — igual à leitura atual', tom: 'ok' },
  CONFERIDO_DIFERENTE: { label: 'Conferido — leitura atual DIFERE', tom: 'atencao' },
  V2_DIVERGENTE: { label: 'Divergiu do quantitativo do documento', tom: 'atencao' },
  SEM_QUANTITATIVO: { label: 'Sem quantitativo p/ conferir', tom: 'neutro' },
  V2_NAO_LEU: { label: 'Novo leitor não reconheceu a tabela', tom: 'atencao' },
  IMAGEM: { label: 'HISCON em imagem (leitura por Vision)', tom: 'neutro' },
  PDF_ILEGIVEL: { label: 'PDF ilegível', tom: 'atencao' },
  SEM_PDF: { label: 'PDF não encontrado no acervo', tom: 'atencao' },
  SEM_VINCULO: { label: 'Documento sem vínculo de mídia', tom: 'atencao' },
};

const n = (v: number | null): string => (v === null ? '—' : String(v));

const Linha = ({ l }: { l: ReleituraLinha }): ReactElement => {
  const r = ROTULO[l.veredicto] ?? { label: l.veredicto, tom: 'neutro' as const };
  return (
    <tr>
      <td>{l.cliente ?? l.chatId}</td>
      <td style={{ textAlign: 'center' }}>{n(l.contratosCache)}</td>
      <td style={{ textAlign: 'center' }}>{n(l.contratosV2)}</td>
      <td style={{ textAlign: 'center' }}>
        {l.declarado !== null
          ? `${String(l.declarado.ativos)} ativo(s) / ${String(l.declarado.suspensos)} susp.`
          : '—'}
      </td>
      <td>
        <span className={`badge ${r.tom === 'ok' ? 'accent' : ''}`}>{r.label}</span>
      </td>
    </tr>
  );
};

const ReleituraPage = async (): Promise<ReactElement> => {
  const dados = await fetchReleituraHiscon();
  return (
    <>
      <h1 className="page-title">Releitura HISCON — comparativo</h1>
      <p className="page-sub">
        O leitor novo (posicional, por template do INSS) rodado sobre os PDFs originais, lado a lado
        com a leitura que a produção usa hoje. Esta página é SÓ CONSULTA — nada é regravado;
        reprocessar um cliente é sempre decisão manual.
      </p>
      {dados === null ? (
        <div className="error-box">
          Não consegui gerar o relatório — a API pode estar processando os PDFs (tente recarregar)
          ou indisponível.
        </div>
      ) : (
        <>
          <div className="cc-ind-grid" style={{ marginBottom: 16 }}>
            {Object.entries(dados.resumo).map(([veredicto, total]) => (
              <div key={veredicto} className="cc-ind">
                <div className="cc-ind-value">{total}</div>
                <div className="cc-ind-label">{ROTULO[veredicto]?.label ?? veredicto}</div>
              </div>
            ))}
          </div>
          <div className="card">
            <h3>
              Clientes com HISCON ({dados.totalClientes}) — gerado em{' '}
              {new Date(dados.geradoEm).toLocaleString('pt-BR')}
            </h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contratos (leitura atual)</th>
                    <th>Contratos (novo leitor)</th>
                    <th>O documento declara</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.linhas.map((l) => (
                    <Linha key={l.chatId} l={l} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default ReleituraPage;
