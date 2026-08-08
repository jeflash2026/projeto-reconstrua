'use client';
// ACESSOS DO PAINEL JURÍDICO — o Admin cria e remove os logins do 2º painel
// (dono + sócio) com um clique; a lista nunca mostra senha (só login e nome).
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { criarAcessoJuridico, removerAcessoJuridico } from '../lib/actions';

export interface AcessoJuridico {
  id: string;
  usuario: string;
  nome: string;
  em: string;
}

export default function JuridicoAcessos({ acessos }: { acessos: AcessoJuridico[] }): ReactElement {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function criar(): Promise<void> {
    setErro(null);
    setAviso(null);
    if (usuario.trim() === '' || nome.trim() === '' || senha.length < 6) {
      setErro('preencha usuário, nome e uma senha com pelo menos 6 caracteres');
      return;
    }
    setBusy(true);
    const r = await criarAcessoJuridico(usuario.trim(), nome.trim(), senha);
    setBusy(false);
    if (!r.ok) {
      setErro(r.error ?? 'falha ao criar o acesso');
      return;
    }
    setAviso(`Acesso "${usuario.trim()}" criado — já pode entrar em /juridico.`);
    setUsuario('');
    setNome('');
    setSenha('');
    router.refresh();
  }

  async function remover(a: AcessoJuridico): Promise<void> {
    if (
      !window.confirm(
        `Remover o acesso de ${a.nome} (${a.usuario})? A pessoa não conseguirá mais entrar.`,
      )
    )
      return;
    setBusy(true);
    const ok = await removerAcessoJuridico(a.id);
    setBusy(false);
    if (!ok) setErro('falha ao remover o acesso');
    else router.refresh();
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Novo acesso</h3>
        <p className="page-sub">
          A senha é definida aqui e entregue por você à pessoa (mínimo 6 caracteres). Para trocar
          uma senha, remova o acesso e crie de novo com a senha nova.
        </p>
        <div className="form-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input
            type="text"
            placeholder="Login (ex.: jesse)"
            value={usuario}
            autoComplete="off"
            onChange={(e) => setUsuario(e.target.value)}
          />
          <input
            type="text"
            placeholder="Nome (assina as ações)"
            value={nome}
            autoComplete="off"
            onChange={(e) => setNome(e.target.value)}
          />
          <input
            type="password"
            placeholder="Senha (mín. 6)"
            value={senha}
            autoComplete="new-password"
            onChange={(e) => setSenha(e.target.value)}
          />
          <button className="primary" disabled={busy} onClick={() => void criar()}>
            Criar acesso
          </button>
        </div>
        {erro !== null ? <div className="error-box">{erro}</div> : null}
        {aviso !== null ? (
          <div className="badge ok" style={{ marginTop: 8 }}>
            {aviso}
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3>Acessos ativos ({acessos.length})</h3>
        {acessos.length === 0 ? (
          <div className="empty">Nenhum acesso criado ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Login</th>
                  <th>Nome</th>
                  <th>Criado em</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {acessos.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.usuario}</td>
                    <td style={{ fontWeight: 600 }}>{a.nome}</td>
                    <td>{new Date(a.em).toLocaleDateString('pt-BR')}</td>
                    <td>
                      <button disabled={busy} onClick={() => void remover(a)}>
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
