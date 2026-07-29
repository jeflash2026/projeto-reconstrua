'use client';
// LOGIN do Portal do Advogado (GO-LIVE-04) — tela NUA: nenhum menu, nenhuma rota,
// nenhum dado antes da autenticação. Credencial INDIVIDUAL (criada pelo convite
// do escritório) — a senha global de transporte não autentica pessoas.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { loginAdvogado } from '../../lib/actions';

const LoginPage = (): ReactElement => {
  const router = useRouter();
  const [id, setId] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entrar = async (): Promise<void> => {
    if (busy || senha === '' || id.trim() === '') return;
    setBusy(true);
    setErro(null);
    const result = await loginAdvogado(id, senha);
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
        <h1 className="page-title">Identifique-se</h1>
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
            inputMode="numeric"
            placeholder="Seu CPF"
            value={id}
            autoFocus
            onChange={(e) => {
              setId(e.target.value);
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
          <button
            type="submit"
            className="primary"
            disabled={busy || senha === '' || id.trim() === ''}
          >
            Entrar
          </button>
        </form>
        {erro ? (
          <div className="error-box" style={{ marginTop: 12 }}>
            {erro}
          </div>
        ) : null}
        {/* Decreto 2026-07-29: caminho CLARO para criar/alterar a senha — a
            redefinição é sempre por um NOVO link de convite do escritório
            (nunca por e-mail/URL pública: fail-closed do GO-LIVE-04). */}
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--accent)' }}>
            Esqueceu a senha ou quer alterá-la?
          </summary>
          <p className="page-sub" style={{ marginTop: 8 }}>
            A senha é criada e alterada por um <strong>link de convite</strong> emitido pelo
            escritório. Peça um novo link ao administrador — ao abri-lo, você define a nova senha na
            hora (a antiga deixa de valer). Depois é só entrar aqui com o seu CPF e a senha nova.
          </p>
        </details>
      </div>
    </div>
  );
};

export default LoginPage;
