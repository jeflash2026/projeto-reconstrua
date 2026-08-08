'use client';
// LOGIN do Painel Jurídico — dono + sócio (usuário e senha próprios).
import { useState, type ReactElement } from 'react';

export default function LoginPage(): ReactElement {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function entrar(): Promise<void> {
    setErro(null);
    setOcupado(true);
    try {
      const res = await fetch('/juridico/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ usuario, senha }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error ?? 'usuário ou senha inválidos');
        return;
      }
      // Navegação COMPLETA: garante que os cookies novos valem já na 1ª página.
      window.location.href = '/juridico';
    } catch {
      setErro('falha de rede — tente de novo');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="login-caixa">
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div className="topo-marca" style={{ justifyContent: 'center' }}>
          <span className="selo">⚖ Jurídico</span>
        </div>
        <h1 className="titulo" style={{ marginTop: 10 }}>
          Painel Jurídico
        </h1>
        <p className="subtitulo">Projeto Reconstrua · operado pela AHRI Tecnologia</p>
      </div>
      <div className="secao-form">
        <div className="campo" style={{ marginBottom: 10 }}>
          <span>Usuário</span>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>
        <div className="campo" style={{ marginBottom: 14 }}>
          <span>Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void entrar();
            }}
          />
        </div>
        {erro !== null ? <div className="erro-box">{erro}</div> : null}
        <button
          className="btn primario"
          style={{ width: '100%', justifyContent: 'center' }}
          disabled={ocupado || usuario.trim() === '' || senha === ''}
          onClick={() => void entrar()}
        >
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </div>
  );
}
