'use client';
// SÓCIOS PANEL (Decreto 2026-07-23) — o Admin cadastra o sócio (CPF + nome +
// participação), gera o LINK de cadastro (o sócio cria a própria senha por CPF) e
// vê o valor estimado que cabe a cada um (fatia do potencial recuperável de hoje).
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { type SocioAdminView } from '../lib/api';
import { fetchSocios, cadastrarSocio, gerarConviteSocio } from '../lib/actions';
import { formatMoney } from '../lib/format';

function formatarCpf(bruto: string): string {
  const so = bruto.replace(/\D/g, '');
  if (so.length !== 11) return bruto;
  return `${so.slice(0, 3)}.${so.slice(3, 6)}.${so.slice(6, 9)}-${so.slice(9)}`;
}

const SociosPanel = (): ReactElement => {
  const [socios, setSocios] = useState<SocioAdminView[] | null>(null);
  const [cpf, setCpf] = useState('');
  const [nome, setNome] = useState('');
  const [percentual, setPercentual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [convite, setConvite] = useState<{ cpf: string; link: string } | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const res = await fetchSocios();
    setSocios(res?.socios ?? null);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 10000);
    return () => {
      window.clearInterval(id);
    };
  }, [load]);

  const register = async (): Promise<void> => {
    setError(null);
    setConvite(null);
    const pct = Number(percentual.replace(',', '.'));
    if (nome.trim() === '') {
      setError('Informe o nome do sócio.');
      return;
    }
    if (cpf.replace(/\D/g, '').length !== 11) {
      setError('Informe um CPF com 11 dígitos.');
      return;
    }
    if (!Number.isFinite(pct) || pct <= 0) {
      setError('Informe a participação (%) — ex.: 5 ou 10.');
      return;
    }
    // participação em % → pontos-base (bps): 5% = 500, 10% = 1000.
    const res = await cadastrarSocio(cpf, nome, Math.round(pct * 100));
    if (!res.ok) {
      setError(res.error ?? 'Falha ao cadastrar o sócio.');
      return;
    }
    setCpf('');
    setNome('');
    setPercentual('');
    await load();
  };

  const convidar = async (cpfDoSocio: string): Promise<void> => {
    setError(null);
    setConvite(null);
    const res = await gerarConviteSocio(cpfDoSocio);
    if (res.link === null) {
      setError(res.error ?? 'Falha ao gerar o link.');
      return;
    }
    setConvite({ cpf: cpfDoSocio, link: res.link });
  };

  const totalEstimado = (socios ?? []).reduce((acc, s) => acc + s.valorEstimado, 0);

  return (
    <>
      <h1 className="page-title">Sócios</h1>
      <p className="page-sub">
        Participação no resultado da AHRI. Rateio do potencial recuperável: cliente 60% · advogado
        sócio 20% · AHRI 20% (dividido entre os sócios abaixo). O sócio entra só com CPF e senha —
        gere o link para ele criar a própria senha.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Cadastrar sócio</h3>
        <div className="form-row">
          <input
            placeholder="Nome completo"
            value={nome}
            onChange={(e) => {
              setNome(e.target.value);
            }}
          />
          <input
            placeholder="CPF (só números)"
            value={cpf}
            onChange={(e) => {
              setCpf(e.target.value);
            }}
          />
          <input
            placeholder="Participação % (ex.: 5)"
            value={percentual}
            inputMode="decimal"
            style={{ maxWidth: 160 }}
            onChange={(e) => {
              setPercentual(e.target.value);
            }}
          />
          <button
            className="primary"
            onClick={() => {
              void register();
            }}
          >
            Cadastrar
          </button>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
      </div>

      {convite !== null ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Link de cadastro gerado (válido por 7 dias)</h3>
          <p className="page-sub">
            Envie este link ao sócio <span className="mono">{formatarCpf(convite.cpf)}</span>. Nele,
            ele confirma o CPF e cria a própria senha. Depois, entra só com CPF + senha.
          </p>
          <pre style={{ overflow: 'auto', userSelect: 'all' }}>{convite.link}</pre>
        </div>
      ) : null}

      <div className="card">
        <h3>Sócios cadastrados</h3>
        {socios === null ? (
          <div className="error-box">API indisponível.</div>
        ) : socios.length === 0 ? (
          <div className="empty">Nenhum sócio cadastrado ainda.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CPF (login)</th>
                    <th>Participação</th>
                    <th>Valor estimado</th>
                    <th>Cadastro</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {socios.map((s) => (
                    <tr key={s.cpf}>
                      <td style={{ fontWeight: 600 }}>{s.nome}</td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {formatarCpf(s.cpf)}
                      </td>
                      <td>{s.percentual}</td>
                      <td>{formatMoney(s.valorEstimado)}</td>
                      <td>
                        {s.temSenha ? (
                          <span className="badge ok">senha criada</span>
                        ) : (
                          <span className="badge bad">aguardando link</span>
                        )}
                        {!s.ativo ? (
                          <span className="badge bad" style={{ marginLeft: 4 }}>
                            inativo
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {s.ativo ? (
                          <button
                            onClick={() => {
                              void convidar(s.cpf);
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
              Soma estimada dos sócios hoje: <strong>{formatMoney(totalEstimado)}</strong> (fatia do
              potencial recuperável total da carteira).
            </p>
          </>
        )}
      </div>
    </>
  );
};

export default SociosPanel;
