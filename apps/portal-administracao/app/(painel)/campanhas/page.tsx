// CAMPANHAS — de onde vem cada cliente, cruzado com o FUNIL (2026-08-12).
// Até aqui esta página lia um campo que nunca foi escrito e dizia "sem fonte de
// dados". A origem sempre esteve na primeira mensagem do cliente: a landing
// carimba "Vim pelo site (X)" nela. Nada é inventado — o que a marca não
// alcança aparece contado à parte.
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';

interface LinhaCampanha {
  origem: string;
  rotulo: string;
  contatos: number;
  entregaramHiscon: number;
  confirmaram: number;
  fecharam: number;
  taxaDeFechamento: number;
}

interface Atribuicao {
  geradoEm: string;
  disponivel: boolean;
  linhas: LinhaCampanha[];
  semOrigem: number;
}

const CampanhasPage = async (): Promise<ReactElement> => {
  const data = await getJson<Atribuicao>('/admin/campaigns');
  return (
    <>
      <h1 className="page-title">Campanhas</h1>
      <p className="page-sub">
        De onde vem cada cliente, do primeiro contato até a documentação completa. A origem é lida
        da primeira mensagem que a pessoa manda pela landing — quem chega por indicação ou direto no
        número não tem origem para atribuir, e aparece contado à parte.
      </p>
      {data === null ? (
        <div className="error-box">API indisponível (ou ainda sem o deploy desta versão).</div>
      ) : !data.disponivel ? (
        <div className="card empty">
          Nenhum contato com origem registrada ainda. A marca de campanha viaja na primeira mensagem
          de quem vem pela landing — assim que o primeiro anúncio trouxer alguém, esta tabela se
          preenche sozinha.
          {data.semOrigem > 0
            ? ` (${String(data.semOrigem)} contato(s) chegaram por fora da landing.)`
            : ''}
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Contatos</th>
                  <th>Entregaram HISCON</th>
                  <th>Confirmaram</th>
                  <th>Documentação completa</th>
                  <th>Taxa de fechamento</th>
                </tr>
              </thead>
              <tbody>
                {data.linhas.map((l) => (
                  <tr key={l.origem}>
                    <td style={{ fontWeight: 600 }}>{l.rotulo}</td>
                    <td>{l.contatos}</td>
                    <td>{l.entregaramHiscon}</td>
                    <td>{l.confirmaram}</td>
                    <td>{l.fecharam}</td>
                    <td>{l.taxaDeFechamento}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="page-sub" style={{ marginTop: 12 }}>
            Ordenado por quem <strong>fecha</strong>, não por quem traz mais gente — é essa a ordem
            de onde investir. {data.semOrigem} contato(s) sem origem atribuível (indicação, número
            direto, ou anteriores ao rastreamento).
          </p>
        </>
      )}
    </>
  );
};

export default CampanhasPage;
