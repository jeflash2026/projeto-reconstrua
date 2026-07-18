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
          Entre com o seu ID e a sua senha. Ainda não tem senha? Use o link de convite que o
          escritório enviou a você.
        </p>
        <form
          className="form-row"
          onSubmit={(e) => { e.preventDefault(); void entrar(); }}
          style={{ flexDirection: 'column', alignItems: 'stretch' }}
        >
          <input
            type="text"
            placeholder="Seu ID de advogado"
            value={id}
            autoFocus
            onChange={(e) => { setId(e.target.value); }}
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={senha}
            onChange={(e) => { setSenha(e.target.value); }}
          />
          <button type="submit" className="primary" disabled={busy || senha === '' || id.trim() === ''}>
            Entrar
          </button>
        </form>
        {erro ? <div className="error-box" style={{ marginTop: 12 }}>{erro}</div> : null}
      </div>
    </div>
  );
};

export default LoginPage;
