'use client';
// INVESTIDORES PANEL (2026-09-16) — o Admin cadastra o investidor (nome + CPF),
// gera o LINK de acesso (ele cria a própria senha e entra com CPF + senha no
// portal /investidor) e acompanha a carteira: valor hoje, o que já foi
// realizado e cada processo (com o nome completo do cliente — o investidor só
// vê as iniciais). A carteira nasce no Founder Console, com confirmação.
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  cadastrarInvestidor,
  fetchCarteiraInvestidor,
  fetchInvestidores,
  gerarConviteInvestidor,
  retirarProcessoInvestidor,
  type CarteiraAdmin,
  type InvestidorAdminView,
} from '../lib/actions';
import { formatMoney } from '../lib/format';

function formatarCpf(bruto: string): string {
  const so = bruto.replace(/\D/g, '');
  if (so.length !== 11) return bruto;
  return `${so.slice(0, 3)}.${so.slice(3, 6)}.${so.slice(6, 9)}-${so.slice(9)}`;
}

const InvestidoresPanel = (): ReactElement => {
  const [investidores, setInvestidores] = useState<InvestidorAdminView[] | null>(null);
  // 'carregando' ≠ erro: antes a tela dizia "API indisponível" enquanto esperava.
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [convite, setConvite] = useState<{ nome: string; link: string } | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [carteira, setCarteira] = useState<CarteiraAdmin | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async (): Promise<void> => {
    setCarregando(true);
    const r = await fetchInvestidores();
    setInvestidores(r?.investidores ?? null);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirCarteira = async (cpfDoInvestidor: string): Promise<void> => {
    setAviso(null);
    if (aberto === cpfDoInvestidor) {
      setAberto(null);
      setCarteira(null);
      return;
    }
    setAberto(cpfDoInvestidor);
    setCarteira(null);
    setCarteira(await fetchCarteiraInvestidor(cpfDoInvestidor));
  };

  const cadastrar = async (): Promise<void> => {
    setErro(null);
    setConvite(null);
    if (nome.trim() === '') {
      setErro('Informe o nome do investidor.');
      return;
    }
    if (cpf.replace(/\D/g, '').length !== 11) {
      setErro('Informe um CPF com 11 dígitos.');
      return;
    }
    const r = await cadastrarInvestidor({ cpf, nome, email, telefone });
    if (!r.ok) {
      setErro(r.error ?? 'Falha ao cadastrar.');
      return;
    }
    setNome('');
    setCpf('');
    setEmail('');
    setTelefone('');
    await carregar();
  };

  const convidar = async (inv: InvestidorAdminView): Promise<void> => {
    setErro(null);
    setConvite(null);
    const r = await gerarConviteInvestidor(inv.cpf);
    if (r.link === null) {
      setErro(r.error ?? 'Falha ao gerar o link.');
      return;
    }
    setConvite({ nome: inv.nome, link: r.link });
  };

  const retirar = async (numero: string): Promise<void> => {
    if (aberto === null) return;
    const motivo = window.prompt(
      `Retirar o processo ${numero} da carteira? Informe o motivo (fica no extrato do investidor):`,
    );
    if (motivo === null) return;
    const r = await retirarProcessoInvestidor(aberto, numero, motivo);
    if (r === null || !r.ok) {
      setAviso(r?.error ?? 'Não foi possível retirar o processo.');
      return;
    }
    setAviso(`Processo ${numero} retirado da carteira.`);
    setCarteira(await fetchCarteiraInvestidor(aberto));
    await carregar();
  };

  const totalCarteiras = (investidores ?? []).reduce((s, i) => s + i.valorAtual, 0);

  return (
    <>
      <h1 className="page-title">Investidores</h1>
      <p className="page-sub">
        Carteiras de créditos judiciais: o investidor compra, antecipado, a parte da empresa (49%)
        no resultado dos processos — R$ 10.000 de referência por processo, ajustado pelo valor real
        quando o processo é pago. Cadastre o investidor, gere o link de acesso e monte a carteira no
        Founder Console, ex.: “adicione uma carteira de 250 mil em processos para o investidor
        João”.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Cadastrar investidor</h3>
        <div className="form-row" style={{ flexWrap: 'wrap' }}>
          <input
            placeholder="Nome completo"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
            }}
          />
          <input
            placeholder="CPF (login)"
            value={cpf}
            inputMode="numeric"
            style={{ maxWidth: 180 }}
            onChange={(e) => {
              setCpf(e.target.value);
            }}
          />
          <input
            placeholder="E-mail (opcional)"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
          />
          <input
            placeholder="Telefone (opcional)"
            value={telefone}
            style={{ maxWidth: 180 }}
            onChange={(e) => {
              setTelefone(e.target.value);
            }}
          />
          <button
            className="primary"
            onClick={() => {
              void cadastrar();
            }}
          >
            Cadastrar
          </button>
        </div>
        {erro !== null ? <div className="error-box">{erro}</div> : null}
      </div>

      {convite !== null ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Link de acesso gerado (válido por 7 dias)</h3>
          <p className="page-sub">
            Envie a {convite.nome}. No link, ele confirma o CPF e cria a própria senha; depois entra
            só com CPF e senha em /investidor.
          </p>
          <pre style={{ overflow: 'auto', userSelect: 'all' }}>{convite.link}</pre>
        </div>
      ) : null}

      <div className="card">
        <h3>Investidores cadastrados</h3>
        {investidores === null && carregando ? (
          <div className="empty">Carregando os investidores…</div>
        ) : investidores === null ? (
          <div className="error-box">
            Não foi possível carregar a lista agora — atualize a página em instantes.
          </div>
        ) : investidores.length === 0 ? (
          <div className="empty">Nenhum investidor cadastrado ainda.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CPF (login)</th>
                    <th>Processos</th>
                    <th>Crédito (limite)</th>
                    <th>Carteira hoje</th>
                    <th>Recebido</th>
                    <th>Acesso</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {investidores.map((i) => (
                    <tr key={i.cpf}>
                      <td style={{ fontWeight: 600 }}>{i.nome}</td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {formatarCpf(i.cpf)}
                      </td>
                      <td>{i.processos}</td>
                      <td>
                        {formatMoney(i.credito)}{' '}
                        <span className="badge dim">{formatMoney(i.limite)}</span>
                      </td>
                      <td>{formatMoney(i.valorAtual)}</td>
                      <td>{formatMoney(i.recebido)}</td>
                      <td>
                        {i.temSenha ? (
                          <span className="badge ok">senha criada</span>
                        ) : (
                          <span className="badge bad">aguardando link</span>
                        )}
                        {!i.ativo ? (
                          <span className="badge bad" style={{ marginLeft: 4 }}>
                            inativo
                          </span>
                        ) : null}
                      </td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => {
                            void abrirCarteira(i.cpf);
                          }}
                        >
                          {aberto === i.cpf ? 'Fechar carteira' : 'Ver carteira'}
                        </button>
                        {i.ativo ? (
                          <button
                            onClick={() => {
                              void convidar(i);
                            }}
                          >
                            Gerar link
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="page-sub" style={{ marginTop: 12 }}>
              Soma das carteiras hoje: <strong>{formatMoney(totalCarteiras)}</strong> (recebido +
              apurado + referência dos processos em curso, respeitando o limite de cada crédito).
            </p>
          </>
        )}
      </div>

      {aberto !== null ? (
        <div className="card" style={{ marginTop: 16 }}>
          {carteira === null ? (
            <div className="empty">Carregando a carteira…</div>
          ) : (
            <>
              <h3>Carteira de {carteira.nome}</h3>
              <p className="page-sub">
                Crédito {formatMoney(carteira.totais.credito)} (limite{' '}
                {formatMoney(carteira.totais.limite)}) · {carteira.totais.processos} processo(s) ·
                hoje {formatMoney(carteira.totais.valorAtual)} · recebido{' '}
                {formatMoney(carteira.totais.recebido)} · apurado{' '}
                {formatMoney(carteira.totais.apurado)} · a receber{' '}
                {formatMoney(carteira.totais.aReceber)} · {carteira.totais.pagos} pago(s),{' '}
                {carteira.totais.perdidos} sem êxito
                {(carteira.totais.excedenteEmpresa ?? 0) > 0
                  ? ` · excedente que fica com a empresa: ${formatMoney(carteira.totais.excedenteEmpresa ?? 0)}`
                  : ''}
              </p>
              {aviso !== null ? <div className="error-box">{aviso}</div> : null}
              {carteira.processos.length === 0 ? (
                <div className="empty">
                  Carteira vazia — monte no Founder Console com um comando de carteira.
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Processo</th>
                        <th>Cliente</th>
                        <th>Bancos</th>
                        <th>Advogado</th>
                        <th>Fase</th>
                        <th>Parte do investidor</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {carteira.processos.map((p) => (
                        <tr key={p.numero}>
                          <td className="mono" style={{ fontSize: 12 }}>
                            <a href={`/juridico/processos/${p.numero.replace(/\D/g, '')}`}>
                              {p.numero}
                            </a>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{p.clienteNome ?? '—'}</span>{' '}
                            <span className="badge dim">{p.iniciais}</span>
                          </td>
                          <td>{p.bancos.join(', ')}</td>
                          <td>{p.advogado ?? '—'}</td>
                          <td>{p.faseRotulo}</td>
                          <td>
                            <strong>{formatMoney(p.valor.parte)}</strong>{' '}
                            <span className="badge dim">
                              {p.valor.tipo === 'referencia'
                                ? 'referência'
                                : p.valor.tipo === 'apurado'
                                  ? 'apurado'
                                  : p.valor.tipo === 'recebido'
                                    ? 'recebido'
                                    : 'sem êxito'}
                            </span>
                          </td>
                          <td>
                            {p.valor.tipo === 'referencia' ? (
                              <button
                                onClick={() => {
                                  void retirar(p.numero);
                                }}
                              >
                                Retirar
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="page-sub" style={{ marginTop: 12 }}>
                O valor real entra quando você lança o resultado na ficha do processo, no Painel
                Jurídico: valor apurado na execução, pago, ou encerrado sem êxito.
              </p>
            </>
          )}
        </div>
      ) : null}
    </>
  );
};

export default InvestidoresPanel;
