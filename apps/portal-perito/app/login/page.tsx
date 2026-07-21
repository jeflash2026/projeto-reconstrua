'use client';
// LOGIN do Portal do PERITO — tela NUA: nada abre sem a senha própria do perito.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { loginPerito } from '../../lib/actions';

const LoginPage = (): ReactElement => {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entrar = async (): Promise<void> => {
    if (busy || senha === '') return;
    setBusy(true);
    setErro(null);
    const result = await loginPerito(senha);
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
        <h1 className="page-title">Central do Perito</h1>
        <p className="page-sub">Entre com a senha de acesso do perito.</p>
        <form
          className="form-row"
          onSubmit={(e) => {
            e.preventDefault();
            void entrar();
          }}
          style={{ flexDirection: 'column', alignItems: 'stretch' }}
        >
          <input
            type="password"
            placeholder="Senha de acesso"
            value={senha}
            autoFocus
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
