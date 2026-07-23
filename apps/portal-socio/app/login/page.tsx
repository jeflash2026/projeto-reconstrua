'use client';
// LOGIN do Portal do SÓCIO — credencial INDIVIDUAL por CPF (convite do Admin →
// senha própria). Tela NUA: nada abre sem autenticação.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { loginSocio } from '../../lib/actions';

const LoginPage = (): ReactElement => {
  const router = useRouter();
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entrar = async (): Promise<void> => {
    if (busy || senha === '' || cpf.trim() === '') return;
    setBusy(true);
    setErro(null);
    const result = await loginSocio(cpf, senha);
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
        <h1 className="page-title">Painel do Sócio</h1>
        <p className="page-sub">
          Entre com o seu CPF e a sua senha. Ainda não tem senha? Use o link de cadastro que o
          administrador enviou a você.
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
            inputMode="numeric"
            placeholder="Seu CPF (só números)"
            value={cpf}
            autoFocus
            onChange={(e) => {
              setCpf(e.target.value);
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
