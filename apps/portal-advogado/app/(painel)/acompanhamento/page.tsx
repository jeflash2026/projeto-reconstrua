// ACOMPANHAMENTO PROCESSUAL (2026-09-11) — os processos judiciais dos seus
// clientes (cadastrados pelo escritório no Painel Jurídico), acompanhados pelo
// DataJud e pelo DJEN. Cada intimação publicada ganha um PARECER da AHRI: o que
// o juiz determinou, quem precisa agir, o prazo escrito e o próximo passo.
import type { ReactElement } from 'react';
import CienteAlerta from '../../../components/ciente-alerta';
import {
  advogadoId,
  getJson,
  type Acompanhamento,
  type AlertaProcessual,
  type AnaliseDaComunicacao,
  type DeterminacaoDoJuizo,
  type MovimentoAcompanhado,
  type ProcessoAcompanhado,
} from '../../../lib/api';
import { classePrazo, diaBr, prazoTexto } from '../../../lib/prazo';

const TOM: Record<AnaliseDaComunicacao['tom'], { classe: string; rotulo: string }> = {
  favoravel: { classe: 'badge ok', rotulo: 'favorável' },
  desfavoravel: { classe: 'badge bad', rotulo: 'desfavorável' },
  neutro: { classe: 'badge dim', rotulo: 'andamento' },
};

const LINHA = '1px solid rgba(127, 127, 127, 0.25)';

