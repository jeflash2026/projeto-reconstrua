'use client';
// LOGIN do Portal do ATENDIMENTO HUMANIZADO — credencial INDIVIDUAL (convite do
// escritório → senha própria; login pelo CPF). Tela NUA: nada abre sem sessão.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { loginHumanizado } from '../../lib/actions';

const LoginPage = (): ReactElement => {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entrar = async (): Promise<void> => {
    if (busy || senha === '' || login.trim() === '') return;
    setBusy(true);
    setErro(null);
    const result = await loginHumanizado(login, senha);
    if (!result.ok) {
      setErro(result.error ?? 'falha no login');
    } else {
      router.push('/');
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 420, margin: '10vh auto', padding: '0 16px' }}>
      <div className="card">
        <h1 className="page-title">Atendimento Humanizado</h1>
        <p className="page-sub">
          Entre com o seu CPF e a sua senha. Ainda não tem senha? Use o link de convite que o
          escritório enviou a você.
        </p>
        <form
          className="form-row"
          onSubmit={(e) => {
            e.preventDefault();
            void entrar();
          }}
          style={{ flexDirection: 'column', alignItems: 'stretch' }}
        >
          <input
            type="text"
            placeholder="Seu CPF"
            value={login}
            autoFocus
            onChange={(e) => {
              setLogin(e.target.value);
            }}
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
            }}
          />
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
          {erro !== null ? <div className="error-box">{erro}</div> : null}
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
