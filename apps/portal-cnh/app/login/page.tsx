'use client';
// LOGIN do Painel CNH — nome de quem opera (assina as ações) + senha do painel.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { entrar } from '../../lib/actions';

const LoginPage = (): ReactElement => {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (): Promise<void> => {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    const r = await entrar(nome, senha);
    if (!r.ok) {
      setErro(r.error ?? 'não foi possível entrar');
      setOcupado(false);
      return;
    }
    router.push('/');
    router.refresh();
  };

  return (
    <div className="acesso">
      <aside className="acesso-lado">
        <div className="marca">
          <img src="/cnh/icone.png" alt="" />
          <div>
            <div className="marca-nome">
              Reconstrua <span>CNH</span>
            </div>
            <div className="marca-sub">Operado pela AHRI Tecnologia</div>
          </div>
        </div>
        <div>
          <div className="kicker" style={{ color: 'var(--marca)' }}>
            Painel de captação
          </div>
          <div className="acesso-titulo">Cada lead da CNH, do primeiro oi até o contrato.</div>
          <p>
            A AHRI atende pelo roteiro do escritório; aqui você acompanha as conversas, assume
            quando precisa, aprova os follow-ups e cuida dos aceites.
          </p>
        </div>
        <div className="marca-sub">Acesso restrito à equipe</div>
      </aside>
      <main className="acesso-form">
        <form
          className="acesso-caixa"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
        >
          <h2>Entrar</h2>
          <p>O seu nome aparece em cada ação que você fizer no painel.</p>
          <label className="campo">
            <span>Seu nome</span>
            <input
              value={nome}
              autoFocus
              autoComplete="name"
              onChange={(e) => {
                setNome(e.target.value);
              }}
            />
          </label>
          <label className="campo">
            <span>Senha do painel</span>
            <input
              type="password"
              value={senha}
              autoComplete="current-password"
              onChange={(e) => {
                setSenha(e.target.value);
              }}
            />
          </label>
          <button
            type="submit"
            className="btn primario"
            style={{ width: '100%', justifyContent: 'center', padding: 12 }}
            disabled={ocupado || nome.trim() === '' || senha === ''}
          >
            {ocupado ? 'Entrando…' : 'Entrar'}
          </button>
          {erro !== null ? <div className="erro">{erro}</div> : null}
        </form>
      </main>
    </div>
  );
};

export default LoginPage;