const Determinacoes = ({
  itens,
}: {
  itens: readonly (DeterminacaoDoJuizo & { vencimentoEstimado?: string | null })[];
}): ReactElement | null =>
  itens.length === 0 ? null : (
    <ul style={{ margin: '4px 0 8px 18px', padding: 0 }}>
      {itens.map((d, i) => (
        <li key={i} style={{ margin: '3px 0' }}>
          {d.oQue} <span className="badge dim">{d.responsavel}</span>
          {d.prazoDias !== null ? (
            <>
              {' '}
              — {d.prazoDias} dias {d.diasCorridos ? 'corridos' : 'úteis'}
              {d.vencimentoEstimado !== undefined && d.vencimentoEstimado !== null ? (
                <>
                  , vence por volta de <strong>{diaBr(d.vencimentoEstimado)}</strong>
                </>
              ) : null}
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );

const linkDoCliente = (chatId: string): string =>
  `/advogado/acompanhamento?cliente=${encodeURIComponent(chatId)}#clientes`;

const AlertaCard = ({ a }: { a: AlertaProcessual }): ReactElement => (
  <div className="card" style={{ marginBottom: 10, opacity: a.ciente ? 0.75 : 1 }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className={classePrazo(a.diasRestantes)}>{prazoTexto(a.diasRestantes)}</span>
      <strong>{a.cliente}</strong>
      <span className="mono">{a.processo}</span>
      <span style={{ opacity: 0.7 }}>
        {a.tipo} publicada em {diaBr(a.dataPublicacao)}
      </span>
    </div>
    <p style={{ margin: '8px 0 4px' }}>{a.resumo}</p>
    <Determinacoes itens={a.determinacoes} />
    {a.proximoPasso !== '' ? (
      <p style={{ margin: '4px 0' }}>
        <strong>Próximo passo:</strong> {a.proximoPasso}
      </p>
    ) : null}
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
      {a.ciente ? <span className="badge dim">ciente</span> : <CienteAlerta chave={a.chave} />}
      <a href={linkDoCliente(a.chatId)}>ver o processo</a>
    </div>
  </div>
);

const Movimento = ({ m }: { m: MovimentoAcompanhado }): ReactElement => (
  <li style={{ listStyle: 'none', padding: '10px 0', borderTop: LINHA }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="mono">{diaBr(m.dataHora.slice(0, 10))}</span>
      <strong>{m.nome}</strong>
      {m.analise !== null ? (
        <span className={TOM[m.analise.tom].classe}>{TOM[m.analise.tom].rotulo}</span>
      ) : null}
      {m.aguardandoParecer ? <span className="badge accent">parecer em preparação</span> : null}
    </div>
    {m.analise !== null ? (
      <div style={{ marginTop: 6 }}>
        <p style={{ margin: '4px 0' }}>{m.analise.resumo}</p>
        <Determinacoes itens={m.analise.determinacoes} />
        {m.analise.proximoPasso !== '' ? (
          <p style={{ margin: '4px 0' }}>
            <strong>Próximo passo:</strong> {m.analise.proximoPasso}
          </p>
        ) : null}
      </div>
    ) : null}
    {typeof m.texto === 'string' && m.texto !== '' ? (
      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: 'pointer' }}>Ver o texto publicado</summary>
        <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: '6px 0' }}>{m.texto}</p>
      </details>
    ) : null}
    {typeof m.link === 'string' && m.link !== '' ? (
      <a href={m.link} target="_blank" rel="noreferrer">
        abrir no tribunal
      </a>
    ) : null}
  </li>
);

const Processo = ({ p }: { p: ProcessoAcompanhado }): ReactElement => {
  const capa = [p.classe, p.orgaoJulgador, p.tribunal].filter((x) => x !== '').join(' · ');
  return (
    <div style={{ borderTop: LINHA, paddingTop: 10, marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="mono" style={{ fontWeight: 600 }}>
          {p.numero}
        </span>
        {p.bancos.length > 0 ? <span className="badge dim">{p.bancos.join(' · ')}</span> : null}
      </div>
      <div style={{ opacity: 0.7, margin: '4px 0' }}>
        {capa !== '' ? capa : 'Capa ainda não publicada'}
      </div>
      {p.consultadoEm === null ? (
        <div className="empty">
          Processo cadastrado — a primeira consulta automática acontece em até 6 horas.
        </div>
      ) : p.movimentos.length === 0 ? (
        <div className="empty">{p.erro ?? 'Sem movimentação publicada ainda.'}</div>
      ) : (
        <ul style={{ padding: 0, margin: 0 }}>
          {p.movimentos.map((m, i) => (
            <Movimento key={i} m={m} />
          ))}
        </ul>
      )}
    </div>
  );
};

const AcompanhamentoPage = async ({
  searchParams,
}: {
  searchParams?: { cliente?: string };
}): Promise<ReactElement> => {
  if (advogadoId() === null) {
    return (
      <>
        <h1 className="page-title">Acompanhamento processual</h1>
        <div className="card empty">Identifique-se na aba Perfil para acessar seus processos.</div>
      </>
    );
  }
  const data = await getJson<Acompanhamento>('/advogado/acompanhamento', 20000);
  if (!data) {
    return (
      <>
        <h1 className="page-title">Acompanhamento processual</h1>
        <div className="error-box">
          Acompanhamento indisponível no momento. Tente de novo em instantes.
        </div>
      </>
    );
  }
  const abertos = data.alertas.filter((a) => !a.ciente);
  const cientes = data.alertas.filter((a) => a.ciente);
  const clienteAberto = searchParams?.cliente ?? null;
  const comProcesso = data.clientes.filter((c) => c.processos.length > 0).length;

  return (
    <>
      <h1 className="page-title">Acompanhamento processual</h1>
      <p className="page-sub">
        Os processos dos seus clientes, acompanhados automaticamente pelo DataJud e pelo DJEN. Cada
        intimação publicada ganha um parecer da AHRI: o que o juiz determinou, quem precisa agir e o
        prazo.
      </p>
      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0 }}>
          <strong>Sobre os vencimentos:</strong> são estimativas em dias úteis a partir da
          publicação no DJEN, sem feriados locais. Confira sempre a contagem oficial no processo
          (eproc). O parecer resume o texto publicado e não substitui a leitura do advogado.
        </p>
        {!data.parecerDisponivel ? (
          <p style={{ margin: '6px 0 0' }}>
            O parecer automático está desligado nesta instalação — o texto publicado continua
            disponível em cada processo.
          </p>
        ) : null}
        {data.aguardandoParecer > 0 ? (
          <p style={{ margin: '6px 0 0' }}>
            {data.aguardandoParecer === 1
              ? '1 intimação recebendo parecer agora'
              : `${String(data.aguardandoParecer)} intimações recebendo parecer agora`}{' '}
            — atualize a página em alguns minutos.
          </p>
        ) : null}
      </div>

      <h3>Prazos e providências</h3>
      {abertos.length === 0 ? (
        <div className="card empty" style={{ marginBottom: 16 }}>
          Nenhum prazo em aberto nos seus processos.
        </div>
      ) : (
        abertos.map((a) => <AlertaCard key={a.chave} a={a} />)
      )}
      {cientes.length > 0 ? (
        <details style={{ margin: '8px 0 16px' }}>
          <summary style={{ cursor: 'pointer' }}>
            Já marcados como ciente ({cientes.length})
          </summary>
          <div style={{ marginTop: 8 }}>
            {cientes.map((a) => (
              <AlertaCard key={a.chave} a={a} />
            ))}
          </div>
        </details>
      ) : null}

      <h3 id="clientes">
        Clientes ({data.clientes.length} · {comProcesso} com processo cadastrado)
      </h3>
      <p className="page-sub" style={{ marginTop: 0 }}>
        Clique no nome do cliente para ver os processos e o parecer de cada movimentação.
      </p>
      {data.clientes.length === 0 ? (
        <div className="card empty">Nenhum cliente entregue a você ainda.</div>
      ) : (
        data.clientes.map((c) => (
          <details
            key={c.chatId}
            className="card"
            open={clienteAberto === c.chatId}
            style={{ marginBottom: 10 }}
          >
            <summary style={{ cursor: 'pointer' }}>
              <strong>{c.nome}</strong>{' '}
              <span className="badge dim">
                {c.processos.length === 1
                  ? '1 processo'
                  : `${String(c.processos.length)} processos`}
              </span>{' '}
              {c.alertas > 0 ? (
                <span className="badge bad">
                  {c.alertas === 1 ? '1 prazo' : `${String(c.alertas)} prazos`}
                </span>
              ) : null}
            </summary>
            {c.processos.length === 0 ? (
              <div className="empty" style={{ marginTop: 8 }}>
                Ainda sem processo distribuído cadastrado pelo escritório.
              </div>
            ) : (
              c.processos.map((p) => <Processo key={p.numero} p={p} />)
            )}
          </details>
        ))
      )}
    </>
  );
};

export default AcompanhamentoPage;
