'use client';
// LOGIN do Portal Admin — visitante → login → painel (nunca painel direto).
// Prova do segredo de acesso (BL-2.1). Se ainda não existir NENHUM administrador
// cadastrado, o mesmo fluxo conclui o BOOTSTRAP SEGURO do 1º administrador
// (exige o segredo; usa o diretório de equipe existente — nada novo).
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { bootstrapAdmin, loginAdmin } from '../../lib/actions';

const LoginPage = (): ReactElement => {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [fase, setFase] = useState<'login' | 'bootstrap'>('login');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entrar = async (): Promise<void> => {
    if (busy || senha.trim() === '') return;
    setBusy(true);
    setErro(null);
    const result = await loginAdmin(senha);
    if (!result.ok) {
      setErro(result.error ?? 'falha no login');
    } else if (result.needsBootstrap === true) {
      setFase('bootstrap');
    } else {
      router.push('/');
      router.refresh();
    }
    setBusy(false);
  };

  const cadastrar = async (): Promise<void> => {
    if (busy || nome.trim() === '') return;
    setBusy(true);
    setErro(null);
    const result = await bootstrapAdmin(senha, nome);
    if (!result.ok) {
      setErro(result.error ?? 'falha no cadastro');
    } else {
      router.push('/');
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 420, margin: '10vh auto', padding: '0 16px' }}>
      <div className="card">
        <h1 className="page-title">Reconstrua — Administração</h1>
        {fase === 'login' ? (
          <>
            <p className="page-sub">Informe a senha de acesso do administrador.</p>
            <form
              className="form-row"
              onSubmit={(e) => { e.preventDefault(); void entrar(); }}
              style={{ flexDirection: 'column', alignItems: 'stretch' }}
            >
              <input
                type="password"
                placeholder="Senha de acesso"
                value={senha}
                autoFocus
                onChange={(e) => { setSenha(e.target.value); }}
              />
              <button type="submit" className="primary" disabled={busy || senha.trim() === ''}>
                Entrar
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="page-sub">
              Nenhum administrador cadastrado ainda. Informe seu nome para concluir o cadastro
              do primeiro administrador.
            </p>
            <form
              className="form-row"
              onSubmit={(e) => { e.preventDefault(); void cadastrar(); }}
              style={{ flexDirection: 'column', alignItems: 'stretch' }}
            >
              <input
                type="text"
                placeholder="Seu nome completo"
                value={nome}
                autoFocus
                onChange={(e) => { setNome(e.target.value); }}
              />
              <button type="submit" className="primary" disabled={busy || nome.trim() === ''}>
                Cadastrar e entrar
              </button>
            </form>
          </>
        )}
        {erro ? <div className="error-box" style={{ marginTop: 12 }}>{erro}</div> : null}
      </div>
    </div>
  );
};

export default LoginPage;
