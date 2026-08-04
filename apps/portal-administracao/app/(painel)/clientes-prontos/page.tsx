// Decreto Tráfego Pago — CLIENTES PRONTOS P/ ADVOGADO: cadastro completo +
// pedido administrativo confirmado pelo perito (prazo de 10 dias em curso ou
// resposta do banco). O administrador escolhe o advogado; a AHRI avisa o
// advogado no número cadastrado por ele e o cliente aparece no painel dele.
import type { ReactElement } from 'react';
import {
  listarClientesProntos,
  fetchPericiasConcluidas,
  fetchTotalPericiasBaixadas,
} from '../../../lib/actions';
import { getJson, type CarteiraAdvogadoView } from '../../../lib/api';
import AtribuirAdvogado from '../../../components/atribuir-advogado';
import CarteiraAdvogados from '../../../components/carteira-advogados';
import EstornarPericias from '../../../components/estornar-pericias';
import EstornarIncompletas from '../../../components/estornar-incompletas';

export const dynamic = 'force-dynamic';

function dataBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const ClientesProntosPage = async (): Promise<ReactElement> => {
  const dados = await listarClientesProntos();
  const concluidas = await fetchPericiasConcluidas();
  const baixadas = await fetchTotalPericiasBaixadas();
  // Decreto 2026-08-04: a carteira de créditos dos advogados parceiros.
  const carteiras =
    (await getJson<{ carteiras: CarteiraAdvogadoView[] }>('/admin/creditos-advogado'))?.carteiras ??
    [];
  return (
    <>
      <h1 className="page-title">Clientes prontos p/ Advogado</h1>
      <p className="page-sub">
        Cadastro completo e pedido administrativo em curso — escolha quem vai representar cada
        cliente. A AHRI avisa o advogado no WhatsApp cadastrado por ele.
      </p>
      {dados === null ? (
        <div className="card empty">
          Integração com o Portal do Advogado indisponível (ADVOGADO_API_URL).
        </div>
      ) : dados.prontos.length === 0 ? (
        <div className="card empty">
          Nenhum cliente aguardando advogado agora — quando o perito confirmar os pedidos
          administrativos, eles aparecem aqui.
        </div>
      ) : (
        <AtribuirAdvogado prontos={dados.prontos} advogados={dados.advogados} />
      )}

      {/* Decreto 2026-08-04: a CARTEIRA de créditos — compra de contratos +
          abate automático por cliente encaminhado (extrato por advogado). */}
      <CarteiraAdvogados carteiras={carteiras} />

      {/* Decreto 2026-07-27: estudos baixados na LEITURA ANTIGA — estorno geral
          para novo download, agora com a leitura corrigida do HISCON. */}
      <EstornarPericias baixadas={baixadas} />

      {/* Decreto 2026-08-03: cada cliente no seu ESTÁGIO REAL — as perícias do
          fluxo antigo voltam ao funil; quem completou o ciclo é preservado. */}
      <EstornarIncompletas />

      {/* Decreto 2026-07-24: perícias com 10 dias vencidos — com as CREDENCIAIS e a
          RESPOSTA DO BANCO, como prova do pedido, para o advogado consultar. */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3>Perícias concluídas — provas do pedido ({concluidas.length})</h3>
        <p className="page-sub" style={{ marginTop: 0 }}>
          O perito fez o pedido administrativo e o prazo de 10 dias venceu. As credenciais e a
          resposta do banco ficam aqui como prova para o advogado que assumir o caso.
        </p>
        {concluidas.length === 0 ? (
          <div className="empty">Nenhuma perícia concluída ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Credenciais (provedor · e-mail · senha)</th>
                  <th>Resposta do banco</th>
                  <th>Prazo vencido em</th>
                </tr>
              </thead>
              <tbody>
                {concluidas.map((p) => (
                  <tr key={p.chatId}>
                    <td style={{ fontWeight: 600 }}>{p.quem}</td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {p.credenciais
                        ? `${p.credenciais.provedor} · ${p.credenciais.email} · ${p.credenciais.senha}`
                        : '—'}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {p.respostaBanco ? p.respostaBanco.texto : '—'}
                    </td>
                    <td className="mono">{dataBr(p.prazoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default ClientesProntosPage;
