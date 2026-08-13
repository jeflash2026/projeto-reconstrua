// PARADOS DEPOIS DO HISCON (2026-08-13) — entregaram o extrato e ficaram sem o
// dossiê. Separados por MOTIVO, porque cada um pede um remédio diferente, e com
// a janela de 24h da Meta marcada (fora dela, só template).
import type { ReactElement } from 'react';
import { getJson } from '../../../lib/api';

interface ClienteParado {
  chatId: string;
  nome: string;
  telefone: string;
  situacao: 'pronto-sem-dossie' | 'falta-cpf' | 'hiscon-ilegivel';
  ultimaEntradaEm: string | null;
  dentroDaJanela24h: boolean;
  pediuSimSemDossie: boolean;
}

interface Resumo {
  geradoEm: string;
  total: number;
  dentroDaJanela24h: number;
  pediramSimSemDossie: number;
  clientes: ClienteParado[];
}

const ROTULO: Record<ClienteParado['situacao'], string> = {
  'pronto-sem-dossie': 'Pronto — o dossiê devia ter saído',
  'falta-cpf': 'Falta o CPF',
  'hiscon-ilegivel': 'HISCON ilegível',
};

const REMEDIO: Record<ClienteParado['situacao'], string> = {
  'pronto-sem-dossie': 'O dossiê sai na próxima varredura; se não sair, é caso de investigar.',
  'falta-cpf': 'Cobrar o CPF — sem ele a análise não roda.',
  'hiscon-ilegivel': 'Releitura/revínculo do HISCON. NÃO mande mensagem: o problema é nosso.',
};

function telefoneBonito(t: string): string {
  const d = t.replace(/\D/g, '');
  const local = d.startsWith('55') ? d.slice(2) : d;
  if (local.length < 10) return t;
  return `(${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}`;
}

export const dynamic = 'force-dynamic';

const ParadosPage = async ({
  searchParams,
}: {
  searchParams: { horas?: string };
}): Promise<ReactElement> => {
  const horas = searchParams.horas ?? '72';
  const dados = await getJson<Resumo>(`/admin/jornada/parados-pos-hiscon?horas=${horas}`);
  return (
    <>
      <h1 className="page-title">Parados depois do HISCON</h1>
      <p className="page-sub">
        Quem entregou o extrato do INSS e continua sem receber o dossiê. O motivo muda o remédio —
        por isso a lista separa os três casos. Só quem falou nas últimas 24h pode receber mensagem
        livre; fora da janela, só template. Nada é enviado por esta tela.
      </p>
      {dados === null ? (
        <div className="error-box">API indisponível (ou ainda sem o deploy desta versão).</div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="dossie-numeros">
              <div className="dossie-num">
                <div className="dossie-num-rotulo">Parados</div>
                <strong className="dossie-num-valor">{dados.total}</strong>
              </div>
              <div className="dossie-num">
                <div className="dossie-num-rotulo">Dentro das 24h</div>
                <strong className="dossie-num-valor destaque">{dados.dentroDaJanela24h}</strong>
                <div className="dossie-num-nota">podem receber mensagem livre</div>
              </div>
              <div className="dossie-num">
                <div className="dossie-num-rotulo">Ouviram &quot;responda SIM&quot;</div>
                <strong className="dossie-num-valor" style={{ color: '#b45309' }}>
                  {dados.pediramSimSemDossie}
                </strong>
                <div className="dossie-num-nota">sem ter recebido o dossiê</div>
              </div>
            </div>
            <p className="page-sub">
              Janela analisada: últimas {horas}h. <a href="?horas=24">24h</a> ·{' '}
              <a href="?horas=72">72h</a> · <a href="?horas=168">7 dias</a>
            </p>
          </div>

          <div className="card">
            <h3>Quem está parado ({dados.clientes.length})</h3>
            {dados.clientes.length === 0 ? (
              <div className="empty">
                Ninguém parado nesta janela — todo mundo que entregou o HISCON recebeu o dossiê.
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Telefone</th>
                      <th>Situação</th>
                      <th>O que fazer</th>
                      <th>Última fala dele</th>
                      <th>24h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.clientes.map((c) => (
                      <tr key={c.chatId}>
                        <td style={{ fontWeight: 600 }}>
                          {c.nome}
                          {c.pediuSimSemDossie ? (
                            <div className="dossie-explica" style={{ color: '#b45309' }}>
                              ouviu &quot;responda SIM&quot; sem dossiê
                            </div>
                          ) : null}
                        </td>
                        <td className="mono">{telefoneBonito(c.telefone)}</td>
                        <td>
                          <span className={c.situacao === 'falta-cpf' ? 'badge warn' : 'badge'}>
                            {ROTULO[c.situacao]}
                          </span>
                        </td>
                        <td className="dossie-explica">{REMEDIO[c.situacao]}</td>
                        <td>
                          {c.ultimaEntradaEm === null
                            ? '—'
                            : new Date(c.ultimaEntradaEm).toLocaleString('pt-BR')}
                        </td>
                        <td>
                          {c.dentroDaJanela24h ? (
                            <span className="badge ok">aberta</span>
                          ) : (
                            <span className="badge dim">fechada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default ParadosPage;
